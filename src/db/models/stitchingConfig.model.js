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
    fabrics: {
      type: [String],
      default: ['Cotton', 'Silk', 'Georgette', 'Chiffon', 'Organza', 'Velvet', 'Rayon', 'Crepe'],
    },
    sizes: {
      type: [String],
      default: ['XS (34)', 'S (36)', 'M (38)', 'L (40)', 'XL (42)', '2XL (44)', '3XL (46)', '4XL (48)', '5XL (50)', '6XL (52)', 'FREE SIZE', 'UNSTITCHED'],
    },
    parties: {
      type: [String],
      default: ['Wholesale Party', 'Direct Client', 'Retailer'],
    },
    vendors: {
      type: [String],
      default: ['Stitching Contractor A', 'Fabric Supplier B', 'Embroidery Job Worker'],
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
