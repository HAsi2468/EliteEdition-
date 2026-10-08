/**
 * Centralized, bulletproof Design Image URL Helper for Cloudflare R2 and fallback engines.
 * Solves all extension mismatches (.jpg vs .jpeg vs .png), space encodings, and suffix discrepancies.
 */

export const R2_PUBLIC_BASE = 'https://pub-66cb4aaa7dca442893dd7569e70ff7bd.r2.dev';

/**
 * Extracts a clean relative filename from any raw URL or string.
 * Strips query parameters, hashes, leading slashes, and decodes any existing percent-encoding
 * so that subsequent encoding does not produce double-encoded (%2520) URLs.
 */
export function extractCleanFilename(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let str = raw.trim();
  if (str.startsWith('data:')) return '';

  if (str.includes('/design_samples/')) {
    str = 'design_samples/' + str.split('/design_samples/')[1];
  } else if (str.includes('/designs/')) {
    str = str.split('/designs/')[1];
  } else if (str.includes('/uploads/')) {
    str = str.split('/uploads/')[1];
  } else if (str.startsWith('http://') || str.startsWith('https://')) {
    try {
      const u = new URL(str);
      str = u.pathname.replace(/^\/+/, '');
    } catch (e) {
      str = str.split('/').pop() || '';
    }
  } else if (str.startsWith('/')) {
    str = str.replace(/^\/+/, '');
  }

  str = str.split('?')[0].split('#')[0];
  try {
    str = decodeURIComponent(str);
  } catch (e) {}

  return str.trim();
}

export const ACCEPTED_IMAGE_FORMATS = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/avif,image/bmp,.jpg,.jpeg,.png,.webp,.gif,.svg,.avif,.bmp';

export function isTiffFile(fileOrUrl) {
  if (!fileOrUrl) return false;
  if (typeof fileOrUrl === 'string') {
    return /\.tiff?($|\?)/i.test(fileOrUrl.trim());
  }
  const name = fileOrUrl.name || '';
  const type = (fileOrUrl.type || '').toLowerCase();
  return /\.tiff?$/i.test(name) || type === 'image/tiff' || type === 'image/tif';
}

export function validateImageFile(file) {
  if (!file) return { valid: false, error: 'No file provided' };
  if (isTiffFile(file)) {
    return {
      valid: false,
      error: 'TIFF files (.tif, .tiff) are not allowed. Please upload JPG, PNG, WEBP, or other image formats.'
    };
  }
  return { valid: true };
}

export function getDisplayImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const clean = url.trim();
  if (isTiffFile(clean)) {
    return `/v1/upload/preview?url=${encodeURIComponent(clean)}`;
  }
  return clean;
}

/**
 * Generates an ordered list of candidate URLs to load for a design.
 * The browser tries these sequentially on error until one succeeds.
 * 
 * Order of candidates:
 * 1. For TIFF files: on-the-fly backend JPEG conversion preview (/v1/upload/preview?url=...).
 * 2. Exact direct Cloudflare R2 link from rawUrl (with clean URI encoding).
 * 3. Extension swap variations on filename (.jpg, .jpeg, .png, .webp).
 * 4. Variations based on designName (.jpg, .jpeg, .png).
 * 5. Stripped designName (removing suffixes like ' D', ' F', '(1)', 'jpg', etc.).
 */

// ─── High-Speed In-Memory & Session Winning Image URL Cache ──────────────────
const imageWinnerMap = new Map();
const deadUrlsSet = new Set();

function getCacheKey(rawUrl, designName, isThumb) {
  const r = (rawUrl || '').trim();
  const d = (designName || '').trim().toUpperCase();
  return `${d}::${r}::${isThumb ? 'thumb' : 'full'}`;
}

export function recordWinningUrl(rawUrl, designName, winningUrl, isThumb = true) {
  if (!winningUrl || typeof winningUrl !== 'string') return;
  const key = getCacheKey(rawUrl, designName, isThumb);
  imageWinnerMap.set(key, winningUrl);
  // Also cache for generic designName without rawUrl if available
  const dName = (designName || '').trim().toUpperCase();
  if (dName) {
    imageWinnerMap.set(`${dName}::::${isThumb ? 'thumb' : 'full'}`, winningUrl);
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(`img_win_${key}`, winningUrl);
    }
  } catch (e) {}
}

export function getWinningUrl(rawUrl, designName, isThumb = true) {
  const key = getCacheKey(rawUrl, designName, isThumb);
  if (imageWinnerMap.has(key)) return imageWinnerMap.get(key);
  const dName = (designName || '').trim().toUpperCase();
  if (dName && imageWinnerMap.has(`${dName}::::${isThumb ? 'thumb' : 'full'}`)) {
    return imageWinnerMap.get(`${dName}::::${isThumb ? 'thumb' : 'full'}`);
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      const val = sessionStorage.getItem(`img_win_${key}`);
      if (val) {
        imageWinnerMap.set(key, val);
        return val;
      }
    }
  } catch (e) {}
  return null;
}

