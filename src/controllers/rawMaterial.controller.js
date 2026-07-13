const RawMaterialTransaction = require('../db/models/rawMaterialTransaction.model');
const PDFDocument = require('pdfkit');

const formatMaterialDetails = (t) => {
  if (!t.materialName) return '-';
  const nameLower = t.materialName.toLowerCase();
  if (nameLower.includes('sublimation')) {
    const details = [];
    if (t.panna) details.push(`Panna: ${t.panna}`);
    if (t.paperQuality) details.push(`Qual: ${t.paperQuality}`);
    if (t.metersPerRoll) details.push(`${t.metersPerRoll}m`);
    return details.length > 0 ? `${t.materialName} (${details.join(', ')})` : t.materialName;
  } else if (nameLower.includes('butter')) {
    const details = [];
    if (t.panna) details.push(`Panna: ${t.panna}`);
    if (t.metersPerRoll) details.push(`${t.metersPerRoll}m`);
    return details.length > 0 ? `${t.materialName} (${details.join(', ')})` : t.materialName;
  } else if (nameLower.includes('ink')) {
    const details = [];
    if (t.color) details.push(t.color);
    if (t.canSize) details.push(`${t.canSize} Ltr`);
    return details.length > 0 ? `${t.materialName} - ${details.join(' ')}` : t.materialName;
  }
  return t.materialName;
};

