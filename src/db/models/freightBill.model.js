const mongoose = require('mongoose');

const freightBillSchema = new mongoose.Schema(
  {
    companyEntity: { type: String, default: 'Elite Digital Print', index: true },
    tenantGstin: { type: String, default: '24AANFE0044M1ZG', index: true },
    lrNumber: { type: String, required: true, trim: true },
    billNo: { type: String, default: '', trim: true },
    billDate: { type: String, required: true, index: true }, // Format: YYYY-MM-DD
    transporterName: { type: String, required: true, trim: true },
    transporterGstin: { type: String, default: '', trim: true }, // Empty indicates unregistered GTA
    originStateCode: { type: String, default: '24', trim: true },
    originStateName: { type: String, default: 'Gujarat', trim: true },
    destinationStateCode: { type: String, default: '24', trim: true },
    destinationStateName: { type: String, default: 'Gujarat', trim: true },
    sacCode: { type: String, default: '9965', trim: true }, // SAC 9965: Goods Transport Agency
    description: { type: String, default: 'Goods Transport Agency (GTA) Freight Services', trim: true },
    freightAmount: { type: Number, required: true, min: 0 },
    isInterstate: { type: Boolean, default: false },
    rcmRate: { type: Number, default: 5.0 }, // 5% Flat RCM
    rcmIgst: { type: Number, default: 0 },
    rcmCgst: { type: Number, default: 0 },
    rcmSgst: { type: Number, default: 0 },
    totalRcmTax: { type: Number, default: 0 },
    isEligibleItc: { type: Boolean, default: true },
    selfInvoiceNumber: { type: String, default: '', trim: true, index: true }, // SINV-YYYY-XXXXX
    selfInvoiceDate: { type: String, default: '', trim: true },
    settlementStatus: { type: String, enum: ['PENDING', 'PAID'], default: 'PENDING', index: true },
    paymentVoucherNo: { type: String, default: '', trim: true },
    paymentDate: { type: String, default: '', trim: true },
    vehicleNo: { type: String, default: '', trim: true },
    weightKg: { type: Number, default: 0 },
    packagesCount: { type: Number, default: 0 },
    notes: { type: String, default: '', trim: true }
  },
  {
    timestamps: true
  }
);

freightBillSchema.index({ companyEntity: 1, billDate: -1 });
freightBillSchema.index({ tenantGstin: 1, billDate: -1 });
freightBillSchema.index({ transporterName: 1 });

module.exports = mongoose.model('FreightBill', freightBillSchema);
