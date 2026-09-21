const crypto = require('crypto');
if (!global.crypto) global.crypto = crypto;
const dns = require('dns');
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}
const mongoose = require('mongoose');
const config = require('../config/config');

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  console.log('Connected to MongoDB!');

  const BillingInvoice = require('../db/models/billingInvoice.model');
  const JobCard = require('../db/models/jobCard.model');

  // 1. Fetch all active (non-cancelled) invoices
  const invoices = await BillingInvoice.find({
    invoiceStatus: { $ne: 'CANCELLED' }
  }).select('_id invoiceNo invoiceDate items').lean();

  console.log(`Loaded ${invoices.length} active invoices.`);

  // 2. Map invoice items by normalized job number (digits)
  const jobInvoicesMap = new Map(); // digits -> array of invoice entries

  invoices.forEach(inv => {
    (inv.items || []).forEach(it => {
      if (!it.jobNo || !String(it.jobNo).trim()) return;

      // Split comma/slash/semicolon/and separated job numbers
      const rawJobParts = String(it.jobNo).split(/[,/;&|]+|\band\b/i).map(p => p.trim()).filter(Boolean);

      // Gather all distinct job keys from this line item
      const jobKeys = [];
      rawJobParts.forEach(p => {
        // Also handle dot-separated like 2762.2756 or 2258.2259
        const subParts = p.split(/\.(?=\d{3,})/).map(s => s.trim()).filter(Boolean);
        subParts.forEach(sp => {
          const digits = sp.replace(/[^\d]/g, '');
          if (digits) jobKeys.push({ digits, raw: sp });
        });
      });

      const totalLineQty = Number(it.qty) || 0;
      const totalLineAmt = Number(it.totalAmount) || 0;
      const numJobs = Math.max(1, jobKeys.length);

      jobKeys.forEach(({ digits, raw }) => {
        if (!jobInvoicesMap.has(digits)) {
          jobInvoicesMap.set(digits, []);
        }
        jobInvoicesMap.get(digits).push({
          invoiceId: inv._id,
          invoiceNo: inv.invoiceNo,
          date: inv.invoiceDate,
          meters: jobKeys.length > 1 ? 0 : totalLineQty,
          lineQty: totalLineQty,
          amount: Math.round((totalLineAmt / numJobs) * 100) / 100,
          rawJobNo: raw
        });
      });
    });
  });

  console.log(`Identified ${jobInvoicesMap.size} unique jobs referenced in billing invoices.`);

  // 3. Fetch all JobCards
  const allJobCards = await JobCard.find({});
  console.log(`Total JobCards in database: ${allJobCards.length}`);

  let updatedCount = 0;
  let multiInvoiceCount = 0;

  for (const card of allJobCards) {
    if (!card.jobNo) continue;
    const rawJob = String(card.jobNo).trim();
    const digits = rawJob.replace(/[^\d]/g, '');
    const key = digits || rawJob.toLowerCase();

    if (jobInvoicesMap.has(key)) {
      const invList = jobInvoicesMap.get(key);
      const uniqueBillNos = Array.from(new Set(invList.map(i => i.invoiceNo))).filter(Boolean);

      const targetMatch = String(card.totalMtr || card.consumption || '0').match(/[\d.]+/);
      const targetMtr = targetMatch ? parseFloat(targetMatch[0]) : 0;

      card.invoices = invList.map(i => {
        let mtr = i.meters;
        if (mtr <= 0 && i.lineQty > 0) {
          mtr = targetMtr > 0 ? targetMtr : i.lineQty;
        }
        return {
          invoiceId: i.invoiceId,
          invoiceNo: i.invoiceNo,
          date: i.date,
          meters: Math.round(mtr * 100) / 100,
          amount: i.amount
        };
      });

      const totalDeliveredMtr = card.invoices.reduce((sum, item) => sum + (item.meters || 0), 0);
      card.deliveredMtr = Math.round(totalDeliveredMtr * 100) / 100;
      card.billNo = uniqueBillNos.join(', ');

      if (targetMtr > 0 && totalDeliveredMtr >= targetMtr) {
        card.deliveryStatus = 'Delivery Done';
        if (card.status !== 'Done' && card.fusingStatus === 'Fusing Done') {
          card.status = 'Done';
        }
      }

      // Sync deliveryDate to latest invoice date
      if (invList.length > 0) {
        const sorted = [...invList].sort((a, b) => new Date(b.date) - new Date(a.date));
        if (sorted[0]?.date) {
          const dt = new Date(sorted[0].date);
          card.deliveryDate = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        }
      }

      await card.save();
      updatedCount++;
      if (invList.length > 1) {
        multiInvoiceCount++;
      }
    }
  }

  console.log(`\n==============================================`);
  console.log(`✅ Backfill Complete!`);
  console.log(`Total JobCards updated with invoice data: ${updatedCount}`);
  console.log(`JobCards with MULTIPLE invoices: ${multiInvoiceCount}`);
  console.log(`==============================================\n`);

  process.exit(0);
}

run().catch(err => {
  console.error('Backfill error:', err);
  process.exit(1);
});
