const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');
const FabricTransaction = require('./src/db/models/fabricTransaction.model');

async function testEliteFilter() {
  await mongoose.connect(config.mongoose.url);

  const eliteInward = await FabricTransaction.find({
    type: 'INWARD',
    $or: [
      { vendorName: { $regex: /ELITE|Elite\s*Digital/i } },
      { partyName: { $regex: /ELITE|Elite\s*Digital/i } }
    ]
  }).lean();

  const eliteOutward = await FabricTransaction.find({
    type: 'OUTWARD',
    $or: [
      { vendorName: { $regex: /ELITE|Elite\s*Digital/i } },
      { partyName: { $regex: /ELITE|Elite\s*Digital/i } }
    ]
  }).lean();

  console.log(`Elite Inward transactions: ${eliteInward.length}`);
  console.log(`Elite Outward transactions: ${eliteOutward.length}`);

  await mongoose.disconnect();
  process.exit(0);
}

testEliteFilter().catch(err => {
  console.error(err);
  process.exit(1);
});
