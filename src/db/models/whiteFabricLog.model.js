const mongoose = require('mongoose');

const whiteFabricLogSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      trim: true,
    },
    vendorName: {
      type: String,
      default: '',
      trim: true,
    },
    challanNo: {
      type: String,
      default: '',
      trim: true,
    },
    fabricQuality: {
      type: String,
      required: true,
      trim: true,
    },
    panna: {
      type: String,
      default: '58"',
      trim: true,
    },
    lotNo: {
      type: String,
      default: '',
      trim: true,
    },
    totalMtr: {
      type: Number,
      required: true,
      min: 0,
    },
    weavingFaultMtr: {
      type: Number,
      default: 0,
    },
    stainFaultMtr: {
      type: Number,
      default: 0,
    },
    shadingFaultMtr: {
      type: Number,
      default: 0,
    },
    widthShortageMtr: {
      type: Number,
      default: 0,
    },
    totalDefectMtr: {
      type: Number,
      default: 0,
    },
    usableFreshMtr: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      default: 'Passed',
      enum: ['Passed', 'Conditionally Accepted', 'Rejected'],
    },
    inspectorName: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    department: {
      type: String,
      default: 'digital_print',
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'whiteFabricLogs',
  }
);

module.exports = mongoose.model('WhiteFabricLog', whiteFabricLogSchema);
