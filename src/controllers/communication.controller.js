const mongoose = require('mongoose');
const { ChatRoom, ChatMessage, user: User } = require('../db/models');
const { syncCommunicationGroups } = require('../utils/syncCommunicationGroups');
const { publishActivity } = require('../utils/activityEvent');
const { sanitizeChatMessage, validateAttachment } = require('../utils/sanitizeChat');
const { decodeUnicodeFileName } = require('../utils/unicodeFileHelper');
const webPushService = require('../services/webPush.service');
const { dispatchChatMessage } = require('./chatController');

const getMemberIdString = (m) => {
  if (!m) return '';
  if (typeof m === 'object') {
    if (m._id) return String(m._id);
    return m.toString ? m.toString() : String(m);
  }
  return String(m);
};

/**
 * Get all communication groups accessible to the user
 */
const getGroups = async (req, res) => {
  try {
    const rawUserId = req.user ? req.user._id : (req.headers['x-user-id'] || req.query.userId || req.body?.userId);
    let currentUser = null;

    if (rawUserId && mongoose.Types.ObjectId.isValid(rawUserId)) {
      currentUser = await User.findById(rawUserId);
    }

    const currentUserId = currentUser ? currentUser._id : (rawUserId && mongoose.Types.ObjectId.isValid(rawUserId) ? new mongoose.Types.ObjectId(rawUserId) : null);
    const currentUserIdStr = currentUserId ? String(currentUserId) : (rawUserId ? String(rawUserId) : null);

    const isClient = req.user && (req.user.isClient || req.user.role === 'Client');
    const isSuperOrAdmin = req.user && (
      req.user.role === 'admin' ||
      req.user.role === 'super_admin' ||
      req.user.isAdmin === true ||
      req.user.isMainAdmin === true ||
      req.headers['x-is-admin'] === 'true'
    );
    let query;

    if (isClient) {
      // Multi-tenancy guard: External Clients ONLY see channels where they are an explicit member
      query = {
        isArchived: { $ne: true },
        members: currentUserId,
        isInternalOnly: { $ne: true }
      };
    } else if (isSuperOrAdmin) {
      // Administrators oversee all company group channels, and their own direct rooms
      if (currentUserId || currentUserIdStr) {
        const userMemberFilter = { $in: [currentUserId, currentUserIdStr].filter(Boolean) };
        query = {
          isArchived: { $ne: true },
          $or: [
            { type: { $ne: 'direct' } },
            { members: userMemberFilter }
          ]
        };
      } else {
        query = {
          isArchived: { $ne: true },
          type: { $ne: 'direct' }
        };
      }
    } else if (currentUserId || currentUserIdStr) {
      // Standard staff members ONLY see groups and chats where they are an explicit member
      const userMemberFilter = { $in: [currentUserId, currentUserIdStr].filter(Boolean) };
      query = {
        isArchived: { $ne: true },
        members: userMemberFilter
      };
    } else {
      // If user identity is missing, do NOT expose any communication channels
      query = {
        isArchived: { $ne: true },
        _id: null
      };
    }

    let rooms = await ChatRoom.find(query)
      .populate('members', 'name username email avatarUrl')
      .sort({ updatedAt: -1 })
      .lean();

    if (rooms.length === 0) {
      await syncCommunicationGroups();
      rooms = await ChatRoom.find(query)
        .populate('members', 'name username email avatarUrl')
        .sort({ updatedAt: -1 })
        .lean();
    }

    // Fetch unread count & latest message snippet for each room using fast parallel indexed queries
    const roomIds = rooms.map((r) => r._id);
    const lastMsgMap = {};
    const unreadMap = {};

    if (roomIds.length > 0) {
      const targetUserId = currentUser ? currentUser._id : (rawUserId && mongoose.Types.ObjectId.isValid(rawUserId) ? rawUserId : null);
      const targetUserObjId = targetUserId && mongoose.Types.ObjectId.isValid(targetUserId)
        ? (typeof targetUserId === 'object' ? targetUserId : new mongoose.Types.ObjectId(targetUserId))
        : null;

      // Execute ultra-fast single-doc primary index queries for each room in parallel (< 5ms total)
      await Promise.all(rooms.map(async (r) => {
        try {
          // 1. Fetch latest message using indexed compound sort
          const lastMsg = await ChatMessage.findOne({ roomId: r._id })
            .sort({ _id: -1 })
            .select('_id roomId content type senderId senderName msgType priority createdAt isDeleted attachment readBy')
            .populate({ path: 'senderId', select: 'name username email avatarUrl', options: { strictPopulate: false } })
            .maxTimeMS(1200)
            .lean();

          if (lastMsg) {
            if (lastMsg.isDeleted) {
              lastMsg.content = 'This message was deleted';
              lastMsg.attachment = null;
            }
            lastMsgMap[String(r._id)] = lastMsg;

            // Smart Unread Calculation: If last message was sent by user or already read, unread count is 0!
            const senderIdStr = String(lastMsg.senderId?._id || lastMsg.senderId || '');
            const targetIdStr = String(targetUserObjId || '');
            const hasReadLastMsg = senderIdStr === targetIdStr || (Array.isArray(lastMsg.readBy) && lastMsg.readBy.some(id => String(id) === targetIdStr));

            if (hasReadLastMsg) {
              unreadMap[String(r._id)] = 0;
            } else if (targetUserObjId) {
              const count = await ChatMessage.countDocuments({
                roomId: r._id,
                senderId: { $ne: targetUserObjId },
                readBy: { $ne: targetUserObjId },
                isDeleted: { $ne: true }
              }).maxTimeMS(600);
              unreadMap[String(r._id)] = count || 0;
            }
          } else {
            unreadMap[String(r._id)] = 0;
          }
        } catch (_) {
          if (r.lastMessage) {
            lastMsgMap[String(r._id)] = r.lastMessage;
          }
          unreadMap[String(r._id)] = 0;
        }
      }));
    }

    const roomsWithMeta = rooms.map((room) => {
      return {
        ...room,
        lastMessage: lastMsgMap[String(room._id)] || null,
        unreadCount: unreadMap[String(room._id)] || 0
      };
    });

    // WhatsApp-Style Recency Sort:
    // Sort all rooms by the timestamp of their latest message, or fall back to room.updatedAt / createdAt
    roomsWithMeta.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const timeA = new Date(a.lastMessage?.createdAt || a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.lastMessage?.createdAt || b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    res.json({ success: true, data: roomsWithMeta });
  } catch (error) {
    console.error('Error fetching communication groups:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch communication groups', error: error.message });
  }
};

/**
 * Get messages for a specific group with pagination & type filter
 */
