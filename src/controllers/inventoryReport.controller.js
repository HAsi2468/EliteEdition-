const db = require('../db/models');
const logger = require('../config/logger');
const PDFDocument = require('pdfkit');
const axios = require('axios');
const sharp = require('sharp');

// ─────────────────────────────────────────────────────────────
// Fetch image, convert any format (incl. WebP) to JPEG buffer
// ─────────────────────────────────────────────────────────────
const fetchImageBuffer = async (imageUrl) => {
  if (!imageUrl) return null;
  try {
    let url = imageUrl.trim();

    // Fix relative paths
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `http://3.7.174.180:3001${url}`;
    }

    // Force JPEG from ImageKit/CloudFront by replacing format param
    // tr:f-webp → tr:f-jpg  and  tr:f-webp,w-1200 → tr:f-jpg,w-400
    url = url
      .replace(/tr:f-webp,w-\d+/g, 'tr:f-jpg,w-400')
      .replace(/tr:f-webp/g, 'tr:f-jpg');

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: { 'Accept': 'image/jpeg,image/png,image/*' }
    });

    const contentType = response.headers['content-type'] || '';

    // Convert to JPEG using sharp regardless of source format
    const jpegBuffer = await sharp(Buffer.from(response.data))
      .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    return jpegBuffer;
  } catch (error) {
    logger.error('Error fetching/converting image for PDF: %s — %s', imageUrl, error.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// Build report data
// ─────────────────────────────────────────────────────────────
const buildReportData = async (dateStart, dateEnd) => {
  const start = new Date(dateStart);
  const end = new Date(dateEnd);
  end.setHours(23, 59, 59, 999);

  const currentStockRaw = await db.Inventory.find().lean();
  const stockInRaw = await db.Inventory.find({
    created_date_time: { $gte: start, $lte: end }
  }).lean();

  const stockOutLogs = await db.StockOut.find({
    created_date_time: { $gte: start, $lte: end }
  }).lean();

  const stockOutRaw = [];
  for (const log of stockOutLogs) {
    const invItem = await db.Inventory.findOne({ skuCode: log.skuCode }).lean();
    stockOutRaw.push({
      ...log,
      itemName: invItem ? invItem.itemName : 'Unknown',
      size: invItem ? invItem.size : 'N/A',
      imageUrl: invItem ? invItem.imageUrl : '',
      salePrice: invItem ? invItem.salePrice : 0,
      purchasePrice: invItem ? invItem.purchasePrice : 0,
      qty: log.qtyOut
    });
  }

  const groupItems = (rawItems, isStockOut = false) => {
    const grouped = {};
    let totalOrderQuantity = 0;
    let totalSellableAmount = 0;

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
          totalSellableAmount: 0
        };
      }

      // Use the first non-empty imageUrl we encounter
      if (!grouped[baseSku].imageUrl && item.imageUrl) {
        grouped[baseSku].imageUrl = item.imageUrl;
      }

      const qty = isStockOut ? item.qty : item.currentlyAvailableStock;

      let sizeObj = grouped[baseSku].sizes.find(s => s.size === item.size);
      if (sizeObj) {
        sizeObj.qty += qty;
      } else {
        grouped[baseSku].sizes.push({ size: item.size, qty });
      }

      grouped[baseSku].total += qty;
      grouped[baseSku].totalPurchaseAmount += (qty * (item.purchasePrice || 0));
      grouped[baseSku].totalSellableAmount += (qty * (item.salePrice || 0));

      totalOrderQuantity += qty;
      totalSellableAmount += (qty * (item.salePrice || 0));
    });

    return {
      totalOrderQuantity,
      totalSellableAmount,
      items: Object.values(grouped).filter(g => g.total > 0)
    };
  };

  const currentStock = groupItems(currentStockRaw, false);
  const stockOut = groupItems(stockOutRaw, true);

  const stockIn = (() => {
    const grouped = {};
    let totalOrderQuantity = 0;
    let totalSellableAmount = 0;

    stockInRaw.forEach(item => {
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
          totalSellableAmount: 0
        };
      }

      if (!grouped[baseSku].imageUrl && item.imageUrl) {
        grouped[baseSku].imageUrl = item.imageUrl;
      }

      const qty = item.qty || item.currentlyAvailableStock;

      let sizeObj = grouped[baseSku].sizes.find(s => s.size === item.size);
      if (sizeObj) {
        sizeObj.qty += qty;
      } else {
        grouped[baseSku].sizes.push({ size: item.size, qty });
      }

      grouped[baseSku].total += qty;
      grouped[baseSku].totalPurchaseAmount += (qty * (item.purchasePrice || 0));
      grouped[baseSku].totalSellableAmount += (qty * (item.salePrice || 0));

      totalOrderQuantity += qty;
      totalSellableAmount += (qty * (item.salePrice || 0));
    });

    return {
      totalOrderQuantity,
      totalSellableAmount,
      items: Object.values(grouped).filter(g => g.total > 0)
    };
  })();

  return { reportDate: { start: dateStart, end: dateEnd }, currentStock, stockIn, stockOut };
};

