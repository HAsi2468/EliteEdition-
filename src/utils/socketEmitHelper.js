/**
 * Socket.IO Emit Helper for Backend Controllers
 * Emits real-time domain events to all connected clients across all 5 company entities.
 */
function emitSocketEvent(req, eventName, payload) {
  try {
    if (!req || !req.app) return;
    const io = req.app.get('io') || req.app.get('socketio') || global.io;
    if (io) {
      io.emit(eventName, payload);
    }
  } catch (err) {
    console.warn(`[socketEmitHelper] Failed to emit ${eventName}:`, err.message);
  }
}

module.exports = { emitSocketEvent };
