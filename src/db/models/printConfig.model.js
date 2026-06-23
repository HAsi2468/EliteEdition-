const mongoose = require('mongoose');

const printConfigSchema = new mongoose.Schema(
  {
    // A singleton identifier
    isConfig: {
      type: Boolean,
      default: true,
      unique: true,
    },
    categories: {
      type: [String],
      default: [],
    },
    passes: {
      type: [String],
      default: [],
    },
    parties: {
      type: [String],
      default: [],
    },
    widths: {
      type: [String],
      default: [],
    },
    fabrics: {
      type: [String],
      default: [],
    },
    designers: {
      type: [String],
      default: [],
    },
    paperTypes: {
      type: [String],
      default: [],
    },
    machines: {
      type: [{
        name: { type: String, required: true },
        profiles: { type: [String], default: [] }
      }],
      default: [
        { name: 'GRANDO', profiles: [] },
        { name: 'PRINTDOT', profiles: [] }
      ],
    },
    billToOptions: {
      type: [String],
      default: [],
    },
    shipToOptions: {
      type: [String],
      default: [],
    },
    temperatures: {
      type: [String],
      default: [],
    },
    speeds: {
      type: [String],
      default: [],
    },
    startingJobNo: {
      type: Number,
      default: 1,
    },
    rawMaterials: {
      type: [String],
      default: [],
    },
    sublimationPanna: {
      type: [String],
      default: [],
    },
    sublimationQualities: {
      type: [String],
      default: [],
    },
    butterPanna: {
      type: [String],
      default: [],
    },
    inkColors: {
      type: [String],
      default: [],
    },
    inkCanSizes: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const PrintConfig = mongoose.model('PrintConfig', printConfigSchema);

module.exports = PrintConfig;