const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing Group ID' });
    }

    const { page = 1, limit = 50, msgType, beforeSeq, before, afterSeq, after } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const skip = (beforeSeq || before || afterSeq || after) ? 0 : (pageNum - 1) * limitNum;

    const room = await ChatRoom.findById(groupId).select('_id type members');
    if (!room) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const rawReqUserId = req.user ? req.user._id : (req.headers['x-user-id'] || req.query.userId || req.body?.userId);
    const reqUserIdStr = rawReqUserId ? String(rawReqUserId) : '';

    if (reqUserIdStr) {
      const isMember = room.members && room.members.some((m) => {
        if (!m) return false;
        const memberIdStr = getMemberIdString(m);
        return memberIdStr === reqUserIdStr || String(m) === reqUserIdStr;
      });

      const userRole = (req.user?.role || req.headers['x-user-role'] || '').toLowerCase();
      const isSuperOrAdmin = Boolean(
        (req.user && (
          req.user.role === 'admin' ||
          req.user.role === 'super_admin' ||
          req.user.isAdmin === true ||
          req.user.isMainAdmin === true
        )) ||
        userRole === 'admin' ||
        userRole === 'super_admin' ||
        req.headers['x-operator-override'] === 'true' ||
        req.headers['x-is-admin'] === 'true'
      );

      if (!isMember) {
        if (room.type === 'direct' && !isSuperOrAdmin) {
          // Do NOT allow non-members to view private 1-on-1 direct rooms
          return res.status(403).json({ success: false, message: 'Access denied to direct message conversation' });
        }
        if (room.isPrivate && !isSuperOrAdmin) {
          return res.status(403).json({ success: false, message: 'Access denied: You are not a member of this private group' });
        }
      }
    }


    const roomObjId = mongoose.Types.ObjectId.isValid(groupId) ? new mongoose.Types.ObjectId(groupId) : groupId;
    const query = { roomId: roomObjId };

    // Cursor-based pagination filtering (older messages: before / beforeSeq; newer messages: after / afterSeq)
    if (before && mongoose.Types.ObjectId.isValid(before)) {
      query._id = { $lt: new mongoose.Types.ObjectId(before) };
    } else if (beforeSeq) {
      query.roomSeq = { $lt: parseInt(beforeSeq, 10) };
    } else if (after && mongoose.Types.ObjectId.isValid(after)) {
      query._id = { $gt: new mongoose.Types.ObjectId(after) };
    } else if (afterSeq) {
      query.roomSeq = { $gt: parseInt(afterSeq, 10) };
    }

    if (msgType === 'human') {
      query.$or = [{ msgType: 'human' }, { msgType: { $exists: false } }, { msgType: null }, { msgType: '' }];
    } else if (msgType === 'system_activity') {
      query.msgType = 'system_activity';
    }

    // Filter by search query if provided (supports ?search=, ?q=, or ?query=)
    const searchTerm = (req.query.search || req.query.q || req.query.query || '').trim();
    if (searchTerm) {
      const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchCondition = [
        { content: { $regex: escaped, $options: 'i' } },
        { 'attachment.fileName': { $regex: escaped, $options: 'i' } }
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchCondition }];
        delete query.$or;
      } else {
        query.$or = searchCondition;
      }
    }

    const [total, messages] = await Promise.all([
      ChatMessage.countDocuments(query),
      ChatMessage.find(query)
        .populate({ path: 'senderId', select: 'name username email role', options: { strictPopulate: false } })
        .populate({ path: 'mentions', select: 'name username email', options: { strictPopulate: false } })
        .populate({ path: 'pinnedBy', select: 'name username email', options: { strictPopulate: false } })
        .populate({ path: 'pollMeta.options.votes', select: 'name username email', options: { strictPopulate: false } })
        .populate({
          path: 'reactions.user',
          select: 'name username email',
          options: { strictPopulate: false }
        })
        .populate({
          path: 'replyTo',
          populate: { path: 'senderId', select: 'name username email', options: { strictPopulate: false } },
          options: { strictPopulate: false }
        })
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
    ]);

    // Return in monotonic chronological order (ascending by timestamp and _id)
    messages.sort((a, b) => {
      const tA = new Date(a.createdAt || 0).getTime();
      const tB = new Date(b.createdAt || 0).getTime();
      if (tA !== tB) return tA - tB;
      return String(a._id).localeCompare(String(b._id));
    });

    res.json({
      success: true,
      data: messages,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('[getGroupMessages ERROR]:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Failed to fetch messages: ' + error.message, error: error.message });
  }
};

/**
 * Vote on a poll option in a chat message
 */
const votePollMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { optionId } = req.body;
    const rawUserId = req.user ? req.user._id : (req.headers['x-user-id'] || req.body.userId || req.query.userId);

    if (!rawUserId || !optionId) {
      return res.status(400).json({ success: false, message: 'User ID and option ID are required' });
    }

    const message = await ChatMessage.findById(messageId);
    if (!message || message.type !== 'poll' || !message.pollMeta) {
      return res.status(404).json({ success: false, message: 'Poll message not found' });
    }

    if (message.pollMeta.isClosed) {
      return res.status(400).json({ success: false, message: 'This poll is closed' });
    }

    const userIdStr = String(rawUserId);
    const isMultiSelect = !!message.pollMeta.isMultiSelect;

    message.pollMeta.options.forEach((opt) => {
      opt.votes = opt.votes || [];
      const userIndex = opt.votes.findIndex((v) => String(v._id || v) === userIdStr);
      if (opt.id === optionId) {
        if (userIndex > -1) {
          opt.votes.splice(userIndex, 1);
        } else {
          opt.votes.push(rawUserId);
        }
      } else if (!isMultiSelect) {
        if (userIndex > -1) {
          opt.votes.splice(userIndex, 1);
        }
      }
    });

    await message.save();

    const updatedMessage = await ChatMessage.findById(messageId)
      .populate('senderId', 'name username email role')
      .populate('pollMeta.options.votes', 'name username email');

    const io = req.app.get('io') || req.app.get('socketio') || global.io;
    if (io) {
      io.to(String(message.roomId)).emit('poll-updated', { messageId: message._id, pollMeta: updatedMessage.pollMeta });
    }

    res.json({ success: true, data: updatedMessage });
  } catch (error) {
    console.error('Error voting on poll:', error);
    res.status(500).json({ success: false, message: 'Failed to vote on poll', error: error.message });
  }
};

/**
 * Forward an existing message to another chat room (or multiple rooms)
 */
const forwardMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { targetRoomId, roomIds } = req.body;
    const rawSenderId = req.user ? req.user._id : (req.headers['x-user-id'] || req.body.senderId || req.body.userId);

    const targetRoomList = Array.isArray(roomIds) && roomIds.length > 0
      ? roomIds
      : (targetRoomId ? [targetRoomId] : []);

    if (targetRoomList.length === 0 || !rawSenderId) {
      return res.status(400).json({ success: false, message: 'Target room ID (or roomIds) and sender ID are required' });
    }

    const origMessage = await ChatMessage.findById(messageId)
      .select('content type attachment pollMeta activityMeta recordMentions senderId roomId')
      .populate('senderId', 'name username')
      .lean();

    if (!origMessage) {
      return res.status(404).json({ success: false, message: 'Original message not found' });
    }

    let origRoomName = 'Channel';
    if (origMessage.roomId) {
      const origRoom = await ChatRoom.findById(origMessage.roomId).select('name').lean();
      if (origRoom) origRoomName = origRoom.name;
    }

    const senderName = origMessage.senderId
      ? (origMessage.senderId.name || origMessage.senderId.username)
      : 'Staff';

    const forwardedMessages = [];
    const io = req.app.get('io') || req.app.get('socketio') || global.io;

    await Promise.all(targetRoomList.map(async (tRoomId) => {
      if (!tRoomId || !mongoose.Types.ObjectId.isValid(tRoomId)) return;

      const updatedTargetRoom = await ChatRoom.findByIdAndUpdate(
        tRoomId,
        { $inc: { lastSeq: 1 }, updatedAt: new Date() },
        { new: true, select: 'name members lastSeq' }
      ).lean();

      const roomSeq = updatedTargetRoom?.lastSeq || 1;

      const newForwardedMsg = await ChatMessage.create({
        roomId: tRoomId,
        roomSeq,
        senderId: rawSenderId,
        content: origMessage.content,
        type: origMessage.type || 'text',
        msgType: 'human',
        attachment: origMessage.attachment || undefined,
        pollMeta: origMessage.pollMeta || undefined,
        activityMeta: origMessage.activityMeta || undefined,
        recordMentions: origMessage.recordMentions || undefined,
        forwardedFrom: {
          senderName,
          originalRoomName: origRoomName
        },
        readBy: [rawSenderId],
        createdAt: new Date()
      });

      // Atomic update for lastMessage to avoid full room save
      await ChatRoom.findByIdAndUpdate(tRoomId, {
        $set: { lastMessage: newForwardedMsg._id, updatedAt: new Date() }
      });

      const populatedMsg = await ChatMessage.findById(newForwardedMsg._id)
        .populate('senderId', 'name username email role')
        .populate('readBy', 'name username email')
        .lean();

      forwardedMessages.push(populatedMsg);

      if (io && updatedTargetRoom) {
        let broadcast = io.to(String(tRoomId));
        if (Array.isArray(updatedTargetRoom.members)) {
          updatedTargetRoom.members.forEach((m) => {
            const mIdStr = getMemberIdString(m);
            if (mIdStr) broadcast = broadcast.to(`user_${mIdStr}`);
          });
        }
        broadcast.emit('receive-message', populatedMsg);
      }
    }));

    const responseData = targetRoomList.length === 1 ? forwardedMessages[0] : forwardedMessages;
    return res.json({ success: true, data: responseData });
  } catch (error) {
    console.error('Error forwarding message:', error);
    res.status(500).json({ success: false, message: 'Failed to forward message', error: error.message });
  }
};

