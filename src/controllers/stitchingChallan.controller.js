const db = require('../db/models');
const logger = require('../config/logger');
const path = require('path');
const fs = require('fs');

// Helper: Parse numeric part of PCH-1
const parseChallanNum = (str) => {
  if (!str) return 0;
  const match = String(str).match(/PCH-(\d+)/i);
  if (match) {
    const val = parseInt(match[1], 10);
    return isNaN(val) ? 0 : val;
  }
  const num = parseInt(str, 10);
  return isNaN(num) ? 0 : num;
};

// ── GET /stitching-challan/next-no ────────────────────────────────────────────
const getNextChallanNo = async (req, res) => {
  try {
    const last = await db.StitchingChallan.findOne({}, 'challanNum challanNo').sort({ challanNum: -1 }).lean();
    let nextNum = 1;
    if (last) {
      nextNum = (last.challanNum || parseChallanNum(last.challanNo)) + 1;
    }
    res.json({ success: true, nextNo: `PCH-${nextNum}`, nextNum });
  } catch (error) {
    logger.error('stitchingChallan.getNextChallanNo error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── POST /stitching-challan ───────────────────────────────────────────────────
const createChallan = async (req, res) => {
  try {
    const body = { ...req.body };

    // Auto-number if not explicitly provided
    if (!body.challanNo) {
      const last = await db.StitchingChallan.findOne({}, 'challanNum challanNo').sort({ challanNum: -1 }).lean();
      const nextNum = last ? (last.challanNum || parseChallanNum(last.challanNo)) + 1 : 1;
      body.challanNo = `PCH-${nextNum}`;
      body.challanNum = nextNum;
    } else {
      body.challanNum = parseChallanNum(body.challanNo);
    }

    // Process & calculate items (up to 30)
    let items = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
    let totalPcs = 0;
    let totalAmount = 0;

    items = items.map((it, idx) => {
      const pcs = parseFloat(it.pcs) || 0;
      const rate = parseFloat(it.rate) || 0;
      const amount = parseFloat((pcs * rate).toFixed(2));
      totalPcs += pcs;
      totalAmount += amount;
      return {
        srNo: idx + 1,
        designNo: it.designNo || '',
        particulars: it.particulars || '',
        hsnCode: it.hsnCode || '6204',
        pcs,
        rate,
        amount
      };
    });

    body.items = items;
    body.totalPcs = totalPcs;
    body.totalAmount = parseFloat(totalAmount.toFixed(2));

    const challan = await db.StitchingChallan.create(body);
    res.status(201).json({ success: true, data: challan });
  } catch (error) {
    logger.error('stitchingChallan.create error: %o', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: `Challan number "${req.body.challanNo}" already exists.` });
    }
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── GET /stitching-challan ────────────────────────────────────────────────────
const getChallans = async (req, res) => {
  try {
    const { dateStart, dateEnd, search, partyName, status, limit = 200 } = req.query;
    const filter = {};

    if (status && status !== 'All') filter.status = status;
    if (partyName) filter.partyName = partyName;

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
        { challanNo: re },
        { partyName: re },
        { billTo: re },
        { deliveryBy: re },
        { notes: re },
        { 'items.designNo': re },
        { 'items.particulars': re },
      ];
    }

    const challans = await db.StitchingChallan.find(filter)
      .sort({ challanNum: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, data: challans });
  } catch (error) {
    logger.error('stitchingChallan.getChallans error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── GET /stitching-challan/:id ────────────────────────────────────────────────
const getOneChallan = async (req, res) => {
  try {
    const challan = await db.StitchingChallan.findById(req.params.id).lean();
    if (!challan) return res.status(404).json({ success: false, error: 'Challan not found' });
    res.json({ success: true, data: challan });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── PUT /stitching-challan/:id ────────────────────────────────────────────────
const updateChallan = async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.items && Array.isArray(body.items)) {
      let items = body.items.slice(0, 30);
      let totalPcs = 0;
      let totalAmount = 0;

      items = items.map((it, idx) => {
        const pcs = parseFloat(it.pcs) || 0;
        const rate = parseFloat(it.rate) || 0;
        const amount = parseFloat((pcs * rate).toFixed(2));
        totalPcs += pcs;
        totalAmount += amount;
        return {
          srNo: idx + 1,
          designNo: it.designNo || '',
          particulars: it.particulars || '',
          hsnCode: it.hsnCode || '6204',
          pcs,
          rate,
          amount
        };
      });

      body.items = items;
      body.totalPcs = totalPcs;
      body.totalAmount = parseFloat(totalAmount.toFixed(2));
    }

    if (body.challanNo) {
      body.challanNum = parseChallanNum(body.challanNo);
    }

    const challan = await db.StitchingChallan.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true }).lean();
    if (!challan) return res.status(404).json({ success: false, error: 'Challan not found' });

    res.json({ success: true, data: challan });
  } catch (error) {
    logger.error('stitchingChallan.update error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── DELETE /stitching-challan/:id ─────────────────────────────────────────────
const deleteChallan = async (req, res) => {
  try {
    const doc = await db.StitchingChallan.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, error: 'Challan not found' });
    res.json({ success: true, message: 'Stitching Challan deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── GET /stitching-challan/:id/pdf ───────────────────────────────────────────
const downloadChallanPdf = async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');

    const challan = await db.StitchingChallan.findById(req.params.id).lean();
    if (!challan) {
      return res.status(404).json({ error: 'Challan not found' });
    }

    const doc = new PDFDocument({ margin: 28, size: 'A4', autoFirstPage: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Stitching_Challan_${challan.challanNo || 'PCH'}.pdf"`);
    doc.pipe(res);

    const PW = 595, PH = 842, ML = 35, MR = 35;
    const contentWidth = PW - ML - MR;

    // Logo path for Elite Edition
    const logoPath = path.join(__dirname, 'Logo.png');

    const formattedDate = challan.date ? new Date(challan.date).toLocaleDateString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }) : '—';

    // Top Header & Outer Box
    doc.strokeColor('#2563eb').lineWidth(1.2)
       .rect(ML, 25, contentWidth, PH - 50).stroke();

    // Company Header
    doc.fillColor('#1e40af').fontSize(9).font('Helvetica-Bold')
       .text('GARMENT DELIVERY CHALLAN', ML + 10, 32);
    
    doc.fillColor('#1e3a8a').fontSize(10).font('Helvetica-Bold')
       .text('ELITE EDITION', ML, 32, { width: contentWidth, align: 'center' });

    doc.fillColor('#475569').fontSize(8.5).font('Helvetica')
       .text('Mo. +91 99098 66667', ML, 32, { width: contentWidth - 10, align: 'right' });

    doc.strokeColor('#cbd5e1').lineWidth(0.5)
       .moveTo(ML, 46).lineTo(PW - MR, 46).stroke();

    // Logo image display
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, ML + (contentWidth - 140) / 2, 52, { width: 140 });
    } else {
      doc.fillColor('#1e3a8a').fontSize(20).font('Helvetica-Bold')
         .text('ELITE EDITION', ML, 60, { width: contentWidth, align: 'center' });
    }

    doc.fillColor('#475569').fontSize(8).font('Helvetica')
       .text('Plot No-B/37, Siddheshwar Soc., Punagam Main Road, Surat | GSTIN: 24AANFE0044M1ZG', ML, 102, { width: contentWidth, align: 'center' });

    doc.strokeColor('#1e40af').lineWidth(1)
       .moveTo(ML, 116).lineTo(PW - MR, 116).stroke();

    // Challan Header Metadata Box
    let curY = 122;
    doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold')
       .text(`CHALLAN NO: ${challan.challanNo}`, ML + 8, curY);
    doc.text(`DATE: ${formattedDate}`, ML + 350, curY);

    curY += 16;
    doc.font('Helvetica-Bold').text('PARTY NAME: ', ML + 8, curY);
    doc.font('Helvetica').text(challan.partyName || '—', ML + 85, curY);

    if (challan.deliveryBy) {
      doc.font('Helvetica-Bold').text('TRANSPORT / BY: ', ML + 350, curY);
      doc.font('Helvetica').text(challan.deliveryBy, ML + 440, curY);
    }

    curY += 16;
    if (challan.billTo) {
      doc.font('Helvetica-Bold').text('BILL TO: ', ML + 8, curY);
      doc.font('Helvetica').text(challan.billTo, ML + 60, curY);
    }
    if (challan.shipTo) {
      doc.font('Helvetica-Bold').text('SHIP TO: ', ML + 350, curY);
      doc.font('Helvetica').text(challan.shipTo, ML + 405, curY);
    }

    curY += 22;
    doc.strokeColor('#cbd5e1').lineWidth(0.5)
       .moveTo(ML, curY).lineTo(PW - MR, curY).stroke();

    // Item Table (Up to 30 items)
    curY += 4;
    const tableTop = curY;
    const cols = [
      { name: 'SR', x: ML + 5, w: 25 },
      { name: 'DESIGN NO', x: ML + 32, w: 85 },
      { name: 'PARTICULARS / DESCRIPTION', x: ML + 120, w: 215 },
      { name: 'HSN', x: ML + 338, w: 45 },
      { name: 'PCS (QTY)', x: ML + 386, w: 55, align: 'right' },
      { name: 'RATE (₹)', x: ML + 444, w: 45, align: 'right' },
      { name: 'AMOUNT (₹)', x: ML + 492, w: 30, align: 'right' },
    ];

    // Draw Table Header Row
    doc.fillColor('#1e40af').rect(ML, tableTop, contentWidth, 18).fill();
    cols.forEach(c => {
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
         .text(c.name, c.x, tableTop + 5, { width: c.w, align: c.align || 'left' });
    });

    curY = tableTop + 20;
    const items = challan.items || [];

    items.forEach((it, index) => {
      const rowBg = index % 2 === 0 ? '#f8fafc' : '#ffffff';
      doc.fillColor(rowBg).rect(ML, curY, contentWidth, 16).fill();

      doc.fillColor('#0f172a').fontSize(8).font('Helvetica');
      doc.text(String(index + 1), cols[0].x, curY + 4, { width: cols[0].w });
      doc.font('Helvetica-Bold').text(it.designNo || '—', cols[1].x, curY + 4, { width: cols[1].w });
      doc.font('Helvetica').text(it.particulars || 'Garment Stitching', cols[2].x, curY + 4, { width: cols[2].w });
      doc.text(it.hsnCode || '6204', cols[3].x, curY + 4, { width: cols[3].w });
      doc.text(String(it.pcs || 0), cols[4].x, curY + 4, { width: cols[4].w, align: 'right' });
      doc.text(it.rate ? `₹${it.rate.toFixed(2)}` : '—', cols[5].x, curY + 4, { width: cols[5].w, align: 'right' });
      doc.font('Helvetica-Bold').text(it.amount ? `₹${it.amount.toFixed(2)}` : '—', cols[6].x, curY + 4, { width: cols[6].w, align: 'right' });

      curY += 16;
    });

    // Table Summary Line
    doc.strokeColor('#1e40af').lineWidth(1)
       .moveTo(ML, curY + 2).lineTo(PW - MR, curY + 2).stroke();

    curY += 6;
    doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold')
       .text(`TOTAL PIECES: ${challan.totalPcs || 0} Pcs`, ML + 10, curY);

    if (challan.totalAmount > 0) {
      doc.text(`TOTAL AMOUNT: ₹${(challan.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, ML + 300, curY, { width: contentWidth - 310, align: 'right' });
    }

    if (challan.notes) {
      curY += 18;
      doc.fillColor('#475569').fontSize(8).font('Helvetica-Oblique')
         .text(`Notes / Instructions: ${challan.notes}`, ML + 10, curY, { width: contentWidth - 20 });
    }

    // Signature Footer Blocks
    const footerY = PH - 90;
    doc.strokeColor('#cbd5e1').lineWidth(0.5)
       .moveTo(ML, footerY).lineTo(PW - MR, footerY).stroke();

    doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold');
    doc.text("PREPARED BY", ML + 20, footerY + 50);
    doc.text("RECEIVER'S SIGNATURE", ML + 210, footerY + 50);
    doc.text("FOR ELITE EDITION", ML + 380, footerY + 12);
    doc.font('Helvetica').text("(Authorized Signatory)", ML + 380, footerY + 50);

    doc.end();
  } catch (error) {
    logger.error('stitchingChallan.downloadChallanPdf error: %o', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
};

module.exports = {
  getNextChallanNo,
  createChallan,
  getChallans,
  getOneChallan,
  updateChallan,
  deleteChallan,
  downloadChallanPdf
};
