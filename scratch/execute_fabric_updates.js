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

const normalizeFabric = (val) => {
  if (!val) return '';
  let clean = String(val).trim().toUpperCase();
  if (clean === 'CREPE' || clean === 'CRAPE' || clean === 'FRANCH CREPE' || clean === 'FRENCH CREP' || clean.includes('CREPE') || clean.includes('CRAPE')) {
    return 'FRENCH CREPE';
  }
  return clean;
};

async function runUpdates() {
  await mongoose.connect(MONGODB_URL);
  console.log('Connected to MongoDB');

  // STEP 1: Add +2% to FRENCH CREPE outward transactions inserted from CSV sheet
  console.log('\n--- STEP 1: Applying +2% to FRENCH CREPE CSV Outward Transactions ---');
  const frenchCrepeCsvOutwards = await FabricTransaction.find({
    type: 'OUTWARD',
    fabricQuality: new RegExp('CREPE', 'i'),
    notes: new RegExp('Imported from', 'i')
  });

  console.log(`Found ${frenchCrepeCsvOutwards.length} FRENCH CREPE outward transactions from sheet import.`);

  let step1Count = 0;
  for (const tx of frenchCrepeCsvOutwards) {
    if (!tx.notes.includes('+2% French Crepe Applied')) {
      const oldQty = tx.qty;
      const newQty = Number((oldQty * 1.02).toFixed(2));
      tx.qty = newQty;
      tx.notes = `${tx.notes} (+2% French Crepe Applied)`;
      await tx.save();
      step1Count++;
      console.log(`Updated Tx ID ${tx._id} (Lot #${tx.lotNo}): ${oldQty} mtr -> ${newQty} mtr (+2%)`);
    }
  }
  console.log(`Step 1 Complete: Updated ${step1Count} records with +2% outward quantity.`);

  // STEP 2: Clear any Lot stock remaining balance <= 5 mtr down to 0
  console.log('\n--- STEP 2: Converting Lot stock <= 5 mtr to 0 mtr ---');
  const lotBalances = await FabricTransaction.aggregate([
    {
      $group: {
        _id: { lotNo: '$lotNo', fabricQuality: '$fabricQuality', panna: '$panna' },
        totalIn: { $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] } },
        totalOut: { $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] } }
      }
    },
    {
      $project: {
        lotNo: '$_id.lotNo',
        fabricQuality: '$_id.fabricQuality',
        panna: '$_id.panna',
        totalIn: 1,
        totalOut: 1,
        currentStock: { $subtract: ['$totalIn', '$totalOut'] }
      }
    },
    { $sort: { lotNo: 1 } }
  ]);

  let step2Count = 0;
  for (const lot of lotBalances) {
    const net = lot.currentStock;
    if (net > 0 && net <= 5.0) {
      console.log(`Lot #${lot.lotNo || 'N/A'} (${lot.fabricQuality}): ${net.toFixed(2)} mtr remaining (<= 5 mtr). Converting to 0 mtr...`);

      // Create an OUTWARD scrap adjustment transaction to zero out the remaining stock
      const adjustTx = new FabricTransaction({
        type: 'OUTWARD',
        fabricQuality: lot.fabricQuality || 'UNSPECIFIED',
        panna: lot.panna || '58',
        lotNo: lot.lotNo || undefined,
        qty: Number(net.toFixed(2)),
        date: new Date(),
        notes: `Remnant Stock Auto-Clear (<= 5 mtr remaining converted to 0)`
      });

      await adjustTx.save();
      step2Count++;
    }
  }

  console.log(`Step 2 Complete: Auto-converted ${step2Count} lots with <= 5 mtr remaining to 0 mtr.`);

  await mongoose.disconnect();
  console.log('\n✅ Database migration completed successfully!');
}

runUpdates().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
