global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');

async function check() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(config.mongoose.url);
  console.log('Connected!');

  const db = mongoose.connection.db;

  console.log('\n=== JOB CARDS matching 6662 ===');
  const jobCards = await db.collection('jobcards').find({
    $or: [
      { jobNo: '6662' }, { jobNo: 6662 },
      { jobCardNo: '6662' }, { jobCardNo: 6662 },
      { id: '6662' }, { id: 6662 }
    ]
  }).toArray();
  console.log(JSON.stringify(jobCards, null, 2));

  console.log('\n=== FABRIC CHALLANS matching 6662 ===');
  const challans = await db.collection('fabricChallans').find({
    $or: [
      { jobNo: '6662' }, { jobNo: 6662 },
      { jobCardNo: '6662' }, { jobCardNo: 6662 }
    ]
  }).toArray();
  console.log(JSON.stringify(challans, null, 2));

  const designNos = [...new Set([
    ...jobCards.map(j => j.designNo),
    ...challans.map(c => c.designNo)
  ].filter(Boolean))];

  console.log('\n=== DESIGNS matching designNos:', designNos, '===');
  if (designNos.length > 0) {
    const designs = await db.collection('designs').find({
      designNo: { $in: designNos }
    }).toArray();
    console.log(JSON.stringify(designs, null, 2));
  }

  await mongoose.disconnect();
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
