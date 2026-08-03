const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');
const Design = require('./src/db/models/design.model');

async function findMaxDesignNo() {
  await mongoose.connect(config.mongoose.url);

  const designs = await Design.find().lean();

  let maxNum = 0;
  for (const d of designs) {
    const name = d.designName || '';
    if (name.includes('(1)')) continue;

    const m = name.match(/^ED-(\d+)$/i) || name.match(/^(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }

  console.log(`Highest existing ED- number: ED-${maxNum}`);

  const createdWithOne = designs.filter(d => (d.designName || '').endsWith('(1)'));
  console.log(`Found ${createdWithOne.length} design catalog entries with '(1)' suffix.`);
  createdWithOne.forEach((d, idx) => {
    const nextNo = maxNum + 1 + idx;
    console.log(`  ${d.designName}  =>  ED-${nextNo}`);
  });

  await mongoose.disconnect();
  process.exit(0);
}

findMaxDesignNo().catch(err => {
  console.error(err);
  process.exit(1);
});
