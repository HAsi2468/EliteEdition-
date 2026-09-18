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

  if (str.includes('/designs/')) {
    str = str.split('/designs/')[1];
  } else if (str.includes('/uploads/')) {
    str = str.split('/uploads/')[1];
  } else if (str.startsWith('http://') || str.startsWith('https://')) {
    try {
      const u = new URL(str);
      str = u.pathname.split('/').pop() || '';
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

/**
 * Generates an ordered list of candidate URLs to load for a design.
 * The browser tries these sequentially on error until one succeeds.
 * 
 * Order of candidates:
 * 1. Exact direct Cloudflare R2 link from rawUrl (with clean URI encoding).
 * 2. Extension swap variations on filename (.jpg, .jpeg, .png, .webp).
 * 3. Variations based on designName (.jpg, .jpeg, .png).
 * 4. Stripped designName (removing suffixes like ' D', ' F', '(1)', 'jpg', etc.).
 * 5. Backend smart fallback route `/v1/designs/${cleanName}.jpg?fallback=1` which guarantees an SVG badge.
 */
export function getImageCandidates(rawUrl, designName) {
  const candidates = [];
  const seen = new Set();

  const add = (u) => {
    if (!u || typeof u !== 'string') return;
    const clean = u.trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      candidates.push(clean);
    }
  };

  const raw = (rawUrl || '').trim();
  const dName = (designName || '').trim();

  // 1. Data URLs are standalone
  if (raw.startsWith('data:')) {
    return [raw];
  }

  // 2. Google Drive Links: convert to direct Google CDN lh3 embed links
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
      return [`https://lh3.googleusercontent.com/d/${fid}=s1000`];
    }
  }

  const rawFilename = extractCleanFilename(raw);

  // 3. If rawFilename has an extension or was specified in DB
  if (rawFilename) {
    add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(rawFilename)}`);
    const baseWithoutExt = rawFilename.replace(/\.(jpg|jpeg|png|webp|gif|svg|jfif)$/i, '');
    if (baseWithoutExt) {
      add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(baseWithoutExt)}.jpg`);
      add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(baseWithoutExt)}.jpeg`);
      add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(baseWithoutExt)}.png`);
      add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(baseWithoutExt)}.webp`);
    }
  }

  // 4. Candidates built from designName
  const cleanDesign = dName.replace(/\.(jpg|jpeg|png|webp|gif|svg|jfif)$/i, '').trim();
  if (cleanDesign) {
    add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(cleanDesign)}.jpg`);
    add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(cleanDesign)}.jpeg`);
    add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(cleanDesign)}.png`);
    add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(cleanDesign)}.webp`);

    // Stripped suffix variations (e.g. 'ED-456 D' -> 'ED-456', 'ED-476(1)' -> 'ED-476', 'ED-81jpg' -> 'ED-81')
    const stripped1 = cleanDesign.replace(/\s+[A-Za-z0-9]$/, '').trim();
    const stripped2 = cleanDesign.replace(/\([0-9]+\)$/, '').trim();
    const stripped3 = cleanDesign.replace(/jpe?g$/i, '').trim();

    for (const s of [stripped1, stripped2, stripped3]) {
      if (s && s !== cleanDesign) {
        add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(s)}.jpg`);
        add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(s)}.jpeg`);
        add(`${R2_PUBLIC_BASE}/designs/${encodeURIComponent(s)}.png`);
      }
    }
  }

  // 5. Backend smart fallback route (guaranteed to return valid image, never 404)
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
