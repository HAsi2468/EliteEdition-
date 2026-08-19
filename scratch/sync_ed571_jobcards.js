const mongoose = require('mongoose');
const config = require('../src/config/config');
const { Design, JobCard } = require('../src/db/models');

async function syncED571() {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  console.log('Connected to MongoDB');

  const design = await Design.findOne({
    $or: [{ designName: 'ED-571' }, { designNo: 'ED-571' }]
  }).lean();

  if (!design) {
    console.log('Design ED-571 not found');
    await mongoose.disconnect();
    return;
  }

  console.log('Found Design ED-571:', design._id, 'imageUrl:', design.imageUrl);

  if (design.imageUrl) {
    const res = await JobCard.updateMany(
      {
        $or: [
          { designName: 'ED-571' },
          { designNo: 'ED-571' },
          { designName: { $regex: /^ED-?571$/i } }
        ]
      },
      {
        $set: {
          imageUrl1: design.imageUrl,
          imageUrl2: design.imageUrl2 || ''
        }
      }
    );

    console.log('Updated Job Cards:', res);
  }

  await mongoose.disconnect();
}

syncED571().catch(err => {
  console.error(err);
  process.exit(1);
});
