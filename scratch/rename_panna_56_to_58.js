const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const db = require('../src/db/models');
const FabricTransaction = require('../src/db/models/fabricTransaction.model');
const JobCard = require('../src/db/models/jobCard.model');
const FabricChallan = require('../src/db/models/fabricChallan.model');
const FabricStockAdjustment = require('../src/db/models/fabricStockAdjustment.model');
const PrintConfig = require('../src/db/models/printConfig.model');

async function run() {
  console.log('\n--- Waiting for Mongoose connection ---');
  await new Promise((resolve) => {
    if (db.mongoose.connection.readyState === 1) {
      resolve();
    } else {
      db.mongoose.connection.once('connected', resolve);
    }
  });

  const pannaRegex = /^\s*(46|56)["']?\s*$/i;

  console.log('\n--- Checking FabricTransactions ---');
  const fabTxs = await FabricTransaction.find({ panna: pannaRegex });
  console.log(`Found ${fabTxs.length} FabricTransactions with panna 46 or 56.`);

  const fabTxRes = await FabricTransaction.updateMany(
    { panna: pannaRegex },
    { $set: { panna: '58' } }
  );
  console.log('FabricTransaction update result:', fabTxRes);

  console.log('\n--- Checking JobCards ---');
  const jobCards = await JobCard.find({ panna: pannaRegex });
  console.log(`Found ${jobCards.length} JobCards with panna 46 or 56.`);

  const jobRes = await JobCard.updateMany(
    { panna: pannaRegex },
    { $set: { panna: '58' } }
  );
  console.log('JobCard update result:', jobRes);

  console.log('\n--- Checking FabricChallans ---');
  const challans = await FabricChallan.find({ panna: pannaRegex });
  console.log(`Found ${challans.length} FabricChallans with panna 46 or 56.`);

  const chalRes = await FabricChallan.updateMany(
    { panna: pannaRegex },
    { $set: { panna: '58' } }
  );
  console.log('FabricChallan update result:', chalRes);

  console.log('\n--- Checking FabricStockAdjustments ---');
  const saRes = await FabricStockAdjustment.updateMany(
    { panna: pannaRegex },
    { $set: { panna: '58' } }
  );
  console.log('FabricStockAdjustment update result:', saRes);

  console.log('\n--- Checking PrintConfig ---');
  const configs = await PrintConfig.find({});
  for (const cfg of configs) {
    let modified = false;
    if (cfg.widths && Array.isArray(cfg.widths)) {
      const updated = cfg.widths.map(w => {
        const clean = String(w).trim().replace(/['"]/g, '');
        return (clean === '46' || clean === '56') ? '58' : clean;
      });
      cfg.widths = Array.from(new Set(updated));
      modified = true;
    }
    if (modified) {
      cfg.markModified('widths');
      await cfg.save();
      console.log('Updated PrintConfig widths!');
    }
  }

  console.log('\n✅ ALL DB PANNA 46 & 56 RECORDS UPDATED TO 58');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
