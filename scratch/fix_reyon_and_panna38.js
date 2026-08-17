const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const db = require('../src/db/models');
const FabricTransaction = require('../src/db/models/fabricTransaction.model');
const JobCard = require('../src/db/models/jobCard.model');
const FabricChallan = require('../src/db/models/fabricChallan.model');
const FabricStockAdjustment = require('../src/db/models/fabricStockAdjustment.model');
const PrintConfig = require('../src/db/models/printConfig.model');

const cleanReyonAndPanna38 = (rawFabric, rawPanna) => {
  if (!rawFabric) return { combinedName: '', baseName: '', panna: '58' };
  let str = String(rawFabric).trim().toUpperCase();

  let extractedPanna = '';
  const pannaMatches = str.match(/(?:\s+(\d+))+\s*$/);
  if (pannaMatches) {
    const digits = pannaMatches[0].trim().split(/\s+/);
    extractedPanna = digits[digits.length - 1];
    str = str.replace(/(?:\s+(\d+))+\s*$/, '').trim();
  }

  let base = str;
  // Merging REYON into POLY REYON
  if (base === 'REYON' || base === 'RAYON' || base === 'POLY REYON' || base === 'POLY RAYON' || base.includes('REYON') || base.includes('RAYON')) {
    if (base.includes('30 SPN')) {
      base = 'POLY REYON 30 SPN';
    } else {
      base = 'POLY REYON';
    }
  } else if (base === 'CREPE' || base === 'CRAPE' || base === 'FRANCH CREPE' || base === 'FRENCH CREP' || base.includes('CREPE') || base.includes('CRAPE') || base.includes('CREP')) {
    base = 'FRENCH CREPE';
  } else if (base === 'CAMRIK' || base === 'CEMBRIC' || base === 'CEMBRIK' || base === 'CAMBRIK' || base.includes('CAMRIK') || base.includes('CEMBRIK')) {
    base = 'CAMBRIC';
  } else if (base === 'MAL' || base === 'POLY MAL' || base === 'POLYMALL' || base === 'POLY MLL' || base === 'POLLY MAL') {
    base = 'POLLY MAL';
  }

  let finalPanna = extractedPanna || (rawPanna ? String(rawPanna).trim().replace(/['"]/g, '') : '');
  // Panna 38, 46, 56 -> convert to 58
  if (finalPanna === '38' || finalPanna === '46' || finalPanna === '56') finalPanna = '58';
  if (!finalPanna || finalPanna.toUpperCase() === 'UNKNOWN' || isNaN(parseInt(finalPanna, 10))) {
    if (base.includes('ARMANI')) finalPanna = '44';
    else finalPanna = '58';
  }

  return {
    combinedName: `${base} ${finalPanna}`,
    baseName: base,
    panna: finalPanna
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

  const uniqueFabrics = new Set();

  console.log('\n--- Merging REYON & Panna 38 in FabricTransactions ---');
  const fabTxs = await FabricTransaction.find({});
  let txFixed = 0;
  for (const tx of fabTxs) {
    if (!tx.fabricQuality) continue;
    const { combinedName, panna } = cleanReyonAndPanna38(tx.fabricQuality, tx.panna);
    if (tx.fabricQuality !== combinedName || tx.panna !== panna) {
      tx.fabricQuality = combinedName;
      tx.panna = panna;
      await tx.save();
      txFixed++;
    }
    uniqueFabrics.add(combinedName);
  }
  console.log(`Updated ${txFixed} FabricTransactions.`);

  console.log('\n--- Merging REYON & Panna 38 in JobCards ---');
  const jobCards = await JobCard.find({});
  let jcFixed = 0;
  for (const jc of jobCards) {
    if (!jc.fabric) continue;
    const { combinedName, panna } = cleanReyonAndPanna38(jc.fabric, jc.panna);
    if (jc.fabric !== combinedName || jc.panna !== panna) {
      jc.fabric = combinedName;
      jc.panna = panna;
      await jc.save();
      jcFixed++;
    }
    uniqueFabrics.add(combinedName);
  }
  console.log(`Updated ${jcFixed} JobCards.`);

  console.log('\n--- Merging REYON & Panna 38 in FabricChallans ---');
  const challans = await FabricChallan.find({});
  let fcFixed = 0;
  for (const fc of challans) {
    if (!fc.fabricName) continue;
    const { combinedName, panna } = cleanReyonAndPanna38(fc.fabricName, fc.panna);
    if (fc.fabricName !== combinedName || fc.panna !== panna) {
      fc.fabricName = combinedName;
      fc.panna = panna;
      await fc.save();
      fcFixed++;
    }
    uniqueFabrics.add(combinedName);
  }
  console.log(`Updated ${fcFixed} FabricChallans.`);

  console.log('\n--- Merging REYON & Panna 38 in FabricStockAdjustments ---');
  const sas = await FabricStockAdjustment.find({});
  let saFixed = 0;
  for (const sa of sas) {
    if (!sa.fabricQuality) continue;
    const { combinedName, panna } = cleanReyonAndPanna38(sa.fabricQuality, sa.panna);
    if (sa.fabricQuality !== combinedName || sa.panna !== panna) {
      sa.fabricQuality = combinedName;
      sa.panna = panna;
      await sa.save();
      saFixed++;
    }
    uniqueFabrics.add(combinedName);
  }
  console.log(`Updated ${saFixed} FabricStockAdjustments.`);

  console.log('\n--- Updating PrintConfig Fabrics Catalog ---');
  const sortedList = Array.from(uniqueFabrics).filter(Boolean).sort();
  console.log('Final Clean Fabrics Catalog:', sortedList);

  const configs = await PrintConfig.find({});
  for (const cfg of configs) {
    cfg.fabrics = sortedList;
    cfg.markModified('fabrics');
    await cfg.save();
    console.log('Updated PrintConfig fabrics catalog!');
  }

  console.log('\n✅ REYON MERGED INTO POLY REYON & PANNA 38 UPDATED TO 58 PERFECTLY!');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
