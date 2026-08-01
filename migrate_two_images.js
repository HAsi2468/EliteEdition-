global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');
const Design = require('./src/db/models/design.model');

async function migrateTwoImageDesigns() {
  await mongoose.connect(config.mongoose.url);
  console.log('Connected to MongoDB.');

  const designs = await Design.find({
    $and: [
      { imageUrl2: { $ne: null } },
      { imageUrl2: { $ne: '' } }
    ]
  }).lean();

  console.log(`Found ${designs.length} candidate designs with imageUrl2.`);

  let createdCount = 0;
  let updatedCount = 0;

  for (const d of designs) {
    const img2 = (d.imageUrl2 || '').trim();
    // Filter out non-image junk strings
    if (!img2 || img2 === 'ALLOVER' || img2 === '20' || img2 === '1800') {
      continue;
    }

    const origName = d.designName || '';
    if (!origName) continue;

    const newDesignName = `${origName}(1)`;
    const newDesignNo = d.designNo && d.designNo !== 'undefined' ? `${d.designNo}(1)` : newDesignName;

    // Check if new catalog entry already exists
    const existingNew = await Design.findOne({ designName: newDesignName }).lean();

    if (!existingNew) {
      // Create new Design catalog document for the 2nd image
      const newDocData = {
        ...d,
        _id: new mongoose.Types.ObjectId(),
        designName: newDesignName,
        designNo: newDesignNo,
        imageUrl: img2,
        imageUrl2: '',
        created_date_time: new Date(),
        modified_date_time: new Date()
      };
      delete newDocData.id;

      await Design.create(newDocData);
      createdCount++;
      console.log(`[CREATED] New catalog entry: "${newDesignName}" with image "${img2}"`);
    } else {
      console.log(`[EXISTS] Catalog entry "${newDesignName}" already exists.`);
    }

    // Update original design document to clear imageUrl2
    await Design.updateOne({ _id: d._id }, { $set: { imageUrl2: '' } });
    updatedCount++;
  }

  console.log(`\nMigration completed successfully!`);
  console.log(`- Created ${createdCount} new design catalog entries with '(1)' suffix.`);
  console.log(`- Updated ${updatedCount} original design catalog entries (cleared imageUrl2).`);

  await mongoose.disconnect();
  process.exit(0);
}

migrateTwoImageDesigns().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
