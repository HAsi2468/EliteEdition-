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
  const jobInvoicesMap = new Map(); // digits -> array of { invoiceId, invoiceNo, date, meters, amount, rawJobNo }

  invoices.forEach(inv => {
    (inv.items || []).forEach(it => {
      if (!it.jobNo || !String(it.jobNo).trim()) return;
      const rawJob = String(it.jobNo).trim();
      const digits = rawJob.replace(/[^\d]/g, '');
      const key = digits || rawJob.toLowerCase();

      if (!jobInvoicesMap.has(key)) {
        jobInvoicesMap.set(key, []);
      }
      jobInvoicesMap.get(key).push({
        invoiceId: inv._id,
        invoiceNo: inv.invoiceNo,
        date: inv.invoiceDate,
        meters: Number(it.qty) || 0,
        amount: Number(it.totalAmount) || 0,
        rawJobNo: rawJob
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
      const totalDeliveredMtr = invList.reduce((sum, item) => sum + (item.meters || 0), 0);
      const uniqueBillNos = Array.from(new Set(invList.map(i => i.invoiceNo))).filter(Boolean);

      card.invoices = invList.map(i => ({
        invoiceId: i.invoiceId,
        invoiceNo: i.invoiceNo,
        date: i.date,
        meters: i.meters,
        amount: i.amount
      }));
      card.deliveredMtr = Math.round(totalDeliveredMtr * 100) / 100;
      card.billNo = uniqueBillNos.join(', ');

      const targetMatch = String(card.totalMtr || card.consumption || '0').match(/[\d.]+/);
      const targetMtr = targetMatch ? parseFloat(targetMatch[0]) : 0;

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
