global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');
const JobCard = require('./src/db/models/jobCard.model');

async function listWithImages() {
  await mongoose.connect(config.mongoose.url);
  const docs = await JobCard.find().lean();
  const filtered = docs.filter(d => Boolean(d.imageUrl1 || d.imageUrl2));
  console.log(`Found ${filtered.length} job cards with image URLs:\n`);
  filtered.forEach(j => {
    console.log(`ID: ${j._id} | JobNo: ${j.jobNo} | DesignNo: ${j.designNo} | Img1: ${j.imageUrl1} | Img2: ${j.imageUrl2}`);
  });
  await mongoose.disconnect();
  process.exit(0);
}

listWithImages().catch(err => {
  console.error(err);
  process.exit(1);
});
