const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isR2Configured, uploadToR2 } = require('../../utils/r2Storage');

const router = express.Router();

let uploadDir = path.join(__dirname, '../../../../elite_edition_images');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (e) {
  uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
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

const axios = require('axios');
const sharp = require('sharp');

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.pdf', '.gif', '.csv', '.xlsx', '.zip', '.svg', '.bmp']);

const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/pjpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/jfif': '.jfif',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
  'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
  'text/csv': '.csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/zip': '.zip',
};

function verifyFileSignature(buffer, ext) {
  if (!buffer || buffer.length < 4) return false;
  // JPEG / JFIF: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true;
  // PDF: 25 50 44 46 (%PDF)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return true;
  // WEBP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return true;
  // BMP: 42 4D
  if (buffer[0] === 0x42 && buffer[1] === 0x4D) return true;
  // ZIP / XLSX: 50 4B 03 04
  if (buffer[0] === 0x50 && buffer[1] === 0x4B && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)) return true;
  // CSV / plain text / SVG
  if (ext === '.csv' || ext === '.txt' || ext === '.svg') {
    return !buffer.slice(0, 512).includes(0x00);
  }
  // Generic fallback: check if starts with known safe image magic bytes
  if ((buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) ||
      (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) ||
      (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP')) {
    return true;
  }
  return false;
}

const fileFilter = (req, file, cb) => {
  let ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  // If no extension or name is blob/generic, infer from mimetype
  if ((!ext || ext === '.') && MIME_TO_EXT[mime]) {
    ext = MIME_TO_EXT[mime];
    file.originalname = `${path.basename(file.originalname || 'upload', ext)}${ext}`;
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    if (MIME_TO_EXT[mime]) {
      ext = MIME_TO_EXT[mime];
      file.originalname = `${path.basename(file.originalname || 'upload', ext)}${ext}`;
      return cb(null, true);
    }
    const err = new Error(`File extension '${ext}' is not permitted. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`);
    err.statusCode = 400;
    return cb(err, false);
  }
  cb(null, true);
};

// Dynamic multer middleware depending on R2 availability
const upload = multer({
  storage: isR2Configured() ? memoryStorage : diskStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max per image/file
  fileFilter
});

/**
 * GET /v1/upload/preview
 * Converts TIFF (.tif/.tiff) or large images into web-compatible JPEG on the fly using Sharp.
 * Allows browsers (Chrome/Firefox/Safari) to display TIFF artwork thumbnails and lightbox previews.
 */
router.get('/preview', async (req, res) => {
  try {
    const rawUrl = req.query.url;
    if (!rawUrl || typeof rawUrl !== 'string') {
      return res.status(400).send('Missing url parameter');
    }

    const targetUrl = rawUrl.trim();
    let imageBuffer = null;

    // 1. If local file path
    if (targetUrl.startsWith('/uploads/') || targetUrl.startsWith('uploads/')) {
      const cleanPath = targetUrl.replace(/^\/?uploads\//, '');
      const localPath = path.join(uploadDir, cleanPath);
      if (fs.existsSync(localPath)) {
        imageBuffer = fs.readFileSync(localPath);
      }
    }

    // 2. If remote URL (e.g. Cloudflare R2 CDN or external)
    if (!imageBuffer) {
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        // Assume R2 key if just a filename or relative path
        const { getR2PublicUrl } = require('../../utils/r2Storage');
        const remoteUrl = `${getR2PublicUrl()}/${targetUrl.replace(/^\/+/, '')}`;
        const resp = await axios.get(remoteUrl, {
          responseType: 'arraybuffer',
          timeout: 15000,
          maxContentLength: 100 * 1024 * 1024,
        });
        imageBuffer = Buffer.from(resp.data);
      } else {
        const resp = await axios.get(targetUrl, {
          responseType: 'arraybuffer',
          timeout: 15000,
          maxContentLength: 100 * 1024 * 1024,
        });
        imageBuffer = Buffer.from(resp.data);
      }
    }

    if (!imageBuffer) {
      return res.status(404).send('Image could not be retrieved');
    }

    let pipeline = sharp(imageBuffer).rotate();

    // Optional width resize for thumbnails
    const width = parseInt(req.query.w, 10);
    if (width && width > 0 && width <= 3000) {
      pipeline = pipeline.resize({ width, withoutEnlargement: true });
    }

    const jpegBuffer = await pipeline.jpeg({ quality: 85 }).toBuffer();

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=2592000');
    return res.send(jpegBuffer);
  } catch (err) {
    console.error('[Upload Preview] Conversion failed:', err.message);
    return res.status(500).send('Failed to generate image preview: ' + err.message);
  }
});

