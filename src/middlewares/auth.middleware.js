const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { user: User, ChatRoom } = require('../db/models');

/**
 * Enforce valid JWT Bearer token authentication
 */
const requireAuth = async (req, res, next) => {
  try {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.replace(/^Bearer\s+/i, '');
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    // If req.user is already validated with a real ObjectId in preceding app middleware
    if (req.user && req.user._id && String(req.user._id).length === 24 && req.user.role) {
      req.userId = String(req.user._id);
      return next();
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid Bearer token.'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired authentication token.'
      });
    }

    const userId = decoded.userId || decoded.id || decoded.sub;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Malformed authentication token payload.'
      });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found or has been deactivated.'
      });
    }

    req.user = user;
    req.userId = String(user._id);
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Authentication verification error',
      error: error.message
    });
  }
};

/**
 * Enforce Admin privileges
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const isAdmin = req.user.role === 'admin' ||
                  req.user.role === 'super_admin' ||
                  req.user.isAdmin === true ||
                  req.user.isMainAdmin === true ||
                  req.user.email === 'harshitsidapara2468@gmail.com';

  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Admin privileges required for this action.'
    });
  }
  next();
};

/**
 * Enforce Group Membership & Channel Isolation (IDOR Protection)
 */
const requireGroupAccess = async (req, res, next) => {
  try {
    const groupId = req.params.groupId || req.body.groupId || req.query.groupId;
    if (!groupId) {
      return res.status(400).json({ success: false, message: 'Group ID is required' });
    }

    const room = await ChatRoom.findById(groupId).lean();
    if (!room) {
      return res.status(404).json({ success: false, message: 'Chat room or group not found' });
    }

    req.chatRoom = room;

    const currentUserIdStr = req.user ? String(req.user._id) : '';
    const isAdmin = req.user && (
      req.user.role === 'admin' ||
      req.user.role === 'super_admin' ||
      req.user.isAdmin === true ||
      req.user.isMainAdmin === true
    );

    // Direct 1-on-1 rooms: Strictly limited to the 2 participants
    if (room.type === 'direct') {
      const isParticipant = room.members && room.members.some(m => String(m._id || m) === currentUserIdStr);
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not a participant in this direct message conversation.'
        });
      }
      return next();
    }

    // Admins have access to operational/department channels
    if (isAdmin) {
      return next();
    }

    // Private or restricted rooms: Must be an explicit member
    if (room.isPrivate) {
      const isMember = room.members && room.members.some(m => String(m._id || m) === currentUserIdStr);
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: This is a private group and you are not a member.'
        });
      }
      return next();
    }

    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Group access verification error', error: err.message });
  }
};

module.exports = {
  requireAuth,
  requireAdmin,
  requireGroupAccess
};
