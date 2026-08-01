global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');
const JobCard = require('./src/db/models/jobCard.model');
const fs = require('fs');
const path = require('path');

async function inspectAllJobCards() {
  await mongoose.connect(config.mongoose.url);
  const cards = await JobCard.find({}).sort({ created_date_time: -1 }).lean();

  console.log(`Inspecting ${cards.length} Job Cards...\n`);
  for (const c of cards) {
    if (c.designNo || c.designName || c.imageUrl1) {
      console.log(`JobNo: ${c.jobNo} | DesignNo: "${c.designNo}" | DesignName: "${c.designName}" | Image1: "${c.imageUrl1}"`);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

inspectAllJobCards().catch(err => {
  console.error(err);
  process.exit(1);
});
