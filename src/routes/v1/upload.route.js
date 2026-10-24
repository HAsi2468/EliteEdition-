const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isR2Configured, uploadToR2 } = require('../../utils/r2Storage');
const { decodeUnicodeFileName, sanitizeUnicodeKeyName } = require('../../utils/unicodeFileHelper');

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

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.jfif', '.png', '.webp', '.pdf', '.gif',
  '.csv', '.xlsx', '.xls', '.docx', '.doc', '.txt', '.zip', '.svg', '.bmp',
  '.md', '.markdown', '.json'
]);

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
  'text/plain': '.txt',
  'text/csv': '.csv',
  'text/markdown': '.md',
  'text/x-markdown': '.md',
  'application/json': '.json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'application/zip': '.zip',
};

function verifyFileSignature(buffer, ext) {
  if (!buffer || buffer.length < 4) return false;
  const cleanExt = (ext || '').toLowerCase();

  // PNG: 89 50 4E 47
  if (cleanExt === '.png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  }
  // JPEG / JFIF: FF D8 FF
  if (cleanExt === '.jpg' || cleanExt === '.jpeg' || cleanExt === '.jfif') {
    return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }
  // GIF: 47 49 46 38
  if (cleanExt === '.gif') {
    return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;
  }
  // PDF: 25 50 44 46 (%PDF)
  if (cleanExt === '.pdf') {
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }
  // WEBP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
  if (cleanExt === '.webp') {
    return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  // BMP: 42 4D
  if (cleanExt === '.bmp') {
    return buffer[0] === 0x42 && buffer[1] === 0x4D;
  }
  // ZIP / XLSX / DOCX: 50 4B 03 04 (PK)
  if (cleanExt === '.zip' || cleanExt === '.xlsx' || cleanExt === '.docx') {
    return buffer[0] === 0x50 && buffer[1] === 0x4B && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07);
  }
  // Legacy MS Office (DOC/XLS): D0 CF 11 E0
  if (cleanExt === '.doc' || cleanExt === '.xls') {
    return (buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) ||
           (buffer[0] === 0x50 && buffer[1] === 0x4B);
  }
  // CSV / plain text / SVG / Markdown / JSON (no null bytes in initial chunk)
  if (cleanExt === '.csv' || cleanExt === '.txt' || cleanExt === '.svg' || cleanExt === '.md' || cleanExt === '.markdown' || cleanExt === '.json') {
    return !buffer.slice(0, 512).includes(0x00);
  }
  return true;
}

const fileFilter = (req, file, cb) => {
  file.originalname = decodeUnicodeFileName(file.originalname);
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

// Dynamic multer middleware depending on R2 availability (up to 50MB)
const upload = multer({
  storage: isR2Configured() ? memoryStorage : diskStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter
});

/**
 * Validates a target URL against SSRF attacks.
 * Strictly allowlists safe HTTPS image CDN hosts and blocks:
 * AWS/Cloud metadata (169.254.0.0/16), localhost, loopbacks, private RFC-1918 IPs, file://, and arbitrary external hosts.
 */
function isSafeImageUrl(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string') return false;
  const trimmed = targetUrl.trim();

  // Block null bytes, directory traversal, and dangerous characters
  if (trimmed.includes('\0') || trimmed.includes('..') || trimmed.includes('\\')) {
    return false;
  }

  // Explicitly block dangerous URI schemes before any URL parsing
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('file:') ||
    lower.startsWith('gopher:') ||
    lower.startsWith('ftp:') ||
    lower.startsWith('data:') ||
    lower.startsWith('dict:') ||
    lower.startsWith('ldap:') ||
    lower.startsWith('tftp:')
  ) {
    return false;
  }

  // Allow safe relative paths to local uploads or R2 keys
  const isRelativeKey =
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('uploads/') ||
    trimmed.startsWith('designs/') ||
    trimmed.startsWith('sample_reference/') ||
    trimmed.startsWith('design_samples/');

  if (isRelativeKey && !trimmed.includes('://')) {
    // Only permit standard path characters
    return /^[a-zA-Z0-9_\-\.\/]+$/.test(trimmed.replace(/^\/+/, ''));
  }

  // If not a relative path, it MUST be a valid absolute HTTPS URL
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (e) {
    return false;
  }

  // Strict HTTPS protocol enforcement (blocks http://, file://, etc.)
  if (parsed.protocol !== 'https:') {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost, IP literals, AWS IMDS, private networks, and loopbacks
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    /^169\.254\./.test(hostname) || // AWS / Cloud IMDS Link-Local
    /^10\./.test(hostname) ||        // RFC-1918 Private Class A
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) || // RFC-1918 Private Class B
    /^192\.168\./.test(hostname) ||  // RFC-1918 Private Class C
    /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(hostname) || // Carrier-Grade NAT (RFC-6598)
    /^127\./.test(hostname) ||       // Loopbacks
    /^0\./.test(hostname) ||
    /^\d+$/.test(hostname) ||        // Decimal / DWORD IP (e.g. 2130706433)
    /^0x[0-9a-f]+$/i.test(hostname) || // Hex IP
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname) || // All raw IPv4 addresses
    hostname.startsWith('[') || hostname.endsWith(']') // IPv6 literals
  ) {
    return false;
  }

  // Allowlist of trusted image hosts only (Cloudflare R2, AWS S3, Elite Edition ERP domains, Google CDN)
  const isAllowedDomain =
    hostname.endsWith('.r2.dev') ||
    hostname.endsWith('.r2.cloudflarestorage.com') ||
    hostname.endsWith('.cloudflarestorage.com') ||
    hostname === 'eliteedition.in' ||
    hostname.endsWith('.eliteedition.in') ||
    hostname.endsWith('.s3.amazonaws.com') ||
    hostname.endsWith('.s3.ap-south-1.amazonaws.com') ||
    hostname === 'lh3.googleusercontent.com' ||
    hostname === 'drive.google.com';

  return isAllowedDomain;
}

