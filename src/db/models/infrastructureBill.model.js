const mongoose = require('mongoose');

const infrastructureBillSchema = new mongoose.Schema(
  {
    month: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    awsAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    awsUsdAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    mongoDbAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
    },
    exchangeRate: {
      type: Number,
      default: 86.5,
    },
    awsBreakdown: [
      {
        service: { type: String, trim: true },
        amountUsd: { type: Number, default: 0 },
        amountInr: { type: Number, default: 0 },
      },
    ],
    isAutoSynced: {
      type: Boolean,
      default: false,
    },
    syncedAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'infrastructureBills',
  }
);

// Pre-save hook to calculate totalAmount automatically
infrastructureBillSchema.pre('save', function (next) {
  this.totalAmount = (this.awsAmount || 0) + (this.mongoDbAmount || 0);
  if (typeof next === 'function') {
    next();
  }
});

const InfrastructureBill = mongoose.model('InfrastructureBill', infrastructureBillSchema);
module.exports = InfrastructureBill;