/**
 * Send a message to a communication group via HTTP POST endpoint
 */
const postGroupMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    let rawSenderId = req.user ? req.user._id : (req.headers['x-user-id'] || req.body.senderId || req.body.userId || req.query.userId);
    let resolvedSenderName = req.user?.name || req.body.senderName || null;

    if (!rawSenderId) {
      const fallbackUser = await User.findOne({ role: 'admin' }) || await User.findOne();
      if (fallbackUser) {
        rawSenderId = fallbackUser._id;
        if (!resolvedSenderName) resolvedSenderName = fallbackUser.name;
      } else {
        return res.status(400).json({ success: false, message: 'Sender ID is required' });
      }
    }

    const { content, replyTo, attachment, priority, type, activityMeta, pollMeta, recordMentions: inRecordMentions, mentionedUserIds: inMentionedUserIds, clientMsgId: inClientMsgId } = req.body;
    const clientMsgId = req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || inClientMsgId || null;

    const rawContent = typeof content === 'string' ? content : (content != null ? String(content) : '');
    const trimmedContent = rawContent.trim();

    if (!trimmedContent && !attachment && type !== 'poll') {
      return res.status(400).json({ success: false, message: 'Message content cannot be empty' });
    }

    if (rawContent.length > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Message content exceeds maximum allowable limit of 10,000 characters'
      });
    }

    // Validate replyTo: must exist within this room or return 400
    let cleanReplyTo = null;
    if (replyTo) {
      if (!mongoose.Types.ObjectId.isValid(replyTo)) {
        return res.status(400).json({ success: false, message: 'Invalid replyTo message ID' });
      }
      const referencedMsg = await ChatMessage.findOne({ _id: replyTo, roomId: groupId }).lean();
      if (!referencedMsg) {
        return res.status(400).json({ success: false, message: 'Referenced replyTo message not found in this room' });
      }
      cleanReplyTo = referencedMsg._id;
    }

    // Idempotency: Return existing message on retry or duplicate POST instead of creating duplicate DB document
    if (clientMsgId) {
      const existingMsg = await ChatMessage.findOne({ roomId: groupId, clientMsgId })
        .populate('senderId', 'name username email role')
        .populate('readBy', 'name username email')
        .populate('pollMeta.options.votes', 'name username email')
        .populate({ path: 'reactions.user', select: 'name username email' })
        .populate({ path: 'replyTo', populate: { path: 'senderId', select: 'name username email' } })
        .lean();
      if (existingMsg) {
        return res.status(200).json({ success: true, data: existingMsg, duplicate: true });
      }
    }

    // Attachment security validation & multi-language Unicode decoding
    if (attachment && typeof attachment === 'object') {
      if (attachment.fileName) attachment.fileName = decodeUnicodeFileName(attachment.fileName);
      if (attachment.originalName) attachment.originalName = decodeUnicodeFileName(attachment.originalName);
      if (attachment.name) attachment.name = decodeUnicodeFileName(attachment.name);
      const attachCheck = validateAttachment(attachment);
      if (!attachCheck.valid) {
        return res.status(400).json({ success: false, message: attachCheck.error });
      }
    }

    const targetRoom = await ChatRoom.findById(groupId);
    if (!targetRoom) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const senderObjId = mongoose.Types.ObjectId.isValid(rawSenderId) ? new mongoose.Types.ObjectId(rawSenderId) : rawSenderId;
    const strSender = String(senderObjId);

    const isMember = targetRoom.members && targetRoom.members.some((m) => {
      if (!m) return false;
      const memberIdStr = getMemberIdString(m);
      return memberIdStr === strSender;
    });

    const isSuperOrAdmin = req.user && (
      req.user.role === 'admin' ||
      req.user.role === 'super_admin' ||
      req.user.isAdmin === true ||
      req.user.isMainAdmin === true
    );

    if (!isMember) {
      if (targetRoom.type === 'direct') {
        return res.status(403).json({ success: false, message: 'You are not a member of this direct conversation' });
      }
      if (targetRoom.isPrivate && !isSuperOrAdmin) {
        return res.status(403).json({ success: false, message: 'Access denied: You are not a member of this private group' });
      }
      targetRoom.members = targetRoom.members || [];
      targetRoom.members.push(senderObjId);
      await targetRoom.save();
    }

    // Sanitize content against Stored XSS and malicious script injection (trimmed)
    const sanitizedContent = sanitizeChatMessage(trimmedContent || '').trim();

    // Parse user mentions (supports explicit mentionedUserIds, @first_name, @full_name, @username, and @all / @everyone)
    let mentions = Array.isArray(inMentionedUserIds) ? [...inMentionedUserIds] : [];
    const isMentionAll = /\b@(all|everyone)\b/i.test(sanitizedContent) || mentions.includes('ALL_MEMBERS');
    if (isMentionAll && targetRoom && Array.isArray(targetRoom.members)) {
      targetRoom.members.forEach((m) => {
        const mIdStr = String(typeof m === 'object' ? (m._id || m.id) : m);
        if (mIdStr && !mentions.includes(mIdStr)) {
          mentions.push(mIdStr);
        }
      });
      mentions = mentions.filter((id) => id !== 'ALL_MEMBERS');
    }

    if (sanitizedContent) {
      try {
        const usersInDb = await User.find({}).select('_id name username').lean();
        const mentionTokens = (sanitizedContent.match(/@([a-zA-Z0-9_.-]+)/g) || []).map(t => t.slice(1).toLowerCase());

        usersInDb.forEach((u) => {
          const uIdStr = String(u._id);
          const fullName = (u.name || '').toLowerCase().trim();
          const firstName = fullName.split(/\s+/)[0] || '';
          const username = (u.username || '').toLowerCase().trim();

          const isMatch = mentionTokens.some(token => (
            (firstName && token === firstName) ||
            (username && token === username) ||
            (fullName && token === fullName)
          )) ||
          (fullName && sanitizedContent.toLowerCase().includes(`@${fullName}`)) ||
          (firstName && new RegExp(`@${firstName}\\b`, 'i').test(sanitizedContent)) ||
          (username && new RegExp(`@${username}\\b`, 'i').test(sanitizedContent));

          if (isMatch && !mentions.includes(uIdStr)) {
            mentions.push(uIdStr);
          }
        });
      } catch (err) {
        console.warn('[postGroupMessage mention resolution error]:', err.message);
      }
      mentions = Array.from(new Set(mentions)).filter((id) => id !== 'ALL_MEMBERS');
    }

    const mentionObjectIds = mentions
      .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    // Parse record mentions
    const recordMentions = inRecordMentions || [];
    if (!inRecordMentions && sanitizedContent) {
      const recordRegex = /@(JC|DES|INV)-([a-zA-Z0-9_-]+)/gi;
      const recordMatches = [...sanitizedContent.matchAll(recordRegex)];
      recordMatches.forEach((m) => {
        const prefix = m[1].toUpperCase();
        const refVal = m[0].replace(/^@/, '');
        const rType = prefix === 'JC' ? 'jobcard' : prefix === 'DES' ? 'design' : 'invoice';
        recordMentions.push({ recordType: rType, recordRef: refVal });
      });
    }

    const msgType = type || (attachment && attachment.fileType === 'audio' ? 'audio-voice' : 'text');

    // Monotonic room sequence increment
    const updatedRoom = await ChatRoom.findByIdAndUpdate(
      groupId,
      { $inc: { lastSeq: 1 }, updatedAt: new Date() },
      { new: true }
    );
    const roomSeq = updatedRoom?.lastSeq || 1;

    const messageContent = (sanitizedContent || '').trim() || (pollMeta ? pollMeta.question : (attachment?.fileName ? attachment.fileName : 'Message'));

    const newMessage = await ChatMessage.create({
      roomId: groupId,
      senderId: senderObjId,
      senderName: resolvedSenderName,
      clientMsgId: clientMsgId || undefined,
      content: messageContent,
      replyTo: cleanReplyTo,
      type: msgType,
      msgType: 'human',
      priority: priority === 'urgent' ? 'urgent' : 'normal',
      attachment: attachment || undefined,
      pollMeta: pollMeta || undefined,
      activityMeta: activityMeta || undefined,
      recordMentions: recordMentions.length > 0 ? recordMentions : undefined,
      mentions: mentionObjectIds,
      readBy: [senderObjId],
      createdAt: new Date(),
      roomSeq
    });

    const populatedMessage = await ChatMessage.findById(newMessage._id)
      .populate('senderId', 'name username email role')
      .populate('readBy', 'name username email')
      .populate({
        path: 'reactions.user',
        select: 'name username email'
      })
      .populate({
        path: 'replyTo',
        populate: { path: 'senderId', select: 'name username email' }
      })
      .populate('mentions', 'name username email');

    const io = req.app.get('io') || req.app.get('socketio') || global.io;

    // Intelligent Dispatch: Real-time WebSocket + selective background Web Push
    try {
      await dispatchChatMessage({
        io,
        roomId: groupId,
        populatedMessage,
        targetRoom,
        senderId: strSender,
        rawContent: content,
        priority: priority === 'urgent' ? 'urgent' : 'normal',
      });
    } catch (dispatchErr) {
      console.warn('[postGroupMessage dispatch warning]:', dispatchErr.message);
    }

    // Targeted notification for mentioned users
    if (mentions.length > 0 && io) {
      const recipientMentionIds = mentions
        .map(String)
        .filter(uId => uId !== strSender);

      recipientMentionIds.forEach(uId => {
        io.to(`user_${uId}`).emit('notification:mention', {
          messageId: newMessage._id,
          roomId: groupId,
          roomName: targetRoom?.name || 'Group Chat',
          sender: populatedMessage.senderId,
          content: sanitizedContent,
          timestamp: newMessage.createdAt
        });
      });

      if (recipientMentionIds.length > 0 && webPushService && typeof webPushService.sendPushToUsers === 'function') {
        const senderName = populatedMessage.senderId?.name || populatedMessage.senderId?.username || 'Team Member';
        webPushService.sendPushToUsers(recipientMentionIds, {
          title: `💬 @mentioned by ${senderName} in ${targetRoom?.name || 'Chat'}`,
          body: sanitizedContent ? (sanitizedContent.length > 80 ? sanitizedContent.slice(0, 80) + '...' : sanitizedContent) : 'You were mentioned in a message',
          icon: '/Logo.png',
          badge: '/Logo.png',
          tag: `mention-${newMessage._id}`,
          data: {
            url: '/communication',
            roomId: String(groupId),
            type: 'mention'
          }
        }, { urgency: 'high' }).catch(err => console.warn('[postGroupMessage mention push] warning:', err.message));
      }
    }

    // ERP-Core Orchestrator Autonomous Trigger
    try {
      const orchestratorController = require('./orchestrator.controller');
      orchestratorController.processChatMessage({
        room: targetRoom,
        message: newMessage,
        user: req.user,
        io
      }).catch((err) => console.warn('[postGroupMessage Orchestrator trigger error]:', err.message));
    } catch (orchErr) {
      console.warn('[postGroupMessage Orchestrator trigger error]:', orchErr.message);
    }

    res.json({ success: true, data: populatedMessage });
  } catch (error) {
    if (error.code === 11000 && clientMsgId) {
      try {
        const existing = await ChatMessage.findOne({ roomId: groupId, clientMsgId })
          .populate('senderId', 'name username email role')
          .populate('readBy', 'name username email')
          .populate({ path: 'reactions.user', select: 'name username email' })
          .populate({ path: 'replyTo', populate: { path: 'senderId', select: 'name username email' } })
          .populate('mentions', 'name username email');
        if (existing) {
          return res.json({ success: true, data: existing, idempotent: true });
        }
      } catch (findErr) {
        console.warn('[postGroupMessage Idempotency fallback find error]:', findErr.message);
      }
    }
    console.error('[postGroupMessage ERROR]:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Failed to send message: ' + error.message, error: error.message });
  }
};

