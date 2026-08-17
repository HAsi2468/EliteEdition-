require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log('--- Cleaning Up Generic "Admin" Creator Names & Chat Messages ---');

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  const JobCard = mongoose.model('JobCard', new mongoose.Schema({}, { strict: false }), 'jobCards');
  const ChatMessage = mongoose.model('ChatMessage', new mongoose.Schema({}, { strict: false }), 'chatMessages');

  // Find primary admin or user
  const adminUser = await User.findOne({ role: 'admin' }).lean() || await User.findOne({}).lean();
  const realName = adminUser ? (adminUser.name || adminUser.username || 'Harshil') : 'Harshil';
  console.log(`Using real staff name: "${realName}" (User ID: ${adminUser ? adminUser._id : 'N/A'})`);

  // 1. Update Job Cards
  const resCards = await JobCard.updateMany(
    { $or: [{ createdBy: 'Admin' }, { createdBy: 'Operator' }, { createdBy: '' }, { createdBy: null }, { createdByName: '' }] },
    { $set: { createdBy: realName, createdByName: realName, updatedBy: realName, updatedByName: realName } }
  );
  console.log(`Updated ${resCards.modifiedCount} Job Cards with real creator name "${realName}".`);

  // 2. Update Chat Messages containing "by Admin." or "by Operator."
  const messagesToFix = await ChatMessage.find({ content: { $regex: /by (Admin|Operator|System Bot)\.?/i } }).lean();
  console.log(`Found ${messagesToFix.length} chat messages with generic "by Admin" text.`);

  let fixedMsgs = 0;
  for (const msg of messagesToFix) {
    const newContent = msg.content.replace(/by (Admin|Operator|System Bot)\.?/gi, `by **${realName}**.`);
    await ChatMessage.updateOne({ _id: msg._id }, { $set: { content: newContent } });
    fixedMsgs++;
  }
  console.log(`Fixed ${fixedMsgs} chat messages with real staff name "${realName}".`);

  console.log('✅ USER NAME CLEANUP MIGRATION COMPLETED SUCCESSFULLY!');
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
