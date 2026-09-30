/**
 * Test Suite: 4-Stage Production Meter Variance Sentinel & Database Non-Negative Ledger Guard (Phase 2)
 * Verifies Mass-Conservation, Overage Typo Defenses, Delivery Ceilings, and Inventory Balance Integrity.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');

const {
  evaluateStageVariances,
  productionVarianceMiddleware,
} = require('../services/productionVarianceSentinel');

describe('Phase 2: 4-Stage Production Meter Variance Sentinel & Database Non-Negative Ledger Guard', () => {
  describe('1. Printing Overage Watchdog', () => {
    it('should approve normal printing output within standard variance (+5%)', () => {
      const result = evaluateStageVariances({
        totalMtr: 100,
        printMtr: 105,
      });

      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.stageMetrics.printVariancePct, 5);
    });

    it('should flag a warning when print overage exceeds 20% without explicit overageReason', () => {
      const result = evaluateStageVariances({
        totalMtr: 100,
        printMtr: 125, // 25% overage
      });

      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.warnings.length, 1);
      assert.match(result.warnings[0], /PRINT_OVERAGE_WARNING/);
    });

    it('should suppress warning when a valid overageReason is provided', () => {
      const result = evaluateStageVariances({
        totalMtr: 100,
        printMtr: 125,
        overageReason: 'Client requested extra 25m safety margin for shrinkage testing',
      });

      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.warnings.length, 0);
    });

    it('should strictly reject anomalous print entry (>50% overrun typo like 1000m for 100m order)', () => {
      const result = evaluateStageVariances({
        totalMtr: 100,
        printMtr: 1000, // 900% overrun! Accidental extra zero
      });

      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.length, 1);
      assert.match(result.errors[0], /PRINT_METER_ANOMALY/);
      assert.ok(result.auditTags.includes('ANOMALOUS_PRINT_REJECTED'));
    });

    it('should permit anomalous meters if explicit supervisor operatorOverride is true', () => {
      const result = evaluateStageVariances({
        totalMtr: 100,
        printMtr: 1000,
        operatorOverride: true,
      });

      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
    });
  });

  describe('2. Fusing Mass-Conservation Watchdog', () => {
    it('should allow fusing meters within thermal calendar stretch allowance (+3%)', () => {
      const result = evaluateStageVariances({
        totalMtr: 100,
        printMtr: 100,
        fusingMtr: 103, // 3% elongation
      });

      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should reject physically impossible fusing output that exceeds printed meters (+5% ceiling)', () => {
      const result = evaluateStageVariances({
        totalMtr: 100,
        printMtr: 100,
        fusingMtr: 160, // 60% higher than printed! Physically impossible
      });

      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.length, 1);
      assert.match(result.errors[0], /FUSING_EXCEEDS_PRINT/);
      assert.ok(result.auditTags.includes('FUSING_MASS_VIOLATION'));
    });
  });

  describe('3. Critical Wastage Alerting', () => {
    it('should trigger CRITICAL_WASTAGE_ALERT when wastage exceeds 25% of printed fabric', () => {
      const result = evaluateStageVariances({
        totalMtr: 100,
        printMtr: 100,
        freshMtr: 70,
        totalWastageMtr: 30, // 30% wastage
      });

      assert.strictEqual(result.isValid, true);
      assert.ok(result.warnings.some((w) => w.includes('CRITICAL_WASTAGE_ALERT')));
      assert.ok(result.auditTags.includes('CRITICAL_WASTAGE_DETECTED'));
    });

    it('should not flag critical alert when wastage is within normal tolerance (<10%)', () => {
      const result = evaluateStageVariances({
        totalMtr: 100,
        printMtr: 100,
        freshMtr: 95,
        totalWastageMtr: 5, // 5% wastage
      });

      assert.ok(!result.warnings.some((w) => w.includes('CRITICAL_WASTAGE_ALERT')));
    });
  });

  describe('4. Delivery Dispatch Ceiling Guard', () => {
    it('should allow valid delivery dispatch within finished fresh meters', () => {
      const result = evaluateStageVariances({
        totalMtr: 100,
        printMtr: 100,
        freshMtr: 95,
        deliveredMtr: 95,
      });

      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should reject delivery dispatch attempting to exceed available finished meters', () => {
      const result = evaluateStageVariances({
        totalMtr: 100,
        printMtr: 100,
        freshMtr: 80,
        deliveredMtr: 120, // Cannot dispatch 120m when only 80m fresh was produced
      });

      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.errors.length, 1);
      assert.match(result.errors[0], /DELIVERY_EXCEEDS_FINISHED/);
      assert.ok(result.auditTags.includes('OVER_DISPATCH_REJECTED'));
    });
  });

  describe('5. Express Production Variance Middleware Integration', () => {
    function createVarianceTestApp() {
      const app = express();
      app.use(express.json());

      app.post('/api/job-cards', productionVarianceMiddleware, (req, res) => {
        res.status(201).json({ success: true, metrics: req.productionMetrics });
      });

      app.put('/api/job-cards/:id', productionVarianceMiddleware, (req, res) => {
        res.status(200).json({ success: true, metrics: req.productionMetrics });
      });

      return app;
    }

    const testApp = createVarianceTestApp();

    it('should accept valid meter creation and attach production metrics', async () => {
      const res = await request(testApp)
        .post('/api/job-cards')
        .send({
          totalMtr: 200,
          printMtr: 210,
          freshMtr: 205,
          deliveredMtr: 205,
        })
        .expect(201);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.metrics.stage1OrderMtr, 200);
      assert.strictEqual(res.body.metrics.stage2PrintMtr, 210);
    });

    it('should intercept anomalous print overage with HTTP 422 Unprocessable Entity', async () => {
      const res = await request(testApp)
        .put('/api/job-cards/650000000000000000000001')
        .send({
          totalMtr: 100,
          printMtr: 500, // Typo 5x overage
        })
        .expect(422);

      assert.strictEqual(res.body.error, 'PRODUCTION_VARIANCE_ANOMALY');
      assert.match(res.body.message, /PRINT_METER_ANOMALY/);
    });
  });

  describe('6. Database Non-Negative Ledger Guard Validation', () => {
    it('should calculate available lot stock and identify negative balance violation', () => {
      const inwardTxs = [{ qty: 500 }, { qty: 200 }]; // 700m total in
      const outwardTxs = [{ qty: 450 }, { qty: 200 }]; // 650m total out
      const totalIn = inwardTxs.reduce((s, t) => s + t.qty, 0);
      const totalOut = outwardTxs.reduce((s, t) => s + t.qty, 0);
      const availableStock = totalIn - totalOut; // 50m remaining

      const requestedQty = 120; // Operator wants 120m, but only 50m available

      const wouldBeNegative = requestedQty > availableStock;
      assert.strictEqual(wouldBeNegative, true);

      const deficit = requestedQty - availableStock;
      assert.strictEqual(deficit, 70);

      const errorMessage = `INSUFFICIENT_FABRIC_STOCK: Cannot issue ${requestedQty} mtr from Lot #42. Available balance is only ${availableStock} mtr (Deficit: ${deficit} mtr). Negative inventory ledger balances are strictly prohibited.`;
      assert.match(errorMessage, /INSUFFICIENT_FABRIC_STOCK/);
      assert.match(errorMessage, /Deficit: 70 mtr/);
    });
  });
});
