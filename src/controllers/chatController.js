/**
 * Agent Chat Controller
 * ─────────────────────────────────────────────────────────────────────────────
 * Implements:
 *  1. POST /chat/agent/stream  — Real SSE streaming with Gemini multi-turn tool loop
 *  2. POST /chat/agent         — Non-streaming fallback (same logic, buffered)
 *  3. GET  /chat/conversations — List persisted conversations for the current user
 *  4. GET  /chat/conversations/:id — Load a single conversation (hydration)
 *  5. DELETE /chat/conversations/:id — Delete a conversation
 *
 * SSE event shape:
 *   event: status      data: { message: string }
 *   event: tool_result data: { tool: string, result: object }
 *   event: delta       data: { text: string }
 *   event: persisted   data: { conversationId: string }
 *   event: done        data: "[DONE]"
 *   event: error       data: { message: string }
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getPermittedTools }  = require('../tools/registry');
const { erpServiceHandlers } = require('../services/erpServices');
const db                     = require('../db/models');

const MAX_AGENT_TURNS = 6;

// ─── Gemini function declarations (matched to ERP tool registry) ─────────────
const GEMINI_FUNCTION_DECLARATIONS = [
  {
    name: 'get_job_card_status',
    description: 'Fetch live status, current production stage and batch details for a job card.',
    parameters: {
      type: 'OBJECT',
      properties: {
        jobCardId: { type: 'STRING', description: 'e.g., JC-2026-104' }
      },
      required: ['jobCardId']
    }
  },
  {
    name: 'update_job_stage',
    description: 'Advance a production job card to its next operational stage.',
    parameters: {
      type: 'OBJECT',
      properties: {
        jobCardId: { type: 'STRING' },
        nextStage: {
          type: 'STRING',
          enum: ['pre_press', 'printing', 'curing', 'cutting', 'packaging', 'dispatched']
        },
        notes: { type: 'STRING' }
      },
      required: ['jobCardId', 'nextStage']
    }
  },
  {
    name: 'check_stock_balance',
    description: 'Retrieve available stock for an SKU or fabric quality across all godown bays.',
    parameters: {
      type: 'OBJECT',
      properties: {
        itemCode:    { type: 'STRING' },
        warehouseId: { type: 'STRING' }
      },
      required: ['itemCode']
    }
  },
  {
    name: 'report_machine_downtime',
    description: 'Log an unexpected machine breakdown or halt for a production job.',
    parameters: {
      type: 'OBJECT',
      properties: {
        jobCardId: { type: 'STRING' },
        reason:    { type: 'STRING' }
      },
      required: ['jobCardId', 'reason']
    }
  },
  {
    name: 'get_client_receivables',
    description: 'Retrieve outstanding invoices, balance due, and aging for a client.',
    parameters: {
      type: 'OBJECT',
      properties: {
        clientId: { type: 'STRING' }
      },
      required: ['clientId']
    }
  },
  {
    name: 'request_action_confirmation',
    description: 'Create a Human-in-the-Loop confirmation ticket for a high-impact irreversible action (e.g., cancel a job, delete a record). Call this instead of executing the action directly.',
    parameters: {
      type: 'OBJECT',
      properties: {
        actionType:    { type: 'STRING', description: 'One of: CANCEL_JOB, DELETE_RECORD, MANUAL_STOCK_ADJUSTMENT' },
        payload:       { type: 'STRING', description: 'JSON string of the action parameters' },
        impactSummary: { type: 'STRING', description: 'One sentence describing the irreversible impact to show the user' }
      },
      required: ['actionType', 'payload', 'impactSummary']
    }
  },
  {
    name: 'apply_order_discount',
    description: 'Apply a discount to an order. If the requested discount exceeds the user\'s authority limit, it is automatically escalated to a manager for approval instead.',
    parameters: {
      type: 'OBJECT',
      properties: {
        orderId:      { type: 'STRING' },
        discountPct:  { type: 'NUMBER', description: 'Discount percentage (0–100)' },
        reason:       { type: 'STRING' }
      },
      required: ['orderId', 'discountPct']
    }
  }
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildUserContext(req) {
  return {
    userId:   String(req.user?._id || req.user?.id || 'sys-user'),
    userName: req.user?.name || req.user?.username || 'Staff User',
    tenantId: req.user?.companyId || req.user?.companyEntity || 'elite_digital_print',
    role:     req.user?.role || (req.user?.isAdmin ? 'admin' : 'operator'),
    permissions: req.user?.permissions || (req.user?.isAdmin
      ? ['admin:*']
      : ['production:read', 'production:write', 'inventory:read']),
    isAdmin: Boolean(req.user?.isAdmin || req.user?.isMainAdmin || req.user?.role === 'admin')
  };
}

function buildGeminiSystemPrompt(ctx) {
  return [
    'You are the ERP Operations Copilot for Elite Digital Print, an Indian textile and digital printing company.',
    'Always invoke tools for factual data — NEVER fabricate stock levels, job statuses, or financial figures.',
    `User: ${ctx.userName} | Role: ${ctx.role} | Tenant: ${ctx.tenantId}`,
    'For high-impact irreversible actions (cancel job, delete record), call request_action_confirmation instead of acting directly.',
    'For discounts exceeding authority, call apply_order_discount — it will escalate automatically.',
    'Respond in plain markdown. Be concise and professional.'
  ].join('\n');
}

/**
 * Persist one user+assistant turn to MongoDB.
 * Creates the conversation if conversationId is null.
 * Returns the conversationId string.
 */
