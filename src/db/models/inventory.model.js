const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    party: {
      type: String,
      required: true,
      trim: true,
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: String,
      required: true,
      trim: true,
    },
    currentlyAvailableStock: {
      type: Number,
      required: true,
      default: 0,
    },
    salePrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    purchasePrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    qty: {
      type: Number,
      required: true,
      default: 0,
    },
    imageUrl: {
      type: String,
      default: '',
    },
    skuCode: {
      type: String,
      default: '',
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: {
      createdAt: 'created_date_time',
      updatedAt: 'modified_date_time',
    },
    collection: 'inventory',
  }
);

const Inventory = mongoose.model('Inventory', inventorySchema);
module.exports = Inventory;
