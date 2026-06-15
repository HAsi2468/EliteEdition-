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
  },
  {
    timestamps: true,
  }
);

const PrintConfig = mongoose.model('PrintConfig', printConfigSchema);

module.exports = PrintConfig;
