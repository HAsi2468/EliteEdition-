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
        pcs,
        rate,
        amount
      };
    });

    body.items = items;
    body.totalPcs = totalPcs;
    body.totalAmount = parseFloat(totalAmount.toFixed(2));

    const challan = await db.StitchingChallan.create(body);

    // Publish Authority Activity Event
    try {
      const { publishActivity } = require('../utils/activityEvent');
      const uName = req.user?.name || body.userName || body.createdBy || 'Staff User';
      const uId = req.user?._id || body.userId;
      const desNo = challan.items && challan.items.length > 0 ? (challan.items[0].designNo || 'N/A') : 'N/A';
      publishActivity({
        actorId: uId,
        actorName: uName,
        action: 'CREATE',
        module: 'Stitching Challan',
        recordRef: challan.challanNo,
        recordId: challan._id,
        permissionScope: 'stitching_department',
        department: 'Stitching',
        description: `🪡 **New Stitching Challan #${challan.challanNo}** created for Karigar/Party: **"${challan.partyName || 'Tailor'}"** | Qty: **${totalPcs} pcs** | Design: **${desNo}** | Total Amount: **₹${totalAmount}** by **${uName}**.`
      }).catch(e => logger.warn('publishActivity stitching challan create failed: %s', e.message));
    } catch (e) {
      logger.warn('Failed to publish activity for stitching challan: %o', e);
    }

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
      const dsStr = dateStart ? String(dateStart).split('T')[0] : '';
      const deStr = dateEnd ? String(dateEnd).split('T')[0] : '';
      const minMs = dsStr ? Math.min(new Date(`${dsStr}T00:00:00.000Z`).getTime(), new Date(`${dsStr}T00:00:00.000`).getTime()) : null;
      const maxMs = deStr ? Math.max(new Date(`${deStr}T23:59:59.999Z`).getTime(), new Date(`${deStr}T23:59:59.999`).getTime()) : null;

      const dateQuery = {};
      if (minMs) dateQuery.$gte = new Date(minMs);
      if (maxMs) dateQuery.$lte = new Date(maxMs);

      filter.$or = [
        { date: dateQuery },
        { date: { $gte: dsStr, $lte: deStr } },
        { created_at: dateQuery },
        { createdAt: dateQuery }
      ];
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

    const { normalizeImageUrl } = require('../utils/imageUrlHelper');
    const challans = await db.StitchingChallan.find(filter)
      .sort({ challanNum: -1 })
      .limit(parseInt(limit))
      .lean();

    const normalized = (challans || []).map(ch => ({
      ...ch,
      items: (ch.items || []).map(it => ({
        ...it,
        imageUrl: normalizeImageUrl(it.imageUrl, it.designNo)
      }))
    }));

    res.json({ success: true, data: normalized });
  } catch (error) {
    logger.error('stitchingChallan.getChallans error: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── GET /stitching-challan/:id ────────────────────────────────────────────────
const getOneChallan = async (req, res) => {
  try {
    const { normalizeImageUrl } = require('../utils/imageUrlHelper');
    const challan = await db.StitchingChallan.findById(req.params.id).lean();
    if (!challan) return res.status(404).json({ success: false, error: 'Challan not found' });
    if (challan.items && Array.isArray(challan.items)) {
      challan.items = challan.items.map(it => ({
        ...it,
        imageUrl: normalizeImageUrl(it.imageUrl, it.designNo)
      }));
    }
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

// ── Shared Helper: Render Stitching Challan Page (Original = 100% Color, Duplicate = 50% Lighter Color) ──
function renderDynamicStitchingChallanPage(doc, challan, isOriginalCopy, logoPath) {
  const {
    getCompanyBrandColor,
    tintColor,
    getDuplicateLighterColor,
    isMeaningfulValue
  } = require('../utils/departmentThemeHelper');

  const PW = 595, PH = 842, ML = 35, MR = 35;
  const contentWidth = PW - ML - MR;

  const resolvedCompany = isMeaningfulValue(challan.companyEntity)
    ? String(challan.companyEntity).trim()
    : (isMeaningfulValue(challan.department) ? String(challan.department).trim() : 'Elite Stitching');
  const baseBrandColor = getCompanyBrandColor(resolvedCompany);

  // Original Copy = 100% department color; Duplicate Copy = 50% lighter department color
  const primaryColor = isOriginalCopy ? baseBrandColor : getDuplicateLighterColor(baseBrandColor);
  const borderLineColor = primaryColor;
  const mutedColor = isOriginalCopy ? '#475569' : tintColor('#475569', 0.45);
  const darkText = isOriginalCopy ? '#0f172a' : tintColor('#0f172a', 0.40);
  const rowAltBg = tintColor(primaryColor, 0.06);
  const copyBadge = isOriginalCopy ? 'ORIGINAL FOR CONSIGNEE' : 'DUPLICATE FOR TRANSPORTER';

  const formattedDate = challan.date ? new Date(challan.date).toLocaleDateString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }) : '';

  // Top Header & Outer Box
  doc.strokeColor(borderLineColor).lineWidth(1.2)
     .rect(ML, 25, contentWidth, PH - 50).stroke();

  // Copy label & Company Header
  doc.fillColor(primaryColor).fontSize(7.5).font('Helvetica-Bold')
     .text(copyBadge, ML, 15, { width: contentWidth, align: 'right' });

  doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold')
     .text('GARMENT DELIVERY CHALLAN', ML + 10, 32);

  doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold')
     .text(resolvedCompany.toUpperCase(), ML, 32, { width: contentWidth, align: 'center' });

  if (isMeaningfulValue(challan.companyPhone)) {
    doc.fillColor(mutedColor).fontSize(8.5).font('Helvetica')
       .text(`Mo. ${challan.companyPhone}`, ML, 32, { width: contentWidth - 10, align: 'right' });
  }

  doc.strokeColor(tintColor(primaryColor, 0.70)).lineWidth(0.5)
     .moveTo(ML, 46).lineTo(PW - MR, 46).stroke();

  // Logo image display
  if (fs.existsSync(logoPath)) {
    if (!isOriginalCopy) doc.save().fillOpacity(0.55);
    doc.image(logoPath, ML + (contentWidth - 140) / 2, 52, { width: 140 });
    if (!isOriginalCopy) doc.restore();
  } else {
    doc.fillColor(primaryColor).fontSize(20).font('Helvetica-Bold')
       .text(resolvedCompany.toUpperCase(), ML, 60, { width: contentWidth, align: 'center' });
  }

  const companySubLine = [
    isMeaningfulValue(challan.companyAddress) ? String(challan.companyAddress).trim() : null,
    isMeaningfulValue(challan.companyGstin) ? `GSTIN: ${String(challan.companyGstin).trim()}` : null
  ].filter(Boolean).join(' | ');

  if (companySubLine) {
    doc.fillColor(mutedColor).fontSize(8).font('Helvetica')
       .text(companySubLine, ML, 102, { width: contentWidth, align: 'center' });
  }

  doc.strokeColor(borderLineColor).lineWidth(1)
     .moveTo(ML, 116).lineTo(PW - MR, 116).stroke();

  // Dynamic Challan Header Metadata Box (only render populated fields)
  let curY = 122;
  const row1Left = isMeaningfulValue(challan.challanNo) ? `CHALLAN NO: ${challan.challanNo}` : '';
  const row1Right = isMeaningfulValue(formattedDate) ? `DATE: ${formattedDate}` : '';
  if (row1Left || row1Right) {
    doc.fillColor(darkText).fontSize(9).font('Helvetica-Bold');
    if (row1Left) doc.text(row1Left, ML + 8, curY);
    if (row1Right) doc.text(row1Right, ML + 350, curY);
    curY += 16;
  }

  const hasParty = isMeaningfulValue(challan.partyName);
  const hasTransport = isMeaningfulValue(challan.deliveryBy);
  if (hasParty || hasTransport) {
    doc.fillColor(darkText).fontSize(9);
    if (hasParty) {
      doc.font('Helvetica-Bold').text('PARTY NAME: ', ML + 8, curY);
      doc.font('Helvetica').text(String(challan.partyName).trim(), ML + 85, curY);
    }
    if (hasTransport) {
      doc.font('Helvetica-Bold').text('TRANSPORT / BY: ', ML + 350, curY);
      doc.font('Helvetica').text(String(challan.deliveryBy).trim(), ML + 440, curY);
    }
    curY += 16;
  }

  const hasBillTo = isMeaningfulValue(challan.billTo);
  const hasShipTo = isMeaningfulValue(challan.shipTo);
  if (hasBillTo || hasShipTo) {
    doc.fillColor(darkText).fontSize(9);
    if (hasBillTo) {
      doc.font('Helvetica-Bold').text('BILL TO: ', ML + 8, curY);
      doc.font('Helvetica').text(String(challan.billTo).trim(), ML + 60, curY);
    }
    if (hasShipTo) {
      doc.font('Helvetica-Bold').text('SHIP TO: ', ML + 350, curY);
      doc.font('Helvetica').text(String(challan.shipTo).trim(), ML + 405, curY);
    }
    curY += 16;
  }

  curY += 6;
  doc.strokeColor(tintColor(primaryColor, 0.65)).lineWidth(0.5)
     .moveTo(ML, curY).lineTo(PW - MR, curY).stroke();

  // Dynamic Item Table Columns
  curY += 4;
  const tableTop = curY;
  const items = challan.items || [];
  const hasAnyDesignNo = items.some(it => isMeaningfulValue(it.designNo));
  const hasAnyRateOrAmt = items.some(it => Number(it.rate) > 0 || Number(it.amount) > 0) || Number(challan.totalAmount) > 0;

  const cols = [
    { key: 'sr', name: 'SR', x: ML + 5, w: 25 },
    ...(hasAnyDesignNo ? [{ key: 'designNo', name: 'DESIGN NO', x: ML + 32, w: 105 }] : []),
    {
      key: 'particulars',
      name: 'PARTICULARS / DESCRIPTION',
      x: hasAnyDesignNo ? ML + 140 : ML + 32,
      w: (hasAnyDesignNo ? 220 : 328) + (hasAnyRateOrAmt ? 0 : 100)
    },
    {
      key: 'pcs',
      name: 'PCS (QTY)',
      x: hasAnyRateOrAmt ? ML + 365 : ML + 455,
      w: 60,
      align: 'right'
    },
    ...(hasAnyRateOrAmt ? [
      { key: 'rate', name: 'RATE (₹)', x: ML + 425, w: 45, align: 'right' },
      { key: 'amount', name: 'AMOUNT (₹)', x: ML + 475, w: 45, align: 'right' }
    ] : [])
  ];

  // Draw Table Header Row
  doc.fillColor(primaryColor).rect(ML, tableTop, contentWidth, 18).fill();
  cols.forEach(c => {
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
       .text(c.name, c.x, tableTop + 5, { width: c.w, align: c.align || 'left' });
  });

  curY = tableTop + 20;

  items.forEach((it, index) => {
    const rowBg = index % 2 === 0 ? rowAltBg : '#ffffff';
    doc.fillColor(rowBg).rect(ML, curY, contentWidth, 16).fill();

    doc.fillColor(darkText).fontSize(8).font('Helvetica');
    cols.forEach(col => {
      if (col.key === 'sr') {
        doc.font('Helvetica').text(String(index + 1), col.x, curY + 4, { width: col.w });
      } else if (col.key === 'designNo') {
        doc.font('Helvetica-Bold').text(isMeaningfulValue(it.designNo) ? String(it.designNo) : '', col.x, curY + 4, { width: col.w });
      } else if (col.key === 'particulars') {
        doc.font('Helvetica').text(isMeaningfulValue(it.particulars) ? String(it.particulars) : '', col.x, curY + 4, { width: col.w });
      } else if (col.key === 'pcs') {
        doc.font('Helvetica').text(Number(it.pcs) > 0 ? String(it.pcs) : '', col.x, curY + 4, { width: col.w, align: 'right' });
      } else if (col.key === 'rate') {
        doc.font('Helvetica').text(Number(it.rate) > 0 ? `₹${Number(it.rate).toFixed(2)}` : '', col.x, curY + 4, { width: col.w, align: 'right' });
      } else if (col.key === 'amount') {
        doc.font('Helvetica-Bold').text(Number(it.amount) > 0 ? `₹${Number(it.amount).toFixed(2)}` : '', col.x, curY + 4, { width: col.w, align: 'right' });
      }
    });

    curY += 16;
  });

  // Table Summary Line
  doc.strokeColor(borderLineColor).lineWidth(1)
     .moveTo(ML, curY + 2).lineTo(PW - MR, curY + 2).stroke();

  curY += 6;
  if (Number(challan.totalPcs) > 0) {
    doc.fillColor(darkText).fontSize(9.5).font('Helvetica-Bold')
       .text(`TOTAL PIECES: ${challan.totalPcs} Pcs`, ML + 10, curY);
  }

  if (Number(challan.totalAmount) > 0) {
    doc.fillColor(primaryColor).fontSize(9.5).font('Helvetica-Bold')
       .text(`TOTAL AMOUNT: ₹${Number(challan.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, ML + 300, curY, { width: contentWidth - 310, align: 'right' });
  }

  if (isMeaningfulValue(challan.notes)) {
    curY += 18;
    doc.fillColor(mutedColor).fontSize(8).font('Helvetica-Oblique')
       .text(`Notes / Instructions: ${String(challan.notes).trim()}`, ML + 10, curY, { width: contentWidth - 20 });
  }

  // Signature Footer Blocks
  const footerY = PH - 90;
  doc.strokeColor(tintColor(primaryColor, 0.65)).lineWidth(0.5)
     .moveTo(ML, footerY).lineTo(PW - MR, footerY).stroke();

  doc.fillColor(mutedColor).fontSize(8).font('Helvetica-Bold');
  doc.text("PREPARED BY", ML + 20, footerY + 50);
  doc.text("RECEIVER'S SIGNATURE", ML + 210, footerY + 50);
  doc.fillColor(primaryColor).font('Helvetica-Bold').text(`FOR ${resolvedCompany.toUpperCase()}`, ML + 360, footerY + 12);
  doc.fillColor(mutedColor).font('Helvetica').text("(Authorized Signatory)", ML + 360, footerY + 50);
}

// ── GET /stitching-challan/:id/pdf ───────────────────────────────────────────
// Page 1: Original in 100% Department Brand Color; Page 2: Duplicate in 50% Lighter Brand Color
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

    const logoPath = path.join(__dirname, 'Logo.png');

    // Page 1: Original in 100% Company Brand Color
    renderDynamicStitchingChallanPage(doc, challan, true, logoPath);

    // Page 2: Duplicate in 50% Lighter Company Brand Color
    doc.addPage({ margin: 28, size: 'A4' });
    renderDynamicStitchingChallanPage(doc, challan, false, logoPath);

    doc.end();
  } catch (error) {
    logger.error('stitchingChallan.downloadChallanPdf error: %o', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
};

// ── GET /stitching-challan/bulk-pdf ───────────────────────────────────────────
const downloadBulkChallansPdf = async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');

    let ids = [];
    if (req.query.ids) {
      ids = String(req.query.ids).split(',').map(s => s.trim()).filter(Boolean);
    } else if (req.body && Array.isArray(req.body.ids)) {
      ids = req.body.ids;
    }

    if (ids.length === 0) {
      return res.status(400).send('No Stitching Challan IDs provided.');
    }

    const challans = await db.StitchingChallan.find({ _id: { $in: ids } }).sort({ challanNum: 1, created_at: 1 }).lean();
    if (challans.length === 0) {
      return res.status(404).send('No matching Stitching Challans found.');
    }

    const doc = new PDFDocument({ margin: 28, size: 'A4', autoFirstPage: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Combined_Stitching_Challans_${challans.length}_Items.pdf"`);
    doc.pipe(res);

    const logoPath = path.join(__dirname, 'Logo.png');
    const includeDuplicate = req.query?.duplicate !== 'false';

    for (let cIdx = 0; cIdx < challans.length; cIdx++) {
      const challan = challans[cIdx];
      if (cIdx > 0) doc.addPage({ margin: 28, size: 'A4' });

      // Page 1: Original Copy (100% Department Brand Color)
      renderDynamicStitchingChallanPage(doc, challan, true, logoPath);

      // Page 2: Duplicate Copy (50% Lighter Department Brand Color)
      if (includeDuplicate) {
        doc.addPage({ margin: 28, size: 'A4' });
        renderDynamicStitchingChallanPage(doc, challan, false, logoPath);
      }
    }

    doc.end();
  } catch (error) {
    logger.error('stitchingChallan.downloadBulkChallansPdf error: %o', error);
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
  downloadChallanPdf,
  downloadBulkChallansPdf
};
