const cron = require('node-cron');
const logger = require('../config/logger');
const { ChatMessage } = require('../db/models/chat.model');

async function performOrphanChatCleanup() {
  try {
    const { listR2Objects, deleteR2Object, isR2Configured } = require('../utils/r2Storage');
    if (!isR2Configured()) return { deletedCount: 0 };

    const objects = await listR2Objects({ folder: 'Chat' });
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const obj of objects) {
      if (obj.lastModified && new Date(obj.lastModified) > oneDayAgo) {
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
      }
    }
    if (deletedCount > 0) {
      logger.info(`[Chat Orphan Cleanup] Removed ${deletedCount} unreferenced chat attachments (> 24h old) from R2.`);
    }
    return { deletedCount };
  } catch (err) {
    logger.warn('[Chat Orphan Cleanup] Warning: %s', err.message);
    return { deletedCount: 0, error: err.message };
  }
}

function startChatOrphanCleanupScheduler() {
  // Cron: Run daily at 03:30 AM IST
  cron.schedule(
    '30 3 * * *',
    async () => {
      await performOrphanChatCleanup();
    },
    { timezone: 'Asia/Kolkata' }
  );
  logger.info('[Scheduler] Chat orphan cleanup scheduler registered (Daily 03:30 AM IST).');
}

module.exports = {
  startChatOrphanCleanupScheduler,
  performOrphanChatCleanup
};
