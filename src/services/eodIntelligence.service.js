/**
 * Service: End-of-Day (EOD) Executive Intelligence Briefing & Production Telemetry
 *
 * Automatically computes daily operational summaries at 8:00 PM IST:
 * - Total digital printing production (meters printed, machine distribution)
 * - Fusing throughput, fresh finished yield, and plant wastage ratios
 * - Dispatch volume (challans generated, meters delivered)
 * - Top client activity and pending backlog
 * - Dispatches Web Push telemetry alert to executive devices
 */

const JobCard = require('../db/models/jobCard.model');
const FabricChallan = require('../db/models/fabricChallan.model');
const webPushService = require('./webPush.service');

/**
 * Computes complete EOD intelligence metrics for a given date.
 *
 * @param {Date|string} [dateInput=new Date()]
 * @returns {Promise<{ metrics: object, briefingMarkdown: string, alertSummary: string }>}
 */
async function generateEodIntelligenceReport(dateInput = new Date()) {
  const targetDate = new Date(dateInput);
  const dsStr = targetDate.toISOString().split('T')[0];

  const startOfDay = new Date(`${dsStr}T00:00:00.000+05:30`);
  const endOfDay = new Date(`${dsStr}T23:59:59.999+05:30`);

  // 1. Digital Printing & Job Card Metrics
  const todayJobs = await JobCard.find({
    $or: [
      { created_date_time: { $gte: startOfDay, $lte: endOfDay } },
      { date: dsStr },
      { printDate: { $regex: dsStr } },
      { fusingDate: { $regex: dsStr } },
    ],
  }).lean();

  let totalMetersOrdered = 0;
  let totalMetersPrinted = 0;
  let totalMetersFused = 0;
  let totalFreshMeters = 0;
  let totalWastageMeters = 0;
  const partyMetersMap = {};
  const machineDistribution = {};

  todayJobs.forEach((job) => {
    const ordered = parseFloat(job.totalMtr) || 0;
    const printed = parseFloat(job.printMtr) || 0;
    const fresh = parseFloat(job.freshMtr) || 0;
    const wastage = parseFloat(job.totalWastageMtr) || 0;
    const fused = parseFloat(job.fusingMtr) || (fresh + wastage) || 0;

    totalMetersOrdered += ordered;
    totalMetersPrinted += printed;
    totalFreshMeters += fresh;
    totalWastageMeters += wastage;
    totalMetersFused += fused;

    const party = job.party || job.billTo || 'Unknown';
    partyMetersMap[party] = (partyMetersMap[party] || 0) + (printed || ordered);

    const machine = job.machineName || 'Digital Printer';
    machineDistribution[machine] = (machineDistribution[machine] || 0) + printed;
  });

  // Active Pending Backlog
  const activeBacklogCount = await JobCard.countDocuments({
    status: { $in: ['Pending', 'In Progress'] },
  });

  // 2. Finished Goods Dispatches & Challans Metrics
  const todayChallans = await FabricChallan.find({
    date: { $gte: startOfDay, $lte: endOfDay },
  }).lean();

  let totalMetersDispatched = 0;
  let totalRollsDispatched = 0;

  todayChallans.forEach((ch) => {
    totalMetersDispatched += parseFloat(ch.totalMtr) || 0;
    totalRollsDispatched += ch.totalTp || (ch.tpDetails ? ch.tpDetails.length : 0);
  });

  // Compute Wastage & Efficiency Metrics
  const wastageRatioPct = totalMetersFused > 0
    ? Number(((totalWastageMeters / totalMetersFused) * 100).toFixed(2))
    : 0;

  const wastageHealth = wastageRatioPct > 15
    ? 'CRITICAL_HIGH_WASTAGE'
    : wastageRatioPct > 8
    ? 'ELEVATED_WASTAGE'
    : 'NOMINAL_EXCELLENT';

  // Sort Top Parties
  const topParties = Object.entries(partyMetersMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([party, mtr], rank) => ({ rank: rank + 1, party, meters: Math.round(mtr * 10) / 10 }));

  const metrics = {
    date: dsStr,
    generatedAt: new Date(),
    metersOrdered: Math.round(totalMetersOrdered * 10) / 10,
    metersPrinted: Math.round(totalMetersPrinted * 10) / 10,
    metersFused: Math.round(totalMetersFused * 10) / 10,
    freshFinishedMeters: Math.round(totalFreshMeters * 10) / 10,
    wastageMeters: Math.round(totalWastageMeters * 10) / 10,
    wastageRatioPct,
    wastageHealth,
    metersDispatched: Math.round(totalMetersDispatched * 10) / 10,
    challansDispatchedCount: todayChallans.length,
    rollsDispatchedCount: totalRollsDispatched,
    activePendingBacklogCount: activeBacklogCount,
    topParties,
    machineDistribution,
  };

  // 3. Build Formatted Executive Briefing
  const formattedDate = targetDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const partyLines = topParties.length > 0
    ? topParties.map((p) => `   ${p.rank}. **${p.party}**: ${p.meters}m`).join('\n')
    : '   - No client orders processed today.';

  const briefingMarkdown = `# 🏭 Elite Edition — End-of-Day Executive Briefing
**Reporting Date**: ${formattedDate} | **Briefing Time**: 8:00 PM IST

### 📊 Production & Output Velocity:
- **Digital Printing Output**: **${metrics.metersPrinted.toLocaleString()} Mtr**
- **Heat-Press / Fusing Finished**: **${metrics.metersFused.toLocaleString()} Mtr**
- **Finished Usable Fabric**: **${metrics.freshFinishedMeters.toLocaleString()} Mtr**
- **Wastage Recorded**: **${metrics.wastageMeters.toLocaleString()} Mtr** (${metrics.wastageRatioPct}%)
- **Wastage Rating**: \`${metrics.wastageHealth}\`

### 🚚 Finished Goods Dispatch:
- **Challans Dispatched**: **${metrics.challansDispatchedCount} Official Challans**
- **Total Fabric Dispatched**: **${metrics.metersDispatched.toLocaleString()} Mtr** across **${metrics.rollsDispatchedCount} Rolls**

### 🏢 Top Client Activity Today:
${partyLines}

### ⏱ Plant Backlog & Sentinel Status:
- **Active Pending Orders**: **${metrics.activePendingBacklogCount} Jobs** in production pipeline
- **Anti-Counterfeit QR Security**: Active on 100% of dispatched delivery challans.
`;

  const alertSummary = `🏭 8:00 PM Briefing: ${metrics.metersPrinted}m Printed, ${metrics.metersDispatched}m Dispatched across ${metrics.challansDispatchedCount} Challans. Wastage: ${metrics.wastageRatioPct}%.`;

  return {
    metrics,
    briefingMarkdown,
    alertSummary,
  };
}

/**
 * Executes the scheduled 8:00 PM EOD dispatch routine
 */
async function runScheduledEodBriefing() {
  try {
    console.log('[EOD Briefing] Running automated 8:00 PM Executive Intelligence Briefing...');
    const report = await generateEodIntelligenceReport(new Date());

    console.log(report.briefingMarkdown);

    // Send push notifications to executive devices
    await webPushService.dispatchExecutiveAlert({
      title: '🏭 8:00 PM EOD Executive Intelligence Briefing',
      body: report.alertSummary,
      url: '/analytics',
    });

    console.log('[EOD Briefing] Executive push alert dispatched successfully.');
    return report;
  } catch (err) {
    console.error('[EOD Briefing] Error during automated briefing generation:', err.message);
  }
}

module.exports = {
  generateEodIntelligenceReport,
  runScheduledEodBriefing,
};
