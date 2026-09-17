const fs = require('fs');
const path = require('path');
require('../polyfills/crypto');
const zlib = require('zlib');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });
const config = require('../config/config');
const logger = require('../config/logger');

const BACKUP_DIR = path.join(__dirname, '../../backups/mongodb');

/**
 * Restores MongoDB database from a gzipped snapshot file.
 * Usage: node src/scripts/restore_mongodb.js [backup_filename]
 */
async function performRestore(backupFileName) {
  if (!backupFileName) {
    // List available backups
    if (!fs.existsSync(BACKUP_DIR)) {
      console.log('No local backups directory found.');
      return;
    }
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json.gz'));
    if (files.length === 0) {
      console.log('No backup archives found in:', BACKUP_DIR);
      return;
    }
    console.log('Available Local Backups:');
    files.forEach((f, idx) => {
      const stats = fs.statSync(path.join(BACKUP_DIR, f));
      const mb = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`  [${idx + 1}] ${f} (${mb} MB, ${stats.mtime.toLocaleString()})`);
    });
    console.log('\nUsage: node src/scripts/restore_mongodb.js <backup_filename>');
    return;
  }

  const filePath = path.isAbsolute(backupFileName)
    ? backupFileName
    : path.join(BACKUP_DIR, backupFileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file not found at: ${filePath}`);
  }

  logger.info(`[Restore Script] Reading backup file: ${filePath}`);
  const compressedBuffer = fs.readFileSync(filePath);
  const jsonString = zlib.gunzipSync(compressedBuffer).toString('utf-8');
  const backupObject = JSON.parse(jsonString);

  if (!backupObject.data) {
    throw new Error('Invalid backup file format: missing "data" key.');
  }

  logger.info(`[Restore Script] Connecting to MongoDB target: ${config.mongoose.url}`);
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  const db = mongoose.connection.db;

  const collections = Object.keys(backupObject.data);
  logger.info(`[Restore Script] Starting database restore for ${collections.length} collections...`);

  for (const colName of collections) {
    const docs = backupObject.data[colName];
    if (!Array.isArray(docs) || docs.length === 0) continue;

    const collection = db.collection(colName);
    
    // Clear existing docs in collection before restore
    await collection.deleteMany({});
    logger.info(`[Restore Script] Cleared collection: ${colName}`);

    // Parse BSON objects if needed (converting strings back to ObjectIDs/Dates where appropriate)
    const formattedDocs = docs.map(doc => {
      if (doc._id && typeof doc._id === 'string' && doc._id.length === 24) {
        try {
          doc._id = new mongoose.Types.ObjectId(doc._id);
        } catch (e) {}
      }
      return doc;
    });

    await collection.insertMany(formattedDocs, { ordered: false });
    logger.info(`[Restore Script] Restored ${formattedDocs.length} documents into ${colName}.`);
  }

  logger.info('[Restore Script] ✅ Database restore completed successfully.');
}

if (require.main === module) {
  const targetFile = process.argv[2];
  performRestore(targetFile)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Restore Error:', err.message);
      process.exit(1);
    });
}

module.exports = { performRestore };
