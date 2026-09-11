const mongoose = require('mongoose');

async function runMerge() {
  console.log('🚀 Starting DB Merge: elite_edition_local ➔ elite_edition...');
  const uriMain = 'mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition';
  const uriLocal = 'mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition_local?retryWrites=true&w=majority&appName=EliteEdition';

  const connMain = mongoose.createConnection(uriMain);
  const connLocal = mongoose.createConnection(uriLocal);
  await Promise.all([connMain.asPromise(), connLocal.asPromise()]);

  console.log('✅ Connected to both databases.');
  const cols = await connLocal.db.listCollections().toArray();

  let totalMigrated = 0;
  for (const c of cols) {
    const localDocs = await connLocal.db.collection(c.name).find({}).toArray();
    const mainCol = connMain.db.collection(c.name);

    for (const doc of localDocs) {
      try {
        const updateObj = {};
        updateObj['$setOnInsert'] = doc;
        const res = await mainCol.updateOne(
          { _id: doc._id },
          updateObj,
          { upsert: true }
        );
        if (res.upsertedCount > 0) totalMigrated++;
      } catch (err) {
        // Skip duplicate key errors silently
      }
    }
  }

  console.log(`🎉 Merged ${totalMigrated} new records into main database "elite_edition"!`);
  await Promise.all([connMain.close(), connLocal.close()]);
  process.exit(0);
}

runMerge().catch(err => {
  console.error('❌ Merge error:', err);
  process.exit(1);
});
