const mongoose = require('mongoose');
const config = require('../src/config/config');
const { Design, JobCard } = require('../src/db/models');

async function checkDesign() {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  console.log('Connected to MongoDB');

  const designs = await Design.find({
    $or: [
      { designName: { $regex: /ED-?571/i } },
      { designNo: { $regex: /ED-?571/i } }
    ]
  }).lean();

  console.log('--- DESIGNS FOUND IN CATALOG ---');
  console.log(JSON.stringify(designs, null, 2));

  const jobCards = await JobCard.find({
    $or: [
      { designName: { $regex: /ED-?571/i } },
      { designNo: { $regex: /ED-?571/i } }
    ]
  }).lean();

  console.log('--- JOB CARDS FOUND WITH ED-571 ---');
  console.log(JSON.stringify(jobCards.map(j => ({
    _id: j._id,
    jobNo: j.jobNo,
    designName: j.designName,
    imageUrl1: j.imageUrl1,
    imageUrl2: j.imageUrl2
  })), null, 2));

  await mongoose.disconnect();
}

checkDesign().catch(err => {
  console.error(err);
  process.exit(1);
});
