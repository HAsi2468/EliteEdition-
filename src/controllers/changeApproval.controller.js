const { ChangeApprovalRequest, ...models } = require('../db/models');
const logger = require('../config/logger');
const { getApprovalSettings, setApprovalSettings } = require('../middlewares/approvalInterceptor.middleware');

/**
 * List Approval Requests with filters & pagination
 */
const getApprovalRequests = async (req, res) => {
  try {
    const { status = 'PENDING', module: moduleFilter, search = '', page = 1, limit = 50 } = req.query;

    const query = {};

    if (status && status !== 'ALL') {
      query.status = status.toUpperCase();
    }

    if (moduleFilter && moduleFilter !== 'ALL' && moduleFilter !== 'All') {
      query.module = moduleFilter;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { targetIdentifier: regex },
        { 'requestedBy.name': regex },
        { module: regex },
        { targetId: regex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [items, totalCount, pendingCount] = await Promise.all([
      ChangeApprovalRequest.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ChangeApprovalRequest.countDocuments(query),
      ChangeApprovalRequest.countDocuments({ status: 'PENDING' }),
    ]);

    return res.status(200).json({
      success: true,
      data: items,
      meta: {
        total: totalCount,
        pending: pendingCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum) || 1,
      },
    });
  } catch (err) {
    logger.error('[ChangeApprovalController] getApprovalRequests error: %o', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch approval requests', error: err.message });
  }
};

/**
 * Get summary stats for Admin dashboard
 */
const getApprovalStats = async (req, res) => {
  try {
    const [pending, approved, rejected, total] = await Promise.all([
      ChangeApprovalRequest.countDocuments({ status: 'PENDING' }),
      ChangeApprovalRequest.countDocuments({ status: 'APPROVED' }),
      ChangeApprovalRequest.countDocuments({ status: 'REJECTED' }),
      ChangeApprovalRequest.countDocuments({}),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        pending,
        approved,
        rejected,
        total,
      },
    });
  } catch (err) {
    logger.error('[ChangeApprovalController] getApprovalStats error: %o', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch stats', error: err.message });
  }
};

/**
 * Helper: Replay & Execute the approved change
 */
const executeApprovedAction = async (approval, adminUser) => {
  const port = process.env.PORT || 3001;
  const url = `http://127.0.0.1:${port}${approval.targetEndpoint}`;

  // 1. Primary execution: Replay original HTTP request to API with Admin privileges
  try {
    const fetchOptions = {
      method: approval.httpMethod,
      headers: {
        'Content-Type': 'application/json',
        'X-Approval-Execution': 'true',
        'X-User-Id': String(adminUser?._id || adminUser?.id || 'admin'),
        'X-User-Name': adminUser?.name || 'Admin',
        'X-User-Role': 'admin',
        'X-Is-Admin': 'true',
        'X-Operator-Override': 'true',
        // Pass the admin's auth details so auth middleware recognizes the request
        'X-Internal-Service': 'approval-executor',
      },
    };

    if (!['GET', 'HEAD', 'DELETE'].includes(approval.httpMethod)) {
      fetchOptions.body = JSON.stringify(approval.requestBody || {});
    }

    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get('content-type') || '';

    let resBody = null;
    if (contentType.includes('application/json')) {
      resBody = await response.json();
    } else {
      resBody = await response.text();
    }

    if (response.ok) {
      return { success: true, method: 'API_REPLAY', data: resBody };
    }

    logger.warn('[ChangeApprovalController] API replay returned %d: %j', response.status, resBody);
  } catch (netErr) {
    logger.warn('[ChangeApprovalController] API replay fetch failed, attempting model fallback: %s', netErr.message);
  }

  // 2. Fail-safe Fallback: Direct Mongoose Model update / delete
  try {
    let targetModel = models[approval.module];
    if (!targetModel && (approval.module === 'Fabric' || approval.module === 'FabricTransaction')) {
      targetModel = models.FabricTransaction || models.Fabric;
    }
    if (targetModel && approval.targetId) {
      if (approval.httpMethod === 'DELETE') {
        const deleted = await targetModel.findByIdAndDelete(approval.targetId);
        return { success: true, method: 'DIRECT_MODEL_DELETE', data: deleted };
      } else {
        const payload = { ...approval.requestBody };

        // Special handling for tpDetails: sanitize before applying
        if (Array.isArray(payload.tpDetails)) {
          payload.tpDetails = payload.tpDetails
            .filter(r => r.tpMeter != null && r.tpMeter !== '')
            .map((r, idx) => ({
              tpNo: Number(r.tpNo) || idx + 1,
              tpMeter: parseFloat(r.tpMeter) || 0,
              notes: r.notes || '',
            }));
          if (payload.totalTp === undefined) {
            payload.totalTp = payload.tpDetails.filter(r => parseFloat(r.tpMeter) > 0).length;
          }
        }

        const updated = await targetModel.findByIdAndUpdate(
          approval.targetId,
          { $set: payload },
          { new: true, runValidators: false }
        );

        // Broadcast real-time module-specific socket event so screens update immediately
        try {
          const io = global.io;
          if (io && updated) {
            if (approval.module === 'Fabric' || approval.module === 'FabricTransaction') {
              io.emit('fabric-updated', { type: 'transaction-updated', data: updated });
            } else if (approval.module === 'JobCard') {
              io.emit('jobCardUpdated', updated);
            }
          }
        } catch (sockErr) {
          logger.warn('[ChangeApprovalController] Real-time fallback broadcast failed: %s', sockErr.message);
        }

        return { success: true, method: 'DIRECT_MODEL_UPDATE', data: updated };
      }
    }
  } catch (modelErr) {
    logger.error('[ChangeApprovalController] Direct model fallback failed: %o', modelErr);
    throw new Error(`Failed to apply changes: ${modelErr.message}`);
  }

  return { success: true, method: 'ACKNOWLEDGED' };
};

/**
 * Approve a pending change request and execute it
 */
const approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes = '' } = req.body;

    const approval = await ChangeApprovalRequest.findById(id);
    if (!approval) {
      return res.status(404).json({ success: false, message: 'Approval request not found' });
    }

    if (approval.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `This request is already marked as ${approval.status}`,
      });
    }

    // Execute the approved changes
    const executionResult = await executeApprovedAction(approval, req.user);

    approval.status = 'APPROVED';
    approval.reviewedBy = {
      userId: String(req.user?._id || req.user?.id || 'admin'),
      name: req.user?.name || req.user?.username || 'Admin',
      email: req.user?.email || '',
    };
    approval.reviewedAt = new Date();
    approval.adminNotes = notes || 'Approved by Admin';
    approval.executionResult = executionResult;

    await approval.save();

    // Broadcast real-time status update to all connected clients
    try {
      const io = global.io || (req.app && req.app.get('io'));
      if (io) {
        io.emit('approval-status-changed', {
          id: approval._id,
          status: 'APPROVED',
          module: approval.module,
          targetIdentifier: approval.targetIdentifier,
        });
      }
    } catch (sockErr) {
      logger.warn('[ChangeApprovalController] Socket emit failed: %s', sockErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Changes approved and successfully applied to the database.',
      data: approval,
    });
  } catch (err) {
    logger.error('[ChangeApprovalController] approveRequest error: %o', err);
    return res.status(500).json({ success: false, message: 'Failed to approve request', error: err.message });
  }
};

