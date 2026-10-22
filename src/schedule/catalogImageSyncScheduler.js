/**
 * Scheduler: Automated Off-Peak Catalog & Image Auto-Sync
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs every night at 2:45 AM IST (off-peak, near-zero server load) to:
 * - Identify any products missing image/photos and fetch them from Uniware.
 * - Find any new products added to Uniware and save them into the Product Catalog.
 */

const cron = require('node-cron');
const logger = require('../config/logger');
const { runCatalogAndImageSync } = require('../services/catalogImageSync.service');

function startCatalogImageSyncScheduler() {
  // Run daily at 02:45 AM IST (Asia/Kolkata) when business operations are idle
  cron.schedule(
    '45 2 * * *',
    async () => {
      logger.info('[Scheduler] 🌙 Off-peak catalog & image auto-sync starting (02:45 AM IST)...');
      try {
        const result = await runCatalogAndImageSync({ triggerSource: 'DAILY_CRON' });
        logger.info('[Scheduler] 🌙 Off-peak catalog sync finished: %o', result);
      } catch (err) {
        logger.error('[Scheduler] ❌ Error in off-peak catalog sync: %o', err);
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Kolkata',
    }
  );

  console.log('[Scheduler] 🌙 Automated Daily Catalog & Image Sync registered (02:45 AM IST, Asia/Kolkata).');
}

module.exports = {
  startCatalogImageSyncScheduler,
};
