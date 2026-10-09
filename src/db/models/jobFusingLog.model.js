const mongoose = require('mongoose');

const jobFusingLogSchema = new mongoose.Schema(
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
    fusingMachine: {
      type: String,
      default: 'Fusing Machine 1',
      trim: true
    },
    shift: {
      type: String,
      enum: ['Morning', 'Evening', 'Night', 'General'],
      default: 'General'
    },
    date: {
      type: Date,
      default: Date.now
    },
    fusingTemp: {
      type: String,
      default: '210°C',
      trim: true
    },
    fusingSpeed: {
      type: String,
      default: '80',
      trim: true
    },
    panna: {
      type: String,
      default: '58"',
      trim: true
    },
    freshMtr: {
      type: Number,
      default: 0,
      min: 0
    },
    totalWastageMtr: {
      type: Number,
      default: 0,
      min: 0
    },
    fabricFaultMtr: {
      type: Number,
      default: 0,
      min: 0
    },
    fusingFaultMtr: {
      type: Number,
      default: 0,
      min: 0
    },
    printFaultMtr: {
      type: Number,
      default: 0,
      min: 0
    },
    genuineFaultMtr: {
      type: Number,
      default: 0,
      min: 0
    },
    fusingMtr: {
      type: Number,
      default: 0,
      min: 0
    },
    useButterPaper: {
      type: String,
      enum: ['Yes', 'No'],
      default: 'Yes'
    },
    butterPaperWeightKg: {
      type: Number,
      default: 0,
      min: 0
    },
    rollCompleted: {
      type: String,
      default: 'Complete',
      trim: true
    },
    operatorName: {
      type: String,
      default: '',
      trim: true
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
    collection: 'jobFusingLogs'
  }
);

// ── Indexes for query performance ──
jobFusingLogSchema.index({ jobCardId: 1 });
jobFusingLogSchema.index({ jobNo: 1 });
jobFusingLogSchema.index({ date: 1 });
jobFusingLogSchema.index({ fusingMachine: 1, date: 1 });

const JobFusingLog = mongoose.model('JobFusingLog', jobFusingLogSchema);
module.exports = JobFusingLog;
