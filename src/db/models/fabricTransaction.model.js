const mongoose = require('mongoose');

const fabricTransactionSchema = new mongoose.Schema(
  {
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
    fabricQuality: {
      type: String,
      required: true,
      trim: true,
    },
    qty: {
      type: Number,
      required: true,
      min: 0,
    },
    // INWARD specific fields
    lotNo: {
      type: Number, // Auto-incrementing
    },
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
    billTo: {
      type: String,
      trim: true,
    },
    panna: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    // Fusing shortage percentage (how much fabric reduces during fusing)
    shortagePct: {
      type: Number,
      min: 0,
      default: null,
    },
    shortageMtr: {
      type: Number,
      min: 0,
      default: null,
    },
    shortageMode: {
      type: String,
      enum: ['pct', 'mtr'],
      default: 'pct',
    },
    department: {
      type: String,
      default: 'digital_print',
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'fabricTransactions',
  }
);

// Auto-increment logic for INWARD lotNo
fabricTransactionSchema.pre('save', async function () {
  if (this.isNew && this.type === 'INWARD' && !this.lotNo) {
    const lastTransaction = await this.constructor.findOne({ type: 'INWARD' }, 'lotNo').sort({ lotNo: -1 });
    this.lotNo = lastTransaction && lastTransaction.lotNo ? lastTransaction.lotNo + 1 : 1;
  }
});

// ── Indexes for query optimization ──
// Stock overview & panna grouping (getStockOverview, getStockByPanna, getTransactions)
fabricTransactionSchema.index({ type: 1, department: 1 });
// Lot stock lookup (getLotStock, fabricChallan lot queries)
fabricTransactionSchema.index({ fabricQuality: 1, panna: 1, type: 1 });
// Lot remnant check (createOutward auto-clear, fabricChallan lot calc)
fabricTransactionSchema.index({ lotNo: 1, type: 1 });
// Auto-increment: findOne({ type: 'INWARD' }).sort({ lotNo: -1 })
fabricTransactionSchema.index({ type: 1, lotNo: -1 });
// Date range queries (downloadLedgerPdf)
fabricTransactionSchema.index({ date: 1 });

const FabricTransaction = mongoose.model('FabricTransaction', fabricTransactionSchema);
module.exports = FabricTransaction;
