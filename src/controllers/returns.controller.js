const httpStatus = require('http-status').default;
const db = require('../db/models');
const logger = require('../config/logger');

const lookupUniwareOrder = async (req, res) => {
  try {
    const code = req.body.code || req.query.code || req.body.referenceId;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Reference ID or AWB code is required' });
    }

    const cleanCode = String(code).trim();

    // 1. Search in local SaleOrder collection by displayOrderCode, saleOrderCode, saleOrderItemCode, reversePickupCode, shippingPackageCode
    let foundOrder = await db.SaleOrder.findOne({
      $or: [
        { displayOrderCode: new RegExp(`^${cleanCode}$`, 'i') },
        { saleOrderCode: new RegExp(`^${cleanCode}$`, 'i') },
        { saleOrderItemCode: new RegExp(`^${cleanCode}$`, 'i') },
        { reversePickupCode: new RegExp(`^${cleanCode}$`, 'i') },
        { shippingPackageCode: new RegExp(`^${cleanCode}$`, 'i') }
      ]
    }).lean();

    if (!foundOrder) {
      // 2. Search in local SalesList collection
      foundOrder = await db.SalesList.findOne({
        $or: [
          { displayorderCode: new RegExp(`^${cleanCode}$`, 'i') },
          { saleOrderItemCode: new RegExp(`^${cleanCode}$`, 'i') },
          { saleOrderCode: new RegExp(`^${cleanCode}$`, 'i') },
          { trackingNumber: new RegExp(`^${cleanCode}$`, 'i') }
        ]
      }).lean();
    }

    let displayOrderId = foundOrder ? (foundOrder.displayOrderCode || foundOrder.displayorderCode || foundOrder.saleOrderCode) : '';
    let sku = foundOrder ? (foundOrder.itemSKUCode || foundOrder.skuCode) : '';

    // 3. If not found in local DB, query Uniware Live API using getAccessToken & getSaleOrderLive
    if (!displayOrderId || !sku) {
      try {
        const { getAccessToken, getSaleOrderLive } = require('../services/api.service');
        const token = await getAccessToken();
        if (token) {
          const uniResponse = await getSaleOrderLive(token, cleanCode);
          if (uniResponse && uniResponse.successful && uniResponse.saleOrder) {
            const order = uniResponse.saleOrder;
            if (order.displayCode || order.code) {
              displayOrderId = order.displayCode || order.code;
            }
            if (order.saleOrderItems && order.saleOrderItems.length > 0) {
              sku = order.saleOrderItems[0].itemTypeSku || order.saleOrderItems[0].sku || sku;
            }
          }
        }
      } catch (uniErr) {
        logger.warn('[lookupUniwareOrder] Uniware API lookup error: %s', uniErr.message);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        referenceId: cleanCode,
        displayOrderId: displayOrderId || cleanCode,
        sku: sku || ''
      }
    });
  } catch (error) {
    logger.error('Error looking up order from Uniware: %o', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const processReturn = async (req, res) => {
  try {
    const { returnType, referenceId, displayOrderId, sku, quantity, condition, notes, party: requestParty } = req.body;

    // Retrieve party name from request, inventory, or fallback catalog
    let party = requestParty || '';
    if (!party) {
      const inventoryRecord = await db.Inventory.findOne({ skuCode: sku });
      if (inventoryRecord) {
        party = inventoryRecord.party;
      } else {
        const catalogRecord = await db.InventoryProduct.findOne({ skuCode: sku });
        if (catalogRecord) {
          party = catalogRecord.brand || 'Uniware Channel Sync';
        } else {
          party = 'Myntra';
        }
      }
    }

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
      displayOrderId: displayOrderId || referenceId,
      sku,
      quantity,
      condition,
      notes,
      status,
    });

    // 2. Increment stock if it is immediately STOCKED_IN (like RTO)
    if (status === 'STOCKED_IN') {
      await db.InventoryProduct.updateOne(
        { skuCode: sku },
        { $inc: { qty: quantity } }
      );
      const inventoryExists = await db.Inventory.findOne({ skuCode: sku });
      if (inventoryExists) {
        await db.Inventory.updateOne(
          { skuCode: sku },
          { $inc: { qty: quantity, currentlyAvailableStock: quantity } }
        );
      }
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
      { skuCode: record.sku },
      { $inc: { qty: record.quantity } }
    );
    const inventoryExists = await db.Inventory.findOne({ skuCode: record.sku });
    if (inventoryExists) {
      await db.Inventory.updateOne(
        { skuCode: record.sku },
        { $inc: { qty: record.quantity, currentlyAvailableStock: record.quantity } }
      );
    }

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
  lookupUniwareOrder,
  processReturn,
  getReturns,
  markRefinished,
};
