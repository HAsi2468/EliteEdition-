const crypto = require('crypto');
const mongoose = require('mongoose');
const axios = require('axios');
const { ChatRoom, ChatMessage, ChatUserPreference, ChatMessageReminder } = require('../db/models/chat.model');
const { user: User } = require('../db/models');
const { dispatchChatMessage } = require('./chatController');
const { sanitizeChatMessage } = require('../utils/sanitizeChat');

const getUid = (req) => (req.user ? req.user._id : (req.headers['x-user-id'] || req.body?.userId || req.query?.userId));

const hashPin = (userId, pin) => {
  return crypto.createHash('sha256').update(`${String(userId)}:${String(pin).trim()}`).digest('hex');
};

// 1. Pin / Unpin Chat Room to Top (per user)
const togglePinRoom = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = getUid(req);
    if (!userId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ success: false, message: 'Invalid room or user ID' });
    }
    const userObjId = new mongoose.Types.ObjectId(userId);
    const room = await ChatRoom.findById(groupId).select('pinnedBy');
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const alreadyPinned = (room.pinnedBy || []).some((id) => String(id) === String(userId));
    if (alreadyPinned) {
      await ChatRoom.updateOne({ _id: groupId }, { $pull: { pinnedBy: userObjId } });
    } else {
      await ChatRoom.updateOne({ _id: groupId }, { $addToSet: { pinnedBy: userObjId } });
    }

    try { require('./communication.controller').invalidateGroupsCache(); } catch (_) {}

    return res.json({ success: true, isPinned: !alreadyPinned });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to toggle pin room', error: err.message });
  }
};

// 2. Mark Chat as Unread / Read (per user)
const toggleMarkUnread = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = getUid(req);
    if (!userId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ success: false, message: 'Invalid room or user ID' });
    }
    const userObjId = new mongoose.Types.ObjectId(userId);
    const room = await ChatRoom.findById(groupId).select('unreadBy');
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const currentlyUnread = (room.unreadBy || []).some((id) => String(id) === String(userId));
    const forceUnread = typeof req.body?.unread === 'boolean' ? req.body.unread : !currentlyUnread;

    if (forceUnread) {
      await ChatRoom.updateOne({ _id: groupId }, { $addToSet: { unreadBy: userObjId } });
    } else {
      await ChatRoom.updateOne({ _id: groupId }, { $pull: { unreadBy: userObjId } });
    }

    try { require('./communication.controller').invalidateGroupsCache(); } catch (_) {}

    return res.json({ success: true, isMarkedUnread: forceUnread });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to toggle unread state', error: err.message });
  }
};

// 3. Chat Lock (Set / Remove / Verify 4-digit PIN per user per room)
const setChatLock = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = getUid(req);
    const { pin, lock = true } = req.body || {};
    if (!userId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ success: false, message: 'Invalid room or user ID' });
    }
    const userObjId = new mongoose.Types.ObjectId(userId);

    if (!lock) {
      await ChatRoom.updateOne({ _id: groupId }, { $pull: { lockedBy: { userId: userObjId } } });
      return res.json({ success: true, isLocked: false });
    }

    const cleanPin = String(pin || '').trim();
    if (!/^\d{4,6}$/.test(cleanPin)) {
      return res.status(400).json({ success: false, message: 'PIN must be 4 to 6 digits' });
    }

    const pinHash = hashPin(userId, cleanPin);
    await ChatRoom.updateOne({ _id: groupId }, { $pull: { lockedBy: { userId: userObjId } } });
    await ChatRoom.updateOne(
      { _id: groupId },
      { $push: { lockedBy: { userId: userObjId, pinHash, lockedAt: new Date() } } }
    );

    return res.json({ success: true, isLocked: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update chat lock', error: err.message });
  }
};

