const mongoose = require('mongoose');

const tpDetailSchema = new mongoose.Schema(
  {
    tpNo: { type: Number, required: true },
    tpMeter: { type: Number, default: 0 },
    lotNo: { type: String, default: '' },
  },
  { _id: false }
);

const fabricStockAdjustmentSchema = new mongoose.Schema(
  {
    saNo: {
      type: String,
      unique: true,
      required: true,
    },
    saSeq: {
      type: Number,
      unique: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    partyName: {
      type: String,
      trim: true,
      default: '',
    },
    adjustmentType: {
      type: String,
      enum: ['RETURN_REJECTED', 'STOCK_DEDUCTION', 'STOCK_ADDITION'],
      default: 'RETURN_REJECTED',
    },
    fabricQuality: {
      type: String,
      trim: true,
      default: '',
    },
    panna: {
      type: String,
      trim: true,
      default: '',
    },
    lotNo: {
      type: String,
      default: '',
    },
    tpDetails: {
      type: [tpDetailSchema],
      default: [],
    },
    totalMtr: {
      type: Number,
      default: 0,
    },
    totalTp: {
      type: Number,
      default: 0,
    },
    reason: {
      type: String,
      trim: true,
      default: 'Fabric Return / Rejection',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: String,
      trim: true,
      default: '',
    },
    fabricTransactionIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FabricTransaction',
      },
    ],
  },
  {
    timestamps: true,
    collection: 'fabricStockAdjustments',
  }
);

// Auto-increment saSeq and format saNo as SA-01, SA-02... before saving
const SA_START_SEQ = 1;
fabricStockAdjustmentSchema.pre('validate', async function () {
  if (this.isNew && (!this.saSeq || !this.saNo)) {
    const last = await this.constructor.findOne({}, 'saSeq').sort({ saSeq: -1 });
    const nextSeq = last && last.saSeq ? last.saSeq + 1 : SA_START_SEQ;
    this.saSeq = nextSeq;
    this.saNo = `SA-${String(nextSeq).padStart(2, '0')}`;
  }
});

const FabricStockAdjustment = mongoose.model('FabricStockAdjustment', fabricStockAdjustmentSchema);
module.exports = FabricStockAdjustment;
