const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const db = require('../src/db/models');
const FabricTransaction = require('../src/db/models/fabricTransaction.model');
const JobCard = require('../src/db/models/jobCard.model');
const FabricChallan = require('../src/db/models/fabricChallan.model');
const PrintConfig = require('../src/db/models/printConfig.model');

async function run() {
  await new Promise((resolve) => {
    if (db.mongoose.connection.readyState === 1) {
      resolve();
    } else {
      db.mongoose.connection.once('connected', resolve);
    }
  });

  console.log('\n--- Inspecting FabricTransaction Combos ---');
  const txCombos = await FabricTransaction.aggregate([
    { $group: { _id: { fabricQuality: '$fabricQuality', panna: '$panna' }, count: { $sum: 1 } } },
    { $sort: { '_id.fabricQuality': 1 } }
  ]);
  console.log(JSON.stringify(txCombos, null, 2));

  console.log('\n--- Inspecting JobCard Combos ---');
  const jcCombos = await JobCard.aggregate([
    { $group: { _id: { fabric: '$fabric', panna: '$panna' }, count: { $sum: 1 } } },
    { $sort: { '_id.fabric': 1 } }
  ]);
  console.log(JSON.stringify(jcCombos, null, 2));

  console.log('\n--- Inspecting PrintConfig Fabrics ---');
  const configs = await PrintConfig.find({});
  for (const c of configs) {
    console.log('PrintConfig fabrics:', c.fabrics);
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
