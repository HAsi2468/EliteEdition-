const mongoose = require('mongoose');

const jobChallanItemSchema = new mongoose.Schema(
  {
    designNo: { type: String, required: true, trim: true },
    designImageUrl: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true },
    processType: { type: String, default: '', trim: true },
    sizeRatio: { type: String, default: '', trim: true },
    qty: { type: Number, required: true, min: 0, default: 0 },
    receivedQty: { type: Number, min: 0, default: 0 },
    unit: { type: String, default: 'Pcs', trim: true },
    rate: { type: Number, min: 0, default: 0 },
    amount: { type: Number, min: 0, default: 0 },
    remarks: { type: String, default: '', trim: true },
  },
  { _id: true }
);

const jobChallanSchema = new mongoose.Schema(
  {
    companyEntity: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    companyName: { type: String, required: true, trim: true },
    companyCode: { type: String, default: 'ES', trim: true, uppercase: true },
    challanNo: { type: String, required: true, trim: true },
    challanDate: { type: String, required: true, trim: true }, // YYYY-MM-DD
    expectedReturnDate: { type: String, default: '', trim: true }, // YYYY-MM-DD
    challanType: {
      type: String,
      enum: ['ISSUE', 'RECEIVE'],
      default: 'ISSUE',
    },
    status: {
      type: String,
      enum: ['DRAFT', 'ISSUED', 'PARTIAL_RECEIVED', 'COMPLETED', 'CANCELLED'],
      default: 'ISSUED',
      index: true,
    },
    party: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, default: '', trim: true },
      address: { type: String, default: '', trim: true },
      gstin: { type: String, default: '', trim: true },
    },
    processType: { type: String, default: 'Stitching', trim: true },
    refLotNo: { type: String, default: '', trim: true },
    items: { type: [jobChallanItemSchema], default: [] },
    totalDesigns: { type: Number, default: 0 },
    totalQty: { type: Number, default: 0 },
    totalReceivedQty: { type: Number, default: 0 },
    totalValue: { type: Number, default: 0 },
    showRateInPrint: { type: Boolean, default: false },
    notes: { type: String, default: '', trim: true },
    terms: {
      type: String,
      default:
        'Goods sent for job work only (Not for Sale). Return balance fabric and rejected pieces along with finished goods.',
      trim: true,
    },
    createdBy: { type: String, default: '', trim: true },
  },
  {
    timestamps: true,
    collection: 'job_challans',
  }
);

jobChallanSchema.index({ companyEntity: 1, challanNo: 1 }, { unique: true });
jobChallanSchema.index({ companyEntity: 1, createdAt: -1 });
jobChallanSchema.index({ 'items.designNo': 1 });

jobChallanSchema.pre('save', function (next) {
  const items = Array.isArray(this.items) ? this.items : [];
  let totalQty = 0;
  let totalReceivedQty = 0;
  let totalValue = 0;

  for (const item of items) {
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;
    const rec = Number(item.receivedQty) || 0;
    item.amount = Number((qty * rate).toFixed(2));
    totalQty += qty;
    totalReceivedQty += rec;
    totalValue += item.amount;
  }

  this.totalDesigns = items.filter((i) => i.designNo && i.designNo.trim()).length;
  this.totalQty = Number(totalQty.toFixed(2));
  this.totalReceivedQty = Number(totalReceivedQty.toFixed(2));
  this.totalValue = Number(totalValue.toFixed(2));
  next();
});

const JobChallan = mongoose.model('JobChallan', jobChallanSchema);
module.exports = JobChallan;
