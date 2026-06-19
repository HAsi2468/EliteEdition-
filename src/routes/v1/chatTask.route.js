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
router.post('/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const host = req.get('host');
    const protocol = req.protocol;
    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    res.json({ success: true, fileUrl });
  } catch (error) {
    console.error('Error handling mock upload:', error);
    res.status(500).json({ success: false, message: 'Failed to upload image' });
  }
});

router.get('/rooms', async (req, res) => {
  try {
    const { userId } = req.query;
    
    let query = {};
    if (userId) {
      query = {
        $or: [
          { type: { $ne: 'direct' } }, // Match 'group' or undefined
          { type: 'direct', members: userId }
        ]
      };
    }

    const rooms = await ChatRoom.find(query).populate('members', 'username email');
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
    res.json({ success: true, data: room });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// Get chat history for a room
router.get('/rooms/:roomId/messages', async (req, res) => {
  try {
    const messages = await ChatMessage.find({ roomId: req.params.roomId })
      .populate('senderId', 'username email')
      .populate({
        path: 'taskId',
        populate: { path: 'assignees', select: 'username email' }
      })
      .sort({ createdAt: 1 }); // Oldest first for chat timeline
    res.json({ success: true, data: messages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// Get all Tasks
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate('assignees', 'username email')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

module.exports = router;
