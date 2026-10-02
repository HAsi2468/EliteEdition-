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

// Dynamic multer middleware depending on R2 availability
const upload = multer({
  storage: isR2Configured() ? memoryStorage : diskStorage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max per image/file
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

router.post('/', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image or attachment file provided' });
  }

  // Check and disallow TIFF files
  const fileExt = path.extname(req.file.originalname || '').toLowerCase();
  const fileMime = (req.file.mimetype || '').toLowerCase();
  if (fileExt === '.tif' || fileExt === '.tiff' || fileMime === 'image/tiff' || fileMime === 'image/tif') {
    return res.status(400).json({
      error: 'TIFF files (.tif, .tiff) are not allowed. Please upload JPG, PNG, WEBP, or standard image formats.'
    });
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

      // If TIFF file, generate and upload high-quality JPEG web preview companion
      let previewUrl = null;
      const isTiff = ext.toLowerCase() === '.tif' || ext.toLowerCase() === '.tiff' || (req.file.mimetype && req.file.mimetype.includes('tiff'));
      if (isTiff) {
        try {
          const previewBuffer = await sharp(req.file.buffer).rotate().jpeg({ quality: 85 }).toBuffer();
          const previewFilename = `${rawBase || 'file'}-${uniqueSuffix}-preview.jpg`;
          previewUrl = await uploadToR2({
            buffer: previewBuffer,
            fileName: previewFilename,
            mimeType: 'image/jpeg',
            folder: folder
          });
        } catch (previewErr) {
          console.warn('[R2 Upload] Failed to generate TIFF companion preview:', previewErr.message);
        }
      }

      // If designName is provided and folder is designs, also upload named version e.g. "ED-709.jpg"
      if (designName && folder === 'designs') {
        await uploadToR2({
          buffer: req.file.buffer,
          fileName: `${designName}${ext}`,
          mimeType: req.file.mimetype,
          folder: 'designs'
        }).catch(err => console.warn('[R2] Failed to save designName copy:', err.message));
      }

      return res.json({ url: r2Url, previewUrl, filename, folder });
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
