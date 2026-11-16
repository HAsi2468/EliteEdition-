/**
 * Centralized, bulletproof Design Image URL Helper for Cloudflare R2 and fallback engines.
 * Solves all extension mismatches (.jpg vs .jpeg vs .png), space encodings, and suffix discrepancies.
 */

export const R2_PUBLIC_BASE = 'https://pub-66cb4aaa7dca442893dd7569e70ff7bd.r2.dev';

/**
 * Extracts a usable product image URL from any EON / API product, inventory, or sale order object.
 */
export function extractApiProductImage(item) {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item !== 'object') return '';

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

  // Check Unicommerce customFieldValues or itemDetailFieldDTOList
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

  if (typeof item.productPageUrl === 'string' && /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(item.productPageUrl.trim())) {
    return item.productPageUrl.trim();
  }

  return '';
}

function isExternalCdnUrl(raw) {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
  try {
    const parsed = new URL(trimmed);
    const host = (parsed.hostname || '').toLowerCase();
    return !(
      host === '3.7.174.180' ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('eliteedition.in') ||
      host.endsWith('.r2.dev') ||
      host.endsWith('.r2.cloudflarestorage.com')
    );
  } catch (e) {
    return false;
  }
}

/**
 * Extracts a clean relative filename from any raw URL or string.
 * Strips query parameters, hashes, leading slashes, and decodes any existing percent-encoding
 * so that subsequent encoding does not produce double-encoded (%2520) URLs.
 */
