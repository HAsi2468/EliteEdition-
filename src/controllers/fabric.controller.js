const FabricTransaction = require('../db/models/fabricTransaction.model');
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

    const transaction = new FabricTransaction({
      type: 'OUTWARD',
      jobNo,
      challanNo,
      partyName,
      fabricQuality: normFabric,
      panna: normP,
      lotNo: lotNo ? Number(lotNo) : undefined,
      qty,
      date: date ? new Date(date) : new Date(),
      notes
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
      {
        $group: {
          _id: '$lotNo',
          fabricQuality: { $first: '$fabricQuality' },
          panna: { $first: '$panna' },
          vendorName: { $first: '$vendorName' },
          vendorChallanNo: { $first: '$challanNo' },
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
      { $sort: { lotNo: -1 } } // Show newest inward lot numbers first!
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
      const csvOutward = (row.outwardQty !== undefined && row.outwardQty !== null && row.outwardQty !== '') ? parseFloat(row.outwardQty) : null;
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

    const filter = { type: 'INWARD' };
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
      doc.image(logoPath, 30, 20, { width: 140 });
    }

    doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold')
      .text('FABRIC INWARD REPORT', 190, 25, { width: 375, align: 'right' });

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

    const filter = { type: 'OUTWARD' };
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
      doc.image(logoPath, 30, 20, { width: 140 });
    }

    doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold')
      .text('FABRIC OUTWARD REPORT', 190, 25, { width: 375, align: 'right' });

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
      doc.text('LOT #', 105, currY + 6);
      doc.text('PARTY NAME', 155, currY + 6);
      doc.text('CHALLAN / JOB NO.', 265, currY + 6);
      doc.text('FABRIC & PANNA', 385, currY + 6);
      doc.text('QTY (M)', 490, currY + 6);
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
      const refStr = `${t.challanNo || t.jobNo || '—'}`;

      doc.rect(30, y, 535, 18).fill(i % 2 === 0 ? '#fcfaff' : '#ffffff');
      doc.fillColor('#000000').fontSize(8).font('Helvetica');
      doc.text(dt, 35, y + 5);
      doc.text(t.lotNo ? `#${t.lotNo}` : '—', 105, y + 5);
      doc.text(t.partyName || '—', 155, y + 5, { width: 105, lineBreak: false });
      doc.text(refStr, 265, y + 5, { width: 115, lineBreak: false });
      doc.text(fabStr, 385, y + 5, { width: 100, lineBreak: false });
      doc.fillColor('#b91c1c').font('Helvetica-Bold').text(`-${(t.qty || 0).toLocaleString('en-IN')} m`, 490, y + 5);
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

const downloadFabricLotWisePdf = async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const path = require('path');
    const fs = require('fs');
    const logoPath = path.join(__dirname, 'Logo.png');
    const { dateStart, dateEnd } = req.query;

    const matchFilter = {};
    if (dateStart || dateEnd) {
      matchFilter.date = {};
      if (dateStart) matchFilter.date.$gte = new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setHours(23, 59, 59, 999);
        matchFilter.date.$lte = end;
      }
    }

    const pipeline = [
      { $match: matchFilter },
      {
        $group: {
          _id: '$lotNo',
          fabricQuality: { $first: '$fabricQuality' },
          panna: { $first: '$panna' },
          vendorName: { $first: '$vendorName' },
          vendorChallanNo: { $first: '$challanNo' },
          totalInward: { $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] } },
          totalOutward: { $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] } },
          firstDate: { $min: '$date' }
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
          firstDate: 1,
          _id: 0
        }
      },
      { $match: { lotNo: { $ne: null } } },
      { $sort: { lotNo: -1 } }
    ];

    const lots = await FabricTransaction.aggregate(pipeline);

    const cleanDateStart = dateStart ? dateStart.split('T')[0] : '';
    const cleanDateEnd = dateEnd ? dateEnd.split('T')[0] : '';

    const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Lotwise_Fabric_Report_${cleanDateStart || 'all'}_to_${cleanDateEnd || 'all'}.pdf"`);
    doc.pipe(res);

    // Header section with Logo (image already includes brand name)
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
      doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold');
      doc.text('LOT #', 35, currY + 6);
      doc.text('FABRIC & PANNA', 95, currY + 6);
      doc.text('VENDOR NAME', 215, currY + 6);
      doc.text('INWARD (M)', 315, currY + 6);
      doc.text('OUTWARD (M)', 395, currY + 6);
      doc.text('CURRENT STOCK', 475, currY + 6);
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
      doc.text(fabStr, 95, y + 5, { width: 115, lineBreak: false });
      doc.text(l.vendorName || '—', 215, y + 5, { width: 95, lineBreak: false });
      doc.text(`+${(l.totalInward || 0).toLocaleString('en-IN')} m`, 315, y + 5);
      doc.text(`-${(l.totalOutward || 0).toLocaleString('en-IN')} m`, 395, y + 5);
      doc.fillColor(stockVal > 0 ? '#15803d' : stockVal < 0 ? '#b91c1c' : '#64748b').font('Helvetica-Bold').text(`${stockVal.toLocaleString('en-IN')} m`, 475, y + 5);
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
    const filter = { type: 'INWARD' };
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
    const filter = { type: 'OUTWARD' };
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
    const matchFilter = {};
    if (dateStart || dateEnd) {
      matchFilter.date = {};
      if (dateStart) matchFilter.date.$gte = new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setHours(23, 59, 59, 999);
        matchFilter.date.$lte = end;
      }
    }
    const pipeline = [
      { $match: matchFilter },
      {
        $group: {
          _id: '$lotNo',
          fabricQuality: { $first: '$fabricQuality' },
          panna: { $first: '$panna' },
          vendorName: { $first: '$vendorName' },
          vendorChallanNo: { $first: '$challanNo' },
          totalInward: { $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] } },
          totalOutward: { $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] } },
          firstDate: { $min: '$date' }
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
          firstDate: 1,
          _id: 0
        }
      },
      { $match: { lotNo: { $ne: null } } },
      { $sort: { lotNo: -1 } }
    ];
    const lots = await FabricTransaction.aggregate(pipeline);
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

    const selectedReports = reports
      ? reports.split(',').map(s => s.trim().toLowerCase())
      : ['challan', 'inward', 'outward', 'lotwise', 'stock'];

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

    let inwardData = [];
    if (selectedReports.includes('inward')) {
      inwardData = await FabricTransaction.find({ type: 'INWARD', ...dateFilter }).sort({ date: -1 }).lean();
    }

    let outwardData = [];
    if (selectedReports.includes('outward')) {
      outwardData = await FabricTransaction.find({ type: 'OUTWARD', ...dateFilter }).sort({ date: -1 }).lean();
    }

    let challanData = [];
    if (selectedReports.includes('challan')) {
      challanData = await FabricChallan.find(dateFilter).sort({ date: -1 }).lean();
    }

    let lotwiseData = [];
    if (selectedReports.includes('lotwise')) {
      const pipeline = [
        { $match: dateFilter },
        {
          $group: {
            _id: '$lotNo',
            fabricQuality: { $first: '$fabricQuality' },
            panna: { $first: '$panna' },
            vendorName: { $first: '$vendorName' },
            totalInward: { $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] } },
            totalOutward: { $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] } }
          }
        },
        {
          $project: {
            lotNo: '$_id',
            fabricQuality: 1,
            panna: 1,
            vendorName: 1,
            totalInward: 1,
            totalOutward: 1,
            currentStock: { $subtract: ['$totalInward', '$totalOutward'] },
            _id: 0
          }
        },
        { $match: { lotNo: { $ne: null } } },
        { $sort: { lotNo: -1 } }
      ];
      lotwiseData = await FabricTransaction.aggregate(pipeline);
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

    const totalInwardMtr = inwardData.reduce((s, r) => s + (r.qty || 0), 0);
    const totalOutwardMtr = outwardData.reduce((s, r) => s + (r.qty || 0), 0);
    const totalChallanMtr = challanData.reduce((s, c) => s + (c.totalMtr || 0), 0);
    const totalChallanTp = challanData.reduce((s, c) => s + (c.totalTp || 0), 0);
    const totalLotNetStock = lotwiseData.reduce((s, l) => s + Math.max(0, l.currentStock || 0), 0);

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
        doc.image(logoPath, ML, 20, { width: 120 });
      }

      doc.fillColor('#000000').fontSize(13).font('Helvetica-Bold')
        .text('ELITE DIGITAL PRINTS — 1 PAGE REPORT', ML + 130, 22, { width: contentWidth - 130, align: 'right' });

      doc.fillColor('#475569').fontSize(8.5).font('Helvetica-Bold')
        .text(`Report Period: ${startDateStr} to ${endDateStr}  |  Generated: ${new Date().toLocaleDateString('en-IN')}`, ML + 130, 38, { width: contentWidth - 130, align: 'right' });

      doc.moveTo(ML, 52).lineTo(PW - MR, 52).strokeColor('#ddd6fe').lineWidth(1.2).stroke();
    };

    drawPageHeader(true);

    // KPI Cards on Page 1
    const activeSections = [
      selectedReports.includes('challan') && { label: 'CHALLAN DISPATCHES', val: `${totalChallanMtr.toFixed(2)} mtr`, sub: `${challanData.length} Challans (${totalChallanTp} TP)` },
      selectedReports.includes('inward') && { label: 'FABRIC INWARD', val: `${totalInwardMtr.toFixed(2)} mtr`, sub: `${inwardData.length} Receipts` },
      selectedReports.includes('outward') && { label: 'FABRIC CONSUMPTION', val: `${totalOutwardMtr.toFixed(2)} mtr`, sub: `${outwardData.length} Dispatches` },
      selectedReports.includes('lotwise') && { label: 'LOT STOCK BALANCE', val: `${totalLotNetStock.toFixed(2)} mtr`, sub: `${lotwiseData.length} Active Lots` }
    ].filter(Boolean);

    const cardCount = activeSections.length || 1;
    const cardWidth = (contentWidth - (cardCount - 1) * 8) / cardCount;
    let cardX = ML;

    activeSections.forEach(card => {
      doc.rect(cardX, 60, cardWidth, 46).fill('#f5f3ff').stroke('#ddd6fe');
      doc.fillColor('#5b21b6').fontSize(7.5).font('Helvetica-Bold')
        .text(card.label, cardX + 5, 64, { width: cardWidth - 10, align: 'center' });
      doc.fillColor('#000000').fontSize(11.5).font('Helvetica-Bold')
        .text(card.val, cardX + 5, 75, { width: cardWidth - 10, align: 'center' });
      doc.fillColor('#475569').fontSize(7).font('Helvetica')
        .text(card.sub, cardX + 5, 91, { width: cardWidth - 10, align: 'center' });
      cardX += cardWidth + 8;
    });

    let currentY = 118;

    const checkAddPage = (heightNeeded) => {
      if (currentY + heightNeeded > maxY) {
        doc.addPage();
        drawPageHeader(false);
        currentY = 62;
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

    // ── 3. FABRIC CONSUMPTION SUMMARY (COMPLETE DATA WITH SHORTAGE) ──
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
        doc.text('DATE', ML + 4, currentY + 5, { width: 50 });
        doc.text('PARTY NAME', ML + 56, currentY + 5, { width: 130 });
        doc.text('JOB NO', ML + 188, currentY + 5, { width: 55 });
        doc.text('CHALLAN NO', ML + 245, currentY + 5, { width: 60 });
        doc.text('FABRIC QUALITY', ML + 307, currentY + 5, { width: 95 });
        doc.text('LOT NO', ML + 404, currentY + 5, { width: 40 });
        doc.text('SHORTAGE', ML + 446, currentY + 5, { width: 45, align: 'center' });
        doc.text('QTY (MTR)', ML + 493, currentY + 5, { width: 38, align: 'right' });
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
        const shortageStr = r.shortagePct != null ? `${r.shortagePct}%` : '—';
        doc.fillColor('#000000').fontSize(7).font('Helvetica');
        doc.text(dStr, ML + 4, currentY + 4.5, { width: 50, lineBreak: false });
        doc.text(r.partyName || '—', ML + 56, currentY + 4.5, { width: 130, lineBreak: false });
        doc.text(r.jobNo || '—', ML + 188, currentY + 4.5, { width: 55, lineBreak: false });
        doc.text(r.challanNo || '—', ML + 245, currentY + 4.5, { width: 60, lineBreak: false });
        doc.text(r.fabricQuality || '—', ML + 307, currentY + 4.5, { width: 95, lineBreak: false });
        doc.text(r.lotNo ? `#${r.lotNo}` : '—', ML + 404, currentY + 4.5, { width: 40, lineBreak: false });
        doc.text(shortageStr, ML + 446, currentY + 4.5, { width: 45, align: 'center', lineBreak: false });
        doc.fillColor('#b91c1c').font('Helvetica-Bold');
        doc.text(`${parseFloat(r.qty || 0).toFixed(2)}`, ML + 493, currentY + 4.5, { width: 38, align: 'right', lineBreak: false });
        currentY += 18;
      });

      currentY += 12;
    }

    // ── 4. LOT-WISE FABRIC STOCK BALANCE SUMMARY ──
    if (selectedReports.includes('lotwise')) {
      checkAddPage(60);

      doc.rect(ML, currentY, contentWidth, 20).fill('#ede9fe').stroke('#ddd6fe');
      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold')
        .text('4. LOT-WISE FABRIC STOCK BALANCE SUMMARY', ML + 8, currentY + 5, { lineBreak: false });
      doc.fillColor('#5b21b6').fontSize(8.5).font('Helvetica-Bold')
        .text(`Total: ${lotwiseData.length} Lots (${totalLotNetStock.toFixed(2)} mtr balance)`, ML + contentWidth - 240, currentY + 5, { width: 230, align: 'right', lineBreak: false });

      currentY += 24;

      const drawLotHeaders = () => {
        doc.rect(ML, currentY, contentWidth, 18).fill('#f8fafc').stroke('#cbd5e1');
        doc.fillColor('#000000').fontSize(7.2).font('Helvetica-Bold');
        doc.text('LOT NO', ML + 4, currentY + 5, { width: 45 });
        doc.text('FABRIC QUALITY', ML + 52, currentY + 5, { width: 150 });
        doc.text('PANNA', ML + 206, currentY + 5, { width: 45 });
        doc.text('SUPPLIER VENDOR', ML + 254, currentY + 5, { width: 140 });
        doc.text('INWARD', ML + 398, currentY + 5, { width: 42, align: 'right' });
        doc.text('OUTWARD', ML + 444, currentY + 5, { width: 42, align: 'right' });
        doc.text('BALANCE', ML + 490, currentY + 5, { width: 41, align: 'right' });
        currentY += 18;
      };

      drawLotHeaders();

      lotwiseData.forEach((l, idx) => {
        if (checkAddPage(20)) {
          drawLotHeaders();
        }
        const bg = idx % 2 === 0 ? '#ffffff' : '#fcfaff';
        doc.rect(ML, currentY, contentWidth, 18).fill(bg);
        doc.strokeColor('#f1f5f9').lineWidth(0.5).rect(ML, currentY, contentWidth, 18).stroke();

        doc.fillColor('#000000').fontSize(7).font('Helvetica');
        doc.text(`#${l.lotNo}`, ML + 4, currentY + 4.5, { width: 45, lineBreak: false });
        doc.text(l.fabricQuality || '—', ML + 52, currentY + 4.5, { width: 150, lineBreak: false });
        doc.text(`${l.panna || '58'}"`, ML + 206, currentY + 4.5, { width: 45, lineBreak: false });
        doc.text(l.vendorName || '—', ML + 254, currentY + 4.5, { width: 140, lineBreak: false });
        doc.text(`${parseFloat(l.totalInward || 0).toFixed(2)}`, ML + 398, currentY + 4.5, { width: 42, align: 'right', lineBreak: false });
        doc.text(`${parseFloat(l.totalOutward || 0).toFixed(2)}`, ML + 444, currentY + 4.5, { width: 42, align: 'right', lineBreak: false });
        doc.fillColor(l.currentStock > 0 ? '#047857' : '#dc2626').font('Helvetica-Bold');
        doc.text(`${parseFloat(l.currentStock || 0).toFixed(2)}`, ML + 490, currentY + 4.5, { width: 41, align: 'right', lineBreak: false });
        currentY += 18;
      });

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
};
