const FabricTransaction = require('../db/models/fabricTransaction.model');
const FabricStockAdjustment = require('../db/models/fabricStockAdjustment.model');
const PDFDocument = require('pdfkit');
const { emitSocketEvent } = require('../utils/socketEmitHelper');

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

    // Auto-assign the next lot number
    const lastLotTx = await FabricTransaction.findOne(
      { type: 'INWARD', lotNo: { $ne: null, $exists: true } },
      { lotNo: 1 },
      { sort: { lotNo: -1 } }
    );
    const nextLotNo = lastLotTx && lastLotTx.lotNo ? Number(lastLotTx.lotNo) + 1 : 1;

    const parsedTpDetails = Array.isArray(req.body.tpDetails)
      ? req.body.tpDetails
          .filter(r => r.tpMeter !== '' && r.tpMeter != null)
          .map((r, idx) => ({
            tpNo: Number(r.tpNo) || idx + 1,
            tpMeter: parseFloat(r.tpMeter) || 0,
            notes: r.notes || '',
          }))
      : [];

    const transaction = new FabricTransaction({
      type: 'INWARD',
      challanNo,
      vendorName,
      fabricQuality: normFabric,
      panna: normP,
      qty,
      lotNo: nextLotNo,
      date: date ? new Date(date) : new Date(),
      notes,
      shortagePct: parsedPct,
      shortageMtr: parsedMtr,
      shortageMode: sMode,
      department: department || 'digital_print',
      tpDetails: parsedTpDetails,
      totalTp: parsedTpDetails.filter(r => r.tpMeter > 0).length,
    });

    await transaction.save();
    emitSocketEvent(req, 'fabric-updated', { type: 'inward', data: transaction });
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
          if (!jobCard.lotNo && lotNo) {
            jobCard.lotNo = String(lotNo).trim();
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

    emitSocketEvent(req, 'fabric-updated', { type: 'outward', data: transaction });
    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    console.error('Error creating outward fabric transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get all transactions
const getTransactions = async (req, res) => {
  try {
    const filter = getDepartmentFilter(req.query.department);
    if (req.query.type) {
      filter.type = req.query.type;
    }
    let query = FabricTransaction.find(filter).sort({ date: -1, createdAt: -1 });
    if (req.query.limit) {
      query = query.limit(parseInt(req.query.limit, 10));
    }
    const transactions = await query;
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
        andConds.push({ panna: new RegExp(`^${cleanP}["']?$`, 'i') });
      }

      matchStage.$and = andConds;
    }

    const pipeline = [
      { $match: matchStage },
      { $sort: { date: 1 } },
      {
        $group: {
          _id: '$lotNo',
          inwardFabricQuality: { $max: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$fabricQuality', null] } },
          firstFabricQuality: { $first: '$fabricQuality' },
          inwardPanna: { $max: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$panna', null] } },
          firstPanna: { $first: '$panna' },
          vendorName: { $max: '$vendorName' },
          inwardVendorChallanNo: { $max: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$challanNo', null] } },
          firstVendorChallanNo: { $first: '$challanNo' },
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
          fabricQuality: { $ifNull: ['$inwardFabricQuality', '$firstFabricQuality'] },
          panna: { $ifNull: ['$inwardPanna', '$firstPanna'] },
          vendorName: 1,
          vendorChallanNo: { $ifNull: ['$inwardVendorChallanNo', '$firstVendorChallanNo'] },
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
    emitSocketEvent(req, 'fabric-updated', { type: 'delete', id });
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

    // Table header configuration
    const colX = [40, 90, 145, 215, 305, 395, 455, 500];
    const colWidths = [45, 50, 65, 85, 85, 55, 40, 55];
    const headers = ['Date', 'Lot #', 'Type', 'Challan/Job', 'Fabric Quality', 'Vendor/Party', 'Panna', 'Qty'];

    const renderTableHeader = () => {
      const py = doc.y;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('black');
      headers.forEach((h, i) => {
        doc.text(h, colX[i], py, { width: colWidths[i], align: i === 7 ? 'right' : 'left' });
      });
      doc.moveDown(0.8);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.4);
    };

    renderTableHeader();

    // Rows
    doc.font('Helvetica').fontSize(7.5);
    let totalIn = 0, totalOut = 0;
    for (const t of transactions) {
      if (doc.y > 740) {
        doc.addPage();
        renderTableHeader();
        doc.font('Helvetica').fontSize(7.5);
      }

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

      const startY = doc.y;
      let maxHeight = 0;

      row.forEach((cell, i) => {
        doc.fillColor(isIn ? '#1a472a' : '#7f1d1d');
        const opts = { width: colWidths[i], align: i === 7 ? 'right' : 'left' };
        doc.text(String(cell), colX[i], startY, opts);
        const cellH = doc.heightOfString(String(cell), opts);
        if (cellH > maxHeight) maxHeight = cellH;
      });

      doc.y = startY + maxHeight + 4;
    }

    // Summary
    doc.moveDown(1);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('black');
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
    const dept = req.query.department || 'digital_print';
    const deptFilter = getDepartmentFilter(dept);

    // Fetch active job cards that have fabric requirements and are not finished
    const jobFilter = {
      status: { $in: ['Pending', 'In Progress'] },
      printStatus: { $nin: ['Printing Done', 'Done', 'Completed'] },
      fabric: { $exists: true, $nin: ['', null] }
    };

    // If a specific department is passed, apply it to jobs
    if (dept) {
      jobFilter.department = { $in: [dept, new RegExp(`^${dept}$`, 'i')] };
    }

    const jobs = await JobCard.find(jobFilter).sort({ jobNo: 1 }).lean();

    // Group requirement by fabric + panna
    const requirementMap = {};
    for (const job of jobs) {
      const panna = normalizePanna(job.panna, job.fabric);
      const fabric = normalizeFabric(job.fabric, panna);
      if (!fabric) continue;

      // Calculate target meters for this job card
      let targetMtr = 0;
      if (job.totalMtr) {
        const targetMatch = String(job.totalMtr).match(/[\d.]+/);
        if (targetMatch) targetMtr = parseFloat(targetMatch[0]) || 0;
      }
      if (targetMtr <= 0 && job.consumption) {
        const consMatch = String(job.consumption).match(/[\d.]+/);
        const consMtr = consMatch ? parseFloat(consMatch[0]) || 0 : 0;
        const pcsNum = parseFloat(String(job.pcs || '1').replace(/[^\d.]/g, '')) || 1;
        targetMtr = consMtr * pcsNum;
      }
      if (targetMtr <= 0) continue;

      // Already printed meters
      let printedMtr = 0;
      if (job.printMtr) {
        const printedMatch = String(job.printMtr).match(/[\d.]+/);
        if (printedMatch) printedMtr = parseFloat(printedMatch[0]) || 0;
      }

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
      requirementMap[key].totalMtrRequired = Math.round((requirementMap[key].totalMtrRequired + mtrNeeded) * 100) / 100;
      requirementMap[key].jobs.push({
        jobNo: job.jobNo,
        party: job.party || '—',
        pcs: job.pcs || '—',
        designNo: job.designNo || job.designName || '',
        totalMtr: Math.round(targetMtr * 100) / 100,
        printedMtr: Math.round(printedMtr * 100) / 100,
        remainingMtr: Math.round(mtrNeeded * 100) / 100,
        date: job.date || ''
      });
    }

    // Now get current stock grouped by fabric+panna for comparison
    const stockPipeline = [
      ...(deptFilter && Object.keys(deptFilter).length > 0 ? [{ $match: deptFilter }] : []),
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
      },
      { $sort: { fabricQuality: 1, panna: 1 } }
    ];
    const stockData = await FabricTransaction.aggregate(stockPipeline);

    // Build stock lookup map (strictly accumulating so multiple records for same normalized fabric sum together)
    const stockMap = {};
    const stockMapByFabricOnly = {};
    for (const s of stockData) {
      const panna = normalizePanna(s.panna, s.fabricQuality);
      const fabric = normalizeFabric(s.fabricQuality, panna);
      const key = `${fabric}|||${panna}`;
      const stockVal = Number(s.currentStock) || 0;
      stockMap[key] = Math.round(((stockMap[key] || 0) + stockVal) * 100) / 100;
      stockMapByFabricOnly[fabric] = Math.round(((stockMapByFabricOnly[fabric] || 0) + stockVal) * 100) / 100;
    }

    // Enrich requirement with stock info
    const result = Object.values(requirementMap).map(req => {
      const key = `${req.fabricQuality}|||${req.panna}`;
      // Match exact fabric + panna, or fallback to fabric match if panna unknown
      let currentStock = stockMap[key];
      if (currentStock === undefined || currentStock === null) {
        currentStock = stockMapByFabricOnly[req.fabricQuality] || 0;
      }
      currentStock = Math.max(0, currentStock);

      const shortfall = Math.round(Math.max(0, req.totalMtrRequired - currentStock) * 100) / 100;
      const status = currentStock >= req.totalMtrRequired ? 'Sufficient' :
                     currentStock > 0 ? 'Short' : 'No Stock';

      // Deterministic sort of jobs inside this requirement
      req.jobs.sort((a, b) => (b.remainingMtr - a.remainingMtr) || String(a.jobNo).localeCompare(String(b.jobNo)));

      return {
        ...req,
        totalMtrRequired: Math.round(req.totalMtrRequired * 100) / 100,
        currentStock: Math.round(currentStock * 100) / 100,
        shortfall,
        status
      };
    }).sort((a, b) => {
      const cmp = a.fabricQuality.localeCompare(b.fabricQuality);
      if (cmp !== 0) return cmp;
      return String(a.panna).localeCompare(String(b.panna));
    });

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
    if (qty !== undefined) transaction.qty = Number(qty);
    if (date !== undefined) transaction.date = new Date(date);
    if (notes !== undefined) transaction.notes = notes;
    if (jobNo !== undefined) transaction.jobNo = jobNo;
    if (partyName !== undefined) transaction.partyName = partyName;
    if (lotNo !== undefined) transaction.lotNo = lotNo ? Number(lotNo) : undefined;
    if (shortagePct !== undefined) transaction.shortagePct = shortagePct !== '' && shortagePct != null ? parseFloat(shortagePct) : null;
    if (req.body.shortageMtr !== undefined) transaction.shortageMtr = req.body.shortageMtr !== '' && req.body.shortageMtr != null ? parseFloat(req.body.shortageMtr) : null;
    if (req.body.shortageMode !== undefined) transaction.shortageMode = req.body.shortageMode;
    if (req.body.tpDetails !== undefined) {
      transaction.tpDetails = Array.isArray(req.body.tpDetails)
        ? req.body.tpDetails
            .filter(r => r.tpMeter !== '' && r.tpMeter != null)
            .map((r, idx) => ({
              tpNo: Number(r.tpNo) || idx + 1,
              tpMeter: parseFloat(r.tpMeter) || 0,
              notes: r.notes || '',
            }))
        : [];
      transaction.totalTp = transaction.tpDetails.filter(r => parseFloat(r.tpMeter) > 0).length;
    }
    if (req.body.totalTp !== undefined) {
      transaction.totalTp = Number(req.body.totalTp) || 0;
    }

    await transaction.save();
    emitSocketEvent(req, 'fabric-updated', { type: 'transaction-updated', data: transaction });
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

const downloadSingleLotStatementPdf = async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const path = require('path');
    const fs = require('fs');
    const mongoose = require('mongoose');
    const logoPath = path.join(__dirname, 'Logo.png');
    const lotNoParam = req.params.lotNo || req.query.lotNo;

    if (!lotNoParam) {
      return res.status(400).json({ error: 'Lot number is required' });
    }

    const cleanLot = String(lotNoParam).trim();
    const numLot = parseInt(cleanLot, 10);
    const clauses = [{ lotNo: cleanLot }];
    if (!isNaN(numLot)) {
      clauses.push({ lotNo: numLot });
      clauses.push({ lotNo: String(numLot) });
    }

    const txs = await mongoose.connection.collection('fabricTransactions').find({ $or: clauses }).sort({ date: 1, _id: 1 }).toArray();

    let fabricQuality = '';
    let panna = '';
    let vendorName = '';
    let vendorChallanNo = '';
    let totalInward = 0;
    let totalOutward = 0;
    const inwardTxs = [];
    const outwardTxs = [];

    for (const t of txs) {
      if (t.fabricQuality && !fabricQuality) fabricQuality = t.fabricQuality;
      if (t.panna && !panna) panna = t.panna;
      if (t.vendorName && !vendorName) vendorName = t.vendorName;

      const qty = Number(t.qty || 0);
      if (t.type === 'INWARD') {
        totalInward += qty;
        if (t.challanNo && !vendorChallanNo) vendorChallanNo = t.challanNo;
        inwardTxs.push(t);
      } else if (t.type === 'OUTWARD') {
        totalOutward += qty;
        outwardTxs.push(t);
      }
    }

    const rawStock = totalInward - totalOutward;
    const currentStock = (rawStock > 0 && rawStock <= 5.0) ? 0 : rawStock;
    const usagePct = totalInward > 0 ? Math.min(100, Math.round((totalOutward / totalInward) * 100)) : 0;

    const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Fabric_Lot_${cleanLot}_Statement_${new Date().toISOString().split('T')[0]}.pdf"`);
    doc.pipe(res);

    // Header section with Logo
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 30, 20, { width: 130 });
    }

    doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold')
      .text('FABRIC LOT INWARD & OUTWARD STATEMENT', 170, 24, { width: 395, align: 'right' });

    doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold')
      .text(`Lot #${cleanLot} — ${fabricQuality || 'Unspecified Fabric'}`, 170, 42, { width: 395, align: 'right' });

    const genDateStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    doc.fillColor('#64748b').fontSize(8).font('Helvetica')
      .text(`Generated: ${genDateStr}`, 170, 56, { width: 395, align: 'right' });

    doc.moveTo(30, 72).lineTo(565, 72).strokeColor('#cbd5e1').lineWidth(1).stroke();

    let y = 82;

    // Metadata Card
    doc.rect(30, y, 535, 34).fill('#f8fafc').stroke('#e2e8f0');
    doc.fillColor('#334155').fontSize(8).font('Helvetica');
    doc.text('Fabric: ', 40, y + 6, { continued: true }).font('Helvetica-Bold').text(fabricQuality || '—', { continued: true })
       .font('Helvetica').text('   |   Panna: ', { continued: true }).font('Helvetica-Bold').text(`${panna || '58'}"`, { continued: true })
       .font('Helvetica').text('   |   Primary Vendor: ', { continued: true }).font('Helvetica-Bold').text(vendorName || '—', { continued: true })
       .font('Helvetica').text('   |   Vendor Challan: ', { continued: true }).font('Helvetica-Bold').text(vendorChallanNo || '—');

    const statusLabel = currentStock > 0 ? 'IN STOCK' : currentStock === 0 ? 'EXHAUSTED' : 'DEFICIT';
    const statusColor = currentStock > 0 ? '#059669' : currentStock === 0 ? '#64748b' : '#dc2626';

    doc.text('Status: ', 40, y + 20, { continued: true }).font('Helvetica-Bold').fillColor(statusColor).text(`${statusLabel} (${usagePct}% Dispatched)`);

    y += 42;

    // 3 KPI Cards
    const kpiWidth = 171;
    // Inward KPI
    doc.rect(30, y, kpiWidth, 38).fill('#ecfdf5').stroke('#a7f3d0');
    doc.fillColor('#065f46').fontSize(7.5).font('Helvetica-Bold').text('TOTAL INWARD', 38, y + 6);
    doc.fillColor('#047857').fontSize(12).font('Helvetica-Bold').text(`+${totalInward.toFixed(2)} mtr`, 38, y + 18);

    // Outward KPI
    doc.rect(211, y, kpiWidth, 38).fill('#fef2f2').stroke('#fecaca');
    doc.fillColor('#991b1b').fontSize(7.5).font('Helvetica-Bold').text('TOTAL OUTWARD', 219, y + 6);
    doc.fillColor('#b91c1c').fontSize(12).font('Helvetica-Bold').text(`-${totalOutward.toFixed(2)} mtr`, 219, y + 18);

    // Net Balance KPI
    const balBg = currentStock >= 0 ? '#eff6ff' : '#fff1f2';
    const balBorder = currentStock >= 0 ? '#bfdbfe' : '#fecdd3';
    const balColor = currentStock >= 0 ? '#1d4ed8' : '#be123c';
    doc.rect(392, y, kpiWidth + 2, 38).fill(balBg).stroke(balBorder);
    doc.fillColor(balColor).fontSize(7.5).font('Helvetica-Bold').text(currentStock >= 0 ? 'NET AVAILABLE STOCK' : 'NET DEFICIT', 400, y + 6);
    doc.fillColor(balColor).fontSize(12).font('Helvetica-Bold').text(`${currentStock.toFixed(2)} mtr`, 400, y + 18);

    y += 48;

    const fmtDate = (d) => {
      if (!d) return '—';
      const obj = new Date(d);
      return isNaN(obj.getTime()) ? '—' : `${String(obj.getDate()).padStart(2, '0')}/${String(obj.getMonth() + 1).padStart(2, '0')}/${obj.getFullYear()}`;
    };

    const formatNote = (str) => {
      if (!str || typeof str !== 'string') return '—';
      let clean = str.trim();
      // Parse auto-shortage string: Fresh=32.75m + 3% shortage = 33.733m raw
      const m = clean.match(/Fresh=([\d.]+)m?\s*\+\s*([\d.]+)%?\s*shortage(?:\s*=\s*[\d.]+m?\s*raw)?/i);
      if (m) {
        return `Fresh: ${m[1]}m (+${m[2]}% Shortage)`;
      }
      if (/Lot Transfer/i.test(clean) || /\[Ref:\s*LT-/i.test(clean)) {
        return clean.replace(/\[Ref:\s*([^\]]+)\]/i, '($1)').replace(/\s*\|\s*/g, ' • ');
      }
      clean = clean.replace(/^Auto:\s*[^|]+\|\s*Lot\s*#?\d+\s*\|\s*/i, '');
      return clean.trim() || '—';
    };

    const renderInwardTableHeader = (currY) => {
      doc.rect(30, currY, 535, 18).fill('#059669');
      doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
      doc.text('DATE', 35, currY + 5);
      doc.text('VENDOR / SOURCE', 105, currY + 5);
      doc.text('CHALLAN / REF', 235, currY + 5);
      doc.text('NOTES / REMARKS', 325, currY + 5);
      doc.text('INWARD QTY', 485, currY + 5, { width: 75, align: 'right' });
    };

    const renderOutwardTableHeader = (currY) => {
      doc.rect(30, currY, 535, 18).fill('#dc2626');
      doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
      doc.text('DATE', 35, currY + 5);
      doc.text('PARTY / DESTINATION', 105, currY + 5);
      doc.text('CHALLAN / JOB NO.', 235, currY + 5);
      doc.text('DISPATCH DETAILS / NOTES', 325, currY + 5);
      doc.text('OUTWARD QTY', 485, currY + 5, { width: 75, align: 'right' });
    };

    // Section 1: Inward Receipts
    doc.fillColor('#065f46').fontSize(10).font('Helvetica-Bold').text(`1. INWARD RECEIPTS (${inwardTxs.length})`, 30, y);
    y += 14;

    renderInwardTableHeader(y);
    y += 18;

    if (inwardTxs.length === 0) {
      doc.rect(30, y, 535, 18).fill('#f8fafc').stroke('#e2e8f0');
      doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('No inward transactions logged.', 35, y + 5);
      y += 18;
    } else {
      inwardTxs.forEach((tx, idx) => {
        const isTransfer = tx.notes && (/Lot Transfer/i.test(tx.notes) || /Auto Lot.*Rebalance/i.test(tx.notes) || /\[Ref:\s*LT-/i.test(tx.notes));
        const srcLot = tx.notes && (tx.notes.match(/(?:from Lot|Lot #(\d+)\s*->)\s*#?\s*(\d+)/i)?.[1] || tx.notes.match(/(?:from Lot|Lot #(\d+)\s*->)\s*#?\s*(\d+)/i)?.[2] || tx.notes.match(/Lot #(\d+)\s*->/i)?.[1]);
        const refId = tx.notes && tx.notes.match(/\[Ref:\s*([^\]]+)\]/i)?.[1];
        const chDisp = tx.challanNo || refId || (isTransfer && srcLot ? `LT-#${srcLot}` : '—');
        const vendorDisp = isTransfer ? (srcLot ? `Lot #${srcLot}` : (tx.vendorName || tx.partyName || 'Lot Transfer')) : (tx.vendorName || tx.partyName || '—');
        const cleanNote = formatNote(tx.notes);

        doc.font('Helvetica').fontSize(7.5);
        const textH = doc.heightOfString(cleanNote, { width: 155 });
        const rowHeight = Math.max(18, textH + 8);

        if (y + rowHeight > 770) {
          doc.addPage();
          y = 30;
          renderInwardTableHeader(y);
          y += 18;
        }

        doc.rect(30, y, 535, rowHeight).fill(idx % 2 === 0 ? '#f8fafc' : '#ffffff');
        doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica');
        doc.text(fmtDate(tx.date), 35, y + 5);
        doc.text(vendorDisp, 105, y + 5, { width: 125, lineBreak: false, ellipsis: true });
        doc.text(chDisp, 235, y + 5, { width: 85, lineBreak: false, ellipsis: true });
        doc.text(cleanNote, 325, y + 5, { width: 155 });
        doc.fillColor('#047857').font('Helvetica-Bold').text(`+${Number(tx.qty || 0).toFixed(2)} m`, 485, y + 5, { width: 75, align: 'right' });
        y += rowHeight;
      });
    }

    y += 16;
    if (y > 740) {
      doc.addPage();
      y = 30;
    }

    // Section 2: Outward Dispatches
    doc.fillColor('#991b1b').fontSize(10).font('Helvetica-Bold').text(`2. OUTWARD DISPATCHES (${outwardTxs.length})`, 30, y);
    y += 14;

    renderOutwardTableHeader(y);
    y += 18;

    if (outwardTxs.length === 0) {
      doc.rect(30, y, 535, 18).fill('#f8fafc').stroke('#e2e8f0');
      doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('No outward dispatches against this lot.', 35, y + 5);
      y += 18;
    } else {
      outwardTxs.forEach((tx, idx) => {
        const isTransfer = tx.notes && (/Lot Transfer/i.test(tx.notes) || /Auto Lot.*Rebalance/i.test(tx.notes) || /\[Ref:\s*LT-/i.test(tx.notes));
        const targetLot = tx.notes && (tx.notes.match(/(?:to Lot|-> Lot|->\s*Lot|Transfer to Lot)\s*#?\s*(\d+)/i)?.[1] || tx.notes.match(/Lot #\d+\s*->\s*Lot #?(\d+)/i)?.[1]);
        const refId = tx.notes && tx.notes.match(/\[Ref:\s*([^\]]+)\]/i)?.[1];
        const chDisp = tx.challanNo || (tx.notes && tx.notes.match(/(EDP-\d+|Challan\s*#?\s*\d+)/i)?.[0]) || refId || tx.jobNo || (isTransfer && targetLot ? `LT-#${targetLot}` : '—');
        const partyDisp = isTransfer ? (targetLot ? `Lot #${targetLot}` : (tx.partyName || 'Lot Transfer')) : (tx.partyName || '—');
        const cleanNote = formatNote(tx.notes);

        doc.font('Helvetica').fontSize(7.5);
        const textH = doc.heightOfString(cleanNote, { width: 155 });
        const rowHeight = Math.max(18, textH + 8);

        if (y + rowHeight > 770) {
          doc.addPage();
          y = 30;
          renderOutwardTableHeader(y);
          y += 18;
        }

        doc.rect(30, y, 535, rowHeight).fill(idx % 2 === 0 ? '#f8fafc' : '#ffffff');
        doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica');
        doc.text(fmtDate(tx.date), 35, y + 5);
        doc.text(partyDisp, 105, y + 5, { width: 125, lineBreak: false, ellipsis: true });
        doc.text(chDisp, 235, y + 5, { width: 85, lineBreak: false, ellipsis: true });
        doc.text(cleanNote, 325, y + 5, { width: 155 });
        doc.fillColor('#b91c1c').font('Helvetica-Bold').text(`-${Number(tx.qty || 0).toFixed(2)} m`, 485, y + 5, { width: 75, align: 'right' });
        y += rowHeight;
      });
    }

    y += 16;
    if (y > 740) { doc.addPage(); y = 30; }

    // Final Summary Box
    doc.rect(30, y, 535, 32).fill('#f1f5f9').stroke('#cbd5e1');
    doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold')
      .text(`NET RECONCILIATION FOR LOT #${cleanLot}`, 40, y + 6);
    doc.fillColor('#334155').fontSize(8).font('Helvetica')
      .text(`Total Inward: +${totalInward.toFixed(2)}m   |   Total Outward: -${totalOutward.toFixed(2)}m   |   Available Balance: `, 40, y + 18, { continued: true })
      .fillColor(statusColor).font('Helvetica-Bold').text(`${currentStock.toFixed(2)} mtr`);

    // Page Numbers
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
        .text(`Page ${i + 1} of ${pages.count} — Elite Digital Prints • Lot #${cleanLot} Statement`, 30, 800, { width: 535, align: 'center', lineBreak: false });
    }

    doc.end();
  } catch (err) {
    console.error('Error generating Single Lot Statement PDF:', err);
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
    const { dateStart, dateEnd, reports, startTime, stopTime, operator, machineName: qMachine, shift: qShift, operatorName: qOperator, pass: qPass } = req.query;
    const PDFDocument = require('pdfkit');
    const path = require('path');
    const fs = require('fs');

    const FabricChallan = require('../db/models/fabricChallan.model');
    const JobPrintLog = require('../db/models/jobPrintLog.model');
    const JobCard = require('../db/models/jobCard.model');
    const RawMaterialTransaction = require('../db/models/rawMaterialTransaction.model');
    const PrintConfig = require('../db/models/printConfig.model');
    const Expense = require('../db/models/expense.model');
    const BillingInvoice = require('../db/models/billingInvoice.model');

    const selectedReports = reports
      ? reports.split(',').map(s => s.trim().toLowerCase())
      : ['challan', 'inward', 'outward', 'lotwise', 'stock', 'machine', 'expense', 'invoice'];

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

    // Calculate WTD & MTD Machine Printed Meters STRICTLY using operational date
    const mtdStartStr = `${mtdStart.getFullYear()}-${String(mtdStart.getMonth() + 1).padStart(2, '0')}-01`;
    const mtdEndStr = `${mtdEnd.getFullYear()}-${String(mtdEnd.getMonth() + 1).padStart(2, '0')}-${String(mtdEnd.getDate()).padStart(2, '0')}`;
    const wtdStartStr = `${wtdStart.getFullYear()}-${String(wtdStart.getMonth() + 1).padStart(2, '0')}-${String(wtdStart.getDate()).padStart(2, '0')}`;
    const wtdEndStr = `${wtdEnd.getFullYear()}-${String(wtdEnd.getMonth() + 1).padStart(2, '0')}-${String(wtdEnd.getDate()).padStart(2, '0')}`;

    const wtdLogQuery = {
      $or: [
        { date: { $gte: wtdStart, $lte: wtdEnd } },
        { date: { $gte: wtdStartStr, $lte: wtdEndStr } }
      ]
    };
    const mtdLogQuery = {
      $or: [
        { date: { $gte: mtdStart, $lte: mtdEnd } },
        { date: { $gte: mtdStartStr, $lte: mtdEndStr } }
      ]
    };

    if (qMachine) {
      wtdLogQuery.machineName = { $regex: qMachine.trim(), $options: 'i' };
      mtdLogQuery.machineName = { $regex: qMachine.trim(), $options: 'i' };
    }
    if (qShift && qShift.trim() !== '' && qShift.toLowerCase() !== 'all') {
      wtdLogQuery.shift = { $regex: qShift.trim(), $options: 'i' };
      mtdLogQuery.shift = { $regex: qShift.trim(), $options: 'i' };
    }
    if (qOperator) {
      wtdLogQuery.operatorName = { $regex: qOperator.trim(), $options: 'i' };
      mtdLogQuery.operatorName = { $regex: qOperator.trim(), $options: 'i' };
    }
    if (qPass) {
      wtdLogQuery.pass = { $regex: qPass.trim(), $options: 'i' };
      mtdLogQuery.pass = { $regex: qPass.trim(), $options: 'i' };
    }

    const wtdPrintLogs = await JobPrintLog.find(wtdLogQuery).lean();
    const wtdMachinePrintedMtr = wtdPrintLogs.reduce((s, l) => s + (Number(l.meters) || 0), 0);

    const mtdPrintLogs = await JobPrintLog.find(mtdLogQuery).lean();
    const mtdMachinePrintedMtr = mtdPrintLogs.reduce((s, l) => s + (Number(l.meters) || 0), 0);

    // ── FABRIC DEPARTMENT OPENING, INWARD, OUTWARD, CLOSING SUMMARY ──
    const fabricOpeningAgg = dsStr ? await FabricTransaction.aggregate([
      {
        $match: {
          department: 'digital_print',
          notes: { $not: /Lot Transfer|Lot Rebalance|Ref:\s*LT-/i },
          $or: [
            { date: { $lt: new Date(`${dsStr}T00:00:00.000`) } },
            { date: { $lt: dsStr } }
          ]
        }
      },
      {
        $group: {
          _id: '$fabricQuality',
          inward: { $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] } },
          outward: { $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] } }
        }
      }
    ]) : [];

    const fabricOpeningMap = {};
    let totalFabricOpeningMtr = 0;
    fabricOpeningAgg.forEach(item => {
      const q = (item._id || 'UNKNOWN').trim();
      const openStock = (item.inward || 0) - (item.outward || 0);
      fabricOpeningMap[q] = openStock;
      totalFabricOpeningMtr += openStock;
    });

    const fabricPeriodQualityMap = {};
    inwardData.forEach(r => {
      const q = (r.fabricQuality || 'UNKNOWN').trim();
      if (!fabricPeriodQualityMap[q]) fabricPeriodQualityMap[q] = { inward: 0, outward: 0 };
      fabricPeriodQualityMap[q].inward += Number(r.qty) || 0;
    });
    outwardData.forEach(r => {
      const q = (r.fabricQuality || 'UNKNOWN').trim();
      if (!fabricPeriodQualityMap[q]) fabricPeriodQualityMap[q] = { inward: 0, outward: 0 };
      fabricPeriodQualityMap[q].outward += Number(r.qty) || 0;
    });

    const allFabQualities = Array.from(new Set([...Object.keys(fabricOpeningMap), ...Object.keys(fabricPeriodQualityMap)]));
    const fabQualitySummaryList = allFabQualities.map(q => {
      const op = fabricOpeningMap[q] || 0;
      const inw = fabricPeriodQualityMap[q]?.inward || 0;
      const out = fabricPeriodQualityMap[q]?.outward || 0;
      const cl = op + inw - out;
      return { q, op, inw, out, cl, vol: inw + out };
    });
    fabQualitySummaryList.sort((a, b) => b.vol - a.vol);
    const topFabQualities = fabQualitySummaryList.slice(0, 4);
    const totalFabricClosingMtr = totalFabricOpeningMtr + totalInwardMtr - totalOutwardMtr;

    // ── PAPER & INK SUMMARY CALCULATIONS ──
    const grandoDayInk = { C: 0, M: 0, Y: 0, K: 0 };
    const grandoNightInk = { C: 0, M: 0, Y: 0, K: 0 };
    const printdotDayInk = { C: 0, M: 0, Y: 0, K: 0 };
    const printdotNightInk = { C: 0, M: 0, Y: 0, K: 0 };

    const pannaCols = ['36', '38', '44', '54', '58', '60'];
    const paperDayTypeMap = {};
    const paperDayMetersMap = {};
    const paperNightTypeMap = {};
    const paperNightMetersMap = {};
    const paperInwardTypeMap = {};
    const paperInwardMetersMap = {};
    const grandoInwardInk = { C: 0, M: 0, Y: 0, K: 0 };
    const printdotInwardInk = { C: 0, M: 0, Y: 0, K: 0 };

    let grando1Pass = 0, grando2Pass = 0;
    let printdot1Pass = 0, printdot2Pass = 0;
    let grandoDayMtr = 0, grandoNightMtr = 0;
    let printdotDayMtr = 0, printdotNightMtr = 0;

    if (detailedPrintLogsList.length > 0) {
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

        const pType = l.paperType || 'A++';
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

    (rawMaterialLogs || []).forEach(t => {
      const mName = (t.materialName || '').toLowerCase();
      const col = (t.color || '').toLowerCase();
      const q = Number(t.qty) || 0;
      const can = Number(t.canSize) || 1;
      const vol = q * can;
      const isNight = String(t.notes || t.shift || '').toLowerCase().includes('night');
      const isTypeInward = t.type === 'INWARD';

      if (mName.includes('grando') || mName.includes('printdot') || mName.includes('ink')) {
        const isGrando = mName.includes('grando') || (!mName.includes('printdot'));
        if (isTypeInward) {
          const inwTarget = isGrando ? grandoInwardInk : printdotInwardInk;
          if (mName.includes('cyan') || col.includes('cyan') || col === 'c') inwTarget.C += vol;
          else if (mName.includes('magenta') || col.includes('magenta') || col === 'm') inwTarget.M += vol;
          else if (mName.includes('yellow') || col.includes('yellow') || col === 'y') inwTarget.Y += vol;
          else if (mName.includes('black') || col.includes('black') || col === 'k' || col === 'bk') inwTarget.K += vol;
        } else {
          const outTarget = isGrando ? (isNight ? grandoNightInk : grandoDayInk) : (isNight ? printdotNightInk : printdotDayInk);
          if (mName.includes('cyan') || col.includes('cyan') || col === 'c') outTarget.C += vol;
          else if (mName.includes('magenta') || col.includes('magenta') || col === 'm') outTarget.M += vol;
          else if (mName.includes('yellow') || col.includes('yellow') || col === 'y') outTarget.Y += vol;
          else if (mName.includes('black') || col.includes('black') || col === 'k' || col === 'bk') outTarget.K += vol;
        }
      } else if (mName.includes('paper') || t.panna || mName.includes('sublimation')) {
        const pType = t.materialName || 'A++';
        let pannaWidth = String(t.panna || '').replace(/[^\d]/g, '');
        if (!pannaWidth || !pannaCols.includes(pannaWidth)) pannaWidth = '58';
        const mtrVal = Number(t.meters) || Number(t.totalMeters) || (q * (Number(t.metersPerRoll) || 0)) || 0;

        if (isTypeInward) {
          if (!paperInwardTypeMap[pType]) {
            paperInwardTypeMap[pType] = { '36': 0, '38': 0, '44': 0, '54': 0, '58': 0, '60': 0 };
            paperInwardMetersMap[pType] = { '36': 0, '38': 0, '44': 0, '54': 0, '58': 0, '60': 0 };
          }
          paperInwardTypeMap[pType][pannaWidth] += q;
          paperInwardMetersMap[pType][pannaWidth] += mtrVal;
        }
      }
    });

    const gDayTot = grandoDayInk.C + grandoDayInk.M + grandoDayInk.Y + grandoDayInk.K;
    const gNightTot = grandoNightInk.C + grandoNightInk.M + grandoNightInk.Y + grandoNightInk.K;
    const pDayTot = printdotDayInk.C + printdotDayInk.M + printdotDayInk.Y + printdotDayInk.K;
    const pNightTot = printdotNightInk.C + printdotNightInk.M + printdotNightInk.Y + printdotNightInk.K;
    const dayTotInk = gDayTot + pDayTot;
    const nightTotInk = gNightTot + pNightTot;
    const grandTotInkAll = dayTotInk + nightTotInk;

    let grandTotPaperRolls = 0;
    let grandTotPaperAll = 0;
    ['A++', 'A+', 'A'].forEach(pType => {
      pannaCols.forEach(p => {
        const dR = (paperDayTypeMap[pType] && paperDayTypeMap[pType][p]) || 0;
        const nR = (paperNightTypeMap[pType] && paperNightTypeMap[pType][p]) || 0;
        const dM = (paperDayMetersMap[pType] && paperDayMetersMap[pType][p]) || 0;
        const nM = (paperNightMetersMap[pType] && paperNightMetersMap[pType][p]) || 0;
        grandTotPaperRolls += (dR + nR) || (Math.ceil((dM + nM) / 910) || 0);
        grandTotPaperAll += (dM + nM);
      });
    });
    if (grandTotPaperAll === 0 && totalMachinePrintedMtr > 0) {
      grandTotPaperAll = totalMachinePrintedMtr;
      grandTotPaperRolls = Math.ceil(totalMachinePrintedMtr / 910);
    }

    // ── EXPENSES & FUNDS SUMMARY (OPENING, INWARD, USED, CLOSING) ──
    const compEntityFilter = {
      $or: [
        { companyEntity: { $in: ['Elite Digital Print', 'Elite Digital Prints'] } },
        { companyEntity: { $exists: false } },
        { companyEntity: null },
        { companyEntity: '' }
      ]
    };

    let expPrior = [];
    if (dsStr) {
      expPrior = await Expense.find({
        date: { $lt: dsStr },
        ...compEntityFilter
      }).lean();
    }
    let cashOpening = 0, bankOpening = 0;
    expPrior.forEach(e => {
      const mode = (e.paymentMode || '').trim().toLowerCase();
      const isCash = mode === 'cash' || mode.includes('cash');
      const net = e.type === 'IN' ? (Number(e.amount) || 0) : -(Number(e.amount) || 0);
      if (isCash) cashOpening += net;
      else bankOpening += net;
    });

    let expPeriodQuery = { ...compEntityFilter };
    if (dsStr && deStr) {
      expPeriodQuery.date = { $gte: dsStr, $lte: deStr };
    } else if (dsStr) {
      expPeriodQuery.date = { $gte: dsStr };
    } else if (deStr) {
      expPeriodQuery.date = { $lte: deStr };
    }

    const periodExpenses = await Expense.find(expPeriodQuery).sort({ date: -1, voucherNo: -1 }).lean();
    let cashInward = 0, cashUsed = 0, bankInward = 0, bankUsed = 0;
    periodExpenses.forEach(e => {
      const mode = (e.paymentMode || '').trim().toLowerCase();
      const isCash = mode === 'cash' || mode.includes('cash');
      const amt = Number(e.amount) || 0;
      if (isCash) {
        if (e.type === 'IN') cashInward += amt;
        else cashUsed += amt;
      } else {
        if (e.type === 'IN') bankInward += amt;
        else bankUsed += amt;
      }
    });

    const cashClosing = cashOpening + cashInward - cashUsed;
    const bankClosing = bankOpening + bankInward - bankUsed;
    const totalFundsOpening = cashOpening + bankOpening;
    const totalFundsInward = cashInward + bankInward;
    const totalFundsUsed = cashUsed + bankUsed;
    const totalFundsClosing = cashClosing + bankClosing;

    // ── SALES & BILLING INVOICES SUMMARY ──
    let invDateFilter = {};
    if (dsStr || deStr) {
      const dsLocal = dsStr ? new Date(`${dsStr}T00:00:00.000Z`) : null;
      const deLocal = deStr ? new Date(`${deStr}T23:59:59.999Z`) : null;
      invDateFilter.invoiceDate = {};
      if (dsLocal) invDateFilter.invoiceDate.$gte = dsLocal;
      if (deLocal) invDateFilter.invoiceDate.$lte = deLocal;
    }

    const periodInvoices = await BillingInvoice.find({
      ...invDateFilter,
      invoiceStatus: { $ne: 'CANCELLED' }
    }).sort({ invoiceDate: -1, invoiceNo: -1 }).lean();

    let totalInvTaxable = 0, totalInvTax = 0, totalInvBilled = 0, totalInvPaid = 0, totalInvDue = 0;
    const debtorMap = {};
    periodInvoices.forEach(i => {
      const sub = Number(i.subtotal) || 0;
      const tax = Number(i.totalTax) || 0;
      const billed = Number(i.grandTotal) || 0;
      const paid = Number(i.paidAmount) || 0;
      const due = Number(i.balanceDue) || 0;

      totalInvTaxable += sub;
      totalInvTax += tax;
      totalInvBilled += billed;
      totalInvPaid += paid;
      totalInvDue += due;

      const pName = (i.customer?.businessName || i.customer?.name || 'Unknown Client').trim();
      if (due > 0) {
        debtorMap[pName] = (debtorMap[pName] || 0) + due;
      }
    });

    const topDebtors = Object.entries(debtorMap)
      .map(([name, due]) => ({ name, due }))
      .sort((a, b) => b.due - a.due)
      .slice(0, 3);

    // Production & Material Efficiency Metrics
    const fabricIssuedToPrintMtr = totalOutwardMtr;
    const prodShortageMtr = Math.max(0, fabricIssuedToPrintMtr - totalMachinePrintedMtr);
    const prodWastagePct = fabricIssuedToPrintMtr > 0 ? ((prodShortageMtr / fabricIssuedToPrintMtr) * 100) : 0;
    const prodEfficiencyPct = fabricIssuedToPrintMtr > 0 ? ((totalMachinePrintedMtr / fabricIssuedToPrintMtr) * 100) : 100;

    const fmtRs = (val) => `Rs. ${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtRsCompact = (val) => `Rs. ${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

    const doc = new PDFDocument({ margin: 25, size: 'A4', autoFirstPage: true, bufferPages: true });
    doc.page.margins.bottom = 10;
    doc.on('pageAdded', () => {
      doc.page.margins.bottom = 10;
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Elite_Digital_Prints_1_Page_Report.pdf"');
    doc.pipe(res);

    const PW = 595, PH = 842, ML = 30, MR = 30;
    const contentWidth = PW - ML - MR;
    const maxY = 750;

    const startDateStr = dsStr ? new Date(`${dsStr}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'All Time';
    const endDateStr = deStr ? new Date(`${deStr}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Present';
    const logoPath = path.join(__dirname, 'Logo.png');

    let startTimeVal = startTime || '';
    let stopTimeVal = stopTime || '';

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

    if (!startTimeVal) startTimeVal = '09:00 AM';
    if (!stopTimeVal) stopTimeVal = '09:00 PM';

    const drawPageHeader = (isFirstPage = false) => {
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, ML, 14, { width: 110 });
      }

      const headerTitle = isFirstPage ? 'ELITE DIGITAL PRINTS — EXECUTIVE SUMMARY REPORT' : 'ELITE DIGITAL PRINTS — TRANSACTION DETAILS';
      doc.fillColor('#000000').fontSize(12).font('Helvetica-Bold')
        .text(headerTitle, ML + 130, 16, { width: contentWidth - 130, align: 'right', lineBreak: false });

      let timeText = `Report Period: ${startDateStr} to ${endDateStr}`;
      if (startTimeVal || stopTimeVal) timeText += ` | Shift Time: ${startTimeVal || '—'} to ${stopTimeVal || '—'}`;
      if (operator) timeText += ` | Operator: ${operator}`;

      doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold')
        .text(timeText, ML + 130, 34, { width: contentWidth - 130, align: 'right', lineBreak: false });

      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica')
        .text(`Generated: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`, ML + 130, 47, { width: contentWidth - 130, align: 'right', lineBreak: false });

      doc.moveTo(ML, 62).lineTo(PW - MR, 62).strokeColor('#ddd6fe').lineWidth(1.2).stroke();
    };

    drawPageHeader(true);

    // ── PAGE 1: COMPLETE DEPARTMENTAL EXECUTIVE SUMMARY ──
    let currentY = 68;

    // 1. Top Executive KPI Cards (Row of 4 Cards)
    const execKpiCards = [
      { label: 'FABRIC CLOSING STOCK', val: `${totalFabricClosingMtr.toFixed(2)} mtr`, sub: `Opening: ${totalFabricOpeningMtr.toFixed(1)}m | Inw: +${totalInwardMtr.toFixed(1)}m` },
      { label: 'MACHINE PRINTED', val: `${totalMachinePrintedMtr.toFixed(2)} mtr`, sub: `${totalMachineJobCardCount} Job Cards (${(detailedPrintLogsList || []).length} Logs)` },
      { label: 'CHALLAN DISPATCHES', val: `${totalChallanMtr.toFixed(2)} mtr`, sub: `${challanData.length} Challans (${totalChallanTp} TP)` },
      { label: 'MTD PRINTED', val: `${mtdMachinePrintedMtr.toFixed(2)} mtr`, sub: 'Month-To-Date (Strict Operational)' }
    ];

    const gapW = 6;
    const kpiCardW = (contentWidth - 3 * gapW) / 4;
    let cardX = ML;

    execKpiCards.forEach((card, idx) => {
      const isBlue = idx % 2 === 0;
      const bg = isBlue ? '#eff6ff' : '#f5f3ff';
      const stroke = isBlue ? '#bfdbfe' : '#ddd6fe';
      const labelColor = isBlue ? '#1e40af' : '#5b21b6';

      doc.rect(cardX, currentY, kpiCardW, 36).fill(bg).stroke(stroke);
      doc.fillColor(labelColor).fontSize(6.5).font('Helvetica-Bold')
        .text(card.label, cardX + 2, currentY + 3.5, { width: kpiCardW - 4, align: 'center', lineBreak: false });
      doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold')
        .text(card.val, cardX + 2, currentY + 14, { width: kpiCardW - 4, align: 'center', lineBreak: false });
      doc.fillColor('#475569').fontSize(5.5).font('Helvetica')
        .text(card.sub, cardX + 2, currentY + 25, { width: kpiCardW - 4, align: 'center', lineBreak: false });

      cardX += kpiCardW + gapW;
    });

    currentY += 42;

    // ── TABLE 1: FABRIC INVENTORY SUMMARY (OPENING, INWARD, USED, CLOSING) ──
    doc.rect(ML, currentY, contentWidth, 14).fill('#ede9fe').stroke('#ddd6fe');
    doc.fillColor('#5b21b6').fontSize(7.5).font('Helvetica-Bold')
      .text('1. FABRIC INVENTORY SUMMARY (OPENING, INWARD, CONSUMPTION, CLOSING)', ML + 6, currentY + 3, { lineBreak: false });
    currentY += 15;

    const fabCols = [
      { title: 'FABRIC QUALITY', w: 165, align: 'left' },
      { title: 'OPENING (MTR)', w: 75, align: 'right' },
      { title: 'INWARD (REC)', w: 75, align: 'right' },
      { title: 'USED (OUTWARD)', w: 75, align: 'right' },
      { title: 'CLOSING (MTR)', w: 80, align: 'right' },
      { title: 'STATUS', w: 65, align: 'center' }
    ];

    let curFabX = ML;
    doc.rect(ML, currentY, contentWidth, 13).fill('#f8fafc').stroke('#cbd5e1');
    fabCols.forEach(col => {
      doc.fillColor('#334155').fontSize(6.5).font('Helvetica-Bold')
        .text(col.title, curFabX + 2, currentY + 3, { width: col.w - 4, align: col.align, lineBreak: false });
      curFabX += col.w;
    });
    currentY += 13;

    topFabQualities.forEach((r, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#fcfaff';
      doc.rect(ML, currentY, contentWidth, 12).fill(bg).stroke('#e2e8f0');
      let x = ML;
      doc.fillColor('#0f172a').fontSize(6.5).font('Helvetica').text(r.q, x + 2, currentY + 2.5, { width: 165 - 4, lineBreak: false });
      x += 165;
      doc.fillColor('#475569').text(r.op.toFixed(2), x + 2, currentY + 2.5, { width: 75 - 4, align: 'right', lineBreak: false });
      x += 75;
      doc.fillColor('#047857').font('Helvetica-Bold').text(r.inw.toFixed(2), x + 2, currentY + 2.5, { width: 75 - 4, align: 'right', lineBreak: false });
      x += 75;
      doc.fillColor('#b91c1c').text(r.out.toFixed(2), x + 2, currentY + 2.5, { width: 75 - 4, align: 'right', lineBreak: false });
      x += 75;
      doc.fillColor('#1e40af').text(r.cl.toFixed(2), x + 2, currentY + 2.5, { width: 80 - 4, align: 'right', lineBreak: false });
      x += 80;
      const statusLabel = r.cl <= 0 ? 'REORDER' : r.cl < 50 ? 'LOW' : 'SAFE';
      const statusColor = r.cl <= 0 ? '#dc2626' : r.cl < 50 ? '#d97706' : '#047857';
      doc.fillColor(statusColor).font('Helvetica-Bold').text(statusLabel, x + 2, currentY + 2.5, { width: 65 - 4, align: 'center', lineBreak: false });
      currentY += 12;
    });

    // Total Fabric Row
    doc.rect(ML, currentY, contentWidth, 13).fill('#ede9fe').stroke('#ddd6fe');
    doc.fillColor('#000000').fontSize(6.8).font('Helvetica-Bold').text('TOTAL FABRIC INVENTORY', ML + 2, currentY + 2.5, { width: 165 - 4, lineBreak: false });
    doc.fillColor('#475569').text(totalFabricOpeningMtr.toFixed(2), ML + 165 + 2, currentY + 2.5, { width: 75 - 4, align: 'right', lineBreak: false });
    doc.fillColor('#047857').text(totalInwardMtr.toFixed(2), ML + 165 + 75 + 2, currentY + 2.5, { width: 75 - 4, align: 'right', lineBreak: false });
    doc.fillColor('#b91c1c').text(totalOutwardMtr.toFixed(2), ML + 165 + 150 + 2, currentY + 2.5, { width: 75 - 4, align: 'right', lineBreak: false });
    doc.fillColor('#1e40af').text(totalFabricClosingMtr.toFixed(2), ML + 165 + 225 + 2, currentY + 2.5, { width: 80 - 4, align: 'right', lineBreak: false });
    doc.fillColor('#047857').text('BALANCED', ML + 165 + 305 + 2, currentY + 2.5, { width: 65 - 4, align: 'center', lineBreak: false });
    currentY += 18;

    // ── TABLE 2: SUBLIMATION / PLOTTER PAPER SUMMARY ──
    doc.rect(ML, currentY, contentWidth, 14).fill('#eff6ff').stroke('#bfdbfe');
    doc.fillColor('#1e40af').fontSize(7.5).font('Helvetica-Bold')
      .text('2. SUBLIMATION / PLOTTER PAPER INVENTORY (OPENING, INWARD, USED, CLOSING)', ML + 6, currentY + 3, { lineBreak: false });
    currentY += 15;

    const paperCols = [
      { title: 'PAPER GRADE', w: 140, align: 'left' },
      { title: 'OPENING (ROLLS)', w: 75, align: 'center' },
      { title: 'INWARD (ROLLS)', w: 75, align: 'center' },
      { title: 'USED (ROLLS)', w: 75, align: 'center' },
      { title: 'CLOSING (ROLLS)', w: 80, align: 'center' },
      { title: 'PRINTED (MTR)', w: 90, align: 'right' }
    ];

    let curPapX = ML;
    doc.rect(ML, currentY, contentWidth, 13).fill('#f8fafc').stroke('#cbd5e1');
    paperCols.forEach(col => {
      doc.fillColor('#334155').fontSize(6.5).font('Helvetica-Bold')
        .text(col.title, curPapX + 2, currentY + 3, { width: col.w - 4, align: col.align, lineBreak: false });
      curPapX += col.w;
    });
    currentY += 13;

    const paperTypesList = ['A++', 'A+', 'A'];
    paperTypesList.forEach((pType, idx) => {
      let rUsedRolls = 0, rUsedMtr = 0, rInwRolls = 0;
      pannaCols.forEach(p => {
        const dR = (paperDayTypeMap[pType] && paperDayTypeMap[pType][p]) || 0;
        const nR = (paperNightTypeMap[pType] && paperNightTypeMap[pType][p]) || 0;
        const dM = (paperDayMetersMap[pType] && paperDayMetersMap[pType][p]) || 0;
        const nM = (paperNightMetersMap[pType] && paperNightMetersMap[pType][p]) || 0;
        rUsedRolls += (dR + nR);
        rUsedMtr += (dM + nM);
        rInwRolls += (paperInwardTypeMap[pType] && paperInwardTypeMap[pType][p]) || 0;
      });
      if (rUsedMtr > 0 && rUsedRolls === 0) rUsedRolls = Math.ceil(rUsedMtr / 910) || 1;
      const opRolls = Math.max(0, rInwRolls > 0 ? Math.round(rInwRolls * 0.2) : 5);
      const clRolls = opRolls + rInwRolls - rUsedRolls;

      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.rect(ML, currentY, contentWidth, 12).fill(bg).stroke('#e2e8f0');
      let x = ML;
      doc.fillColor('#0f172a').fontSize(6.5).font('Helvetica').text(`GRADE ${pType}`, x + 2, currentY + 2.5, { width: 140 - 4, lineBreak: false });
      x += 140;
      doc.fillColor('#475569').text(`${opRolls} R`, x + 2, currentY + 2.5, { width: 75 - 4, align: 'center', lineBreak: false });
      x += 75;
      doc.fillColor('#047857').font('Helvetica-Bold').text(`${rInwRolls} R`, x + 2, currentY + 2.5, { width: 75 - 4, align: 'center', lineBreak: false });
      x += 75;
      doc.fillColor('#b91c1c').text(`${rUsedRolls} R`, x + 2, currentY + 2.5, { width: 75 - 4, align: 'center', lineBreak: false });
      x += 75;
      doc.fillColor('#1e40af').text(`${clRolls} R`, x + 2, currentY + 2.5, { width: 80 - 4, align: 'center', lineBreak: false });
      x += 80;
      doc.fillColor('#0f172a').font('Helvetica-Bold').text(`${rUsedMtr.toFixed(0)} m`, x + 2, currentY + 2.5, { width: 90 - 4, align: 'right', lineBreak: false });
      currentY += 12;
    });

    // Total Paper Row
    doc.rect(ML, currentY, contentWidth, 13).fill('#eff6ff').stroke('#bfdbfe');
    doc.fillColor('#000000').fontSize(6.8).font('Helvetica-Bold').text('TOTAL PAPER INVENTORY', ML + 2, currentY + 2.5, { width: 140 - 4, lineBreak: false });
    doc.fillColor('#475569').text('—', ML + 140 + 2, currentY + 2.5, { width: 75 - 4, align: 'center', lineBreak: false });
    doc.fillColor('#047857').text('—', ML + 140 + 75 + 2, currentY + 2.5, { width: 75 - 4, align: 'center', lineBreak: false });
    doc.fillColor('#b91c1c').text(`${grandTotPaperRolls} Rolls`, ML + 140 + 150 + 2, currentY + 2.5, { width: 75 - 4, align: 'center', lineBreak: false });
    doc.fillColor('#1e40af').text('—', ML + 140 + 225 + 2, currentY + 2.5, { width: 80 - 4, align: 'center', lineBreak: false });
    doc.fillColor('#0f172a').text(`${grandTotPaperAll.toFixed(0)} mtr`, ML + 140 + 305 + 2, currentY + 2.5, { width: 90 - 4, align: 'right', lineBreak: false });
    currentY += 18;

    // ── TABLE 3: PRINTING INK SUMMARY (GRANDO & PRINTDOT) ──
    doc.rect(ML, currentY, contentWidth, 14).fill('#f5f3ff').stroke('#ddd6fe');
    doc.fillColor('#5b21b6').fontSize(7.5).font('Helvetica-Bold')
      .text('3. PRINTING INK SUMMARY (OPENING, INWARD, CONSUMPTION, CLOSING)', ML + 6, currentY + 3, { lineBreak: false });
    currentY += 15;

    const inkCols = [
      { title: 'INK TYPE / BRAND', w: 140, align: 'left' },
      { title: 'CYAN (LTR)', w: 75, align: 'center' },
      { title: 'MAGENTA (LTR)', w: 75, align: 'center' },
      { title: 'YELLOW (LTR)', w: 75, align: 'center' },
      { title: 'BLACK (LTR)', w: 75, align: 'center' },
      { title: 'TOTAL CONSUMED (L)', w: 90, align: 'right' }
    ];

    let curInkX = ML;
    doc.rect(ML, currentY, contentWidth, 13).fill('#f8fafc').stroke('#cbd5e1');
    inkCols.forEach(col => {
      doc.fillColor('#334155').fontSize(6.5).font('Helvetica-Bold')
        .text(col.title, curInkX + 2, currentY + 3, { width: col.w - 4, align: col.align, lineBreak: false });
      curInkX += col.w;
    });
    currentY += 13;

    const gTotC = grandoDayInk.C + grandoNightInk.C;
    const gTotM = grandoDayInk.M + grandoNightInk.M;
    const gTotY = grandoDayInk.Y + grandoNightInk.Y;
    const gTotK = grandoDayInk.K + grandoNightInk.K;
    const gAllTot = gTotC + gTotM + gTotY + gTotK;

    const pTotC = printdotDayInk.C + printdotNightInk.C;
    const pTotM = printdotDayInk.M + printdotNightInk.M;
    const pTotY = printdotDayInk.Y + printdotNightInk.Y;
    const pTotK = printdotDayInk.K + printdotNightInk.K;
    const pAllTot = pTotC + pTotM + pTotY + pTotK;

    const inkRows = [
      { b: 'GRANDO INK CONSUMPTION', c: gTotC.toFixed(2), m: gTotM.toFixed(2), y: gTotY.toFixed(2), k: gTotK.toFixed(2), tot: `${gAllTot.toFixed(2)} Ltr` },
      { b: 'PRINTDOT INK CONSUMPTION', c: pTotC.toFixed(2), m: pTotM.toFixed(2), y: pTotY.toFixed(2), k: pTotK.toFixed(2), tot: `${pAllTot.toFixed(2)} Ltr` }
    ];

    inkRows.forEach((r, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#fcfaff';
      doc.rect(ML, currentY, contentWidth, 12).fill(bg).stroke('#e2e8f0');
      let x = ML;
      doc.fillColor('#0f172a').fontSize(6.5).font('Helvetica').text(r.b, x + 2, currentY + 2.5, { width: 140 - 4, lineBreak: false });
      x += 140;
      doc.fillColor('#0284c7').text(r.c, x + 2, currentY + 2.5, { width: 75 - 4, align: 'center', lineBreak: false });
      x += 75;
      doc.fillColor('#e11d48').text(r.m, x + 2, currentY + 2.5, { width: 75 - 4, align: 'center', lineBreak: false });
      x += 75;
      doc.fillColor('#d97706').text(r.y, x + 2, currentY + 2.5, { width: 75 - 4, align: 'center', lineBreak: false });
      x += 75;
      doc.fillColor('#0f172a').text(r.k, x + 2, currentY + 2.5, { width: 75 - 4, align: 'center', lineBreak: false });
      x += 75;
      doc.fillColor('#5b21b6').font('Helvetica-Bold').text(r.tot, x + 2, currentY + 2.5, { width: 90 - 4, align: 'right', lineBreak: false });
      currentY += 12;
    });

    // Total Ink Row
    doc.rect(ML, currentY, contentWidth, 13).fill('#f5f3ff').stroke('#ddd6fe');
    doc.fillColor('#000000').fontSize(6.8).font('Helvetica-Bold').text('TOTAL INK CONSUMED', ML + 2, currentY + 2.5, { width: 140 - 4, lineBreak: false });
    doc.fillColor('#0284c7').font('Helvetica-Bold').text((gTotC + pTotC).toFixed(2), ML + 140 + 2, currentY + 2.5, { width: 75 - 4, align: 'center', lineBreak: false });
    doc.fillColor('#e11d48').text((gTotM + pTotM).toFixed(2), ML + 140 + 75 + 2, currentY + 2.5, { width: 75 - 4, align: 'center', lineBreak: false });
    doc.fillColor('#d97706').text((gTotY + pTotY).toFixed(2), ML + 140 + 150 + 2, currentY + 2.5, { width: 75 - 4, align: 'center', lineBreak: false });
    doc.fillColor('#0f172a').text((gTotK + pTotK).toFixed(2), ML + 140 + 225 + 2, currentY + 2.5, { width: 75 - 4, align: 'center', lineBreak: false });
    doc.fillColor('#5b21b6').text(`${grandTotInkAll.toFixed(2)} Ltr`, ML + 140 + 300 + 2, currentY + 2.5, { width: 90 - 4, align: 'right', lineBreak: false });
    currentY += 18;

    // ── TABLE 4: MACHINE PRODUCTION & SHIFT PERFORMANCE ──
    doc.rect(ML, currentY, contentWidth, 14).fill('#eff6ff').stroke('#bfdbfe');
    doc.fillColor('#1e40af').fontSize(7.5).font('Helvetica-Bold')
      .text('4. MACHINE PRODUCTION & SHIFT PERFORMANCE', ML + 6, currentY + 3, { lineBreak: false });
    currentY += 15;

    const machCols = [
      { title: 'MACHINE NAME', w: 125, align: 'left' },
      { title: '1-PASS (MTR)', w: 80, align: 'right' },
      { title: '2-PASS (MTR)', w: 80, align: 'right' },
      { title: 'DAY SHIFT (MTR)', w: 80, align: 'right' },
      { title: 'NIGHT SHIFT (MTR)', w: 80, align: 'right' },
      { title: 'TOTAL PRINTED', w: 90, align: 'right' }
    ];

    let curMachX = ML;
    doc.rect(ML, currentY, contentWidth, 13).fill('#f8fafc').stroke('#cbd5e1');
    machCols.forEach(col => {
      doc.fillColor('#334155').fontSize(6.5).font('Helvetica-Bold')
        .text(col.title, curMachX + 2, currentY + 3, { width: col.w - 4, align: col.align, lineBreak: false });
      curMachX += col.w;
    });
    currentY += 13;

    const machRows = [
      { m: 'GRANDO', p1: grando1Pass.toFixed(2), p2: grando2Pass.toFixed(2), day: grandoDayMtr.toFixed(2), night: grandoNightMtr.toFixed(2), tot: `${grandoTotal.toFixed(2)} m` },
      { m: 'PRINTDOT', p1: printdot1Pass.toFixed(2), p2: printdot2Pass.toFixed(2), day: printdotDayMtr.toFixed(2), night: printdotNightMtr.toFixed(2), tot: `${printdotTotal.toFixed(2)} m` }
    ];

    machRows.forEach((r, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.rect(ML, currentY, contentWidth, 12).fill(bg).stroke('#e2e8f0');
      let x = ML;
      doc.fillColor('#0f172a').fontSize(6.5).font('Helvetica').text(r.m, x + 2, currentY + 2.5, { width: 125 - 4, lineBreak: false });
      x += 125;
      doc.fillColor('#475569').text(r.p1, x + 2, currentY + 2.5, { width: 80 - 4, align: 'right', lineBreak: false });
      x += 80;
      doc.fillColor('#475569').text(r.p2, x + 2, currentY + 2.5, { width: 80 - 4, align: 'right', lineBreak: false });
      x += 80;
      doc.fillColor('#0f172a').text(r.day, x + 2, currentY + 2.5, { width: 80 - 4, align: 'right', lineBreak: false });
      x += 80;
      doc.fillColor('#0f172a').text(r.night, x + 2, currentY + 2.5, { width: 80 - 4, align: 'right', lineBreak: false });
      x += 80;
      doc.fillColor('#1e40af').font('Helvetica-Bold').text(r.tot, x + 2, currentY + 2.5, { width: 90 - 4, align: 'right', lineBreak: false });
      currentY += 12;
    });

    // Total Machine Row
    doc.rect(ML, currentY, contentWidth, 13).fill('#eff6ff').stroke('#bfdbfe');
    doc.fillColor('#000000').fontSize(6.8).font('Helvetica-Bold').text('TOTAL MACHINE PRINTED', ML + 2, currentY + 2.5, { width: 125 - 4, lineBreak: false });
    doc.fillColor('#475569').text((grando1Pass + printdot1Pass).toFixed(2), ML + 125 + 2, currentY + 2.5, { width: 80 - 4, align: 'right', lineBreak: false });
    doc.fillColor('#475569').text((grando2Pass + printdot2Pass).toFixed(2), ML + 125 + 80 + 2, currentY + 2.5, { width: 80 - 4, align: 'right', lineBreak: false });
    doc.fillColor('#0f172a').text((grandoDayMtr + printdotDayMtr).toFixed(2), ML + 125 + 160 + 2, currentY + 2.5, { width: 80 - 4, align: 'right', lineBreak: false });
    doc.fillColor('#0f172a').text((grandoNightMtr + printdotNightMtr).toFixed(2), ML + 125 + 240 + 2, currentY + 2.5, { width: 80 - 4, align: 'right', lineBreak: false });
    doc.fillColor('#1e40af').text(`${totalMachinePrintedMtr.toFixed(2)} mtr`, ML + 125 + 320 + 2, currentY + 2.5, { width: 90 - 4, align: 'right', lineBreak: false });
    currentY += 18;

    // ── TABLE 5: EXPENSE & CASH / BANK LIQUIDITY SUMMARY ──
    doc.rect(ML, currentY, contentWidth, 14).fill('#f0fdf4').stroke('#bbf7d0');
    doc.fillColor('#166534').fontSize(7.5).font('Helvetica-Bold')
      .text('5. EXPENSE & CASH / BANK LIQUIDITY (OPENING, INWARD, USED, CLOSING)', ML + 6, currentY + 3, { lineBreak: false });
    currentY += 15;

    const expCols = [
      { title: 'ACCOUNT / FUND MODE', w: 145, align: 'left' },
      { title: 'OPENING (RS.)', w: 78, align: 'right' },
      { title: 'INWARD / REC (RS.)', w: 78, align: 'right' },
      { title: 'USED / EXP (RS.)', w: 78, align: 'right' },
      { title: 'CLOSING (RS.)', w: 80, align: 'right' },
      { title: 'NET FLOW (RS.)', w: 76, align: 'right' }
    ];

    let curExpX = ML;
    doc.rect(ML, currentY, contentWidth, 13).fill('#f8fafc').stroke('#cbd5e1');
    expCols.forEach(col => {
      doc.fillColor('#334155').fontSize(6.5).font('Helvetica-Bold')
        .text(col.title, curExpX + 2, currentY + 3, { width: col.w - 4, align: col.align, lineBreak: false });
      curExpX += col.w;
    });
    currentY += 13;

    const expRows = [
      {
        mode: 'CASH IN HAND',
        op: cashOpening,
        inw: cashInward,
        out: cashUsed,
        cl: cashClosing,
        net: cashInward - cashUsed
      },
      {
        mode: 'BANK ACCOUNTS (KOTAK / ONLINE)',
        op: bankOpening,
        inw: bankInward,
        out: bankUsed,
        cl: bankClosing,
        net: bankInward - bankUsed
      }
    ];

    expRows.forEach((r, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f0fdf4';
      doc.rect(ML, currentY, contentWidth, 12).fill(bg).stroke('#e2e8f0');
      let x = ML;
      doc.fillColor('#0f172a').fontSize(6.5).font('Helvetica').text(r.mode, x + 2, currentY + 2.5, { width: 145 - 4, lineBreak: false });
      x += 145;
      doc.fillColor('#475569').text(fmtRs(r.op), x + 2, currentY + 2.5, { width: 78 - 4, align: 'right', lineBreak: false });
      x += 78;
      doc.fillColor('#047857').font('Helvetica-Bold').text(`+${fmtRs(r.inw)}`, x + 2, currentY + 2.5, { width: 78 - 4, align: 'right', lineBreak: false });
      x += 78;
      doc.fillColor('#b91c1c').text(`-${fmtRs(r.out)}`, x + 2, currentY + 2.5, { width: 78 - 4, align: 'right', lineBreak: false });
      x += 78;
      doc.fillColor('#1e40af').text(fmtRs(r.cl), x + 2, currentY + 2.5, { width: 80 - 4, align: 'right', lineBreak: false });
      x += 80;
      const netColor = r.net >= 0 ? '#047857' : '#b91c1c';
      const netPrefix = r.net >= 0 ? '+' : '';
      doc.fillColor(netColor).text(`${netPrefix}${fmtRs(r.net)}`, x + 2, currentY + 2.5, { width: 76 - 4, align: 'right', lineBreak: false });
      currentY += 12;
    });

    // Total Funds Row
    doc.rect(ML, currentY, contentWidth, 13).fill('#dcfce7').stroke('#86efac');
    doc.fillColor('#000000').fontSize(6.8).font('Helvetica-Bold').text('TOTAL LIQUID FUNDS', ML + 2, currentY + 2.5, { width: 145 - 4, lineBreak: false });
    doc.fillColor('#475569').text(fmtRs(totalFundsOpening), ML + 145 + 2, currentY + 2.5, { width: 78 - 4, align: 'right', lineBreak: false });
    doc.fillColor('#047857').text(`+${fmtRs(totalFundsInward)}`, ML + 145 + 78 + 2, currentY + 2.5, { width: 78 - 4, align: 'right', lineBreak: false });
    doc.fillColor('#b91c1c').text(`-${fmtRs(totalFundsUsed)}`, ML + 145 + 156 + 2, currentY + 2.5, { width: 78 - 4, align: 'right', lineBreak: false });
    doc.fillColor('#1e40af').text(fmtRs(totalFundsClosing), ML + 145 + 234 + 2, currentY + 2.5, { width: 80 - 4, align: 'right', lineBreak: false });
    const totNet = totalFundsInward - totalFundsUsed;
    const totNetColor = totNet >= 0 ? '#047857' : '#b91c1c';
    const totNetPrefix = totNet >= 0 ? '+' : '';
    doc.fillColor(totNetColor).text(`${totNetPrefix}${fmtRs(totNet)}`, ML + 145 + 314 + 2, currentY + 2.5, { width: 76 - 4, align: 'right', lineBreak: false });
    currentY += 18;

    // ── TABLE 6: SALES & BILLING INVOICES SUMMARY ──
    doc.rect(ML, currentY, contentWidth, 14).fill('#fef3c7').stroke('#fde68a');
    doc.fillColor('#92400e').fontSize(7.5).font('Helvetica-Bold')
      .text('6. SALES & BILLING INVOICES SUMMARY (REVENUE, TAX & OUTSTANDING DUE)', ML + 6, currentY + 3, { lineBreak: false });
    currentY += 15;

    const invCols = [
      { title: 'REVENUE & INVOICE METRICS', w: 145, align: 'left' },
      { title: 'TAXABLE VALUE (RS.)', w: 78, align: 'right' },
      { title: 'GST TAX (RS.)', w: 78, align: 'right' },
      { title: 'TOTAL BILLED (RS.)', w: 78, align: 'right' },
      { title: 'COLLECTED (RS.)', w: 80, align: 'right' },
      { title: 'BALANCE DUE (RS.)', w: 76, align: 'right' }
    ];

    let curInvX = ML;
    doc.rect(ML, currentY, contentWidth, 13).fill('#f8fafc').stroke('#cbd5e1');
    invCols.forEach(col => {
      doc.fillColor('#334155').fontSize(6.5).font('Helvetica-Bold')
        .text(col.title, curInvX + 2, currentY + 3, { width: col.w - 4, align: col.align, lineBreak: false });
      curInvX += col.w;
    });
    currentY += 13;

    doc.rect(ML, currentY, contentWidth, 12).fill('#ffffff').stroke('#e2e8f0');
    let xInv = ML;
    doc.fillColor('#0f172a').fontSize(6.5).font('Helvetica').text(`SALES INVOICES (${periodInvoices.length} INVS)`, xInv + 2, currentY + 2.5, { width: 145 - 4, lineBreak: false });
    xInv += 145;
    doc.fillColor('#475569').text(fmtRs(totalInvTaxable), xInv + 2, currentY + 2.5, { width: 78 - 4, align: 'right', lineBreak: false });
    xInv += 78;
    doc.fillColor('#475569').text(fmtRs(totalInvTax), xInv + 2, currentY + 2.5, { width: 78 - 4, align: 'right', lineBreak: false });
    xInv += 78;
    doc.fillColor('#0f172a').font('Helvetica-Bold').text(fmtRs(totalInvBilled), xInv + 2, currentY + 2.5, { width: 78 - 4, align: 'right', lineBreak: false });
    xInv += 78;
    doc.fillColor('#047857').text(fmtRs(totalInvPaid), xInv + 2, currentY + 2.5, { width: 80 - 4, align: 'right', lineBreak: false });
    xInv += 80;
    doc.fillColor('#b91c1c').text(fmtRs(totalInvDue), xInv + 2, currentY + 2.5, { width: 76 - 4, align: 'right', lineBreak: false });
    currentY += 12;

    // Total Invoices Row
    doc.rect(ML, currentY, contentWidth, 13).fill('#fef3c7').stroke('#fde68a');
    doc.fillColor('#000000').fontSize(6.8).font('Helvetica-Bold').text('NET RECEIVABLES TOTAL', ML + 2, currentY + 2.5, { width: 145 - 4, lineBreak: false });
    doc.fillColor('#475569').text(fmtRs(totalInvTaxable), ML + 145 + 2, currentY + 2.5, { width: 78 - 4, align: 'right', lineBreak: false });
    doc.fillColor('#475569').text(fmtRs(totalInvTax), ML + 145 + 78 + 2, currentY + 2.5, { width: 78 - 4, align: 'right', lineBreak: false });
    doc.fillColor('#0f172a').text(fmtRs(totalInvBilled), ML + 145 + 156 + 2, currentY + 2.5, { width: 78 - 4, align: 'right', lineBreak: false });
    doc.fillColor('#047857').text(fmtRs(totalInvPaid), ML + 145 + 234 + 2, currentY + 2.5, { width: 80 - 4, align: 'right', lineBreak: false });
    doc.fillColor('#b91c1c').text(fmtRs(totalInvDue), ML + 145 + 314 + 2, currentY + 2.5, { width: 76 - 4, align: 'right', lineBreak: false });
    currentY += 18;

    // ── TABLE 7: PRODUCTION EFFICIENCY, WASTAGE & TOP RECEIVABLES ──
    const pendingDispatches = Math.max(0, totalMachinePrintedMtr - totalChallanMtr);
    const cardGap = 6;
    const halfW = (contentWidth - cardGap) / 2;

    // Left Card: Production Efficiency & Shortage
    doc.rect(ML, currentY, halfW, 34).fill('#f8fafc').stroke('#cbd5e1');
    doc.fillColor('#1e40af').fontSize(6.8).font('Helvetica-Bold')
      .text('PRODUCTION EFFICIENCY & MATERIAL SHORTAGE', ML + 5, currentY + 3.5, { width: halfW - 10, lineBreak: false });
    doc.fillColor('#334155').fontSize(6.2).font('Helvetica')
      .text(`Issued: ${fabricIssuedToPrintMtr.toFixed(1)} m | Machine Printed: ${totalMachinePrintedMtr.toFixed(1)} m | Dispatch Pending: ${pendingDispatches.toFixed(1)} m`, ML + 5, currentY + 14, { width: halfW - 10, lineBreak: false });
    doc.fillColor(prodShortageMtr > 0 ? '#b91c1c' : '#047857').fontSize(6.2).font('Helvetica-Bold')
      .text(`Shortage / Wastage: ${prodShortageMtr.toFixed(1)} m (${prodWastagePct.toFixed(2)}%) | Job Efficiency: ${prodEfficiencyPct.toFixed(1)}%`, ML + 5, currentY + 23.5, { width: halfW - 10, lineBreak: false });

    // Right Card: Top Outstanding Receivables
    const rightX = ML + halfW + cardGap;
    doc.rect(rightX, currentY, halfW, 34).fill('#fff1f2').stroke('#fecdd3');
    doc.fillColor('#9f1239').fontSize(6.8).font('Helvetica-Bold')
      .text('TOP OUTSTANDING RECEIVABLES (CLIENTS DUE)', rightX + 5, currentY + 3.5, { width: halfW - 10, lineBreak: false });

    let debtorLine1 = topDebtors[0] ? `1. ${topDebtors[0].name}: ${fmtRs(topDebtors[0].due)}` : 'All invoices cleared — Zero pending dues';
    let debtorLine2 = '';
    if (topDebtors[1]) debtorLine2 += `2. ${topDebtors[1].name}: ${fmtRs(topDebtors[1].due)}`;
    if (topDebtors[2]) debtorLine2 += ` | 3. ${topDebtors[2].name}: ${fmtRs(topDebtors[2].due)}`;

    doc.fillColor('#881337').fontSize(6.2).font('Helvetica-Bold')
      .text(debtorLine1, rightX + 5, currentY + 14, { width: halfW - 10, lineBreak: false });
    doc.fillColor('#475569').fontSize(6.2).font('Helvetica')
      .text(debtorLine2 || ('Total Due: ' + fmtRs(totalInvDue)), rightX + 5, currentY + 23.5, { width: halfW - 10, lineBreak: false });

    // ── TRANSITION TO PAGE 2 FOR ITEMISED TRANSACTION HISTORIES ──
    doc.addPage();
    doc.page.margins.bottom = 10;
    drawPageHeader(false);
    currentY = 70;

    const checkAddPage = (heightNeeded) => {
      if (currentY + heightNeeded > maxY) {
        doc.addPage();
        doc.page.margins.bottom = 10;
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
        doc.text('CH. NO', ML + 4, currentY + 5, { width: 44, lineBreak: false });
        doc.text('DATE', ML + 50, currentY + 5, { width: 42, lineBreak: false });
        doc.text('PARTY NAME', ML + 94, currentY + 5, { width: 96, lineBreak: false });
        doc.text('BILLING NAME', ML + 192, currentY + 5, { width: 96, lineBreak: false });
        doc.text('JOB NO', ML + 290, currentY + 5, { width: 50, lineBreak: false });
        doc.text('DESIGN NO', ML + 342, currentY + 5, { width: 70, lineBreak: false });
        doc.text('FABRIC', ML + 414, currentY + 5, { width: 50, lineBreak: false });
        doc.text('TP', ML + 466, currentY + 5, { width: 20, align: 'center', lineBreak: false });
        doc.text('METERS', ML + 488, currentY + 5, { width: 43, align: 'right', lineBreak: false });
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
        doc.text('DATE', ML + 4, currentY + 5, { width: 52, lineBreak: false });
        doc.text('VENDOR NAME', ML + 60, currentY + 5, { width: 140, lineBreak: false });
        doc.text('VENDOR CHALLAN', ML + 204, currentY + 5, { width: 100, lineBreak: false });
        doc.text('FABRIC QUALITY', ML + 308, currentY + 5, { width: 110, lineBreak: false });
        doc.text('PANNA', ML + 422, currentY + 5, { width: 35, lineBreak: false });
        doc.text('LOT NO', ML + 460, currentY + 5, { width: 35, lineBreak: false });
        doc.text('QTY (MTR)', ML + 498, currentY + 5, { width: 33, align: 'right', lineBreak: false });
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
        doc.text('DATE', ML + 4, currentY + 5, { width: 40, lineBreak: false });
        doc.text('PARTY NAME', ML + 46, currentY + 5, { width: 90, lineBreak: false });
        doc.text('BILL TO', ML + 138, currentY + 5, { width: 90, lineBreak: false });
        doc.text('JOB NO', ML + 230, currentY + 5, { width: 45, lineBreak: false });
        doc.text('CHALLAN NO', ML + 277, currentY + 5, { width: 55, lineBreak: false });
        doc.text('FABRIC QUALITY', ML + 334, currentY + 5, { width: 85, lineBreak: false });
        doc.text('LOT NO', ML + 421, currentY + 5, { width: 35, lineBreak: false });
        doc.text('SHORTAGE', ML + 458, currentY + 5, { width: 35, align: 'center', lineBreak: false });
        doc.text('QTY (MTR)', ML + 495, currentY + 5, { width: 36, align: 'right', lineBreak: false });
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

    // ── 4. DETAILS OF PRINTING JOBCARD (PRINT RUN LOGS) ──
    if (selectedReports.includes('machine') || selectedReports.includes('machine_print') || (typeof detailedPrintLogsList !== 'undefined' && detailedPrintLogsList && detailedPrintLogsList.length > 0)) {
      if (typeof detailedPrintLogsList !== 'undefined' && detailedPrintLogsList && detailedPrintLogsList.length > 0) {
        checkAddPage(60);

        doc.rect(ML, currentY, contentWidth, 20).fill('#ede9fe').stroke('#ddd6fe');
        doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold')
          .text('4. DETAILS OF PRINTING JOBCARD (PRINT RUN LOGS)', ML + 8, currentY + 5, { lineBreak: false });
        doc.fillColor('#5b21b6').fontSize(8.5).font('Helvetica-Bold')
          .text(`Total: ${detailedPrintLogsList.length} Logs (${totalMachinePrintedMtr.toFixed(2)} mtr)`, ML + contentWidth - 220, currentY + 5, { width: 210, align: 'right', lineBreak: false });

        currentY += 24;

        const drawDetailHeaders = () => {
          doc.rect(ML, currentY, contentWidth, 18).fill('#f8fafc').stroke('#cbd5e1');
          doc.fillColor('#000000').fontSize(7.2).font('Helvetica-Bold');
          doc.text('SHIFT', ML + 4, currentY + 5, { width: 35, align: 'center', lineBreak: false });
          doc.text('JOB CARD #', ML + 41, currentY + 5, { width: 65, lineBreak: false });
          doc.text('PARTY / CLIENT', ML + 108, currentY + 5, { width: 105, lineBreak: false });
          doc.text('DESIGN NAME', ML + 215, currentY + 5, { width: 80, lineBreak: false });
          doc.text('MACHINE', ML + 300, currentY + 5, { width: 45, align: 'center', lineBreak: false });
          doc.text('PASS', ML + 347, currentY + 5, { width: 35, align: 'center', lineBreak: false });
          doc.text('METERS PRINTED', ML + 384, currentY + 5, { width: 65, align: 'right', lineBreak: false });
          doc.text('OPERATOR', ML + 451, currentY + 5, { width: 75, lineBreak: false });
          currentY += 18;
        };

        drawDetailHeaders();

        let subtotalMtr = 0;
        detailedPrintLogsList.forEach((log, idx) => {
          if (checkAddPage(18)) {
            drawDetailHeaders();
          }
          const bg = idx % 2 === 0 ? '#ffffff' : '#fcfaff';
          doc.rect(ML, currentY, contentWidth, 18).fill(bg);
          doc.strokeColor('#f1f5f9').lineWidth(0.5).rect(ML, currentY, contentWidth, 18).stroke();

          const cleanJobNo = String(log.jobNo || '').replace(/[^\d]/g, '') || log.jobNo || '—';
          const shiftShort = String(log.shift || '').toLowerCase().includes('morn') ? 'M' :
                            String(log.shift || '').toLowerCase().includes('night') ? 'N' :
                            (log.shift ? log.shift.charAt(0).toUpperCase() : '—');
          const machineShort = String(log.machineName || '').toUpperCase().includes('GRANDO') ? 'G' :
                               String(log.machineName || '').toUpperCase().includes('PRINTDOT') ? 'P' :
                               (log.machineName ? log.machineName.charAt(0).toUpperCase() : '—');
          const passNum = (String(log.pass || '').match(/\d+/) || [log.pass || '1'])[0];

          doc.fillColor('#000000').fontSize(7).font('Helvetica-Bold');
          doc.text(shiftShort, ML + 4, currentY + 4.5, { width: 35, align: 'center', lineBreak: false });

          doc.fillColor('#5b21b6').font('Helvetica-Bold');
          doc.text(cleanJobNo, ML + 41, currentY + 4.5, { width: 65, lineBreak: false });

          doc.fillColor('#000000').font('Helvetica');
          doc.text(log.party || '—', ML + 108, currentY + 4.5, { width: 105, lineBreak: false });
          doc.text(log.design || '—', ML + 215, currentY + 4.5, { width: 80, lineBreak: false });

          doc.fillColor('#000000').font('Helvetica-Bold');
          doc.text(machineShort, ML + 300, currentY + 4.5, { width: 45, align: 'center', lineBreak: false });
          doc.text(passNum, ML + 347, currentY + 4.5, { width: 35, align: 'center', lineBreak: false });

          doc.fillColor('#047857').font('Helvetica-Bold');
          doc.text(`${Number(log.meters || 0).toFixed(2)}`, ML + 384, currentY + 4.5, { width: 65, align: 'right', lineBreak: false });

          doc.fillColor('#334155').font('Helvetica');
          doc.text(log.operatorName || '—', ML + 451, currentY + 4.5, { width: 75, lineBreak: false });

          subtotalMtr += (Number(log.meters) || 0);
          currentY += 18;
        });

        // Detailed Total Row
        if (checkAddPage(20)) {
          drawDetailHeaders();
        }
        doc.rect(ML, currentY, contentWidth, 18).fill('#ede9fe').stroke('#ddd6fe');
        doc.fillColor('#000000').fontSize(7.2).font('Helvetica-Bold');
        doc.text(`GRAND TOTAL PRINTED METERS (${detailedPrintLogsList.length} LOGS):`, ML + 4, currentY + 4.5, { width: 370, lineBreak: false });
        doc.fillColor('#5b21b6').font('Helvetica-Bold');
        doc.text(`${subtotalMtr.toFixed(2)} mtr`, ML + 384, currentY + 4.5, { width: 65, align: 'right', lineBreak: false });
        currentY += 18;
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
        doc.text('FABRIC QUALITY', ML + 4, currentY + 5, { width: 180, lineBreak: false });
        doc.text('TOTAL INWARD (MTR)', ML + 188, currentY + 5, { width: 85, align: 'right', lineBreak: false });
        doc.text('TOTAL OUTWARD (MTR)', ML + 277, currentY + 5, { width: 85, align: 'right', lineBreak: false });
        doc.text('CURRENT STOCK (MTR)', ML + 366, currentY + 5, { width: 85, align: 'right', lineBreak: false });
        doc.text('STOCK STATUS', ML + 455, currentY + 5, { width: 73, align: 'center', lineBreak: false });
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

    // ── 6. EXPENSES & CASH / BANK VOUCHERS REGISTER (COMPLETE DATA) ──
    if (selectedReports.includes('expense') && periodExpenses.length > 0) {
      checkAddPage(60);

      const netExp = totalFundsInward - totalFundsUsed;
      doc.rect(ML, currentY, contentWidth, 20).fill('#f0fdf4').stroke('#bbf7d0');
      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold')
        .text('6. EXPENSES & CASH / BANK VOUCHERS REGISTER', ML + 8, currentY + 5, { lineBreak: false });
      doc.fillColor('#166534').fontSize(8.5).font('Helvetica-Bold')
        .text(`Total: ${periodExpenses.length} Vouchers (In: ${fmtRs(totalFundsInward)} | Out: ${fmtRs(totalFundsUsed)})`, ML + contentWidth - 300, currentY + 5, { width: 290, align: 'right', lineBreak: false });

      currentY += 24;

      const drawExpHeaders = () => {
        doc.rect(ML, currentY, contentWidth, 18).fill('#f8fafc').stroke('#cbd5e1');
        doc.fillColor('#000000').fontSize(7.2).font('Helvetica-Bold');
        doc.text('VOUCHER NO', ML + 4, currentY + 5, { width: 68, lineBreak: false });
        doc.text('DATE', ML + 72, currentY + 5, { width: 48, lineBreak: false });
        doc.text('TYPE', ML + 120, currentY + 5, { width: 32, align: 'center', lineBreak: false });
        doc.text('CATEGORY', ML + 152, currentY + 5, { width: 95, lineBreak: false });
        doc.text('PARTICULARS / PAID TO', ML + 247, currentY + 5, { width: 158, lineBreak: false });
        doc.text('MODE', ML + 405, currentY + 5, { width: 65, lineBreak: false });
        doc.text('AMOUNT (RS.)', ML + 470, currentY + 5, { width: 61, align: 'right', lineBreak: false });
        currentY += 18;
      };

      drawExpHeaders();

      periodExpenses.forEach((e, idx) => {
        if (checkAddPage(20)) {
          drawExpHeaders();
        }
        const bg = idx % 2 === 0 ? '#ffffff' : '#fcfaff';
        doc.rect(ML, currentY, contentWidth, 18).fill(bg);
        doc.strokeColor('#f1f5f9').lineWidth(0.5).rect(ML, currentY, contentWidth, 18).stroke();

        const dStr = e.date ? e.date : '—';
        const isTypeIn = e.type === 'IN';
        const typeColor = isTypeIn ? '#047857' : '#b91c1c';
        const particulars = e.paidToOrReceivedFrom ? `${e.title || ''} (${e.paidToOrReceivedFrom})` : (e.title || '—');

        doc.fillColor('#000000').fontSize(7).font('Helvetica');
        doc.text(e.voucherNo || '—', ML + 4, currentY + 4.5, { width: 68, lineBreak: false });
        doc.text(dStr, ML + 72, currentY + 4.5, { width: 48, lineBreak: false });
        doc.fillColor(typeColor).font('Helvetica-Bold');
        doc.text(e.type || 'OUT', ML + 120, currentY + 4.5, { width: 32, align: 'center', lineBreak: false });
        doc.fillColor('#000000').font('Helvetica');
        doc.text(e.category || 'Miscellaneous', ML + 152, currentY + 4.5, { width: 95, lineBreak: false });
        doc.text(particulars, ML + 247, currentY + 4.5, { width: 158, lineBreak: false });
        doc.text(e.paymentMode || 'Cash', ML + 405, currentY + 4.5, { width: 65, lineBreak: false });
        doc.fillColor(typeColor).font('Helvetica-Bold');
        doc.text(fmtRs(e.amount), ML + 470, currentY + 4.5, { width: 61, align: 'right', lineBreak: false });
        currentY += 18;
      });

      // Total Row for Expense Vouchers
      if (checkAddPage(20)) {
        drawExpHeaders();
      }
      doc.rect(ML, currentY, contentWidth, 18).fill('#f0fdf4').stroke('#bbf7d0');
      doc.fillColor('#000000').fontSize(7.2).font('Helvetica-Bold');
      doc.text(`TOTAL EXPENSE TRANSACTIONS (${periodExpenses.length} VOUCHERS):`, ML + 4, currentY + 4.5, { width: 280, lineBreak: false });
      doc.fillColor('#047857').font('Helvetica-Bold');
      doc.text(`IN: ${fmtRs(totalFundsInward)}`, ML + 285, currentY + 4.5, { width: 90, align: 'right', lineBreak: false });
      doc.fillColor('#b91c1c');
      doc.text(`OUT: ${fmtRs(totalFundsUsed)}`, ML + 375, currentY + 4.5, { width: 85, align: 'right', lineBreak: false });
      doc.fillColor('#1e40af');
      doc.text(`NET: ${fmtRs(netExp)}`, ML + 460, currentY + 4.5, { width: 71, align: 'right', lineBreak: false });
      currentY += 18;

      currentY += 12;
    }

    // ── 7. SALES & BILLING INVOICES REGISTER (COMPLETE DATA) ──
    if (selectedReports.includes('invoice') && periodInvoices.length > 0) {
      checkAddPage(60);

      doc.rect(ML, currentY, contentWidth, 20).fill('#fef3c7').stroke('#fde68a');
      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold')
        .text('7. SALES & BILLING INVOICES REGISTER', ML + 8, currentY + 5, { lineBreak: false });
      doc.fillColor('#92400e').fontSize(8.5).font('Helvetica-Bold')
        .text(`Total: ${periodInvoices.length} Invoices (Billed: ${fmtRs(totalInvBilled)} | Due: ${fmtRs(totalInvDue)})`, ML + contentWidth - 320, currentY + 5, { width: 310, align: 'right', lineBreak: false });

      currentY += 24;

      const drawInvoiceHeaders = () => {
        doc.rect(ML, currentY, contentWidth, 18).fill('#f8fafc').stroke('#cbd5e1');
        doc.fillColor('#000000').fontSize(7.2).font('Helvetica-Bold');
        doc.text('INVOICE NO', ML + 4, currentY + 5, { width: 72, lineBreak: false });
        doc.text('DATE', ML + 76, currentY + 5, { width: 46, lineBreak: false });
        doc.text('CUSTOMER / PARTY NAME', ML + 122, currentY + 5, { width: 147, lineBreak: false });
        doc.text('TAXABLE (RS.)', ML + 269, currentY + 5, { width: 60, align: 'right', lineBreak: false });
        doc.text('GST (RS.)', ML + 329, currentY + 5, { width: 45, align: 'right', lineBreak: false });
        doc.text('TOTAL (RS.)', ML + 374, currentY + 5, { width: 56, align: 'right', lineBreak: false });
        doc.text('PAID (RS.)', ML + 430, currentY + 5, { width: 50, align: 'right', lineBreak: false });
        doc.text('DUE (RS.)', ML + 480, currentY + 5, { width: 51, align: 'right', lineBreak: false });
        currentY += 18;
      };

      drawInvoiceHeaders();

      periodInvoices.forEach((inv, idx) => {
        if (checkAddPage(20)) {
          drawInvoiceHeaders();
        }
        const bg = idx % 2 === 0 ? '#ffffff' : '#fcfaff';
        doc.rect(ML, currentY, contentWidth, 18).fill(bg);
        doc.strokeColor('#f1f5f9').lineWidth(0.5).rect(ML, currentY, contentWidth, 18).stroke();

        const dStr = inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit' }) : '—';
        const partyName = (inv.customer?.businessName || inv.customer?.name || '—').trim();
        const dueVal = Number(inv.balanceDue) || 0;
        const dueColor = dueVal > 0 ? '#b91c1c' : '#047857';

        doc.fillColor('#000000').fontSize(7).font('Helvetica');
        doc.text(inv.invoiceNo || '—', ML + 4, currentY + 4.5, { width: 72, lineBreak: false });
        doc.text(dStr, ML + 76, currentY + 4.5, { width: 46, lineBreak: false });
        doc.text(partyName, ML + 122, currentY + 4.5, { width: 147, lineBreak: false });
        doc.text(`${Number(inv.subtotal || 0).toFixed(0)}`, ML + 269, currentY + 4.5, { width: 60, align: 'right', lineBreak: false });
        doc.text(`${Number(inv.totalTax || 0).toFixed(0)}`, ML + 329, currentY + 4.5, { width: 45, align: 'right', lineBreak: false });
        doc.fillColor('#0f172a').font('Helvetica-Bold');
        doc.text(`${Number(inv.grandTotal || 0).toFixed(0)}`, ML + 374, currentY + 4.5, { width: 56, align: 'right', lineBreak: false });
        doc.fillColor('#047857').font('Helvetica');
        doc.text(`${Number(inv.paidAmount || 0).toFixed(0)}`, ML + 430, currentY + 4.5, { width: 50, align: 'right', lineBreak: false });
        doc.fillColor(dueColor).font('Helvetica-Bold');
        doc.text(`${dueVal.toFixed(0)}`, ML + 480, currentY + 4.5, { width: 51, align: 'right', lineBreak: false });
        currentY += 18;
      });

      // Total Row for Invoices
      if (checkAddPage(20)) {
        drawInvoiceHeaders();
      }
      doc.rect(ML, currentY, contentWidth, 18).fill('#fef3c7').stroke('#fde68a');
      doc.fillColor('#000000').fontSize(7.2).font('Helvetica-Bold');
      doc.text(`TOTAL BILLED REVENUE (${periodInvoices.length} INVOICES):`, ML + 4, currentY + 4.5, { width: 265, lineBreak: false });
      doc.text(`${totalInvTaxable.toFixed(0)}`, ML + 269, currentY + 4.5, { width: 60, align: 'right', lineBreak: false });
      doc.text(`${totalInvTax.toFixed(0)}`, ML + 329, currentY + 4.5, { width: 45, align: 'right', lineBreak: false });
      doc.fillColor('#0f172a');
      doc.text(`${totalInvBilled.toFixed(0)}`, ML + 374, currentY + 4.5, { width: 56, align: 'right', lineBreak: false });
      doc.fillColor('#047857');
      doc.text(`${totalInvPaid.toFixed(0)}`, ML + 430, currentY + 4.5, { width: 50, align: 'right', lineBreak: false });
      doc.fillColor('#b91c1c');
      doc.text(`${totalInvDue.toFixed(0)}`, ML + 480, currentY + 4.5, { width: 51, align: 'right', lineBreak: false });
      currentY += 18;

      currentY += 12;
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

    emitSocketEvent(req, 'fabric-updated', { type: 'adjustment', data: saDoc });

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
    const { date, fabricQuality, panna, sourceLotNo, destLotNo, qty, partyName, notes, department } = req.body;

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

    // Inherit panna, vendor, and department from existing source or destination lot if available
    const existingSource = await FabricTransaction.findOne({ lotNo: sourceLot, type: 'INWARD' }).lean() ||
                           await FabricTransaction.findOne({ lotNo: sourceLot }).lean();
    const existingDest = await FabricTransaction.findOne({ lotNo: destLot, type: 'INWARD' }).lean() ||
                         await FabricTransaction.findOne({ lotNo: destLot }).lean();

    const effectivePanna = panna || existingSource?.panna || existingDest?.panna || '58';
    const effectiveVendor = existingSource?.vendorName || existingDest?.vendorName || '';
    const effectiveDept = department || existingSource?.department || 'digital_print';
    const normFabric = normalizeFabric(fabricQuality, effectivePanna);

    // Determine effective party name (for party clearance)
    let effectiveParty = (partyName || '').trim();
    if (!effectiveParty) {
      const destOut = await FabricTransaction.findOne({ lotNo: destLot, type: 'OUTWARD', partyName: { $exists: true, $ne: '' } }).sort({ date: -1 }).lean();
      const srcOut = await FabricTransaction.findOne({ lotNo: sourceLot, type: 'OUTWARD', partyName: { $exists: true, $ne: '' } }).sort({ date: -1 }).lean();
      effectiveParty = destOut?.partyName || srcOut?.partyName || effectiveVendor || '';
    }

    // Inward vendor challans for source and destination lots
    const destChallan = existingDest?.challanNo && !String(existingDest.challanNo).startsWith('LT-') ? String(existingDest.challanNo).trim() : '';
    const srcChallan = existingSource?.challanNo && !String(existingSource.challanNo).startsWith('LT-') ? String(existingSource.challanNo).trim() : '';

    const destLabel = `Lot #${destLot}${destChallan ? ` (${destChallan})` : ''}`;
    const srcLabel = `Lot #${sourceLot}${srcChallan ? ` (${srcChallan})` : ''}`;

    // 1. OUTWARD from Source Lot
    const outwardTx = new FabricTransaction({
      type: 'OUTWARD',
      date: transferDate,
      fabricQuality: normFabric || fabricQuality,
      panna: effectivePanna,
      vendorName: effectiveVendor,
      partyName: destLabel,
      challanNo: transferRefId,
      lotNo: sourceLot,
      qty: transferQty,
      department: effectiveDept,
      notes: `Lot Transfer to ${destLabel}${notes ? ' | ' + notes : ''} [Ref: ${transferRefId}]`
    });

    // 2. INWARD to Destination Lot
    const inwardTx = new FabricTransaction({
      type: 'INWARD',
      date: transferDate,
      fabricQuality: normFabric || fabricQuality,
      panna: effectivePanna,
      vendorName: srcLabel,
      partyName: srcLabel,
      challanNo: transferRefId,
      lotNo: destLot,
      qty: transferQty,
      department: effectiveDept,
      notes: `Lot Transfer from ${srcLabel}${notes ? ' | ' + notes : ''} [Ref: ${transferRefId}]`
    });

    await outwardTx.save();
    await inwardTx.save();

    emitSocketEvent(req, 'fabric-updated', { type: 'lot-transfer', transferRefId });

    res.status(201).json({
      success: true,
      message: `Successfully transferred ${transferQty}m from Lot #${sourceLot} to Lot #${destLot}`,
      data: { outwardTx, inwardTx, transferRefId, partyName: effectiveParty }
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
          partyName: t.partyName || t.vendorName || '',
          vendorName: t.vendorName || '',
          qty: t.qty,
          sourceLotNo: null,
          destLotNo: null,
          sourceTxId: null,
          destTxId: null,
          notes: t.notes
        });
      }

      const item = transferMap.get(refKey);
      if (t.partyName && !item.partyName) item.partyName = t.partyName;
      if (t.vendorName && !item.vendorName) item.vendorName = t.vendorName;
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

          const effectiveVendor = candidate.vendorName || negLot.vendorName || '';
          const effectiveParty = candidate.partyName || negLot.partyName || effectiveVendor || '';

          const candInward = await FabricTransaction.findOne({ lotNo: candidate.lotNo, type: 'INWARD' }).lean();
          const negInward = await FabricTransaction.findOne({ lotNo: negLot.lotNo, type: 'INWARD' }).lean();

          const candCh = candInward?.challanNo && !String(candInward.challanNo).startsWith('LT-') ? String(candInward.challanNo).trim() : '';
          const negCh = negInward?.challanNo && !String(negInward.challanNo).startsWith('LT-') ? String(negInward.challanNo).trim() : '';

          const candLabel = `Lot #${candidate.lotNo}${candCh ? ` (${candCh})` : ''}`;
          const negLabel = `Lot #${negLot.lotNo}${negCh ? ` (${negCh})` : ''}`;

          const noteMsg = `Auto Lot Rebalance (Fabric + Panna + Party): ${candLabel} -> ${negLabel} [Ref: ${pairRefId}]`;

          // Create OUTWARD from candidate
          const outwardTx = new FabricTransaction({
            type: 'OUTWARD',
            date: now,
            fabricQuality: candidate.fabricQuality,
            panna: candidate.panna || '',
            vendorName: effectiveVendor,
            partyName: negLabel,
            challanNo: pairRefId,
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
            vendorName: candLabel,
            partyName: candLabel,
            challanNo: pairRefId,
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

// ── DELETE /fabric/lot-transfer/:refId ───────────────────────────────────────
const deleteLotTransfer = async (req, res) => {
  try {
    const { refId } = req.params;
    if (!refId) return res.status(400).json({ success: false, error: 'Transfer reference ID required' });

    const cleanRef = decodeURIComponent(refId).trim();
    const result = await FabricTransaction.deleteMany({
      notes: { $regex: cleanRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
    });

    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} transaction record(s) for transfer ${cleanRef}`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting lot transfer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── White Fabric Inward Checking & Defect Logs ──
const WhiteFabricLog = require('../db/models/whiteFabricLog.model');

const getWhiteFabricLogs = async (req, res) => {
  try {
    const { department = 'digital_print' } = req.query;
    const filter = department === 'all' ? {} : { department };
    const logs = await WhiteFabricLog.find(filter).sort({ createdAt: -1, date: -1 });
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const createWhiteFabricLog = async (req, res) => {
  try {
    const body = req.body;
    const log = await WhiteFabricLog.create(body);
    res.json({ success: true, data: log });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteWhiteFabricLog = async (req, res) => {
  try {
    const { id } = req.params;
    await WhiteFabricLog.findByIdAndDelete(id);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
  downloadSingleLotStatementPdf,
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
  deleteLotTransfer,
  getWhiteFabricLogs,
  createWhiteFabricLog,
  deleteWhiteFabricLog,
};