/**
 * Get members of a communication group
 */
const getGroupMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const room = await ChatRoom.findById(groupId).populate('members', 'name email role permissions created_date_time');

    if (!room) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    res.json({ success: true, data: room.members || [] });
  } catch (error) {
    console.error('Error fetching group members:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch group members', error: error.message });
  }
};

/**
 * Trigger sync of communication groups based on user permissions
 */
const syncGroups = async (req, res) => {
  try {
    const result = await syncCommunicationGroups();
    res.json(result);
  } catch (error) {
    console.error('Error in group sync endpoint:', error);
    res.status(500).json({ success: false, message: 'Failed to sync communication groups', error: error.message });
  }
};

/**
 * Manually post a system activity event (for external integrations/webhooks)
 */
const postActivityEvent = async (req, res) => {
  try {
    const { action, module, recordRef, recordId, permissionScope, department, description } = req.body;
    const actorId = req.user ? req.user._id : req.body.actorId;
    const actorName = req.user ? req.user.name : req.body.actorName;

    const published = await publishActivity({
      actorId,
      actorName,
      action,
      module,
      recordRef,
      recordId,
      permissionScope,
      department,
      description
    });

    if (!published) {
      return res.status(400).json({ success: false, message: 'Failed to publish activity message' });
    }

    res.json({ success: true, data: published });
  } catch (error) {
    console.error('Error posting activity event:', error);
    res.status(500).json({ success: false, message: 'Failed to post activity event', error: error.message });
  }
};

/**
 * Acknowledge or update status on an activity/chat message
 */
const acknowledgeMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { action = 'acknowledged' } = req.body;
    const userId = req.user ? req.user._id : req.body.userId;
    const userName = req.user ? (req.user.name || req.user.username) : (req.body.userName || 'User');

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const message = await ChatMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Initialize acknowledgments array if missing
    if (!message.acknowledgments) message.acknowledgments = [];

    // Check if user already acknowledged this message
    const existingIndex = message.acknowledgments.findIndex(
      (a) => String(a.user) === String(userId)
    );

    if (existingIndex >= 0) {
      message.acknowledgments[existingIndex].action = action;
      message.acknowledgments[existingIndex].timestamp = new Date();
    } else {
      message.acknowledgments.push({
        user: userId,
        userName,
        action,
        timestamp: new Date()
      });
    }

    await message.save();

    // Broadcast via global socket if io is attached
    const io = req.app.get('io') || req.app.get('socketio') || global.io;
    if (io) {
      io.to(String(message.roomId)).emit('message-acknowledged', {
        messageId: message._id,
        roomId: message.roomId,
        acknowledgments: message.acknowledgments
      });
    }

    res.json({ success: true, data: message });
  } catch (error) {
    console.error('Error acknowledging message:', error);
    res.status(500).json({ success: false, message: 'Failed to acknowledge message', error: error.message });
  }
};

let dmUsersCache = null;
let dmUsersCacheTime = 0;

/**
 * Get active users list for starting private 1-on-1 direct messages
 */
const getUsersForDM = async (req, res) => {
  try {
    const rawUserId = req.user ? req.user._id : req.query.userId;
    const now = Date.now();
    let allUsers = dmUsersCache;

    if (!allUsers || now - dmUsersCacheTime > 60000) {
      allUsers = await User.find({})
        .select('_id name username email role department avatarUrl')
        .maxTimeMS(2000)
        .lean();
      if (Array.isArray(allUsers)) {
        allUsers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        dmUsersCache = allUsers;
        dmUsersCacheTime = now;
      } else {
        allUsers = [];
      }
    }

    const filtered = rawUserId
      ? allUsers.filter(u => String(u._id) !== String(rawUserId))
      : allUsers;

    res.json({ success: true, data: filtered });
  } catch (error) {
    console.error('Error fetching users for DM:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users', error: error.message });
  }
};

/**
 * Create or get an existing 1-on-1 direct message room between two users
 */
const createOrGetDirectRoom = async (req, res) => {
  try {
    const rawCurrentUserId = (req.user && req.user._id) ? req.user._id : (req.body.userId || req.query.userId);
    const { targetUserId } = req.body;

    if (!rawCurrentUserId || !targetUserId) {
      return res.status(400).json({ success: false, message: 'Current user ID and Target user ID are required' });
    }

    const currentUserId = mongoose.Types.ObjectId.isValid(rawCurrentUserId) ? new mongoose.Types.ObjectId(rawCurrentUserId) : rawCurrentUserId;
    const targetObjId = mongoose.Types.ObjectId.isValid(targetUserId) ? new mongoose.Types.ObjectId(targetUserId) : targetUserId;

    const strCurrent = String(currentUserId);
    const strTarget = String(targetObjId);

    let query;
    if (strCurrent === strTarget) {
      query = {
        type: 'direct',
        members: { $in: [currentUserId, strCurrent] }
      };
    } else {
      query = {
        type: 'direct',
        $and: [
          { members: { $in: [currentUserId, strCurrent] } },
          { members: { $in: [targetObjId, strTarget] } }
        ]
      };
    }

    // Check if direct room already exists between these 2 users
    let room = await ChatRoom.findOne(query).populate('members', 'name username email role permissions department');

    if (!room) {
      const u1 = await User.findById(currentUserId);
      const u2 = await User.findById(targetObjId);

      const name1 = u1 ? (u1.name || u1.username) : 'User';
      const name2 = u2 ? (u2.name || u2.username) : 'User';

      const membersArr = strCurrent === strTarget
        ? [currentUserId]
        : [currentUserId, targetObjId];

      room = await ChatRoom.create({
        name: strCurrent === strTarget ? `${name1} (Self)` : `${name1} & ${name2}`,
        type: 'direct',
        members: membersArr,
        department: u2 ? (u2.department || 'General') : 'General',
        permissionScope: 'direct_msg'
      });

      room = await ChatRoom.findById(room._id).populate('members', 'name username email role permissions department');
    }

    res.json({ success: true, data: room });
  } catch (error) {
    console.error('Error creating/getting direct room:', error);
    res.status(500).json({ success: false, message: 'Failed to create direct room', error: error.message });
  }
};

/**
 * Search message content across accessible rooms or fetch latest
 */
