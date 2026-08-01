global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');

async function find652InDb() {
  await mongoose.connect(config.mongoose.url);
  const db = mongoose.connection.db;

  const collections = await db.listCollections().toArray();
  for (const c of collections) {
    const docs = await db.collection(c.name).find({
      $or: [
        { challanNo: 652 }, { challanNo: '652' }, { challanNo: 'EDP-652' },
        { jobNo: { $regex: '652' } }, { designNo: { $regex: '652' } }
      ]
    }).toArray();
    if (docs.length > 0) {
      console.log(`\n=== FOUND IN COLLECTION: ${c.name} ===`);
      console.log(JSON.stringify(docs, null, 2));
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

find652InDb().catch(err => {
  console.error(err);
  process.exit(1);
});
