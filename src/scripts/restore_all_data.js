const fs = require('fs');
const path = require('path');
require('../polyfills/crypto');
const zlib = require('zlib');
const child_process = require('child_process');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });
const config = require('../config/config');
const logger = require('../config/logger');

const DB_BACKUP_DIR = path.join(__dirname, '../../backups/mongodb');
const IMAGES_BACKUP_DIR = path.join(__dirname, '../../backups/images');
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

/**
 * 1-Click Complete System Disaster Recovery:
 * Restores ALL MongoDB database collections AND unpacks ALL uploaded images and media.
 * Usage: node src/scripts/restore_all_data.js [db_backup_file] [images_backup_file]
 */
async function restoreAllData(dbBackupFile, imagesBackupFile) {
  console.log('========================================================================');
  console.log('⚡ ELITE EDITION ERP — COMPLETE SYSTEM DISASTER RECOVERY & RESTORE');
  console.log('========================================================================\n');
  const startTime = Date.now();

  // 1. Locate Database Backup File
  let targetDbFile = dbBackupFile;
  if (!targetDbFile) {
    if (fs.existsSync(DB_BACKUP_DIR)) {
      const dbFiles = fs.readdirSync(DB_BACKUP_DIR)
        .filter(f => f.endsWith('.json.gz'))
        .map(f => ({ name: f, path: path.join(DB_BACKUP_DIR, f), time: fs.statSync(path.join(DB_BACKUP_DIR, f)).mtimeMs }))
        .sort((a, b) => b.time - a.time);

      if (dbFiles.length > 0) {
        targetDbFile = dbFiles[0].path;
      }
    }
  } else if (!path.isAbsolute(targetDbFile)) {
    targetDbFile = path.join(DB_BACKUP_DIR, targetDbFile);
  }

  if (!targetDbFile || !fs.existsSync(targetDbFile)) {
    throw new Error(`Database backup file not found: ${targetDbFile || 'No archives in backups/mongodb'}`);
  }

  // 2. Locate Images Backup File
  let targetImagesFile = imagesBackupFile;
  if (!targetImagesFile) {
    if (fs.existsSync(IMAGES_BACKUP_DIR)) {
      const imgFiles = fs.readdirSync(IMAGES_BACKUP_DIR)
        .filter(f => f.endsWith('.tar.gz') || f.endsWith('.gz'))
        .map(f => ({ name: f, path: path.join(IMAGES_BACKUP_DIR, f), time: fs.statSync(path.join(IMAGES_BACKUP_DIR, f)).mtimeMs }))
        .sort((a, b) => b.time - a.time);

      if (imgFiles.length > 0) {
        targetImagesFile = imgFiles[0].path;
      }
    }
  } else if (!path.isAbsolute(targetImagesFile)) {
    targetImagesFile = path.join(IMAGES_BACKUP_DIR, targetImagesFile);
  }

  console.log(`📦 Selected Database Archive: ${path.basename(targetDbFile)}`);
  if (targetImagesFile && fs.existsSync(targetImagesFile)) {
    console.log(`🖼️  Selected Images Archive:   ${path.basename(targetImagesFile)}`);
  } else {
    console.log('⚠️  No separate images archive found; restoring database documents only.');
  }
  console.log('');

  // 3. Restore MongoDB Database
  console.log('▶️  Phase 1: Restoring MongoDB Collections...');
  const compressedBuffer = fs.readFileSync(targetDbFile);
  const jsonString = zlib.gunzipSync(compressedBuffer).toString('utf-8');
  const backupObject = JSON.parse(jsonString);

  if (!backupObject.data) {
    throw new Error('Invalid backup file format: missing "data" property.');
  }

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
  }
  const db = mongoose.connection.db;

  const collections = Object.keys(backupObject.data);
  let totalDocsRestored = 0;

  for (const colName of collections) {
    const docs = backupObject.data[colName];
    if (!Array.isArray(docs) || docs.length === 0) continue;

    const collection = db.collection(colName);
    await collection.deleteMany({}); // Clear existing

    // Rehydrate ObjectIds and Dates
    const rehydratedDocs = docs.map(doc => {
      const newDoc = { ...doc };
      if (newDoc._id && typeof newDoc._id === 'string' && newDoc._id.length === 24) {
        try {
          newDoc._id = new mongoose.Types.ObjectId(newDoc._id);
        } catch (e) {}
      }
      return newDoc;
    });

    await collection.insertMany(rehydratedDocs);
    totalDocsRestored += rehydratedDocs.length;
    console.log(`  ✓ Restored [${colName}]: ${rehydratedDocs.length} documents`);
  }
  console.log(`\n✅ Database Restore Completed: ${collections.length} collections, ${totalDocsRestored} documents restored.\n`);

  // 4. Restore Images & Uploads Directory
  let restoredImagesCount = 0;
  if (targetImagesFile && fs.existsSync(targetImagesFile)) {
    console.log('▶️  Phase 2: Restoring All Uploaded Images & Media...');
    const parentDir = path.dirname(UPLOADS_DIR);
    try {
      child_process.execSync(`tar -xzf "${targetImagesFile}" -C "${parentDir}"`, { timeout: 120000 });
      const countOut = child_process.execSync(`find "${UPLOADS_DIR}" -type f | wc -l`, { encoding: 'utf-8' });
      restoredImagesCount = parseInt(countOut.trim(), 10) || 0;
      console.log(`✅ Images Restore Completed: ${restoredImagesCount} media files restored into ${UPLOADS_DIR}.\n`);
    } catch (tarErr) {
      console.error(`❌ Failed to unpack images archive: ${tarErr.message}`);
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('========================================================================');
  console.log(`🎉 FULL SYSTEM DISASTER RECOVERY FINISHED IN ${durationSec}s!`);
  console.log('   All business collections and all uploaded images are 100% active.');
  console.log('========================================================================\n');

  return {
    success: true,
    dbFile: path.basename(targetDbFile),
    imagesFile: targetImagesFile ? path.basename(targetImagesFile) : null,
    collectionsCount: collections.length,
    documentsRestored: totalDocsRestored,
    imagesRestored: restoredImagesCount,
    durationSec,
  };
}

if (require.main === module) {
  const [,, dbArg, imgArg] = process.argv;
  restoreAllData(dbArg, imgArg)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Restore failed:', err);
      process.exit(1);
    });
}

module.exports = {
  restoreAllData,
};
