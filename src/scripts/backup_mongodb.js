const fs = require('fs');
const path = require('path');
require('../polyfills/crypto');
const os = require('os');
const zlib = require('zlib');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });
const config = require('../config/config');
const logger = require('../config/logger');
const { uploadToR2, isR2Configured } = require('../utils/r2Storage');
const { uploadToS3, isS3Configured } = require('../utils/s3Storage');

const BACKUP_DIR = path.join(__dirname, '../../backups/mongodb');
const RETENTION_DAYS = 30;

/**
 * Creates a local gzipped backup of the MongoDB database,
 * purges backups older than RETENTION_DAYS (30 days),
 * and syncs to cloud storage if configured.
 */
async function performBackup() {
  logger.info('[Backup Script] Initializing MongoDB automated multi-destination backup...');

  // Ensure local backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Connect to MongoDB if not connected
  if (mongoose.connection.readyState !== 1) {
    logger.info('[Backup Script] Connecting to MongoDB...');
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    logger.info('[Backup Script] Connected to MongoDB.');
  }

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection is not ready');
  }

  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-');
  const fileName = `elite_mongodb_backup_${dateStr}.json.gz`;
  const localFilePath = path.join(BACKUP_DIR, fileName);

  const collections = await db.listCollections().toArray();
  logger.info(`[Backup Script] Exporting ${collections.length} collections...`);

  // Stream data to gzipped local file
  await new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(localFilePath);
    const gzip = zlib.createGzip();

    gzip.pipe(writeStream);
    gzip.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', resolve);

    gzip.write(`{\n  "meta": {\n    "exportDate": "${now.toISOString()}",\n    "databaseName": "${db.databaseName}",\n    "totalCollections": ${collections.length}\n  },\n  "data": {\n`);

    (async () => {
      for (let i = 0; i < collections.length; i++) {
        const col = collections[i];
        const isLast = i === collections.length - 1;
        gzip.write(`    "${col.name}": [\n`);

        try {
          const cursor = db.collection(col.name).find({});
          let isFirstDoc = true;
          for await (const doc of cursor) {
            const prefix = isFirstDoc ? '      ' : ',\n      ';
            isFirstDoc = false;
            gzip.write(prefix + JSON.stringify(doc));
          }
        } catch (err) {
          logger.warn(`[Backup Script] Warning reading collection ${col.name}: ${err.message}`);
        }
        gzip.write(`\n    ]${isLast ? '' : ','}\n`);
      }
      gzip.write('  }\n}\n');
      gzip.end();
    })().catch(reject);
  });

  const stats = fs.statSync(localFilePath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  logger.info(`[Backup Script] Local backup created successfully: ${fileName} (${sizeMB} MB) at ${localFilePath}`);

  // 2. Perform 30-day Local Retention Cleanup
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const cutoffTime = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let purgedCount = 0;

    for (const file of files) {
      if (file.endsWith('.json.gz') || file.endsWith('.tar.gz')) {
        const filePath = path.join(BACKUP_DIR, file);
        const fileStats = fs.statSync(filePath);
        if (fileStats.mtimeMs < cutoffTime) {
          fs.unlinkSync(filePath);
          purgedCount++;
          logger.info(`[Backup Script] Purged expired local backup older than ${RETENTION_DAYS} days: ${file}`);
        }
      }
    }
    if (purgedCount > 0) {
      logger.info(`[Backup Script] Cleaned up ${purgedCount} expired local backup(s).`);
    }
  } catch (err) {
    logger.warn(`[Backup Script] Retention cleanup warning: ${err.message}`);
  }

  // 3. Multi-Destination Offsite Cloud Storage Sync (R2 & Amazon S3 / Glacier)
  let cloudUrl = null;
  let s3Uri = null;

  if (isR2Configured()) {
    try {
      logger.info('[Backup Script] Syncing backup archive to Cloudflare R2...');
      const buffer = fs.readFileSync(localFilePath);
      cloudUrl = await uploadToR2({
        buffer,
        fileName,
        mimeType: 'application/gzip',
        folder: 'backups/mongodb',
      });
      logger.info(`[Backup Script] Offsite R2 cloud backup sync complete: ${cloudUrl}`);
    } catch (err) {
      logger.error(`[Backup Script] R2 backup sync failed: ${err.message}`);
    }
  } else {
    logger.info('[Backup Script] Cloudflare R2 credentials not set; skipped R2 sync.');
  }

  if (isS3Configured()) {
    try {
      logger.info('[Backup Script] Syncing backup archive to Amazon S3 & Glacier Flexible Archive...');
      const buffer = fs.readFileSync(localFilePath);
      s3Uri = await uploadToS3({
        buffer,
        fileName,
        mimeType: 'application/gzip',
        folder: 'mongodb-dumps',
      });
      logger.info(`[Backup Script] Offsite Amazon S3 backup sync complete: ${s3Uri}`);
    } catch (err) {
      logger.error(`[Backup Script] Amazon S3 backup sync failed: ${err.message}`);
    }
  } else {
    logger.info('[Backup Script] Amazon S3 credentials not set; skipped S3 sync.');
  }

  return {
    success: true,
    fileName,
    localPath: localFilePath,
    sizeMB,
    cloudUrl,
    s3Uri,
    timestamp: now.toISOString(),
  };
}

// Allow direct CLI execution
if (require.main === module) {
  performBackup()
    .then((res) => {
      console.log('✅ MongoDB Backup Completed Successfully:', JSON.stringify(res, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ MongoDB Backup Failed:', err);
      process.exit(1);
    });
}

module.exports = {
  performBackup,
};
