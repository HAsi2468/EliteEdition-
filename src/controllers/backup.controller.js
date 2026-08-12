const mongoose = require('mongoose');

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
  getDepartmentBackup
};
