const { performBackup } = require('../scripts/backup_mongodb');
const logger = require('../config/logger');

let backupTimeout = null;

/**
 * Calculate exact milliseconds until the next 12:00 AM midnight in Asia/Kolkata (IST)
 */
function getMsUntilMidnightIST() {
  const now = new Date();
  const kolkataStr = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const kolkataDate = new Date(kolkataStr);
  const nextMidnight = new Date(kolkataDate);
  nextMidnight.setHours(24, 0, 0, 0); // 00:00:00 next day IST
  const diff = nextMidnight.getTime() - kolkataDate.getTime();
  return diff > 0 ? diff : 24 * 60 * 60 * 1000;
}

function scheduleMidnightBackup() {
  const msUntilMidnight = getMsUntilMidnightIST();
  const hoursUntil = (msUntilMidnight / (1000 * 60 * 60)).toFixed(2);
  logger.info(`[Automated Midnight Backup] Next daily automated multi-cloud backup scheduled in ${hoursUntil} hours (12:00 AM Midnight IST).`);

  backupTimeout = setTimeout(async () => {
    logger.info('[Automated Midnight Backup] 🕛 12:00 AM Midnight IST arrived! Executing full database and images backup...');
    try {
      const res = await performBackup();
      logger.info(`[Automated Midnight Backup] ✅ Midnight backup successful: DB=${res.fileName} (${res.sizeMB} MB), Images=${res.imagesBackup?.fileName || 'N/A'}`);
    } catch (err) {
      logger.error(`[Automated Midnight Backup] ❌ Midnight backup failed: ${err.message}`);
    }
    // Schedule for following midnight
    scheduleMidnightBackup();
  }, msUntilMidnight);
}

/**
 * Initialize automatic daily database & images backup scheduler
 * Runs precisely at 12:00 AM midnight IST (00:00 IST) every day
 */
function startDbBackupScheduler() {
  scheduleMidnightBackup();
  logger.info('[Automated DB Backup] Midnight 12:00 AM IST scheduler active with auto-email delivery.');
}

module.exports = {
  startDbBackupScheduler,
};

