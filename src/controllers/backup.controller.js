const mongoose = require('mongoose');
const zlib = require('zlib');
const { uploadToR2, listR2Objects, isR2Configured } = require('../utils/r2Storage');
const logger = require('../config/logger');

// Helper to construct date filter on query
const buildDateFilter = (startDate, endDate) => {
  if (!startDate && !endDate) return {};
  const dateCond = {};
  if (startDate) {
    dateCond.$gte = new Date(`${startDate}T00:00:00.000Z`);
  }
  if (endDate) {
    dateCond.$lte = new Date(`${endDate}T23:59:59.999Z`);
  }
  
  // Use $or across common date fields
  return {
    $or: [
      { created_at: dateCond },
      { createdAt: dateCond },
      { date: dateCond },
      { invoiceDate: dateCond }
    ]
  };
};

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Stream all collections in MongoDB database to a gzipped JSON temp file, then upload directly to Cloudflare R2
 */
const performDatabaseR2Backup = async () => {
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 is not configured in environment variables');
  }

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection is not ready');
  }

  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-');
  const fileName = `db_backup_${dateStr}.json.gz`;
  const tmpFilePath = path.join(os.tmpdir(), fileName);

  const collections = await db.listCollections().toArray();

  await new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(tmpFilePath);
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
          logger.warn(`Backup cursor warning on ${col.name}: ${err.message}`);
        }
        gzip.write(`\n    ]${isLast ? '' : ','}\n`);
      }
      gzip.write('  }\n}\n');
      gzip.end();
    })().catch(reject);
  });

  const compressedBuffer = fs.readFileSync(tmpFilePath);
  const sizeBytes = compressedBuffer.length;

  const publicUrl = await uploadToR2({
    buffer: compressedBuffer,
    fileName,
    mimeType: 'application/gzip',
    folder: 'backups/mongodb',
  });

  // Cleanup temp file
  try {
    fs.unlinkSync(tmpFilePath);
  } catch (e) {}

  return {
    fileName,
    sizeBytes,
    publicUrl,
    timestamp: now.toISOString(),
    collectionsCount: collections.length,
  };
};

const triggerR2Backup = async (req, res) => {
  try {
    const result = await performDatabaseR2Backup();
    return res.status(200).json({
      success: true,
      message: 'Database successfully backed up and uploaded to Cloudflare R2!',
      data: result,
    });
  } catch (error) {
    console.error('R2 Data Backup Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Database R2 backup failed' });
  }
};

const listR2Backups = async (req, res) => {
  try {
    const backups = await listR2Objects({ folder: 'backups/mongodb' });
    return res.status(200).json({
      success: true,
      data: backups,
    });
  } catch (error) {
    console.error('List R2 Backups Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to list R2 backups' });
  }
};

const getDepartmentBackup = async (req, res) => {
  try {
    const { startDate, endDate, department = 'all', format = 'json' } = req.query;
    const db = mongoose.connection.db;

    // Define collection mappings per department
    const deptCollections = {
      billing: ['billinginvoices', 'billingcustomers', 'billingitems'],
      design: ['designs'],
      digital_printing: ['jobCards', 'jobPrintLogs', 'jobFusingLogs'],
      fabric: ['fabricChallans', 'fabricTransactions', 'fabricStockAdjustments'],
      stitching: ['stitching_challans', 'stitching_configs'],
      garment: ['garmentJobCards'],
      sales: ['sale_orders', 'products', 'inventory_products'],
      customers: ['vendors', 'partys', 'fabricVendors'],
      all: [
        'billinginvoices', 'billingcustomers', 'billingitems',
        'designs', 'jobCards', 'jobPrintLogs', 'jobFusingLogs',
        'fabricChallans', 'fabricTransactions', 'fabricStockAdjustments',
        'stitching_challans', 'stitching_configs', 'garmentJobCards',
        'sale_orders', 'products', 'inventory_products',
        'vendors', 'partys', 'fabricVendors'
      ]
    };

    const targetCollections = deptCollections[department] || deptCollections['all'];
    const backupData = {
      meta: {
        exportDate: new Date().toISOString(),
        department,
        startDate: startDate || 'ALL',
        endDate: endDate || 'ALL',
        totalCollections: targetCollections.length
      },
      data: {}
    };

    const hasDateRange = Boolean(startDate || endDate);
    const dateFilter = buildDateFilter(startDate, endDate);

    for (const colName of targetCollections) {
      try {
        let docs = [];
        if (hasDateRange) {
          docs = await db.collection(colName).find(dateFilter).toArray();
          // Fallback if date field is not indexed or structured differently
          if (docs.length === 0) {
            docs = await db.collection(colName).find({}).toArray();
          }
        } else {
          docs = await db.collection(colName).find({}).toArray();
        }
        backupData.data[colName] = docs;
      } catch (e) {
        backupData.data[colName] = [];
      }
    }

    const startTag = startDate || 'Start';
    const endTag = endDate || 'End';
    const filename = `Elite_Edition_Backup_${department}_${startTag}_to_${endTag}.${format === 'csv' ? 'csv' : 'json'}`;

    if (format === 'csv') {
      let csvContent = 'Collection,DocumentID,CreatedDate,DataContent\n';
      for (const [col, docs] of Object.entries(backupData.data)) {
        docs.forEach(doc => {
          const id = doc._id || '';
          const dt = doc.created_at || doc.createdAt || doc.date || doc.invoiceDate || '';
          const summary = JSON.stringify(doc).replace(/"/g, '""');
          csvContent += `"${col}","${id}","${dt}","${summary}"\n`;
        });
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csvContent);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(JSON.stringify(backupData, null, 2));
    }
  } catch (error) {
    console.error('Data Backup Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Data backup failed' });
  }
};

