const { performDatabaseR2Backup } = require('../controllers/backup.controller');
const logger = require('../config/logger');

let backupInterval = null;

/**
 * Initialize automatic daily database backup scheduler
 * Runs once every 24 hours (86,400,000 ms)
 */
function startDbBackupScheduler() {
  if (backupInterval) return;

  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  // Run initial background backup 2 minutes after server startup
  setTimeout(() => {
    logger.info('[R2 DB Backup] Running initial database backup to Cloudflare R2...');
    performDatabaseR2Backup()
      .then((res) => {
        logger.info(`[R2 DB Backup] Initial backup successful: ${res.publicUrl} (${res.sizeBytes} bytes)`);
      })
      .catch((err) => {
        logger.error(`[R2 DB Backup] Initial backup failed: ${err.message}`);
      });
  }, 2 * 60 * 1000);

  // Repeat every 24 hours
  backupInterval = setInterval(() => {
    logger.info('[R2 DB Backup] Starting scheduled daily database backup to Cloudflare R2...');
    performDatabaseR2Backup()
      .then((res) => {
        logger.info(`[R2 DB Backup] Daily backup successful: ${res.publicUrl} (${res.sizeBytes} bytes)`);
      })
      .catch((err) => {
        logger.error(`[R2 DB Backup] Daily backup failed: ${err.message}`);
      });
  }, TWENTY_FOUR_HOURS);

  logger.info('[R2 DB Backup] Daily database backup scheduler initialized.');
}

module.exports = {
  startDbBackupScheduler,
};
