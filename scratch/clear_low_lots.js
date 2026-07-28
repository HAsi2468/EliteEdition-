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

async function clearLowLots() {
  await mongoose.connect(MONGODB_URL);
  console.log('Connected to MongoDB');

  // Aggregate strictly by lotNo
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

  console.log('\nChecking lots with remaining stock <= 10.0 mtr...');
  let clearedCount = 0;

  for (const lot of lotBalances) {
    const net = lot.currentStock;
    if (net > 0 && net <= 10.0) {
      console.log(`Lot #${lot.lotNo} (${lot.fabricQuality}): ${net.toFixed(2)} mtr remaining. Creating outward auto-clear transaction...`);

      const scrapTx = new FabricTransaction({
        type: 'OUTWARD',
        fabricQuality: lot.fabricQuality || 'UNSPECIFIED',
        panna: lot.panna || '58',
        lotNo: lot.lotNo,
        qty: Number(net.toFixed(2)),
        date: new Date(),
        notes: 'Remnant Stock Auto-Clear (<= 10m remaining converted to 0)'
      });

      await scrapTx.save();
      clearedCount++;
    }
  }

  console.log(`\nSuccessfully auto-cleared ${clearedCount} lots with <= 10.0 mtr remaining!`);

  await mongoose.disconnect();
}

clearLowLots().catch(err => {
  console.error(err);
  process.exit(1);
});
