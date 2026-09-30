/**
 * ============================================================================
 * ELITE EDITION ENTERPRISE - CONTEXT-AWARE OUTPUT ESCAPING ENGINE
 * Prevents XSS breakouts across HTML Body, Attribute, URL, and Script Contexts
 * ============================================================================
 */

const HTML_BODY_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

const HTML_BODY_REGEX = /[&<>"'/]/g;

const ATTR_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

const ATTR_REGEX = /[&<>"'`=]/g;

const ALLOWED_URL_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export class ContextAwareEscaper {
  /**
   * 1. HTML Body Context Escaping
   */
  static escapeHtmlBody(str) {
    if (str == null) return '';
    return String(str).replace(HTML_BODY_REGEX, (char) => HTML_BODY_ESCAPE_MAP[char]);
  }

  /**
   * 2. HTML Attribute Context Escaping
   */
  static escapeHtmlAttribute(str) {
    if (str == null) return '';
    return String(str).replace(ATTR_REGEX, (char) => ATTR_ESCAPE_MAP[char]);
  }

  /**
   * 3. URL / Hyperlink Context Sanitization
   */
  static sanitizeUrl(rawUrl, fallbackUrl = 'about:blank') {
    if (!rawUrl || typeof rawUrl !== 'string') return fallbackUrl;

    const trimmed = rawUrl.trim();
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      return trimmed;
    }
    if (trimmed.startsWith('#')) {
      return trimmed;
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
   */
  static safeJsonSerialize(data) {
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
