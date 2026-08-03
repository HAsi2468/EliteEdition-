const mongoose = require('mongoose');

const billingItemSchema = new mongoose.Schema(
  {
    itemName: { type: String, required: true },
    hsnCode: { type: String, default: '5407' }, // Default HSN for woven/printed fabrics
    unitPrice: { type: Number, required: true, default: 0 },
    unit: { type: String, default: 'Meters' },
    taxRate: { type: Number, default: 18 }, // GST %
    category: { type: String, default: 'Printing Services' }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

module.exports = mongoose.model('BillingItem', billingItemSchema);
