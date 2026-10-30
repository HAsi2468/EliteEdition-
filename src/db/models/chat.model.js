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
        type: mongoose.Schema.Types.Mixed,
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
    avatarUrl: {
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
    companyEntity: {
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
    lastSeq: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    isInternalOnly: {
      type: Boolean,
      default: false,
    },
    lastMessage: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
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
    roomSeq: {
      type: Number,
      default: 0,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderName: {
      type: String,
      default: null,
      trim: true
    },
    content: {
      type: String,
      default: '',
      trim: true,
    },
    type: {
      type: String,
      enum: ['text', 'task-card', 'record-card', 'audio-voice', 'poll', 'sticker', 'gif', 'image', 'attachment', 'call-log'],
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
      fileSize: { type: Number },
      mimeType: { type: String },
      durationSec: { type: Number }
    },

    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: []
      }
    ],
    deliveredTo: [
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
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    deletedAt: {
      type: Date,
      default: null
    },
    isPinned: {
      type: Boolean,
      default: false
    },
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    pinnedAt: {
      type: Date,
      default: null
    },
    // ── Interactive Polls & Scheduling fields ──
    pollMeta: {
      question: { type: String, default: '' },
      isMultiSelect: { type: Boolean, default: false },
      isClosed: { type: Boolean, default: false },
      options: [
        {
          id: { type: String, required: true },
          text: { type: String, required: true },
          votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }]
        }
      ]
    },
    forwardedFrom: {
      type: {
        senderName: { type: String, default: null },
        originalRoomName: { type: String, default: null }
      },
      default: null,
      _id: false
    },
    isScheduled: {
      type: Boolean,
      default: false
    },
    scheduledAt: {
      type: Date,
      default: null
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
      recordData:      { type: mongoose.Schema.Types.Mixed }, // Full snapshot if provided
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
    // Client-side idempotency tracking key to prevent duplicate sends/retries
    clientMsgId: {
      type: String,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// High-performance indexes for ChatRoom
chatRoomSchema.index({ members: 1, updatedAt: -1 });
chatRoomSchema.index({ type: 1, isArchived: 1, updatedAt: -1 });
chatRoomSchema.index({ isArchived: 1, updatedAt: -1 });

// High-performance indexes for ChatMessage
chatMessageSchema.index({ roomId: 1, _id: -1 });
chatMessageSchema.index({ roomId: 1, createdAt: -1 });
chatMessageSchema.index({ roomId: 1, msgType: 1, createdAt: -1 });
chatMessageSchema.index({ roomId: 1, senderId: 1, readBy: 1 });
chatMessageSchema.index({ roomId: 1, clientMsgId: 1 }, { unique: true, sparse: true });
chatMessageSchema.index({ senderId: 1 });
chatMessageSchema.index({ content: 'text' });

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema, 'chatrooms');
const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema, 'chatmessages');

module.exports = {
  ChatRoom,
  ChatMessage,
};
