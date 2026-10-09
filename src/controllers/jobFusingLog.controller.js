const mongoose = require('mongoose');
const { JobFusingLog, JobCard, RawMaterialTransaction } = require('../db/models');
const logger = require('../config/logger');

// Helper to parse dates flexibly
function parseFlexibleDate(dateInput, isEnd = false) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return dateInput;
  const str = String(dateInput).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const [y, m, d] = str.split('T')[0].split('-');
    if (isEnd) return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999));
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0));
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
    const [d, m, y] = str.split('/');
    if (isEnd) return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999));
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0));
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Recalculate Job Card cumulative Fusing metrics across all its Fusing Log entries.
 * Note: Adding a new production run log records action 'FUSING_ENTRY', NOT an 'EDIT' / 'UPDATE'
 * of the Job Card master specifications!
 */
async function syncJobCardFusingTotals(jobCardId, jobNo) {
  let targetJob = null;
  if (jobCardId) {
    targetJob = await JobCard.findById(jobCardId);
  }
  if (!targetJob && jobNo) {
    targetJob = await JobCard.findOne({ jobNo: String(jobNo).trim() });
  }
  if (!targetJob) return null;

  const logs = await JobFusingLog.find({
    $or: [{ jobCardId: targetJob._id }, { jobNo: targetJob.jobNo }]
  }).sort({ date: -1, created_date_time: -1 });

  let totalFreshMtr = 0;
  let totalWastageMtr = 0;
  let totalFabricFaultMtr = 0;
  let totalFusingFaultMtr = 0;
  let totalPrintFaultMtr = 0;
  let totalGenuineFaultMtr = 0;

  logs.forEach(l => {
    totalFreshMtr += Number(l.freshMtr) || 0;
    totalWastageMtr += Number(l.totalWastageMtr) || 0;
    totalFabricFaultMtr += Number(l.fabricFaultMtr) || 0;
    totalFusingFaultMtr += Number(l.fusingFaultMtr) || 0;
    totalPrintFaultMtr += Number(l.printFaultMtr) || 0;
    totalGenuineFaultMtr += Number(l.genuineFaultMtr) || 0;
  });

  const totalFusedMtr = totalFreshMtr + totalWastageMtr;

  targetJob.freshMtr = Number.isInteger(totalFreshMtr) ? String(totalFreshMtr) : totalFreshMtr.toFixed(2);
  targetJob.totalWastageMtr = Number.isInteger(totalWastageMtr) ? String(totalWastageMtr) : totalWastageMtr.toFixed(2);
  targetJob.fabricFaultMtr = Number.isInteger(totalFabricFaultMtr) ? String(totalFabricFaultMtr) : totalFabricFaultMtr.toFixed(2);
  targetJob.fusingFaultMtr = Number.isInteger(totalFusingFaultMtr) ? String(totalFusingFaultMtr) : totalFusingFaultMtr.toFixed(2);
  targetJob.printFaultMtr = Number.isInteger(totalPrintFaultMtr) ? String(totalPrintFaultMtr) : totalPrintFaultMtr.toFixed(2);
  targetJob.genuineFaultMtr = Number.isInteger(totalGenuineFaultMtr) ? String(totalGenuineFaultMtr) : totalGenuineFaultMtr.toFixed(2);
  targetJob.totalFabricUsedMtr = Number.isInteger(totalFusedMtr) ? String(totalFusedMtr) : totalFusedMtr.toFixed(2);
  targetJob.fusingMtr = Number.isInteger(totalFusedMtr) ? String(totalFusedMtr) : totalFusedMtr.toFixed(2);

  if (logs.length > 0) {
    const latest = logs[0];
    if (latest.fusingMachine) targetJob.fusingMachine = latest.fusingMachine;
    if (latest.fusingSpeed) targetJob.fusingSpeed = String(latest.fusingSpeed);
    if (latest.fusingTemp) targetJob.fusingTemp = String(latest.fusingTemp);
    if (latest.operatorName) targetJob.fusingOperator = latest.operatorName;
    if (latest.shift) targetJob.shift = latest.shift;
    if (latest.date) {
      const dt = new Date(latest.date);
      const yr = dt.getFullYear();
      const mo = String(dt.getMonth() + 1).padStart(2, '0');
      const dy = String(dt.getDate()).padStart(2, '0');
      targetJob.fusingDate = `${yr}-${mo}-${dy}`;
    }

    // Determine status
    const targetStr = targetJob.totalMtr || targetJob.printMtr || '0';
    const targetMatch = String(targetStr).match(/[\d.]+/);
    const targetMtr = targetMatch ? parseFloat(targetMatch[0]) : 0;

    const isComplete = latest.rollCompleted === 'Complete' || (targetMtr > 0 && totalFreshMtr >= targetMtr);
    targetJob.fusingStatus = isComplete ? 'Fusing Done' : 'Fusing In Progress';
    if (targetJob.status === 'Pending') {
      targetJob.status = 'In Progress';
    }
  } else {
    targetJob.fusingStatus = 'Fusing Pending';
  }

  // Update overall Job Card status
  if (
    targetJob.printStatus === 'Printing Done' &&
    targetJob.fusingStatus === 'Fusing Done' &&
    targetJob.deliveryStatus === 'Delivery Done'
  ) {
    targetJob.status = 'Done';
  } else if (
    targetJob.printStatus === 'Printing Done' ||
    targetJob.printStatus === 'Printing In Progress' ||
    targetJob.fusingStatus === 'Fusing Done' ||
    targetJob.fusingStatus === 'Fusing In Progress' ||
    targetJob.deliveryStatus === 'Delivery Done' ||
    targetJob.deliveryStatus === 'Delivery In Progress'
  ) {
    targetJob.status = 'In Progress';
  }

  // Record production progress action (FUSING_ENTRY), NOT an EDIT of the Job Card master specs
  const latestLog = logs[0];
  const auditAction = 'FUSING_ENTRY';
  const auditEntry = {
    performedBy: latestLog?.operatorName || 'Fusing Operator',
    performedByName: latestLog?.operatorName || 'Fusing Operator',
    action: auditAction,
    timestamp: new Date(),
    details: logs.length > 0
      ? `Fusing Run Logged: ${latestLog.freshMtr}m Fresh${latestLog.totalWastageMtr > 0 ? ` + ${latestLog.totalWastageMtr}m Waste` : ''} on ${latestLog.fusingMachine || 'Machine'} (Cumulative: ${totalFreshMtr}m fresh)`
      : 'Fusing log recalculated',
    changesSummary: `Fusing Status: ${targetJob.fusingStatus}; Total Fused: ${totalFusedMtr}m`
  };

  if (!Array.isArray(targetJob.auditTrail)) {
    targetJob.auditTrail = [];
  }
  targetJob.auditTrail.push(auditEntry);

  await targetJob.save();
  return {
    jobCard: targetJob,
    totalFreshMtr,
    totalWastageMtr,
    totalFusedMtr,
    logsCount: logs.length
  };
}

