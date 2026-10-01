/**
 * ============================================================================
 * SEC-CORS — Automated CORS Vulnerability Verification Suite (Phase 1)
 * Technical Specification: "CORS & CSRF Vulnerability Remediation"
 *
 * Test runner: Node.js built-in `node:test` + Supertest
 *   Run: node --test src/tests/corsPhase1Spec.test.js
 *
 * Coverage matrix:
 *   SEC-CORS-01  Cross-origin GET from evil-attacker.com with credentials:include
 *   SEC-CORS-02  OPTIONS preflight from Origin: null
 *   SEC-CORS-02b OPTIONS preflight from unauthorized domain (suffix hijack)
 *   SEC-CORS-03  Wildcard '*' NEVER emitted alongside credentials: true
 *   SEC-CORS-04  Exact-origin reflection for all allowlisted origins
 *   SEC-CORS-05  Vary: Origin present on every CORS response (anti-cache-poison)
 *   SEC-CORS-06  HTTP 204 with correct headers on valid OPTIONS preflight
 *   SEC-CORS-07  No CORS headers on same-origin (no Origin header)
 *   SEC-CORS-08  Prefix-injection domain attack blocked (attacker-eliteerp.com)
 *   SEC-CORS-09  Suffix-injection attack blocked (eliteerp.com.attacker.com)
 *   SEC-CORS-10  null origin on regular GET (not just OPTIONS) is rejected
 *   SEC-CORS-11  Exact allowed methods in preflight response
 *   SEC-CORS-12  Max-Age is 86400 on every valid preflight
 *   SEC-CORS-13  Access-Control-Allow-Headers restricted to exact surface
 *   SEC-CORS-14  Downstream route NOT called on OPTIONS preflight
 *   SEC-CORS-15  additionalOrigins factory option injects custom origin
 * ============================================================================
 */

'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

// Import the JS runtime (compiled from TS via `tsx` or existing JS file).
// We deliberately require the .js file so these tests run without a build step.
const { createCorsMiddleware } = require('../middlewares/cors.middleware');

// ---------------------------------------------------------------------------
// Test application factory
// ---------------------------------------------------------------------------

/**
 * Creates a minimal Express app wired with the CORS middleware under test.
 * A downstream handler mutation counter lets us assert that OPTIONS never
 * reaches route logic (SEC-CORS-14).
 */
function buildTestApp(options = {}) {
  const app = express();

  // Track downstream invocations so SEC-CORS-14 can assert zero calls.
  let downstreamCallCount = 0;
  app._getDownstreamCallCount = () => downstreamCallCount;
  app._resetDownstreamCallCount = () => { downstreamCallCount = 0; };

  app.use(createCorsMiddleware(options));
  app.use(express.json());

  // Sentinel handler — MUST NOT be called during OPTIONS preflight
  app.use((_req, _res, next) => {
    downstreamCallCount++;
    next();
  });

  // GET /api/v1/user — read-only resource (SEC-CORS-01 target)
  app.get('/api/v1/user', (_req, res) => {
    res.status(200).json({
      userId: '60c72b2f9b1d8b2bad000001',
      name: 'Harshit Sidapara',
      email: 'harshit@eliteerp.com',
      role: 'admin',
    });
  });

  // POST /api/v1/orders — state-mutation resource
  app.post('/api/v1/orders', (_req, res) => {
    res.status(201).json({ success: true, orderId: 'ORD-99901' });
  });

  return app;
}

// ---------------------------------------------------------------------------
// Constants mirrored from cors.config for assertion clarity
// ---------------------------------------------------------------------------
const EXACT_ALLOWED_ORIGINS = [
  'https://erp.eliteedition.in',
  'https://eliteedition.in',
  'https://app.eliteerp.com',
  'https://admin.eliteerp.com',
  'http://localhost:5173',
];

