/**
 * Scheduler: Automated Multi-Cloud Infrastructure Billing & Metrics Sync
 *
 * COST-PROTECTION MODE:
 * Paid AWS Cost Explorer API calls are strictly MANUAL-ONLY (triggered only when
 * an admin clicks the Sync button AND 24 hours have elapsed since the last sync).
 * Background/startup auto-firing is intentionally disabled to keep AWS Cost Explorer
 * fees at $0.00/day.
 */

const logger = require('../config/logger');

function startInfrastructureBillingScheduler() {
  logger.info('[Scheduler] AWS Cost Explorer auto-sync disabled (manual button + 24h cooldown mode active).');
}

module.exports = {
  startInfrastructureBillingScheduler,
};
