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

async function main() {
  await mongoose.connect(MONGODB_URL);
  console.log('Connected to MongoDB');

  const totalTxs = await FabricTransaction.countDocuments();
  console.log(`Total Fabric Transactions: ${totalTxs}`);

  const allTxs = await FabricTransaction.find().sort({ date: -1 }).limit(30);
  console.log('\n--- Recent 30 Fabric Transactions ---');
  allTxs.forEach(t => {
    console.log(`[${t.type}] Date: ${t.date.toISOString().split('T')[0]} | Fab: ${t.fabricQuality} | Lot: #${t.lotNo || '-'} | Qty: ${t.qty} | Job/Ch: ${t.jobNo || t.challanNo || '-'} | Notes: ${t.notes || '-'}`);
  });

  // Group by lotNo to see lot balances
  const lotBalances = await FabricTransaction.aggregate([
    {
      $group: {
        _id: { lotNo: '$lotNo', fabricQuality: '$fabricQuality' },
        totalIn: { $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] } },
        totalOut: { $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] } }
      }
    },
    {
      $project: {
        lotNo: '$_id.lotNo',
        fabricQuality: '$_id.fabricQuality',
        totalIn: 1,
        totalOut: 1,
        currentStock: { $subtract: ['$totalIn', '$totalOut'] }
      }
    },
    { $sort: { lotNo: 1 } }
  ]);

  console.log('\n--- All Lot Balances ---');
  lotBalances.forEach(l => {
    console.log(`Lot #${l.lotNo || 'N/A'} (${l.fabricQuality}): TotalIn=${l.totalIn}, TotalOut=${l.totalOut}, Net=${l.currentStock.toFixed(2)}`);
  });

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