const verifyChatLock = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = getUid(req);
    const { pin } = req.body || {};
    if (!userId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ success: false, message: 'Invalid room or user ID' });
    }

    const room = await ChatRoom.findById(groupId).select('lockedBy').lean();
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const entry = (room.lockedBy || []).find((l) => String(l.userId) === String(userId));
    if (!entry) return res.json({ success: true, unlocked: true });

    const candidateHash = hashPin(userId, pin || '');
    if (candidateHash !== entry.pinHash) {
      return res.status(403).json({ success: false, message: 'Incorrect PIN' });
    }

    return res.json({ success: true, unlocked: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to verify chat lock', error: err.message });
  }
};

// 4. Group Invite Links & Admin Join Approval
const getInviteLink = async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ success: false, message: 'Invalid group ID' });
    }
    let room = await ChatRoom.findById(groupId)
      .select('name type inviteToken requireJoinApproval joinRequests')
      .populate('joinRequests.userId', 'name email role')
      .lean();
    if (!room) return res.status(404).json({ success: false, message: 'Group not found' });

    if (!room.inviteToken) {
      const token = crypto.randomBytes(12).toString('hex');
      await ChatRoom.updateOne({ _id: groupId }, { $set: { inviteToken: token } });
      room.inviteToken = token;
    }

    return res.json({
      success: true,
      data: {
        inviteToken: room.inviteToken,
        requireJoinApproval: Boolean(room.requireJoinApproval),
        joinRequests: room.joinRequests || [],
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch invite link', error: err.message });
  }
};

const resetInviteLink = async (req, res) => {
  try {
    const { groupId } = req.params;
    const token = crypto.randomBytes(12).toString('hex');
    const updated = await ChatRoom.findByIdAndUpdate(
      groupId,
      { $set: { inviteToken: token } },
      { new: true }
    ).select('inviteToken requireJoinApproval');
    if (!updated) return res.status(404).json({ success: false, message: 'Group not found' });
    return res.json({ success: true, data: { inviteToken: updated.inviteToken } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to reset invite link', error: err.message });
  }
};

const toggleJoinApproval = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { requireJoinApproval } = req.body || {};
    const updated = await ChatRoom.findByIdAndUpdate(
      groupId,
      { $set: { requireJoinApproval: Boolean(requireJoinApproval) } },
      { new: true }
    ).select('requireJoinApproval');
    if (!updated) return res.status(404).json({ success: false, message: 'Group not found' });
    return res.json({ success: true, data: { requireJoinApproval: updated.requireJoinApproval } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update join approval setting', error: err.message });
  }
};

const joinByInviteToken = async (req, res) => {
  try {
    const { token } = req.params;
    const userId = getUid(req);
    if (!userId || !token) {
      return res.status(400).json({ success: false, message: 'Missing invite token or user' });
    }
    const room = await ChatRoom.findOne({ inviteToken: token });
    if (!room) return res.status(404).json({ success: false, message: 'Invalid or expired invite link' });

    const alreadyMember = (room.members || []).some((m) => String(m?._id || m) === String(userId));
    if (alreadyMember) {
      return res.json({ success: true, status: 'joined', roomId: room._id, roomName: room.name });
    }

    const userObjId = new mongoose.Types.ObjectId(userId);
    if (room.requireJoinApproval) {
      const alreadyRequested = (room.joinRequests || []).some((r) => String(r.userId) === String(userId));
      if (!alreadyRequested) {
        await ChatRoom.updateOne(
          { _id: room._id },
          { $push: { joinRequests: { userId: userObjId, requestedAt: new Date() } } }
        );
      }
      return res.json({ success: true, status: 'pending_approval', roomId: room._id, roomName: room.name });
    }

    await ChatRoom.updateOne({ _id: room._id }, { $addToSet: { members: userObjId } });
    return res.json({ success: true, status: 'joined', roomId: room._id, roomName: room.name });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to join via invite link', error: err.message });
  }
};

const handleJoinRequest = async (req, res) => {
  try {
    const { groupId, targetUserId } = req.params;
    const { action = 'approve' } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }
    const targetObjId = new mongoose.Types.ObjectId(targetUserId);
    await ChatRoom.updateOne({ _id: groupId }, { $pull: { joinRequests: { userId: targetObjId } } });
    if (action === 'approve') {
      await ChatRoom.updateOne({ _id: groupId }, { $addToSet: { members: targetObjId } });
    }
    return res.json({ success: true, action });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to handle join request', error: err.message });
  }
};

// 5. Broadcast Lists — send one message as individual DMs to all list members
const sendBroadcastMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const senderId = getUid(req);
    const { content, attachment, type } = req.body || {};

    if (!senderId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ success: false, message: 'Invalid broadcast list or sender' });
    }

    const broadcastRoom = await ChatRoom.findById(groupId);
    if (!broadcastRoom || broadcastRoom.type !== 'broadcast') {
      return res.status(404).json({ success: false, message: 'Broadcast list not found' });
    }

    const sanitizedContent = sanitizeChatMessage(String(content || ''), 10000);
    if (!sanitizedContent.trim() && !attachment) {
      return res.status(400).json({ success: false, message: 'Broadcast message cannot be empty' });
    }

    const senderObjId = new mongoose.Types.ObjectId(senderId);
    const senderUser = await User.findById(senderObjId).select('name').lean();
    const senderName = senderUser?.name || req.user?.name || 'User';

    // Record in the broadcast list room itself
    const updatedBroadcast = await ChatRoom.findByIdAndUpdate(
      groupId,
      { $inc: { lastSeq: 1 }, updatedAt: new Date() },
      { new: true }
    );
    const listMsg = await ChatMessage.create({
      roomId: groupId,
      senderId: senderObjId,
      senderName,
      content: sanitizedContent.trim() || attachment?.fileName || 'Broadcast',
      type: type || (attachment ? 'attachment' : 'text'),
      attachment: attachment || undefined,
      readBy: [senderObjId],
      roomSeq: updatedBroadcast?.lastSeq || 1,
      broadcastListId: groupId,
    });

    // Fan out to each recipient's individual DM room
    const io = req.app.get('io') || req.app.get('socketio') || global.io;
    const recipientIds = (broadcastRoom.members || [])
      .map((m) => String(m?._id || m))
      .filter((id) => id && id !== String(senderId) && mongoose.Types.ObjectId.isValid(id));

    let deliveredRooms = 0;
    for (const rId of recipientIds) {
      const rObjId = new mongoose.Types.ObjectId(rId);
      let dmRoom = await ChatRoom.findOne({
        type: 'direct',
        members: { $all: [senderObjId, rObjId], $size: 2 }
      });
      if (!dmRoom) {
        const recipientUser = await User.findById(rObjId).select('name').lean();
        dmRoom = await ChatRoom.create({
          name: `${senderName} & ${recipientUser?.name || 'User'}`,
          type: 'direct',
          members: [senderObjId, rObjId],
          createdBy: senderObjId,
        });
      }
      const incRoom = await ChatRoom.findByIdAndUpdate(
        dmRoom._id,
        { $inc: { lastSeq: 1 }, updatedAt: new Date() },
        { new: true }
      );
      const dmMsg = await ChatMessage.create({
        roomId: dmRoom._id,
        senderId: senderObjId,
        senderName,
        content: sanitizedContent.trim() || attachment?.fileName || 'Broadcast',
        type: type || (attachment ? 'attachment' : 'text'),
        attachment: attachment || undefined,
        readBy: [senderObjId],
        roomSeq: incRoom?.lastSeq || 1,
        broadcastListId: groupId,
      });
      const populatedDm = await ChatMessage.findById(dmMsg._id)
        .populate('senderId', 'name username email role')
        .lean();
      try {
        await dispatchChatMessage({
          io,
          roomId: dmRoom._id,
          populatedMessage: populatedDm,
          targetRoom: dmRoom,
          senderId: String(senderId),
          rawContent: sanitizedContent,
          priority: 'normal',
        });
      } catch (_) {}
      deliveredRooms += 1;
    }

    const populatedListMsg = await ChatMessage.findById(listMsg._id)
      .populate('senderId', 'name username email role')
      .lean();

    return res.json({ success: true, data: populatedListMsg, deliveredRooms });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to send broadcast', error: err.message });
  }
};

