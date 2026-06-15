const httpStatus = require('http-status');
const db = require('../db/models');

const saveConfig = async (req, res) => {
  const { merchantId, secretKey } = req.body;
  if (!merchantId || !secretKey) {
    return res.status(httpStatus.BAD_REQUEST).send('Merchant ID and Secret Key are required');
  }

  try {
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
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error saving Myntra config');
  }
};

const getConfig = async (req, res) => {
  try {
    const config = await db.MyntraConfig.findOne();
    if (config) {
      // Send masked secret key for security
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
  // Mock endpoint for live orders until real API is integrated
  try {
    const config = await db.MyntraConfig.findOne();
    if (!config) {
      return res.status(httpStatus.BAD_REQUEST).send('Myntra credentials not configured');
    }

    // Return dummy orders
    const mockOrders = [
      { orderId: 'MYN-ORD-1001', date: new Date().toISOString(), status: 'NEW', total: 1299, sku: '271_L' },
      { orderId: 'MYN-ORD-1002', date: new Date(Date.now() - 3600000).toISOString(), status: 'PACKED', total: 899, sku: '336_M' },
      { orderId: 'MYN-ORD-1003', date: new Date(Date.now() - 7200000).toISOString(), status: 'NEW', total: 2499, sku: '308_XL' },
    ];
    res.status(httpStatus.OK).send(mockOrders);
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error fetching Myntra orders');
  }
};

const syncInventory = async (req, res) => {
  // Mock endpoint for inventory sync
  try {
    res.status(httpStatus.OK).send({ message: 'Inventory sync triggered successfully (Mock)' });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error syncing inventory');
  }
};

module.exports = {
  saveConfig,
  getConfig,
  getOrders,
  syncInventory,
};
