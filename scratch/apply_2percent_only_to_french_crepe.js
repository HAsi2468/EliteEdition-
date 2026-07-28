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

function isFrenchCrepe(quality) {
  if (!quality) return false;
  const q = quality.trim().toUpperCase();
  return q.includes('CREP') || q.includes('CRAPE') || q.includes('FRENCH');
}

async function updateFrenchCrepeOnly() {
  await mongoose.connect(MONGODB_URL);
  console.log('Connected to MongoDB');

  // Delete remnant auto-clear transactions first
  await FabricTransaction.deleteMany({ notes: /Remnant Stock Auto-Clear/i });

  // Get all OUTWARD transactions
  const outwards = await FabricTransaction.find({ type: 'OUTWARD' });
  console.log(`Processing ${outwards.length} outward transactions...`);

  let frenchCrepeCount = 0;
  let nonFrenchCrepeReverted = 0;

  for (const t of outwards) {
    const isFc = isFrenchCrepe(t.fabricQuality);

    if (!isFc) {
      // Revert non-French Crepe outwards if (+2% Shortage Applied) was present
      if ((t.notes || '').includes('Shortage Applied') || (t.notes || '').includes('+2%')) {
        const oldQty = t.qty;
        const revertedQty = Number((oldQty / 1.02).toFixed(2));
        t.qty = revertedQty;
        t.notes = (t.notes || '').replace(/\(\+2% Shortage Applied\)/g, '').replace(/\(\+2% French Crepe Applied\)/g, '').trim();
        await t.save();
        nonFrenchCrepeReverted++;
        console.log(`Reverted non-French Crepe Outward [Lot #${t.lotNo || 'N/A'}, ${t.fabricQuality}]: ${oldQty} m -> ${revertedQty} m`);
      }
    } else {
      // Ensure French Crepe has +2% applied
      if (!(t.notes || '').includes('+2%')) {
        const oldQty = t.qty;
        const newQty = Number((oldQty * 1.02).toFixed(2));
        t.qty = newQty;
        t.notes = (t.notes ? t.notes + ' ' : '') + '(+2% French Crepe Applied)';
        await t.save();
        frenchCrepeCount++;
        console.log(`Applied +2% to French Crepe Outward [Lot #${t.lotNo || 'N/A'}, ${t.fabricQuality}]: ${oldQty} m -> ${newQty} m`);
      } else {
        frenchCrepeCount++;
      }
    }
  }

  console.log(`\nReverted ${nonFrenchCrepeReverted} non-French Crepe dispatches back to exact meters.`);
  console.log(`Total French Crepe dispatches with +2%: ${frenchCrepeCount}`);

  // Re-evaluate remnant stock zeroing for 0 < stock <= 5.0m
  const lotBalances = await FabricTransaction.aggregate([
    { $match: { lotNo: { $ne: null } } },
    {
      $group: {
        _id: '$lotNo',
        fabricQuality: { $first: '$fabricQuality' },
        panna: { $first: '$panna' },
        vendorName: { $first: '$vendorName' },
        totalIn: { $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] } },
        totalOut: { $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] } }
      }
    },
    {
      $project: {
        lotNo: '$_id',
        fabricQuality: 1,
        panna: 1,
        vendorName: 1,
        totalIn: 1,
        totalOut: 1,
        currentStock: { $subtract: ['$totalIn', '$totalOut'] }
      }
    },
    { $sort: { lotNo: 1 } }
  ]);

  let autoClearedCount = 0;
  let negativeCount = 0;

  for (const lot of lotBalances) {
    const net = lot.currentStock;
    if (net > 0 && net <= 5.0) {
      console.log(`Lot #${lot.lotNo} (${lot.fabricQuality}): Positive balance +${net.toFixed(2)} m (0 < stock <= 5m). Creating auto-clear transaction...`);
      const scrapTx = new FabricTransaction({
        type: 'OUTWARD',
        fabricQuality: lot.fabricQuality || 'UNSPECIFIED',
        panna: lot.panna || '58',
        lotNo: lot.lotNo,
        qty: Number(net.toFixed(2)),
        date: new Date(),
        notes: 'Remnant Stock Auto-Clear (0 < stock <= 5m converted to 0)'
      });
      await scrapTx.save();
      autoClearedCount++;
    } else if (net < 0) {
      negativeCount++;
    }
  }

  console.log(`\n================ SUMMARY ================`);
  console.log(`Lots zeroed out (0 < stock <= 5m): ${autoClearedCount}`);
  console.log(`Lots with negative stock (< 0): ${negativeCount}`);
  console.log(`=========================================`);

  await mongoose.disconnect();
}

updateFrenchCrepeOnly().catch(err => {
  console.error(err);
  process.exit(1);
});
