const mongoose = require('mongoose');
const config = require('../src/config/config');
const { BillingInvoice, FabricChallan, JobCard, Design } = require('../src/db/models');

async function deepSearch() {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  console.log('Connected to MongoDB');

  // Search FabricChallan for 783
  const challan783 = await FabricChallan.findOne({ challanNo: 783 }).lean();
  console.log('Challan 783:', JSON.stringify(challan783, null, 2));

  // Search JobCard for 2253
  const job2253 = await JobCard.findOne({
    $or: [{ jobNo: '2253' }, { jobNo: 'JOB-2253' }, { jobNo: 'JOB NO.- 2253' }]
  }).lean();
  console.log('JobCard 2253:', JSON.stringify(job2253, null, 2));

  // Search Invoice containing 783 or 2253 in any string field
  const allInvs = await BillingInvoice.find({}).lean();
  console.log(`Total Invoices in MongoDB: ${allInvs.length}`);

  const matchedInv = allInvs.find(inv => {
    const jsonStr = JSON.stringify(inv);
    return jsonStr.includes('783') || jsonStr.includes('2253') || jsonStr.includes('297');
  });

  if (matchedInv) {
    console.log('MATCHED INVOICE:', JSON.stringify(matchedInv, null, 2));
  } else {
    console.log('No invoice found matching 783, 2253, or 297');
  }

  await mongoose.disconnect();
}

deepSearch().catch(err => console.error(err));
