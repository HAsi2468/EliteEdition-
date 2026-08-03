const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');
const Design = require('./src/db/models/design.model');

async function renameDesignCatalog() {
  await mongoose.connect(config.mongoose.url);
  console.log('Connected to MongoDB.');

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

  console.log(`Highest existing base ED- number: ED-${maxNum}`);

  const createdWithOne = designs.filter(d => (d.designName || '').endsWith('(1)'));
  console.log(`Renaming ${createdWithOne.length} catalog entries...`);

  let renamedCount = 0;

  for (let idx = 0; idx < createdWithOne.length; idx++) {
    const d = createdWithOne[idx];
    const newSeq = maxNum + 1 + idx;
    const newDesignName = `ED-${newSeq}`;
    const newDesignNo = `${newSeq}`;

    await Design.updateOne(
      { _id: d._id },
      {
        $set: {
          designName: newDesignName,
          designNo: newDesignNo,
          modified_date_time: new Date()
        }
      }
    );

    renamedCount++;
    console.log(`[RENAMED] ${d.designName} -> ${newDesignName} (Image: "${d.imageUrl}")`);
  }

  console.log(`\nRenaming completed! ${renamedCount} design catalog entries updated.`);

  await mongoose.disconnect();
  process.exit(0);
}

renameDesignCatalog().catch(err => {
  console.error('Renaming failed:', err);
  process.exit(1);
});
