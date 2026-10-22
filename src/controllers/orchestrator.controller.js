/**
 * ERP-Core Orchestrator Controller
 * Exposes API endpoints and chat integration for the ERP operational agent.
 */

const orchestratorService = require('../services/orchestrator.service');
const { ChatMessage, ChatRoom, user: User } = require('../db/models');

let cachedBotUser = null;

async function getOrchestratorBotUser() {
  if (cachedBotUser) return cachedBotUser;
  try {
    let bot = await User.findOne({ email: 'orchestrator@elitedigital.internal' });
    if (!bot) {
      bot = await User.create({
        name: 'ERP-Core Orchestrator',
        username: 'orchestrator',
        email: 'orchestrator@elitedigital.internal',
        role: 'admin',
        isAdmin: true,
        isMainAdmin: false,
        permissions: ['jobcards', 'billing', 'inventory', 'sales_orders'],
        allowedCompanies: ['Elite Digital Print'],
        password: '$2a$10$wE1V2vY90uP8QZ02B19eU.1s8l.94m4m1m1m1m1m1m1m1m1m1m1m'
      });
    }
    cachedBotUser = bot;
    return bot;
  } catch (err) {
    console.warn('[OrchestratorController] Could not find or create bot user:', err.message);
    return null;
  }
}

/**
 * POST /v1/ai/orchestrator
 */
const handlePrompt = async (req, res) => {
  try {
    const { prompt, history, active_workspace } = req.body;
    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ success: false, message: 'Field "prompt" is required.' });
    }

    const userContext = {
      ...(req.user || {}),
      active_workspace: active_workspace || 'Production Hub'
    };

    const result = await orchestratorService.processOrchestratorPrompt({
      prompt: String(prompt).trim(),
      userContext,
      history: history || []
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('[OrchestratorController Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process orchestrator request: ' + error.message
    });
  }
};

/**
 * POST /v1/ai/orchestrator/confirm
 */
const handleConfirm = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Confirmation token is required.' });
    }

    const result = await orchestratorService.confirmTier3Action(token);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('[OrchestratorConfirm Error]:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Chat Integration: Background Processor for Mentions and Bot Rooms
 */
const processChatMessage = async ({ room, message, user, io }) => {
  try {
    if (!room || !message || !message.content) return;
    const rawContent = message.content.trim();

    // Check if Orchestrator is mentioned or targeted
    const isMentioned = /@(ERP-Core Orchestrator|Orchestrator|bot|agent)\b/i.test(rawContent) ||
      rawContent.startsWith('/orchestrator');

    const isOrchestratorRoom = room.name && /orchestrator|ai assistant/i.test(room.name);

    if (!isMentioned && !isOrchestratorRoom) {
      return;
    }

    // Clean prompt by removing trigger mentions
    const cleanPrompt = rawContent
      .replace(/@(ERP-Core Orchestrator|Orchestrator|bot|agent)\b/gi, '')
      .replace(/^\/orchestrator\s*/i, '')
      .trim();

    if (!cleanPrompt) return;

    // Execute Orchestrator with User Session Context
    const orchestratorResult = await orchestratorService.processOrchestratorPrompt({
      prompt: cleanPrompt,
      userContext: user || {}
    });

    const botUser = await getOrchestratorBotUser();
    const botSenderId = botUser ? botUser._id : (user._id || user.id);

    // Increment room sequence
    const updatedRoom = await ChatRoom.findByIdAndUpdate(
      room._id,
      { $inc: { lastSeq: 1 }, updatedAt: new Date() },
      { new: true }
    );
    const roomSeq = updatedRoom?.lastSeq || (room.lastSeq || 0) + 1;

    // Create Chat Message with structured Operational Card
    const botMessage = await ChatMessage.create({
      roomId: room._id,
      senderId: botSenderId,
      senderName: 'ERP-Core Orchestrator',
      content: orchestratorResult.text,
      replyTo: message._id,
      type: 'text',
      msgType: 'human',
      priority: 'normal',
      activityMeta: {
        isOrchestrator: true,
        receipt: orchestratorResult.receipt,
        interactiveCard: orchestratorResult.interactiveCard,
        isTier3Required: orchestratorResult.isTier3Required
      },
      readBy: [botSenderId],
      createdAt: new Date(),
      roomSeq
    });

    const populatedBotMessage = await ChatMessage.findById(botMessage._id)
      .populate('senderId', 'name username email role')
      .populate('readBy', 'name username email')
      .populate({
        path: 'replyTo',
        populate: { path: 'senderId', select: 'name username email' }
      });

    // Broadcast in real-time
    if (io) {
      io.to(`room_${room._id}`).emit('message:received', populatedBotMessage);
      io.to(`room_${room._id}`).emit('room:updated', {
        roomId: room._id,
        lastMessage: populatedBotMessage,
        updatedAt: new Date()
      });
    }
  } catch (err) {
    console.error('[Orchestrator processChatMessage Error]:', err.message);
  }
};

module.exports = {
  handlePrompt,
  handleConfirm,
  processChatMessage,
  getOrchestratorBotUser
};
