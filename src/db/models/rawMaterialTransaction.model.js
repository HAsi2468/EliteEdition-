const mongoose = require('mongoose');

const rawMaterialTransactionSchema = new mongoose.Schema(
  {
    companyEntity: {
      type: String,
      trim: true,
      default: 'Elite Digital Print',
      index: true,
    },
    type: {
      type: String,
      enum: ['INWARD', 'OUTWARD'],
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    materialName: {
      type: String,
      required: true,
      trim: true,
    },
    qty: {
      type: Number,
      required: true,
      min: 0,
    },
    unit: {
      type: String,
      trim: true,
      default: 'Rolls',
    },
    // INWARD specific fields
    challanNo: {
      type: String,
      trim: true,
    },
    vendorName: {
      type: String,
      trim: true,
    },
    // OUTWARD specific fields
    jobNo: {
      type: String,
      trim: true,
    },
    partyName: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    // Dynamic specifications
    panna: {
      type: String,
      trim: true,
    },
    paperQuality: {
      type: String,
      trim: true,
    },
    color: {
      type: String,
      trim: true,
    },
    canSize: {
      type: Number,
    },
    metersPerRoll: {
      type: Number,
    },
    // Sister Company Inward & Verification Workflow
    isSisterTransfer: {
      type: Boolean,
      default: false,
      index: true,
    },
    sourceCompany: {
      type: String,
      trim: true,
      index: true,
    },
    sourceDocType: {
      type: String,
      enum: ['INVOICE', 'DELIVERY_CHALLAN', 'FABRIC_CHALLAN', 'MANUAL'],
      default: 'MANUAL',
    },
    sourceDocId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'sourceDocModel',
    },
    sourceDocModel: {
      type: String,
      enum: ['BillingInvoice', 'DeliveryChallan', 'FabricChallan'],
    },
    sourceDocNo: {
      type: String,
      trim: true,
      index: true,
    },
    verificationStatus: {
      type: String,
      enum: ['VERIFIED', 'PENDING_CHECK', 'REJECTED'],
      default: 'VERIFIED',
      index: true,
    },
    verifiedAt: {
      type: Date,
    },
    verifiedBy: {
      type: String,
      trim: true,
    },
    verifiedQty: {
      type: Number,
    },
    verificationNotes: {
      type: String,
      trim: true,
    },
    discrepancyReason: {
      type: String,
      trim: true,
    },
    unitPrice: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'rawMaterialTransactions',
  }
);

// ── Indexes for query optimization ──
// Stock overview aggregation
rawMaterialTransactionSchema.index({ materialName: 1, type: 1 });
// Date range queries
rawMaterialTransactionSchema.index({ date: 1 });

const RawMaterialTransaction = mongoose.model('RawMaterialTransaction', rawMaterialTransactionSchema);
module.exports = RawMaterialTransaction;
