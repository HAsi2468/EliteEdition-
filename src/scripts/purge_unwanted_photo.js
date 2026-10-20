require('dotenv').config();
const mongoose = require('mongoose');
const { deleteR2Object } = require('../utils/r2Storage');

async function purgeUnwantedPhoto() {
  const uri = process.env.MONGODB_URL || 'mongodb://localhost:27017/elite_edition';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const ChatMessage = mongoose.model('ChatMessage', new mongoose.Schema({}, { strict: false }));
  const ChatRoom = mongoose.model('ChatRoom', new mongoose.Schema({}, { strict: false }));

  // Target message ID: 6ad72addd67d8fb117e17003 sent on 20 Oct at ~2:18 PM
  const messageId = new mongoose.Types.ObjectId('6ad72addd67d8fb117e17003');
  const message = await ChatMessage.findById(messageId);

  if (!message) {
    console.error('Message not found:', messageId);
    process.exit(1);
  }

  console.log('Found target message:', {
    id: message._id,
    createdAt: message.createdAt,
    content: message.content,
    attachment: message.attachment
  });

  // Purge from Cloudflare R2 if attachment exists
  if (message.attachment && message.attachment.fileUrl) {
    try {
      const url = new URL(message.attachment.fileUrl);
      const key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
      console.log('Purging R2 object key:', key);
      await deleteR2Object(key);
      console.log('Successfully purged object from Cloudflare R2');
    } catch (r2Err) {
      console.warn('Warning: Could not purge from R2:', r2Err.message);
    }
  }

  // Soft-delete the message in DB
  message.isDeleted = true;
  message.deletedBy = message.senderId;
  message.deletedAt = new Date();
  message.content = 'This message was deleted';
  message.attachment = null;
  await message.save();

  console.log('Successfully soft-deleted message:', messageId);

  // Update room lastMessage if this was the last message
  const room = await ChatRoom.findById(message.roomId);
  if (room && room.lastMessage && String(room.lastMessage._id || room.lastMessage) === String(message._id)) {
    const prevMsg = await ChatMessage.findOne({ roomId: message.roomId, isDeleted: { $ne: true } })
      .sort({ roomSeq: -1, createdAt: -1 });
    room.lastMessage = prevMsg || null;
    await room.save();
    console.log('Updated room.lastMessage to:', prevMsg?._id || 'null');
  }

  console.log('Data cleanup completed successfully!');
  process.exit(0);
}

purgeUnwantedPhoto().catch(err => {
  console.error('Purge error:', err);
  process.exit(1);
});