// 6. View-Once Media Open Tracking
const markViewOnceOpened = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = getUid(req);
    if (!userId || !mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ success: false, message: 'Invalid message or user ID' });
    }
    const msg = await ChatMessage.findById(messageId).select('viewOnce viewedBy senderId attachment');
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });

    const alreadyViewed = (msg.viewedBy || []).some((v) => String(v.userId) === String(userId));
    if (!alreadyViewed) {
      await ChatMessage.updateOne(
        { _id: messageId },
        { $push: { viewedBy: { userId: new mongoose.Types.ObjectId(userId), viewedAt: new Date() } } }
      );
    }

    return res.json({ success: true, opened: true, alreadyViewed });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to mark view-once opened', error: err.message });
  }
};

// 7. Save Voice Note Transcript
const saveVoiceTranscript = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { transcript } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ success: false, message: 'Invalid message ID' });
    }
    const clean = sanitizeChatMessage(String(transcript || ''), 5000);
    await ChatMessage.updateOne({ _id: messageId }, { $set: { transcript: clean } });
    return res.json({ success: true, transcript: clean });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to save transcript', error: err.message });
  }
};

// 7B. Auto-Detect Language & Transcribe Voice Note via AI (Supports Any Language: Gujarati, Hindi, English, etc.)
const transcribeVoiceMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ success: false, message: 'Invalid message ID' });
    }

    const msg = await ChatMessage.findById(messageId).select('roomId attachment transcript').lean();
    if (!msg || !msg.attachment?.fileUrl) {
      return res.status(404).json({ success: false, message: 'Voice attachment not found' });
    }

    const openAiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!openAiKey && !geminiKey) {
      return res.status(503).json({
        success: false,
        code: 'TRANSCRIPTION_KEY_MISSING',
        message: 'Configure OPENAI_API_KEY or GEMINI_API_KEY in server .env to enable automatic multi-language voice transcription.'
      });
    }

    const audioRes = await axios.get(msg.attachment.fileUrl, {
      responseType: 'arraybuffer',
      timeout: 25000
    });
    const buffer = Buffer.from(audioRes.data);
    if (!buffer.length) {
      return res.status(400).json({ success: false, message: 'Empty audio file' });
    }

    const urlLower = String(msg.attachment.fileUrl).toLowerCase();
    const headerMime = String(audioRes.headers?.['content-type'] || '').split(';')[0].trim();
    const mimeType = headerMime.startsWith('audio/')
      ? headerMime
      : (urlLower.endsWith('.mp3') ? 'audio/mpeg'
        : urlLower.endsWith('.m4a') || urlLower.endsWith('.mp4') ? 'audio/mp4'
        : urlLower.endsWith('.ogg') ? 'audio/ogg'
        : urlLower.endsWith('.wav') ? 'audio/wav'
        : 'audio/webm');

    let rawTranscript = '';

    if (openAiKey) {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: openAiKey });
      const ext = mimeType.includes('mpeg') ? 'mp3' : mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : mimeType.includes('wav') ? 'wav' : 'webm';
      const fileObj = await OpenAI.toFile(buffer, `voice_${messageId}.${ext}`, { type: mimeType });
      try {
        const tr = await openai.audio.transcriptions.create({
          file: fileObj,
          model: 'gpt-4o-mini-transcribe',
          prompt: 'Auto-detect any spoken language (Gujarati, Hindi, English, Marathi, etc.) and transcribe verbatim in the native script.'
        });
        rawTranscript = tr?.text || '';
      } catch (primaryErr) {
        const trFallback = await openai.audio.transcriptions.create({
          file: await OpenAI.toFile(buffer, `voice_${messageId}.${ext}`, { type: mimeType }),
          model: 'whisper-1'
        });
        rawTranscript = trFallback?.text || '';
      }
    } else if (geminiKey) {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(geminiKey);
      const prompt = 'Auto-detect the exact spoken language(s) in this audio (such as Gujarati, Hindi, English, Marathi, Tamil, Punjabi, etc., or mixed). Transcribe the exact spoken words verbatim in the speaker\'s native script (for Gujarati use ગુજરાતી script, for Hindi use Devanagari हिन्दी script, for English use English). Do NOT translate into English. Output ONLY the clean verbatim transcript text with no quotes or extra commentary.';
      const modelNames = ['gemini-2.0-flash', 'gemini-1.5-flash'];
      for (const mName of modelNames) {
        try {
          const model = genAI.getGenerativeModel({ model: mName });
          const result = await model.generateContent([
            { inlineData: { mimeType, data: buffer.toString('base64') } },
            prompt
          ]);
          rawTranscript = result?.response?.text?.() || '';
          if (rawTranscript.trim()) break;
        } catch (gemErr) {
          if (mName === modelNames[modelNames.length - 1]) throw gemErr;
        }
      }
    }

    const clean = sanitizeChatMessage(String(rawTranscript || '').trim(), 5000);
    await ChatMessage.updateOne({ _id: messageId }, { $set: { transcript: clean } });

    const io = req.app.get('io');
    if (io && msg.roomId) {
      const roomIdStr = String(msg.roomId);
      let broadcast = io.to(roomIdStr);
      const room = await ChatRoom.findById(roomIdStr).select('members').lean();
      if (room?.members?.length) {
        room.members.forEach((m) => {
          const mid = String(m?._id || m);
          if (mid) broadcast = broadcast.to(`user_${mid}`);
        });
      }
      broadcast.emit('message-transcript-updated', {
        roomId: roomIdStr,
        messageId: String(messageId),
        transcript: clean
      });
    }

    return res.json({ success: true, transcript: clean });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to transcribe audio', error: err.message });
  }
};

