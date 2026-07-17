const db = require('../db/models');
const logger = require('../config/logger');
const PDFDocument = require('pdfkit');
const axios = require('axios');
const sharp = require('sharp');

// ─────────────────────────────────────────────────────────────
// Image helper — fetches & converts any image to JPEG buffer
// ─────────────────────────────────────────────────────────────
const fetchImageBuffer = async (imageUrl) => {
  if (!imageUrl || imageUrl === 'null') return null;
  try {
    let url = imageUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `http://3.7.174.180:3001${url}`;
    }
    url = url
      .replace(/tr:f-webp,w-\d+/g, 'tr:f-jpg,w-400')
      .replace(/tr:f-webp/g, 'tr:f-jpg');

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: { Accept: 'image/jpeg,image/png,image/*' },
    });
    return await sharp(Buffer.from(response.data))
      .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (err) {
    logger.error('Image fetch error: %s — %s', imageUrl, err.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// Light colour palette (no dark heavy colours)
// ─────────────────────────────────────────────────────────────
const C = {
  headerBg:     '#DBEAFE',   // page top banner (light blue)
  headerText:   '#1E3A8A',   // dark blue text for readability
  accentBlue:   '#3B82F6',
  tableBg:      '#EFF6FF',   // soft blue table header
  tableText:    '#1E40AF',
  rowAlt:       '#F8FAFC',   // very light alternate row
  rowNormal:    '#FFFFFF',
  border:       '#E2E8F0',
  text:         '#1E293B',
  subText:      '#64748B',
  green:        '#16A34A',
  greenBg:      '#DCFCE7',
  red:          '#DC2626',
  redBg:        '#FEE2E2',
  summaryBg:    '#F8FAFC',
  sectionBg:    '#EFF6FF',
  sectionText:  '#1E40AF',
};

const PAGE_W  = 595.28;
const PAGE_H  = 841.89;
const M       = 36;
const CW      = PAGE_W - M * 2; // ≈ 523

const fmt   = (n) => `${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtN  = (n) => Number(n || 0).toLocaleString('en-IN');

// ─────────────────────────────────────────────────────────────
// Draw punching guide on the left margin
// ─────────────────────────────────────────────────────────────
const drawPunchGuide = (doc) => {
  doc.save();
  const centerY = PAGE_H / 2;
  const holeDistance = 226.77; // 80mm standard
  const marginX = 14; 
  
  doc.lineWidth(1).strokeColor('#9ca3af');
  doc.circle(marginX, centerY - holeDistance / 2, 6).stroke(); // Top hole
  doc.circle(marginX, centerY + holeDistance / 2, 6).stroke(); // Bottom hole
  
  // Center Arrow
  doc.moveTo(marginX - 6, centerY).lineTo(marginX + 6, centerY).stroke();
  doc.moveTo(marginX + 2, centerY - 4).lineTo(marginX + 6, centerY).lineTo(marginX + 2, centerY + 4).stroke();
  
  // Text
  doc.fillColor('#9ca3af').font('Helvetica').fontSize(5)
     .text('PUNCH', marginX - 10, centerY + 8, { width: 20, align: 'center' });
  doc.restore();
};

// ─────────────────────────────────────────────────────────────
// Draw page header (repeats on every page)
// ─────────────────────────────────────────────────────────────
const drawPageHeader = (doc, reportTitle, dateStr, pageNum) => {
  doc.rect(0, 0, PAGE_W, 54).fill(C.headerBg);

  // Logo drawing next to title (increased size to 44x44, placed at y = 5)
  const path = require('path');
  const logoPath = path.join(__dirname, 'Logo_previous.png');
  try {
    doc.image(logoPath, M, 5, { width: 44, height: 44 });
  } catch (err) {
    logger.warn('Failed to draw logo: %s', err.message);
  }

  doc.fillColor(C.headerText).font('Helvetica-Bold').fontSize(16)
     .text(reportTitle, M + 54, 19);

  doc.fillColor(C.headerText).font('Helvetica').fontSize(8.5)
     .text(dateStr, M, 14, { width: CW, align: 'right' });
  doc.fillColor(C.headerText).font('Helvetica').fontSize(7.5)
     .text(`Page ${pageNum}`, M, 34, { width: CW, align: 'right' });

  doc.rect(0, 54, PAGE_W, 2).fill(C.accentBlue);
};

// ─────────────────────────────────────────────────────────────
// Summary stat cards below the header
// ─────────────────────────────────────────────────────────────
const drawSummaryCards = (doc, y, stats) => {
  const cardW = CW / stats.length;
  stats.forEach((stat, i) => {
    const x = M + i * cardW;
    doc.rect(x, y, cardW - 6, 46).fill(C.summaryBg);
    doc.rect(x, y, 3, 46).fill(C.accentBlue);
    doc.fillColor(C.subText).font('Helvetica').fontSize(7)
       .text(stat.label.toUpperCase(), x + 8, y + 8, { width: cardW - 20 });
    doc.fillColor(stat.color || C.text).font('Helvetica-Bold').fontSize(14)
       .text(stat.value, x + 8, y + 20, { width: cardW - 20 });
  });
  return y + 54;
};

// ─────────────────────────────────────────────────────────────
// Table header row
// ─────────────────────────────────────────────────────────────
const drawTableHeader = (doc, y, cols) => {
  const rowH = 22;
  doc.rect(M, y, CW, rowH).fill(C.tableBg);
  doc.rect(M, y, CW, 2).fill(C.accentBlue);
  let x = M;
  cols.forEach((col) => {
    doc.fillColor(C.tableText).font('Helvetica-Bold').fontSize(7.5)
       .text(col.label, x + 3, y + 6, { width: col.w - 6, align: 'center' });
    x += col.w;
  });
  return y + rowH;
};

// ─────────────────────────────────────────────────────────────
// Draw vertical dividers between table columns
// ─────────────────────────────────────────────────────────────
const drawDividers = (doc, y, rowH, cols) => {
  let x = M;
  cols.slice(0, -1).forEach((col) => {
    x += col.w;
    doc.moveTo(x, y + 3).lineTo(x, y + rowH - 3)
       .strokeColor(C.border).lineWidth(0.3).stroke();
  });
};

// ─────────────────────────────────────────────────────────────
// Draw page footer on all pages (with temporary margin override to prevent page break)
// ─────────────────────────────────────────────────────────────
const drawFooters = (doc) => {
  const { start, count } = doc.bufferedPageRange();
  const oldBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0; // prevent page overflow when writing at bottom
  for (let p = 0; p < count; p++) {
    doc.switchToPage(start + p);
    doc.rect(0, PAGE_H - 26, PAGE_W, 26).fill(C.headerBg);
    doc.fillColor(C.headerText).font('Helvetica-Bold').fontSize(7.5)
       .text(`Elite Edition ERP  •  Generated: ${new Date().toLocaleString('en-IN')}  •  Page ${p + 1} of ${count}`,
         M, PAGE_H - 17, { width: CW, align: 'center' });
  }
  doc.page.margins.bottom = oldBottom;
};

// ─────────────────────────────────────────────────────────────
// Column definitions for different reports
// ─────────────────────────────────────────────────────────────
const COLS_VALUE = [
  { label: 'Photo',         w: 38  },
  { label: 'SKU / Item',    w: 85  },
  { label: 'Vendor',        w: 65  },
  { label: 'Sizes & Qty',   w: 85  },
  { label: 'Total',         w: 30  },
  { label: 'Pur. (Unit)',   w: 48  },
  { label: 'Pur. (Total)',  w: 62  },
  { label: 'Sale (Unit)',   w: 48  },
  { label: 'Sale (Total)',  w: 62  },
];

const COLS_INWARD = [
  { label: 'Photo',         w: 45  },
  { label: 'SKU / Item',    w: 110 },
  { label: 'Vendor',        w: 90  },
  { label: 'Sizes & Qty',   w: 110 },
  { label: 'Total',         w: 40  },
  { label: 'Pur. (Unit)',   w: 58  },
  { label: 'Pur. (Total)',  w: 70  },
];

const COLS_OUTWARD = [
  { label: 'Photo',         w: 38  },
  { label: 'SKU / Item',    w: 80  },
  { label: 'Vendor',        w: 60  },
  { label: 'Sizes & Qty',   w: 80  },
  { label: 'Total',         w: 28  },
  { label: 'Pur. (Unit)',   w: 43  },
  { label: 'Pur. (Total)',  w: 52  },
  { label: 'Sale (Unit)',   w: 43  },
  { label: 'Sale (Total)',  w: 52  },
  { label: 'Profit',        w: 47  },
];

const COLS_RETURNS = [
  { label: '#',         w: 25  },
  { label: 'Date',      w: 65  },
  { label: 'Party',     w: 95  },
  { label: 'Ref ID',    w: 70  },
  { label: 'SKU',       w: 80  },
  { label: 'Qty',       w: 35  },
  { label: 'Condition', w: 83  },
  { label: 'Status',    w: 70  },
];

const COLS_PRODUCTION = [
  { label: '#',         w: 25  },
  { label: 'Date',      w: 60  },
  { label: 'Job No',    w: 70  },
  { label: 'Design No', w: 80  },
  { label: 'Party',     w: 100 },
  { label: 'Machine',   w: 60  },
  { label: 'Total Mtr', w: 55  },
  { label: 'Status',    w: 73  },
];

// ─────────────────────────────────────────────────────────────
// Draw a single inventory item row
// ─────────────────────────────────────────────────────────────
const drawInventoryRow = (doc, y, item, imgBuf, alt, cols, type) => {
  const sizesText = (item.sizes || [])
    .sort((a, b) => a.size.localeCompare(b.size))
    .map(s => `${s.size}: ${s.qty}`)
    .join('\n');
  const linesCount = Math.max(1, (item.sizes || []).length);
  const rowH = Math.max(52, linesCount * 14 + 16);

  doc.rect(M, y, CW, rowH).fill(alt ? C.rowAlt : C.rowNormal);
  doc.moveTo(M, y + rowH).lineTo(M + CW, y + rowH)
     .strokeColor(C.border).lineWidth(0.4).stroke();
  drawDividers(doc, y, rowH, cols);

  const mid = y + rowH / 2;
  let x = M;

  // Photo
  const colPhoto = cols[0];
  const imgSize = Math.min(rowH - 10, colPhoto.w - 6);
  const ix = x + (colPhoto.w - imgSize) / 2;
  const iy = y + (rowH - imgSize) / 2;
  if (imgBuf) {
    try {
      doc.rect(ix - 1, iy - 1, imgSize + 2, imgSize + 2).strokeColor(C.border).lineWidth(0.5).stroke();
      doc.image(imgBuf, ix, iy, { width: imgSize, height: imgSize, cover: [imgSize, imgSize] });
    } catch (_) {
      doc.rect(ix, iy, imgSize, imgSize).fill('#F1F5F9');
    }
  } else {
    doc.rect(ix, iy, imgSize, imgSize).fill('#F1F5F9');
    doc.fillColor(C.subText).font('Helvetica').fontSize(6).text('No Photo', ix, iy + imgSize / 2 - 4, { width: imgSize, align: 'center' });
  }
  x += colPhoto.w;

  // SKU / Item
  const colSku = cols[1];
  doc.fillColor(C.tableText).font('Helvetica-Bold').fontSize(7.5)
     .text(item.sku || '-', x + 4, mid - 10, { width: colSku.w - 8, lineBreak: false, ellipsis: true });
  if (item.itemName && item.itemName !== item.sku) {
    doc.fillColor(C.subText).font('Helvetica').fontSize(6.5)
       .text(item.itemName, x + 4, mid + 2, { width: colSku.w - 8, lineBreak: false, ellipsis: true });
  }
  x += colSku.w;

  // Vendor
  const colVendor = cols[2];
  doc.fillColor(C.subText).font('Helvetica').fontSize(7)
     .text(item.party || '-', x + 4, mid - 5, { width: colVendor.w - 8, align: 'center' });
  x += colVendor.w;

  // Sizes & Qty
  const colSizes = cols[3];
  doc.fillColor(C.text).font('Helvetica').fontSize(7)
     .text(sizesText, x + 4, y + 8, { width: colSizes.w - 8, align: 'center', lineBreak: true });
  x += colSizes.w;

  // Total
  const colTotal = cols[4];
  doc.fillColor(C.text).font('Helvetica-Bold').fontSize(9)
     .text(fmtN(item.total), x + 2, mid - 7, { width: colTotal.w - 4, align: 'center' });
  x += colTotal.w;

  if (type === 'value') {
    // Pur. (Unit)
    doc.fillColor(C.subText).font('Helvetica').fontSize(7.5)
       .text(fmt(item.purchasePrice), x + 2, mid - 5, { width: cols[5].w - 4, align: 'center' });
    x += cols[5].w;

    // Pur. (Total)
    doc.fillColor(C.subText).font('Helvetica').fontSize(7.5)
       .text(fmt(item.totalPurchaseAmount), x + 2, mid - 5, { width: cols[6].w - 4, align: 'center' });
    x += cols[6].w;

    // Sale (Unit)
    doc.fillColor(C.accentBlue).font('Helvetica-Bold').fontSize(7.5)
       .text(fmt(item.salePrice), x + 2, mid - 5, { width: cols[7].w - 4, align: 'center' });
    x += cols[7].w;

    // Sale (Total)
    doc.fillColor(C.accentBlue).font('Helvetica-Bold').fontSize(7.5)
       .text(fmt(item.totalSellableAmount), x + 2, mid - 5, { width: cols[8].w - 4, align: 'center' });
  } 
  else if (type === 'inward') {
    // Pur. (Unit)
    doc.fillColor(C.subText).font('Helvetica').fontSize(7.5)
       .text(fmt(item.purchasePrice), x + 2, mid - 5, { width: cols[5].w - 4, align: 'center' });
    x += cols[5].w;

    // Pur. (Total)
    doc.fillColor(C.subText).font('Helvetica').fontSize(7.5)
       .text(fmt(item.totalPurchaseAmount), x + 2, mid - 5, { width: cols[6].w - 4, align: 'center' });
  } 
  else { // outward
    // Pur. (Unit)
    doc.fillColor(C.subText).font('Helvetica').fontSize(7.5)
       .text(fmt(item.purchasePrice), x + 2, mid - 5, { width: cols[5].w - 4, align: 'center' });
    x += cols[5].w;

    // Pur. (Total)
    doc.fillColor(C.subText).font('Helvetica').fontSize(7.5)
       .text(fmt(item.totalPurchaseAmount), x + 2, mid - 5, { width: cols[6].w - 4, align: 'center' });
    x += cols[6].w;

    // Sale (Unit)
    doc.fillColor(C.accentBlue).font('Helvetica-Bold').fontSize(7.5)
       .text(fmt(item.salePrice), x + 2, mid - 5, { width: cols[7].w - 4, align: 'center' });
    x += cols[7].w;

    // Sale (Total)
    doc.fillColor(C.accentBlue).font('Helvetica-Bold').fontSize(7.5)
       .text(fmt(item.totalSellableAmount), x + 2, mid - 5, { width: cols[8].w - 4, align: 'center' });
    x += cols[8].w;

    // Profit
    const profit = item.totalSellableAmount - item.totalPurchaseAmount;
    doc.fillColor(profit >= 0 ? C.green : C.red).font('Helvetica-Bold').fontSize(7.5)
       .text(fmt(profit), x + 2, mid - 5, { width: cols[9].w - 4, align: 'center' });
  }

  return rowH;
};

// ─────────────────────────────────────────────────────────────
// Draw a single Return item row
// ─────────────────────────────────────────────────────────────
const drawReturnRow = (doc, y, item, index, alt, cols) => {
  const rowH = 26; // Fixed row height for returns

  doc.rect(M, y, CW, rowH).fill(alt ? C.rowAlt : C.rowNormal);
  doc.moveTo(M, y + rowH).lineTo(M + CW, y + rowH)
     .strokeColor(C.border).lineWidth(0.4).stroke();
  drawDividers(doc, y, rowH, cols);

  const mid = y + rowH / 2;
  let x = M;

  // #
  doc.fillColor(C.text).font('Helvetica').fontSize(8)
     .text(index.toString(), x + 2, mid - 5, { width: cols[0].w - 4, align: 'center' });
  x += cols[0].w;

  // Date
  const dt = new Date(item.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  doc.fillColor(C.text).font('Helvetica').fontSize(8)
     .text(dt, x + 2, mid - 5, { width: cols[1].w - 4, align: 'center' });
  x += cols[1].w;

  // Party
  doc.fillColor(C.text).font('Helvetica-Bold').fontSize(8)
     .text(item.party, x + 4, mid - 5, { width: cols[2].w - 8, align: 'left' });
  x += cols[2].w;

  // Ref ID
  doc.fillColor(C.subText).font('Helvetica').fontSize(8)
     .text(item.referenceId, x + 4, mid - 5, { width: cols[3].w - 8, align: 'left', lineBreak: false });
  x += cols[3].w;

  // SKU
  doc.fillColor(C.text).font('Helvetica-Bold').fontSize(8)
     .text(item.sku, x + 4, mid - 5, { width: cols[4].w - 8, align: 'left', lineBreak: false });
  x += cols[4].w;

  // Qty
  doc.fillColor(C.accentBlue).font('Helvetica-Bold').fontSize(8)
     .text(fmtN(item.quantity), x + 2, mid - 5, { width: cols[5].w - 4, align: 'center' });
  x += cols[5].w;

  // Condition
  const condColor = item.condition === 'WRONG_ITEM' || item.condition === 'DAMAGED' ? C.red : (item.condition === 'INTACT' ? C.green : C.subText);
  doc.fillColor(condColor).font('Helvetica-Bold').fontSize(7.5)
     .text(item.condition.replace('_', ' '), x + 2, mid - 5, { width: cols[6].w - 4, align: 'center' });
  x += cols[6].w;

  // Status
  const statColor = item.status === 'STOCKED_IN' ? C.green : (item.status === 'DISPUTED' ? C.red : C.accentBlue);
  doc.fillColor(statColor).font('Helvetica-Bold').fontSize(7.5)
     .text(item.status.replace('_', ' '), x + 2, mid - 5, { width: cols[7].w - 4, align: 'center' });

  return rowH;
};

// ─────────────────────────────────────────────────────────────
// Render the paginated Returns report items
// ─────────────────────────────────────────────────────────────
const renderReturns = (doc, items, reportTitle, dateStr, startPageNum, cols) => {
  let y = doc.y + 15;
  let alt = false;
  let pageNum = startPageNum;

  // Table header
  y = drawTableHeader(doc, y, cols);

  items.forEach((item, index) => {
    const rowH = 26;
    if (y + rowH > PAGE_H - 45) {
      doc.addPage();
      pageNum++;
      drawPageHeader(doc, reportTitle, dateStr, pageNum);
      y = 65;
      y = drawTableHeader(doc, y, cols);
    }
    y += drawReturnRow(doc, y, item, index + 1, alt, cols);
    alt = !alt;
  });

  return y;
};

// ─────────────────────────────────────────────────────────────
// Draw a single Production item row
// ─────────────────────────────────────────────────────────────
const drawProductionRow = (doc, y, item, index, alt, cols) => {
  const rowH = 26;

  doc.rect(M, y, CW, rowH).fill(alt ? C.rowAlt : C.rowNormal);
  doc.moveTo(M, y + rowH).lineTo(M + CW, y + rowH)
     .strokeColor(C.border).lineWidth(0.4).stroke();
  drawDividers(doc, y, rowH, cols);

  const mid = y + rowH / 2;
  let x = M;

  // #
  doc.fillColor(C.text).font('Helvetica').fontSize(8)
     .text(index.toString(), x + 2, mid - 5, { width: cols[0].w - 4, align: 'center' });
  x += cols[0].w;

  // Date
  const dt = item.date || new Date(item.created_date_time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  doc.fillColor(C.text).font('Helvetica').fontSize(8)
     .text(dt, x + 2, mid - 5, { width: cols[1].w - 4, align: 'center' });
  x += cols[1].w;

  // Job No
  doc.fillColor(C.text).font('Helvetica-Bold').fontSize(8)
     .text(item.jobNo, x + 4, mid - 5, { width: cols[2].w - 8, align: 'left', lineBreak: false });
  x += cols[2].w;

  // Design No
  doc.fillColor(C.subText).font('Helvetica').fontSize(8)
     .text(item.designNo || '-', x + 4, mid - 5, { width: cols[3].w - 8, align: 'left', lineBreak: false });
  x += cols[3].w;

  // Party
  doc.fillColor(C.text).font('Helvetica-Bold').fontSize(8)
     .text(item.party, x + 4, mid - 5, { width: cols[4].w - 8, align: 'left', lineBreak: false });
  x += cols[4].w;

  // Machine
  const machineColor = item.machineName === 'GRANDO' ? '#0b5394' : item.machineName === 'PRINTDOT' ? '#cc0000' : C.text;
  doc.fillColor(machineColor).font('Helvetica-Bold').fontSize(8)
     .text(item.machineName || 'N/A', x + 2, mid - 5, { width: cols[5].w - 4, align: 'center' });
  x += cols[5].w;

  // Total Mtr
  doc.fillColor(C.accentBlue).font('Helvetica-Bold').fontSize(8)
     .text(fmt(item.totalMtr), x + 2, mid - 5, { width: cols[6].w - 4, align: 'center' });
  x += cols[6].w;

  // Status
  const isDone = item.status === 'Done';
  doc.fillColor(isDone ? C.green : C.subText).font('Helvetica-Bold').fontSize(7.5)
     .text(item.status || 'Pending', x + 2, mid - 5, { width: cols[7].w - 4, align: 'center' });

  return rowH;
};

// ─────────────────────────────────────────────────────────────
// Render the paginated Production report items
// ─────────────────────────────────────────────────────────────
const renderProduction = (doc, items, reportTitle, dateStr, startPageNum, cols) => {
  let y = doc.y + 15;
  let alt = false;
  let pageNum = startPageNum;

  y = drawTableHeader(doc, y, cols);

  items.forEach((item, index) => {
    const rowH = 26;
    if (y + rowH > PAGE_H - 45) {
      doc.addPage();
      pageNum++;
      drawPageHeader(doc, reportTitle, dateStr, pageNum);
      y = 65;
      y = drawTableHeader(doc, y, cols);
    }
    y += drawProductionRow(doc, y, item, index + 1, alt, cols);
    alt = !alt;
  });

  return y;
};

// ─────────────────────────────────────────────────────────────
// Shared: build grouped items from raw db query
// ─────────────────────────────────────────────────────────────
const groupInventoryItems = (rawItems, qtyField = 'currentlyAvailableStock') => {
  const grouped = {};
  let totalQty = 0;
  let totalSell = 0;

  rawItems.forEach(item => {
    const baseSku = item.skuCode ? item.skuCode.split('_')[0] : item.itemName;
    if (!grouped[baseSku]) {
      grouped[baseSku] = {
        imageUrl: item.imageUrl || '',
        sku: baseSku,
        itemName: item.itemName || baseSku,
        party: item.party || '-',
        sizes: [],
        total: 0,
        totalPurchaseAmount: 0,
        totalSellableAmount: 0,
        purchasePrice: item.purchasePrice || 0,
        salePrice: item.salePrice || 0,
      };
    }
    if (!grouped[baseSku].imageUrl && item.imageUrl) grouped[baseSku].imageUrl = item.imageUrl;
    if (!grouped[baseSku].purchasePrice && item.purchasePrice) grouped[baseSku].purchasePrice = item.purchasePrice;
    if (!grouped[baseSku].salePrice && item.salePrice) grouped[baseSku].salePrice = item.salePrice;

    const qty = item[qtyField] || 0;
    const sizeObj = grouped[baseSku].sizes.find(s => s.size === item.size);
    if (sizeObj) {
      sizeObj.qty += qty;
    } else {
      grouped[baseSku].sizes.push({ size: item.size || 'N/A', qty });
    }
    grouped[baseSku].total += qty;
    grouped[baseSku].totalPurchaseAmount += qty * (item.purchasePrice || 0);
    grouped[baseSku].totalSellableAmount += qty * (item.salePrice || 0);
    totalQty  += qty;
    totalSell += qty * (item.salePrice || 0);
  });

  return {
    totalQty,
    totalSell,
    items: Object.values(grouped).filter(g => g.total > 0).sort((a, b) => a.sku.localeCompare(b.sku)),
  };
};

// ─────────────────────────────────────────────────────────────
// Shared: enrich missing images from InventoryProduct
// ─────────────────────────────────────────────────────────────
const enrichImages = async (items) => {
  const needImage = items.filter(i => !i.imageUrl).map(i => i.sku);
  if (needImage.length === 0) return;

  const productDocs = await db.InventoryProduct.find({ imageUrl: { $exists: true, $nin: [null, ''] } }).lean();
  const imageMap = {};
  productDocs.forEach(p => {
    const base = p.skuCode ? p.skuCode.split('_')[0] : null;
    if (base && needImage.includes(base) && p.imageUrl && !imageMap[base]) {
      imageMap[base] = p.imageUrl;
    }
  });
  items.forEach(item => {
    if (!item.imageUrl && imageMap[item.sku]) item.imageUrl = imageMap[item.sku];
  });
};

// ─────────────────────────────────────────────────────────────
// Shared: pre-fetch all images (10 at a time)
// ─────────────────────────────────────────────────────────────
const buildImageCache = async (items) => {
  const uniqueUrls = [...new Set(items.map(i => i.imageUrl).filter(Boolean))];
  logger.info('Pre-fetching %d images…', uniqueUrls.length);
  const cache = {};
  const CHUNK = 10;
  for (let i = 0; i < uniqueUrls.length; i += CHUNK) {
    await Promise.all(uniqueUrls.slice(i, i + CHUNK).map(async url => {
      cache[url] = await fetchImageBuffer(url);
    }));
  }
  return cache;
};

// ─────────────────────────────────────────────────────────────
// Render list of items into PDF, returns final pageNum
// ─────────────────────────────────────────────────────────────
const renderItems = (doc, items, imageCache, reportTitle, dateStr, startPageNum, cols, type) => {
  let pageNum = startPageNum;
  let y = doc.y;
  let alt = false;

  if (items.length === 0) {
    doc.fillColor(C.subText).font('Helvetica-Oblique').fontSize(11)
       .text('No data available for this period.', M, y + 14);
    doc.y = y + 40;
    return pageNum;
  }

  y = drawTableHeader(doc, y, cols);

  for (const item of items) {
    const linesCount = Math.max(1, (item.sizes || []).length);
    const rowH = Math.max(52, linesCount * 14 + 16);

    if (y + rowH > PAGE_H - M - 28) {
      doc.addPage();
      pageNum++;
      drawPageHeader(doc, reportTitle, dateStr, pageNum);
      y = 65;
      doc.fillColor(C.subText).font('Helvetica-Oblique').fontSize(8)
         .text('(continued)', M, y);
      y += 14;
      y = drawTableHeader(doc, y, cols);
      alt = false;
    }

    const cacheBuf = item.imageUrl ? imageCache[item.imageUrl] : null;
    y += drawInventoryRow(doc, y, item, cacheBuf, alt, cols, type);
    alt = !alt;
  }

  doc.y = y;
  return pageNum;
};

// ─────────────────────────────────────────────────────────────
// JSON endpoint (legacy, kept for backward compat)
// ─────────────────────────────────────────────────────────────
const getInventoryReport = async (req, res) => {
  try {
    const { dateStart, dateEnd } = req.query;
    if (!dateStart || !dateEnd) return res.status(400).json({ error: 'dateStart and dateEnd are required' });

    const start = new Date(dateStart);
    const end   = new Date(dateEnd);
    end.setHours(23, 59, 59, 999);

    const currentStockRaw = await db.Inventory.find({ party: { $ne: 'Uniware Channel Sync' } }).lean();
    const stockInRaw  = await db.Inventory.find({ created_date_time: { $gte: start, $lte: end }, party: { $ne: 'Uniware Channel Sync' } }).lean();
    const stockOutLogs = await db.StockOut.find({ created_date_time: { $gte: start, $lte: end } }).lean();

    const stockOutRaw = [];
    for (const log of stockOutLogs) {
      const inv = await db.Inventory.findOne({ skuCode: log.skuCode }).lean();
      stockOutRaw.push({ ...log, itemName: inv?.itemName || 'Unknown', size: inv?.size || 'N/A', imageUrl: inv?.imageUrl || '', salePrice: inv?.salePrice || 0, purchasePrice: inv?.purchasePrice || 0, qty: log.qtyOut });
    }

    res.json({ currentStock: groupInventoryItems(currentStockRaw), stockIn: groupInventoryItems(stockInRaw, 'qty'), stockOut: groupInventoryItems(stockOutRaw, 'qty') });
  } catch (error) {
    logger.error('Inventory JSON error: %o', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─────────────────────────────────────────────────────────────
// 1. STOCK VALUE REPORT PDF — current stock snapshot
// ─────────────────────────────────────────────────────────────
const downloadStockValuePdf = async (req, res) => {
  try {
    const { dateStart = '', dateEnd = '' } = req.query;
    const dateStr = dateStart && dateEnd ? `${dateStart}  →  ${dateEnd}` : `As of ${new Date().toLocaleDateString('en-IN')}`;
    logger.info('Generating Stock Value PDF');

    const raw = await db.Inventory.find({ party: { $ne: 'Uniware Channel Sync' } }).lean();
    const { totalQty, totalSell, items } = groupInventoryItems(raw, 'currentlyAvailableStock');

    await enrichImages(items);
    const imageCache = await buildImageCache(items);

    const doc = new PDFDocument({ margin: M, size: 'A4', bufferPages: true,
      info: { Title: 'Elite Edition Stock Value Report', Author: 'Elite Edition ERP' }
    });
    doc.on('pageAdded', () => drawPunchGuide(doc));
    drawPunchGuide(doc);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Stock_Value_Report_${dateStart || 'today'}.pdf"`);
    doc.pipe(res);

    drawPageHeader(doc, 'Stock Value Report', dateStr, 1);
    let y = 65;
    y = drawSummaryCards(doc, y, [
      { label: 'Total SKUs',      value: fmtN(items.length) },
      { label: 'Total Stock',     value: fmtN(totalQty) },
      { label: 'Inventory Value', value: fmt(totalSell) },
    ]);
    doc.y = y;

    renderItems(doc, items, imageCache, 'Stock Value Report', dateStr, 1, COLS_VALUE, 'value');
    drawFooters(doc);
    doc.end();
    logger.info('Stock Value PDF complete.');
  } catch (err) {
    logger.error('Stock Value PDF error: %o', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 2. STOCK INWARD REPORT PDF — items received in date range
// ─────────────────────────────────────────────────────────────
const downloadStockInwardPdf = async (req, res) => {
  try {
    const { dateStart, dateEnd } = req.query;
    if (!dateStart || !dateEnd) return res.status(400).json({ error: 'dateStart and dateEnd are required' });

    const start = new Date(dateStart);
    const end   = new Date(dateEnd);
    end.setHours(23, 59, 59, 999);
    const dateStr = `${dateStart}  →  ${dateEnd}`;
    logger.info('Generating Stock Inward PDF %s → %s', dateStart, dateEnd);

    const raw = await db.Inventory.find({ created_date_time: { $gte: start, $lte: end }, party: { $ne: 'Uniware Channel Sync' } }).lean();
    const { totalQty, items } = groupInventoryItems(raw, 'qty');
    const totalPurchase = items.reduce((s, i) => s + i.totalPurchaseAmount, 0);

    await enrichImages(items);
    const imageCache = await buildImageCache(items);

    const doc = new PDFDocument({ margin: M, size: 'A4', bufferPages: true,
      info: { Title: 'Elite Edition Stock Inward Report', Author: 'Elite Edition ERP' }
    });
    doc.on('pageAdded', () => drawPunchGuide(doc));
    drawPunchGuide(doc);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Stock_Inward_Report_${dateStart}.pdf"`);
    doc.pipe(res);

    drawPageHeader(doc, 'Stock Inward Report', dateStr, 1);
    let y = 65;
    y = drawSummaryCards(doc, y, [
      { label: 'SKUs Received',   value: fmtN(items.length) },
      { label: 'Total Units In',  value: fmtN(totalQty) },
      { label: 'Purchase Total',  value: fmt(totalPurchase) },
    ]);
    doc.y = y;

    renderItems(doc, items, imageCache, 'Stock Inward Report', dateStr, 1, COLS_INWARD, 'inward');
    drawFooters(doc);
    doc.end();
    logger.info('Stock Inward PDF complete.');
  } catch (err) {
    logger.error('Stock Inward PDF error: %o', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 3. STOCK OUTWARD REPORT PDF — items dispatched in date range
// ─────────────────────────────────────────────────────────────
const downloadStockOutwardPdf = async (req, res) => {
  try {
    const { dateStart, dateEnd } = req.query;
    if (!dateStart || !dateEnd) return res.status(400).json({ error: 'dateStart and dateEnd are required' });

    const start = new Date(dateStart);
    const end   = new Date(dateEnd);
    end.setHours(23, 59, 59, 999);
    const dateStr = `${dateStart}  →  ${dateEnd}`;
    logger.info('Generating Stock Outward PDF %s → %s', dateStart, dateEnd);

    const stockOutLogs = await db.StockOut.find({ created_date_time: { $gte: start, $lte: end } }).lean();

    // Join with Inventory for details
    const raw = [];
    for (const log of stockOutLogs) {
      const inv = await db.Inventory.findOne({ skuCode: log.skuCode }).lean();
      raw.push({
        ...log,
        itemName:     inv?.itemName     || log.skuCode || 'Unknown',
        size:         inv?.size         || log.size    || 'N/A',
        imageUrl:     inv?.imageUrl     || '',
        salePrice:    inv?.salePrice    || 0,
        purchasePrice:inv?.purchasePrice|| 0,
        qty:          log.qtyOut        || 0,
      });
    }

    const { totalQty, totalSell, items } = groupInventoryItems(raw, 'qty');
    const totalPurchase = items.reduce((s, i) => s + i.totalPurchaseAmount, 0);
    const totalProfit   = totalSell - totalPurchase;

    await enrichImages(items);
    const imageCache = await buildImageCache(items);

    const doc = new PDFDocument({ margin: M, size: 'A4', bufferPages: true,
      info: { Title: 'Elite Edition Stock Outward Report', Author: 'Elite Edition ERP' }
    });
    doc.on('pageAdded', () => drawPunchGuide(doc));
    drawPunchGuide(doc);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Stock_Outward_Report_${dateStart}.pdf"`);
    doc.pipe(res);

    drawPageHeader(doc, 'Stock Outward Report', dateStr, 1);
    let y = 65;
    y = drawSummaryCards(doc, y, [
      { label: 'SKUs Dispatched', value: fmtN(items.length) },
      { label: 'Total Units Out', value: fmtN(totalQty) },
      { label: 'Sell Revenue',    value: fmt(totalSell), color: C.accentBlue },
      { label: 'Est. Profit',     value: fmt(totalProfit), color: totalProfit >= 0 ? C.green : C.red },
    ]);
    doc.y = y;

    renderItems(doc, items, imageCache, 'Stock Outward Report', dateStr, 1, COLS_OUTWARD, 'outward');
    drawFooters(doc);
    doc.end();
    logger.info('Stock Outward PDF complete.');
  } catch (err) {
    logger.error('Stock Outward PDF error: %o', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 4. RETURNS REPORT PDF — returns logged in date range
// ─────────────────────────────────────────────────────────────
const downloadReturnsReportPdf = async (req, res) => {
  try {
    const { dateStart = '', dateEnd = '' } = req.query;
    const dateStr = dateStart && dateEnd ? `${dateStart}  →  ${dateEnd}` : `All Time Returns`;
    logger.info('Generating Returns Report PDF %s → %s', dateStart, dateEnd);

    let query = {};
    if (dateStart && dateEnd) {
      const start = new Date(dateStart);
      const end   = new Date(dateEnd);
      end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const items = await db.ReturnRecord.find(query).sort({ createdAt: -1 }).lean();
    
    let totalQty = 0;
    let rtoQty = 0;
    let customerReturnQty = 0;
    
    items.forEach(item => {
      totalQty += item.quantity;
      if (item.returnType === 'RTO') rtoQty += item.quantity;
      if (item.returnType === 'CUSTOMER_RETURN') customerReturnQty += item.quantity;
    });

    const doc = new PDFDocument({ margin: M, size: 'A4', bufferPages: true,
      info: { Title: 'Elite Edition Returns Report', Author: 'Elite Edition ERP' }
    });
    doc.on('pageAdded', () => drawPunchGuide(doc));
    drawPunchGuide(doc);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Returns_Report_${dateStart || 'AllTime'}.pdf"`);
    doc.pipe(res);

    drawPageHeader(doc, 'Returns Log Report', dateStr, 1);
    let y = 65;
    y = drawSummaryCards(doc, y, [
      { label: 'Total Returns',     value: fmtN(items.length) },
      { label: 'RTO Items',         value: fmtN(rtoQty) },
      { label: 'Customer Returns',  value: fmtN(customerReturnQty) },
    ]);
    doc.y = y;

    if (items.length === 0) {
      doc.y += 30;
      doc.fillColor(C.subText).font('Helvetica-Bold').fontSize(12).text('No returns logged for this period.', { align: 'center' });
    } else {
      renderReturns(doc, items, 'Returns Log Report', dateStr, 1, COLS_RETURNS);
    }
    
    drawFooters(doc);
    doc.end();
    logger.info('Returns PDF complete.');
  } catch (err) {
    logger.error('Returns PDF error: %o', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 5. MACHINE PRODUCTION REPORT PDF — job card logging
// ─────────────────────────────────────────────────────────────
const downloadMachineProductionReportPdf = async (req, res) => {
  try {
    const { dateStart = '', dateEnd = '' } = req.query;
    const dateStr = dateStart && dateEnd ? `${dateStart}  →  ${dateEnd}` : `All Time Production`;
    logger.info('Generating Production Report PDF %s → %s', dateStart, dateEnd);

    let query = {};
    if (dateStart && dateEnd) {
      query.date = { $gte: dateStart, $lte: dateEnd };
    }

    const items = await db.JobCard.find(query).sort({ created_date_time: -1 }).lean();
    
    let totalMtrs = 0;
    let grandoMtrs = 0;
    let printdotMtrs = 0;
    let completedCards = 0;
    
    items.forEach(item => {
      const mtr = Number(item.totalMtr) || 0;
      totalMtrs += mtr;
      if (item.machineName === 'GRANDO') grandoMtrs += mtr;
      if (item.machineName === 'PRINTDOT') printdotMtrs += mtr;
      if (item.status === 'Done') completedCards += 1;
    });

    const doc = new PDFDocument({ margin: M, size: 'A4', bufferPages: true,
      info: { Title: 'Elite Edition Machine Production Report', Author: 'Elite Edition ERP' }
    });
    doc.on('pageAdded', () => drawPunchGuide(doc));
    drawPunchGuide(doc);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Machine_Production_Report_${dateStart || 'AllTime'}.pdf"`);
    doc.pipe(res);

    drawPageHeader(doc, 'Machine Production Report', dateStr, 1);
    let y = 65;
    y = drawSummaryCards(doc, y, [
      { label: 'Total Cards / Done', value: `${items.length} / ${completedCards}` },
      { label: 'GRANDO Mtr',         value: fmt(grandoMtrs), color: '#0b5394' },
      { label: 'PRINTDOT Mtr',       value: fmt(printdotMtrs), color: '#cc0000' },
      { label: 'Total Mtr',          value: fmt(totalMtrs), color: C.green },
    ]);
    doc.y = y;

    if (items.length === 0) {
      doc.y += 30;
      doc.fillColor(C.subText).font('Helvetica-Bold').fontSize(12).text('No production logged for this period.', { align: 'center' });
    } else {
      renderProduction(doc, items, 'Machine Production Report', dateStr, 1, COLS_PRODUCTION);
    }
    
    drawFooters(doc);
    doc.end();
    logger.info('Production PDF complete.');
  } catch (err) {
    logger.error('Production PDF error: %o', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};

const getStockValueData = async (req, res) => {
  try {
    const raw = await db.Inventory.find({ party: { $ne: 'Uniware Channel Sync' } }).lean();
    const { totalQty, totalSell, items } = groupInventoryItems(raw, 'currentlyAvailableStock');
    await enrichImages(items);
    res.json({ totalQty, totalSell, items });
  } catch (err) {
    logger.error('getStockValueData error: %o', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};

const getStockInwardData = async (req, res) => {
  try {
    const { dateStart, dateEnd } = req.query;
    if (!dateStart || !dateEnd) return res.status(400).json({ error: 'dateStart and dateEnd are required' });

    const start = new Date(dateStart);
    const end   = new Date(dateEnd);
    end.setHours(23, 59, 59, 999);

    const raw = await db.Inventory.find({ created_date_time: { $gte: start, $lte: end }, party: { $ne: 'Uniware Channel Sync' } }).lean();
    const { totalQty, items } = groupInventoryItems(raw, 'qty');
    const totalPurchase = items.reduce((s, i) => s + i.totalPurchaseAmount, 0);
    await enrichImages(items);
    res.json({ totalQty, totalPurchase, items });
  } catch (err) {
    logger.error('getStockInwardData error: %o', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};

const getStockOutwardData = async (req, res) => {
  try {
    const { dateStart, dateEnd } = req.query;
    if (!dateStart || !dateEnd) return res.status(400).json({ error: 'dateStart and dateEnd are required' });

    const start = new Date(dateStart);
    const end   = new Date(dateEnd);
    end.setHours(23, 59, 59, 999);

    const stockOutLogs = await db.StockOut.find({ created_date_time: { $gte: start, $lte: end } }).lean();
    const raw = [];
    for (const log of stockOutLogs) {
      const inv = await db.Inventory.findOne({ skuCode: log.skuCode }).lean();
      raw.push({
        ...log,
        itemName:     inv?.itemName     || log.skuCode || 'Unknown',
        size:         inv?.size         || log.size    || 'N/A',
        imageUrl:     inv?.imageUrl     || '',
        salePrice:    inv?.salePrice    || 0,
        purchasePrice:inv?.purchasePrice|| 0,
        qty:          log.qtyOut        || 0,
      });
    }

    const { totalQty, totalSell, items } = groupInventoryItems(raw, 'qty');
    const totalPurchase = items.reduce((s, i) => s + i.totalPurchaseAmount, 0);
    const totalProfit   = totalSell - totalPurchase;
    await enrichImages(items);

    res.json({ totalQty, totalSell, totalPurchase, totalProfit, items });
  } catch (err) {
    logger.error('getStockOutwardData error: %o', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};

module.exports = {
  getInventoryReport,
  downloadStockValuePdf,
  downloadStockInwardPdf,
  downloadStockOutwardPdf,
  downloadReturnsReportPdf,
  downloadMachineProductionReportPdf,
  getStockValueData,
  getStockInwardData,
  getStockOutwardData,
};
