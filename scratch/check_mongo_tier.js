require('../src/polyfills/crypto');
const mongoose = require('mongoose');

const uri = 'mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition';

async function run() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB Production Atlas');
    
    const stats = await mongoose.connection.db.stats();
    console.log('\n--- Database Stats ---');
    console.log(`Database Name: ${mongoose.connection.db.databaseName}`);
    console.log(`Collections Count: ${stats.collections}`);
    console.log(`Data Size (Uncompressed): ${(stats.dataSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Storage Size (Allocated): ${(stats.storageSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Index Size: ${(stats.indexSize / (1024 * 1024)).toFixed(2)} MB`);
    
    // We can run serverStatus or admin commands to see buildInfo or replica set
    const adminDb = mongoose.connection.db.admin();
    const buildInfo = await adminDb.buildInfo();
    console.log('\n--- Server Info ---');
    console.log(`MongoDB Version: ${buildInfo.version}`);
    
    // Let's try running serverStatus to check connection count or other metrics
    try {
      const serverStatus = await adminDb.serverStatus();
      console.log(`Process: ${serverStatus.process}`);
      console.log(`Uptime: ${serverStatus.uptime} seconds`);
    } catch (e) {
      console.log('Could not retrieve serverStatus (typical on shared/free tier Clusters).');
    }
  } catch (e) {
    console.error('Error running MongoDB stats:', e);
  } finally {
    await mongoose.disconnect();
  }
}
run();
