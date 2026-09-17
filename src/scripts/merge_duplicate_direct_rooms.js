require('../polyfills/crypto');
const mongoose = require('mongoose');
const config = require('../config/config');

async function cleanDirectRooms() {
  try {
    await mongoose.connect(config.mongoose.url);
    console.log('Connected to MongoDB');

    const ChatRoom = mongoose.model('ChatRoom', new mongoose.Schema({}, { strict: false, timestamps: true }), 'chatrooms');

    const directRooms = await ChatRoom.find({ type: 'direct' });
    console.log(`Found ${directRooms.length} direct rooms total.`);

    let cleanedCount = 0;
    for (const room of directRooms) {
      if (!room.members || !Array.isArray(room.members)) continue;
      
      const uniqueMembers = Array.from(new Set(room.members.map(m => String(m._id || m))));
      
      if (uniqueMembers.length > 2) {
        console.log(`Trimming multi-member direct room ${room._id} ("${room.name}") from ${uniqueMembers.length} to 2 members.`);
        const firstTwo = uniqueMembers.slice(0, 2).map(id => new mongoose.Types.ObjectId(id));
        await ChatRoom.findByIdAndUpdate(room._id, { members: firstTwo });
        cleanedCount++;
      }
    }

    console.log(`Done. Cleaned ${cleanedCount} direct rooms.`);
    process.exit(0);
  } catch (err) {
    console.error('Error cleaning direct rooms:', err);
    process.exit(1);
  }
}

cleanDirectRooms();
