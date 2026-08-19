const mongoose = require('mongoose');
const config = require('../src/config/config');
const { Design, JobCard } = require('../src/db/models');

async function fixED571() {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  console.log('Connected to MongoDB');

  // Find ED-571 D or ED-571 F that has a valid uploaded image
  const ed571D = await Design.findOne({ designName: 'ED-571 D' }).lean();
  const ed571F = await Design.findOne({ designName: 'ED-571 F' }).lean();

  const validImage = (ed571D && ed571D.imageUrl) || (ed571F && ed571F.imageUrl) || '/designs/image-1786097634427-711818055';

  console.log('Using valid image:', validImage);

  // Update ED-571 design in catalog
  const designRes = await Design.updateMany(
    { designName: 'ED-571' },
    { $set: { imageUrl: validImage } }
  );
  console.log('Updated Design ED-571:', designRes);

  // Update all JobCards with ED-571
  const cardRes = await JobCard.updateMany(
    {
      $or: [
        { designName: 'ED-571' },
        { designNo: 'ED-571' }
      ]
    },
    { $set: { imageUrl1: validImage } }
  );
  console.log('Updated JobCards for ED-571:', cardRes);

  await mongoose.disconnect();
}

fixED571().catch(err => {
  console.error(err);
  process.exit(1);
});
