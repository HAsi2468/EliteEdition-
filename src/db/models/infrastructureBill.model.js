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
  next();
});

const InfrastructureBill = mongoose.model('InfrastructureBill', infrastructureBillSchema);
module.exports = InfrastructureBill;
