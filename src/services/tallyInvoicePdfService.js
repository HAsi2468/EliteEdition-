/**
 * Tally GST Tax Invoice Vector PDF Generator
 * Renders pixel-accurate Tally Prime GST Tax Invoices in compact structured box-grid layout
 * Supports Issuing Company Brand Identity & Palette (Original) and crisp Black/White (Duplicate)
 */

const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const {
  getCompanyBrandColor,
  tintColor,
  getDuplicateLighterColor,
  isMeaningfulValue,
} = require('../utils/departmentThemeHelper');

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
  const isDirectConfig = (companyConfig.companyEntity === resolvedCompany) && !companyConfig.isFallbackConfig;
  const baseBrandColor = getCompanyBrandColor(resolvedCompany, companyConfig.brandColor || companyConfig.badgeColor);
  const duplicateBrandColor = getDuplicateLighterColor(baseBrandColor);

  // 1. BRAND IDENTITY & COLOR PALETTE
  // Original Copy: 100% Department Color | Duplicate Copy: 50% Lighter Same Department Color
  const BRAND = isDuplicate ? duplicateBrandColor : baseBrandColor;
  const BORDER = isDuplicate ? duplicateBrandColor : baseBrandColor;
  const GRID_LINE = isDuplicate ? tintColor(baseBrandColor, 0.25) : '#cbd5e1';
  const TEXT_MAIN = isDuplicate ? '#334155' : '#0b0f19';
  const TEXT_MUTED = isDuplicate ? '#64748b' : '#475569';
  const BG_TINT = isDuplicate ? tintColor(baseBrandColor, 0.04) : tintColor(baseBrandColor, 0.08);

  // Geometry: Standard A4 portrait (595.28 x 841.89 pt) with 20pt (~7mm) crisp margins
  const PW = 595.28;
  const PH = 841.89;
  const PAD = 20;
  const CW = PW - PAD * 2; // 555.28 pt
  const halfCW = 277; // Left column width (50%)
  const rightColW = CW - halfCW; // 278.28 pt (Right column width)
  const midX = PAD + halfCW; // 297 pt

  // Seller details resolution honoring the issuing company (Dynamic: only render populated fields)
  let companyDisplayName = (isDirectConfig && companyConfig.companyName) ? companyConfig.companyName : (resolvedCompany === 'Elite Online' ? 'ELITE ONLINE' : resolvedCompany.toUpperCase());
  companyDisplayName = companyDisplayName.replace(/\s*\([^)]*\)/g, '').trim();

  const companyAddress = ((isDirectConfig && companyConfig.companyAddress)
    ? companyConfig.companyAddress
    : (companyConfig.companyAddress || '')).toUpperCase().trim();
  const companyGstin = ((isDirectConfig && companyConfig.companyGstin)
    ? companyConfig.companyGstin
    : (companyConfig.companyGstin || '')).trim();
  const companyState = ((isDirectConfig && companyConfig.companyState) ? companyConfig.companyState : (companyConfig.companyState || '')).trim();
  const companyStateCode = ((isDirectConfig && companyConfig.companyStateCode) ? companyConfig.companyStateCode : (companyConfig.companyStateCode || '')).trim();
  const companyEmail = ((isDirectConfig && (companyConfig.companyEmail || companyConfig.companyPhone))
    ? (companyConfig.companyEmail || companyConfig.companyPhone)
    : (companyConfig.companyEmail || companyConfig.companyPhone || '')).trim();
  const companyCity = ((isDirectConfig && companyConfig.companyCity) ? companyConfig.companyCity : (companyConfig.companyCity || 'Surat')).trim();

  // Consignee (Ship To) - Dynamic fields only
  const cust = invoice.customer || {};
  const consigneeName = (cust.businessName || cust.name || invoice.partyName || invoice.customerName || '').trim();
  const consigneeAddr = (cust.shippingAddress || cust.billingAddress || invoice.billingAddress || '').trim();
  const consigneeGstin = isMeaningfulValue(cust.gstin || invoice.customerGstin) ? String(cust.gstin || invoice.customerGstin).trim() : '';
  const consigneeState = isMeaningfulValue(cust.state || invoice.placeOfSupply) ? String(cust.state || invoice.placeOfSupply).trim() : '';
  const consigneeStateCode = isMeaningfulValue(cust.stateCode) ? String(cust.stateCode).trim() : '';
  const consigneePhone = isMeaningfulValue(cust.phone || cust.mobile || invoice.customerPhone) ? String(cust.phone || cust.mobile || invoice.customerPhone).trim() : '';

  // Buyer (Bill To) - Dynamic fields only
  const buyerName = (cust.businessName || cust.name || invoice.partyName || invoice.customerName || '').trim();
  const buyerAddr = (cust.billingAddress || cust.shippingAddress || invoice.billingAddress || '').trim();
  const buyerGstin = consigneeGstin;
  const buyerState = consigneeState;
  const buyerStateCode = consigneeStateCode;

  const items = invoice.items || [];
  const itemChunks = chunkInvoiceItems(items, 6, 11);
  const totalPages = itemChunks.length;

  const taxType = invoice.taxType || (consigneeStateCode && String(consigneeStateCode).trim() !== String(companyStateCode).trim() ? 'IGST' : 'CGST_SGST');
  const isIgst = taxType === 'IGST';

  // Tax calculation per HSN & rate
  const hsnMap = {};
  items.forEach(it => {
    const hsn = isMeaningfulValue(it.hsnCode || it.hsn) ? String(it.hsnCode || it.hsn).trim() : '';
    const rate = Number(it.taxRate !== undefined && it.taxRate !== null ? it.taxRate : (invoice.taxRate !== undefined ? invoice.taxRate : 5));
    const key = `${hsn || 'DEFAULT'}_${rate}`;
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
  const totalCgst = invoice.cgstAmount != null ? Number(invoice.cgstAmount) : hsnRows.reduce((s, r) => s + r.cgst, 0);
  const totalSgst = invoice.sgstAmount != null ? Number(invoice.sgstAmount) : hsnRows.reduce((s, r) => s + r.sgst, 0);
  const totalIgst = invoice.igstAmount != null ? Number(invoice.igstAmount) : hsnRows.reduce((s, r) => s + r.igst, 0);
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

  // 2. MAIN ITEM TABLE COLUMNS (Dynamic 7 or 8 Columns depending on discounts)
  const hasDiscount = items.some(it => {
    const dPct = parseFloat(it.discountPercent || it.discountPct || it.discountRate || it.discount || 0);
    const dAmt = parseFloat(it.discountAmount || it.discountAmt || 0);
    return dPct > 0 || dAmt > 0;
  });

  const tableCols = hasDiscount ? [
    { id: 'sr', title: 'Sl\nNo.', w: 26, align: 'center' },
    { id: 'desc', title: 'Description of Goods', w: 181.28, align: 'left' },
    { id: 'hsn', title: 'HSN/SAC', w: 48, align: 'center' },
    { id: 'qty', title: 'Quantity', w: 68, align: 'right' },
    { id: 'rate', title: 'Rate (₹)', w: 48, align: 'right' },
    { id: 'per', title: 'per', w: 34, align: 'center' },
    { id: 'disc', title: 'Disc\n%', w: 50, align: 'right' },
    { id: 'amount', title: 'Amount (₹)', w: 100, align: 'right' }
  ] : [
    { id: 'sr', title: 'Sl\nNo.', w: 28, align: 'center' },
    { id: 'desc', title: 'Description of Goods', w: 215.28, align: 'left' },
    { id: 'hsn', title: 'HSN/SAC', w: 50, align: 'center' },
    { id: 'qty', title: 'Quantity', w: 72, align: 'right' },
    { id: 'rate', title: 'Rate (₹)', w: 52, align: 'right' },
    { id: 'per', title: 'per', w: 38, align: 'center' },
    { id: 'amount', title: 'Amount (₹)', w: 100, align: 'right' }
  ];

  const amountColIdx = tableCols.length - 1;
  const discColIdx = hasDiscount ? 6 : -1;

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
    doc.fillColor(BRAND).fontSize(7.5).font('Helvetica-Bold')
       .text(pLabel, PAD, topY + 13, { width: CW, align: 'center' });

    let currentY = 42;

    // ── B. HEADER & METADATA GRID (Dynamic Tally 2-Column Split) ──
    if (isFirstPage) {
      // Dynamically gather only the metadata cells that actually have values
      const challanDocNo = invoice.ourChallanNo || invoice.dispatchDocNo || (Array.isArray(invoice.linkedChallanNos) && invoice.linkedChallanNos.filter(Boolean).join(', ')) || invoice.challanNo || '';
      const challanDocDate = invoice.challanDate ? formatDate(invoice.challanDate) : '';
      const dynamicCells = [
        { k: 'Invoice No.', v: invoice.invoiceNo || '', bold: true },
        { k: 'Dated', v: formatDate(invoice.invoiceDate), bold: true },
      ];
      if (isMeaningfulValue(challanDocNo)) {
        dynamicCells.push({ k: 'Challan / Dispatch Doc No.', v: String(challanDocNo).trim(), bold: true });
      }
      if (isMeaningfulValue(challanDocDate)) {
        dynamicCells.push({ k: 'Challan Date', v: challanDocDate });
      }
      if (isMeaningfulValue(invoice.paymentTerms || invoice.modeOfPayment)) {
        dynamicCells.push({ k: 'Mode/Terms of Payment', v: String(invoice.paymentTerms || invoice.modeOfPayment).trim() });
      }
      if (isMeaningfulValue(invoice.dueDate)) {
        dynamicCells.push({ k: 'Due Date', v: formatDate(invoice.dueDate) });
      }
      if (isMeaningfulValue(invoice.deliveryNote || invoice.orderRef)) {
        dynamicCells.push({ k: 'Delivery Note / Order Ref', v: String(invoice.deliveryNote || invoice.orderRef).trim() });
      }
      if (isMeaningfulValue(invoice.refNoDate || invoice.otherReferences || invoice.orderNo)) {
        dynamicCells.push({ k: 'Reference No.', v: String(invoice.refNoDate || invoice.otherReferences || invoice.orderNo).trim() });
      }
      if (isMeaningfulValue(invoice.transport || invoice.dispatchThrough)) {
        dynamicCells.push({ k: 'Dispatched Through', v: String(invoice.transport || invoice.dispatchThrough).trim() });
      }
      if (isMeaningfulValue(invoice.deliveryTerms || invoice.termsOfDelivery || invoice.destination)) {
        dynamicCells.push({ k: 'Terms of Delivery', v: String(invoice.deliveryTerms || invoice.termsOfDelivery || invoice.destination).trim() });
      }
      if (isMeaningfulValue(invoice.deliveryBy || invoice.agentName || invoice.brokerName)) {
        dynamicCells.push({ k: 'Agent / Delivery By', v: String(invoice.deliveryBy || invoice.agentName || invoice.brokerName).trim() });
      }
      if (isMeaningfulValue(invoice.vehicleNo)) {
        dynamicCells.push({ k: 'Vehicle No.', v: String(invoice.vehicleNo).trim() });
      }
      if (isMeaningfulValue(invoice.eWayBillNo)) {
        dynamicCells.push({ k: 'E-Way Bill No.', v: String(invoice.eWayBillNo).trim() });
      }

      // Pair cells into rows of up to 2 columns
      const rightMetaRows = [];
      for (let i = 0; i < dynamicCells.length; i += 2) {
        rightMetaRows.push({
          c1: dynamicCells[i],
          c2: dynamicCells[i + 1] || null,
        });
      }

      const row1H = Math.max(76, rightMetaRows.length * 24);
      const hasBuyerInfo = isMeaningfulValue(buyerName) || isMeaningfulValue(buyerAddr) || isMeaningfulValue(buyerGstin);
      const row2H = hasBuyerInfo ? 68 : 0;
      const topGridH = row1H + row2H;

      // Outer Box Container
      doc.lineWidth(1).strokeColor(BORDER)
         .rect(PAD, currentY, CW, topGridH).stroke();

      // Vertical Split between Left & Right Columns
      doc.lineWidth(0.75).strokeColor(GRID_LINE)
         .moveTo(midX, currentY).lineTo(midX, currentY + topGridH).stroke();

      // Horizontal Split between Row 1 and Row 2 (only if Row 2 exists)
      const splitY = currentY + row1H;
      if (row2H > 0) {
        doc.lineWidth(0.75).strokeColor(GRID_LINE)
           .moveTo(PAD, splitY).lineTo(PAD + CW, splitY).stroke();
      }

      // ── ROW 1: LEFT BOX (Supplier / Seller Details - Only populated fields) ──
      const leftX = PAD + 6;
      const leftW = halfCW - 12;
      const logoFile = resolveCompanyLogo(resolvedCompany);
      let sellerContentY = currentY + 5;

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
        sellerContentY += 14;
      }

      if (isMeaningfulValue(companyAddress)) {
        doc.fillColor(TEXT_MAIN).fontSize(6.8).font('Helvetica')
           .text(companyAddress, leftX, sellerContentY, { width: leftW, lineGap: 0.5 });
        sellerContentY += doc.heightOfString(companyAddress, { width: leftW, lineGap: 0.5 }) + 3;
      }

      if (isMeaningfulValue(companyGstin)) {
        doc.font('Helvetica-Bold').fontSize(7.2).fillColor(TEXT_MAIN).text('GSTIN/UIN: ', leftX, sellerContentY, { continued: true })
           .font('Helvetica').text(companyGstin);
        sellerContentY += 10;
      }

      if (isMeaningfulValue(companyState)) {
        const stateText = isMeaningfulValue(companyStateCode)
          ? `State Name : ${companyState}, Code : ${companyStateCode}`
          : `State Name : ${companyState}`;
        doc.font('Helvetica').fontSize(7.2).fillColor(TEXT_MAIN)
           .text(stateText, leftX, sellerContentY);
        sellerContentY += 10;
      }

      if (isMeaningfulValue(companyEmail)) {
        doc.font('Helvetica').fontSize(7).fillColor(TEXT_MAIN)
           .text(`Contact : ${companyEmail}`, leftX, sellerContentY);
      }

      // ── ROW 1: RIGHT BOX (Dynamic Invoice Metadata Grid) ──
      const subW = Math.floor(rightColW / 2);
      const col1X = midX + 5;
      const col2X = midX + subW + 5;
      const col1ValW = subW - 10;
      const col2ValW = rightColW - subW - 10;
      const subDivX = midX + subW;
      const metaRowH = row1H / Math.max(1, rightMetaRows.length);

      let metaY = currentY;
      rightMetaRows.forEach((r, idx) => {
        if (idx > 0) {
          doc.lineWidth(0.5).strokeColor(GRID_LINE)
             .moveTo(midX, metaY).lineTo(PAD + CW, metaY).stroke();
        }

        if (r.c2) {
          doc.lineWidth(0.5).strokeColor(GRID_LINE)
             .moveTo(subDivX, metaY).lineTo(subDivX, metaY + metaRowH).stroke();
        }

        if (r.c1) {
          doc.fillColor(TEXT_MUTED).fontSize(6.2).font('Helvetica').text(r.c1.k, col1X, metaY + 3);
          doc.fillColor(r.c1.bold ? BRAND : TEXT_MAIN).fontSize(r.c1.bold ? 8 : 7.2).font(r.c1.bold ? 'Helvetica-Bold' : 'Helvetica')
             .text(r.c1.v, col1X, metaY + 11.5, { width: r.c2 ? col1ValW : (rightColW - 10), lineBreak: false });
        }

        if (r.c2) {
          doc.fillColor(TEXT_MUTED).fontSize(6.2).font('Helvetica').text(r.c2.k, col2X, metaY + 3);
          doc.fillColor(r.c2.bold ? BRAND : TEXT_MAIN).fontSize(r.c2.bold ? 8 : 7.2).font(r.c2.bold ? 'Helvetica-Bold' : 'Helvetica')
             .text(r.c2.v, col2X, metaY + 11.5, { width: col2ValW, lineBreak: false });
        }

        metaY += metaRowH;
      });

      // ── ROW 2: CONSIGNEE (SHIP TO) & BUYER (BILL TO) (Dynamic fields only) ──
      if (row2H > 0) {
        const shipY = splitY + 4;
        doc.fillColor(TEXT_MUTED).fontSize(6.5).font('Helvetica')
           .text('Consignee (Ship to)', leftX, shipY);

        let curShipY = shipY + 9;
        if (isMeaningfulValue(consigneeName)) {
          doc.fillColor(BRAND).fontSize(8.5).font('Helvetica-Bold')
             .text(consigneeName, leftX, curShipY, { width: leftW, lineBreak: false });
          curShipY += 11;
        }
        if (isMeaningfulValue(consigneeAddr)) {
          doc.fillColor(TEXT_MAIN).fontSize(7).font('Helvetica')
             .text(consigneeAddr, leftX, curShipY, { width: leftW, lineGap: 0.5 });
          curShipY += Math.min(24, doc.heightOfString(consigneeAddr, { width: leftW }) + 2);
        }
        if (isMeaningfulValue(consigneeGstin)) {
          doc.font('Helvetica-Bold').fontSize(7.2).fillColor(TEXT_MAIN).text('GSTIN/UIN : ', leftX, curShipY, { continued: true })
             .font('Helvetica').text(consigneeGstin);
          curShipY += 9.5;
        }
        if (isMeaningfulValue(consigneeState)) {
          const stStr = isMeaningfulValue(consigneeStateCode)
            ? `State Name : ${consigneeState}, Code : ${consigneeStateCode}`
            : `State Name : ${consigneeState}`;
          doc.font('Helvetica').fontSize(7.2).fillColor(TEXT_MAIN).text(stStr, leftX, curShipY);
        } else if (isMeaningfulValue(consigneePhone)) {
          doc.font('Helvetica').fontSize(7.2).fillColor(TEXT_MAIN).text(`Phone : ${consigneePhone}`, leftX, curShipY);
        }

        // Right Half: Buyer (Bill To)
        const billY = splitY + 4;
        const billX = midX + 6;
        const billW = rightColW - 12;

        doc.fillColor(TEXT_MUTED).fontSize(6.5).font('Helvetica')
           .text('Buyer (Bill to)', billX, billY);

        let curBillY = billY + 9;
        if (isMeaningfulValue(buyerName)) {
          doc.fillColor(BRAND).fontSize(8.5).font('Helvetica-Bold')
             .text(buyerName, billX, curBillY, { width: billW, lineBreak: false });
          curBillY += 11;
        }
        if (isMeaningfulValue(buyerAddr)) {
          doc.fillColor(TEXT_MAIN).fontSize(7).font('Helvetica')
             .text(buyerAddr, billX, curBillY, { width: billW, lineGap: 0.5 });
          curBillY += Math.min(24, doc.heightOfString(buyerAddr, { width: billW }) + 2);
        }
        if (isMeaningfulValue(buyerGstin)) {
          doc.font('Helvetica-Bold').fontSize(7.2).fillColor(TEXT_MAIN).text('GSTIN/UIN : ', billX, curBillY, { continued: true })
             .font('Helvetica').text(buyerGstin);
          curBillY += 9.5;
        }
        if (isMeaningfulValue(buyerState)) {
          const stStr = isMeaningfulValue(buyerStateCode)
            ? `State Name : ${buyerState}, Code : ${buyerStateCode}`
            : `State Name : ${buyerState}`;
          doc.font('Helvetica').fontSize(7.2).fillColor(TEXT_MAIN).text(stStr, billX, curBillY);
        }
      }

      currentY += topGridH;
    } else {
      // Continuation Header on Page 2+
      const compHdrH = 32;
      doc.lineWidth(1).strokeColor(BORDER).rect(PAD, currentY, CW, compHdrH).stroke();
      doc.fillColor(BRAND).fontSize(9.5).font('Helvetica-Bold')
         .text(`${companyDisplayName}  •  TAX INVOICE: ${invoice.invoiceNo || ''}  •  DATE: ${formatDate(invoice.invoiceDate)}`, PAD + 8, currentY + 5);
      const subParts = [];
      if (isMeaningfulValue(buyerName)) subParts.push(`BUYER: ${buyerName}`);
      if (isMeaningfulValue(invoice.challanNo || invoice.dispatchDocNo || invoice.ourChallanNo)) {
        subParts.push(`CHALLAN: ${invoice.challanNo || invoice.dispatchDocNo || invoice.ourChallanNo}`);
      }
      if (subParts.length > 0) {
        doc.fillColor(TEXT_MUTED).fontSize(7.2).font('Helvetica')
           .text(subParts.join('   |   '), PAD + 8, currentY + 18);
      }
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
    const showHsnTable = totalTax > 0;
    const bottomFooterH = isLastPage ? (showHsnTable ? 172 : 120) : 24;
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

      const iName = (it.itemName || it.description || it.particulars || '').trim();
      const descParts = [];
      if (isMeaningfulValue(it.description) && String(it.description).trim() !== iName) {
        descParts.push(String(it.description).trim());
      }
      if (isMeaningfulValue(it.designNo)) descParts.push(`Design: ${it.designNo}`);
      if (isMeaningfulValue(it.lotNo)) descParts.push(`Lot: ${it.lotNo}`);
      if (isMeaningfulValue(it.fabric || it.fabricName)) descParts.push(`Fabric: ${it.fabric || it.fabricName}`);
      if (isMeaningfulValue(it.jobNo || it.jobCardNo)) descParts.push(`Job Card: #${String(it.jobNo || it.jobCardNo).replace(/^#?JOB\s*NO\.?\s*[-:]?\s*/i, '')}`);
      if (isMeaningfulValue(it.partyChallanNo || it.vendorChallanNo)) descParts.push(`Challan: ${it.partyChallanNo || it.vendorChallanNo}`);

      const descStr = descParts.join('  •  ');
      const itemUnit = it.unit || it.qtyUnit || overallQtyUnit;

      doc.fillColor(TEXT_MAIN).fontSize(7.5).font('Helvetica-Bold')
         .text(String(runningItemIndex), colX[0] + 1, itemRowY, { width: tableCols[0].w - 2, align: 'center' });

      if (iName) {
        doc.font('Helvetica-Bold').fontSize(8)
           .text(iName, colX[1] + 3, itemRowY, { width: tableCols[1].w - 6 });
      }

      if (descStr) {
        doc.font('Helvetica').fontSize(6.8).fillColor(TEXT_MUTED)
           .text(descStr, colX[1] + 3, itemRowY + (iName ? 10 : 0), { width: tableCols[1].w - 6, lineGap: 0.5 });
      }

      const itemHsn = isMeaningfulValue(it.hsnCode || it.hsn) ? String(it.hsnCode || it.hsn).trim() : '';
      if (itemHsn) {
        doc.fillColor(TEXT_MAIN).font('Helvetica').fontSize(7.5)
           .text(itemHsn, colX[2] + 2, itemRowY, { width: tableCols[2].w - 4, align: 'center' });
      }

      doc.fillColor(TEXT_MAIN).font('Helvetica-Bold').fontSize(7.8)
         .text(`${qVal.toFixed(2)} ${itemUnit}`, colX[3] + 2, itemRowY, { width: tableCols[3].w - 4, align: 'right' });

      doc.font('Helvetica').fontSize(7.8)
         .text(rateVal.toFixed(2), colX[4] + 2, itemRowY, { width: tableCols[4].w - 4, align: 'right' });

      doc.font('Helvetica').fontSize(7.2)
         .text(itemUnit, colX[5] + 2, itemRowY, { width: tableCols[5].w - 4, align: 'center' });

      if (hasDiscount) {
        const dPct = parseFloat(it.discountPercent || it.discountPct || it.discountRate || it.discount || 0);
        const dAmt = parseFloat(it.discountAmount || it.discountAmt || 0);
        const discStr = dPct > 0 ? `${dPct}%` : (dAmt > 0 ? `₹${dAmt.toFixed(2)}` : '');
        if (discStr) {
          doc.font('Helvetica').fontSize(7.5).fillColor(BRAND)
             .text(discStr, colX[discColIdx] + 2, itemRowY, { width: tableCols[discColIdx].w - 4, align: 'right' });
        }
      }

      doc.font('Helvetica-Bold').fontSize(8.2).fillColor(TEXT_MAIN)
         .text(amtVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX[amountColIdx] + 2, itemRowY, { width: tableCols[amountColIdx].w - 4, align: 'right' });

      const rowH = descStr ? 22 : 16;
      itemRowY += rowH;
    });

    // ── D. SUMMARY, TAXES & NET RECEIVABLE ROWS INSIDE ITEM TABLE ──
    if (isLastPage) {
      itemRowY += 4;

      // Subtotal (Taxable Value) Row if multiple items exist or tax/roundOff/TDS exists
      if (chunk.length > 1 || totalTax > 0 || roundOffVal !== 0 || (hasTds && tdsAmount > 0)) {
        doc.fillColor(TEXT_MUTED).fontSize(7.5).font('Helvetica-Bold')
           .text('Subtotal (Taxable Value)', colX[1] + 6, itemRowY, { width: colX[amountColIdx] - colX[1] - 12, align: 'right' });
        doc.fillColor(TEXT_MAIN).fontSize(7.8).font('Helvetica-Bold')
           .text(totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX[amountColIdx] + 2, itemRowY, { width: tableCols[amountColIdx].w - 4, align: 'right' });
        itemRowY += 12;
      }

      // CGST & SGST (or IGST) Rows — only rendered when tax is non-zero
      if (totalTax > 0) {
        const effRate = hsnRows[0]?.rate || 5;
        if (isIgst && totalIgst > 0) {
          doc.fillColor(TEXT_MAIN).fontSize(7.8).font('Helvetica-Bold')
             .text(`IGST @ ${effRate.toFixed(1)}%`, colX[1] + 6, itemRowY, { width: colX[amountColIdx] - colX[1] - 12, align: 'right' });
          doc.text(totalIgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX[amountColIdx] + 2, itemRowY, { width: tableCols[amountColIdx].w - 4, align: 'right' });
          itemRowY += 12;
        } else {
          if (totalCgst > 0) {
            doc.fillColor(TEXT_MAIN).fontSize(7.8).font('Helvetica-Bold')
               .text(`CGST @ ${(effRate / 2).toFixed(1)}%`, colX[1] + 6, itemRowY, { width: colX[amountColIdx] - colX[1] - 12, align: 'right' });
            doc.text(totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX[amountColIdx] + 2, itemRowY, { width: tableCols[amountColIdx].w - 4, align: 'right' });
            itemRowY += 12;
          }
          if (totalSgst > 0) {
            doc.fillColor(TEXT_MAIN).fontSize(7.8).font('Helvetica-Bold')
               .text(`SGST @ ${(effRate / 2).toFixed(1)}%`, colX[1] + 6, itemRowY, { width: colX[amountColIdx] - colX[1] - 12, align: 'right' });
            doc.text(totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX[amountColIdx] + 2, itemRowY, { width: tableCols[amountColIdx].w - 4, align: 'right' });
            itemRowY += 12;
          }
        }
      }

      // Round-off Row (only if non-zero)
      if (roundOffVal !== 0) {
        doc.fillColor(TEXT_MUTED).fontSize(7.5).font('Helvetica')
           .text('Round Off', colX[1] + 6, itemRowY, { width: colX[amountColIdx] - colX[1] - 12, align: 'right' });
        doc.fillColor(TEXT_MAIN).fontSize(7.8).font('Helvetica')
           .text((roundOffVal > 0 ? `+${roundOffVal.toFixed(2)}` : roundOffVal.toFixed(2)), colX[amountColIdx] + 2, itemRowY, { width: tableCols[amountColIdx].w - 4, align: 'right' });
        itemRowY += 12;
      }

      // Job-work / ERP Specific Deductions: Less TDS & Net Receivable (only when enabled & > 0)
      if (hasTds && tdsAmount > 0) {
        doc.fillColor('#dc2626').fontSize(7.5).font('Helvetica-Bold')
           .text(`Less: TDS (${tdsSection}) @ ${tdsRate}%`, colX[1] + 6, itemRowY, { width: colX[amountColIdx] - colX[1] - 12, align: 'right' });
        doc.fillColor('#dc2626').fontSize(7.8).font('Helvetica-Bold')
           .text(`-${tdsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, colX[amountColIdx] + 2, itemRowY, { width: tableCols[amountColIdx].w - 4, align: 'right' });
        itemRowY += 12;

        doc.fillColor(BRAND).fontSize(8).font('Helvetica-Bold')
           .text('Net Receivable', colX[1] + 6, itemRowY, { width: colX[amountColIdx] - colX[1] - 12, align: 'right' });
        doc.fillColor(BRAND).fontSize(8.5).font('Helvetica-Bold')
           .text(`₹ ${netReceivable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, colX[amountColIdx] + 2, itemRowY, { width: tableCols[amountColIdx].w - 4, align: 'right' });
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
         .text(`₹ ${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, colX[amountColIdx] + 2, totalRowY + 5, { width: tableCols[amountColIdx].w - 4, align: 'right' });
    } else {
      doc.fillColor(BRAND).fontSize(8).font('Helvetica-Bold')
         .text('Page Subtotal (Continued on Next Page...):', colX[1] + 6, totalRowY + 5, { width: colX[3] - colX[1] - 8, align: 'right' });

      doc.fillColor(BRAND).fontSize(8).font('Helvetica-Bold')
         .text(`${pageQty.toFixed(2)} ${overallQtyUnit}`, colX[3] + 2, totalRowY + 5, { width: tableCols[3].w - 4, align: 'right' });

      doc.fillColor(BRAND).fontSize(8.5).font('Helvetica-Bold')
         .text(pageAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX[amountColIdx] + 2, totalRowY + 5, { width: tableCols[amountColIdx].w - 4, align: 'right' });
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

      // ── 2. GST TAX BREAKDOWN TABLE (Only if totalTax > 0) ──
      if (showHsnTable) {
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
        const firstHsn = hsnRows[0] || { hsn: '', taxable: totalTaxable, rate: 5, cgst: totalCgst, sgst: totalSgst, igst: totalIgst };
        const halfRate = (firstHsn.rate / 2).toFixed(2);

        doc.font('Helvetica').fontSize(7.2).fillColor(TEXT_MAIN);
        if (firstHsn.hsn) {
          doc.text(firstHsn.hsn, hsnColX[0] + 4, hsnRowY, { width: hsnColW[0] - 8, align: 'center' });
        }
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
      }

      // ── 4. FOOTER BLOCK (Equal 50/50 Horizontal Split) ──
      const footerBoxH = 62;
      doc.rect(PAD, currentY, CW, footerBoxH).stroke(BORDER);
      const footerMidX = PAD + halfCW;
      doc.lineWidth(0.75).strokeColor(GRID_LINE).moveTo(footerMidX, currentY).lineTo(footerMidX, currentY + footerBoxH).stroke();

      // Left Box: Dynamic Bank Details (only if present) + Notes/Terms + Declaration
      const footLeftX = PAD + 6;
      const footLeftW = halfCW - 12;

      const bankName = (companyConfig.companyBanks && companyConfig.companyBanks[0]?.bankName) || companyConfig.companyBankName || invoice.bankName || '';
      const bankAccount = (companyConfig.companyBanks && companyConfig.companyBanks[0]?.accountNo) || companyConfig.companyAccountNo || invoice.bankAccountNo || '';
      const bankIfsc = (companyConfig.companyBanks && companyConfig.companyBanks[0]?.ifscCode) || companyConfig.companyIfscCode || invoice.bankIfsc || '';
      const bankBranch = (companyConfig.companyBanks && companyConfig.companyBanks[0]?.branch) || companyConfig.companyBranch || invoice.bankBranch || '';

      let footY = currentY + 3;
      if (isMeaningfulValue(bankName) || isMeaningfulValue(bankAccount) || isMeaningfulValue(bankIfsc)) {
        doc.fillColor(TEXT_MUTED).fontSize(6.5).font('Helvetica-Bold')
           .text('Company\'s Bank Details:', footLeftX, footY);
        footY += 8;
        doc.fillColor(TEXT_MAIN).fontSize(6.8).font('Helvetica');
        if (isMeaningfulValue(bankName)) {
          doc.text(`Bank Name   : ${bankName}`, footLeftX, footY);
          footY += 8;
        }
        if (isMeaningfulValue(bankAccount)) {
          doc.text(`A/c No.     : ${bankAccount}`, footLeftX, footY);
          footY += 8;
        }
        if (isMeaningfulValue(bankBranch) || isMeaningfulValue(bankIfsc)) {
          const branchIfscStr = [bankBranch, bankIfsc ? `(${bankIfsc})` : ''].filter(Boolean).join(' ');
          doc.text(`Branch & IFS: ${branchIfscStr}`, footLeftX, footY);
          footY += 9;
        }
      } else if (isMeaningfulValue(invoice.notes) || isMeaningfulValue(invoice.termsAndConditions)) {
        const customTerms = [invoice.notes, invoice.termsAndConditions].filter(isMeaningfulValue).join(' • ');
        doc.fillColor(TEXT_MUTED).fontSize(6.5).font('Helvetica-Bold')
           .text('Notes / Terms:', footLeftX, footY);
        footY += 8;
        doc.fillColor(TEXT_MAIN).fontSize(6.5).font('Helvetica')
           .text(customTerms.substring(0, 180), footLeftX, footY, { width: footLeftW, lineGap: 0.3 });
        footY += 18;
      }

      doc.fillColor(TEXT_MUTED).fontSize(6.2).font('Helvetica-Bold')
         .text('Declaration:', footLeftX, Math.max(footY, currentY + 36));
      doc.fillColor(TEXT_MUTED).fontSize(6.2).font('Helvetica')
         .text('We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.', footLeftX, Math.max(footY + 8, currentY + 44), { width: footLeftW, lineGap: 0.3 });

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