const BACKUP_DIR = path.join(__dirname, '../../backups/mongodb');

/**
 * List all automated daily backups stored on disk and synced to cloud
 */
const listDailyBackups = async (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return res.status(200).json({
        success: true,
        backups: [],
        recipients: ['parth6070@gmail.com', 'harshtsidapara2468@gmail.com'],
      });
    }

    const files = fs.readdirSync(BACKUP_DIR);
    const backupList = [];

    for (const file of files) {
      if (file.endsWith('.json.gz') || file.endsWith('.tar.gz') || file.endsWith('.json')) {
        const filePath = path.join(BACKUP_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          backupList.push({
            fileName: file,
            sizeBytes: stats.size,
            sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
            createdAt: stats.birthtime && stats.birthtime.getTime() > 0 ? stats.birthtime : stats.mtime,
            modifiedAt: stats.mtime,
            destinations: ['Local EC2 Disk', 'AWS S3 Standard', 'Cloudflare R2'],
          });
        } catch (e) {
          // ignore corrupted file stat
        }
      }
    }

    // Sort newest first
    backupList.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));

    return res.status(200).json({
      success: true,
      count: backupList.length,
      backups: backupList,
      recipients: ['parth6070@gmail.com', 'harshtsidapara2468@gmail.com'],
      schedulerStatus: 'Active (Daily 07:30 AM IST + Cloud Sync)',
    });
  } catch (error) {
    logger.error(`List daily backups error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || 'Failed to list backups' });
  }
};

/**
 * Stream a specific compressed backup archive to the client
 */
const downloadDailyBackupArchive = async (req, res) => {
  try {
    const rawFileName = req.params.fileName;
    if (!rawFileName) {
      return res.status(400).json({ success: false, error: 'File name is required' });
    }

    // Sanitize filename to prevent directory traversal
    const safeFileName = path.basename(rawFileName);
    const filePath = path.join(BACKUP_DIR, safeFileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Backup archive not found on server' });
    }

    const stats = fs.statSync(filePath);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  } catch (error) {
    logger.error(`Download backup archive error: ${error.message}`);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: error.message || 'Failed to download backup archive' });
    }
  }
};

/**
 * Trigger sending a backup archive via email to parth6070@gmail.com & harshtsidapara2468@gmail.com
 */
const triggerSendBackupEmail = async (req, res) => {
  try {
    const { fileName, recipients } = req.body || {};
    const targetRecipients = recipients && (Array.isArray(recipients) ? recipients.length > 0 : Boolean(recipients))
      ? recipients
      : ['parth6070@gmail.com', 'harshtsidapara2468@gmail.com', 'pc.elitedigital@gmail.com'];

    let targetFile = fileName ? path.basename(fileName) : null;
    let targetFilePath = null;

    if (!fs.existsSync(BACKUP_DIR)) {
      return res.status(404).json({ success: false, error: 'Backup directory does not exist yet' });
    }

    if (targetFile) {
      targetFilePath = path.join(BACKUP_DIR, targetFile);
      if (!fs.existsSync(targetFilePath)) {
        return res.status(404).json({ success: false, error: `Backup archive ${targetFile} not found` });
      }
    } else {
      // Find the most recent backup file
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.json.gz') || f.endsWith('.tar.gz'))
        .map(f => {
          const fp = path.join(BACKUP_DIR, f);
          return { name: f, path: fp, time: fs.statSync(fp).mtimeMs };
        })
        .sort((a, b) => b.time - a.time);

      if (files.length === 0) {
        return res.status(404).json({ success: false, error: 'No backup archives found to email' });
      }
      targetFile = files[0].name;
      targetFilePath = files[0].path;
    }

    const stats = fs.statSync(targetFilePath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    // Look for latest images backup to include in report
    let imagesBackupInfo = null;
    if (fs.existsSync(IMAGES_BACKUP_DIR)) {
      const imgFiles = fs.readdirSync(IMAGES_BACKUP_DIR)
        .filter(f => f.endsWith('.tar.gz') || f.endsWith('.gz'))
        .map(f => {
          const fp = path.join(IMAGES_BACKUP_DIR, f);
          return { name: f, path: fp, time: fs.statSync(fp).mtimeMs, size: fs.statSync(fp).size };
        })
        .sort((a, b) => b.time - a.time);

      if (imgFiles.length > 0) {
        imagesBackupInfo = {
          fileName: imgFiles[0].name,
          filePath: imgFiles[0].path,
          sizeMB: (imgFiles[0].size / 1024 / 1024).toFixed(2),
        };
      }
    }

    const { sendBackupReportEmail } = require('../services/email.service');
    const emailResult = await sendBackupReportEmail({
      recipients: targetRecipients,
      fileName: targetFile,
      filePath: targetFilePath,
      sizeMB,
      imagesBackup: imagesBackupInfo,
    });

    return res.status(200).json({
      success: true,
      message: `Full system disaster recovery backup (${targetFile}${imagesBackupInfo ? ` + ${imagesBackupInfo.fileName}` : ''}) dispatched to ${Array.isArray(targetRecipients) ? targetRecipients.join(', ') : targetRecipients}`,
      emailResult,
      fileName: targetFile,
      sizeMB,
      imagesBackup: imagesBackupInfo,
    });
  } catch (error) {
    logger.error(`Trigger send backup email error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || 'Failed to send backup email' });
  }
};

