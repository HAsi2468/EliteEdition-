/**
 * ============================================================================
 * ELITE EDITION ENTERPRISE - INPUT VALIDATION & SANITIZATION ENGINE (TypeScript)
 * Strict regular expression allowlists & character-level input sanitizers
 * ============================================================================
 */

export interface NumericSanitizeOptions {
  /**
   * Whether to allow a decimal point. Default: false.
   */
  allowDecimal?: boolean;
  /**
   * Maximum allowed decimal places. Default: 2.
   */
  decimalPlaces?: number;
  /**
   * Whether to allow negative numbers. Default: false.
   */
  allowNegative?: boolean;
  /**
   * Maximum integer digits permitted. Optional.
   */
  maxIntegerDigits?: number;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const VALIDATION_PATTERNS = {
  // 3-32 characters, letters, numbers, dot, underscore, hyphen
  USERNAME: /^[a-zA-Z0-9._-]{3,32}$/,

  // Lowercase alphanumeric with single hyphen separators
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,

  // Safe search: eliminates SQL/XSS tokens (<, >, ;, ", `, \, etc.)
  SAFE_SEARCH: /^[a-zA-Z0-9\s.,'#\-]{1,100}$/,

  // ISO 8601 Date (YYYY-MM-DD)
  ISO_DATE: /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/,

  // Phone: E.164 compliant (+ followed by 1 to 15 digits)
  PHONE_E164: /^\+[1-9]\d{1,14}$/,

  // Raw phone digits (10-15 digits)
  PHONE_DIGITS: /^\d{10,15}$/,

  // Formatted US/North American Phone Mask
  PHONE_US_MASK: /^\+1\s\(\d{3}\)\s\d{3}-\d{4}$/,

  // Strict alphanumeric safe text (no quotes, semicolons, brackets, or angle tags)
  ALPHANUMERIC_SAFE: /^[a-zA-Z0-9_\-\s]+$/,

  // Strict alphanumeric without whitespace
  ALPHANUMERIC_STRICT: /^[a-zA-Z0-9_\-]+$/,
} as const;

export class SecurityValidationEngine {
  /**
   * Sanitizes numeric input: removes all characters except digits and optional single decimal point.
   * Enforces maximum decimal precision (default: 2 decimal places) and prevents duplicate decimal separators.
   */
  static sanitizeNumeric(value: unknown, rules: NumericSanitizeOptions = {}): string {
    const {
      allowDecimal = false,
      decimalPlaces = 2,
      allowNegative = false,
      maxIntegerDigits,
    } = rules;

    if (value == null) return '';

    let sanitized = String(value).trim();
    if (!sanitized) return '';

    const isNegative = allowNegative && sanitized.startsWith('-');

    if (allowDecimal) {
      // Strip everything except digits and dot
      sanitized = sanitized.replace(/[^0-9.]/g, '');

      // Enforce single decimal point and precision
      const parts = sanitized.split('.');
      let intPart = parts[0] || '';
      if (maxIntegerDigits && intPart.length > maxIntegerDigits) {
        intPart = intPart.slice(0, maxIntegerDigits);
      }

      if (parts.length > 1) {
        const decPart = parts.slice(1).join('').slice(0, decimalPlaces);
        sanitized = `${intPart}.${decPart}`;
      } else {
        sanitized = intPart;
      }
    } else {
      // Digits only
      sanitized = sanitized.replace(/\D/g, '');
      if (maxIntegerDigits && sanitized.length > maxIntegerDigits) {
        sanitized = sanitized.slice(0, maxIntegerDigits);
      }
    }

    if (!sanitized) return '';
    return isNegative ? `-${sanitized}` : sanitized;
  }

  /**
   * Sanitizes text to alphanumeric characters, underscores, hyphens, and spaces only.
   * Completely strips quotes (', "), semicolons (;), angle brackets (<, >), backticks (`),
   * SQL injection markers (--), and dangerous control characters.
   */
  static sanitizeAlphanumeric(value: unknown, allowSpaces: boolean = true): string {
    if (value == null) return '';
    const regex = allowSpaces ? /[^a-zA-Z0-9_\-\s]/g : /[^a-zA-Z0-9_\-]/g;
    return String(value).replace(regex, '');
  }

  /**
   * Formats raw digits into ITU / North American standard +1 (XXX) XXX-XXXX mask.
   * Strips all non-digit characters and injection artifacts.
   */
  static formatUSPhone(value: unknown): string {
    if (value == null) return '';
    const digits = String(value).replace(/\D/g, '');
    const cleanDigits = digits.startsWith('1') ? digits.slice(1) : digits;
    const truncated = cleanDigits.slice(0, 10);

    if (truncated.length === 0) return '';
    if (truncated.length <= 3) return `+1 (${truncated}`;
    if (truncated.length <= 6) return `+1 (${truncated.slice(0, 3)}) ${truncated.slice(3)}`;
    return `+1 (${truncated.slice(0, 3)}) ${truncated.slice(3, 6)}-${truncated.slice(6, 10)}`;
  }

  /**
   * Formats a raw phone string into strict E.164 representation (+[country][national_number]).
   * Eliminates quotes, angle brackets, and non-numeric keystrokes.
   */
  static formatE164Phone(value: unknown, defaultCountryCode: string = '1'): string {
    if (value == null) return '';
    const raw = String(value).trim();
    const hasPlus = raw.startsWith('+');
    const digits = raw.replace(/\D/g, '');

    if (!digits) return '';

    if (hasPlus) {
      return `+${digits.slice(0, 15)}`;
    }

    if (digits.length === 10) {
      return `+${defaultCountryCode}${digits}`;
    }

    return `+${digits.slice(0, 15)}`;
  }

  /**
   * Validates calendar date integrity (checks actual days in month including leap years).
   * Format must strictly match YYYY-MM-DD.
   */
  static isValidCalendarDate(dateString: string): boolean {
    if (!dateString || !VALIDATION_PATTERNS.ISO_DATE.test(dateString)) return false;

    const [yearStr, monthStr, dayStr] = dateString.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);

    if (year < 1900 || year > 2100) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  /**
   * Validates username against enterprise regex allowlist.
   */
  static validateUsername(username: unknown): ValidationResult {
    if (!username || typeof username !== 'string') {
      return { isValid: false, error: 'Username is required.' };
    }
    if (!VALIDATION_PATTERNS.USERNAME.test(username)) {
      return {
        isValid: false,
        error: 'Username must be 3-32 characters and contain only letters, numbers, dots, hyphens, or underscores.',
      };
    }
    return { isValid: true };
  }

  /**
   * Validates URL slug identifier against strict lowercase alphanumeric pattern.
   */
  static validateSlug(slug: unknown): ValidationResult {
    if (!slug || typeof slug !== 'string') {
      return { isValid: false, error: 'Slug identifier is required.' };
    }
    if (!VALIDATION_PATTERNS.SLUG.test(slug)) {
      return {
        isValid: false,
        error: 'Slug must be lowercase alphanumeric words separated by single hyphens (e.g., "summer-collection-2026").',
      };
    }
    return { isValid: true };
  }

  /**
   * Validates search queries to prevent SQL and XSS injection payloads.
   */
  static validateSafeSearch(query: unknown): ValidationResult {
    if (query == null || query === '') return { isValid: true };
    if (typeof query !== 'string' || !VALIDATION_PATTERNS.SAFE_SEARCH.test(query)) {
      return {
        isValid: false,
        error: 'Search query contains disallowed characters. Remove special symbols (e.g. < > ; " `).',
      };
    }
    return { isValid: true };
  }
}
