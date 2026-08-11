const mongoose = require('mongoose');

const stitchingConfigSchema = new mongoose.Schema(
  {
    isConfig: {
      type: Boolean,
      default: true,
      unique: true,
    },
    categories: {
      type: [String],
      default: ['SUIT', 'KURTI', 'DUPATTA', 'TOP', 'BOTTOM', 'LEHENGA', 'STITCHING SET', 'KIDS', 'ETHNIC'],
    },
    labels: {
      type: [String],
      default: ['Elite Edition', 'Private Label', 'Custom Brand'],
    },
    finishingOptions: {
      type: [String],
      default: ['Standard Finishing', 'Iron & Pack', 'Overlock', 'Embroidery Finish', 'Premium Box'],
    },
    parties: {
      type: [String],
      default: ['Wholesale Party', 'Direct Client', 'Retailer'],
    },
    billToOptions: {
      type: [String],
      default: [],
    },
    shipToOptions: {
      type: [String],
      default: [],
    },
    deliveryOptions: {
      type: [String],
      default: ['Party Delivery', 'Self Pickup', 'Courier / Cargo'],
    },
    startingJobNo: {
      type: Number,
      default: 1001,
    },
    startingChallanNo: {
      type: Number,
      default: 1,
    },
    notes: {
      type: String,
      default: 'Elite Stitching Department Configuration Settings',
    }
  },
  {
    timestamps: true,
    collection: 'stitching_configs'
  }
);

const StitchingConfig = mongoose.model('StitchingConfig', stitchingConfigSchema);

module.exports = StitchingConfig;