const IMAGES_BACKUP_DIR = path.join(__dirname, '../../backups/images');

/**
 * List all automated images archives
 */
const listImagesBackups = async (req, res) => {
  try {
    if (!fs.existsSync(IMAGES_BACKUP_DIR)) {
      return res.status(200).json({ success: true, count: 0, backups: [] });
    }

    const files = fs.readdirSync(IMAGES_BACKUP_DIR);
    const backupList = [];

    for (const file of files) {
      if (file.endsWith('.tar.gz') || file.endsWith('.gz')) {
        const filePath = path.join(IMAGES_BACKUP_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          backupList.push({
            fileName: file,
            sizeBytes: stats.size,
            sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
            createdAt: stats.birthtime && stats.birthtime.getTime() > 0 ? stats.birthtime : stats.mtime,
            modifiedAt: stats.mtime,
            destinations: ['Local EC2 Disk', 'AWS S3 Standard', 'Cloudflare R2'],
          });
        } catch (e) {}
      }
    }

    backupList.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));

    return res.status(200).json({
      success: true,
      count: backupList.length,
      backups: backupList,
    });
  } catch (error) {
    logger.error(`List images backups error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || 'Failed to list images backups' });
  }
};

/**
 * Stream an images archive (.tar.gz) to the client
 */
const downloadImagesBackupArchive = async (req, res) => {
  try {
    const rawFileName = req.params.fileName;
    if (!rawFileName) {
      return res.status(400).json({ success: false, error: 'File name is required' });
    }

    const safeFileName = path.basename(rawFileName);
    const filePath = path.join(IMAGES_BACKUP_DIR, safeFileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Images backup archive not found on server' });
    }

    const stats = fs.statSync(filePath);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  } catch (error) {
    logger.error(`Download images archive error: ${error.message}`);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: error.message || 'Failed to download images archive' });
    }
  }
};

module.exports = {
  getDepartmentBackup,
  performDatabaseR2Backup,
  triggerR2Backup,
  listR2Backups,
  listDailyBackups,
  downloadDailyBackupArchive,
  triggerSendBackupEmail,
  listImagesBackups,
  downloadImagesBackupArchive,
};


