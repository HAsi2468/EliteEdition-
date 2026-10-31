const logger = require('../config/logger');
const db = require('../db/models');

/**
 * Automatically purges QA testing artifacts created during audits and smoke tests.
 * Resolves left-over QA test rows:
 * - 9 EDP QA-TEST raw materials (with opening qty 99999999999999)
 * - Scan & Pack QA-TEST records
 * - Inward challan CH-3010-01
 * - Old print log #QA-TEST-JC1
 * - Leftover QA complaints (EDP-COMP-1010, EO-COMP-1001, QA-TEST-*)
 * - Leftover QA users and facilities
 */
const purgeAllQaTestArtifacts = async () => {
  try {
    const qaRegex = /QA-TEST/i;

    await Promise.allSettled([
      // 1. Raw Materials with QA-TEST or absurd quantities
      db.RawMaterialTransaction?.deleteMany({
        $or: [
          { materialName: qaRegex },
          { remarks: qaRegex },
          { qty: { $gt: 10000000 } }
        ]
      }),

      // 2. Scan Logs
      db.ScanLog?.deleteMany({
        $or: [
          { awb: qaRegex },
          { sku: qaRegex },
          { itemName: qaRegex },
          { remarks: qaRegex }
        ]
      }),

      // 3. Fabric & Delivery Challans (including CH-3010-01)
      db.FabricChallan?.deleteMany({
        $or: [
          { challanNo: 'CH-3010-01' },
          { challanNo: qaRegex },
          { partyName: qaRegex },
          { notes: qaRegex }
        ]
      }),
      db.DeliveryChallan?.deleteMany({
        $or: [
          { challanNo: 'CH-3010-01' },
          { challanNo: qaRegex },
          { partyName: qaRegex },
          { notes: qaRegex }
        ]
      }),

      // 4. Print Logs
      db.JobPrintLog?.deleteMany({
        $or: [
          { jobNo: qaRegex },
          { notes: qaRegex }
        ]
      }),
      db.DocumentPrintLog?.deleteMany({
        $or: [
          { docNo: qaRegex },
          { notes: qaRegex }
        ]
      }),

      // 5. Leftover QA Complaints
      db.Complaint?.deleteMany({
        $or: [
          { complaintNo: /EDP-COMP-1010|EO-COMP-1001/i },
          { complaintNo: qaRegex },
          { partyName: qaRegex },
          { title: qaRegex }
        ]
      }),

      // 6. QA Job Cards & Products
      db.JobCard?.deleteMany({
        $or: [
          { party: qaRegex },
          { designName: qaRegex },
          { jobNo: qaRegex }
        ]
      }),
      db.Product?.deleteMany({
        $or: [
          { name: qaRegex },
          { sku: qaRegex }
        ]
      }),

      // 7. QA Inventory & Items
      db.Inventory?.deleteMany({
        $or: [
          { name: qaRegex },
          { sku: qaRegex }
        ]
      }),
      db.BillingItem?.deleteMany({
        $or: [
          { name: qaRegex },
          { sku: qaRegex }
        ]
      }),

      // 8. QA Test Users & Facilities
      db.User?.deleteMany({
        $or: [
          { email: /qa-test-viewer/i },
          { email: qaRegex },
          { username: qaRegex }
        ]
      }),
      db.Facility?.deleteMany({
        $or: [
          { name: qaRegex },
          { code: 'QAT' },
          { code: qaRegex }
        ]
      })
    ]);

    logger.info('[QA-CLEANUP] Automated QA test artifact purge executed on startup.');
  } catch (error) {
    logger.warn('[QA-CLEANUP] Purge warning: ' + error.message);
  }
};

module.exports = { purgeAllQaTestArtifacts };
