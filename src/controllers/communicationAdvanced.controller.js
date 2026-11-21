const mongoose = require('mongoose');
const axios = require('axios');
const { ChatRoom, ChatMessage } = require('../db/models/chat.model');
const { User } = require('../db/models');
const logger = require('../config/logger');
const { sanitizeChatMessage } = require('../utils/sanitizeChat');

const getUserId = (req) => String(req.user?._id || req.user?.id || '');
const isAdminUser = (req) => {
  const r = String(req.user?.role || '').toLowerCase();
  return r === 'admin' || r === 'super_admin' || req.user?.isAdmin === true || req.user?.isMainAdmin === true;
};
const canAccessRoom = async (req, roomId) => {
  if (isAdminUser(req)) return true;
  const userId = getUserId(req);
  if (!userId || !roomId || !mongoose.Types.ObjectId.isValid(roomId)) return false;
  const room = await ChatRoom.findById(roomId).select('members isSystemGroup').lean();
  if (!room) return false;
  if (!Array.isArray(room.members) || room.members.length === 0) return Boolean(room.isSystemGroup);
  return room.members.some((m) => String(m?._id || m) === userId);
};

/**
 * 1. Per-Chat Mute / Unmute (durationMinutes = 0 -> unmute, null -> mute forever, >0 -> mute for N minutes)
 */
