require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URL || process.env.MONGODB_URI || process.env.MONGO_URI;

const FabricChallan = require('../src/db/models/fabricChallan.model');

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const challans = await FabricChallan.find().sort({ challanNo: 1 });
  for (const c of challans) {
    console.log(`\n=================== EDP-${c.challanNo} ===================`);
    console.log(`partyName: ${c.partyName}`);
    console.log(`lotNo: ${c.lotNo}`);
    console.log(`fabricName: ${c.fabricName}`);
    console.log(`shortagePct: ${c.shortagePct}`);
    console.log(`totalMtr: ${c.totalMtr}`);
    console.log(`fabricOutwardIds:`, c.fabricOutwardIds || c.fabricOutwardId);
    console.log(`tpDetails:`, JSON.stringify(c.tpDetails, null, 2));
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