// 8. User Chat Preferences (Wallpapers, Privacy Toggles, Media Auto-Download)
const getUserChatPreferences = async (req, res) => {
  try {
    const userId = getUid(req);
    if (!userId) return res.status(401).json({ success: false, message: 'User required' });
    const userObjId = new mongoose.Types.ObjectId(userId);
    let prefs = await ChatUserPreference.findOne({ userId: userObjId }).lean();
    if (!prefs) {
      prefs = {
        userId: userObjId,
        globalWallpaper: 'default',
        roomWallpapers: {},
        privacy: { lastSeen: 'everyone', readReceipts: true, onlineVisible: true },
        mediaAutoDownload: { photos: true, videos: false, documents: true, audio: true },
      };
    }
    return res.json({ success: true, data: prefs });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to load preferences', error: err.message });
  }
};

const updateUserChatPreferences = async (req, res) => {
  try {
    const userId = getUid(req);
    if (!userId) return res.status(401).json({ success: false, message: 'User required' });
    const userObjId = new mongoose.Types.ObjectId(userId);
    const { globalWallpaper, roomId, roomWallpaper, roomTone, hdMediaDefault, privacy, mediaAutoDownload } = req.body || {};

    const updateSet = { lastSeenAt: new Date() };
    if (globalWallpaper !== undefined) updateSet.globalWallpaper = String(globalWallpaper);
    if (roomId && roomWallpaper !== undefined) {
      updateSet[`roomWallpapers.${String(roomId)}`] = String(roomWallpaper);
    }
    if (roomId && roomTone !== undefined) {
      updateSet[`roomTones.${String(roomId)}`] = String(roomTone);
    }
    if (typeof hdMediaDefault === 'boolean') {
      updateSet.hdMediaDefault = hdMediaDefault;
    }
    if (privacy && typeof privacy === 'object') {
      if (privacy.lastSeen) updateSet['privacy.lastSeen'] = privacy.lastSeen === 'nobody' ? 'nobody' : 'everyone';
      if (typeof privacy.readReceipts === 'boolean') updateSet['privacy.readReceipts'] = privacy.readReceipts;
      if (typeof privacy.onlineVisible === 'boolean') updateSet['privacy.onlineVisible'] = privacy.onlineVisible;
    }
    if (mediaAutoDownload && typeof mediaAutoDownload === 'object') {
      ['photos', 'videos', 'documents', 'audio'].forEach((k) => {
        if (typeof mediaAutoDownload[k] === 'boolean') {
          updateSet[`mediaAutoDownload.${k}`] = mediaAutoDownload[k];
        }
      });
    }

    const updated = await ChatUserPreference.findOneAndUpdate(
      { userId: userObjId },
      { $set: updateSet },
      { upsert: true, new: true }
    ).lean();

    return res.json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update preferences', error: err.message });
  }
};

