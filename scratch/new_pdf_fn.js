// ── 9. DOWNLOAD INVOICE PDF ──────────────────────────────────────────────────
const downloadInvoicePdf = async (req, res) => {
  try {
    const invoice = await BillingInvoice.findById(req.params.id).lean();
    if (!invoice) {
      return res.status(404).send('Invoice not found');
    }

    const PrintConfig = require('../db/models/printConfig.model');
    const JobCard = require('../db/models/jobCard.model');
    const config = await PrintConfig.findOne({ isConfig: true }).lean() || {};
    const companyName = config.companyName || 'ELITE DIGITAL PRINTS';
    const companyGstin = config.companyGstin || '24AAAFE1234F1Z5';
    const companyAddress = config.companyAddress || 'G.F., PLOT NO-B/37, Siddheshwar Soc., Punagam Main Road, Surat - 395006';
    const companyPhone = config.companyPhone || '+91 98790 00000';
    const companyTerms = invoice.terms || config.companyTerms || 'Payment due within 30 days from invoice date. Subject to Surat jurisdiction.';

    const doc = new PDFDocument({ margin: 18, size: 'A4', autoFirstPage: true, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice_${invoice.invoiceNo}.pdf"`);
    doc.pipe(res);

    const PW = 595, PH = 842, ML = 20, MR = 20;
    const contentWidth = PW - ML - MR;
    const logoPath = path.join(__dirname, 'Logo.png');

    // ── Helpers ─────────────────────────────────────────────────────────────
    const resolveImagePath = (urlOrPath) => {
      if (!urlOrPath) return null;
      let filename = urlOrPath.replace(/^.*\/designs\//, '').replace(/^\/designs\//, '').trim();
      try { filename = decodeURIComponent(filename); } catch (e) {}
      const possibleDirs = [
        path.join(__dirname, '../../elite_edition_images'),
        path.join(__dirname, '../../../elite_edition_images'),
        '/home/ubuntu/elite_edition_images',
        path.join(__dirname, '../elite_edition_images'),
        path.join(__dirname, '../../Digital print'),
        path.join(__dirname, '../../../Digital print'),
        '/home/ubuntu/Digital print'
      ];
      for (const pDir of possibleDirs) {
        if (fs.existsSync(pDir)) {
          const direct = path.join(pDir, filename);
          if (fs.existsSync(direct)) return direct;
          try {
            const files = fs.readdirSync(pDir);
            const matched = files.find(f => f.toLowerCase() === filename.toLowerCase());
            if (matched) return path.join(pDir, matched);
          } catch (e) {}
        }
      }
      return null;
    };

    const formatDate = (d) => {
      if (!d) return '--';
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return `${String(dt.getDate()).padStart(2,'0')}-${String(dt.getMonth()+1).padStart(2,'0')}-${dt.getFullYear()}`;
    };

    const cleanJobDisplay = (jobStr) => {
      if (!jobStr) return '';
      const str = String(jobStr);
      const matches = str.match(/\d+/g);
      if (matches && matches.length > 0) {
        const unique = [...new Set(matches)];
        return unique.length === 1 ? `Job Card: ${unique[0]}` : `Job Cards: ${unique.join(', ')}`;
      }
      return str.replace(/JOB NO\.-?\s*/gi, '').replace(/Job\s*#?\s*/gi, '').trim();
    };

    // ── COLOUR PALETTE ───────────────────────────────────────────────────────
    const C = {
      purple:      '#4c1d95',
      purpleMid:   '#6b21a8',
      purpleLight: '#ede9fe',
      slate900:    '#0f172a',
      slate700:    '#334155',
      slate500:    '#64748b',
      slate200:    '#e2e8f0',
      slate100:    '#f1f5f9',
      slate50:     '#f8fafc',
      white:       '#ffffff',
    };

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 1: HEADER
    // ─────────────────────────────────────────────────────────────────────────
    let Y = 22;

    // Purple top accent bar
    doc.rect(ML, Y, contentWidth, 3).fill(C.purple);
    Y += 8;

    const logoW = 110;
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, ML, Y, { width: logoW, height: 40, fit: [logoW, 40] });
    }

    doc.fillColor(C.slate900).fontSize(13).font('Helvetica-Bold')
      .text(companyName.toUpperCase(), ML + logoW + 10, Y, { width: contentWidth - logoW - 10, align: 'right' });
    doc.fillColor(C.slate500).fontSize(7.5).font('Helvetica')
      .text(companyAddress, ML + logoW + 10, Y + 16, { width: contentWidth - logoW - 10, align: 'right' })
      .text(`GSTIN/UIN: ${companyGstin}   Phone: ${companyPhone}`, ML + logoW + 10, Y + 26, { width: contentWidth - logoW - 10, align: 'right' });

    Y += 46;
    doc.moveTo(ML, Y).lineTo(PW - MR, Y).strokeColor(C.purple).lineWidth(1.5).stroke();
    Y += 1;

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 2: TAX INVOICE BADGE
    // ─────────────────────────────────────────────────────────────────────────
    const badgeH = 36;
    doc.rect(ML, Y, contentWidth, badgeH).fill(C.purpleLight).stroke(C.slate200);

    doc.fillColor(C.purple).fontSize(14).font('Helvetica-Bold')
      .text('TAX INVOICE', ML + 10, Y + 4);

    const ourChallanStr = invoice.ourChallanNo || invoice.challanNo || '';
    doc.fillColor(C.slate700).fontSize(8).font('Helvetica')
      .text(`Invoice No: ${invoice.invoiceNo}`, ML + 10, Y + 22, { width: 200 });
    if (ourChallanStr) {
      doc.text(`Challan No: ${ourChallanStr}`, ML + 175, Y + 22, { width: 200 });
    }

    doc.fillColor(C.slate700).fontSize(8).font('Helvetica')
      .text(`Date: ${formatDate(invoice.invoiceDate)}`, ML + contentWidth - 180, Y + 6, { width: 175, align: 'right' })
      .text(`Due Date: ${formatDate(invoice.dueDate)}`, ML + contentWidth - 180, Y + 18, { width: 175, align: 'right' });

    Y += badgeH;

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 3: BILLED TO / META — 2-column
    // ─────────────────────────────────────────────────────────────────────────
    const cust = invoice.customer || {};
    const leftColW = 290;
    const rightColW2 = contentWidth - leftColW - 5;
    const custBoxH = 76;
    const custBoxY = Y + 2;

    // Left: Buyer
    doc.rect(ML, custBoxY, leftColW, custBoxH).fill(C.slate50).stroke(C.slate200);
    doc.fillColor(C.purple).fontSize(7.5).font('Helvetica-Bold')
      .text('BUYER (BILLED TO)', ML + 5, custBoxY + 4);
    doc.moveTo(ML + 5, custBoxY + 13).lineTo(ML + leftColW - 5, custBoxY + 13).strokeColor(C.slate200).lineWidth(0.5).stroke();
    doc.fillColor(C.slate900).fontSize(8.5).font('Helvetica-Bold')
      .text(cust.businessName || cust.name || '--', ML + 5, custBoxY + 16, { width: leftColW - 10 });
    doc.fillColor(C.slate700).fontSize(7.5).font('Helvetica')
      .text(cust.billingAddress || '--', ML + 5, custBoxY + 27, { width: leftColW - 10 });
    doc.fillColor(C.slate500).fontSize(7.5).font('Helvetica')
      .text(`GSTIN/UIN: ${cust.gstin || 'N/A'}`, ML + 5, custBoxY + 48)
      .text(`State: ${cust.state || 'Gujarat'}, Code: ${cust.stateCode || '24'}`, ML + 5, custBoxY + 57)
      .text(`Contact: ${cust.phone || '--'}`, ML + 5, custBoxY + custBoxH - 9);

    // Right: Invoice meta grid
    const rx = ML + leftColW + 5;
    doc.rect(rx, custBoxY, rightColW2, custBoxH).fill(C.slate50).stroke(C.slate200);
    const halfR = rightColW2 / 2;
    const metaRows = [
      ['Credit Note No.', invoice.creditNoteNo || '--', 'e-Way Bill No.', invoice.ewayBillNo || '--'],
      ['Dated', formatDate(invoice.invoiceDate), 'Mode/Terms of Payment', 'Bank Transfer'],
      ['State Name', cust.state || 'Gujarat', 'Code', cust.stateCode || '24'],
      ['Dispatch Doc No.', invoice.dispatchDocNo || '--', 'Destination', cust.state || 'Gujarat'],
    ];
    let metaY = custBoxY + 2;
    metaRows.forEach(([k1, v1, k2, v2]) => {
      doc.fillColor(C.slate500).fontSize(6.5).font('Helvetica')
        .text(k1, rx + 4, metaY, { width: halfR - 8 })
        .text(k2, rx + halfR + 4, metaY, { width: halfR - 8 });
      doc.fillColor(C.slate900).fontSize(7).font('Helvetica-Bold')
        .text(v1, rx + 4, metaY + 7, { width: halfR - 8 })
        .text(v2, rx + halfR + 4, metaY + 7, { width: halfR - 8 });
      metaY += 18;
    });

    Y = custBoxY + custBoxH + 6;

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 4: ITEMS TABLE
    // ─────────────────────────────────────────────────────────────────────────
    const COL = { sr: 20, img: 38, desc: 192, hsn: 52, gst: 34, qty: 50, rate: 56, per: 32, amt: 81 };
    const COL_X = {
      sr:   ML,
      img:  ML + COL.sr,
      desc: ML + COL.sr + COL.img,
      hsn:  ML + COL.sr + COL.img + COL.desc,
      gst:  ML + COL.sr + COL.img + COL.desc + COL.hsn,
      qty:  ML + COL.sr + COL.img + COL.desc + COL.hsn + COL.gst,
      rate: ML + COL.sr + COL.img + COL.desc + COL.hsn + COL.gst + COL.qty,
      per:  ML + COL.sr + COL.img + COL.desc + COL.hsn + COL.gst + COL.qty + COL.rate,
      amt:  ML + COL.sr + COL.img + COL.desc + COL.hsn + COL.gst + COL.qty + COL.rate + COL.per,
    };

    let tableY = Y;

    const drawColLines = (rowY, rowH) => {
      [COL_X.img, COL_X.desc, COL_X.hsn, COL_X.gst, COL_X.qty, COL_X.rate, COL_X.per, COL_X.amt].forEach(cx => {
        doc.moveTo(cx, rowY).lineTo(cx, rowY + rowH).strokeColor(C.slate200).lineWidth(0.4).stroke();
      });
    };

    // Header row
    const hdrH = 20;
    doc.rect(ML, tableY, contentWidth, hdrH).fill(C.purple);
    doc.fillColor(C.white).fontSize(7.5).font('Helvetica-Bold');
    doc.text('Sr.', COL_X.sr + 3, tableY + 6, { width: COL.sr - 3 });
    doc.text('IMAGE', COL_X.img + 2, tableY + 6, { width: COL.img - 4, align: 'center' });
    doc.text('Description of Goods', COL_X.desc + 2, tableY + 6, { width: COL.desc - 4 });
    doc.text('HSN/SAC', COL_X.hsn + 2, tableY + 6, { width: COL.hsn - 4, align: 'center' });
    doc.text('GST%', COL_X.gst + 2, tableY + 6, { width: COL.gst - 4, align: 'center' });
    doc.text('Quantity', COL_X.qty + 2, tableY + 6, { width: COL.qty - 4, align: 'center' });
    doc.text('Rate', COL_X.rate + 2, tableY + 6, { width: COL.rate - 4, align: 'right' });
    doc.text('Per', COL_X.per + 2, tableY + 6, { width: COL.per - 4, align: 'center' });
    doc.text('Amount', COL_X.amt + 2, tableY + 6, { width: COL.amt - 4, align: 'right' });
    tableY += hdrH;

    // Item rows
    const items = invoice.items || [];
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const rowBg = idx % 2 === 0 ? C.white : C.slate50;

      const metaLines = [];
      const jobDisplay = cleanJobDisplay(item.jobNo);
      if (jobDisplay) metaLines.push({ text: jobDisplay, font: 'Helvetica-Bold', size: 7.5, color: C.purpleMid });
      const lotParts = [];
      if (item.lotNo) lotParts.push(`Lot: ${item.lotNo}`);
      if (item.partyChallan) lotParts.push(`Vendor Challan: ${item.partyChallan}`);
      if (lotParts.length) metaLines.push({ text: lotParts.join('  |  '), font: 'Helvetica', size: 7.5, color: C.slate700 });
      const challanParts = [];
      if (item.ourChallanNo) challanParts.push(`Challan: ${item.ourChallanNo}`);
      if (item.description) challanParts.push(item.description);
      if (challanParts.length) metaLines.push({ text: challanParts.join('  |  '), font: 'Helvetica', size: 7.5, color: C.slate700 });

      doc.font('Helvetica-Bold').fontSize(8.5);
      let descH = doc.heightOfString(item.itemName || '--', { width: COL.desc - 6 });
      metaLines.forEach(m => {
        doc.font(m.font).fontSize(m.size);
        descH += doc.heightOfString(m.text, { width: COL.desc - 6 }) + 1;
      });
      const rowH = Math.max(40, descH + 12);

      doc.rect(ML, tableY, contentWidth, rowH).fill(rowBg).stroke(C.slate200);
      drawColLines(tableY, rowH);

      doc.fillColor(C.slate700).fontSize(8.5).font('Helvetica-Bold')
        .text(String(idx + 1), COL_X.sr + 3, tableY + 6, { width: COL.sr - 3 });

      // Image
      let resolvedImgPath = resolveImagePath(item.imageUrl);
      if (!resolvedImgPath && item.jobNo) {
        try {
          const nums = String(item.jobNo).match(/\d+/g) || [];
          for (const num of nums) {
            const jobDoc = await JobCard.findOne({
              $or: [{ jobNo: num }, { jobNo: `JOB NO.- ${num}` }, { jobNo: `JOB NO.-${num}` }, { jobNo: { $regex: num, $options: 'i' } }]
            }).lean();
            if (jobDoc) {
              const imgUrl = jobDoc.imageUrl1 || jobDoc.imageUrl2 || jobDoc.proofing?.artworkUrl;
              if (imgUrl) { resolvedImgPath = resolveImagePath(imgUrl); if (resolvedImgPath) break; }
            }
          }
        } catch (e) {}
      }
      if (resolvedImgPath && fs.existsSync(resolvedImgPath)) {
        try {
          const imgSz = Math.min(rowH - 6, 32);
          doc.image(resolvedImgPath, COL_X.img + 3, tableY + 3, { fit: [imgSz, imgSz], align: 'center', valign: 'center' });
        } catch (e) {}
      } else {
        doc.fillColor(C.slate200).fontSize(6.5).font('Helvetica')
          .text('N/A', COL_X.img + 2, tableY + rowH / 2 - 4, { width: COL.img - 4, align: 'center' });
      }

      // Description column
      let descTextY = tableY + 5;
      doc.fillColor(C.slate900).font('Helvetica-Bold').fontSize(8.5);
      const nameH = doc.heightOfString(item.itemName || '--', { width: COL.desc - 6 });
      doc.text(item.itemName || '--', COL_X.desc + 2, descTextY, { width: COL.desc - 6 });
      descTextY += nameH + 1;
      metaLines.forEach(m => {
        doc.font(m.font).fontSize(m.size).fillColor(m.color);
        const mH = doc.heightOfString(m.text, { width: COL.desc - 6 });
        doc.text(m.text, COL_X.desc + 2, descTextY, { width: COL.desc - 6 });
        descTextY += mH + 1;
      });

      // Right columns
      const midY = tableY + rowH / 2 - 5;
      const taxRate = item.taxRate || 18;
      doc.fillColor(C.slate700).fontSize(8).font('Helvetica')
        .text(item.hsnCode || '998821', COL_X.hsn + 2, midY, { width: COL.hsn - 4, align: 'center' })
        .text(`${taxRate}%`, COL_X.gst + 2, midY, { width: COL.gst - 4, align: 'center' });
      doc.fillColor(C.slate900).font('Helvetica-Bold').fontSize(8.5)
        .text(`${Number(item.qty || 0).toFixed(2)} ${item.unit || 'Mtrs'}`, COL_X.qty + 2, midY, { width: COL.qty - 4, align: 'center' });
      doc.font('Helvetica').fontSize(8)
        .text(Number(item.unitPrice || 0).toFixed(2), COL_X.rate + 2, midY, { width: COL.rate - 4, align: 'right' });
      doc.fillColor(C.slate500).fontSize(7.5)
        .text(item.unit || 'Mtrs', COL_X.per + 2, midY, { width: COL.per - 4, align: 'center' });
      doc.fillColor(C.slate900).font('Helvetica-Bold').fontSize(8.5)
        .text(Number(item.totalAmount || 0).toFixed(2), COL_X.amt + 2, midY, { width: COL.amt - 4, align: 'right' });

      tableY += rowH;
    }

    // CGST / SGST rows
    const taxRows = [];
    if (invoice.taxType === 'IGST') {
      taxRows.push({ label: 'IGST', rate: invoice.igstRate || 18, amount: invoice.igstAmount || 0 });
    } else {
      taxRows.push({ label: 'CGST', rate: invoice.cgstRate || 9, amount: invoice.cgstAmount || 0 });
      taxRows.push({ label: 'SGST', rate: invoice.sgstRate || 9, amount: invoice.sgstAmount || 0 });
    }
    taxRows.forEach(tr => {
      const trH = 17;
      doc.rect(ML, tableY, contentWidth, trH).fill(C.purpleLight).stroke(C.slate200);
      drawColLines(tableY, trH);
      doc.fillColor(C.purpleMid).fontSize(8).font('Helvetica-Bold')
        .text(`${tr.label} @ ${tr.rate}%`, COL_X.desc + 2, tableY + 5, { width: COL.desc + COL.hsn + COL.gst + COL.qty + COL.rate + COL.per - 4 });
      doc.fillColor(C.purple).font('Helvetica-Bold').fontSize(8.5)
        .text(Number(tr.amount).toFixed(2), COL_X.amt + 2, tableY + 4, { width: COL.amt - 4, align: 'right' });
      tableY += trH;
    });

    // Grand Total row
    const totalRowH = 22;
    doc.rect(ML, tableY, contentWidth, totalRowH).fill(C.purple);
    doc.fillColor(C.white).fontSize(9.5).font('Helvetica-Bold')
      .text('Total', COL_X.desc + 2, tableY + 6, { width: COL.desc - 4 })
      .text(`Rs. ${Number(invoice.grandTotal || 0).toFixed(2)}`, COL_X.amt + 2, tableY + 6, { width: COL.amt - 4, align: 'right' });
    tableY += totalRowH;

    // Amount in Words bar
    const wordsH = 26;
    doc.rect(ML, tableY, contentWidth, wordsH).fill(C.slate50).stroke(C.slate200);
    doc.fillColor(C.slate700).fontSize(7.5).font('Helvetica-Bold')
      .text('Amount Chargeable (in words):', ML + 5, tableY + 4);
    doc.fillColor(C.slate900).fontSize(8).font('Helvetica-Bold')
      .text(numToWords(invoice.grandTotal), ML + 5, tableY + 14, { width: contentWidth - 60 });
    const roundOffVal = Number(invoice.roundOff || 0);
    if (Math.abs(roundOffVal) > 0) {
      const signStr = roundOffVal > 0 ? '+' : '';
      doc.fillColor(C.slate500).fontSize(7.5).font('Helvetica')
        .text(`Round Off: ${signStr}${roundOffVal.toFixed(2)}`, ML + contentWidth - 120, tableY + 4, { width: 115, align: 'right' });
    }
    doc.fillColor(C.slate500).fontSize(7).font('Helvetica')
      .text('E. & O.E.', ML + contentWidth - 50, tableY + 14, { width: 45, align: 'right' });
    tableY += wordsH + 8;

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 5: GST TAX SUMMARY TABLE
    // ─────────────────────────────────────────────────────────────────────────
    const hsnMap = {};
    (invoice.items || []).forEach(it => {
      const hsn = it.hsnCode || '998821';
      const rate = it.taxRate || 18;
      const key = `${hsn}_${rate}`;
      if (!hsnMap[key]) hsnMap[key] = { hsn, rate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      const taxable = Number(it.totalAmount || 0);
      hsnMap[key].taxable += taxable;
      if (invoice.taxType === 'IGST') {
        hsnMap[key].igst += taxable * (rate / 100);
      } else {
        hsnMap[key].cgst += taxable * (rate / 2 / 100);
        hsnMap[key].sgst += taxable * (rate / 2 / 100);
      }
    });
    const hsnRows = Object.values(hsnMap);

    const taxCW = { hsn: 58, taxable: 88, cgstR: 38, cgstA: 72, sgstR: 38, sgstA: 72 };
    taxCW.total = contentWidth - taxCW.hsn - taxCW.taxable - taxCW.cgstR - taxCW.cgstA - taxCW.sgstR - taxCW.sgstA;
    const taxCX = {
      hsn:     ML,
      taxable: ML + taxCW.hsn,
      cgstR:   ML + taxCW.hsn + taxCW.taxable,
      cgstA:   ML + taxCW.hsn + taxCW.taxable + taxCW.cgstR,
      sgstR:   ML + taxCW.hsn + taxCW.taxable + taxCW.cgstR + taxCW.cgstA,
      sgstA:   ML + taxCW.hsn + taxCW.taxable + taxCW.cgstR + taxCW.cgstA + taxCW.sgstR,
      total:   ML + taxCW.hsn + taxCW.taxable + taxCW.cgstR + taxCW.cgstA + taxCW.sgstR + taxCW.sgstA,
    };

    const taxHdrH = 18;
    doc.rect(ML, tableY, contentWidth, taxHdrH).fill(C.purple);
    doc.fillColor(C.white).fontSize(7.5).font('Helvetica-Bold')
      .text('HSN/SAC', taxCX.hsn + 2, tableY + 5, { width: taxCW.hsn - 4 })
      .text('Taxable Value', taxCX.taxable + 2, tableY + 5, { width: taxCW.taxable - 4, align: 'right' })
      .text('CGST Rate', taxCX.cgstR + 2, tableY + 5, { width: taxCW.cgstR - 4, align: 'center' })
      .text('CGST Amount', taxCX.cgstA + 2, tableY + 5, { width: taxCW.cgstA - 4, align: 'right' })
      .text('SGST Rate', taxCX.sgstR + 2, tableY + 5, { width: taxCW.sgstR - 4, align: 'center' })
      .text('SGST Amount', taxCX.sgstA + 2, tableY + 5, { width: taxCW.sgstA - 4, align: 'right' })
      .text('Total Tax', taxCX.total + 2, tableY + 5, { width: taxCW.total - 4, align: 'right' });
    tableY += taxHdrH;

    let totalTaxable = 0, totalCgst = 0, totalSgst = 0, totalTax = 0;
    hsnRows.forEach((row, i) => {
      const rH = 15;
      doc.rect(ML, tableY, contentWidth, rH).fill(i % 2 === 0 ? C.white : C.slate50).stroke(C.slate200);
      const rowTax = row.cgst + row.sgst + row.igst;
      totalTaxable += row.taxable; totalCgst += row.cgst; totalSgst += row.sgst; totalTax += rowTax;
      doc.fillColor(C.slate700).fontSize(7.5).font('Helvetica')
        .text(row.hsn, taxCX.hsn + 2, tableY + 4, { width: taxCW.hsn - 4 })
        .text(row.taxable.toFixed(2), taxCX.taxable + 2, tableY + 4, { width: taxCW.taxable - 4, align: 'right' })
        .text(`${row.rate / 2}%`, taxCX.cgstR + 2, tableY + 4, { width: taxCW.cgstR - 4, align: 'center' })
        .text(row.cgst.toFixed(2), taxCX.cgstA + 2, tableY + 4, { width: taxCW.cgstA - 4, align: 'right' })
        .text(`${row.rate / 2}%`, taxCX.sgstR + 2, tableY + 4, { width: taxCW.sgstR - 4, align: 'center' })
        .text(row.sgst.toFixed(2), taxCX.sgstA + 2, tableY + 4, { width: taxCW.sgstA - 4, align: 'right' });
      doc.fillColor(C.slate900).font('Helvetica-Bold')
        .text(rowTax.toFixed(2), taxCX.total + 2, tableY + 4, { width: taxCW.total - 4, align: 'right' });
      tableY += rH;
    });

    const taxTotH = 17;
    doc.rect(ML, tableY, contentWidth, taxTotH).fill(C.purpleLight).stroke(C.slate200);
    doc.fillColor(C.purple).fontSize(8).font('Helvetica-Bold')
      .text('Total', taxCX.hsn + 2, tableY + 4, { width: taxCW.hsn - 4 })
      .text(totalTaxable.toFixed(2), taxCX.taxable + 2, tableY + 4, { width: taxCW.taxable - 4, align: 'right' })
      .text(totalCgst.toFixed(2), taxCX.cgstA + 2, tableY + 4, { width: taxCW.cgstA - 4, align: 'right' })
      .text(totalSgst.toFixed(2), taxCX.sgstA + 2, tableY + 4, { width: taxCW.sgstA - 4, align: 'right' })
      .text(totalTax.toFixed(2), taxCX.total + 2, tableY + 4, { width: taxCW.total - 4, align: 'right' });
    tableY += taxTotH + 3;

    doc.fillColor(C.slate500).fontSize(7.5).font('Helvetica')
      .text('Tax Amount (in words):', ML + 2, tableY + 2)
      .text(numToWords(totalTax), ML + 104, tableY + 2, { width: contentWidth - 108 });
    tableY += 14;

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 6: FOOTER — Bank Details (left) | Authorised Signatory (right)
    // ─────────────────────────────────────────────────────────────────────────
    const footerY = PH - 85;
    doc.moveTo(ML, footerY - 5).lineTo(PW - MR, footerY - 5).strokeColor(C.slate200).lineWidth(0.8).stroke();

    const leftFW = 320;
    const rightFW = contentWidth - leftFW - 10;
    const rightFX = ML + leftFW + 10;

    doc.fillColor(C.slate900).fontSize(8).font('Helvetica-Bold')
      .text("Company's Bank Details", ML + 2, footerY);
    doc.fillColor(C.slate700).fontSize(8).font('Helvetica')
      .text(`Bank Name: ${config.companyBankName || 'ICICI Bank'}`, ML + 2, footerY + 13)
      .text(`A/c No.: ${config.companyAccountNo || 'N/A'}`, ML + 2, footerY + 23)
      .text(`Branch & IFS Code: ${config.companyIfscCode || 'N/A'}`, ML + 2, footerY + 33);

    doc.fillColor(C.slate500).fontSize(6.5).font('Helvetica')
      .text('Terms & Conditions:', ML + 2, footerY + 48)
      .text(companyTerms, ML + 2, footerY + 57, { width: leftFW });

    doc.fillColor(C.slate900).fontSize(8.5).font('Helvetica-Bold')
      .text(`for ${companyName.toUpperCase()}`, rightFX, footerY, { width: rightFW, align: 'right' });
    doc.fillColor(C.slate500).fontSize(7.5).font('Helvetica')
      .text('Authorised Signatory', rightFX, footerY + 50, { width: rightFW, align: 'right' });

    doc.moveTo(ML, PH - 22).lineTo(PW - MR, PH - 22).strokeColor(C.slate200).lineWidth(0.5).stroke();
    doc.fillColor(C.slate500).fontSize(7).font('Helvetica')
      .text('This is a Computer Generated Document', ML, PH - 16, { width: contentWidth, align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Download Invoice PDF Error:', error);
    res.status(500).send('Error generating PDF invoice');
  }
};
