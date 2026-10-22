const mongoose = require('mongoose');

const reconciliationItemSchema = new mongoose.Schema(
  {
    date: { type: String, trim: true },
    voucherNo: { type: String, trim: true },
    type: { type: String, trim: true },
    narration: { type: String, trim: true },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    matchedWith: { type: mongoose.Schema.Types.Mixed, default: null },
    status: {
      type: String,
      enum: ['MATCHED', 'PROBABLE', 'DISCREPANT', 'UNMATCHED', 'IGNORED', 'RESOLVED'],
      default: 'UNMATCHED'
    },
    notes: { type: String, trim: true }
  },
  { _id: true }
);

const ledgerReconciliationSchema = new mongoose.Schema(
  {
    tenantId: { type: String, default: 'default', index: true },
    companyEntity: { type: String, trim: true, index: true },
    partyType: {
      type: String,
      enum: ['customer', 'vendor', 'bank', 'marketplace'],
      required: true,
      index: true
    },
    partyId: { type: String, trim: true, index: true },
    partyName: { type: String, required: true, trim: true, index: true },
    periodStart: { type: String, trim: true },
    periodEnd: { type: String, trim: true },
    statementOpeningBalance: { type: Number, default: 0 },
    statementClosingBalance: { type: Number, default: 0 },
    erpOpeningBalance: { type: Number, default: 0 },
    erpClosingBalance: { type: Number, default: 0 },
    variance: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['DRAFT', 'IN_PROGRESS', 'RECONCILED', 'DISPUTED'],
      default: 'DRAFT',
      index: true
    },
    matchedItems: [reconciliationItemSchema],
    probableItems: [reconciliationItemSchema],
    discrepantItems: [reconciliationItemSchema],
    unmatchedStatementItems: [reconciliationItemSchema],
    unmatchedErpItems: [reconciliationItemSchema],
    aiAuditReport: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    settlementNotice: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    createdBy: { type: String, default: 'System' },
    updatedBy: { type: String, default: 'System' }
  },
  {
    timestamps: true
  }
);

ledgerReconciliationSchema.index({ partyType: 1, partyName: 1 });
ledgerReconciliationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('LedgerReconciliation', ledgerReconciliationSchema);
