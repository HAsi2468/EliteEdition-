/**
 * 4-Stage Production Meter Variance Sentinel
 *
 * Implements end-to-end mass conservation and variance guardrails across the 4 key stages
 * of textile digital printing and finishing:
 *
 * Stage 1: Order Allocation (totalMtr)
 * Stage 2: Digital Printing (printMtr)
 * Stage 3: Heat-Press / Fusing (fusingMtr, freshMtr, totalWastageMtr)
 * Stage 4: Finished Delivery & Dispatch (deliveredMtr)
 *
 * Enforces:
 * 1. Print Overage Watchdog: Blocks extreme accidental meter entry (e.g. 1000m instead of 100m)
 * 2. Fusing Mass-Conservation: Prohibits fusing output from exceeding printed meters (+ thermal stretch allowance)
 * 3. Delivery Ceiling Guard: Prevents dispatching more finished meters than produced
 * 4. Critical Wastage Alerting: Auto-tags audit logs when wastage exceeds 25%
 */

const httpStatus = require('http-status').default;

const MAX_PRINT_OVERAGE_RATIO = 1.20;       // Up to 20% overage acceptable in normal operation
const ANOMALOUS_PRINT_OVERAGE_RATIO = 1.50; // >50% overage is flagged as an input anomaly/typo
const THERMAL_STRETCH_ALLOWANCE = 1.05;     // 5% max physical elongation during thermal calendar pressing
const CRITICAL_WASTAGE_RATIO = 0.25;        // 25% wastage triggers critical management alert

/**
 * Evaluates production metrics across all 4 manufacturing stages.
 *
 * @param {object} params
 * @param {number|string} params.totalMtr - Stage 1: Allocated order meters
 * @param {number|string} [params.printMtr] - Stage 2: Printed meters
 * @param {number|string} [params.fusingMtr] - Stage 3: Total fusing meters
 * @param {number|string} [params.freshMtr] - Stage 3: Usable fresh meters
 * @param {number|string} [params.totalWastageMtr] - Stage 3: Wastage meters
 * @param {number|string} [params.deliveredMtr] - Stage 4: Delivered meters
 * @param {string} [params.overageReason] - Reason for abnormal print overage
 * @param {boolean} [params.operatorOverride] - Authorized manager override flag
 * @returns {{ isValid: boolean, errors: string[], warnings: string[], stageMetrics: object, auditTags: string[] }}
 */
function evaluateStageVariances({
  totalMtr,
  printMtr,
  fusingMtr,
  freshMtr,
  totalWastageMtr,
  deliveredMtr,
  overageReason = '',
  operatorOverride = false,
}) {
  const errors = [];
  const warnings = [];
  const auditTags = [];

  const stage1 = Math.max(0, parseFloat(totalMtr) || 0);
  const stage2 = Math.max(0, parseFloat(printMtr) || 0);
  const stage3Fresh = Math.max(0, parseFloat(freshMtr) || 0);
  const stage3Wastage = Math.max(0, parseFloat(totalWastageMtr) || 0);
  const stage3Total = Math.max(0, parseFloat(fusingMtr) || (stage3Fresh + stage3Wastage) || 0);
  const stage4 = Math.max(0, parseFloat(deliveredMtr) || 0);

  // ── Stage 1 -> Stage 2: Printing Overage Watchdog ──
  if (stage1 > 0 && stage2 > 0) {
    const ratio = stage2 / stage1;
    if (ratio > ANOMALOUS_PRINT_OVERAGE_RATIO && !operatorOverride) {
      errors.push(
        `PRINT_METER_ANOMALY: Printed meters (${stage2}m) exceed order meters (${stage1}m) by ${Math.round((ratio - 1) * 100)}%. Over 50% overage indicates an input typo or unauthorized print overrun.`
      );
      auditTags.push('ANOMALOUS_PRINT_REJECTED');
    } else if (ratio > MAX_PRINT_OVERAGE_RATIO && !overageReason && !operatorOverride) {
      warnings.push(
        `PRINT_OVERAGE_WARNING: Printed meters (${stage2}m) exceed order (${stage1}m) by ${Math.round((ratio - 1) * 100)}%. Please provide an overageReason or obtain supervisor approval.`
      );
      auditTags.push('PRINT_OVERAGE_WARNED');
    }
  }

  // ── Stage 2 -> Stage 3: Fusing Mass-Conservation Watchdog ──
  if (stage2 > 0 && stage3Total > 0) {
    const maxPermittedFusing = stage2 * THERMAL_STRETCH_ALLOWANCE + 0.5; // with 0.5m tolerance
    if (stage3Total > maxPermittedFusing && !operatorOverride) {
      errors.push(
        `FUSING_EXCEEDS_PRINT: Fusing output (${stage3Total}m) cannot physically exceed printed meters (${stage2}m + 5% thermal stretch ceiling = ${maxPermittedFusing.toFixed(1)}m). Check entered meters.`
      );
      auditTags.push('FUSING_MASS_VIOLATION');
    }
  }

  // ── Stage 3: Critical Wastage Alerting ──
  if (stage2 > 0 && stage3Wastage > 0) {
    const wastageRatio = stage3Wastage / stage2;
    if (wastageRatio > CRITICAL_WASTAGE_RATIO) {
      warnings.push(
        `CRITICAL_WASTAGE_ALERT: Wastage of ${stage3Wastage}m represents ${(wastageRatio * 100).toFixed(1)}% of printed fabric (Threshold: ${CRITICAL_WASTAGE_RATIO * 100}%). Review fabric faults and machine tension.`
      );
      auditTags.push('CRITICAL_WASTAGE_DETECTED');
    }
  }

  // ── Stage 3 -> Stage 4: Delivery Dispatch Ceiling Guard ──
  const finishedFinishedCeiling = stage3Fresh > 0 ? stage3Fresh : (stage3Total > 0 ? stage3Total : stage2);
  if (finishedFinishedCeiling > 0 && stage4 > 0) {
    const maxPermittedDelivery = finishedFinishedCeiling * 1.02 + 0.5; // 2% tolerance
    if (stage4 > maxPermittedDelivery && !operatorOverride) {
      errors.push(
        `DELIVERY_EXCEEDS_FINISHED: Dispatched delivery meters (${stage4}m) exceed available finished fabric (${finishedFinishedCeiling.toFixed(1)}m). Cannot dispatch nonexistent fabric.`
      );
      auditTags.push('OVER_DISPATCH_REJECTED');
    }
  }

  const printVariancePct = stage1 > 0 && stage2 > 0 ? Number(((stage2 - stage1) / stage1 * 100).toFixed(2)) : 0;
  const fusingYieldPct = stage2 > 0 && stage3Total > 0 ? Number((stage3Total / stage2 * 100).toFixed(2)) : 0;
  const wastagePct = stage2 > 0 && stage3Wastage > 0 ? Number((stage3Wastage / stage2 * 100).toFixed(2)) : 0;
  const deliveryYieldPct = stage1 > 0 && stage4 > 0 ? Number((stage4 / stage1 * 100).toFixed(2)) : 0;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stageMetrics: {
      stage1OrderMtr: stage1,
      stage2PrintMtr: stage2,
      stage3FusingMtr: stage3Total,
      stage3FreshMtr: stage3Fresh,
      stage3WastageMtr: stage3Wastage,
      stage4DeliveredMtr: stage4,
      printVariancePct,
      fusingYieldPct,
      wastagePct,
      deliveryYieldPct,
    },
    auditTags,
  };
}

