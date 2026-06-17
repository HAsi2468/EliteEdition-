
const crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('../../config/config');
const logger = require('../../config/logger');

// Mongoose connection
mongoose.connection.on('connecting', () => {
  logger.info('Mongoose connecting to MongoDB...');
});
mongoose.connection.on('connected', () => {
  logger.info('Mongoose successfully connected to MongoDB');
});
mongoose.connection.on('error', (error) => {
  logger.error('Mongoose connection error: %o', error);
});
mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose disconnected from MongoDB');
});

mongoose.connect(config.mongoose.url, {
  serverSelectionTimeoutMS: 5000, // Fail fast if Atlas is unreachable
})
  .catch((error) => {
    logger.error('Connect to mongodb error on initial connection:', error);
  });

const db = {
  user: require('./user.model'),
  Product: require('./product.model'),
  InventoryProduct: require('./inventoryProduct.model'),
  SaleOrder: require('./saleOrder.model'),
  SalesList: require('./salesList.model'),
  Inventory: require('./inventory.model'),
  Vendor: require('./vendor.model'),
  Party: require('./party.model'),
  StockOut: require('./stockOut.model'),
  JobCard: require('./jobCard.model'),
  Design: require('./design.model'),
  MyntraConfig: require('./myntraConfig.model'),
  ReturnRecord: require('./returnRecord.model'),
  PrintConfig: require('./printConfig.model'),
  ChatRoom: require('./chat.model').ChatRoom,
  ChatMessage: require('./chat.model').ChatMessage,
  Task: require('./task.model').Task,
  mongoose,
};

module.exports = db;
