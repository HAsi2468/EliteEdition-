const mongoose = require('mongoose');

const billingItemSchema = new mongoose.Schema(
  {
    companyEntity: { type: String, default: 'Elite Online', index: true },
    itemName: { type: String, required: true },
    hsnCode: { type: String, default: '998821' }, // Default HSN/SAC for Printing Services
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
