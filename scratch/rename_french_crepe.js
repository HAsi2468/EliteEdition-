const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const FabricTransaction = require('../src/db/models/fabricTransaction.model');
const JobCard = require('../src/db/models/jobCard.model');
const FabricChallan = require('../src/db/models/fabricChallan.model');
const FabricStockAdjustment = require('../src/db/models/fabricStockAdjustment.model');
const PrintConfig = require('../src/db/models/printConfig.model');

async function run() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/elite_edition';
  console.log('Connecting to Mongo:', mongoUri);
  await mongoose.connect(mongoUri);

  console.log('\n--- Checking FabricTransactions ---');
  const fabTxs = await FabricTransaction.find({
    fabricQuality: { $in: [/^FRENCH CREP$/i, /^CREPE$/i, /^CRAPE$/i, /^FRANCH CREPE$/i] }
  });
  console.log(`Found ${fabTxs.length} FabricTransactions with FRENCH CREP / CREPE / CRAPE.`);
  
  const fabTxRes = await FabricTransaction.updateMany(
    { fabricQuality: { $in: [/^FRENCH CREP$/i, /^CREPE$/i, /^CRAPE$/i, /^FRANCH CREPE$/i] } },
    { $set: { fabricQuality: 'FRENCH CREPE' } }
  );
  console.log('FabricTransaction update result:', fabTxRes);

  console.log('\n--- Checking JobCards ---');
  const jobCards = await JobCard.find({
    fabric: { $in: [/^FRENCH CREP$/i, /^CREPE$/i, /^CRAPE$/i, /^FRANCH CREPE$/i] }
  });
  console.log(`Found ${jobCards.length} JobCards with FRENCH CREP.`);

  const jobRes = await JobCard.updateMany(
    { fabric: { $in: [/^FRENCH CREP$/i, /^CREPE$/i, /^CRAPE$/i, /^FRANCH CREPE$/i] } },
    { $set: { fabric: 'FRENCH CREPE' } }
  );
  console.log('JobCard update result:', jobRes);

  console.log('\n--- Checking FabricChallans ---');
  const challans = await FabricChallan.find({
    fabricName: { $in: [/^FRENCH CREP$/i, /^CREPE$/i, /^CRAPE$/i, /^FRANCH CREPE$/i] }
  });
  console.log(`Found ${challans.length} FabricChallans with FRENCH CREP.`);

  const chalRes = await FabricChallan.updateMany(
    { fabricName: { $in: [/^FRENCH CREP$/i, /^CREPE$/i, /^CRAPE$/i, /^FRANCH CREPE$/i] } },
    { $set: { fabricName: 'FRENCH CREPE' } }
  );
  console.log('FabricChallan update result:', chalRes);

  console.log('\n--- Checking FabricStockAdjustments ---');
  const saRes = await FabricStockAdjustment.updateMany(
    { fabricQuality: { $in: [/^FRENCH CREP$/i, /^CREPE$/i, /^CRAPE$/i, /^FRANCH CREPE$/i] } },
    { $set: { fabricQuality: 'FRENCH CREPE' } }
  );
  console.log('FabricStockAdjustment update result:', saRes);

  console.log('\n--- Checking PrintConfig ---');
  const configs = await PrintConfig.find({});
  for (const cfg of configs) {
    let modified = false;
    if (cfg.fabrics) {
      if (Array.isArray(cfg.fabrics)) {
        const updated = cfg.fabrics.map(f => (f.trim().toUpperCase() === 'FRENCH CREP' ? 'FRENCH CREPE' : f));
        cfg.fabrics = Array.from(new Set(updated));
        modified = true;
      } else if (typeof cfg.fabrics === 'object') {
        if (cfg.fabrics['FRENCH CREP']) {
          delete cfg.fabrics['FRENCH CREP'];
          cfg.fabrics['FRENCH CREPE'] = true;
          modified = true;
        }
      }
    }
    if (modified) {
      cfg.markModified('fabrics');
      await cfg.save();
      console.log('Updated PrintConfig fabrics!');
    }
  }

  console.log('\n✅ ALL DB RECORDS UPDATED TO "FRENCH CREPE"');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
