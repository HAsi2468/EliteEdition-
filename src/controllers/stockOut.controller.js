const db = require('../db/models');
const logger = require('../config/logger');

const createStockOut = async (req, res) => {
  try {
    const { skuCode, party, qtyOut } = req.body;
    
    if (!skuCode || !party) {
      return res.status(400).json({ error: 'skuCode and party are required' });
    }

    const qty = qtyOut || 1;

    // Find inventory item by SKU
    const inventoryItem = await db.Inventory.findOne({ skuCode });
    if (!inventoryItem) {
      return res.status(404).json({ error: 'Item with this SKU not found in inventory' });
    }

    // Decrement stock
    if (inventoryItem.currentlyAvailableStock < qty) {
      return res.status(400).json({ error: 'Not enough stock available' });
    }

    inventoryItem.currentlyAvailableStock -= qty;
    await inventoryItem.save();

    // Log stock out
    const stockOutLog = await db.StockOut.create({
      skuCode,
      party,
      qtyOut: qty,
    });

    res.status(201).json(stockOutLog);
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
