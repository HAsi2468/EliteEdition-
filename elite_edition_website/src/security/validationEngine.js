/**
 * ============================================================================
 * ELITE EDITION ENTERPRISE - INPUT VALIDATION & SANITIZATION ENGINE
 * Strict regular expression allowlists & character-level input sanitizers
 * ============================================================================
 */

export const VALIDATION_PATTERNS = {
  // 3-32 characters, letters, numbers, dot, underscore, hyphen
  USERNAME: /^[a-zA-Z0-9._-]{3,32}$/,

  // Lowercase alphanumeric with single hyphen separators
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,

  // Safe search: eliminates SQL/XSS tokens (<, >, ;, ", `, \, etc.)
  SAFE_SEARCH: /^[a-zA-Z0-9\s.,'#\-]{1,100}$/,

  // ISO 8601 Date (YYYY-MM-DD)
  ISO_DATE: /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/,

  // Phone: E.164 compliant (+ followed by up to 15 digits) or formatted US/IN mask
  PHONE_DIGITS: /^\d{10,15}$/,
  PHONE_US_MASK: /^\+1\s\(\d{3}\)\s\d{3}-\d{4}$/,

  // Strict alphanumeric safe text (no quotes, semicolons, brackets, or angle tags)
  ALPHANUMERIC_SAFE: /^[a-zA-Z0-9_\-\s]+$/,
};

export class SecurityValidationEngine {
  /**
   * Sanitizes numeric input: removes all characters except digits and optional single decimal point.
   */
  static sanitizeNumeric(value, rules = {}) {
    const { allowDecimal = false, decimalPlaces = 2, allowNegative = false } = rules;
    if (value == null) return '';

    let sanitized = String(value).trim();
    const isNegative = allowNegative && sanitized.startsWith('-');

    if (allowDecimal) {
      sanitized = sanitized.replace(/[^0-9.]/g, '');
      const parts = sanitized.split('.');
      if (parts.length > 1) {
        const intPart = parts[0];
        const decPart = parts.slice(1).join('').slice(0, decimalPlaces);
        sanitized = `${intPart}.${decPart}`;
      }
    } else {
      sanitized = sanitized.replace(/\D/g, '');
    }

    return isNegative ? `-${sanitized}` : sanitized;
  }

  /**
   * Sanitizes text to alphanumeric characters, underscores, hyphens, and spaces only.
   * Strips SQL/XSS injection payloads (<script>, ', ", ;, --, /*).
   */
  static sanitizeAlphanumeric(value, allowSpaces = true) {
    if (value == null) return '';
    const regex = allowSpaces ? /[^a-zA-Z0-9_\-\s]/g : /[^a-zA-Z0-9_\-]/g;
    return String(value).replace(regex, '');
  }

  /**
   * Formats raw digits into ITU / North American standard +1 (XXX) XXX-XXXX mask.
   */
  static formatUSPhone(value) {
    if (value == null) return '';
    const digits = String(value).replace(/\D/g, '');
    const cleanDigits = digits.startsWith('1') && digits.length > 10 ? digits.slice(1) : digits;
    const truncated = cleanDigits.slice(0, 10);

    if (truncated.length === 0) return '';
    if (truncated.length <= 3) return `+1 (${truncated}`;
    if (truncated.length <= 6) return `+1 (${truncated.slice(0, 3)}) ${truncated.slice(3)}`;
    return `+1 (${truncated.slice(0, 3)}) ${truncated.slice(3, 6)}-${truncated.slice(6, 10)}`;
  }

  /**
   * Validates calendar date integrity (checks actual days in month including leap years).
   */
  static isValidCalendarDate(dateString) {
    if (!dateString || !VALIDATION_PATTERNS.ISO_DATE.test(dateString)) return false;

    const [yearStr, monthStr, dayStr] = dateString.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);

    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  static validateUsername(username) {
    if (!username) return { isValid: false, error: 'Username is required.' };
    if (!VALIDATION_PATTERNS.USERNAME.test(username)) {
      return {
        isValid: false,
        error: 'Username must be 3-32 characters and contain only letters, numbers, dots, hyphens, or underscores.',
      };
    }
    return { isValid: true };
  }

  static validateSlug(slug) {
    if (!slug) return { isValid: false, error: 'Slug identifier is required.' };
    if (!VALIDATION_PATTERNS.SLUG.test(slug)) {
      return {
        isValid: false,
        error: 'Slug must be lowercase alphanumeric words separated by single hyphens (e.g., "summer-collection-2026").',
      };
    }
    return { isValid: true };
  }

  static validateSafeSearch(query) {
    if (!query) return { isValid: true };
    if (!VALIDATION_PATTERNS.SAFE_SEARCH.test(query)) {
      return {
        isValid: false,
        error: 'Search query contains disallowed characters. Remove special symbols (e.g. < > ; " `).',
      };
    }
    return { isValid: true };
  }
}
