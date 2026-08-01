global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');
const Design = require('./src/db/models/design.model');

async function checkTwoImageDesigns() {
  await mongoose.connect(config.mongoose.url);

  const designsWithTwoImages = await Design.find({
    $and: [
      { imageUrl2: { $ne: null } },
      { imageUrl2: { $ne: '' } }
    ]
  }).lean();

  console.log(`Found ${designsWithTwoImages.length} design documents with imageUrl2:`);
  designsWithTwoImages.forEach(d => {
    console.log(`ID: ${d._id} | designName: "${d.designName}" | designNo: "${d.designNo}"`);
    console.log(`  Img1: "${d.imageUrl}"`);
    console.log(`  Img2: "${d.imageUrl2}"\n`);
  });

  await mongoose.disconnect();
  process.exit(0);
}

checkTwoImageDesigns().catch(err => {
  console.error(err);
  process.exit(1);
});
