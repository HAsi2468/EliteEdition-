const { ChatRoom, ChatMessage, user: User } = require('../db/models');
const { syncCommunicationGroups } = require('../utils/syncCommunicationGroups');
const { publishActivity } = require('../utils/activityEvent');

/**
 * Get all communication groups accessible to the user
 */
const getGroups = async (req, res) => {
  try {
    const userId = req.user ? req.user._id : req.query.userId;
    let currentUser = null;

    if (userId) {
      currentUser = await User.findById(userId);
    }

    let query = { isArchived: { $ne: true } };

    if (currentUser && currentUser.role !== 'admin') {
      // User can view groups where they are explicit members OR matches their permissions
      query = {
        isArchived: { $ne: true },
        $or: [
          { members: currentUser._id },
          { isSystemGroup: true, permissionScope: { $in: currentUser.permissions || [] } },
          { isSystemGroup: { $ne: true } }
        ]
      };
    }

    let rooms = await ChatRoom.find(query)
      .populate('members', 'name email role permissions')
      .sort({ updatedAt: -1 });

    if (rooms.length === 0) {
      await syncCommunicationGroups();
      rooms = await ChatRoom.find(query)
        .populate('members', 'name email role permissions')
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

    const query = { roomId: groupId };
    if (msgType && ['human', 'system_activity'].includes(msgType)) {
      query.msgType = msgType;
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
    const currentUserId = req.user ? req.user._id : req.query.userId;
    const query = currentUserId ? { _id: { $ne: currentUserId } } : {};
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
    const currentUserId = (req.user && req.user._id) ? req.user._id : (req.body.userId || req.query.userId);
    const { targetUserId } = req.body;

    if (!currentUserId || !targetUserId) {
      return res.status(400).json({ success: false, message: 'Current user ID and Target user ID are required' });
    }

    // Check if direct room already exists between these 2 users
    let room = await ChatRoom.findOne({
      type: 'direct',
      members: { $all: [currentUserId, targetUserId], $size: 2 }
    }).populate('members', 'name email role permissions department');

    if (!room) {
      const u1 = await User.findById(currentUserId);
      const u2 = await User.findById(targetUserId);

      const name1 = u1 ? (u1.name || u1.username) : 'User';
      const name2 = u2 ? (u2.name || u2.username) : 'User';

      room = await ChatRoom.create({
        name: `${name1} & ${name2}`,
        type: 'direct',
        members: [currentUserId, targetUserId],
        department: u2 ? (u2.department || 'General') : 'General',
        permissionScope: 'direct_msg'
      });

      room = await ChatRoom.findById(room._id).populate('members', 'name email role permissions department');
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
    const { name, description = '', department = 'General', permissionScope = 'general', subscribedModules = [], subscribedActions = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }

    // Find all users who match department or permissionScope
    let matchingUsers = [];
    if (permissionScope && permissionScope !== 'general') {
      matchingUsers = await User.find({
        $or: [
          { role: 'admin' },
          { permissions: permissionScope },
          { department: { $regex: new RegExp(`^${department}$`, 'i') } }
        ]
      }).select('_id');
    } else {
      matchingUsers = await User.find().select('_id');
    }

    const memberIds = matchingUsers.map((u) => u._id);

    const room = await ChatRoom.create({
      name: name.trim(),
      description: description.trim(),
      type: 'group',
      department: department.trim(),
      permissionScope: permissionScope.trim(),
      isSystemGroup: true,
      subscribedModules: subscribedModules || [],
      subscribedActions: subscribedActions || [],
      members: memberIds
    });

    const populatedRoom = await ChatRoom.findById(room._id).populate('members', 'name email role permissions department');

    res.json({ success: true, data: populatedRoom });
  } catch (error) {
    console.error('Error creating custom group:', error);
    res.status(500).json({ success: false, message: 'Failed to create custom group', error: error.message });
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
  getGroupMembers,
  syncGroups,
  postActivityEvent,
  acknowledgeMessage,
  getUsersForDM,
  createOrGetDirectRoom,
  createGroup,
  deleteGroup,
  forceReloadAllUsers,
};




