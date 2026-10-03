const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  itemName: { type: String, required: true, trim: true },
  quantity: { type: Number, default: 0 },
  unit: { type: String, default: 'Mtr' },
  rate: { type: Number, default: 0 },
  amount: { type: Number, default: 0 }
});

const billingPurchaseSchema = new mongoose.Schema(
  {
    companyEntity: { type: String, default: 'Elite Digital Prints', index: true },
    purchaseNo: { type: String, required: true, trim: true, index: true },
    date: { type: Date, default: Date.now },
    vendorName: { type: String, required: true, trim: true },
    items: [purchaseItemSchema],
    itemName: { type: String, default: '' },
    quantity: { type: Number, default: 0 },
    unit: { type: String, default: 'Mtr' },
    rate: { type: mongoose.Schema.Types.Mixed, default: 0 },
    subtotalAmount: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    gstRate: { type: Number, default: 0 },
    gstType: { type: String, default: 'CGST_SGST' },
    gstAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    notes: { type: String, default: '' }
  },
  {
    timestamps: true
  }
);

// Index for query optimization
billingPurchaseSchema.index({ companyEntity: 1, date: -1 });

const BillingPurchase = mongoose.model('BillingPurchase', billingPurchaseSchema);

module.exports = BillingPurchase;