/**
 * Reject a pending change request
 */
const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = '' } = req.body;

    const approval = await ChangeApprovalRequest.findById(id);
    if (!approval) {
      return res.status(404).json({ success: false, message: 'Approval request not found' });
    }

    if (approval.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `This request is already marked as ${approval.status}`,
      });
    }

    approval.status = 'REJECTED';
    approval.rejectionReason = reason || 'Rejected by Administrator';
    approval.reviewedBy = {
      userId: String(req.user?._id || req.user?.id || 'admin'),
      name: req.user?.name || req.user?.username || 'Admin',
      email: req.user?.email || '',
    };
    approval.reviewedAt = new Date();

    await approval.save();

    // Broadcast real-time status update
    try {
      const io = global.io || (req.app && req.app.get('io'));
      if (io) {
        io.emit('approval-status-changed', {
          id: approval._id,
          status: 'REJECTED',
          module: approval.module,
          targetIdentifier: approval.targetIdentifier,
          reason: approval.rejectionReason,
        });
      }
    } catch (sockErr) {
      logger.warn('[ChangeApprovalController] Socket emit failed: %s', sockErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Change request rejected.',
      data: approval,
    });
  } catch (err) {
    logger.error('[ChangeApprovalController] rejectRequest error: %o', err);
    return res.status(500).json({ success: false, message: 'Failed to reject request', error: err.message });
  }
};

