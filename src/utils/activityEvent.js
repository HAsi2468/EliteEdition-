const { ChatRoom, ChatMessage, user: User } = require('../db/models');

let ioInstance = null;

/**
 * Set global Socket.IO instance for real-time activity dispatch
 */
function setActivitySocketIo(io) {
  ioInstance = io;
}

/**
 * Map generic module name/permission to corresponding groupKey
 */
function resolveGroupKey(permissionScope, department) {
  const scope = (permissionScope || '').toLowerCase();
  const dept = (department || '').toLowerCase();

  if (scope.includes('jobcard') && (scope.includes('log') || scope.includes('print'))) return 'production__printing_log';
  if (scope.includes('jobcard') || dept.includes('production')) return 'production__job_card';
  if (scope.includes('fabric') || dept.includes('fabric')) return 'fabric__inventory';
  if (scope.includes('bill') || dept.includes('billing')) return 'billing__invoicing';
  if (scope.includes('inventory') || dept.includes('inventory')) return 'inventory__stock';
  if (scope.includes('complain') || dept.includes('quality')) return 'quality__complaints';
  if (scope.includes('stitch') || dept.includes('stitching')) return 'stitching__department';
  if (scope.includes('expense') || dept.includes('finance')) return 'finance__expenses';
  if (scope.includes('design') || dept.includes('design')) return 'design__catalogue';

  return 'production__job_card'; // default fallback
}

/**
 * Publish an authority-based system activity event
 * 
 * @param {Object} options
 * @param {string} options.actorId - User ID who triggered activity
 * @param {string} [options.actorName] - Name of user
 * @param {string} options.action - 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'STAGE_ADVANCE'
 * @param {string} options.module - e.g. 'Job Card', 'Billing Invoice', 'Fabric Inventory'
 * @param {string} options.recordRef - e.g. 'JC-1042', 'INV-8812'
 * @param {string} [options.recordId] - MongoDB _id
 * @param {string} options.permissionScope - e.g. 'jobcards', 'jobcards_fabric', 'billing'
 * @param {string} [options.department] - e.g. 'Production', 'Billing'
 * @param {string} options.description - Human readable event summary message
 */
async function publishActivity({
  actorId,
  actorName = '',
  action,
  module,
  recordRef,
  recordId = '',
  permissionScope,
  department = '',
  description
}) {
  try {
    let realUserName = (actorName || '').trim();

    // 1. If actorId is provided, look up the exact user's name from MongoDB
    if (actorId) {
      const u = await User.findById(actorId).lean();
      if (u && (u.name || u.username)) {
        realUserName = u.name || u.username;
      }
    }

    // 2. If realUserName is still generic or empty, try fallback lookups
    if (!realUserName || ['Admin', 'Operator', 'System Bot', 'System'].includes(realUserName)) {
      if (actorName && !['Admin', 'Operator', 'System Bot', 'System'].includes(actorName.trim())) {
        realUserName = actorName.trim();
      }
    }

    // 3. Format final description replacing generic "by Admin" with actual user name
    let finalDescription = description || `[System Activity] ${action} on ${module} #${recordRef}`;
    if (realUserName && !['Admin', 'Operator', 'System Bot'].includes(realUserName)) {
      finalDescription = finalDescription.replace(/by (Admin|Operator|System Bot)\.?$/i, `by **${realUserName}**.`);
    } else if (realUserName) {
      finalDescription = finalDescription.replace(/by (Admin|Operator|System Bot)\.?$/i, `by **${realUserName}**.`);
    }

    const groupKey = resolveGroupKey(permissionScope, department);
    
    // Find primary default room + any custom subscribed groups
    const matchingRooms = await ChatRoom.find({
      isSystemGroup: true,
      $or: [
        { groupKey: groupKey },
        { permissionScope: permissionScope },
        { subscribedModules: module },
        { subscribedActions: action }
      ]
    });

    let targetRooms = matchingRooms;
    if (targetRooms.length === 0) {
      // Fallback: search by any system room
      const fallbackRoom = await ChatRoom.findOne({ isSystemGroup: true });
      if (fallbackRoom) targetRooms = [fallbackRoom];
    }

    if (targetRooms.length === 0) {
      console.warn(`[publishActivity] No system ChatRoom found for scope: ${permissionScope}`);
      return null;
    }

    let firstPopulatedMsg = null;

    for (const room of targetRooms) {
      // Resolve senderId (use actorId or fallback to admin/room ID)
      let senderId = actorId;
      if (!senderId) {
        const admin = await User.findOne({ role: 'admin' });
        senderId = admin ? admin._id : room._id;
      }

      // Create system_activity message
      const newMessage = await ChatMessage.create({
        roomId: room._id,
        senderId,
        content: finalDescription,
        type: 'text',
        msgType: 'system_activity',
        activityMeta: {
          action,
          module,
          recordRef,
          recordId: String(recordId || ''),
          department: department || room.department,
          permissionScope: permissionScope || room.permissionScope,
        },
        readBy: actorId ? [actorId] : []
      });

      const populatedMsg = await ChatMessage.findById(newMessage._id)
        .populate('senderId', 'name username email role');

      if (!firstPopulatedMsg) firstPopulatedMsg = populatedMsg;

      // Emit Socket.IO real-time event to room and all connected users
      if (ioInstance) {
        ioInstance.to(String(room._id)).emit('receive-message', populatedMsg);
        ioInstance.emit('activity-notification', {
          roomId: room._id,
          groupKey: room.groupKey,
          groupName: room.name,
          message: populatedMsg,
        });
      }
    }

    return firstPopulatedMsg;
  } catch (error) {
    console.error('Error publishing activity event:', error);
    return null;
  }
}

module.exports = {
  setActivitySocketIo,
  publishActivity,
};
