const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['direct', 'group'],
      default: 'group',
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isArchived: {
      type: Boolean,
      default: false
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    // ── Authority-Based Communication Module fields ──
    department: {
      type: String,
      default: '',
      trim: true,
    },
    permissionScope: {
      type: String,
      default: '',
      trim: true,
    },
    groupKey: {
      type: String,
      default: null,
      sparse: true,
      trim: true,
    },
    isSystemGroup: {
      type: Boolean,
      default: false,
    },
    subscribedModules: [
      {
        type: String,
        trim: true,
      }
    ],
    subscribedActions: [
      {
        type: String,
        trim: true,
      }
    ],
  },
  {
    timestamps: true,
  }
);

const chatMessageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatRoom',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['text', 'task-card'],
      default: 'text',
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatMessage',
      default: null,
    },
    reactions: [
      {
        emoji: { type: String, required: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
      }
    ],
    attachment: {
      fileName: { type: String },
      fileType: { type: String },
      fileUrl: { type: String },
      fileSize: { type: Number }
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: []
      }
    ],
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: []
      }
    ],
    isEdited: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    isPinned: {
      type: Boolean,
      default: false
    },
    // ── Authority-Based Communication Module fields ──
    msgType: {
      type: String,
      enum: ['human', 'system_activity'],
      default: 'human',
    },
    priority: {
      type: String,
      enum: ['normal', 'urgent'],
      default: 'normal',
    },
    activityMeta: {
      action:          { type: String, default: '' },   // 'CREATE', 'UPDATE', 'DELETE', 'STAGE_CHANGE', etc.
      module:          { type: String, default: '' },   // 'Job Card', 'Invoice', 'Raw Material', etc.
      recordRef:       { type: String, default: '' },   // Human-readable ref e.g. 'JC-1024'
      recordId:        { type: String, default: '' },   // MongoDB _id string if applicable
      department:      { type: String, default: '' },
      permissionScope: { type: String, default: '' },
    },
    acknowledgments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: { type: String, default: '' },
        action: { type: String, default: 'acknowledged' }, // 'acknowledged' | 'in_progress' | 'completed'
        timestamp: { type: Date, default: Date.now },
      }
    ],
    recordMentions: [
      {
        recordType: { type: String, default: 'jobcard' }, // 'jobcard' | 'design' | 'invoice'
        recordRef: { type: String, default: '' },
      }
    ],
  },
  {
    timestamps: true,
  }
);

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);
const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

module.exports = {
  ChatRoom,
  ChatMessage,
};
