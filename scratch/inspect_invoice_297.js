const mongoose = require('mongoose');
const config = require('../src/config/config');
const { BillingInvoice, JobCard, Design, FabricChallan } = require('../src/db/models');

async function inspectInvoice297() {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  console.log('Connected to MongoDB');

  const inv = await BillingInvoice.findOne({ invoiceNo: { $regex: /297$/ } }).lean();
  if (!inv) {
    console.log('Invoice 297 not found');
    await mongoose.disconnect();
    return;
  }

  console.log('--- INVOICE 297 FOUND ---');
  console.log('Invoice No:', inv.invoiceNo);
  console.log('Items Count:', inv.items.length);

  for (let i = 0; i < inv.items.length; i++) {
    const item = inv.items[i];
    console.log(`\nItem ${i + 1}:`, item.itemName);
    console.log('  jobNo:', item.jobNo);
    console.log('  ourChallanNo:', item.ourChallanNo);
    console.log('  imageUrl:', item.imageUrl);

    // Extract job card numbers from jobNo or description
    const jobNums = String(item.jobNo || item.description || '').match(/\d+/g) || [];
    console.log('  Extracted Job Numbers:', jobNums);

    if (jobNums.length > 0) {
      const foundJobs = await JobCard.find({
        $or: jobNums.map(n => ({
          $or: [
            { jobNo: n },
            { jobNo: `JOB-${n}` },
            { jobNo: `JOB NO.- ${n}` },
            { jobNo: `JOB NO.-${n}` }
          ]
        })).flat()
      }, 'jobNo designNo designName imageUrl1 imageUrl2').lean();

      console.log('  Found JobCards count:', foundJobs.length);
      foundJobs.forEach(j => {
        console.log(`    Job #${j.jobNo}: designNo="${j.designNo}", designName="${j.designName}", img1="${j.imageUrl1}", img2="${j.imageUrl2}"`);
      });

      // Check design catalog for those design numbers
      const designNames = foundJobs.map(j => j.designNo || j.designName).filter(Boolean);
      console.log('  Associated Design Names:', designNames);

      for (const dName of designNames) {
        const cleanName = String(dName).replace(/^ED-/i, '');
        const dDoc = await Design.findOne({
          $or: [
            { designName: { $regex: new RegExp(`^(ED-)?${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
            { designNo: { $regex: new RegExp(`^(ED-)?${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
          ]
        }, 'designName designNo imageUrl imageUrl2').lean();

        if (dDoc) {
          console.log(`    Found Design Catalog Doc for "${dName}": img1="${dDoc.imageUrl}", img2="${dDoc.imageUrl2}"`);
        } else {
          console.log(`    No Design Catalog Doc found for "${dName}"`);
        }
      }
    }
  }

  await mongoose.disconnect();
}

inspectInvoice297().catch(err => {
  console.error(err);
  process.exit(1);
});
