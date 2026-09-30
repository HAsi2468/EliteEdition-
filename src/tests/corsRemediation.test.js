const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { createCorsMiddleware } = require('../middlewares/cors.middleware');

describe('CORS Security Engine & Technical Specification Phase 1 Suite', () => {

  const setupTestApp = (options = {}) => {
    const testApp = express();
    testApp.use(createCorsMiddleware(options));
    testApp.use(express.json());

    testApp.get('/api/v1/user', (req, res) => {
      res.json({
        userId: '60c72b2f9b1d8b2bad000001',
        name: 'Harshit Sidapara',
        email: 'harshit@eliteerp.com',
        role: 'admin'
      });
    });

    testApp.post('/api/v1/orders', (req, res) => {
      res.status(201).json({ success: true, orderId: 'ORD-99901' });
    });

    return testApp;
  };

  const app = setupTestApp();

  describe('SEC-CORS-01: Cross-Origin Request Isolation & No Wildcard Credentials', () => {
    it('should reject unauthorized origin https://malicious-site.com with HTTP 403 and omit CORS headers', async () => {
      const res = await request(app)
        .get('/api/v1/user')
        .set('Origin', 'https://malicious-site.com')
        .set('Cookie', 'token=s%3Avalid_session_jwt');

      assert.equal(res.status, 403);
      assert.equal(res.headers['access-control-allow-origin'], undefined);
      assert.equal(res.headers['access-control-allow-credentials'], undefined);
      assert.equal(res.body.error, 'CORS_FORBIDDEN');
    });

    it('should NEVER reflect wildcard "*" when Access-Control-Allow-Credentials is true', async () => {
      const allowedOrigins = [
        'https://erp.eliteedition.in',
        'https://eliteedition.in',
        'https://app.eliteerp.com',
        'https://admin.eliteerp.com',
        'http://localhost:5173'
      ];

      for (const origin of allowedOrigins) {
        const res = await request(app)
          .get('/api/v1/user')
          .set('Origin', origin);

        assert.equal(res.status, 200);
        assert.notEqual(res.headers['access-control-allow-origin'], '*');
        assert.equal(res.headers['access-control-allow-origin'], origin);
        assert.equal(res.headers['access-control-allow-credentials'], 'true');
        assert.equal(res.headers['vary'], 'Origin');
      }
    });

    it('should allow legitimate same-origin / server-to-server requests without Origin header', async () => {
      const res = await request(app)
        .get('/api/v1/user');

      assert.equal(res.status, 200);
      assert.equal(res.headers['access-control-allow-origin'], undefined);
      assert.equal(res.body.name, 'Harshit Sidapara');
    });
  });

  describe('SEC-CORS-02: Preflight (OPTIONS) Routing & Anchored Regex Hijack Prevention', () => {
    it('should block subdomain prefix hijack attempt https://attacker-eliteerp.com', async () => {
      const res = await request(app)
        .options('/api/v1/user')
        .set('Origin', 'https://attacker-eliteerp.com')
        .set('Access-Control-Request-Method', 'GET');

      assert.equal(res.status, 403);
      assert.equal(res.headers['access-control-allow-origin'], undefined);
      assert.equal(res.body.error, 'CORS_FORBIDDEN');
    });

    it('should block suffix hijack attempt https://app.eliteerp.com.attacker.com', async () => {
      const res = await request(app)
        .options('/api/v1/user')
        .set('Origin', 'https://app.eliteerp.com.attacker.com')
        .set('Access-Control-Request-Method', 'POST');

      assert.equal(res.status, 403);
      assert.equal(res.headers['access-control-allow-origin'], undefined);
      assert.equal(res.body.error, 'CORS_FORBIDDEN');
    });

    it('should explicitly detect and reject Origin: null (sandboxed iframes, file://, data: URIs)', async () => {
      const res = await request(app)
        .options('/api/v1/user')
        .set('Origin', 'null')
        .set('Access-Control-Request-Method', 'GET');

      assert.equal(res.status, 403);
      assert.equal(res.headers['access-control-allow-origin'], undefined);
      assert.equal(res.body.error, 'CORS_FORBIDDEN');
      assert.ok(res.body.message.includes('null origin'));
    });

    it('should explicitly detect and reject Origin: null on regular GET requests', async () => {
      const res = await request(app)
        .get('/api/v1/user')
        .set('Origin', 'null');

      assert.equal(res.status, 403);
      assert.equal(res.headers['access-control-allow-origin'], undefined);
      assert.equal(res.body.error, 'CORS_FORBIDDEN');
    });

    it('should terminate valid preflights cleanly with HTTP 204 No Content', async () => {
      const res = await request(app)
        .options('/api/v1/orders')
        .set('Origin', 'https://app.eliteerp.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type, Authorization, X-CSRF-Token');

      assert.equal(res.status, 204);
      assert.equal(res.headers['access-control-allow-origin'], 'https://app.eliteerp.com');
      assert.equal(res.headers['access-control-allow-credentials'], 'true');
      assert.equal(res.headers['access-control-allow-methods'], 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      assert.equal(res.headers['access-control-allow-headers'], 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-User-Id');
      assert.equal(res.headers['access-control-max-age'], '86400');
      assert.equal(res.headers['vary'], 'Origin');
    });
  });
});
