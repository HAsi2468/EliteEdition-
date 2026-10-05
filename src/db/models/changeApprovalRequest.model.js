const mongoose = require('mongoose');

const changeApprovalRequestSchema = new mongoose.Schema(
  {
    module: {
      type: String,
      required: true,
      index: true,
      trim: true,
      // e.g. 'JobCard', 'Billing', 'Expense', 'FabricChallan', 'Inventory', 'Vendor', 'Party', 'Design', etc.
    },
    action: {
      type: String,
      required: true,
      enum: ['EDIT', 'DELETE', 'STATUS_CHANGE', 'CREATE'],
      default: 'EDIT',
    },
    targetId: {
      type: String,
      default: '',
      index: true,
    },
    targetIdentifier: {
      type: String,
      default: '',
      trim: true,
      // e.g. "JC-2026-0089", "Invoice EDP/26-27/439", "Expense #EX-01"
    },
    targetEndpoint: {
      type: String,
      required: true,
      trim: true,
    },
    httpMethod: {
      type: String,
      required: true,
      enum: ['PUT', 'PATCH', 'DELETE', 'POST'],
      default: 'PUT',
    },
    requestBody: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    requestQuery: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    beforeData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    afterData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    diffSummary: [
      {
        field: { type: String, required: true },
        before: { type: mongoose.Schema.Types.Mixed },
        after: { type: mongoose.Schema.Types.Mixed },
      },
    ],
    requestedBy: {
      userId: { type: String, required: true, index: true },
      name: { type: String, default: 'Staff User' },
      email: { type: String, default: '' },
      role: { type: String, default: 'user' },
      department: { type: String, default: 'General' },
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    reviewedBy: {
      userId: { type: String, default: null },
      name: { type: String, default: null },
      email: { type: String, default: null },
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    adminNotes: {
      type: String,
      default: '',
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    executionResult: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

changeApprovalRequestSchema.index({ status: 1, createdAt: -1 });
changeApprovalRequestSchema.index({ module: 1, status: 1 });

const ChangeApprovalRequest = mongoose.model('ChangeApprovalRequest', changeApprovalRequestSchema);

module.exports = ChangeApprovalRequest;
