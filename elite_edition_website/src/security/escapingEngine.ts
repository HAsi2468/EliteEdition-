/**
 * ============================================================================
 * ELITE EDITION ENTERPRISE - CONTEXT-AWARE OUTPUT ESCAPING ENGINE (TypeScript)
 * Prevents XSS breakouts across HTML Body, Attribute, URL, and Script Contexts
 * ============================================================================
 */

export const HTML_BODY_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

const HTML_BODY_REGEX = /[&<>"'/]/g;

export const ATTR_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '`': '&#x60;',
  '=': '&#x3D;',
  '\t': '&#x9;',
  '\n': '&#xA;',
  '\r': '&#xD;',
  '\f': '&#xC;',
  '\v': '&#xB;',
  '\0': '&#x0;',
};

const ATTR_REGEX = /[&<>"'`=\t\n\r\f\v\0]/g;

const ALLOWED_URL_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

export class ContextAwareEscaper {
  /**
   * 1. HTML Body Context Escaping
   * Encodes &, <, >, ", ', / into safe HTML entities.
   */
  static escapeHtmlBody(str: unknown): string {
    if (str == null) return '';
    return String(str).replace(HTML_BODY_REGEX, (char) => HTML_BODY_ESCAPE_MAP[char] || char);
  }

  /**
   * 2. HTML Attribute Context Escaping
   * Encodes quotes, backticks, equals, and whitespace breakout characters.
   */
  static escapeHtmlAttribute(str: unknown): string {
    if (str == null) return '';
    return String(str).replace(ATTR_REGEX, (char) => ATTR_ESCAPE_MAP[char] || char);
  }

  /**
   * Formats an attribute safely strictly quoted in double quotes.
   * Enforces alphanumeric/dash attribute name to eliminate attribute injection.
   */
  static formatSafeAttribute(name: string, value: unknown): string {
    if (!name || !/^[a-zA-Z0-9_\-]+$/.test(name)) {
      throw new Error(`[Security] Invalid attribute name: "${name}"`);
    }
    const lowerName = name.toLowerCase();
    if (lowerName.startsWith('on')) {
      throw new Error(`[Security] Inline event handler attributes are strictly forbidden: "${name}"`);
    }
    const escapedValue = ContextAwareEscaper.escapeHtmlAttribute(value);
    return `${name}="${escapedValue}"`;
  }

  /**
   * 3. URL / Hyperlink Context Sanitization
   * Validates protocols against a strict allowlist (http:, https:, mailto:).
   * Strictly blocks pseudo-protocols (javascript:, data:, vbscript:).
   * Disallows protocol-relative URLs (//) to avoid unvetted domain redirects.
   */
  static sanitizeUrl(rawUrl: unknown, fallbackUrl: string = 'about:blank'): string {
    if (!rawUrl || typeof rawUrl !== 'string') return fallbackUrl;

    const trimmed = rawUrl.trim();

    // Block protocol-relative URLs (e.g., //evil.com)
    if (trimmed.startsWith('//')) {
      return fallbackUrl;
    }

    // Allow safe relative paths
    if (trimmed.startsWith('/') && !trimmed.startsWith('/\\')) {
      return trimmed;
    }
    if (trimmed.startsWith('#')) {
      return trimmed;
    }

    // Explicit check for dangerous pseudo-protocols in case of normalization bypasses
    const lower = trimmed.toLowerCase();
    if (
      lower.startsWith('javascript:') ||
      lower.startsWith('data:') ||
      lower.startsWith('vbscript:') ||
      lower.startsWith('blob:') ||
      lower.startsWith('file:')
    ) {
      return fallbackUrl;
    }

    try {
      const parsed = new URL(trimmed, typeof window !== 'undefined' ? window.location?.origin : 'https://localhost');
      if (ALLOWED_URL_SCHEMES.has(parsed.protocol.toLowerCase())) {
        return parsed.href;
      }
      return fallbackUrl;
    } catch {
      return fallbackUrl;
    }
  }

  /**
   * 4. JavaScript Object Context Serializer (Safe embedding in script or JSON)
   * Hex-escapes &, <, >, and line terminators (\u003c, \u003e, \u0026, \u2028, \u2029).
   */
  static safeJsonSerialize(data: unknown): string {
    const jsonString = JSON.stringify(data);
    if (!jsonString) return 'null';

    return jsonString
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  }
}
