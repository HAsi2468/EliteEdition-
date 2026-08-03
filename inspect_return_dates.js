const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');
const db = require('./src/db/models');

async function inspectReturnDates() {
  await mongoose.connect(config.mongoose.url);

  const sampleReturns = await db.SaleOrder.find({
    reversePickupCreatedDate: { $ne: null, $exists: true, $ne: '' }
  }).sort({ _id: -1 }).limit(10).lean();

  console.log(`Found ${sampleReturns.length} return orders sample:`);
  sampleReturns.forEach(s => {
    console.log(`ID: ${s._id} | Order: ${s.saleOrderItemCode}`);
    console.log(`  reversePickupCreatedDate: "${s.reversePickupCreatedDate}" (type: ${typeof s.reversePickupCreatedDate})`);
    console.log(`  returnDate: "${s.returnDate}" (type: ${typeof s.returnDate})`);
    console.log(`  orderDate: "${s.orderDate}" (type: ${typeof s.orderDate})\n`);
  });

  await mongoose.disconnect();
  process.exit(0);
}

inspectReturnDates().catch(err => {
  console.error(err);
  process.exit(1);
});
