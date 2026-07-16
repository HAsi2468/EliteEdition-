require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URL || process.env.MONGODB_URI || process.env.MONGO_URI;

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

  // 1. Update EDP-1
  const challan1 = await FabricChallan.findOne({ challanNo: 1 });
  if (challan1) {
    console.log('Updating EDP-1...');
    // Assign lot numbers to each TP row
    challan1.tpDetails[0].lotNo = "235";
    challan1.tpDetails[1].lotNo = "247";
    challan1.tpDetails[2].lotNo = "254";
    for (let i = 3; i < challan1.tpDetails.length; i++) {
      challan1.tpDetails[i].lotNo = "264";
    }
    // Mark modified
    challan1.markModified('tpDetails');
    await challan1.save();
    console.log('EDP-1 TP rows updated.');

    // Delete existing outward transactions for EDP-1
    if (challan1.fabricOutwardId) {
      await FabricTransaction.findByIdAndDelete(challan1.fabricOutwardId);
      challan1.fabricOutwardId = undefined;
    }
    if (challan1.fabricOutwardIds && challan1.fabricOutwardIds.length > 0) {
      for (const txId of challan1.fabricOutwardIds) {
        await FabricTransaction.findByIdAndDelete(txId);
      }
    }

    // Generate new lot-wise transactions
    const lotGroups = {};
    for (const tp of challan1.tpDetails) {
      const m = parseFloat(tp.tpMeter) || 0;
      if (m > 0) {
        const itemLot = (tp.lotNo || '').trim();
        if (!lotGroups[itemLot]) {
          lotGroups[itemLot] = 0;
        }
        lotGroups[itemLot] += m;
      }
    }

    const createdTxIds = [];
    for (const [lot, groupMtr] of Object.entries(lotGroups)) {
      const rawMtr = computeRawMeters(groupMtr, challan1.shortagePct);
      const outwardTx = new FabricTransaction({
        type: 'OUTWARD',
        fabricQuality: challan1.fabricName,
        panna: challan1.panna || '',
        lotNo: parseLotNo(lot),
        qty: rawMtr,
        date: challan1.date,
        jobNo: challan1.jobNo || '',
        partyName: challan1.partyName || '',
        challanNo: 'EDP-' + challan1.challanNo,
        notes: `Auto: EDP-${challan1.challanNo} | Lot #${lot || 'N/A'} | Fresh=${groupMtr}m + ${challan1.shortagePct || 0}% shortage = ${rawMtr}m raw`,
      });
      await outwardTx.save();
      createdTxIds.push(outwardTx._id);
      console.log(`Created outward entry for Lot #${lot}: ${groupMtr}m -> ${rawMtr}m raw`);
    }
    challan1.fabricOutwardIds = createdTxIds;
    await challan1.save();
    console.log('EDP-1 outward transactions synchronized.');
  }

  // 2. Update EDP-2
  const challan2 = await FabricChallan.findOne({ challanNo: 2 });
  if (challan2) {
    console.log('Updating EDP-2...');
    challan2.tpDetails[0].lotNo = "320";
    challan2.markModified('tpDetails');
    await challan2.save();
    console.log('EDP-2 TP rows updated.');

    // Delete existing outward transactions for EDP-2
    if (challan2.fabricOutwardId) {
      await FabricTransaction.findByIdAndDelete(challan2.fabricOutwardId);
      challan2.fabricOutwardId = undefined;
    }
    if (challan2.fabricOutwardIds && challan2.fabricOutwardIds.length > 0) {
      for (const txId of challan2.fabricOutwardIds) {
        await FabricTransaction.findByIdAndDelete(txId);
      }
    }

    // Generate new lot-wise transactions
    const lotGroups = {};
    for (const tp of challan2.tpDetails) {
      const m = parseFloat(tp.tpMeter) || 0;
      if (m > 0) {
        const itemLot = (tp.lotNo || '').trim();
        if (!lotGroups[itemLot]) {
          lotGroups[itemLot] = 0;
        }
        lotGroups[itemLot] += m;
      }
    }

    const createdTxIds = [];
    for (const [lot, groupMtr] of Object.entries(lotGroups)) {
      const rawMtr = computeRawMeters(groupMtr, challan2.shortagePct);
      const outwardTx = new FabricTransaction({
        type: 'OUTWARD',
        fabricQuality: challan2.fabricName,
        panna: challan2.panna || '',
        lotNo: parseLotNo(lot),
        qty: rawMtr,
        date: challan2.date,
        jobNo: challan2.jobNo || '',
        partyName: challan2.partyName || '',
        challanNo: 'EDP-' + challan2.challanNo,
        notes: `Auto: EDP-${challan2.challanNo} | Lot #${lot || 'N/A'} | Fresh=${groupMtr}m + ${challan2.shortagePct || 0}% shortage = ${rawMtr}m raw`,
      });
      await outwardTx.save();
      createdTxIds.push(outwardTx._id);
      console.log(`Created outward entry for Lot #${lot}: ${groupMtr}m -> ${rawMtr}m raw`);
    }
    challan2.fabricOutwardIds = createdTxIds;
    await challan2.save();
    console.log('EDP-2 outward transactions synchronized.');
  }

  await mongoose.disconnect();
  console.log('🎉 Update script completed successfully!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
