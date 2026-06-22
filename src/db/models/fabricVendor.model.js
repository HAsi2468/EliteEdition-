const mongoose = require('mongoose');

const fabricVendorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
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
