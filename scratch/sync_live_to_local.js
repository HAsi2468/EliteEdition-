const { MongoClient } = require('mongodb');

// Live Production MongoDB URI
const LIVE_URI = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition";

// Local MongoDB URI
const LOCAL_URI = process.env.LOCAL_MONGODB_URL || "mongodb://127.0.0.1:27017/elite_edition";

async function syncLiveToLocal() {
  console.log("🚀 Starting Full Data Sync from Live Production Atlas to Local MongoDB...");
  console.log(`Live Source : ${LIVE_URI.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`Local Target: ${LOCAL_URI}\n`);

  const liveClient = new MongoClient(LIVE_URI);
  const localClient = new MongoClient(LOCAL_URI);

  try {
    await liveClient.connect();
    console.log("✅ Connected to Live Production Database.");
    
    await localClient.connect();
    console.log("✅ Connected to Local MongoDB Database.\n");

    const liveDb = liveClient.db();
    const localDb = localClient.db();

    const collections = await liveDb.listCollections().toArray();
    console.log(`Found ${collections.length} collections on Live Database.\n`);

    const summary = [];

    for (const colInfo of collections) {
      const colName = colInfo.name;
      if (colName.startsWith('system.')) continue;

      const liveCol = liveDb.collection(colName);
      const localCol = localDb.collection(colName);

      const totalCount = await liveCol.countDocuments();
      console.log(`📦 Syncing '${colName}' (${totalCount} documents)...`);

      // Clear existing local collection data before sync
      await localCol.deleteMany({});

      if (totalCount > 0) {
        const cursor = liveCol.find({});
        let batch = [];
        let syncedCount = 0;

        while (await cursor.hasNext()) {
          const doc = await cursor.next();
          batch.push(doc);

          if (batch.length >= 500) {
            await localCol.insertMany(batch);
            syncedCount += batch.length;
            batch = [];
          }
        }

        if (batch.length > 0) {
          await localCol.insertMany(batch);
          syncedCount += batch.length;
        }

        console.log(`   └─ ✅ Synced ${syncedCount}/${totalCount} documents into local '${colName}'.`);
        summary.push({ collection: colName, status: 'Success', count: syncedCount });
      } else {
        console.log(`   └─ ℹ️ Skipped empty collection '${colName}'.`);
        summary.push({ collection: colName, status: 'Empty', count: 0 });
      }
    }

    console.log("\n========================================================");
    console.log("🎉 DATA SYNC COMPLETED SUCCESSFULLY!");
    console.log("========================================================\n");
    console.table(summary);

  } catch (err) {
    console.error("❌ Error during database sync:", err);
  } finally {
    await liveClient.close();
    await localClient.close();
    console.log("\nDatabase connections closed.");
  }
}

syncLiveToLocal();
