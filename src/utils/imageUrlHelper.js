const config = require('../config/config');

/**
 * Normalizes any image URL into a clean, secure Cloudflare R2 or HTTPS endpoint.
 * Returns empty string '' if url is falsy/empty, preventing 404 GET requests.
 * 
 * @param {string} url - The raw image URL or path
 * @returns {string} Normalized R2 / HTTPS URL or empty string
 */
function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return '';
  }

  const trimmed = url.trim();
  if (trimmed.startsWith('data:')) return trimmed;

  // Google Drive share / embed links -> lh3.googleusercontent.com
  if (trimmed.includes('drive.google.com') || trimmed.includes('googleusercontent') || trimmed.includes('lh3.google')) {
    if (trimmed.includes('/folders/')) return '';
    let fid = '';
    const fileMatch = trimmed.match(/\/d\/([-\w]{20,})/);
    if (fileMatch) fid = fileMatch[1];
    if (!fid) {
      const openMatch = trimmed.match(/[?&]id=([-\w]{20,})/);
      if (openMatch) fid = openMatch[1];
    }
    if (!fid) {
      const idMatch = trimmed.match(/([-\w]{25,})/);
      if (idMatch) fid = idMatch[1];
    }
    if (fid) return `https://lh3.googleusercontent.com/d/${fid}=s1000`;
  }

  const r2Base = ((config.r2 && config.r2.publicUrl) || 'https://pub-66cb4aaa7dca442893dd7569e70ff7bd.r2.dev').replace(/\/+$/, '');

  // Extract clean path if file is under /designs/ or /uploads/
  let subPath = '';
  if (trimmed.includes('/designs/')) {
    subPath = `designs/${trimmed.split('/designs/')[1].replace(/^\/+/, '')}`;
  } else if (trimmed.includes('/uploads/')) {
    subPath = `uploads/${trimmed.split('/uploads/')[1].replace(/^\/+/, '')}`;
  }

  // 1. If Cloudflare R2 Public CDN URL is configured
  if (r2Base) {
    if (subPath) {
      return `${r2Base}/${subPath}`;
    }
    if (trimmed.startsWith('https://')) {
      return trimmed;
    }
  }

  // 2. Insecure IP Backend URLs e.g. "http://3.7.174.180:3001/designs/ED-476(1).jpg" -> convert to relative HTTPS route
  if (trimmed.includes('3.7.174.180') || trimmed.startsWith('http://')) {
    if (subPath) {
      return `/v1/${subPath}`;
    }
    const cleanPath = trimmed.replace(/^http:\/\/[^\/]+/, '');
    return cleanPath.startsWith('/designs/') ? `/v1${cleanPath}` : cleanPath;
  }

  // 3. Absolute HTTPS external links (R2, AWS S3, etc.)
  if (trimmed.startsWith('https://')) {
    return trimmed;
  }

  // 4. Relative paths or bare filenames e.g. "ED-476.jpg" or "/designs/ED-476.jpg"
  if (subPath) {
    return `/v1/${subPath}`;
  }

  if (!trimmed.startsWith('http') && !trimmed.includes('/')) {
    const filename = trimmed.includes('.') ? trimmed : `${trimmed}.jpeg`;
    return `/v1/designs/${encodeURIComponent(filename)}`;
  }

  return trimmed;
}

module.exports = { normalizeImageUrl };
