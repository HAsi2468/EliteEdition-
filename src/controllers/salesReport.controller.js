const db = require('../db/models');
const logger = require('../config/logger');
const PDFDocument = require('pdfkit');
const axios = require('axios');
const sharp = require('sharp');
const { fetchSalesReportData } = require('../services/product.service');

// ─────────────────────────────────────────────────────────────
// Fetch & convert image to JPEG buffer (handles WebP from CDN)
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
// Light color palette
// ─────────────────────────────────────────────────────────────
const C = {
  headerBg:     '#DBEAFE',   // page top banner (light blue)
  headerText:   '#1E3A8A',   // dark blue text for readability
  tableBg:      '#EFF6FF',   // light blue table header
  tableText:    '#1E40AF',   // indigo table header text
  rowAlt:       '#F0F7FF',   // very light blue alternate row
  rowNormal:    '#FFFFFF',
  border:       '#BFDBFE',   // light blue border
  text:         '#1E293B',
  subText:      '#64748B',
  green:        '#16A34A',
  greenBg:      '#DCFCE7',
  red:          '#DC2626',
  redBg:        '#FEE2E2',
  sectionBg:    '#DBEAFE',   // light blue section header
  sectionText:  '#1E40AF',
  accentBlue:   '#3B82F6',
  summaryBg:    '#F0FDF4',   // light mint summary card
  summaryBorder:'#BBF7D0',
};

const PAGE_W  = 595.28;
const PAGE_H  = 841.89;
const MARGIN  = 36;
const CW      = PAGE_W - MARGIN * 2;  // content width ≈ 523

