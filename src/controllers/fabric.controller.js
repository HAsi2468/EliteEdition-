const FabricTransaction = require('../db/models/fabricTransaction.model');
const PDFDocument = require('pdfkit');

// Normalize functions to merge matching fabric and panna widths (e.g. 58" and 58)
const normalizePanna = (val) => {
  if (val === null || val === undefined) return 'Unknown';
  let clean = String(val).trim().replace(/['"]/g, '');
  return clean || 'Unknown';
};

const normalizeFabric = (val) => {
  if (!val) return '';
  return String(val).trim().toUpperCase();
};

// Create a new INWARD transaction
const createInward = async (req, res) => {
  try {
    const { challanNo, vendorName, fabricQuality, panna, qty, date, notes, shortagePct } = req.body;
    
    if (!fabricQuality || qty == null || qty < 0) {
      return res.status(400).json({ success: false, error: 'Fabric Quality and a valid Quantity are required.' });
    }

    const transaction = new FabricTransaction({
      type: 'INWARD',
      challanNo,
      vendorName,
      fabricQuality,
      panna,
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

    const transaction = new FabricTransaction({
      type: 'OUTWARD',
      jobNo,
      challanNo,
      partyName,
      fabricQuality,
      panna,
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
      if (clean.includes('CREP') || clean.includes('CREPE')) {
        candidates.push('CREPE');
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
      if (clean.includes('CEMBRIC') || clean.includes('CEMBRIK')) {
        candidates.push('CEMBRIC');
        candidates.push('CEMBRIK');
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
      { $sort: { lotNo: 1 } }
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
  importStock
};