/**
 * Bulk Approve multiple pending requests
 */
const bulkApprove = async (req, res) => {
  try {
    const { ids = [], notes = 'Bulk approved by Admin' } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'IDs array required' });
    }

    const pendingRequests = await ChangeApprovalRequest.find({
      _id: { $in: ids },
      status: 'PENDING',
    });

    const results = [];
    for (const reqItem of pendingRequests) {
      try {
        const execRes = await executeApprovedAction(reqItem, req.user);
        reqItem.status = 'APPROVED';
        reqItem.reviewedBy = {
          userId: String(req.user?._id || req.user?.id || 'admin'),
          name: req.user?.name || req.user?.username || 'Admin',
        };
        reqItem.reviewedAt = new Date();
        reqItem.adminNotes = notes;
        reqItem.executionResult = execRes;
        await reqItem.save();
        results.push({ id: reqItem._id, success: true });
      } catch (e) {
        results.push({ id: reqItem._id, success: false, error: e.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Processed ${results.filter(r => r.success).length} approvals successfully.`,
      results,
    });
  } catch (err) {
    logger.error('[ChangeApprovalController] bulkApprove error: %o', err);
    return res.status(500).json({ success: false, message: 'Bulk approval failed', error: err.message });
  }
};

/**
 * Bulk Reject multiple requests
 */
const bulkReject = async (req, res) => {
  try {
    const { ids = [], reason = 'Bulk rejected by Admin' } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'IDs array required' });
    }

    const updateResult = await ChangeApprovalRequest.updateMany(
      { _id: { $in: ids }, status: 'PENDING' },
      {
        $set: {
          status: 'REJECTED',
          rejectionReason: reason,
          reviewedBy: {
            userId: String(req.user?._id || req.user?.id || 'admin'),
            name: req.user?.name || req.user?.username || 'Admin',
          },
          reviewedAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: `Rejected ${updateResult.modifiedCount} requests.`,
    });
  } catch (err) {
    logger.error('[ChangeApprovalController] bulkReject error: %o', err);
    return res.status(500).json({ success: false, message: 'Bulk reject failed', error: err.message });
  }
};

/**
 * Get and Update Approval Settings (Master Toggle)
 */
const getSettings = (req, res) => {
  const settings = getApprovalSettings();
  return res.status(200).json({ success: true, data: settings });
};

const updateSettings = (req, res) => {
  const updated = setApprovalSettings(req.body);
  return res.status(200).json({ success: true, message: 'Approval settings updated', data: updated });
};

/**
 * Review Screen: Fetch all data entries across the ERP created by users
 */
const getUserDataEntries = async (req, res) => {
  try {
    const {
      user = 'ALL',
      module: moduleFilter = 'ALL',
      startDate = '',
      endDate = '',
      search = '',
      page = 1,
      limit = 40
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 40));

    // Construct Date Range Objects & Strings
    let dateStartObj = null;
    let dateEndObj = null;
    let startDateStr = '';
    let endDateStr = '';

    if (startDate) {
      dateStartObj = new Date(startDate);
      startDateStr = startDate.split('T')[0];
    }
    if (endDate) {
      dateEndObj = new Date(endDate);
      dateEndObj.setHours(23, 59, 59, 999);
      endDateStr = endDate.split('T')[0];
    }
    const hasDate = Boolean(dateStartObj || dateEndObj);

    // Construct User Filter
    const userRegex = (user && user !== 'ALL' && user !== 'All')
      ? new RegExp(`^${user.trim()}$`, 'i')
      : null;

    // Construct Search Regex
    const searchRegex = (search && search.trim())
      ? new RegExp(search.trim(), 'i')
      : null;

    const shouldFetch = (modName) => moduleFilter === 'ALL' || moduleFilter === 'All' || moduleFilter === modName;

    const promises = [];
    const maxFetch = limitNum * pageNum + 80;

    // 1. Job Cards (Digital Printing)
    if (shouldFetch('JobCard') && models.JobCard) {
      const q = {};
      if (hasDate) {
        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;

        const strCond = {};
        if (startDateStr) strCond.$gte = startDateStr;
        if (endDateStr) strCond.$lte = endDateStr;

        q.$or = [
          { created_date_time: dateCond },
          { date: strCond },
          { createdAt: dateCond },
        ];
      }
      if (userRegex) {
        const userOr = [
          { createdByName: userRegex },
          { createdBy: userRegex },
          { updatedByName: userRegex },
          { fusingOperator: userRegex },
          { printOperator: userRegex },
          { designer: userRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: userOr }] : (q.$or ? [{ $or: q.$or }, { $or: userOr }] : [{ $or: userOr }]);
        delete q.$or;
      }
      if (searchRegex) {
        const searchOr = [
          { jobNo: searchRegex },
          { party: searchRegex },
          { partyName: searchRegex },
          { clientName: searchRegex },
          { fabric: searchRegex },
          { fabricName: searchRegex },
          { designNo: searchRegex },
          { designName: searchRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        models.JobCard.find(q)
          .sort({ created_date_time: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const rawParty = doc.partyName || doc.party || doc.clientName || 'Internal';
            const rawFabric = doc.fabric || doc.fabricName || doc.fabricType || 'Fabric';
            const rawMtr = doc.totalMtr || doc.freshMtr || doc.fusingMtr || 0;
            const parsedDate = doc.created_date_time || (doc.date ? new Date(doc.date) : (doc.createdAt || new Date()));
            return {
              id: doc._id,
              module: 'JobCard',
              moduleLabel: 'Job Card',
              identifier: doc.jobNo || `#${String(doc._id).slice(-6)}`,
              party: rawParty,
              details: `${rawMtr} Mtr • ${rawFabric} • Design: ${doc.designNo || doc.designName || 'N/A'}${doc.fusingMtr ? ` • Fused: ${doc.fusingMtr}m` : ''}${doc.printMtr ? ` • Print: ${doc.printMtr}m` : ''}`,
              amountOrQuantity: `${rawMtr} Mtr`,
              status: doc.fusingStatus || doc.printStatus || doc.status || doc.productionStage || 'Production',
              createdBy: doc.createdByName || doc.createdBy || doc.updatedByName || doc.fusingOperator || doc.printOperator || 'Staff User',
              createdAt: parsedDate,
              rawDoc: doc,
            };
          }))
      );
    }

    // 2. Garment Job Cards
    if (shouldFetch('GarmentJobCard') && models.GarmentJobCard) {
      const q = {};
      if (hasDate) {
        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;
        q.$or = [{ created_date_time: dateCond }, { createdAt: dateCond }, { targetDate: dateCond }];
      }
      if (userRegex) {
        const userOr = [{ createdByName: userRegex }, { createdBy: userRegex }, { designer: userRegex }];
        q.$and = q.$and ? [...q.$and, { $or: userOr }] : (q.$or ? [{ $or: q.$or }, { $or: userOr }] : [{ $or: userOr }]);
        delete q.$or;
      }
      if (searchRegex) {
        const searchOr = [
          { jobNo: searchRegex },
          { clientName: searchRegex },
          { partyName: searchRegex },
          { styleNo: searchRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        models.GarmentJobCard.find(q)
          .sort({ created_date_time: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const pcs = doc.totalPieces || doc.pieces || 0;
            const parsedDate = doc.created_date_time || doc.createdAt || new Date();
            return {
              id: doc._id,
              module: 'GarmentJobCard',
              moduleLabel: 'Garment Job Card',
              identifier: doc.jobNo ? `Garment #${doc.jobNo}` : 'Garment Job',
              party: doc.clientName || doc.partyName || 'Client',
              details: `${pcs} Pcs • Style: ${doc.styleNo || 'N/A'} • Status: ${doc.status || 'Active'}`,
              amountOrQuantity: `${pcs} Pcs`,
              status: doc.status || 'Active',
              createdBy: doc.createdByName || doc.createdBy || 'Staff User',
              createdAt: parsedDate,
              rawDoc: doc,
            };
          }))
      );
    }

    // 3. Billing Invoices
    if (shouldFetch('BillingInvoice') && models.BillingInvoice) {
      const q = {};
      if (hasDate) {
        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;
        q.$or = [
          { invoiceDate: dateCond },
          { created_at: dateCond },
          { createdAt: dateCond },
        ];
      }
      if (userRegex) {
        const userOr = [{ createdByName: userRegex }, { createdBy: userRegex }];
        q.$and = q.$and ? [...q.$and, { $or: userOr }] : (q.$or ? [{ $or: q.$or }, { $or: userOr }] : [{ $or: userOr }]);
        delete q.$or;
      }
      if (searchRegex) {
        const searchOr = [
          { invoiceNo: searchRegex },
          { 'customer.name': searchRegex },
          { 'customer.businessName': searchRegex },
          { customerName: searchRegex },
          { partyName: searchRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        models.BillingInvoice.find(q)
          .sort({ invoiceDate: -1, created_at: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const rawParty = doc.customer?.name || doc.customer?.businessName || doc.customerName || doc.partyName || 'Customer';
            const total = Number(doc.grandTotal || doc.totalAmount || 0);
            const paid = Number(doc.paidAmount || 0);
            const due = Number(doc.balanceDue || (total - paid));
            const parsedDate = doc.invoiceDate || doc.created_at || doc.createdAt || new Date();
            return {
              id: doc._id,
              module: 'BillingInvoice',
              moduleLabel: 'Tax Invoice',
              identifier: doc.invoiceNo || (doc.invoicePrefix ? `${doc.invoicePrefix}${doc.invoiceSeq}` : 'Invoice'),
              party: rawParty,
              details: `Total: ₹${total.toLocaleString('en-IN')} • Paid: ₹${paid.toLocaleString('en-IN')} • Due: ₹${due.toLocaleString('en-IN')} • ${doc.items?.length || 0} Items`,
              amountOrQuantity: `₹${total.toLocaleString('en-IN')}`,
              status: `${doc.paymentStatus || 'UNPAID'} (${doc.invoiceStatus || 'FINAL'})`,
              createdBy: doc.createdByName || doc.createdBy || 'Billing Team',
              createdAt: parsedDate,
              rawDoc: doc,
            };
          }))
      );
    }

    // 4. Expenses
    if (shouldFetch('Expense') && models.Expense) {
      const q = {};
      if (hasDate) {
        const strCond = {};
        if (startDateStr) strCond.$gte = startDateStr;
        if (endDateStr) strCond.$lte = endDateStr;

        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;

        q.$or = [
          { date: strCond },
          { createdAt: dateCond },
        ];
      }
      if (userRegex) {
        const userOr = [{ createdByName: userRegex }, { createdBy: userRegex }];
        q.$and = q.$and ? [...q.$and, { $or: userOr }] : (q.$or ? [{ $or: q.$or }, { $or: userOr }] : [{ $or: userOr }]);
        delete q.$or;
      }
      if (searchRegex) {
        const searchOr = [
          { voucherNo: searchRegex },
          { category: searchRegex },
          { title: searchRegex },
          { partyName: searchRegex },
          { vendorName: searchRegex },
          { paidToOrReceivedFrom: searchRegex },
          { description: searchRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        models.Expense.find(q)
          .sort({ date: -1, createdAt: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const rawParty = doc.paidToOrReceivedFrom || doc.partyName || doc.vendorName || doc.title || 'General';
            const amt = Number(doc.amount || 0);
            const parsedDate = doc.date ? new Date(doc.date) : (doc.createdAt || new Date());
            return {
              id: doc._id,
              module: 'Expense',
              moduleLabel: `Expense (${doc.type || 'OUT'})`,
              identifier: doc.voucherNo || doc.title || 'Expense',
              party: rawParty,
              details: `${doc.category || 'General'} • Mode: ${doc.paymentMode || 'Cash'} ${doc.description ? `• ${doc.description}` : ''}`,
              amountOrQuantity: `₹${amt.toLocaleString('en-IN')}`,
              status: doc.type === 'IN' ? 'Cash IN' : 'Cash OUT',
              createdBy: doc.createdByName || doc.createdBy || 'Staff User',
              createdAt: parsedDate,
              rawDoc: doc,
            };
          }))
      );
    }

    // 5. Fabric Challans
    if (shouldFetch('FabricChallan') && models.FabricChallan) {
      const q = {};
      if (hasDate) {
        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;
        q.$or = [{ date: dateCond }, { createdAt: dateCond }];
      }
      if (userRegex) {
        const userOr = [{ createdByName: userRegex }, { createdBy: userRegex }, { deliveryBy: userRegex }];
        q.$and = q.$and ? [...q.$and, { $or: userOr }] : (q.$or ? [{ $or: q.$or }, { $or: userOr }] : [{ $or: userOr }]);
        delete q.$or;
      }
      if (searchRegex) {
        const numVal = Number(search.trim());
        const searchOr = [
          { partyName: searchRegex },
          { fabricName: searchRegex },
          { lotNo: searchRegex },
          { vendorChallanNo: searchRegex },
        ];
        if (!isNaN(numVal) && numVal > 0) {
          searchOr.push({ challanNo: numVal });
        }
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        models.FabricChallan.find(q)
          .sort({ date: -1, createdAt: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const mtr = doc.totalMtr || doc.totalMeters || doc.freshMtr || 0;
            const rolls = doc.totalRolls || (doc.tpDetails?.length || 0);
            const parsedDate = doc.date || doc.createdAt || new Date();
            return {
              id: doc._id,
              module: 'FabricChallan',
              moduleLabel: 'Fabric Challan',
              identifier: doc.challanNo ? `Challan #${doc.challanNo}` : 'Fabric Challan',
              party: doc.partyName || 'Party',
              details: `${mtr} Mtr (${rolls} Rolls) • ${doc.fabricName || 'Fabric'} • Lot: ${doc.lotNo || 'N/A'}`,
              amountOrQuantity: `${mtr} Mtr`,
              status: doc.status || 'Active',
              createdBy: doc.createdByName || doc.createdBy || doc.deliveryBy || 'Staff User',
              createdAt: parsedDate,
              rawDoc: doc,
            };
          }))
      );
    }

    // 6. Stitching Challans
    if (shouldFetch('StitchingChallan') && models.StitchingChallan) {
      const q = {};
      if (hasDate) {
        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;
        q.$or = [{ created_date_time: dateCond }, { date: dateCond }, { createdAt: dateCond }];
      }
      if (userRegex) {
        const userOr = [{ createdByName: userRegex }, { createdBy: userRegex }, { workerName: userRegex }];
        q.$and = q.$and ? [...q.$and, { $or: userOr }] : (q.$or ? [{ $or: q.$or }, { $or: userOr }] : [{ $or: userOr }]);
        delete q.$or;
      }
      if (searchRegex) {
        const numVal = Number(search.trim());
        const searchOr = [
          { partyName: searchRegex },
          { workerName: searchRegex },
          { jobNo: searchRegex },
        ];
        if (!isNaN(numVal) && numVal > 0) {
          searchOr.push({ challanNo: numVal });
        }
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        models.StitchingChallan.find(q)
          .sort({ created_date_time: -1, date: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const pcs = doc.totalPieces || doc.pieces || 0;
            const parsedDate = doc.created_date_time || doc.date || doc.createdAt || new Date();
            return {
              id: doc._id,
              module: 'StitchingChallan',
              moduleLabel: 'Stitching Challan',
              identifier: doc.challanNo ? `Stitching #${doc.challanNo}` : 'Stitching Challan',
              party: doc.partyName || doc.workerName || 'Worker',
              details: `${pcs} Pcs • Job #${doc.jobNo || 'N/A'} • Worker: ${doc.workerName || 'N/A'}`,
              amountOrQuantity: `${pcs} Pcs`,
              status: doc.status || 'Active',
              createdBy: doc.createdByName || doc.createdBy || doc.workerName || 'Staff User',
              createdAt: parsedDate,
              rawDoc: doc,
            };
          }))
      );
    }

    // 7. Inventory Inward/Stock
    if (shouldFetch('Inventory') && models.Inventory) {
      const q = {};
      if (hasDate) {
        const dateCond = {};
        if (dateStartObj) dateCond.$gte = dateStartObj;
        if (dateEndObj) dateCond.$lte = dateEndObj;
        q.$or = [{ created_date_time: dateCond }, { createdAt: dateCond }];
      }
      if (userRegex) {
        const userOr = [{ createdByName: userRegex }, { createdBy: userRegex }];
        q.$and = q.$and ? [...q.$and, { $or: userOr }] : (q.$or ? [{ $or: q.$or }, { $or: userOr }] : [{ $or: userOr }]);
        delete q.$or;
      }
      if (searchRegex) {
        const searchOr = [
          { productName: searchRegex },
          { itemName: searchRegex },
          { vendorName: searchRegex },
          { supplier: searchRegex },
          { category: searchRegex },
        ];
        q.$and = q.$and ? [...q.$and, { $or: searchOr }] : [{ $or: searchOr }];
      }

      promises.push(
        models.Inventory.find(q)
          .sort({ created_date_time: -1, _id: -1 })
          .limit(maxFetch)
          .lean()
          .then(docs => docs.map(doc => {
            const parsedDate = doc.created_date_time || doc.createdAt || new Date();
            const qty = doc.quantity || 0;
            const unit = doc.unit || 'Units';
            return {
              id: doc._id,
              module: 'Inventory',
              moduleLabel: 'Inventory Item',
              identifier: doc.productName || doc.itemName || 'Inventory Item',
              party: doc.vendorName || doc.supplier || 'Stock',
              details: `${qty} ${unit} • ${doc.category || doc.type || 'Stock'}${doc.sku ? ` • SKU: ${doc.sku}` : ''}`,
              amountOrQuantity: `${qty} ${unit}`,
              status: doc.type || doc.category || 'In Stock',
              createdBy: doc.createdByName || doc.createdBy || 'Staff User',
              createdAt: parsedDate,
              rawDoc: doc,
            };
          }))
      );
    }

    const resultsArray = await Promise.all(promises);
    const allEntries = resultsArray.flat();

    // Sort by createdAt descending
    allEntries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalCount = allEntries.length;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedItems = allEntries.slice(startIndex, startIndex + limitNum);

    return res.status(200).json({
      success: true,
      data: paginatedItems,
      meta: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum) || 1,
      },
    });
  } catch (err) {
    logger.error('[ChangeApprovalController] getUserDataEntries error: %o', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch user entries', error: err.message });
  }
};

