require('../src/polyfills/crypto');
const mongoose = require('mongoose');
const db = require('../src/db/models');
const config = require('../src/config/config');

mongoose.connect(config.mongoose.url, config.mongoose.options).then(async () => {
  console.log('Connected to MongoDB');
  const duplicates = await db.SaleOrder.aggregate([
    { $group: { _id: "$saleOrderItemCode", count: { $sum: 1 }, docs: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  
  let deletedCount = 0;
  for (const dup of duplicates) {
    if (!dup._id) continue; // skip nulls if any
    const docsToRemove = dup.docs.slice(1); // keep the first one
    const result = await db.SaleOrder.deleteMany({ _id: { $in: docsToRemove } });
    deletedCount += result.deletedCount;
  }
  
  console.log(`Deleted ${deletedCount} duplicate SaleOrders.`);
  
  // Also recreate indexes
  await db.SaleOrder.syncIndexes();
  console.log('Synced indexes for SaleOrder.');
  
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit(1);
});
