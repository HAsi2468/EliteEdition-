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

async function listActiveLots() {
  await mongoose.connect(MONGODB_URL);

  const activeLots = await FabricTransaction.aggregate([
    { $match: { lotNo: { $ne: null } } },
    {
      $group: {
        _id: '$lotNo',
        fabricQuality: { $first: '$fabricQuality' },
        totalIn: { $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] } },
        totalOut: { $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] } }
      }
    },
    {
      $project: {
        lotNo: '$_id',
        fabricQuality: 1,
        totalIn: 1,
        totalOut: 1,
        currentStock: { $subtract: ['$totalIn', '$totalOut'] }
      }
    },
    { $match: { currentStock: { $gt: 0 } } },
    { $sort: { currentStock: 1 } }
  ]);

  console.log(`\n================ ACTIVE LOTS (> 0 mtr) ================`);
  console.log(`Total Active Lots: ${activeLots.length}`);
  console.log(`Lowest 15 active lots by stock:`);

  activeLots.slice(0, 15).forEach(l => {
    console.log(`Lot #${l.lotNo} (${l.fabricQuality}): ${l.currentStock.toFixed(2)} mtr remaining`);
  });

  await mongoose.disconnect();
}

listActiveLots().catch(err => console.error(err));