router.post('/', (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds maximum limit of 100MB' });
      }
      return res.status(400).json({ error: err.message || 'File upload validation failed' });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image or attachment file provided' });
  }

  let fileExt = path.extname(req.file.originalname || '').toLowerCase();
  const fileMime = (req.file.mimetype || '').toLowerCase();
  if (!fileExt || fileExt === '.') {
    fileExt = MIME_TO_EXT[fileMime] || '.jpg';
  }

  // Check and disallow TIFF files
  if (fileExt === '.tif' || fileExt === '.tiff' || fileMime === 'image/tiff' || fileMime === 'image/tif') {
    return res.status(400).json({
      error: 'TIFF files (.tif, .tiff) are not allowed. Please upload JPG, PNG, WEBP, or standard image formats.'
    });
  }

  // Magic bytes signature verification
  let fileBuffer = req.file.buffer;
  if (!fileBuffer && req.file.path && fs.existsSync(req.file.path)) {
    try {
      fileBuffer = fs.readFileSync(req.file.path);
    } catch (_) {}
  }
  if (fileBuffer && !verifyFileSignature(fileBuffer, fileExt)) {
    if (req.file.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
    return res.status(400).json({ error: 'File content does not match genuine allowed format signature.' });
  }

  const folder = (req.body?.folder || req.query?.folder || 'designs').trim();
  const designName = (req.body?.designName || req.query?.designName || '').trim();

  // 1. Cloudflare R2 Upload Path
  if (isR2Configured() && req.file.buffer) {
    try {
      let ext = fileExt;
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const rawBase = path.basename(req.file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${rawBase || 'file'}-${uniqueSuffix}${ext}`;

      // Upload file to R2 under specified folder (e.g. "Complaints/Digital_Print" or "designs" or "sample_reference")
      const r2Url = await uploadToR2({
        buffer: req.file.buffer,
        fileName: filename,
        mimeType: req.file.mimetype || 'image/jpeg',
        folder: folder
      });

      // If designName is provided and folder is designs, also upload named version e.g. "ED-709.jpg"
      if (designName && folder === 'designs') {
        await uploadToR2({
          buffer: req.file.buffer,
          fileName: `${designName}${ext}`,
          mimeType: req.file.mimetype || 'image/jpeg',
          folder: 'designs'
        }).catch(err => console.warn('[R2] Failed to save designName copy:', err.message));
      }

      return res.json({ url: r2Url, previewUrl: null, filename, folder });
    } catch (err) {
      console.error('[Cloudflare R2] Upload error:', err);
      // Fallback: save to disk if R2 fails
      try {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fallbackFilename = `r2fallback-${uniqueSuffix}${fileExt}`;
        const diskPath = path.join(uploadDir, fallbackFilename);
        fs.writeFileSync(diskPath, req.file.buffer);
        const fileUrl = `/uploads/${fallbackFilename}`;
        console.warn('[Cloudflare R2] Saved to local disk fallback:', fileUrl);
        return res.json({ url: fileUrl, filename: fallbackFilename, folder, warning: 'Saved locally as R2 fallback' });
      } catch (fallbackErr) {
        return res.status(500).json({ error: 'Failed to upload file to Cloudflare R2: ' + err.message });
      }
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

/**
 * POST /v1/upload/presign
 * Generates a pre-signed direct upload URL to bypass app server
 */
router.post('/presign', async (req, res) => {
  const { fileName, fileType, folder = 'designs' } = req.body || {};
  if (!fileName || !fileType) {
    return res.status(400).json({ error: 'fileName and fileType are required' });
  }

  // Reject TIFF
  const extCheck = path.extname(fileName || '').toLowerCase();
  const mimeCheck = (fileType || '').toLowerCase();
  if (extCheck === '.tif' || extCheck === '.tiff' || mimeCheck === 'image/tiff' || mimeCheck === 'image/tif') {
    return res.status(400).json({
      error: 'TIFF files (.tif, .tiff) are not allowed. Please upload JPG, PNG, WEBP, or standard image formats.'
    });
  }

  const { getPresignedR2UploadUrl, isR2Configured } = require('../../utils/r2Storage');
  if (!isR2Configured()) {
    return res.status(503).json({ error: 'Direct Cloudflare R2 storage is not configured on server' });
  }

  try {
    const ext = path.extname(fileName) || '.bin';
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const presigned = await getPresignedR2UploadUrl({
      fileName: uniqueName,
      fileType,
      folder,
      expiresIn: 300,
    });

    res.json({
      success: true,
      uploadUrl: presigned.uploadUrl,
      fileUrl: presigned.fileUrl,
      key: presigned.key,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate presigned upload URL: ' + err.message });
  }
});

/**
 * POST /v1/upload/multipart/initiate
 * Starts an S3/R2 multipart upload for large files (> 10MB)
 */
router.post('/multipart/initiate', async (req, res) => {
  const { fileName, fileType, folder = 'designs' } = req.body || {};
  if (!fileName) {
    return res.status(400).json({ error: 'fileName is required' });
  }

  // Reject TIFF
  const extCheck = path.extname(fileName || '').toLowerCase();
  const mimeCheck = (fileType || '').toLowerCase();
  if (extCheck === '.tif' || extCheck === '.tiff' || mimeCheck === 'image/tiff' || mimeCheck === 'image/tif') {
    return res.status(400).json({
      error: 'TIFF files (.tif, .tiff) are not allowed. Please upload JPG, PNG, WEBP, or standard image formats.'
    });
  }

  const { initiateMultipartR2Upload, isR2Configured } = require('../../utils/r2Storage');
  if (!isR2Configured()) {
    return res.status(503).json({ error: 'Direct Cloudflare R2 storage is not configured on server' });
  }

  try {
    const ext = path.extname(fileName) || '.bin';
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const result = await initiateMultipartR2Upload({
      fileName: uniqueName,
      fileType: fileType || 'application/octet-stream',
      folder,
    });

    res.json({
      success: true,
      uploadId: result.uploadId,
      key: result.key,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to initiate multipart upload: ' + err.message });
  }
});

/**
 * POST /v1/upload/multipart/part-url
 * Generates a pre-signed URL for an individual part chunk
 */
router.post('/multipart/part-url', async (req, res) => {
  const { key, uploadId, partNumber } = req.body || {};
  if (!key || !uploadId || !partNumber) {
    return res.status(400).json({ error: 'key, uploadId, and partNumber are required' });
  }

  const { getMultipartR2PartUrl, isR2Configured } = require('../../utils/r2Storage');
  if (!isR2Configured()) {
    return res.status(503).json({ error: 'Direct Cloudflare R2 storage is not configured on server' });
  }

  try {
    const result = await getMultipartR2PartUrl({
      key,
      uploadId,
      partNumber,
      expiresIn: 600,
    });

    res.json({
      success: true,
      partUploadUrl: result.partUploadUrl,
      partNumber: result.partNumber,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate part upload URL: ' + err.message });
  }
});

/**
 * POST /v1/upload/multipart/complete
 * Finalizes multipart upload and returns CDN file URL
 */
router.post('/multipart/complete', async (req, res) => {
  const { key, uploadId, parts } = req.body || {};
  if (!key || !uploadId || !Array.isArray(parts)) {
    return res.status(400).json({ error: 'key, uploadId, and parts array are required' });
  }

  const { completeMultipartR2Upload, isR2Configured } = require('../../utils/r2Storage');
  if (!isR2Configured()) {
    return res.status(503).json({ error: 'Direct Cloudflare R2 storage is not configured on server' });
  }

  try {
    const result = await completeMultipartR2Upload({
      key,
      uploadId,
      parts,
    });

    res.json({
      success: true,
      fileUrl: result.fileUrl,
      key: result.key,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete multipart upload: ' + err.message });
  }
});

module.exports = router;