// ─────────────────────────────────────────────────────────────
// Enrich items with imageUrl from inventory_products by base SKU
// ─────────────────────────────────────────────────────────────
const enrichImagesFromProducts = async (reportData) => {
  // Collect all base SKUs that need images
  const baseSkusNeedingImage = new Set();
  [reportData.currentStock, reportData.stockIn, reportData.stockOut].forEach(section => {
    (section.items || []).forEach(item => {
      if (!item.imageUrl) baseSkusNeedingImage.add(item.sku);
    });
  });

  if (baseSkusNeedingImage.size === 0) return;

  // Fetch matching inventory_products by SKU code prefix
  // inventory_products SKUs are like "265_XL", base SKU is "265"
  const baseSkuArray = Array.from(baseSkusNeedingImage);
  const productDocs = await db.InventoryProduct.find({
    imageUrl: { $exists: true, $nin: [null, ''] }
  }).lean();

  // Build a map: baseSku → imageUrl
  const imageMap = {};
  productDocs.forEach(p => {
    const base = p.skuCode ? p.skuCode.split('_')[0] : null;
    if (base && baseSkuArray.includes(base) && p.imageUrl && !imageMap[base]) {
      imageMap[base] = p.imageUrl;
    }
  });

  // Inject imageUrl into report items that are missing it
  [reportData.currentStock, reportData.stockIn, reportData.stockOut].forEach(section => {
    (section.items || []).forEach(item => {
      if (!item.imageUrl && imageMap[item.sku]) {
        item.imageUrl = imageMap[item.sku];
      }
    });
  });
};

