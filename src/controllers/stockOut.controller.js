const db = require('../db/models');
const logger = require('../config/logger');
const { emitSocketEvent } = require('../utils/socketEmitHelper');
const { allocateInventoryBatch } = require('../services/inventoryAllocation.service');

const createStockOut = async (req, res) => {
  try {
    const rawItems = Array.isArray(req.body) ? req.body : (req.body.items || [req.body]);
    const itemsToProcess = rawItems.filter(item => item && item.skuCode && item.party);

    if (itemsToProcess.length === 0) {
      return res.status(400).json({ error: 'Failed to process outward. Check SKU availability and party.' });
    }

    const { results, allocations } = await allocateInventoryBatch(itemsToProcess, { req });

    for (const alloc of allocations) {
      emitSocketEvent(req, 'inventory-stock-updated', {
        inventoryId: alloc.inventoryId,
        skuCode: alloc.skuCode,
        currentlyAvailableStock: alloc.newStock,
        version: alloc.version
      });
    }

    emitSocketEvent(req, 'inventory-updated', { type: 'stock-out', count: results.length });
    emitSocketEvent(req, 'stock-out-created', results);

    res.status(201).json(Array.isArray(req.body) ? results : results[0]);
  } catch (error) {
    if (error.statusCode === 422 || error.code === 'INSUFFICIENT_STOCK') {
      return res.status(422).json({
        success: false,
        code: 'INSUFFICIENT_STOCK',
        message: error.message,
        skuCode: error.skuCode,
        required: error.required,
        available: error.available
      });
    }
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, error: error.message });
    }
    logger.error('Error creating stock out: %o', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Internal Server Error' });
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
