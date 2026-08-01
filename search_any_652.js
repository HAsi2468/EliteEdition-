global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');

async function searchAny652() {
  await mongoose.connect(config.mongoose.url);
  const db = mongoose.connection.db;

  const collections = await db.listCollections().toArray();
  for (const c of collections) {
    const docs = await db.collection(c.name).find({}).toArray();
    for (const d of docs) {
      const s = JSON.stringify(d);
      if (s.includes('652') || s.includes('EDP-652')) {
        console.log(`\n=== MATCH IN COLLECTION ${c.name} (ID: ${d._id}) ===`);
        console.log(JSON.stringify(d, null, 2));
      }
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

searchAny652().catch(err => {
  console.error(err);
  process.exit(1);
});