// ─────────────────────────────────────────────────────────────
// JSON endpoint
// ─────────────────────────────────────────────────────────────
const getInventoryReport = async (req, res) => {
  try {
    const { dateStart, dateEnd } = req.query;
    if (!dateStart || !dateEnd) {
      return res.status(400).json({ error: 'dateStart and dateEnd are required' });
    }
    const response = await buildReportData(dateStart, dateEnd);
    res.json(response);
  } catch (error) {
    logger.error('Error generating inventory report JSON: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// PDF Design Constants
// ─────────────────────────────────────────────────────────────
const COLORS = {
  primary:      '#1B2A4A',   // deep navy
  accent:       '#3B82F6',   // vivid blue
  accentLight:  '#EFF6FF',   // light blue tint
  headerBg:     '#1B2A4A',   // table header bg
  headerText:   '#FFFFFF',
  rowAlt:       '#F8FAFD',   // alternating row
  rowNormal:    '#FFFFFF',
  border:       '#CBD5E1',
  text:         '#1E293B',
  subText:      '#64748B',
  green:        '#16A34A',
  red:          '#DC2626',
  orange:       '#D97706',
  white:        '#FFFFFF',
  sectionBg:    '#3B82F6',
};

const PAGE_MARGIN = 36;
const PAGE_WIDTH  = 595.28;  // A4
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

// Column layout (total = CONTENT_WIDTH ~523)
const COLS = {
  img:      52,
  sku:     100,
  vendor:   90,
  sizes:   100,
  total:    40,
  purchase: 55,
  sell:     55,
  profit:   55,
};
const COL_KEYS = ['img', 'sku', 'vendor', 'sizes', 'total', 'purchase', 'sell', 'profit'];
const COL_LABELS = ['Photo', 'SKU / Item', 'Vendor', 'Sizes & Qty', 'Total', 'Purchase ₹', 'Sell ₹', 'Profit ₹'];

const ROW_HEIGHT_BASE = 52;

// ─────────────────────────────────────────────────────────────
// Helper: format currency
// ─────────────────────────────────────────────────────────────
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');

// ─────────────────────────────────────────────────────────────
// Draw page header (repeated on every page)
// ─────────────────────────────────────────────────────────────
const drawPageHeader = (doc, dateStart, dateEnd, pageNum) => {
  // Top navy banner
  doc.rect(0, 0, PAGE_WIDTH, 58).fill(COLORS.primary);

  // Brand name
  doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(18)
     .text('ELITE EDITION', PAGE_MARGIN, 14, { characterSpacing: 1 });

  // Subtitle
  doc.fillColor('#93C5FD').font('Helvetica').fontSize(9)
     .text('Inventory Report', PAGE_MARGIN, 36);

  // Date range on right
  const dateStr = `${dateStart}  →  ${dateEnd}`;
  doc.fillColor(COLORS.white).font('Helvetica').fontSize(9)
     .text(dateStr, PAGE_MARGIN, 18, { width: CONTENT_WIDTH, align: 'right' });

  // Page number
  doc.fillColor('#93C5FD').font('Helvetica').fontSize(8)
     .text(`Page ${pageNum}`, PAGE_MARGIN, 36, { width: CONTENT_WIDTH, align: 'right' });

  // Accent line under header
  doc.rect(0, 58, PAGE_WIDTH, 3).fill(COLORS.accent);
};

// ─────────────────────────────────────────────────────────────
// Draw section summary card
// ─────────────────────────────────────────────────────────────
const drawSummaryCard = (doc, y, label, totalQty, totalSell, totalPurchase) => {
  const profit = totalSell - totalPurchase;
  const cardH = 56;
  const colW = CONTENT_WIDTH / 4;

  // Card background
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, cardH).fill(COLORS.accentLight);
  doc.rect(PAGE_MARGIN, y, 4, cardH).fill(COLORS.accent);

  const stats = [
    { label: 'Items',           value: fmtNum(totalQty) },
    { label: 'Purchase Total',  value: fmt(totalPurchase) },
    { label: 'Sell Total',      value: fmt(totalSell) },
    { label: 'Profit',          value: fmt(profit), color: profit >= 0 ? COLORS.green : COLORS.red },
  ];

  stats.forEach((stat, i) => {
    const x = PAGE_MARGIN + 12 + i * colW;
    doc.fillColor(COLORS.subText).font('Helvetica').fontSize(7.5)
       .text(stat.label.toUpperCase(), x, y + 10, { width: colW - 8 });
    doc.fillColor(stat.color || COLORS.text).font('Helvetica-Bold').fontSize(13)
       .text(stat.value, x, y + 22, { width: colW - 8 });
  });

  return y + cardH + 10;
};

// ─────────────────────────────────────────────────────────────
// Draw table header row
// ─────────────────────────────────────────────────────────────
const drawTableHeader = (doc, y) => {
  const rowH = 22;
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, rowH).fill(COLORS.headerBg);

  let x = PAGE_MARGIN;
  COL_KEYS.forEach((key, i) => {
    doc.fillColor(COLORS.headerText).font('Helvetica-Bold').fontSize(7.5)
       .text(COL_LABELS[i], x + 3, y + 7, { width: COLS[key] - 6, align: 'center' });
    x += COLS[key];
  });

  return y + rowH;
};

// ─────────────────────────────────────────────────────────────
// Draw a single data row
// ─────────────────────────────────────────────────────────────
const drawRow = (doc, y, item, imageBuffer, isAlternate) => {
  const sizesText = (item.sizes || [])
    .sort((a, b) => a.size.localeCompare(b.size))
    .map(s => `${s.size}: ${s.qty}`)
    .join('\n');

  const linesCount = Math.max(1, (item.sizes || []).length);
  const rowH = Math.max(ROW_HEIGHT_BASE, linesCount * 14 + 16);

  // Row background
  const rowBg = isAlternate ? COLORS.rowAlt : COLORS.rowNormal;
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, rowH).fill(rowBg);

  // Bottom border line
  doc.moveTo(PAGE_MARGIN, y + rowH).lineTo(PAGE_MARGIN + CONTENT_WIDTH, y + rowH)
     .strokeColor(COLORS.border).lineWidth(0.4).stroke();

  let x = PAGE_MARGIN;
  const midY = y + rowH / 2;

  // ── Column: Image ──
  const imgSize = Math.min(rowH - 10, 42);
  const imgX = x + (COLS.img - imgSize) / 2;
  const imgY = y + (rowH - imgSize) / 2;

  if (imageBuffer) {
    try {
      // Image frame/border
      doc.rect(imgX - 1, imgY - 1, imgSize + 2, imgSize + 2)
         .strokeColor('#E2E8F0').lineWidth(0.8).stroke();
      doc.image(imageBuffer, imgX, imgY, { width: imgSize, height: imgSize, cover: [imgSize, imgSize] });
    } catch (e) {
      // fallback placeholder
      doc.rect(imgX, imgY, imgSize, imgSize).fill('#F1F5F9');
      doc.fillColor(COLORS.subText).font('Helvetica').fontSize(6)
         .text('No Photo', imgX, imgY + imgSize / 2 - 4, { width: imgSize, align: 'center' });
    }
  } else {
    // Placeholder box
    doc.rect(imgX, imgY, imgSize, imgSize).fill('#F1F5F9');
    doc.fillColor(COLORS.subText).font('Helvetica').fontSize(6)
       .text('No Photo', imgX, imgY + imgSize / 2 - 4, { width: imgSize, align: 'center' });
  }
  x += COLS.img;

  // Vertical dividers
  const drawDivider = (dx) => {
    doc.moveTo(dx, y + 4).lineTo(dx, y + rowH - 4)
       .strokeColor(COLORS.border).lineWidth(0.3).stroke();
  };

  let divX = PAGE_MARGIN + COLS.img;
  COL_KEYS.slice(1).forEach(key => {
    drawDivider(divX);
    divX += COLS[key];
  });

  // ── Column: SKU / Item Name ──
  const textY = midY - 10;
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8.5)
     .text(item.sku || '-', x + 4, textY, { width: COLS.sku - 8, lineBreak: false, ellipsis: true });
  if (item.itemName && item.itemName !== item.sku) {
    doc.fillColor(COLORS.subText).font('Helvetica').fontSize(7)
       .text(item.itemName, x + 4, textY + 12, { width: COLS.sku - 8, lineBreak: false, ellipsis: true });
  }
  x += COLS.sku;

  // ── Column: Vendor ──
  doc.fillColor(COLORS.subText).font('Helvetica').fontSize(7.5)
     .text(item.party || '-', x + 4, midY - 5, { width: COLS.vendor - 8, align: 'center' });
  x += COLS.vendor;

  // ── Column: Sizes ──
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.5)
     .text(sizesText, x + 4, y + 8, { width: COLS.sizes - 8, align: 'center', lineBreak: true });
  x += COLS.sizes;

  // ── Column: Total ──
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
     .text(fmtNum(item.total), x + 2, midY - 6, { width: COLS.total - 4, align: 'center' });
  x += COLS.total;

  // ── Column: Purchase ──
  doc.fillColor(COLORS.subText).font('Helvetica').fontSize(8)
     .text(fmt(item.totalPurchaseAmount), x + 2, midY - 5, { width: COLS.purchase - 4, align: 'center' });
  x += COLS.purchase;

  // ── Column: Sell ──
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8)
     .text(fmt(item.totalSellableAmount), x + 2, midY - 5, { width: COLS.sell - 4, align: 'center' });
  x += COLS.sell;

  // ── Column: Profit ──
  const profit = item.totalSellableAmount - item.totalPurchaseAmount;
  const profitColor = profit >= 0 ? COLORS.green : COLORS.red;
  doc.fillColor(profitColor).font('Helvetica-Bold').fontSize(8)
     .text(fmt(profit), x + 2, midY - 5, { width: COLS.profit - 4, align: 'center' });

  return rowH;
};

