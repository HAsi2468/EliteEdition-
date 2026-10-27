global.crypto = require('crypto');
const mongoose = require('mongoose');
require('dotenv').config({ path: '/Users/harshitsidapara/Node projects/Elite_Edition/EliteEditionMongo/.env' });
const uri = process.env.MONGODB_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/elite_edition';

async function cleanup() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const usersColl = mongoose.connection.db.collection('user');
  const chatroomsColl = mongoose.connection.db.collection('chatrooms');
  const tasksColl = mongoose.connection.db.collection('tasks');

  const testUsersFilter = {
    $or: [
      { name: /^TEST/i },
      { username: /^TEST/i },
      { email: /test-load/i },
      { email: /qa-bot/i },
      { email: /testbot/i },
      { name: /QA Automation Bot/i },
      { name: /^testingbot/i }
    ]
  };

  const testUsers = await usersColl.find(testUsersFilter).toArray();
  const testUserIds = testUsers.map(u => u._id);
  console.log(`Found ${testUsers.length} test users to delete.`);

  if (testUserIds.length > 0) {
    // 1. Remove test users from chatrooms members array
    const roomUpdate = await chatroomsColl.updateMany(
      { members: { $in: testUserIds } },
      { $pull: { members: { $in: testUserIds } } }
    );
    console.log(`Removed test users from chatrooms: matched ${roomUpdate.matchedCount}, modified ${roomUpdate.modifiedCount}`);

    // 2. Delete the test users
    const userDel = await usersColl.deleteMany({ _id: { $in: testUserIds } });
    console.log(`Deleted ${userDel.deletedCount} test users from user collection.`);
  }

  // 3. Delete the test task
  const taskDel = await tasksColl.deleteMany({
    $or: [
      { title: /^TEST/i },
      { name: /^TEST/i },
      { isTest: true }
    ]
  });
  console.log(`Deleted ${taskDel.deletedCount} test tasks from tasks collection.`);

  await mongoose.disconnect();
  console.log('Cleanup completed successfully.');
  process.exit(0);
}

cleanup().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
