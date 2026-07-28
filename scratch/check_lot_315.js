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

async function inspectLot315() {
  await mongoose.connect(MONGODB_URL);
  console.log('Connected to MongoDB');

  const txs = await FabricTransaction.find({ lotNo: 315 }).sort({ date: 1, createdAt: 1 });
  console.log(`Found ${txs.length} transactions for Lot #315:`);

  let totalIn = 0;
  let totalOut = 0;

  txs.forEach((t, idx) => {
    const isIN = t.type === 'INWARD';
    if (isIN) totalIn += t.qty;
    else totalOut += t.qty;

    console.log(`\n--- Transaction #${idx + 1} ---`);
    console.log(`Type:          ${t.type}`);
    console.log(`Date:          ${t.date.toISOString().split('T')[0]}`);
    console.log(`Fabric Quality:${t.fabricQuality}`);
    console.log(`Panna:         ${t.panna}`);
    console.log(`Quantity:      ${t.qty} mtr`);
    console.log(`Party Name:    ${t.partyName || 'N/A'}`);
    console.log(`Vendor Name:   ${t.vendorName || 'N/A'}`);
    console.log(`Job / Challan: ${t.jobNo || t.challanNo || 'N/A'}`);
    console.log(`Notes:         ${t.notes || 'N/A'}`);
  });

  console.log('\n====================================');
  console.log(`SUMMARY FOR LOT #315:`);
  console.log(`Total Inward:  +${totalIn.toFixed(2)} mtr`);
  console.log(`Total Outward: -${totalOut.toFixed(2)} mtr`);
  console.log(`Current Stock: ${(totalIn - totalOut).toFixed(2)} mtr`);
  console.log('====================================');

  await mongoose.disconnect();
}

inspectLot315().catch(err => {
  console.error(err);
  process.exit(1);
});
