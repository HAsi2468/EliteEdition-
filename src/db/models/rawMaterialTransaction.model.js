const mongoose = require('mongoose');

const rawMaterialTransactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['INWARD', 'OUTWARD'],
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    materialName: {
      type: String,
      required: true,
      trim: true,
    },
    qty: {
      type: Number,
      required: true,
      min: 0,
    },
    unit: {
      type: String,
      trim: true,
      default: 'Rolls',
    },
    // INWARD specific fields
    challanNo: {
      type: String,
      trim: true,
    },
    vendorName: {
      type: String,
      trim: true,
    },
    // OUTWARD specific fields
    jobNo: {
      type: String,
      trim: true,
    },
    partyName: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'rawMaterialTransactions',
  }
);

const RawMaterialTransaction = mongoose.model('RawMaterialTransaction', rawMaterialTransactionSchema);
module.exports = RawMaterialTransaction;
