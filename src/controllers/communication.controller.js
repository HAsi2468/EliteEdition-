const mongoose = require('mongoose');
const { ChatRoom, ChatMessage, user: User } = require('../db/models');
const { syncCommunicationGroups } = require('../utils/syncCommunicationGroups');
const { publishActivity } = require('../utils/activityEvent');

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

    let query;

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
      // If user identity is missing, do NOT expose direct 1-on-1 messages of other users
      query = {
        isArchived: { $ne: true },
        type: { $ne: 'direct' }
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

    // Fetch unread count & latest message snippet for each room
    const roomsWithMeta = await Promise.all(
      rooms.map(async (room) => {
        const roomObj = room.toObject();
        
        const lastMsg = await ChatMessage.findOne({ roomId: room._id })
          .sort({ createdAt: -1 })
          .populate('senderId', 'name username email');

        let unreadCount = 0;
        if (currentUser) {
          unreadCount = await ChatMessage.countDocuments({
            roomId: room._id,
            senderId: { $ne: currentUser._id },
            readBy: { $ne: currentUser._id }
          });
        }

        roomObj.lastMessage = lastMsg || null;
        roomObj.unreadCount = unreadCount;
        return roomObj;
      })
    );

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

    const room = await ChatRoom.findById(groupId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const rawReqUserId = req.user ? req.user._id : (req.headers['x-user-id'] || req.query.userId || req.body?.userId);
    const requestingUser = rawReqUserId ? await User.findById(rawReqUserId) : null;
    const reqUserIdStr = String(requestingUser ? requestingUser._id : (rawReqUserId || ''));

    if (requestingUser && reqUserIdStr) {
      const isMember = room.members && room.members.some((m) => {
        if (!m) return false;
        const memberIdStr = String(typeof m === 'object' ? (m._id || m.id || m) : m);
        return memberIdStr === reqUserIdStr;
      });

      if (!isMember) {
        if (room.type === 'direct') {
          // Do NOT allow non-members to view or auto-join private 1-on-1 direct rooms
          return res.status(403).json({ success: false, message: 'Access denied to direct message conversation' });
        }
        // Auto-join public/authority group rooms if user has access
        room.members = room.members || [];
        room.members.push(requestingUser._id);
        await room.save();
      }
    }

    const query = { roomId: groupId };
    if (msgType === 'human') {
      query.$or = [{ msgType: 'human' }, { msgType: { $exists: false } }, { msgType: null }, { msgType: '' }];
    } else if (msgType === 'system_activity') {
      query.msgType = 'system_activity';
    }

    const total = await ChatMessage.countDocuments(query);
    const messages = await ChatMessage.find(query)
      .populate('senderId', 'name username email role')
      .populate({
        path: 'reactions.user',
        select: 'name username email'
      })
      .populate({
        path: 'replyTo',
        populate: { path: 'senderId', select: 'name username email' }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Return in chronological order
    messages.reverse();

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
 * Send a message to a communication group via HTTP POST endpoint
 */
const postGroupMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const rawSenderId = req.user ? req.user._id : (req.headers['x-user-id'] || req.body.senderId || req.body.userId || req.query.userId);

    if (!rawSenderId) {
      return res.status(400).json({ success: false, message: 'Sender ID is required' });
    }

    const { content, replyTo, attachment, priority, type, activityMeta, recordMentions: inRecordMentions } = req.body;

    if (!content && !attachment) {
      return res.status(400).json({ success: false, message: 'Message content or attachment is required' });
    }

    const targetRoom = await ChatRoom.findById(groupId);
    if (!targetRoom) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const senderObjId = mongoose.Types.ObjectId.isValid(rawSenderId) ? new mongoose.Types.ObjectId(rawSenderId) : rawSenderId;
    const strSender = String(senderObjId);

    const isMember = targetRoom.members && targetRoom.members.some((m) => {
      if (!m) return false;
      const memberIdStr = String(typeof m === 'object' ? (m._id || m.id || m) : m);
      return memberIdStr === strSender;
    });

    if (!isMember) {
      if (targetRoom.type === 'direct') {
        return res.status(403).json({ success: false, message: 'You are not a member of this direct conversation' });
      }
      targetRoom.members = targetRoom.members || [];
      targetRoom.members.push(senderObjId);
      await targetRoom.save();
    }

    // Parse user mentions
    const mentionRegex = /@(\w+)/g;
    const matches = [...(content || '').matchAll(mentionRegex)];
    const usernames = matches.map(m => m[1]);
    const mentions = [];
    if (usernames.length > 0) {
      const matchedUsers = await User.find({ username: { $in: usernames } });
      matchedUsers.forEach(u => mentions.push(u._id));
    }

    // Parse record mentions
    const recordMentions = inRecordMentions || [];
    if (!inRecordMentions && content) {
      const recordRegex = /@(JC|DES|INV)-([a-zA-Z0-9_-]+)/gi;
      const recordMatches = [...content.matchAll(recordRegex)];
      recordMatches.forEach((m) => {
        const prefix = m[1].toUpperCase();
        const refVal = m[0].replace(/^@/, '');
        const rType = prefix === 'JC' ? 'jobcard' : prefix === 'DES' ? 'design' : 'invoice';
        recordMentions.push({ recordType: rType, recordRef: refVal });
      });
    }

    const msgType = type || (attachment && attachment.fileType === 'audio' ? 'audio-voice' : 'text');

    const newMessage = await ChatMessage.create({
      roomId: groupId,
      senderId: senderObjId,
      content: content || (attachment ? `Attached ${attachment.fileName || 'file'}` : ''),
      replyTo: replyTo || null,
      type: msgType,
      msgType: 'human',
      priority: priority === 'urgent' ? 'urgent' : 'normal',
      attachment: attachment || undefined,
      activityMeta: activityMeta || undefined,
      recordMentions: recordMentions.length > 0 ? recordMentions : undefined,
      readBy: [senderObjId]
    });

    await ChatRoom.findByIdAndUpdate(groupId, { updatedAt: new Date() });

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

    // Broadcast via Socket.IO if available
    const io = req.app.get('io') || global.io;
    if (io) {
      io.to(String(groupId)).emit('receive-message', populatedMessage);
      if (targetRoom.members && targetRoom.members.length > 0) {
        targetRoom.members.forEach((m) => {
          const mIdStr = String(typeof m === 'object' ? (m._id || m.id || m) : m);
          if (mIdStr) {
            io.to(`user_${mIdStr}`).emit('receive-message', populatedMessage);
          }
        });
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
    const io = req.app.get('io') || global.io;
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
 * Admin option to create custom communication activity group
 */
const createGroup = async (req, res) => {
  try {
    const { name, description = '', department = 'General', companyEntity = '', permissionScope = 'general', subscribedModules = [], subscribedActions = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }

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

    const creatorId = req.user ? req.user._id : (req.body.userId || req.query.userId);
    let memberIds = matchingUsers.map(u => String(u._id));
    if (creatorId && !memberIds.includes(String(creatorId))) {
      memberIds.push(String(creatorId));
    }

    const room = await ChatRoom.create({
      name: name.trim(),
      description: description.trim(),
      type: 'group',
      department: department.trim(),
      companyEntity: companyEntity.trim(),
      permissionScope: permissionScope.trim(),
      isSystemGroup: false,
      subscribedModules: subscribedModules || [],
      subscribedActions: subscribedActions || [],
      members: memberIds
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

module.exports = {
  getGroups,
  getGroupMessages,
  postGroupMessage,
  getGroupMembers,
  updateGroupMembers,
  syncGroups,
  postActivityEvent,
  acknowledgeMessage,
  getUsersForDM,
  createOrGetDirectRoom,
  createGroup,
  deleteGroup,
  forceReloadAllUsers,
};




