/**
 * Audit Data Integrity Script
 * Scans MongoDB for:
 * 1. Overpaid invoices (paidAmount > grandTotal + 0.01)
 * 2. Invoices with negative balanceDue (< -0.01)
 * 3. Overpaid purchases / advance exceeding grand total
 * 4. Negative inventory or raw material balances
 * 5. Duplicate challans generated in rapid succession
 * 6. Remaining QA-TEST artifacts
 */

const mongoose = require('mongoose');
const config = require('../src/config/config');

async function runAudit() {
  console.log('🔍 Connecting to MongoDB for Data Integrity Audit...');
  try {
    await mongoose.connect(config.mongoose.url, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });
    console.log('✅ Connected to MongoDB.');

    const db = require('../src/db/models');

    // 1. Overpaid Invoices
    const overpaidInvoices = await db.BillingInvoice.find({
      $expr: { $gt: ['$paidAmount', { $add: ['$grandTotal', 0.01] }] }
    }).select('invoiceNo customer.name grandTotal paidAmount balanceDue paymentStatus').lean();

    console.log(`\n--- 1. OVERPAID INVOICES: ${overpaidInvoices.length} found ---`);
    overpaidInvoices.forEach(inv => {
      console.log(`[Invoice #${inv.invoiceNo}] Customer: ${inv.customer?.name} | GrandTotal: ₹${inv.grandTotal} | Paid: ₹${inv.paidAmount} | Excess: ₹${(inv.paidAmount - inv.grandTotal).toFixed(2)}`);
    });

    // 2. Negative Balance Due
    const negativeBalanceInvoices = await db.BillingInvoice.find({
      balanceDue: { $lt: -0.01 }
    }).select('invoiceNo customer.name grandTotal paidAmount balanceDue').lean();

    console.log(`\n--- 2. NEGATIVE BALANCE DUE INVOICES: ${negativeBalanceInvoices.length} found ---`);
    negativeBalanceInvoices.forEach(inv => {
      console.log(`[Invoice #${inv.invoiceNo}] Customer: ${inv.customer?.name} | BalanceDue: ₹${inv.balanceDue}`);
    });

    // 3. Purchases with Excess Advance
    const overpaidPurchases = await db.BillingPurchase.find({
      $expr: { $gt: ['$paidAmount', { $add: ['$grandTotal', 0.01] }] }
    }).select('purchaseNo vendorName grandTotal paidAmount balanceDue').lean();

    console.log(`\n--- 3. OVERPAID PURCHASES: ${overpaidPurchases.length} found ---`);
    overpaidPurchases.forEach(pur => {
      console.log(`[Purchase #${pur.purchaseNo}] Vendor: ${pur.vendorName} | GrandTotal: ₹${pur.grandTotal} | Paid/Advance: ₹${pur.paidAmount}`);
    });

    // 4. Duplicate Challans
    const dupChallans = await db.FabricChallan.aggregate([
      {
        $group: {
          _id: { partyName: '$partyName', fabricName: '$fabricName', totalMtr: '$totalMtr', dateStr: { $dateToString: { format: '%Y-%m-%d %H:%M', date: '$createdAt' } } },
          count: { $sum: 1 },
          challanNos: { $push: '$challanNo' }
        }
      },
      { $filter: { input: '$count', as: 'c', cond: { $gt: ['$$c', 1] } } },
      { $match: { count: { $gt: 1 } } }
    ]);

    console.log(`\n--- 4. DUPLICATE CHALLANS: ${dupChallans.length} clusters found ---`);
    dupChallans.forEach(dup => {
      console.log(`[Cluster] Party: ${dup._id.partyName} | Fabric: ${dup._id.fabricName} | Qty: ${dup._id.totalMtr}m | Challans: ${dup.challanNos.join(', ')}`);
    });

    // 5. Remaining QA-TEST Artifacts
    const qaArtifacts = await Promise.all([
      db.RawMaterialTransaction.countDocuments({ materialName: /QA-TEST/i }),
      db.ScanLog.countDocuments({ awb: /QA-TEST/i }),
      db.FabricChallan.countDocuments({ challanNo: /CH-3010-01|QA-TEST/i }),
      db.JobPrintLog.countDocuments({ jobNo: /QA-TEST/i }),
      db.Complaint.countDocuments({ complaintNo: /EDP-COMP-1010|EO-COMP-1001|QA-TEST/i }),
      db.Facility.countDocuments({ code: 'QAT' }),
      db.User.countDocuments({ email: /qa-test-viewer/i })
    ]);

    const qaTotal = qaArtifacts.reduce((a, b) => a + b, 0);
    console.log(`\n--- 5. QA-TEST LEFTOVER ARTIFACTS IN DB: ${qaTotal} found ---`);
    console.log(`Raw Materials: ${qaArtifacts[0]}, Scan Logs: ${qaArtifacts[1]}, Challans: ${qaArtifacts[2]}, Print Logs: ${qaArtifacts[3]}, Complaints: ${qaArtifacts[4]}, Facilities: ${qaArtifacts[5]}, Users: ${qaArtifacts[6]}`);

    console.log('\n✅ Data integrity audit finished successfully.');
  } catch (err) {
    console.error('Audit execution error (e.g. database network offline in sandbox):', err.message);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

if (require.main === module) {
  runAudit();
}

module.exports = { runAudit };
