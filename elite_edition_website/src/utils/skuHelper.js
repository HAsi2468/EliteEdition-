/**
 * SKU Helper Utility for Frontend Web Application
 */

/**
 * Extracts the base SKU design code from a full SKU code by stripping size suffixes.
 * Examples:
 *   - S-4_344-M   => S-4_344
 *   - S-4_344_M   => S-4_344
 *   - S-4_344-2XL => S-4_344
 *   - S-4_344_2XL => S-4_344
 *   - S-4_344-38  => S-4_344
 *   - S-4_344_38  => S-4_344
 *
 * @param {string} skuCode
 * @returns {string} Base SKU code
 */
export function extractBaseSku(skuCode) {
  if (!skuCode || typeof skuCode !== 'string') return '';
  const trimmed = skuCode.trim();

  // Regex matches trailing size tokens preceded by '-' or '_'
  // Size tokens: XS, S, M, L, XL, XXL, XXXL, 1XL..6XL, 26..54, FREE, FS, ONESIZE, OS
  const sizeSuffixRegex = /[-_](?:(?:[1-6]?[X]*[L])|(?:X*S)|[SML]|(?:[2-5][0-9])|FREE|FS|ONESIZE|OS)$/i;

  return trimmed.replace(sizeSuffixRegex, '');
}

/**
 * Extracts the size suffix from a SKU code.
 *
 * @param {string} skuCode
 * @returns {string} Extracted size or empty string
 */
export function extractSizeFromSku(skuCode) {
  if (!skuCode || typeof skuCode !== 'string') return '';
  const trimmed = skuCode.trim();
  const match = trimmed.match(/[-_]((?:[1-6]?[X]*[L])|(?:X*S)|[SML]|(?:[2-5][0-9])|FREE|FS|ONESIZE|OS)$/i);
  return match ? match[1].toUpperCase() : '';
}

/**
 * Normalizes SKU code string for indexing and storage.
 *
 * @param {string} skuCode
 * @returns {string} Clean base SKU code in upper case
 */
export function normalizeSkuCode(skuCode) {
  return extractBaseSku(skuCode).toUpperCase();
}

/**
 * Checks if input SKU / barcode matches item Master SKU or any linked Brand SKU/Barcode.
 *
 * @param {object} item
 * @param {string} inputSku
 * @returns {boolean}
 */
export function matchSkuOrBrandCode(item, inputSku) {
  if (!item || !inputSku) return false;
  const cleanInput = String(inputSku).trim().toLowerCase();
  if (!cleanInput) return false;

  // 1. Check Master SKU Code
  const masterSku = String(item.skuCode || item.sku || '').trim().toLowerCase();
  if (masterSku === cleanInput) return true;

  // 2. Check brandCodes array (objects [{ brand, code }] or strings)
  if (Array.isArray(item.brandCodes)) {
    for (const bc of item.brandCodes) {
      if (typeof bc === 'string' && bc.trim().toLowerCase() === cleanInput) {
        return true;
      }
      if (bc && typeof bc === 'object' && bc.code && String(bc.code).trim().toLowerCase() === cleanInput) {
        return true;
      }
    }
  }

  // 3. Check legacy brandSkus
  if (Array.isArray(item.brandSkus)) {
    for (const bs of item.brandSkus) {
      if (String(bs).trim().toLowerCase() === cleanInput) return true;
    }
  } else if (typeof item.brandSkus === 'string') {
    const splitSkus = item.brandSkus.split(',').map(s => s.trim().toLowerCase());
    if (splitSkus.includes(cleanInput)) return true;
  }

  return false;
}