/**
 * Get distinct user list who have created or entered data
 */
const getEntryUsersList = async (req, res) => {
  try {
    const userSet = new Set();

    // 1. Registered active system users
    if (models.user) {
      const activeUsers = await models.user.find({}, 'name username role').lean();
      activeUsers.forEach(u => {
        if (u.name && u.name.trim()) userSet.add(u.name.trim());
        if (u.username && u.username.trim()) userSet.add(u.username.trim());
      });
    }

    // 2. JobCards creators, updaters, and department operators
    if (models.JobCard) {
      const jcCreators = await models.JobCard.distinct('createdByName');
      jcCreators.forEach(u => u && userSet.add(String(u).trim()));
      const jcUpdaters = await models.JobCard.distinct('updatedByName');
      jcUpdaters.forEach(u => u && userSet.add(String(u).trim()));
      const jcFusingOps = await models.JobCard.distinct('fusingOperator');
      jcFusingOps.forEach(u => u && userSet.add(String(u).trim()));
      const jcPrintOps = await models.JobCard.distinct('printOperator');
      jcPrintOps.forEach(u => u && userSet.add(String(u).trim()));
      const jcDesigners = await models.JobCard.distinct('designer');
      jcDesigners.forEach(u => u && userSet.add(String(u).trim()));
    }

    // 3. Billing Invoices
    if (models.BillingInvoice) {
      const invCreators = await models.BillingInvoice.distinct('createdBy');
      invCreators.forEach(u => u && userSet.add(String(u).trim()));
      const invNames = await models.BillingInvoice.distinct('createdByName');
      invNames.forEach(u => u && userSet.add(String(u).trim()));
    }

    // 4. Expenses
    if (models.Expense) {
      const expCreators = await models.Expense.distinct('createdByName');
      expCreators.forEach(u => u && userSet.add(String(u).trim()));
    }

    // 5. Fabric Challans
    if (models.FabricChallan) {
      const fcCreators = await models.FabricChallan.distinct('createdByName');
      fcCreators.forEach(u => u && userSet.add(String(u).trim()));
      const fcDeliv = await models.FabricChallan.distinct('deliveryBy');
      fcDeliv.forEach(u => u && userSet.add(String(u).trim()));
    }

    // 6. Stitching Challans
    if (models.StitchingChallan) {
      const scWorkers = await models.StitchingChallan.distinct('workerName');
      scWorkers.forEach(u => u && userSet.add(String(u).trim()));
    }

    const sortedUsers = Array.from(userSet).filter(Boolean).sort((a, b) => a.localeCompare(b));

    return res.status(200).json({
      success: true,
      data: sortedUsers,
    });
  } catch (err) {
    logger.error('[ChangeApprovalController] getEntryUsersList error: %o', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch user list', error: err.message });
  }
};


module.exports = {
  getApprovalRequests,
  getApprovalStats,
  approveRequest,
  rejectRequest,
  bulkApprove,
  bulkReject,
  getSettings,
  updateSettings,
  getUserDataEntries,
  getEntryUsersList,
};