const searchMessages = async (req, res) => {
  try {
    const rawSearch = (req.query.search || req.query.q || req.query.query || '').trim();
    const { limit = 20, page = 1, before, roomId, groupId } = req.query;

    const rawUserId = req.user ? req.user._id : (req.headers['x-user-id'] || req.query.userId);
    const userObjId = rawUserId && mongoose.Types.ObjectId.isValid(rawUserId) ? new mongoose.Types.ObjectId(rawUserId) : null;
    const userStrId = rawUserId ? String(rawUserId) : null;
    const userMembers = [userObjId, userStrId].filter(Boolean);

    const isClient = req.user && (
      req.user.role === 'client' ||
      req.user.userType === 'client' ||
      req.headers['x-user-type'] === 'client'
    );

    const isSuperOrAdmin = req.user && (
      req.user.role === 'admin' ||
      req.user.role === 'super_admin' ||
      req.user.isAdmin === true ||
      req.user.isMainAdmin === true ||
      req.headers['x-is-admin'] === 'true'
    );

    let roomQuery = { isArchived: { $ne: true } };

    if (isClient) {
      if (userMembers.length === 0) {
        return res.status(200).json({ success: true, results: [], data: [], page: 1, limit: 20, total: 0, hasMore: false });
      }
      roomQuery.members = { $in: userMembers };
      roomQuery.isInternalOnly = { $ne: true };
    } else if (isSuperOrAdmin) {
      if (userMembers.length > 0) {
        roomQuery.$or = [
          { type: { $ne: 'direct' } },
          { members: { $in: userMembers } }
        ];
      } else {
        roomQuery.type = { $ne: 'direct' };
      }
    } else if (userMembers.length > 0) {
      roomQuery.members = { $in: userMembers };
    } else {
      return res.status(200).json({ success: true, results: [], data: [], page: 1, limit: 20, total: 0, hasMore: false });
    }

    const targetRoomId = roomId || groupId;
    if (targetRoomId && mongoose.Types.ObjectId.isValid(targetRoomId)) {
      roomQuery._id = new mongoose.Types.ObjectId(targetRoomId);
    }

    const accessibleRooms = await ChatRoom.find(roomQuery).select('_id name title type').lean();
    const accessibleRoomIds = accessibleRooms.map(r => r._id);

    if (accessibleRoomIds.length === 0) {
      return res.status(200).json({ success: true, results: [], data: [], page: 1, limit: 20, total: 0, hasMore: false });
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = (pageNum - 1) * limitNum;

    const query = {
      roomId: { $in: accessibleRoomIds },
      isDeleted: { $ne: true }
    };

    if (rawSearch) {
      const escapedQuery = rawSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { content: { $regex: escapedQuery, $options: 'i' } },
        { 'attachment.fileName': { $regex: escapedQuery, $options: 'i' } },
        { 'attachment.originalName': { $regex: escapedQuery, $options: 'i' } },
        { 'attachment.name': { $regex: escapedQuery, $options: 'i' } }
      ];
    }

    if (before) {
      const beforeDate = new Date(before);
      if (!isNaN(beforeDate.getTime())) {
        query.createdAt = { $lt: beforeDate };
      }
    }

    const total = await ChatMessage.countDocuments(query);
    const results = await ChatMessage.find(query)
      .populate('senderId', 'name username email avatarUrl role')
      .populate('roomId', 'name title type')
      .populate('mentions', 'name username email')
      .populate('pinnedBy', 'name username email')
      .populate({
        path: 'reactions.user',
        select: 'name username email'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const hasMore = skip + (results ? results.length : 0) < total;

    return res.status(200).json({
      success: true,
      results: results || [],
      data: results || [],
      page: pageNum,
      limit: limitNum,
      total,
      hasMore
    });
  } catch (error) {
    console.error('Error searching messages:', error);
    return res.status(200).json({ success: true, results: [], data: [], total: 0, hasMore: false, error: error.message });
  }
};

/**
 * Toggle reaction (emoji) on a chat message
 */
const toggleReaction = async (req, res) => {
  try {
    const messageId = req.params.messageId || req.body.messageId;
    const emoji = (req.body.emoji || req.body.reaction || '').trim();
    const rawUserId = req.user ? req.user._id : (req.headers['x-user-id'] || req.body.userId || req.body.senderId);

    if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing message ID' });
    }
    if (!emoji) {
      return res.status(400).json({ success: false, message: 'Emoji is required' });
    }
    if (!rawUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const userIdStr = String(rawUserId);
    const userObjId = mongoose.Types.ObjectId.isValid(rawUserId) ? new mongoose.Types.ObjectId(rawUserId) : rawUserId;

    const message = await ChatMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    message.reactions = message.reactions || [];
    const existingIndex = message.reactions.findIndex(
      (r) => r.emoji === emoji && String(r.user?._id || r.user) === userIdStr
    );

    let action = 'added';
    if (existingIndex > -1) {
      message.reactions.splice(existingIndex, 1);
      action = 'removed';
    } else {
      message.reactions.push({ emoji, user: userObjId });
    }

    await message.save();

    const populatedMsg = await ChatMessage.findById(message._id)
      .populate('reactions.user', 'name username email')
      .populate('senderId', 'name username email role')
      .lean();

    const io = req.app.get('io') || req.app.get('socketio') || global.io;
    if (io && message.roomId) {
      io.to(String(message.roomId)).emit('message-reaction-updated', {
        messageId: String(message._id),
        roomId: String(message.roomId),
        reactions: populatedMsg.reactions,
        action,
        emoji,
        userId: userIdStr
      });
      io.to(String(message.roomId)).emit('receive-reaction', {
        messageId: String(message._id),
        reactions: populatedMsg.reactions
      });
    }

    return res.json({
      success: true,
      action,
      data: populatedMsg.reactions,
      reactions: populatedMsg.reactions,
      message: populatedMsg
    });
  } catch (error) {
    console.error('Error in toggleReaction:', error);
    res.status(500).json({ success: false, message: 'Failed to update reaction', error: error.message });
  }
};

/**
 * Toggle pin state on a chat message
 */
const togglePinMessage = async (req, res) => {
  try {
    const messageId = req.params.messageId || req.body.messageId;
    const rawUserId = req.user ? req.user._id : (req.headers['x-user-id'] || req.body.userId || req.body.senderId);

    if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing message ID' });
    }

    const message = await ChatMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const newPinnedState = !message.isPinned;
    message.isPinned = newPinnedState;
    message.pinnedBy = newPinnedState ? (mongoose.Types.ObjectId.isValid(rawUserId) ? new mongoose.Types.ObjectId(rawUserId) : rawUserId) : null;
    message.pinnedAt = newPinnedState ? new Date() : null;

    await message.save();

    const populatedMsg = await ChatMessage.findById(message._id)
      .populate('senderId', 'name username email role')
      .populate('pinnedBy', 'name username email')
      .lean();

    const io = req.app.get('io') || req.app.get('socketio') || global.io;
    if (io && message.roomId) {
      io.to(String(message.roomId)).emit('message-pinned-updated', {
        messageId: String(message._id),
        roomId: String(message.roomId),
        isPinned: newPinnedState,
        pinnedBy: message.pinnedBy,
        pinnedAt: message.pinnedAt
      });
    }

    return res.json({
      success: true,
      isPinned: newPinnedState,
      data: populatedMsg,
      message: populatedMsg
    });
  } catch (error) {
    console.error('Error in togglePinMessage:', error);
    res.status(500).json({ success: false, message: 'Failed to update pinned state', error: error.message });
  }
};


/**
 * Admin option to create custom communication activity group
 */
const createGroup = async (req, res) => {
  try {
    const {
      name,
      description = '',
      department = 'General',
      companyEntity = '',
      permissionScope = 'general',
      subscribedModules = [],
      subscribedActions = [],
      memberIds: requestedMemberIds = [],
      members: requestedMembers = []
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }

    const creatorId = req.user ? req.user._id : (req.body.userId || req.query.userId);
    if (!creatorId) {
      return res.status(401).json({ success: false, message: 'Authentication required to create a group' });
    }

    // External clients are restricted from creating internal communication channels
    if (req.user && (req.user.isClient || req.user.role === 'Client')) {
      return res.status(403).json({ success: false, message: 'Clients are not permitted to create internal operational groups' });
    }

    const sanitizedName = sanitizeChatMessage(name, 100);
    const sanitizedDesc = sanitizeChatMessage(description || '', 500);

    // If caller explicitly selected members, respect that exact member list!
    const explicitIds = (Array.isArray(requestedMemberIds) && requestedMemberIds.length > 0)
      ? requestedMemberIds
      : ((Array.isArray(requestedMembers) && requestedMembers.length > 0) ? requestedMembers : []);

    let finalMemberIds = [];

    if (explicitIds.length > 0) {
      finalMemberIds = Array.from(new Set(explicitIds.map(id => String(id).trim()))).filter(Boolean);
      if (creatorId && !finalMemberIds.includes(String(creatorId))) {
        finalMemberIds.push(String(creatorId));
      }
    } else {
      // Fallback: only if no explicit members were selected, match users by scope/company
      const allUsers = await User.find({}).lean();
      const scope = (permissionScope || '').toLowerCase();
      const targetComp = (companyEntity || '').trim().toLowerCase();

      const matchingUsers = allUsers.filter(u => {
        if (u.role === 'admin') return true;

        if (targetComp) {
          const userCompanies = Array.isArray(u.allowedCompanies)
            ? u.allowedCompanies.map(c => String(c).trim().toLowerCase())
            : [];
          if (userCompanies.length > 0 && !userCompanies.includes(targetComp) && !userCompanies.includes('all')) {
            return false;
          }
        }

        if (!u.permissions || !Array.isArray(u.permissions)) return false;
        if (!scope || scope === 'general' || scope === 'direct_msg') return true;

        return u.permissions.some(p => {
          const perm = (p || '').toLowerCase();
          return perm === scope || perm.startsWith(scope) || scope.startsWith(perm);
        });
      });

      finalMemberIds = matchingUsers.map(u => String(u._id));
      if (creatorId && !finalMemberIds.includes(String(creatorId))) {
        finalMemberIds.push(String(creatorId));
      }
    }

    const room = await ChatRoom.create({
      name: sanitizedName,
      description: sanitizedDesc,
      type: 'group',
      department: department.trim(),
      companyEntity: companyEntity.trim(),
      permissionScope: permissionScope.trim(),
      isSystemGroup: false,
      isPrivate: Boolean(req.body.isPrivate),
      createdBy: creatorId,
      subscribedModules: subscribedModules || [],
      subscribedActions: subscribedActions || [],
      members: finalMemberIds
    });

    const populatedRoom = await ChatRoom.findById(room._id).populate('members', 'name email role permissions department allowedCompanies');

    res.json({ success: true, data: populatedRoom });
  } catch (error) {
    console.error('Error creating custom group:', error);
    res.status(500).json({ success: false, message: 'Failed to create custom group', error: error.message });
  }
};

/**
 * Update members of an existing group
 */
const updateGroupMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberIds = [] } = req.body;

    const room = await ChatRoom.findById(groupId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const isSuperOrAdmin = req.user && (
      req.user.role === 'admin' ||
      req.user.role === 'super_admin' ||
      req.user.isAdmin === true ||
      req.user.isMainAdmin === true
    );
    const isCreator = req.user && room.createdBy && String(room.createdBy) === String(req.user._id);

    if (!isSuperOrAdmin && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Only group creators or administrators can modify group members'
      });
    }

    room.members = memberIds.map((id) => new mongoose.Types.ObjectId(id));
    await room.save();

    const populatedRoom = await ChatRoom.findById(groupId).populate('members', 'name email role permissions department');
    res.json({ success: true, data: populatedRoom.members });
  } catch (error) {
    console.error('Error updating group members:', error);
    res.status(500).json({ success: false, message: 'Failed to update group members', error: error.message });
  }
};

