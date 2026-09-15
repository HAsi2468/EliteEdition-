global.crypto = require('crypto');
const db = require('./src/db/models');

async function checkChallans() {
  try {
    // Wait for Mongoose connection
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const targets = ['EDP-903', 'EDP-904', 'EDP-906', '903', '904', '906'];
    
    // 1. Search in JobCard collection
    const jobCards = await db.JobCard.find({ 
      $or: [
        { challanNo: { $regex: '903|904|906', $options: 'i' } },
        { jobCardNo: { $regex: '903|904|906', $options: 'i' } },
        { challanNumber: { $regex: '903|904|906', $options: 'i' } }
      ]
    }).lean();

    // 2. Search in StitchingChallan collection
    const stitchingChallans = await db.StitchingChallan.find({
      $or: [
        { challanNo: { $regex: '903|904|906', $options: 'i' } }
      ]
    }).lean();

    // 3. Search in BillingInvoice collection
    const invoices = await db.BillingInvoice.find({
      $or: [
        { challanNo: { $regex: '903|904|906', $options: 'i' } },
        { 'items.challanNo': { $regex: '903|904|906', $options: 'i' } },
        { 'items.jobCardNo': { $regex: '903|904|906', $options: 'i' } },
        { 'items.description': { $regex: '903|904|906', $options: 'i' } },
        { notes: { $regex: '903|904|906', $options: 'i' } }
      ]
    }).lean();

    // 4. Fetch all invoices from Elite Digital Print to cross check
    const printInvoices = await db.BillingInvoice.find({
      $or: [
        { companyEntity: 'Elite Digital Print' },
        { companyEntity: /digital print/i }
      ]
    }).sort({ createdAt: -1 }).limit(50).lean();

    console.log('=== JOB CARDS FOUND (903, 904, 906) ===');
    console.log(JSON.stringify(jobCards.map(j => ({
      _id: j._id,
      jobCardNo: j.jobCardNo,
      challanNo: j.challanNo,
      partyName: j.partyName || j.customerName,
      companyEntity: j.companyEntity,
      status: j.status,
      isInvoiced: j.isInvoiced,
      invoiceNo: j.invoiceNo,
      billNo: j.billNo,
      createdAt: j.createdAt || j.created_date_time
    })), null, 2));

    console.log('=== STITCHING CHALLANS FOUND ===');
    console.log(JSON.stringify(stitchingChallans, null, 2));

    console.log('=== MATCHING BILLING INVOICES ===');
    console.log(JSON.stringify(invoices.map(i => ({
      _id: i._id,
      invoiceNo: i.invoiceNo,
      companyEntity: i.companyEntity,
      partyName: i.partyName,
      challanNo: i.challanNo,
      items: i.items,
      totalAmount: i.totalAmount,
      status: i.status,
      createdAt: i.createdAt || i.created_date_time
    })), null, 2));

    console.log('=== ALL ELITE DIGITAL PRINT INVOICES (FOR VERIFICATION) ===');
    console.log(JSON.stringify(printInvoices.map(i => ({
      invoiceNo: i.invoiceNo,
      companyEntity: i.companyEntity,
      partyName: i.partyName,
      challanNo: i.challanNo,
      itemChallans: (i.items || []).map(it => it.challanNo || it.jobCardNo || it.description)
    })), null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error querying MongoDB:', err);
    process.exit(1);
  }
}

checkChallans();
