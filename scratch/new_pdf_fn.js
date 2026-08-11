// ── 9. DOWNLOAD INVOICE PDF ──────────────────────────────────────────────────
const downloadInvoicePdf = async (req, res) => {
  try {
    const invoice = await BillingInvoice.findById(req.params.id).lean();
    if (!invoice) return res.status(404).send('Invoice not found');

    const includeDuplicate = req.query.duplicate === 'true';

    const PrintConfig = require('../db/models/printConfig.model');
    const JobCard = require('../db/models/jobCard.model');
    const config = await PrintConfig.findOne({ isConfig: true }).lean() || {};

    const companyName    = config.companyName    || 'ELITE DIGITAL PRINTS';
    const companyGstin   = config.companyGstin   || '24AAAFE1234F1Z5';
    const companyAddress = config.companyAddress  || 'G.F., PLOT NO-B/37, Siddheshwar Soc., Punagam Main Road, Surat - 395006';
    const companyPhone   = config.companyPhone   || '+91 98790 00000';
    const companyState   = config.companyState   || 'Gujarat';
    const companyStateCode = config.companyStateCode || '24';
    const companyTerms   = invoice.terms || config.companyTerms ||
      'Payment due within 30 days from invoice date. Subject to Surat jurisdiction.';
    const bankName   = config.companyBankName  || 'ICICI Bank';
    const bankAcNo   = config.companyAccountNo || 'N/A';
    const bankIfsc   = config.companyIfscCode  || 'N/A';

    const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: true, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice_${invoice.invoiceNo}.pdf"`);
    doc.pipe(res);

    const PW = 595.28, PH = 841.89;
    const PAD = 18;
    const CW = PW - PAD * 2;
    const logoPath = path.join(__dirname, 'Logo.png');

    // ── HELPERS ─────────────────────────────────────────────────────────────────
    const formatDate = (d) => {
      if (!d) return '--';
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return `${String(dt.getDate()).padStart(2,'0')}-${String(dt.getMonth()+1).padStart(2,'0')}-${dt.getFullYear()}`;
    };

    const resolveImagePath = (urlOrPath) => {
      if (!urlOrPath) return null;
      let filename = urlOrPath.replace(/^.*\/designs\//, '').replace(/^\/designs\//, '').trim();
      try { filename = decodeURIComponent(filename); } catch(e) {}
      const dirs = [
        path.join(__dirname, '../../elite_edition_images'),
        path.join(__dirname, '../../../elite_edition_images'),
        '/home/ubuntu/elite_edition_images',
        path.join(__dirname, '../elite_edition_images'),
        path.join(__dirname, '../../Digital print'),
        '/home/ubuntu/Digital print'
      ];
      for (const d of dirs) {
        if (!fs.existsSync(d)) continue;
        const direct = path.join(d, filename);
        if (fs.existsSync(direct)) return direct;
        try {
          const f = fs.readdirSync(d).find(x => x.toLowerCase() === filename.toLowerCase());
          if (f) return path.join(d, f);
        } catch(e) {}
      }
      return null;
    };

    const cleanJobDisplay = (jobStr) => {
      if (!jobStr) return '';
      const matches = String(jobStr).match(/\d+/g);
      if (matches && matches.length > 0) {
        const unique = [...new Set(matches)];
        return unique.length === 1 ? `Job Card: ${unique[0]}` : `Job Cards: ${unique.join(', ')}`;
      }
      return String(jobStr).replace(/JOB NO\.-?\s*/gi,'').replace(/Job\s*#?\s*/gi,'').trim();
    };

    // ── COLUMN WIDTHS ────────────────────────────────────────────────────────────
    // Sr | IMG | Description | HSN | GST% | Qty | Rate | Per | Amount
    const COL = [18, 100, 132, 54, 34, 60, 60, 30, 71.28]; // sum=559.28 ✓
    const colX = COL.reduce((acc, w, i) => { acc.push((acc[i-1]||PAD) + (i>0?COL[i-1]:0)); return acc; }, []);

    // ── PRE-LOAD IMAGES ──────────────────────────────────────────────────────────
    const itemImages = [];
    const items = invoice.items || [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let imgPath = resolveImagePath(item.imageUrl);
      if (!imgPath && item.jobNo) {
        try {
          const nums = String(item.jobNo).match(/\d+/g) || [];
          for (const num of nums) {
            const jd = await JobCard.findOne({ $or: [
              { jobNo: num }, { jobNo: `JOB NO.- ${num}` },
              { jobNo: `JOB NO.-${num}` }, { jobNo: { $regex: num, $options: 'i' } }
            ]}).lean();
            if (jd) {
              const url = jd.imageUrl1 || jd.imageUrl2 || jd.proofing?.artworkUrl;
              if (url) { imgPath = resolveImagePath(url); if (imgPath) break; }
            }
          }
        } catch(e) {}
      }
      itemImages.push(imgPath);
    }

    // ── TAX COMPUTATION ──────────────────────────────────────────────────────────
    const hsnMap = {};
    items.forEach(it => {
      const hsn  = it.hsnCode || '998821';
      const rate = it.taxRate || 18;
      const key  = `${hsn}_${rate}`;
      if (!hsnMap[key]) hsnMap[key] = { hsn, rate, taxable: 0, cgst: 0, sgst: 0 };
      const taxable = Number(it.totalAmount || 0);
      hsnMap[key].taxable += taxable;
      hsnMap[key].cgst   += taxable * (rate / 2 / 100);
      hsnMap[key].sgst   += taxable * (rate / 2 / 100);
    });
    const hsnRows      = Object.values(hsnMap);
    const totalTaxable = hsnRows.reduce((s, r) => s + r.taxable, 0);
    const totalCgst    = hsnRows.reduce((s, r) => s + r.cgst,    0);
    const totalSgst    = hsnRows.reduce((s, r) => s + r.sgst,    0);
    const totalTax     = totalCgst + totalSgst;

    // ── PAGE RENDERER ────────────────────────────────────────────────────────────
    // bw = true → renders entire page in black & white (duplicate copy)
    const renderPage = (copyLabel, bw = false) => {
      // Colour palette — overridden to grayscale if bw=true
      const c = (color, bwFallback) => bw ? (bwFallback || '#000000') : color;

      const PRP  = c('#4c1d95', '#000000');  // deep purple   → black in B&W
      const PRPM = c('#6b21a8', '#000000');  // mid purple    → black in B&W
      const PRPL = c('#ede9fe', '#f0f0f0');  // light purple  → light gray
      const S900 = c('#000000', '#000000');  // pure black
      const S700 = c('#000000', '#000000');  // pure black (was gray)
      const S500 = c('#000000', '#000000');  // pure black (was gray)
      const S200 = c('#e2e8f0', '#cccccc');
      const S50  = c('#f8fafc', '#f9f9f9');
      const WHT  = '#ffffff';

      let Y = PAD;

      // ── OUTER BORDER ──────────────────────────────────────────────────────────
      doc.rect(PAD, Y, CW, PH - PAD * 2).stroke(S200);

      // ── TOP ACCENT BAR ────────────────────────────────────────────────────────
      doc.rect(PAD, Y, CW, 4).fill(PRP);


      Y += 4;


      // ── HEADER: LOGO LEFT / COMPANY RIGHT ─────────────────────────────────────
      const hdrH = 62;
      doc.rect(PAD, Y, CW, hdrH).fill(S50);

      if (fs.existsSync(logoPath)) {
        try { doc.image(logoPath, PAD + 6, Y + 6, { width: 110, height: 50, fit: [110, 50] }); } catch(e) {}
      }

      doc.fillColor(S900).fontSize(12).font('Helvetica-Bold')
        .text(companyName.toUpperCase(), PAD + 120, Y + 6, { width: CW - 126, align: 'right' });
      doc.fillColor(S500).fontSize(8).font('Helvetica')
        .text('G.F., PLOT NO-B/37, SIDDHESHWAR SOC., PUNAGAM MAIN ROAD, SURAT - 395010', PAD + 120, Y + 22, { width: CW - 126, align: 'right' })
        .text(`GST: 24AANFE0044M   PHONE: +91 99098 66667   STATE: GUJARAT, CODE: 24`,
              PAD + 120, Y + 34, { width: CW - 126, align: 'right' });

      Y += hdrH;

      // ── INVOICE TITLE ─────────────────────────────────────────────────────────
      const titleH = 22;
      doc.rect(PAD, Y, CW, titleH).fill(PRPL);
      doc.fillColor(PRP).fontSize(13).font('Helvetica-Bold').text('INVOICE', PAD + 8, Y + 5);

      doc.fillColor(S900).fontSize(10).font('Helvetica-Bold')
        .text(`Invoice No: ${invoice.invoiceNo}`, PAD + 140, Y + 5, { width: 220 })
        .text(`Date: ${formatDate(invoice.invoiceDate)}`, PAD + CW - 180, Y + 5, { width: 175, align: 'right' });
      Y += titleH;

      // ── BUYER / SELLER INFO ───────────────────────────────────────────────────
      const cust   = invoice.customer || {};
      const infoH  = 72;
      const halfCW = Math.floor(CW / 2);

      // Left: Buyer
      doc.rect(PAD, Y, halfCW, infoH).fill(WHT).stroke(S200);
      doc.rect(PAD, Y, halfCW, 14).fill(PRP);
      doc.fillColor(WHT).fontSize(8.5).font('Helvetica-Bold')
        .text('BUYER (BILLED TO)', PAD + 5, Y + 3, { width: halfCW - 10 });
      doc.fillColor(S900).fontSize(10).font('Helvetica-Bold')
        .text(cust.businessName || cust.name || '--', PAD + 5, Y + 16, { width: halfCW - 10 });
      doc.fillColor(S700).fontSize(8.5).font('Helvetica')
        .text(cust.billingAddress || '--', PAD + 5, Y + 28, { width: halfCW - 10 });
      doc.fillColor(S500).fontSize(8).font('Helvetica')
        .text(`GST: ${cust.gstin || 'N/A'}`, PAD + 5, Y + 46)
        .text(`State: ${cust.state || 'Gujarat'}, Code: ${cust.stateCode || '24'}`, PAD + 5, Y + 56);

      // Right: Seller/meta
      const rx = PAD + halfCW;
      doc.rect(rx, Y, CW - halfCW, infoH).fill(WHT).stroke(S200);
      doc.rect(rx, Y, CW - halfCW, 14).fill(PRP);
      doc.fillColor(WHT).fontSize(8.5).font('Helvetica-Bold')
        .text('SELLER / DISPATCH DETAILS', rx + 5, Y + 3, { width: CW - halfCW - 10 });
      const metaW = (CW - halfCW) / 2 - 5;
      const pairs = [
        ['Order No.', invoice.orderNo || '--', 'Invoice No.', invoice.invoiceNo || '--'],
        ['Dispatch Doc', invoice.dispatchDocNo || '--', 'Challan No.', invoice.ourChallanNo || invoice.challanNo || '--'],
        ['Terms of Delivery', 'By Road', 'Place of Supply', `${cust.state || 'Gujarat'} (${cust.stateCode || '24'})`],
      ];
      let metaY = Y + 16;
      pairs.forEach(([k1, v1, k2, v2]) => {
        doc.fillColor(S500).fontSize(7.5).font('Helvetica')
          .text(k1 + ':', rx + 4, metaY, { width: metaW })
          .text(k2 + ':', rx + metaW + 10, metaY, { width: metaW });
        doc.fillColor(S900).fontSize(8.5).font('Helvetica-Bold')
          .text(v1, rx + 4, metaY + 9, { width: metaW })
          .text(v2, rx + metaW + 10, metaY + 9, { width: metaW });
        metaY += 18;
      });
      Y += infoH;

      // ── DYNAMIC 1-PAGE TABLE HEIGHT CALCULATION ─────────────────────────────
      const fixedTopH = PAD + 4 + 52 + 22 + 72 + 22; // 190
      const bottomSummaryH = (hsnRows.length * 48) + 22 + 28 + 18 + (hsnRows.length * 16) + 17 + 16 + 78 + PAD;
      const availableItemsH = PH - fixedTopH - bottomSummaryH;
      const minRowHPerItem = Math.floor(availableItemsH / Math.max(items.length, 1));

      // ── ITEMS TABLE HEADER ───────────────────────────────────────────────────
      const tblHdrH = 22;
      doc.rect(PAD, Y, CW, tblHdrH).fill(PRP);
      doc.fillColor(WHT).fontSize(9.5).font('Helvetica-Bold');
      const hdrs   = ['Sr.', 'Image', 'Description of Goods', 'HSN', 'GST%', 'Qty', 'Rate', 'Per', 'Amount'];
      const aligns = ['left','center','left','center','center','center','right','center','right'];
      hdrs.forEach((h, i) => doc.text(h, colX[i] + 2, Y + 7, { width: COL[i] - 4, align: aligns[i] }));
      Y += tblHdrH;

      const drawColSeps = (rowY, rowH) => {
        colX.slice(1).forEach(cx => {
          doc.moveTo(cx, rowY).lineTo(cx, rowY + rowH).strokeColor(S200).lineWidth(0.4).stroke();
        });
      };

      // ── ITEM ROWS ────────────────────────────────────────────────────────────
      items.forEach((item, idx) => {
        const rowBg = idx % 2 === 0 ? WHT : S50;

        const metaLines = [];
        const jd = cleanJobDisplay(item.jobNo);
        if (jd) metaLines.push({ text: jd, font: 'Helvetica-Bold', size: 8.5, color: PRPM });
        const p1 = [];
        if (item.lotNo)        p1.push(`Lot: ${item.lotNo}`);
        if (item.partyChallan) p1.push(`Vendor Challan: ${item.partyChallan}`);
        if (p1.length) metaLines.push({ text: p1.join('  |  '), font: 'Helvetica', size: 8, color: S700 });
        const p2 = [];
        if (item.description)  p2.push(item.description);
        if (p2.length) metaLines.push({ text: p2.join('  |  '), font: 'Helvetica', size: 8, color: S700 });
        if (item.fabric) metaLines.push({ text: `Fabric: ${item.fabric}`, font: 'Helvetica', size: 8, color: S500 });

        doc.font('Helvetica-Bold').fontSize(11);
        let descH = doc.heightOfString(item.itemName || '--', { width: COL[2] - 6 });
        metaLines.forEach(m => {
          doc.font(m.font).fontSize(m.size);
          descH += doc.heightOfString(m.text, { width: COL[2] - 6 }) + 2;
        });
        const rowH = Math.max(minRowHPerItem, descH + 14);

        doc.rect(PAD, Y, CW, rowH).fill(rowBg).stroke(S200);
        drawColSeps(Y, rowH);

        doc.fillColor(S700).fontSize(10).font('Helvetica-Bold')
          .text(String(idx + 1), colX[0] + 3, Y + 6, { width: COL[0] - 3 });

        // Image — large thumbnail up to 110px
        const imgPath = itemImages[idx];
        const imgMaxW = COL[1] - 6; // 94px
        const imgMaxH = Math.min(rowH - 10, 115);
        if (imgPath && fs.existsSync(imgPath)) {
          try {
            doc.image(imgPath, colX[1] + 3, Y + 5, { fit: [imgMaxW, imgMaxH] });
          } catch(e) {
            doc.fillColor(S200).fontSize(7).font('Helvetica')
              .text('N/A', colX[1], Y + 12, { width: COL[1], align: 'center' });
          }
        } else {
          doc.fillColor(S200).fontSize(7).font('Helvetica')
            .text('N/A', colX[1], Y + 12, { width: COL[1], align: 'center' });
        }

        let textY = Y + 5;
        doc.fillColor(S900).font('Helvetica').fontSize(11);
        doc.text(item.itemName || '--', colX[2] + 3, textY, { width: COL[2] - 6 });
        textY += doc.heightOfString(item.itemName || '--', { width: COL[2] - 6 }) + 2;
        metaLines.forEach(m => {
          doc.font(m.font).fontSize(m.size).fillColor(m.color);
          doc.text(m.text, colX[2] + 3, textY, { width: COL[2] - 6 });
          textY += doc.heightOfString(m.text, { width: COL[2] - 6 }) + 2;
        });

        const numY    = Y + 6;
        const taxRate = item.taxRate || 18;
        let u = (item.unit || 'MTR').trim();
        if (/meter|mtr/i.test(u)) u = 'MTR';
        doc.fillColor(S700).font('Helvetica').fontSize(9.5)
          .text(item.hsnCode || '998821', colX[3] + 2, numY, { width: COL[3] - 4, align: 'center' })
          .text(`${taxRate}%`,            colX[4] + 2, numY, { width: COL[4] - 4, align: 'center' });
        doc.fillColor(S900).font('Helvetica-Bold').fontSize(10)
          .text(`${Number(item.qty||0).toFixed(2)} ${u}`, colX[5]+2, numY, { width: COL[5]-4, align:'center' })
          .text(Number(item.unitPrice||0).toFixed(2), colX[6]+2, numY, { width: COL[6]-4, align:'right' });
        doc.fillColor(S500).font('Helvetica-Bold').fontSize(8.5)
          .text(u, colX[7]+2, numY, { width: COL[7]-4, align:'center' });
        doc.fillColor(S900).font('Helvetica-Bold').fontSize(10.5)
          .text(Number(item.totalAmount||0).toFixed(2), colX[8]+2, numY, { width: COL[8]-4, align:'right' });
        Y += rowH;
      });

      // ── CGST / SGST ROWS ─────────────────────────────────────────────────────
      hsnRows.forEach(row => {
        const halfRate = row.rate / 2;
        ['CGST', 'SGST'].forEach(type => {
          const amt = type === 'CGST' ? row.cgst : row.sgst;
          const trH = 16;
          doc.rect(PAD, Y, CW, trH).fill(PRPL).stroke(S200);
          doc.fillColor(PRPM).fontSize(8.5).font('Helvetica-Bold')
            .text(`${type} @ ${halfRate}%`, colX[6] - 20, Y + 4, { width: COL[6] + COL[7] + 16, align: 'right' });
          doc.fillColor(PRP).font('Helvetica-Bold').fontSize(9)
            .text(amt.toFixed(2), colX[8] + 2, Y + 4, { width: COL[8] - 4, align: 'right' });
          Y += trH;
        });
      });

      // ── ROUND OFF ROW ────────────────────────────────────────────────────────
      const roundOff = Number(invoice.roundOff || 0);
      if (Math.abs(roundOff) > 0) {
        const roH = 16;
        doc.rect(PAD, Y, CW, roH).fill(PRPL).stroke(S200);
        doc.fillColor(S900).fontSize(8.5).font('Helvetica-Bold')
          .text('Round Off', colX[6] - 20, Y + 4, { width: COL[6] + COL[7] + 16, align: 'right' });
        doc.fillColor(S900).font('Helvetica-Bold').fontSize(9)
          .text(`${roundOff > 0 ? '+' : ''}${roundOff.toFixed(2)}`, colX[8] + 2, Y + 4, { width: COL[8] - 4, align: 'right' });
        Y += roH;
      }

      // ── GRAND TOTAL ───────────────────────────────────────────────────────────
      const totH = 22;
      doc.rect(PAD, Y, CW, totH).fill(PRP);
      doc.fillColor(WHT).fontSize(10).font('Helvetica-Bold')
        .text('Total', colX[6] - 20, Y + 6, { width: COL[6] + COL[7] + 16, align: 'right' })
        .text(`Rs. ${Number(invoice.grandTotal||0).toFixed(2)}`, colX[8] + 2, Y + 6, { width: COL[8]-4, align: 'right' });
      Y += totH;

      // ── AMOUNT IN WORDS ───────────────────────────────────────────────────────
      const wordsH = 28;
      doc.rect(PAD, Y, CW, wordsH).fill(S50).stroke(S200);
      doc.fillColor(S700).fontSize(7.5).font('Helvetica-Bold')
        .text('Amount Chargeable (in words):', PAD + 5, Y + 4);
      doc.fillColor(S900).fontSize(8.5).font('Helvetica-Bold')
        .text(numToWords(invoice.grandTotal), PAD + 5, Y + 14, { width: CW - 80 });
      doc.fillColor(S500).fontSize(7).font('Helvetica')
        .text('E. & O.E.', PAD + CW - 55, Y + 14, { width: 50, align: 'right' });
      Y += wordsH;

      // ── 9. GST TAX SUMMARY TABLE ─────────────────────────────────────────────
      const TC = [58, 86, 44, 74, 44, 74];
      TC.push(CW - TC.reduce((a,b) => a+b, 0));
      const TX = TC.reduce((acc, w, i) => { acc.push((acc[i-1]||PAD) + (i>0?TC[i-1]:0)); return acc; }, []);

      const tHdrH2 = 18;
      doc.rect(PAD, Y, CW, tHdrH2).fill(PRP);
      doc.fillColor(WHT).fontSize(7.5).font('Helvetica-Bold');
      ['HSN','Taxable Value','CGST %','CGST Amount','SGST %','SGST Amount','Total Tax'].forEach((h, i) => {
        const align = i === 0 ? 'left' : (i === 2 || i === 4 ? 'center' : 'right');
        doc.text(h, TX[i] + 2, Y + 5, { width: TC[i] - 4, align });
      });
      Y += tHdrH2;

      hsnRows.forEach((row, i) => {
        const rH = 16;
        doc.rect(PAD, Y, CW, rH).fill(i % 2 === 0 ? WHT : S50).stroke(S200);
        const halfRate = row.rate / 2;
        doc.fillColor(S700).fontSize(8).font('Helvetica')
          .text(row.hsn, TX[0]+2, Y+4, { width: TC[0]-4 })
          .text(row.taxable.toFixed(2), TX[1]+2, Y+4, { width: TC[1]-4, align:'right' })
          .text(`${halfRate}%`, TX[2]+2, Y+4, { width: TC[2]-4, align:'center' })
          .text(row.cgst.toFixed(2), TX[3]+2, Y+4, { width: TC[3]-4, align:'right' })
          .text(`${halfRate}%`, TX[4]+2, Y+4, { width: TC[4]-4, align:'center' })
          .text(row.sgst.toFixed(2), TX[5]+2, Y+4, { width: TC[5]-4, align:'right' });
        doc.fillColor(S900).font('Helvetica-Bold')
          .text((row.cgst+row.sgst).toFixed(2), TX[6]+2, Y+4, { width: TC[6]-4, align:'right' });
        Y += rH;
      });

      // Tax totals row
      const tTotH = 17;
      doc.rect(PAD, Y, CW, tTotH).fill(PRPL).stroke(S200);
      doc.fillColor(PRP).fontSize(8.5).font('Helvetica-Bold')
        .text('Total', TX[0]+2, Y+4, { width: TC[0]-4 })
        .text(totalTaxable.toFixed(2), TX[1]+2, Y+4, { width: TC[1]-4, align:'right' })
        .text(totalCgst.toFixed(2), TX[3]+2, Y+4, { width: TC[3]-4, align:'right' })
        .text(totalSgst.toFixed(2), TX[5]+2, Y+4, { width: TC[5]-4, align:'right' })
        .text(totalTax.toFixed(2), TX[6]+2, Y+4, { width: TC[6]-4, align:'right' });
      Y += tTotH + 3;

      doc.fillColor(S500).fontSize(7.5).font('Helvetica')
        .text('Tax Amount (in words):', PAD+2, Y+2)
        .text(numToWords(totalTax), PAD+105, Y+2, { width: CW-109 });
      Y += 16;

      // ── FOOTER ────────────────────────────────────────────────────────────────
      const footerY = PH - PAD - 70;
      doc.moveTo(PAD, footerY).lineTo(PAD+CW, footerY).strokeColor(S200).lineWidth(0.6).stroke();

      const leftFW = 300;
      const rightFX = PAD + leftFW + 8;
      const rightFW = CW - leftFW - 8;

      doc.fillColor(S900).fontSize(8).font('Helvetica-Bold')
        .text("Company's Bank Details:", PAD+4, footerY+5);
      doc.fillColor(S700).fontSize(8).font('Helvetica')
        .text(`Bank Name: ${bankName}`, PAD+4, footerY+16)
        .text(`A/c No.: ${bankAcNo}`, PAD+4, footerY+26)
        .text(`Branch & IFS Code: ${bankIfsc}`, PAD+4, footerY+36);
      doc.fillColor(S500).fontSize(6.5).font('Helvetica')
        .text('Terms & Conditions:', PAD+4, footerY+50)
        .text(companyTerms, PAD+4, footerY+58, { width: leftFW });

      doc.fillColor(S900).fontSize(8.5).font('Helvetica-Bold')
        .text(`for ${companyName.toUpperCase()}`, rightFX, footerY+5, { width: rightFW, align:'right' });
      doc.moveTo(rightFX + rightFW - 100, footerY + 48).lineTo(rightFX + rightFW, footerY + 48)
        .strokeColor(S500).lineWidth(0.5).stroke();
      doc.fillColor(S500).fontSize(8).font('Helvetica')
        .text('Authorised Signatory', rightFX, footerY+50, { width: rightFW, align:'right' });

      const bottomNoteY = PH - PAD - 14;
      doc.moveTo(PAD, bottomNoteY).lineTo(PAD+CW, bottomNoteY).strokeColor(S200).lineWidth(0.4).stroke();
      doc.fillColor(S500).fontSize(7).font('Helvetica')
        .text('This is a Computer Generated Document', PAD, bottomNoteY+3, { width: CW, align:'center' });
    };

    // ── RENDER PAGES ──────────────────────────────────────────────────────────
    // Page 1: Colourful original
    renderPage('ORIGINAL FOR BUYER', false);

    // Page 2 (only if duplicate requested): Black & White duplicate
    if (includeDuplicate) {
      doc.addPage();
      renderPage('DUPLICATE COPY', true);
    }

    doc.end();

  } catch (error) {
    console.error('Download Invoice PDF Error:', error);
    res.status(500).send('Error generating PDF invoice');
  }
};
