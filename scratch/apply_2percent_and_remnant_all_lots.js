const globalCrypto = require('crypto');
if (!global.crypto) global.crypto = globalCrypto;
const mongoose = require('mongoose');

const MONGODB_URL = 'mongodb+srv://Elite_edition:Elite_edition6070@cluster0.h38kxpm.mongodb.net/elite_edition?retryWrites=true&w=majority';

const FabricTransactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['INWARD', 'OUTWARD'], required: true },
  challanNo: { type: String },
  vendorName: { type: String },
  jobNo: { type: String },
  partyName: { type: String },
  fabricQuality: { type: String, required: true },
  panna: { type: String, default: '58' },
  lotNo: { type: Number },
  qty: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  notes: { type: String },
  shortagePct: { type: Number }
}, { timestamps: true, collection: 'fabricTransactions' });

const FabricTransaction = mongoose.model('FabricTransaction', FabricTransactionSchema);

async function applyAllOutward2Percent() {
  await mongoose.connect(MONGODB_URL);
  console.log('Connected to MongoDB');

  // Find all OUTWARD transactions that do NOT yet have '+2%' in their notes, and are not auto-clear transactions
  const outwards = await FabricTransaction.find({
    type: 'OUTWARD',
    notes: { $not: /Remnant Stock Auto-Clear/i }
  });

  console.log(`Found ${outwards.length} outward transactions.`);

  let updatedCount = 0;
  for (const t of outwards) {
    if (!(t.notes || '').includes('+2%')) {
      const oldQty = t.qty;
      const newQty = Number((oldQty * 1.02).toFixed(2));
      t.qty = newQty;
      t.notes = (t.notes ? t.notes + ' ' : '') + '(+2% Shortage Applied)';
      await t.save();
      updatedCount++;
      console.log(`Updated Outward Tx [Lot #${t.lotNo || 'N/A'}, Quality: ${t.fabricQuality}]: ${oldQty} m -> ${newQty} m (+2%)`);
    }
  }

  console.log(`\nUpdated ${updatedCount} outward transactions with +2% shortage!`);

  // Now remove previous auto-clear transactions and re-evaluate remnant auto-clear for all lots <= 5.0m
  await FabricTransaction.deleteMany({ notes: /Remnant Stock Auto-Clear/i });

  const lotBalances = await FabricTransaction.aggregate([
    { $match: { lotNo: { $ne: null } } },
    {
      $group: {
        _id: '$lotNo',
        fabricQuality: { $first: '$fabricQuality' },
        panna: { $first: '$panna' },
        totalIn: { $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] } },
        totalOut: { $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] } }
      }
    },
    {
      $project: {
        lotNo: '$_id',
        fabricQuality: 1,
        panna: 1,
        totalIn: 1,
        totalOut: 1,
        currentStock: { $subtract: ['$totalIn', '$totalOut'] }
      }
    },
    { $sort: { lotNo: 1 } }
  ]);

  let autoClearedCount = 0;
  for (const lot of lotBalances) {
    const net = lot.currentStock;
    if (net <= 5.0) {
      console.log(`Lot #${lot.lotNo} (${lot.fabricQuality}): TotalIn=${lot.totalIn.toFixed(2)}, TotalOut=${lot.totalOut.toFixed(2)}, Net=${net.toFixed(2)} mtr (<= 5m). Zeroing balance...`);

      if (net > 0) {
        const scrapTx = new FabricTransaction({
          type: 'OUTWARD',
          fabricQuality: lot.fabricQuality || 'UNSPECIFIED',
          panna: lot.panna || '58',
          lotNo: lot.lotNo,
          qty: Number(net.toFixed(2)),
          date: new Date(),
          notes: 'Remnant Stock Auto-Clear (<= 5m remaining converted to 0)'
        });
        await scrapTx.save();
        autoClearedCount++;
      }
    }
  }

  console.log(`\nCreated ${autoClearedCount} remnant auto-clear transactions for lots <= 5.0m!`);

  await mongoose.disconnect();
}

applyAllOutward2Percent().catch(err => {
  console.error(err);
  process.exit(1);
});