export function extractCleanFilename(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let str = raw.trim();
  if (str.startsWith('data:')) return '';
  if (isExternalCdnUrl(str)) return '';

  if (str.includes('/sample_reference/')) {
    str = 'sample_reference/' + str.split('/sample_reference/')[1];
  } else if (str.includes('/design_samples/')) {
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
  if (!rawUrl && dName && imageWinnerMap.has(`${dName}::::${isThumb ? 'thumb' : 'full'}`)) {
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

  // Strict mode for EON Inventory: never guess R2/design URLs if no explicit Uniware/product URL exists
  if (options.strictDirectOnly && !raw) {
    return [];
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
  const cleanDesign = (dName || '').replace(/\.(jpg|jpeg|png|webp|gif|svg|jfif|tiff?)$/i, '').trim();
  const isCatalogOrInv = options.category === 'catalog' || options.category === 'inventory';

  // Collect all valid text identifiers (sku, brand codes, designName, etc.)
  const nameSet = new Set();
  const addNameCandidate = (val) => {
    if (!val || typeof val !== 'string') return;
    const trimmed = val.trim();
    if (!trimmed || trimmed.length > 40 || trimmed.includes('—')) return;
    const upper = trimmed.toUpperCase();
    if (
      upper === 'UNNAMED PRODUCT' ||
      upper === 'UNIWARE SKU' ||
      upper === 'PRODUCT' ||
      upper === 'ITEM' ||
      upper === 'SKU' ||
      upper === 'DEFAULT' ||
      upper === 'N/A' ||
      upper === 'KURTA SET' ||
      upper === 'APPAREL'
    ) {
      return;
    }
    nameSet.add(trimmed);
  };

  if (options.sku) addNameCandidate(options.sku);
  addNameCandidate(cleanDesign);
  if (Array.isArray(options.identifiers)) {
    options.identifiers.forEach(addNameCandidate);
  }

  // 4. Direct absolute HTTP/HTTPS URL (API product image link / Marketplace CDN / Cloudflare R2)
  // Load directly from Cloudflare R2 Edge CDN (zero EC2 bottleneck); only use /v1/upload/preview for TIFFs.
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    if (isExternalCdnUrl(raw)) {
      const httpsRaw = raw.startsWith('http://') ? raw.replace(/^http:\/\//i, 'https://') : raw;
      add(httpsRaw);
      add(`/v1/upload/preview?url=${encodeURIComponent(httpsRaw)}&w=${width}`);
      if (raw !== httpsRaw) add(raw);
      return candidates;
    }
    if (isThumb) {
      add(`/v1/upload/preview?url=${encodeURIComponent(raw)}&w=${width}`);
    }
    add(raw);
    if (raw.includes('/designs/')) {
      add(raw.replace('/designs/', '/sample_reference/'));
    } else if (raw.includes('/sample_reference/')) {
      add(raw.replace('/sample_reference/', '/designs/'));
    }
    return candidates;
  }

  // 5. Direct Cloudflare R2 links from rawFilename
  if (rawFilename) {
    if (isTiffFile(rawFilename)) {
      add(`/v1/upload/preview?url=${encodeURIComponent(rawFilename)}`);
    }
    if (rawFilename.startsWith('sample_reference/') || rawFilename.startsWith('design_samples/') || rawFilename.startsWith('designs/')) {
      add(`${R2_PUBLIC_BASE}/${rawFilename}`);
    } else {
      add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(rawFilename)}`);
      if (!isCatalogOrInv) {
        add(`${R2_PUBLIC_BASE}/sample_reference/${encodeURIComponent(rawFilename)}`);
        add(`${R2_PUBLIC_BASE}/design_samples/${encodeURIComponent(rawFilename)}`);
        add(`/uploads/${encodeURIComponent(rawFilename)}`);
      }
    }

    if (!isCatalogOrInv && !rawFilename.startsWith('image-') && !rawFilename.startsWith('blob-')) {
      const baseWithoutExt = rawFilename.replace(/\.(jpg|jpeg|png|webp|gif|svg|jfif)$/i, '');
      if (baseWithoutExt) {
        add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(baseWithoutExt)}.jpg`);
        add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(baseWithoutExt)}.jpeg`);
        add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(baseWithoutExt)}.png`);
        add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(baseWithoutExt)}.webp`);
        add(`/uploads/${encodeURIComponent(baseWithoutExt)}.jpg`);
      }
    }
  }

  // 6. Candidates built from identifiers (SKU, brand codes, designName)
  for (const ident of nameSet) {
    const cleanIdent = ident.replace(/\.(jpg|jpeg|png|webp|gif|svg|jfif)$/i, '').trim();
    if (!cleanIdent) continue;

    // For EON catalog/inventory items without an explicit API image URL, do not fire speculative 404 R2 requests.
    if (isCatalogOrInv) {
      break;
    }

    // Direct match with common image extensions
    add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(cleanIdent)}.jpg`);
    add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(cleanIdent)}.jpeg`);
    add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(cleanIdent)}.png`);
    add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(cleanIdent)}.webp`);
    add(`/uploads/${encodeURIComponent(cleanIdent)}.jpg`);

    // Numeric SKU prefixes (e.g. SKU '273' -> 'ED-273', 'S-273', 'ED-0273')
    if (/^\d+$/.test(cleanIdent)) {
      add(`${R2_PUBLIC_BASE}/designs/ED-${cleanIdent}.jpg`);
      add(`${R2_PUBLIC_BASE}/designs/ED-${cleanIdent}.jpeg`);
      add(`${R2_PUBLIC_BASE}/designs/ED-${cleanIdent}.png`);
      add(`${R2_PUBLIC_BASE}/designs/S-${cleanIdent}.jpg`);
      add(`${R2_PUBLIC_BASE}/designs/ED-0${cleanIdent}.jpg`);
      add(`/uploads/ED-${cleanIdent}.jpg`);
    }

    // Prefixed SKU without prefix (e.g. 'ED-273' -> '273', 'S-469' -> '469')
    const unprefix = cleanIdent.replace(/^(ED|S|SKU)[-_]/i, '').trim();
    if (unprefix && unprefix !== cleanIdent) {
      add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(unprefix)}.jpg`);
      add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(unprefix)}.jpeg`);
      add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(unprefix)}.png`);
      add(`/uploads/${encodeURIComponent(unprefix)}.jpg`);
    }

    // Stripped suffix variations (e.g. 'ED-456 D' -> 'ED-456', 'ED-476(1)' -> 'ED-476', 'ED-81jpg' -> 'ED-81')
    const stripped1 = cleanIdent.replace(/\s+[A-Za-z0-9]$/, '').trim();
    const stripped2 = cleanIdent.replace(/\([0-9]+\)$/, '').trim();
    const stripped3 = cleanIdent.replace(/jpe?g$/i, '').trim();

    for (const s of [stripped1, stripped2, stripped3]) {
      if (s && s !== cleanIdent) {
        add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(s)}.jpg`);
        add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(s)}.jpeg`);
        add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(s)}.png`);
      }
    }

    // Sample reference & design samples folders on R2
    add(`${R2_PUBLIC_BASE}/sample_reference/${encodeURIComponent(cleanIdent)}.jpg`);
    add(`${R2_PUBLIC_BASE}/design_samples/${encodeURIComponent(cleanIdent)}.jpg`);

    if (candidates.length >= 6) break;
  }

  return candidates.slice(0, 6);
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

  // 3. Cloudflare R2 files -> Load directly from Cloudflare R2 CDN!
  if (clean.includes('r2.dev') || clean.startsWith(R2_PUBLIC_BASE)) {
    return clean;
  }

  // 4. Relative uploads
  if (clean.startsWith('/uploads/') || clean.startsWith('uploads/')) {
    return clean.startsWith('/') ? clean : `/${clean}`;
  }

  // 5. External HTTP CDN URLs -> upgrade to HTTPS so browsers never block mixed content
  if (clean.startsWith('http://') && isExternalCdnUrl(clean)) {
    return clean.replace(/^http:\/\//i, 'https://');
  }

  // 6. Default return
  return clean;
}

