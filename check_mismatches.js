global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');
const JobCard = require('./src/db/models/jobCard.model');
const Design = require('./src/db/models/design.model');

async function checkMismatches() {
  await mongoose.connect(config.mongoose.url);
  const cards = await JobCard.find().lean();
  const designs = await Design.find().lean();

  const designMap = {};
  designs.forEach(d => {
    if (d.designName) designMap[d.designName.toUpperCase().trim()] = d;
    if (d.designNo) designMap[d.designNo.toUpperCase().trim()] = d;
  });

  console.log(`Checking ${cards.length} job cards for image mismatches...\n`);
  let mismatches = 0;

  for (const c of cards) {
    const dKey = (c.designName || c.designNo || '').toUpperCase().trim();
    const dMatch = designMap[dKey] || designMap[`ED-${dKey}`] || designMap[dKey.replace(/^ED-/i, '')];
    
    const catalogImg = dMatch ? (dMatch.imageUrl || dMatch.imageUrl2 || '') : '';
    const storedImg = c.imageUrl1 || '';

    if (storedImg && catalogImg && storedImg !== catalogImg) {
      mismatches++;
      console.log(`MISMATCH found on Job Card ${c.jobNo} (${c._id}):`);
      console.log(`  DesignNo/Name in JC: "${c.designNo}" / "${c.designName}"`);
      console.log(`  Stored imageUrl1 in JC: "${storedImg}"`);
      console.log(`  Catalog imageUrl in Design: "${catalogImg}"\n`);
    }
  }

  console.log(`Total mismatches found: ${mismatches}`);
  await mongoose.disconnect();
  process.exit(0);
}

checkMismatches().catch(err => {
  console.error(err);
  process.exit(1);
});
