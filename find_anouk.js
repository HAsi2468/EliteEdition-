const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');
const db = require('./src/db/models');

async function findAnoukOrders() {
  await mongoose.connect(config.mongoose.url);

  const orders = await db.SaleOrder.find({
    itemTypeBrand: 'ANOUK',
    reversePickupCreatedDate: { $ne: null, $exists: true, $ne: '' }
  }).lean();

  console.log(`Found ${orders.length} ANOUK return orders in DB:`);
  orders.forEach(o => {
    console.log(`OrderCode: ${o.saleOrderItemCode} | SKU: ${o.itemSKUCode} | Qty: ${o.saleCount} | Price: ${o.totalPrice}`);
    console.log(`  reversePickupCreatedDate: "${o.reversePickupCreatedDate}"`);
    console.log(`  returnDate: "${o.returnDate}"`);
    console.log(`  orderDate: "${o.orderDate}"\n`);
  });

  await mongoose.disconnect();
  process.exit(0);
}

findAnoukOrders().catch(err => {
  console.error(err);
  process.exit(1);
});
