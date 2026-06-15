const httpStatus = require('http-status').default;
const db = require('../db/models');
const logger = require('../config/logger');

const processReturn = async (req, res) => {
  try {
    const { party, returnType, referenceId, sku, quantity, condition, notes } = req.body;

    if (!party || !returnType || !referenceId || !sku || !quantity || !condition) {
      return res.status(httpStatus.BAD_REQUEST).send('Missing required fields');
    }

    if ((condition === 'WRONG_ITEM' || condition === 'DAMAGED') && (!notes || notes.trim() === '')) {
      return res.status(httpStatus.BAD_REQUEST).send('Notes are mandatory for Damaged or Wrong Item conditions');
    }

    let status = 'STOCKED_IN';
    if (condition === 'NEEDS_REFINISHING') {
      status = 'PENDING_REFINISH';
    } else if (condition === 'WRONG_ITEM' || condition === 'DAMAGED') {
      status = 'DISPUTED';
    }

    // 1. Create the history record
    const returnRecord = await db.ReturnRecord.create({
      party,
      returnType,
      referenceId,
      sku,
      quantity,
      condition,
      notes,
      status,
    });

    // 2. Increment stock if it is immediately STOCKED_IN (like RTO)
    // Here we find the SKU inside the variations array of the InventoryProduct.
    if (status === 'STOCKED_IN') {
      await db.InventoryProduct.updateOne(
        { "variations.sku": sku },
        { $inc: { "variations.$.quantity": quantity } }
      );
    }

    res.status(httpStatus.CREATED).send({
      message: status === 'STOCKED_IN' ? 'Return processed and stock updated' : `Return processed and marked as ${status}`,
      record: returnRecord,
    });
  } catch (error) {
    logger.error('Error processing return: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error processing return');
  }
};

const getReturns = async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    
    const returns = await db.ReturnRecord.find(query).sort({ createdAt: -1 });
    res.status(httpStatus.OK).send(returns);
  } catch (error) {
    logger.error('Error fetching returns: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error fetching returns');
  }
};

const markRefinished = async (req, res) => {
  try {
    const { id } = req.params;
    
    const record = await db.ReturnRecord.findById(id);
    if (!record) {
      return res.status(httpStatus.NOT_FOUND).send('Return record not found');
    }

    if (record.status !== 'PENDING_REFINISH') {
      return res.status(httpStatus.BAD_REQUEST).send('Item is not pending refinishing');
    }

    record.status = 'STOCKED_IN';
    await record.save();

    // Increment inventory since it's now repacked and fresh
    await db.InventoryProduct.updateOne(
      { "variations.sku": record.sku },
      { $inc: { "variations.$.quantity": record.quantity } }
    );

    res.status(httpStatus.OK).send({
      message: 'Item refinished and stocked in successfully',
      record,
    });
  } catch (error) {
    logger.error('Error marking return refinished: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error marking return refinished');
  }
};

module.exports = {
  processReturn,
  getReturns,
  markRefinished,
};
