// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { SecurityValidationEngine, VALIDATION_PATTERNS } from '../security/validationEngine';
import { ContextAwareEscaper } from '../security/escapingEngine';
import createDOMPurify from 'dompurify';

const DOMPurify = typeof window !== 'undefined' ? createDOMPurify(window) : createDOMPurify();

describe('Elite Edition - Input Sanitization & XSS Remediation Engine', () => {
  // --------------------------------------------------------------------------
  // 1. SecurityValidationEngine Tests
  // --------------------------------------------------------------------------
  describe('SecurityValidationEngine', () => {
    it('sanitizes numeric input and strips injection characters', () => {
      const dirty = "123.45' OR '1'='1<script>alert(1)</script>";
      const clean = SecurityValidationEngine.sanitizeNumeric(dirty, { allowDecimal: true, decimalPlaces: 2 });
      expect(clean).toBe('123.45');
    });

    it('enforces single decimal point and precision', () => {
      const multiDecimal = '12.34.56.78';
      const clean = SecurityValidationEngine.sanitizeNumeric(multiDecimal, { allowDecimal: true, decimalPlaces: 2 });
      expect(clean).toBe('12.34');
    });

    it('sanitizes alphanumeric input and strips SQL tokens and angle brackets', () => {
      const malicious = "admin'; DROP TABLE users; -- <script>";
      const clean = SecurityValidationEngine.sanitizeAlphanumeric(malicious, true);
      expect(clean).toBe('admin DROP TABLE users -- script');
      expect(clean).not.toContain("'");
      expect(clean).not.toContain(";");
      expect(clean).not.toContain("<");
      expect(clean).not.toContain(">");
    });

    it('formats phone numbers into safe standardized masks', () => {
      const dirtyPhone = '+1 (415) 555-0199 <script>';
      const formatted = SecurityValidationEngine.formatUSPhone(dirtyPhone);
      expect(formatted).toBe('+1 (415) 555-0199');
    });

    it('validates calendar date boundaries and rejects impossible dates (e.g. Feb 30th)', () => {
      expect(SecurityValidationEngine.isValidCalendarDate('2026-02-28')).toBe(true);
      expect(SecurityValidationEngine.isValidCalendarDate('2026-02-30')).toBe(false);
      expect(SecurityValidationEngine.isValidCalendarDate('2026-04-31')).toBe(false);
      expect(SecurityValidationEngine.isValidCalendarDate('invalid-date')).toBe(false);
    });

    it('validates safe usernames against regex allowlist', () => {
      expect(SecurityValidationEngine.validateUsername('john_doe-99').isValid).toBe(true);
      expect(SecurityValidationEngine.validateUsername('admin<script>').isValid).toBe(false);
      expect(SecurityValidationEngine.validateUsername("user' OR 1=1").isValid).toBe(false);
    });

    it('validates safe search queries and catches illegal symbols', () => {
      expect(SecurityValidationEngine.validateSafeSearch('Cotton Fabric #485').isValid).toBe(true);
      expect(SecurityValidationEngine.validateSafeSearch('<img src=x onerror=alert(1)>').isValid).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. ContextAwareEscaper Tests
  // --------------------------------------------------------------------------
  describe('ContextAwareEscaper', () => {
    it('escapes HTML body entities', () => {
      const raw = '<div class="alert">"Test" & \'Demo\' / 123</div>';
      const escaped = ContextAwareEscaper.escapeHtmlBody(raw);
      expect(escaped).toBe('&lt;div class=&quot;alert&quot;&gt;&quot;Test&quot; &amp; &#x27;Demo&#x27; &#x2F; 123&lt;&#x2F;div&gt;');
    });

    it('escapes HTML attribute values preventing quote and backtick breakouts', () => {
      const raw = 'test" onfocus="alert(1)" `';
      const escaped = ContextAwareEscaper.escapeHtmlAttribute(raw);
      expect(escaped).toBe('test&quot; onfocus&#x3D;&quot;alert(1)&quot; &#x60;');
      expect(escaped).not.toContain('"');
      expect(escaped).not.toContain('`');
    });

    it('blocks dangerous pseudo-protocols like javascript: and data:', () => {
      expect(ContextAwareEscaper.sanitizeUrl('javascript:alert(1)')).toBe('about:blank');
      expect(ContextAwareEscaper.sanitizeUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe('about:blank');
      expect(ContextAwareEscaper.sanitizeUrl('vbscript:msgbox(1)')).toBe('about:blank');
      expect(ContextAwareEscaper.sanitizeUrl('https://erp.eliteedition.in/orders')).toBe('https://erp.eliteedition.in/orders');
      expect(ContextAwareEscaper.sanitizeUrl('/app/dashboard')).toBe('/app/dashboard');
    });

    it('safely serializes JSON into script contexts without tag breakout', () => {
      const payload = { tag: '</script><script>alert("hacked")</script>' };
      const serialized = ContextAwareEscaper.safeJsonSerialize(payload);
      expect(serialized).not.toContain('</script>');
      expect(serialized).toContain('\\u003c/script\\u003e');
    });
  });

  // --------------------------------------------------------------------------
  // 3. DOMPurify Rich Text Sanitization Tests
  // --------------------------------------------------------------------------
  describe('DOMPurify Rich Text Sanitization', () => {
    it('SEC-INJ-02: Neutralizes <script> and malicious event handlers completely', () => {
      const dirty = '<p>Normal text</p><script>alert("XSS")</script><img src=x onerror=alert(1)>';
      const clean = DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: ['p', 'b', 'i', 'strong', 'a'],
        ALLOWED_ATTR: ['href', 'title']
      });

      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('alert');
      expect(clean).not.toContain('onerror');
      expect(clean).toContain('<p>Normal text</p>');
    });

    it('neutralizes obfuscated javascript: URLs in anchor tags', () => {
      const dirty = '<a href="javascript:alert(document.cookie)">Click me</a>';
      const clean = DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: ['a'],
        ALLOWED_ATTR: ['href']
      });
      expect(clean).not.toContain('javascript:');
    });
  });
});
