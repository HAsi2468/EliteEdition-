const mongoose = require('mongoose');

const billingVendorSchema = new mongoose.Schema(
  {
    companyEntity: { type: String, default: 'Elite Digital Prints', index: true },
    name: { type: String, required: true, trim: true },
    businessName: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true },
    gstin: { type: String, default: '', trim: true },
    billingAddress: { type: String, default: '', trim: true },
    shippingAddress: { type: String, default: '', trim: true },
    state: { type: String, default: 'Gujarat', trim: true },
    stateCode: { type: String, default: '24', trim: true },
    openingBalance: { type: Number, default: 0 },
    vendorType: { type: String, default: 'Fabric', trim: true }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

module.exports = mongoose.model('BillingVendor', billingVendorSchema);
