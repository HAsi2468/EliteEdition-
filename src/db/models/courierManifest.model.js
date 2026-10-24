const mongoose = require('mongoose');

const packageItemSchema = new mongoose.Schema(
  {
    awb: {
      type: String,
      required: true,
      trim: true,
    },
    displayOrderCode: {
      type: String,
      trim: true,
      default: '',
    },
    sku: {
      type: String,
      trim: true,
      default: '',
    },
    itemName: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      trim: true,
      default: '',
    },
    customerName: {
      type: String,
      trim: true,
      default: '',
    },
    price: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const courierManifestSchema = new mongoose.Schema(
  {
    manifestId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    courier: {
      type: String,
      required: true,
      trim: true,
    },
    dispatchDate: {
      type: Date,
      default: Date.now,
    },
    totalPackages: {
      type: Number,
      required: true,
      default: 0,
    },
    packages: [packageItemSchema],
    pickupDriverName: {
      type: String,
      trim: true,
      default: '',
    },
    pickupDriverPhone: {
      type: String,
      trim: true,
      default: '',
    },
    vehicleNumber: {
      type: String,
      trim: true,
      default: '',
    },
    facility: {
      type: String,
      trim: true,
      default: 'WH-MAIN',
    },
    status: {
      type: String,
      enum: ['GENERATED', 'HANDED_OVER', 'CANCELLED'],
      default: 'HANDED_OVER',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

courierManifestSchema.index({ courier: 1 });
courierManifestSchema.index({ createdAt: -1 });

const CourierManifest = mongoose.model('CourierManifest', courierManifestSchema);

module.exports = CourierManifest;