export function recordDeadUrl(url) {
  if (!url || typeof url !== 'string') return;
  // Keep set bounded to prevent unbounded memory growth
  if (deadUrlsSet.size > 2000) deadUrlsSet.clear();
  deadUrlsSet.add(url.trim());
}

export function isDeadUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return deadUrlsSet.has(url.trim());
}

/**
 * Pre-fetches an image in the background with low priority so that subsequent
 * views or zoom dialogs display the image instantly (0ms).
 */
export function prefetchImage(url) {
  if (!url || typeof window === 'undefined' || isDeadUrl(url)) return;
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
}

/**
 * Generates an ordered list of candidate URLs to load for a design.
 * The browser tries these sequentially on error until one succeeds.
 * 
 * Order of candidates:
 * 1. Cached winning URL (if previously resolved, instant 0ms hit).
 * 2. For TIFF files: on-the-fly backend JPEG conversion preview (/v1/upload/preview?url=...).
 * 3. High-efficiency WebP/JPEG backend thumbnail (for thumbnail mode) or direct Cloudflare R2 link (for HD).
 * 4. Extension swap variations on filename (.jpg, .jpeg, .png, .webp).
 * 5. Variations based on designName (.jpg, .jpeg, .png).
 * 6. Backend smart fallback route `/v1/designs/${cleanName}.jpg?fallback=1` which guarantees an SVG badge.
 */
export function getImageCandidates(rawUrl, designName, options = {}) {
  const isThumb = options.thumbnail !== false; // default true
  const width = options.width || 360;
  const thumbQuery = isThumb ? `?thumb=1&w=${width}` : '';

  const candidates = [];
  const seen = new Set();

  const add = (u) => {
    if (!u || typeof u !== 'string') return;
    const clean = u.trim();
    if (clean && !seen.has(clean) && !deadUrlsSet.has(clean)) {
      seen.add(clean);
      candidates.push(clean);
    }
  };

  // 0. Instant Cache Hit: If we already know the working URL for this design, prioritize it immediately!
  const knownWinner = getWinningUrl(rawUrl, designName, isThumb);
  if (knownWinner) {
    add(knownWinner);
  }

  const raw = (rawUrl || '').trim();
  const dName = (designName || '').trim();

  // 1. Data URLs are standalone
  if (raw.startsWith('data:')) {
    return [raw];
  }

  // 2. TIFF files: browsers cannot decode TIFF natively in <img> tags.
  // Prioritize server-side on-the-fly Sharp conversion to JPEG.
  if (isTiffFile(raw)) {
    add(`/v1/upload/preview?url=${encodeURIComponent(raw)}&w=${width}`);
    add(`/v1/upload/preview?url=${encodeURIComponent(raw)}`);
    // Companion preview file if saved alongside
    const companionJpg = raw.replace(/\.tiff?($|\?)/i, '-preview.jpg$1');
    if (companionJpg !== raw) {
      add(companionJpg);
    }
  }

  // 3. Google Drive Links: convert to direct Google CDN lh3 embed links (use s400 for thumbnails, s1600 for HD)
  if (raw.includes('drive.google.com') || raw.includes('googleusercontent') || raw.includes('lh3.google')) {
    let fid = '';
    const m1 = raw.match(/\/d\/([-\w]{20,})/);
    if (m1) fid = m1[1];
    if (!fid) {
      const m2 = raw.match(/[?&]id=([-\w]{20,})/);
      if (m2) fid = m2[1];
    }
    if (!fid) {
      const m3 = raw.match(/([-\w]{25,})/);
      if (m3) fid = m3[1];
    }
    if (fid) {
      const gSize = isThumb ? (width > 500 ? 's800' : 's400') : 's1600';
      return [`https://lh3.googleusercontent.com/d/${fid}=${gSize}`];
    }
  }

  const rawFilename = extractCleanFilename(raw);
  const cleanDesign = dName.replace(/\.(jpg|jpeg|png|webp|gif|svg|jfif|tiff?)$/i, '').trim();

  // 4. For thumbnails, prioritize backend thumbnail endpoint to avoid downloading 10MB+ raw originals
  if (isThumb && cleanDesign) {
    add(`/v1/designs/${encodeURIComponent(cleanDesign)}.jpg${thumbQuery}`);
  }
  if (isThumb && rawFilename && !rawFilename.startsWith('http')) {
    add(`/v1/designs/${encodeURIComponent(rawFilename)}${thumbQuery}`);
  }

  // 5. Direct absolute HTTP/HTTPS URL (Cloudflare R2 / CDN link)
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    add(raw);
  }

  // 6. Direct Cloudflare R2 links (and master fallbacks)
  if (rawFilename) {
    if (isTiffFile(rawFilename)) {
      add(`/v1/upload/preview?url=${encodeURIComponent(rawFilename)}`);
    }
    if (rawFilename.startsWith('design_samples/') || rawFilename.startsWith('designs/')) {
      add(`${R2_PUBLIC_BASE}/${rawFilename}`);
    } else {
      add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(rawFilename)}`);
      add(`${R2_PUBLIC_BASE}/design_samples/${encodeURIComponent(rawFilename)}`);
    }
    add(`/v1/designs/${encodeURIComponent(rawFilename)}`);

    if (!rawFilename.startsWith('image-') && !rawFilename.startsWith('blob-')) {
      const baseWithoutExt = rawFilename.replace(/\.(jpg|jpeg|png|webp|gif|svg|jfif)$/i, '');
      if (baseWithoutExt) {
        add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(baseWithoutExt)}.jpg`);
        add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(baseWithoutExt)}.jpeg`);
        add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(baseWithoutExt)}.png`);
        add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(baseWithoutExt)}.webp`);
        add(`/v1/designs/${encodeURIComponent(baseWithoutExt)}.jpg`);
      }
    }
  }

  // 5. For thumbnails, also include the backend endpoint if not already loaded
  if (isThumb && !raw.startsWith('http://') && !raw.startsWith('https://')) {
    if (rawFilename) {
      add(`/v1/designs/${encodeURIComponent(rawFilename)}${thumbQuery}`);
      const baseWithoutExt = rawFilename.replace(/\.(jpg|jpeg|png|webp|gif|svg|jfif)$/i, '');
      if (baseWithoutExt) {
        add(`/v1/designs/${encodeURIComponent(baseWithoutExt)}.jpg${thumbQuery}`);
      }
    }
    if (cleanDesign) {
      add(`/v1/designs/${encodeURIComponent(cleanDesign)}.jpg${thumbQuery}`);
    }
  }

  // 5. Candidates built from designName
  if (cleanDesign) {
    add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(cleanDesign)}.jpg`);
    add(`/v1/designs/${encodeURIComponent(cleanDesign)}.jpg`);
    add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(cleanDesign)}.jpeg`);
    add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(cleanDesign)}.png`);
    add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(cleanDesign)}.webp`);

    // Stripped suffix variations (e.g. 'ED-456 D' -> 'ED-456', 'ED-476(1)' -> 'ED-476', 'ED-81jpg' -> 'ED-81')
    const stripped1 = cleanDesign.replace(/\s+[A-Za-z0-9]$/, '').trim();
    const stripped2 = cleanDesign.replace(/\([0-9]+\)$/, '').trim();
    const stripped3 = cleanDesign.replace(/jpe?g$/i, '').trim();

    for (const s of [stripped1, stripped2, stripped3]) {
      if (s && s !== cleanDesign) {
        if (isThumb) {
          add(`/v1/designs/${encodeURIComponent(s)}.jpg${thumbQuery}`);
        }
        add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(s)}.jpg`);
        add(`/v1/designs/${encodeURIComponent(s)}.jpg`);
        add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(s)}.jpeg`);
        add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(s)}.png`);
      }
    }
  }

  // 6. Backend smart fallback route (guaranteed to return valid image or decorative SVG badge)
  const fallback = cleanDesign || rawFilename || 'DESIGN';
  add(`/v1/designs/${encodeURIComponent(fallback)}.jpg?fallback=1`);

  return candidates;
}

