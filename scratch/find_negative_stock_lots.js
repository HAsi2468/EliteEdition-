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

async function findNegativeLots() {
  await mongoose.connect(MONGODB_URL);
  console.log('Connected to MongoDB');

  // Aggregate by lotNo excluding remnant auto-clears
  const rawBalances = await FabricTransaction.aggregate([
    { $match: { lotNo: { $ne: null }, notes: { $not: /Remnant Stock Auto-Clear/i } } },
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
        rawStock: { $subtract: ['$totalIn', '$totalOut'] }
      }
    },
    { $match: { rawStock: { $lt: 0 } } },
    { $sort: { lotNo: 1 } }
  ]);

  console.log(`\n================ ALL LOTS WITH NEGATIVE STOCK ================`);
  console.log(`Total Lots with Negative Balance: ${rawBalances.length}\n`);

  let totalNegMtr = 0;
  rawBalances.forEach((l, idx) => {
    totalNegMtr += l.rawStock;
    console.log(`${idx + 1}. Lot #${l.lotNo} [${l.fabricQuality} | Panna ${l.panna} | Vendor: ${l.vendorName || 'N/A'}]`);
    console.log(`   Inward: +${l.totalIn.toFixed(2)} m | Outward (+2%): -${l.totalOut.toFixed(2)} m | Difference: ${l.rawStock.toFixed(2)} m`);
  });

  console.log(`\nTotal Deficit Across Negative Lots: ${totalNegMtr.toFixed(2)} mtr`);

  await mongoose.disconnect();
}

findNegativeLots().catch(err => {
  console.error(err);
  process.exit(1);
});
