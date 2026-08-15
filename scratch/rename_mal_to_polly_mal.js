require('../src/polyfills/crypto');
const mongoose = require('mongoose');
const config = require('../src/config/config');

async function run() {
  const uri = config.mongoose.url;
  console.log('Connecting to Mongo at:', uri.split('@')[1]);
  await mongoose.connect(uri);

  const db = mongoose.connection.db;

  // 1. Update fabric_transactions
  const txRes = await db.collection('fabric_transactions').updateMany(
    { fabricQuality: { $regex: /^(mal|poly\s*mal|polymall)$/i } },
    { $set: { fabricQuality: 'POLLY MAL' } }
  );
  console.log(`Updated ${txRes.modifiedCount} fabric_transactions records to POLLY MAL`);

  // 2. Update fabric_challans
  const chRes = await db.collection('fabric_challans').updateMany(
    { fabricName: { $regex: /^(mal|poly\s*mal|polymall)$/i } },
    { $set: { fabricName: 'POLLY MAL' } }
  );
  console.log(`Updated ${chRes.modifiedCount} fabric_challans records to POLLY MAL`);

  // 3. Update job_cards
  const jobRes = await db.collection('job_cards').updateMany(
    { fabric: { $regex: /^(mal|poly\s*mal|polymall)$/i } },
    { $set: { fabric: 'POLLY MAL' } }
  );
  console.log(`Updated ${jobRes.modifiedCount} job_cards records to POLLY MAL`);

  // 4. Update print_configs fabrics list
  const cfg = await db.collection('print_configs').findOne({ isConfig: true });
  if (cfg && Array.isArray(cfg.fabrics)) {
    const newFabrics = Array.from(new Set(
      cfg.fabrics.map(f => /^(mal|poly\s*mal|polymall)$/i.test(f.trim()) ? 'POLLY MAL' : f)
    ));
    if (!newFabrics.includes('POLLY MAL')) {
      newFabrics.push('POLLY MAL');
    }
    await db.collection('print_configs').updateOne(
      { _id: cfg._id },
      { $set: { fabrics: newFabrics } }
    );
    console.log('Updated print_configs fabrics array:', newFabrics);
  }

  console.log('Migration complete!');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
