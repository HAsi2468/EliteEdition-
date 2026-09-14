const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'],
      default: 'To Do',
    },
    dueDate: {
      type: Date,
    },
    department: {
      type: String,
      default: 'General',
      trim: true,
    },
    projectRef: {
      type: String,
      default: '',
      trim: true,
    },
    clientName: {
      type: String,
      default: '',
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    estimatedHours: {
      type: Number,
      default: 0,
    },
    originRoomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatRoom',
    },
    originMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatMessage',
    },
    assignees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    dependencies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
      },
    ],
    images: [
      {
        type: String,
      },
    ],
    attachments: [
      {
        fileName: { type: String, required: true },
        fileUrl: { type: String, required: true },
        fileSize: { type: Number, default: 0 },
        fileType: { type: String, default: 'document' },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    checklist: [
      {
        text: { type: String, required: true },
        completed: { type: Boolean, default: false },
        assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    comments: [
      {
        text: { type: String, required: true },
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        senderName: { type: String, default: 'Staff' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    tags: [
      {
        text: { type: String, required: true },
        color: { type: String, default: '#2563eb' },
      },
    ],
    liveTimers: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        startTime: { type: Date, default: Date.now },
        isRunning: { type: Boolean, default: true },
      },
    ],
    timeLogs: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        userName: { type: String, default: 'Staff' },
        hours: { type: Number, required: true },
        durationMinutes: { type: Number, default: 0 },
        startTime: { type: Date },
        endTime: { type: Date },
        description: { type: String, default: '' },
        isBillable: { type: Boolean, default: true },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    recurrence: {
      isRecurring: { type: Boolean, default: false },
      frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'custom'], default: 'daily' },
      intervalDays: { type: Number, default: 1 },
      nextRunDate: { type: Date },
    },
    auditLogs: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: { type: String, default: 'System' },
        fieldChanged: { type: String, required: true },
        oldValue: { type: String, default: '' },
        newValue: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

taskSchema.index({ status: 1, priority: 1, department: 1 });
taskSchema.index({ assignees: 1 });
taskSchema.index({ createdBy: 1 });

const Task = mongoose.model('Task', taskSchema);

module.exports = {
  Task,
};
