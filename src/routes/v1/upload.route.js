const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isR2Configured, uploadToR2 } = require('../../utils/r2Storage');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../../../elite_edition_images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const memoryStorage = multer.memoryStorage();
const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    let ext = path.extname(file.originalname);
    if (!ext || ext === '.') {
      if (file.mimetype === 'image/jpeg') ext = '.jpg';
      else if (file.mimetype === 'image/png') ext = '.png';
      else if (file.mimetype === 'image/webp') ext = '.webp';
      else ext = '.jpg';
    }
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Dynamic multer middleware depending on R2 availability
const upload = multer({
  storage: isR2Configured() ? memoryStorage : diskStorage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max per image/file
});

router.post('/', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image or attachment file provided' });
  }

  const folder = (req.body?.folder || req.query?.folder || 'designs').trim();
  const designName = (req.body?.designName || req.query?.designName || '').trim();

  // 1. Cloudflare R2 Upload Path
  if (isR2Configured()) {
    try {
      let ext = path.extname(req.file.originalname);
      if (!ext || ext === '.') {
        if (req.file.mimetype === 'image/jpeg') ext = '.jpg';
        else if (req.file.mimetype === 'image/png') ext = '.png';
        else if (req.file.mimetype === 'image/webp') ext = '.webp';
        else if (req.file.mimetype === 'application/pdf') ext = '.pdf';
        else ext = '.bin';
      }

      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const rawBase = path.basename(req.file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${rawBase || 'file'}-${uniqueSuffix}${ext}`;

      // Upload file to R2 under specified folder (e.g. "Complaints/Digital_Print" or "designs")
      const r2Url = await uploadToR2({
        buffer: req.file.buffer,
        fileName: filename,
        mimeType: req.file.mimetype,
        folder: folder
      });

      // If designName is provided and folder is designs, also upload named version e.g. "ED-709.jpg"
      if (designName && folder === 'designs') {
        await uploadToR2({
          buffer: req.file.buffer,
          fileName: `${designName}${ext}`,
          mimeType: req.file.mimetype,
          folder: 'designs'
        }).catch(err => console.warn('[R2] Failed to save designName copy:', err.message));
      }

      return res.json({ url: r2Url, filename, folder });
    } catch (err) {
      console.error('[Cloudflare R2] Upload error:', err);
      return res.status(500).json({ error: 'Failed to upload file to Cloudflare R2: ' + err.message });
    }
  }

  // 2. Fallback Local Disk Path
  if (designName) {
    const ext = path.extname(req.file.filename) || '.jpg';
    const namedPath = path.join(uploadDir, `${designName}${ext}`);
    try {
      fs.copyFileSync(req.file.path, namedPath);
    } catch (e) {
      console.warn('Failed to copy uploaded file to designName path:', e.message);
    }
  }

  const fileUrl = `/designs/${req.file.filename}`;
  res.json({ url: fileUrl, folder });
});


module.exports = router;
