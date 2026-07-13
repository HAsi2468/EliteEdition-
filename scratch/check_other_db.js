require('../src/polyfills/crypto');
const mongoose = require('mongoose');

const otherUrl = 'mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition';

async function run() {
  await mongoose.connect(otherUrl);
  console.log('Connected to Other MongoDB');

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  console.log(`Found ${collections.length} collections:`);
  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    console.log(`  Collection: ${col.name.padEnd(30)} -> Count: ${count}`);
  }

  await mongoose.connection.close();
}

run().catch(console.error);