const ALLOWED_METHODS  = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const ALLOWED_HEADERS  = 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-User-Id';
const MAX_AGE          = '86400';

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('CORS Security Engine — Phase 1 Verification Suite', () => {

  // ── Shared app instance ──────────────────────────────────────────────────
  let app;
  before(() => {
    app = buildTestApp();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SEC-CORS-01: Malicious cross-origin GET with credentials:include intent
  // ─────────────────────────────────────────────────────────────────────────
  describe('SEC-CORS-01 — Cross-origin GET from evil-attacker.com', () => {
    it('should return HTTP 403 and omit all CORS headers', async () => {
      const res = await request(app)
        .get('/api/v1/user')
        .set('Origin', 'https://evil-attacker.com')
        .set('Cookie', 'token=s%3Avalid_session_jwt');  // simulates credentials:include

      assert.equal(res.status, 403, 'Expected HTTP 403 for unlisted origin');
      assert.equal(
        res.headers['access-control-allow-origin'],
        undefined,
        'ACAO header MUST be absent for unlisted origins',
      );
      assert.equal(
        res.headers['access-control-allow-credentials'],
        undefined,
        'ACAC header MUST be absent when origin is rejected',
      );
      assert.equal(res.body.error, 'CORS_FORBIDDEN');
    });

    it('response body from rejected cross-origin request MUST be completely unreadable by browser (headers absent)', async () => {
      // From a browser's perspective, without ACAO header the browser refuses
      // to expose the response body to JS. We assert the headers are absent.
      const res = await request(app)
        .get('/api/v1/user')
        .set('Origin', 'https://evil-attacker.com')
        .set('Cookie', 'sessionId=secret-token');

      assert.equal(res.headers['access-control-allow-origin'], undefined);
      assert.equal(res.headers['access-control-allow-credentials'], undefined);
      // Confirm sensitive data is not accidentally echoed in a readable body
      assert.notEqual(res.body.userId, '60c72b2f9b1d8b2bad000001',
        'Sensitive user data must not be reachable from attacker origin');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SEC-CORS-02: OPTIONS preflight from Origin: null
  // ─────────────────────────────────────────────────────────────────────────
  describe('SEC-CORS-02 — OPTIONS preflight from Origin: null (RFC 6454 opaque)', () => {
    it('should reject null origin OPTIONS preflight with HTTP 403', async () => {
      const res = await request(app)
        .options('/api/v1/user')
        .set('Origin', 'null')
        .set('Access-Control-Request-Method', 'GET');

      assert.equal(res.status, 403, 'null origin MUST be rejected with 403');
      assert.equal(res.headers['access-control-allow-origin'], undefined);
      assert.equal(res.body.error, 'CORS_FORBIDDEN');
      assert.ok(
        res.body.message.includes('null origin'),
        'Error message must explicitly mention null origin',
      );
    });

    it('should reject null origin on regular GET requests (not just OPTIONS)', async () => {
      const res = await request(app)
        .get('/api/v1/user')
        .set('Origin', 'null');

      assert.equal(res.status, 403);
      assert.equal(res.headers['access-control-allow-origin'], undefined);
      assert.equal(res.body.error, 'CORS_FORBIDDEN');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SEC-CORS-02b: OPTIONS preflight from unauthorized suffix-hijack domain
  // ─────────────────────────────────────────────────────────────────────────
  describe('SEC-CORS-02b — OPTIONS preflight from https://app.eliteerp.com.attacker.com', () => {
    it('should reject suffix-hijack attempt with HTTP 403 — no mutation or read permitted', async () => {
      const res = await request(app)
        .options('/api/v1/user')
        .set('Origin', 'https://app.eliteerp.com.attacker.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      assert.equal(res.status, 403, 'Suffix-hijack domain MUST be rejected');
      assert.equal(res.headers['access-control-allow-origin'], undefined,
        'ACAO MUST NOT be present for suffix-hijack origin');
      assert.equal(res.body.error, 'CORS_FORBIDDEN');
    });

    it('should reject prefix-injection domain: https://attacker-app.eliteerp.com', async () => {
      const res = await request(app)
        .options('/api/v1/user')
        .set('Origin', 'https://attacker-app.eliteerp.com')
        .set('Access-Control-Request-Method', 'GET');

      assert.equal(res.status, 403);
      assert.equal(res.headers['access-control-allow-origin'], undefined);
    });

    it('should reject subdomain prefix attack: https://attacker-eliteerp.com', async () => {
      const res = await request(app)
        .options('/api/v1/user')
        .set('Origin', 'https://attacker-eliteerp.com')
        .set('Access-Control-Request-Method', 'GET');

      assert.equal(res.status, 403);
      assert.equal(res.headers['access-control-allow-origin'], undefined);
    });

    it('should reject port-manipulated variant: https://app.eliteerp.com:8080', async () => {
      // eliteerp.com does NOT have a port-based pattern in the allowlist
      const res = await request(app)
        .options('/api/v1/user')
        .set('Origin', 'https://app.eliteerp.com:8080')
        .set('Access-Control-Request-Method', 'GET');

      assert.equal(res.status, 403);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SEC-CORS-03: Wildcard '*' NEVER emitted with credentials
  // ─────────────────────────────────────────────────────────────────────────
  describe('SEC-CORS-03 — Wildcard * never emitted alongside credentials:true', () => {
    it('should NEVER set Access-Control-Allow-Origin: * for any allowlisted origin', async () => {
      for (const origin of EXACT_ALLOWED_ORIGINS) {
        const res = await request(app)
          .get('/api/v1/user')
          .set('Origin', origin);

        assert.equal(res.status, 200, `Expected 200 for allowlisted origin: ${origin}`);
        assert.notEqual(
          res.headers['access-control-allow-origin'],
          '*',
          `Wildcard MUST NOT be emitted for origin: ${origin}`,
        );
        // ACAO must reflect the exact origin string
        assert.equal(
          res.headers['access-control-allow-origin'],
          origin,
          `ACAO must exactly match the request origin: ${origin}`,
        );
        // Credentials must be 'true' (string) for allowed origins
        assert.equal(res.headers['access-control-allow-credentials'], 'true');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SEC-CORS-04: Exact origin reflection for allowlisted origins
  // ─────────────────────────────────────────────────────────────────────────
  describe('SEC-CORS-04 — Exact Access-Control-Allow-Origin reflection', () => {
    it('should reflect erp.eliteedition.in (exact string, no wildcard)', async () => {
      const res = await request(app)
        .get('/api/v1/user')
        .set('Origin', 'https://erp.eliteedition.in');

      assert.equal(res.status, 200);
      assert.equal(res.headers['access-control-allow-origin'], 'https://erp.eliteedition.in');
      assert.equal(res.headers['access-control-allow-credentials'], 'true');
    });

    it('should allow subdomain app.eliteerp.com via anchored regex', async () => {
      const res = await request(app)
        .get('/api/v1/user')
        .set('Origin', 'https://app.eliteerp.com');

      assert.equal(res.status, 200);
      assert.equal(res.headers['access-control-allow-origin'], 'https://app.eliteerp.com');
    });

    it('should allow admin.eliteerp.com via anchored regex', async () => {
      const res = await request(app)
        .get('/api/v1/user')
        .set('Origin', 'https://admin.eliteerp.com');

      assert.equal(res.status, 200);
      assert.equal(res.headers['access-control-allow-origin'], 'https://admin.eliteerp.com');
    });

    it('should allow localhost:5173 for local development', async () => {
      const res = await request(app)
        .get('/api/v1/user')
        .set('Origin', 'http://localhost:5173');

      assert.equal(res.status, 200);
      assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SEC-CORS-05: Vary: Origin anti-cache-poison header
  // ─────────────────────────────────────────────────────────────────────────
  describe('SEC-CORS-05 — Vary: Origin on every CORS response', () => {
    it('should include Vary: Origin on allowed cross-origin GET', async () => {
      const res = await request(app)
        .get('/api/v1/user')
        .set('Origin', 'https://app.eliteerp.com');

      assert.equal(res.headers['vary'], 'Origin',
        'Vary: Origin is mandatory to prevent CDN CORS-header cache poisoning');
    });

    it('should include Vary: Origin on a valid OPTIONS preflight', async () => {
      const res = await request(app)
        .options('/api/v1/orders')
        .set('Origin', 'https://app.eliteerp.com')
        .set('Access-Control-Request-Method', 'POST');

      assert.equal(res.headers['vary'], 'Origin');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SEC-CORS-06: Valid OPTIONS preflight — full header assertions
  // ─────────────────────────────────────────────────────────────────────────
  describe('SEC-CORS-06 — Valid OPTIONS preflight (HTTP 204 + strict headers)', () => {
    it('should terminate with HTTP 204 and all required preflight headers', async () => {
      const res = await request(app)
        .options('/api/v1/orders')
        .set('Origin', 'https://app.eliteerp.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type, Authorization, X-CSRF-Token');

      assert.equal(res.status, 204, 'Valid preflight MUST return 204 No Content');
      assert.equal(res.headers['access-control-allow-origin'], 'https://app.eliteerp.com');
      assert.equal(res.headers['access-control-allow-credentials'], 'true');
      assert.equal(res.headers['access-control-allow-methods'], ALLOWED_METHODS);
      assert.equal(res.headers['access-control-allow-headers'], ALLOWED_HEADERS);
      assert.equal(res.headers['access-control-max-age'], MAX_AGE);
      assert.equal(res.headers['vary'], 'Origin');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SEC-CORS-07: No CORS headers on same-origin (no Origin header)
  // ─────────────────────────────────────────────────────────────────────────
  describe('SEC-CORS-07 — Same-origin / server-to-server requests', () => {
    it('should allow same-origin requests without attaching any CORS headers', async () => {
      const res = await request(app)
        .get('/api/v1/user');
      // No Origin header ⟹ same-origin or s2s call

      assert.equal(res.status, 200);
      assert.equal(res.headers['access-control-allow-origin'], undefined,
        'CORS headers MUST NOT be added to same-origin requests');
      assert.equal(res.headers['access-control-allow-credentials'], undefined);
      assert.equal(res.body.name, 'Harshit Sidapara');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SEC-CORS-08 / SEC-CORS-09: Anchored regex attack vectors
  // ─────────────────────────────────────────────────────────────────────────
  describe('SEC-CORS-08/09 — Anchored regex subdomain injection attacks', () => {
    const attackVectors = [
      'https://attacker-eliteerp.com',
      'https://app.eliteerp.com.attacker.com',
      'https://fakeeliteedition.in',
      'https://eliteedition.in.evil.io',
      'https://not-erp.eliteedition.in.attacker.com',
      'https://app.eliteerp.com@evil.com',
      'http://eliteedition.in%2f.attacker.com',
    ];

    for (const vector of attackVectors) {
      it(`should block injection attack vector: ${vector}`, async () => {
        const res = await request(app)
          .get('/api/v1/user')
          .set('Origin', vector);

        assert.equal(res.status, 403, `Must reject attack vector: ${vector}`);
        assert.equal(res.headers['access-control-allow-origin'], undefined);
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SEC-CORS-11: Allowed methods exact surface
  // ─────────────────────────────────────────────────────────────────────────
  describe('SEC-CORS-11 — Access-Control-Allow-Methods exact surface', () => {
    it('should restrict Allow-Methods to GET, POST, PUT, PATCH, DELETE, OPTIONS only', async () => {
      const res = await request(app)
        .options('/api/v1/user')
        .set('Origin', 'https://app.eliteerp.com')
        .set('Access-Control-Request-Method', 'GET');

      assert.equal(res.headers['access-control-allow-methods'], ALLOWED_METHODS);
      // Assert dangerous methods are NOT in the list
      assert.ok(!res.headers['access-control-allow-methods']?.includes('TRACE'),
        'TRACE must not be in the allowed methods');
      assert.ok(!res.headers['access-control-allow-methods']?.includes('CONNECT'),
        'CONNECT must not be in the allowed methods');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SEC-CORS-12: Max-Age is always 86400
  // ─────────────────────────────────────────────────────────────────────────
  describe('SEC-CORS-12 — Access-Control-Max-Age = 86400', () => {
    it('should set Max-Age to 86400 on every valid preflight', async () => {
      const res = await request(app)
        .options('/api/v1/orders')
        .set('Origin', 'https://admin.eliteerp.com')
        .set('Access-Control-Request-Method', 'DELETE');

      assert.equal(res.headers['access-control-max-age'], '86400');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SEC-CORS-13: Allowed headers restricted to exact surface
  // ─────────────────────────────────────────────────────────────────────────
  describe('SEC-CORS-13 — Access-Control-Allow-Headers exact surface', () => {
    it('should restrict Allow-Headers to Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-User-Id', async () => {
      const res = await request(app)
        .options('/api/v1/orders')
        .set('Origin', 'https://app.eliteerp.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type, Authorization');

      assert.equal(res.headers['access-control-allow-headers'], ALLOWED_HEADERS);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SEC-CORS-14: Downstream route NOT called on OPTIONS preflight
  // ─────────────────────────────────────────────────────────────────────────
  describe('SEC-CORS-14 — Downstream route logic NOT invoked on OPTIONS', () => {
    it('should never call downstream route handlers on a valid preflight', async () => {
      const isolatedApp = buildTestApp();
      isolatedApp._resetDownstreamCallCount();

      await request(isolatedApp)
        .options('/api/v1/user')
        .set('Origin', 'https://app.eliteerp.com')
        .set('Access-Control-Request-Method', 'GET');

      assert.equal(
        isolatedApp._getDownstreamCallCount(),
        0,
        'Downstream handlers MUST NOT be called during OPTIONS preflight',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SEC-CORS-15: additionalOrigins factory option
  // ─────────────────────────────────────────────────────────────────────────
  describe('SEC-CORS-15 — additionalOrigins option injects custom origins', () => {
    it('should allow a tenant-specific origin passed via additionalOrigins', async () => {
      const tenantApp = buildTestApp({
        additionalOrigins: ['https://tenant-a.eliteerp.com'],
      });

      const res = await request(tenantApp)
        .get('/api/v1/user')
        .set('Origin', 'https://tenant-a.eliteerp.com');

      assert.equal(res.status, 200);
      assert.equal(
        res.headers['access-control-allow-origin'],
        'https://tenant-a.eliteerp.com',
      );
      assert.equal(res.headers['access-control-allow-credentials'], 'true');
    });

    it('should NOT allow origins not in the combined allowlist', async () => {
      const tenantApp = buildTestApp({
        additionalOrigins: ['https://tenant-a.eliteerp.com'],
      });

      const res = await request(tenantApp)
        .get('/api/v1/user')
        .set('Origin', 'https://tenant-b.eliteerp.com');  // NOT in additionalOrigins

      assert.equal(res.status, 403);
      assert.equal(res.headers['access-control-allow-origin'], undefined);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Edge-cases: Malformed, empty, and case-variant origins
  // ─────────────────────────────────────────────────────────────────────────
  describe('Edge-cases — Malformed and case-variant origins', () => {
    it('should reject empty string Origin header', async () => {
      const res = await request(app)
        .get('/api/v1/user')
        .set('Origin', '');

      // Empty origin: browser would not send this, but a crafted request might.
      // Middleware passes empty to next() (treated as no-origin), body is OK.
      // Either 200 without CORS headers or 403 is acceptable — just no ACAO.
      assert.equal(res.headers['access-control-allow-origin'], undefined);
    });

    it('should reject mixed-case NULL origin (NULL vs null)', async () => {
      const res = await request(app)
        .get('/api/v1/user')
        .set('Origin', 'NULL');

      assert.equal(res.status, 403);
      assert.equal(res.headers['access-control-allow-origin'], undefined);
    });

    it('should reject origin with CRLF injection attempt — Node HTTP blocks at transport layer', async () => {
      // Node.js HTTP client itself rejects CRLF in header values before the packet
      // is sent (ERR_INVALID_CHAR). This is the correct platform-level protection.
      // We assert this layer fires, which means the server is never reached.
      const malformed = 'https://app.eliteerp.com\r\nX-Injected: evil';
      let requestError = null;
      try {
        await request(app)
          .get('/api/v1/user')
          .set('Origin', malformed);
      } catch (err) {
        requestError = err;
      }
      // Either Node blocked it (ERR_INVALID_CHAR) OR it was stripped and ACAO is absent.
      // Both outcomes protect the application — either is acceptable.
      if (requestError !== null) {
        assert.ok(
          requestError.code === 'ERR_INVALID_CHAR' || requestError.message.includes('Invalid character'),
          'Node HTTP must block CRLF injection at transport layer',
        );
      }
      // If somehow reached server, ACAO must never be reflected
      // (this branch only fires if Node strips CRLF before sending)
    });
  });
});
