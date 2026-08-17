const mongoose = require('mongoose');

const jobPrintLogSchema = new mongoose.Schema(
  {
    jobCardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobCard',
      required: true
    },
    jobNo: {
      type: String,
      required: true,
      trim: true
    },
    machineName: {
      type: String,
      required: true,
      trim: true
    },
    pass: {
      type: String,
      default: '4 Pass',
      trim: true
    },
    meters: {
      type: Number,
      required: true,
      min: 0
    },
    date: {
      type: Date,
      default: Date.now
    },
    operatorName: {
      type: String,
      default: '',
      trim: true
    },
    shift: {
      type: String,
      enum: ['Morning', 'Evening', 'Night', 'General'],
      default: 'General'
    },
    notes: {
      type: String,
      default: '',
      trim: true
    }
  },
  {
    timestamps: {
      createdAt: 'created_date_time',
      updatedAt: 'modified_date_time'
    },
    collection: 'jobPrintLogs'
  }
);

// ── Indexes for query optimization ──
// departmentReport machine meterage aggregation
jobPrintLogSchema.index({ machineName: 1, date: 1 });
// Join/lookup by job card reference
jobPrintLogSchema.index({ jobCardId: 1 });

const JobPrintLog = mongoose.model('JobPrintLog', jobPrintLogSchema);
module.exports = JobPrintLog;
