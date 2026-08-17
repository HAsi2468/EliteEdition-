/**
 * Utility functions for normalized design name and design number handling.
 * Resolves equivalencies like "122" <-> "ED-122" or "ED122" <-> "ED-122".
 */

export function areDesignsEquivalent(a, b) {
  if (!a || !b) return false;
  const s1 = String(a).trim().toUpperCase();
  const s2 = String(b).trim().toUpperCase();
  if (s1 === s2) return true;

  // Clean prefixes ED-, ED, PKD-, PKD, etc.
  const clean1 = s1.replace(/^(ED|PKD)[-\s]?/i, '').trim();
  const clean2 = s2.replace(/^(ED|PKD)[-\s]?/i, '').trim();

  if (clean1 && clean2 && clean1 === clean2) return true;
  return false;
}

export function cleanDesignNameString(str) {
  if (!str || typeof str !== 'string') return '';
  const parts = str.split(/[,&/+]|\band\b/i).map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];

  const uniqueList = [];
  for (const p of parts) {
    const existingIdx = uniqueList.findIndex(u => areDesignsEquivalent(u, p));
    if (existingIdx === -1) {
      uniqueList.push(p);
    } else {
      // Prefer ED- or PKD- prefixed version over raw numbers
      if (/^(ED|PKD)-/i.test(p) && !/^(ED|PKD)-/i.test(uniqueList[existingIdx])) {
        uniqueList[existingIdx] = p;
      }
    }
  }
  return uniqueList.join(', ');
}

export function extractDesignNames(str) {
  if (!str || typeof str !== 'string') return [];
  const cleaned = cleanDesignNameString(str);
  return cleaned
    .split(/[,&/+]|\band\b/i)
    .map(s => s.trim())
    .filter(Boolean);
}
