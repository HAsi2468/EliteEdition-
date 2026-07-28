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

async function inspect232() {
  await mongoose.connect(MONGODB_URL);
  console.log('Connected to MongoDB');

  const txs = await FabricTransaction.find({ lotNo: 232 });
  console.log(`Found ${txs.length} transactions for Lot #232:`);
  let totalIn = 0;
  let totalOut = 0;

  txs.forEach(t => {
    console.log(`[${t.type}] Date: ${t.date.toISOString().split('T')[0]}, Quality: '${t.fabricQuality}', Panna: '${t.panna}', Qty: ${t.qty}, Notes: '${t.notes || ''}'`);
    if (t.type === 'INWARD') totalIn += t.qty;
    else totalOut += t.qty;
  });

  console.log(`\nLot #232 Raw Totals: In=${totalIn}, Out=${totalOut}, Net=${(totalIn - totalOut).toFixed(2)} mtr`);

  // Check how downloadFabricLotWisePdf aggregation treats lot 232
  const aggResult = await FabricTransaction.aggregate([
    {
      $group: {
        _id: '$lotNo',
        fabricQuality: { $first: '$fabricQuality' },
        panna: { $first: '$panna' },
        vendorName: { $first: '$vendorName' },
        totalInward: { $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] } },
        totalOutward: { $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] } }
      }
    },
    {
      $project: {
        lotNo: '$_id',
        fabricQuality: 1,
        panna: 1,
        totalInward: 1,
        totalOutward: 1,
        currentStock: { $subtract: ['$totalInward', '$totalOutward'] }
      }
    },
    { $match: { lotNo: 232 } }
  ]);

  console.log('\nAggregation result for Lot #232:');
  console.log(aggResult);

  await mongoose.disconnect();
}

inspect232().catch(err => console.error(err));