/**
 * Delete / Archive a communication group permanently & clean up messages
 */
const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;

    const room = await ChatRoom.findById(groupId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const isSuperOrAdmin = req.user && (
      req.user.role === 'admin' ||
      req.user.role === 'super_admin' ||
      req.user.isAdmin === true ||
      req.user.isMainAdmin === true
    );
    const isCreator = req.user && room.createdBy && String(room.createdBy) === String(req.user._id);

    if (!isSuperOrAdmin && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Only group creators or administrators can delete this group'
      });
    }

    if (room.isSystemGroup) {
      return res.status(403).json({
        success: false,
        message: 'System department groups cannot be deleted'
      });
    }

    // Mark as archived so syncCommunicationGroups will NEVER resurrect it!
    room.isArchived = true;
    await room.save();

    // Clean up message history
    await ChatMessage.deleteMany({ roomId: groupId });

    res.json({ success: true, message: 'Group and message history deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ success: false, message: 'Failed to delete group', error: error.message });
  }
};

/**
 * Update basic details of an existing group (Name, Description, Department, AvatarUrl)
 */
const updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing Group ID' });
    }

    const room = await ChatRoom.findById(groupId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const isSuperOrAdmin = req.user && (
      req.user.role === 'admin' ||
      req.user.role === 'super_admin' ||
      req.user.isAdmin === true ||
      req.user.isMainAdmin === true
    );
    const isCreator = req.user && room.createdBy && String(room.createdBy) === String(req.user._id);
    const isMember = room.members && room.members.some((m) => getMemberIdString(m) === String(req.user?._id));

    if (!isSuperOrAdmin && !isCreator && !isMember) {
      return res.status(403).json({ success: false, message: 'Access denied: Only group members or admins can edit group details' });
    }

    const { name, description, department, avatarUrl } = req.body;
    if (name !== undefined && typeof name === 'string' && name.trim()) {
      room.name = sanitizeChatMessage(name, 100);
    }
    if (description !== undefined && typeof description === 'string') {
      room.description = sanitizeChatMessage(description, 500);
    }
    if (department !== undefined && typeof department === 'string' && department.trim()) {
      room.department = department.trim();
    }
    if (avatarUrl !== undefined && typeof avatarUrl === 'string') {
      room.avatarUrl = avatarUrl.trim();
    }

    await room.save();

    const populatedRoom = await ChatRoom.findById(room._id)
      .populate('members', 'name email role permissions department allowedCompanies avatarUrl');

    const io = req.app.get('socketio') || global.io;
    if (io) {
      io.to(String(room._id)).emit('group-updated', {
        groupId: String(room._id),
        group: populatedRoom
      });
    }

    return res.json({ success: true, data: populatedRoom });
  } catch (error) {
    console.error('Error updating group details:', error);
    return res.status(500).json({ success: false, message: 'Failed to update group details', error: error.message });
  }
};

/**
 * Admin endpoint to broadcast force hard-reload signal to all connected Socket clients
 */
const forceReloadAllUsers = async (req, res) => {
  try {
    const io = req.app.get('socketio') || global.io;
    if (io) {
      io.emit('force-system-reload', {
        timestamp: Date.now(),
        by: req.user ? (req.user.name || req.user.username) : 'System Admin'
      });
    }
    res.json({ success: true, message: 'Hard reload signal broadcast to all connected clients.' });
  } catch (error) {
    console.error('Error broadcasting force reload:', error);
    res.status(500).json({ success: false, message: 'Failed to broadcast force reload signal', error: error.message });
  }
};

/**
 * Admin endpoint to clear all chat messages and reset communication department groups
 */
const clearAllData = async (req, res) => {
  try {
    await ChatMessage.deleteMany({});
    await ChatRoom.deleteMany({ isSystemGroup: false });
    await syncCommunicationGroups();

    const io = req.app.get('io') || req.app.get('socketio') || global.io;
    if (io) {
      io.emit('communication-data-cleared', { timestamp: Date.now() });
    }

    res.json({ success: true, message: 'All communication data deleted and department groups reset successfully.' });
  } catch (error) {
    console.error('Error clearing communication data:', error);
    res.status(500).json({ success: false, message: 'Failed to clear communication data', error: error.message });
  }
};

/**
 * Admin endpoint to broadcast app version update notification to all connected clients
 */
const broadcastVersionUpdate = async (req, res) => {
  try {
    const io = req.app.get('io') || req.app.get('socketio') || global.io;
    const { version, releaseVersion, releaseName } = req.body || {};
    const payload = {
      version: version || 1791022781512,
      releaseVersion: releaseVersion || 'v2.8.0',
      releaseName: releaseName || 'v2.8.0 — Job Card Print Sheet & Production Suite',
      timestamp: Date.now()
    };
    if (io) {
      io.emit('app-version-updated', payload);
    }
    res.json({ success: true, message: 'Version update signal broadcast to all connected clients.', payload });
  } catch (error) {
    console.error('Error broadcasting version update:', error);
    res.status(500).json({ success: false, message: 'Failed to broadcast version update signal', error: error.message });
  }
};

