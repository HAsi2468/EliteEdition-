const db = require('../db/models');
const logger = require('../config/logger');
const PDFDocument = require('pdfkit');
const axios = require('axios');

const fetchImageBuffer = async (imageUrl) => {
  if (!imageUrl) return null;
  try {
    let url = imageUrl;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `http://3.7.174.180:3001${url}`;
    }
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (error) {
    logger.error('Error fetching image for PDF: %s', error.message);
    return null;
  }
};

const buildReportData = async (dateStart, dateEnd) => {
  const start = new Date(dateStart);
  const end = new Date(dateEnd);
  // ensure end covers the entire day if it's just a date
  end.setHours(23, 59, 59, 999);

  // 1. Current Stock (All inventory items)
  const currentStockRaw = await db.Inventory.find().lean();
  
  // 2. Stock In (Inventory items created within date range)
  const stockInRaw = await db.Inventory.find({
    created_date_time: { $gte: start, $lte: end }
  }).lean();

  // 3. Stock Out (StockOut items within date range)
  const stockOutLogs = await db.StockOut.find({
    created_date_time: { $gte: start, $lte: end }
  }).lean();

  // For Stock Out, we need to join with Inventory to get prices and image
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

  // Helper function to group items for the report format
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
          party: item.party || '-',
          sizes: [],
          total: 0,
          totalPurchaseAmount: 0,
          totalSellableAmount: 0
        };
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

  // Correcting Stock In grouping
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
          party: item.party || '-',
          sizes: [],
          total: 0,
          totalPurchaseAmount: 0,
          totalSellableAmount: 0
        };
      }

      const qty = item.qty || item.currentlyAvailableStock; // Use qty for Stock In
      
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

  return {
    reportDate: { start: dateStart, end: dateEnd },
    currentStock,
    stockIn,
    stockOut
  };
};

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

const downloadInventoryReportPdf = async (req, res) => {
  try {
    const { dateStart, dateEnd } = req.query;
    
    if (!dateStart || !dateEnd) {
      return res.status(400).json({ error: 'dateStart and dateEnd are required' });
    }

    const reportData = await buildReportData(dateStart, dateEnd);

    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Inventory_Report_${dateStart}.pdf"`);

    doc.pipe(res);

    // Title / Branding
    doc.fillColor('#1B365D').font('Helvetica-Bold').fontSize(20).text('Elite Edition - Inventory Report', { align: 'center' });
    doc.moveDown(0.5);

    // Date range
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(10).text(`Report Date: `, { continued: true })
       .font('Helvetica').text(`${dateStart} To ${dateEnd}`);
    doc.moveDown(1.5);

    const renderSectionTable = async (title, sectionData) => {
      doc.fillColor('#1B365D').font('Helvetica-Bold').fontSize(14).text(title);
      doc.moveDown(0.3);

      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(10)
         .text(`Total Order Quantity: `, { continued: true }).font('Helvetica').text(sectionData.totalOrderQuantity.toString(), { continued: true })
         .font('Helvetica-Bold').text(`   Total Sellable Amount: `, { continued: true }).font('Helvetica').text(sectionData.totalSellableAmount.toFixed(2));
      doc.moveDown(0.8);

      const items = sectionData.items || [];
      if (items.length === 0) {
        doc.font('Helvetica-Oblique').fontSize(10).text('No data available for this section.');
        doc.moveDown(1.5);
        return;
      }

      // Draw table headers
      const startX = 30;
      let y = doc.y;
      
      const colWidths = [45, 120, 80, 80, 45, 50, 50, 60]; // total = 530
      const headers = ['Image', 'SKU', 'Vendor', 'Sizes', 'Total', 'Purchase', 'Sellable', 'Profit'];

      doc.rect(startX, y, 535, 20).fill('#E5E7EB');
      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(9);

      let currentX = startX;
      headers.forEach((h, idx) => {
        doc.text(h, currentX, y + 5, { width: colWidths[idx], align: 'center' });
        currentX += colWidths[idx];
      });

      y += 20;

      // Draw rows
      for (const item of items) {
        const rowHeight = Math.max(40, (item.sizes || []).length * 15 + 10);
        
        // Page break check
        if (y + rowHeight > 785) {
          doc.addPage();
          y = 40;
          
          // Redraw headers
          doc.rect(startX, y, 535, 20).fill('#E5E7EB');
          doc.fillColor('#000000').font('Helvetica-Bold').fontSize(9);
          currentX = startX;
          headers.forEach((h, idx) => {
            doc.text(h, currentX, y + 5, { width: colWidths[idx], align: 'center' });
            currentX += colWidths[idx];
          });
          y += 20;
        }

        // Draw row borders
        doc.rect(startX, y, 535, rowHeight).strokeColor('#D1D5DB').lineWidth(0.5).stroke();

        // Image
        if (item.imageUrl) {
          const buffer = await fetchImageBuffer(item.imageUrl);
          if (buffer) {
            try {
              doc.image(buffer, startX + 5, y + 5, { width: 35, height: 30 });
            } catch (e) {
              doc.font('Helvetica').fontSize(7).text('Error', startX, y + 15, { width: colWidths[0], align: 'center' });
            }
          } else {
            doc.font('Helvetica').fontSize(7).text('N/A', startX, y + 15, { width: colWidths[0], align: 'center' });
          }
        } else {
          doc.font('Helvetica').fontSize(7).text('No Image', startX, y + 15, { width: colWidths[0], align: 'center' });
        }

        // Text details
        doc.fillColor('#000000').font('Helvetica').fontSize(8);
        doc.text(item.sku || '-', startX + colWidths[0], y + 15, { width: colWidths[1], align: 'center' });
        doc.text(item.party || '-', startX + colWidths[0] + colWidths[1], y + 15, { width: colWidths[2], align: 'center' });

        // Sizes Column
        let sizeY = y + 5;
        (item.sizes || []).forEach(s => {
          doc.text(`${s.size} - ${s.qty}`, startX + colWidths[0] + colWidths[1] + colWidths[2], sizeY, { width: colWidths[3], align: 'center' });
          sizeY += 12;
        });

        // Totals & Prices
        const offset = colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];
        doc.text(item.total.toString(), startX + offset, y + 15, { width: colWidths[4], align: 'center' });
        doc.text(item.totalPurchaseAmount.toFixed(2), startX + offset + colWidths[4], y + 15, { width: colWidths[5], align: 'center' });
        doc.text(item.totalSellableAmount.toFixed(2), startX + offset + colWidths[4] + colWidths[5], y + 15, { width: colWidths[6], align: 'center' });
        
        const profit = item.totalSellableAmount - item.totalPurchaseAmount;
        doc.text(profit.toFixed(2), startX + offset + colWidths[4] + colWidths[5] + colWidths[6], y + 15, { width: colWidths[7], align: 'center' });

        y += rowHeight;
      }

      doc.y = y;
      doc.moveDown(1.5);
    };

    await renderSectionTable('Current stock', reportData.currentStock);
    await renderSectionTable('Stock in', reportData.stockIn);
    await renderSectionTable('Stock out', reportData.stockOut);

    doc.end();
  } catch (error) {
    logger.error('Error generating backend PDF: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

module.exports = {
  getInventoryReport,
  downloadInventoryReportPdf
};
