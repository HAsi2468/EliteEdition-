// cleanup-qa-records.js
const mongoose = require('mongoose');
const config = require('../config/config');

async function cleanup() {
  const uri = process.env.MONGO_URI || config.mongoose.url;
  await mongoose.connect(uri);

  const approvalIds = [
    '6ad761101c31ee3668758e23',
    '6ad762c91c31ee366875a175',
    '6ad761bc1c31ee3668759084',
    '6ad761eb1c31ee36687592de',
    '6ad761b91c31ee3668759080'
  ];

  const objIds = approvalIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  // Purge approvals from both possible collection names
  try {
    const res1 = await mongoose.connection.collection('changeapprovalrequests').deleteMany({
      _id: { $in: objIds }
    });
    console.log(`Deleted ${res1.deletedCount} from changeapprovalrequests`);
  } catch (e) {
    console.log('changeapprovalrequests collection:', e.message);
  }

  try {
    const res2 = await mongoose.connection.collection('approvals').deleteMany({
      _id: { $in: objIds }
    });
    console.log(`Deleted ${res2.deletedCount} from approvals`);
  } catch (e) {
    console.log('approvals collection:', e.message);
  }

  // Purge fabric challans
  const rFabric = await mongoose.connection.collection('fabricchallans').deleteMany({
    challanNo: { $in: [1267, 1268, '1267', '1268'] }
  });
  console.log(`Deleted ${rFabric.deletedCount} from fabricchallans`);

  // Purge delivery challans
  const rDelivery = await mongoose.connection.collection('deliverychallans').deleteMany({
    $or: [
      { challanNo: { $in: [1000, '1000', 'DC-1000', 'SO-1000', 'SO1000'] } },
      { challanSeq: 1000 }
    ]
  });
  console.log(`Deleted ${rDelivery.deletedCount} from deliverychallans`);

  // Purge stitching challans
  const rStitching = await mongoose.connection.collection('stitchingchallans').deleteMany({
    $or: [
      { challanNo: { $in: [1, '1', 'PCH-1', 'PCH1'] } },
      { challanNo: /^PCH-1$/i }
    ]
  });
  console.log(`Deleted ${rStitching.deletedCount} from stitchingchallans`);

  // Purge test tasks
  const rTasks = await mongoose.connection.collection('tasks').deleteMany({
    title: { $regex: /TEST - QA/i }
  });
  console.log(`Deleted ${rTasks.deletedCount} from tasks`);

  console.log('QA test data cleanup complete.');
  process.exit(0);
}

cleanup().catch((err) => {
  console.error('Cleanup script error:', err);
  process.exit(1);
});
