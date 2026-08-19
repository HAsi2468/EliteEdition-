const mongoose = require('mongoose');
const config = require('../src/config/config');
const { BillingInvoice } = require('../src/db/models');

async function findInvoices() {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  console.log('Connected to MongoDB');

  const invs = await BillingInvoice.find({}, 'invoiceNo ourChallanNo items').sort({ created_at: -1 }).limit(10).lean();
  console.log('Recent Invoices:');
  invs.forEach(i => {
    console.log(`InvoiceNo: "${i.invoiceNo}" | OurChallanNo: "${i.ourChallanNo}" | Items: ${i.items.length}`);
  });

  await mongoose.disconnect();
}

findInvoices().catch(err => console.error(err));
