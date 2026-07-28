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

async function fixNegativeAndRemnants() {
  await mongoose.connect(MONGODB_URL);
  console.log('Connected to MongoDB');

  // Delete existing Remnant Stock Auto-Clear transactions so we get pure raw balances
  const deleted = await FabricTransaction.deleteMany({ notes: /Remnant Stock Auto-Clear/i });
  console.log(`Deleted ${deleted.deletedCount} old auto-clear transactions.`);

  // Aggregate lot balances strictly by lotNo
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
      console.log(`Lot #${lot.lotNo} (${lot.fabricQuality}): Balance is +${net.toFixed(2)} mtr (0 < net <= 5m). Creating auto-clear to zero out balance...`);
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
      console.log(`Lot #${lot.lotNo} (${lot.fabricQuality}): Negative balance of ${net.toFixed(2)} mtr PRESERVED!`);
    }
  }

  console.log(`\n================ RESULT SUMMARY ================`);
  console.log(`Lots zeroed out (0 < stock <= 5m): ${autoClearedCount}`);
  console.log(`Lots preserved with negative stock (< 0): ${negativeCount}`);
  console.log(`===============================================`);

  await mongoose.disconnect();
}

fixNegativeAndRemnants().catch(err => {
  console.error(err);
  process.exit(1);
});
