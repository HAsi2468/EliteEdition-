require('../src/polyfills/crypto');
const mongoose = require('mongoose');
const FabricTransaction = require('../src/db/models/fabricTransaction.model');

const mongoUrl = 'mongodb+srv://Elite_edition:Elite_edition6070@cluster0.h38kxpm.mongodb.net/elite_edition?retryWrites=true&w=majority';

async function run() {
  await mongoose.connect(mongoUrl);
  console.log('Connected to MongoDB');

  // Let's find the current max lot number
  const lastTxBefore = await FabricTransaction.findOne({ type: 'INWARD' }).sort({ lotNo: -1 });
  const startLot = lastTxBefore ? lastTxBefore.lotNo : 0;
  console.log(`Starting max lot number: ${startLot}`);

  // Create Inward 1
  const tx1 = new FabricTransaction({
    type: 'INWARD',
    challanNo: 'CHALLAN-TEST-99',
    vendorName: 'TEST VENDOR',
    fabricQuality: 'TEST COTTON',
    panna: '44',
    qty: 100
  });
  await tx1.save();
  console.log(`Inward 1 saved with LotNo: ${tx1.lotNo}`);

  // Create Inward 2 (same details)
  const tx2 = new FabricTransaction({
    type: 'INWARD',
    challanNo: 'CHALLAN-TEST-99',
    vendorName: 'TEST VENDOR',
    fabricQuality: 'TEST COTTON',
    panna: '44',
    qty: 150
  });
  await tx2.save();
  console.log(`Inward 2 saved with LotNo: ${tx2.lotNo}`);

  // Clean up
  await FabricTransaction.findByIdAndDelete(tx1._id);
  await FabricTransaction.findByIdAndDelete(tx2._id);
  console.log('Cleaned up test documents.');

  await mongoose.connection.close();
}

run().catch(console.error);
