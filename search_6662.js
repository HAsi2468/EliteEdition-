global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');

async function searchAll() {
  await mongoose.connect(config.mongoose.url);
  const db = mongoose.connection.db;

  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    const name = col.name;
    const records = await db.collection(name).find({
      $or: [
        { jobNo: '6662' }, { jobNo: 6662 },
        { jobCardNo: '6662' }, { jobCardNo: 6662 },
        { challanNo: '6662' }, { challanNo: 6662 },
        { designNo: '6662' }, { designNo: 6662 },
        { lotNo: '6662' }, { lotNo: 6662 }
      ]
    }).toArray();
    if (records.length > 0) {
      console.log(`\n=== FOUND IN COLLECTION: ${name} (${records.length} records) ===`);
      console.log(JSON.stringify(records, null, 2));
    }
  }

  // Also search regex 6662 in text/string fields
  console.log('\n--- Searching Regex /6662/ in JobCards and FabricChallans ---');
  const jcRegex = await db.collection('jobcards').find({
    $or: [
      { jobNo: { $regex: '6662' } },
      { jobCardNo: { $regex: '6662' } },
      { designNo: { $regex: '6662' } }
    ]
  }).toArray();
  console.log('JobCards Regex matches:', JSON.stringify(jcRegex, null, 2));

  const fcRegex = await db.collection('fabricChallans').find({
    $or: [
      { jobNo: { $regex: '6662' } },
      { challanNo: { $regex: '6662' } },
      { designNo: { $regex: '6662' } }
    ]
  }).toArray();
  console.log('FabricChallans Regex matches:', JSON.stringify(fcRegex, null, 2));

  await mongoose.disconnect();
  process.exit(0);
}

searchAll().catch(err => {
  console.error(err);
  process.exit(1);
});
