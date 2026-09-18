require('../polyfills/crypto');
const mongoose = require('mongoose');
const config = require('../config/config');

async function mergeDuplicateDirectRooms() {
  try {
    await mongoose.connect(config.mongoose.url);
    console.log('Connected to DB');

    const ChatRoom = mongoose.model('ChatRoom', new mongoose.Schema({}, { strict: false }), 'chatrooms');
    const ChatMessage = mongoose.model('ChatMessage', new mongoose.Schema({}, { strict: false }), 'chatmessages');

    const directRooms = await ChatRoom.find({ type: 'direct' });
    console.log(`Analyzing ${directRooms.length} direct rooms...`);

    // Group rooms by normalized pair key e.g. "id1_id2"
    const pairMap = new Map();

    for (const room of directRooms) {
      if (!room.members || !Array.isArray(room.members)) continue;
      const cleanMemberIds = room.members
        .map(m => String(m._id || m))
        .filter(Boolean)
        .sort();

      if (cleanMemberIds.length === 0) continue;

      const pairKey = cleanMemberIds.join('_');
      if (!pairMap.has(pairKey)) {
        pairMap.set(pairKey, []);
      }
      pairMap.get(pairKey).push(room);
    }

    let mergedCount = 0;
    for (const [pairKey, rooms] of pairMap.entries()) {
      if (rooms.length > 1) {
        console.log(`\nFound ${rooms.length} duplicate direct rooms for pair [${pairKey}]:`);
        
        // Find room with most messages or most recently updated
        const roomMeta = await Promise.all(
          rooms.map(async (r) => {
            const count = await ChatMessage.countDocuments({ roomId: r._id });
            return { room: r, count, updatedAt: r.updatedAt || new Date(0) };
          })
        );

        // Sort descending by message count, then updatedAt
        roomMeta.sort((a, b) => b.count - a.count || new Date(b.updatedAt) - new Date(a.updatedAt));

        const canonicalRoom = roomMeta[0].room;
        console.log(`   Canonical room chosen: ${canonicalRoom._id} ("${canonicalRoom.name}") with ${roomMeta[0].count} msgs.`);

        for (let i = 1; i < roomMeta.length; i++) {
          const duplicateRoom = roomMeta[i].room;
          console.log(`   Merging messages from duplicate room ${duplicateRoom._id} ("${duplicateRoom.name}") into ${canonicalRoom._id}...`);
          
          // Reassign messages from duplicate room to canonical room
          const updateRes = await ChatMessage.updateMany(
            { roomId: duplicateRoom._id },
            { roomId: canonicalRoom._id }
          );
          console.log(`   Reassigned ${updateRes.modifiedCount} messages.`);

          // Delete duplicate room
          await ChatRoom.findByIdAndDelete(duplicateRoom._id);
          console.log(`   Deleted duplicate room ${duplicateRoom._id}.`);
          mergedCount++;
        }
      }
    }

    console.log(`\n✅ Direct rooms cleanup finished! Merged ${mergedCount} duplicate direct rooms.`);
    process.exit(0);
  } catch (err) {
    console.error('Error merging direct rooms:', err);
    process.exit(1);
  }
}

mergeDuplicateDirectRooms();
