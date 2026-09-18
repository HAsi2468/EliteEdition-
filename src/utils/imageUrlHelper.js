const config = require('../config/config');

/**
 * Normalizes any image URL into a clean, secure Cloudflare R2 or HTTPS endpoint.
 * Returns empty string '' if url is falsy/empty, preventing 404 GET requests.
 * 
 * @param {string} url - The raw image URL or path
 * @param {string} [designName] - Optional design identifier for smart resolution
 * @returns {string} Normalized R2 / HTTPS URL or empty string
 */
function normalizeImageUrl(url, designName = '') {
  if (!url || typeof url !== 'string' || !url.trim()) {
    if (designName && typeof designName === 'string' && designName.trim()) {
      const clean = designName.trim().replace(/\.(jpg|jpeg|png|webp|gif|svg)$/i, '');
      const r2 = ((config.r2 && config.r2.publicUrl) || 'https://pub-66cb4aaa7dca442893dd7569e70ff7bd.r2.dev').replace(/\/+$/, '');
      return `${r2}/designs/${encodeURIComponent(clean)}.jpg`;
    }
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

  // Extract clean filename if file is under /designs/ or /uploads/
  let subFolder = 'designs';
  let rawFilename = '';

  if (trimmed.includes('/designs/')) {
    subFolder = 'designs';
    rawFilename = trimmed.split('/designs/')[1];
  } else if (trimmed.includes('/uploads/')) {
    subFolder = 'uploads';
    rawFilename = trimmed.split('/uploads/')[1];
  } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      rawFilename = parsed.pathname.split('/').pop() || '';
    } catch (e) {
      rawFilename = trimmed.split('/').pop() || '';
    }
  } else if (!trimmed.includes('/')) {
    rawFilename = trimmed;
  }

  if (rawFilename) {
    // Strip query params and single decode to avoid double-encoding
    rawFilename = rawFilename.split('?')[0].split('#')[0];
    try { rawFilename = decodeURIComponent(rawFilename); } catch (e) {}
    rawFilename = rawFilename.replace(/^\/+/, '').trim();

    // Default to .jpg if no extension present and not a timestamped multer upload (e.g. image-178...)
    if (!/\.[a-zA-Z0-9]+$/.test(rawFilename) && !rawFilename.startsWith('image-')) {
      rawFilename = `${rawFilename}.jpg`;
    }

    if (r2Base) {
      return `${r2Base}/${subFolder}/${encodeURIComponent(rawFilename)}`;
    }
    return `/v1/${subFolder}/${encodeURIComponent(rawFilename)}`;
  }

  return trimmed;
}

module.exports = { normalizeImageUrl };
