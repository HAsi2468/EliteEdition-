const JobPrintLog = require('../db/models/jobPrintLog.model');
const JobCard = require('../db/models/jobCard.model');

// Helper to recalculate JobCard totals & status based on print logs
async function syncJobCardPrintTotals(jobCardId) {
  if (!jobCardId) return null;
  const jobCard = await JobCard.findById(jobCardId);
  if (!jobCard) return null;

  // Aggregate total printed meters from JobPrintLog collection
  const logs = await JobPrintLog.find({ jobCardId }).sort({ date: -1, created_date_time: -1 });
  const totalPrintedMtr = logs.reduce((sum, log) => sum + (Number(log.meters) || 0), 0);

  // Parse target meters from Job Card totalMtr or consumption
  const targetStr = jobCard.totalMtr || jobCard.consumption || '0';
  const targetMatch = String(targetStr).match(/[\d.]+/);
  const targetMtr = targetMatch ? parseFloat(targetMatch[0]) : 0;

  jobCard.printMtr = `${totalPrintedMtr.toFixed(2)} mtr`;
  
  if (logs.length > 0) {
    const latestLog = logs[0];
    if (latestLog.operatorName) {
      jobCard.operatorName = latestLog.operatorName;
    }
    if (latestLog.machineName) {
      jobCard.machineName = latestLog.machineName;
    }
    if (latestLog.pass) {
      jobCard.pass = latestLog.pass;
    }
    if (latestLog.date) {
      const dt = new Date(latestLog.date);
      const day = String(dt.getDate()).padStart(2, '0');
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      jobCard.printDate = `${day}/${month}/${dt.getFullYear()}`;
    }
  }

  if (totalPrintedMtr > 0) {
    if (targetMtr > 0 && totalPrintedMtr >= targetMtr) {
      jobCard.printStatus = 'Printing Done';
      if (jobCard.status === 'Pending') {
        jobCard.status = 'In Progress';
      }
    } else {
      jobCard.printStatus = 'Printing Pending';
      if (jobCard.status === 'Pending') {
        jobCard.status = 'In Progress';
      }
    }
  } else {
    jobCard.printStatus = 'Printing Pending';
  }

  await jobCard.save();
  return { jobCard, totalPrintedMtr, targetMtr, logsCount: logs.length };
}

