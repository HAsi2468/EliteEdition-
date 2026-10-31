/**
 * Atomic Stock Decrement & Non-Negative Balance Guard (BUG-037, BUG-022, BUG-053)
 * Enforces atomic check-and-set updates in MongoDB:
 * - findOneAndUpdate({ companyId, itemId, qtyMilli: { $gte: qtyMilli } }, { $inc: { qtyMilli: -qtyMilli } })
 * - Inward strictly requires positive qty and valid master SKU (no free-text or sign flips)
 */
const { AppError } = require('./errors');

async function decrementStock(StockModel, companyId, itemId, qtyMilli, session = null) {
  if (!Number.isSafeInteger(qtyMilli) || qtyMilli <= 0) {
    throw new AppError(422, 'QTY_RANGE', 'Quantity must be greater than 0.', { qty: 'Must be > 0.' });
  }

  const query = {
    companyId: String(companyId),
    itemId: itemId,
    qtyMilli: { $gte: qtyMilli }
  };
  const update = {
    $inc: { qtyMilli: -qtyMilli, __v: 1 }
  };
  const options = { new: true };
  if (session) options.session = session;

  const updated = await StockModel.findOneAndUpdate(query, update, options).lean();
  if (!updated) {
    const cur = await StockModel.findOne({ companyId: String(companyId), itemId }, { qtyMilli: 1 }, session ? { session } : {}).lean();
    const available = ((cur?.qtyMilli ?? 0) / 1000).toFixed(3);
    throw new AppError(409, 'INSUFFICIENT_STOCK', `Only ${available} available.`, { qty: 'Exceeds available stock.' });
  }

  return updated;
}

async function incrementStock(StockModel, companyId, itemId, qtyMilli, session = null) {
  if (!Number.isSafeInteger(qtyMilli) || qtyMilli <= 0) {
    throw new AppError(422, 'QTY_RANGE', 'Quantity must be greater than 0.', { qty: 'Must be > 0.' });
  }

  const options = { new: true };
  if (session) options.session = session;

  const updated = await StockModel.findOneAndUpdate(
    { companyId: String(companyId), itemId },
    { $inc: { qtyMilli, __v: 1 } },
    options
  ).lean();

  if (!updated) {
    throw new AppError(422, 'UNKNOWN_SKU', 'SKU not found in item master.', { sku: 'Pick an SKU from the list.' });
  }

  return updated;
}

async function withStockTransaction(connection, work) {
  const session = await connection.startSession();
  try {
    let out;
    await session.withTransaction(async () => {
      out = await work(session);
    }, {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    });
    return out;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  decrementStock,
  incrementStock,
  withStockTransaction
};
