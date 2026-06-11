const db = require('../db/models');
const logger = require('../config/logger');

const getInventoryReport = async (req, res) => {
  try {
    const { dateStart, dateEnd } = req.query;
    
    if (!dateStart || !dateEnd) {
      return res.status(400).json({ error: 'dateStart and dateEnd are required' });
    }

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
    // Since Inventory items could be deleted, we try to match by skuCode and party
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
        // Group by itemName or base sku (we'll just use itemName/skuCode logic)
        // If skuCode has an underscore (e.g. 265_XL), the base sku is the first part
        const baseSku = item.skuCode ? item.skuCode.split('_')[0] : item.itemName;
        
        if (!grouped[baseSku]) {
          grouped[baseSku] = {
            imageUrl: item.imageUrl || '',
            sku: baseSku,
            sizes: [],
            total: 0,
            totalPurchaseAmount: 0,
            totalSellableAmount: 0
          };
        }

        const qty = isStockOut ? item.qty : item.currentlyAvailableStock;
        
        // Find if size already exists in the group
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

    const response = {
      reportDate: { start: dateStart, end: dateEnd },
      currentStock: groupItems(currentStockRaw, false),
      stockIn: groupItems(stockInRaw, false), // using currentlyAvailableStock might be wrong if they want INITIAL added stock.
      stockOut: groupItems(stockOutRaw, true)
    };

    // Correcting Stock In to use `item.qty` instead of `currentlyAvailableStock` if `qty` represents the incoming quantity
    response.stockIn = (() => {
      const grouped = {};
      let totalOrderQuantity = 0;
      let totalSellableAmount = 0;

      stockInRaw.forEach(item => {
        const baseSku = item.skuCode ? item.skuCode.split('_')[0] : item.itemName;
        if (!grouped[baseSku]) {
          grouped[baseSku] = {
            imageUrl: item.imageUrl || '',
            sku: baseSku,
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


    res.json(response);
  } catch (error) {
    logger.error('Error generating inventory report: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

module.exports = {
  getInventoryReport,
};
