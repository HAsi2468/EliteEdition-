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
function resolveGroupKey(permissionScope, department, companyEntity = '') {
  const scope = (permissionScope || '').toLowerCase();
  const dept = (department || '').toLowerCase();
  const company = (companyEntity || '').toLowerCase();

  const isEDP = company.includes('digital') || company.includes('edp') || scope.includes('edp') || scope.includes('jobcards') || dept.includes('production') || dept.includes('fabric') || dept.includes('stitching');
  const isEO = company.includes('online') || scope.includes('sales') || scope.includes('returns') || scope.includes('unicommerce');

  if (isEDP) {
    if (scope.includes('bill') || scope.includes('invoice') || dept.includes('bill')) return 'edp__billing_invoicing';
    if (scope.includes('fabric') || dept.includes('fabric')) return 'edp__fabric_inventory';
    if (scope.includes('stitch') || dept.includes('stitch')) return 'edp__stitching';
    if (scope.includes('print') && (scope.includes('log') || dept.includes('print'))) return 'edp__printing_log';
    if (scope.includes('jobcard') || dept.includes('production')) return 'edp__job_card';
  }

  if (isEO) {
    if (scope.includes('return')) return 'eo__returns_manager';
    if (scope.includes('sale') || scope.includes('order')) return 'eo__sales_orders';
    if (scope.includes('inventory')) return 'eo__inventory_stock';
  }

  if (scope.includes('bill') || scope.includes('invoice')) return 'edp__billing_invoicing';
  if (scope.includes('fabric')) return 'edp__fabric_inventory';
  if (scope.includes('stitch')) return 'edp__stitching';
  if (scope.includes('return')) return 'eo__returns_manager';

  return 'edp__job_card'; // default fallback
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
 * @param {string} [options.companyEntity] - e.g. 'Elite Digital Print', 'Elite Online'
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
  companyEntity = '',
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

    // 2. If realUserName is still generic or empty, default to HASI
    if (!realUserName || ['Admin', 'Operator', 'System Bot', 'System', 'Staff User'].includes(realUserName)) {
      if (actorName && !['Admin', 'Operator', 'System Bot', 'System', 'Staff User'].includes(actorName.trim())) {
        realUserName = actorName.trim();
      } else {
        realUserName = 'HASI';
      }
    }

    // 3. Format final description replacing generic "by Admin" with actual user name
    let finalDescription = description || `[System Activity] ${action} on ${module} #${recordRef}`;
    finalDescription = finalDescription.replace(/by \*{0,2}(Admin|Operator|System Bot|Staff User)\*{0,2}\.?$/i, `by **${realUserName}**.`);

    const groupKey = resolveGroupKey(permissionScope, department, companyEntity);
    
    // Find primary default room matching the resolved department groupKey or Company + Scope
    let targetRooms = await ChatRoom.find({
      isSystemGroup: true,
      $or: [
        { groupKey: groupKey },
        { permissionScope: permissionScope }
      ]
    });

    if (companyEntity && companyEntity.trim()) {
      const companyRooms = await ChatRoom.find({
        isSystemGroup: true,
        companyEntity: new RegExp(companyEntity.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        permissionScope: permissionScope
      });
      if (companyRooms.length > 0) {
        targetRooms = Array.from(new Set([...targetRooms, ...companyRooms]));
      }
    }

    if (targetRooms.length === 0) {
      // Fallback: search by subscribed modules or actions
      targetRooms = await ChatRoom.find({
        isSystemGroup: true,
        $or: [
          { subscribedModules: module },
          { subscribedActions: action }
        ]
      });
    }
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
