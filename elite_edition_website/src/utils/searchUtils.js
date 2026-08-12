/**
 * Universal flexible search matcher for Elite Edition modules.
 * Matches search strings flexibly:
 * - Handles prefix stripping (e.g., typing "648" matches "EDP-648", "EDP-0648", "PCH-648", etc.)
 * - Case-insensitive substring matching
 * - Supports nested object property paths (e.g. 'customer.name')
 */

export function matchSearchQuery(item, searchStr, fields = []) {
  if (!searchStr || !String(searchStr).trim()) return true;
  if (!item) return false;

  const rawQuery = String(searchStr).trim().toLowerCase();
  const normQuery = rawQuery.replace(/[^a-z0-9]/gi, '');
  const digitsOnlyQuery = rawQuery.replace(/\D/g, '');

  for (const field of fields) {
    let val = item;
    if (field.includes('.')) {
      val = field.split('.').reduce((obj, k) => (obj ? obj[k] : null), item);
    } else {
      val = item[field];
    }

    if (val === null || val === undefined) continue;

    const valArr = Array.isArray(val) ? val : [val];
    for (const v of valArr) {
      const strVal = String(v).trim().toLowerCase();
      const normVal = strVal.replace(/[^a-z0-9]/gi, '');
      const digitsOnlyVal = strVal.replace(/\D/g, '');

      // 1. Direct substring match (case-insensitive)
      if (strVal.includes(rawQuery)) return true;

      // 2. Normalized alphanumeric match (e.g., "edp648" matches "EDP-648")
      if (normQuery.length > 0 && normVal.includes(normQuery)) return true;

      // 3. Numeric part match (e.g. query "648" matching "EDP-648", "0648", "EDP-0648")
      if (digitsOnlyQuery.length > 0 && digitsOnlyVal.length > 0) {
        if (
          digitsOnlyVal.includes(digitsOnlyQuery) ||
          parseInt(digitsOnlyVal, 10) === parseInt(digitsOnlyQuery, 10)
        ) {
          return true;
        }
      }
    }
  }

  return false;
}
