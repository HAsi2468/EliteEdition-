/**
 * One-time backfill script:
 * Creates OUTWARD fabric transactions for existing challans
 * that don't yet have a linked fabricOutwardId.
 *
 * Run: node scratch/backfill_challan_outward.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URL || process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ No MONGODB_URI found in environment!');
  process.exit(1);
}

const FabricChallan    = require('../src/db/models/fabricChallan.model');
const FabricTransaction = require('../src/db/models/fabricTransaction.model');

function computeRawMeters(totalMtr, shortagePct) {
  const mtr = parseFloat(totalMtr) || 0;
  const pct = parseFloat(shortagePct) || 0;
  return parseFloat((mtr * (1 + pct / 100)).toFixed(3));
}

function parseLotNo(lotStr) {
  if (!lotStr) return undefined;
  const match = String(lotStr).match(/\d+/);
  if (match) {
    const val = parseInt(match[0], 10);
    return isNaN(val) ? undefined : val;
  }
  return undefined;
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Find all challans that don't have a fabricOutwardId yet
  const challans = await FabricChallan.find({
    $or: [
      { fabricOutwardId: null },
      { fabricOutwardId: { $exists: false } }
    ]
  }).sort({ challanNo: 1 });

  console.log(`📋 Found ${challans.length} challan(s) without outward entry`);

  let created = 0;
  let skipped = 0;

  for (const challan of challans) {
    if (!challan.fabricName || !challan.totalMtr || challan.totalMtr <= 0) {
      console.log(`  ⚠️  EDP-${challan.challanNo}: skipped (no fabric or 0 meters)`);
      skipped++;
      continue;
    }

    const rawMtr = computeRawMeters(challan.totalMtr, challan.shortagePct);

    const outwardTx = new FabricTransaction({
      type: 'OUTWARD',
      fabricQuality: challan.fabricName,
      panna: challan.panna || '',
      lotNo: parseLotNo(challan.lotNo),
      qty: rawMtr,
      date: challan.date,
      jobNo: challan.jobNo || '',
      partyName: challan.partyName || '',
      challanNo: 'EDP-' + challan.challanNo,
      notes: `Auto: EDP-${challan.challanNo} | Fresh=${challan.totalMtr}m + ${challan.shortagePct || 0}% shortage = ${rawMtr}m raw`,
    });

    await outwardTx.save();

    challan.fabricOutwardId = outwardTx._id;
    await challan.save();

    console.log(`  ✅ EDP-${challan.challanNo}: ${challan.totalMtr}m + ${challan.shortagePct || 0}% = ${rawMtr}m raw → outward created`);
    created++;
  }

  console.log(`\n🎉 Done! Created: ${created}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