/**
 * Express Middleware: Production Meter Variance Sentinel
 * Inspects incoming job card update payloads and rejects anomalous meter inputs.
 */
function productionVarianceMiddleware(req, res, next) {
  // Only evaluate update requests containing meter changes
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
    return next();
  }

  const body = req.body || {};
  const hasMeterData =
    body.printMtr !== undefined ||
    body.fusingMtr !== undefined ||
    body.freshMtr !== undefined ||
    body.totalWastageMtr !== undefined ||
    body.deliveredMtr !== undefined ||
    body.deliveryMtr !== undefined;

  if (!hasMeterData) {
    return next();
  }

  // If updating existing job card, retrieve base card from db or req.verifiedDocument
  const existingDoc = req.verifiedDocument || {};
  const totalMtr = body.totalMtr || existingDoc.totalMtr || 0;
  const printMtr = body.printMtr !== undefined ? body.printMtr : existingDoc.printMtr;
  const fusingMtr = body.fusingMtr !== undefined ? body.fusingMtr : existingDoc.fusingMtr;
  const freshMtr = body.freshMtr !== undefined ? body.freshMtr : existingDoc.freshMtr;
  const totalWastageMtr = body.totalWastageMtr !== undefined ? body.totalWastageMtr : existingDoc.totalWastageMtr;
  const deliveredMtr = body.deliveredMtr !== undefined ? body.deliveredMtr : (body.deliveryMtr || existingDoc.deliveredMtr);

  const evaluation = evaluateStageVariances({
    totalMtr,
    printMtr,
    fusingMtr,
    freshMtr,
    totalWastageMtr,
    deliveredMtr,
    overageReason: body.overageReason || req.headers['x-overage-reason'],
    operatorOverride: body.operatorOverride === true || req.headers['x-operator-override'] === 'true',
  });

  if (!evaluation.isValid) {
    return res.status(httpStatus.UNPROCESSABLE_ENTITY).json({
      error: 'PRODUCTION_VARIANCE_ANOMALY',
      message: evaluation.errors[0],
      details: evaluation.errors,
      stageMetrics: evaluation.stageMetrics,
    });
  }

  // Attach metrics and warnings to req for controller logging
  req.productionMetrics = evaluation.stageMetrics;
  req.productionWarnings = evaluation.warnings;
  req.productionAuditTags = evaluation.auditTags;

  next();
}

module.exports = {
  evaluateStageVariances,
  productionVarianceMiddleware,
  MAX_PRINT_OVERAGE_RATIO,
  ANOMALOUS_PRINT_OVERAGE_RATIO,
  THERMAL_STRETCH_ALLOWANCE,
  CRITICAL_WASTAGE_RATIO,
};
