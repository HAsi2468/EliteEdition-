const mongoose = require('mongoose');

const myntraConfigSchema = mongoose.Schema(
  {
    merchantId: {
      type: String,
      required: true,
      trim: true,
    },
    secretKey: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const MyntraConfig = mongoose.model('MyntraConfig', myntraConfigSchema);

module.exports = MyntraConfig;
