const FabricTransaction = require('../db/models/fabricTransaction.model');
const PDFDocument = require('pdfkit');

// Create a new INWARD transaction
const createInward = async (req, res) => {
  try {
    const { challanNo, vendorName, fabricQuality, panna, qty, date, notes } = req.body;
    
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
      notes
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
      matchStage.fabricQuality = new RegExp(`^${fabricQuality.trim()}$`, 'i');
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

// Get fabric requirement from in-progress job cards
const getFabricRequirement = async (req, res) => {
  try {
    const JobCard = require('../db/models/jobCard.model');

    // Fetch all In Progress job cards that have fabric info
    const jobs = await JobCard.find({
      status: 'In Progress',
      fabric: { $ne: '' }
    }).lean();

    // Group requirement by fabric + panna
    const requirementMap = {};
    for (const job of jobs) {
      const fabric = (job.fabric || '').trim();
      const panna = (job.panna || '').trim() || 'Unknown';
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

    // Build stock lookup map (case-insensitive)
    const stockMap = {};
    for (const s of stockData) {
      const key = `${s.fabricQuality.toLowerCase().trim()}|||${(s.panna || 'Unknown').trim()}`;
      stockMap[key] = s.currentStock;
    }

    // Enrich requirement with stock info
    const result = Object.values(requirementMap).map(req => {
      const lookupKey = `${req.fabricQuality.toLowerCase().trim()}|||${req.panna.trim()}`;
      const currentStock = stockMap[lookupKey] || 0;
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

module.exports = {
  createInward,
  createOutward,
  getTransactions,
  getStockOverview,
  getLotStock,
  deleteTransaction,
  getLotLedger,
  downloadLedgerPdf,
  getStockByPanna,
  getFabricRequirement
};
