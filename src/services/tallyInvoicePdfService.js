/**
 * Tally GST Tax Invoice Vector PDF Generator
 * Renders pixel-accurate Tally Prime GST Tax Invoices in compact structured box-grid layout
 * Supports Issuing Company Brand Identity & Palette (Original) and crisp Black/White (Duplicate)
 */

const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Central Brand Color registry for all companies
// Elite Digital Print primary accent: Deep Midnight Navy (#1A233A)
const COMPANY_BRAND_COLORS = {
  'Elite Digital Print': '#1A233A', // EDP (Deep Midnight Navy)
  'Elite Stitching': '#059669',     // ES (Emerald Green)
  'Elite Edition': '#7c3aed',       // EE (Royal Violet)
  'Elite Fabtex': '#d97706',        // EF (Amber Orange)
  'Elite Online': '#4f46e5',        // EON (Indigo)
  'Sobise': '#e11d48',              // SO (Rose Red)
  'Ethno wear': '#8b5a2b',          // EW (Warm Brown)
  'Yamunaji': '#0284c7',            // YJ (Sky Blue)
  'Yamunaji Creation': '#0284c7',
  'EXEDP': '#475569'                // EXEDP (Slate Gray)
};

function getCompanyBrandColor(entityName, customColor) {
  if (customColor && String(customColor).startsWith('#')) return customColor;
  const raw = String(entityName || '').trim();
  if (COMPANY_BRAND_COLORS[raw]) return COMPANY_BRAND_COLORS[raw];
  const norm = raw.toLowerCase().replace(/[\s_-]+/g, '');
  if (norm === 'ethnowear' || norm === 'ew') return '#8b5a2b';
  if (norm === 'yamunaji' || norm === 'yj' || norm === 'yamunajicreation') return '#0284c7';
  if (norm === 'elitefabtex' || norm === 'ef' || norm === 'fabtex') return '#d97706';
  if (norm === 'eliteedition' || norm === 'ee') return '#7c3aed';
  if (norm === 'elitestitching' || norm === 'es' || norm === 'stitching') return '#059669';
  if (norm === 'elitedigitalprint' || norm === 'elitedigitalprints' || norm === 'edp' || norm === 'digitalprint') return '#1A233A';
  if (norm === 'sobise' || norm === 'so') return '#e11d48';
  if (norm === 'eliteonline' || norm === 'eon' || norm === 'eo') return '#4f46e5';
  if (norm === 'exedp' || norm === 'ex-edp') return '#475569';
  return '#1A233A';
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

function tintColor(hex, factor = 0.05) {
  try {
    const { r, g, b } = hexToRgb(hex);
    const tr = Math.round(r * factor + 255 * (1 - factor));
    const tg = Math.round(g * factor + 255 * (1 - factor));
    const tb = Math.round(b * factor + 255 * (1 - factor));
    return `#${((1 << 24) + (tr << 16) + (tg << 8) + tb).toString(16).slice(1)}`;
  } catch (e) {
    return '#f1f5f9';
  }
}

function numToWords(n) {
  const num = Math.round(Math.abs(Number(n) || 0));
  if (num === 0) return 'INR Zero Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(val) {
    if (val === 0) return '';
    if (val < 20) return a[val] + ' ';
    if (val < 100) return b[Math.floor(val / 10)] + (val % 10 !== 0 ? ' ' + a[val % 10] : '') + ' ';
    if (val < 1000) return a[Math.floor(val / 100)] + ' Hundred ' + inWords(val % 100);
    if (val < 100000) return inWords(Math.floor(val / 1000)) + 'Thousand ' + inWords(val % 1000);
    if (val < 10000000) return inWords(Math.floor(val / 100000)) + 'Lakh ' + inWords(val % 100000);
    return inWords(Math.floor(val / 10000000)) + 'Crore ' + inWords(val % 10000000);
  }

  const words = inWords(num).trim();
  return `INR ${words} Only`;
}

function formatDate(d) {
  if (!d) return '--';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const day = dt.getDate();
  const m = months[dt.getMonth()];
  const y = String(dt.getFullYear()).slice(-2);
  return `${day}-${m}-${y}`;
}

