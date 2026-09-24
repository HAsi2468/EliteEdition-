const mongoose = require('mongoose');

const stageHistorySchema = new mongoose.Schema(
  {
    stage: {
      type: String,
      required: true,
      trim: true,
    },
    updatedBy: {
      type: String,
      default: '',
    },
    updatedByName: {
      type: String,
      default: '',
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
    outputImage: {
      type: String,
      default: '',
    },
    outputLink: {
      type: String,
      default: '',
    },
  },
  { _id: true }
);

const designerTaskSchema = new mongoose.Schema(
  {
    taskNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    designName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      trim: true,
      index: true,
      default: () => new Date().toISOString().split('T')[0],
    },
    designerName: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    designers: {
      type: [String],
      default: [],
    },
    fabricName: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    fabrics: {
      type: [String],
      default: [],
    },
    colourMatching: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    colourMatches: {
      type: [String],
      default: [],
    },
    priority: {
      type: String,
      enum: ['Urgent', 'High', 'Medium', 'Low'],
      default: 'Medium',
      index: true,
    },
    sampleImage: {
      type: String,
      default: '',
      trim: true,
    },
    sampleLink: {
      type: String,
      default: '',
      trim: true,
    },
    sampleLinkType: {
      type: String,
      enum: ['video', 'image', 'link'],
      default: 'link',
    },
    status: {
      type: String,
      enum: [
        'New',
        'Assigned',
        'In Progress',
        'Colour Matching',
        'Sample Proof Ready',
        'Revision Requested',
        'Approved',
        'Cancelled',
      ],
      default: 'New',
      index: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    outputImage: {
      type: String,
      default: '',
      trim: true,
    },
    outputLink: {
      type: String,
      default: '',
      trim: true,
    },
    stageHistory: {
      type: [stageHistorySchema],
      default: [],
    },
    createdById: {
      type: String,
      default: '',
    },
    createdByName: {
      type: String,
      default: 'Admin',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast multi-field filtering
designerTaskSchema.index({ date: -1, designerName: 1 });
designerTaskSchema.index({ date: -1, colourMatching: 1 });
designerTaskSchema.index({ status: 1, priority: 1 });

const DesignerTask = mongoose.model('DesignerTask', designerTaskSchema);

module.exports = DesignerTask;
