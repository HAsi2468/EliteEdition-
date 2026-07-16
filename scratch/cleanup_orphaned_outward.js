require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URL || process.env.MONGODB_URI || process.env.MONGO_URI;

const FabricChallan    = require('../src/db/models/fabricChallan.model');
const FabricTransaction = require('../src/db/models/fabricTransaction.model');

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Find all auto-outward transactions
  const outwardTxs = await FabricTransaction.find({
    type: 'OUTWARD',
    challanNo: { $regex: /^EDP-/i }
  });

  console.log(`📋 Found ${outwardTxs.length} auto-outward transactions. Scanning for orphans...`);

  let deletedCount = 0;

  for (const tx of outwardTxs) {
    // Extract challan number, e.g. "EDP-2" -> 2
    const numMatch = tx.challanNo.match(/\d+/);
    if (!numMatch) continue;
    const challanNo = parseInt(numMatch[0], 10);

    // Check if challan exists
    const challanExists = await FabricChallan.exists({ challanNo });
    if (!challanExists) {
      console.log(`🗑️  Deleting orphaned outward entry for EDP-${challanNo} (Qty: ${tx.qty} mtr, Date: ${tx.date.toLocaleDateString()})`);
      await FabricTransaction.findByIdAndDelete(tx._id);
      deletedCount++;
    }
  }

  console.log(`\n🎉 Completed! Deleted ${deletedCount} orphaned outward entry/entries.`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
