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
      digital_printing: ['jobCards', 'jobPrintLogs'],
      fabric: ['fabricChallans', 'fabricTransactions', 'fabricStockAdjustments'],
      stitching: ['stitching_challans', 'stitching_configs'],
      garment: ['garmentJobCards'],
      sales: ['sale_orders', 'products', 'inventory_products'],
      customers: ['vendors', 'partys', 'fabricVendors'],
      all: [
        'billinginvoices', 'billingcustomers', 'billingitems',
        'designs', 'jobCards', 'jobPrintLogs',
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

module.exports = {
  getDepartmentBackup,
  performDatabaseR2Backup,
  triggerR2Backup,
  listR2Backups,
};

