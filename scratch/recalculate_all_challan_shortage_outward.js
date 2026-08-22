const mongoose = require('mongoose');
const config = require('../src/config/config');
const FabricChallan = require('../src/db/models/fabricChallan.model');
const FabricTransaction = require('../src/db/models/fabricTransaction.model');

function computeRawMeters(totalMtr, shortagePct, shortageMtr, shortageMode) {
  const mtr = parseFloat(totalMtr) || 0;
  if (shortageMode === 'mtr' || (shortageMtr != null && parseFloat(shortageMtr) > 0 && (shortagePct == null || shortagePct === ''))) {
    const sMtr = parseFloat(shortageMtr) || 0;
    return parseFloat((mtr + sMtr).toFixed(3));
  }
  const pct = parseFloat(shortagePct) || 0;
  return parseFloat((mtr * (1 + pct / 100)).toFixed(3));
}

async function auditAndRecalculateChallanShortages() {
  await mongoose.connect(config.mongoose.url);
  console.log('Connected to MongoDB');

  const challans = await FabricChallan.find({}).lean();
  console.log(`Found ${challans.length} Fabric Challans.`);

  let updatedOutwardCount = 0;

  for (const ch of challans) {
    if (!ch.fabricOutwardIds || ch.fabricOutwardIds.length === 0) continue;

    const freshMtr = ch.totalMtr || 0;
    const sPct = ch.shortagePct;
    const sMtr = ch.shortageMtr;
    const sMode = ch.shortageMode;

    const expectedRawMtr = computeRawMeters(freshMtr, sPct, sMtr, sMode);

    const outwardTxs = await FabricTransaction.find({ _id: { $in: ch.fabricOutwardIds } });
    
    // Check total outward qty currently stored
    let currentOutwardSum = 0;
    outwardTxs.forEach(t => currentOutwardSum += (t.qty || 0));

    // If outward sum doesn't match expected raw meters, recalculate and update
    if (outwardTxs.length > 0 && Math.abs(currentOutwardSum - expectedRawMtr) > 0.05) {
      console.log(`Challan #${ch.challanNo}: fresh=${freshMtr}m, shortage=${sPct}% (${sMtr}m), currentOutward=${currentOutwardSum.toFixed(2)}m, expectedRaw=${expectedRawMtr.toFixed(2)}m`);

      // Pro-rate among outward transactions
      for (const tx of outwardTxs) {
        const ratio = currentOutwardSum > 0 ? tx.qty / currentOutwardSum : 1 / outwardTxs.length;
        const newQty = parseFloat((expectedRawMtr * ratio).toFixed(3));
        tx.qty = newQty;
        tx.shortagePct = sPct != null ? sPct : tx.shortagePct;
        tx.shortageMtr = sMtr != null ? sMtr : tx.shortageMtr;
        await tx.save();
        updatedOutwardCount++;
      }
    }
  }

  console.log(`✅ Re-synced ${updatedOutwardCount} OUTWARD fabric transactions across all Delivery Challans!`);

  await mongoose.disconnect();
}

auditAndRecalculateChallanShortages().catch(err => {
  console.error(err);
  process.exit(1);
});