// 1. Create a Fusing Log entry (Step 3: New Entry - NOT an edit)
const createFusingLog = async (req, res) => {
  try {
    const {
      jobCardId,
      jobNo,
      fusingMachine,
      shift,
      date,
      fusingTemp,
      fusingSpeed,
      panna,
      freshMtr,
      totalWastageMtr,
      fabricFaultMtr,
      fusingFaultMtr,
      printFaultMtr,
      genuineFaultMtr,
      fusingMtr,
      useButterPaper,
      butterPaperWeightKg,
      rollCompleted,
      operatorName,
      notes
    } = req.body;

    if (!jobNo && !jobCardId) {
      return res.status(400).json({ success: false, error: 'Job Card Number or ID is required.' });
    }

    let targetJob = null;
    if (jobCardId) {
      targetJob = await JobCard.findById(jobCardId);
    }
    if (!targetJob && jobNo) {
      targetJob = await JobCard.findOne({ jobNo: String(jobNo).trim() });
    }

    if (!targetJob) {
      return res.status(404).json({ success: false, error: `Job Card #${jobNo || jobCardId} not found.` });
    }

    const parsedFresh = Math.max(0, parseFloat(freshMtr) || 0);
    const parsedWaste = Math.max(0, parseFloat(totalWastageMtr) || 0);
    const parsedTotalFusing = Math.max(0, parseFloat(fusingMtr) || (parsedFresh + parsedWaste));

    const opName = operatorName || req.user?.name || req.user?.username || targetJob.fusingOperator || 'Fusing Operator';

    const fusingLog = new JobFusingLog({
      jobCardId: targetJob._id,
      jobNo: targetJob.jobNo,
      fusingMachine: fusingMachine ? String(fusingMachine).trim() : 'Fusing Machine 1',
      shift: shift || 'General',
      date: date ? (parseFlexibleDate(date) || new Date()) : new Date(),
      fusingTemp: fusingTemp ? String(fusingTemp).trim() : '210°C',
      fusingSpeed: fusingSpeed ? String(fusingSpeed).trim() : '80',
      panna: panna ? String(panna).trim() : (targetJob.panna || '58"'),
      freshMtr: parsedFresh,
      totalWastageMtr: parsedWaste,
      fabricFaultMtr: Math.max(0, parseFloat(fabricFaultMtr) || 0),
      fusingFaultMtr: Math.max(0, parseFloat(fusingFaultMtr) || 0),
      printFaultMtr: Math.max(0, parseFloat(printFaultMtr) || 0),
      genuineFaultMtr: Math.max(0, parseFloat(genuineFaultMtr) || 0),
      fusingMtr: parsedTotalFusing,
      useButterPaper: useButterPaper || 'Yes',
      butterPaperWeightKg: Math.max(0, parseFloat(butterPaperWeightKg) || 0),
      rollCompleted: rollCompleted || 'Complete',
      operatorName: opName,
      notes: notes || ''
    });

    await fusingLog.save();

    // 2. Consume Butter Paper inventory if used
    if (useButterPaper === 'Yes' && parseFloat(butterPaperWeightKg) > 0 && RawMaterialTransaction) {
      try {
        await RawMaterialTransaction.create({
          type: 'OUTWARD',
          date: fusingLog.date,
          materialName: 'Butter Paper',
          qty: Number(butterPaperWeightKg),
          unit: 'Kg',
          panna: fusingLog.panna,
          jobNo: targetJob.jobNo,
          notes: `Fusing Entry — Machine: ${fusingLog.fusingMachine} | Operator: ${opName} | Roll: ${rollCompleted || 'Complete'}`
        });
      } catch (rmErr) {
        logger.warn('Butter paper transaction log error: %s', rmErr.message);
      }
    }

    // 3. Rollup Job Card metrics
    const summary = await syncJobCardFusingTotals(targetJob._id, targetJob.jobNo);

    res.status(201).json({
      success: true,
      message: `Logged ${parsedFresh}m fresh fusing run for Job #${targetJob.jobNo}`,
      data: fusingLog,
      summary
    });
  } catch (error) {
    logger.error('Error in createFusingLog: %s', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 2. Get Fusing Logs with filtering & pagination
const getFusingLogs = async (req, res) => {
  try {
    const {
      jobNo,
      fusingMachine,
      operatorName,
      shift,
      dateStart,
      dateEnd,
      page = 1,
      limit = 200
    } = req.query;

    const filter = {};
    if (jobNo) {
      filter.jobNo = { $regex: jobNo.trim(), $options: 'i' };
    }
    if (fusingMachine) {
      const machines = String(fusingMachine).split(',').map(m => m.trim()).filter(Boolean);
      if (machines.length > 1) {
        filter.fusingMachine = { $in: machines.map(m => new RegExp(`^${m.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i')) };
      } else if (machines.length === 1) {
        filter.fusingMachine = { $regex: machines[0], $options: 'i' };
      }
    }
    if (operatorName) {
      const operators = String(operatorName).split(',').map(o => o.trim()).filter(Boolean);
      if (operators.length > 1) {
        filter.operatorName = { $in: operators.map(o => new RegExp(`^${o.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i')) };
      } else if (operators.length === 1) {
        filter.operatorName = { $regex: operators[0], $options: 'i' };
      }
    }
    if (shift) {
      filter.shift = { $regex: shift.trim(), $options: 'i' };
    }

    if (dateStart || dateEnd) {
      const dsStr = dateStart ? String(dateStart).split('T')[0] : '';
      const deStr = dateEnd ? String(dateEnd).split('T')[0] : '';
      let minTime = null;
      let maxTime = null;

      if (dsStr) {
        const utcStart = new Date(`${dsStr}T00:00:00.000Z`).getTime();
        const istStart = new Date(`${dsStr}T00:00:00.000+05:30`).getTime();
        minTime = Math.min(utcStart, istStart);
      }
      if (deStr) {
        const utcEnd = new Date(`${deStr}T23:59:59.999Z`).getTime();
        const istEnd = new Date(`${deStr}T23:59:59.999+05:30`).getTime();
        maxTime = Math.max(utcEnd, istEnd);
      }

      if (minTime !== null && maxTime !== null) {
        filter.date = { $gte: new Date(minTime), $lte: new Date(maxTime) };
      } else if (minTime !== null) {
        filter.date = { $gte: new Date(minTime) };
      } else if (maxTime !== null) {
        filter.date = { $lte: new Date(maxTime) };
      }
    }

    const p = Math.max(1, parseInt(page, 10));
    const l = Math.max(1, parseInt(limit, 10));
    const skip = (p - 1) * l;

    const total = await JobFusingLog.countDocuments(filter);
    const logs = await JobFusingLog.find(filter)
      .sort({ date: -1, created_date_time: -1 })
      .skip(skip)
      .limit(l)
      .populate('jobCardId', 'party fabric designName designNo totalMtr panna printMtr printStatus')
      .lean();

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: p,
        limit: l,
        total,
        totalPages: Math.ceil(total / l)
      }
    });
  } catch (error) {
    logger.error('Error in getFusingLogs: %s', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 3. Get Fusing Logs for a specific Job Card
const getJobCardFusingLogs = async (req, res) => {
  try {
    const { jobNoOrId } = req.params;
    let query = {};
    if (mongoose.Types.ObjectId.isValid(jobNoOrId)) {
      query = { $or: [{ jobCardId: jobNoOrId }, { jobNo: jobNoOrId }] };
    } else {
      query = { jobNo: jobNoOrId };
    }

    const logs = await JobFusingLog.find(query).sort({ date: -1, created_date_time: -1 }).lean();
    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('Error in getJobCardFusingLogs: %s', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 4. Update an existing Fusing Log entry (THIS IS AN EDIT)
const updateFusingLog = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const log = await JobFusingLog.findById(id);
    if (!log) {
      return res.status(404).json({ success: false, error: 'Fusing Log entry not found.' });
    }

    const oldJobCardId = log.jobCardId;
    const oldJobNo = log.jobNo;

    if (body.fusingMachine !== undefined) log.fusingMachine = String(body.fusingMachine).trim();
    if (body.shift !== undefined) log.shift = body.shift;
    if (body.fusingTemp !== undefined) log.fusingTemp = String(body.fusingTemp).trim();
    if (body.fusingSpeed !== undefined) log.fusingSpeed = String(body.fusingSpeed).trim();
    if (body.panna !== undefined) log.panna = String(body.panna).trim();
    if (body.freshMtr !== undefined) log.freshMtr = Math.max(0, parseFloat(body.freshMtr) || 0);
    if (body.totalWastageMtr !== undefined) log.totalWastageMtr = Math.max(0, parseFloat(body.totalWastageMtr) || 0);
    if (body.fabricFaultMtr !== undefined) log.fabricFaultMtr = Math.max(0, parseFloat(body.fabricFaultMtr) || 0);
    if (body.fusingFaultMtr !== undefined) log.fusingFaultMtr = Math.max(0, parseFloat(body.fusingFaultMtr) || 0);
    if (body.printFaultMtr !== undefined) log.printFaultMtr = Math.max(0, parseFloat(body.printFaultMtr) || 0);
    if (body.genuineFaultMtr !== undefined) log.genuineFaultMtr = Math.max(0, parseFloat(body.genuineFaultMtr) || 0);
    if (body.fusingMtr !== undefined) {
      log.fusingMtr = Math.max(0, parseFloat(body.fusingMtr) || (log.freshMtr + log.totalWastageMtr));
    } else {
      log.fusingMtr = log.freshMtr + log.totalWastageMtr;
    }
    if (body.useButterPaper !== undefined) log.useButterPaper = body.useButterPaper;
    if (body.butterPaperWeightKg !== undefined) log.butterPaperWeightKg = Math.max(0, parseFloat(body.butterPaperWeightKg) || 0);
    if (body.rollCompleted !== undefined) log.rollCompleted = body.rollCompleted;
    if (body.operatorName !== undefined) log.operatorName = body.operatorName;
    if (body.notes !== undefined) log.notes = body.notes;
    if (body.date !== undefined) {
      const parsed = parseFlexibleDate(body.date);
      if (parsed) log.date = parsed;
    }

    await log.save();

    // Re-sync Job Card totals
    const summary = await syncJobCardFusingTotals(log.jobCardId, log.jobNo);
    if (oldJobCardId && String(oldJobCardId) !== String(log.jobCardId)) {
      await syncJobCardFusingTotals(oldJobCardId, oldJobNo);
    }

    res.json({
      success: true,
      message: 'Fusing Log entry updated successfully.',
      data: log,
      summary
    });
  } catch (error) {
    logger.error('Error in updateFusingLog: %s', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 5. Delete a Fusing Log entry
const deleteFusingLog = async (req, res) => {
  try {
    const { id } = req.params;
    const log = await JobFusingLog.findById(id);
    if (!log) {
      return res.status(404).json({ success: false, error: 'Fusing Log entry not found.' });
    }

    const { jobCardId, jobNo } = log;
    await JobFusingLog.findByIdAndDelete(id);

    const summary = await syncJobCardFusingTotals(jobCardId, jobNo);
    res.json({
      success: true,
      message: 'Fusing Log entry deleted successfully.',
      summary
    });
  } catch (error) {
    logger.error('Error in deleteFusingLog: %s', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  createFusingLog,
  getFusingLogs,
  getJobCardFusingLogs,
  updateFusingLog,
  deleteFusingLog,
  syncJobCardFusingTotals
};