// 9. Storage Manager — Per-Room Media & Attachment Breakdown
const getStorageUsage = async (req, res) => {
  try {
    const userId = getUid(req);
    if (!userId) return res.status(401).json({ success: false, message: 'User required' });
    const userObjId = new mongoose.Types.ObjectId(userId);

    const rooms = await ChatRoom.find({ members: userObjId }).select('name type').lean();
    const roomIds = rooms.map((r) => r._id);
    const roomNameMap = new Map(rooms.map((r) => [String(r._id), r.name || 'Direct Chat']));

    const agg = await ChatMessage.aggregate([
      {
        $match: {
          roomId: { $in: roomIds },
          isDeleted: { $ne: true },
          'attachment.fileUrl': { $exists: true, $ne: '' },
        },
      },
      {
        $group: {
          _id: '$roomId',
          fileCount: { $sum: 1 },
          totalBytes: { $sum: { $ifNull: ['$attachment.fileSize', 0] } },
        },
      },
      { $sort: { totalBytes: -1, fileCount: -1 } },
    ]);

    const breakdown = agg.map((row) => ({
      roomId: String(row._id),
      roomName: roomNameMap.get(String(row._id)) || 'Chat',
      fileCount: row.fileCount,
      totalBytes: row.totalBytes,
    }));

    const totalBytes = breakdown.reduce((sum, b) => sum + (b.totalBytes || 0), 0);
    const totalFiles = breakdown.reduce((sum, b) => sum + (b.fileCount || 0), 0);

    return res.json({ success: true, data: { totalBytes, totalFiles, breakdown } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to compute storage usage', error: err.message });
  }
};

// 10. Group Event RSVP
const rsvpGroupEvent = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = getUid(req);
    const { status = 'going' } = req.body || {};
    if (!userId || !mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ success: false, message: 'Invalid message or user ID' });
    }
    const validStatus = ['going', 'maybe', 'not_going'].includes(status) ? status : 'going';
    const userObjId = new mongoose.Types.ObjectId(userId);
    await ChatMessage.updateOne({ _id: messageId }, { $pull: { 'eventMeta.rsvps': { userId: userObjId } } });
    const updated = await ChatMessage.findByIdAndUpdate(
      messageId,
      { $push: { 'eventMeta.rsvps': { userId: userObjId, status: validStatus, updatedAt: new Date() } } },
      { new: true }
    ).select('roomId eventMeta');
    if (!updated) return res.status(404).json({ success: false, message: 'Event message not found' });

    const io = req.app.get('io') || req.app.get('socketio') || global.io;
    if (io && updated.roomId) {
      io.to(String(updated.roomId)).emit('message-updated', { _id: messageId, roomId: updated.roomId, eventMeta: updated.eventMeta });
    }
    return res.json({ success: true, data: updated.eventMeta });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update RSVP', error: err.message });
  }
};

