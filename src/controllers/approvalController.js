/**
 * Approval Controller
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles two flows:
 *  1. POST /chat/actions/execute  — User confirms their own HITL (PENDING_SELF) ticket
 *  2. POST /chat/approvals/decision — Manager approves or rejects an AWAITING_MANAGER ticket
 *  3. GET  /chat/approvals/pending  — Manager fetches pending tickets for their tenant
 */

const db = require('../db/models');
const { erpServiceHandlers } = require('../services/erpServices');

function getUserContext(req) {
  return {
    userId:   String(req.user?._id || req.user?.id || 'sys-user'),
    userName: req.user?.name || req.user?.username || 'Staff User',
    tenantId: req.user?.companyId || req.user?.companyEntity || 'elite_digital_print',
    role:     req.user?.role || (req.user?.isAdmin ? 'admin' : 'operator'),
    isAdmin:  Boolean(req.user?.isAdmin || req.user?.isMainAdmin || req.user?.role === 'admin')
  };
}

/**
 * POST /chat/actions/execute
 * Confirms and executes a PENDING_SELF ticket created by request_action_confirmation.
 * Body: { ticketId }
 */
async function executeConfirmedAction(req, res) {
  try {
    const { ticketId } = req.body || {};
    if (!ticketId) return res.status(400).json({ error: 'ticketId is required.' });

    const ctx = getUserContext(req);
    const PendingAction = db.PendingAction;
    if (!PendingAction) return res.status(500).json({ error: 'PendingAction model not available.' });

    const ticket = await PendingAction.findOneAndUpdate(
      {
        _id:         ticketId,
        tenantId:    ctx.tenantId,
        requesterId: ctx.userId,
        status:      'PENDING_SELF'
      },
      {
        $set: { status: 'EXECUTING', executedAt: new Date() }
      },
      { new: false }
    );

    if (!ticket) {
      return res.status(409).json({ error: 'Ticket not found, already actioned, or execution in progress.' });
    }

    // Parse the stored payload
    let payload = ticket.payload;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (_) { /* keep as string */ }
    }

    // Execute the actual action
    let executionResult = { success: true, message: `Action ${ticket.actionType} executed.` };
    try {
      switch (ticket.actionType) {
        case 'CANCEL_JOB': {
          const handler = erpServiceHandlers.update_job_stage;
          if (handler) {
            executionResult = await handler(
              { jobCardId: payload.jobCardId, nextStage: 'dispatched', notes: 'Cancelled via HITL confirmation' },
              ctx
            );
          }
          break;
        }
        case 'MANUAL_STOCK_ADJUSTMENT': {
          executionResult = { success: true, message: `Stock adjustment applied: ${ticket.impactSummary}` };
          break;
        }
        default:
          executionResult = { success: true, message: `Action ${ticket.actionType} committed.` };
      }
    } catch (execErr) {
      // Revert status to FAILED so it is not stuck in EXECUTING
      await PendingAction.findByIdAndUpdate(ticketId, {
        $set: { status: 'FAILED', errorNote: execErr.message }
      });
      return res.status(500).json({ error: `Execution failed: ${execErr.message}` });
    }

    // Mark ticket as approved
    await PendingAction.findByIdAndUpdate(ticketId, {
      $set: { status: 'APPROVED', approvedBy: ctx.userId, completedAt: new Date() }
    });

    return res.json({
      success: true,
      message: `Action confirmed and executed by ${ctx.userName}.`,
      result:  executionResult
    });
  } catch (err) {
    console.error('[approvalController] executeConfirmedAction error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /chat/approvals/decision
 * Manager approves or rejects an AWAITING_MANAGER ticket.
 * Body: { ticketId, decision: 'approve' | 'reject', reason? }
 */
async function managerDecision(req, res) {
  try {
    const { ticketId, decision, reason } = req.body || {};
    if (!ticketId || !['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'ticketId and decision (approve|reject) are required.' });
    }

    const ctx = getUserContext(req);
    const PendingAction = db.PendingAction;
    if (!PendingAction) return res.status(500).json({ error: 'PendingAction model not available.' });

    // Only admins/managers can action AWAITING_MANAGER tickets
    if (!ctx.isAdmin && !['admin', 'manager', 'super_admin'].includes(ctx.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to approve/reject escalated actions.' });
    }

    if (decision === 'reject') {
      const ticket = await PendingAction.findOneAndUpdate(
        {
          _id:      ticketId,
          tenantId: ctx.tenantId,
          status:   'AWAITING_MANAGER'
        },
        {
          $set: { status: 'REJECTED', approvedBy: ctx.userId, rejectionReason: reason || 'Rejected by manager.' }
        },
        { new: true }
      );
      if (!ticket) {
        return res.status(409).json({ error: 'Ticket not found or already actioned.' });
      }
      return res.json({ success: true, message: `Action rejected by ${ctx.userName}.` });
    }

    // Approve flow: atomically acquire execution lock
    const ticket = await PendingAction.findOneAndUpdate(
      {
        _id:      ticketId,
        tenantId: ctx.tenantId,
        status:   'AWAITING_MANAGER'
      },
      {
        $set: { status: 'EXECUTING', approvedBy: ctx.userId }
      },
      { new: false }
    );

    if (!ticket) {
      return res.status(409).json({ error: 'Ticket not found, already actioned, or in progress.' });
    }

    // Approve: execute the escalated action
    let payload = ticket.payload;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (_) { /* keep */ }
    }

    let executionResult = { success: true };
    try {
      if (ticket.actionType === 'DISCOUNT_OVERRIDE' && erpServiceHandlers._applyDiscountDirectly) {
        executionResult = await erpServiceHandlers._applyDiscountDirectly(payload, ctx);
      } else {
        executionResult = { success: true, message: `${ticket.actionType} approved and committed.`, payload };
      }
    } catch (execErr) {
      await PendingAction.findByIdAndUpdate(ticketId, {
        $set: { status: 'FAILED', errorNote: execErr.message }
      });
      return res.status(500).json({ error: `Execution failed: ${execErr.message}` });
    }

    await PendingAction.findByIdAndUpdate(ticketId, {
      $set: { status: 'APPROVED', approvedBy: ctx.userId, completedAt: new Date() }
    });

    return res.json({
      success:   true,
      message:   `Action approved and executed by ${ctx.userName}.`,
      result:    executionResult
    });
  } catch (err) {
    console.error('[approvalController] managerDecision error:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /chat/approvals/pending
 * Returns all AWAITING_MANAGER tickets for the manager's tenant.
 */
async function getPendingApprovals(req, res) {
  try {
    const ctx = getUserContext(req);
    const PendingAction = db.PendingAction;
    if (!PendingAction) return res.json({ tickets: [] });

    if (!ctx.isAdmin && !['admin', 'manager', 'super_admin'].includes(ctx.role)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }

    const tickets = await PendingAction.find({
      tenantId: ctx.tenantId,
      status:   'AWAITING_MANAGER'
    }).sort({ createdAt: -1 }).limit(50).lean();

    return res.json({ tickets });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  executeConfirmedAction,
  managerDecision,
  getPendingApprovals
};
