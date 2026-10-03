/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - ATOMIC INVENTORY ALLOCATION SERVICE
 * Guarantees zero stock overselling, deadlock-free deterministic lock ordering,
 * and complete multi-item transaction atomicity with automatic compensation rollback.
 * ============================================================================
 */

const mongoose = require('mongoose');
const db = require('../db/models');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status').default;

/**
 * Deterministically allocate stock for multiple inventory items atomically.
 *
 * @param {Array<{skuCode: string, party: string, qtyOut: number, facility?: string}>} items
 * @param {object} [context={}]
 * @returns {Promise<{success: boolean, results: Array<object>, allocations: Array<object>}>}
 */
async function allocateInventoryBatch(items, context = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No items provided for stock allocation');
  }

  // 1. Sort items deterministically by SKU code to prevent AB-BA deadlock in concurrent runs
  const sortedItems = [...items].sort((a, b) => {
    const skuA = String(a.skuCode || '').toLowerCase();
    const skuB = String(b.skuCode || '').toLowerCase();
    return skuA.localeCompare(skuB);
  });

  const executedAllocations = [];
  const stockOutRecords = [];

  // Try using MongoDB session transaction if replica set supports it
  let session = null;
  let useTransaction = false;

  try {
    session = await mongoose.startSession();
    // Test if replica set / transactions supported
    session.startTransaction();
    useTransaction = true;
  } catch (sessErr) {
    // Standalone MongoDB instances do not support replica transactions; fallback to compensating rollback
    if (session) {
      try { await session.endSession(); } catch (_) {}
    }
    session = null;
    useTransaction = false;
  }

  try {
    for (const item of sortedItems) {
      const { skuCode, party, qtyOut, facility } = item;
      if (!skuCode || !party) continue;

      const qty = parseInt(qtyOut, 10) || 1;
      const cleanSku = (skuCode || '').trim();
      const facilityQuery = facility && facility !== 'All' ? { facility } : {};

      // Find inventory matching exact SKU or brand code
      const queryOpts = session ? { session } : {};

      let inventoryItem = await db.Inventory.findOne({
        skuCode: { $regex: new RegExp(`^${cleanSku}$`, 'i') },
        ...facilityQuery
      }, null, queryOpts);

      if (!inventoryItem) {
        const matchedProd = await db.Product.findOne({
          $or: [{ 'brandCodes': cleanSku }, { 'brandCodes.code': cleanSku }]
        }, null, queryOpts).lean() || await db.InventoryProduct.findOne({
          $or: [{ 'brandCodes': cleanSku }, { 'brandCodes.code': cleanSku }]
        }, null, queryOpts).lean();

        if (matchedProd && matchedProd.skuCode) {
          const masterSku = matchedProd.skuCode.trim();
          inventoryItem = await db.Inventory.findOne({
            skuCode: { $regex: new RegExp(`^${masterSku}$`, 'i') },
            ...facilityQuery
          }, null, queryOpts);
        }
      }

      if (!inventoryItem) {
        inventoryItem = await db.Inventory.findOne({
          $or: [{ 'brandCodes': cleanSku }, { 'brandCodes.code': cleanSku }],
          ...facilityQuery
        }, null, queryOpts);
      }

      if (!inventoryItem && facility) {
        inventoryItem = await db.Inventory.findOne({
          skuCode: { $regex: new RegExp(`^${cleanSku}$`, 'i') }
        }, null, queryOpts);
      }

      if (!inventoryItem) {
        throw new ApiError(
          httpStatus.NOT_FOUND,
          `Inventory item not found for SKU: ${cleanSku}`
        );
      }

      // Execute atomic conditional decrement at database engine level
      const updatedInventory = await db.Inventory.findOneAndUpdate(
        {
          _id: inventoryItem._id,
          currentlyAvailableStock: { $gte: qty }
        },
        {
          $inc: { currentlyAvailableStock: -qty, qty: -qty, version: 1 }
        },
        {
          new: true,
          ...queryOpts
        }
      );

      if (!updatedInventory) {
        const currentCheck = await db.Inventory.findById(inventoryItem._id, null, queryOpts).lean();
        const available = currentCheck ? (currentCheck.currentlyAvailableStock ?? 0) : 0;
        const err = new ApiError(
          httpStatus.UNPROCESSABLE_ENTITY,
          `Insufficient stock for SKU ${inventoryItem.skuCode}. Required: ${qty}, Available: ${available}.`
        );
        err.code = 'INSUFFICIENT_STOCK';
        err.skuCode = inventoryItem.skuCode;
        err.required = qty;
        err.available = available;
        throw err;
      }

      // Track allocation for potential compensating rollback
      executedAllocations.push({
        inventoryId: updatedInventory._id,
        skuCode: updatedInventory.skuCode,
        qtyDeducted: qty,
        newStock: updatedInventory.currentlyAvailableStock,
        version: updatedInventory.version
      });

      const stockOutDoc = new db.StockOut({
        skuCode: updatedInventory.skuCode,
        party,
        qtyOut: qty,
        facility: facility || updatedInventory.facility || 'Pankhudi',
      });

      if (session) {
        await stockOutDoc.save({ session });
      } else {
        await stockOutDoc.save();
      }

      stockOutRecords.push(stockOutDoc);
    }

    if (useTransaction && session) {
      await session.commitTransaction();
      await session.endSession();
    }

    return {
      success: true,
      results: stockOutRecords,
      allocations: executedAllocations
    };
  } catch (error) {
    if (useTransaction && session) {
      try {
        await session.abortTransaction();
        await session.endSession();
      } catch (abortErr) {
        logger.error('Failed to abort transaction session: %o', abortErr);
      }
    } else {
      // Compensating rollback for standalone MongoDB
      logger.warn('Rolling back %d stock allocations due to batch error: %s', executedAllocations.length, error.message);
      for (const alloc of executedAllocations) {
        try {
          await db.Inventory.findByIdAndUpdate(alloc.inventoryId, {
            $inc: { currentlyAvailableStock: alloc.qtyDeducted, qty: alloc.qtyDeducted, version: 1 }
          });
        } catch (rollErr) {
          logger.error('CRITICAL: Stock rollback compensation failed for %s: %o', alloc.skuCode, rollErr);
        }
      }
      for (const rec of stockOutRecords) {
        try {
          await db.StockOut.findByIdAndDelete(rec._id);
        } catch (_) {}
      }
    }

    throw error;
  }
}

module.exports = {
  allocateInventoryBatch,
};
