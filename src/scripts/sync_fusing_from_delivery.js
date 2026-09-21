const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URL);

  const JobCard = require('../db/models/jobCard.model');

  const filter = {
    $or: [
      { deliveredMtr: { $gt: 0 } },
      { 'invoices.0': { $exists: true } },
      { deliveryStatus: 'Delivery Done' }
    ]
  };

  const cards = await JobCard.find(filter);
  console.log(`Found ${cards.length} cards matching delivered/invoiced criteria.`);

  let updatedCount = 0;
  for (const card of cards) {
    let delMtr = card.deliveredMtr || 0;
    if (!delMtr && Array.isArray(card.invoices) && card.invoices.length > 0) {
      delMtr = card.invoices.reduce((sum, inv) => sum + (Number(inv.meters) || 0), 0);
      delMtr = Math.round(delMtr * 100) / 100;
    }
    if (!delMtr && card.deliveryStatus === 'Delivery Done') {
      const m = String(card.totalMtr || card.consumption || '0').match(/[\d.]+/);
      if (m) delMtr = parseFloat(m[0]);
    }

    let invDate = card.deliveryDate || '';
    if (!invDate && Array.isArray(card.invoices) && card.invoices.length > 0) {
      const sorted = [...card.invoices].sort((a, b) => new Date(b.date) - new Date(a.date));
      if (sorted[0]?.date) {
        const dt = new Date(sorted[0].date);
        if (!isNaN(dt.getTime())) {
          invDate = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        }
      }
    }

    let modified = false;

    // 1. Write delivery mtr in Fusing mtr
    if (delMtr > 0) {
      const delMtrStr = String(delMtr);
      if (card.fusingMtr !== delMtrStr) {
        card.fusingMtr = delMtrStr;
        modified = true;
      }
    }

    // 2. Change fusing status to Fusing Done
    if (delMtr > 0 || card.deliveryStatus === 'Delivery Done') {
      if (card.fusingStatus !== 'Fusing Done') {
        card.fusingStatus = 'Fusing Done';
        modified = true;
      }
    }

    // 3. Date put same as in invoice
    if (invDate && card.fusingDate !== invDate) {
      card.fusingDate = invDate;
      modified = true;
    }

    if (modified) {
      if (card.deliveryStatus === 'Delivery Done' && card.status !== 'Done') {
        card.status = 'Done';
      }
      await card.save();
      updatedCount++;
    }
  }

  console.log(`\n==============================================`);
  console.log(`✅ Fusing sync complete! Updated ${updatedCount} out of ${cards.length} cards.`);
  console.log(`==============================================\n`);
  process.exit(0);
}

run().catch(err => {
  console.error('Error syncing fusing from delivery:', err);
  process.exit(1);
});
