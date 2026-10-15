const mongoose = require('mongoose');

const returnRecordSchema = new mongoose.Schema(
  {
    party: {
      type: String,
      required: true,
      trim: true,
    },
    returnType: {
      type: String,
      enum: ['RTO', 'CUSTOMER_RETURN'],
      required: true,
    },
    referenceId: {
      type: String,
      required: true,
      trim: true,
    },
    displayOrderId: {
      type: String,
      trim: true,
      default: '',
    },
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    condition: {
      type: String,
      enum: ['INTACT', 'NEEDS_REFINISHING', 'WRONG_ITEM', 'DAMAGED'],
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['STOCKED_IN', 'PENDING_REFINISH', 'DISPUTED'],
      required: true,
    },
    images: [{
      type: String,
    }],
    claimStatus: {
      type: String,
      enum: ['NOT_APPLICABLE', 'CLAIM_PENDING', 'CLAIM_SUBMITTED', 'CLAIM_APPROVED', 'CLAIM_REJECTED'],
      default: 'NOT_APPLICABLE',
    },
    claimId: {
      type: String,
      trim: true,
      default: '',
    },
    claimAmount: {
      type: Number,
      default: 0,
    },
    weightGrams: {
      type: Number,
      default: 0,
    },
    claimNotes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const ReturnRecord = mongoose.model('ReturnRecord', returnRecordSchema);

module.exports = ReturnRecord;
