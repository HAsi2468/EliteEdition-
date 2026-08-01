global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('./src/config/config');
const FabricChallan = require('./src/db/models/fabricChallan.model');
const JobCard = require('./src/db/models/jobCard.model');
const Design = require('./src/db/models/design.model');

async function inspect652() {
  await mongoose.connect(config.mongoose.url);

  console.log('=== FABRIC CHALLAN 652 ===');
  const challan = await FabricChallan.findOne({ challanNo: 652 }).lean();
  console.log(JSON.stringify(challan, null, 2));

  if (challan) {
    if (challan.jobNo) {
      console.log('\n=== LINKED JOB CARD(S) for jobNo:', challan.jobNo, '===');
      const jobTokens = String(challan.jobNo).split(',').map(s => s.trim()).filter(Boolean);
      const jobs = await JobCard.find({ jobNo: { $in: jobTokens } }).lean();
      console.log(JSON.stringify(jobs, null, 2));
    }

    if (challan.designNo) {
      console.log('\n=== LINKED DESIGN(S) for designNo:', challan.designNo, '===');
      const clean = challan.designNo.replace(/^ED-/i, '');
      const designs = await Design.find({
        $or: [
          { designName: { $regex: clean, $options: 'i' } },
          { designNo: { $regex: clean, $options: 'i' } }
        ]
      }).lean();
      console.log(JSON.stringify(designs, null, 2));
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

inspect652().catch(err => {
  console.error(err);
  process.exit(1);
});
