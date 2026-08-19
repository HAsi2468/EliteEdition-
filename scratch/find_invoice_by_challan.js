const mongoose = require('mongoose');
const config = require('../src/config/config');
const { BillingInvoice, JobCard, Design, FabricChallan } = require('../src/db/models');

async function searchInvoice() {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  console.log('Connected to MongoDB');

  const invs = await BillingInvoice.find({
    $or: [
      { invoiceNo: { $regex: /297/ } },
      { ourChallanNo: { $regex: /783/ } }
    ]
  }).lean();

  console.log(`Found ${invs.length} matching invoices:`);
  for (const inv of invs) {
    console.log('\n--- INVOICE ---');
    console.log('InvoiceNo:', inv.invoiceNo);
    console.log('ourChallanNo:', inv.ourChallanNo);
    console.log('Items count:', inv.items.length);

    for (let i = 0; i < inv.items.length; i++) {
      const item = inv.items[i];
      console.log(`\n  Item ${i + 1}:`, item.itemName);
      console.log('    description:', item.description);
      console.log('    jobNo:', item.jobNo);
      console.log('    ourChallanNo:', item.ourChallanNo);
      console.log('    imageUrl:', item.imageUrl);

      // Search matching FabricChallan for item.ourChallanNo (e.g. EDP-783)
      const chNum = (item.ourChallanNo || item.description || '').match(/EDP-(\d+)/i);
      if (chNum) {
        const challanDoc = await FabricChallan.findOne({ challanNo: parseInt(chNum[1], 10) }).lean();
        if (challanDoc) {
          console.log(`    Matching FabricChallan #${chNum[1]}: jobNo="${challanDoc.jobNo}", designNo="${challanDoc.designNo}", designImage="${challanDoc.designImage}"`);

          // Extract job card numbers from challanDoc.jobNo
          const jNums = String(challanDoc.jobNo || '').match(/\d+/g) || [];
          console.log('    Challan Job Cards:', jNums);

          for (const jn of jNums) {
            const jDoc = await JobCard.findOne({
              $or: [
                { jobNo: jn },
                { jobNo: `JOB-${jn}` },
                { jobNo: `JOB NO.- ${jn}` },
                { jobNo: `JOB NO.-${jn}` }
              ]
            }).lean();
            if (jDoc) {
              console.log(`      JobCard #${jn}: designNo="${jDoc.designNo}", designName="${jDoc.designName}", img1="${jDoc.imageUrl1}", img2="${jDoc.imageUrl2}"`);
            } else {
              console.log(`      JobCard #${jn} NOT found in DB`);
            }
          }
        } else {
          console.log(`    FabricChallan #${chNum[1]} NOT found in DB`);
        }
      }
    }
  }

  await mongoose.disconnect();
}

searchInvoice().catch(err => console.error(err));