const toggleMuteRoom = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { groupId } = req.params;
    const { muted = true, durationMinutes = null } = req.body || {};

    if (!userId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ success: false, message: 'Invalid room or user ID' });
    }

    await ChatRoom.findByIdAndUpdate(groupId, {
      $pull: { mutedBy: { userId: new mongoose.Types.ObjectId(userId) } }
    });

    if (muted) {
      const mutedUntil = durationMinutes && Number(durationMinutes) > 0
        ? new Date(Date.now() + Number(durationMinutes) * 60000)
        : null;
      await ChatRoom.findByIdAndUpdate(groupId, {
        $push: { mutedBy: { userId: new mongoose.Types.ObjectId(userId), mutedUntil } }
      });
    }

    try { require('./communication.controller').invalidateGroupsCache(); } catch (_) {}

    return res.json({ success: true, muted: Boolean(muted) });
  } catch (err) {
    logger.error('toggleMuteRoom error: %o', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 2. Per-User Archive / Unarchive Room
 */
const toggleArchiveRoom = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { groupId } = req.params;
    const { archived = true } = req.body || {};

    if (!userId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ success: false, message: 'Invalid room or user ID' });
    }

    const op = archived
      ? { $addToSet: { archivedBy: new mongoose.Types.ObjectId(userId) } }
      : { $pull: { archivedBy: new mongoose.Types.ObjectId(userId) } };

    await ChatRoom.findByIdAndUpdate(groupId, op);
    try { require('./communication.controller').invalidateGroupsCache(); } catch (_) {}
    return res.json({ success: true, archived: Boolean(archived) });
  } catch (err) {
    logger.error('toggleArchiveRoom error: %o', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 3. Disappearing Messages Timer per Room
 */
const updateDisappearTimer = async (req, res) => {
  try {
    const { groupId } = req.params;
    const disappearAfterSec = Math.max(0, Number(req.body?.disappearAfterSec || 0));

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ success: false, message: 'Invalid room ID' });
    }

    const room = await ChatRoom.findByIdAndUpdate(
      groupId,
      { $set: { disappearAfterSec } },
      { new: true }
    ).lean();

    const io = global.io || req.app?.get('io');
    if (io) {
      io.to(String(groupId)).emit('room-disappear-updated', { groupId, disappearAfterSec });
    }
    try { require('./communication.controller').invalidateGroupsCache(); } catch (_) {}

    return res.json({ success: true, disappearAfterSec: room?.disappearAfterSec || 0 });
  } catch (err) {
    logger.error('updateDisappearTimer error: %o', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 4. Personal Star / Bookmark Message Toggle & Fetch All Starred Messages
 */
const toggleStarMessage = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { messageId } = req.params;
    if (!userId || !mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ success: false, message: 'Invalid message ID' });
    }

    const msg = await ChatMessage.findById(messageId).select('roomId starredBy').lean();
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });
    if (!(await canAccessRoom(req, msg.roomId))) {
      return res.status(403).json({ success: false, message: 'Access denied to this room' });
    }

    const alreadyStarred = Array.isArray(msg.starredBy) && msg.starredBy.some(id => String(id) === userId);
    const op = alreadyStarred
      ? { $pull: { starredBy: new mongoose.Types.ObjectId(userId) } }
      : { $addToSet: { starredBy: new mongoose.Types.ObjectId(userId) } };

    await ChatMessage.findByIdAndUpdate(messageId, op);
    return res.json({ success: true, starred: !alreadyStarred });
  } catch (err) {
    logger.error('toggleStarMessage error: %o', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getStarredMessages = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const messages = await ChatMessage.find({
      starredBy: new mongoose.Types.ObjectId(userId),
      isDeleted: { $ne: true },
      isScheduled: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('roomId', 'name type')
      .populate('senderId', 'name avatarUrl')
      .lean();

    return res.json({ success: true, data: messages });
  } catch (err) {
    logger.error('getStarredMessages error: %o', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 5. Threaded Sub-Replies (Slack/Teams style side-panel thread)
 */
const getThreadMessages = async (req, res) => {
  try {
    const { messageId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ success: false, message: 'Invalid parent message ID' });
    }

    const [parent, replies] = await Promise.all([
      ChatMessage.findById(messageId)
        .populate('senderId', 'name avatarUrl role')
        .lean(),
      ChatMessage.find({
        replyTo: new mongoose.Types.ObjectId(messageId),
        isDeleted: { $ne: true },
        isScheduled: { $ne: true },
      })
        .sort({ createdAt: 1 })
        .populate('senderId', 'name avatarUrl role')
        .lean(),
    ]);

    if (!parent) return res.status(404).json({ success: false, message: 'Parent message not found' });
    if (!(await canAccessRoom(req, parent.roomId))) {
      return res.status(403).json({ success: false, message: 'Access denied to this room' });
    }
    return res.json({ success: true, parent, replies });
  } catch (err) {
    logger.error('getThreadMessages error: %o', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 6. Message Info (Read-by / Delivered-to user list)
 */
const getMessageInfo = async (req, res) => {
  try {
    const { messageId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ success: false, message: 'Invalid message ID' });
    }

    const msg = await ChatMessage.findById(messageId)
      .select('senderId roomId readBy deliveredTo createdAt expiresAt')
      .populate('readBy', 'name email avatarUrl role')
      .populate('deliveredTo', 'name email avatarUrl role')
      .lean();

    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });
    if (!(await canAccessRoom(req, msg.roomId))) {
      return res.status(403).json({ success: false, message: 'Access denied to this room' });
    }
    return res.json({
      success: true,
      data: {
        readBy: msg.readBy || [],
        deliveredTo: msg.deliveredTo || [],
        createdAt: msg.createdAt,
        expiresAt: msg.expiresAt || null,
      }
    });
  } catch (err) {
    logger.error('getMessageInfo error: %o', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 7. Multi-Select Bulk Message Actions (delete or forward multiple messages)
 */
const bulkMessageAction = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { action, messageIds = [], targetRoomId } = req.body || {};
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No messages selected' });
    }

    const validIds = messageIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
    if (validIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid message IDs' });
    }

    const io = global.io || req.app?.get('io');

    if (action === 'delete') {
      const isAdmin = isAdminUser(req);
      const filter = isAdmin
        ? { _id: { $in: validIds } }
        : { _id: { $in: validIds }, senderId: new mongoose.Types.ObjectId(userId) };

      const msgs = await ChatMessage.find(filter).select('_id roomId').lean();
      await ChatMessage.updateMany(filter, {
        $set: { isDeleted: true, deletedBy: new mongoose.Types.ObjectId(userId), deletedAt: new Date(), content: 'This message was deleted' }
      });

      if (io) {
        msgs.forEach(m => {
          io.to(String(m.roomId)).emit('message-deleted', { messageId: String(m._id), roomId: String(m.roomId) });
        });
      }
      return res.json({ success: true, count: msgs.length });
    }

    if (action === 'forward') {
      if (!targetRoomId || !mongoose.Types.ObjectId.isValid(targetRoomId)) {
        return res.status(400).json({ success: false, message: 'Target room ID is required' });
      }
      if (!(await canAccessRoom(req, targetRoomId))) {
        return res.status(403).json({ success: false, message: 'Access denied to target room' });
      }
      const originals = await ChatMessage.find({ _id: { $in: validIds }, isDeleted: { $ne: true } })
        .sort({ createdAt: 1 })
        .populate('roomId', 'name')
        .lean();

      const senderName = req.user?.name || 'User';
      const created = [];
      for (const orig of originals) {
        const origRoomId = orig.roomId?._id || orig.roomId;
        if (!(await canAccessRoom(req, origRoomId))) continue;
        const doc = await ChatMessage.create({
          roomId: new mongoose.Types.ObjectId(targetRoomId),
          senderId: new mongoose.Types.ObjectId(userId),
          senderName,
          content: orig.content || '',
          type: orig.type || 'text',
          attachment: orig.attachment || undefined,
          forwardedFrom: {
            senderName: orig.senderName || 'Staff',
            originalRoomName: orig.roomId?.name || 'Chat'
          },
          readBy: [new mongoose.Types.ObjectId(userId)],
        });
        created.push(doc);
        if (io) {
          io.to(String(targetRoomId)).emit('receive-message', doc.toObject());
        }
      }
      return res.json({ success: true, count: created.length });
    }

    return res.status(400).json({ success: false, message: 'Unsupported bulk action' });
  } catch (err) {
    logger.error('bulkMessageAction error: %o', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 8. Scheduled Messages (Create, List, Cancel)
 */
const scheduleMessage = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { groupId } = req.params;
    const { content = '', scheduledAt, type = 'text' } = req.body || {};

    if (!userId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ success: false, message: 'Invalid room or user ID' });
    }
    const sendDate = new Date(scheduledAt);
    if (!scheduledAt || isNaN(sendDate.getTime()) || sendDate.getTime() <= Date.now()) {
      return res.status(400).json({ success: false, message: 'Scheduled time must be in the future' });
    }
    const cleanContent = sanitizeChatMessage(String(content).trim(), 5000);
    if (!cleanContent) {
      return res.status(400).json({ success: false, message: 'Message content cannot be empty' });
    }
    const allowedTypes = ['text', 'image', 'file', 'audio', 'video'];
    const safeType = allowedTypes.includes(type) ? type : 'text';

    const msg = await ChatMessage.create({
      roomId: new mongoose.Types.ObjectId(groupId),
      senderId: new mongoose.Types.ObjectId(userId),
      senderName: req.user?.name || 'User',
      content: cleanContent,
      type: safeType,
      isScheduled: true,
      scheduledAt: sendDate,
      readBy: [new mongoose.Types.ObjectId(userId)],
    });

    return res.json({ success: true, data: msg });
  } catch (err) {
    logger.error('scheduleMessage error: %o', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getScheduledMessages = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { groupId } = req.params;
    const filter = {
      senderId: new mongoose.Types.ObjectId(userId),
      isScheduled: true,
      isDeleted: { $ne: true },
    };
    if (groupId) {
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        return res.status(400).json({ success: false, message: 'Invalid room ID' });
      }
      filter.roomId = new mongoose.Types.ObjectId(groupId);
    }

    const list = await ChatMessage.find(filter).sort({ scheduledAt: 1 }).lean();
    return res.json({ success: true, data: list });
  } catch (err) {
    logger.error('getScheduledMessages error: %o', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const cancelScheduledMessage = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { messageId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ success: false, message: 'Invalid message ID' });
    }

    await ChatMessage.deleteOne({
      _id: new mongoose.Types.ObjectId(messageId),
      senderId: new mongoose.Types.ObjectId(userId),
      isScheduled: true,
    });
    return res.json({ success: true });
  } catch (err) {
    logger.error('cancelScheduledMessage error: %o', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 9. Safe Link Preview Metadata Extractor (SSRF-guarded)
 */
const linkPreviewCache = new Map();
const getLinkPreview = async (req, res) => {
  try {
    const rawUrl = String(req.query?.url || '').trim();
    if (!rawUrl) return res.status(400).json({ success: false, message: 'URL required' });

    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch (_) {
      return res.status(400).json({ success: false, message: 'Invalid URL' });
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ success: false, message: 'Unsupported protocol' });
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return res.status(403).json({ success: false, message: 'Private addresses blocked' });
    }

    if (linkPreviewCache.has(rawUrl)) {
      return res.json({ success: true, data: linkPreviewCache.get(rawUrl) });
    }

    const resp = await axios.get(rawUrl, {
      timeout: 3500,
      maxContentLength: 512 * 1024,
      headers: { 'User-Agent': 'EliteERP-LinkPreview/1.0' }
    });
    const html = typeof resp.data === 'string' ? resp.data : '';
    const pickMeta = (prop) => {
      const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
      return m ? m[1].trim() : '';
    };
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const preview = {
      url: rawUrl,
      domain: host.replace(/^www\./, ''),
      title: pickMeta('og:title') || pickMeta('twitter:title') || (titleMatch ? titleMatch[1].trim() : host),
      description: pickMeta('og:description') || pickMeta('description') || '',
      image: pickMeta('og:image') || '',
    };

    if (linkPreviewCache.size > 200) linkPreviewCache.clear();
    linkPreviewCache.set(rawUrl, preview);
    return res.json({ success: true, data: preview });
  } catch (err) {
    return res.json({ success: false, data: null });
  }
};

/**
 * 10. Background Scheduler for Due Scheduled Messages & Disappearing Message Cleanup
 */
let schedulerStarted = false;
const startChatBackgroundWorkers = (io) => {
  if (schedulerStarted) return;
  schedulerStarted = true;

  let webPushService = null;
  try { webPushService = require('../services/webPushService'); } catch (_) { }
  const { ChatMessageReminder } = require('../db/models/chat.model');

  setInterval(async () => {
    try {
      const now = new Date();
      // 1. Dispatch due scheduled messages (atomic claim prevents duplicate sends across PM2 cluster workers)
      const dueCandidates = await ChatMessage.find({
        isScheduled: true,
        isDeleted: { $ne: true },
        scheduledAt: { $lte: now },
      }).select('_id roomId').limit(25).lean();

      for (const candidate of dueCandidates) {
        const room = await ChatRoom.findById(candidate.roomId).select('name members disappearAfterSec').lean();
        const expiresAt = room?.disappearAfterSec > 0
          ? new Date(Date.now() + room.disappearAfterSec * 1000)
          : null;

        const claimed = await ChatMessage.findOneAndUpdate(
          { _id: candidate._id, isScheduled: true, isDeleted: { $ne: true } },
          {
            $set: {
              isScheduled: false,
              scheduledAt: null,
              ...(expiresAt ? { expiresAt } : {}),
            }
          },
          { returnDocument: 'after' }
        );
        if (!claimed) continue; // Already claimed by another PM2 worker

        const updatedRoom = await ChatRoom.findByIdAndUpdate(
          claimed.roomId,
          {
            $inc: { lastSeq: 1 },
            $set: {
              lastMessage: {
                content: claimed.content,
                senderName: claimed.senderName,
                createdAt: new Date(),
                type: claimed.type,
              }
            }
          },
          { returnDocument: 'after' }
        ).lean();
        if (updatedRoom?.lastSeq) {
          claimed.roomSeq = updatedRoom.lastSeq;
          await ChatMessage.updateOne({ _id: claimed._id }, { $set: { roomSeq: updatedRoom.lastSeq } });
        }
        try {
          const cc = require('./communication.controller');
          cc.invalidateGroupsCache();
          cc.invalidateGroupMessagesCache(String(claimed.roomId));
        } catch (_) {}

        if (io) {
          io.to(String(claimed.roomId)).emit('receive-message', claimed.toObject());
        }

        // Send high-urgency Web Push to room members when scheduled message fires
        if (webPushService && typeof webPushService.sendPushToUsers === 'function' && room?.members?.length) {
          const senderStr = String(claimed.senderId || '');
          const recipientIds = room.members
            .map((m) => String(m?._id || m))
            .filter((id) => id && id !== senderStr);
          if (recipientIds.length > 0) {
            webPushService.sendPushToUsers(recipientIds, {
              title: `${claimed.senderName || 'Team Member'} (${room.name || 'Chat'})`,
              body: String(claimed.content || 'New scheduled message').slice(0, 140),
              tag: `chat-${claimed.roomId}`,
              data: {
                url: `/communication?room=${claimed.roomId}`,
                roomId: String(claimed.roomId),
                messageId: String(claimed._id),
              }
            }, { urgency: 'high', TTL: 86400 }).catch(() => { });
          }
        }
      }

      // 2. Dispatch due Message Reminders via Web Push + Socket (works even when app is in background)
      if (ChatMessageReminder) {
        const dueReminders = await ChatMessageReminder.find({
          fired: false,
          remindAt: { $lte: now },
        }).select('_id').limit(25).lean();

        for (const cand of dueReminders) {
          const rem = await ChatMessageReminder.findOneAndUpdate(
            { _id: cand._id, fired: false },
            { $set: { fired: true } },
            { returnDocument: 'after' }
          ).lean();
          if (!rem) continue;

          if (io) {
            io.to(`user_${rem.userId}`).emit('message-reminder-due', rem);
          }
          if (webPushService && typeof webPushService.sendPushToUsers === 'function') {
            webPushService.sendPushToUsers([String(rem.userId)], {
              title: `⏰ Message Reminder — ${rem.roomName || 'Chat'}`,
              body: String(rem.snippet || 'You have a scheduled message reminder.').slice(0, 140),
              tag: `reminder-${rem._id}`,
              data: {
                url: `/communication?room=${rem.roomId}`,
                roomId: String(rem.roomId),
                messageId: String(rem.messageId),
              }
            }, { urgency: 'high', TTL: 86400 }).catch(() => { });
          }
        }
      }

      // 3. Soft-delete expired disappearing messages
      const expired = await ChatMessage.find({
        expiresAt: { $ne: null, $lte: now },
        isDeleted: { $ne: true },
      }).select('_id roomId').limit(50).lean();

      if (expired.length > 0) {
        const ids = expired.map(e => e._id);
        await ChatMessage.updateMany(
          { _id: { $in: ids } },
          { $set: { isDeleted: true, content: 'This disappearing message expired', deletedAt: now } }
        );
        if (io) {
          expired.forEach(e => {
            io.to(String(e.roomId)).emit('message-deleted', { messageId: String(e._id), roomId: String(e.roomId) });
          });
        }
      }
    } catch (e) {
      console.error('[ChatBackgroundWorker] Tick error:', e?.message || e);
    }
  }, 15000);
};

module.exports = {
  toggleMuteRoom,
  toggleArchiveRoom,
  updateDisappearTimer,
  toggleStarMessage,
  getStarredMessages,
  getThreadMessages,
  getMessageInfo,
  bulkMessageAction,
  scheduleMessage,
  getScheduledMessages,
  cancelScheduledMessage,
  getLinkPreview,
  startChatBackgroundWorkers,
};
