const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const cookieParser = require('cookie-parser');
const { createCorsMiddleware } = require('../middlewares/cors.middleware');
const { createCsrfMiddleware } = require('../middlewares/csrf.middleware');
const { safeRestGuard } = require('../middlewares/safeRestGuard');
const { csrfManager, CsrfManager } = require('../utils/csrfManager');

describe('Enterprise CORS & Anti-CSRF Vulnerability Remediation Suite (Phase 3 & 4)', () => {
  const setupSecurityApp = () => {
    const app = express();

    app.use(createCorsMiddleware());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(safeRestGuard);

    // CSRF Handshake endpoint
    app.get('/api/v1/auth/csrf-token', csrfManager.handshakeHandler);
    app.post('/api/v1/auth/csrf-token', csrfManager.handshakeHandler);

    // Anti-CSRF verification middleware protecting state-changing requests
    app.use(createCsrfMiddleware({ manager: csrfManager }));

    // Test API Endpoints
    app.get('/api/v1/user', (req, res) => {
      res.status(200).json({
        userId: '60c72b2f9b1d8b2bad000001',
        name: 'Harshit Sidapara',
        email: 'harshit@eliteerp.com',
        role: 'admin',
      });
    });

    app.post('/api/v1/orders', (req, res) => {
      res.status(201).json({
        success: true,
        orderId: 'ORD-SEC-9901',
        status: 'placed',
      });
    });

    app.post('/api/v1/jobcards/status', (req, res) => {
      res.status(200).json({
        success: true,
        jobCardId: req.body?.jobCardId || 'JC-1001',
        status: req.body?.status || 'In Progress',
      });
    });

    app.put('/api/v1/orders/:id', (req, res) => {
      res.status(200).json({
        success: true,
        orderId: req.params.id,
        updated: true,
      });
    });

    app.delete('/api/v1/orders/:id', (req, res) => {
      res.status(200).json({
        success: true,
        orderId: req.params.id,
        deleted: true,
      });
    });

    return app;
  };

  const app = setupSecurityApp();

  // ───────────────────────────────────────────────────────────────────────────
  // SEC-CORS-01: Malicious Origin Read Test
  // ───────────────────────────────────────────────────────────────────────────
  describe('SEC-CORS-01 (Malicious Origin Read Test)', () => {
    it('should reject unauthorized origin https://evil-hacker.com and omit CORS headers', async () => {
      const res = await request(app)
        .get('/api/v1/user')
        .set('Origin', 'https://evil-hacker.com')
        .set('Cookie', 'token=s%3Avalid_session_jwt; XSRF-TOKEN=sample');

      assert.equal(res.status, 403);
      assert.equal(res.headers['access-control-allow-origin'], undefined);
      assert.equal(res.headers['access-control-allow-credentials'], undefined);
      assert.equal(res.body.error, 'CORS_FORBIDDEN');
    });

    it('should NEVER echo wildcard "*" when credentials are included', async () => {
      const res = await request(app)
        .get('/api/v1/user')
        .set('Origin', 'https://erp.eliteedition.in')
        .set('Cookie', 'token=s%3Avalid_session_jwt');

      assert.equal(res.status, 200);
      assert.notEqual(res.headers['access-control-allow-origin'], '*');
      assert.equal(res.headers['access-control-allow-origin'], 'https://erp.eliteedition.in');
      assert.equal(res.headers['access-control-allow-credentials'], 'true');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SEC-CORS-02: Preflight Verification
  // ───────────────────────────────────────────────────────────────────────────
  describe('SEC-CORS-02 (Preflight Verification)', () => {
    it('should reject preflight OPTIONS from unauthorized subdomain https://dev-evil.eliteerp.com', async () => {
      const res = await request(app)
        .options('/api/v1/orders')
        .set('Origin', 'https://dev-evil.eliteerp.com')
        .set('Access-Control-Request-Method', 'POST');

      assert.equal(res.status, 403);
      assert.equal(res.headers['access-control-allow-origin'], undefined);
      assert.equal(res.body.error, 'CORS_FORBIDDEN');
    });

    it('should reject preflight OPTIONS with Origin: null', async () => {
      const res = await request(app)
        .options('/api/v1/orders')
        .set('Origin', 'null')
        .set('Access-Control-Request-Method', 'POST');

      assert.equal(res.status, 403);
      assert.equal(res.headers['access-control-allow-origin'], undefined);
      assert.equal(res.body.error, 'CORS_FORBIDDEN');
    });

    it('should cleanly accept preflight OPTIONS from authorized origin with 204 No Content', async () => {
      const res = await request(app)
        .options('/api/v1/orders')
        .set('Origin', 'https://erp.eliteedition.in')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type, X-CSRF-Token');

      assert.equal(res.status, 204);
      assert.equal(res.headers['access-control-allow-origin'], 'https://erp.eliteedition.in');
      assert.equal(res.headers['access-control-allow-credentials'], 'true');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SEC-CSRF-01: Cross-Site Forged POST Attack
  // ───────────────────────────────────────────────────────────────────────────
  describe('SEC-CSRF-01 (Cross-Site Forged POST Attack)', () => {
    it('should block forged HTML form submission missing X-CSRF-Token header with HTTP 403 CSRF_TOKEN_MISSING', async () => {
      // Simulate ambient cookie sent by browser during cross-site post (forms cannot set X-CSRF-Token)
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Origin', 'https://erp.eliteedition.in')
        .set('Cookie', 'token=valid_session_cookie')
        .send({ item: 'Luxury Silk Shirt', quantity: 100 });

      assert.equal(res.status, 403);
      assert.equal(res.body.error, 'CSRF_TOKEN_MISSING');
      assert.equal(res.body.message, 'CSRF token is required for state mutation.');
    });

    it('should block forged submission from external unauthorized third-party origin with HTTP 403', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Origin', 'https://evil-hacker.com')
        .set('Cookie', 'token=valid_session_cookie')
        .send({ item: 'Luxury Silk Shirt', quantity: 100 });

      assert.equal(res.status, 403);
      assert.ok(['CORS_FORBIDDEN', 'CSRF_TOKEN_MISSING'].includes(res.body.error));
    });


    it('should block mutating request with cookie token but missing header token', async () => {
      const token = csrfManager.generateToken();

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Cookie', `XSRF-TOKEN=${token}`)
        .send({ item: 'Silk Roll', quantity: 5 });

      assert.equal(res.status, 403);
      assert.equal(res.body.error, 'CSRF_TOKEN_MISSING');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SEC-CSRF-02: Tampered Token Test
  // ───────────────────────────────────────────────────────────────────────────
  describe('SEC-CSRF-02 (Tampered Token Test)', () => {
    it('should reject mutating request POST /api/v1/jobcards/status with missing token', async () => {
      const res = await request(app)
        .post('/api/v1/jobcards/status')
        .send({ jobCardId: 'JC-501', status: 'Completed' });

      assert.equal(res.status, 403);
      assert.equal(res.body.error, 'CSRF_TOKEN_MISSING');
    });

    it('should reject mutating request with forged/tampered signature with HTTP 403 CSRF_TOKEN_INVALID', async () => {
      const validToken = csrfManager.generateToken();
      const parts = validToken.split('.');
      // Tamper signature part
      const forgedToken = `${parts[0]}.${parts[1]}.badbeefbadbeefbadbeefbadbeefbadbeefbadbeefbadbeefbadbeefbadbeefbadb`;

      const res = await request(app)
        .post('/api/v1/jobcards/status')
        .set('Cookie', `XSRF-TOKEN=${forgedToken}`)
        .set('X-CSRF-Token', forgedToken)
        .send({ jobCardId: 'JC-501', status: 'Completed' });

      assert.equal(res.status, 403);
      assert.equal(res.body.error, 'CSRF_TOKEN_INVALID');
    });

    it('should reject mutating request with partially truncated token with HTTP 403 CSRF_TOKEN_INVALID', async () => {
      const truncatedToken = 'abc123truncated';

      const res = await request(app)
        .post('/api/v1/jobcards/status')
        .set('Cookie', `XSRF-TOKEN=${truncatedToken}`)
        .set('X-CSRF-Token', truncatedToken)
        .send({ jobCardId: 'JC-501', status: 'Completed' });

      assert.equal(res.status, 403);
      assert.equal(res.body.error, 'CSRF_TOKEN_INVALID');
    });

    it('should reject mutating request when header token does NOT match cookie token', async () => {
      const tokenA = csrfManager.generateToken();
      const tokenB = csrfManager.generateToken();

      const res = await request(app)
        .post('/api/v1/jobcards/status')
        .set('Cookie', `XSRF-TOKEN=${tokenA}`)
        .set('X-CSRF-Token', tokenB)
        .send({ jobCardId: 'JC-501', status: 'Completed' });

      assert.equal(res.status, 403);
      assert.equal(res.body.error, 'CSRF_TOKEN_INVALID');
    });

    it('should reject mutating request with expired token with HTTP 403 CSRF_TOKEN_EXPIRED', async () => {
      // Create manager with 1 millisecond TTL
      const shortLivedManager = new CsrfManager(undefined, 1);
      const expiredToken = shortLivedManager.generateToken();

      // Wait 10ms to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      const expiredApp = express();
      expiredApp.use(express.json());
      expiredApp.use(cookieParser());
      expiredApp.use(createCsrfMiddleware({ manager: shortLivedManager }));
      expiredApp.post('/api/v1/orders', (req, res) => res.json({ success: true }));

      const res = await request(expiredApp)
        .post('/api/v1/orders')
        .set('Cookie', `XSRF-TOKEN=${expiredToken}`)
        .set('X-CSRF-Token', expiredToken)
        .send({ orderId: 'ORD-EXPIRED' });

      assert.equal(res.status, 403);
      assert.equal(res.body.error, 'CSRF_TOKEN_EXPIRED');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SEC-CSRF-03: Legitimate SPA Mutation
  // ───────────────────────────────────────────────────────────────────────────
  describe('SEC-CSRF-03 (Legitimate SPA Mutation)', () => {
    it('should hydrate client via GET /api/v1/auth/csrf-token and return token + cookie', async () => {
      const handshakeRes = await request(app)
        .get('/api/v1/auth/csrf-token')
        .set('Origin', 'https://erp.eliteedition.in');

      assert.equal(handshakeRes.status, 200);
      assert.ok(handshakeRes.body.csrfToken);

      const setCookieHeader = handshakeRes.headers['set-cookie'];
      assert.ok(setCookieHeader);
      const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : setCookieHeader;
      assert.ok(cookieStr.includes('XSRF-TOKEN='));
      assert.ok(cookieStr.toLowerCase().includes('samesite=lax'));
    });

    it('should successfully mutate state on POST /api/v1/jobcards/status with matching X-CSRF-Token header and cookie', async () => {
      const handshakeRes = await request(app)
        .get('/api/v1/auth/csrf-token')
        .set('Origin', 'https://erp.eliteedition.in');

      const token = handshakeRes.body.csrfToken;
      const cookies = handshakeRes.headers['set-cookie'];

      const mutateRes = await request(app)
        .post('/api/v1/jobcards/status')
        .set('Origin', 'https://erp.eliteedition.in')
        .set('Cookie', cookies)
        .set('X-CSRF-Token', token)
        .send({ jobCardId: 'JC-1001', status: 'In Progress' });

      assert.equal(mutateRes.status, 200);
      assert.equal(mutateRes.body.success, true);
      assert.equal(mutateRes.body.jobCardId, 'JC-1001');
      assert.equal(mutateRes.body.status, 'In Progress');
    });

    it('should successfully execute PUT and DELETE with valid anti-CSRF token', async () => {
      const token = csrfManager.generateToken();

      const putRes = await request(app)
        .put('/api/v1/orders/ORD-777')
        .set('Origin', 'https://erp.eliteedition.in')
        .set('Cookie', `XSRF-TOKEN=${token}`)
        .set('x-xsrf-token', token) // Supports x-xsrf-token alias
        .send({ status: 'Updated' });

      assert.equal(putRes.status, 200);
      assert.equal(putRes.body.updated, true);

      const delRes = await request(app)
        .delete('/api/v1/orders/ORD-777')
        .set('Origin', 'https://erp.eliteedition.in')
        .set('Cookie', `XSRF-TOKEN=${token}`)
        .set('X-CSRF-Token', token);

      assert.equal(delRes.status, 200);
      assert.equal(delRes.body.deleted, true);
    });

    it('should allow idempotent GET requests to bypass CSRF validation without token', async () => {
      const res = await request(app)
        .get('/api/v1/user')
        .set('Origin', 'https://erp.eliteedition.in');

      assert.equal(res.status, 200);
      assert.equal(res.body.email, 'harshit@eliteerp.com');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SEC-REST-01: Safe REST Semantics Guard
  // ───────────────────────────────────────────────────────────────────────────
  describe('SEC-REST-01 (Safe REST Semantics Guard)', () => {
    it('should reject GET requests attempting query-driven deletion (?action=delete) with HTTP 405', async () => {
      const res = await request(app)
        .get('/api/v1/orders?action=delete&id=123');

      assert.equal(res.status, 405);
      assert.equal(res.body.error, 'MUTATION_IN_GET_FORBIDDEN');
    });

    it('should reject GET requests with boolean mutation flags (?delete=true) with HTTP 405', async () => {
      const res = await request(app)
        .get('/api/v1/orders?id=123&delete=true');

      assert.equal(res.status, 405);
      assert.equal(res.body.error, 'MUTATION_IN_GET_FORBIDDEN');
    });

    it('should reject GET requests targeting action-driven mutating paths (/delete?id=123) with HTTP 405', async () => {
      const res = await request(app)
        .get('/delete?id=123');

      assert.equal(res.status, 405);
      assert.equal(res.body.error, 'MUTATION_IN_GET_FORBIDDEN');
    });

    it('should reject HTTP method tunneling (_method=DELETE) via GET with HTTP 405', async () => {
      const res = await request(app)
        .get('/api/v1/orders/123?_method=DELETE');

      assert.equal(res.status, 405);
      assert.equal(res.body.error, 'MUTATION_IN_GET_FORBIDDEN');
    });

    it('should allow safe legitimate GET requests with normal query parameters', async () => {
      const res = await request(app)
        .get('/api/v1/user?page=1&limit=20&search=harshit');

      assert.equal(res.status, 200);
      assert.equal(res.body.name, 'Harshit Sidapara');
    });
  });
});