/**
 * GET /v1/upload/preview
 * Converts TIFF (.tif/.tiff) or large images into web-compatible JPEG on the fly using Sharp.
 * Allows browsers (Chrome/Firefox/Safari) to display TIFF artwork thumbnails and lightbox previews.
 */
router.get('/preview', async (req, res) => {
  try {
    const rawUrl = req.query.url;
    if (!rawUrl || typeof rawUrl !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid url query parameter.' });
    }

    const targetUrl = rawUrl.trim();

    // SSRF Guard Check: Validate URL safety before attempting any network requests or file reads
    if (!isSafeImageUrl(targetUrl)) {
      return res.status(403).json({
        error: 'Forbidden: Access to requested URL host or protocol is blocked by SSRF security policies.'
      });
    }

    let imageBuffer = null;

    // 1. If local file path
    if (targetUrl.startsWith('/uploads/') || targetUrl.startsWith('uploads/')) {
      const cleanPath = targetUrl.replace(/^\/?uploads\//, '');
      const localPath = path.resolve(uploadDir, cleanPath);
      // Ensure path traversal cannot escape uploadDir
      if (localPath.startsWith(path.resolve(uploadDir)) && fs.existsSync(localPath)) {
        imageBuffer = fs.readFileSync(localPath);
      }
    }

    // 2. If remote URL (Cloudflare R2 CDN or verified HTTPS domain)
    if (!imageBuffer) {
      if (!targetUrl.startsWith('https://')) {
        // Assume R2 key if just a filename or relative key
        const { getR2PublicUrl } = require('../../utils/r2Storage');
        const publicBase = typeof getR2PublicUrl === 'function' ? getR2PublicUrl() : '';
        if (!publicBase) {
          return res.status(400).json({ error: 'Storage public URL is not configured.' });
        }
        const remoteUrl = `${publicBase}/${targetUrl.replace(/^\/+/, '')}`;
        if (!isSafeImageUrl(remoteUrl)) {
          return res.status(403).json({ error: 'Forbidden: Invalid R2 object URL target.' });
        }
        const resp = await axios.get(remoteUrl, {
          responseType: 'arraybuffer',
          timeout: 10000,
          maxRedirects: 0, // Prevent redirect SSRF bypass
          maxContentLength: 50 * 1024 * 1024,
        });
        imageBuffer = Buffer.from(resp.data);
      } else {
        const resp = await axios.get(targetUrl, {
          responseType: 'arraybuffer',
          timeout: 10000,
          maxRedirects: 0, // Prevent redirect SSRF bypass
          maxContentLength: 50 * 1024 * 1024,
        });
        imageBuffer = Buffer.from(resp.data);
      }
    }

    if (!imageBuffer) {
      return res.status(404).json({ error: 'Image could not be retrieved or found.' });
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
    // Never return 500 error; return standardized 400 Bad Request
    return res.status(400).json({
      error: 'Failed to generate image preview: Invalid image format or inaccessible resource.'
    });
  }
});

router.post('/', (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds maximum limit of 50MB' });
      }
      return res.status(400).json({ error: err.message || 'File upload validation failed' });
    }
    req.file = req.file || (req.files && req.files[0]);
    next();
  });
}, async (req, res) => {
  req.file = req.file || (req.files && req.files[0]);
  if (!req.file) {
    return res.status(400).json({ error: 'No image or attachment file provided' });
  }

  // Multi-language Unicode filename decode (Gujarati, Hindi, Arabic, Chinese, etc.)
  const cleanOriginalName = decodeUnicodeFileName(req.file.originalname);
  req.file.originalname = cleanOriginalName;

  let fileExt = path.extname(cleanOriginalName || '').toLowerCase();
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

  // Deep image content sniffing: Prevent spoofed images (e.g. JPEG magic bytes + ELF/script payloads)
  const isImageFormat = ['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.gif', '.bmp'].includes(fileExt);
  if (isImageFormat && fileBuffer) {
    try {
      const meta = await sharp(fileBuffer).metadata();
      if (!meta || !meta.width || !meta.height) {
        throw new Error('Image dimensions could not be parsed');
      }
    } catch (err) {
      if (req.file.path && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch (_) {}
      }
      return res.status(400).json({ error: 'Invalid or corrupt image content. Spoofed image files are strictly rejected.' });
    }
  }

  const folder = (req.body?.folder || req.query?.folder || 'designs').trim();
  const designName = (req.body?.designName || req.query?.designName || '').trim();

  // 1. Cloudflare R2 Upload Path
  if (isR2Configured() && req.file.buffer) {
    try {
      let ext = fileExt;
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const rawBase = sanitizeUnicodeKeyName(path.basename(cleanOriginalName, ext));
      const filename = `${rawBase || 'file'}-${uniqueSuffix}${ext}`;

      // Upload file to R2 under specified folder (e.g. "Complaints/Digital_Print" or "designs" or "sample_reference")
      const r2Url = await uploadToR2({
        buffer: req.file.buffer,
        fileName: filename,
        originalName: cleanOriginalName,
        mimeType: req.file.mimetype || 'image/jpeg',
        folder: folder
      });

      // If designName is provided and folder is designs, also upload named version e.g. "ED-709.jpg"
      if (designName && folder === 'designs') {
        await uploadToR2({
          buffer: req.file.buffer,
          fileName: `${designName}${ext}`,
          originalName: `${designName}${ext}`,
          mimeType: req.file.mimetype || 'image/jpeg',
          folder: 'designs'
        }).catch(err => console.warn('[R2] Failed to save designName copy:', err.message));
      }

      return res.json({
        url: r2Url,
        fileUrl: r2Url,
        previewUrl: null,
        filename,
        fileName: cleanOriginalName,
        originalName: cleanOriginalName,
        fileSize: req.file.size,
        folder
      });
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
        return res.json({
          url: fileUrl,
          fileUrl,
          filename: fallbackFilename,
          fileName: cleanOriginalName,
          originalName: cleanOriginalName,
          fileSize: req.file.size,
          folder,
          warning: 'Saved locally as R2 fallback'
        });
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
  res.json({
    url: fileUrl,
    fileUrl,
    filename: req.file.filename,
    fileName: cleanOriginalName,
    originalName: cleanOriginalName,
    fileSize: req.file.size,
    folder
  });
});

/**
 * GET /v1/upload/download
 * Serves files with Content-Disposition: attachment; filename="<originalName>"
 * so browser saves the file with original name rather than opening in new tab
 */
router.get('/download', async (req, res) => {
  const fileUrl = req.query.url;
  const originalName = req.query.filename || req.query.fileName || 'download';
  if (!fileUrl) {
    return res.status(400).send('Missing url parameter');
  }

  const safeName = (originalName || 'download').replace(/["\r\n]/g, '_');
  const asciiName = safeName.replace(/[^\x20-\x7E]/g, '_');

  // If local file path
  if (fileUrl.startsWith('/uploads/') || fileUrl.startsWith('/designs/')) {
    const localRel = fileUrl.replace(/^\/(uploads|designs)\//, '');
    const localPath = path.join(uploadDir, localRel);
    if (fs.existsSync(localPath)) {
      return res.download(localPath, safeName);
    }
  }

  // Strict SSRF guard for remote URLs
  if (!isSafeImageUrl(fileUrl)) {
    return res.status(403).json({ error: 'Forbidden: Access to requested URL host or protocol is blocked' });
  }

  // Stream remote R2/Cloudflare URL
  try {
    const response = await axios({
      method: 'GET',
      url: fileUrl,
      responseType: 'stream',
      timeout: 30000,
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400
    });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');
    res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`);
    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    response.data.pipe(res);
  } catch (err) {
    console.warn('[upload/download] Remote stream failed:', err.message);
    return res.status(400).json({ error: 'Failed to download remote file', details: err.message });
  }
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

  if (!ALLOWED_EXTENSIONS.has(extCheck)) {
    return res.status(400).json({
      error: `File extension '${extCheck}' is not permitted. Allowed extensions: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`
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
