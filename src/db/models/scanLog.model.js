const mongoose = require('mongoose');

const scanLogSchema = new mongoose.Schema(
  {
    awb: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    shippingPackageCode: {
      type: String,
      trim: true,
      index: true,
      default: '',
    },
    orderCode: {
      type: String,
      trim: true,
      index: true,
      default: '',
    },
    sku: {
      type: String,
      trim: true,
      default: '',
    },
    itemName: {
      type: String,
      default: '',
    },
    courier: {
      type: String,
      default: '',
    },
    channel: {
      type: String,
      default: 'Myntra',
    },
    customerName: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      default: '',
    },
    brand: {
      type: String,
      default: '',
    },
    size: {
      type: String,
      default: '',
    },
    color: {
      type: String,
      default: '',
    },
    mode: {
      type: String,
      enum: ['ALL', 'PACK', 'DISPATCH', 'DELIVERY', 'RETURN', 'RTO', 'LOOKUP', 'MANIFEST'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      default: 'SCANNED',
    },
    weightGrams: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      default: 0,
    },
    paymentMode: {
      type: String,
      default: 'PREPAID',
    },
    paymentStatus: {
      type: String,
      default: 'PAID',
    },
    codAmount: {
      type: Number,
      default: 0,
    },
    operator: {
      type: String,
      default: 'Warehouse Operator',
    },
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    facility: {
      type: String,
      default: 'eliteedition',
    },
    source: {
      type: String,
      default: 'Barcode Scanner',
    },
    notes: {
      type: String,
      default: '',
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for ultra-fast queries in busy warehouses
scanLogSchema.index({ createdAt: -1 });
scanLogSchema.index({ mode: 1, createdAt: -1 });
scanLogSchema.index({ awb: 1, createdAt: -1 });
scanLogSchema.index({ shippingPackageCode: 1, createdAt: -1 });

const ScanLog = mongoose.model('ScanLog', scanLogSchema);

module.exports = ScanLog;