// 11. Shareable Call Link
const createCallLink = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = getUid(req);
    const { callType = 'video', title = 'Team Call' } = req.body || {};
    if (!userId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ success: false, message: 'Invalid room or user ID' });
    }
    const token = crypto.randomBytes(10).toString('hex');
    const userObjId = new mongoose.Types.ObjectId(userId);
    const senderUser = await User.findById(userObjId).select('name').lean();
    const senderName = senderUser?.name || req.user?.name || 'User';

    const room = await ChatRoom.findByIdAndUpdate(groupId, { $inc: { lastSeq: 1 }, updatedAt: new Date() }, { new: true });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const msg = await ChatMessage.create({
      roomId: groupId,
      senderId: userObjId,
      senderName,
      content: `Join ${callType === 'video' ? 'Video' : 'Voice'} Call: ${title}`,
      type: 'call-link',
      callLinkMeta: {
        token,
        callType: callType === 'voice' ? 'voice' : 'video',
        title: sanitizeChatMessage(String(title || 'Team Call'), 120),
        createdByName: senderName,
        active: true,
      },
      readBy: [userObjId],
      roomSeq: room.lastSeq || 1,
    });

    const populated = await ChatMessage.findById(msg._id).populate('senderId', 'name username email role').lean();
    const io = req.app.get('io') || req.app.get('socketio') || global.io;
    try {
      await dispatchChatMessage({ io, roomId: groupId, populatedMessage: populated, targetRoom: room, senderId: String(userId), rawContent: msg.content, priority: 'normal' });
    } catch (_) {}

    return res.json({ success: true, data: populated });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to create call link', error: err.message });
  }
};

