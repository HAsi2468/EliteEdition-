const mongoose = require('mongoose');
const db = require('../src/db/models');
const config = require('../src/config/config');

mongoose.connect(config.mongoose.url, config.mongoose.options).then(async () => {
  console.log('Connected to MongoDB');
  const saleOrders = await db.SaleOrder.aggregate([
    { $group: { _id: "$saleOrderItemCode", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  console.log('SaleOrder duplicates:', saleOrders.length);
  const salesList = await db.SalesList.aggregate([
    { $group: { _id: "$saleOrderItemCode", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  console.log('SalesList duplicates:', salesList.length);
  const products = await db.Product.aggregate([
    { $group: { _id: "$skuCode", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  console.log('Product duplicates:', products.length);
  process.exit();
});
