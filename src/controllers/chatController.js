const { ChatMessage, ChatRoom, User } = require('../db/models');
const pushNotificationService = require('../services/pushNotificationService');
const { sanitizeChatMessage, validateAttachment } = require('../utils/sanitizeChat');
const logger = require('../config/logger');

const getMemberIdString = (m) => {
  if (!m) return '';
  if (typeof m === 'object') {
    if (m._id) return String(m._id);
    return m.toString ? m.toString() : String(m);
  }
  return String(m);
};

/**
 * Intelligent Room Presence Verifier:
 * Checks whether a user has an active, foregrounded WebSocket in a given chat room
 * @param {object} io - Socket.io server instance
 * @param {string} userId - Recipient user ID
 * @param {string} roomId - Chat room ID
 * @returns {boolean} true if user is actively focused in that room
 */
function isUserActiveInChatRoom(io, userId, roomId) {
  if (!io || !userId || !roomId) return false;
  try {
    const userRoom = io.sockets.adapter?.rooms?.get(`user_${userId}`);
    if (!userRoom || userRoom.size === 0) return false;

    const strRoomId = String(roomId);
    for (const socketId of userRoom) {
      const s = io.sockets.sockets.get(socketId);
      if (s && s.rooms && s.rooms.has(strRoomId) && !s.isBackgrounded) {
        return true;
      }
    }
  } catch (err) {
    logger.warn(`[IntelligentDispatch] Presence check notice: ${err.message}`);
  }
  return false;
}

/**
 * Intelligent Message Dispatcher:
 * Transmits via real-time WebSocket, and selectively triggers background Web Push
 * ONLY for recipients who are offline, backgrounded, or in another room.
 */
async function dispatchChatMessage({ io, roomId, populatedMessage, targetRoom, senderId, rawContent, priority }) {
  const strRoomId = String(roomId);

  // 1. Always broadcast real-time WebSocket event to active listeners & user channels
  if (io) {
    let broadcast = io.to(strRoomId);
    if (targetRoom.members && targetRoom.members.length > 0) {
      targetRoom.members.forEach((m) => {
        const mIdStr = getMemberIdString(m);
        if (mIdStr) broadcast = broadcast.to(`user_${mIdStr}`);
      });
    }
    broadcast.emit('receive-message', populatedMessage);
  }

  // 2. Intelligent Push Routing: Filter recipients who need background Web Push
  const senderDisplayName =
    populatedMessage.senderId?.name ||
    populatedMessage.senderId?.username ||
    'Team Member';

  const cleanSnippet =
    (rawContent || '').slice(0, 120) ||
    (populatedMessage.attachment ? `Attached: ${populatedMessage.attachment.fileName || 'file'}` : 'New message');

  const pushPayload = {
    title: targetRoom.name ? `${senderDisplayName} in ${targetRoom.name}` : senderDisplayName,
    body: cleanSnippet,
    icon: '/Logo.png',
    badge: '/Logo.png',
    tag: `chat-room-${strRoomId}`, // Collapses alerts per thread gracefully
    renotify: true,
    timestamp: Date.now(),
    priority: priority === 'urgent' ? 'urgent' : 'normal',
    data: {
      roomId: strRoomId,
      url: `/communication?room=${strRoomId}`,
      priority: priority === 'urgent' ? 'urgent' : 'normal',
    },
    actions: [
      { action: 'open', title: 'Open Chat' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  const members = targetRoom.members || [];
  const pushPromises = [];

  for (const member of members) {
    const memberId = getMemberIdString(member);
    if (!memberId || memberId === String(senderId)) continue; // Never push to self

    // Check if recipient is actively connected AND viewing this specific room
    const isActiveInRoom = isUserActiveInChatRoom(io, memberId, strRoomId);

    if (isActiveInRoom) {
      // User is live and actively watching the conversation; suppress push notification
      logger.info(`[IntelligentDispatch] Suppressed push for active user ${memberId} in room ${strRoomId}`);
    } else {
      // User is either disconnected, app backgrounded, or navigating another screen
      // Dispatch background Web Push
      pushPromises.push(
        pushNotificationService.sendPushToUser(memberId, pushPayload).catch((err) => {
          logger.warn(`[IntelligentDispatch] Push dispatch error for ${memberId}: ${err.message}`);
        })
      );
    }
  }

  if (pushPromises.length > 0) {
    await Promise.allSettled(pushPromises);
  }
}

module.exports = {
  isUserActiveInChatRoom,
  dispatchChatMessage,
  getMemberIdString,
};
