const httpStatus = require('http-status');
const axios = require('axios');
const db = require('../db/models');
const logger = require('../../config/logger');

const MYNTRA_API_URL = 'https://api.pretr.com';

const generateToken = async (merchantId, secretKey) => {
  try {
    const params = new URLSearchParams();
    params.append('merchant_id', merchantId);
    params.append('secret_key', secretKey);

    const response = await axios.post(`${MYNTRA_API_URL}/authorization/generate_token`, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    return response.data.access_token;
  } catch (error) {
    logger.error('Error generating Myntra token: %o', error.response ? error.response.data : error.message);
    throw new Error('Authentication failed with Myntra');
  }
};

const saveConfig = async (req, res) => {
  const { merchantId, secretKey } = req.body;
  if (!merchantId || !secretKey) {
    return res.status(httpStatus.BAD_REQUEST).send('Merchant ID and Secret Key are required');
  }

  try {
    // Validate credentials by generating a test token
    await generateToken(merchantId, secretKey);

    let config = await db.MyntraConfig.findOne();
    if (config) {
      config.merchantId = merchantId;
      config.secretKey = secretKey;
      await config.save();
    } else {
      config = await db.MyntraConfig.create({ merchantId, secretKey });
    }
    res.status(httpStatus.OK).send({ message: 'Myntra credentials saved successfully', config: { merchantId: config.merchantId } });
  } catch (error) {
    res.status(httpStatus.BAD_REQUEST).send(error.message || 'Error saving Myntra config');
  }
};

const getConfig = async (req, res) => {
  try {
    const config = await db.MyntraConfig.findOne();
    if (config) {
      const maskedKey = config.secretKey.substring(0, 4) + '**********' + config.secretKey.substring(config.secretKey.length - 4);
      res.status(httpStatus.OK).send({ merchantId: config.merchantId, secretKey: maskedKey, isSet: true });
    } else {
      res.status(httpStatus.OK).send({ isSet: false });
    }
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error fetching Myntra config');
  }
};

const getOrders = async (req, res) => {
  try {
    const config = await db.MyntraConfig.findOne();
    if (!config) {
      return res.status(httpStatus.BAD_REQUEST).send('Myntra credentials not configured');
    }

    // The provided API collection does not have a "fetch all orders" endpoint, only "Get Order By ID".
    // We will keep the mock UI until Myntra provides the fetch orders API.
    const mockOrders = [
      { orderId: 'MYN-ORD-1001', date: new Date().toISOString(), status: 'NEW', total: 1299, sku: '271_L' },
      { orderId: 'MYN-ORD-1002', date: new Date(Date.now() - 3600000).toISOString(), status: 'PACKED', total: 899, sku: '336_M' },
    ];
    res.status(httpStatus.OK).send(mockOrders);
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error fetching Myntra orders');
  }
};

const syncInventory = async (req, res) => {
  try {
    const config = await db.MyntraConfig.findOne();
    if (!config) {
      return res.status(httpStatus.BAD_REQUEST).send('Myntra credentials not configured');
    }

    const token = await generateToken(config.merchantId, config.secretKey);

    // Fetch local inventory mapped by SKU
    // Assuming active products with quantity
    const inventoryItems = await db.InventoryProduct.find({ 'variations.0': { $exists: true } }).limit(50).lean();
    
    if (!inventoryItems.length) {
      return res.status(httpStatus.OK).send({ message: 'No local inventory found to sync' });
    }

    const myntraPayload = [];
    inventoryItems.forEach(item => {
      item.variations.forEach(variation => {
        if (variation.sku && variation.quantity > 0) {
          myntraPayload.push({
            sku: variation.sku,
            inventoryCount: variation.quantity,
            processingSla: 2,
            storeCode: "MAIN_WH" // Assuming default warehouse
          });
        }
      });
    });

    if (myntraPayload.length === 0) {
      return res.status(httpStatus.OK).send({ message: 'No valid SKUs to sync' });
    }

    // Push to Myntra
    const response = await axios.put(`${MYNTRA_API_URL}/partner/v4/inventory/update`, myntraPayload, {
      headers: {
        'access_token': token,
        'x-partner-store': 'MYNTRA',
        'Content-Type': 'application/json'
      }
    });

    res.status(httpStatus.OK).send({ message: `Successfully synced ${myntraPayload.length} SKUs to Myntra`, data: response.data });
  } catch (error) {
    logger.error('Error syncing Myntra inventory: %o', error.response ? error.response.data : error.message);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error syncing inventory with Myntra');
  }
};

module.exports = {
  saveConfig,
  getConfig,
  getOrders,
  syncInventory,
};
