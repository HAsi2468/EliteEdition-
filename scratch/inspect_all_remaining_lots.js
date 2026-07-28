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

async function inspectAllLots() {
  await mongoose.connect(MONGODB_URL);
  console.log('Connected to MongoDB');

  const lotBalances = await FabricTransaction.aggregate([
    {
      $group: {
        _id: { lotNo: '$lotNo', fabricQuality: '$fabricQuality', panna: '$panna' },
        totalIn: { $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] } },
        totalOut: { $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] } },
        shortagePct: { $first: '$shortagePct' }
      }
    },
    {
      $project: {
        lotNo: '$_id.lotNo',
        fabricQuality: '$_id.fabricQuality',
        panna: '$_id.panna',
        totalIn: 1,
        totalOut: 1,
        shortagePct: 1,
        currentStock: { $subtract: ['$totalIn', '$totalOut'] }
      }
    },
    { $sort: { lotNo: 1 } }
  ]);

  console.log(`\n================ ALL LOT BALANCES ================`);
  const activeLots = lotBalances.filter(l => l.currentStock > 0);
  const lowStockLots = lotBalances.filter(l => l.currentStock > 0 && l.currentStock <= 10.0);

  console.log(`Total Active Lots (> 0 mtr): ${activeLots.length}`);
  console.log(`Total Lots with <= 10.0 mtr remaining: ${lowStockLots.length}\n`);

  lowStockLots.forEach(l => {
    console.log(`Lot #${l.lotNo || 'N/A'} [${l.fabricQuality} | Panna ${l.panna}"]: TotalIn=${l.totalIn.toFixed(2)}, TotalOut=${l.totalOut.toFixed(2)}, Net=${l.currentStock.toFixed(2)} mtr`);
  });

  await mongoose.disconnect();
}

inspectAllLots().catch(err => {
  console.error(err);
  process.exit(1);
});
