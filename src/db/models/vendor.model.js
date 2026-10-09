const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    businessName: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    gstin: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      default: '',
    },
    billingAddress: {
      type: String,
      trim: true,
      default: '',
    },
    shippingAddress: {
      type: String,
      trim: true,
      default: '',
    },
    state: {
      type: String,
      trim: true,
      default: 'Gujarat',
    },
    stateCode: {
      type: String,
      trim: true,
      default: '24',
    },
    vendorType: {
      type: String,
      trim: true,
      default: 'General',
    },
    companyEntity: {
      type: String,
      trim: true,
      default: 'Elite Online',
    },
  },
  {
    timestamps: {
      createdAt: 'created_date_time',
      updatedAt: 'modified_date_time',
    },
    collection: 'vendors',
  }
);

const Vendor = mongoose.model('Vendor', vendorSchema);
module.exports = Vendor;
