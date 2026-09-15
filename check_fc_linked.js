global.crypto = require('crypto');
const db = require('./src/db/models');

async function fixAndInspect() {
  try {
    await new Promise(r => setTimeout(r, 2500));

    const inv = await db.BillingInvoice.findOne({ invoiceNo: 'EDP/26-27/340' }).lean();
    console.log('Invoice EDP/26-27/340 linkedChallanIds:', inv.linkedChallanIds);

    for (const idStr of inv.linkedChallanIds) {
      const fc = await db.FabricChallan.findById(idStr).lean();
      console.log(`FabricChallan ${idStr}:`, fc ? { challanNo: fc.challanNo, status: fc.status, invoiceNo: fc.invoiceNo } : 'NOT FOUND BY ID');
    }

    // Also search FabricChallan by challanNo 903, 904, 906
    const fcsByNo = await db.FabricChallan.find({ challanNo: { $in: [903, 904, 906, '903', '904', '906', 'EDP-903', 'EDP-904', 'EDP-906'] } }).lean();
    console.log('\nFabricChallans found by challanNo:', fcsByNo.map(f => ({ _id: f._id, challanNo: f.challanNo, status: f.status, invoiceNo: f.invoiceNo })));

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

fixAndInspect();
