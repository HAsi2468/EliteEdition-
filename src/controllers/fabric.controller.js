const FabricTransaction = require('../db/models/fabricTransaction.model');
const FabricStockAdjustment = require('../db/models/fabricStockAdjustment.model');
const PDFDocument = require('pdfkit');

// Normalize functions to merge matching fabric and panna widths (e.g. 58" and 58)
const normalizeFabric = (val) => {
  if (!val) return '';
  let clean = String(val).trim().toUpperCase();
  if (clean === 'CREPE' || clean === 'CRAPE' || clean === 'FRANCH CREPE' || clean === 'FRENCH CREP' || clean.includes('CREPE') || clean.includes('CRAPE')) {
    return 'FRENCH CREPE';
  }
  if (clean === 'CAMRIK' || clean === 'CEMBRIC' || clean === 'CEMBRIK' || clean === 'CAMBRIK' || clean.includes('CAMRIK') || clean.includes('CEMBRIK')) {
    return 'CAMBRIC';
  }
  return clean;
};

const normalizePanna = (val, fabricName = '') => {
  let clean = val ? String(val).trim().replace(/['"]/g, '') : '';
  if (!clean || clean.toUpperCase() === 'UNKNOWN') {
    const fabUpper = String(fabricName || '').trim().toUpperCase();
    if (fabUpper.includes('ARMANI')) {
      return '44';
    }
    return '58';
  }
  return clean;
};

// Create a new INWARD transaction
const createInward = async (req, res) => {
  try {
    const { challanNo, vendorName, fabricQuality, panna, qty, date, notes, shortagePct } = req.body;
    
    if (!fabricQuality || qty == null || qty < 0) {
      return res.status(400).json({ success: false, error: 'Fabric Quality and a valid Quantity are required.' });
    }

    const normFabric = normalizeFabric(fabricQuality);
    const normP = normalizePanna(panna, normFabric);

    const transaction = new FabricTransaction({
      type: 'INWARD',
      challanNo,
      vendorName,
      fabricQuality: normFabric,
      panna: normP,
      qty,
      date: date ? new Date(date) : new Date(),
      notes,
      shortagePct: shortagePct !== '' && shortagePct != null ? parseFloat(shortagePct) : null,
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
    const { jobNo, challanNo, partyName, fabricQuality, panna, lotNo, qty, date, notes } = req.body;
    
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
      notes: finalNotes
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
    const transactions = await FabricTransaction.find().sort({ date: -1, createdAt: -1 });
    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    console.error('Error fetching fabric transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get current stock overview grouped by fabric quality
const getStockOverview = async (req, res) => {
  try {
    const pipeline = [
      {
        $group: {
          _id: '$fabricQuality',
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
          fabricQuality: '$_id',
          totalInward: 1,
          totalOutward: 1,
          currentStock: { $subtract: ['$totalInward', '$totalOutward'] },
          _id: 0
        }
      },
      {
        $sort: { fabricQuality: 1 }
      }
    ];

    const stock = await FabricTransaction.aggregate(pipeline);
    res.status(200).json({ success: true, data: stock });
  } catch (error) {
    console.error('Error calculating fabric stock:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getLotStock = async (req, res) => {
  try {
    const { fabricQuality } = req.query;
    const matchStage = {};
    if (fabricQuality) {
      const clean = fabricQuality.trim().toUpperCase();
      const candidates = [clean];
      
      if (clean.includes('SUDAR')) {
        candidates.push('SUDARSHAN');
        candidates.push('SUDARSUN');
      }
      if (clean.includes('SUMM')) {
        candidates.push('SUMMER COOL');
        candidates.push('SUMMAR COOL');
      }
      if (clean.includes('CREP') || clean.includes('CREPE') || clean.includes('CRAPE')) {
        candidates.push('CREPE');
        candidates.push('CRAPE');
        candidates.push('FRENCH CREP');
        candidates.push('FRENCH CREPE');
      }
      if (clean.includes('MAL')) {
        candidates.push('MAL');
        candidates.push('POLY MAL');
      }
      if (clean.includes('REYON') || clean.includes('RAYON')) {
        candidates.push('REYON');
        candidates.push('RAYON');
      }
      if (clean.includes('CAMBRIC') || clean.includes('CEMBRIC') || clean.includes('CEMBRIK') || clean.includes('CAMRIK')) {
        candidates.push('CAMBRIC');
        candidates.push('CEMBRIC');
        candidates.push('CEMBRIK');
        candidates.push('CAMRIK');
      }

      matchStage.fabricQuality = {
        $in: candidates.map(c => new RegExp(`^${c}$`, 'i'))
      };
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
      { $sort: { lotNo: 1 } } // Sort ascending: clear earliest lot numbers first (FIFO)!
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
    const pipeline = [
      {
        $group: {
          _id: { fabricQuality: '$fabricQuality', panna: { $ifNull: ['$panna', 'Unknown'] } },
          totalInward: { $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] } },
          totalOutward: { $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] } },
          lotCount: { $addToSet: '$lotNo' }
        }
      },
      {
        $project: {
          fabricQuality: '$_id.fabricQuality',
          panna: '$_id.panna',
          totalInward: 1,
          totalOutward: 1,
          currentStock: { $subtract: ['$totalInward', '$totalOutward'] },
          lotCount: { $size: { $filter: { input: '$lotCount', cond: { $ne: ['$$this', null] } } } },
          _id: 0
        }
      },
      { $sort: { fabricQuality: 1, panna: 1 } }
    ];

    const result = await FabricTransaction.aggregate(pipeline);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching panna-wise stock:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get fabric requirement from pending and in-progress job cards
const getFabricRequirement = async (req, res) => {
  try {
    const JobCard = require('../db/models/jobCard.model');

    // Fetch all Pending and In Progress job cards that have fabric info
    const jobs = await JobCard.find({
      status: { $in: ['Pending', 'In Progress'] },
      fabric: { $ne: '' }
    }).lean();

    // Group requirement by fabric + panna
    const requirementMap = {};
    for (const job of jobs) {
      const fabric = normalizeFabric(job.fabric);
      const panna = normalizePanna(job.panna);
      if (!fabric) continue;

      // totalMtr is the main fabric needed in meters
      const mtrNeeded = parseFloat(job.totalMtr) || 0;

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
        totalMtr: mtrNeeded,
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
  const dateFilter = {};
  if (dateStart || dateEnd) {
    dateFilter.date = {};
    if (dateStart) dateFilter.date.$gte = new Date(dateStart);
    if (dateEnd) {
      const end = new Date(dateEnd);
      end.setHours(23, 59, 59, 999);
      dateFilter.date.$lte = end;
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
  if (dateStart || dateEnd) {
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
  } else if (dateEnd) {
    const end = new Date(dateEnd);
    end.setHours(23, 59, 59, 999);
    txFilter.date = { $lte: end };
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
    const { dateStart, dateEnd, reports } = req.query;
    const PDFDocument = require('pdfkit');
    const path = require('path');
    const fs = require('fs');

    const FabricChallan = require('../db/models/fabricChallan.model');
    const JobPrintLog = require('../db/models/jobPrintLog.model');
    const JobCard = require('../db/models/jobCard.model');

    const selectedReports = reports
      ? reports.split(',').map(s => s.trim().toLowerCase())
      : ['challan', 'inward', 'outward', 'lotwise', 'stock', 'machine'];

    const dateFilter = {};
    if (dateStart || dateEnd) {
      dateFilter.date = {};
      if (dateStart) dateFilter.date.$gte = new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setHours(23, 59, 59, 999);
        dateFilter.date.$lte = end;
      }
    }

    const lotTransferExclude = { notes: { $not: /Lot Transfer|Lot Rebalance|\[Ref:\s*LT-/i } };

    let inwardData = [];
    if (selectedReports.includes('inward')) {
      inwardData = await FabricTransaction.find({ type: 'INWARD', ...dateFilter, ...lotTransferExclude }).sort({ date: -1 }).lean();
    }

    let outwardData = [];
    if (selectedReports.includes('outward')) {
      outwardData = await FabricTransaction.find({ type: 'OUTWARD', ...dateFilter, ...lotTransferExclude }).sort({ date: -1 }).lean();
    }

    let challanData = [];
    if (selectedReports.includes('challan')) {
      challanData = await FabricChallan.find({
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

    if (selectedReports.includes('machine') || selectedReports.includes('machine_print')) {
      let logDateFilter = {};
      if (dateStart || dateEnd) {
        const dsStr = dateStart ? dateStart.split('T')[0] : '';
        const deStr = dateEnd ? dateEnd.split('T')[0] : '';

        const dsLocal = dsStr ? new Date(`${dsStr}T00:00:00.000`) : null;
        const deLocal = deStr ? new Date(`${deStr}T23:59:59.999`) : null;

        const dsUtc = dsStr ? new Date(`${dsStr}T00:00:00.000Z`) : null;
        const deUtc = deStr ? new Date(`${deStr}T23:59:59.999Z`) : null;

        const dateConditions = [];
        if (dsStr && deStr) {
          dateConditions.push({ date: { $gte: dsLocal, $lte: deLocal } });
          dateConditions.push({ date: { $gte: dsUtc, $lte: deUtc } });
          dateConditions.push({ created_date_time: { $gte: dsLocal, $lte: deLocal } });
          dateConditions.push({ created_date_time: { $gte: dsUtc, $lte: deUtc } });
          dateConditions.push({ date: { $gte: dsStr, $lte: deStr } });
        } else if (dsStr) {
          dateConditions.push({ date: { $gte: dsLocal } });
          dateConditions.push({ date: { $gte: dsUtc } });
          dateConditions.push({ created_date_time: { $gte: dsLocal } });
          dateConditions.push({ date: { $gte: dsStr } });
        } else if (deStr) {
          dateConditions.push({ date: { $lte: deLocal } });
          dateConditions.push({ date: { $lte: deUtc } });
          dateConditions.push({ created_date_time: { $lte: deLocal } });
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
      if (qShift) {
        logDateFilter.shift = qShift.trim();
      }
      if (qOperator) {
        logDateFilter.operatorName = { $regex: qOperator.trim(), $options: 'i' };
      }
      if (qPass) {
        logDateFilter.pass = { $regex: qPass.trim(), $options: 'i' };
      }

      // 1. Fetch print logs strictly from JobPrintLog collection (Machine Printing Entry & Logs Screen)
      const printLogs = await JobPrintLog.find(logDateFilter).sort({ date: -1, created_date_time: -1 }).lean();

      // 1B. Fetch Raw Material Outward Usage logs for selected date range
      const RawMaterialTransaction = require('../db/models/rawMaterialTransaction.model');
      var rawMaterialLogs = await RawMaterialTransaction.find({ type: 'OUTWARD', ...logDateFilter }).sort({ date: -1, createdAt: -1 }).lean();

      // 2. Fetch all job cards to map client/party name and design name
      const allJobCardsList = await JobCard.find({}).select('jobNo party designName designNo').lean();
      const jobCardMapByNo = {};
      const jobCardMapById = {};
      allJobCardsList.forEach(c => {
        if (c.jobNo) jobCardMapByNo[String(c.jobNo).trim()] = c;
        if (c._id) jobCardMapById[String(c._id)] = c;
      });

      var detailedPrintLogsList = printLogs.map(l => {
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

    // ── MTD (Month-Till-Date: 1st of current month to today end) Calculations ──
    const now = new Date();
    const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const mtdEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const mtdDateFilter = { date: { $gte: mtdStart, $lte: mtdEnd } };

    const mtdInwardData = await FabricTransaction.find({ type: 'INWARD', ...mtdDateFilter, ...lotTransferExclude }).lean();
    const mtdOutwardData = await FabricTransaction.find({ type: 'OUTWARD', ...mtdDateFilter, ...lotTransferExclude }).lean();
    const mtdChallanData = await FabricChallan.find({ ...mtdDateFilter }).lean();

    const mtdTotalInwardMtr = mtdInwardData.reduce((s, r) => s + (r.qty || 0), 0);
    const mtdTotalOutwardMtr = mtdOutwardData.reduce((s, r) => s + (r.qty || 0), 0);
    const mtdTotalChallanMtr = mtdChallanData.reduce((s, c) => s + (c.totalMtr || 0), 0);
    const mtdTotalChallanTp = mtdChallanData.reduce((s, c) => s + (c.totalTp || 0), 0);

    const doc = new PDFDocument({ margin: 25, size: 'A4', autoFirstPage: true, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Elite_Digital_Prints_1_Page_Report.pdf"');
    doc.pipe(res);

    const PW = 595, PH = 842, ML = 30, MR = 30;
    const contentWidth = PW - ML - MR;
    const maxY = 770;

    const startDateStr = dateStart ? new Date(dateStart).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'All Time';
    const endDateStr = dateEnd ? new Date(dateEnd).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Present';
    const logoPath = path.join(__dirname, 'Logo.png');

    const drawPageHeader = (isFirstPage = false) => {
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, ML, 14, { width: 110 });
      }

      doc.fillColor('#000000').fontSize(13).font('Helvetica-Bold')
        .text('ELITE DIGITAL PRINTS — 1 PAGE REPORT', ML + 130, 20, { width: contentWidth - 130, align: 'right' });

      doc.fillColor('#475569').fontSize(8.5).font('Helvetica-Bold')
        .text(`Report Period: ${startDateStr} to ${endDateStr}  |  Generated: ${new Date().toLocaleDateString('en-IN')}`, ML + 130, 38, { width: contentWidth - 130, align: 'right' });

      // Line drawn cleanly at y = 62, below the logo image!
      doc.moveTo(ML, 62).lineTo(PW - MR, 62).strokeColor('#ddd6fe').lineWidth(1.2).stroke();
    };

    drawPageHeader(true);

    // Row 1: Selected Period KPI Cards
    const periodSections = [
      selectedReports.includes('challan') && { label: 'CHALLAN DISPATCHES', val: `${totalChallanMtr.toFixed(2)} mtr`, sub: `${challanData.length} Challans (${totalChallanTp} TP)` },
      selectedReports.includes('inward') && { label: 'FABRIC INWARD', val: `${totalInwardMtr.toFixed(2)} mtr`, sub: `${inwardData.length} Receipts` },
      selectedReports.includes('outward') && { label: 'FABRIC CONSUMPTION', val: `${totalOutwardMtr.toFixed(2)} mtr`, sub: `${outwardData.length} Dispatches` },
      (selectedReports.includes('machine') || selectedReports.includes('machine_print')) && { label: 'MACHINE PRINTED', val: `${totalMachinePrintedMtr.toFixed(2)} mtr`, sub: `${totalMachineJobCardCount} Job Cards` },
    ].filter(Boolean);

    const cardCount1 = periodSections.length || 1;
    const cardWidth1 = (contentWidth - (cardCount1 - 1) * 8) / cardCount1;
    let cardX1 = ML;

    periodSections.forEach(card => {
      doc.rect(cardX1, 68, cardWidth1, 42).fill('#f5f3ff').stroke('#ddd6fe');
      doc.fillColor('#5b21b6').fontSize(7.5).font('Helvetica-Bold')
        .text(card.label, cardX1 + 5, 72, { width: cardWidth1 - 10, align: 'center' });
      doc.fillColor('#000000').fontSize(11).font('Helvetica-Bold')
        .text(card.val, cardX1 + 5, 82, { width: cardWidth1 - 10, align: 'center' });
      doc.fillColor('#475569').fontSize(6.8).font('Helvetica')
        .text(card.sub, cardX1 + 5, 96, { width: cardWidth1 - 10, align: 'center' });
      cardX1 += cardWidth1 + 8;
    });

    // Row 2: Month Till Date (MTD) KPI Cards
    const mtdSections = [
      selectedReports.includes('challan') && { label: 'MTD CHALLAN DISPATCHES', val: `${mtdTotalChallanMtr.toFixed(2)} mtr`, sub: `${mtdChallanData.length} Challans (${mtdTotalChallanTp} TP)` },
      selectedReports.includes('inward') && { label: 'MTD FABRIC INWARD', val: `${mtdTotalInwardMtr.toFixed(2)} mtr`, sub: `${mtdInwardData.length} Receipts` },
      selectedReports.includes('outward') && { label: 'MTD FABRIC CONSUMPTION', val: `${mtdTotalOutwardMtr.toFixed(2)} mtr`, sub: `${mtdOutwardData.length} Dispatches` },
    ].filter(Boolean);

    const cardCount2 = mtdSections.length || 1;
    const cardWidth2 = (contentWidth - (cardCount2 - 1) * 8) / cardCount2;
    let cardX2 = ML;

    mtdSections.forEach(card => {
      doc.rect(cardX2, 114, cardWidth2, 42).fill('#eff6ff').stroke('#bfdbfe');
      doc.fillColor('#1e40af').fontSize(7.5).font('Helvetica-Bold')
        .text(card.label, cardX2 + 5, 118, { width: cardWidth2 - 10, align: 'center' });
      doc.fillColor('#000000').fontSize(11).font('Helvetica-Bold')
        .text(card.val, cardX2 + 5, 128, { width: cardWidth2 - 10, align: 'center' });
      doc.fillColor('#475569').fontSize(6.8).font('Helvetica')
        .text(card.sub, cardX2 + 5, 142, { width: cardWidth2 - 10, align: 'center' });
      cardX2 += cardWidth2 + 8;
    });

    let currentY = 164;

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

    // ── 4. PRINTING ENTRY & LOGS SUMMARY (MACHINE & PASS WISE) ──
    if (selectedReports.includes('machine') || selectedReports.includes('machine_print')) {
      checkAddPage(60);

      doc.rect(ML, currentY, contentWidth, 20).fill('#ede9fe').stroke('#ddd6fe');
      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold')
        .text('4. PRINTING ENTRY & LOGS (MACHINE & PASS WISE)', ML + 8, currentY + 5, { lineBreak: false });
      doc.fillColor('#5b21b6').fontSize(8.5).font('Helvetica-Bold')
        .text(`Total: ${totalMachinePrintedMtr.toFixed(2)} mtr (${totalMachineJobCardCount} Job Cards)`, ML + contentWidth - 250, currentY + 5, { width: 240, align: 'right', lineBreak: false });

      currentY += 24;

      const drawMachineHeaders = () => {
        doc.rect(ML, currentY, contentWidth, 18).fill('#f8fafc').stroke('#cbd5e1');
        doc.fillColor('#000000').fontSize(7.2).font('Helvetica-Bold');
        doc.text('MACHINE NAME', ML + 4, currentY + 5, { width: 170 });
        doc.text('PASS / CONFIG', ML + 178, currentY + 5, { width: 140 });
        doc.text('JOBCARD COUNT', ML + 322, currentY + 5, { width: 90, align: 'center' });
        doc.text('TOTAL METERS PRINTED', ML + 416, currentY + 5, { width: 115, align: 'right' });
        currentY += 18;
      };

      drawMachineHeaders();

      if (machineData.length === 0) {
        doc.rect(ML, currentY, contentWidth, 18).fill('#ffffff');
        doc.strokeColor('#f1f5f9').lineWidth(0.5).rect(ML, currentY, contentWidth, 18).stroke();
        doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text('No machine printing entry logs found for selected period.', ML + 4, currentY + 4.5, { width: contentWidth - 8, align: 'center' });
        currentY += 18;
      } else {
        machineData.forEach((row, idx) => {
          if (checkAddPage(20)) {
            drawMachineHeaders();
          }
          const bg = idx % 2 === 0 ? '#ffffff' : '#fcfaff';
          doc.rect(ML, currentY, contentWidth, 18).fill(bg);
          doc.strokeColor('#f1f5f9').lineWidth(0.5).rect(ML, currentY, contentWidth, 18).stroke();

          doc.fillColor('#000000').fontSize(7.2).font('Helvetica-Bold');
          doc.text(row.machineName, ML + 4, currentY + 4.5, { width: 170, lineBreak: false });
          doc.fillColor('#334155').font('Helvetica');
          doc.text(row.pass, ML + 178, currentY + 4.5, { width: 140, lineBreak: false });
          doc.fillColor('#0284c7').font('Helvetica-Bold');
          doc.text(`${row.jobCardCount} Job Cards`, ML + 322, currentY + 4.5, { width: 90, align: 'center', lineBreak: false });
          doc.fillColor('#047857').font('Helvetica-Bold');
          doc.text(`${parseFloat(row.totalMtr || 0).toFixed(2)} mtr`, ML + 416, currentY + 4.5, { width: 115, align: 'right', lineBreak: false });
          currentY += 18;
        });

        // Summary Total Row
        if (checkAddPage(20)) {
          drawMachineHeaders();
        }
        doc.rect(ML, currentY, contentWidth, 18).fill('#f1f5f9').stroke('#cbd5e1');
        doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold');
        doc.text('TOTAL MACHINE PRINTING SUMMARY:', ML + 4, currentY + 4.5, { width: 310, lineBreak: false });
        doc.fillColor('#0284c7').font('Helvetica-Bold');
        doc.text(`${totalMachineJobCardCount} Job Cards`, ML + 322, currentY + 4.5, { width: 90, align: 'center', lineBreak: false });
        doc.fillColor('#047857').font('Helvetica-Bold');
        doc.text(`${totalMachinePrintedMtr.toFixed(2)} mtr`, ML + 416, currentY + 4.5, { width: 115, align: 'right', lineBreak: false });
        currentY += 18;
      }

      // ── 4B. COMPLETE DETAILED PRINTING LOGS & RUN ENTRIES TABLE ──
      if (typeof detailedPrintLogsList !== 'undefined' && detailedPrintLogsList && detailedPrintLogsList.length > 0) {
        currentY += 10;
        checkAddPage(60);

        doc.rect(ML, currentY, contentWidth, 18).fill('#e0e7ff').stroke('#c7d2fe');
        doc.fillColor('#3730a3').fontSize(8).font('Helvetica-Bold')
          .text('COMPLETE DETAILED PRINTING RUN LOGS', ML + 8, currentY + 4.5, { lineBreak: false });
        doc.fillColor('#4338ca').fontSize(7.5).font('Helvetica-Bold')
          .text(`Total Entries: ${detailedPrintLogsList.length}`, ML + contentWidth - 150, currentY + 4.5, { width: 140, align: 'right', lineBreak: false });
        currentY += 22;

        const drawDetailHeaders = () => {
          doc.rect(ML, currentY, contentWidth, 18).fill('#1e293b').stroke('#0f172a');
          doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold');
          doc.text('DATE & SHIFT', ML + 4, currentY + 5, { width: 65 });
          doc.text('JOB CARD #', ML + 71, currentY + 5, { width: 45 });
          doc.text('PARTY / CLIENT', ML + 118, currentY + 5, { width: 85 });
          doc.text('DESIGN NAME', ML + 205, currentY + 5, { width: 80 });
          doc.text('MACHINE & PASS', ML + 287, currentY + 5, { width: 95 });
          doc.text('METERS PRINTED', ML + 384, currentY + 5, { width: 55, align: 'right' });
          doc.text('OPERATOR', ML + 441, currentY + 5, { width: 45 });
          doc.text('REMARKS', ML + 488, currentY + 5, { width: 43 });
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

          doc.fillColor('#000000').fontSize(6.8).font('Helvetica-Bold');
          doc.text(`${log.dateStr} (${log.shift})`, ML + 4, currentY + 4.5, { width: 65, lineBreak: false });

          doc.fillColor('#0284c7').font('Helvetica-Bold');
          doc.text(`#${log.jobNo}`, ML + 71, currentY + 4.5, { width: 45, lineBreak: false });

          doc.fillColor('#334155').font('Helvetica');
          doc.text(log.party, ML + 118, currentY + 4.5, { width: 85, lineBreak: false });
          doc.text(log.design, ML + 205, currentY + 4.5, { width: 80, lineBreak: false });

          doc.fillColor('#000000').font('Helvetica-Bold');
          doc.text(`${log.machineName} (${log.pass})`, ML + 287, currentY + 4.5, { width: 95, lineBreak: false });

          doc.fillColor('#047857').font('Helvetica-Bold');
          doc.text(`${log.meters.toFixed(2)} mtr`, ML + 384, currentY + 4.5, { width: 55, align: 'right', lineBreak: false });

          doc.fillColor('#334155').font('Helvetica');
          doc.text(log.operatorName, ML + 441, currentY + 4.5, { width: 45, lineBreak: false });
          doc.text(log.notes, ML + 488, currentY + 4.5, { width: 43, lineBreak: false });

          subtotalMtr += log.meters;
          currentY += 18;
        });

        // Detailed Total Row
        if (checkAddPage(20)) {
          drawDetailHeaders();
        }
        doc.rect(ML, currentY, contentWidth, 18).fill('#e2e8f0').stroke('#cbd5e1');
        doc.fillColor('#0f172a').fontSize(7.2).font('Helvetica-Bold');
        doc.text(`GRAND TOTAL PRINTED METERS (${detailedPrintLogsList.length} LOGS):`, ML + 4, currentY + 4.5, { width: 378, lineBreak: false });
        doc.fillColor('#047857').font('Helvetica-Bold');
        doc.text(`${subtotalMtr.toFixed(2)} mtr`, ML + 384, currentY + 4.5, { width: 55, align: 'right', lineBreak: false });
        currentY += 18;
      }

      // ── 4C. RAW MATERIAL CONSUMPTION SUMMARY (GRANDO INK, PRINTDOT INK & PAPER PANNA) ──
      if (typeof rawMaterialLogs !== 'undefined' && rawMaterialLogs && rawMaterialLogs.length > 0) {
        currentY += 12;
        checkAddPage(70);

        const grandoInk = { C: 0, M: 0, Y: 0, K: 0 };
        const printdotInk = { C: 0, M: 0, Y: 0, K: 0 };
        const paperPannaSummary = {};

        rawMaterialLogs.forEach(t => {
          const mName = (t.materialName || '').toLowerCase();
          const q = Number(t.qty) || 0;

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
            const pKey = t.panna ? (t.panna.toLowerCase().includes('panna') || t.panna.includes('"') ? t.panna : `${t.panna} PANNA`) : 'PAPER ROLL';
            paperPannaSummary[pKey] = (paperPannaSummary[pKey] || 0) + q;
          }
        });

        doc.rect(ML, currentY, contentWidth, 18).fill('#dcfce7').stroke('#86efac');
        doc.fillColor('#14532d').fontSize(8).font('Helvetica-Bold')
          .text('RAW MATERIAL CONSUMPTION SUMMARY (GRANDO INK, PRINTDOT INK & PAPER PANNA)', ML + 8, currentY + 4.5, { lineBreak: false });
        currentY += 22;

        const drawRawSummaryHeaders = () => {
          doc.rect(ML, currentY, contentWidth, 18).fill('#064e3b').stroke('#022c22');
          doc.fillColor('#ffffff').fontSize(7.2).font('Helvetica-Bold');
          doc.text('MATERIAL / ITEM DESCRIPTION', ML + 8, currentY + 5, { width: 340 });
          doc.text('TOTAL CONSUMED QTY & UNIT', ML + 356, currentY + 5, { width: 170, align: 'right' });
          currentY += 18;
        };

        drawRawSummaryHeaders();

        const summaryRows = [
          { label: 'GRANDO C', val: `${grandoInk.C.toFixed(2)} Liters` },
          { label: 'GRANDO M', val: `${grandoInk.M.toFixed(2)} Liters` },
          { label: 'GRANDO Y', val: `${grandoInk.Y.toFixed(2)} Liters` },
          { label: 'GRANDO K', val: `${grandoInk.K.toFixed(2)} Liters` },
          { label: 'PRINTDOT C', val: `${printdotInk.C.toFixed(2)} Liters` },
          { label: 'PRINTDOT M', val: `${printdotInk.M.toFixed(2)} Liters` },
          { label: 'PRINTDOT Y', val: `${printdotInk.Y.toFixed(2)} Liters` },
          { label: 'PRINTDOT K', val: `${printdotInk.K.toFixed(2)} Liters` },
        ];

        Object.entries(paperPannaSummary).forEach(([pannaName, qty]) => {
          summaryRows.push({ label: `PAPER ${pannaName.toUpperCase()}`, val: `${qty} Rolls` });
        });

        summaryRows.forEach((row, idx) => {
          if (checkAddPage(18)) {
            drawRawSummaryHeaders();
          }
          const bg = idx % 2 === 0 ? '#ffffff' : '#f0fdf4';
          doc.rect(ML, currentY, contentWidth, 18).fill(bg);
          doc.strokeColor('#dcfce7').lineWidth(0.5).rect(ML, currentY, contentWidth, 18).stroke();

          doc.fillColor('#0f766e').fontSize(7.2).font('Helvetica-Bold');
          doc.text(row.label, ML + 8, currentY + 4.5, { width: 340, lineBreak: false });

          doc.fillColor('#047857').fontSize(7.5).font('Helvetica-Bold');
          doc.text(row.val, ML + 356, currentY + 4.5, { width: 170, align: 'right', lineBreak: false });

          currentY += 18;
        });
      }

      currentY += 12;
    }

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
      res.status(500).json({ error: 'Internal Server Error' });
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
