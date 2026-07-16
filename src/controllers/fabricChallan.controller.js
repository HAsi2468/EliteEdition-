const FabricChallan = require('../db/models/fabricChallan.model');
const FabricTransaction = require('../db/models/fabricTransaction.model');
const JobCard = require('../db/models/jobCard.model');

// ── Helper: compute totals from tpDetails ──────────────────────────────────
function computeTotals(tpDetails = []) {
  let totalMtr = 0;
  let totalTp = 0;
  for (const tp of tpDetails) {
    const m = parseFloat(tp.tpMeter) || 0;
    if (m > 0) {
      totalMtr += m;
      totalTp += 1;
    }
  }
  return { totalMtr: parseFloat(totalMtr.toFixed(3)), totalTp };
}

// ── GET /fabric-challan/next-no ────────────────────────────────────────────
const getNextChallanNo = async (req, res) => {
  try {
    const last = await FabricChallan.findOne({}, 'challanNo').sort({ challanNo: -1 });
    const next = last && last.challanNo ? last.challanNo + 1 : 1;
    res.json({ success: true, nextNo: next });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── GET /fabric-challan/lot-info/:lotNo ───────────────────────────────────
// Returns inward transaction details for a given lot number
const getLotInfo = async (req, res) => {
  try {
    const lotNo = parseInt(req.params.lotNo);
    if (isNaN(lotNo)) {
      return res.status(400).json({ success: false, error: 'Invalid lot number' });
    }
    const tx = await FabricTransaction.findOne({ type: 'INWARD', lotNo });
    if (!tx) {
      return res.status(404).json({ success: false, error: 'Lot not found' });
    }
    res.json({
      success: true,
      data: {
        lotNo: tx.lotNo,
        vendorChallanNo: tx.challanNo || '',
        fabricName: tx.fabricQuality || '',
        shortagePct: tx.shortagePct != null ? tx.shortagePct : null,
        panna: tx.panna || '',
        vendorName: tx.vendorName || '',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Helper: compute raw meters from fresh meters + shortage % ──────────────
function computeRawMeters(totalMtr, shortagePct) {
  const mtr = parseFloat(totalMtr) || 0;
  const pct = parseFloat(shortagePct) || 0;
  // Raw = fresh meters + shortage
  // e.g. 100 mtr + 5% shortage = 105 raw meters consumed from stock
  return parseFloat((mtr * (1 + pct / 100)).toFixed(3));
}

// ── Helper: safely extract first lot number from a lot string ──────────────
function parseLotNo(lotStr) {
  if (!lotStr) return undefined;
  const match = String(lotStr).match(/\d+/);
  if (match) {
    const val = parseInt(match[0], 10);
    return isNaN(val) ? undefined : val;
  }
  return undefined;
}

// ── POST /fabric-challan ───────────────────────────────────────────────────
const createChallan = async (req, res) => {
  try {
    const {
      date, partyName,
      lotNo, vendorChallanNo, fabricName, shortagePct,
      jobNo, designNo, colour, panna,
      tpDetails, pcs,
      notes, createdBy,
      billTo, shipTo,
    } = req.body;

    const details = Array.isArray(tpDetails) ? tpDetails : [];
    const { totalMtr, totalTp } = computeTotals(details);

    const challan = new FabricChallan({
      date: date ? new Date(date) : new Date(),
      partyName: partyName || '',
      lotNo: lotNo ? String(lotNo) : '',
      vendorChallanNo: vendorChallanNo || '',
      fabricName: fabricName || '',
      shortagePct: shortagePct !== '' && shortagePct != null ? parseFloat(shortagePct) : null,
      jobNo: jobNo || '',
      designNo: designNo || '',
      colour: colour || '',
      panna: panna || '',
      tpDetails: details,
      totalMtr,
      totalTp,
      pcs: pcs !== '' && pcs != null ? parseInt(pcs) : 0,
      billTo: billTo || '',
      shipTo: shipTo || '',
      notes: notes || '',
      createdBy: createdBy || '',
    });

    await challan.save();

    // ── Auto-create OUTWARD fabric transactions (lot-wise) ──────────────
    if (fabricName && totalMtr > 0) {
      try {
        // Group tpDetails by lotNo
        const lotGroups = {};
        for (const tp of details) {
          const m = parseFloat(tp.tpMeter) || 0;
          if (m > 0) {
            // If row has lotNo, use it, otherwise fall back to parent lotNo
            let itemLot = (tp.lotNo || '').trim();
            if (!itemLot) {
              itemLot = (lotNo || '').trim();
            }
            if (!lotGroups[itemLot]) {
              lotGroups[itemLot] = 0;
            }
            lotGroups[itemLot] += m;
          }
        }

        const createdTxIds = [];
        for (const [lot, groupMtr] of Object.entries(lotGroups)) {
          const rawMtr = computeRawMeters(groupMtr, challan.shortagePct);
          const outwardTx = new FabricTransaction({
            type: 'OUTWARD',
            fabricQuality: fabricName,
            panna: panna || '',
            lotNo: parseLotNo(lot),
            qty: rawMtr,
            date: challan.date,
            jobNo: jobNo || '',
            partyName: partyName || '',
            challanNo: 'EDP-' + challan.challanNo,
            notes: `Auto: EDP-${challan.challanNo} | Lot #${lot || 'N/A'} | Fresh=${groupMtr}m + ${challan.shortagePct || 0}% shortage = ${rawMtr}m raw`,
          });
          await outwardTx.save();
          createdTxIds.push(outwardTx._id);
        }
        challan.fabricOutwardIds = createdTxIds;
        await challan.save();
      } catch (txErr) {
        console.error('Warning: Failed to auto-create fabric outward transactions:', txErr.message);
      }
    }

    res.status(201).json({ success: true, data: challan });
  } catch (error) {
    console.error('Error creating fabric challan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── GET /fabric-challan ────────────────────────────────────────────────────
const getChallans = async (req, res) => {
  try {
    const { dateStart, dateEnd, search, page = 1, limit = 200 } = req.query;
    const filter = {};

    if (dateStart || dateEnd) {
      filter.date = {};
      if (dateStart) filter.date.$gte = new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [
        { partyName: re },
        { fabricName: re },
        { jobNo: re },
        { designNo: re },
        { colour: re },
      ];
    }

    const challans = await FabricChallan.find(filter)
      .sort({ challanNo: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, data: challans });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── PUT /fabric-challan/:id ────────────────────────────────────────────────
const updateChallan = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      date, partyName,
      lotNo, vendorChallanNo, fabricName, shortagePct,
      jobNo, designNo, colour, panna,
      tpDetails, pcs, notes,
      billTo, shipTo,
    } = req.body;

    const challan = await FabricChallan.findById(id);
    if (!challan) {
      return res.status(404).json({ success: false, error: 'Challan not found' });
    }

    if (date !== undefined) challan.date = new Date(date);
    if (partyName !== undefined) challan.partyName = partyName;
    if (lotNo !== undefined) challan.lotNo = lotNo ? String(lotNo) : '';
    if (vendorChallanNo !== undefined) challan.vendorChallanNo = vendorChallanNo;
    if (fabricName !== undefined) challan.fabricName = fabricName;
    if (shortagePct !== undefined) challan.shortagePct = shortagePct !== '' && shortagePct != null ? parseFloat(shortagePct) : null;
    if (jobNo !== undefined) challan.jobNo = jobNo;
    if (designNo !== undefined) challan.designNo = designNo;
    if (colour !== undefined) challan.colour = colour;
    if (panna !== undefined) challan.panna = panna;
    if (pcs !== undefined) challan.pcs = pcs !== '' && pcs != null ? parseInt(pcs) : 0;
    if (billTo !== undefined) challan.billTo = billTo;
    if (shipTo !== undefined) challan.shipTo = shipTo;
    if (notes !== undefined) challan.notes = notes;

    if (tpDetails !== undefined) {
      const details = Array.isArray(tpDetails) ? tpDetails : [];
      const { totalMtr, totalTp } = computeTotals(details);
      challan.tpDetails = details;
      challan.totalMtr = totalMtr;
      challan.totalTp = totalTp;
    }

    await challan.save();

    // ── Sync OUTWARD fabric transactions: delete old, create new ──────────────
    try {
      // Delete old single outward link if exists (backwards compatibility)
      if (challan.fabricOutwardId) {
        await FabricTransaction.findByIdAndDelete(challan.fabricOutwardId);
        challan.fabricOutwardId = null;
      }
      // Delete all old lot-wise outward links
      if (challan.fabricOutwardIds && challan.fabricOutwardIds.length > 0) {
        for (const txId of challan.fabricOutwardIds) {
          await FabricTransaction.findByIdAndDelete(txId);
        }
        challan.fabricOutwardIds = [];
      }

      if (challan.fabricName && challan.totalMtr > 0) {
        // Group tpDetails by lotNo
        const lotGroups = {};
        for (const tp of challan.tpDetails) {
          const m = parseFloat(tp.tpMeter) || 0;
          if (m > 0) {
            let itemLot = (tp.lotNo || '').trim();
            if (!itemLot) {
              itemLot = (challan.lotNo || '').trim();
            }
            if (!lotGroups[itemLot]) {
              lotGroups[itemLot] = 0;
            }
            lotGroups[itemLot] += m;
          }
        }

        const createdTxIds = [];
        for (const [lot, groupMtr] of Object.entries(lotGroups)) {
          const rawMtr = computeRawMeters(groupMtr, challan.shortagePct);
          const outwardTx = new FabricTransaction({
            type: 'OUTWARD',
            fabricQuality: challan.fabricName,
            panna: challan.panna || '',
            lotNo: parseLotNo(lot),
            qty: rawMtr,
            date: challan.date,
            jobNo: challan.jobNo || '',
            partyName: challan.partyName || '',
            challanNo: 'EDP-' + challan.challanNo,
            notes: `Auto: EDP-${challan.challanNo} | Lot #${lot || 'N/A'} | Fresh=${groupMtr}m + ${challan.shortagePct || 0}% shortage = ${rawMtr}m raw`,
          });
          await outwardTx.save();
          createdTxIds.push(outwardTx._id);
        }
        challan.fabricOutwardIds = createdTxIds;
        await challan.save();
      }
    } catch (txErr) {
      console.error('Warning: Failed to sync fabric outward transactions on update:', txErr.message);
    }

    res.json({ success: true, data: challan });
  } catch (error) {
    console.error('Error updating fabric challan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── DELETE /fabric-challan/:id ─────────────────────────────────────────────
const deleteChallan = async (req, res) => {
  try {
    const challan = await FabricChallan.findById(req.params.id);
    if (!challan) {
      return res.status(404).json({ success: false, error: 'Challan not found' });
    }

    // Remove the linked outward fabric transactions first
    if (challan.fabricOutwardId) {
      try {
        await FabricTransaction.findByIdAndDelete(challan.fabricOutwardId);
      } catch (txErr) {
        console.error('Warning: Failed to delete linked fabric outward:', txErr.message);
      }
    }
    if (challan.fabricOutwardIds && challan.fabricOutwardIds.length > 0) {
      for (const txId of challan.fabricOutwardIds) {
        try {
          await FabricTransaction.findByIdAndDelete(txId);
        } catch (txErr) {
          console.error('Warning: Failed to delete linked fabric outward:', txErr.message);
        }
      }
    }

    await FabricChallan.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Challan and linked fabric outward deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── GET /fabric-challan/:id/pdf ───────────────────────────────────────────
const downloadChallanPdf = async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const path = require('path');
    const fs = require('fs');

    const challan = await FabricChallan.findById(req.params.id).lean();
    if (!challan) {
      return res.status(404).json({ error: 'Challan not found' });
    }

    const doc = new PDFDocument({ margin: 28, size: 'A4', autoFirstPage: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="EDP-${challan.challanNo || 'preview'}.pdf"`);
    doc.pipe(res);

    const PW = 595, PH = 842, ML = 45, MR = 28;
    const contentWidth = PW - ML - MR;

    doc.strokeColor('#0000ff').lineWidth(1).rect(ML, MR, contentWidth, PH - 2 * MR).stroke();

    doc.fillColor('#0000ff').fontSize(10.5).font('Helvetica')
      .text('Subject to SURAT Jurisdiction', ML + 12, MR + 4, { lineBreak: false });
    doc.fillColor('#0000ff').fontSize(10.5).font('Helvetica-Bold')
      .text('|| Shree Ganeshay Namah ||', ML, MR + 4, { width: contentWidth, align: 'center', lineBreak: false });
    doc.fillColor('#0000ff').fontSize(10.5).font('Helvetica')
      .text('Mo. +91 99098 66667', ML, MR + 4, { width: contentWidth - 12, align: 'right', lineBreak: false });

    doc.strokeColor('#0000ff').lineWidth(0.5)
      .moveTo(ML, MR + 14).lineTo(PW - MR, MR + 14).stroke();

    let billTo = challan.billTo || '';
    let shipTo = challan.shipTo || '';
    if (!billTo || !shipTo) {
      if (challan.jobNo) {
        try {
          const job = await JobCard.findOne({ jobNo: challan.jobNo });
          if (job) {
            if (!billTo) billTo = job.billTo || '';
            if (!shipTo) shipTo = job.shipTo || '';
          }
        } catch (e) {
          console.warn('Failed to find job card info', e);
        }
      }
    }
    if (!billTo) billTo = '—';
    if (!shipTo) shipTo = '—';

    // All fabric challans are Elite Digital Prints (EDP-xxx), so always use black EDP logo
    const selectedLogoName = 'Logo.png';

    const logoPath = path.join(__dirname, selectedLogoName);
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, ML + (contentWidth - 140) / 2, MR + 16, { width: 140 });
    }

    doc.fillColor('#0000ff').fontSize(10.5).font('Helvetica-Bold')
      .text('GROUND FLOOR, PLOT NO-B/37, Siddheshwar Society, Puna Kumbariya Road, NR. KALAPUL, Punagam, Surat, Surat, Gujarat, 395010', ML, MR + 60, { width: contentWidth, align: 'center', lineBreak: false });

    doc.strokeColor('#0000ff').lineWidth(0.8)
      .moveTo(ML, MR + 88).lineTo(PW - MR, MR + 88).stroke();

    const formattedDate = challan.date ? new Date(challan.date).toLocaleDateString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }) : '—';

    if (fs.existsSync(logoPath)) {
      doc.save();
      doc.opacity(0.10);
      doc.image(logoPath, ML + (contentWidth - 300) / 2, (PH - 300) / 2, { width: 300, height: 300 });
      doc.restore();
    }

    const startY = MR + 92;

    doc.fillColor('#0000ff').fontSize(12.5).font('Helvetica-Bold')
      .text('M/s:', ML + 12, startY + 6, { lineBreak: false });
    doc.fillColor('#0f172a').fontSize(14.5).font('Helvetica-Bold')
      .text(challan.partyName || '—', ML + 42, startY + 4, { lineBreak: false });
      
    doc.fillColor('#0000ff').fontSize(12.5).font('Helvetica-Bold')
      .text('Ch.no.:', PW - MR - 175, startY + 6, { width: 90, align: 'right', lineBreak: false });
    doc.fillColor('#dc2626').fontSize(15).font('Helvetica-Bold')
      .text('EDP-' + (challan.challanNo || '—'), PW - MR - 80, startY + 4, { width: 80, align: 'left', lineBreak: false });

    doc.fillColor('#0000ff').fontSize(12.5).font('Helvetica-Bold')
      .text('Date:', PW - MR - 175, startY + 17, { width: 90, align: 'right', lineBreak: false });
    doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold')
      .text(formattedDate, PW - MR - 80, startY + 17, { width: 80, align: 'left', lineBreak: false });

    doc.strokeColor('#0000ff').lineWidth(0.6)
      .moveTo(ML, startY + 28).lineTo(PW - MR, startY + 28).stroke();

    function renderField(label, value, x, y, width, height) {
      doc.strokeColor('#0000ff').lineWidth(0.5)
        .rect(x, y, width, height).stroke();

      doc.fillColor('#0000ff').fontSize(10.5).font('Helvetica-Bold')
        .text(label.toUpperCase(), x + 10, y + 5, { width: width - 20, align: 'left', lineBreak: false });

      doc.fillColor('#0f172a').fontSize(12.5).font('Helvetica-Bold')
        .text(String(value || '—'), x + 10, y + 17, { width: width - 20, align: 'left', lineBreak: false });
    }

    const billStartY = startY + 28;
    const halfWidth = contentWidth / 2;
    renderField('Bill to', billTo, ML, billStartY, halfWidth, 34);
    renderField('Ship to', shipTo, ML + halfWidth, billStartY, halfWidth, 34);

    const gridStartY = billStartY + 34;
    const colWidth4 = contentWidth / 4;

    renderField('Job No.', challan.jobNo, ML, gridStartY, colWidth4, 34);
    renderField('Design No.', challan.designNo, ML + colWidth4, gridStartY, colWidth4, 34);
    renderField('Lot No.', challan.lotNo ? `#${challan.lotNo}` : '—', ML + colWidth4 * 2, gridStartY, colWidth4, 34);
    renderField('Panno', challan.panna, ML + colWidth4 * 3, gridStartY, colWidth4, 34);

    renderField('Colour', challan.colour, ML, gridStartY + 34, colWidth4, 34);
    renderField('Fabric', challan.fabricName, ML + colWidth4, gridStartY + 34, colWidth4, 34);
    renderField('Vendor Challan', challan.vendorChallanNo, ML + colWidth4 * 2, gridStartY + 34, colWidth4 * 2, 34);

    const tpSectionY = gridStartY + 68 + 12;
    doc.fillColor('#0000ff').fontSize(13).font('Helvetica-Bold')
      .text('TP Details', ML + 16, tpSectionY, { lineBreak: false });

    const activeTps = (challan.tpDetails || [])
      .filter(tp => tp.tpMeter != null && parseFloat(tp.tpMeter) > 0);

    const activeCount = activeTps.length;
    const tpColsCount = activeCount === 0 ? 1 : activeCount <= 5 ? 1 : activeCount <= 10 ? 2 : 3;
    const tpColWidth = contentWidth / tpColsCount;
    const tpRowHeight = 26;
    const tableHeaderHeight = 26;
    const tpTableStartY = tpSectionY + 16;

    for (let c = 0; c < tpColsCount; c++) {
      const x = ML + c * tpColWidth;
      doc.rect(x, tpTableStartY, tpColWidth, tableHeaderHeight).fill('#f8fafc');
      doc.strokeColor('#0000ff').lineWidth(0.5).rect(x, tpTableStartY, tpColWidth, tableHeaderHeight).stroke();
      
      doc.fillColor('#0000ff').fontSize(12).font('Helvetica-Bold')
        .text('TP NO.', x, tpTableStartY + 7, { width: tpColWidth * 0.35, align: 'center' });
      doc.text('METRES', x + tpColWidth * 0.35, tpTableStartY + 7, { width: tpColWidth * 0.65, align: 'center' });
    }

    const rowsPerCol = Math.ceil(activeCount / tpColsCount);

    if (activeCount === 0) {
      const x = ML;
      const y = tpTableStartY + tableHeaderHeight;
      doc.strokeColor('#0000ff').lineWidth(0.5).rect(x, y, contentWidth, tpRowHeight).stroke();
      doc.fillColor('#0000ff').fontSize(12.5).font('Helvetica-Oblique')
        .text('No active TP details entered.', x, y + 7, { width: contentWidth, align: 'center' });
    } else {
      for (let i = 0; i < activeCount; i++) {
        const tp = activeTps[i];
        const colIndex = i % tpColsCount;
        const rowIndex = Math.floor(i / tpColsCount);

        const x = ML + colIndex * tpColWidth;
        const y = tpTableStartY + tableHeaderHeight + rowIndex * tpRowHeight;

        doc.strokeColor('#0000ff').lineWidth(0.5).rect(x, y, tpColWidth, tpRowHeight).stroke();

        const val = `${parseFloat(tp.tpMeter).toFixed(2)} mtr`;

        doc.fillColor('#0000ff').fontSize(12.5).font('Helvetica-Bold')
          .text(String(tp.tpNo), x, y + 7, { width: tpColWidth * 0.35, align: 'center' });
        
        doc.fillColor('#0f172a').fontSize(13).font('Helvetica')
          .text(val, x + tpColWidth * 0.35, y + 7, { width: tpColWidth * 0.65, align: 'center' });
      }
    }

    const summaryStartY = tpTableStartY + tableHeaderHeight + (activeCount > 0 ? rowsPerCol * tpRowHeight : tpRowHeight) + 15;
    const summaryColWidth3 = contentWidth / 3;

    doc.strokeColor('#0000ff').lineWidth(0.5).rect(ML, summaryStartY, summaryColWidth3, 48).stroke();
    doc.fillColor('#0000ff').fontSize(11.5).font('Helvetica-Bold')
      .text('TOTAL CHALLAN TP', ML, summaryStartY + 8, { width: summaryColWidth3, align: 'center' });
    doc.fillColor('#10b981').fontSize(17).font('Helvetica-Bold')
      .text(String(challan.totalTp || 0), ML, summaryStartY + 23, { width: summaryColWidth3, align: 'center' });

    doc.strokeColor('#0000ff').lineWidth(0.5).rect(ML + summaryColWidth3, summaryStartY, summaryColWidth3, 48).stroke();
    doc.fillColor('#0000ff').fontSize(11.5).font('Helvetica-Bold')
      .text('EXPECTED PCS', ML + summaryColWidth3, summaryStartY + 8, { width: summaryColWidth3, align: 'center' });
    doc.fillColor('#10b981').fontSize(17).font('Helvetica-Bold')
      .text(String(challan.pcs || 0), ML + summaryColWidth3, summaryStartY + 23, { width: summaryColWidth3, align: 'center' });

    doc.strokeColor('#0000ff').lineWidth(0.5).rect(ML + summaryColWidth3 * 2, summaryStartY, summaryColWidth3, 48).stroke();
    doc.fillColor('#0000ff').fontSize(11.5).font('Helvetica-Bold')
      .text('TOTAL CHALLAN METRES', ML + summaryColWidth3 * 2, summaryStartY + 8, { width: summaryColWidth3, align: 'center' });
    doc.fillColor('#10b981').fontSize(17).font('Helvetica-Bold')
      .text(`${parseFloat(challan.totalMtr || 0).toFixed(2)} mtr`, ML + summaryColWidth3 * 2, summaryStartY + 23, { width: summaryColWidth3, align: 'center' });

    if (challan.notes && challan.notes.trim()) {
      const notesY = summaryStartY + 60;
      doc.strokeColor('#0000ff').lineWidth(0.5).rect(ML, notesY, contentWidth, 42).stroke();
      doc.fillColor('#0000ff').fontSize(11.5).font('Helvetica-Bold')
        .text('NOTES / REMARKS', ML + 12, notesY + 6, { width: contentWidth - 24 });
      doc.fillColor('#0f172a').fontSize(13).font('Helvetica')
        .text(challan.notes, ML + 12, notesY + 20, { width: contentWidth - 24 });
    }

    const sigLineY = PH - MR - 45;
    
    doc.moveTo(ML + 30, sigLineY).lineTo(ML + 160, sigLineY).strokeColor('#0000ff').lineWidth(0.5).stroke();
    doc.fillColor('#0000ff').fontSize(12).font('Helvetica-Bold')
      .text('RECEIVER SIGNATURE', ML + 30, sigLineY + 5, { width: 130, align: 'center' });

    // Right: Authorized Signature
    doc.moveTo(PW - MR - 160, sigLineY).lineTo(PW - MR - 30, sigLineY).strokeColor('#0000ff').lineWidth(0.5).stroke();
    doc.fillColor('#0000ff').fontSize(12).font('Helvetica-Bold')
      .text('AUTHORIZED SIGNATURE', PW - MR - 160, sigLineY + 5, { width: 130, align: 'center' });

    doc.end();
  } catch (err) {
    console.error('Error downloading challan PDF:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
};

module.exports = {
  createChallan,
  getChallans,
  updateChallan,
  deleteChallan,
  getNextChallanNo,
  getLotInfo,
  downloadChallanPdf,
};