async function persistTurn({ conversationId, tenantId, userId, userText, assistantText, toolEvents }) {
  try {
    const AIChatConversation = db.AIChatConversation;
    if (!AIChatConversation) return null;

    const userMsg = { role: 'user', content: userText, toolEvents: [], timestamp: new Date() };
    const assistantMsg = {
      role: 'assistant',
      content: assistantText,
      toolEvents: toolEvents || [],
      timestamp: new Date()
    };

    // Auto-generate conversation title from the first user message
    const title = String(userText).slice(0, 72) || 'New Conversation';

    if (conversationId) {
      const updated = await AIChatConversation.findByIdAndUpdate(
        conversationId,
        { $push: { messages: { $each: [userMsg, assistantMsg] } } },
        { new: true }
      ).lean();
      return updated ? String(updated._id) : null;
    }

    const newConv = await AIChatConversation.create({
      tenantId,
      userId,
      title,
      messages: [userMsg, assistantMsg]
    });
    return String(newConv._id);
  } catch (err) {
    console.error('[chatController] persistTurn error:', err.message);
    return null;
  }
}

/**
 * Core Gemini multi-turn tool loop.
 * Dispatches function calls to erpServiceHandlers, emits SSE events via callbacks.
 * Returns { textBuffer, toolEvents }.
 */
async function runGeminiLoop({ message, conversationId, userContext, onStatus, onToolResult, onDelta, isAbortedCheck }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const genAI = new GoogleGenerativeAI(apiKey);
  const permittedToolNames = new Set(
    getPermittedTools(userContext.permissions, userContext.role, userContext.isAdmin)
      .map(t => t.function?.name).filter(Boolean)
  );

  // Filter declarations to only tools the user is allowed to call
  const allowedDecls = GEMINI_FUNCTION_DECLARATIONS.filter(d => permittedToolNames.has(d.name));

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: buildGeminiSystemPrompt(userContext),
    ...(allowedDecls.length > 0 ? { tools: [{ functionDeclarations: allowedDecls }] } : {})
  });

  // Hydrate conversation history from DB if continuing an existing session
  const geminiHistory = [];
  if (conversationId && db.AIChatConversation) {
    try {
      const conv = await db.AIChatConversation.findOne({
        _id: conversationId,
        tenantId: userContext.tenantId,
        userId: userContext.userId
      }).lean();
      if (conv && Array.isArray(conv.messages)) {
        const recent = conv.messages.slice(-10);
        for (const m of recent) {
          const role = m.role === 'assistant' ? 'model' : 'user';
          const text = String(m.content || '').trim();
          if (!text) continue;
          const last = geminiHistory[geminiHistory.length - 1];
          if (last && last.role === role) {
            last.parts[0].text += `\n${text}`;
          } else {
            geminiHistory.push({ role, parts: [{ text }] });
          }
        }
        if (geminiHistory.length > 0 && geminiHistory[0].role !== 'user') {
          geminiHistory.shift();
        }
        if (geminiHistory.length > 0 && geminiHistory[geminiHistory.length - 1].role !== 'model') {
          geminiHistory.pop();
        }
      }
    } catch (hErr) {
      console.warn('[chatController] Failed to load history:', hErr.message);
    }
  }

  const chat = model.startChat({ history: geminiHistory });

  const toolEvents = [];
  let textBuffer = '';
  let pendingMessage = message;
  let pendingFunctionResponses = null;

  for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
    if (isAbortedCheck && isAbortedCheck()) {
      console.log('[chatController] Abort signal received. Breaking turn loop.');
      break;
    }

    // Use the pending function responses after the first user turn
    const payload = pendingFunctionResponses || pendingMessage;
    const result = await chat.sendMessage(payload);

    if (isAbortedCheck && isAbortedCheck()) {
      break;
    }

    const response = await result.response;
    const functionCalls = response.functionCalls();

    if (!functionCalls || functionCalls.length === 0) {
      // Final text response — stream word by word
      const finalText = response.text() || '';
      textBuffer = finalText;

      if (onDelta && finalText) {
        // Split on whitespace boundaries to give natural streaming feel
        const tokens = finalText.match(/\S+\s*/g) || [finalText];
        for (const token of tokens) {
          if (isAbortedCheck && isAbortedCheck()) break;
          onDelta(token);
          await new Promise(r => setTimeout(r, 12));
        }
      }
      break;
    }

    // Process function calls
    pendingFunctionResponses = [];
    for (const call of functionCalls) {
      if (isAbortedCheck && isAbortedCheck()) break;
      if (onStatus) onStatus(`Running ${call.name.replace(/_/g, ' ')}…`);

      const handler = erpServiceHandlers[call.name];
      let toolResult;

      if (!handler) {
        toolResult = { error: `Handler not found for tool: ${call.name}` };
      } else {
        try {
          const args = typeof call.args === 'string' ? JSON.parse(call.args) : call.args;
          toolResult = await handler(args, userContext);
        } catch (execErr) {
          toolResult = { error: execErr.message || 'Tool execution failed.' };
        }
      }

      toolEvents.push({ tool: call.name, result: toolResult });
      if (onToolResult && (!isAbortedCheck || !isAbortedCheck())) {
        onToolResult(call.name, toolResult);
      }

      pendingFunctionResponses.push({
        functionResponse: { name: call.name, response: { result: toolResult } }
      });
    }

    pendingMessage = null; // subsequent turns use functionResponses only
  }

  return { textBuffer, toolEvents };
}

