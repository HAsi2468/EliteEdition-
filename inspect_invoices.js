global.crypto = require('crypto');
const db = require('./src/db/models');

async function inspectInvoices() {
  try {
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const invs = await db.BillingInvoice.find({
      invoiceNo: { $in: ['EDP/26-27/340', 'EDP/26-27/341'] }
    }).lean();

    console.log('=== DETAILED INVOICES FOR EDP-903, EDP-904 & EDP-906 ===');
    console.log(JSON.stringify(invs, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

inspectInvoices();
