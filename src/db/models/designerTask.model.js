const mongoose = require('mongoose');

const stageHistorySchema = new mongoose.Schema(
  {
    category: {
      type: String,
      default: 'general',
      trim: true,
    },
    statusType: {
      type: String,
      default: '',
      trim: true,
    },
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
    images: {
      type: [String],
      default: [],
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
    // ─── Three Core Workflow Statuses ─────────────────────────────
    // 1. Drow Design Status: 'START WORKING' | 'REVIEW SAMPLE' | 'FINAL SAMPLE'
    drowDesignStatus: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    drowDesignImages: {
      type: [String],
      default: [],
    },
    // 2. Colour Matching Status: 'COLOUR PANTON' | 'REVIEW SAMPLE' | 'FINAL SAMPLE'
    colourMatchingStatus: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    colourMatchingImages: {
      type: [String],
      default: [],
    },
    // 3. Stage 3 Status: 'Hold' | 'Continue'
    stage3Status: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    stage3Images: {
      type: [String],
      default: [],
    },
    // 4. Final Design Status: 'Reject' | 'Approved'
    finalDesignStatus: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    finalDesignImages: {
      type: [String],
      default: [],
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
