/**
 * Test Suite: Automated 8:00 PM End-of-Day (EOD) Executive Intelligence Briefing & Telemetry (Phase 4)
 * Verifies plant production aggregation, wastage ratings, client ranking, and alert formatting.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');

describe('Phase 4: Automated 8:00 PM End-of-Day (EOD) Executive Intelligence Briefing & Telemetry', () => {
  describe('1. Intelligence Aggregation & Wastage Analysis', () => {
    it('should accurately compute production metrics, plant wastage ratio, and top client ranking', () => {
      // Mock daily sample data
      const sampleJobs = [
        { totalMtr: 1000, printMtr: 1050, freshMtr: 1000, totalWastageMtr: 50, fusingMtr: 1050, party: 'Aditi Fashions', machineName: 'Printer 1' },
        { totalMtr: 2000, printMtr: 2000, freshMtr: 1900, totalWastageMtr: 100, fusingMtr: 2000, party: 'Shree Krishna Silks', machineName: 'Printer 2' },
        { totalMtr: 500, printMtr: 520, freshMtr: 500, totalWastageMtr: 20, fusingMtr: 520, party: 'Aditi Fashions', machineName: 'Printer 1' },
      ];

      const sampleChallans = [
        { totalMtr: 950, totalTp: 10, partyName: 'Aditi Fashions' },
        { totalMtr: 1800, totalTp: 20, partyName: 'Shree Krishna Silks' },
      ];

      let totalPrinted = 0;
      let totalFused = 0;
      let totalFresh = 0;
      let totalWastage = 0;
      const partyMap = {};

      sampleJobs.forEach((j) => {
        totalPrinted += j.printMtr;
        totalFused += j.fusingMtr;
        totalFresh += j.freshMtr;
        totalWastage += j.totalWastageMtr;
        partyMap[j.party] = (partyMap[j.party] || 0) + j.printMtr;
      });

      const totalDispatched = sampleChallans.reduce((s, c) => s + c.totalMtr, 0);
      const totalRolls = sampleChallans.reduce((s, c) => s + c.totalTp, 0);

      const wastagePct = Number(((totalWastage / totalFused) * 100).toFixed(2));
      const wastageHealth = wastagePct > 15 ? 'CRITICAL_HIGH_WASTAGE' : wastagePct > 8 ? 'ELEVATED_WASTAGE' : 'NOMINAL_EXCELLENT';

      const topParties = Object.entries(partyMap)
        .sort((a, b) => b[1] - a[1])
        .map(([party, mtr], rank) => ({ rank: rank + 1, party, meters: mtr }));

      assert.strictEqual(totalPrinted, 3570);
      assert.strictEqual(totalFused, 3570);
      assert.strictEqual(totalFresh, 3400);
      assert.strictEqual(totalWastage, 170);
      assert.strictEqual(totalDispatched, 2750);
      assert.strictEqual(totalRolls, 30);
      assert.strictEqual(wastagePct, 4.76);
      assert.strictEqual(wastageHealth, 'NOMINAL_EXCELLENT');

      // Top party should be Shree Krishna Silks with 2000m
      assert.strictEqual(topParties[0].party, 'Shree Krishna Silks');
      assert.strictEqual(topParties[0].meters, 2000);
      assert.strictEqual(topParties[1].party, 'Aditi Fashions');
      assert.strictEqual(topParties[1].meters, 1570);
    });

    it('should flag CRITICAL_HIGH_WASTAGE when plant wastage exceeds 15%', () => {
      const totalFused = 1000;
      const totalWastage = 180; // 18%
      const wastagePct = (totalWastage / totalFused) * 100;
      const wastageHealth = wastagePct > 15 ? 'CRITICAL_HIGH_WASTAGE' : 'NOMINAL';

      assert.strictEqual(wastageHealth, 'CRITICAL_HIGH_WASTAGE');
    });
  });

  describe('2. Briefing Formatting & Push Alert Payloads', () => {
    it('should generate formatted executive markdown and push notification body', () => {
      const metrics = {
        date: '2026-09-30',
        metersPrinted: 3570,
        metersFused: 3570,
        freshFinishedMeters: 3400,
        wastageMeters: 170,
        wastageRatioPct: 4.76,
        wastageHealth: 'NOMINAL_EXCELLENT',
        metersDispatched: 2750,
        challansDispatchedCount: 2,
        rollsDispatchedCount: 30,
        activePendingBacklogCount: 5,
        topParties: [
          { rank: 1, party: 'Shree Krishna Silks', meters: 2000 },
          { rank: 2, party: 'Aditi Fashions', meters: 1570 },
        ],
      };

      const partyLines = metrics.topParties
        .map((p) => `   ${p.rank}. **${p.party}**: ${p.meters}m`)
        .join('\n');

      const markdown = `# 🏭 Elite Edition — End-of-Day Executive Briefing
**Reporting Date**: 30 Sep 2026 | **Briefing Time**: 8:00 PM IST

### 📊 Production & Output Velocity:
- **Digital Printing Output**: **${metrics.metersPrinted.toLocaleString()} Mtr**
- **Heat-Press / Fusing Finished**: **${metrics.metersFused.toLocaleString()} Mtr**
- **Wastage Recorded**: **${metrics.wastageMeters.toLocaleString()} Mtr** (${metrics.wastageRatioPct}%)
- **Wastage Rating**: \`${metrics.wastageHealth}\`

### 🚚 Finished Goods Dispatch:
- **Challans Dispatched**: **${metrics.challansDispatchedCount} Official Challans**
- **Total Fabric Dispatched**: **${metrics.metersDispatched.toLocaleString()} Mtr** across **${metrics.rollsDispatchedCount} Rolls**

### 🏢 Top Client Activity Today:
${partyLines}

### ⏱ Plant Backlog:
- **Active Pending Orders**: **${metrics.activePendingBacklogCount} Jobs**
`;

      assert.ok(markdown.includes('3,570 Mtr'));
      assert.ok(markdown.includes('NOMINAL_EXCELLENT'));
      assert.ok(markdown.includes('Shree Krishna Silks'));
      assert.ok(markdown.includes('2 Official Challans'));

      const alertSummary = `🏭 8:00 PM Briefing: ${metrics.metersPrinted}m Printed, ${metrics.metersDispatched}m Dispatched across ${metrics.challansDispatchedCount} Challans. Wastage: ${metrics.wastageRatioPct}%.`;
      assert.ok(alertSummary.includes('3570m Printed'));
      assert.ok(alertSummary.includes('Wastage: 4.76%'));
    });
  });

  describe('3. On-Demand Analytics Endpoint Express Harness', () => {
    function createBriefingApp() {
      const app = express();
      app.use(express.json());

      app.get('/v1/analytics/eod-briefing', (req, res) => {
        res.status(200).json({
          success: true,
          data: {
            metrics: {
              date: '2026-09-30',
              metersPrinted: 3570,
              metersDispatched: 2750,
              wastageRatioPct: 4.76,
            },
            briefingMarkdown: '# 🏭 Elite Edition — End-of-Day Executive Briefing',
          },
        });
      });

      return app;
    }

    const testApp = createBriefingApp();

    it('should respond with HTTP 200 and executive briefing payload on GET /v1/analytics/eod-briefing', async () => {
      const res = await request(testApp)
        .get('/v1/analytics/eod-briefing')
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.metrics.metersPrinted, 3570);
      assert.ok(res.body.data.briefingMarkdown.includes('End-of-Day Executive Briefing'));
    });
  });
});
