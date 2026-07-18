const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const config = require('../../config/config');
const { ChatRoom, ChatMessage, Task } = require('../../db/models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'chat-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

const router = express.Router();

// Generate Pre-signed URL for S3
router.post('/presign', async (req, res) => {
  try {
    const { fileType } = req.body;
    if (!config.aws.accessKeyId) {
      return res.status(500).json({ success: false, message: 'AWS credentials not configured' });
    }

    const s3Client = new S3Client({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
    });

    const fileExtension = fileType.split('/')[1] || 'jpg';
    const fileName = `uploads/${crypto.randomUUID()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: config.aws.bucketName,
      Key: fileName,
      ContentType: fileType,
    });

    // URL valid for 60 seconds
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });

    res.json({
      success: true,
      data: {
        uploadUrl: signedUrl,
        fileUrl: `https://${config.aws.bucketName}.s3.${config.aws.region}.amazonaws.com/${fileName}`
      }
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({ success: false, message: 'Failed to generate presigned URL', error: error.message });
  }
});

// Mock Upload Route
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const host = req.get('host');
    const protocol = req.protocol;
    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    res.json({ 
      success: true, 
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype
    });
  } catch (error) {
    console.error('Error handling mock upload:', error);
    res.status(500).json({ success: false, message: 'Failed to upload file' });
  }
});

router.get('/rooms', async (req, res) => {
  try {
    const { userId } = req.query;
    
    let query = {};
    if (userId) {
      query = {
        $or: [
          { members: userId }, // Match any room where user is a member
          { type: { $ne: 'direct' }, $or: [ { members: { $exists: false } }, { members: { $size: 0 } } ] } // Match public group rooms
        ]
      };
    }

    const rooms = await ChatRoom.find(query).populate('members', 'name email');
    res.json({ success: true, data: rooms });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// Create a Chat Room
router.post('/rooms', async (req, res) => {
  try {
    const { name, type, members } = req.body;
    const room = await ChatRoom.create({ name, type, members });
    const populatedRoom = await ChatRoom.findById(room._id).populate('members', 'name email');
    
    // Broadcast room-created notification to all members' personal channels
    const io = req.app.get('socketio');
    if (io && populatedRoom.members) {
      populatedRoom.members.forEach(member => {
        const memId = member._id || member;
        io.to(`user_${memId}`).emit('room-created', populatedRoom);
      });
    }

    res.json({ success: true, data: populatedRoom });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// Get chat history for a room (with cursor-based pagination)
router.get('/rooms/:roomId/messages', async (req, res) => {
  try {
    const { limit = 50, before } = req.query;
    const query = { roomId: req.params.roomId };
    
    if (before) {
      query._id = { $lt: before };
    }

    const limitVal = parseInt(limit, 10);

    const messages = await ChatMessage.find(query)
      .populate('senderId', 'name email')
      .populate({
        path: 'reactions.user',
        select: 'name username email'
      })
      .populate({
        path: 'replyTo',
        populate: { path: 'senderId', select: 'name email' }
      })
      .populate({
        path: 'taskId',
        populate: [
          { path: 'assignees', select: 'name email' },
          { path: 'comments.sender', select: 'name username email' }
        ]
      })
      .sort({ createdAt: -1 }) // Newest first for cursor limit query
      .limit(limitVal);

    // Reverse to return chronological order (oldest first)
    messages.reverse();

    res.json({ success: true, data: messages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// Send a message to a room via HTTP (e.g. for sharing reports)
router.post('/rooms/:roomId/messages', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { senderId, content } = req.body;
    
    const newMessage = await ChatMessage.create({
      roomId,
      senderId,
      content,
      type: 'text'
    });
    
    const populatedMessage = await ChatMessage.findById(newMessage._id).populate('senderId', 'name email');
    
    // Broadcast message via socket if Socket.io is attached to req.app
    const io = req.app.get('socketio');
    if (io) {
      io.to(roomId).emit('receive-message', populatedMessage);
    }
    
    res.json({ success: true, data: populatedMessage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// Get all Tasks
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate('assignees', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

module.exports = router;