const fmt = (n) => `${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtN = (n) => Number(n || 0).toLocaleString('en-IN');

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
// Draw repeating page header
// ─────────────────────────────────────────────────────────────
const drawHeader = (doc, title, dateStr, page) => {
  doc.rect(0, 0, PAGE_W, 54).fill(C.headerBg);

  // Logo drawing next to title
  const path = require('path');
  const logoPath = path.join(__dirname, 'Logo.png');
  try {
    doc.image(logoPath, MARGIN, 11, { width: 32, height: 32 });
  } catch (err) {
    logger.warn('Failed to draw logo: %s', err.message);
  }

  doc.fillColor(C.headerText).font('Helvetica-Bold').fontSize(16)
     .text(title, MARGIN + 42, 19);

  doc.fillColor(C.headerText).font('Helvetica').fontSize(8.5)
     .text(dateStr, MARGIN, 14, { width: CW, align: 'right' });
  doc.fillColor(C.headerText).font('Helvetica').fontSize(7.5)
     .text(`Page ${page}`, MARGIN, 34, { width: CW, align: 'right' });

  // accent underline
  doc.rect(0, 54, PAGE_W, 2).fill(C.accentBlue);
};

// ─────────────────────────────────────────────────────────────
// Draw summary stat cards
// ─────────────────────────────────────────────────────────────
const drawSummaryCards = (doc, y, stats) => {
  const cardW = CW / stats.length;
  stats.forEach((stat, i) => {
    const x = MARGIN + i * cardW;
    doc.rect(x, y, cardW - 6, 44).fill(C.summaryBg);
    doc.rect(x, y, 3, 44).fill(C.accentBlue);
    doc.fillColor(C.subText).font('Helvetica').fontSize(7)
       .text(stat.label.toUpperCase(), x + 8, y + 8, { width: cardW - 20 });
    doc.fillColor(stat.color || C.text).font('Helvetica-Bold').fontSize(13)
       .text(stat.value, x + 8, y + 20, { width: cardW - 20 });
  });
  return y + 52;
};

// ─────────────────────────────────────────────────────────────
// Draw table header row
// ─────────────────────────────────────────────────────────────
const drawTableHeader = (doc, y, cols) => {
  const rowH = 22;
  doc.rect(MARGIN, y, CW, rowH).fill(C.tableBg);
  // top border accent
  doc.rect(MARGIN, y, CW, 2).fill(C.accentBlue);

  let x = MARGIN;
  cols.forEach((col) => {
    doc.fillColor(C.tableText).font('Helvetica-Bold').fontSize(7.5)
       .text(col.label, x + 3, y + 6, { width: col.w - 6, align: 'center' });
    x += col.w;
  });
  return y + rowH;
};

// ─────────────────────────────────────────────────────────────
// Helper: draw vertical dividers between columns
// ─────────────────────────────────────────────────────────────
const drawDividers = (doc, startX, y, rowH, cols) => {
  let x = startX;
  cols.slice(0, -1).forEach((col) => {
    x += col.w;
    doc.moveTo(x, y + 3).lineTo(x, y + rowH - 3)
       .strokeColor(C.border).lineWidth(0.4).stroke();
  });
};

// ─────────────────────────────────────────────────────────────
// SALES REPORT PDF
// ─────────────────────────────────────────────────────────────
const SALES_COLS = [
  { label: 'Photo',    w: 52  },
  { label: 'SKU Code', w: 110 },
  { label: 'Name',     w: 120 },
  { label: 'Brand',    w: 80  },
  { label: 'Orders',   w: 50  },
  { label: 'Avg',    w: 55  },
  { label: 'Total',  w: 56  },
];

const downloadSalesReportPdf = async (req, res) => {
  try {
    const { dateStart, dateEnd } = req.query;
    if (!dateStart || !dateEnd) {
      return res.status(400).json({ error: 'dateStart and dateEnd are required' });
    }

    const dateStartObj = new Date(dateStart);
    const dateEndObj   = new Date(dateEnd);
    dateEndObj.setHours(23, 59, 59, 999);

    const { searchCode } = req.query;
    const whereClause = { orderDate: { $gte: dateStartObj, $lte: dateEndObj }, saleOrderStatus: { $ne: 'CANCELLED' } };
    if (searchCode) {
      whereClause.itemSKUCode = new RegExp(`^${searchCode}`, 'i');
    }
    logger.info('Generating Sales PDF report %s → %s', dateStart, dateEnd);

    // Aggregation pipeline for Sales Report
    const pipeline = [
      { $match: whereClause },
      { $group: {
          _id: { baseSku: { $arrayElemAt: [{ $split: ['$itemSKUCode', '_'] }, 0] }, size: { $cond: { if: { $or: [{ $eq: ['$itemTypeSize', ''] }, { $eq: [{ $ifNull: ['$itemTypeSize', null] }, null] }] }, then: 'N/A', else: '$itemTypeSize' } } },
          quantity: { $sum: { $ifNull: ['$saleCount', 1] } },
          sellableAmount: { $sum: { $multiply: [{ $ifNull: ['$saleCount', 1] }, { $convert: { input: '$totalPrice', to: 'double', onError: 0, onNull: 0 } }] } }
      }},
      { $group: {
          _id: '$_id.baseSku',
          variations: { $push: { size: '$_id.size', quantity: '$quantity', sellableAmount: '$sellableAmount' } },
          qty: { $sum: '$quantity' },
          amt: { $sum: '$sellableAmount' }
      }},
      { $sort: { qty: -1 } } // "HIGH ORDER PUT ON FIRST"
    ];

    const products = await db.SaleOrder.aggregate(pipeline);

    // Fetch images
    const baseSkus = products.map(p => p._id).filter(Boolean);
    const productDocs = await db.InventoryProduct.find({
      skuCode: { $in: baseSkus.flatMap(s => [s, ...baseSkus.filter(x => x.startsWith(s))]) },
      imageUrl: { $exists: true, $nin: [null, ''] }
    }).lean();

    const skuImageMap = {};
    productDocs.forEach(p => {
      const base = (p.skuCode || '').split('_')[0];
      if (base && !skuImageMap[base] && p.imageUrl) skuImageMap[base] = p.imageUrl;
    });

    const productDocs2 = await db.Product.find({ skuCode: { $in: baseSkus }, imageUrl: { $nin: [null, ''] } }).lean();
    productDocs2.forEach(p => {
      if (p.skuCode && !skuImageMap[p.skuCode] && p.imageUrl) skuImageMap[p.skuCode] = p.imageUrl;
    });

    // Pre-fetch all images
    const uniqueUrls = [...new Set(Object.values(skuImageMap).filter(Boolean))];
    const imageCache = {};
    const CHUNK = 8;
    for (let i = 0; i < uniqueUrls.length; i += CHUNK) {
      await Promise.all(uniqueUrls.slice(i, i + CHUNK).map(async url => {
        imageCache[url] = await fetchImageBuffer(url);
      }));
    }

    // Totals
    const totalOrders  = products.reduce((s, r) => s + r.qty, 0);
    const totalAmount  = products.reduce((s, r) => s + r.amt, 0);
    const dateStr = `${dateStart}  →  ${dateEnd}`;

    const doc = new PDFDocument({ margin: MARGIN, size: 'A4', bufferPages: true,
      info: { Title: `Elite Edition Sales Report ${dateStart}`, Author: 'Elite Edition ERP' }
    });

    doc.on('pageAdded', () => drawPunchGuide(doc));
    drawPunchGuide(doc);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Sales_Report_${dateStart}.pdf"`);
    doc.pipe(res);

    let pageNum = 1;
    drawHeader(doc, 'Sales Report', dateStr, pageNum);

    // Summary cards
    let y = 65;
    y = drawSummaryCards(doc, y, [
      { label: 'Total SKUs',    value: fmtN(products.length) },
      { label: 'Total Orders',  value: fmtN(totalOrders) },
      { label: 'Total Revenue', value: fmt(totalAmount) },
      { label: 'Avg per Order', value: totalOrders > 0 ? fmt(totalAmount / totalOrders) : '0', color: C.accentBlue },
    ]);

    const SIMPLE_COLS = [
      { label: 'Photo',       w: 52  },
      { label: 'SKU',         w: 110 },
      { label: 'Sizes & Qty', w: 90 },
      { label: 'Orders',      w: 55  },
      { label: 'Revenue',     w: 78  },
      { label: 'Avg',         w: 78  },
    ];

    const sizeOrder = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];

    // Table header
    y = drawTableHeader(doc, y, SIMPLE_COLS);

    let alt = false;
    for (const prod of products) {
      const baseSku  = prod._id || '-';
      const imgUrl   = skuImageMap[baseSku];
      const imgBuf   = imgUrl ? imageCache[imgUrl] : null;

      const sortedVariations = (prod.variations || []).sort((a, b) => {
        let sa = (a.size || '').toUpperCase().trim().replace('XXL', '2XL').replace('XXXL', '3XL');
        let sb = (b.size || '').toUpperCase().trim().replace('XXL', '2XL').replace('XXXL', '3XL');
        let ia = sizeOrder.indexOf(sa);
        let ib = sizeOrder.indexOf(sb);
        if (ia === -1 && ib === -1) return (a.size || '').localeCompare(b.size || '');
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });

      const sizesText = sortedVariations.map(v => `${(v.size || '').toUpperCase()}: ${v.quantity}`).join('\n');
      const numLines = Math.max(1, sortedVariations.length);
      const rowH = Math.max(50, numLines * 10 + 20);

      if (y + rowH > PAGE_H - MARGIN - 28) {
        // Only add a new page if there is remaining data to render
        if (y + rowH > PAGE_H - MARGIN - 28) {
          // Only add a new page if there is another product after this one
          if (prod !== products[products.length - 1]) {
            doc.addPage();
            pageNum++;
            drawHeader(doc, 'Sales Report (continued)', dateStr, pageNum);
            y = 65;
            y = drawTableHeader(doc, y, SIMPLE_COLS);
            alt = false;
          }
        }
      }

       // Row background – moved font settings outside loop for speed
       doc.rect(MARGIN, y, CW, rowH).fill(alt ? C.rowAlt : C.rowNormal);
       // Bottom border
       doc.moveTo(MARGIN, y + rowH).lineTo(MARGIN + CW, y + rowH)
          .strokeColor(C.border).lineWidth(0.4).stroke();
       drawDividers(doc, MARGIN, y, rowH, SIMPLE_COLS);

      const mid = y + rowH / 2;
      let x = MARGIN;

      // Image
      const imgSize = Math.min(rowH - 10, 40);
      const ix = x + (SIMPLE_COLS[0].w - imgSize) / 2;
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
        doc.fillColor(C.subText).font('Helvetica').fontSize(5).text('No Photo', ix, iy + imgSize / 2 - 3, { width: imgSize, align: 'center' });
      }
      x += SIMPLE_COLS[0].w;

      // SKU
      doc.fillColor(C.tableText).font('Helvetica-Bold').fontSize(9)
         .text(baseSku, x + 3, mid - 5, { width: SIMPLE_COLS[1].w - 6, align: 'center', lineBreak: false, ellipsis: true });
      x += SIMPLE_COLS[1].w;

      // Sizes
      doc.fillColor(C.text).font('Helvetica').fontSize(8);
      const sizesHeight = doc.heightOfString(sizesText, { width: SIMPLE_COLS[2].w - 8, align: 'center' });
      const sizesY = y + (rowH - sizesHeight) / 2;
      doc.text(sizesText, x + 4, sizesY, { width: SIMPLE_COLS[2].w - 8, align: 'center', lineBreak: true });
      x += SIMPLE_COLS[2].w;

      // Orders
      doc.fillColor(C.text).font('Helvetica-Bold').fontSize(10)
         .text(fmtN(prod.qty), x + 2, mid - 7, { width: SIMPLE_COLS[3].w - 4, align: 'center' });
      x += SIMPLE_COLS[3].w;

      // Revenue
      doc.fillColor(C.accentBlue).font('Helvetica-Bold').fontSize(8)
         .text(fmt(prod.amt), x + 2, mid - 5, { width: SIMPLE_COLS[4].w - 4, align: 'center' });
      x += SIMPLE_COLS[4].w;

      // Avg
      const avgAmt = prod.qty > 0 ? prod.amt / prod.qty : 0;
      doc.fillColor(C.subText).font('Helvetica').fontSize(8)
         .text(fmt(avgAmt), x + 2, mid - 5, { width: SIMPLE_COLS[5].w - 4, align: 'center' });

      y += rowH;
      alt = !alt;
    }

    // Footer on all pages
    const pages = doc.bufferedPageRange();
    const oldBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    for (let p = 0; p < pages.count; p++) {
      doc.switchToPage(pages.start + p);
      doc.rect(0, PAGE_H - 26, PAGE_W, 26).fill(C.headerBg);
      doc.fillColor(C.headerText).font('Helvetica-Bold').fontSize(7.5)
         .text(`Elite Edition ERP  •  Generated: ${new Date().toLocaleString('en-IN')}  •  Page ${p + 1} of ${pages.count}`,
           MARGIN, PAGE_H - 17, { width: CW, align: 'center' });
    }
    doc.page.margins.bottom = oldBottom;

    doc.end();
    logger.info('Sales PDF complete.');
  } catch (err) {
    logger.error('Sales PDF error: %o', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// BRAND REPORT PDF
// ─────────────────────────────────────────────────────────────
const downloadBrandReportPdf = async (req, res) => {
  try {
    const { dateStart, dateEnd } = req.query;
    if (!dateStart || !dateEnd) {
      return res.status(400).json({ error: 'dateStart and dateEnd are required' });
    }

    const dateStartObj = new Date(dateStart);
    const dateEndObj   = new Date(dateEnd);
    dateEndObj.setHours(23, 59, 59, 999);
    const dateStr = `${dateStart}  →  ${dateEnd}`;

    logger.info('Generating Brand PDF report %s → %s', dateStart, dateEnd);

    // Aggregation
    const { searchCode } = req.query;
    const whereClause = { orderDate: { $gte: dateStartObj, $lte: dateEndObj }, saleOrderStatus: { $ne: 'CANCELLED' } };
    if (searchCode) {
      whereClause.itemSKUCode = new RegExp(`^${searchCode}`, 'i');
    }

    const pipeline = [
      { $match: whereClause },
      { $group: {
          _id: { brand: { $cond: { if: { $or: [{ $eq: ['$itemTypeBrand', ''] }, { $eq: [{ $ifNull: ['$itemTypeBrand', null] }, null] }] }, then: 'Unknown', else: '$itemTypeBrand' } }, baseSku: { $arrayElemAt: [{ $split: ['$itemSKUCode', '_'] }, 0] }, size: { $cond: { if: { $or: [{ $eq: ['$itemTypeSize', ''] }, { $eq: [{ $ifNull: ['$itemTypeSize', null] }, null] }] }, then: 'N/A', else: '$itemTypeSize' } } },
          quantity: { $sum: { $ifNull: ['$saleCount', 1] } },
          sellableAmount: { $sum: { $multiply: [{ $ifNull: ['$saleCount', 1] }, { $convert: { input: '$totalPrice', to: 'double', onError: 0, onNull: 0 } }] } }
      }},
      { $group: {
          _id: { brand: '$_id.brand', baseSku: '$_id.baseSku' },
          variations: { $push: { size: '$_id.size', quantity: '$quantity', sellableAmount: '$sellableAmount' } },
          skuQty: { $sum: '$quantity' },
          skuAmt: { $sum: '$sellableAmount' }
      }},
      { $group: {
          _id: '$_id.brand',
          products: { $push: { sku: '$_id.baseSku', qty: '$skuQty', amt: '$skuAmt', variations: '$variations' } },
          brandQty: { $sum: '$skuQty' },
          brandAmt: { $sum: '$skuAmt' }
      }}
    ];

    const brands = await db.SaleOrder.aggregate(pipeline);

    // Fetch images
    const allBaseSkus = brands.flatMap(b => b.products.map(p => p.sku)).filter(Boolean);
    const productDocs = await db.InventoryProduct.find({ imageUrl: { $nin: [null, ''] } }).lean();
    const skuImageMap = {};
    productDocs.forEach(p => {
      const base = (p.skuCode || '').split('_')[0];
      if (base && !skuImageMap[base] && p.imageUrl) skuImageMap[base] = p.imageUrl;
    });
    const productDocs2 = await db.Product.find({ skuCode: { $in: allBaseSkus }, imageUrl: { $nin: [null, ''] } }).lean();
    productDocs2.forEach(p => { if (p.skuCode && p.imageUrl && !skuImageMap[p.skuCode]) skuImageMap[p.skuCode] = p.imageUrl; });

    const uniqueUrls = [...new Set(Object.values(skuImageMap).filter(Boolean))];
    const imageCache = {};
    const CHUNK = 8;
    for (let i = 0; i < uniqueUrls.length; i += CHUNK) {
      await Promise.all(uniqueUrls.slice(i, i + CHUNK).map(async url => {
        imageCache[url] = await fetchImageBuffer(url);
      }));
    }

    const totalQty = brands.reduce((s, b) => s + b.brandQty, 0);
    const totalAmt = brands.reduce((s, b) => s + b.brandAmt, 0);

    const doc = new PDFDocument({ margin: MARGIN, size: 'A4', bufferPages: true,
      info: { Title: `Elite Edition Brand Report ${dateStart}`, Author: 'Elite Edition ERP' }
    });

    doc.on('pageAdded', () => drawPunchGuide(doc));
    drawPunchGuide(doc);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Brand_Report_${dateStart}.pdf"`);
    doc.pipe(res);

    let pageNum = 1;
    drawHeader(doc, 'Brand Report', dateStr, pageNum);

    let y = 65;
    y = drawSummaryCards(doc, y, [
      { label: 'Total Brands', value: fmtN(brands.length) },
      { label: 'Total SKUs',   value: fmtN(allBaseSkus.length) },
      { label: 'Total Orders', value: fmtN(totalQty) },
      { label: 'Total Revenue',value: fmt(totalAmt) },
    ]);

    // Brand‑by‑brand tables
    const SIMPLE_COLS = [
      { label: 'Photo',       w: 52  },
      { label: 'SKU',         w: 110 },
      { label: 'Sizes & Qty', w: 90 },
      { label: 'Orders',      w: 55  },
      { label: 'Revenue',     w: 78  },
      { label: 'Avg',         w: 78  },
    ];
    
    const sizeOrder = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];

    // Sort brands by quantity descending
    brands.sort((a, b) => b.brandQty - a.brandQty);

    for (const brand of brands) {
      const brandH = 28;
      if (y + brandH + 60 > PAGE_H - MARGIN - 28) {
        doc.addPage();
        pageNum++;
        drawHeader(doc, 'Brand Report (continued)', dateStr, pageNum);
        y = 65;
      }

      // Brand section banner
      doc.rect(MARGIN, y, CW, brandH).fill(C.sectionBg);
      doc.rect(MARGIN, y, 4, brandH).fill(C.accentBlue);
      doc.fillColor(C.sectionText).font('Helvetica-Bold').fontSize(11)
         .text(brand._id || 'Unknown', MARGIN + 10, y + 8);
      // Brand totals on right
      doc.fillColor(C.subText).font('Helvetica').fontSize(8)
         .text(`Orders: ${fmtN(brand.brandQty)}   Revenue: ${fmt(brand.brandAmt)}`, MARGIN, y + 10, { width: CW - 8, align: 'right' });
      y += brandH + 4;

      // Table header for brand
      y = drawTableHeader(doc, y, SIMPLE_COLS);

      // Sort products by quantity descending
      brand.products.sort((a, b) => b.qty - a.qty);

      let alt = false;
      for (const prod of brand.products) {
        const imgUrl = skuImageMap[prod.sku];
        const imgBuf = imgUrl ? imageCache[imgUrl] : null;
        
        const sortedVariations = (prod.variations || []).sort((a, b) => {
          let sa = (a.size || '').toUpperCase().trim().replace('XXL', '2XL').replace('XXXL', '3XL');
          let sb = (b.size || '').toUpperCase().trim().replace('XXL', '2XL').replace('XXXL', '3XL');
          let ia = sizeOrder.indexOf(sa);
          let ib = sizeOrder.indexOf(sb);
          if (ia === -1 && ib === -1) return (a.size || '').localeCompare(b.size || '');
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        });
        
        const sizesText = sortedVariations.map(v => `${(v.size || '').toUpperCase()}: ${v.quantity}`).join('\n');
        const numLines = Math.max(1, sortedVariations.length);
        const rowH = Math.max(50, numLines * 10 + 20);

        if (y + rowH > PAGE_H - MARGIN - 28) {
          doc.addPage();
          pageNum++;
          drawHeader(doc, 'Brand Report (continued)', dateStr, pageNum);
          y = 65;
          doc.fillColor(C.subText).font('Helvetica-Oblique').fontSize(8)
             .text(`Brand: ${brand._id} (continued)`, MARGIN, y);
          y += 12;
          y = drawTableHeader(doc, y, SIMPLE_COLS);
          alt = false;
        }

        doc.rect(MARGIN, y, CW, rowH).fill(alt ? C.rowAlt : C.rowNormal);
        doc.moveTo(MARGIN, y + rowH).lineTo(MARGIN + CW, y + rowH).strokeColor(C.border).lineWidth(0.4).stroke();
        drawDividers(doc, MARGIN, y, rowH, SIMPLE_COLS);

        const mid = y + rowH / 2;
        let x = MARGIN;

        // Photo
        const imgSize = Math.min(rowH - 10, 40);
        const ix = x + (SIMPLE_COLS[0].w - imgSize) / 2;
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
          doc.fillColor(C.subText).font('Helvetica').fontSize(5).text('No Photo', ix, iy + imgSize / 2 - 3, { width: imgSize, align: 'center' });
        }
        x += SIMPLE_COLS[0].w;

        // SKU
        doc.fillColor(C.tableText).font('Helvetica-Bold').fontSize(9)
           .text(prod.sku || '-', x + 3, mid - 5, { width: SIMPLE_COLS[1].w - 6, align: 'center', lineBreak: false, ellipsis: true });
        x += SIMPLE_COLS[1].w;

        // Sizes
        doc.fillColor(C.text).font('Helvetica').fontSize(8);
        const sizesHeight = doc.heightOfString(sizesText, { width: SIMPLE_COLS[2].w - 8, align: 'center' });
        const sizesY = y + (rowH - sizesHeight) / 2;
        doc.text(sizesText, x + 4, sizesY, { width: SIMPLE_COLS[2].w - 8, align: 'center', lineBreak: true });
        x += SIMPLE_COLS[2].w;

        // Total
        doc.fillColor(C.text).font('Helvetica-Bold').fontSize(10)
           .text(fmtN(prod.qty), x + 2, mid - 7, { width: SIMPLE_COLS[3].w - 4, align: 'center' });
        x += SIMPLE_COLS[3].w;

        // Revenue
        doc.fillColor(C.accentBlue).font('Helvetica-Bold').fontSize(8)
           .text(fmt(prod.amt), x + 2, mid - 5, { width: SIMPLE_COLS[4].w - 4, align: 'center' });
        x += SIMPLE_COLS[4].w;

        // Avg
        const avgAmt = prod.qty > 0 ? prod.amt / prod.qty : 0;
        doc.fillColor(C.subText).font('Helvetica').fontSize(8)
           .text(fmt(avgAmt), x + 2, mid - 5, { width: SIMPLE_COLS[5].w - 4, align: 'center' });

        y += rowH;
        alt = !alt;
      }
      y += 12; // gap between brands
    }

    // Footer
    const pages = doc.bufferedPageRange();
    const oldBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    for (let p = 0; p < pages.count; p++) {
      doc.switchToPage(pages.start + p);
      doc.rect(0, PAGE_H - 26, PAGE_W, 26).fill(C.headerBg);
      doc.fillColor(C.headerText).font('Helvetica-Bold').fontSize(7.5)
         .text(`Elite Edition ERP  •  Generated: ${new Date().toLocaleString('en-IN')}  •  Page ${p + 1} of ${pages.count}`,
           MARGIN, PAGE_H - 17, { width: CW, align: 'center' });
    }
    doc.page.margins.bottom = oldBottom;

    doc.end();
    logger.info('Brand PDF complete.');
  } catch (err) {
    logger.error('Brand PDF error: %o', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};

module.exports = { downloadSalesReportPdf, downloadBrandReportPdf };
