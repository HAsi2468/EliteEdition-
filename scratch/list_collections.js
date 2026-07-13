require('../src/polyfills/crypto');
const mongoose = require('mongoose');
const config = require('../src/config/config');

async function run() {
  await mongoose.connect(config.mongoose.url);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  console.log(`Found ${collections.length} collections:`);
  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    printCollectionDetails(col.name, count);
  }

  await mongoose.connection.close();
}

function printCollectionDetails(name, count) {
  console.log(`  Collection: ${name.padEnd(30)} -> Count: ${count}`);
}

run().catch(console.error);
