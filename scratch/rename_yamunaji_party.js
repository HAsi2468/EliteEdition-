const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const config = require('../src/config/config');

async function runMigration() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.mongoose.url);
    console.log('Connected to MongoDB successfully.');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections in database.`);

    const targetRegex = /^YAMUNAJI\b/i; // Matches "YAMUNAJI", "YAMUNAJI ", "yamunaji", etc.
    const newName = 'YAMUNAJI CREATION';

    let totalUpdated = 0;

    for (const colInfo of collections) {
      const colName = colInfo.name;
      const collection = db.collection(colName);

      // Check fields: party, partyName, vendorName, customerName, billTo, shipTo, name, businessName
      const fields = ['party', 'partyName', 'vendorName', 'customerName', 'billTo', 'shipTo', 'name', 'businessName'];

      for (const field of fields) {
        const query = { [field]: { $regex: targetRegex } };
        const count = await collection.countDocuments(query);

        if (count > 0) {
          console.log(`Found ${count} documents in collection '${colName}' with field '${field}' matching YAMUNAJI`);
          
          // Perform update
          const docs = await collection.find(query).toArray();
          for (const doc of docs) {
            const currentVal = doc[field];
            if (typeof currentVal === 'string') {
              // Replace exact "YAMUNAJI" or "YAMUNAJI " with "YAMUNAJI CREATION"
              const updatedVal = currentVal.replace(/^YAMUNAJI(\s*CREATION)?\b/i, 'YAMUNAJI CREATION').trim();
              if (updatedVal !== currentVal) {
                await collection.updateOne({ _id: doc._id }, { $set: { [field]: updatedVal } });
                totalUpdated++;
              }
            }
          }
          console.log(`Updated documents in '${colName}' for field '${field}'.`);
        }
      }
    }

    console.log(`\n✅ Migration Complete! Total documents updated across all collections: ${totalUpdated}`);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

runMigration();