// ─────────────────────────────────────────────────────────────
// Render a full section (Current Stock / Stock In / Stock Out)
// ─────────────────────────────────────────────────────────────
const renderSection = async (doc, sectionTitle, sectionData, imageCache, dateStart, dateEnd, pageNum) => {
  const items = sectionData.items || [];

  // ── Section title bar ──
  let y = doc.y + 14;

  // ensure there's room for at least the title + header
  if (y + 100 > PAGE_HEIGHT - PAGE_MARGIN) {
    doc.addPage();
    pageNum++;
    drawPageHeader(doc, dateStart, dateEnd, pageNum);
    y = 75;
  }

  // Section banner
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, 28).fill(COLORS.primary);
  doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(12)
     .text(sectionTitle.toUpperCase(), PAGE_MARGIN + 12, y + 8, { characterSpacing: 0.5 });

  // Item count badge
  const badge = `${items.length} items`;
  const badgeW = 55;
  doc.rect(PAGE_MARGIN + CONTENT_WIDTH - badgeW - 8, y + 6, badgeW, 16)
     .fill(COLORS.accent);
  doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(7.5)
     .text(badge, PAGE_MARGIN + CONTENT_WIDTH - badgeW - 8, y + 10, { width: badgeW, align: 'center' });

  y += 28 + 8;

  // Summary card
  y = drawSummaryCard(doc, y, sectionTitle, sectionData.totalOrderQuantity, sectionData.totalSellableAmount, 
      items.reduce((s, i) => s + i.totalPurchaseAmount, 0));

  if (items.length === 0) {
    doc.fillColor(COLORS.subText).font('Helvetica-Oblique').fontSize(10)
       .text('No data available for this period.', PAGE_MARGIN, y + 10);
    doc.y = y + 30;
    return pageNum;
  }

  // Table header
  y = drawTableHeader(doc, y);

  // Rows
  let alternate = false;
  for (const item of items) {
    const sizesCount = Math.max(1, (item.sizes || []).length);
    const rowH = Math.max(ROW_HEIGHT_BASE, sizesCount * 14 + 16);

    // Page break
    if (y + rowH > PAGE_HEIGHT - PAGE_MARGIN - 20) {
      doc.addPage();
      pageNum++;
      drawPageHeader(doc, dateStart, dateEnd, pageNum);
      y = 75;

      // Re-draw section sub-header
      doc.fillColor(COLORS.subText).font('Helvetica-Oblique').fontSize(8)
         .text(`${sectionTitle} (continued)`, PAGE_MARGIN, y);
      y += 14;
      y = drawTableHeader(doc, y);
    }

    const imgBuffer = item.imageUrl ? imageCache[item.imageUrl] : null;
    const usedH = drawRow(doc, y, item, imgBuffer, alternate);
    y += usedH;
    alternate = !alternate;
  }

  doc.y = y;
  return pageNum;
};