// 12. Toggle End-to-End Encryption (E2EE) & Deterministic Safety Fingerprint
const toggleRoomE2EE = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { enabled } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ success: false, message: 'Invalid group ID' });
    }
    const room = await ChatRoom.findById(groupId).select('e2eeEnabled members');
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const nextState = typeof enabled === 'boolean' ? enabled : !room.e2eeEnabled;
    room.e2eeEnabled = nextState;
    await room.save();

    const memberSig = (room.members || []).map((m) => String(m?._id || m)).sort().join(':');
    const digest = crypto.createHash('sha256').update(`${String(groupId)}:${memberSig}`).digest('hex');
    const safetyNumbers = digest.slice(0, 60).replace(/[^0-9]/g, (c) => String(c.charCodeAt(0) % 10)).match(/.{1,5}/g)?.join(' ') || digest.slice(0, 30);

    return res.json({ success: true, e2eeEnabled: nextState, safetyNumbers });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to toggle E2EE', error: err.message });
  }
};

// 13. Communities (Parent Hub + Announcement Channel + Sub-Groups)
const createCommunity = async (req, res) => {
  try {
    const userId = getUid(req);
    const { name, description = '', subGroupIds = [] } = req.body || {};
    if (!userId || !name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Community name and user are required' });
    }
    const userObjId = new mongoose.Types.ObjectId(userId);
    const cleanName = sanitizeChatMessage(name.trim(), 100);

    const communityRoom = await ChatRoom.create({
      name: cleanName,
      description: sanitizeChatMessage(description, 400),
      type: 'community',
      createdBy: userObjId,
      members: [userObjId],
    });

    const announcementRoom = await ChatRoom.create({
      name: `${cleanName} — Announcements`,
      description: `Official announcements for ${cleanName}`,
      type: 'group',
      communityId: communityRoom._id,
      isAnnouncementChannel: true,
      createdBy: userObjId,
      members: [userObjId],
    });

    if (Array.isArray(subGroupIds) && subGroupIds.length > 0) {
      const validIds = subGroupIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
      if (validIds.length > 0) {
        await ChatRoom.updateMany({ _id: { $in: validIds } }, { $set: { communityId: communityRoom._id } });
      }
    }

    return res.json({ success: true, data: { community: communityRoom, announcementChannel: announcementRoom } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to create community', error: err.message });
  }
};

const linkCommunityGroups = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { subGroupIds = [] } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(communityId)) {
      return res.status(400).json({ success: false, message: 'Invalid community ID' });
    }
    const validIds = (Array.isArray(subGroupIds) ? subGroupIds : []).filter((id) => mongoose.Types.ObjectId.isValid(id));
    await ChatRoom.updateMany({ _id: { $in: validIds } }, { $set: { communityId: new mongoose.Types.ObjectId(communityId) } });
    return res.json({ success: true, linkedCount: validIds.length });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to link community groups', error: err.message });
  }
};

