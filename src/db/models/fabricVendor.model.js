const mongoose = require('mongoose');

const fabricVendorSchema = new mongoose.Schema(
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
      default: 'Fabric',
    },
    companyEntity: {
      type: String,
      trim: true,
      default: 'Elite Digital Prints',
    },
  },
  {
    timestamps: {
      createdAt: 'created_date_time',
      updatedAt: 'modified_date_time',
    },
    collection: 'fabricVendors',
  }
);

const FabricVendor = mongoose.model('FabricVendor', fabricVendorSchema);
module.exports = FabricVendor;
