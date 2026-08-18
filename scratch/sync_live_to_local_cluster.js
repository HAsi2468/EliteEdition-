const { MongoClient } = require('mongodb');

// Live Production MongoDB URI (Source: elite_edition)
const LIVE_URI = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition";

// Localhost Backend Dedicated Target DB URI (Target: elite_edition_local)
const TARGET_LOCAL_URI = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition_local?retryWrites=true&w=majority&appName=EliteEdition";

async function syncLiveToLocalCluster() {
  console.log("🚀 Starting Full Data Sync from Live Database ('elite_edition') to Local Dev DB ('elite_edition_local')...");

  const liveClient = new MongoClient(LIVE_URI);
  const targetClient = new MongoClient(TARGET_LOCAL_URI);

  try {
    await liveClient.connect();
    console.log("✅ Connected to Live Production Database ('elite_edition').");
    
    await targetClient.connect();
    console.log("✅ Connected to Local Dev Database ('elite_edition_local').\n");

    const liveDb = liveClient.db('elite_edition');
    const targetDb = targetClient.db('elite_edition_local');

    const collections = await liveDb.listCollections().toArray();
    console.log(`Found ${collections.length} collections in Live Database.\n`);

    const summary = [];

    for (const colInfo of collections) {
      const colName = colInfo.name;
      if (colName.startsWith('system.')) continue;

      const liveCol = liveDb.collection(colName);
      const targetCol = targetDb.collection(colName);

      const totalCount = await liveCol.countDocuments();
      console.log(`📦 Syncing '${colName}' (${totalCount} documents)...`);

      // Clear existing local dev database collection before sync
      await targetCol.deleteMany({});

      if (totalCount > 0) {
        const cursor = liveCol.find({});
        let batch = [];
        let syncedCount = 0;

        while (await cursor.hasNext()) {
          const doc = await cursor.next();
          batch.push(doc);

          if (batch.length >= 500) {
            await targetCol.insertMany(batch);
            syncedCount += batch.length;
            batch = [];
          }
        }

        if (batch.length > 0) {
          await targetCol.insertMany(batch);
          syncedCount += batch.length;
        }

        console.log(`   └─ ✅ Synced ${syncedCount}/${totalCount} documents into local dev database '${colName}'.`);
        summary.push({ Collection: colName, Status: 'Success', Count: syncedCount });
      } else {
        console.log(`   └─ ℹ️ Empty collection '${colName}'.`);
        summary.push({ Collection: colName, Status: 'Empty', Count: 0 });
      }
    }

    console.log("\n========================================================");
    console.log("🎉 ALL LIVE DATA COPIED TO LOCAL DEV DATABASE ('elite_edition_local')!");
    console.log("========================================================\n");
    console.table(summary);

  } catch (err) {
    console.error("❌ Error during database sync:", err);
  } finally {
    await liveClient.close();
    await targetClient.close();
    console.log("\nDatabase connections closed.");
  }
}

syncLiveToLocalCluster();
