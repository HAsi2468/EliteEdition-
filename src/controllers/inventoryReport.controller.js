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
  headerBg:     '#1E3A5F',   // page top banner (deep navy)
  headerText:   '#FFFFFF',
  accentBlue:   '#3B82F6',
  tableBg:      '#DBEAFE',   // light blue table header
  tableText:    '#1E3799',
  rowAlt:       '#F0F7FF',
  rowNormal:    '#FFFFFF',
  border:       '#BFDBFE',
  text:         '#1E293B',
  subText:      '#64748B',
  green:        '#16A34A',
  greenBg:      '#DCFCE7',
  red:          '#DC2626',
  redBg:        '#FEE2E2',
  summaryBg:    '#EFF6FF',
  sectionBg:    '#DBEAFE',
  sectionText:  '#1E40AF',
};

const PAGE_W  = 595.28;
const PAGE_H  = 841.89;
const M       = 36;
const CW      = PAGE_W - M * 2; // ≈ 523

const fmt   = (n) => `${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtN  = (n) => Number(n || 0).toLocaleString('en-IN');

// ─────────────────────────────────────────────────────────────
// Draw page header (repeats on every page)
// ─────────────────────────────────────────────────────────────
const drawPageHeader = (doc, reportTitle, dateStr, pageNum) => {
  doc.rect(0, 0, PAGE_W, 54).fill(C.headerBg);
  doc.fillColor(C.headerText).font('Helvetica-Bold').fontSize(16)
     .text('ELITE EDITION', M, 12, { characterSpacing: 0.8 });
  doc.fillColor('#93C5FD').font('Helvetica').fontSize(9)
     .text(reportTitle, M, 32);
  doc.fillColor(C.headerText).font('Helvetica').fontSize(8.5)
     .text(dateStr, M, 14, { width: CW, align: 'right' });
  doc.fillColor('#93C5FD').font('Helvetica').fontSize(7.5)
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
// Draw page footer on all pages
// ─────────────────────────────────────────────────────────────
const drawFooters = (doc, totalPages) => {
  const { start, count } = doc.bufferedPageRange();
  for (let p = 0; p < count; p++) {
    doc.switchToPage(start + p);
    doc.rect(0, PAGE_H - 26, PAGE_W, 26).fill(C.headerBg);
    doc.fillColor('#93C5FD').font('Helvetica').fontSize(7.5)
       .text(`Elite Edition ERP  •  Generated: ${new Date().toLocaleString('en-IN')}  •  Page ${p + 1} of ${count}`,
         M, PAGE_H - 17, { width: CW, align: 'center' });
  }
};

// ─────────────────────────────────────────────────────────────
// Shared columns for all 3 inventory reports
// ─────────────────────────────────────────────────────────────
const INV_COLS = [
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

// ─────────────────────────────────────────────────────────────
// Draw a single inventory item row
// ─────────────────────────────────────────────────────────────
const drawInventoryRow = (doc, y, item, imgBuf, alt) => {
  const sizesText = (item.sizes || [])
    .sort((a, b) => a.size.localeCompare(b.size))
    .map(s => `${s.size}: ${s.qty}`)
    .join('\n');
  const linesCount = Math.max(1, (item.sizes || []).length);
  const rowH = Math.max(52, linesCount * 14 + 16);

  doc.rect(M, y, CW, rowH).fill(alt ? C.rowAlt : C.rowNormal);
  doc.moveTo(M, y + rowH).lineTo(M + CW, y + rowH)
     .strokeColor(C.border).lineWidth(0.4).stroke();
  drawDividers(doc, y, rowH, INV_COLS);

  const mid = y + rowH / 2;
  let x = M;

  // Image (width 38)
  const imgSize = Math.min(rowH - 10, 32);
  const ix = x + (INV_COLS[0].w - imgSize) / 2;
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
  x += INV_COLS[0].w;

  // SKU / Name (width 80)
  doc.fillColor(C.tableText).font('Helvetica-Bold').fontSize(7.5)
     .text(item.sku || '-', x + 4, mid - 10, { width: INV_COLS[1].w - 8, lineBreak: false, ellipsis: true });
  if (item.itemName && item.itemName !== item.sku) {
    doc.fillColor(C.subText).font('Helvetica').fontSize(6.5)
       .text(item.itemName, x + 4, mid + 2, { width: INV_COLS[1].w - 8, lineBreak: false, ellipsis: true });
  }
  x += INV_COLS[1].w;

  // Vendor (width 60)
  doc.fillColor(C.subText).font('Helvetica').fontSize(7)
     .text(item.party || '-', x + 4, mid - 5, { width: INV_COLS[2].w - 8, align: 'center' });
  x += INV_COLS[2].w;

  // Sizes (width 80)
  doc.fillColor(C.text).font('Helvetica').fontSize(7)
     .text(sizesText, x + 4, y + 8, { width: INV_COLS[3].w - 8, align: 'center', lineBreak: true });
  x += INV_COLS[3].w;

  // Total (width 28)
  doc.fillColor(C.text).font('Helvetica-Bold').fontSize(9)
     .text(fmtN(item.total), x + 2, mid - 7, { width: INV_COLS[4].w - 4, align: 'center' });
  x += INV_COLS[4].w;

  // Purchase Unit (width 43)
  doc.fillColor(C.subText).font('Helvetica').fontSize(7.5)
     .text(fmt(item.purchasePrice), x + 2, mid - 5, { width: INV_COLS[5].w - 4, align: 'center' });
  x += INV_COLS[5].w;

  // Purchase Total (width 52)
  doc.fillColor(C.subText).font('Helvetica').fontSize(7.5)
     .text(fmt(item.totalPurchaseAmount), x + 2, mid - 5, { width: INV_COLS[6].w - 4, align: 'center' });
  x += INV_COLS[6].w;

  // Sell Unit (width 43)
  doc.fillColor(C.accentBlue).font('Helvetica-Bold').fontSize(7.5)
     .text(fmt(item.salePrice), x + 2, mid - 5, { width: INV_COLS[7].w - 4, align: 'center' });
  x += INV_COLS[7].w;

  // Sell Total (width 52)
  doc.fillColor(C.accentBlue).font('Helvetica-Bold').fontSize(7.5)
     .text(fmt(item.totalSellableAmount), x + 2, mid - 5, { width: INV_COLS[8].w - 4, align: 'center' });
  x += INV_COLS[8].w;

  // Profit (width 47)
  const profit = item.totalSellableAmount - item.totalPurchaseAmount;
  doc.fillColor(profit >= 0 ? C.green : C.red).font('Helvetica-Bold').fontSize(7.5)
     .text(fmt(profit), x + 2, mid - 5, { width: INV_COLS[9].w - 4, align: 'center' });

  return rowH;
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
const renderItems = (doc, items, imageCache, reportTitle, dateStr, startPageNum) => {
  let pageNum = startPageNum;
  let y = doc.y;
  let alt = false;

  if (items.length === 0) {
    doc.fillColor(C.subText).font('Helvetica-Oblique').fontSize(11)
       .text('No data available for this period.', M, y + 14);
    doc.y = y + 40;
    return pageNum;
  }

  y = drawTableHeader(doc, y, INV_COLS);

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
      y = drawTableHeader(doc, y, INV_COLS);
      alt = false;
    }

    const imgBuf = item.imageUrl ? imageCache[item.imageUrl] : null;
    y += drawInventoryRow(doc, y, item, imgBuf, alt);
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

    const currentStockRaw = await db.Inventory.find().lean();
    const stockInRaw  = await db.Inventory.find({ created_date_time: { $gte: start, $lte: end } }).lean();
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

    const raw = await db.Inventory.find().lean();
    const { totalQty, totalSell, items } = groupInventoryItems(raw, 'currentlyAvailableStock');
    const totalPurchase = items.reduce((s, i) => s + i.totalPurchaseAmount, 0);
    const totalProfit   = totalSell - totalPurchase;

    await enrichImages(items);
    const imageCache = await buildImageCache(items);

    const doc = new PDFDocument({ margin: M, size: 'A4', bufferPages: true,
      info: { Title: 'Elite Edition Stock Value Report', Author: 'Elite Edition ERP' }
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Stock_Value_Report_${dateStart || 'today'}.pdf"`);
    doc.pipe(res);

    drawPageHeader(doc, 'Stock Value Report', dateStr, 1);
    let y = 65;
    y = drawSummaryCards(doc, y, [
      { label: 'Total SKUs',      value: fmtN(items.length) },
      { label: 'Total Stock',     value: fmtN(totalQty) },
      { label: 'Inventory Value', value: fmt(totalSell) },
      { label: 'Est. Profit',     value: fmt(totalProfit), color: totalProfit >= 0 ? C.green : C.red },
    ]);
    doc.y = y;

    renderItems(doc, items, imageCache, 'Stock Value Report', dateStr, 1);
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

    const raw = await db.Inventory.find({ created_date_time: { $gte: start, $lte: end } }).lean();
    const { totalQty, totalSell, items } = groupInventoryItems(raw, 'qty');
    const totalPurchase = items.reduce((s, i) => s + i.totalPurchaseAmount, 0);

    await enrichImages(items);
    const imageCache = await buildImageCache(items);

    const doc = new PDFDocument({ margin: M, size: 'A4', bufferPages: true,
      info: { Title: 'Elite Edition Stock Inward Report', Author: 'Elite Edition ERP' }
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Stock_Inward_Report_${dateStart}.pdf"`);
    doc.pipe(res);

    drawPageHeader(doc, 'Stock Inward Report', dateStr, 1);
    let y = 65;
    y = drawSummaryCards(doc, y, [
      { label: 'SKUs Received',   value: fmtN(items.length) },
      { label: 'Total Units In',  value: fmtN(totalQty) },
      { label: 'Purchase Total',  value: fmt(totalPurchase) },
      { label: 'Sell Value',      value: fmt(totalSell), color: C.accentBlue },
    ]);
    doc.y = y;

    renderItems(doc, items, imageCache, 'Stock Inward Report', dateStr, 1);
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

    renderItems(doc, items, imageCache, 'Stock Outward Report', dateStr, 1);
    drawFooters(doc);
    doc.end();
    logger.info('Stock Outward PDF complete.');
  } catch (err) {
    logger.error('Stock Outward PDF error: %o', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};

module.exports = {
  getInventoryReport,
  downloadStockValuePdf,
  downloadStockInwardPdf,
  downloadStockOutwardPdf,
};
