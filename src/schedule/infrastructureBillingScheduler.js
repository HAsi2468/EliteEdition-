/**
 * Scheduler: Automated Multi-Cloud Infrastructure Billing & Metrics Sync
 * 
 * Periodically synchronizes live metrics, Month-to-Date spend, and usage data
 * across AWS Cloud, MongoDB Atlas, and Cloudflare R2 into the ERP database.
 * 
 * Schedule:
 * - Runs every 6 hours (00:00, 06:00, 12:00, 18:00 IST)
 * - Also runs on service boot (with a 30s grace period)
 */

const cron = require('node-cron');
const logger = require('../config/logger');
const { performAllProvidersSync } = require('../controllers/infrastructureController');

function startInfrastructureBillingScheduler() {
  // Cron syntax: 0 */6 * * * = Every 6 hours at minute 0
  cron.schedule(
    '0 */6 * * *',
    async () => {
      try {
        logger.info('[Scheduler] Running automated multi-cloud infrastructure billing sync...');
        const bill = await performAllProvidersSync();
        logger.info(`[Scheduler] Multi-cloud sync completed successfully for ${bill.month} (AWS: ₹${bill.awsAmount}, Mongo: ₹${bill.mongoDbAmount}, R2: ₹${bill.cloudflareAmount})`);
      } catch (err) {
        logger.error('[Scheduler] Error in automated multi-cloud billing sync: %o', err);
      }
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  console.log('[Scheduler] Multi-Cloud Infrastructure Auto-Sync registered (Every 6 hours, Asia/Kolkata).');

  // Also trigger a background sync 30 seconds after server start
  setTimeout(async () => {
    try {
      logger.info('[Startup Sync] Initializing multi-cloud infrastructure billing snapshot...');
      const bill = await performAllProvidersSync();
      logger.info(`[Startup Sync] Initialized cloud billing snapshot for ${bill.month}.`);
    } catch (err) {
      logger.warn(`[Startup Sync] Initial multi-cloud sync notice: ${err.message}`);
    }
  }, 30000);
}

module.exports = {
  startInfrastructureBillingScheduler,
};