// ─── SSE Streaming Endpoint ───────────────────────────────────────────────────

async function handleAgentChatStream(req, res) {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // nginx: disable proxy buffering
  res.flushHeaders?.();

  let isAborted = false;
  req.on('close', () => {
    isAborted = true;
  });

  const sendEvent = (event, data) => {
    if (isAborted) return;
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    res.write(`event: ${event}\ndata: ${payload}\n\n`);
  };

  try {
    const { message, conversationId = null } = req.body || {};

    if (!message || !String(message).trim()) {
      sendEvent('error', { message: 'Message is required.' });
      return res.end();
    }

    const userContext = buildUserContext(req);
    sendEvent('status', { message: 'Analyzing your request…' });

    const { textBuffer, toolEvents } = await runGeminiLoop({
      message,
      conversationId,
      userContext,
      onStatus:       (msg)          => sendEvent('status',      { message: msg }),
      onToolResult:   (tool, result) => sendEvent('tool_result', { tool, result }),
      onDelta:        (text)         => sendEvent('delta',       { text }),
      isAbortedCheck: ()             => isAborted
    });

    if (isAborted) {
      return res.end();
    }

    // Persist the completed turn
    const savedConvId = await persistTurn({
      conversationId,
      tenantId:       userContext.tenantId,
      userId:         userContext.userId,
      userText:       message,
      assistantText:  textBuffer,
      toolEvents
    });

    if (savedConvId) {
      sendEvent('persisted', { conversationId: savedConvId });
    }

    sendEvent('done', '[DONE]');
    return res.end();
  } catch (err) {
    if (isAborted) return;
    console.error('[chatController] SSE stream error:', err);
    sendEvent('error', { message: err.message || 'Internal agent error.' });
    return res.end();
  }
}

// ─── Non-Streaming Fallback ───────────────────────────────────────────────────

async function handleAgentChat(req, res) {
  try {
    const { message, conversationId = null } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const userContext = buildUserContext(req);

    const { textBuffer: reply, toolEvents } = await runGeminiLoop({
      message,
      conversationId,
      userContext,
      onStatus:     () => {},
      onToolResult: () => {},
      onDelta:      () => {},
      isAbortedCheck: () => false
    });

    const savedConvId = await persistTurn({
      conversationId,
      tenantId:      userContext.tenantId,
      userId:        userContext.userId,
      userText:      message,
      assistantText: reply,
      toolEvents
    });

    return res.json({ reply, toolEvents, conversationId: savedConvId });
  } catch (err) {
    console.error('[chatController] handleAgentChat error:', err);
    return res.status(500).json({ error: err.message || 'Internal error.' });
  }
}

