require('../src/polyfills/crypto');
const mongoose = require('mongoose');
const config = require('../src/config/config');
const FabricTransaction = require('../src/db/models/fabricTransaction.model');

async function run() {
  await mongoose.connect(config.mongoose.url);
  console.log('Connected to MongoDB');

  const total = await FabricTransaction.countDocuments();
  console.log(`Total Fabric Transactions in DB: ${total}`);

  // June 2026 counts
  const juneStart = new Date('2026-06-01T00:00:00.000Z');
  const juneEnd = new Date('2026-06-30T23:59:59.999Z');
  const juneCount = await FabricTransaction.countDocuments({
    date: { $gte: juneStart, $lte: juneEnd }
  });
  console.log(`June 2026 Fabric Transactions in DB: ${juneCount}`);

  // July 2026 counts
  const julyStart = new Date('2026-07-01T00:00:00.000Z');
  const julyEnd = new Date('2026-07-31T23:59:59.999Z');
  const julyCount = await FabricTransaction.countDocuments({
    date: { $gte: julyStart, $lte: julyEnd }
  });
  console.log(`July 2026 Fabric Transactions in DB: ${julyCount}`);

  await mongoose.connection.close();
}

run().catch(console.error);