/**
 * Backward-compatible single URL converter. Returns the first primary candidate.
 */
export function convertDriveUrl(link, designName) {
  if (!link && !designName) return '';
  const candidates = getImageCandidates(link, designName);
  return candidates[0] || '';
}

/**
 * Server Request Optimizer: Converts any image source into a lightweight,
 * compressed thumbnail URL bounded to target width and quality (e.g. ?w=100&q=75)
 * preventing 5MB-15MB natural upload files from overloading high-density tables.
 */
export function getOptimizedThumbnailUrl(src, options = {}) {
  if (!src || typeof src !== 'string') return '';
  const clean = src.trim();
  if (clean.startsWith('data:')) return clean;

  const width = options.width || 100;
  const quality = options.quality || 75;

  // 1. Google Drive URLs -> Direct LH3 embed with bounded size
  if (clean.includes('drive.google.com') || clean.includes('googleusercontent') || clean.includes('lh3.google')) {
    let fid = '';
    const m1 = clean.match(/\/d\/([-\w]{20,})/);
    if (m1) fid = m1[1];
    if (!fid) {
      const m2 = clean.match(/[?&]id=([-\w]{20,})/);
      if (m2) fid = m2[1];
    }
    if (fid) {
      return `https://lh3.googleusercontent.com/d/${fid}=s${Math.min(width * 2, 200)}`;
    }
  }

  // 2. TIFF files -> backend preview converter
  if (isTiffFile(clean)) {
    return `/v1/upload/preview?url=${encodeURIComponent(clean)}&w=${width}&q=${quality}`;
  }

  // 3. Cloudflare R2 files -> Route through backend Sharp thumbnail pipeline
  if (clean.includes('r2.dev') || clean.startsWith(R2_PUBLIC_BASE)) {
    const rawFilename = extractCleanFilename(clean);
    if (rawFilename) {
      return `/v1/designs/${encodeURIComponent(rawFilename)}?thumb=1&w=${width}&q=${quality}`;
    }
  }

  // 4. Relative backend designs
  if (clean.startsWith('/v1/designs/') || clean.startsWith('/designs/')) {
    const sep = clean.includes('?') ? '&' : '?';
    return `${clean}${sep}thumb=1&w=${width}&q=${quality}`;
  }

  // 5. Default return
  return clean;
}

