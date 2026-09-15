global.crypto = require('crypto');
const db = require('./src/db/models');

async function checkSpecificChallans() {
  try {
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const challanNumbers = ['EDP-903', 'EDP-904', 'EDP-906'];
    
    console.log('----------------------------------------------------');
    console.log('CHECKING STATUS FOR CHALLAN NOS: EDP-903, EDP-904, EDP-906');
    console.log('----------------------------------------------------');

    for (const cNo of challanNumbers) {
      // Find Job Card
      const jc = await db.JobCard.findOne({
        $or: [
          { challanNo: cNo },
          { jobCardNo: cNo },
          { challanNumber: cNo }
        ]
      }).lean();

      // Find Invoices referencing this challan
      const invs = await db.BillingInvoice.find({
        $or: [
          { challanNo: cNo },
          { 'items.challanNo': cNo },
          { 'items.jobCardNo': cNo },
          { 'items.description': { $regex: cNo, $options: 'i' } },
          { notes: { $regex: cNo, $options: 'i' } }
        ]
      }).lean();

      console.log(`\n📌 CHALLAN NO: ${cNo}`);
      if (jc) {
        console.log(`   - Job Card ID / No : ${jc.jobCardNo || jc._id}`);
        console.log(`   - Party / Customer : ${jc.partyName || jc.customerName || 'N/A'}`);
        console.log(`   - Design / Fabric  : ${jc.designName || jc.fabricName || 'N/A'}`);
        console.log(`   - Total Meters/Qty : ${jc.totalMeters || jc.totalQty || 'N/A'}`);
        console.log(`   - Status           : ${jc.status || 'N/A'}`);
        console.log(`   - Invoiced Status  : ${jc.isInvoiced ? 'YES ✅' : 'NO ❌'}`);
        if (jc.invoiceNo) console.log(`   - Invoice Number   : ${jc.invoiceNo}`);
      } else {
        console.log(`   - Job Card Entry   : Not found in Job Card Master.`);
      }

      if (invs && invs.length > 0) {
        console.log(`   - INVOICE CREATED  : YES ✅ (${invs.length} Invoice(s) Found)`);
        invs.forEach(inv => {
          console.log(`     * Invoice No   : ${inv.invoiceNo}`);
          console.log(`     * Company      : ${inv.companyEntity}`);
          console.log(`     * Party Name   : ${inv.partyName}`);
          console.log(`     * Total Amount : ₹${inv.totalAmount}`);
          console.log(`     * Date         : ${inv.createdAt || inv.created_date_time}`);
        });
      } else {
        console.log(`   - INVOICE CREATED  : NO ❌ (No invoice created yet for ${cNo})`);
      }
    }

    // Also search in all BillingInvoices for any invoice that contains 903, 904, or 906
    console.log('\n----------------------------------------------------');
    console.log('SEARCHING ALL BILLING INVOICES FOR ANY REFERENCE TO 903, 904, 906');
    console.log('----------------------------------------------------');
    const allMatchingInvs = await db.BillingInvoice.find({
      $or: [
        { challanNo: /903|904|906/ },
        { 'items.challanNo': /903|904|906/ },
        { 'items.description': /903|904|906/ },
        { notes: /903|904|906/ }
      ]
    }).lean();

    if (allMatchingInvs.length === 0) {
      console.log('RESULT: 0 Invoices found matching EDP-903, EDP-904, or EDP-906 in BillingInvoices.');
    } else {
      console.log(`RESULT: Found ${allMatchingInvs.length} invoice(s):`);
      allMatchingInvs.forEach(inv => {
        console.log(`- Invoice No: ${inv.invoiceNo} | Party: ${inv.partyName} | Challan: ${inv.challanNo}`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkSpecificChallans();
