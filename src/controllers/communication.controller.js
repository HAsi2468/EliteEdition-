const mongoose = require('mongoose');
const { ChatRoom, ChatMessage, user: User } = require('../db/models');
const { syncCommunicationGroups } = require('../utils/syncCommunicationGroups');
const { publishActivity } = require('../utils/activityEvent');
const { sanitizeChatMessage, validateAttachment } = require('../utils/sanitizeChat');
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
      .populate('members', 'name username email role permissions department')
      .sort({ updatedAt: -1 });

    if (rooms.length === 0) {
      await syncCommunicationGroups();
      rooms = await ChatRoom.find(query)
        .populate('members', 'name username email role permissions department')
        .sort({ updatedAt: -1 });
    }

    // Fetch unread count & latest message snippet for each room using fast batch aggregation
    const roomIds = rooms.map((r) => r._id);
    const lastMsgMap = {};
    const unreadMap = {};

    if (roomIds.length > 0) {
      // 1. Fetch latest message for each room in a single aggregation pipeline
      const latestAgg = await ChatMessage.aggregate([
        { $match: { roomId: { $in: roomIds } } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$roomId',
            lastMsg: { $first: '$$ROOT' }
          }
        }
      ]);

      if (latestAgg.length > 0) {
        const msgsToPopulate = latestAgg.map((x) => x.lastMsg);
        await ChatMessage.populate(msgsToPopulate, { path: 'senderId', select: 'name username email' });
        latestAgg.forEach((x) => {
          if (x.lastMsg && x.lastMsg.isDeleted) {
            x.lastMsg.content = 'This message was deleted';
          }
          lastMsgMap[String(x._id)] = x.lastMsg;
        });
      }

      // 2. Fetch unread counts in a single aggregation pipeline
      const targetUserId = currentUser ? currentUser._id : (rawUserId && mongoose.Types.ObjectId.isValid(rawUserId) ? rawUserId : null);
      if (targetUserId) {
        const targetUserObjId = mongoose.Types.ObjectId.isValid(targetUserId)
          ? (typeof targetUserId === 'object' ? targetUserId : new mongoose.Types.ObjectId(targetUserId))
          : null;
        if (targetUserObjId) {
          const unreadAgg = await ChatMessage.aggregate([
            {
              $match: {
                roomId: { $in: roomIds },
                senderId: { $ne: targetUserObjId },
                readBy: { $ne: targetUserObjId },
                isDeleted: { $ne: true }
              }
            },
            {
              $group: {
                _id: '$roomId',
                count: { $sum: 1 }
              }
            }
          ]);
          unreadAgg.forEach((u) => {
            unreadMap[String(u._id)] = u.count;
          });
        }
      }
    }

    const roomsWithMeta = rooms.map((room) => {
      const roomObj = room.toObject();
      roomObj.lastMessage = lastMsgMap[String(room._id)] || null;
      roomObj.unreadCount = unreadMap[String(room._id)] || 0;
      return roomObj;
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
    const { page = 1, limit = 50, msgType } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

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

      const isSuperOrAdmin = req.user && (
        req.user.role === 'admin' ||
        req.user.role === 'super_admin' ||
        req.user.isAdmin === true ||
        req.user.isMainAdmin === true
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
    if (msgType === 'human') {
      query.$or = [{ msgType: 'human' }, { msgType: { $exists: false } }, { msgType: null }, { msgType: '' }];
    } else if (msgType === 'system_activity') {
      query.msgType = 'system_activity';
    }

    const [total, messages] = await Promise.all([
      ChatMessage.countDocuments(query),
      ChatMessage.find(query)
        .populate('senderId', 'name username email role')
        .populate('pollMeta.options.votes', 'name username email')
        .populate({
          path: 'reactions.user',
          select: 'name username email'
        })
        .populate({
          path: 'replyTo',
          populate: { path: 'senderId', select: 'name username email' }
        })
        .sort({ roomSeq: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
    ]);

    // Return in monotonic chronological order (roomSeq ascending, fallback createdAt)
    messages.sort((a, b) => {
      if (a.roomSeq && b.roomSeq) return a.roomSeq - b.roomSeq;
      return new Date(a.createdAt) - new Date(b.createdAt);
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
    console.error('Error fetching group messages:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages', error: error.message });
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
 * Forward an existing message to another chat room
 */
const forwardMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { targetRoomId } = req.body;
    const rawSenderId = req.user ? req.user._id : (req.headers['x-user-id'] || req.body.senderId || req.body.userId);

    if (!targetRoomId || !rawSenderId) {
      return res.status(400).json({ success: false, message: 'Target room ID and sender ID are required' });
    }

    const origMessage = await ChatMessage.findById(messageId).populate('senderId', 'name username');
    if (!origMessage) {
      return res.status(404).json({ success: false, message: 'Original message not found' });
    }

    const origRoom = await ChatRoom.findById(origMessage.roomId);

    const forwardedMsg = await ChatMessage.create({
      roomId: targetRoomId,
      senderId: rawSenderId,
      content: origMessage.content,
      type: origMessage.type,
      msgType: 'human',
      attachment: origMessage.attachment || undefined,
      pollMeta: origMessage.pollMeta || undefined,
      activityMeta: origMessage.activityMeta || undefined,
      recordMentions: origMessage.recordMentions || undefined,
      forwardedFrom: {
        senderName: origMessage.senderId ? (origMessage.senderId.name || origMessage.senderId.username) : 'Staff',
        originalRoomName: origRoom ? origRoom.name : 'Channel'
      },
      readBy: [rawSenderId]
    });

    await ChatRoom.findByIdAndUpdate(targetRoomId, { updatedAt: new Date() });

    const populatedMsg = await ChatMessage.findById(forwardedMsg._id)
      .populate('senderId', 'name username email role')
      .populate('readBy', 'name username email');

    const io = req.app.get('io') || req.app.get('socketio') || global.io;
    if (io) {
      let broadcast = io.to(String(targetRoomId));
      const targetRoom = await ChatRoom.findById(targetRoomId);
      if (targetRoom && targetRoom.members && targetRoom.members.length > 0) {
        targetRoom.members.forEach((m) => {
          const mIdStr = getMemberIdString(m);
          if (mIdStr) broadcast = broadcast.to(`user_${mIdStr}`);
        });
      }
      broadcast.emit('receive-message', populatedMsg);
    }

    res.json({ success: true, data: populatedMsg });
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

    const { content, replyTo, attachment, priority, type, activityMeta, pollMeta, recordMentions: inRecordMentions } = req.body;

    if (!content && !attachment && type !== 'poll') {
      return res.status(400).json({ success: false, message: 'Message content, attachment, or poll is required' });
    }

    // Attachment security validation (block executables and oversized files)
    if (attachment) {
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

    // Sanitize content against Stored XSS and malicious script injection
    const sanitizedContent = sanitizeChatMessage(content || '');

    // Parse user mentions
    const mentionRegex = /@(\w+)/g;
    const matches = [...(sanitizedContent || '').matchAll(mentionRegex)];
    const usernames = matches.map(m => m[1]);
    const mentions = [];
    if (usernames.length > 0) {
      const matchedUsers = await User.find({ username: { $in: usernames } });
      matchedUsers.forEach(u => mentions.push(u._id));
    }

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

    const newMessage = await ChatMessage.create({
      roomId: groupId,
      senderId: senderObjId,
      senderName: resolvedSenderName,
      content: sanitizedContent || (pollMeta ? pollMeta.question : ''),
      replyTo: replyTo || null,
      type: msgType,
      msgType: 'human',
      priority: priority === 'urgent' ? 'urgent' : 'normal',
      attachment: attachment || undefined,
      pollMeta: pollMeta || undefined,
      activityMeta: activityMeta || undefined,
      recordMentions: recordMentions.length > 0 ? recordMentions : undefined,
      mentions: mentions.length > 0 ? mentions : undefined,
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

    // Intelligent Dispatch: Real-time WebSocket + selective background Web Push
    await dispatchChatMessage({
      io,
      roomId: groupId,
      populatedMessage,
      targetRoom,
      senderId: strSender,
      rawContent: content,
      priority: priority === 'urgent' ? 'urgent' : 'normal',
    });

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

    res.json({ success: true, data: populatedMessage });
  } catch (error) {
    console.error('Error in postGroupMessage endpoint:', error);
    res.status(500).json({ success: false, message: 'Failed to send message', error: error.message });
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

/**
 * Get active users list for starting private 1-on-1 direct messages
 */
const getUsersForDM = async (req, res) => {
  try {
    const rawUserId = req.user ? req.user._id : req.query.userId;
    let query = {};
    if (rawUserId && mongoose.Types.ObjectId.isValid(rawUserId)) {
      query = { _id: { $ne: new mongoose.Types.ObjectId(rawUserId) } };
    }
    const users = await User.find(query).select('name username email role department').sort({ name: 1 });
    res.json({ success: true, data: users });
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
 * Search message content across accessible rooms
 */
const searchMessages = async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    if (!q || !q.trim()) {
      return res.status(200).json({ success: true, results: [] });
    }

    const rawUserId = req.user ? req.user._id : (req.headers['x-user-id'] || req.query.userId);
    const userObjId = rawUserId && mongoose.Types.ObjectId.isValid(rawUserId) ? new mongoose.Types.ObjectId(rawUserId) : null;
    const userStrId = rawUserId ? String(rawUserId) : null;
    const userMembers = [userObjId, userStrId].filter(Boolean);

    const isSuperOrAdmin = req.user && (
      req.user.role === 'admin' ||
      req.user.role === 'super_admin' ||
      req.user.isAdmin === true ||
      req.user.isMainAdmin === true ||
      req.headers['x-is-admin'] === 'true'
    );

    let roomQuery = { isArchived: { $ne: true } };
    if (!isSuperOrAdmin) {
      if (userMembers.length > 0) {
        roomQuery.$or = [
          { members: { $in: userMembers } },
          { createdBy: { $in: userMembers } },
          { isSystemGroup: true },
          { type: 'group' }
        ];
      } else {
        roomQuery.$or = [
          { isSystemGroup: true },
          { type: 'group' }
        ];
      }
    }

    const accessibleRooms = await ChatRoom.find(roomQuery).select('_id name title type').lean();
    const accessibleRoomIds = accessibleRooms.map(r => r._id);

    if (accessibleRoomIds.length === 0) {
      return res.status(200).json({ success: true, results: [] });
    }

    const limitNum = Math.min(parseInt(limit, 10) || 20, 50);
    const trimmed = q.trim();
    const escapedQuery = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Query messages by case-insensitive regex search
    const query = {
      roomId: { $in: accessibleRoomIds },
      isDeleted: { $ne: true },
      content: { $regex: escapedQuery, $options: 'i' }
    };

    const results = await ChatMessage.find(query)
      .populate('senderId', 'name username email avatarUrl')
      .populate('roomId', 'name title type')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();

    return res.status(200).json({ success: true, results: results || [] });
  } catch (error) {
    console.error('Error searching messages:', error);
    return res.status(200).json({ success: true, results: [], error: error.message });
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

    // Soft delete the message in MongoDB
    message.isDeleted = true;
    message.deletedBy = userId;
    message.deletedAt = new Date();
    message.content = 'This message was deleted';
    message.attachment = null;
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
    console.error('Error deleting message:', error);
    res.status(500).json({ success: false, message: 'Failed to delete message', error: error.message });
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
  deleteGroup,
  deleteMessage,
  editMessage,
  searchMessages,
  forceReloadAllUsers,
  clearAllData,
  broadcastVersionUpdate,
};




