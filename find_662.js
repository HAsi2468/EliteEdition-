global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');

async function find662() {
  await mongoose.connect(config.mongoose.url);
  const db = mongoose.connection.db;

  console.log('--- ALL JOBCARDS with jobNo or designNo containing 662 ---');
  const jc = await db.collection('jobCards').find({
    $or: [{ jobNo: /662/ }, { designNo: /662/ }]
  }).toArray();
  console.log('Found:', jc.length);
  for (const j of jc) {
    console.log(JSON.stringify(j, null, 2));
  }

  console.log('\n--- ALL DESIGNS with designNo or designName containing 662 ---');
  const ds = await db.collection('designs').find({
    $or: [{ designNo: /662/ }, { designName: /662/ }]
  }).toArray();
  console.log('Found:', ds.length);
  for (const d of ds) {
    console.log(JSON.stringify(d, null, 2));
  }

  console.log('\n--- ALL FABRIC CHALLANS with jobNo or designNo containing 662 or 6662 ---');
  const fc = await db.collection('fabricChallans').find({
    $or: [{ jobNo: /66/ }, { designNo: /66/ }, { challanNo: /66/ }]
  }).toArray();
  console.log('Found:', fc.length);
  for (const c of fc) {
    console.log(`ChallanNo: "${c.challanNo}", JobNo: "${c.jobNo}", DesignNo: "${c.designNo}"`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

find662().catch(err => {
  console.error(err);
  process.exit(1);
});