// ─── Conversation CRUD ────────────────────────────────────────────────────────

async function listConversations(req, res) {
  try {
    const userContext = buildUserContext(req);
    const AIChatConversation = db.AIChatConversation;
    if (!AIChatConversation) return res.json({ conversations: [] });

    const conversations = await AIChatConversation
      .find({ tenantId: userContext.tenantId, userId: userContext.userId })
      .sort({ updatedAt: -1 })
      .limit(50)
      .select('_id title updatedAt messages')
      .lean();

    const list = conversations.map(c => ({
      _id:          c._id,
      title:        c.title || 'Conversation',
      updatedAt:    c.updatedAt,
      messageCount: c.messages?.length || 0,
      preview:      c.messages?.find(m => m.role === 'assistant')?.content?.slice(0, 120) || ''
    }));

    return res.json({ conversations: list });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getConversation(req, res) {
  try {
    const userContext      = buildUserContext(req);
    const { id }           = req.params;
    const AIChatConversation = db.AIChatConversation;
    if (!AIChatConversation) return res.status(404).json({ error: 'Not found.' });

    const conv = await AIChatConversation
      .findOne({ _id: id, tenantId: userContext.tenantId, userId: userContext.userId })
      .lean();

    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
    return res.json({ conversation: conv });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function deleteConversation(req, res) {
  try {
    const userContext = buildUserContext(req);
    const { id }      = req.params;
    const AIChatConversation = db.AIChatConversation;
    if (!AIChatConversation) return res.status(404).json({ error: 'Not found.' });

    await AIChatConversation.deleteOne({ _id: id, tenantId: userContext.tenantId, userId: userContext.userId });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Real-time WebSocket + Background Web Push Dispatcher for Chat Messages
 */
async function dispatchChatMessage({
  io,
  roomId,
  populatedMessage,
  targetRoom,
  senderId,
  rawContent,
  priority = 'normal'
}) {
  try {
    if (!io) return;
    const strRoomId = String(roomId);
    let broadcast = io.to(strRoomId);

    // Also broadcast directly to member user rooms for unread indicators
    if (targetRoom && Array.isArray(targetRoom.members) && targetRoom.members.length > 0) {
      targetRoom.members.forEach((m) => {
        const mIdStr = typeof m === 'object' ? (m._id || m.id) : m;
        if (mIdStr) broadcast = broadcast.to(`user_${mIdStr}`);
      });
    }

    try {
      const commCtrl = require('./communication.controller');
      if (commCtrl.invalidateGroupMessagesCache) commCtrl.invalidateGroupMessagesCache(strRoomId);
      if (commCtrl.invalidateGroupsCache) commCtrl.invalidateGroupsCache();
    } catch (_) {}

    broadcast.emit('receive-message', populatedMessage);

    // Selective Web Push for background users
    try {
      const webPushService = require('../services/webPush.service');
      if (webPushService && typeof webPushService.sendPushToUsers === 'function' && targetRoom) {
        const recipientIds = (targetRoom.members || [])
          .map(m => String(typeof m === 'object' ? (m._id || m.id) : m))
          .filter(id => id && id !== String(senderId));

        if (recipientIds.length > 0) {
          const senderName = populatedMessage?.senderName || populatedMessage?.senderId?.name || 'Someone';
          const title = targetRoom.type === 'direct'
            ? `💬 ${senderName}`
            : `💬 ${senderName} in ${targetRoom.name || 'Chat'}`;
          const bodyText = rawContent || (populatedMessage?.attachment ? `[File] ${populatedMessage.attachment.fileName}` : 'Sent a message');

          webPushService.sendPushToUsers(recipientIds, {
            title,
            body: bodyText.length > 100 ? bodyText.slice(0, 100) + '...' : bodyText,
            icon: '/Logo.png',
            badge: '/Logo.png',
            tag: `msg-${populatedMessage?._id}`,
            data: {
              url: '/communication',
              roomId: strRoomId,
              type: 'chat_message'
            }
          }, { urgency: priority === 'urgent' ? 'high' : 'normal' }).catch(err => {
            console.warn('[dispatchChatMessage push notification warning]:', err.message);
          });
        }
      }
    } catch (pushErr) {
      console.warn('[dispatchChatMessage webPushService skipped]:', pushErr.message);
    }
  } catch (err) {
    console.error('[dispatchChatMessage error]:', err.message);
  }
}

module.exports = {
  handleAgentChatStream,
  handleAgentChat,
  listConversations,
  getConversation,
  deleteConversation,
  dispatchChatMessage
};

