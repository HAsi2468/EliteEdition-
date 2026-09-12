const RawMaterialTransaction = require('../db/models/rawMaterialTransaction.model');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

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
    const compEntity = req.body.companyEntity || req.query.companyEntity || 'Elite Digital Print';
    if (Array.isArray(req.body)) {
      const docs = req.body.map(item => {
        const { challanNo, vendorName, materialName, qty, unit, date, notes, panna, paperQuality, color, canSize, metersPerRoll, companyEntity } = item;
        if (!materialName || qty == null || qty < 0) {
          throw new Error('Material Name and a valid Quantity are required.');
        }
        return {
          type: 'INWARD',
          companyEntity: companyEntity || compEntity,
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

    const { challanNo, vendorName, materialName, qty, unit, date, notes, panna, paperQuality, color, canSize, metersPerRoll, companyEntity } = req.body;
    
    if (!materialName || qty == null || qty < 0) {
      return res.status(400).json({ success: false, error: 'Material Name and a valid Quantity are required.' });
    }

    const transaction = new RawMaterialTransaction({
      type: 'INWARD',
      companyEntity: companyEntity || compEntity,
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
    const compEntity = req.body.companyEntity || req.query.companyEntity || 'Elite Digital Print';
    if (Array.isArray(req.body)) {
      const docs = req.body.map(item => {
        const { jobNo, partyName, materialName, qty, unit, date, notes, panna, paperQuality, color, canSize, metersPerRoll, companyEntity } = item;
        if (!materialName || qty == null || qty <= 0) {
          throw new Error('Material Name and a valid Quantity (>0) are required.');
        }
        return {
          type: 'OUTWARD',
          companyEntity: companyEntity || compEntity,
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

    const { jobNo, partyName, materialName, qty, unit, date, notes, panna, paperQuality, color, canSize, metersPerRoll, companyEntity } = req.body;
    
    if (!materialName || qty == null || qty <= 0) {
      return res.status(400).json({ success: false, error: 'Material Name and a valid Quantity (>0) are required.' });
    }

    const transaction = new RawMaterialTransaction({
      type: 'OUTWARD',
      companyEntity: companyEntity || compEntity,
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

const buildRawCompFilter = (companyEntity) => {
  if (companyEntity === 'Elite Stitching') {
    return { companyEntity: 'Elite Stitching' };
  }
  return {
    $or: [
      { companyEntity: { $in: ['Elite Digital Print', 'Elite Digital Prints'] } },
      { companyEntity: { $exists: false } },
      { companyEntity: null },
      { companyEntity: '' }
    ]
  };
};

// Get all transactions
const getTransactions = async (req, res) => {
  try {
    const { companyEntity, dateStart, dateEnd } = req.query;
    const filter = buildRawCompFilter(companyEntity);
    if (dateStart || dateEnd) {
      filter.date = {};
      if (dateStart) filter.date.$gte = new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }
    const transactions = await RawMaterialTransaction.find(filter).sort({ date: -1, createdAt: -1 });
    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    console.error('Error fetching raw material transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get current stock overview grouped by material name
const getStockOverview = async (req, res) => {
  try {
    const { companyEntity, dateStart, dateEnd } = req.query;
    const matchStage = buildRawCompFilter(companyEntity);

    if (dateStart || dateEnd) {
      matchStage.date = {};
      if (dateStart) {
        const dsStr = String(dateStart).trim();
        const ds = /^\d{4}-\d{2}-\d{2}$/.test(dsStr) ? new Date(`${dsStr}T00:00:00.000`) : new Date(dateStart);
        if (!isNaN(ds.getTime())) {
          ds.setHours(0, 0, 0, 0);
          matchStage.date.$gte = ds;
        }
      }
      if (dateEnd) {
        const deStr = String(dateEnd).trim();
        const de = /^\d{4}-\d{2}-\d{2}$/.test(deStr) ? new Date(`${deStr}T23:59:59.999`) : new Date(dateEnd);
        if (!isNaN(de.getTime())) {
          de.setHours(23, 59, 59, 999);
          matchStage.date.$lte = de;
        }
      }
    }

    const pipeline = [
      { $match: matchStage },
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
    const { dateStart, dateEnd, materialName, type, companyEntity, search } = req.query;

    const matchStage = buildRawCompFilter(companyEntity);
    if (dateStart || dateEnd) {
      matchStage.date = {};
      if (dateStart) {
        const dsStr = String(dateStart).trim();
        const ds = /^\d{4}-\d{2}-\d{2}$/.test(dsStr) ? new Date(`${dsStr}T00:00:00.000`) : new Date(dateStart);
        if (!isNaN(ds.getTime())) {
          ds.setHours(0, 0, 0, 0);
          matchStage.date.$gte = ds;
        }
      }
      if (dateEnd) {
        const deStr = String(dateEnd).trim();
        const de = /^\d{4}-\d{2}-\d{2}$/.test(deStr) ? new Date(`${deStr}T23:59:59.999`) : new Date(dateEnd);
        if (!isNaN(de.getTime())) {
          de.setHours(23, 59, 59, 999);
          matchStage.date.$lte = de;
        }
      }
    }

    if (type && type !== 'All') {
      matchStage.type = new RegExp('^' + type.trim() + '$', 'i');
    }

    if (materialName && materialName !== 'All') {
      const target = String(materialName).trim();
      const lower = target.toLowerCase();
      if (lower === 'ink' || lower.includes('all inks') || lower === 'all inks') {
        matchStage.materialName = new RegExp('ink', 'i');
      } else if (lower === 'paper' || lower.includes('all papers') || lower === 'all papers') {
        matchStage.materialName = new RegExp('paper', 'i');
      } else if (target !== '') {
        const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        matchStage.materialName = new RegExp(escaped, 'i');
      }
    }

    if (search && String(search).trim()) {
      const sEsc = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const sRegex = new RegExp(sEsc, 'i');
      matchStage.$or = [
        { materialName: sRegex },
        { vendorName: sRegex },
        { partyName: sRegex },
        { challanNo: sRegex },
        { jobNo: sRegex },
        { panna: sRegex },
        { paperQuality: sRegex },
        { color: sRegex },
        { notes: sRegex }
      ];
    }

    const transactions = await RawMaterialTransaction.find(matchStage).sort({ date: 1, createdAt: 1 });

    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=raw-materials-ledger.pdf');
    doc.pipe(res);

    const toSafeText = (val) => {
      if (val == null || val === undefined) return '';
      return String(val)
        .replace(/[—–]/g, '-')
        .replace(/’/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/[^\x00-\x7F]/g, '')
        .trim();
    };

    const digitalLogoPath = path.join(__dirname, 'DigitalLogo.png');
    const logoPath = path.join(__dirname, 'Logo.png');
    const activeLogo = fs.existsSync(digitalLogoPath) ? digitalLogoPath : (fs.existsSync(logoPath) ? logoPath : null);

    const titleType = type && type !== 'All' ? `${type.toUpperCase()} ` : '';
    const compName = companyEntity || 'Elite Digital Print';

    // Header drawing
    if (activeLogo) {
      try {
        doc.image(activeLogo, 40, 22, { width: 105 });
      } catch (e) {
        console.warn('Failed to embed logo in raw material PDF:', e);
      }
    }

    const textX = activeLogo ? 155 : 40;
    const textW = activeLogo ? 400 : 515;

    doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827').text(`${compName}`, textX, 24, { width: textW, align: activeLogo ? 'left' : 'center' });
    doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#374151').text(`Raw Materials ${titleType}Ledger`, textX, 41, { width: textW, align: activeLogo ? 'left' : 'center' });

    const dateLabel = dateStart || dateEnd
      ? `Period: ${dateStart || 'Start'} to ${dateEnd || 'Today'}`
      : 'Period: All Transactions';
    const matLabel = materialName && materialName !== 'All' ? ` | Material: ${materialName}` : '';
    const searchLabel = search ? ` | Search: "${search}"` : '';

    doc.fontSize(8.5).font('Helvetica').fillColor('#6b7280').text(`${dateLabel}${matLabel}${searchLabel}`, textX, 56, { width: textW, align: activeLogo ? 'left' : 'center' });

    doc.moveTo(40, 75).lineTo(555, 75).strokeColor('#d1d5db').lineWidth(0.8).stroke();
    doc.y = 85;

    // Table header configuration
    const colX = [40, 88, 131, 189, 282, 365, 408, 448];
    const colWidths = [45, 40, 55, 90, 80, 40, 37, 107];
    const headers = ['Date', 'Type', 'Challan/Job', 'Material Name', 'Vendor/Party', 'Qty', 'Unit', 'Notes'];

    const renderTableHeader = () => {
      const py = doc.y;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#111827');
      headers.forEach((h, i) => {
        doc.text(h, colX[i], py, { width: colWidths[i], align: i === 5 ? 'right' : 'left' });
      });
      doc.moveDown(0.8);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#9ca3af').lineWidth(0.75).stroke();
      doc.moveDown(0.4);
    };

    renderTableHeader();

    // Rows
    doc.font('Helvetica').fontSize(7);
    let totalIn = 0, totalOut = 0;
    if (transactions.length === 0) {
      doc.fontSize(9).font('Helvetica-Oblique').fillColor('#666666').text('No matching transactions found for the selected filters.', 40, doc.y);
      doc.moveDown(1);
    } else {
      for (const t of transactions) {
        if (doc.y > 730) {
          doc.addPage();
          if (activeLogo) {
            try {
              doc.image(activeLogo, 40, 18, { width: 75 });
            } catch (e) {}
          }
          doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#111827').text(`${compName} - Raw Materials ${titleType}Ledger`, activeLogo ? 125 : 40, 20);
          doc.moveTo(40, 36).lineTo(555, 36).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
          doc.y = 42;
          renderTableHeader();
          doc.font('Helvetica').fontSize(7);
        }

        const isIn = t.type === 'INWARD';
        const qtyNum = Number(t.qty || 0);
        if (isIn) totalIn += qtyNum; else totalOut += qtyNum;

        const dateStr = t.date ? new Date(t.date).toLocaleDateString('en-IN') : '-';
        const row = [
          toSafeText(dateStr) || '-',
          toSafeText(t.type) || '-',
          toSafeText(isIn ? (t.challanNo || '-') : (t.jobNo || '-')) || '-',
          toSafeText(formatMaterialDetails(t)) || '-',
          toSafeText(isIn ? (t.vendorName || '-') : (t.partyName || '-')) || '-',
          toSafeText(`${isIn ? '+' : '-'}${qtyNum}`) || '-',
          toSafeText(t.unit) || '-',
          toSafeText(t.notes) || '-'
        ];

        const startY = doc.y;
        let maxHeight = 0;

        row.forEach((cell, i) => {
          doc.fillColor(isIn ? '#1a472a' : '#7f1d1d');
          const opts = { width: colWidths[i], align: i === 5 ? 'right' : 'left' };
          doc.text(String(cell), colX[i], startY, opts);
          const cellH = doc.heightOfString(String(cell), opts);
          if (cellH > maxHeight) maxHeight = cellH;
        });

        doc.y = startY + maxHeight + 3;
      }
    }

    // Summary
    if (doc.y > 700) doc.addPage();
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('black');
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
