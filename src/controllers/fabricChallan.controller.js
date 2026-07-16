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

// ── POST /fabric-challan ───────────────────────────────────────────────────
const createChallan = async (req, res) => {
  try {
    const {
      date, partyName,
      lotNo, vendorChallanNo, fabricName, shortagePct,
      jobNo, designNo, colour, panna,
      tpDetails,
      notes, createdBy,
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
      notes: notes || '',
      createdBy: createdBy || '',
    });

    await challan.save();
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
      tpDetails, notes,
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
    if (notes !== undefined) challan.notes = notes;

    if (tpDetails !== undefined) {
      const details = Array.isArray(tpDetails) ? tpDetails : [];
      const { totalMtr, totalTp } = computeTotals(details);
      challan.tpDetails = details;
      challan.totalMtr = totalMtr;
      challan.totalTp = totalTp;
    }

    await challan.save();
    res.json({ success: true, data: challan });
  } catch (error) {
    console.error('Error updating fabric challan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── DELETE /fabric-challan/:id ─────────────────────────────────────────────
const deleteChallan = async (req, res) => {
  try {
    const deleted = await FabricChallan.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Challan not found' });
    }
    res.json({ success: true, message: 'Challan deleted' });
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

    // PDF document with custom margins
    const doc = new PDFDocument({ margin: 28, size: 'A4', autoFirstPage: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Challan_EDP_${challan.challanNo || 'preview'}.pdf"`);
    doc.pipe(res);

    // Page boundaries
    const PW = 595, PH = 842, M = 28;

    // Draw nice outer card border
    doc.strokeColor('#c8d4e0').lineWidth(1).rect(M, M, PW - 2 * M, PH - 2 * M).stroke();

    // Top header metadata matching physical paper pad
    doc.fillColor('#475569').fontSize(7.5).font('Helvetica')
      .text('Subject to SURAT Jurisdiction', M + 12, M + 6, { lineBreak: false });
    doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold')
      .text('|| Shree Ganeshay Namah ||', M, M + 6, { width: PW - 2 * M, align: 'center', lineBreak: false });
    doc.fillColor('#475569').fontSize(7.5).font('Helvetica')
      .text('Mo. +91 99098 66667', M, M + 6, { width: PW - 2 * M - 12, align: 'right', lineBreak: false });

    // Subtle header divider
    doc.strokeColor('#cbd5e1').lineWidth(0.5)
      .moveTo(M, M + 15).lineTo(PW - M, M + 15).stroke();

    // Centered Company Logo (Elite Digital Prints) - with reduced space
    const logoPath = path.join(__dirname, 'Logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, (PW - 140) / 2, M + 17, { width: 140 });
    }

    // Company Address centered below logo
    doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Bold')
      .text('GROUND FLOOR, PLOT NO-B/37, Siddheshwar Society, Puna Kumbariya Road, NR. KALAPUL, Punagam, Surat, Surat, Gujarat, 395010', M, M + 112, { width: PW - 2 * M, align: 'center', lineBreak: false });

    // Header bottom boundary line
    doc.strokeColor('#cbd5e1').lineWidth(0.8)
      .moveTo(M, M + 124).lineTo(PW - M, M + 124).stroke();

    const formattedDate = challan.date ? new Date(challan.date).toLocaleDateString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }) : '—';

    // Watermark/Default logo in background with low opacity
    if (fs.existsSync(logoPath)) {
      doc.save();
      doc.opacity(0.02);
      doc.image(logoPath, (PW - 300) / 2, (PH - 300) / 2, { width: 300, height: 300 });
      doc.restore();
    }

    // M/s & Challan Details Header Row
    const startY = M + 128;

    // Draw M/s: Party Name (Left aligned)
    doc.fillColor('#64748b').fontSize(9.5).font('Helvetica-Bold')
      .text('M/s:', M + 12, startY + 6, { lineBreak: false });
    doc.fillColor('#0f172a').fontSize(11.5).font('Helvetica-Bold')
      .text(challan.partyName || '—', M + 42, startY + 4, { lineBreak: false });
      
    // Draw Challan No in Bold Red (Right aligned)
    doc.fillColor('#64748b').fontSize(9.5).font('Helvetica-Bold')
      .text('Ch.no.:', PW - M - 160, startY + 6, { width: 90, align: 'right', lineBreak: false });
    doc.fillColor('#dc2626').fontSize(12).font('Helvetica-Bold') // Premium Red
      .text('EDP-' + (challan.challanNo || '—'), PW - M - 65, startY + 4, { width: 60, align: 'left', lineBreak: false });

    // Draw Date (Right aligned, below Challan No)
    doc.fillColor('#64748b').fontSize(9.5).font('Helvetica-Bold')
      .text('Date:', PW - M - 160, startY + 17, { width: 90, align: 'right', lineBreak: false });
    doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold')
      .text(formattedDate, PW - M - 65, startY + 17, { width: 60, align: 'left', lineBreak: false });

    // Divider line below M/s Row
    doc.strokeColor('#cbd5e1').lineWidth(0.6)
      .moveTo(M, startY + 28).lineTo(PW - M, startY + 28).stroke();

    // Helper to print details key-value pair with premium design
    function renderField(label, value, x, y, width, height) {
      // Draw subtle cell boundaries
      doc.strokeColor('#cbd5e1').lineWidth(0.5)
        .rect(x, y, width, height).stroke();

      // Label (left padded, small font)
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Bold')
        .text(label.toUpperCase(), x + 10, y + 4, { width: width - 20, align: 'left', lineBreak: false });

      // Value (left padded, bold, slightly larger)
      doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold')
        .text(String(value || '—'), x + 10, y + 14, { width: width - 20, align: 'left', lineBreak: false });
    }

    // Fetch associated job card details for Bill to & Ship to
    let billTo = '—';
    let shipTo = '—';
    if (challan.jobNo) {
      try {
        const job = await JobCard.findOne({ jobNo: challan.jobNo });
        if (job) {
          billTo = job.billTo || '—';
          shipTo = job.shipTo || '—';
        }
      } catch (e) {
        console.warn('Failed to find job card info', e);
      }
    }

    // Row 1: Bill To and Ship To (spanning full width split in half)
    const billStartY = startY + 28;
    const halfWidth = (PW - 2 * M) / 2;
    renderField('Bill to', billTo, M, billStartY, halfWidth, 28);
    renderField('Ship to', shipTo, M + halfWidth, billStartY, halfWidth, 28);

    // Row 2 & 3: Metadata Grid Layout starting below Bill to / Ship to row in 4 columns
    const gridStartY = billStartY + 28;
    const colWidth4 = (PW - 2 * M) / 4;

    // Row 0 of Grid (startY)
    // Row 0 of Grid (startY)
    renderField('Job No.', challan.jobNo, M, gridStartY, colWidth4, 28);
    renderField('Design No.', challan.designNo, M + colWidth4, gridStartY, colWidth4, 28);
    renderField('Lot No.', challan.lotNo ? `#${challan.lotNo}` : '—', M + colWidth4 * 2, gridStartY, colWidth4, 28);
    renderField('Panno', challan.panna, M + colWidth4 * 3, gridStartY, colWidth4, 28);

    // Row 1 of Grid (gridStartY + 28)
    renderField('Colour', challan.colour, M, gridStartY + 28, colWidth4, 28);
    renderField('Fabric', challan.fabricName, M + colWidth4, gridStartY + 28, colWidth4 * 2, 28);
    renderField('Vendor Challan', challan.vendorChallanNo, M + colWidth4 * 3, gridStartY + 28, colWidth4, 28);

    // ─── TP Details section ───
    const tpSectionY = gridStartY + 56 + 15;
    doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold')
      .text('TP Details', M + 16, tpSectionY, { lineBreak: false });

    // Filter active TP details (meter > 0)
    const activeTps = (challan.tpDetails || [])
      .filter(tp => tp.tpMeter != null && parseFloat(tp.tpMeter) > 0);

    // Dynamic columns count depending on active rows:
    // If <= 5 rows, we print 1 single column
    // If <= 10 rows, we print 2 columns
    // Else, we print 3 columns
    const activeCount = activeTps.length;
    const tpColsCount = activeCount === 0 ? 1 : activeCount <= 5 ? 1 : activeCount <= 10 ? 2 : 3;
    const tpColWidth = (PW - 2 * M) / tpColsCount;
    const tpRowHeight = 22;
    const tableHeaderHeight = 22;
    const tpTableStartY = tpSectionY + 16;

    // Draw TP Table Headers
    for (let c = 0; c < tpColsCount; c++) {
      const x = M + c * tpColWidth;
      // Header background
      doc.rect(x, tpTableStartY, tpColWidth, tableHeaderHeight).fill('#f8fafc');
      doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(x, tpTableStartY, tpColWidth, tableHeaderHeight).stroke();
      
      // Header text (centered)
      doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold')
        .text('TP NO.', x, tpTableStartY + 6, { width: tpColWidth * 0.35, align: 'center' });
      doc.text('METRES', x + tpColWidth * 0.35, tpTableStartY + 6, { width: tpColWidth * 0.65, align: 'center' });
    }

    const rowsPerCol = Math.ceil(activeCount / tpColsCount);

    if (activeCount === 0) {
      const x = M;
      const y = tpTableStartY + tableHeaderHeight;
      doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(x, y, PW - 2 * M, tpRowHeight).stroke();
      doc.fillColor('#64748b').fontSize(9.5).font('Helvetica-Oblique')
        .text('No active TP details entered.', x, y + 6, { width: PW - 2 * M, align: 'center' });
    } else {
      for (let i = 0; i < activeCount; i++) {
        const tp = activeTps[i];
        const colIndex = i % tpColsCount;
        const rowIndex = Math.floor(i / tpColsCount);

        const x = M + colIndex * tpColWidth;
        const y = tpTableStartY + tableHeaderHeight + rowIndex * tpRowHeight;

        // Draw cell border
        doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(x, y, tpColWidth, tpRowHeight).stroke();

        const val = `${parseFloat(tp.tpMeter).toFixed(3)} mtr`;

        doc.fillColor('#64748b').fontSize(9.5).font('Helvetica-Bold')
          .text(String(tp.tpNo), x, y + 6, { width: tpColWidth * 0.35, align: 'center' });
        
        doc.fillColor('#0f172a').fontSize(10).font('Helvetica')
          .text(val, x + tpColWidth * 0.35, y + 6, { width: tpColWidth * 0.65, align: 'center' });
      }
    }

    // ─── Summary Section ───
    const summaryStartY = tpTableStartY + tableHeaderHeight + (activeCount > 0 ? rowsPerCol * tpRowHeight : tpRowHeight) + 15;
    const summaryColWidth = (PW - 2 * M) / 2;

    // Draw total cards
    // Left: Total TP
    doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(M, summaryStartY, summaryColWidth, 42).stroke();
    doc.fillColor('#64748b').fontSize(8.5).font('Helvetica-Bold')
      .text('TOTAL CHALLAN TP', M, summaryStartY + 8, { width: summaryColWidth, align: 'center' });
    doc.fillColor('#10b981').fontSize(14).font('Helvetica-Bold')
      .text(String(challan.totalTp || 0), M, summaryStartY + 20, { width: summaryColWidth, align: 'center' });

    // Right: Total Metres
    doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(M + summaryColWidth, summaryStartY, summaryColWidth, 42).stroke();
    doc.fillColor('#64748b').fontSize(8.5).font('Helvetica-Bold')
      .text('TOTAL CHALLAN METRES', M + summaryColWidth, summaryStartY + 8, { width: summaryColWidth, align: 'center' });
    doc.fillColor('#10b981').fontSize(14).font('Helvetica-Bold')
      .text(`${parseFloat(challan.totalMtr || 0).toFixed(3)} mtr`, M + summaryColWidth, summaryStartY + 20, { width: summaryColWidth, align: 'center' });

    // Notes area
    const notesY = summaryStartY + 54;
    doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(M, notesY, PW - 2 * M, 34).stroke();
    doc.fillColor('#8896a4').fontSize(8.5).font('Helvetica-Bold')
      .text('NOTES / REMARKS', M + 12, notesY + 5, { width: PW - 2 * M - 24 });
    doc.fillColor('#0f172a').fontSize(10).font('Helvetica')
      .text(challan.notes || 'No remarks provided.', M + 12, notesY + 16, { width: PW - 2 * M - 24 });

    // Signatures footer at the bottom
    const sigLineY = PH - M - 45;
    
    // Left: Receiver Signature
    doc.moveTo(M + 30, sigLineY).lineTo(M + 160, sigLineY).strokeColor('#94a3b8').lineWidth(0.5).stroke();
    doc.fillColor('#64748b').fontSize(9).font('Helvetica-Bold')
      .text('RECEIVER SIGNATURE', M + 30, sigLineY + 5, { width: 130, align: 'center' });

    // Right: Authorized Signature
    doc.moveTo(PW - M - 160, sigLineY).lineTo(PW - M - 30, sigLineY).strokeColor('#94a3b8').lineWidth(0.5).stroke();
    doc.fillColor('#64748b').fontSize(9).font('Helvetica-Bold')
      .text('AUTHORIZED SIGNATURE', PW - M - 160, sigLineY + 5, { width: 130, align: 'center' });

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