// 1. Create a Print Log entry
const createPrintLog = async (req, res) => {
  try {
    const { jobCardId, jobNo, machineName, pass, meters, date, operatorName, shift, notes } = req.body;

    if (!jobNo && !jobCardId) {
      return res.status(400).json({ success: false, error: 'Job Card Number or ID is required.' });
    }
    if (!machineName) {
      return res.status(400).json({ success: false, error: 'Machine Name is required.' });
    }
    if (meters === undefined || meters === null || Number(meters) <= 0) {
      return res.status(400).json({ success: false, error: 'Printed Meters must be greater than 0.' });
    }

    // Resolve Job Card
    let targetJob = null;
    if (jobCardId) {
      targetJob = await JobCard.findById(jobCardId);
    }
    if (!targetJob && jobNo) {
      targetJob = await JobCard.findOne({ jobNo: jobNo.trim() });
    }

    if (!targetJob) {
      return res.status(404).json({ success: false, error: `Job Card #${jobNo || jobCardId} not found.` });
    }

    const printLog = new JobPrintLog({
      jobCardId: targetJob._id,
      jobNo: targetJob.jobNo,
      machineName: machineName.trim(),
      pass: pass || targetJob.pass || '4 Pass',
      meters: Number(meters),
      date: date ? (parseFlexibleDate(date) || new Date()) : new Date(),
      operatorName: operatorName || req.user?.name || '',
      shift: shift || 'General',
      notes: notes || ''
    });

    await printLog.save();

    // Recalculate Job Card Rollup stats
    const summary = await syncJobCardPrintTotals(targetJob._id);

    res.status(201).json({
      success: true,
      message: `Logged ${meters} mtr print run for Job #${targetJob.jobNo} on ${machineName}`,
      data: printLog,
      summary
    });
  } catch (error) {
    console.error('Error in createPrintLog:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

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

// 2. Get all Print Logs with pagination & filters
const getPrintLogs = async (req, res) => {
  try {
    const { jobNo, machineName, operatorName, dateStart, dateEnd, page = 1, limit = 500 } = req.query;

    const filter = {};
    if (jobNo) {
      filter.jobNo = { $regex: jobNo.trim(), $options: 'i' };
    }
    if (machineName) {
      filter.machineName = { $regex: machineName.trim(), $options: 'i' };
    }
    if (operatorName) {
      filter.operatorName = { $regex: operatorName.trim(), $options: 'i' };
    }

    if (dateStart || dateEnd) {
      const dsStr = dateStart ? String(dateStart).split('T')[0] : '';
      const deStr = dateEnd ? String(dateEnd).split('T')[0] : '';

      const minMs = dsStr ? Math.min(
        new Date(`${dsStr}T00:00:00.000Z`).getTime(),
        new Date(`${dsStr}T00:00:00.000`).getTime()
      ) : null;

      const maxMs = deStr ? Math.max(
        new Date(`${deStr}T23:59:59.999Z`).getTime(),
        new Date(`${deStr}T23:59:59.999`).getTime()
      ) : null;

      const minDate = minMs ? new Date(minMs) : null;
      const maxDate = maxMs ? new Date(maxMs) : null;

      const dateRange = {};
      if (minDate) dateRange.$gte = minDate;
      if (maxDate) dateRange.$lte = maxDate;

      filter.$or = [
        { date: dateRange },
        { created_date_time: dateRange }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await JobPrintLog.countDocuments(filter);
    const logs = await JobPrintLog.find(filter)
      .sort({ date: -1, created_date_time: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Summary statistics for query
    const totalMeters = logs.reduce((s, l) => s + (l.meters || 0), 0);

    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
      totalMeters,
      data: logs
    });
  } catch (error) {
    console.error('Error in getPrintLogs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 3. Get all Print Logs for a specific Job Card
const getJobCardPrintLogs = async (req, res) => {
  try {
    const { jobNoOrId } = req.params;

    let targetJob = null;
    if (jobNoOrId.match(/^[0-9a-fA-F]{24}$/)) {
      targetJob = await JobCard.findById(jobNoOrId);
    }
    if (!targetJob) {
      targetJob = await JobCard.findOne({ jobNo: jobNoOrId.trim() });
    }

    if (!targetJob) {
      return res.status(404).json({ success: false, error: `Job Card #${jobNoOrId} not found.` });
    }

    const logs = await JobPrintLog.find({ jobCardId: targetJob._id })
      .sort({ date: -1, created_date_time: -1 })
      .lean();

    const totalPrintedMtr = logs.reduce((sum, l) => sum + (Number(l.meters) || 0), 0);
    const targetMatch = String(targetJob.totalMtr || targetJob.consumption || '0').match(/[\d.]+/);
    const targetMtr = targetMatch ? parseFloat(targetMatch[0]) : 0;
    const remainingMtr = Math.max(0, targetMtr - totalPrintedMtr);
    const progressPct = targetMtr > 0 ? Math.min(100, Math.round((totalPrintedMtr / targetMtr) * 100)) : 0;

    res.status(200).json({
      success: true,
      jobCard: targetJob,
      summary: {
        targetMtr,
        totalPrintedMtr,
        remainingMtr,
        progressPct,
        logsCount: logs.length
      },
      data: logs
    });
  } catch (error) {
    console.error('Error in getJobCardPrintLogs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 4. Update a Print Log entry
const updatePrintLog = async (req, res) => {
  try {
    const { id } = req.params;
    const { machineName, pass, meters, date, operatorName, shift, notes } = req.body;

    const log = await JobPrintLog.findById(id);
    if (!log) {
      return res.status(404).json({ success: false, error: 'Print Log entry not found.' });
    }

    if (machineName !== undefined) log.machineName = machineName.trim();
    if (pass !== undefined) log.pass = pass;
    if (meters !== undefined) log.meters = Number(meters);
    if (date !== undefined) log.date = new Date(date);
    if (operatorName !== undefined) log.operatorName = operatorName;
    if (shift !== undefined) log.shift = shift;
    if (notes !== undefined) log.notes = notes;

    await log.save();

    // Sync Job Card totals
    const summary = await syncJobCardPrintTotals(log.jobCardId);

    res.status(200).json({
      success: true,
      message: 'Print Log updated successfully.',
      data: log,
      summary
    });
  } catch (error) {
    console.error('Error in updatePrintLog:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 5. Delete a Print Log entry
const deletePrintLog = async (req, res) => {
  try {
    const { id } = req.params;

    const log = await JobPrintLog.findById(id);
    if (!log) {
      return res.status(404).json({ success: false, error: 'Print Log entry not found.' });
    }

    const jobCardId = log.jobCardId;
    await JobPrintLog.findByIdAndDelete(id);

    // Sync Job Card totals
    const summary = await syncJobCardPrintTotals(jobCardId);

    res.status(200).json({
      success: true,
      message: 'Print Log deleted and Job Card progress updated.',
      summary
    });
  } catch (error) {
    console.error('Error in deletePrintLog:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  createPrintLog,
  getPrintLogs,
  getJobCardPrintLogs,
  updatePrintLog,
  deletePrintLog
};
