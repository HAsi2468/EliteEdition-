/**
 * Socket.IO Emit Helper for Backend Controllers
 * Routes all domain events through the centralized EventBus with company room isolation.
 */
const eventBus = require('../services/eventBus.service');
const { normalizeCompanyId } = require('../config/company.constants');

function emitSocketEvent(req, eventName, payload) {
  try {
    const io = (req && req.app && (req.app.get('io') || req.app.get('socketio'))) || global.io;
    if (io && !eventBus.io) {
      eventBus.setSocketIo(io);
    }

    // Determine entity and action from eventName (e.g., 'job-updated', 'inventory-created')
    let entity = 'system';
    let action = 'updated';
    if (typeof eventName === 'string') {
      const parts = eventName.split('-');
      if (parts.length >= 2) {
        entity = parts[0];
        action = parts[1];
      } else {
        entity = eventName;
      }
    }

    const companyId = (req && (req.company_id || req.canonicalCompanyId)) ||
                      (payload && (payload.company_id || payload.companyId || payload.department || payload.companyEntity)) ||
                      null;

    const id = (payload && (payload._id || payload.id || payload.jobCardId)) || 'batch';

    eventBus.publishDataChange({
      entity,
      id,
      action,
      companyId: normalizeCompanyId(companyId),
      version: (payload && payload.__v) || 1,
      updatedAt: (payload && (payload.updatedAt || payload.modified_date_time)) || new Date(),
      payload: (typeof payload === 'object' && payload !== null) ? payload : null
    });
  } catch (err) {
    console.warn(`[socketEmitHelper] Failed to emit ${eventName}:`, err.message);
  }
}

module.exports = { emitSocketEvent };