// ─────────────────────────────────────────────────────────────
// PDF endpoint
// ─────────────────────────────────────────────────────────────
const downloadInventoryReportPdf = async (req, res) => {
  try {
    const { dateStart, dateEnd } = req.query;
    if (!dateStart || !dateEnd) {
      return res.status(400).json({ error: 'dateStart and dateEnd are required' });
    }

    logger.info('Building PDF report for %s → %s', dateStart, dateEnd);
    const reportData = await buildReportData(dateStart, dateEnd);

    // Enrich missing imageUrls from inventory_products collection
    await enrichImagesFromProducts(reportData);
    logger.info('Image enrichment done.');

    // ── Pre-fetch & convert all images ──
    const uniqueUrls = new Set();
    [reportData.currentStock, reportData.stockIn, reportData.stockOut].forEach(section => {
      (section.items || []).forEach(item => {
        if (item.imageUrl) uniqueUrls.add(item.imageUrl);
      });
    });

    logger.info('Pre-fetching %d unique images…', uniqueUrls.size);
    const imageCache = {};
    const urlArr = Array.from(uniqueUrls);
    const CHUNK = 10;
    for (let i = 0; i < urlArr.length; i += CHUNK) {
      const chunk = urlArr.slice(i, i + CHUNK);
      await Promise.all(chunk.map(async (url) => {
        imageCache[url] = await fetchImageBuffer(url);
      }));
    }
    logger.info('Image pre-fetch complete. %d/%d loaded.', Object.values(imageCache).filter(Boolean).length, urlArr.length);

    // ── Create PDF document ──
    const doc = new PDFDocument({
      margin: PAGE_MARGIN,
      size: 'A4',
      bufferPages: true,
      info: {
        Title: `Elite Edition Inventory Report ${dateStart}`,
        Author: 'Elite Edition ERP',
        Subject: 'Inventory Report',
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="EliteEdition_Report_${dateStart}_to_${dateEnd}.pdf"`);
    doc.pipe(res);

    let pageNum = 1;

    // ── Page 1 Header ──
    drawPageHeader(doc, dateStart, dateEnd, pageNum);

    // ── Grand summary row ──
    const grandQty = reportData.currentStock.totalOrderQuantity;
    const grandSell = reportData.currentStock.totalSellableAmount;
    const grandPurchase = reportData.currentStock.items.reduce((s, i) => s + i.totalPurchaseAmount, 0);
    const grandProfit = grandSell - grandPurchase;

    let y = 70;
    const statW = CONTENT_WIDTH / 4;
    const stats = [
      { label: 'Total SKUs',      value: fmtNum(reportData.currentStock.items.length), icon: '📦' },
      { label: 'Total Stock',     value: fmtNum(grandQty),                              icon: '📊' },
      { label: 'Inventory Value', value: fmt(grandSell),                                icon: '💰' },
      { label: 'Potential Profit',value: fmt(grandProfit), color: grandProfit >= 0 ? COLORS.green : COLORS.red, icon: '📈' },
    ];

    stats.forEach((stat, i) => {
      const sx = PAGE_MARGIN + i * statW;
      doc.rect(sx, y, statW - 6, 44).fill('#F8FAFD');
      doc.rect(sx, y, 3, 44).fill(COLORS.accent);
      doc.fillColor(COLORS.subText).font('Helvetica').fontSize(7)
         .text(stat.label.toUpperCase(), sx + 8, y + 7, { width: statW - 18 });
      doc.fillColor(stat.color || COLORS.text).font('Helvetica-Bold').fontSize(13)
         .text(stat.value, sx + 8, y + 19, { width: statW - 18 });
    });

    doc.y = y + 52;

    // ── Sections ──
    pageNum = await renderSection(doc, 'Current Stock',  reportData.currentStock, imageCache, dateStart, dateEnd, pageNum);
    pageNum = await renderSection(doc, 'Stock In',       reportData.stockIn,      imageCache, dateStart, dateEnd, pageNum);
    pageNum = await renderSection(doc, 'Stock Out',      reportData.stockOut,     imageCache, dateStart, dateEnd, pageNum);

    // ── Footer on every page ──
    const pages = doc.bufferedPageRange();
    for (let p = 0; p < pages.count; p++) {
      doc.switchToPage(pages.start + p);
      doc.rect(0, PAGE_HEIGHT - 28, PAGE_WIDTH, 28).fill(COLORS.primary);
      doc.fillColor('#93C5FD').font('Helvetica').fontSize(7.5)
         .text(
           `Elite Edition ERP  •  Generated: ${new Date().toLocaleString('en-IN')}  •  Page ${p + 1} of ${pages.count}`,
           PAGE_MARGIN, PAGE_HEIGHT - 19,
           { width: CONTENT_WIDTH, align: 'center' }
         );
    }

    doc.end();
    logger.info('PDF generation complete.');
  } catch (error) {
    logger.error('Error generating PDF: %o', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
  }
};

module.exports = {
  getInventoryReport,
  downloadInventoryReportPdf
};
