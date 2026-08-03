const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');
const FabricTransaction = require('./src/db/models/fabricTransaction.model');
const FabricChallan = require('./src/db/models/fabricChallan.model');

async function checkParties() {
  await mongoose.connect(config.mongoose.url);

  const txParties = await FabricTransaction.distinct('partyName');
  const txVendors = await FabricTransaction.distinct('vendorName');
  const chParties = await FabricChallan.distinct('partyName');
  const chBillTo = await FabricChallan.distinct('billTo');

  console.log('FabricTransaction partyNames:', txParties);
  console.log('FabricTransaction vendorNames:', txVendors);
  console.log('FabricChallan partyNames:', chParties);
  console.log('FabricChallan billTo:', chBillTo);

  await mongoose.disconnect();
  process.exit(0);
}

checkParties().catch(err => {
  console.error(err);
  process.exit(1);
});
