/**
 * Pure SVG Code 128 (Type B) Barcode Generator
 * 100% self-contained, zero external network CDN dependencies, works completely offline.
 */

const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"                                 // 100-106
];

export function generateCode128Svg(rawText, height = 40, barColor = '#000000') {
  const text = (rawText || 'NO-SKU').trim();
  const START_B = 104;
  const STOP = 106;
  const codes = [START_B];
  let checkSum = START_B;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    const validCode = (code >= 0 && code <= 95) ? code : 0;
    codes.push(validCode);
    checkSum += validCode * (i + 1);
  }

  codes.push(checkSum % 103);
  codes.push(STOP);

  let patternStr = "";
  for (const c of codes) {
    patternStr += CODE128_PATTERNS[c] || "";
  }

  // Generate SVG bars
  let x = 0;
  let isBar = true;
  let rects = "";
  for (let i = 0; i < patternStr.length; i++) {
    const w = parseInt(patternStr[i], 10);
    if (isBar) {
      rects += `<rect x="${x}" y="0" width="${w}" height="${height}" fill="${barColor}" />`;
    }
    x += w;
    isBar = !isBar;
  }

  return `<svg viewBox="0 0 ${x} ${height}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

export function resolveItemSize(item, sku) {
  let s = '';
  if (Array.isArray(item?.size)) {
    s = item.size.filter(Boolean).map(x => String(x).trim()).filter(Boolean).join('/');
  } else if (item?.size && typeof item.size === 'string') {
    s = item.size.trim();
  }

  if (!s && item?.sizes) {
    if (Array.isArray(item.sizes)) {
      s = item.sizes.filter(Boolean).map(x => String(x).trim()).filter(Boolean).join('/');
    } else if (typeof item.sizes === 'string') {
      s = item.sizes.trim();
    }
  }

  // If size is still empty, try extracting size from SKU code (e.g. "S-469_L", "S-469-XL", "S-469-38")
  if (!s && sku) {
    const parts = sku.split(/[-_]/);
    const lastPart = parts[parts.length - 1]?.toUpperCase();
    const KNOWN_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL', '5XL', 'FS', 'FREE'];
    if (KNOWN_SIZES.includes(lastPart) || /^\d{2}$/.test(lastPart)) {
      s = lastPart;
    }
  }

  return s || 'Free Size';
}

export function resolveBarcodeTitle(item) {
  if (item?.brand && item.brand.toUpperCase() !== 'ELITE ONLINE' && item.brand.toUpperCase() !== 'ALL') {
    return item.brand.toUpperCase();
  }
  return 'EON';
}

