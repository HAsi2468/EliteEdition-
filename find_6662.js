global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');

async function find6662() {
  await mongoose.connect(config.mongoose.url);
  const db = mongoose.connection.db;

  console.log('--- ALL JOBCARDS with jobNo containing 666 ---');
  const jc = await db.collection('jobCards').find({ jobNo: /66/ }).toArray();
  console.log('Found:', jc.length);
  for (const j of jc) {
    console.log(`JobNo: "${j.jobNo}", DesignNo: "${j.designNo}", Image1: "${j.imageUrl1}", Image2: "${j.imageUrl2}"`);
  }

  console.log('\n--- ALL DESIGNS with designNo containing 666 ---');
  const ds = await db.collection('designs').find({ $or: [{ designNo: /66/ }, { designName: /66/ }] }).toArray();
  console.log('Found:', ds.length);
  for (const d of ds) {
    console.log(`DesignNo: "${d.designNo}", DesignName: "${d.designName}", ImageUrl: "${d.imageUrl}"`);
  }

  console.log('\n--- LAST 10 JOBCARDS ---');
  const recentJc = await db.collection('jobCards').find({}).sort({ _id: -1 }).limit(10).toArray();
  for (const j of recentJc) {
    console.log(`JobNo: "${j.jobNo}", DesignNo: "${j.designNo}", Image1: "${j.imageUrl1}"`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

find6662().catch(err => {
  console.error(err);
  process.exit(1);
});
