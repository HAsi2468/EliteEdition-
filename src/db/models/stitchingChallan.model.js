const mongoose = require('mongoose');

const stitchingChallanItemSchema = new mongoose.Schema({
  srNo: { type: Number },
  designNo: { type: String, default: '', trim: true },
  particulars: { type: String, default: '', trim: true },
  hsnCode: { type: String, default: '6204', trim: true },
  pcs: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
});

const stitchingChallanSchema = new mongoose.Schema(
  {
    challanNo: { type: String, required: true, unique: true, trim: true }, // e.g. PCH-1, PCH-2
    challanNum: { type: Number, required: true },                          // numeric value for sorting e.g. 1
    date: { type: Date, default: Date.now },
    partyName: { type: String, default: '', trim: true },
    billTo: { type: String, default: '', trim: true },
    shipTo: { type: String, default: '', trim: true },
    deliveryBy: { type: String, default: '', trim: true },
    vendorChallanNo: { type: String, default: '', trim: true },
    department: { type: String, default: 'stitching', trim: true },
    items: [stitchingChallanItemSchema],
    totalPcs: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    notes: { type: String, default: '', trim: true },
    createdBy: { type: String, default: '', trim: true },
    status: { type: String, default: 'Active', enum: ['Active', 'INVOICED', 'Cancelled'] },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'BillingInvoice', default: null },
    invoiceNo: { type: String, default: '' }
  },
  {
    timestamps: {
      createdAt: 'created_date_time',
      updatedAt: 'modified_date_time'
    },
    collection: 'stitching_challans'
  }
);

stitchingChallanSchema.index({ challanNum: 1 });
stitchingChallanSchema.index({ partyName: 1 });
stitchingChallanSchema.index({ date: 1 });

const StitchingChallan = mongoose.model('StitchingChallan', stitchingChallanSchema);
module.exports = StitchingChallan;
