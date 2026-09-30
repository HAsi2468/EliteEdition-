/**
 * Automated Verification Suite for Unsanitized Input Injections Remediation (Phase 3)
 * Tests RFC 7807 schema validation, mass-assignment defense (.strict()),
 * NoSQL operator injection neutralization, and parameter allowlisting.
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
  getUserParamsSchema,
} = require('../validations/zod/user.schemas');

// Build an isolated, lightweight Express test harness
function createTestApp() {
  const app = express();
  app.use(express.json());

  // SEC-INJ-03 Endpoint: Authentication login
  app.post('/api/auth/login', validateRequest(loginSchema), (req, res) => {
    res.status(200).json({ success: true, user: { email: req.body.email } });
  });

  // User registration
  app.post('/api/auth/register', validateRequest(registerSchema), (req, res) => {
    res.status(201).json({ success: true, user: req.body });
  });

  // SEC-INJ-04 Endpoint: Profile update with strict schema
  app.patch(
    '/api/users/profile',
    validateRequest(updateProfileSchema),
    (req, res) => {
      res.status(200).json({ success: true, updated: req.body });
    }
  );

  // SEC-INJ-05 Endpoint: Query allowlisting & pagination
  app.get('/api/users', validateRequest(getUsersQuerySchema), (req, res) => {
    res.status(200).json({ success: true, query: req.query });
  });

  // Route parameter validation
  app.get(
    '/api/users/:userId',
    validateRequest(getUserParamsSchema),
    (req, res) => {
      res.status(200).json({ success: true, userId: req.params.userId });
    }
  );

  // Global untyped NoSQL sanitizer test endpoint
  app.post('/api/untyped', noSqlSanitizerMiddleware, (req, res) => {
    res.status(200).json({ success: true, data: req.body });
  });

  return app;
}

const app = createTestApp();

describe('Phase 3: Unsanitized Input Injections Remediation', () => {
  // ─── SEC-INJ-03: NoSQL Operator & Type Confusion Neutralization ────────────
  describe('SEC-INJ-03: NoSQL Operator & Type Confusion Neutralization', () => {
    it('should reject login payload with {"$gt": ""} in password with HTTP 400 Bad Request', async () => {
      const payload = {
        email: 'admin@example.com',
        password: { $gt: '' },
      };

      const res = await request(app)
        .post('/api/auth/login')
        .send(payload);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'VALIDATION_ERROR');
      assert.strictEqual(res.body.message, 'Invalid request payload');
      assert.ok(Array.isArray(res.body.details));

      const passwordError = res.body.details.find((d) => d.field === 'body.password');
      assert.ok(passwordError, 'Expected validation error detail for body.password');
      assert.ok(
        passwordError.message.includes('string') || passwordError.code === 'invalid_type',
        `Expected type mismatch message, got: ${passwordError.message}`
      );
    });

    it('should reject login payload with NoSQL operator in email with HTTP 400 Bad Request', async () => {
      const payload = {
        email: { $ne: null },
        password: 'ValidPassword123!',
      };

      const res = await request(app)
        .post('/api/auth/login')
        .send(payload);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'VALIDATION_ERROR');
      const emailError = res.body.details.find((d) => d.field === 'body.email');
      assert.ok(emailError, 'Expected validation error detail for body.email');
    });

    it('should allow legitimate authentication with string primitives', async () => {
      const payload = {
        email: 'admin@example.com',
        password: 'StrongSecretPassword123!',
      };

      const res = await request(app)
        .post('/api/auth/login')
        .send(payload);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.user.email, 'admin@example.com');
    });
  });

  // ─── SEC-INJ-04: Mass Assignment Defense (.strict() Pipeline) ──────────────
  describe('SEC-INJ-04: Mass Assignment Defense (.strict() Pipeline)', () => {
    it('should reject profile update payload containing undeclared "isAdmin": true with HTTP 400 Bad Request', async () => {
      const payload = {
        name: 'John Doe',
        isAdmin: true,
      };

      const res = await request(app)
        .patch('/api/users/profile')
        .send(payload);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'VALIDATION_ERROR');
      assert.strictEqual(res.body.status, 400);

      const adminError = res.body.details.find(
        (d) => d.field.includes('isAdmin') || d.code === 'unrecognized_keys'
      );
      assert.ok(
        adminError,
        `Expected unrecognized key error for isAdmin, details: ${JSON.stringify(res.body.details)}`
      );
    });

    it('should reject privilege elevation payload containing "role": "superadmin" or "balance": 99999', async () => {
      const payload = {
        name: 'Jane Doe',
        role: 'superadmin',
        balance: 99999,
      };

      const res = await request(app)
        .patch('/api/users/profile')
        .send(payload);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'VALIDATION_ERROR');
    });

    it('should successfully accept valid profile update matching declared schema shape', async () => {
      const payload = {
        name: 'Updated Name',
        phone: '+1-555-123-4567',
        bio: 'Senior Software Engineer',
      };

      const res = await request(app)
        .patch('/api/users/profile')
        .send(payload);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.updated.name, 'Updated Name');
    });
  });

  // ─── SEC-INJ-05: Route Parameters & Query Allowlisting ─────────────────────
  describe('SEC-INJ-05: Route Parameters & Query Allowlisting', () => {
    it('should immediately reject SQL/command payload in sortBy query parameter with HTTP 400', async () => {
      const res = await request(app).get(
        '/api/users?sortBy=id;DROP%20TABLE%20users;'
      );

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'VALIDATION_ERROR');

      const sortError = res.body.details.find((d) => d.field === 'query.sortBy');
      assert.ok(sortError, 'Expected validation error detail for query.sortBy');
      assert.ok(
        sortError.message.includes('Invalid sortBy field'),
        `Expected custom invalid sortBy message, got: ${sortError.message}`
      );
      assert.ok(
        sortError.code === 'invalid_value' || sortError.code === 'invalid_enum_value',
        `Expected invalid enum code, got: ${sortError.code}`
      );
    });

    it('should coerce and clamp valid query pagination and sorting parameters', async () => {
      const res = await request(app).get(
        '/api/users?page=3&limit=25&sortBy=name&order=asc'
      );

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.query.page, 3);
      assert.strictEqual(res.body.query.limit, 25);
      assert.strictEqual(res.body.query.sortBy, 'name');
      assert.strictEqual(res.body.query.order, 'asc');
    });

    it('should reject pagination limit exceeding 100 with HTTP 400', async () => {
      const res = await request(app).get('/api/users?limit=500');

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'VALIDATION_ERROR');
      const limitError = res.body.details.find((d) => d.field === 'query.limit');
      assert.ok(limitError, 'Expected validation error for query.limit');
    });

    it('should reject malformed route parameter (non-hex, non-UUID) with HTTP 400', async () => {
      const res = await request(app).get('/api/users/malicious-route-id-12345');

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'VALIDATION_ERROR');
      const paramError = res.body.details.find((d) => d.field === 'params.userId');
      assert.ok(paramError, 'Expected validation error for params.userId');
    });

    it('should accept valid 24-hex MongoDB ObjectId in route parameter', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      const res = await request(app).get(`/api/users/${validObjectId}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.userId, validObjectId);
    });

    it('should accept valid RFC 4122 UUID in route parameter', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const res = await request(app).get(`/api/users/${validUuid}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.userId, validUuid);
    });
  });

  // ─── Deep NoSQL Operator Stripping Unit Tests ──────────────────────────────
  describe('stripNoSqlOperators Utility', () => {
    it('should recursively strip keys starting with "$" or containing "."', () => {
      const dangerousInput = {
        safeField: 'hello',
        $where: 'sleep(5000)',
        'nested.key': 'evil',
        nestedObject: {
          goodKey: 'world',
          $gt: 100,
          $regex: '.*',
        },
        items: [{ safe: 1, $ne: null }],
      };

      const sanitized = stripNoSqlOperators(dangerousInput);

      assert.deepStrictEqual(sanitized, {
        safeField: 'hello',
        nestedObject: {
          goodKey: 'world',
        },
        items: [{ safe: 1 }],
      });
    });

    it('should sanitize untyped endpoints via noSqlSanitizerMiddleware', async () => {
      const res = await request(app)
        .post('/api/untyped')
        .send({
          query: { $gt: '' },
          allowedField: 'safeValue',
        });

      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(res.body.data, {
        query: {},
        allowedField: 'safeValue',
      });
    });
  });
});
