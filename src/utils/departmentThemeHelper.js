/**
 * Unified Department Brand Color & 50%-Lighter Duplicate Copy Helper
 * Used across all Invoices and Challans in every department.
 */

const COMPANY_BRAND_COLORS = {
  'Elite Digital Print': '#1e3a8a', // EDP (Royal Navy Blue)
  'Elite Stitching': '#059669',     // ES (Emerald Green)
  'Elite Edition': '#7c3aed',       // EE (Royal Violet)
  'Elite Fabtex': '#d97706',        // EF (Amber Gold)
  'Elite Online': '#4f46e5',        // EON (Vibrant Indigo)
  'Sobise': '#e11d48',              // SO (Rose Crimson)
  'Ethno wear': '#8b5a2b',          // EW (Warm Bronze Brown)
  'Yamunaji': '#0284c7',            // YJ (Ocean Sky Blue)
  'Yamunaji Creation': '#0284c7',
  'EXEDP': '#334155',               // EXEDP (Slate Navy)
};

function getCompanyBrandColor(entityName, customColor) {
  if (customColor && typeof customColor === 'string' && customColor.trim().startsWith('#')) {
    return customColor.trim();
  }
  const raw = String(entityName || '').trim();
  if (COMPANY_BRAND_COLORS[raw]) return COMPANY_BRAND_COLORS[raw];
  const norm = raw.toLowerCase().replace(/[\s_-]+/g, '');
  if (norm === 'ethnowear' || norm === 'ew') return '#8b5a2b';
  if (norm === 'yamunaji' || norm === 'yj' || norm === 'yamunajicreation') return '#0284c7';
  if (norm === 'elitefabtex' || norm === 'ef' || norm === 'fabtex') return '#d97706';
  if (norm === 'eliteedition' || norm === 'ee') return '#7c3aed';
  if (norm === 'elitestitching' || norm === 'es' || norm === 'stitching') return '#059669';
  if (norm === 'elitedigitalprint' || norm === 'elitedigitalprints' || norm === 'edp' || norm === 'digitalprint') return '#1e3a8a';
  if (norm === 'sobise' || norm === 'so') return '#e11d48';
  if (norm === 'eliteonline' || norm === 'eon' || norm === 'eo') return '#4f46e5';
  if (norm === 'exedp' || norm === 'ex-edp') return '#334155';
  return '#1e3a8a';
}

function hexToRgb(hex) {
  const clean = String(hex || '#1e3a8a').replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const bigint = parseInt(full, 16);
  if (isNaN(bigint)) return { r: 30, g: 58, b: 138 };
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

/**
 * Blends hex color with white (#ffffff).
 * factor = 1.0 -> 100% original color
 * factor = 0.5 -> 50% lighter than original color (Duplicate Copy primary color)
 * factor = 0.08 -> very soft background tint
 */
function tintColor(hex, factor = 0.08) {
  try {
    const { r, g, b } = hexToRgb(hex);
    const tr = Math.round(r * factor + 255 * (1 - factor));
    const tg = Math.round(g * factor + 255 * (1 - factor));
    const tb = Math.round(b * factor + 255 * (1 - factor));
    return `#${((1 << 24) + (tr << 16) + (tg << 8) + tb).toString(16).slice(1)}`;
  } catch (e) {
    return '#f1f5f9';
  }
}

/**
 * Returns the exact same department color, but 50% lighter (blended 50% with white)
 * for Duplicate Copies of Invoices and Challans.
 */
function getDuplicateLighterColor(baseBrandColor) {
  return tintColor(baseBrandColor, 0.50);
}

/**
 * Checks whether a document field has real user-entered data (not empty or placeholder).
 */
function isMeaningfulValue(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === 'number') return !isNaN(val) && val !== 0;
  if (Array.isArray(val)) return val.some(isMeaningfulValue);
  const str = String(val).trim();
  if (!str) return false;
  if (/^(--|—|-|n\/a|na|none|null|undefined)$/i.test(str)) return false;
  return true;
}

module.exports = {
  COMPANY_BRAND_COLORS,
  getCompanyBrandColor,
  hexToRgb,
  tintColor,
  getDuplicateLighterColor,
  isMeaningfulValue,
};
