/**
 * Scheduler: Automated 8:00 PM End-of-Day (EOD) Executive Intelligence Briefing
 *
 * Runs nightly at 20:00 (8:00 PM) Indian Standard Time (IST / Asia/Kolkata)
 */

const cron = require('node-cron');
const { runScheduledEodBriefing } = require('../services/eodIntelligence.service');

function startEodExecutiveBriefingScheduler() {
  // Cron syntax: 0 20 * * * = At 20:00 (8:00 PM) every day
  cron.schedule(
    '0 20 * * *',
    async () => {
      await runScheduledEodBriefing();
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  console.log('[Scheduler] 8:00 PM EOD Executive Intelligence Briefing registered (Asia/Kolkata).');
}

module.exports = {
  startEodExecutiveBriefingScheduler,
};