/**
 * DELETE /v1/communication/messages/:messageId
 * Soft delete a single chat message and purge attached storage assets
 */
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
      if (typeof messageId === 'string' && messageId.startsWith('temp_')) {
        return res.json({ success: true, message: 'Temporary message dismissed' });
      }
      return res.status(400).json({ success: false, message: 'Invalid message ID' });
    }

    const userId = req.user ? (req.user._id || req.user.id) : null;
    const userRole = (req.user?.role || '').toLowerCase();
    const isMasterAdmin =
      userRole === 'admin' ||
      userRole === 'super_admin' ||
      Boolean(req.user?.isMainAdmin) ||
      Boolean(req.user?.isAdmin) ||
      req.headers['x-is-admin'] === 'true';

    const message = await ChatMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const isSender = String(message.senderId) === String(userId);
    const messageAgeHours = (Date.now() - new Date(message.createdAt).getTime()) / (1000 * 60 * 60);

    if (!isMasterAdmin && (!isSender || messageAgeHours > 24)) {
      return res.status(403).json({
        success: false,
        message: isSender
          ? 'You can only delete messages within 24 hours of sending.'
          : 'You do not have permission to delete this message.'
      });
    }

    // Purge attached media asset from Cloudflare R2 if present
    if (message.attachment && message.attachment.fileUrl) {
      try {
        const { deleteR2Object } = require('../utils/r2Storage');
        const url = new URL(message.attachment.fileUrl);
        const key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
        if (key) {
          await deleteR2Object(key);
        }
      } catch (r2Err) {
        console.warn('[Communication] Error purging R2 media for deleted message:', r2Err.message);
      }
    }

    // Soft delete the message in MongoDB & purge edit history/attachments
    message.isDeleted = true;
    message.deletedBy = userId;
    message.deletedAt = new Date();
    message.content = 'This message was deleted';
    message.attachment = null;
    message.isEdited = false;
    message.editedAt = null;
    message.editHistory = [];
    message.reactions = [];
    await message.save();

    // If this was the room's latest message, update room.lastMessage to previous non-deleted message
    const room = await ChatRoom.findById(message.roomId);
    if (room && room.lastMessage && String(room.lastMessage._id || room.lastMessage) === String(message._id)) {
      const prevMsg = await ChatMessage.findOne({ roomId: message.roomId, isDeleted: { $ne: true } })
        .sort({ roomSeq: -1, createdAt: -1 })
        .populate('senderId', 'name username');
      room.lastMessage = prevMsg || null;
      await room.save();
    }

    // Real-time broadcast to room participants
    const io = req.app.get('io') || req.app.get('socketio') || global.io;
    if (io) {
      io.to(String(message.roomId)).emit('message-deleted', {
        messageId: message._id,
        roomId: message.roomId
      });
    }

    res.json({
      success: true,
      message: 'Message deleted successfully',
      data: { messageId: message._id, roomId: message.roomId }
    });
  } catch (error) {
    console.error('[deleteMessage ERROR]:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Failed to delete message: ' + error.message, error: error.message });
  }
};

/**
 * PATCH /v1/communication/messages/:messageId
 * Edit an existing chat message content
 */
const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user ? (req.user._id || req.user.id) : null;
    const userRole = (req.user?.role || '').toLowerCase();
    const isMasterAdmin =
      userRole === 'admin' ||
      userRole === 'super_admin' ||
      Boolean(req.user?.isMainAdmin) ||
      Boolean(req.user?.isAdmin) ||
      req.headers['x-is-admin'] === 'true';

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Message content cannot be empty' });
    }

    const message = await ChatMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (message.isDeleted) {
      return res.status(400).json({ success: false, message: 'Cannot edit a deleted message' });
    }

    const isSender = String(message.senderId) === String(userId);
    const messageAgeHours = (Date.now() - new Date(message.createdAt).getTime()) / (1000 * 60 * 60);

    if (!isMasterAdmin && (!isSender || messageAgeHours > 24)) {
      return res.status(403).json({
        success: false,
        message: isSender
          ? 'You can only edit messages within 24 hours of sending.'
          : 'You do not have permission to edit this message.'
      });
    }

    message.content = content.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    const targetRoomId = message.roomId || message.groupId;

    // Real-time broadcast to room participants
    const io = req.app.get('io') || req.app.get('socketio') || global.io;
    if (io && targetRoomId) {
      io.to(String(targetRoomId)).emit('message-edited', {
        messageId: message._id,
        newContent: message.content,
        roomId: targetRoomId
      });
    }

    res.json({
      success: true,
      message: 'Message edited successfully',
      data: message
    });
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({ success: false, message: 'Failed to edit message', error: error.message });
  }
};

/**
 * Purge orphan chat files from Cloudflare R2 storage
 * (Files under Chat/ older than 1 hour with no live message reference)
 */
const purgeOrphanChatFiles = async (req, res) => {
  try {
    const { listR2Objects, deleteR2Object } = require('../utils/r2Storage');
    const objects = await listR2Objects({ folder: 'Chat' });
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let deletedCount = 0;
    const deletedKeys = [];

    for (const obj of objects) {
      if (obj.lastModified && new Date(obj.lastModified) > oneHourAgo) {
        continue;
      }
      const keyEscaped = obj.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const isReferenced = await ChatMessage.exists({
        isDeleted: { $ne: true },
        $or: [
          { 'attachment.fileUrl': { $regex: keyEscaped, $options: 'i' } },
          { 'attachment.fileName': obj.key.split('/').pop() }
        ]
      });

      if (!isReferenced) {
        await deleteR2Object(obj.key);
        deletedCount++;
        deletedKeys.push(obj.key);
      }
    }

    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} orphan chat files from Cloudflare R2.`,
      deletedCount,
      deletedKeys
    });
  } catch (error) {
    console.error('Error purging orphan chat files:', error);
    res.status(500).json({ success: false, message: 'Failed to purge orphan chat files', error: error.message });
  }
};

/**
 * POST /v1/communication/groups/:groupId/read
 * Mark all messages in a group/room as read for the requesting user
 */
const markGroupAsRead = async (req, res) => {
  try {
    const groupId = req.params.groupId || req.params.id;
    if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing Group ID' });
    }

    const rawUserId = req.user ? req.user._id : (req.headers['x-user-id'] || req.body?.userId || req.query?.userId);
    if (!rawUserId) {
      return res.status(401).json({ success: false, message: 'User ID is required to mark messages as read' });
    }

    const userObjId = mongoose.Types.ObjectId.isValid(rawUserId) ? new mongoose.Types.ObjectId(rawUserId) : rawUserId;

    const result = await ChatMessage.updateMany(
      { roomId: groupId, senderId: { $ne: userObjId }, readBy: { $ne: userObjId } },
      { $addToSet: { readBy: userObjId, deliveredTo: userObjId } }
    );

    const io = req.app.get('io') || req.app.get('socketio') || global.io;
    if (io) {
      let broadcast = io.to(String(groupId));
      const targetRoom = await ChatRoom.findById(groupId).select('members');
      if (targetRoom && targetRoom.members && targetRoom.members.length > 0) {
        targetRoom.members.forEach((m) => {
          const mIdStr = getMemberIdString(m);
          if (mIdStr) broadcast = broadcast.to(`user_${mIdStr}`);
        });
      }
      broadcast.emit('room-messages-read', { roomId: groupId, userId: String(rawUserId) });
      broadcast.emit('messages-read', { roomId: groupId, conversationId: groupId, userId: String(rawUserId) });
    }

    return res.json({
      success: true,
      message: 'Room marked as read',
      modifiedCount: result.modifiedCount || 0
    });
  } catch (error) {
    console.error('Error marking group as read:', error);
    return res.status(500).json({ success: false, message: 'Failed to mark group as read', error: error.message });
  }
};

module.exports = {
  getGroups,
  getGroupMessages,
  postGroupMessage,
  votePollMessage,
  forwardMessage,
  getGroupMembers,
  updateGroupMembers,
  syncGroups,
  postActivityEvent,
  acknowledgeMessage,
  getUsersForDM,
  createOrGetDirectRoom,
  createGroup,
  updateGroup,
  deleteGroup,
  deleteMessage,
  editMessage,
  searchMessages,
  toggleReaction,
  togglePinMessage,
  markGroupAsRead,
  purgeOrphanChatFiles,
  forceReloadAllUsers,
  clearAllData,
  broadcastVersionUpdate,
};