function resolveCompanyLogo(resolvedCompany) {
  const norm = String(resolvedCompany || '').toLowerCase().replace(/[\s_-]+/g, '');
  if (norm.includes('digitalprint') || norm === 'edp' || norm === 'elitedigitalprint') {
    const candidates = [
      path.join(__dirname, '../controllers/DigitalLogo.png'),
      path.join(__dirname, '../controllers/Logo.png'),
      path.join(__dirname, '../../elite_edition_website/public/DigitalLogo.png'),
      path.join(__dirname, '../../elite_edition_website/public/Logo.png'),
      '/home/ubuntu/elite_edition_website_dist/DigitalLogo.png',
      '/home/ubuntu/elite_edition_website_dist/Logo.png'
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  }
  return null;
}

/**
 * Splits items for pagination:
 * Up to 6 items fit comfortably on a single A4 page with full Tally box-grid, HSN summary & signatures.
 */
function chunkInvoiceItems(items, maxFirst = 6, maxOther = 11) {
  const total = (items || []).length;
  if (total <= maxFirst) return [items || []];

  const chunks = [];
  chunks.push(items.slice(0, maxFirst));
  let curr = maxFirst;
  while (curr < total) {
    chunks.push(items.slice(curr, curr + maxOther));
    curr += maxOther;
  }
  return chunks;
}

/**
 * Builds and renders the Tally GST Tax Invoice into an existing or new PDFDocument instance
 */
function renderTallyInvoice(doc, invoice = {}, companyConfig = {}, options = {}) {
  companyConfig = companyConfig || {};
  invoice = invoice || {};
  options = options || {};

  const isColor = options.isColor !== false;
  const isDuplicate = options.isDuplicate === true || !isColor;
  const defaultLabel = isDuplicate ? '(DUPLICATE FOR TRANSPORTER)' : '(ORIGINAL FOR RECIPIENT)';
  const copyLabel = options.copyLabel || defaultLabel;

  // Determine issuing company - invoice.companyEntity is the authoritative source
  const rawCompany = String(invoice.companyEntity || companyConfig.companyEntity || companyConfig.companyName || 'Elite Digital Print').trim();
  const resolvedCompany = rawCompany;
  const isDirectConfig = companyConfig.companyEntity === resolvedCompany;
  const baseBrandColor = getCompanyBrandColor(resolvedCompany, companyConfig.brandColor || companyConfig.badgeColor);

  // 1. BRAND IDENTITY & COLOR PALETTE
  const BRAND = isColor ? baseBrandColor : '#000000';
  const BORDER = isColor ? baseBrandColor : '#1a1a1a';
  const GRID_LINE = isColor ? '#cbd5e1' : '#94a3b8';
  const TEXT_MAIN = '#0b0f19';
  const TEXT_MUTED = '#475569';
  const BG_TINT = isColor ? tintColor(baseBrandColor, 0.05) : '#f1f5f9';

  // Geometry: Standard A4 portrait (595.28 x 841.89 pt) with 20pt (~7mm) crisp margins
  const PW = 595.28;
  const PH = 841.89;
  const PAD = 20;
  const CW = PW - PAD * 2; // 555.28 pt
  const halfCW = 277; // Left column width (50%)
  const rightColW = CW - halfCW; // 278.28 pt (Right column width)
  const midX = PAD + halfCW; // 297 pt

  // Seller details resolution honoring the issuing company
  let companyDisplayName = (isDirectConfig && companyConfig.companyName) ? companyConfig.companyName : resolvedCompany.toUpperCase();
  companyDisplayName = companyDisplayName.replace(/\s*\([^)]*\)/g, '').trim();

  const companyAddress = ((isDirectConfig && companyConfig.companyAddress)
    ? companyConfig.companyAddress
    : (resolvedCompany === 'Elite Online' ? 'Plot No. 12, Surat, Gujarat' : (companyConfig.companyAddress || 'G.F., PLOT NO-B/37, SIDDHESHWAR SOC., PUNAGAM MAIN ROAD, NR. KALAPUL, SURAT-395010'))).toUpperCase();
  const companyGstin = (isDirectConfig && companyConfig.companyGstin)
    ? companyConfig.companyGstin
    : (resolvedCompany === 'Yamunaji' ? '24AAEFY0361N1ZZ' : (companyConfig.companyGstin || '24AANFE0044M1ZG'));
  const companyState = (isDirectConfig && companyConfig.companyState) ? companyConfig.companyState : 'Gujarat';
  const companyStateCode = (isDirectConfig && companyConfig.companyStateCode) ? companyConfig.companyStateCode : '24';
  const companyEmail = (isDirectConfig && (companyConfig.companyEmail || companyConfig.companyPhone))
    ? (companyConfig.companyEmail || companyConfig.companyPhone)
    : (resolvedCompany === 'Elite Digital Print' ? 'elitedigitalprint@gmail.com' : 'info@company.com');
  const companyCity = (isDirectConfig && companyConfig.companyCity) ? companyConfig.companyCity : 'Surat';

  // Consignee (Ship To)
  const cust = invoice.customer || {};
  const consigneeName = (cust.businessName || cust.name || 'Party Name').trim();
  const consigneeAddr = (cust.shippingAddress || cust.billingAddress || 'Surat, Gujarat').trim();
  const consigneeGstin = cust.gstin && cust.gstin !== 'N/A' ? cust.gstin : '';
  const consigneeState = cust.state || 'Gujarat';
  const consigneeStateCode = cust.stateCode || '24';

  // Buyer (Bill To)
  const buyerName = (cust.businessName || cust.name || 'Party Name').trim();
  const buyerAddr = (cust.billingAddress || cust.shippingAddress || 'Surat, Gujarat').trim();
  const buyerGstin = cust.gstin && cust.gstin !== 'N/A' ? cust.gstin : '';
  const buyerState = cust.state || 'Gujarat';
  const buyerStateCode = cust.stateCode || '24';

  const items = invoice.items || [];
  const itemChunks = chunkInvoiceItems(items, 6, 11);
  const totalPages = itemChunks.length;

  const taxType = invoice.taxType || (consigneeStateCode && String(consigneeStateCode).trim() !== String(companyStateCode).trim() ? 'IGST' : 'CGST_SGST');
  const isIgst = taxType === 'IGST';

  // Tax calculation per HSN & rate
  const hsnMap = {};
  items.forEach(it => {
    const hsn = it.hsnCode || '5407';
    const rate = Number(it.taxRate !== undefined && it.taxRate !== null ? it.taxRate : 5);
    const key = `${hsn}_${rate}`;
    if (!hsnMap[key]) hsnMap[key] = { hsn, rate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    const itQty = parseFloat(it.qty !== undefined ? it.qty : (it.quantity !== undefined ? it.quantity : 0)) || 0;
    const itPrice = parseFloat(it.unitPrice !== undefined ? it.unitPrice : (it.rate !== undefined ? it.rate : 0)) || 0;
    const taxable = Number(it.totalAmount !== undefined && it.totalAmount !== null ? it.totalAmount : (it.amount !== undefined && it.amount !== null ? it.amount : (itQty * itPrice)));
    hsnMap[key].taxable += taxable;
    if (isIgst) {
      hsnMap[key].igst += Math.round((taxable * (rate / 100)) * 100) / 100;
    } else {
      hsnMap[key].cgst += Math.round((taxable * (rate / 2 / 100)) * 100) / 100;
      hsnMap[key].sgst += Math.round((taxable * (rate / 2 / 100)) * 100) / 100;
    }
  });

  const hsnRows = Object.values(hsnMap);
  const totalTaxable = (invoice.subtotal != null && Number(invoice.subtotal) > 0) ? Number(invoice.subtotal) : hsnRows.reduce((s, r) => s + r.taxable, 0);
  const totalCgst = (invoice.cgstAmount != null && Number(invoice.cgstAmount) > 0) ? Number(invoice.cgstAmount) : hsnRows.reduce((s, r) => s + r.cgst, 0);
  const totalSgst = (invoice.sgstAmount != null && Number(invoice.sgstAmount) > 0) ? Number(invoice.sgstAmount) : hsnRows.reduce((s, r) => s + r.sgst, 0);
  const totalIgst = (invoice.igstAmount != null && Number(invoice.igstAmount) > 0) ? Number(invoice.igstAmount) : hsnRows.reduce((s, r) => s + r.igst, 0);
  const totalTax = isIgst ? totalIgst : parseFloat((totalCgst + totalSgst).toFixed(2));

  let grandTotalQty = 0;
  let overallQtyUnit = 'MTR';
  items.forEach(it => {
    grandTotalQty += parseFloat(it.qty !== undefined ? it.qty : (it.quantity !== undefined ? it.quantity : 0)) || 0;
    if (it.unit || it.qtyUnit) overallQtyUnit = it.unit || it.qtyUnit;
  });

  const roundOffVal = invoice.roundOff != null ? Number(invoice.roundOff) : 0;
  const rawGrandTotal = totalTaxable + totalTax + roundOffVal;
  const grandTotal = invoice.grandTotal ? Number(invoice.grandTotal) : Math.round(rawGrandTotal);

  // TDS Deduction
  const hasTds = invoice.enableTds === true || Boolean(invoice.tdsAmount && Number(invoice.tdsAmount) > 0);
  const tdsSection = invoice.tdsSection || '194C';
  const tdsRate = invoice.tdsRate != null && Number(invoice.tdsRate) > 0 ? Number(invoice.tdsRate) : 2.0;
  const tdsAmount = hasTds ? (invoice.tdsAmount != null && Number(invoice.tdsAmount) > 0 ? Number(invoice.tdsAmount) : Math.round((totalTaxable * (tdsRate / 100)) * 100) / 100) : 0;
  const netReceivable = grandTotal - tdsAmount;

  // 2. MAIN ITEM TABLE COLUMNS (7 Standard Columns)
  // Total Width = 28 + 215.28 + 50 + 72 + 52 + 38 + 100 = 555.28 pt
  const tableCols = [
    { id: 'sr', title: 'Sl\nNo.', w: 28, align: 'center' },
    { id: 'desc', title: 'Description of Goods', w: 215.28, align: 'left' },
    { id: 'hsn', title: 'HSN/SAC', w: 50, align: 'center' },
    { id: 'qty', title: 'Quantity', w: 72, align: 'right' },
    { id: 'rate', title: 'Rate (₹)', w: 52, align: 'right' },
    { id: 'per', title: 'per', w: 38, align: 'center' },
    { id: 'amount', title: 'Amount (₹)', w: 100, align: 'right' }
  ];

  const colX = [];
  let accX = PAD;
  tableCols.forEach(c => {
    colX.push(accX);
    accX += c.w;
  });

  let runningItemIndex = 0;

  itemChunks.forEach((chunk, pageIdx) => {
    if (pageIdx > 0) {
      doc.addPage({ margin: 0, size: 'A4' });
    }

    const isFirstPage = pageIdx === 0;
    const isLastPage = pageIdx === totalPages - 1;
    const topY = 18;

    // ── A. TOP TITLE & COPIES ──
    doc.fillColor(BRAND).fontSize(12).font('Helvetica-Bold')
       .text('TAX INVOICE', PAD, topY, { width: CW, align: 'center' });

    const pLabel = totalPages > 1 ? `${copyLabel}  •  Page ${pageIdx + 1} of ${totalPages}` : copyLabel;
    doc.fillColor(isColor ? BRAND : TEXT_MUTED).fontSize(7.5).font('Helvetica-Bold')
       .text(pLabel, PAD, topY + 13, { width: CW, align: 'center' });

    let currentY = 42;

    // ── B. HEADER & METADATA GRID (Tally 2-Column Split) ──
    if (isFirstPage) {
      const row1H = 96; // Supplier (Left) & Meta Grid (Right)
      const row2H = 74; // Consignee Ship To (Left) & Buyer Bill To (Right)
      const topGridH = row1H + row2H; // 170 pt

      // Outer Box Container
      doc.lineWidth(1).strokeColor(BORDER)
         .rect(PAD, currentY, CW, topGridH).stroke();

      // Vertical Split between Left & Right Columns
      doc.lineWidth(0.75).strokeColor(GRID_LINE)
         .moveTo(midX, currentY).lineTo(midX, currentY + topGridH).stroke();

      // Horizontal Split between Row 1 and Row 2
      const splitY = currentY + row1H;
      doc.lineWidth(0.75).strokeColor(GRID_LINE)
         .moveTo(PAD, splitY).lineTo(PAD + CW, splitY).stroke();

      // ── ROW 1: LEFT BOX (Supplier / Seller Details) ──
      const leftX = PAD + 6;
      const leftW = halfCW - 12;
      const logoFile = resolveCompanyLogo(resolvedCompany);
      let sellerContentY = currentY + 4;

      if (logoFile) {
        try {
          doc.image(logoFile, leftX, sellerContentY, { width: 95, height: 24, fit: [95, 24] });
          sellerContentY += 26;
        } catch (e) {
          doc.fillColor(BRAND).fontSize(10).font('Helvetica-Bold')
             .text(companyDisplayName, leftX, sellerContentY, { width: leftW });
          sellerContentY += 14;
        }
      } else {
        doc.fillColor(BRAND).fontSize(10).font('Helvetica-Bold')
           .text(companyDisplayName, leftX, sellerContentY, { width: leftW });
        sellerContentY += 13;
      }

      doc.fillColor(TEXT_MAIN).fontSize(6.8).font('Helvetica')
         .text(companyAddress, leftX, sellerContentY, { width: leftW, lineGap: 0.5 });
      sellerContentY += 20;

      doc.font('Helvetica-Bold').fontSize(7.2).fillColor(TEXT_MAIN).text('GSTIN/UIN: ', leftX, sellerContentY, { continued: true })
         .font('Helvetica').text(companyGstin);
      sellerContentY += 9.5;

      doc.font('Helvetica').fontSize(7.2)
         .text(`State Name : ${companyState}, Code : ${companyStateCode}`, leftX, sellerContentY);
      sellerContentY += 9.5;

      doc.font('Helvetica').fontSize(7)
         .text(`E-Mail : ${companyEmail}`, leftX, sellerContentY);

      // ── ROW 1: RIGHT BOX (Invoice Metadata Grid) ──
      const subW = Math.floor(rightColW / 2);
      const col1X = midX + 5;
      const col2X = midX + subW + 5;
      const col1ValW = subW - 10;
      const col2ValW = rightColW - subW - 10;
      const subDivX = midX + subW;

      const challanDocNo = invoice.ourChallanNo || invoice.dispatchDocNo || (invoice.linkedChallanNos && invoice.linkedChallanNos.join(', ')) || invoice.challanNo || '--';
      const challanDocDate = formatDate(invoice.challanDate || invoice.invoiceDate);

      const rightMetaRows = [
        {
          h: 24,
          k1: 'Invoice No.', v1: invoice.invoiceNo || '--', bold1: true,
          k2: 'Dated', v2: formatDate(invoice.invoiceDate), bold2: true
        },
        {
          h: 24,
          k1: 'Delivery Note', v1: invoice.deliveryNote || invoice.orderRef || '--',
          k2: 'Mode/Terms of Payment', v2: invoice.paymentTerms || invoice.modeOfPayment || 'Credit'
        },
        {
          h: 24,
          k1: 'Reference No. & Date.', v1: invoice.refNoDate || '--',
          k2: 'Other References', v2: invoice.otherReferences || invoice.orderNo || '--'
        },
        {
          h: 24,
          k1: 'Dispatch Doc No.', v1: challanDocNo, bold1: true,
          k2: 'Delivery Note Date', v2: challanDocDate
        }
      ];

      let metaY = currentY;
      rightMetaRows.forEach((r, idx) => {
        if (idx > 0) {
          doc.lineWidth(0.5).strokeColor(GRID_LINE)
             .moveTo(midX, metaY).lineTo(PAD + CW, metaY).stroke();
        }

        doc.lineWidth(0.5).strokeColor(GRID_LINE)
           .moveTo(subDivX, metaY).lineTo(subDivX, metaY + r.h).stroke();

        doc.fillColor(TEXT_MUTED).fontSize(6.2).font('Helvetica').text(r.k1, col1X, metaY + 2.5);
        doc.fillColor(r.bold1 ? BRAND : TEXT_MAIN).fontSize(r.bold1 ? 8 : 7.2).font(r.bold1 ? 'Helvetica-Bold' : 'Helvetica')
           .text(r.v1, col1X, metaY + 11, { width: col1ValW, lineBreak: false });

        doc.fillColor(TEXT_MUTED).fontSize(6.2).font('Helvetica').text(r.k2, col2X, metaY + 2.5);
        doc.fillColor(r.bold2 ? BRAND : TEXT_MAIN).fontSize(r.bold2 ? 8 : 7.2).font(r.bold2 ? 'Helvetica-Bold' : 'Helvetica')
           .text(r.v2, col2X, metaY + 11, { width: col2ValW, lineBreak: false });

        metaY += r.h;
      });

      // ── ROW 2: LEFT HALF (Consignee - Ship To) ──
      const shipY = splitY + 3;
      doc.fillColor(TEXT_MUTED).fontSize(6.5).font('Helvetica')
         .text('Consignee (Ship to)', leftX, shipY);

      doc.fillColor(BRAND).fontSize(8.5).font('Helvetica-Bold')
         .text(consigneeName, leftX, shipY + 10, { width: leftW, lineBreak: false });

      doc.fillColor(TEXT_MAIN).fontSize(7).font('Helvetica')
         .text(consigneeAddr, leftX, shipY + 21, { width: leftW, lineGap: 0.5 });

      const shipGstinY = splitY + 47;
      doc.font('Helvetica-Bold').fontSize(7.2).fillColor(TEXT_MAIN).text('GSTIN/UIN   : ', leftX, shipGstinY, { continued: true })
         .font('Helvetica').text(consigneeGstin || 'Unregistered');

      doc.font('Helvetica').fontSize(7.2)
         .text(`State Name  : ${consigneeState}, Code : ${consigneeStateCode}`, leftX, shipGstinY + 10);

      // ── ROW 2: RIGHT HALF (Buyer - Bill To) ──
      const billY = splitY + 3;
      const billX = midX + 6;
      const billW = rightColW - 12;

      doc.fillColor(TEXT_MUTED).fontSize(6.5).font('Helvetica')
         .text('Buyer (Bill to)', billX, billY);

      doc.fillColor(BRAND).fontSize(8.5).font('Helvetica-Bold')
         .text(buyerName, billX, billY + 10, { width: billW, lineBreak: false });

      doc.fillColor(TEXT_MAIN).fontSize(7).font('Helvetica')
         .text(buyerAddr, billX, billY + 21, { width: billW, lineGap: 0.5 });

      const billGstinY = splitY + 47;
      doc.font('Helvetica-Bold').fontSize(7.2).fillColor(TEXT_MAIN).text('GSTIN/UIN   : ', billX, billGstinY, { continued: true })
         .font('Helvetica').text(buyerGstin || 'Unregistered');

      doc.font('Helvetica').fontSize(7.2)
         .text(`State Name  : ${buyerState}, Code : ${buyerStateCode}`, billX, billGstinY + 10);

      currentY += topGridH;
    } else {
      // Continuation Header on Page 2+
      const compHdrH = 32;
      doc.lineWidth(1).strokeColor(BORDER).rect(PAD, currentY, CW, compHdrH).stroke();
      doc.fillColor(BRAND).fontSize(9.5).font('Helvetica-Bold')
         .text(`${companyDisplayName}  •  TAX INVOICE: ${invoice.invoiceNo || '--'}  •  DATE: ${formatDate(invoice.invoiceDate)}`, PAD + 8, currentY + 5);
      doc.fillColor(TEXT_MUTED).fontSize(7.2).font('Helvetica')
         .text(`BUYER: ${buyerName}   |   CHALLAN: ${invoice.challanNo || invoice.dispatchDocNo || '--'}`, PAD + 8, currentY + 18);
      currentY += compHdrH;
    }

    // ── C. MAIN ITEM TABLE ──
    const tableHeaderH = 20;
    const tableHeaderY = currentY;

    // Header Background & Crisp Border
    doc.rect(PAD, tableHeaderY, CW, tableHeaderH).fill(BG_TINT).stroke(BORDER);
    tableCols.forEach((c, idx) => {
      doc.fillColor(BRAND).fontSize(7.2).font('Helvetica-Bold')
         .text(c.title, colX[idx] + 2, tableHeaderY + (c.title.includes('\n') ? 2.5 : 6), {
           width: c.w - 4,
           align: c.align
         });
    });

    colX.slice(1).forEach(cx => {
      doc.lineWidth(0.5).strokeColor(GRID_LINE)
         .moveTo(cx, tableHeaderY).lineTo(cx, tableHeaderY + tableHeaderH).stroke();
    });

    currentY += tableHeaderH;

    // Fixed bottom footer reserve height on last page vs intermediate page
    const bottomFooterH = isLastPage ? 172 : 24;
    const tableTotalH = 20;
    const tableBottomY = PH - 18 - bottomFooterH;

    let itemRowY = currentY + 3;
    let pageQty = 0;
    let pageAmount = 0;

    chunk.forEach(it => {
      runningItemIndex++;
      const qVal = parseFloat(it.qty !== undefined ? it.qty : (it.quantity !== undefined ? it.quantity : 0)) || 0;
      pageQty += qVal;
      const rateVal = parseFloat(it.unitPrice != null ? it.unitPrice : it.rate) || 0;
      const amtVal = parseFloat(it.totalAmount != null ? it.totalAmount : (it.amount != null ? it.amount : (qVal * rateVal))) || 0;
      pageAmount += amtVal;

      const iName = it.itemName || 'FANCY FABRIC';
      const descParts = [];
      if (it.description && String(it.description).trim() && String(it.description).trim() !== iName) {
        descParts.push(it.description.trim());
      }
      if (it.designNo) descParts.push(`Design: ${it.designNo}`);
      if (it.lotNo) descParts.push(`Lot: ${it.lotNo}`);
      if (it.fabric || it.fabricName) descParts.push(`Fabric: ${it.fabric || it.fabricName}`);
      if (it.jobNo || it.jobCardNo) descParts.push(`Job Card: #${String(it.jobNo || it.jobCardNo).replace(/^#?JOB\s*NO\.?\s*[-:]?\s*/i, '')}`);
      if (it.partyChallanNo || it.vendorChallanNo) descParts.push(`Challan: ${it.partyChallanNo || it.vendorChallanNo}`);

      const descStr = descParts.join('  •  ');

      doc.fillColor(TEXT_MAIN).fontSize(7.5).font('Helvetica-Bold')
         .text(String(runningItemIndex), colX[0] + 1, itemRowY, { width: tableCols[0].w - 2, align: 'center' });

      doc.font('Helvetica-Bold').fontSize(8)
         .text(iName, colX[1] + 3, itemRowY, { width: tableCols[1].w - 6 });

      if (descStr) {
        doc.font('Helvetica').fontSize(6.8).fillColor(TEXT_MUTED)
           .text(descStr, colX[1] + 3, itemRowY + 10, { width: tableCols[1].w - 6, lineGap: 0.5 });
      }

      doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(7.5)
         .text(it.hsnCode || '5407', colX[2] + 2, itemRowY, { width: tableCols[2].w - 4, align: 'center' });

      doc.font('Helvetica-Bold').fontSize(7.8)
         .text(`${qVal.toFixed(2)} ${overallQtyUnit}`, colX[3] + 2, itemRowY, { width: tableCols[3].w - 4, align: 'right' });

      doc.font('Helvetica').fontSize(7.8)
         .text(rateVal.toFixed(2), colX[4] + 2, itemRowY, { width: tableCols[4].w - 4, align: 'right' });

      doc.font('Helvetica').fontSize(7.2)
         .text(overallQtyUnit, colX[5] + 2, itemRowY, { width: tableCols[5].w - 4, align: 'center' });

      doc.font('Helvetica-Bold').fontSize(8.2)
         .text(amtVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX[6] + 2, itemRowY, { width: tableCols[6].w - 4, align: 'right' });

      const rowH = descStr ? 22 : 16;
      itemRowY += rowH;
    });

    // ── D. SUMMARY, TAXES & NET RECEIVABLE ROWS INSIDE ITEM TABLE ──
    if (isLastPage) {
      itemRowY += 4;

      // Subtotal (Taxable Value) Row if multiple items exist
      if (chunk.length > 1) {
        doc.fillColor(TEXT_MUTED).fontSize(7.5).font('Helvetica-Bold')
           .text('Subtotal (Taxable Value)', colX[1] + 6, itemRowY, { width: colX[6] - colX[1] - 12, align: 'right' });
        doc.fillColor(TEXT_MAIN).fontSize(7.8).font('Helvetica-Bold')
           .text(totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX[6] + 2, itemRowY, { width: tableCols[6].w - 4, align: 'right' });
        itemRowY += 12;
      }

      // CGST & SGST (or IGST) Rows
      if (isIgst) {
        doc.fillColor(TEXT_MAIN).fontSize(7.8).font('Helvetica-Bold')
           .text('IGST @ 5.0%', colX[1] + 6, itemRowY, { width: colX[6] - colX[1] - 12, align: 'right' });
        doc.text(totalIgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX[6] + 2, itemRowY, { width: tableCols[6].w - 4, align: 'right' });
        itemRowY += 12;
      } else {
        doc.fillColor(TEXT_MAIN).fontSize(7.8).font('Helvetica-Bold')
           .text('CGST @ 2.5%', colX[1] + 6, itemRowY, { width: colX[6] - colX[1] - 12, align: 'right' });
        doc.text(totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX[6] + 2, itemRowY, { width: tableCols[6].w - 4, align: 'right' });
        itemRowY += 12;

        doc.fillColor(TEXT_MAIN).fontSize(7.8).font('Helvetica-Bold')
           .text('SGST @ 2.5%', colX[1] + 6, itemRowY, { width: colX[6] - colX[1] - 12, align: 'right' });
        doc.text(totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX[6] + 2, itemRowY, { width: tableCols[6].w - 4, align: 'right' });
        itemRowY += 12;
      }

      // Round-off Row (if non-zero)
      if (roundOffVal !== 0) {
        doc.fillColor(TEXT_MUTED).fontSize(7.5).font('Helvetica')
           .text('Round Off', colX[1] + 6, itemRowY, { width: colX[6] - colX[1] - 12, align: 'right' });
        doc.fillColor(TEXT_MAIN).fontSize(7.8).font('Helvetica')
           .text((roundOffVal > 0 ? `+${roundOffVal.toFixed(2)}` : roundOffVal.toFixed(2)), colX[6] + 2, itemRowY, { width: tableCols[6].w - 4, align: 'right' });
        itemRowY += 12;
      }

      // Job-work / ERP Specific Deductions: Less TDS (194C) @ 2% & Net Receivable
      if (hasTds) {
        doc.fillColor('#dc2626').fontSize(7.5).font('Helvetica-Bold')
           .text(`Less: TDS (${tdsSection}) @ ${tdsRate}%`, colX[1] + 6, itemRowY, { width: colX[6] - colX[1] - 12, align: 'right' });
        doc.fillColor('#dc2626').fontSize(7.8).font('Helvetica-Bold')
           .text(`-${tdsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, colX[6] + 2, itemRowY, { width: tableCols[6].w - 4, align: 'right' });
        itemRowY += 12;

        doc.fillColor(BRAND).fontSize(8).font('Helvetica-Bold')
           .text('Net Receivable', colX[1] + 6, itemRowY, { width: colX[6] - colX[1] - 12, align: 'right' });
        doc.fillColor(BRAND).fontSize(8.5).font('Helvetica-Bold')
           .text(`₹ ${netReceivable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, colX[6] + 2, itemRowY, { width: tableCols[6].w - 4, align: 'right' });
        itemRowY += 13;
      }
    }

    // Vertical Table Grid Separators extending from Header to Table Bottom
    const fullTableH = tableBottomY - tableHeaderY;
    doc.lineWidth(0.5).strokeColor(GRID_LINE);
    colX.slice(1).forEach(cx => {
      doc.moveTo(cx, currentY).lineTo(cx, tableBottomY).stroke();
    });

    // Outer Table Perimeter Box
    doc.lineWidth(1).strokeColor(BORDER)
       .rect(PAD, tableHeaderY, CW, fullTableH).stroke();

    // ── TOTAL SUMMARY ROW WITH SOLID BRAND ACCENT OUTLINE & TINT ──
    const totalRowY = tableBottomY - tableTotalH;
    doc.rect(PAD, totalRowY, CW, tableTotalH).fill(BG_TINT).stroke(BORDER);

    colX.slice(1).forEach(cx => {
      doc.lineWidth(0.5).strokeColor(GRID_LINE)
         .moveTo(cx, totalRowY).lineTo(cx, tableBottomY).stroke();
    });

    if (isLastPage) {
      doc.fillColor(BRAND).fontSize(8.5).font('Helvetica-Bold')
         .text('Total', colX[1] + 8, totalRowY + 5);

      doc.fillColor(BRAND).fontSize(8.5).font('Helvetica-Bold')
         .text(`${grandTotalQty.toFixed(2)} ${overallQtyUnit}`, colX[3] + 2, totalRowY + 5, { width: tableCols[3].w - 4, align: 'right' });

      doc.fillColor(BRAND).fontSize(9.5).font('Helvetica-Bold')
         .text(`₹ ${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, colX[6] + 2, totalRowY + 5, { width: tableCols[6].w - 4, align: 'right' });
    } else {
      doc.fillColor(BRAND).fontSize(8).font('Helvetica-Bold')
         .text('Page Subtotal (Continued on Next Page...):', colX[1] + 6, totalRowY + 5, { width: colX[3] - colX[1] - 8, align: 'right' });

      doc.fillColor(BRAND).fontSize(8).font('Helvetica-Bold')
         .text(`${pageQty.toFixed(2)} ${overallQtyUnit}`, colX[3] + 2, totalRowY + 5, { width: tableCols[3].w - 4, align: 'right' });

      doc.fillColor(BRAND).fontSize(8.5).font('Helvetica-Bold')
         .text(pageAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX[6] + 2, totalRowY + 5, { width: tableCols[6].w - 4, align: 'right' });
    }

    currentY = tableBottomY;

    if (isLastPage) {
      // ── 1. FULL AMOUNT IN WORDS (INR) SPANNED BOX ──
      const wordsRowH = 22;
      doc.rect(PAD, currentY, CW, wordsRowH).stroke(BORDER);
      doc.fillColor(TEXT_MUTED).fontSize(6.5).font('Helvetica')
         .text('Amount Chargeable (in words)', PAD + 6, currentY + 3);
      doc.fillColor(TEXT_MUTED).fontSize(7).font('Helvetica-Bold')
         .text('E. & O.E', PAD + CW - 60, currentY + 3, { width: 54, align: 'right' });
      doc.fillColor(TEXT_MAIN).fontSize(8.2).font('Helvetica-Bold')
         .text(numToWords(grandTotal), PAD + 6, currentY + 11.5, { width: CW - 12 });
      currentY += wordsRowH;

      // ── 2. GST TAX BREAKDOWN TABLE (Tally Standard) ──
      const hsnTableH = 38;
      doc.rect(PAD, currentY, CW, hsnTableH).stroke(BORDER);

      const hsnColW = isIgst
        ? [100, 140, 80, 95, 140.28]
        : [80, 105, 50, 65, 50, 65, 140.28];
      const hsnColX = [];
      let hsnAcc = PAD;
      hsnColW.forEach(w => { hsnColX.push(hsnAcc); hsnAcc += w; });

      const hsnHdrY = currentY;
      doc.fillColor(TEXT_MAIN).fontSize(7).font('Helvetica-Bold');
      if (isIgst) {
        doc.text('HSN/SAC', hsnColX[0] + 4, hsnHdrY + 3, { width: hsnColW[0] - 8, align: 'center' });
        doc.text('Taxable Value', hsnColX[1] + 4, hsnHdrY + 3, { width: hsnColW[1] - 8, align: 'right' });
        doc.text('IGST Rate', hsnColX[2] + 4, hsnHdrY + 3, { width: hsnColW[2] - 8, align: 'center' });
        doc.text('IGST Amount', hsnColX[3] + 4, hsnHdrY + 3, { width: hsnColW[3] - 8, align: 'right' });
        doc.text('Total Tax Amount', hsnColX[4] + 4, hsnHdrY + 3, { width: hsnColW[4] - 8, align: 'right' });
      } else {
        doc.text('HSN/SAC', hsnColX[0] + 4, hsnHdrY + 3, { width: hsnColW[0] - 8, align: 'center' });
        doc.text('Taxable Value', hsnColX[1] + 4, hsnHdrY + 3, { width: hsnColW[1] - 8, align: 'right' });
        doc.text('CGST Rate', hsnColX[2] + 2, hsnHdrY + 3, { width: hsnColW[2] - 4, align: 'center' });
        doc.text('CGST Amount', hsnColX[3] + 2, hsnHdrY + 3, { width: hsnColW[3] - 4, align: 'right' });
        doc.text('SGST Rate', hsnColX[4] + 2, hsnHdrY + 3, { width: hsnColW[4] - 4, align: 'center' });
        doc.text('SGST Amount', hsnColX[5] + 2, hsnHdrY + 3, { width: hsnColW[5] - 4, align: 'right' });
        doc.text('Total Tax Amount', hsnColX[6] + 4, hsnHdrY + 3, { width: hsnColW[6] - 8, align: 'right' });
      }

      doc.lineWidth(0.5).strokeColor(GRID_LINE).moveTo(PAD, hsnHdrY + 15).lineTo(PAD + CW, hsnHdrY + 15).stroke();
      hsnColX.slice(1).forEach(cx => {
        doc.lineWidth(0.5).strokeColor(GRID_LINE).moveTo(cx, hsnHdrY).lineTo(cx, hsnHdrY + hsnTableH).stroke();
      });

      const hsnRowY = hsnHdrY + 17;
      const firstHsn = hsnRows[0] || { hsn: '5407', taxable: totalTaxable, rate: 5, cgst: totalCgst, sgst: totalSgst, igst: totalIgst };
      const halfRate = (firstHsn.rate / 2).toFixed(2);

      doc.font('Helvetica').fontSize(7.2).fillColor(TEXT_MAIN);
      doc.text(firstHsn.hsn, hsnColX[0] + 4, hsnRowY, { width: hsnColW[0] - 8, align: 'center' });
      doc.text(firstHsn.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 }), hsnColX[1] + 4, hsnRowY, { width: hsnColW[1] - 8, align: 'right' });

      if (isIgst) {
        doc.text(`${firstHsn.rate.toFixed(2)}%`, hsnColX[2] + 4, hsnRowY, { width: hsnColW[2] - 8, align: 'center' });
        doc.text(firstHsn.igst.toFixed(2), hsnColX[3] + 4, hsnRowY, { width: hsnColW[3] - 8, align: 'right' });
        doc.font('Helvetica-Bold').text(firstHsn.igst.toFixed(2), hsnColX[4] + 4, hsnRowY, { width: hsnColW[4] - 8, align: 'right' });
      } else {
        doc.text(`${halfRate}%`, hsnColX[2] + 2, hsnRowY, { width: hsnColW[2] - 4, align: 'center' });
        doc.text(firstHsn.cgst.toFixed(2), hsnColX[3] + 2, hsnRowY, { width: hsnColW[3] - 4, align: 'right' });
        doc.text(`${halfRate}%`, hsnColX[4] + 2, hsnRowY, { width: hsnColW[4] - 4, align: 'center' });
        doc.text(firstHsn.sgst.toFixed(2), hsnColX[5] + 2, hsnRowY, { width: hsnColW[5] - 4, align: 'right' });
        doc.font('Helvetica-Bold').text((firstHsn.cgst + firstHsn.sgst).toFixed(2), hsnColX[6] + 4, hsnRowY, { width: hsnColW[6] - 8, align: 'right' });
      }

      // HSN Summary Total Row
      const hsnTotY = hsnHdrY + 27;
      doc.lineWidth(0.5).strokeColor(GRID_LINE).moveTo(PAD, hsnTotY - 1).lineTo(PAD + CW, hsnTotY - 1).stroke();
      doc.font('Helvetica-Bold').fontSize(7.2).fillColor(BRAND);
      doc.text('Total', hsnColX[0] + 4, hsnTotY, { width: hsnColW[0] - 8, align: 'center' });
      doc.text(totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 }), hsnColX[1] + 4, hsnTotY, { width: hsnColW[1] - 8, align: 'right' });

      if (isIgst) {
        doc.text(totalTax.toFixed(2), hsnColX[4] + 4, hsnTotY, { width: hsnColW[4] - 8, align: 'right' });
      } else {
        doc.text(totalCgst.toFixed(2), hsnColX[3] + 2, hsnTotY, { width: hsnColW[3] - 4, align: 'right' });
        doc.text(totalSgst.toFixed(2), hsnColX[5] + 2, hsnTotY, { width: hsnColW[5] - 4, align: 'right' });
        doc.text(totalTax.toFixed(2), hsnColX[6] + 4, hsnTotY, { width: hsnColW[6] - 8, align: 'right' });
      }

      currentY += hsnTableH;

      // ── 3. TOTAL TAX AMOUNT IN WORDS (INR) ──
      const taxWordsH = 14;
      doc.rect(PAD, currentY, CW, taxWordsH).stroke(BORDER);
      doc.fillColor(TEXT_MAIN).fontSize(7.5).font('Helvetica-Bold')
         .text(`Tax Amount (in words) :  ${numToWords(totalTax)}`, PAD + 6, currentY + 3);
      currentY += taxWordsH;

      // ── 4. FOOTER BLOCK (Equal 50/50 Horizontal Split) ──
      const footerBoxH = 62;
      doc.rect(PAD, currentY, CW, footerBoxH).stroke(BORDER);
      const footerMidX = PAD + halfCW;
      doc.lineWidth(0.75).strokeColor(GRID_LINE).moveTo(footerMidX, currentY).lineTo(footerMidX, currentY + footerBoxH).stroke();

      // Left Box: Company Bank Details + Declaration & Terms
      const footLeftX = PAD + 6;
      const footLeftW = halfCW - 12;

      // Bank Details
      const bankName = (companyConfig.companyBanks && companyConfig.companyBanks[0]?.bankName) || companyConfig.companyBankName || (resolvedCompany.includes('Yamunaji') ? 'HDFC BANK' : 'KOTAK MAHINDRA BANK');
      const bankAccount = (companyConfig.companyBanks && companyConfig.companyBanks[0]?.accountNo) || companyConfig.companyAccountNo || '50200058291044';
      const bankIfsc = (companyConfig.companyBanks && companyConfig.companyBanks[0]?.ifscCode) || companyConfig.companyIfscCode || 'KKBK0000841';
      const bankBranch = (companyConfig.companyBanks && companyConfig.companyBanks[0]?.branch) || companyConfig.companyBranch || 'Ring Road Branch, Surat';

      doc.fillColor(TEXT_MUTED).fontSize(6.5).font('Helvetica-Bold')
         .text('Company\'s Bank Details:', footLeftX, currentY + 3);
      doc.fillColor(TEXT_MAIN).fontSize(6.8).font('Helvetica')
         .text(`Bank Name   : ${bankName}`, footLeftX, currentY + 11)
         .text(`A/c No.     : ${bankAccount}`, footLeftX, currentY + 19)
         .text(`Branch & IFS: ${bankBranch} (${bankIfsc})`, footLeftX, currentY + 27);

      doc.fillColor(TEXT_MUTED).fontSize(6.2).font('Helvetica-Bold')
         .text('Declaration & Terms:', footLeftX, currentY + 37);
      doc.fillColor(TEXT_MUTED).fontSize(6.2).font('Helvetica')
         .text('We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.', footLeftX, currentY + 45, { width: footLeftW, lineGap: 0.3 });

      // Right Box: For Company, Stamp Space & Authorised Signatory
      const signX = footerMidX + 8;
      const signW = rightColW - 16;

      doc.fillColor(BRAND).fontSize(8.5).font('Helvetica-Bold')
         .text(`for ${companyDisplayName}`, signX, currentY + 5, { width: signW, align: 'right' });

      doc.fillColor(TEXT_MUTED).fontSize(6.8).font('Helvetica-Oblique')
         .text('(Authorised Stamp / Digital Signature)', signX, currentY + 28, { width: signW, align: 'center' });

      doc.fillColor(TEXT_MAIN).fontSize(8).font('Helvetica-Bold')
         .text('Authorised Signatory', signX, currentY + 48, { width: signW, align: 'right' });

      currentY += footerBoxH;

      // ── 5. BOTTOM JURISDICTION & COMPUTER GENERATED NOTICE ──
      doc.fillColor(TEXT_MAIN).fontSize(7.5).font('Helvetica-Bold')
         .text(`SUBJECT TO ${companyCity.toUpperCase()} JURISDICTION`, PAD, currentY + 3, { width: CW, align: 'center' });

      doc.fillColor(TEXT_MUTED).fontSize(6.5).font('Helvetica')
         .text('This is a Computer Generated Invoice', PAD, currentY + 13, { width: CW, align: 'center' });
    } else {
      // Intermediate page continuation notice
      doc.fillColor(TEXT_MUTED).fontSize(7).font('Helvetica')
         .text('This is a Computer Generated Document  •  Continued on Next Page...', PAD, currentY + 6, { width: CW, align: 'center' });
    }
  });
}

module.exports = {
  renderTallyInvoice,
  getCompanyBrandColor,
  numToWords,
  formatDate
};
