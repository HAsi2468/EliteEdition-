/**
 * Universal Date Formatting Utilities for Elite ERP
 * Strictly enforces DD/MM/YYYY formatting across all client devices,
 * operating systems, and browser locale settings.
 */

export function formatDateDDMMYYYY(dateVal, fallback = '—') {
  if (!dateVal) return fallback;

  // Handle strings directly to avoid browser timezone shift
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (!trimmed) return fallback;

    // Already in DD/MM/YYYY format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return trimmed;
    }
    // Handle DD-MM-YYYY -> DD/MM/YYYY
    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
      return trimmed.replace(/-/g, '/');
    }
    // Handle YYYY-MM-DD or ISO strings without timezone day-shifting
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const parts = trimmed.split('T')[0].split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
      }
    }
  }

  try {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (isNaN(d.getTime())) return fallback || String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return fallback || String(dateVal);
  }
}

export function formatDateTimeDDMMYYYY(dateVal, fallback = '—') {
  if (!dateVal) return fallback;
  try {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (isNaN(d.getTime())) return fallback || String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, '0');
    return `${day}/${month}/${year} ${strHours}:${minutes} ${ampm}`;
  } catch (e) {
    return fallback || String(dateVal);
  }
}

export const formatDate = formatDateDDMMYYYY;
export const formatDateTime = formatDateTimeDDMMYYYY;

export function toLocalYMD(dateVal = new Date()) {
  if (!dateVal) return '';
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
}

export function formatForInputDate(val) {
  if (!val) return '';
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.split('T')[0];
    if (/^\d{2}\/\d{2}\/\d{4}/.test(val)) {
      const [d, m, y] = val.split('/');
      return `${y}-${m}-${d}`;
    }
    if (/^\d{2}-\d{2}-\d{4}/.test(val)) {
      const [d, m, y] = val.split('-');
      return `${y}-${m}-${d}`;
    }
  }
  return toLocalYMD(val);
}

/**
 * Global Enforcer: Ensures that any incidental call to Date.prototype.toLocaleDateString()
 * across the application defaults strictly to DD/MM/YYYY standard format, overriding
 * any host-system locale (like US MM/DD/YYYY) that might otherwise cause confusion.
 */
export function enforceGlobalDDMMYYYYFormat() {
  if (typeof window === 'undefined') return;
  const originalToLocaleDateString = Date.prototype.toLocaleDateString;
  Date.prototype.toLocaleDateString = function (locales, options) {
    if (!locales || locales === 'en' || locales === 'en-US' || locales === 'en-IN' || locales === 'en-GB') {
      // If no custom month/weekday text formatting options are requested, force 2-digit DD/MM/YYYY
      if (!options || (!options.month && !options.weekday)) {
        const day = String(this.getDate()).padStart(2, '0');
        const month = String(this.getMonth() + 1).padStart(2, '0');
        const year = this.getFullYear();
        return `${day}/${month}/${year}`;
      }
    }
    return originalToLocaleDateString.call(this, locales || 'en-GB', options);
  };
}
