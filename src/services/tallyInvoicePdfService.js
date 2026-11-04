/**
 * Tally GST Tax Invoice Vector PDF Generator
 * Renders pixel-accurate Tally ERP / Prime GST Tax Invoices
 * Supports Issuing Company Brand Color for Original & Black/White for Duplicate
 */

const PDFDocument = require('pdfkit');

// Central Brand Color registry for all companies
const COMPANY_BRAND_COLORS = {
  'Elite Digital Print': '#1d4ed8', // EDP (Royal Blue)
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
  if (norm === 'elitedigitalprint' || norm === 'elitedigitalprints' || norm === 'edp' || norm === 'digitalprint') return '#1d4ed8';
  if (norm === 'sobise' || norm === 'so') return '#e11d48';
  if (norm === 'eliteonline' || norm === 'eon' || norm === 'eo') return '#4f46e5';
  if (norm === 'exedp' || norm === 'ex-edp') return '#475569';
  return '#1d4ed8';
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

function tintColor(hex, factor = 0.08) {
  const { r, g, b } = hexToRgb(hex);
  const tr = Math.round(r * factor + 255 * (1 - factor));
  const tg = Math.round(g * factor + 255 * (1 - factor));
  const tb = Math.round(b * factor + 255 * (1 - factor));
  return `#${((1 << 24) + (tr << 16) + (tg << 8) + tb).toString(16).slice(1)}`;
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

/**
 * Splits items for pagination:
 * Up to 7 items fit on a single page with all Tally boxes, HSN summary & signatures.
 */
function chunkInvoiceItems(items, maxFirst = 7, maxOther = 12) {
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

  // Palette selection
  const BRAND = isColor ? baseBrandColor : '#000000';
  const BORDER = isColor ? baseBrandColor : '#000000';
  const GRID_LINE = '#cbd5e1';
  const TEXT_MAIN = '#000000';
  const TEXT_MUTED = '#475569';
  const BG_TINT = isColor ? tintColor(baseBrandColor, 0.08) : '#f8fafc';

  // Geometry
  const PW = 595.28;
  const PH = 841.89;
  const PAD = 20;
  const CW = PW - PAD * 2; // 555.28
  const halfCW = Math.floor(CW / 2); // 277
  const rightColW = CW - halfCW; // 278.28

  // Seller details resolution strictly honoring the issuing company
  let companyDisplayName = (isDirectConfig && companyConfig.companyName) ? companyConfig.companyName : resolvedCompany.toUpperCase();
  companyDisplayName = companyDisplayName.replace(/\s*\([^)]*\)/g, '').trim();

  const companyAddress = ((isDirectConfig && companyConfig.companyAddress) ? companyConfig.companyAddress : (resolvedCompany === 'Elite Online' ? 'Plot No. 12, Surat, Gujarat' : (companyConfig.companyAddress || 'Plot No. 12, Surat, Gujarat'))).toUpperCase();
  const companyGstin = (isDirectConfig && companyConfig.companyGstin) ? companyConfig.companyGstin : (resolvedCompany === 'Elite Online' ? '24AANFE0044M1ZG' : (resolvedCompany === 'Elite Digital Print' ? '24AANFE0044M1ZG' : (resolvedCompany === 'Yamunaji' ? '24AAEFY0361N1ZZ' : (companyConfig.companyGstin || ''))));
  const companyState = (isDirectConfig && companyConfig.companyState) ? companyConfig.companyState : 'Gujarat';
  const companyStateCode = (isDirectConfig && companyConfig.companyStateCode) ? companyConfig.companyStateCode : '24';
  const companyEmail = (isDirectConfig && (companyConfig.companyEmail || companyConfig.companyPhone)) ? (companyConfig.companyEmail || companyConfig.companyPhone) : (resolvedCompany === 'Elite Digital Print' ? 'elitedigitalprint@gmail.com' : 'info@company.com');
  const companyCity = (isDirectConfig && companyConfig.companyCity) ? companyConfig.companyCity : 'Surat';

  const cust = invoice.customer || {};
  const consigneeName = (cust.businessName || cust.name || 'Party Name').trim();
  const consigneeAddr = (cust.shippingAddress || cust.billingAddress || 'Surat, Gujarat').trim();
  const consigneeGstin = cust.gstin && cust.gstin !== 'N/A' ? cust.gstin : '';
  const consigneeState = cust.state || 'Gujarat';
  const consigneeStateCode = cust.stateCode || '24';

  const buyerName = (cust.businessName || cust.name || 'Party Name').trim();
  const buyerAddr = (cust.billingAddress || cust.shippingAddress || 'Surat, Gujarat').trim();
  const buyerGstin = cust.gstin && cust.gstin !== 'N/A' ? cust.gstin : '';
  const buyerState = cust.state || 'Gujarat';
  const buyerStateCode = cust.stateCode || '24';

  const items = invoice.items || [];
  const itemChunks = chunkInvoiceItems(items, 7, 12);
  const totalPages = itemChunks.length;

  const taxType = invoice.taxType || (consigneeStateCode && String(consigneeStateCode).trim() !== String(companyStateCode).trim() ? 'IGST' : 'CGST_SGST');
  const isIgst = taxType === 'IGST';

  // Tax calculation
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

  const rawGrandTotal = totalTaxable + totalTax;
  const grandTotal = invoice.grandTotal ? Number(invoice.grandTotal) : rawGrandTotal;

  // Table Columns
  const tableCols = [
    { id: 'sr', title: 'Sl\nNo.', w: 22, align: 'center' },
    { id: 'item', title: 'Item Name', w: 140, align: 'left' },
    { id: 'desc', title: 'Description', w: 98, align: 'left' },
    { id: 'hsn', title: 'HSN/SAC', w: 46, align: 'center' },
    { id: 'qty', title: 'Quantity', w: 68, align: 'right' },
    { id: 'rate', title: 'Rate', w: 48, align: 'right' },
    { id: 'per', title: 'per', w: 30, align: 'center' },
    { id: 'disc', title: 'Disc. %', w: 32, align: 'right' },
    { id: 'amount', title: 'Amount', w: 71.28, align: 'right' }
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
    const topY = 22;

    // 1. Top Header
    doc.fillColor(BRAND).fontSize(12).font('Helvetica-Bold')
       .text('TAX INVOICE', PAD, topY, { width: CW, align: 'center' });

    const pLabel = totalPages > 1 ? `${copyLabel} - Page ${pageIdx + 1} of ${totalPages}` : copyLabel;
    doc.fillColor(isColor ? BRAND : TEXT_MUTED).fontSize(7.5).font('Helvetica-Bold')
       .text(pLabel, PAD, topY + 13, { width: CW, align: 'center' });

    let currentY = 46;

    // Top Grid Box on Page 1 (or compact header on subsequent pages)
    if (isFirstPage) {
      const topGridH = 176;
      doc.lineWidth(0.75).strokeColor(BORDER)
         .rect(PAD, currentY, CW, topGridH).stroke();

      const midX = PAD + halfCW;
      doc.lineWidth(0.5).strokeColor(GRID_LINE)
         .moveTo(midX, currentY).lineTo(midX, currentY + topGridH).stroke();

      // LEFT COLUMN
      const leftX = PAD + 5;
      const leftW = halfCW - 10;

      // Seller (H = 68)
      const sellerH = 68;
      doc.fillColor(BRAND).fontSize(9.5).font('Helvetica-Bold')
         .text(companyDisplayName, leftX, currentY + 4, { width: leftW });

      doc.fillColor(TEXT_MAIN).fontSize(7).font('Helvetica')
         .text(companyAddress, leftX, currentY + 16, { width: leftW, lineGap: 0.5 });

      const sellerMetaY = currentY + 40;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(TEXT_MAIN).text('GSTIN/UIN: ', leftX, sellerMetaY, { continued: true })
         .font('Helvetica').text(companyGstin);

      doc.font('Helvetica').fontSize(7.5)
         .text(`State Name : ${companyState}, Code : ${companyStateCode}`, leftX, sellerMetaY + 10)
         .text(`E-Mail : ${companyEmail}`, leftX, sellerMetaY + 20);

      // Divider line 1
      const div1Y = currentY + sellerH;
      doc.lineWidth(0.5).strokeColor(GRID_LINE)
         .moveTo(PAD, div1Y).lineTo(midX, div1Y).stroke();

      // Consignee (H = 54)
      const consigneeH = 54;
      doc.fillColor(TEXT_MUTED).fontSize(7).font('Helvetica')
         .text('Consignee (Ship to)', leftX, div1Y + 3);

      doc.fillColor(TEXT_MAIN).fontSize(8.5).font('Helvetica-Bold')
         .text(consigneeName, leftX, div1Y + 12, { width: leftW });

      doc.fillColor(TEXT_MAIN).fontSize(7).font('Helvetica')
         .text(consigneeAddr, leftX, div1Y + 23, { width: leftW, lineGap: 0.5 });

      doc.font('Helvetica').fontSize(7.5)
         .text(`GSTIN/UIN   : ${consigneeGstin || 'Unregistered'}`, leftX, div1Y + 35)
         .text(`State Name  : ${consigneeState}, Code : ${consigneeStateCode}`, leftX, div1Y + 44);

      // Divider line 2
      const div2Y = div1Y + consigneeH;
      doc.lineWidth(0.5).strokeColor(GRID_LINE)
         .moveTo(PAD, div2Y).lineTo(midX, div2Y).stroke();

      // Buyer (H = 54)
      doc.fillColor(TEXT_MUTED).fontSize(7).font('Helvetica')
         .text('Buyer (Bill to)', leftX, div2Y + 3);

      doc.fillColor(TEXT_MAIN).fontSize(8.5).font('Helvetica-Bold')
         .text(buyerName, leftX, div2Y + 12, { width: leftW });

      doc.fillColor(TEXT_MAIN).fontSize(7).font('Helvetica')
         .text(buyerAddr, leftX, div2Y + 23, { width: leftW, lineGap: 0.5 });

      doc.font('Helvetica').fontSize(7.5)
         .text(`GSTIN/UIN   : ${buyerGstin || 'Unregistered'}`, leftX, div2Y + 35)
         .text(`State Name  : ${buyerState}, Code : ${buyerStateCode}`, leftX, div2Y + 44);

      // RIGHT COLUMN
      const subW = Math.floor(rightColW / 2);
      const col1X = midX + 4;
      const col2X = midX + subW + 4;
      const col1ValW = subW - 8;
      const col2ValW = rightColW - subW - 8;
      const subDivX = midX + subW;

      const rightRows = [
        {
          h: 22,
          k1: 'Invoice No.', v1: invoice.invoiceNo || '--', bold1: true,
          k2: 'Dated', v2: formatDate(invoice.invoiceDate), bold2: true
        },
        {
          h: 22,
          k1: 'Delivery Note', v1: invoice.deliveryNote || invoice.orderRef || '',
          k2: 'Mode/Terms of Payment', v2: invoice.paymentTerms || invoice.modeOfPayment || ''
        },
        {
          h: 22,
          k1: 'Reference No. & Date.', v1: invoice.refNoDate || '',
          k2: 'Other References', v2: invoice.otherReferences || invoice.orderNo || ''
        },
        {
          h: 22,
          k1: 'Dispatch Doc No.', v1: invoice.ourChallanNo || invoice.dispatchDocNo || (invoice.linkedChallanNos && invoice.linkedChallanNos.join(', ')) || invoice.challanNo || '', bold1: true,
          k2: 'Delivery Note Date', v2: formatDate(invoice.challanDate || invoice.invoiceDate)
        },
        {
          h: 22,
          k1: 'Dispatched through', v1: invoice.deliveryBy || invoice.dispatchedThrough || 'Direct',
          k2: 'Destination', v2: invoice.destination || (cust.city || cust.state || '')
        },
        {
          h: 22,
          k1: 'Vessel/Flight No.', v1: invoice.vehicleNo || invoice.vesselFlightNo || '',
          k2: 'Place of receipt by shipper:', v2: invoice.receiptPlace || ''
        },
        {
          h: 22,
          k1: 'City/Port of Loading', v1: invoice.portLoading || '',
          k2: 'City/Port of Discharge', v2: invoice.portDischarge || ''
        },
        {
          h: 22,
          fullWidth: true,
          k: 'Terms of Delivery',
          v: invoice.termsOfDelivery || (`Delivery to ${cust.businessName || cust.name || 'Party'}`)
        }
      ];

      let rY = currentY;
      rightRows.forEach((r, idx) => {
        if (idx > 0) {
          doc.lineWidth(0.5).strokeColor(GRID_LINE)
             .moveTo(midX, rY).lineTo(PAD + CW, rY).stroke();
        }

        if (r.fullWidth) {
          doc.fillColor(TEXT_MUTED).fontSize(6.5).font('Helvetica').text(r.k, col1X, rY + 2);
          doc.fillColor(TEXT_MAIN).fontSize(7.5).font('Helvetica').text(r.v, col1X, rY + 10, { width: rightColW - 8 });
        } else {
          doc.lineWidth(0.5).strokeColor(GRID_LINE)
             .moveTo(subDivX, rY).lineTo(subDivX, rY + r.h).stroke();

          doc.fillColor(TEXT_MUTED).fontSize(6.5).font('Helvetica').text(r.k1, col1X, rY + 2);
          doc.fillColor(TEXT_MAIN).fontSize(r.bold1 ? 8 : 7.5).font(r.bold1 ? 'Helvetica-Bold' : 'Helvetica')
             .text(r.v1, col1X, rY + 10, { width: col1ValW });

          doc.fillColor(TEXT_MUTED).fontSize(6.5).font('Helvetica').text(r.k2, col2X, rY + 2);
          doc.fillColor(TEXT_MAIN).fontSize(r.bold2 ? 8 : 7.5).font(r.bold2 ? 'Helvetica-Bold' : 'Helvetica')
             .text(r.v2, col2X, rY + 10, { width: col2ValW });
        }
        rY += r.h;
      });

      currentY += topGridH;
    } else {
      // Compact header on page 2+
      const compHdrH = 34;
      doc.lineWidth(0.75).strokeColor(BORDER).rect(PAD, currentY, CW, compHdrH).stroke();
      doc.fillColor(BRAND).fontSize(9.5).font('Helvetica-Bold')
         .text(`${companyDisplayName}  |  TAX INVOICE: ${invoice.invoiceNo || '--'}  |  DATE: ${formatDate(invoice.invoiceDate)}`, PAD + 8, currentY + 6);
      doc.fillColor(TEXT_MUTED).fontSize(7.5).font('Helvetica')
         .text(`BUYER: ${buyerName}   |   DESTINATION: ${cust.city || cust.state || 'Surat'}`, PAD + 8, currentY + 19);
      currentY += compHdrH;
    }

    // Table Header
    const tableHeaderH = 22;
    const tableHeaderY = currentY;

    doc.rect(PAD, tableHeaderY, CW, tableHeaderH).fill(BG_TINT).stroke(BORDER);
    tableCols.forEach((c, idx) => {
      doc.fillColor(BRAND).fontSize(7.5).font('Helvetica-Bold')
         .text(c.title, colX[idx] + 2, tableHeaderY + (c.title.includes('\n') ? 3 : 7), {
           width: c.w - 4,
           align: c.align
         });
    });

    colX.slice(1).forEach(cx => {
      doc.lineWidth(0.5).strokeColor(GRID_LINE)
         .moveTo(cx, tableHeaderY).lineTo(cx, tableHeaderY + tableHeaderH).stroke();
    });

    currentY += tableHeaderH;

    // Available table height
    const bottomFooterH = isLastPage ? 158 : 25;
    const tableTotalH = 20;
    const bottomMargin = 16;
    const tableBottomY = PH - bottomMargin - bottomFooterH;

    let itemRowY = currentY + 4;
    let pageQty = 0;
    let pageAmount = 0;

    chunk.forEach(it => {
      runningItemIndex++;
      const qVal = parseFloat(it.qty) || 0;
      pageQty += qVal;
      const rateVal = parseFloat(it.unitPrice != null ? it.unitPrice : it.rate) || 0;
      const amtVal = parseFloat(it.totalAmount) || (qVal * rateVal);
      pageAmount += amtVal;
      const discStr = it.discountPct ? `${it.discountPct}%` : '';

      const iName = it.itemName || 'FANCY FABRIC';
      const descParts = [];
      if (it.description) descParts.push(it.description);
      if (it.designNo) descParts.push(`Design: ${it.designNo}`);
      if (it.lotNo) descParts.push(`Lot: ${it.lotNo}`);
      const descStr = descParts.join('\n');

      doc.fillColor(TEXT_MAIN).fontSize(8).font('Helvetica-Bold')
         .text(String(runningItemIndex), colX[0] + 2, itemRowY, { width: tableCols[0].w - 4, align: 'center' });

      doc.font('Helvetica-Bold').fontSize(8.5)
         .text(iName, colX[1] + 3, itemRowY, { width: tableCols[1].w - 6 });

      doc.font('Helvetica').fontSize(7.5)
         .text(descStr, colX[2] + 2, itemRowY, { width: tableCols[2].w - 4 });

      doc.font('Helvetica').fontSize(8)
         .text(it.hsnCode || '5407', colX[3] + 2, itemRowY, { width: tableCols[3].w - 4, align: 'center' });

      doc.font('Helvetica-Bold').fontSize(8)
         .text(`${qVal.toFixed(2)} ${overallQtyUnit}`, colX[4] + 2, itemRowY, { width: tableCols[4].w - 4, align: 'right' });

      doc.font('Helvetica').fontSize(8)
         .text(rateVal.toFixed(2), colX[5] + 2, itemRowY, { width: tableCols[5].w - 4, align: 'right' });

      doc.font('Helvetica').fontSize(7.5)
         .text(overallQtyUnit, colX[6] + 2, itemRowY, { width: tableCols[6].w - 4, align: 'center' });

      doc.font('Helvetica').fontSize(7.5)
         .text(discStr, colX[7] + 2, itemRowY, { width: tableCols[7].w - 4, align: 'right' });

      doc.font('Helvetica-Bold').fontSize(8.5)
         .text(amtVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX[8] + 2, itemRowY, { width: tableCols[8].w - 4, align: 'right' });

      const maxLines = Math.max(
        doc.heightOfString(iName, { width: tableCols[1].w - 6 }),
        descStr ? doc.heightOfString(descStr, { width: tableCols[2].w - 4 }) : 0
      );
      itemRowY += Math.max(18, maxLines + 6);
    });

    if (isLastPage) {
      itemRowY += 8;
      if (isIgst) {
        doc.fillColor(TEXT_MAIN).fontSize(8.5).font('Helvetica-Bold')
           .text('IGST', colX[2] + 4, itemRowY, { width: tableCols[2].w });
        doc.text(totalIgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX[8] + 2, itemRowY, { width: tableCols[8].w - 4, align: 'right' });
        itemRowY += 13;
      } else {
        doc.fillColor(TEXT_MAIN).fontSize(8.5).font('Helvetica-Bold')
           .text('SGST', colX[2] + 4, itemRowY, { width: tableCols[2].w });
        doc.text(totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX[8] + 2, itemRowY, { width: tableCols[8].w - 4, align: 'right' });
        itemRowY += 13;

        doc.fillColor(TEXT_MAIN).fontSize(8.5).font('Helvetica-Bold')
           .text('CGST', colX[2] + 4, itemRowY, { width: tableCols[2].w });
        doc.text(totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX[8] + 2, itemRowY, { width: tableCols[8].w - 4, align: 'right' });
        itemRowY += 13;
      }
    }

    // Vertical table separators
    const fullTableH = tableBottomY - tableHeaderY;
    doc.lineWidth(0.5).strokeColor(GRID_LINE);
    colX.slice(1).forEach(cx => {
      doc.moveTo(cx, currentY).lineTo(cx, tableBottomY).stroke();
    });

    doc.lineWidth(0.75).strokeColor(BORDER)
       .rect(PAD, tableHeaderY, CW, fullTableH).stroke();

    // Table Total / Subtotal Row
    const totalRowY = tableBottomY - tableTotalH;
    doc.rect(PAD, totalRowY, CW, tableTotalH).fill(BG_TINT).stroke(BORDER);

    doc.lineWidth(0.5).strokeColor(GRID_LINE);
    colX.slice(1).forEach(cx => {
      doc.moveTo(cx, totalRowY).lineTo(cx, tableBottomY).stroke();
    });

    if (isLastPage) {
      doc.fillColor(BRAND).fontSize(8.5).font('Helvetica-Bold')
         .text('Total', colX[1] + 10, totalRowY + 5);

      doc.fillColor(BRAND).fontSize(8.5).font('Helvetica-Bold')
         .text(`${grandTotalQty.toFixed(2)} ${overallQtyUnit}`, colX[4] + 2, totalRowY + 5, { width: tableCols[4].w - 4, align: 'right' });

      doc.fillColor(BRAND).fontSize(9.5).font('Helvetica-Bold')
         .text(`₹ ${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, colX[8] + 2, totalRowY + 5, { width: tableCols[8].w - 4, align: 'right' });
    } else {
      doc.fillColor(BRAND).fontSize(8).font('Helvetica-Bold')
         .text('Page Subtotal (Continued on Next Page...):', colX[1] + 6, totalRowY + 5, { width: colX[4] - colX[1] - 8, align: 'right' });

      doc.fillColor(BRAND).fontSize(8).font('Helvetica-Bold')
         .text(`${pageQty.toFixed(2)} ${overallQtyUnit}`, colX[4] + 2, totalRowY + 5, { width: tableCols[4].w - 4, align: 'right' });

      doc.fillColor(BRAND).fontSize(8.5).font('Helvetica-Bold')
         .text(pageAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), colX[8] + 2, totalRowY + 5, { width: tableCols[8].w - 4, align: 'right' });
    }

    currentY = tableBottomY;

    if (isLastPage) {
      // 1. Amount in words
      const wordsRowH = 24;
      doc.rect(PAD, currentY, CW, wordsRowH).stroke(BORDER);
      doc.fillColor(TEXT_MUTED).fontSize(6.5).font('Helvetica')
         .text('Amount Chargeable (in words)', PAD + 6, currentY + 3);
      doc.fillColor(TEXT_MUTED).fontSize(7).font('Helvetica-Bold')
         .text('E. & O.E', PAD + CW - 60, currentY + 3, { width: 54, align: 'right' });
      doc.fillColor(TEXT_MAIN).fontSize(8).font('Helvetica-Bold')
         .text(numToWords(grandTotal), PAD + 6, currentY + 12, { width: CW - 12 });
      currentY += wordsRowH;

      // 2. HSN Table
      const hsnTableH = 38;
      doc.rect(PAD, currentY, CW, hsnTableH).stroke(BORDER);

      const hsnColW = isIgst ? [100, 150, 150, 155.28] : [90, 110, 120, 120, 115.28];
      const hsnColX = [];
      let hsnAcc = PAD;
      hsnColW.forEach(w => { hsnColX.push(hsnAcc); hsnAcc += w; });

      const hsnHdrY = currentY;
      doc.fillColor(TEXT_MAIN).fontSize(7).font('Helvetica-Bold');
      if (isIgst) {
        doc.text('HSN/SAC', hsnColX[0] + 4, hsnHdrY + 3, { width: hsnColW[0] - 8, align: 'center' });
        doc.text('Taxable Value', hsnColX[1] + 4, hsnHdrY + 3, { width: hsnColW[1] - 8, align: 'right' });
        doc.text('IGST (Rate / Amt)', hsnColX[2] + 4, hsnHdrY + 3, { width: hsnColW[2] - 8, align: 'center' });
        doc.text('Total Tax Amount', hsnColX[3] + 4, hsnHdrY + 3, { width: hsnColW[3] - 8, align: 'right' });
      } else {
        doc.text('HSN/SAC', hsnColX[0] + 4, hsnHdrY + 3, { width: hsnColW[0] - 8, align: 'center' });
        doc.text('Taxable Value', hsnColX[1] + 4, hsnHdrY + 3, { width: hsnColW[1] - 8, align: 'right' });
        doc.text('CGST', hsnColX[2] + 4, hsnHdrY + 2, { width: hsnColW[2] - 8, align: 'center' });
        doc.text('Rate     Amount', hsnColX[2] + 4, hsnHdrY + 8, { width: hsnColW[2] - 8, align: 'center' });
        doc.text('SGST/UTGST', hsnColX[3] + 4, hsnHdrY + 2, { width: hsnColW[3] - 8, align: 'center' });
        doc.text('Rate     Amount', hsnColX[3] + 4, hsnHdrY + 8, { width: hsnColW[3] - 8, align: 'center' });
        doc.text('Total Tax Amount', hsnColX[4] + 4, hsnHdrY + 3, { width: hsnColW[4] - 8, align: 'right' });
      }

      doc.lineWidth(0.5).strokeColor(GRID_LINE).moveTo(PAD, hsnHdrY + 16).lineTo(PAD + CW, hsnHdrY + 16).stroke();
      hsnColX.slice(1).forEach(cx => {
        doc.lineWidth(0.5).strokeColor(GRID_LINE).moveTo(cx, hsnHdrY).lineTo(cx, hsnHdrY + hsnTableH).stroke();
      });

      const hsnRowY = hsnHdrY + 18;
      const firstHsn = hsnRows[0] || { hsn: '5407', taxable: totalTaxable, rate: 5, cgst: totalCgst, sgst: totalSgst, igst: totalIgst };
      const halfRate = (firstHsn.rate / 2).toFixed(2);

      doc.font('Helvetica').fontSize(7.5).fillColor(TEXT_MAIN);
      doc.text(firstHsn.hsn, hsnColX[0] + 4, hsnRowY, { width: hsnColW[0] - 8, align: 'center' });
      doc.text(firstHsn.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 }), hsnColX[1] + 4, hsnRowY, { width: hsnColW[1] - 8, align: 'right' });

      if (isIgst) {
        doc.text(`${firstHsn.rate}%   ${firstHsn.igst.toFixed(2)}`, hsnColX[2] + 4, hsnRowY, { width: hsnColW[2] - 8, align: 'center' });
        doc.font('Helvetica-Bold').text(firstHsn.igst.toFixed(2), hsnColX[3] + 4, hsnRowY, { width: hsnColW[3] - 8, align: 'right' });
      } else {
        doc.text(`${halfRate}%       ${firstHsn.cgst.toFixed(2)}`, hsnColX[2] + 4, hsnRowY, { width: hsnColW[2] - 8, align: 'center' });
        doc.text(`${halfRate}%       ${firstHsn.sgst.toFixed(2)}`, hsnColX[3] + 4, hsnRowY, { width: hsnColW[3] - 8, align: 'center' });
        doc.font('Helvetica-Bold').text((firstHsn.cgst + firstHsn.sgst).toFixed(2), hsnColX[4] + 4, hsnRowY, { width: hsnColW[4] - 8, align: 'right' });
      }

      const hsnTotY = hsnHdrY + 28;
      doc.lineWidth(0.5).strokeColor(GRID_LINE).moveTo(PAD, hsnTotY - 1).lineTo(PAD + CW, hsnTotY - 1).stroke();
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(BRAND);
      doc.text('Total', hsnColX[0] + 4, hsnTotY, { width: hsnColW[0] - 8, align: 'center' });
      doc.text(totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 }), hsnColX[1] + 4, hsnTotY, { width: hsnColW[1] - 8, align: 'right' });

      if (isIgst) {
        doc.text(totalTax.toFixed(2), hsnColX[3] + 4, hsnTotY, { width: hsnColW[3] - 8, align: 'right' });
      } else {
        doc.text(totalCgst.toFixed(2), hsnColX[2] + 4, hsnTotY, { width: hsnColW[2] - 8, align: 'right' });
        doc.text(totalSgst.toFixed(2), hsnColX[3] + 4, hsnTotY, { width: hsnColW[3] - 8, align: 'right' });
        doc.text(totalTax.toFixed(2), hsnColX[4] + 4, hsnTotY, { width: hsnColW[4] - 8, align: 'right' });
      }

      currentY += hsnTableH;

      // 3. Tax in words
      const taxWordsH = 14;
      doc.rect(PAD, currentY, CW, taxWordsH).stroke(BORDER);
      doc.fillColor(TEXT_MAIN).fontSize(7.5).font('Helvetica-Bold')
         .text(`Tax Amount (in words) :  ${numToWords(totalTax)}`, PAD + 6, currentY + 3);
      currentY += taxWordsH;

      // 4. Declaration & Signature
      const declH = 58;
      doc.rect(PAD, currentY, CW, declH).stroke(BORDER);
      const declMidX = PAD + Math.floor(CW * 0.52);
      doc.lineWidth(0.5).strokeColor(GRID_LINE).moveTo(declMidX, currentY).lineTo(declMidX, currentY + declH).stroke();

      doc.fillColor(TEXT_MAIN).fontSize(7.5).font('Helvetica-Bold').text('Declaration', PAD + 6, currentY + 4);
      doc.fillColor(TEXT_MAIN).fontSize(7).font('Helvetica')
         .text('We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.', PAD + 6, currentY + 15, { width: declMidX - PAD - 12 });

      if (companyConfig.companyBankName || companyConfig.companyAccountNo) {
        doc.fillColor(TEXT_MUTED).fontSize(6.5).font('Helvetica')
           .text(`Bank: ${companyConfig.companyBankName || 'Bank'} | A/c: ${companyConfig.companyAccountNo || '--'} | IFSC: ${companyConfig.companyIfscCode || '--'}`, PAD + 6, currentY + 44, { width: declMidX - PAD - 12 });
      }

      const rightSignW = PAD + CW - declMidX - 12;
      doc.fillColor(BRAND).fontSize(8.5).font('Helvetica-Bold')
         .text(`for ${companyDisplayName}`, declMidX + 6, currentY + 4, { width: rightSignW, align: 'right' });

      doc.fillColor(TEXT_MAIN).fontSize(8).font('Helvetica')
         .text('Authorised Signatory', declMidX + 6, currentY + 42, { width: rightSignW, align: 'right' });

      currentY += declH;

      // 5. Jurisdiction & Computer generated
      doc.fillColor(TEXT_MAIN).fontSize(7.5).font('Helvetica-Bold')
         .text(`SUBJECT TO ${companyCity.toUpperCase()} JURISDICTION`, PAD, currentY + 3, { width: CW, align: 'center' });

      doc.fillColor(TEXT_MUTED).fontSize(6.5).font('Helvetica')
         .text('This is a Computer Generated Invoice', PAD, currentY + 13, { width: CW, align: 'center' });
    } else {
      // Intermediate page footer
      doc.fillColor(TEXT_MUTED).fontSize(7).font('Helvetica')
         .text('This is a Computer Generated Document  |  Continued on Next Page...', PAD, currentY + 6, { width: CW, align: 'center' });
    }
  });
}

module.exports = {
  renderTallyInvoice,
  getCompanyBrandColor,
  numToWords,
  formatDate
};
