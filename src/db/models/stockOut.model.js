const mongoose = require('mongoose');

const stockOutSchema = new mongoose.Schema(
  {
    skuCode: {
      type: String,
      required: true,
      trim: true,
    },
    party: {
      type: String,
      required: true,
    },
    qtyOut: {
      type: Number,
      required: true,
      default: 1,
    },
  },
  {
    timestamps: {
      createdAt: 'created_date_time',
      updatedAt: 'modified_date_time',
    },
    collection: 'stockouts',
  }
);

const StockOut = mongoose.model('StockOut', stockOutSchema);
module.exports = StockOut;
