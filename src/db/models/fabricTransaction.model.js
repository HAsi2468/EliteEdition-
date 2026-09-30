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
    tpDetails: {
      type: [
        {
          tpNo: { type: Number, required: true },
          tpMeter: { type: Number, default: 0 },
          notes: { type: String, trim: true, default: '' },
        },
      ],
      default: [],
    },
    totalTp: {
      type: Number,
      default: 0,
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
    companyEntity: {
      type: String,
      trim: true,
      default: 'Elite Digital Print',
      index: true,
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

// ── Non-Negative Ledger Guard Pre-Save Hook ──
// Prohibits OUTWARD transactions from driving lot inventory below zero
fabricTransactionSchema.pre('save', async function () {
  if (this.type === 'OUTWARD' && this.lotNo && !this.forceAllowNegative) {
    const lotNum = Number(this.lotNo);
    if (!isNaN(lotNum) && lotNum > 0) {
      const matchCriteria = { lotNo: lotNum };
      if (!this.isNew && this._id) {
        matchCriteria._id = { $ne: this._id };
      }

      const agg = await this.constructor.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: '$lotNo',
            totalIn: { $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] } },
            totalOut: { $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] } },
          },
        },
      ]);

      const currentStats = agg && agg[0] ? agg[0] : { totalIn: 0, totalOut: 0 };
      const currentAvailable = currentStats.totalIn - currentStats.totalOut;
      const requestedQty = parseFloat(this.qty) || 0;

      // Allow 0.05m tolerance for floating point rounding differences
      if (requestedQty > currentAvailable + 0.05) {
        const deficit = Math.round((requestedQty - currentAvailable) * 100) / 100;
        const err = new Error(
          `INSUFFICIENT_FABRIC_STOCK: Cannot issue ${requestedQty} mtr from Lot #${lotNum}. Available balance is only ${Math.max(0, Math.round(currentAvailable * 100) / 100)} mtr (Deficit: ${deficit} mtr). Negative inventory ledger balances are strictly prohibited.`
        );
        err.name = 'LedgerStockError';
        err.statusCode = 422;
        err.code = 'INSUFFICIENT_FABRIC_STOCK';
        throw err;
      }
    }
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
