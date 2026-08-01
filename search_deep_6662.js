global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');

async function searchDeep() {
  await mongoose.connect(config.mongoose.url);
  const db = mongoose.connection.db;

  const collectionsToSearch = ['jobCards', 'designs', 'sale_orders', 'salesList', 'products', 'fabricTransactions'];

  for (const colName of collectionsToSearch) {
    const docs = await db.collection(colName).find({}).toArray();
    for (const doc of docs) {
      const str = JSON.stringify(doc);
      if (str.includes('6662') || str.includes('666')) {
        console.log(`\n=== MATCH IN ${colName} (ID: ${doc._id}) ===`);
        console.log(JSON.stringify(doc, null, 2));
      }
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

searchDeep().catch(err => {
  console.error(err);
  process.exit(1);
});
