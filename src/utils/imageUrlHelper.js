const config = require('../config/config');

/**
 * Extracts a usable image URL from any API product / inventory / order object.
 * Checks standard fields, array fields, and Unicommerce customFieldValues / itemDetailFieldDTOList.
 */
function extractApiImageUrl(item) {
  if (!item || typeof item !== 'object') return '';
  const directCandidates = [
    item.imageUrl,
    item.productImage,
    item.image_url,
    item.itemTypeImageUrl,
    item.image,
    item.photo,
    item.thumbnail,
    item.imgUrl,
    item.imageUrl1,
    Array.isArray(item.imageUrls) ? item.imageUrls[0] : null,
    Array.isArray(item.images) ? item.images[0] : null,
  ];

  for (const cand of directCandidates) {
    if (cand && typeof cand === 'string') {
      const t = cand.trim();
      if (t && t.toLowerCase() !== 'null' && t.toLowerCase() !== 'undefined' && !t.includes('placeholder')) {
        return t;
      }
    }
  }

  // Check Unicommerce customFieldValues or itemDetailFieldDTOList if present
  const customLists = [item.customFieldValues, item.itemDetailFieldDTOList];
  for (const list of customLists) {
    if (Array.isArray(list)) {
      for (const entry of list) {
        if (!entry || typeof entry !== 'object') continue;
        const val = entry.fieldValue || entry.value || entry.imageUrl || '';
        if (typeof val === 'string' && /^https?:\/\/.+/i.test(val.trim())) {
          return val.trim();
        }
      }
    } else if (list && typeof list === 'object') {
      for (const val of Object.values(list)) {
        if (typeof val === 'string' && /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)/i.test(val.trim())) {
          return val.trim();
        }
      }
    }
  }

  // Fallback: if productPageUrl is actually a direct image link
  if (typeof item.productPageUrl === 'string' && /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(item.productPageUrl.trim())) {
    return item.productPageUrl.trim();
  }

  return '';
}

/**
 * Normalizes any image URL into a clean, secure Cloudflare R2 or external CDN HTTPS endpoint.
 * Preserves external API / CDN domains (Myntra, Flipkart, Unicommerce, Amazon, etc.) intact!
 * Returns empty string '' if url is falsy/empty, preventing 404 GET requests.
 * 
 * @param {string} url - The raw image URL or path
 * @param {string} [designName] - Optional design identifier for smart resolution
 * @returns {string} Normalized R2 / HTTPS URL or empty string
 */
function normalizeImageUrl(url, designName = '') {
  const validDesignHint =
    designName &&
    typeof designName === 'string' &&
    designName.trim() &&
    !designName.trim().endsWith('-2') &&
    !/^(unnamed product|uniware sku|product|sku|n\/a|null|undefined|-)$/i.test(designName.trim());

  if (!url || typeof url !== 'string' || !url.trim() || url.trim().toLowerCase() === 'null') {
    if (validDesignHint) {
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

  // If this is an full HTTP/HTTPS URL, check whether it's an external API/CDN URL vs our own internal storage
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      const host = (parsed.hostname || '').toLowerCase();
      const isInternalHost =
        host === '3.7.174.180' ||
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.endsWith('eliteedition.in') ||
        host.endsWith('.r2.dev') ||
        host.endsWith('.r2.cloudflarestorage.com');

      if (!isInternalHost) {
        // External API / Marketplace CDN image URL (Myntra, Flipkart, Unicommerce, Amazon, Shopify, etc.)
        // Upgrade known CDN http:// links to https:// so browsers don't block mixed content
        if (parsed.protocol === 'http:') {
          parsed.protocol = 'https:';
          return parsed.toString();
        }
        return trimmed;
      }
    } catch (e) {
      // Fall through if URL constructor fails
    }
  }

  // Extract clean filename and preserve any valid subfolder for internal R2 / local paths
  let subFolder = 'designs';
  let rawFilename = '';

  if (trimmed.includes('/sample_reference/')) {
    subFolder = 'sample_reference';
    rawFilename = trimmed.split('/sample_reference/')[1];
  } else if (trimmed.includes('/design_samples/')) {
    subFolder = 'design_samples';
    rawFilename = trimmed.split('/design_samples/')[1];
  } else if (trimmed.includes('/designs/')) {
    subFolder = 'designs';
    rawFilename = trimmed.split('/designs/')[1];
  } else if (trimmed.includes('/uploads/')) {
    subFolder = 'uploads';
    rawFilename = trimmed.split('/uploads/')[1];
  } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      const cleanPath = parsed.pathname.replace(/^\/+/, '');
      const parts = cleanPath.split('/');
      if (parts.length > 1) {
        subFolder = parts.slice(0, -1).join('/');
        rawFilename = parts[parts.length - 1];
      } else {
        rawFilename = parts[0] || '';
      }
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

    // Default to .jpg if no extension present and not a timestamped multer upload (e.g. image-178... or blob-...)
    if (!/\.[a-zA-Z0-9]+$/.test(rawFilename) && !rawFilename.startsWith('image-') && !rawFilename.startsWith('blob-')) {
      rawFilename = `${rawFilename}.jpg`;
    }

    if (r2Base) {
      return `${r2Base}/${subFolder}/${encodeURIComponent(rawFilename)}`;
    }
    return `/v1/${subFolder}/${encodeURIComponent(rawFilename)}`;
  }

  return trimmed;
}

module.exports = { normalizeImageUrl, extractApiImageUrl };
