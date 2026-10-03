// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { ContextAwareEscaper } from '../security/escapingEngine';
import {
  buildCspDirectives,
  formatCspHeader,
  generateCspHeader,
  getNextSecurityHeaders,
  generateNginxCspConfig,
} from '../security/cspConfig';

describe('Phase 1: Context-Aware Escaping Utilities & CSP Headers', () => {
  // --------------------------------------------------------------------------
  // 1. Context-Aware Escaper Tests
  // --------------------------------------------------------------------------
  describe('ContextAwareEscaper', () => {
    it('HTML Body Context: encodes &, <, >, ", \', / into safe HTML entities', () => {
      const raw = '<h1>"Hello" & \'Welcome\' / Goodbye</h1>';
      const escaped = ContextAwareEscaper.escapeHtmlBody(raw);

      expect(escaped).toBe(
        '&lt;h1&gt;&quot;Hello&quot; &amp; &#x27;Welcome&#x27; &#x2F; Goodbye&lt;&#x2F;h1&gt;'
      );
      expect(escaped).not.toContain('<');
      expect(escaped).not.toContain('>');
      expect(escaped).not.toContain('"');
      expect(escaped).not.toContain("'");
      expect(escaped).not.toContain('/');
    });

    it('HTML Attribute Context: encodes quotes, backticks, equals, and whitespace breakout chars', () => {
      const breakoutPayload = 'test" onfocus="alert(1)" `\t\n\r=';
      const escaped = ContextAwareEscaper.escapeHtmlAttribute(breakoutPayload);

      expect(escaped).not.toContain('"');
      expect(escaped).not.toContain('`');
      expect(escaped).not.toContain('\t');
      expect(escaped).not.toContain('\n');
      expect(escaped).not.toContain('\r');
      expect(escaped).toContain('&quot;');
      expect(escaped).toContain('&#x60;');
      expect(escaped).toContain('&#x3D;');
      expect(escaped).toContain('&#x9;');
      expect(escaped).toContain('&#xA;');
    });

    it('formatSafeAttribute strictly validates attribute name and safely formats quoted attribute', () => {
      const formatted = ContextAwareEscaper.formatSafeAttribute('data-title', '5 < 10 "quote"');
      expect(formatted).toBe('data-title="5 &lt; 10 &quot;quote&quot;"');

      // Rejects inline event handler names
      expect(() => ContextAwareEscaper.formatSafeAttribute('onclick', 'alert(1)')).toThrow();
      expect(() => ContextAwareEscaper.formatSafeAttribute('onload', 'alert(1)')).toThrow();

      // Rejects invalid attribute names with injection characters
      expect(() => ContextAwareEscaper.formatSafeAttribute('foo"bar', 'baz')).toThrow();
    });

    it('URL / Hyperlink Context: validates protocols against strict allowlist (http:, https:, mailto:)', () => {
      // Allowed protocols
      expect(ContextAwareEscaper.sanitizeUrl('https://erp.eliteedition.in/orders')).toBe(
        'https://erp.eliteedition.in/orders'
      );
      expect(ContextAwareEscaper.sanitizeUrl('http://erp.eliteedition.in/orders')).toBe(
        'http://erp.eliteedition.in/orders'
      );
      expect(ContextAwareEscaper.sanitizeUrl('mailto:support@eliteedition.in')).toBe(
        'mailto:support@eliteedition.in'
      );

      // Relative paths
      expect(ContextAwareEscaper.sanitizeUrl('/api/v1/jobcards')).toBe('/api/v1/jobcards');
      expect(ContextAwareEscaper.sanitizeUrl('#section-overview')).toBe('#section-overview');

      // Strictly blocks pseudo-protocols
      expect(ContextAwareEscaper.sanitizeUrl('javascript:alert(1)')).toBe('about:blank');
      expect(ContextAwareEscaper.sanitizeUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe('about:blank');
      expect(ContextAwareEscaper.sanitizeUrl('vbscript:msgbox(1)')).toBe('about:blank');
      expect(ContextAwareEscaper.sanitizeUrl('blob:https://erp.eliteedition.in/uuid')).toBe('about:blank');
      expect(ContextAwareEscaper.sanitizeUrl('file:///etc/passwd')).toBe('about:blank');

      // Strictly blocks protocol-relative URLs
      expect(ContextAwareEscaper.sanitizeUrl('//evil-phishing.com')).toBe('about:blank');
    });

    it('Safe JSON / Script Context: hex-escapes &, <, >, and line terminators', () => {
      const payload = {
        markup: '</script><script>alert("PWNED")</script>',
        entity: 'A & B',
        terminator: 'Line1\u2028Line2\u2029End',
      };

      const serialized = ContextAwareEscaper.safeJsonSerialize(payload);

      expect(serialized).not.toContain('</script>');
      expect(serialized).toContain('\\u003c/script\\u003e');
      expect(serialized).toContain('\\u003cscript\\u003e');
      expect(serialized).toContain('\\u0026');
      expect(serialized).toContain('\\u2028');
      expect(serialized).toContain('\\u2029');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Content Security Policy (CSP) Headers Tests
  // --------------------------------------------------------------------------
  describe('Content Security Policy (CSP) Headers', () => {
    it('generates strict CSP directives matching specifications', () => {
      const directives = buildCspDirectives({
        nonce: 'k38fnx92m0',
        r2AccountId: 'cf_account_123',
        r2Subdomain: 'sub123',
        customDomain: 'erp.eliteedition.in',
      });

      // default-src 'self'
      expect(directives['default-src']).toEqual(["'self'"]);

      // script-src 'self' 'nonce-k38fnx92m0'
      expect(directives['script-src']).toContain("'self'");
      expect(directives['script-src']).toContain("'nonce-k38fnx92m0'");
      expect(directives['script-src']).not.toContain("'unsafe-inline'");
      expect(directives['script-src']).not.toContain("'unsafe-eval'");

      // connect-src 'self' https://<ACCOUNT_ID>.r2.cloudflarestorage.com
      expect(directives['connect-src']).toContain("'self'");
      expect(directives['connect-src']).toContain('https://cf_account_123.r2.cloudflarestorage.com');

      // img-src 'self' data: https://pub-<R2_SUBDOMAIN>.r2.dev https://<CUSTOM_DOMAIN>
      expect(directives['img-src']).toContain("'self'");
      expect(directives['img-src']).toContain('data:');
      expect(directives['img-src']).toContain('https://pub-sub123.r2.dev');
      expect(directives['img-src']).toContain('https://erp.eliteedition.in');

      // object-src 'none'; base-uri 'self'; frame-ancestors 'none'
      expect(directives['object-src']).toEqual(["'none'"]);
      expect(directives['base-uri']).toEqual(["'self'"]);
      expect(directives['frame-ancestors']).toEqual(["'none'"]);
    });

    it('formats CSP header string accurately', () => {
      const header = generateCspHeader({
        nonce: 'testNonce',
        r2AccountId: 'testAccount',
        r2Subdomain: 'testSub',
        customDomain: 'erp.eliteedition.in',
      });

      expect(header).toContain("default-src 'self';");
      expect(header).toContain("script-src 'self' 'nonce-testNonce';");
      expect(header).toContain("connect-src 'self' https://testAccount.r2.cloudflarestorage.com");
      expect(header).toContain("img-src 'self' data: https://pub-testSub.r2.dev https://erp.eliteedition.in;");
      expect(header).toContain("object-src 'none';");
      expect(header).toContain("base-uri 'self';");
      expect(header).toContain("frame-ancestors 'none';");
    });

    it('generates standard Next.js security headers array', () => {
      const headers = getNextSecurityHeaders({ nonce: 'nextNonce' });
      const cspObj = headers.find((h) => h.key === 'Content-Security-Policy');
      const frameObj = headers.find((h) => h.key === 'X-Frame-Options');

      expect(cspObj).toBeDefined();
      expect(cspObj?.value).toContain("script-src 'self' 'nonce-nextNonce';");
      expect(frameObj?.value).toBe('DENY');
    });

    it('generates production-ready Nginx configuration block', () => {
      const nginxConfig = generateNginxCspConfig({
        r2AccountId: 'r2_prod_1',
        r2Subdomain: 'r2_pub_prod',
        customDomain: 'erp.eliteedition.in',
      });

      expect(nginxConfig).toContain('add_header Content-Security-Policy');
      expect(nginxConfig).toContain('add_header X-Content-Type-Options "nosniff" always;');
      expect(nginxConfig).toContain('add_header X-Frame-Options "DENY" always;');
      expect(nginxConfig).toContain('add_header Strict-Transport-Security');
    });
  });
});
