const FabricTransaction = require('../db/models/fabricTransaction.model');
const FabricStockAdjustment = require('../db/models/fabricStockAdjustment.model');
const PDFDocument = require('pdfkit');

// Normalize functions to merge matching fabric and panna widths (e.g. 58" and 58)
const normalizeFabric = (val, pannaVal = '') => {
  if (!val) return '';
  let str = String(val).trim().toUpperCase();

  let extractedPanna = '';
  const pannaMatches = str.match(/(?:\s+(\d+))+\s*$/);
  if (pannaMatches) {
    const digits = pannaMatches[0].trim().split(/\s+/);
    extractedPanna = digits[digits.length - 1];
    str = str.replace(/(?:\s+(\d+))+\s*$/, '').trim();
  }

  let base = str;
  if (base === 'LINEN' || base === 'KOINUR LINEN' || base === 'KOHINUR LINEN' || base === 'KOHINOOR LINEN' || base.includes('KOINUR') || base.includes('KOHINOOR') || base.includes('KOHINUR')) {
    base = 'KOHINOOR LINEN';
  } else if (base === 'REYON' || base === 'RAYON' || base === 'POLY REYON' || base === 'POLY RAYON' || base.includes('REYON') || base.includes('RAYON')) {
    if (base.includes('30 SPN')) {
      base = 'POLY REYON 30 SPN';
    } else {
      base = 'POLY REYON';
    }
  } else if (base === 'CREPE' || base === 'CRAPE' || base === 'FRANCH CREPE' || base === 'FRENCH CREP' || base.includes('CREPE') || base.includes('CRAPE') || base.includes('CREP')) {
    base = 'FRENCH CREPE';
  } else if (base === 'CAMRIK' || base === 'CEMBRIC' || base === 'CEMBRIK' || base === 'CAMBRIK' || base.includes('CAMRIK') || base.includes('CEMBRIK')) {
    base = 'CAMBRIC';
  } else if (base === 'MAL' || base === 'POLY MAL' || base === 'POLYMALL' || base === 'POLY MLL' || base === 'POLLY MAL') {
    base = 'POLLY MAL';
  }

  let finalPanna = extractedPanna || (pannaVal ? String(pannaVal).trim().replace(/['"]/g, '') : '');
  if (finalPanna === '38' || finalPanna === '46' || finalPanna === '56') finalPanna = '58';
  if (!finalPanna || finalPanna.toUpperCase() === 'UNKNOWN' || isNaN(parseInt(finalPanna, 10))) {
    if (base.includes('ARMANI')) finalPanna = '44';
    else finalPanna = '58';
  }

  return `${base} ${finalPanna}`;
};

const normalizePanna = (val, fabricName = '') => {
  let clean = val ? String(val).trim().replace(/['"]/g, '') : '';
  if (clean === '46' || clean === '56') return '58';
  if (!clean || clean.toUpperCase() === 'UNKNOWN') {
    const fabUpper = String(fabricName || '').trim().toUpperCase();
    if (fabUpper.includes('ARMANI')) {
      return '44';
    }
    return '58';
  }
  return clean;
};

const getDepartmentFilter = (dept) => {
  if (dept === 'stitching') {
    return { department: 'stitching' };
  } else if (dept === 'digital_print') {
    // $in with null matches both null values AND missing fields ($exists: false)
    // This enables index usage, unlike $or with $exists
    return { department: { $in: ['digital_print', null, ''] } };
  }
  return {};
};

// Create a new INWARD transaction
const createInward = async (req, res) => {
  try {
    const { challanNo, vendorName, fabricQuality, panna, qty, date, notes, shortagePct, shortageMtr, shortageMode, department } = req.body;
    
    if (!fabricQuality || qty == null || qty < 0) {
      return res.status(400).json({ success: false, error: 'Fabric Quality and a valid Quantity are required.' });
    }

    const normFabric = normalizeFabric(fabricQuality);
    const normP = normalizePanna(panna, normFabric);

    const sMode = shortageMode === 'mtr' ? 'mtr' : 'pct';
    let parsedPct = shortagePct !== '' && shortagePct != null ? parseFloat(shortagePct) : null;
    let parsedMtr = shortageMtr !== '' && shortageMtr != null ? parseFloat(shortageMtr) : null;

    if (sMode === 'mtr' && parsedMtr != null && qty > 0) {
      parsedPct = parseFloat(((parsedMtr / qty) * 100).toFixed(2));
    } else if (sMode === 'pct' && parsedPct != null && qty > 0) {
      parsedMtr = parseFloat(((qty * parsedPct) / 100).toFixed(2));
    }

    const transaction = new FabricTransaction({
      type: 'INWARD',
      challanNo,
      vendorName,
      fabricQuality: normFabric,
      panna: normP,
      qty,
      date: date ? new Date(date) : new Date(),
      notes,
      shortagePct: parsedPct,
      shortageMtr: parsedMtr,
      shortageMode: sMode,
      department: department || 'digital_print',
    });

    await transaction.save();
    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    console.error('Error creating inward fabric transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create a new OUTWARD transaction
const createOutward = async (req, res) => {
  try {
    const { jobNo, challanNo, partyName, fabricQuality, panna, lotNo, qty, date, notes, department } = req.body;
    
    if (!fabricQuality || qty == null || qty <= 0) {
      return res.status(400).json({ success: false, error: 'Fabric Quality and a valid Quantity (>0) are required.' });
    }

    const normFabric = normalizeFabric(fabricQuality);
    const normP = normalizePanna(panna, normFabric);

    let finalQty = parseFloat(qty);
    let finalNotes = notes || '';
    if (normFabric.includes('CREPE') || normFabric.includes('CRAPE') || normFabric.includes('FRENCH')) {
      finalQty = Number((finalQty * 1.02).toFixed(2));
      if (!finalNotes.includes('+2% French Crepe Applied')) {
        finalNotes = finalNotes ? `${finalNotes} (+2% French Crepe Applied)` : '(+2% French Crepe Applied)';
      }
    }

    const transaction = new FabricTransaction({
      type: 'OUTWARD',
      jobNo,
      challanNo,
      partyName,
      fabricQuality: normFabric,
      panna: normP,
      lotNo: lotNo ? Number(lotNo) : undefined,
      qty: finalQty,
      date: date ? new Date(date) : new Date(),
      notes: finalNotes,
      department: department || 'digital_print',
    });

    await transaction.save();

    // Smart Automation: Sync Outward with Tracking Job Card
    if (jobNo) {
      try {
        const JobCard = require('../db/models/jobCard.model');
        const jobCard = await JobCard.findOne({ jobNo: jobNo.trim() });
        if (jobCard) {
          let updated = false;
          // Auto-progress status if pending
          if (jobCard.status === 'Pending') {
            jobCard.status = 'In Progress';
            updated = true;
          }
          // Log lot allocation details in job notes
          const syncNote = `[Fabric Sync] Issued ${qty} mtr from Lot #${lotNo || 'N/A'}`;
          if (!jobCard.note1) {
            jobCard.note1 = syncNote;
            updated = true;
          } else if (!jobCard.note2) {
            jobCard.note2 = syncNote;
            updated = true;
          } else if (!jobCard.note1.includes(syncNote) && !jobCard.note2.includes(syncNote)) {
            jobCard.note1 = `${jobCard.note1} | ${syncNote}`;
            updated = true;
          }
          
          if (updated) {
            await jobCard.save();
            console.log(`Auto-synced Fabric Outward for Job No ${jobNo}: status set to In Progress.`);
          }
        }
      } catch (jobErr) {
        console.error(`Failed to auto-sync with Job Card:`, jobErr.message);
      }
    }

    // Auto-clear lot balance if remaining stock <= 5 mtr
    if (lotNo) {
      const lotAgg = await FabricTransaction.aggregate([
        { $match: { lotNo: Number(lotNo) } },
        {
          $group: {
            _id: '$lotNo',
            fabricQuality: { $first: '$fabricQuality' },
            panna: { $first: '$panna' },
            totalIn: { $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] } },
            totalOut: { $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] } }
          }
        }
      ]);
      if (lotAgg.length > 0) {
        const rem = lotAgg[0].totalIn - lotAgg[0].totalOut;
        if (rem > 0 && rem <= 5.0) {
          const scrapTx = new FabricTransaction({
            type: 'OUTWARD',
            fabricQuality: lotAgg[0].fabricQuality,
            panna: lotAgg[0].panna,
            lotNo: Number(lotNo),
            qty: Number(rem.toFixed(2)),
            date: new Date(),
            notes: 'Remnant Stock Auto-Clear (<= 5 mtr remaining converted to 0)'
          });
          await scrapTx.save();
          console.log(`Auto-cleared remnant stock for Lot #${lotNo} (${rem.toFixed(2)} mtr converted to 0)`);
        }
      }
    }

    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    console.error('Error creating outward fabric transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get all transactions
const getTransactions = async (req, res) => {
  try {
    const deptFilter = getDepartmentFilter(req.query.department);
    const transactions = await FabricTransaction.find(deptFilter).sort({ date: -1, createdAt: -1 });
    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    console.error('Error fetching fabric transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get current stock overview grouped by fabric quality
const getStockOverview = async (req, res) => {
  try {
    const deptFilter = getDepartmentFilter(req.query.department);
    const pipeline = [
      { $match: deptFilter },
      {
        $group: {
          _id: '$fabricQuality',
          totalInward: {
            $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] }
          },
          totalOutward: {
            $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] }
          },
          totalShortage: {
            $sum: {
              $cond: [
                { $eq: ['$type', 'OUTWARD'] },
                {
                  $cond: [
                    { $and: [{ $ne: ['$shortageMtr', null] }, { $gt: ['$shortageMtr', 0] }] },
                    '$shortageMtr',
                    {
                      $cond: [
                        { $and: [{ $ne: ['$shortagePct', null] }, { $gt: ['$shortagePct', 0] }] },
                        { $subtract: ['$qty', { $divide: ['$qty', { $add: [1, { $divide: ['$shortagePct', 100] }] }] }] },
                        0
                      ]
                    }
                  ]
                },
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          fabricQuality: '$_id',
          totalInward: 1,
          totalOutward: 1,
          totalShortage: 1,
          freshOutward: { $subtract: ['$totalOutward', '$totalShortage'] },
          currentStock: { $subtract: ['$totalInward', '$totalOutward'] },
          _id: 0
        }
      },
      {
        $sort: { fabricQuality: 1 }
      }
    ];

    const stock = await FabricTransaction.aggregate(pipeline);
    const normalizedStockMap = new Map();
    for (const item of stock) {
      const normName = normalizeFabric(item.fabricQuality);
      if (!normalizedStockMap.has(normName)) {
        normalizedStockMap.set(normName, {
          fabricQuality: normName,
          totalInward: 0,
          freshOutward: 0,
          totalShortage: 0,
          totalOutward: 0,
          currentStock: 0
        });
      }
      const existing = normalizedStockMap.get(normName);
      existing.totalInward += item.totalInward || 0;
      existing.freshOutward += item.freshOutward || 0;
      existing.totalShortage += item.totalShortage || 0;
      existing.totalOutward += item.totalOutward || 0;
      existing.currentStock += item.currentStock || 0;
    }
    const finalStock = Array.from(normalizedStockMap.values()).sort((a, b) => a.fabricQuality.localeCompare(b.fabricQuality));
    res.status(200).json({ success: true, data: finalStock });
  } catch (error) {
    console.error('Error calculating fabric stock:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getLotStock = async (req, res) => {
  try {
    const { fabricQuality, panna, department } = req.query;
    const matchStage = getDepartmentFilter(department);
    if (fabricQuality && fabricQuality.trim()) {
      const clean = fabricQuality.trim().toUpperCase();
      const safeClean = clean.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

      const andConds = [
        { fabricQuality: new RegExp(`^${safeClean}`, 'i') }
      ];

      if (panna && panna.trim()) {
        const cleanP = panna.trim().replace(/['"]/g, '');
        andConds.push({ panna: new RegExp(`^${cleanP}$`, 'i') });
      }

      matchStage.$and = andConds;
    }

    const pipeline = [
      { $match: matchStage },
      { $sort: { date: 1, type: -1 } },
      {
        $group: {
          _id: '$lotNo',
          fabricQuality: { $first: '$fabricQuality' },
          panna: { $first: '$panna' },
          vendorName: { $max: '$vendorName' },
          vendorChallanNo: { $max: '$challanNo' },
          totalInward: {
            $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] }
          },
          totalOutward: {
            $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] }
          }
        }
      },
      {
        $project: {
          lotNo: '$_id',
          fabricQuality: 1,
          panna: 1,
          vendorName: 1,
          vendorChallanNo: 1,
          totalInward: 1,
          totalOutward: 1,
          currentStock: { $subtract: ['$totalInward', '$totalOutward'] },
          _id: 0
        }
      },
      {
        $match: {
          lotNo: { $ne: null },
          currentStock: { $gt: 0 }
        }
      },
      { $sort: { lotNo: -1 } } // Sort descending: latest lot numbers first!
    ];

    const lotStock = await FabricTransaction.aggregate(pipeline);
    res.status(200).json({ success: true, data: lotStock });
  } catch (error) {
    console.error('Error fetching lot stock:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete a single transaction by ID
const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await FabricTransaction.findByIdAndDelete(id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Transaction not found.' });
    }
    res.status(200).json({ success: true, message: 'Transaction deleted successfully.' });
  } catch (error) {
    console.error('Error deleting fabric transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get lot-wise stock ledger for a specific fabric
const getLotLedger = async (req, res) => {
  try {
    const { fabricQuality } = req.query;
    const matchStage = {};
    if (fabricQuality) {
      matchStage.fabricQuality = new RegExp(`^${fabricQuality.trim()}$`, 'i');
    }
    // Fetch all transactions sorted by lot and date
    const transactions = await FabricTransaction.find(matchStage).sort({ lotNo: 1, date: 1 });
    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    console.error('Error fetching lot ledger:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Generate Fabric Ledger PDF
const downloadLedgerPdf = async (req, res) => {
  try {
    const { dateStart, dateEnd, fabricQuality } = req.query;

    const matchStage = {};
    if (dateStart || dateEnd) {
      matchStage.date = {};
      if (dateStart) matchStage.date.$gte = new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setHours(23, 59, 59, 999);
        matchStage.date.$lte = end;
      }
    }
    if (fabricQuality) {
      matchStage.fabricQuality = new RegExp(`^${fabricQuality.trim()}$`, 'i');
    }

    const transactions = await FabricTransaction.find(matchStage).sort({ date: 1 });

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=fabric-ledger.pdf');
    doc.pipe(res);

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text('Elite Digital Print — Fabric Ledger', { align: 'center' });
    doc.moveDown(0.3);
    const dateLabel = dateStart || dateEnd
      ? `Period: ${dateStart || 'Start'} to ${dateEnd || 'Today'}`
      : 'All Transactions';
    doc.fontSize(10).font('Helvetica').text(dateLabel, { align: 'center' });
    if (fabricQuality) {
      doc.text(`Fabric: ${fabricQuality}`, { align: 'center' });
    }
    doc.moveDown(1);

    // Table header
    const colX = [40, 90, 155, 230, 310, 380, 430, 490];
    const headers = ['Date', 'Lot #', 'Type', 'Challan/Job', 'Fabric Quality', 'Vendor/Party', 'Panna', 'Qty'];
    doc.fontSize(8).font('Helvetica-Bold');
    headers.forEach((h, i) => doc.text(h, colX[i], doc.y, { width: colX[i + 1] ? colX[i + 1] - colX[i] - 2 : 70, continued: i < headers.length - 1 }));
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.4);

    // Rows
    doc.font('Helvetica').fontSize(7.5);
    let totalIn = 0, totalOut = 0;
    for (const t of transactions) {
      const y = doc.y;
      if (y > 750) { doc.addPage(); }
      const isIn = t.type === 'INWARD';
      if (isIn) totalIn += t.qty; else totalOut += t.qty;
      const row = [
        new Date(t.date).toLocaleDateString('en-IN'),
        t.lotNo ? `#${t.lotNo}` : '-',
        t.type,
        isIn ? (t.challanNo || '-') : (t.jobNo || '-'),
        t.fabricQuality || '-',
        isIn ? (t.vendorName || '-') : (t.partyName || '-'),
        t.panna || '-',
        `${isIn ? '+' : '-'}${t.qty}`
      ];
      row.forEach((cell, i) => {
        doc.fillColor(isIn ? '#1a472a' : '#7f1d1d').text(String(cell), colX[i], doc.y, {
          width: colX[i + 1] ? colX[i + 1] - colX[i] - 2 : 70,
          continued: i < row.length - 1
        });
      });
      doc.fillColor('black').moveDown(0.6);
    }

    // Summary
    doc.moveDown(1);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text(`Total Inward: +${totalIn} mtr`, 40);
    doc.text(`Total Outward: -${totalOut} mtr`);
    doc.text(`Net Stock: ${totalIn - totalOut} mtr`);

    doc.end();
  } catch (error) {
    console.error('Error generating fabric ledger PDF:', error);
    if (!res.headersSent) res.status(500).json({ success: false, error: error.message });
  }
};

// Get stock grouped by fabricQuality + panna
const getStockByPanna = async (req, res) => {
  try {
    const deptFilter = getDepartmentFilter(req.query.department);
    const pipeline = [
      { $match: deptFilter },
      {
        $group: {
          _id: { fabricQuality: '$fabricQuality', panna: { $ifNull: ['$panna', 'Unknown'] } },
          totalInward: { $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] } },
          totalOutward: { $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] } },
          totalShortage: {
            $sum: {
              $cond: [
                { $eq: ['$type', 'OUTWARD'] },
                {
                  $cond: [
                    { $and: [{ $ne: ['$shortageMtr', null] }, { $gt: ['$shortageMtr', 0] }] },
                    '$shortageMtr',
                    {
                      $cond: [
                        { $and: [{ $ne: ['$shortagePct', null] }, { $gt: ['$shortagePct', 0] }] },
                        { $subtract: ['$qty', { $divide: ['$qty', { $add: [1, { $divide: ['$shortagePct', 100] }] }] }] },
                        0
                      ]
                    }
                  ]
                },
                0
              ]
            }
          },
          lotCount: { $addToSet: '$lotNo' }
        }
      },
      {
        $project: {
          fabricQuality: '$_id.fabricQuality',
          panna: '$_id.panna',
          totalInward: 1,
          totalOutward: 1,
          totalShortage: 1,
          freshOutward: { $subtract: ['$totalOutward', '$totalShortage'] },
          currentStock: { $subtract: ['$totalInward', '$totalOutward'] },
          lotCount: { $size: { $filter: { input: '$lotCount', cond: { $ne: ['$$this', null] } } } },
          _id: 0
        }
      },
      { $sort: { fabricQuality: 1, panna: 1 } }
    ];

    const result = await FabricTransaction.aggregate(pipeline);
    const normalizedPannaMap = new Map();
    for (const item of result) {
      const normName = normalizeFabric(item.fabricQuality);
      const key = `${normName}|||${item.panna}`;
      if (!normalizedPannaMap.has(key)) {
        normalizedPannaMap.set(key, {
          fabricQuality: normName,
          panna: item.panna,
          totalInward: 0,
          freshOutward: 0,
          totalShortage: 0,
          totalOutward: 0,
          currentStock: 0,
          lotCount: 0
        });
      }
      const existing = normalizedPannaMap.get(key);
      existing.totalInward += item.totalInward || 0;
      existing.freshOutward += item.freshOutward || 0;
      existing.totalShortage += item.totalShortage || 0;
      existing.totalOutward += item.totalOutward || 0;
      existing.currentStock += item.currentStock || 0;
      existing.lotCount += item.lotCount || 0;
    }
    const finalPanna = Array.from(normalizedPannaMap.values()).sort((a, b) => a.fabricQuality.localeCompare(b.fabricQuality));
    res.status(200).json({ success: true, data: finalPanna });
  } catch (error) {
    console.error('Error fetching panna-wise stock:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get fabric requirement from pending and in-progress job cards
const getFabricRequirement = async (req, res) => {
  try {
    const JobCard = require('../db/models/jobCard.model');

    // Fetch all Pending and In Progress job cards that have fabric info and are not yet fully printed
    const jobs = await JobCard.find({
      status: { $in: ['Pending', 'In Progress'] },
      printStatus: { $ne: 'Printing Done' },
      fabric: { $ne: '' }
    }).lean();

    // Group requirement by fabric + panna
    const requirementMap = {};
    for (const job of jobs) {
      const fabric = normalizeFabric(job.fabric);
      const panna = normalizePanna(job.panna);
      if (!fabric) continue;

      // Target fabric needed in meters
      const targetStr = job.totalMtr || job.consumption || '0';
      const targetMatch = String(targetStr).match(/[\d.]+/);
      const targetMtr = targetMatch ? parseFloat(targetMatch[0]) : 0;

      // Already printed meters
      const printedStr = job.printMtr || '0';
      const printedMatch = String(printedStr).match(/[\d.]+/);
      const printedMtr = printedMatch ? parseFloat(printedMatch[0]) : 0;

      // Net remaining meters required for this active job
      const mtrNeeded = Math.max(0, targetMtr - printedMtr);
      if (mtrNeeded <= 0) continue; // Skip jobs where printing is already complete

      const key = `${fabric}|||${panna}`;
      if (!requirementMap[key]) {
        requirementMap[key] = {
          fabricQuality: fabric,
          panna,
          totalMtrRequired: 0,
          jobs: []
        };
      }
      requirementMap[key].totalMtrRequired += mtrNeeded;
      requirementMap[key].jobs.push({
        jobNo: job.jobNo,
        party: job.party,
        pcs: job.pcs,
        totalMtr: targetMtr,
        printedMtr,
        remainingMtr: mtrNeeded,
        date: job.date
      });
    }

    // Now get current stock grouped by fabric+panna for comparison
    const stockPipeline = [
      {
        $group: {
          _id: { fabricQuality: '$fabricQuality', panna: { $ifNull: ['$panna', 'Unknown'] } },
          totalInward: { $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] } },
          totalOutward: { $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] } }
        }
      },
      {
        $project: {
          fabricQuality: '$_id.fabricQuality',
          panna: '$_id.panna',
          currentStock: { $subtract: ['$totalInward', '$totalOutward'] },
          _id: 0
        }
      }
    ];
    const stockData = await FabricTransaction.aggregate(stockPipeline);

    // Build stock lookup map (case-insensitive & normalized)
    const stockMap = {};
    for (const s of stockData) {
      const fabric = normalizeFabric(s.fabricQuality);
      const panna = normalizePanna(s.panna);
      const key = `${fabric}|||${panna}`;
      stockMap[key] = s.currentStock;
    }

    // Enrich requirement with stock info
    const result = Object.values(requirementMap).map(req => {
      const key = `${req.fabricQuality}|||${req.panna}`;
      const currentStock = stockMap[key] || 0;
      return {
        ...req,
        currentStock,
        shortfall: Math.max(0, req.totalMtrRequired - currentStock),
        status: currentStock >= req.totalMtrRequired ? 'Sufficient' :
                currentStock > 0 ? 'Short' : 'No Stock'
      };
    }).sort((a, b) => a.fabricQuality.localeCompare(b.fabricQuality));

    res.status(200).json({ success: true, data: result, totalJobs: jobs.length });
  } catch (error) {
    console.error('Error calculating fabric requirement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const importStock = async (req, res) => {
  try {
    const rows = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ success: false, error: 'Request body must be an array of rows.' });
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfPrevMonth = new Date(startOfMonth.getTime() - 1000);
    const createdTransactions = [];

    for (const row of rows) {
      const fabricQuality = String(row.fabricQuality || '').trim().toUpperCase();
      const panna = String(row.panna || '').trim();

      if (!fabricQuality) continue;

      // Find all transactions for this fabric + panna
      const query = {
        fabricQuality: new RegExp(`^${fabricQuality}$`, 'i')
      };
      if (panna) {
        query.panna = new RegExp(`^${panna}$`, 'i');
      } else {
        query.panna = { $in: [null, '', undefined] };
      }

      const txs = await FabricTransaction.find(query);

      let dbOpeningStock = 0;
      let dbInward = 0;
      let dbOutward = 0;

      txs.forEach(t => {
        const tDate = new Date(t.date);
        const isPrev = tDate < startOfMonth;
        const isAdj = t.notes && t.notes.includes('Adjustment');

        if (isPrev) {
          if (t.type === 'INWARD') dbOpeningStock += t.qty;
          else dbOpeningStock -= t.qty;
        } else {
          if (t.type === 'INWARD') {
            if (!isAdj) dbInward += t.qty;
          } else {
            if (!isAdj) dbOutward += t.qty;
          }
        }
      });

      const csvOpening = (row.openingStock !== undefined && row.openingStock !== null && row.openingStock !== '') ? parseFloat(row.openingStock) : null;
      const csvInward = (row.inwardQty !== undefined && row.inwardQty !== null && row.inwardQty !== '') ? parseFloat(row.inwardQty) : null;
      let csvOutward = (row.outwardQty !== undefined && row.outwardQty !== null && row.outwardQty !== '') ? parseFloat(row.outwardQty) : null;
      
      // Rule: Add +2% in outwards for FRENCH CREPE inserted from sheet
      if (csvOutward !== null && !isNaN(csvOutward) && csvOutward > 0 && (fabricQuality.includes('CREPE') || fabricQuality.includes('CRAPE') || fabricQuality.includes('FRENCH'))) {
        csvOutward = Number((csvOutward * 1.02).toFixed(2));
      }

      const csvCurrent = (row.currentStock !== undefined && row.currentStock !== null && row.currentStock !== '') ? parseFloat(row.currentStock) : null;

      // Extract metadata fields
      const txDate = row.date ? new Date(row.date) : null;
      const challanNo = row.challanNo || undefined;
      const vendorName = row.vendorName || undefined;
      const jobNo = row.jobNo || undefined;
      const partyName = row.partyName || undefined;
      const notes = row.notes || undefined;

      // Adjust Opening Stock
      if (csvOpening !== null && !isNaN(csvOpening)) {
        const diff = csvOpening - dbOpeningStock;
        if (Math.abs(diff) > 0.01) {
          const t = new FabricTransaction({
            type: diff > 0 ? 'INWARD' : 'OUTWARD',
            fabricQuality,
            panna,
            qty: Math.abs(diff),
            date: txDate || endOfPrevMonth,
            notes: notes || 'CSV Opening Stock Adjustment',
            challanNo,
            vendorName: diff > 0 ? vendorName : undefined,
            jobNo: diff < 0 ? jobNo : undefined,
            partyName: diff < 0 ? partyName : undefined
          });
          await t.save();
          createdTransactions.push(t);
          dbOpeningStock = csvOpening;
        }
      }

      // Adjust Inward
      if (csvInward !== null && !isNaN(csvInward)) {
        const diff = csvInward - dbInward;
        if (Math.abs(diff) > 0.01) {
          const t = new FabricTransaction({
            type: diff > 0 ? 'INWARD' : 'OUTWARD',
            fabricQuality,
            panna,
            qty: Math.abs(diff),
            date: txDate || new Date(),
            notes: notes || 'CSV Inward Adjustment',
            challanNo,
            vendorName: diff > 0 ? vendorName : undefined,
            jobNo: diff < 0 ? jobNo : undefined,
            partyName: diff < 0 ? partyName : undefined
          });
          await t.save();
          createdTransactions.push(t);
          dbInward = csvInward;
        }
      }

      // Adjust Outward
      if (csvOutward !== null && !isNaN(csvOutward)) {
        const diff = csvOutward - dbOutward;
        if (Math.abs(diff) > 0.01) {
          const t = new FabricTransaction({
            type: diff > 0 ? 'OUTWARD' : 'INWARD',
            fabricQuality,
            panna,
            qty: Math.abs(diff),
            date: txDate || new Date(),
            notes: notes || 'CSV Outward Adjustment',
            challanNo,
            vendorName: diff < 0 ? vendorName : undefined,
            jobNo: diff > 0 ? jobNo : undefined,
            partyName: diff > 0 ? partyName : undefined
          });
          await t.save();
          createdTransactions.push(t);
          dbOutward = csvOutward;
        }
      }

      // Adjust Current Stock if it still doesn't match
      if (csvCurrent !== null && !isNaN(csvCurrent)) {
        const computedCurrent = dbOpeningStock + dbInward - dbOutward;
        const diff = csvCurrent - computedCurrent;
        if (Math.abs(diff) > 0.01) {
          const t = new FabricTransaction({
            type: diff > 0 ? 'INWARD' : 'OUTWARD',
            fabricQuality,
            panna,
            qty: Math.abs(diff),
            date: txDate || new Date(),
            notes: notes || 'CSV Current Stock Adjustment',
            challanNo,
            vendorName: diff > 0 ? vendorName : undefined,
            jobNo: diff < 0 ? jobNo : undefined,
            partyName: diff < 0 ? partyName : undefined
          });
          await t.save();
          createdTransactions.push(t);
        }
      }
    }

    res.status(200).json({ success: true, message: `Stock import completed. Created ${createdTransactions.length} adjustment records.`, count: createdTransactions.length });
  } catch (error) {
    console.error('Error in importStock:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update a transaction by ID
const updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { challanNo, vendorName, fabricQuality, panna, qty, date, notes, jobNo, partyName, lotNo, shortagePct } = req.body;

    const transaction = await FabricTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found.' });
    }

    // Update fields
    if (challanNo !== undefined) transaction.challanNo = challanNo;
    if (vendorName !== undefined) transaction.vendorName = vendorName;
    if (fabricQuality !== undefined) transaction.fabricQuality = fabricQuality;
    if (panna !== undefined) transaction.panna = panna;
    if (qty !== undefined) transaction.qty = qty;
    if (date !== undefined) transaction.date = new Date(date);
    if (notes !== undefined) transaction.notes = notes;
    if (jobNo !== undefined) transaction.jobNo = jobNo;
    if (partyName !== undefined) transaction.partyName = partyName;
    if (lotNo !== undefined) transaction.lotNo = lotNo ? Number(lotNo) : undefined;
    if (shortagePct !== undefined) transaction.shortagePct = shortagePct !== '' && shortagePct != null ? parseFloat(shortagePct) : null;

    await transaction.save();
    res.status(200).json({ success: true, data: transaction });
  } catch (error) {
    console.error('Error updating fabric transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const downloadFabricInwardPdf = async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const path = require('path');
    const fs = require('fs');
    const logoPath = path.join(__dirname, 'Logo.png');
    const { dateStart, dateEnd } = req.query;

    const filter = {
      type: 'INWARD',
      notes: { $not: /Lot Transfer|Lot Rebalance|\[Ref:\s*LT-/i }
    };
    if (dateStart || dateEnd) {
      filter.date = {};
      if (dateStart) filter.date.$gte = new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const transactions = await FabricTransaction.find(filter).sort({ date: -1, lotNo: -1 }).lean();

    const cleanDateStart = dateStart ? dateStart.split('T')[0] : '';
    const cleanDateEnd = dateEnd ? dateEnd.split('T')[0] : '';

    const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Fabric_Inward_Report_${cleanDateStart || 'all'}_to_${cleanDateEnd || 'all'}.pdf"`);
    doc.pipe(res);

    // Header section with Logo (image already includes brand name)
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 30, 14, { width: 110 });
    }

    doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold')
      .text('FABRIC INWARD REPORT', 190, 20, { width: 375, align: 'right' });

    let periodStr = 'Period: All Time';
    if (cleanDateStart && cleanDateEnd) periodStr = `Period: ${cleanDateStart} to ${cleanDateEnd}`;
    else if (cleanDateStart) periodStr = `Period: From ${cleanDateStart}`;
    else if (cleanDateEnd) periodStr = `Period: Until ${cleanDateEnd}`;

    doc.fillColor('#475569').fontSize(8.5).font('Helvetica')
      .text(periodStr, 190, 38, { width: 375, align: 'right' });
    doc.fillColor('#64748b').fontSize(8).font('Helvetica')
      .text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 190, 50, { width: 375, align: 'right' });

    doc.moveTo(30, 62).lineTo(565, 62).strokeColor('#ddd6fe').lineWidth(1.2).stroke();

    let y = 74;

    const totalInwardMtr = transactions.reduce((s, t) => s + (t.qty || 0), 0);
    const totalLotsCount = transactions.length;

    // KPI Cards with Light Purple background & Black numbers
    doc.rect(30, y, 260, 42).fill('#f5f3ff').stroke('#ddd6fe');
    doc.fillColor('#5b21b6').fontSize(7.5).font('Helvetica-Bold').text('TOTAL INWARD LOTS', 35, y + 7);
    doc.fillColor('#000000').fontSize(13).font('Helvetica-Bold').text(String(totalLotsCount), 35, y + 20);

    doc.rect(305, y, 260, 42).fill('#f5f3ff').stroke('#ddd6fe');
    doc.fillColor('#5b21b6').fontSize(7.5).font('Helvetica-Bold').text('TOTAL INWARD METERAGE', 310, y + 7);
    doc.fillColor('#000000').fontSize(13).font('Helvetica-Bold').text(`${totalInwardMtr.toLocaleString('en-IN')} m`, 310, y + 20);

    y += 52;

    const renderTableHeader = (currY) => {
      doc.rect(30, currY, 535, 20).fill('#ede9fe');
      doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold');
      doc.text('DATE', 35, currY + 6);
      doc.text('LOT #', 105, currY + 6);
      doc.text('VENDOR NAME', 155, currY + 6);
      doc.text('VENDOR CH. NO.', 265, currY + 6);
      doc.text('FABRIC & PANNA', 365, currY + 6);
      doc.text('QTY (M)', 490, currY + 6);
    };

    doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold').text('FABRIC INWARD TRANSACTIONS MASTER LIST', 30, y);
    y += 14;

    renderTableHeader(y);
    y += 20;

    transactions.forEach((t, i) => {
      if (y > 750) {
        doc.addPage();
        y = 30;
        renderTableHeader(y);
        y += 20;
      }
      const dt = t.date ? new Date(t.date).toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—';
      const fabStr = `${t.fabricQuality || '—'}${t.panna ? ' (' + t.panna + '")' : ''}`;

      doc.rect(30, y, 535, 18).fill(i % 2 === 0 ? '#fcfaff' : '#ffffff');
      doc.fillColor('#000000').fontSize(8).font('Helvetica');
      doc.text(dt, 35, y + 5);
      doc.text(t.lotNo ? `#${t.lotNo}` : '—', 105, y + 5);
      doc.text(t.vendorName || '—', 155, y + 5, { width: 105, lineBreak: false });
      doc.text(t.challanNo || '—', 265, y + 5, { width: 95, lineBreak: false });
      doc.text(fabStr, 365, y + 5, { width: 120, lineBreak: false });
      doc.fillColor('#15803d').font('Helvetica-Bold').text(`+${(t.qty || 0).toLocaleString('en-IN')} m`, 490, y + 5);
      y += 18;
    });

    if (transactions.length === 0) {
      doc.rect(30, y, 535, 25).fill('#fcfaff');
      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('No fabric inward records found for selected period.', 30, y + 7, { width: 535, align: 'center' });
    }

    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fillColor('#6b21a8').fontSize(8).font('Helvetica')
        .text(`Page ${i + 1} of ${pages.count} — Elite Digital Prints Fabric Inward Report`, 30, 795, { width: 535, align: 'center', lineBreak: false });
    }

    doc.end();
  } catch (err) {
    console.error('Error generating Fabric Inward PDF report:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
  }
};

const downloadFabricOutwardPdf = async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const path = require('path');
    const fs = require('fs');
    const logoPath = path.join(__dirname, 'Logo.png');
    const { dateStart, dateEnd } = req.query;

    const filter = {
      type: 'OUTWARD',
      notes: { $not: /Lot Transfer|Lot Rebalance|\[Ref:\s*LT-/i }
    };
    if (dateStart || dateEnd) {
      filter.date = {};
      if (dateStart) filter.date.$gte = new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const transactions = await FabricTransaction.find(filter).sort({ date: -1 }).lean();

    const cleanDateStart = dateStart ? dateStart.split('T')[0] : '';
    const cleanDateEnd = dateEnd ? dateEnd.split('T')[0] : '';

    const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Fabric_Outward_Report_${cleanDateStart || 'all'}_to_${cleanDateEnd || 'all'}.pdf"`);
    doc.pipe(res);

    // Header section with Logo (image already includes brand name)
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 30, 14, { width: 110 });
    }

    doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold')
      .text('FABRIC OUTWARD REPORT', 190, 20, { width: 375, align: 'right' });

    let periodStr = 'Period: All Time';
    if (cleanDateStart && cleanDateEnd) periodStr = `Period: ${cleanDateStart} to ${cleanDateEnd}`;
    else if (cleanDateStart) periodStr = `Period: From ${cleanDateStart}`;
    else if (cleanDateEnd) periodStr = `Period: Until ${cleanDateEnd}`;

    doc.fillColor('#475569').fontSize(8.5).font('Helvetica')
      .text(periodStr, 190, 38, { width: 375, align: 'right' });
    doc.fillColor('#64748b').fontSize(8).font('Helvetica')
      .text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 190, 50, { width: 375, align: 'right' });

    doc.moveTo(30, 62).lineTo(565, 62).strokeColor('#ddd6fe').lineWidth(1.2).stroke();

    let y = 74;

    const totalOutwardMtr = transactions.reduce((s, t) => s + (t.qty || 0), 0);
    const totalOutwardCount = transactions.length;

    // KPI Cards with Light Purple background & Black numbers
    doc.rect(30, y, 260, 42).fill('#f5f3ff').stroke('#ddd6fe');
    doc.fillColor('#5b21b6').fontSize(7.5).font('Helvetica-Bold').text('TOTAL OUTWARD DISPATCHES', 35, y + 7);
    doc.fillColor('#000000').fontSize(13).font('Helvetica-Bold').text(String(totalOutwardCount), 35, y + 20);

    doc.rect(305, y, 260, 42).fill('#f5f3ff').stroke('#ddd6fe');
    doc.fillColor('#5b21b6').fontSize(7.5).font('Helvetica-Bold').text('TOTAL DISPATCHED METERAGE', 310, y + 7);
    doc.fillColor('#000000').fontSize(13).font('Helvetica-Bold').text(`${totalOutwardMtr.toLocaleString('en-IN')} m`, 310, y + 20);

    y += 52;

    const renderTableHeader = (currY) => {
      doc.rect(30, currY, 535, 20).fill('#ede9fe');
      doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold');
      doc.text('DATE', 35, currY + 6);
      doc.text('LOT #', 85, currY + 6);
      doc.text('PARTY NAME', 130, currY + 6);
      doc.text('BILL TO', 225, currY + 6);
      doc.text('CHALLAN NO.', 320, currY + 6);
      doc.text('FABRIC & PANNA', 395, currY + 6);
      doc.text('SHORTAGE', 465, currY + 6);
      doc.text('QTY (M)', 510, currY + 6);
    };

    doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold').text('FABRIC OUTWARD TRANSACTIONS MASTER LIST', 30, y);
    y += 14;

    renderTableHeader(y);
    y += 20;

    transactions.forEach((t, i) => {
      if (y > 750) {
        doc.addPage();
        y = 30;
        renderTableHeader(y);
        y += 20;
      }
      const dt = t.date ? new Date(t.date).toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—';
      const fabStr = `${t.fabricQuality || '—'}${t.panna ? ' (' + t.panna + '")' : ''}`;
      const chStr = `${t.challanNo || '—'}`;
      let shortageVal = (t.shortagePct !== undefined && t.shortagePct !== null && t.shortagePct !== '') ? t.shortagePct : null;
      if (shortageVal === null && t.notes) {
        const m = String(t.notes).match(/(\d+(?:\.\d+)?)%\s*shortage/i);
        if (m) shortageVal = m[1];
      }
      if (shortageVal === null && t.fabricQuality && (t.fabricQuality.includes('CREPE') || t.fabricQuality.includes('CRAPE') || t.fabricQuality.includes('FRENCH'))) {
        shortageVal = 2;
      }
      const shortageStr = shortageVal != null ? `${shortageVal}%` : '—';

      doc.rect(30, y, 535, 18).fill(i % 2 === 0 ? '#fcfaff' : '#ffffff');
      doc.fillColor('#000000').fontSize(8).font('Helvetica');
      doc.text(dt, 35, y + 5);
      doc.text(t.lotNo ? `#${t.lotNo}` : '—', 85, y + 5);
      doc.text(t.partyName || '—', 130, y + 5, { width: 90, lineBreak: false });
      doc.text(t.billTo || t.partyName || '—', 225, y + 5, { width: 90, lineBreak: false });
      doc.text(chStr, 320, y + 5, { width: 70, lineBreak: false });
      doc.text(fabStr, 395, y + 5, { width: 65, lineBreak: false });
      doc.text(shortageStr, 465, y + 5, { width: 40, lineBreak: false });
      doc.fillColor('#b91c1c').font('Helvetica-Bold').text(`-${(t.qty || 0).toLocaleString('en-IN')} m`, 510, y + 5);
      y += 18;
    });

    if (transactions.length === 0) {
      doc.rect(30, y, 535, 25).fill('#fcfaff');
      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('No fabric outward records found for selected period.', 30, y + 7, { width: 535, align: 'center' });
    }

    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fillColor('#6b21a8').fontSize(8).font('Helvetica')
        .text(`Page ${i + 1} of ${pages.count} — Elite Digital Prints Fabric Outward Report`, 30, 795, { width: 535, align: 'center', lineBreak: false });
    }

    doc.end();
  } catch (err) {
    console.error('Error generating Fabric Outward PDF report:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Helper: Compute lot-wise inventory balance with shortage and date range filtering
async function computeLotWiseData(dateStart, dateEnd, vendorRegex = null) {
  const dsStr = dateStart ? String(dateStart).split('T')[0] : '';
  const deStr = dateEnd ? String(dateEnd).split('T')[0] : '';

  const dateFilter = {};
  if (dsStr || deStr) {
    dateFilter.date = {};
    if (dsStr) {
      const dLocal = new Date(`${dsStr}T00:00:00.000`);
      const dUtc = new Date(`${dsStr}T00:00:00.000Z`);
      const minStart = !isNaN(dLocal.getTime()) && !isNaN(dUtc.getTime()) ? (dLocal < dUtc ? dLocal : dUtc) : (dLocal || dUtc);
      if (minStart && !isNaN(minStart.getTime())) dateFilter.date.$gte = minStart;
    }
    if (deStr) {
      const dLocal = new Date(`${deStr}T23:59:59.999`);
      const dUtc = new Date(`${deStr}T23:59:59.999Z`);
      const maxEnd = !isNaN(dLocal.getTime()) && !isNaN(dUtc.getTime()) ? (dLocal > dUtc ? dLocal : dUtc) : (dLocal || dUtc);
      if (maxEnd && !isNaN(maxEnd.getTime())) dateFilter.date.$lte = maxEnd;
    }
  }

  const vendorQuery = vendorRegex ? {
    $or: [
      { vendorName: { $regex: new RegExp(vendorRegex, 'i') } },
      { partyName: { $regex: new RegExp(vendorRegex, 'i') } }
    ]
  } : {};

  // Find distinct lot numbers active in date range (if dateStart/dateEnd provided)
  let activeLotNos = null;
  if (dsStr || deStr) {
    activeLotNos = await FabricTransaction.distinct('lotNo', {
      lotNo: { $ne: null },
      ...dateFilter,
      ...vendorQuery
    });
  }

  // Fetch all transactions for active lots (or all lots) up to dateEnd
  const txFilter = { lotNo: { $ne: null }, ...vendorQuery };
  if (activeLotNos !== null) {
    txFilter.lotNo = { $in: activeLotNos };
  } else if (deStr) {
    const end = new Date(`${deStr}T23:59:59.999Z`);
    if (!isNaN(end.getTime())) txFilter.date = { $lte: end };
  }

  const allTxs = await FabricTransaction.find(txFilter).sort({ lotNo: 1, date: 1 }).lean();

  const lotMap = {};
  for (const t of allTxs) {
    const lot = t.lotNo;
    if (!lot) continue;

    if (!lotMap[lot]) {
      lotMap[lot] = {
        lotNo: lot,
        fabricQuality: t.fabricQuality || '',
        panna: t.panna || '',
        vendorName: t.vendorName || '',
        vendorChallanNo: t.challanNo || '',
        totalInward: 0,
        totalOutward: 0,
        firstDate: t.date
      };
    }

    if (t.vendorName && !lotMap[lot].vendorName) lotMap[lot].vendorName = t.vendorName;
    if (t.challanNo && !lotMap[lot].vendorChallanNo) lotMap[lot].vendorChallanNo = t.challanNo;

    if (t.type === 'INWARD') {
      lotMap[lot].totalInward += (t.qty || 0);
    } else if (t.type === 'OUTWARD') {
      const pct = (t.shortagePct !== undefined && t.shortagePct !== null && t.shortagePct !== '')
        ? parseFloat(t.shortagePct)
        : ((t.fabricQuality && (t.fabricQuality.includes('CREPE') || t.fabricQuality.includes('CRAPE') || t.fabricQuality.includes('FRENCH'))) ? 2 : 0);
      const outwardWithShortage = (t.qty || 0) * (1 + pct / 100);
      lotMap[lot].totalOutward += outwardWithShortage;
    }
  }

  const result = Object.values(lotMap).map(l => {
    const rawInward = Number(l.totalInward.toFixed(2));
    const rawOutward = Number(l.totalOutward.toFixed(2));
    let rawStock = Number((rawInward - rawOutward).toFixed(2));

    // Rule: 0 <= stock <= 5 makes stock 0 (negative stock stays negative)
    if (rawStock >= 0 && rawStock <= 5) {
      rawStock = 0;
    }

    return {
      lotNo: l.lotNo,
      fabricQuality: l.fabricQuality,
      panna: l.panna,
      vendorName: l.vendorName,
      vendorChallanNo: l.vendorChallanNo,
      totalInward: rawInward,
      totalOutward: rawOutward,
      currentStock: rawStock,
      firstDate: l.firstDate
    };
  }).filter(l => l.currentStock !== 0 || (l.totalInward > 0 || l.totalOutward > 0))
    .sort((a, b) => a.lotNo - b.lotNo);

  return result;
}

const downloadFabricLotWisePdf = async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const path = require('path');
    const fs = require('fs');
    const logoPath = path.join(__dirname, 'Logo.png');
    const { dateStart, dateEnd } = req.query;

    const lots = await computeLotWiseData(dateStart, dateEnd);

    const cleanDateStart = dateStart ? dateStart.split('T')[0] : '';
    const cleanDateEnd = dateEnd ? dateEnd.split('T')[0] : '';

    const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Lotwise_Fabric_Report_${cleanDateStart || 'all'}_to_${cleanDateEnd || 'all'}.pdf"`);
    doc.pipe(res);

    // Header section with Logo
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 30, 20, { width: 140 });
    }

    doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold')
      .text('LOT-WISE FABRIC BALANCE REPORT', 190, 25, { width: 375, align: 'right' });

    let periodStr = 'Period: All Time';
    if (cleanDateStart && cleanDateEnd) periodStr = `Period: ${cleanDateStart} to ${cleanDateEnd}`;
    else if (cleanDateStart) periodStr = `Period: From ${cleanDateStart}`;
    else if (cleanDateEnd) periodStr = `Period: Until ${cleanDateEnd}`;

    doc.fillColor('#475569').fontSize(8.5).font('Helvetica')
      .text(periodStr, 190, 43, { width: 375, align: 'right' });
    doc.fillColor('#64748b').fontSize(8).font('Helvetica')
      .text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 190, 56, { width: 375, align: 'right' });

    doc.moveTo(30, 72).lineTo(565, 72).strokeColor('#ddd6fe').lineWidth(1.5).stroke();

    let y = 84;

    const totalInwardM = lots.reduce((s, l) => s + (l.totalInward || 0), 0);
    const totalOutwardM = lots.reduce((s, l) => s + (l.totalOutward || 0), 0);
    const totalRemainingM = lots.reduce((s, l) => s + Math.max(0, l.currentStock || 0), 0);

    // KPI Cards with Light Purple background & Black numbers
    doc.rect(30, y, 125, 42).fill('#f5f3ff').stroke('#ddd6fe');
    doc.fillColor('#5b21b6').fontSize(7.5).font('Helvetica-Bold').text('TOTAL LOTS TRACKED', 35, y + 7);
    doc.fillColor('#000000').fontSize(13).font('Helvetica-Bold').text(String(lots.length), 35, y + 20);

    doc.rect(165, y, 125, 42).fill('#f5f3ff').stroke('#ddd6fe');
    doc.fillColor('#5b21b6').fontSize(7.5).font('Helvetica-Bold').text('TOTAL INWARD (M)', 170, y + 7);
    doc.fillColor('#000000').fontSize(13).font('Helvetica-Bold').text(`${totalInwardM.toLocaleString('en-IN')} m`, 170, y + 20);

    doc.rect(300, y, 135, 42).fill('#f5f3ff').stroke('#ddd6fe');
    doc.fillColor('#5b21b6').fontSize(7.5).font('Helvetica-Bold').text('TOTAL OUTWARD (M)', 305, y + 7);
    doc.fillColor('#000000').fontSize(13).font('Helvetica-Bold').text(`${totalOutwardM.toLocaleString('en-IN')} m`, 305, y + 20);

    doc.rect(445, y, 120, 42).fill('#f5f3ff').stroke('#ddd6fe');
    doc.fillColor('#5b21b6').fontSize(7.5).font('Helvetica-Bold').text('NET BALANCE IN STOCK', 450, y + 7);
    doc.fillColor('#000000').fontSize(13).font('Helvetica-Bold').text(`${totalRemainingM.toLocaleString('en-IN')} m`, 450, y + 20);

    y += 52;

    const renderTableHeader = (currY) => {
      doc.rect(30, currY, 535, 20).fill('#ede9fe');
      doc.fillColor('#000000').fontSize(7.8).font('Helvetica-Bold');
      doc.text('LOT #', 35, currY + 6);
      doc.text('FABRIC & PANNA', 85, currY + 6);
      doc.text('VENDOR NAME', 195, currY + 6);
      doc.text('INWARD (M)', 295, currY + 6);
      doc.text('OUTWARD WITH SHORTAGE (M)', 375, currY + 6);
      doc.text('CURRENT STOCK', 495, currY + 6);
    };

    doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold').text('LOT-WISE FABRIC STOCK BALANCE LIST', 30, y);
    y += 14;

    renderTableHeader(y);
    y += 20;

    lots.forEach((l, i) => {
      if (y > 750) {
        doc.addPage();
        y = 30;
        renderTableHeader(y);
        y += 20;
      }
      const fabStr = `${l.fabricQuality || '—'}${l.panna ? ' (' + l.panna + '")' : ''}`;
      const stockVal = l.currentStock || 0;

      doc.rect(30, y, 535, 18).fill(i % 2 === 0 ? '#fcfaff' : '#ffffff');
      doc.fillColor('#000000').fontSize(8).font('Helvetica');
      doc.text(`#${l.lotNo}`, 35, y + 5);
      doc.text(fabStr, 85, y + 5, { width: 105, lineBreak: false });
      doc.text(l.vendorName || '—', 195, y + 5, { width: 95, lineBreak: false });
      doc.text(`+${(l.totalInward || 0).toLocaleString('en-IN')} m`, 295, y + 5);
      doc.text(`-${(l.totalOutward || 0).toLocaleString('en-IN')} m`, 375, y + 5);
      doc.fillColor(stockVal > 0 ? '#15803d' : stockVal < 0 ? '#b91c1c' : '#64748b').font('Helvetica-Bold').text(`${stockVal.toLocaleString('en-IN')} m`, 495, y + 5);
      y += 18;
    });

    if (lots.length === 0) {
      doc.rect(30, y, 535, 25).fill('#fcfaff');
      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('No lot-wise fabric balance records found for selected period.', 30, y + 7, { width: 535, align: 'center' });
    }

    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fillColor('#6b21a8').fontSize(8).font('Helvetica')
        .text(`Page ${i + 1} of ${pages.count} — Elite Digital Prints Lot-Wise Fabric Report`, 30, 795, { width: 535, align: 'center', lineBreak: false });
    }

    doc.end();
  } catch (err) {
    console.error('Error generating Lot-Wise Fabric PDF report:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getFabricInwardReportData = async (req, res) => {
  try {
    const { dateStart, dateEnd } = req.query;
    const filter = {
      type: 'INWARD',
      notes: { $not: /Lot Transfer|Lot Rebalance|\[Ref:\s*LT-/i }
    };
    if (dateStart || dateEnd) {
      filter.date = {};
      if (dateStart) filter.date.$gte = new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }
    const transactions = await FabricTransaction.find(filter).sort({ date: -1, lotNo: -1 }).lean();
    res.status(200).json({ success: true, data: transactions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getFabricOutwardReportData = async (req, res) => {
  try {
    const { dateStart, dateEnd } = req.query;
    const filter = {
      type: 'OUTWARD',
      notes: { $not: /Lot Transfer|Lot Rebalance|\[Ref:\s*LT-/i }
    };
    if (dateStart || dateEnd) {
      filter.date = {};
      if (dateStart) filter.date.$gte = new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }
    const transactions = await FabricTransaction.find(filter).sort({ date: -1 }).lean();
    res.status(200).json({ success: true, data: transactions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getFabricLotWiseReportData = async (req, res) => {
  try {
    const { dateStart, dateEnd } = req.query;
    const lots = await computeLotWiseData(dateStart, dateEnd);
    res.status(200).json({ success: true, data: lots });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const downloadFabricCombinedReportPdf = async (req, res) => {
  try {
    const { dateStart, dateEnd, reports, startTime, stopTime, operator } = req.query;
    const PDFDocument = require('pdfkit');
    const path = require('path');
    const fs = require('fs');

    const FabricChallan = require('../db/models/fabricChallan.model');
    const JobPrintLog = require('../db/models/jobPrintLog.model');
    const JobCard = require('../db/models/jobCard.model');
    const RawMaterialTransaction = require('../db/models/rawMaterialTransaction.model');
    const PrintConfig = require('../db/models/printConfig.model');

    const selectedReports = reports
      ? reports.split(',').map(s => s.trim().toLowerCase())
      : ['challan', 'inward', 'outward', 'lotwise', 'stock', 'machine'];

    const dsStr = dateStart ? String(dateStart).split('T')[0] : '';
    const deStr = dateEnd ? String(dateEnd).split('T')[0] : '';

    const dateFilter = {};
    if (dsStr || deStr) {
      dateFilter.date = {};
      if (dsStr) {
        const dLocal = new Date(`${dsStr}T00:00:00.000`);
        const dUtc = new Date(`${dsStr}T00:00:00.000Z`);
        const minStart = !isNaN(dLocal.getTime()) && !isNaN(dUtc.getTime()) ? (dLocal < dUtc ? dLocal : dUtc) : (dLocal || dUtc);
        if (minStart && !isNaN(minStart.getTime())) dateFilter.date.$gte = minStart;
      }
      if (deStr) {
        const dLocal = new Date(`${deStr}T23:59:59.999`);
        const dUtc = new Date(`${deStr}T23:59:59.999Z`);
        const maxEnd = !isNaN(dLocal.getTime()) && !isNaN(dUtc.getTime()) ? (dLocal > dUtc ? dLocal : dUtc) : (dLocal || dUtc);
        if (maxEnd && !isNaN(maxEnd.getTime())) dateFilter.date.$lte = maxEnd;
      }
    }

    const lotTransferExclude = { notes: { $not: /Lot Transfer|Lot Rebalance|\[Ref:\s*LT-/i } };
    const deptFilter = { department: 'digital_print' };

    let inwardData = [];
    if (selectedReports.includes('inward')) {
      inwardData = await FabricTransaction.find({ type: 'INWARD', ...deptFilter, ...dateFilter, ...lotTransferExclude }).sort({ date: -1 }).lean();
    }

    let outwardData = [];
    if (selectedReports.includes('outward')) {
      outwardData = await FabricTransaction.find({ type: 'OUTWARD', ...deptFilter, ...dateFilter, ...lotTransferExclude }).sort({ date: -1 }).lean();
    }

    let challanData = [];
    if (selectedReports.includes('challan')) {
      challanData = await FabricChallan.find({
        $or: [
          { companyEntity: { $in: ['Elite Digital Print', 'Elite Digital Prints'] } },
          { companyEntity: { $exists: false } },
          { companyEntity: null },
          { companyEntity: '' }
        ],
        ...dateFilter
      }).sort({ date: -1 }).lean();
    }

    let lotwiseData = [];
    if (selectedReports.includes('lotwise')) {
      lotwiseData = await computeLotWiseData(dateStart, dateEnd, null);
    }

    let stockSummaryData = [];
    if (selectedReports.includes('stock')) {
      const stockPipeline = [
        {
          $group: {
            _id: '$fabricQuality',
            totalInward: { $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] } },
            totalOutward: { $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] } }
          }
        },
        {
          $project: {
            fabricQuality: '$_id',
            totalInward: 1,
            totalOutward: 1,
            currentStock: { $subtract: ['$totalInward', '$totalOutward'] },
            _id: 0
          }
        },
        { $match: { fabricQuality: { $ne: null } } },
        { $sort: { fabricQuality: 1 } }
      ];
      stockSummaryData = await FabricTransaction.aggregate(stockPipeline);
    }

    let machineData = [];
    let totalMachinePrintedMtr = 0;
    let totalMachineJobCardCount = 0;
    let morningMachinePrintedMtr = 0;
    let nightMachinePrintedMtr = 0;
    let rawMaterialLogs = [];
    let detailedPrintLogsList = [];

    if (selectedReports.includes('machine') || selectedReports.includes('machine_print')) {
      let logDateFilter = {};
      if (dsStr || deStr) {
        const dsLocal = dsStr ? new Date(`${dsStr}T00:00:00.000`) : null;
        const deLocal = deStr ? new Date(`${deStr}T23:59:59.999`) : null;

        const dsUtc = dsStr ? new Date(`${dsStr}T00:00:00.000Z`) : null;
        const deUtc = deStr ? new Date(`${deStr}T23:59:59.999Z`) : null;

        const dateConditions = [];
        if (dsStr && deStr) {
          dateConditions.push({ date: { $gte: dsLocal, $lte: deLocal } });
          dateConditions.push({ date: { $gte: dsUtc, $lte: deUtc } });
          dateConditions.push({ date: { $gte: dsStr, $lte: deStr } });
        } else if (dsStr) {
          dateConditions.push({ date: { $gte: dsLocal } });
          dateConditions.push({ date: { $gte: dsUtc } });
          dateConditions.push({ date: { $gte: dsStr } });
        } else if (deStr) {
          dateConditions.push({ date: { $lte: deLocal } });
          dateConditions.push({ date: { $lte: deUtc } });
          dateConditions.push({ date: { $lte: deStr } });
        }
        if (dateConditions.length > 0) {
          logDateFilter = { $or: dateConditions };
        }
      }

      const { machineName: qMachine, shift: qShift, operatorName: qOperator, pass: qPass } = req.query;
      if (qMachine) {
        logDateFilter.machineName = { $regex: qMachine.trim(), $options: 'i' };
      }
      if (qShift && qShift.trim() !== '' && qShift.toLowerCase() !== 'all') {
        logDateFilter.shift = { $regex: qShift.trim(), $options: 'i' };
      }
      if (qOperator) {
        logDateFilter.operatorName = { $regex: qOperator.trim(), $options: 'i' };
      }
      if (qPass) {
        logDateFilter.pass = { $regex: qPass.trim(), $options: 'i' };
      }

      // 1. Fetch print logs strictly from JobPrintLog collection (Machine Printing Entry & Logs Screen)
      const printLogs = await JobPrintLog.find(logDateFilter).sort({ date: -1, created_date_time: -1 }).lean();

      // 1B. Fetch ALL Raw Material (INWARD & OUTWARD) logs for selected date range
      let rawMaterialDateFilter = {};
      if (dsStr || deStr) {
        const dsLocal = dsStr ? new Date(`${dsStr}T00:00:00.000`) : null;
        const deLocal = deStr ? new Date(`${deStr}T23:59:59.999`) : null;

        const dsUtc = dsStr ? new Date(`${dsStr}T00:00:00.000Z`) : null;
        const deUtc = deStr ? new Date(`${deStr}T23:59:59.999Z`) : null;

        const rawConditions = [];
        if (dsStr && deStr) {
          rawConditions.push({ date: { $gte: dsLocal, $lte: deLocal } });
          rawConditions.push({ date: { $gte: dsUtc, $lte: deUtc } });
          rawConditions.push({ date: { $gte: dsStr, $lte: deStr } });
        } else if (dsStr) {
          rawConditions.push({ date: { $gte: dsLocal } });
          rawConditions.push({ date: { $gte: dsUtc } });
          rawConditions.push({ date: { $gte: dsStr } });
        } else if (deStr) {
          rawConditions.push({ date: { $lte: deLocal } });
          rawConditions.push({ date: { $lte: deUtc } });
          rawConditions.push({ date: { $lte: deStr } });
        }
        if (rawConditions.length > 0) {
          rawMaterialDateFilter = { $or: rawConditions };
        }
      }

      const rawCompFilter = {
        $or: [
          { companyEntity: { $in: ['Elite Digital Print', 'Elite Digital Prints'] } },
          { companyEntity: { $exists: false } },
          { companyEntity: null },
          { companyEntity: '' }
        ]
      };
      const finalRawFilter = Object.keys(rawMaterialDateFilter).length > 0
        ? { $and: [rawCompFilter, rawMaterialDateFilter] }
        : rawCompFilter;

      rawMaterialLogs = await RawMaterialTransaction.find(finalRawFilter).sort({ date: -1, createdAt: -1 }).lean();

      // 2. Fetch all job cards to map client/party name and design name
      const allJobCardsList = await JobCard.find({}).select('jobNo party designName designNo').lean();
      const jobCardMapByNo = {};
      const jobCardMapById = {};
      allJobCardsList.forEach(c => {
        if (c.jobNo) jobCardMapByNo[String(c.jobNo).trim()] = c;
        if (c._id) jobCardMapById[String(c._id)] = c;
      });

      detailedPrintLogsList = printLogs.map(l => {
        const matched = (l.jobCardId && jobCardMapById[String(l.jobCardId)]) || (l.jobNo && jobCardMapByNo[String(l.jobNo).trim()]);
        return {
          dateStr: l.date ? new Date(l.date).toLocaleDateString('en-IN') : '—',
          shift: l.shift || 'General',
          jobNo: l.jobNo || '—',
          party: matched ? (matched.party || '—') : '—',
          design: matched ? (matched.designName || matched.designNo || '—') : '—',
          machineName: l.machineName || '—',
          pass: l.pass || '—',
          meters: Number(l.meters) || 0,
          operatorName: l.operatorName || '—',
          notes: l.notes || '—'
        };
      });

      // Map to group strictly by machineName + pass from actual JobPrintLog entries
      const machineMap = {};
      const globalJobSet = new Set();
      morningMachinePrintedMtr = 0;
      nightMachinePrintedMtr = 0;

      printLogs.forEach(log => {
        const mName = (log.machineName || 'Unknown Machine').trim();
        const passName = (log.pass || 'Standard').trim();
        const key = `${mName.toUpperCase()}__${passName.toUpperCase()}`;

        if (!machineMap[key]) {
          machineMap[key] = {
            machineName: mName,
            pass: passName,
            totalMtr: 0,
            jobNos: new Set(),
            logCount: 0
          };
        }

        const mtr = Number(log.meters) || 0;
        machineMap[key].totalMtr += mtr;
        machineMap[key].logCount += 1;
        if (log.jobNo) {
          machineMap[key].jobNos.add(log.jobNo);
          globalJobSet.add(log.jobNo);
        }

        const sStr = String(log.shift || '').toLowerCase();
        if (sStr.includes('night')) {
          nightMachinePrintedMtr += mtr;
        } else {
          morningMachinePrintedMtr += mtr;
        }
      });

      // Convert machineMap to array and calculate exact totals
      machineData = Object.values(machineMap).map(item => {
        totalMachinePrintedMtr += item.totalMtr;
        return {
          machineName: item.machineName,
          pass: item.pass,
          totalMtr: item.totalMtr,
          jobCardCount: item.jobNos.size,
          logCount: item.logCount
        };
      });

      // Sort by machineName then pass
      machineData.sort((a, b) => a.machineName.localeCompare(b.machineName) || a.pass.localeCompare(b.pass));

      totalMachineJobCardCount = globalJobSet.size;
    }

    const totalInwardMtr = inwardData.reduce((s, r) => s + (r.qty || 0), 0);
    const totalOutwardMtr = outwardData.reduce((s, r) => s + (r.qty || 0), 0);
    const totalChallanMtr = challanData.reduce((s, c) => s + (c.totalMtr || 0), 0);
    const totalChallanTp = challanData.reduce((s, c) => s + (c.totalTp || 0), 0);
    const totalLotNetStock = lotwiseData.reduce((s, l) => s + Math.max(0, l.currentStock || 0), 0);

    // ── MTD & WTD (Month-Till-Date & Week-Till-Date) Calculations ──
    const refDate = deStr ? new Date(`${deStr}T23:59:59.999`) : new Date();
    const dayOfWeek = refDate.getDay();
    const distToMonday = (dayOfWeek + 6) % 7;
    const wtdStart = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - distToMonday, 0, 0, 0, 0);
    const wtdEnd = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59, 999);

    const mtdStart = new Date(refDate.getFullYear(), refDate.getMonth(), 1, 0, 0, 0, 0);
    const mtdEnd = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59, 999);
    const mtdDateFilter = { date: { $gte: mtdStart, $lte: mtdEnd } };

    const mtdInwardData = await FabricTransaction.find({ type: 'INWARD', ...mtdDateFilter, ...lotTransferExclude }).lean();
    const mtdOutwardData = await FabricTransaction.find({ type: 'OUTWARD', ...mtdDateFilter, ...lotTransferExclude }).lean();
    const mtdChallanData = await FabricChallan.find({ ...mtdDateFilter }).lean();

    const mtdTotalInwardMtr = mtdInwardData.reduce((s, r) => s + (r.qty || 0), 0);
    const mtdTotalOutwardMtr = mtdOutwardData.reduce((s, r) => s + (r.qty || 0), 0);
    const mtdTotalChallanMtr = mtdChallanData.reduce((s, c) => s + (c.totalMtr || 0), 0);
    const mtdTotalChallanTp = mtdChallanData.reduce((s, c) => s + (c.totalTp || 0), 0);

    // Calculate WTD & MTD Machine Printed Meters
    const wtdPrintLogs = await JobPrintLog.find({
      $or: [
        { date: { $gte: wtdStart, $lte: wtdEnd } },
        { created_date_time: { $gte: wtdStart, $lte: wtdEnd } }
      ]
    }).lean();
    const wtdMachinePrintedMtr = wtdPrintLogs.reduce((s, l) => s + (Number(l.meters) || 0), 0);

    const mtdPrintLogs = await JobPrintLog.find({
      $or: [
        { date: { $gte: mtdStart, $lte: mtdEnd } },
        { created_date_time: { $gte: mtdStart, $lte: mtdEnd } }
      ]
    }).lean();
    const mtdMachinePrintedMtr = mtdPrintLogs.reduce((s, l) => s + (Number(l.meters) || 0), 0);

    const doc = new PDFDocument({ margin: 25, size: 'A4', autoFirstPage: true, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Elite_Digital_Prints_1_Page_Report.pdf"');
    doc.pipe(res);

    const PW = 595, PH = 842, ML = 30, MR = 30;
    const contentWidth = PW - ML - MR;
    const maxY = 770;

    const startDateStr = dsStr ? new Date(`${dsStr}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'All Time';
    const endDateStr = deStr ? new Date(`${deStr}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Present';
    const logoPath = path.join(__dirname, 'Logo.png');

    let startTimeVal = startTime || '';
    let stopTimeVal = stopTime || '';

    // 1. Search in rawMaterialLogs for selected date
    if ((!startTimeVal || !stopTimeVal) && typeof rawMaterialLogs !== 'undefined' && rawMaterialLogs && rawMaterialLogs.length > 0) {
      rawMaterialLogs.forEach(log => {
        if (log.notes) {
          const tm = log.notes.match(/Time:\s*([^\s|]+(?:\s*[AP]M)?)\s*(?:to|-)\s*([^\s|]+(?:\s*[AP]M)?)/i) ||
                     log.notes.match(/(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*(?:to|-)\s*(\d{1,2}:\d{2}(?:\s*[AP]M)?)/i);
          if (tm) {
            if (!startTimeVal) startTimeVal = tm[1];
            if (!stopTimeVal) stopTimeVal = tm[2];
          }
        }
      });
    }

    // 2. Fallback: Search all recent OUTWARD raw material transactions if date filter was narrow
    if (!startTimeVal || !stopTimeVal) {
      const allOutwardLogs = await RawMaterialTransaction.find({ type: 'OUTWARD' }).sort({ date: -1, createdAt: -1 }).limit(100).lean();
      allOutwardLogs.forEach(log => {
        if (log.notes) {
          const tm = log.notes.match(/Time:\s*([^\s|]+(?:\s*[AP]M)?)\s*(?:to|-)\s*([^\s|]+(?:\s*[AP]M)?)/i) ||
                     log.notes.match(/(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*(?:to|-)\s*(\d{1,2}:\d{2}(?:\s*[AP]M)?)/i);
          if (tm) {
            if (!startTimeVal) startTimeVal = tm[1];
            if (!stopTimeVal) stopTimeVal = tm[2];
          }
        }
      });
    }

    // Default fallbacks to prevent report generation block
    if (!startTimeVal) startTimeVal = '09:00 AM';
    if (!stopTimeVal) stopTimeVal = '09:00 PM';

    const drawPageHeader = (isFirstPage = false) => {
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, ML, 14, { width: 110 });
      }

      doc.fillColor('#000000').fontSize(13).font('Helvetica-Bold')
        .text('ELITE DIGITAL PRINTS — PRINTING REPORT', ML + 130, 16, { width: contentWidth - 130, align: 'right' });

      let timeText = `Report Period: ${startDateStr} to ${endDateStr}`;
      if (startTimeVal || stopTimeVal) timeText += ` | Shift Time: ${startTimeVal || '—'} to ${stopTimeVal || '—'}`;
      if (operator) timeText += ` | Operator: ${operator}`;

      doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold')
        .text(timeText, ML + 130, 34, { width: contentWidth - 130, align: 'right' });

      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica')
        .text(`Generated: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`, ML + 130, 47, { width: contentWidth - 130, align: 'right' });

      doc.moveTo(ML, 62).lineTo(PW - MR, 62).strokeColor('#ddd6fe').lineWidth(1.2).stroke();
    };

    drawPageHeader(true);

    const isPrintingReportOnly = (selectedReports.includes('machine') || selectedReports.includes('machine_print')) && selectedReports.length <= 1;

    let currentY = 68;

    if (isPrintingReportOnly) {
      // Single horizontal line with 4 Cards Side-by-Side: Morning, Night, Total, MTD
      const printingKpiCards = [
        { label: 'MORNING SHIFT', val: `${morningMachinePrintedMtr.toFixed(2)} mtr`, sub: 'Morning Shift' },
        { label: 'NIGHT SHIFT', val: `${nightMachinePrintedMtr.toFixed(2)} mtr`, sub: 'Night Shift' },
        { label: 'MACHINE PRINTED', val: `${totalMachinePrintedMtr.toFixed(2)} mtr`, sub: `${totalMachineJobCardCount} Job Cards` },
        { label: 'MTD PRINTED', val: `${mtdMachinePrintedMtr.toFixed(2)} mtr`, sub: 'Month To Till Date' }
      ];

      const gapW = 6;
      const kpiCardW = (contentWidth - (printingKpiCards.length - 1) * gapW) / printingKpiCards.length;
      let cardX = ML;

      printingKpiCards.forEach((card, idx) => {
        // Alternating sequence: Light Blue, Light Purple, Light Blue, Light Purple
        const isBlue = idx % 2 === 0;
        const bg = isBlue ? '#eff6ff' : '#f5f3ff';
        const stroke = isBlue ? '#bfdbfe' : '#ddd6fe';
        const labelColor = isBlue ? '#1e40af' : '#5b21b6';

        doc.rect(cardX, currentY, kpiCardW, 40).fill(bg).stroke(stroke);
        doc.fillColor(labelColor).fontSize(6.8).font('Helvetica-Bold')
          .text(card.label, cardX + 3, currentY + 4, { width: kpiCardW - 6, align: 'center', lineBreak: false });
        doc.fillColor('#0f172a').fontSize(9.0).font('Helvetica-Bold')
          .text(card.val, cardX + 3, currentY + 16, { width: kpiCardW - 6, align: 'center', lineBreak: false });
        doc.fillColor('#475569').fontSize(6.0).font('Helvetica')
          .text(card.sub, cardX + 3, currentY + 28, { width: kpiCardW - 6, align: 'center', lineBreak: false });

        cardX += kpiCardW + gapW;
      });

      currentY += 48;
    } else {
      // Multi-report selected (Challan, Inward, Outward, Machine)
      const periodSections = [
        selectedReports.includes('challan') && { label: 'CHALLAN DISPATCHES', val: `${totalChallanMtr.toFixed(2)} mtr`, sub: `${challanData.length} Challans (${totalChallanTp} TP)` },
        selectedReports.includes('inward') && { label: 'FABRIC INWARD', val: `${totalInwardMtr.toFixed(2)} mtr`, sub: `${inwardData.length} Receipts` },
        selectedReports.includes('outward') && { label: 'FABRIC CONSUMPTION', val: `${totalOutwardMtr.toFixed(2)} mtr`, sub: `${outwardData.length} Dispatches` },
        (selectedReports.includes('machine') || selectedReports.includes('machine_print')) && { label: 'MACHINE PRINTED', val: `${totalMachinePrintedMtr.toFixed(2)} mtr`, sub: `${totalMachineJobCardCount} Job Cards` },
      ].filter(Boolean);

      const cardCount1 = periodSections.length || 1;
      const cardWidth1 = (contentWidth - (cardCount1 - 1) * 6) / cardCount1;
      let cardX1 = ML;

      periodSections.forEach(card => {
        doc.rect(cardX1, 66, cardWidth1, 40).fill('#f5f3ff').stroke('#ddd6fe');
        doc.fillColor('#5b21b6').fontSize(6.8).font('Helvetica-Bold')
          .text(card.label, cardX1 + 3, 70, { width: cardWidth1 - 6, align: 'center', lineBreak: false });
        doc.fillColor('#000000').fontSize(9.2).font('Helvetica-Bold')
          .text(card.val, cardX1 + 3, 82, { width: cardWidth1 - 6, align: 'center', lineBreak: false });
        doc.fillColor('#475569').fontSize(6.0).font('Helvetica')
          .text(card.sub, cardX1 + 3, 94, { width: cardWidth1 - 6, align: 'center', lineBreak: false });
        cardX1 += cardWidth1 + 6;
      });

      const mtdSections = [
        selectedReports.includes('challan') && { label: 'MTD DISPATCHES', val: `${mtdTotalChallanMtr.toFixed(2)} mtr`, sub: `${mtdChallanData.length} Challans (${mtdTotalChallanTp} TP)` },
        selectedReports.includes('inward') && { label: 'MTD INWARD', val: `${mtdTotalInwardMtr.toFixed(2)} mtr`, sub: `${mtdInwardData.length} Receipts` },
        selectedReports.includes('outward') && { label: 'MTD CONSUMPTION', val: `${mtdTotalOutwardMtr.toFixed(2)} mtr`, sub: `${mtdOutwardData.length} Dispatches` },
        (selectedReports.includes('machine') || selectedReports.includes('machine_print')) && { label: 'MTD PRINTED', val: `${mtdMachinePrintedMtr.toFixed(2)} mtr`, sub: 'Month To Till Date' },
      ].filter(Boolean);

      const cardCount2 = mtdSections.length || 1;
      const cardWidth2 = (contentWidth - (cardCount2 - 1) * 6) / cardCount2;
      let cardX2 = ML;

      mtdSections.forEach(card => {
        doc.rect(cardX2, 112, cardWidth2, 40).fill('#eff6ff').stroke('#bfdbfe');
        doc.fillColor('#1e40af').fontSize(6.8).font('Helvetica-Bold')
          .text(card.label, cardX2 + 3, 116, { width: cardWidth2 - 6, align: 'center', lineBreak: false });
        doc.fillColor('#000000').fontSize(9.2).font('Helvetica-Bold')
          .text(card.val, cardX2 + 3, 128, { width: cardWidth2 - 6, align: 'center', lineBreak: false });
        doc.fillColor('#475569').fontSize(6.0).font('Helvetica')
          .text(card.sub, cardX2 + 3, 140, { width: cardWidth2 - 6, align: 'center', lineBreak: false });
        cardX2 += cardWidth2 + 6;
      });

      currentY = 160;
    }

    const checkAddPage = (heightNeeded) => {
      if (currentY + heightNeeded > maxY) {
        doc.addPage();
        drawPageHeader(false);
        currentY = 70;
        return true;
      }
      return false;
    };

    // ── 1. FABRIC CHALLANS DISPATCH OUTWARDS (COMPLETE DATA) ──
    if (selectedReports.includes('challan')) {
      checkAddPage(60);

      doc.rect(ML, currentY, contentWidth, 20).fill('#ede9fe').stroke('#ddd6fe');
      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold')
        .text('1. FABRIC CHALLANS DISPATCH OUTWARDS', ML + 8, currentY + 5, { lineBreak: false });
      doc.fillColor('#5b21b6').fontSize(8.5).font('Helvetica-Bold')
        .text(`Total: ${challanData.length} Records (${totalChallanMtr.toFixed(2)} mtr)`, ML + contentWidth - 220, currentY + 5, { width: 210, align: 'right', lineBreak: false });

      currentY += 24;

      const drawChallanHeaders = () => {
        doc.rect(ML, currentY, contentWidth, 18).fill('#f8fafc').stroke('#cbd5e1');
        doc.fillColor('#000000').fontSize(7.2).font('Helvetica-Bold');
        doc.text('CH. NO', ML + 4, currentY + 5, { width: 44 });
        doc.text('DATE', ML + 50, currentY + 5, { width: 42 });
        doc.text('PARTY NAME', ML + 94, currentY + 5, { width: 96 });
        doc.text('BILLING NAME', ML + 192, currentY + 5, { width: 96 });
        doc.text('JOB NO', ML + 290, currentY + 5, { width: 50 });
        doc.text('DESIGN NO', ML + 342, currentY + 5, { width: 70 });
        doc.text('FABRIC', ML + 414, currentY + 5, { width: 50 });
        doc.text('TP', ML + 466, currentY + 5, { width: 20, align: 'center' });
        doc.text('METERS', ML + 488, currentY + 5, { width: 43, align: 'right' });
        currentY += 18;
      };

      drawChallanHeaders();

      challanData.forEach((c, idx) => {
        if (checkAddPage(20)) {
          drawChallanHeaders();
        }
        const bg = idx % 2 === 0 ? '#ffffff' : '#fcfaff';
        doc.rect(ML, currentY, contentWidth, 18).fill(bg);
        doc.strokeColor('#f1f5f9').lineWidth(0.5).rect(ML, currentY, contentWidth, 18).stroke();

        const dStr = c.date ? new Date(c.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit' }) : '—';
        doc.fillColor('#000000').fontSize(7).font('Helvetica');
        doc.text(`EDP-${c.challanNo || '—'}`, ML + 4, currentY + 4.5, { width: 44, lineBreak: false });
        doc.text(dStr, ML + 50, currentY + 4.5, { width: 42, lineBreak: false });
        doc.text(c.partyName || '—', ML + 94, currentY + 4.5, { width: 96, lineBreak: false });
        doc.text(c.billTo || c.partyName || '—', ML + 192, currentY + 4.5, { width: 96, lineBreak: false });
        doc.text(c.jobNo || '—', ML + 290, currentY + 4.5, { width: 50, lineBreak: false });
        doc.text(c.designNo || '—', ML + 342, currentY + 4.5, { width: 70, lineBreak: false });
        doc.text(c.fabricName || '—', ML + 414, currentY + 4.5, { width: 50, lineBreak: false });
        doc.text(String(c.totalTp || 0), ML + 466, currentY + 4.5, { width: 20, align: 'center', lineBreak: false });
        doc.fillColor('#000000').font('Helvetica-Bold');
        doc.text(`${parseFloat(c.totalMtr || 0).toFixed(2)}`, ML + 488, currentY + 4.5, { width: 43, align: 'right', lineBreak: false });
        currentY += 18;
      });

      currentY += 12;
    }

    // ── 2. FABRIC INWARDS SUMMARY (COMPLETE DATA) ──
    if (selectedReports.includes('inward')) {
      checkAddPage(60);

      doc.rect(ML, currentY, contentWidth, 20).fill('#ede9fe').stroke('#ddd6fe');
      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold')
        .text('2. FABRIC INWARDS SUMMARY', ML + 8, currentY + 5, { lineBreak: false });
      doc.fillColor('#5b21b6').fontSize(8.5).font('Helvetica-Bold')
        .text(`Total: ${inwardData.length} Receipts (${totalInwardMtr.toFixed(2)} mtr)`, ML + contentWidth - 220, currentY + 5, { width: 210, align: 'right', lineBreak: false });

      currentY += 24;

      const drawInwardHeaders = () => {
        doc.rect(ML, currentY, contentWidth, 18).fill('#f8fafc').stroke('#cbd5e1');
        doc.fillColor('#000000').fontSize(7.2).font('Helvetica-Bold');
        doc.text('DATE', ML + 4, currentY + 5, { width: 52 });
        doc.text('VENDOR NAME', ML + 60, currentY + 5, { width: 140 });
        doc.text('VENDOR CHALLAN', ML + 204, currentY + 5, { width: 100 });
        doc.text('FABRIC QUALITY', ML + 308, currentY + 5, { width: 110 });
        doc.text('PANNA', ML + 422, currentY + 5, { width: 35 });
        doc.text('LOT NO', ML + 460, currentY + 5, { width: 35 });
        doc.text('QTY (MTR)', ML + 498, currentY + 5, { width: 33, align: 'right' });
        currentY += 18;
      };

      drawInwardHeaders();

      inwardData.forEach((r, idx) => {
        if (checkAddPage(20)) {
          drawInwardHeaders();
        }
        const bg = idx % 2 === 0 ? '#ffffff' : '#fcfaff';
        doc.rect(ML, currentY, contentWidth, 18).fill(bg);
        doc.strokeColor('#f1f5f9').lineWidth(0.5).rect(ML, currentY, contentWidth, 18).stroke();

        const dStr = r.date ? new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
        doc.fillColor('#000000').fontSize(7).font('Helvetica');
        doc.text(dStr, ML + 4, currentY + 4.5, { width: 52, lineBreak: false });
        doc.text(r.vendorName || '—', ML + 60, currentY + 4.5, { width: 140, lineBreak: false });
        doc.text(r.challanNo || '—', ML + 204, currentY + 4.5, { width: 100, lineBreak: false });
        doc.text(r.fabricQuality || '—', ML + 308, currentY + 4.5, { width: 110, lineBreak: false });
        doc.text(`${r.panna || '58'}"`, ML + 422, currentY + 4.5, { width: 35, lineBreak: false });
        doc.text(r.lotNo ? `#${r.lotNo}` : '—', ML + 460, currentY + 4.5, { width: 35, lineBreak: false });
        doc.fillColor('#047857').font('Helvetica-Bold');
        doc.text(`${parseFloat(r.qty || 0).toFixed(2)}`, ML + 498, currentY + 4.5, { width: 33, align: 'right', lineBreak: false });
        currentY += 18;
      });

      currentY += 12;
    }

    // ── 3. FABRIC CONSUMPTION SUMMARY (COMPLETE DATA WITH SHORTAGE & BILL TO) ──
    if (selectedReports.includes('outward')) {
      checkAddPage(60);

      doc.rect(ML, currentY, contentWidth, 20).fill('#ede9fe').stroke('#ddd6fe');
      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold')
        .text('3. FABRIC CONSUMPTION SUMMARY', ML + 8, currentY + 5, { lineBreak: false });
      doc.fillColor('#5b21b6').fontSize(8.5).font('Helvetica-Bold')
        .text(`Total: ${outwardData.length} Dispatches (${totalOutwardMtr.toFixed(2)} mtr)`, ML + contentWidth - 220, currentY + 5, { width: 210, align: 'right', lineBreak: false });

      currentY += 24;

      const drawOutwardHeaders = () => {
        doc.rect(ML, currentY, contentWidth, 18).fill('#f8fafc').stroke('#cbd5e1');
        doc.fillColor('#000000').fontSize(7.2).font('Helvetica-Bold');
        doc.text('DATE', ML + 4, currentY + 5, { width: 40 });
        doc.text('PARTY NAME', ML + 46, currentY + 5, { width: 90 });
        doc.text('BILL TO', ML + 138, currentY + 5, { width: 90 });
        doc.text('JOB NO', ML + 230, currentY + 5, { width: 45 });
        doc.text('CHALLAN NO', ML + 277, currentY + 5, { width: 55 });
        doc.text('FABRIC QUALITY', ML + 334, currentY + 5, { width: 85 });
        doc.text('LOT NO', ML + 421, currentY + 5, { width: 35 });
        doc.text('SHORTAGE', ML + 458, currentY + 5, { width: 35, align: 'center' });
        doc.text('QTY (MTR)', ML + 495, currentY + 5, { width: 36, align: 'right' });
        currentY += 18;
      };

      drawOutwardHeaders();

      outwardData.forEach((r, idx) => {
        if (checkAddPage(20)) {
          drawOutwardHeaders();
        }
        const bg = idx % 2 === 0 ? '#ffffff' : '#fcfaff';
        doc.rect(ML, currentY, contentWidth, 18).fill(bg);
        doc.strokeColor('#f1f5f9').lineWidth(0.5).rect(ML, currentY, contentWidth, 18).stroke();

        const dStr = r.date ? new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
        let shortageVal = (r.shortagePct !== undefined && r.shortagePct !== null && r.shortagePct !== '') ? r.shortagePct : null;
        if (shortageVal === null && r.notes) {
          const m = String(r.notes).match(/(\d+(?:\.\d+)?)%\s*shortage/i);
          if (m) shortageVal = m[1];
        }
        if (shortageVal === null && r.fabricQuality && (r.fabricQuality.includes('CREPE') || r.fabricQuality.includes('CRAPE') || r.fabricQuality.includes('FRENCH'))) {
          shortageVal = 2;
        }
        const shortageStr = shortageVal != null ? `${shortageVal}%` : '—';

        doc.fillColor('#000000').fontSize(7).font('Helvetica');
        doc.text(dStr, ML + 4, currentY + 4.5, { width: 40, lineBreak: false });
        doc.text(r.partyName || '—', ML + 46, currentY + 4.5, { width: 90, lineBreak: false });
        doc.text(r.billTo || r.partyName || '—', ML + 138, currentY + 4.5, { width: 90, lineBreak: false });
        doc.text(r.jobNo || '—', ML + 230, currentY + 4.5, { width: 45, lineBreak: false });
        doc.text(r.challanNo || '—', ML + 277, currentY + 4.5, { width: 55, lineBreak: false });
        doc.text(r.fabricQuality || '—', ML + 334, currentY + 4.5, { width: 85, lineBreak: false });
        doc.text(r.lotNo ? `#${r.lotNo}` : '—', ML + 421, currentY + 4.5, { width: 35, lineBreak: false });
        doc.text(shortageStr, ML + 458, currentY + 4.5, { width: 35, align: 'center', lineBreak: false });
        doc.fillColor('#b91c1c').font('Helvetica-Bold');
        doc.text(`${parseFloat(r.qty || 0).toFixed(2)}`, ML + 495, currentY + 4.5, { width: 36, align: 'right', lineBreak: false });
        currentY += 18;
      });

      currentY += 12;
    }

      // ── 4B. PRINTING DEPARTMENT CONSUMPTION TABLES & DETAILED RUN LOGS ──
      if (selectedReports.includes('machine') || selectedReports.includes('machine_print') || (typeof detailedPrintLogsList !== 'undefined' && detailedPrintLogsList && detailedPrintLogsList.length > 0)) {

        const grandoInk = { C: 0, M: 0, Y: 0, K: 0 };
        const printdotInk = { C: 0, M: 0, Y: 0, K: 0 };
        const pannaCols = ['36', '38', '44', '54', '58', '60'];
        const inwardRawMaterialList = [];

        // 2 Shifts: Day Shift vs Night Shift
        const paperDayTypeMap = {};
        const paperDayMetersMap = {};
        const paperNightTypeMap = {};
        const paperNightMetersMap = {};

        // Calculate Machine & Shift Wise Meterages
        let grando1Pass = 0, grando2Pass = 0;
        let printdot1Pass = 0, printdot2Pass = 0;

        let grandoDayMtr = 0, grandoNightMtr = 0;
        let printdotDayMtr = 0, printdotNightMtr = 0;

        if (typeof detailedPrintLogsList !== 'undefined' && detailedPrintLogsList && detailedPrintLogsList.length > 0) {
          detailedPrintLogsList.forEach(l => {
            const mName = String(l.machineName || '').toUpperCase();
            const passStr = String(l.pass || '').toLowerCase();
            const sName = String(l.shift || '').toLowerCase();
            const mtr = Number(l.meters) || 0;

            const isNightShift = sName.includes('night') || sName.includes('even');
            const is1Pass = passStr.includes('1') || passStr.includes('draft');

            if (mName.includes('PRINTDOT')) {
              if (is1Pass) printdot1Pass += mtr;
              else printdot2Pass += mtr;

              if (isNightShift) printdotNightMtr += mtr;
              else printdotDayMtr += mtr;
            } else {
              if (is1Pass) grando1Pass += mtr;
              else grando2Pass += mtr;

              if (isNightShift) grandoNightMtr += mtr;
              else grandoDayMtr += mtr;
            }

            // Record paper consumption from print logs into Day/Night shift
            const pType = l.paperType || l.fabricQuality || 'A++';
            let pannaWidth = String(l.panna || '').replace(/[^\d]/g, '');
            if (!pannaWidth || !pannaCols.includes(pannaWidth)) pannaWidth = '58';

            const targetTypeMap = isNightShift ? paperNightTypeMap : paperDayTypeMap;
            const targetMetersMap = isNightShift ? paperNightMetersMap : paperDayMetersMap;

            if (!targetTypeMap[pType]) {
              targetTypeMap[pType] = { '36': 0, '38': 0, '44': 0, '54': 0, '58': 0, '60': 0 };
              targetMetersMap[pType] = { '36': 0, '38': 0, '44': 0, '54': 0, '58': 0, '60': 0 };
            }
            targetMetersMap[pType][pannaWidth] += mtr;
          });
        }

        const grandoTotal = grando1Pass + grando2Pass;
        const printdotTotal = printdot1Pass + printdot2Pass;

        if (typeof rawMaterialLogs !== 'undefined' && rawMaterialLogs && rawMaterialLogs.length > 0) {
          rawMaterialLogs.forEach(t => {
            const mName = (t.materialName || '').toLowerCase();
            const q = Number(t.qty) || 0;
            const isTypeInward = t.type === 'INWARD';

            if (isTypeInward) {
              inwardRawMaterialList.push(t);
            } else {
              if (mName.includes('grando')) {
                if (mName.includes('cyan') || t.color === 'Cyan') grandoInk.C += q;
                else if (mName.includes('magenta') || t.color === 'Magenta') grandoInk.M += q;
                else if (mName.includes('yellow') || t.color === 'Yellow') grandoInk.Y += q;
                else if (mName.includes('black') || t.color === 'Black') grandoInk.K += q;
              } else if (mName.includes('printdot')) {
                if (mName.includes('cyan') || t.color === 'Cyan') printdotInk.C += q;
                else if (mName.includes('magenta') || t.color === 'Magenta') printdotInk.M += q;
                else if (mName.includes('yellow') || t.color === 'Yellow') printdotInk.Y += q;
                else if (mName.includes('black') || t.color === 'Black') printdotInk.K += q;
              } else if (mName.includes('paper') || t.panna) {
                const pType = t.materialName || 'A++';
                let pannaWidth = String(t.panna || '').replace(/[^\d]/g, '');
                if (!pannaWidth || !pannaCols.includes(pannaWidth)) pannaWidth = '58';

                const sName = (t.shift || '').toLowerCase();
                const isNight = sName.includes('night') || sName.includes('even');
                const targetTypeMap = isNight ? paperNightTypeMap : paperDayTypeMap;
                const targetMetersMap = isNight ? paperNightMetersMap : paperDayMetersMap;

                if (!targetTypeMap[pType]) {
                  targetTypeMap[pType] = { '36': 0, '38': 0, '44': 0, '54': 0, '58': 0, '60': 0 };
                  targetMetersMap[pType] = { '36': 0, '38': 0, '44': 0, '54': 0, '58': 0, '60': 0 };
                }
                targetTypeMap[pType][pannaWidth] += q;

                const mtrVal = Number(t.meters) || Number(t.totalMeters) || (q * (Number(t.metersPerRoll) || 0)) || 0;
                targetMetersMap[pType][pannaWidth] += mtrVal;
              }
            }
          });
        }

        // Compute 2-Shift Ink Allocations (Day Shift vs Night Shift)
        const grandoTotMtr = grandoDayMtr + grandoNightMtr;
        const printdotTotMtr = printdotDayMtr + printdotNightMtr;

        const grandoDayRatio = grandoTotMtr > 0 ? (grandoDayMtr / grandoTotMtr) : 0.5;
        const grandoNightRatio = 1 - grandoDayRatio;

        const printdotDayRatio = printdotTotMtr > 0 ? (printdotDayMtr / printdotTotMtr) : 0.5;
        const printdotNightRatio = 1 - printdotDayRatio;

        const grandoDayInk = { C: grandoInk.C * grandoDayRatio, M: grandoInk.M * grandoDayRatio, Y: grandoInk.Y * grandoDayRatio, K: grandoInk.K * grandoDayRatio };
        const grandoNightInk = { C: grandoInk.C * grandoNightRatio, M: grandoInk.M * grandoNightRatio, Y: grandoInk.Y * grandoNightRatio, K: grandoInk.K * grandoNightRatio };

        const printdotDayInk = { C: printdotInk.C * printdotDayRatio, M: printdotInk.M * printdotDayRatio, Y: printdotInk.Y * printdotDayRatio, K: printdotInk.K * printdotDayRatio };
        const printdotNightInk = { C: printdotInk.C * printdotNightRatio, M: printdotInk.M * printdotNightRatio, Y: printdotInk.Y * printdotNightRatio, K: printdotInk.K * printdotNightRatio };


        // ── 1. SHIFT WISE INK CONSUMPTION TABLE (DAY SHIFT & NIGHT SHIFT) ──
        checkAddPage(110);

        doc.rect(ML, currentY, contentWidth, 15).fill('#eff6ff').stroke('#bfdbfe');
        doc.fillColor('#1e40af').fontSize(8).font('Helvetica-Bold')
          .text('INK CONSUMPTION SUMMARY (DAY & NIGHT SHIFT)', ML, currentY + 3.5, { width: contentWidth, align: 'center' });
        currentY += 16;

        const leftX = ML;
        const tableW = 260;
        const gap = 15;
        const rightX = ML + tableW + gap;
        const inkCols = ['C', 'M', 'Y', 'K', 'TOTAL'];
        const colW = tableW / 5;

        // 1A. DAY SHIFT INK CONSUMPTION
        doc.rect(ML, currentY, contentWidth, 13).fill('#f8fafc').stroke('#cbd5e1');
        doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold')
          .text('☀️ DAY SHIFT INK CONSUMPTION', ML + 6, currentY + 2.5, { width: contentWidth - 12, align: 'left' });
        currentY += 13;

        doc.rect(leftX, currentY, tableW, 14).fill('#eff6ff').stroke('#bfdbfe');
        doc.fillColor('#1e40af').fontSize(7.5).font('Helvetica-Bold')
          .text('GRANDO (DAY SHIFT)', leftX, currentY + 3, { width: tableW, align: 'center' });

        doc.rect(rightX, currentY, tableW, 14).fill('#f5f3ff').stroke('#ddd6fe');
        doc.fillColor('#5b21b6').fontSize(7.5).font('Helvetica-Bold')
          .text('PRINTDOT (DAY SHIFT)', rightX, currentY + 3, { width: tableW, align: 'center' });
        currentY += 14;

        inkCols.forEach((col, i) => {
          doc.rect(leftX + i * colW, currentY, colW, 13).fill('#f8fafc').stroke('#cbd5e1');
          doc.fillColor('#334155').fontSize(7).font('Helvetica-Bold')
            .text(col, leftX + i * colW, currentY + 2.5, { width: colW, align: 'center' });

          doc.rect(rightX + i * colW, currentY, colW, 13).fill('#f8fafc').stroke('#cbd5e1');
          doc.fillColor('#334155').fontSize(7).font('Helvetica-Bold')
            .text(col, rightX + i * colW, currentY + 2.5, { width: colW, align: 'center' });
        });
        currentY += 13;

        const gDayTot = grandoDayInk.C + grandoDayInk.M + grandoDayInk.Y + grandoDayInk.K;
        const pDayTot = printdotDayInk.C + printdotDayInk.M + printdotDayInk.Y + printdotDayInk.K;
        const dayTotInk = gDayTot + pDayTot;

        const gDayVals = [grandoDayInk.C.toFixed(2), grandoDayInk.M.toFixed(2), grandoDayInk.Y.toFixed(2), grandoDayInk.K.toFixed(2), gDayTot.toFixed(2)];
        const pDayVals = [printdotDayInk.C.toFixed(2), printdotDayInk.M.toFixed(2), printdotDayInk.Y.toFixed(2), printdotDayInk.K.toFixed(2), pDayTot.toFixed(2)];

        gDayVals.forEach((val, i) => {
          const isTot = i === 4;
          doc.rect(leftX + i * colW, currentY, colW, 14).fill(isTot ? '#eff6ff' : '#ffffff').stroke(isTot ? '#bfdbfe' : '#cbd5e1');
          doc.fillColor(isTot ? '#1e40af' : '#0f172a').fontSize(7.5).font(isTot ? 'Helvetica-Bold' : 'Helvetica')
            .text(val, leftX + i * colW, currentY + 3, { width: colW, align: 'center' });
        });
        pDayVals.forEach((val, i) => {
          const isTot = i === 4;
          doc.rect(rightX + i * colW, currentY, colW, 14).fill(isTot ? '#f5f3ff' : '#ffffff').stroke(isTot ? '#ddd6fe' : '#cbd5e1');
          doc.fillColor(isTot ? '#5b21b6' : '#0f172a').fontSize(7.5).font(isTot ? 'Helvetica-Bold' : 'Helvetica')
            .text(val, rightX + i * colW, currentY + 3, { width: colW, align: 'center' });
        });
        currentY += 18;

        // 1B. NIGHT SHIFT INK CONSUMPTION
        doc.rect(ML, currentY, contentWidth, 13).fill('#f8fafc').stroke('#cbd5e1');
        doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold')
          .text('🌙 NIGHT SHIFT INK CONSUMPTION', ML + 6, currentY + 2.5, { width: contentWidth - 12, align: 'left' });
        currentY += 13;

        doc.rect(leftX, currentY, tableW, 14).fill('#eff6ff').stroke('#bfdbfe');
        doc.fillColor('#1e40af').fontSize(7.5).font('Helvetica-Bold')
          .text('GRANDO (NIGHT SHIFT)', leftX, currentY + 3, { width: tableW, align: 'center' });

        doc.rect(rightX, currentY, tableW, 14).fill('#f5f3ff').stroke('#ddd6fe');
        doc.fillColor('#5b21b6').fontSize(7.5).font('Helvetica-Bold')
          .text('PRINTDOT (NIGHT SHIFT)', rightX, currentY + 3, { width: tableW, align: 'center' });
        currentY += 14;

        inkCols.forEach((col, i) => {
          doc.rect(leftX + i * colW, currentY, colW, 13).fill('#f8fafc').stroke('#cbd5e1');
          doc.fillColor('#334155').fontSize(7).font('Helvetica-Bold')
            .text(col, leftX + i * colW, currentY + 2.5, { width: colW, align: 'center' });

          doc.rect(rightX + i * colW, currentY, colW, 13).fill('#f8fafc').stroke('#cbd5e1');
          doc.fillColor('#334155').fontSize(7).font('Helvetica-Bold')
            .text(col, rightX + i * colW, currentY + 2.5, { width: colW, align: 'center' });
        });
        currentY += 13;

        const gNightTot = grandoNightInk.C + grandoNightInk.M + grandoNightInk.Y + grandoNightInk.K;
        const pNightTot = printdotNightInk.C + printdotNightInk.M + printdotNightInk.Y + printdotNightInk.K;
        const nightTotInk = gNightTot + pNightTot;

        const gNightVals = [grandoNightInk.C.toFixed(2), grandoNightInk.M.toFixed(2), grandoNightInk.Y.toFixed(2), grandoNightInk.K.toFixed(2), gNightTot.toFixed(2)];
        const pNightVals = [printdotNightInk.C.toFixed(2), printdotNightInk.M.toFixed(2), printdotNightInk.Y.toFixed(2), printdotNightInk.K.toFixed(2), pNightTot.toFixed(2)];

        gNightVals.forEach((val, i) => {
          const isTot = i === 4;
          doc.rect(leftX + i * colW, currentY, colW, 14).fill(isTot ? '#eff6ff' : '#ffffff').stroke(isTot ? '#bfdbfe' : '#cbd5e1');
          doc.fillColor(isTot ? '#1e40af' : '#0f172a').fontSize(7.5).font(isTot ? 'Helvetica-Bold' : 'Helvetica')
            .text(val, leftX + i * colW, currentY + 3, { width: colW, align: 'center' });
        });
        pNightVals.forEach((val, i) => {
          const isTot = i === 4;
          doc.rect(rightX + i * colW, currentY, colW, 14).fill(isTot ? '#f5f3ff' : '#ffffff').stroke(isTot ? '#ddd6fe' : '#cbd5e1');
          doc.fillColor(isTot ? '#5b21b6' : '#0f172a').fontSize(7.5).font(isTot ? 'Helvetica-Bold' : 'Helvetica')
            .text(val, rightX + i * colW, currentY + 3, { width: colW, align: 'center' });
        });
        currentY += 15;

        // INK TOTAL SUMMARY BAR Across Both Shifts (Light Blue)
        const grandTotInkAll = dayTotInk + nightTotInk;
        doc.rect(ML, currentY, contentWidth, 15).fill('#eff6ff').stroke('#bfdbfe');
        doc.fillColor('#1e40af').fontSize(7.5).font('Helvetica-Bold')
          .text(`TOTAL INK CONSUMED (DAY + NIGHT SHIFT): ${grandTotInkAll.toFixed(2)} Ltr (Day: ${dayTotInk.toFixed(2)} Ltr | Night: ${nightTotInk.toFixed(2)} Ltr)`, ML + 8, currentY + 3.5, { width: contentWidth - 16, align: 'center' });
        currentY += 21;


        // ── 2. SHIFT WISE PAPER CONSUMPTION SUMMARY (DAY SHIFT & NIGHT SHIFT) ──
        checkAddPage(120);

        doc.rect(ML, currentY, contentWidth, 15).fill('#f5f3ff').stroke('#ddd6fe');
        doc.fillColor('#5b21b6').fontSize(8).font('Helvetica-Bold')
          .text('PAPER CONSUMPTION SUMMARY (DAY & NIGHT SHIFT)', ML, currentY + 3.5, { width: contentWidth, align: 'center' });
        currentY += 16;

        const typeColW = 95;
        const totalColW = 65;
        const pannaColW = (contentWidth - typeColW - totalColW) / pannaCols.length;

        const printConfigDoc = await PrintConfig.findOne({ isConfig: true }).lean();
        const configuredPaperTypes = (printConfigDoc && Array.isArray(printConfigDoc.paperTypes) && printConfigDoc.paperTypes.length > 0)
          ? printConfigDoc.paperTypes
          : ['A++', 'A+', 'A'];

        const allPaperKeys = Array.from(new Set([...Object.keys(paperDayTypeMap), ...Object.keys(paperNightTypeMap), ...configuredPaperTypes]));

        // Function helper to render Paper Consumption Matrix for a specific shift
        const renderShiftPaperMatrix = (shiftTitle, typeMap, metersMap) => {
          doc.rect(ML, currentY, contentWidth, 13).fill('#f8fafc').stroke('#cbd5e1');
          doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold')
            .text(shiftTitle, ML + 6, currentY + 2.5, { width: contentWidth - 12, align: 'left' });
          currentY += 13;

          doc.rect(ML, currentY, typeColW, 14).fill('#f8fafc').stroke('#cbd5e1');
          doc.fillColor('#334155').fontSize(7.5).font('Helvetica-Bold')
            .text('PAPER TYPE', ML, currentY + 3, { width: typeColW, align: 'center' });

          pannaCols.forEach((panna, i) => {
            const x = ML + typeColW + i * pannaColW;
            doc.rect(x, currentY, pannaColW, 14).fill('#f8fafc').stroke('#cbd5e1');
            doc.fillColor('#334155').fontSize(7.5).font('Helvetica-Bold')
              .text(panna, x, currentY + 3, { width: pannaColW, align: 'center' });
          });

          doc.rect(ML + typeColW + pannaCols.length * pannaColW, currentY, totalColW, 14).fill('#f8fafc').stroke('#cbd5e1');
          doc.fillColor('#1e293b').fontSize(7.5).font('Helvetica-Bold')
            .text('TOTAL', ML + typeColW + pannaCols.length * pannaColW, currentY + 3, { width: totalColW, align: 'center' });
          currentY += 14;

          const colTotals = { '36': 0, '38': 0, '44': 0, '54': 0, '58': 0, '60': 0 };
          const colMetersTotals = { '36': 0, '38': 0, '44': 0, '54': 0, '58': 0, '60': 0 };
          let shiftTotRolls = 0;
          let shiftTotMeters = 0;

          allPaperKeys.forEach((pType, pIdx) => {
            const bg = pIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
            doc.rect(ML, currentY, typeColW, 14).fill(bg).stroke('#cbd5e1');
            doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold')
              .text(pType, ML, currentY + 3, { width: typeColW, align: 'center' });

            let rowRollTotal = 0;
            let rowMetersTotal = 0;

            pannaCols.forEach((panna, i) => {
              const x = ML + typeColW + i * pannaColW;
              const qtyVal = (typeMap[pType] && typeMap[pType][panna]) ? typeMap[pType][panna] : 0;
              const mtrVal = (metersMap[pType] && metersMap[pType][panna]) ? metersMap[pType][panna] : 0;

              rowRollTotal += qtyVal;
              rowMetersTotal += mtrVal;
              colTotals[panna] = (colTotals[panna] || 0) + qtyVal;
              colMetersTotals[panna] = (colMetersTotals[panna] || 0) + mtrVal;

              let valStr = '';
              if (qtyVal > 0 && mtrVal > 0) {
                valStr = `${qtyVal} R (${mtrVal.toFixed(0)}m)`;
              } else if (qtyVal > 0) {
                valStr = `${qtyVal} R`;
              } else if (mtrVal > 0) {
                valStr = `${mtrVal.toFixed(0)}m`;
              }

              doc.rect(x, currentY, pannaColW, 14).fill(bg).stroke('#cbd5e1');
              doc.fillColor(qtyVal > 0 || mtrVal > 0 ? '#1e40af' : '#94a3b8').fontSize(6.5).font(qtyVal > 0 || mtrVal > 0 ? 'Helvetica-Bold' : 'Helvetica')
                .text(valStr, x, currentY + 3.5, { width: pannaColW, align: 'center' });
            });

            shiftTotRolls += rowRollTotal;
            shiftTotMeters += rowMetersTotal;
            const totX = ML + typeColW + pannaCols.length * pannaColW;
            doc.rect(totX, currentY, totalColW, 14).fill(bg).stroke('#cbd5e1');

            let rowTotStr = '0';
            if (rowRollTotal > 0 && rowMetersTotal > 0) {
              rowTotStr = `${rowRollTotal} R (${rowMetersTotal.toFixed(0)}m)`;
            } else if (rowRollTotal > 0) {
              rowTotStr = `${rowRollTotal} R`;
            } else if (rowMetersTotal > 0) {
              rowTotStr = `${rowMetersTotal.toFixed(0)}m`;
            }

            doc.fillColor('#1e40af').fontSize(6.5).font('Helvetica-Bold')
              .text(rowTotStr, totX, currentY + 3.5, { width: totalColW, align: 'center' });

            currentY += 14;
          });

          // TOTAL ROLLS ROW
          doc.rect(ML, currentY, typeColW, 14).fill('#eff6ff').stroke('#bfdbfe');
          doc.fillColor('#1e40af').fontSize(7.5).font('Helvetica-Bold')
            .text('TOTAL ROLLS', ML, currentY + 3, { width: typeColW, align: 'center' });

          pannaCols.forEach((panna, i) => {
            const x = ML + typeColW + i * pannaColW;
            const cTot = colTotals[panna] || 0;
            doc.rect(x, currentY, pannaColW, 14).fill('#eff6ff').stroke('#bfdbfe');
            doc.fillColor('#1e40af').fontSize(7.5).font('Helvetica-Bold')
              .text(cTot > 0 ? `${cTot} R` : '0', x, currentY + 3, { width: pannaColW, align: 'center' });
          });

          const totX1 = ML + typeColW + pannaCols.length * pannaColW;
          doc.rect(totX1, currentY, totalColW, 14).fill('#eff6ff').stroke('#bfdbfe');
          doc.fillColor('#1e40af').fontSize(7.5).font('Helvetica-Bold')
            .text(`${shiftTotRolls} Rolls`, totX1, currentY + 3, { width: totalColW, align: 'center' });
          currentY += 14;

          // TOTAL METERS ROW
          doc.rect(ML, currentY, typeColW, 14).fill('#f5f3ff').stroke('#ddd6fe');
          doc.fillColor('#5b21b6').fontSize(7.0).font('Helvetica-Bold')
            .text('TOTAL PAPER METERS', ML, currentY + 3, { width: typeColW, align: 'center' });

          pannaCols.forEach((panna, i) => {
            const x = ML + typeColW + i * pannaColW;
            const cMtrTot = colMetersTotals[panna] || 0;
            doc.rect(x, currentY, pannaColW, 14).fill('#f5f3ff').stroke('#ddd6fe');
            doc.fillColor('#5b21b6').fontSize(7.0).font('Helvetica-Bold')
              .text(cMtrTot > 0 ? `${cMtrTot.toFixed(0)}m` : '0m', x, currentY + 3, { width: pannaColW, align: 'center' });
          });

          const totX2 = ML + typeColW + pannaCols.length * pannaColW;
          doc.rect(totX2, currentY, totalColW, 14).fill('#f5f3ff').stroke('#ddd6fe');
          doc.fillColor('#5b21b6').fontSize(7.2).font('Helvetica-Bold')
            .text(`${shiftTotMeters.toFixed(0)} mtr`, totX2, currentY + 3, { width: totalColW, align: 'center' });

          currentY += 18;
          return shiftTotMeters;
        };

        // Render Day Shift Paper Consumption
        const dayShiftMetersTot = renderShiftPaperMatrix('☀️ DAY SHIFT PAPER CONSUMPTION', paperDayTypeMap, paperDayMetersMap);

        // Render Night Shift Paper Consumption
        const nightShiftMetersTot = renderShiftPaperMatrix('🌙 NIGHT SHIFT PAPER CONSUMPTION', paperNightTypeMap, paperNightMetersMap);

        // GRAND TOTAL PAPER SUMMARY BAR
        const grandTotPaperAll = dayShiftMetersTot + nightShiftMetersTot;
        doc.rect(ML, currentY, contentWidth, 15).fill('#f5f3ff').stroke('#ddd6fe');
        doc.fillColor('#5b21b6').fontSize(7.5).font('Helvetica-Bold')
          .text(`TOTAL PAPER METERS PRINTED (DAY + NIGHT SHIFT): ${grandTotPaperAll.toFixed(0)} mtr (Day: ${dayShiftMetersTot.toFixed(0)}m | Night: ${nightShiftMetersTot.toFixed(0)}m)`, ML + 8, currentY + 3.5, { width: contentWidth - 16, align: 'center' });
        currentY += 21;


        // ── 2B. INK & PAPER INWARD SUMMARY MATRIX TABLES ──
        const inkInwardList = (inwardRawMaterialList || []).filter(t => {
          const m = (t.materialName || '').toLowerCase();
          return m.includes('ink') || m.includes('grando') || m.includes('printdot');
        });

        const paperInwardList = (inwardRawMaterialList || []).filter(t => {
          const m = (t.materialName || '').toLowerCase();
          return m.includes('paper') || t.panna || m.includes('sublimation') || m.includes('butter');
        });

        const otherInwardList = (inwardRawMaterialList || []).filter(t => !inkInwardList.includes(t) && !paperInwardList.includes(t));
        const combinedPaperAndOther = [...paperInwardList, ...otherInwardList];

        // 1. INK INWARD SUMMARY MATRIX (GRANDO & PRINTDOT GRID)
        checkAddPage(90);

        // Aggregate Inward Ink
        const grandoInwardInk = { C: 0, M: 0, Y: 0, K: 0 };
        const printdotInwardInk = { C: 0, M: 0, Y: 0, K: 0 };

        (inkInwardList || []).forEach(r => {
          const m = (r.materialName || '').toLowerCase();
          const col = (r.color || '').toLowerCase();
          const q = Number(r.qty) || 0;
          const can = Number(r.canSize) || 1;
          const vol = q * can;

          const isGrando = m.includes('grando') || (!m.includes('printdot'));
          const target = isGrando ? grandoInwardInk : printdotInwardInk;

          if (m.includes('cyan') || col.includes('cyan') || col === 'c') target.C += vol;
          else if (m.includes('magenta') || col.includes('magenta') || col === 'm') target.M += vol;
          else if (m.includes('yellow') || col.includes('yellow') || col === 'y') target.Y += vol;
          else if (m.includes('black') || col.includes('black') || col === 'k' || col === 'bk') target.K += vol;
        });

        const grandoInwardTot = grandoInwardInk.C + grandoInwardInk.M + grandoInwardInk.Y + grandoInwardInk.K;
        const printdotInwardTot = printdotInwardInk.C + printdotInwardInk.M + printdotInwardInk.Y + printdotInwardInk.K;
        const totInkInwardVol = grandoInwardTot + printdotInwardTot;

        const inwLeftX = ML;
        const inwTableW = 260;
        const inwGap = 15;
        const inwRightX = ML + inwTableW + inwGap;
        const inwInkCols = ['C', 'M', 'Y', 'K', 'TOTAL'];
        const inwColW = inwTableW / 5;

        // GRANDO Table Header Row 1 (Light Blue)
        doc.rect(inwLeftX, currentY, inwTableW, 15).fill('#eff6ff').stroke('#bfdbfe');
        doc.fillColor('#1e40af').fontSize(8).font('Helvetica-Bold')
          .text('GRANDO INK INWARD', inwLeftX, currentY + 3.5, { width: inwTableW, align: 'center' });

        // PRINTDOT Table Header Row 1 (Light Purple)
        doc.rect(inwRightX, currentY, inwTableW, 15).fill('#f5f3ff').stroke('#ddd6fe');
        doc.fillColor('#5b21b6').fontSize(8).font('Helvetica-Bold')
          .text('PRINTDOT INK INWARD', inwRightX, currentY + 3.5, { width: inwTableW, align: 'center' });
        currentY += 15;

        // Header Row 2: C | M | Y | K | TOTAL
        inwInkCols.forEach((col, i) => {
          doc.rect(inwLeftX + i * inwColW, currentY, inwColW, 14).fill('#f8fafc').stroke('#cbd5e1');
          doc.fillColor('#334155').fontSize(7.5).font('Helvetica-Bold')
            .text(col, inwLeftX + i * inwColW, currentY + 3, { width: inwColW, align: 'center' });

          doc.rect(inwRightX + i * inwColW, currentY, inwColW, 14).fill('#f8fafc').stroke('#cbd5e1');
          doc.fillColor('#334155').fontSize(7.5).font('Helvetica-Bold')
            .text(col, inwRightX + i * inwColW, currentY + 3, { width: inwColW, align: 'center' });
        });
        currentY += 14;

        // Data Row: Values
        const grandoInwardVals = [
          grandoInwardInk.C > 0 ? grandoInwardInk.C.toFixed(2) : '0.00',
          grandoInwardInk.M > 0 ? grandoInwardInk.M.toFixed(2) : '0.00',
          grandoInwardInk.Y > 0 ? grandoInwardInk.Y.toFixed(2) : '0.00',
          grandoInwardInk.K > 0 ? grandoInwardInk.K.toFixed(2) : '0.00',
          grandoInwardTot.toFixed(2)
        ];
        const printdotInwardVals = [
          printdotInwardInk.C > 0 ? printdotInwardInk.C.toFixed(2) : '0.00',
          printdotInwardInk.M > 0 ? printdotInwardInk.M.toFixed(2) : '0.00',
          printdotInwardInk.Y > 0 ? printdotInwardInk.Y.toFixed(2) : '0.00',
          printdotInwardInk.K > 0 ? printdotInwardInk.K.toFixed(2) : '0.00',
          printdotInwardTot.toFixed(2)
        ];

        grandoInwardVals.forEach((val, i) => {
          const isTot = i === 4;
          const bg = isTot ? '#eff6ff' : '#ffffff';
          const stroke = isTot ? '#bfdbfe' : '#cbd5e1';
          const textColor = isTot ? '#1e40af' : '#0f172a';
          doc.rect(inwLeftX + i * inwColW, currentY, inwColW, 15).fill(bg).stroke(stroke);
          doc.fillColor(textColor).fontSize(7.5).font(isTot ? 'Helvetica-Bold' : 'Helvetica')
            .text(val, inwLeftX + i * inwColW, currentY + 3.5, { width: inwColW, align: 'center' });
        });

        printdotInwardVals.forEach((val, i) => {
          const isTot = i === 4;
          const bg = isTot ? '#f5f3ff' : '#ffffff';
          const stroke = isTot ? '#ddd6fe' : '#cbd5e1';
          const textColor = isTot ? '#5b21b6' : '#0f172a';
          doc.rect(inwRightX + i * inwColW, currentY, inwColW, 15).fill(bg).stroke(stroke);
          doc.fillColor(textColor).fontSize(7.5).font(isTot ? 'Helvetica-Bold' : 'Helvetica')
            .text(val, inwRightX + i * inwColW, currentY + 3.5, { width: inwColW, align: 'center' });
        });
        currentY += 15;

        // INK INWARD TOTAL BAR (Light Blue)
        doc.rect(ML, currentY, contentWidth, 15).fill('#eff6ff').stroke('#bfdbfe');
        doc.fillColor('#1e40af').fontSize(7.5).font('Helvetica-Bold')
          .text(`TOTAL INK RECEIVED INWARD: ${totInkInwardVol.toFixed(2)} Ltr (${inkInwardList.length} Receipts)`, ML + 8, currentY + 3.5, { width: contentWidth - 16, align: 'center' });
        currentY += 21;


        // 2. PAPER INWARD SUMMARY MATRIX (PANNA & PAPER TYPE GRID)
        checkAddPage(90);

        doc.rect(ML, currentY, contentWidth, 15).fill('#f5f3ff').stroke('#ddd6fe');
        doc.fillColor('#5b21b6').fontSize(8).font('Helvetica-Bold')
          .text('PAPER INWARD SUMMARY', ML, currentY + 3.5, { width: contentWidth, align: 'center' });
        currentY += 15;

        const paperInwardTypeMap = {};
        const paperInwardMetersMap = {};

        (combinedPaperAndOther || []).forEach(r => {
          const pType = r.materialName || 'A++';
          let pannaWidth = String(r.panna || '').replace(/[^\d]/g, '');
          if (!pannaWidth || !pannaCols.includes(pannaWidth)) pannaWidth = '58';

          const q = Number(r.qty) || 0;
          const mtrVal = Number(r.meters) || Number(r.totalMeters) || (q * (Number(r.metersPerRoll) || 0)) || 0;

          if (!paperInwardTypeMap[pType]) {
            paperInwardTypeMap[pType] = { '36': 0, '38': 0, '44': 0, '54': 0, '58': 0, '60': 0 };
            paperInwardMetersMap[pType] = { '36': 0, '38': 0, '44': 0, '54': 0, '58': 0, '60': 0 };
          }
          paperInwardTypeMap[pType][pannaWidth] += q;
          paperInwardMetersMap[pType][pannaWidth] += mtrVal;
        });

        const inwTypeColW = 95;
        const inwTotalColW = 65;
        const inwPannaColW = (contentWidth - inwTypeColW - inwTotalColW) / pannaCols.length;

        doc.rect(ML, currentY, inwTypeColW, 14).fill('#f8fafc').stroke('#cbd5e1');
        doc.fillColor('#334155').fontSize(7.5).font('Helvetica-Bold')
          .text('PAPER TYPE', ML, currentY + 3, { width: inwTypeColW, align: 'center' });

        pannaCols.forEach((panna, i) => {
          const x = ML + inwTypeColW + i * inwPannaColW;
          doc.rect(x, currentY, inwPannaColW, 14).fill('#f8fafc').stroke('#cbd5e1');
          doc.fillColor('#334155').fontSize(7.5).font('Helvetica-Bold')
            .text(panna, x, currentY + 3, { width: inwPannaColW, align: 'center' });
        });

        doc.rect(ML + inwTypeColW + pannaCols.length * inwPannaColW, currentY, inwTotalColW, 14).fill('#f8fafc').stroke('#cbd5e1');
        doc.fillColor('#1e293b').fontSize(7.5).font('Helvetica-Bold')
          .text('TOTAL', ML + inwTypeColW + pannaCols.length * inwPannaColW, currentY + 3, { width: inwTotalColW, align: 'center' });

        currentY += 14;

        const inwPaperTypes = Object.keys(paperInwardTypeMap).length > 0
          ? Object.keys(paperInwardTypeMap)
          : ['A++', 'A+', 'A'];

        const inwColTotals = { '36': 0, '38': 0, '44': 0, '54': 0, '58': 0, '60': 0 };
        const inwColMetersTotals = { '36': 0, '38': 0, '44': 0, '54': 0, '58': 0, '60': 0 };
        let grandInwPaperRolls = 0;
        let grandInwPaperMeters = 0;

        inwPaperTypes.forEach((pType, pIdx) => {
          const bg = pIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
          doc.rect(ML, currentY, inwTypeColW, 14).fill(bg).stroke('#cbd5e1');
          doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold')
            .text(pType, ML, currentY + 3, { width: inwTypeColW, align: 'center' });

          let rowRollTotal = 0;
          let rowMetersTotal = 0;

          pannaCols.forEach((panna, i) => {
            const x = ML + inwTypeColW + i * inwPannaColW;
            const qtyVal = (paperInwardTypeMap[pType] && paperInwardTypeMap[pType][panna]) ? paperInwardTypeMap[pType][panna] : 0;
            const mtrVal = (paperInwardMetersMap[pType] && paperInwardMetersMap[pType][panna]) ? paperInwardMetersMap[pType][panna] : 0;

            rowRollTotal += qtyVal;
            rowMetersTotal += mtrVal;
            inwColTotals[panna] = (inwColTotals[panna] || 0) + qtyVal;
            inwColMetersTotals[panna] = (inwColMetersTotals[panna] || 0) + mtrVal;

            let valStr = '';
            if (qtyVal > 0 && mtrVal > 0) {
              valStr = `${qtyVal} R (${mtrVal.toFixed(0)}m)`;
            } else if (qtyVal > 0) {
              valStr = `${qtyVal} R`;
            } else if (mtrVal > 0) {
              valStr = `${mtrVal.toFixed(0)}m`;
            }

            doc.rect(x, currentY, inwPannaColW, 14).fill(bg).stroke('#cbd5e1');
            doc.fillColor(qtyVal > 0 || mtrVal > 0 ? '#1e40af' : '#94a3b8').fontSize(6.5).font(qtyVal > 0 || mtrVal > 0 ? 'Helvetica-Bold' : 'Helvetica')
              .text(valStr, x, currentY + 3.5, { width: inwPannaColW, align: 'center' });
          });

          grandInwPaperRolls += rowRollTotal;
          grandInwPaperMeters += rowMetersTotal;
          const totX = ML + inwTypeColW + pannaCols.length * inwPannaColW;
          doc.rect(totX, currentY, inwTotalColW, 14).fill(bg).stroke('#cbd5e1');

          let rowTotStr = '0';
          if (rowRollTotal > 0 && rowMetersTotal > 0) {
            rowTotStr = `${rowRollTotal} R (${rowMetersTotal.toFixed(0)}m)`;
          } else if (rowRollTotal > 0) {
            rowTotStr = `${rowRollTotal} R`;
          }

          doc.fillColor('#1e40af').fontSize(6.5).font('Helvetica-Bold')
            .text(rowTotStr, totX, currentY + 3.5, { width: inwTotalColW, align: 'center' });

          currentY += 14;
        });

        // INWARD PAPER TOTAL BOTTOM ROW 1: TOTAL ROLLS (Light Blue)
        doc.rect(ML, currentY, inwTypeColW, 14).fill('#eff6ff').stroke('#bfdbfe');
        doc.fillColor('#1e40af').fontSize(7.5).font('Helvetica-Bold')
          .text('TOTAL ROLLS', ML, currentY + 3, { width: inwTypeColW, align: 'center' });

        pannaCols.forEach((panna, i) => {
          const x = ML + inwTypeColW + i * inwPannaColW;
          const cTot = inwColTotals[panna] || 0;
          doc.rect(x, currentY, inwPannaColW, 14).fill('#eff6ff').stroke('#bfdbfe');
          doc.fillColor('#1e40af').fontSize(7.5).font('Helvetica-Bold')
            .text(cTot > 0 ? `${cTot} R` : '0', x, currentY + 3, { width: inwPannaColW, align: 'center' });
        });

        const inwTotX1 = ML + inwTypeColW + pannaCols.length * inwPannaColW;
        doc.rect(inwTotX1, currentY, inwTotalColW, 14).fill('#eff6ff').stroke('#bfdbfe');
        doc.fillColor('#1e40af').fontSize(7.5).font('Helvetica-Bold')
          .text(`${grandInwPaperRolls} Rolls`, inwTotX1, currentY + 3, { width: inwTotalColW, align: 'center' });

        currentY += 14;

        // INWARD PAPER TOTAL BOTTOM ROW 2: TOTAL PAPER METERS (Light Purple)
        doc.rect(ML, currentY, inwTypeColW, 14).fill('#f5f3ff').stroke('#ddd6fe');
        doc.fillColor('#5b21b6').fontSize(7.0).font('Helvetica-Bold')
          .text('TOTAL PAPER METERS', ML, currentY + 3, { width: inwTypeColW, align: 'center' });

        pannaCols.forEach((panna, i) => {
          const x = ML + inwTypeColW + i * inwPannaColW;
          const cMtrTot = inwColMetersTotals[panna] || 0;
          doc.rect(x, currentY, inwPannaColW, 14).fill('#f5f3ff').stroke('#ddd6fe');
          doc.fillColor('#5b21b6').fontSize(7.0).font('Helvetica-Bold')
            .text(cMtrTot > 0 ? `${cMtrTot.toFixed(0)}m` : '0m', x, currentY + 3, { width: inwPannaColW, align: 'center' });
        });

        const inwTotX2 = ML + inwTypeColW + pannaCols.length * inwPannaColW;
        doc.rect(inwTotX2, currentY, inwTotalColW, 14).fill('#f5f3ff').stroke('#ddd6fe');
        doc.fillColor('#5b21b6').fontSize(7.2).font('Helvetica-Bold')
          .text(`${grandInwPaperMeters.toFixed(0)} mtr`, inwTotX2, currentY + 3, { width: inwTotalColW, align: 'center' });

        currentY += 20;

        // 3. DETAILED INWARD LOG TRANSACTIONS TABLE
        if (inkInwardList.length > 0 || combinedPaperAndOther.length > 0) {
          checkAddPage(60);
          doc.rect(ML, currentY, contentWidth, 15).fill('#f8fafc').stroke('#cbd5e1');
          doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold')
            .text('ITEMIZED INWARD RECEIPTS LOG', ML, currentY + 3.5, { width: contentWidth, align: 'center' });
          currentY += 15;

          const inwLogColsW = [55, 110, 45, 60, 65, 95, 75];
          const inwLogHeaders = ['DATE', 'MATERIAL / BRAND', 'PANNA/COLOR', 'QTY', 'METERS / VOL', 'CHALLAN NO', 'SUPPLIER'];

          doc.rect(ML, currentY, contentWidth, 14).fill('#f1f5f9').stroke('#cbd5e1');
          let curX = ML;
          inwLogHeaders.forEach((h, idx) => {
            const w = inwLogColsW[idx];
            doc.fillColor('#334155').fontSize(7).font('Helvetica-Bold')
              .text(h, curX + 2, currentY + 3, { width: w - 4, align: idx === 3 || idx === 4 ? 'right' : 'left' });
            curX += w;
          });
          currentY += 14;

          const allInwLogs = [...inkInwardList, ...combinedPaperAndOther];
          allInwLogs.forEach((r, rIdx) => {
            checkAddPage(14);
            const bg = rIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
            doc.rect(ML, currentY, contentWidth, 14).fill(bg).stroke('#cbd5e1');

            const rDate = r.date ? (String(r.date).includes('T') ? String(r.date).split('T')[0] : String(r.date)) : '—';
            const rMat = r.materialName || 'Inward Item';
            const rSpec = r.panna ? (String(r.panna).includes('"') ? r.panna : `${r.panna}"`) : (r.color || '—');
            const rQty = Number(r.qty) || 0;
            const rCanSize = Number(r.canSize) || Number(r.metersPerRoll) || 0;
            const rMtr = Number(r.meters) || Number(r.totalMeters) || (rCanSize > 0 ? (rQty * rCanSize) : 0);

            const rChallan = r.challanNo || '—';
            const rVendor = r.vendorName || r.partyName || '—';

            let curX2 = ML;
            const vals = [
              rDate,
              rMat,
              rSpec,
              `${rQty} ${r.unit || 'Pcs'}`,
              rMtr > 0 ? `${rMtr.toFixed(2)} ${rMat.toLowerCase().includes('ink') ? 'Ltr' : 'm'}` : '—',
              rChallan,
              rVendor
            ];

            vals.forEach((v, idx) => {
              const w = inwLogColsW[idx];
              const isNum = idx === 3 || idx === 4;
              doc.fillColor(isNum ? '#1e40af' : '#0f172a').fontSize(7).font(isNum ? 'Helvetica-Bold' : 'Helvetica')
                .text(v, curX2 + 2, currentY + 3, { width: w - 4, align: isNum ? 'right' : 'left', lineBreak: false });
              curX2 += w;
            });

            currentY += 14;
          });
          currentY += 18;
        }


        // ── 3. MACHINE WISE REPORT TABLE (LIGHT BLUE & LIGHT PURPLE THEME) ──
        checkAddPage(80);

        doc.rect(ML, currentY, contentWidth, 15).fill('#eff6ff').stroke('#bfdbfe');
        doc.fillColor('#1e40af').fontSize(8).font('Helvetica-Bold')
          .text('MACHINE WISE REPORT', ML, currentY + 3.5, { width: contentWidth, align: 'center' });
        currentY += 15;

        const halfW = contentWidth / 2;
        const subColW = halfW / 3;

        doc.rect(ML, currentY, halfW, 15).fill('#f5f3ff').stroke('#ddd6fe');
        doc.fillColor('#5b21b6').fontSize(8).font('Helvetica-Bold')
          .text('GRANDO', ML, currentY + 3.5, { width: halfW, align: 'center' });

        doc.rect(ML + halfW, currentY, halfW, 15).fill('#eff6ff').stroke('#bfdbfe');
        doc.fillColor('#1e40af').fontSize(8).font('Helvetica-Bold')
          .text('PRINTDOT', ML + halfW, currentY + 3.5, { width: halfW, align: 'center' });
        currentY += 15;

        const machineCols = ['1PASS MTR', '2 PASS MTR', 'TOTAL MTR', '1PASS MTR', '2 PASS MTR', 'TOTAL MTR'];
        machineCols.forEach((col, i) => {
          const x = ML + i * subColW;
          doc.rect(x, currentY, subColW, 14).fill('#f8fafc').stroke('#cbd5e1');
          doc.fillColor('#334155').fontSize(7.5).font('Helvetica-Bold')
            .text(col, x, currentY + 3, { width: subColW, align: 'center' });
        });
        currentY += 14;

        const mtrVals = [
          grando1Pass.toFixed(2),
          grando2Pass.toFixed(2),
          grandoTotal.toFixed(2),
          printdot1Pass.toFixed(2),
          printdot2Pass.toFixed(2),
          printdotTotal.toFixed(2)
        ];
        mtrVals.forEach((val, i) => {
          const x = ML + i * subColW;
          const isTot = i === 2 || i === 5;
          const bg = isTot ? (i === 2 ? '#f5f3ff' : '#eff6ff') : '#ffffff';
          const stroke = isTot ? (i === 2 ? '#ddd6fe' : '#bfdbfe') : '#cbd5e1';
          const textColor = isTot ? (i === 2 ? '#5b21b6' : '#1e40af') : '#0f172a';

          doc.rect(x, currentY, subColW, 15).fill(bg).stroke(stroke);
          doc.fillColor(textColor).fontSize(7.5).font(isTot ? 'Helvetica-Bold' : 'Helvetica')
            .text(val, x, currentY + 3.5, { width: subColW, align: 'center' });
        });
        currentY += 15;

        // BOTH MACHINES PRINTED METERS TOTAL BAR (Light Purple)
        const totalBothMtr = grandoTotal + printdotTotal;
        doc.rect(ML, currentY, contentWidth, 15).fill('#f5f3ff').stroke('#ddd6fe');
        doc.fillColor('#5b21b6').fontSize(7.5).font('Helvetica-Bold')
          .text(`TOTAL PRINTED METERS (BOTH MACHINES): ${totalBothMtr.toFixed(2)} mtr`, ML + 8, currentY + 3.5, { width: contentWidth - 16, align: 'center' });
        currentY += 21;

        // ── 3B. SHIFT WISE PRINTING USAGE REPORT TABLE ──
        checkAddPage(90);

        const shiftMap = {
          'Morning': { grando: 0, printdot: 0 },
          'Evening': { grando: 0, printdot: 0 },
          'Night': { grando: 0, printdot: 0 },
          'General': { grando: 0, printdot: 0 }
        };

        if (typeof detailedPrintLogsList !== 'undefined' && detailedPrintLogsList && detailedPrintLogsList.length > 0) {
          detailedPrintLogsList.forEach(l => {
            const mName = String(l.machineName || '').toUpperCase();
            const sName = String(l.shift || 'General');
            const normShift = sName.toLowerCase().includes('morn') ? 'Morning'
              : sName.toLowerCase().includes('even') ? 'Evening'
              : sName.toLowerCase().includes('night') ? 'Night'
              : 'General';

            const mtr = Number(l.meters) || 0;
            if (!shiftMap[normShift]) {
              shiftMap[normShift] = { grando: 0, printdot: 0 };
            }
            if (mName.includes('PRINTDOT')) {
              shiftMap[normShift].printdot += mtr;
            } else {
              shiftMap[normShift].grando += mtr;
            }
          });
        }

        doc.rect(ML, currentY, contentWidth, 15).fill('#f5f3ff').stroke('#ddd6fe');
        doc.fillColor('#5b21b6').fontSize(8).font('Helvetica-Bold')
          .text('SHIFT WISE PRINTING USAGE SUMMARY', ML, currentY + 3.5, { width: contentWidth, align: 'center' });
        currentY += 15;

        const shiftColsW = [120, 110, 110, 110, 85];
        const shiftHeaders = ['SHIFT NAME', 'GRANDO (MTR)', 'PRINTDOT (MTR)', 'TOTAL METERS (MTR)', 'USAGE %'];

        doc.rect(ML, currentY, contentWidth, 14).fill('#f8fafc').stroke('#cbd5e1');
        let curShiftX = ML;
        shiftHeaders.forEach((h, idx) => {
          const w = shiftColsW[idx];
          doc.fillColor('#334155').fontSize(7.5).font('Helvetica-Bold')
            .text(h, curShiftX + 2, currentY + 3, { width: w - 4, align: idx === 0 ? 'left' : 'right' });
          curShiftX += w;
        });
        currentY += 14;

        const totalOverallMeters = (grandoTotal + printdotTotal) || 1;
        const shiftsList = ['Morning', 'Evening', 'Night', 'General'];

        let grandShiftGrando = 0;
        let grandShiftPrintdot = 0;

        shiftsList.forEach((sName, sIdx) => {
          const data = shiftMap[sName] || { grando: 0, printdot: 0 };
          const rowTot = data.grando + data.printdot;
          grandShiftGrando += data.grando;
          grandShiftPrintdot += data.printdot;

          const rowPct = ((rowTot / totalOverallMeters) * 100).toFixed(1);
          const bg = sIdx % 2 === 0 ? '#ffffff' : '#f8fafc';

          doc.rect(ML, currentY, contentWidth, 14).fill(bg).stroke('#cbd5e1');

          let curX2 = ML;
          const vals = [
            `Shift: ${sName}`,
            data.grando > 0 ? `${data.grando.toFixed(2)} m` : '0.00 m',
            data.printdot > 0 ? `${data.printdot.toFixed(2)} m` : '0.00 m',
            rowTot > 0 ? `${rowTot.toFixed(2)} m` : '0.00 m',
            `${rowPct}%`
          ];

          vals.forEach((v, idx) => {
            const w = shiftColsW[idx];
            const isTot = idx === 3;
            doc.fillColor(isTot ? '#5b21b6' : '#0f172a').fontSize(7.5).font(isTot ? 'Helvetica-Bold' : 'Helvetica')
              .text(v, curX2 + 2, currentY + 3, { width: w - 4, align: idx === 0 ? 'left' : 'right', lineBreak: false });
            curX2 += w;
          });

          currentY += 14;
        });

        // SHIFT SUMMARY TOTAL BAR (Light Purple)
        const grandShiftTotal = grandShiftGrando + grandShiftPrintdot;
        doc.rect(ML, currentY, contentWidth, 15).fill('#f5f3ff').stroke('#ddd6fe');
        doc.fillColor('#5b21b6').fontSize(7.5).font('Helvetica-Bold')
          .text(`TOTAL SHIFT PRINTING USAGE: ${grandShiftTotal.toFixed(2)} mtr (Grando: ${grandShiftGrando.toFixed(2)}m | Printdot: ${grandShiftPrintdot.toFixed(2)}m)`, ML + 8, currentY + 3.5, { width: contentWidth - 16, align: 'center' });
        currentY += 21;

        // ── 4. DETAILS OF PRINTING JOBCARD (FORMERLY COMPLETE DETAILED PRINTING RUN LOGS) ──
        if (typeof detailedPrintLogsList !== 'undefined' && detailedPrintLogsList && detailedPrintLogsList.length > 0) {
          checkAddPage(60);

          doc.rect(ML, currentY, contentWidth, 18).fill('#e0e7ff').stroke('#c7d2fe');
          doc.fillColor('#3730a3').fontSize(8).font('Helvetica-Bold')
            .text('DETAILS OF PRINTING JOBCARD', ML + 8, currentY + 4.5, { lineBreak: false });
          doc.fillColor('#4338ca').fontSize(7.5).font('Helvetica-Bold')
            .text(`Total Entries: ${detailedPrintLogsList.length}`, ML + contentWidth - 150, currentY + 4.5, { width: 140, align: 'right', lineBreak: false });
          currentY += 22;

          const drawDetailHeaders = () => {
            doc.rect(ML, currentY, contentWidth, 18).fill('#1e293b').stroke('#0f172a');
            doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold');
            doc.text('SHIFT', ML + 4, currentY + 5, { width: 35, align: 'center' });
            doc.text('JOB CARD #', ML + 41, currentY + 5, { width: 65 });
            doc.text('PARTY / CLIENT', ML + 108, currentY + 5, { width: 105 });
            doc.text('DESIGN NAME', ML + 215, currentY + 5, { width: 80 });
            doc.text('MACHINE', ML + 300, currentY + 5, { width: 45, align: 'center' });
            doc.text('PASS', ML + 347, currentY + 5, { width: 35, align: 'center' });
            doc.text('METERS PRINTED', ML + 384, currentY + 5, { width: 65, align: 'right' });
            doc.text('OPERATOR', ML + 451, currentY + 5, { width: 75 });
            currentY += 18;
          };

          drawDetailHeaders();

          let subtotalMtr = 0;
          detailedPrintLogsList.forEach((log, idx) => {
            if (checkAddPage(18)) {
              drawDetailHeaders();
            }
            const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
            doc.rect(ML, currentY, contentWidth, 18).fill(bg);
            doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(ML, currentY, contentWidth, 18).stroke();

            const cleanJobNo = String(log.jobNo || '').replace(/[^\d]/g, '') || log.jobNo || '—';
            const shiftShort = String(log.shift || '').toLowerCase().includes('morn') ? 'M' :
                              String(log.shift || '').toLowerCase().includes('night') ? 'N' :
                              (log.shift ? log.shift.charAt(0).toUpperCase() : '—');
            const machineShort = String(log.machineName || '').toUpperCase().includes('GRANDO') ? 'G' :
                                 String(log.machineName || '').toUpperCase().includes('PRINTDOT') ? 'P' :
                                 (log.machineName ? log.machineName.charAt(0).toUpperCase() : '—');
            const passNum = (String(log.pass || '').match(/\d+/) || [log.pass || '1'])[0];

            doc.fillColor('#000000').fontSize(6.8).font('Helvetica-Bold');
            doc.text(shiftShort, ML + 4, currentY + 4.5, { width: 35, align: 'center', lineBreak: false });

            doc.fillColor('#0284c7').font('Helvetica-Bold');
            doc.text(cleanJobNo, ML + 41, currentY + 4.5, { width: 65, lineBreak: false });

            doc.fillColor('#334155').font('Helvetica');
            doc.text(log.party, ML + 108, currentY + 4.5, { width: 105, lineBreak: false });
            doc.text(log.design, ML + 215, currentY + 4.5, { width: 80, lineBreak: false });

            doc.fillColor('#000000').font('Helvetica-Bold');
            doc.text(machineShort, ML + 300, currentY + 4.5, { width: 45, align: 'center', lineBreak: false });
            doc.text(passNum, ML + 347, currentY + 4.5, { width: 35, align: 'center', lineBreak: false });

            doc.fillColor('#047857').font('Helvetica-Bold');
            doc.text(`${log.meters.toFixed(2)} mtr`, ML + 384, currentY + 4.5, { width: 65, align: 'right', lineBreak: false });

            doc.fillColor('#334155').font('Helvetica');
            doc.text(log.operatorName, ML + 451, currentY + 4.5, { width: 75, lineBreak: false });

            subtotalMtr += log.meters;
            currentY += 18;
          });

          // Detailed Total Row
          if (checkAddPage(20)) {
            drawDetailHeaders();
          }
          doc.rect(ML, currentY, contentWidth, 18).fill('#e2e8f0').stroke('#cbd5e1');
          doc.fillColor('#0f172a').fontSize(7.2).font('Helvetica-Bold');
          doc.text(`GRAND TOTAL PRINTED METERS (${detailedPrintLogsList.length} LOGS):`, ML + 4, currentY + 4.5, { width: 400, lineBreak: false });
          doc.fillColor('#047857').font('Helvetica-Bold');
          doc.text(`${subtotalMtr.toFixed(2)} mtr`, ML + 406, currentY + 4.5, { width: 65, align: 'right', lineBreak: false });
          currentY += 18;
        }

      }

      currentY += 12;

    // ── 5. FABRIC CURRENT STOCK SUMMARY (NEW TABLE) ──
    if (selectedReports.includes('stock') && stockSummaryData.length > 0) {
      checkAddPage(60);

      const totalStockMtr = stockSummaryData.reduce((s, st) => s + Math.max(0, st.currentStock || 0), 0);

      doc.rect(ML, currentY, contentWidth, 20).fill('#ede9fe').stroke('#ddd6fe');
      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold')
        .text('5. FABRIC CURRENT STOCK SUMMARY', ML + 8, currentY + 5, { lineBreak: false });
      doc.fillColor('#5b21b6').fontSize(8.5).font('Helvetica-Bold')
        .text(`Total: ${stockSummaryData.length} Qualities (${totalStockMtr.toFixed(2)} mtr available)`, ML + contentWidth - 250, currentY + 5, { width: 240, align: 'right', lineBreak: false });

      currentY += 24;

      const drawStockHeaders = () => {
        doc.rect(ML, currentY, contentWidth, 18).fill('#f8fafc').stroke('#cbd5e1');
        doc.fillColor('#000000').fontSize(7.2).font('Helvetica-Bold');
        doc.text('FABRIC QUALITY', ML + 4, currentY + 5, { width: 180 });
        doc.text('TOTAL INWARD (MTR)', ML + 188, currentY + 5, { width: 85, align: 'right' });
        doc.text('TOTAL OUTWARD (MTR)', ML + 277, currentY + 5, { width: 85, align: 'right' });
        doc.text('CURRENT STOCK (MTR)', ML + 366, currentY + 5, { width: 85, align: 'right' });
        doc.text('STOCK STATUS', ML + 455, currentY + 5, { width: 73, align: 'center' });
        currentY += 18;
      };

      drawStockHeaders();

      stockSummaryData.forEach((st, idx) => {
        if (checkAddPage(20)) {
          drawStockHeaders();
        }
        const bg = idx % 2 === 0 ? '#ffffff' : '#fcfaff';
        doc.rect(ML, currentY, contentWidth, 18).fill(bg);
        doc.strokeColor('#f1f5f9').lineWidth(0.5).rect(ML, currentY, contentWidth, 18).stroke();

        const isLow = st.currentStock <= 50 && st.currentStock > 0;
        const isEmpty = st.currentStock <= 0;
        const statusLabel = isEmpty ? 'EMPTY' : isLow ? 'LOW STOCK' : 'SAFE';
        const statusColor = isEmpty ? '#dc2626' : isLow ? '#d97706' : '#047857';

        doc.fillColor('#000000').fontSize(7).font('Helvetica');
        doc.text(st.fabricQuality || '—', ML + 4, currentY + 4.5, { width: 180, lineBreak: false });
        doc.text(`${parseFloat(st.totalInward || 0).toFixed(2)}`, ML + 188, currentY + 4.5, { width: 85, align: 'right', lineBreak: false });
        doc.text(`${parseFloat(st.totalOutward || 0).toFixed(2)}`, ML + 277, currentY + 4.5, { width: 85, align: 'right', lineBreak: false });
        doc.fillColor(statusColor).font('Helvetica-Bold');
        doc.text(`${parseFloat(st.currentStock || 0).toFixed(2)}`, ML + 366, currentY + 4.5, { width: 85, align: 'right', lineBreak: false });
        doc.text(statusLabel, ML + 455, currentY + 4.5, { width: 73, align: 'center', lineBreak: false });
        currentY += 18;
      });
    }

    // Dynamic Footer Page Stamping on All Pages
    const pageRange = doc.bufferedPageRange();
    for (let i = pageRange.start; i < pageRange.start + pageRange.count; i++) {
      doc.switchToPage(i);
      doc.fillColor('#6b21a8').fontSize(8).font('Helvetica')
        .text(`Page ${i + 1} of ${pageRange.count} — Elite Digital Prints 1 Page Report`, ML, 795, { width: contentWidth, align: 'center', lineBreak: false });
    }

    doc.end();
  } catch (err) {
    console.error('Error generating combined fabric PDF:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  }
};

const createStockAdjustment = async (req, res) => {
  try {
    const {
      date,
      partyName,
      adjustmentType = 'RETURN_REJECTED',
      fabricQuality,
      panna,
      lotNo,
      vendorChallanNo = '',
      tpDetails = [],
      totalMtr = 0,
      totalTp = 0,
      reason = 'Fabric Return / Rejection',
      notes = '',
      createdBy = ''
    } = req.body;

    if (!fabricQuality || (!totalMtr && tpDetails.length === 0)) {
      return res.status(400).json({ success: false, error: 'Fabric Quality and return meters/TP details are required.' });
    }

    const normFabric = normalizeFabric(fabricQuality);
    const normP = normalizePanna(panna, normFabric);

    const getVendorShortCode = (name) => {
      if (!name) return '';
      const u = name.toUpperCase().trim();
      if (u.includes('AVSAR')) return 'AV';
      if (u.includes('ELITE')) return 'EL';
      if (u.includes('FABTEX')) return 'FT';
      if (u.includes('MAHAGAURI')) return 'MG';
      if (u.includes('OEQUAL') || u.includes('OE')) return 'OE';
      if (u.includes('OZONE')) return 'OZ';
      if (u.includes('YAMUNAJI')) return 'YM';
      if (u.includes('SUDAR')) return 'SUD';
      if (u.includes('SUMM')) return 'SUM';
      if (u.includes('RAYON') || u.includes('REYON')) return 'RY';
      
      const words = u.split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        return words.map(w => w[0]).join('').substring(0, 3);
      }
      return u.substring(0, 3);
    };

    const formatVendorChallanWithPrefix = (vNo, vendorName) => {
      if (!vNo) return '';
      const cleanNo = String(vNo).trim();
      if (!cleanNo) return '';
      if (/^[A-Za-z0-9]{2,4}-/.test(cleanNo)) {
        return cleanNo;
      }
      const shortForm = getVendorShortCode(vendorName);
      if (shortForm) {
        return `${shortForm}-${cleanNo}`;
      }
      return cleanNo;
    };

    let finalVendorChallan = (vendorChallanNo || '').trim();
    let vendorForLookup = partyName || '';

    if (lotNo) {
      const numLot = parseInt(lotNo, 10);
      if (!isNaN(numLot)) {
        const inTx = await FabricTransaction.findOne({ lotNo: numLot, type: 'INWARD' }).sort({ date: 1 }).lean();
        if (inTx) {
          if (!finalVendorChallan && inTx.challanNo) {
            finalVendorChallan = inTx.challanNo;
          }
          if (!vendorForLookup && inTx.vendorName) {
            vendorForLookup = inTx.vendorName;
          }
        }
      }
    }

    if (finalVendorChallan && vendorForLookup) {
      finalVendorChallan = formatVendorChallanWithPrefix(finalVendorChallan, vendorForLookup);
    }

    const saDoc = new FabricStockAdjustment({
      date: date ? new Date(date) : new Date(),
      partyName: partyName || vendorForLookup || '',
      adjustmentType,
      fabricQuality: normFabric,
      panna: normP,
      lotNo: lotNo || '',
      vendorChallanNo: finalVendorChallan,
      tpDetails: tpDetails || [],
      totalMtr: Number(totalMtr) || 0,
      totalTp: Number(totalTp) || tpDetails.length,
      reason: reason || 'Fabric Return / Rejection',
      notes: notes || '',
      createdBy: createdBy || ''
    });

    await saDoc.save();

    const isReturnOrDeduction = adjustmentType === 'RETURN_REJECTED' || adjustmentType === 'STOCK_DEDUCTION';
    const txType = isReturnOrDeduction ? 'OUTWARD' : 'INWARD';

    const createdTxIds = [];
    const lotMeterMap = {};

    if (tpDetails.length > 0) {
      tpDetails.forEach(tp => {
        const lKey = (tp.lotNo || lotNo || '').trim();
        const mtr = parseFloat(tp.tpMeter) || 0;
        if (lKey && mtr > 0) {
          lotMeterMap[lKey] = (lotMeterMap[lKey] || 0) + mtr;
        }
      });
    }

    if (Object.keys(lotMeterMap).length === 0) {
      const lKey = (lotNo || '').trim();
      lotMeterMap[lKey || 'UNASSIGNED'] = Number(totalMtr);
    }

    for (const [lNo, mtr] of Object.entries(lotMeterMap)) {
      let finalQty = Number(mtr.toFixed(2));
      let finalNotes = `Stock Adjustment ${saDoc.saNo} (${reason})`;
      if (notes) finalNotes += ` - ${notes}`;

      const tx = new FabricTransaction({
        type: txType,
        jobNo: saDoc.saNo,
        partyName: partyName || 'VEND_RETURN',
        fabricQuality: normFabric,
        panna: normP,
        lotNo: lNo !== 'UNASSIGNED' && !isNaN(parseInt(lNo, 10)) ? parseInt(lNo, 10) : undefined,
        qty: finalQty,
        shortagePct: 0,
        date: saDoc.date,
        notes: finalNotes
      });

      await tx.save();
      createdTxIds.push(tx._id);

      if (tx.lotNo) {
        const lotAgg = await FabricTransaction.aggregate([
          { $match: { lotNo: tx.lotNo } },
          {
            $group: {
              _id: '$lotNo',
              fabricQuality: { $first: '$fabricQuality' },
              panna: { $first: '$panna' },
              totalIn: { $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] } },
              totalOut: { $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] } }
            }
          }
        ]);
        if (lotAgg.length > 0) {
          const rem = lotAgg[0].totalIn - lotAgg[0].totalOut;
          if (rem > 0 && rem <= 5.0) {
            const scrapTx = new FabricTransaction({
              type: 'OUTWARD',
              fabricQuality: lotAgg[0].fabricQuality,
              panna: lotAgg[0].panna,
              lotNo: tx.lotNo,
              qty: Number(rem.toFixed(2)),
              shortagePct: 0,
              date: new Date(),
              notes: 'Remnant Stock Auto-Clear (0 < stock <= 5m converted to 0)'
            });
            await scrapTx.save();
          }
        }
      }
    }

    saDoc.fabricTransactionIds = createdTxIds;
    await saDoc.save();

    res.status(201).json({ success: true, data: saDoc });
  } catch (err) {
    console.error('Error creating fabric stock adjustment:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

const updateStockAdjustment = async (req, res) => {
  try {
    const { id } = req.params;
    const saDoc = await FabricStockAdjustment.findById(id);
    if (!saDoc) {
      return res.status(404).json({ success: false, error: 'Stock adjustment record not found.' });
    }

    const {
      date,
      partyName,
      adjustmentType = 'RETURN_REJECTED',
      fabricQuality,
      panna,
      lotNo,
      vendorChallanNo = '',
      tpDetails = [],
      totalMtr = 0,
      totalTp = 0,
      reason = 'Fabric Return / Rejection',
      notes = '',
      createdBy = ''
    } = req.body;

    if (!fabricQuality || (!totalMtr && tpDetails.length === 0)) {
      return res.status(400).json({ success: false, error: 'Fabric Quality and return meters/TP details are required.' });
    }

    const normFabric = normalizeFabric(fabricQuality);
    const normP = normalizePanna(panna, normFabric);

    let finalVendorChallan = (vendorChallanNo || '').trim();
    let vendorForLookup = partyName || saDoc.partyName || '';

    if (lotNo) {
      const numLot = parseInt(lotNo, 10);
      if (!isNaN(numLot)) {
        const inTx = await FabricTransaction.findOne({ lotNo: numLot, type: 'INWARD' }).sort({ date: 1 }).lean();
        if (inTx) {
          if (!finalVendorChallan && inTx.challanNo) {
            finalVendorChallan = inTx.challanNo;
          }
          if (!vendorForLookup && inTx.vendorName) {
            vendorForLookup = inTx.vendorName;
          }
        }
      }
    }

    if (finalVendorChallan && vendorForLookup) {
      const getVendorShortCode = (name) => {
        if (!name) return '';
        const u = name.toUpperCase().trim();
        if (u.includes('AVSAR')) return 'AV';
        if (u.includes('ELITE')) return 'EL';
        if (u.includes('FABTEX')) return 'FT';
        if (u.includes('MAHAGAURI')) return 'MG';
        if (u.includes('OEQUAL') || u.includes('OE')) return 'OE';
        if (u.includes('OZONE')) return 'OZ';
        if (u.includes('YAMUNAJI')) return 'YM';
        if (u.includes('SUDAR')) return 'SUD';
        if (u.includes('SUMM')) return 'SUM';
        if (u.includes('RAYON') || u.includes('REYON')) return 'RY';
        const words = u.split(/\s+/).filter(Boolean);
        if (words.length >= 2) return words.map(w => w[0]).join('').substring(0, 3);
        return u.substring(0, 3);
      };

      if (!/^[A-Za-z0-9]{2,4}-/.test(finalVendorChallan)) {
        const sc = getVendorShortCode(vendorForLookup);
        if (sc) finalVendorChallan = `${sc}-${finalVendorChallan}`;
      }
    }

    // Delete existing transactions tied to this SA
    if (saDoc.fabricTransactionIds && saDoc.fabricTransactionIds.length > 0) {
      await FabricTransaction.deleteMany({ _id: { $in: saDoc.fabricTransactionIds } });
    }

    // Update SA document fields
    saDoc.date = date ? new Date(date) : saDoc.date;
    saDoc.partyName = partyName || vendorForLookup || '';
    saDoc.adjustmentType = adjustmentType;
    saDoc.fabricQuality = normFabric;
    saDoc.panna = normP;
    saDoc.lotNo = lotNo || '';
    saDoc.vendorChallanNo = finalVendorChallan;
    saDoc.tpDetails = tpDetails || [];
    saDoc.totalMtr = Number(totalMtr) || 0;
    saDoc.totalTp = Number(totalTp) || (tpDetails ? tpDetails.length : 0);
    saDoc.reason = reason || 'Fabric Return / Rejection';
    saDoc.notes = notes || '';
    if (createdBy) saDoc.createdBy = createdBy;

    const isReturnOrDeduction = adjustmentType === 'RETURN_REJECTED' || adjustmentType === 'STOCK_DEDUCTION';
    const txType = isReturnOrDeduction ? 'OUTWARD' : 'INWARD';

    const createdTxIds = [];
    const lotMeterMap = {};

    if (tpDetails.length > 0) {
      tpDetails.forEach(tp => {
        const lKey = (tp.lotNo || lotNo || '').trim();
        const mtr = parseFloat(tp.tpMeter) || 0;
        if (lKey && mtr > 0) {
          lotMeterMap[lKey] = (lotMeterMap[lKey] || 0) + mtr;
        }
      });
    }

    if (Object.keys(lotMeterMap).length === 0) {
      const lKey = (lotNo || '').trim();
      lotMeterMap[lKey || 'UNASSIGNED'] = Number(totalMtr);
    }

    for (const [lNo, mtr] of Object.entries(lotMeterMap)) {
      let finalQty = Number(mtr.toFixed(2));
      let finalNotes = `Stock Adjustment ${saDoc.saNo} (${reason})`;
      if (notes) finalNotes += ` - ${notes}`;

      const tx = new FabricTransaction({
        type: txType,
        jobNo: saDoc.saNo,
        partyName: partyName || 'VEND_RETURN',
        fabricQuality: normFabric,
        panna: normP,
        lotNo: lNo !== 'UNASSIGNED' && !isNaN(parseInt(lNo, 10)) ? parseInt(lNo, 10) : undefined,
        qty: finalQty,
        shortagePct: 0,
        date: saDoc.date,
        notes: finalNotes
      });

      await tx.save();
      createdTxIds.push(tx._id);
    }

    saDoc.fabricTransactionIds = createdTxIds;
    await saDoc.save();

    res.status(200).json({ success: true, data: saDoc });
  } catch (err) {
    console.error('Error updating fabric stock adjustment:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getStockAdjustments = async (req, res) => {
  try {
    const adjustments = await FabricStockAdjustment.find().sort({ saSeq: -1 }).lean();
    res.status(200).json({ success: true, data: adjustments });
  } catch (err) {
    console.error('Error fetching stock adjustments:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getStockAdjustmentById = async (req, res) => {
  try {
    const saDoc = await FabricStockAdjustment.findById(req.params.id).lean();
    if (!saDoc) return res.status(404).json({ success: false, error: 'Stock adjustment record not found.' });
    res.status(200).json({ success: true, data: saDoc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteStockAdjustment = async (req, res) => {
  try {
    const saDoc = await FabricStockAdjustment.findById(req.params.id);
    if (!saDoc) return res.status(404).json({ success: false, error: 'Stock adjustment record not found.' });

    if (saDoc.fabricTransactionIds && saDoc.fabricTransactionIds.length > 0) {
      await FabricTransaction.deleteMany({ _id: { $in: saDoc.fabricTransactionIds } });
    }

    await FabricStockAdjustment.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: `Stock Adjustment ${saDoc.saNo} deleted and stock restored successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const downloadStockAdjustmentPdf = async (req, res) => {
  try {
    const saDoc = await FabricStockAdjustment.findById(req.params.id).lean();
    if (!saDoc) return res.status(404).json({ error: 'Stock adjustment record not found' });

    const path = require('path');
    const fs = require('fs');
    const logoPath = path.join(__dirname, 'Logo.png');

    const doc = new PDFDocument({ size: 'A4', margin: 30, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Fabric_Return_${saDoc.saNo}.pdf"`);
    doc.pipe(res);

    const ML = 30;
    const MR = 30;
    const PW = 595;
    const PH = 842;
    const contentWidth = PW - ML - MR;
    const ADDRESS_LINE = 'G.F., PLOT NO-B/37, Siddheshwar Soc., Punagam Main Road, NR. KALAPUL, Punagam, Surat';

    const dStr = saDoc.date ? new Date(saDoc.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

    const getColor = (colorStr, isColorPage) => {
      if (isColorPage) return colorStr;
      if (colorStr === '#7e22ce' || colorStr === '#6b21a8') return '#000000';
      return '#000000'; // Black & White on second page
    };

    const renderPage = (isColorPage) => {
      let y = 18;

      // ── HEADER SECTION ────────────────────────────────────────────────────────
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, ML, y, { width: 140 });
      }

      const displayNo = (saDoc.saNo || '').replace(/^SA-/i, 'RE-');

      // Title & Return # on right
      doc.fillColor(getColor('#000000', isColorPage)).fontSize(16).font('Helvetica-Bold')
        .text('RETURN', ML, y + 2, { width: contentWidth, align: 'right', lineBreak: false });

      doc.fillColor(getColor('#6b21a8', isColorPage)).fontSize(12).font('Helvetica-Bold')
        .text(`RETURN #: ${displayNo}`, ML, y + 22, { width: contentWidth, align: 'right', lineBreak: false });

      doc.fillColor(getColor('#475569', isColorPage)).fontSize(8.5).font('Helvetica')
        .text(`Date: ${dStr}`, ML, y + 38, { width: contentWidth, align: 'right', lineBreak: false });

      // Address line below logo (STRICT SINGLE LINE)
      doc.fillColor(getColor('#374151', isColorPage)).fontSize(7.5).font('Helvetica')
        .text(ADDRESS_LINE, ML, y + 54, { width: 380, lineBreak: false });

      doc.moveTo(ML, y + 68).lineTo(ML + contentWidth, y + 68).strokeColor(getColor('#c084fc', isColorPage)).lineWidth(1.5).stroke();

      y = y + 78;

      // ── PARTY / VENDOR INFO BOX ─────────────────────────────────────────────────
      const infoBoxH = saDoc.notes ? 72 : 58;
      doc.rect(ML, y, contentWidth, infoBoxH).fill(isColorPage ? '#faf5ff' : '#ffffff').stroke(getColor('#e9d5ff', isColorPage));
      doc.fillColor(getColor('#000000', isColorPage)).fontSize(8.5).font('Helvetica-Bold');

      // Row 1
      doc.text('PARTY / VENDOR:', ML + 10, y + 8);
      doc.font('Helvetica').text(saDoc.partyName || '—', ML + 120, y + 8, { width: 165, lineBreak: false });

      doc.font('Helvetica-Bold').text('ADJUSTMENT TYPE:', ML + 295, y + 8);
      doc.font('Helvetica').text(
        saDoc.adjustmentType === 'RETURN_REJECTED' ? 'Return / Rejected Outward'
          : saDoc.adjustmentType === 'STOCK_DEDUCTION' ? 'Stock Deduction'
          : saDoc.adjustmentType === 'STOCK_ADDITION' ? 'Stock Addition'
          : saDoc.adjustmentType,
        ML + 400, y + 8, { width: 125, lineBreak: false }
      );

      // Row 2
      doc.font('Helvetica-Bold').text('FABRIC & PANNA:', ML + 10, y + 23);
      doc.font('Helvetica').text(`${saDoc.fabricQuality || '—'}${saDoc.panna ? ' (' + saDoc.panna + '")' : ''}`, ML + 120, y + 23, { width: 165, lineBreak: false });

      doc.font('Helvetica-Bold').text('LOT NUMBER(S):', ML + 295, y + 23);
      doc.font('Helvetica').text(saDoc.lotNo ? `#${saDoc.lotNo}` : '—', ML + 400, y + 23, { width: 125, lineBreak: false });

      // Row 3
      doc.font('Helvetica-Bold').text('VENDOR CHALLAN NO:', ML + 10, y + 38);
      doc.font('Helvetica').text(saDoc.vendorChallanNo || '—', ML + 120, y + 38, { width: 165, lineBreak: false });

      doc.font('Helvetica-Bold').text('REASON / REMARK:', ML + 295, y + 38);
      doc.font('Helvetica').text(saDoc.reason || 'Fabric Return / Rejection', ML + 400, y + 38, { width: 125, lineBreak: false });

      // Row 4 (Notes)
      if (saDoc.notes) {
        doc.font('Helvetica-Bold').text('NOTES:', ML + 10, y + 53);
        doc.font('Helvetica').text(saDoc.notes, ML + 120, y + 53, { width: 400, lineBreak: false });
      }

      y += infoBoxH + 12;

      // ── 3-COLUMN TP DETAILS TABLE ──────────────────────────────────────────────
      const activeTps = (saDoc.tpDetails && saDoc.tpDetails.length > 0 ? saDoc.tpDetails : [{ tpNo: 1, tpMeter: saDoc.totalMtr }])
        .filter(tp => tp.tpMeter != null && parseFloat(tp.tpMeter) > 0);

      const activeCount = activeTps.length;
      const tpColsCount = 3; // FORCED 3 COLUMNS as requested by user
      const tpColWidth = contentWidth / tpColsCount;
      const rowsPerCol = Math.max(1, Math.ceil(activeCount / tpColsCount));
      const tpRowHeight = 19;
      const tableHeaderHeight = 20;

      // Table Header Row across 3 columns
      for (let c = 0; c < tpColsCount; c++) {
        const x = ML + c * tpColWidth;
        doc.rect(x, y, tpColWidth, tableHeaderHeight).fill(isColorPage ? '#ede9fe' : '#f1f5f9');
        doc.strokeColor(getColor('#c084fc', isColorPage)).lineWidth(0.5).rect(x, y, tpColWidth, tableHeaderHeight).stroke();

        doc.fillColor(getColor('#000000', isColorPage)).fontSize(8.5).font('Helvetica-Bold');
        doc.text('TP / ROLL NO', x + 8, y + 6, { width: tpColWidth * 0.45 });
        doc.text('METERS (MTR)', x + tpColWidth * 0.45, y + 6, { width: tpColWidth * 0.52, align: 'right' });
      }

      y += tableHeaderHeight;
      const tableBodyStartY = y;

      if (activeCount === 0) {
        doc.rect(ML, y, contentWidth, tpRowHeight).fill('#ffffff').stroke('#f1f5f9');
        doc.fillColor('#000000').fontSize(8.5).font('Helvetica')
          .text('No TP details entered.', ML + 10, y + 5);
        y += tpRowHeight;
      } else {
        for (let i = 0; i < activeCount; i++) {
          const tp = activeTps[i];
          const colIndex = Math.floor(i / rowsPerCol);
          const rowIndex = i % rowsPerCol;

          const x = ML + colIndex * tpColWidth;
          const rowY = tableBodyStartY + rowIndex * tpRowHeight;

          doc.rect(x, rowY, tpColWidth, tpRowHeight).fill(rowIndex % 2 === 0 ? '#ffffff' : (isColorPage ? '#faf5ff' : '#f8fafc'));
          doc.strokeColor('#e2e8f0').lineWidth(0.4).rect(x, rowY, tpColWidth, tpRowHeight).stroke();

          doc.fillColor(getColor('#000000', isColorPage)).fontSize(8.5).font('Helvetica');
          doc.text(`TP-${tp.tpNo}`, x + 8, rowY + 5, { width: tpColWidth * 0.45 });
          doc.font('Helvetica-Bold').text(`${parseFloat(tp.tpMeter || 0).toFixed(2)} mtr`, x + tpColWidth * 0.45, rowY + 5, { width: tpColWidth * 0.52, align: 'right' });
        }

        // Fill remaining empty cells in partial columns to keep grid clean
        const totalGridCells = rowsPerCol * tpColsCount;
        for (let i = activeCount; i < totalGridCells; i++) {
          const colIndex = Math.floor(i / rowsPerCol);
          const rowIndex = i % rowsPerCol;
          const x = ML + colIndex * tpColWidth;
          const rowY = tableBodyStartY + rowIndex * tpRowHeight;

          doc.rect(x, rowY, tpColWidth, tpRowHeight).fill(rowIndex % 2 === 0 ? '#ffffff' : (isColorPage ? '#faf5ff' : '#f8fafc'));
          doc.strokeColor('#e2e8f0').lineWidth(0.4).rect(x, rowY, tpColWidth, tpRowHeight).stroke();
        }

        y = tableBodyStartY + rowsPerCol * tpRowHeight;
      }

      // ── TOTALS SUMMARY ROW ─────────────────────────────────────────────────────
      doc.rect(ML, y, contentWidth, 26).fill(isColorPage ? '#f3e8ff' : '#f1f5f9').stroke(getColor('#c084fc', isColorPage));
      doc.fillColor(getColor('#000000', isColorPage)).fontSize(9).font('Helvetica-Bold');
      doc.text(`TOTAL ROLLS / TP: ${saDoc.totalTp || activeCount}`, ML + 10, y + 8);
      doc.fillColor(getColor('#7e22ce', isColorPage)).fontSize(11).font('Helvetica-Bold')
        .text(`TOTAL METERS RETURNED: ${parseFloat(saDoc.totalMtr || 0).toFixed(2)} MTR`, ML + 200, y + 7, { width: contentWidth - 210, align: 'right' });

      y += 34;

      // ── TERMS & CONDITIONS ──────────────────────────────────────────────────────
      doc.fillColor(getColor('#64748b', isColorPage)).fontSize(7).font('Helvetica')
        .text('Terms & Conditions: Fabric return accepted subject to quality inspection. This voucher is valid only with company seal and signature.', ML, y, { width: contentWidth });

      // ── SIGNATURES AT BOTTOM ────────────────────────────────────────────────────
      const sigY = PH - MR - 45;

      doc.fillColor(getColor('#374151', isColorPage)).fontSize(8).font('Helvetica-Bold');
      doc.text('Receiver / Supplier Sign', ML + 20, sigY, { width: 160, align: 'center' });
      doc.text('Authorized Signatory', ML + contentWidth - 180, sigY, { width: 160, align: 'center' });

      doc.moveTo(ML + 20, sigY + 22).lineTo(ML + 180, sigY + 22).strokeColor(getColor('#94a3b8', isColorPage)).lineWidth(1).stroke();
      doc.moveTo(ML + contentWidth - 180, sigY + 22).lineTo(ML + contentWidth - 20, sigY + 22).strokeColor(getColor('#94a3b8', isColorPage)).lineWidth(1).stroke();
    };

    renderPage(true);  // Page 1: Color
    doc.addPage();
    renderPage(false); // Page 2: Black & White Duplicate

    doc.end();
  } catch (err) {
    console.error('Error generating Stock Adjustment PDF voucher:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ── POST /fabric/lot-transfer ──────────────────────────────────────────────
const createLotTransfer = async (req, res) => {
  try {
    const { date, fabricQuality, panna, sourceLotNo, destLotNo, qty, notes } = req.body;

    const sourceLot = parseInt(sourceLotNo, 10);
    const destLot = parseInt(destLotNo, 10);
    const transferQty = parseFloat(qty);

    if (isNaN(sourceLot) || isNaN(destLot)) {
      return res.status(400).json({ success: false, error: 'Valid source and destination lot numbers are required.' });
    }
    if (sourceLot === destLot) {
      return res.status(400).json({ success: false, error: 'Source and destination lots must be different.' });
    }
    if (isNaN(transferQty) || transferQty <= 0) {
      return res.status(400).json({ success: false, error: 'Transfer quantity must be greater than 0.' });
    }
    if (!fabricQuality) {
      return res.status(400).json({ success: false, error: 'Fabric quality is required.' });
    }

    const transferDate = date ? new Date(date) : new Date();
    const transferRefId = 'LT-' + Date.now();

    // 1. OUTWARD from Source Lot
    const outwardTx = new FabricTransaction({
      type: 'OUTWARD',
      date: transferDate,
      fabricQuality,
      panna: panna || '',
      lotNo: sourceLot,
      qty: transferQty,
      notes: `Lot Transfer to Lot #${destLot}${notes ? ' | ' + notes : ''} [Ref: ${transferRefId}]`
    });

    // 2. INWARD to Destination Lot
    const inwardTx = new FabricTransaction({
      type: 'INWARD',
      date: transferDate,
      fabricQuality,
      panna: panna || '',
      lotNo: destLot,
      qty: transferQty,
      notes: `Lot Transfer from Lot #${sourceLot}${notes ? ' | ' + notes : ''} [Ref: ${transferRefId}]`
    });

    await outwardTx.save();
    await inwardTx.save();

    res.status(201).json({
      success: true,
      message: `Successfully transferred ${transferQty}m from Lot #${sourceLot} to Lot #${destLot}`,
      data: { outwardTx, inwardTx, transferRefId }
    });
  } catch (error) {
    console.error('Error creating lot transfer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── GET /fabric/lot-transfer ───────────────────────────────────────────────
const getLotTransfers = async (req, res) => {
  try {
    const { dateStart, dateEnd, search } = req.query;

    // Base: any transaction that is a lot transfer/rebalance
    // — primary: match by [Ref: LT-] tag in notes
    // — fallback: catch first-batch auto-rebalance entries that lacked a Ref tag
    const conditions = [
      {
        $or: [
          { notes: { $regex: /\[Ref:\s*LT-/i } },
          { notes: { $regex: /Auto Lot Rebalance/i } },
          { notes: { $regex: /Lot Transfer to Lot/i } },
          { notes: { $regex: /Lot Transfer from Lot/i } }
        ]
      }
    ];

    if (dateStart || dateEnd) {
      const dateRange = {};
      if (dateStart) dateRange.$gte = new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setHours(23, 59, 59, 999);
        dateRange.$lte = end;
      }
      conditions.push({ date: dateRange });
    }

    if (search) {
      const re = new RegExp(search, 'i');
      conditions.push({
        $or: [
          { fabricQuality: re },
          { notes: re }
        ]
      });
    }

    const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };

    const txs = await FabricTransaction.find(filter).sort({ date: -1, createdAt: -1 }).lean();

    // Group pairs by unique Ref ID — each paired OUTWARD + INWARD shares the same [Ref: LT-xxx]
    const transferMap = new Map();
    txs.forEach(t => {
      const matchRef = (t.notes || '').match(/\[Ref:\s*(LT-[A-Za-z0-9_-]+)\]/i);

      // Build ref key: use [Ref: LT-xxx] if present, else build from notes/lot/qty
      let refKey;
      if (matchRef) {
        refKey = matchRef[1];
      } else {
        // Fallback for old entries without a Ref tag — group by same note text (trimmed)
        refKey = `LT-LEGACY-${(t.notes || '').replace(/\s+/g, '-').substring(0, 60)}`;
      }

      if (!transferMap.has(refKey)) {
        transferMap.set(refKey, {
          transferRefId: refKey,
          date: t.date,
          fabricQuality: t.fabricQuality,
          panna: t.panna,
          qty: t.qty,
          sourceLotNo: null,
          destLotNo: null,
          sourceTxId: null,
          destTxId: null,
          notes: t.notes
        });
      }

      const item = transferMap.get(refKey);
      if (t.type === 'OUTWARD') {
        item.sourceLotNo = t.lotNo;
        item.sourceTxId = t._id;
      } else if (t.type === 'INWARD') {
        item.destLotNo = t.lotNo;
        item.destTxId = t._id;
      }
    });

    // Sort by date descending
    const result = Array.from(transferMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── POST /fabric/auto-lot-transfer ───────────────────────────────────────
const autoLotTransfer = async (req, res) => {
  try {
    const lots = await computeLotWiseData();

    // 1. Separate negative deficit lots and positive stock lots
    const negativeLots = lots.filter(l => l.currentStock < 0);
    const positiveLots = lots.filter(l => l.currentStock > 0);

    if (negativeLots.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No negative deficit lots found. Inventory stock balances are all clean!',
        data: { transferredCount: 0, totalMetersTransferred: 0, transfers: [] }
      });
    }

    const executedTransfers = [];
    let totalMetersTransferred = 0;
    const now = new Date();
    const batchTimestamp = Date.now();

    // Work on mutable copies of lot stocks
    const posLots = positiveLots.map(l => ({ ...l }));

    for (const negLot of negativeLots) {
      let deficitNeeded = Math.abs(negLot.currentStock);

      // Try matching by: 3) Fabric + Panna + Party, 2) Fabric + Panna, 1) Fabric
      const matchCandidates = (strictness) => {
        return posLots.filter(p => {
          if (p.currentStock <= 0) return false;
          if (String(p.lotNo) === String(negLot.lotNo)) return false;

          const fabMatch = (p.fabricQuality || '').toLowerCase().trim() === (negLot.fabricQuality || '').toLowerCase().trim();
          if (!fabMatch) return false;

          const pannaMatch = String(p.panna || '').replace(/['"]/g, '').trim() === String(negLot.panna || '').replace(/['"]/g, '').trim();
          const vendorMatch = (p.vendorName || '').toLowerCase().trim() === (negLot.vendorName || '').toLowerCase().trim() && Boolean(p.vendorName);

          if (strictness === 3) return fabMatch && pannaMatch && vendorMatch;
          if (strictness === 2) return fabMatch && pannaMatch;
          if (strictness === 1) return fabMatch;
          return false;
        }).sort((a, b) => b.currentStock - a.currentStock); // prefer larger positive lots
      };

      // Try strict level 3 (Fabric + Panna + Party), then 2 (Fabric + Panna), then 1 (Fabric)
      for (const level of [3, 2, 1]) {
        if (deficitNeeded <= 0.001) break;

        const candidates = matchCandidates(level);

        for (const candidate of candidates) {
          if (deficitNeeded <= 0.001) break;
          if (candidate.currentStock <= 0) continue;

          const transferQty = Number(Math.min(candidate.currentStock, deficitNeeded).toFixed(2));
          if (transferQty <= 0) continue;

          // Deduct from candidate, add to deficit
          candidate.currentStock -= transferQty;
          deficitNeeded -= transferQty;
          totalMetersTransferred += transferQty;

          const pairRefId = `LT-AUTO-${batchTimestamp}-${executedTransfers.length + 1}`;
          const matchLabel = level === 3 ? 'Fabric + Panna + Party' : level === 2 ? 'Fabric + Panna' : 'Fabric Quality';
          const noteMsg = `Auto Lot Transfer Rebalance (${matchLabel}): Lot #${candidate.lotNo} -> Lot #${negLot.lotNo} [Ref: ${pairRefId}]`;

          // Create OUTWARD from candidate
          const outwardTx = new FabricTransaction({
            type: 'OUTWARD',
            date: now,
            fabricQuality: candidate.fabricQuality,
            panna: candidate.panna || '',
            lotNo: candidate.lotNo,
            qty: transferQty,
            notes: noteMsg
          });

          // Create INWARD to negative lot
          const inwardTx = new FabricTransaction({
            type: 'INWARD',
            date: now,
            fabricQuality: negLot.fabricQuality || candidate.fabricQuality,
            panna: negLot.panna || candidate.panna || '',
            lotNo: negLot.lotNo,
            qty: transferQty,
            notes: noteMsg
          });

          await outwardTx.save();
          await inwardTx.save();

          executedTransfers.push({
            refId: pairRefId,
            fabricQuality: candidate.fabricQuality,
            panna: candidate.panna,
            vendorName: candidate.vendorName || negLot.vendorName,
            sourceLotNo: candidate.lotNo,
            destLotNo: negLot.lotNo,
            qty: transferQty,
            matchCriteria: matchLabel
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      message: executedTransfers.length > 0
        ? `Successfully auto-rebalanced ${executedTransfers.length} transfer pairs (${totalMetersTransferred.toFixed(2)} mtr total) and recorded in history.`
        : 'Could not auto-rebalance negative lots because no matching positive stock lots were found for the same fabric/panna/party.',
      data: {
        batchRefId: `LT-AUTO-${batchTimestamp}`,
        transferredCount: executedTransfers.length,
        totalMetersTransferred: Number(totalMetersTransferred.toFixed(2)),
        transfers: executedTransfers
      }
    });
  } catch (error) {
    console.error('Error executing auto lot transfer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  createInward,
  createOutward,
  getTransactions,
  getStockOverview,
  getLotStock,
  deleteTransaction,
  updateTransaction,
  getLotLedger,
  downloadLedgerPdf,
  getStockByPanna,
  getFabricRequirement,
  importStock,
  downloadFabricInwardPdf,
  downloadFabricOutwardPdf,
  downloadFabricLotWisePdf,
  downloadFabricCombinedReportPdf,
  getFabricInwardReportData,
  getFabricOutwardReportData,
  getFabricLotWiseReportData,
  createStockAdjustment,
  updateStockAdjustment,
  getStockAdjustments,
  getStockAdjustmentById,
  deleteStockAdjustment,
  downloadStockAdjustmentPdf,
  createLotTransfer,
  getLotTransfers,
  autoLotTransfer,
};
