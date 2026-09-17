const { performBackup } = require('../scripts/backup_mongodb');
const logger = require('../config/logger');

let backupInterval = null;

/**
 * Initialize automatic daily database backup scheduler (local 30-day retention + cloud sync)
 * Runs once every 24 hours (86,400,000 ms)
 */
function startDbBackupScheduler() {
  if (backupInterval) return;

  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  // Run initial background backup 2 minutes after server startup
  setTimeout(() => {
    logger.info('[Automated DB Backup] Running initial database backup...');
    performBackup()
      .then((res) => {
        logger.info(`[Automated DB Backup] Initial backup successful: ${res.fileName} (${res.sizeMB} MB)`);
      })
      .catch((err) => {
        logger.error(`[Automated DB Backup] Initial backup failed: ${err.message}`);
      });
  }, 2 * 60 * 1000);

  // Repeat every 24 hours
  backupInterval = setInterval(() => {
    logger.info('[Automated DB Backup] Starting scheduled daily multi-destination backup...');
    performBackup()
      .then((res) => {
        logger.info(`[Automated DB Backup] Daily backup successful: ${res.fileName} (${res.sizeMB} MB)`);
      })
      .catch((err) => {
        logger.error(`[Automated DB Backup] Daily backup failed: ${err.message}`);
      });
  }, TWENTY_FOUR_HOURS);

  logger.info('[Automated DB Backup] Daily multi-destination backup scheduler initialized.');
}

module.exports = {
  startDbBackupScheduler,
};

