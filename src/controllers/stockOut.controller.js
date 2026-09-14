const db = require('../db/models');
const logger = require('../config/logger');

const createStockOut = async (req, res) => {
  try {
    const itemsToProcess = Array.isArray(req.body) ? req.body : (req.body.items || [req.body]);
    const results = [];

    for (const item of itemsToProcess) {
      const { skuCode, party, qtyOut } = item;
      if (!skuCode || !party) continue;

      const qty = parseInt(qtyOut, 10) || 1;
      const cleanSku = (skuCode || '').trim();
      
      let inventoryItem = await db.Inventory.findOne({
        skuCode: { $regex: new RegExp(`^${cleanSku}$`, 'i') }
      });

      if (!inventoryItem) {
        const matchedProd = await db.Product.findOne({
          $or: [
            { 'brandCodes': cleanSku },
            { 'brandCodes.code': cleanSku }
          ]
        }).lean() || await db.InventoryProduct.findOne({
          $or: [
            { 'brandCodes': cleanSku },
            { 'brandCodes.code': cleanSku }
          ]
        }).lean();

        if (matchedProd && matchedProd.skuCode) {
          const masterSku = matchedProd.skuCode.trim();
          inventoryItem = await db.Inventory.findOne({
            skuCode: { $regex: new RegExp(`^${masterSku}$`, 'i') }
          });
        }
      }

      if (!inventoryItem) {
        inventoryItem = await db.Inventory.findOne({
          $or: [
            { 'brandCodes': cleanSku },
            { 'brandCodes.code': cleanSku }
          ]
        });
      }
      
      if (!inventoryItem) continue;

      if (inventoryItem.currentlyAvailableStock >= qty) {
        inventoryItem.currentlyAvailableStock -= qty;
        await inventoryItem.save();

        const stockOutLog = await db.StockOut.create({
          skuCode: inventoryItem.skuCode,
          party,
          qtyOut: qty,
        });
        results.push(stockOutLog);
      }
    }

    if (results.length === 0) {
      return res.status(400).json({ error: 'Failed to process outward. Check SKU availability and party.' });
    }

    res.status(201).json(Array.isArray(req.body) ? results : results[0]);
  } catch (error) {
    logger.error('Error creating stock out: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const getStockOuts = async (req, res) => {
  try {
    const stockOuts = await db.StockOut.find()
      .sort({ created_date_time: -1 })
      .lean();

    res.json(stockOuts.map(s => ({ ...s, id: s._id.toString() })));
  } catch (error) {
    logger.error('Error fetching stock outs: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

module.exports = {
  createStockOut,
  getStockOuts,
};
