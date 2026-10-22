/**
 * PendingAction Model
 * Stores high-impact action tickets requiring either:
 *   - PENDING_SELF: User's own explicit confirmation (Tier 3 HITL)
 *   - AWAITING_MANAGER: Approval from a manager/admin (escalated actions)
 *
 * MongoDB TTL index auto-expires unreviewed tickets.
 */

const mongoose = require('mongoose');

const PendingActionSchema = new mongoose.Schema(
  {
    // Scoping
    tenantId:      { type: String, required: true, index: true },
    requesterId:   { type: String, required: true },
    requesterName: { type: String, required: true },

    // Approval routing
    requiredRole:      { type: String, default: 'manager' },
    assignedToUserId:  { type: String, default: null },
    targetChannelId:   { type: String, default: null },

    // Action classification
    actionType: {
      type: String,
      enum: [
        'CANCEL_JOB',
        'MANUAL_STOCK_ADJUSTMENT',
        'DISCOUNT_OVERRIDE',
        'CREDIT_LIMIT_OVERRIDE',
        'OVERRIDE_PRICE',
        'DELETE_RECORD'
      ],
      required: true
    },

    // What to execute on approval
    payload:       { type: mongoose.Schema.Types.Mixed, required: true },
    impactSummary: { type: String, required: true },

    // Lifecycle state
    status: {
      type: String,
      enum: ['PENDING_SELF', 'AWAITING_MANAGER', 'APPROVED', 'REJECTED', 'EXPIRED'],
      default: 'PENDING_SELF'
    },
    approvedBy:      { type: String, default: null },
    rejectionReason: { type: String, default: null },

    // TTL: 30 minutes for self-confirm, 24 hours for manager escalation
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 60 * 1000)
    }
  },
  { timestamps: true }
);

// MongoDB native TTL - documents are auto-deleted once expiresAt passes
PendingActionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PendingAction = mongoose.model('PendingAction', PendingActionSchema);

module.exports = { PendingAction };