// 14. Saved Messages ("Chat with Yourself")
const getOrCreateSavedMessagesRoom = async (req, res) => {
  try {
    const userId = getUid(req);
    if (!userId) return res.status(401).json({ success: false, message: 'User required' });
    const userObjId = new mongoose.Types.ObjectId(userId);
    const groupKey = `saved_${String(userId)}`;

    let room = await ChatRoom.findOne({ groupKey }).populate('members', 'name username email role').lean();
    if (!room) {
      const created = await ChatRoom.create({
        name: 'Saved Messages',
        description: 'Your personal cloud notepad for notes, links, and files',
        type: 'direct',
        groupKey,
        members: [userObjId],
        createdBy: userObjId,
        pinnedBy: [userObjId],
      });
      room = await ChatRoom.findById(created._id).populate('members', 'name username email role').lean();
    }
    return res.json({ success: true, data: room });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to open Saved Messages', error: err.message });
  }
};

// 15. Message Reminders
const createMessageReminder = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = getUid(req);
    const { remindAt, roomName, snippet } = req.body || {};
    if (!userId || !mongoose.Types.ObjectId.isValid(messageId) || !remindAt) {
      return res.status(400).json({ success: false, message: 'Message ID and remindAt are required' });
    }
    const msg = await ChatMessage.findById(messageId).select('roomId content').lean();
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });

    const created = await ChatMessageReminder.create({
      userId: new mongoose.Types.ObjectId(userId),
      messageId: msg._id,
      roomId: msg.roomId,
      roomName: roomName || 'Chat',
      snippet: snippet || String(msg.content || '').slice(0, 140),
      remindAt: new Date(remindAt),
      fired: false,
    });
    return res.json({ success: true, data: created });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to set reminder', error: err.message });
  }
};

const getMyReminders = async (req, res) => {
  try {
    const userId = getUid(req);
    if (!userId) return res.status(401).json({ success: false, message: 'User required' });
    const list = await ChatMessageReminder.find({ userId: new mongoose.Types.ObjectId(userId), fired: false })
      .sort({ remindAt: 1 })
      .lean();
    return res.json({ success: true, data: list });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to load reminders', error: err.message });
  }
};

const deleteReminder = async (req, res) => {
  try {
    const { reminderId } = req.params;
    const userId = getUid(req);
    await ChatMessageReminder.deleteOne({ _id: reminderId, userId: new mongoose.Types.ObjectId(userId) });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete reminder', error: err.message });
  }
};

module.exports = {
  togglePinRoom,
  toggleMarkUnread,
  setChatLock,
  verifyChatLock,
  getInviteLink,
  resetInviteLink,
  toggleJoinApproval,
  joinByInviteToken,
  handleJoinRequest,
  sendBroadcastMessage,
  markViewOnceOpened,
  saveVoiceTranscript,
  transcribeVoiceMessage,
  getUserChatPreferences,
  updateUserChatPreferences,
  getStorageUsage,
  rsvpGroupEvent,
  createCallLink,
  toggleRoomE2EE,
  createCommunity,
  linkCommunityGroups,
  getOrCreateSavedMessagesRoom,
  createMessageReminder,
  getMyReminders,
  deleteReminder,
};
