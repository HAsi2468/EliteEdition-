const db = require('../db/models');
const logger = require('../config/logger');
const { emitSocketEvent } = require('../utils/socketEmitHelper');

const createStockOut = async (req, res) => {
  try {
    const itemsToProcess = Array.isArray(req.body) ? req.body : (req.body.items || [req.body]);
    const results = [];

    for (const item of itemsToProcess) {
      const { skuCode, party, qtyOut, facility } = item;
      if (!skuCode || !party) continue;

      const qty = parseInt(qtyOut, 10) || 1;
      const cleanSku = (skuCode || '').trim();
      const facilityQuery = facility && facility !== 'All' ? { facility } : {};
      
      let inventoryItem = await db.Inventory.findOne({
        skuCode: { $regex: new RegExp(`^${cleanSku}$`, 'i') },
        ...facilityQuery
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
            skuCode: { $regex: new RegExp(`^${masterSku}$`, 'i') },
            ...facilityQuery
          });
        }
      }

      if (!inventoryItem) {
        inventoryItem = await db.Inventory.findOne({
          $or: [
            { 'brandCodes': cleanSku },
            { 'brandCodes.code': cleanSku }
          ],
          ...facilityQuery
        });
      }

      // Fallback without facility if not found in specific facility
      if (!inventoryItem && facility) {
        inventoryItem = await db.Inventory.findOne({
          skuCode: { $regex: new RegExp(`^${cleanSku}$`, 'i') }
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
          facility: facility || inventoryItem.facility || 'Pankhudi',
        });
        results.push(stockOutLog);
      }
    }

    if (results.length === 0) {
      return res.status(400).json({ error: 'Failed to process outward. Check SKU availability and party.' });
    }

    emitSocketEvent(req, 'inventory-updated', { type: 'stock-out', count: results.length });
    emitSocketEvent(req, 'stock-out-created', results);

    res.status(201).json(Array.isArray(req.body) ? results : results[0]);
  } catch (error) {
    logger.error('Error creating stock out: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const getStockOuts = async (req, res) => {
  try {
    const { facility } = req.query;
    const query = {};
    if (facility && facility !== 'All') {
      query.facility = facility;
    }

    const stockOuts = await db.StockOut.find(query)
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
