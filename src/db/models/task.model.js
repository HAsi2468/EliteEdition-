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
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['To Do', 'In Progress', 'Done'],
      default: 'To Do',
    },
    dueDate: {
      type: Date,
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
    images: [
      {
        type: String, // Storing secure URL strings from object storage
      },
    ],
    checklist: [
      {
        text: { type: String, required: true },
        completed: { type: Boolean, default: false }
      }
    ],
    comments: [
      {
        text: { type: String, required: true },
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    tags: [
      {
        text: { type: String, required: true },
        color: { type: String, default: '#3b82f6' }
      }
    ],
    subTasks: [
      {
        title: { type: String, required: true },
        completed: { type: Boolean, default: false },
        assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
      }
    ],
    timeLogs: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        hours: { type: Number, required: true },
        description: { type: String },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    activityLogs: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        action: { type: String, required: true },
        details: { type: String },
        createdAt: { type: Date, default: Date.now }
      }
    ],
  },
  {
    timestamps: true,
  }
);

const Task = mongoose.model('Task', taskSchema);

module.exports = {
  Task,
};
