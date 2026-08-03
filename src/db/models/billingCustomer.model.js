const mongoose = require('mongoose');

const billingCustomerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    businessName: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    gstin: { type: String, default: '' },
    billingAddress: { type: String, default: '' },
    shippingAddress: { type: String, default: '' },
    state: { type: String, default: 'Gujarat' },
    stateCode: { type: String, default: '24' },
    openingBalance: { type: Number, default: 0 }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

module.exports = mongoose.model('BillingCustomer', billingCustomerSchema);
