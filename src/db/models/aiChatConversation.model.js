/**
 * AIChatConversation Model
 * Persists per-user AI agent sessions: OpenAI-compatible message history
 * plus client-side toolEvents array for interactive card hydration on page refresh.
 */

const mongoose = require('mongoose');

const ToolEventSchema = new mongoose.Schema(
  {
    tool:   { type: String, required: true },
    result: { type: mongoose.Schema.Types.Mixed, required: true }
  },
  { _id: false }
);

const AIChatMessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content:    { type: String, default: '' },
  toolEvents: [ToolEventSchema],
  timestamp:  { type: Date, default: Date.now }
});

const AIChatConversationSchema = new mongoose.Schema(
  {
    // Tenant + user scoping
    tenantId: { type: String, required: true, index: true },
    userId:   { type: String, required: true, index: true },
    title:    { type: String, default: 'New Conversation' },
    messages: [AIChatMessageSchema]
  },
  { timestamps: true }
);

// Fast lookup by user, sorted by most recently updated
AIChatConversationSchema.index({ tenantId: 1, userId: 1, updatedAt: -1 });

const AIChatConversation = mongoose.model('AIChatConversation', AIChatConversationSchema);

module.exports = { AIChatConversation };
