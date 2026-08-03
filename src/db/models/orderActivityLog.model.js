const mongoose = require('mongoose');

const orderActivityLogSchema = new mongoose.Schema(
  {
    jobCardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobCard',
      required: true,
    },
    jobNo: {
      type: String,
      required: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    actorName: {
      type: String,
      default: 'System Bot',
    },
    action: {
      type: String,
      required: true,
    },
    previousStage: {
      type: String,
      default: '',
    },
    newStage: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: { createdAt: 'timestamp', updatedAt: false },
  }
);

const OrderActivityLog = mongoose.model('OrderActivityLog', orderActivityLogSchema);
module.exports = OrderActivityLog;