// Create a new INWARD transaction
const createInward = async (req, res) => {
  try {
    if (Array.isArray(req.body)) {
      const docs = req.body.map(item => {
        const { challanNo, vendorName, materialName, qty, unit, date, notes, panna, paperQuality, color, canSize, metersPerRoll } = item;
        if (!materialName || qty == null || qty < 0) {
          throw new Error('Material Name and a valid Quantity are required.');
        }
        return {
          type: 'INWARD',
          challanNo,
          vendorName,
          materialName,
          qty,
          unit: unit || 'Rolls',
          date: date ? new Date(date) : new Date(),
          notes,
          panna,
          paperQuality,
          color,
          canSize,
          metersPerRoll
        };
      });
      const transactions = await RawMaterialTransaction.insertMany(docs);
      return res.status(201).json({ success: true, data: transactions });
    }

    const { challanNo, vendorName, materialName, qty, unit, date, notes, panna, paperQuality, color, canSize, metersPerRoll } = req.body;
    
    if (!materialName || qty == null || qty < 0) {
      return res.status(400).json({ success: false, error: 'Material Name and a valid Quantity are required.' });
    }

    const transaction = new RawMaterialTransaction({
      type: 'INWARD',
      challanNo,
      vendorName,
      materialName,
      qty,
      unit: unit || 'Rolls',
      date: date ? new Date(date) : new Date(),
      notes,
      panna,
      paperQuality,
      color,
      canSize,
      metersPerRoll
    });

    await transaction.save();
    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    console.error('Error creating inward raw material transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create a new OUTWARD transaction
const createOutward = async (req, res) => {
  try {
    if (Array.isArray(req.body)) {
      const docs = req.body.map(item => {
        const { jobNo, partyName, materialName, qty, unit, date, notes, panna, paperQuality, color, canSize, metersPerRoll } = item;
        if (!materialName || qty == null || qty <= 0) {
          throw new Error('Material Name and a valid Quantity (>0) are required.');
        }
        return {
          type: 'OUTWARD',
          jobNo,
          partyName,
          materialName,
          qty,
          unit: unit || 'Rolls',
          date: date ? new Date(date) : new Date(),
          notes,
          panna,
          paperQuality,
          color,
          canSize,
          metersPerRoll
        };
      });
      const transactions = await RawMaterialTransaction.insertMany(docs);
      return res.status(201).json({ success: true, data: transactions });
    }

    const { jobNo, partyName, materialName, qty, unit, date, notes, panna, paperQuality, color, canSize, metersPerRoll } = req.body;
    
    if (!materialName || qty == null || qty <= 0) {
      return res.status(400).json({ success: false, error: 'Material Name and a valid Quantity (>0) are required.' });
    }

    const transaction = new RawMaterialTransaction({
      type: 'OUTWARD',
      jobNo,
      partyName,
      materialName,
      qty,
      unit: unit || 'Rolls',
      date: date ? new Date(date) : new Date(),
      notes,
      panna,
      paperQuality,
      color,
      canSize,
      metersPerRoll
    });

    await transaction.save();
    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    console.error('Error creating outward raw material transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get all transactions
const getTransactions = async (req, res) => {
  try {
    const transactions = await RawMaterialTransaction.find().sort({ date: -1, createdAt: -1 });
    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    console.error('Error fetching raw material transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get current stock overview grouped by material name
const getStockOverview = async (req, res) => {
  try {
    const pipeline = [
      {
        $group: {
          _id: {
            materialName: '$materialName',
            panna: '$panna',
            paperQuality: '$paperQuality',
            color: '$color',
            canSize: '$canSize',
            metersPerRoll: '$metersPerRoll'
          },
          totalInward: {
            $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] }
          },
          totalOutward: {
            $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] }
          },
          unit: { $first: '$unit' } // Get unit label
        }
      },
      {
        $project: {
          materialName: '$_id.materialName',
          panna: '$_id.panna',
          paperQuality: '$_id.paperQuality',
          color: '$_id.color',
          canSize: '$_id.canSize',
          metersPerRoll: '$_id.metersPerRoll',
          totalInward: 1,
          totalOutward: 1,
          currentStock: { $subtract: ['$totalInward', '$totalOutward'] },
          unit: 1,
          _id: 0
        }
      },
      {
        $sort: { materialName: 1, panna: 1, paperQuality: 1, color: 1 }
      }
    ];

    const stock = await RawMaterialTransaction.aggregate(pipeline);
    res.status(200).json({ success: true, data: stock });
  } catch (error) {
    console.error('Error calculating raw material stock:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete a single transaction by ID
const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await RawMaterialTransaction.findByIdAndDelete(id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Transaction not found.' });
    }
    res.status(200).json({ success: true, message: 'Transaction deleted successfully.' });
  } catch (error) {
    console.error('Error deleting raw material transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Generate Raw Material Ledger PDF
const downloadLedgerPdf = async (req, res) => {
  try {
    const { dateStart, dateEnd, materialName } = req.query;

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
    if (materialName) {
      matchStage.materialName = new RegExp(`^${materialName.trim()}$`, 'i');
    }

    const transactions = await RawMaterialTransaction.find(matchStage).sort({ date: 1 });

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=raw-materials-ledger.pdf');
    doc.pipe(res);

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text('Elite Digital Print — Raw Materials Ledger', { align: 'center' });
    doc.moveDown(0.3);
    const dateLabel = dateStart || dateEnd
      ? `Period: ${dateStart || 'Start'} to ${dateEnd || 'Today'}`
      : 'All Transactions';
    doc.fontSize(10).font('Helvetica').text(dateLabel, { align: 'center' });
    if (materialName) {
      doc.text(`Material: ${materialName}`, { align: 'center' });
    }
    doc.moveDown(1);

    // Table header
    const colX = [40, 95, 155, 230, 320, 395, 475];
    const headers = ['Date', 'Type', 'Challan/Job', 'Material Name', 'Vendor/Party', 'Qty', 'Unit'];
    doc.fontSize(8).font('Helvetica-Bold');
    headers.forEach((h, i) => doc.text(h, colX[i], doc.y, { width: colX[i + 1] ? colX[i + 1] - colX[i] - 2 : 75, continued: i < headers.length - 1 }));
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
        t.type,
        isIn ? (t.challanNo || '-') : (t.jobNo || '-'),
        formatMaterialDetails(t),
        isIn ? (t.vendorName || '-') : (t.partyName || '-'),
        `${isIn ? '+' : '-'}${t.qty}`,
        t.unit || '-'
      ];
      row.forEach((cell, i) => {
        doc.fillColor(isIn ? '#1a472a' : '#7f1d1d').text(String(cell), colX[i], doc.y, {
          width: colX[i + 1] ? colX[i + 1] - colX[i] - 2 : 75,
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
    doc.text(`Total Inward: +${totalIn}`, 40);
    doc.text(`Total Outward: -${totalOut}`);
    doc.text(`Net Stock Change: ${totalIn - totalOut}`);

    doc.end();
  } catch (error) {
    console.error('Error generating raw materials ledger PDF:', error);
    if (!res.headersSent) res.status(500).json({ success: false, error: error.message });
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
      const materialName = String(row.materialName || '').trim();
      if (!materialName) continue;

      const panna = String(row.panna || '').trim();
      const paperQuality = String(row.paperQuality || '').trim();
      const color = String(row.color || '').trim();
      const canSize = row.canSize !== undefined && row.canSize !== null && row.canSize !== '' ? parseFloat(row.canSize) : null;
      const metersPerRoll = row.metersPerRoll !== undefined && row.metersPerRoll !== null && row.metersPerRoll !== '' ? parseFloat(row.metersPerRoll) : null;

      // Construct a query to match exact material specifications
      const query = {
        materialName: new RegExp(`^${materialName}$`, 'i')
      };

      if (panna) {
        query.panna = new RegExp(`^${panna}$`, 'i');
      } else {
        query.panna = { $in: [null, '', undefined] };
      }

      if (paperQuality) {
        query.paperQuality = new RegExp(`^${paperQuality}$`, 'i');
      } else {
        query.paperQuality = { $in: [null, '', undefined] };
      }

      if (color) {
        query.color = new RegExp(`^${color}$`, 'i');
      } else {
        query.color = { $in: [null, '', undefined] };
      }

      if (canSize !== null && !isNaN(canSize)) {
        query.canSize = canSize;
      } else {
        query.canSize = { $in: [null, undefined] };
      }

      if (metersPerRoll !== null && !isNaN(metersPerRoll)) {
        query.metersPerRoll = metersPerRoll;
      } else {
        query.metersPerRoll = { $in: [null, undefined] };
      }

      const txs = await RawMaterialTransaction.find(query);

      let dbOpeningStock = 0;
      let dbInward = 0;
      let dbOutward = 0;
      let dbUnit = 'Rolls'; // default

      txs.forEach(t => {
        const tDate = new Date(t.date);
        const isPrev = tDate < startOfMonth;
        const isAdj = t.notes && t.notes.includes('Adjustment');

        if (t.unit) dbUnit = t.unit;

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
          const t = new RawMaterialTransaction({
            type: diff > 0 ? 'INWARD' : 'OUTWARD',
            materialName,
            panna,
            paperQuality,
            color,
            canSize,
            metersPerRoll,
            unit: dbUnit,
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
          const t = new RawMaterialTransaction({
            type: diff > 0 ? 'INWARD' : 'OUTWARD',
            materialName,
            panna,
            paperQuality,
            color,
            canSize,
            metersPerRoll,
            unit: dbUnit,
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
          const t = new RawMaterialTransaction({
            type: diff > 0 ? 'OUTWARD' : 'INWARD',
            materialName,
            panna,
            paperQuality,
            color,
            canSize,
            metersPerRoll,
            unit: dbUnit,
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
          const t = new RawMaterialTransaction({
            type: diff > 0 ? 'INWARD' : 'OUTWARD',
            materialName,
            panna,
            paperQuality,
            color,
            canSize,
            metersPerRoll,
            unit: dbUnit,
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

    res.status(200).json({ success: true, message: `Raw Material stock import completed. Created ${createdTransactions.length} adjustment records.`, count: createdTransactions.length });
  } catch (error) {
    console.error('Error in importStock for raw materials:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update a transaction by ID
const updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { challanNo, vendorName, materialName, panna, qty, date, notes, jobNo, partyName, paperQuality, color, canSize, metersPerRoll, unit } = req.body;

    const RawMaterialTransaction = require('../db/models/rawMaterialTransaction.model');
    const transaction = await RawMaterialTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found.' });
    }

    // Update fields
    if (challanNo !== undefined) transaction.challanNo = challanNo;
    if (vendorName !== undefined) transaction.vendorName = vendorName;
    if (materialName !== undefined) transaction.materialName = materialName;
    if (panna !== undefined) transaction.panna = panna;
    if (qty !== undefined) transaction.qty = qty;
    if (date !== undefined) transaction.date = new Date(date);
    if (notes !== undefined) transaction.notes = notes;
    if (jobNo !== undefined) transaction.jobNo = jobNo;
    if (partyName !== undefined) transaction.partyName = partyName;
    if (paperQuality !== undefined) transaction.paperQuality = paperQuality;
    if (color !== undefined) transaction.color = color;
    if (canSize !== undefined) transaction.canSize = canSize ? Number(canSize) : undefined;
    if (metersPerRoll !== undefined) transaction.metersPerRoll = metersPerRoll ? Number(metersPerRoll) : undefined;
    if (unit !== undefined) transaction.unit = unit;

    await transaction.save();
    res.status(200).json({ success: true, data: transaction });
  } catch (error) {
    console.error('Error updating raw material transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  createInward,
  createOutward,
  getTransactions,
  getStockOverview,
  deleteTransaction,
  updateTransaction,
  downloadLedgerPdf,
  importStock
};
