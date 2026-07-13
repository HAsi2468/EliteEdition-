const mongoose = require('mongoose');

const fabricTransactionSchema = new mongoose.Schema(
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
    fabricQuality: {
      type: String,
      required: true,
      trim: true,
    },
    qty: {
      type: Number,
      required: true,
      min: 0,
    },
    // INWARD specific fields
    lotNo: {
      type: Number, // Auto-incrementing
    },
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
    panna: {
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
    collection: 'fabricTransactions',
  }
);

// Auto-increment logic for INWARD lotNo
fabricTransactionSchema.pre('save', async function () {
  if (this.isNew && this.type === 'INWARD' && !this.lotNo) {
    const lastTransaction = await this.constructor.findOne({ type: 'INWARD' }, 'lotNo').sort({ lotNo: -1 });
    this.lotNo = lastTransaction && lastTransaction.lotNo ? lastTransaction.lotNo + 1 : 1;
  }
});

const FabricTransaction = mongoose.model('FabricTransaction', fabricTransactionSchema);
module.exports = FabricTransaction;
