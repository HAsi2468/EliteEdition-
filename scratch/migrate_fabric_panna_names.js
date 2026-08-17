const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const db = require('../src/db/models');
const FabricTransaction = require('../src/db/models/fabricTransaction.model');
const JobCard = require('../src/db/models/jobCard.model');
const FabricChallan = require('../src/db/models/fabricChallan.model');
const FabricStockAdjustment = require('../src/db/models/fabricStockAdjustment.model');
const PrintConfig = require('../src/db/models/printConfig.model');

const getBaseFabric = (val) => {
  if (!val) return '';
  let clean = String(val).trim().toUpperCase();
  // Strip trailing width numbers if already present (e.g. "FRENCH CREPE 58" -> "FRENCH CREPE")
  clean = clean.replace(/\s+(44|58|36|56|46)$/, '').trim();

  if (clean === 'CREPE' || clean === 'CRAPE' || clean === 'FRANCH CREPE' || clean === 'FRENCH CREP' || clean.includes('CREPE') || clean.includes('CRAPE') || clean.includes('CREP')) {
    return 'FRENCH CREPE';
  }
  if (clean === 'CAMRIK' || clean === 'CEMBRIC' || clean === 'CEMBRIK' || clean === 'CAMBRIK' || clean.includes('CAMRIK') || clean.includes('CEMBRIK')) {
    return 'CAMBRIC';
  }
  if (clean === 'MAL' || clean === 'POLY MAL' || clean === 'POLYMALL' || clean === 'POLY MLL' || clean === 'POLLY MAL') {
    return 'POLLY MAL';
  }
  return clean;
};

const getCleanPanna = (val, baseFabric = '') => {
  let clean = val ? String(val).trim().replace(/['"]/g, '') : '';
  if (clean === '46' || clean === '56') clean = '58';
  if (!clean || clean.toUpperCase() === 'UNKNOWN') {
    if (baseFabric.includes('ARMANI')) return '44';
    return '58';
  }
  return clean;
};

const formatCombinedFabricName = (rawFabric, rawPanna) => {
  if (!rawFabric) return '';
  const base = getBaseFabric(rawFabric);

  // Check if rawFabric already has explicit panna embedded e.g. "FRENCH CREPE 44"
  const matchPannaInName = String(rawFabric).trim().match(/\s+(44|58|36|56|46)$/);
  let panna = matchPannaInName ? matchPannaInName[1] : rawPanna;
  panna = getCleanPanna(panna, base);

  return {
    combinedName: `${base} ${panna}`,
    baseName: base,
    panna
  };
};

async function run() {
  console.log('\n--- Waiting for Mongoose connection ---');
  await new Promise((resolve) => {
    if (db.mongoose.connection.readyState === 1) {
      resolve();
    } else {
      db.mongoose.connection.once('connected', resolve);
    }
  });

  const updatedFabricsSet = new Set();

  console.log('\n--- Migrating FabricTransactions ---');
  const fabTxs = await FabricTransaction.find({});
  console.log(`Processing ${fabTxs.length} FabricTransactions...`);
  let txUpdatedCount = 0;
  for (const tx of fabTxs) {
    if (!tx.fabricQuality) continue;
    const { combinedName, panna } = formatCombinedFabricName(tx.fabricQuality, tx.panna);
    if (tx.fabricQuality !== combinedName || tx.panna !== panna) {
      tx.fabricQuality = combinedName;
      tx.panna = panna;
      await tx.save();
      txUpdatedCount++;
    }
    updatedFabricsSet.add(combinedName);
  }
  console.log(`Updated ${txUpdatedCount} FabricTransactions to combined names.`);

  console.log('\n--- Migrating JobCards ---');
  const jobCards = await JobCard.find({});
  console.log(`Processing ${jobCards.length} JobCards...`);
  let jcUpdatedCount = 0;
  for (const jc of jobCards) {
    if (!jc.fabric) continue;
    const { combinedName, panna } = formatCombinedFabricName(jc.fabric, jc.panna);
    if (jc.fabric !== combinedName || jc.panna !== panna) {
      jc.fabric = combinedName;
      jc.panna = panna;
      await jc.save();
      jcUpdatedCount++;
    }
    updatedFabricsSet.add(combinedName);
  }
  console.log(`Updated ${jcUpdatedCount} JobCards to combined names.`);

  console.log('\n--- Migrating FabricChallans ---');
  const challans = await FabricChallan.find({});
  console.log(`Processing ${challans.length} FabricChallans...`);
  let challanUpdatedCount = 0;
  for (const fc of challans) {
    if (!fc.fabricName) continue;
    const { combinedName, panna } = formatCombinedFabricName(fc.fabricName, fc.panna);
    if (fc.fabricName !== combinedName || fc.panna !== panna) {
      fc.fabricName = combinedName;
      fc.panna = panna;
      await fc.save();
      challanUpdatedCount++;
    }
    updatedFabricsSet.add(combinedName);
  }
  console.log(`Updated ${challanUpdatedCount} FabricChallans to combined names.`);

  console.log('\n--- Migrating FabricStockAdjustments ---');
  const sas = await FabricStockAdjustment.find({});
  let saUpdatedCount = 0;
  for (const sa of sas) {
    if (!sa.fabricQuality) continue;
    const { combinedName, panna } = formatCombinedFabricName(sa.fabricQuality, sa.panna);
    if (sa.fabricQuality !== combinedName || sa.panna !== panna) {
      sa.fabricQuality = combinedName;
      sa.panna = panna;
      await sa.save();
      saUpdatedCount++;
    }
    updatedFabricsSet.add(combinedName);
  }
  console.log(`Updated ${saUpdatedCount} FabricStockAdjustments to combined names.`);

  console.log('\n--- Updating PrintConfig Fabrics Catalog ---');
  const newFabricsList = Array.from(updatedFabricsSet).filter(Boolean).sort();
  console.log('New Fabrics List for Catalog:', newFabricsList);

  const configs = await PrintConfig.find({});
  for (const cfg of configs) {
    cfg.fabrics = newFabricsList;
    cfg.markModified('fabrics');
    await cfg.save();
    console.log('Updated PrintConfig fabrics catalog!');
  }

  console.log('\n✅ FABRIC QUALITY & PANNA PERMANENT COMBINED NAME MIGRATION COMPLETE!');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
