/**
 * Automated Verification Suite for Unsanitized Input Injections Remediation (Phase 2)
 * Tests RFC 7807 schema validation, mass-assignment defense (.strict()),
 * NoSQL operator injection neutralization, custom objectIdSchema, and query allowlisting.
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
const {
  getOrdersQuerySchema,
  createOrderSchema,
  getOrderParamsSchema,
} = require('../validations/zod/order.schemas');
const {
  objectIdSchema,
  uuidSchema,
  positiveIntIdSchema,
  uuidParamSchema,
  positiveIntParamSchema,
} = require('../validations/zod/common.schemas');

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

  // Dedicated UUID route param endpoint
  app.get('/api/documents/:docId', validateRequest(uuidParamSchema('docId')), (req, res) => {
    res.status(200).json({ success: true, docId: req.params.docId });
  });

  // Dedicated positive integer route param endpoint
  app.get('/api/items/:itemId', validateRequest(positiveIntParamSchema('itemId')), (req, res) => {
    res.status(200).json({ success: true, itemId: req.params.itemId });
  });

  // SEC-INJ-04 Endpoint: Profile update with strict schema
  app.patch(
    '/api/users/profile',
    validateRequest(updateProfileSchema),
    (req, res) => {
      res.status(200).json({ success: true, updated: req.body });
    }
  );

  // SEC-INJ-05 Endpoint: Query allowlisting & pagination for Users
  app.get('/api/users', validateRequest(getUsersQuerySchema), (req, res) => {
    res.status(200).json({ success: true, query: req.query });
  });

  // SEC-INJ-05 Endpoint: Orders listing with strict sortBy enum
  app.get('/api/orders', validateRequest(getOrdersQuerySchema), (req, res) => {
    res.status(200).json({ success: true, query: req.query });
  });

  // Order creation endpoint
  app.post('/api/orders', validateRequest(createOrderSchema), (req, res) => {
    res.status(201).json({ success: true, order: req.body });
  });

  // Order parameter validation
  app.get('/api/orders/:orderId', validateRequest(getOrderParamsSchema), (req, res) => {
    res.status(200).json({ success: true, orderId: req.params.orderId });
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

describe('Phase 2 & 3: Unsanitized Input Injections Remediation', () => {
  // ─── SEC-INJ-03: NoSQL Operator & Type Confusion Neutralization ────────────
  describe('SEC-INJ-03: NoSQL Operator & Type Confusion Neutralization', () => {
    it('SEC-INJ-03: Submit {"email": "admin@example.com", "password": {"$gt": ""}} -> Assert HTTP 400 Bad Request rejection', async () => {
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
      assert.strictEqual(res.body.status, 400);
      assert.ok(Array.isArray(res.body.details));

      const passwordError = res.body.details.find((d) => d.field === 'body.password');
      assert.ok(passwordError, 'Expected validation error detail for body.password');
      assert.ok(
        passwordError.message.includes('string') || passwordError.code === 'invalid_type',
        `Expected type mismatch message, got: ${passwordError.message}`
      );
    });

    it('should reject login payload with NoSQL operator in email {"$ne": null} with HTTP 400 Bad Request', async () => {
      const payload = {
        email: { $ne: null },
        password: 'ValidPassword123!',
      };

      const res = await request(app)
        .post('/api/auth/login')
        .send(payload);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'VALIDATION_ERROR');
      assert.strictEqual(res.body.message, 'Invalid request payload');
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
    it('SEC-INJ-04: Submit profile update with undeclared "isAdmin": true -> Assert HTTP 400 rejection', async () => {
      const payload = {
        bio: 'Clean bio',
        isAdmin: true,
      };

      const res = await request(app)
        .patch('/api/users/profile')
        .send(payload);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'VALIDATION_ERROR');
      assert.strictEqual(res.body.message, 'Invalid request payload');
      assert.strictEqual(res.body.status, 400);

      const adminError = res.body.details.find(
        (d) => d.field.includes('isAdmin') || d.code === 'unrecognized_keys' || d.code === 'custom'
      );
      assert.ok(
        adminError,
        `Expected unrecognized key / privilege error for isAdmin, details: ${JSON.stringify(res.body.details)}`
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
      assert.strictEqual(res.body.message, 'Invalid request payload');
    });

    it('should reject privilege elevation payload containing "isVerified": true or "permissions": ["*"]', async () => {
      const payload = {
        name: 'Jane Doe',
        isVerified: true,
        permissions: ['*'],
      };

      const res = await request(app)
        .patch('/api/users/profile')
        .send(payload);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'VALIDATION_ERROR');
      assert.strictEqual(res.body.message, 'Invalid request payload');
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
      assert.strictEqual(res.body.updated.bio, 'Senior Software Engineer');
    });
  });

  // ─── SEC-INJ-05: Route Parameters & Query Allowlisting ─────────────────────
  describe('SEC-INJ-05: Route Parameters & Query Allowlisting', () => {
    it('SEC-INJ-05: Submit SQL/command payload in sortBy query parameter (e.g. ?sortBy=id;DROP TABLE users;) -> Assert immediate HTTP 400 Bad Request from enum validation', async () => {
      const res = await request(app).get(
        '/api/users?sortBy=id;DROP%20TABLE%20users;'
      );

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'VALIDATION_ERROR');
      assert.strictEqual(res.body.message, 'Invalid request payload');

      const sortError = res.body.details.find((d) => d.field === 'query.sortBy');
      assert.ok(sortError, 'Expected validation error detail for query.sortBy');
    });

    it('GET /orders?sortBy=name;db.users.drop() -> Immediate HTTP 400 Bad Request from enum validation', async () => {
      const res = await request(app).get(
        '/api/orders?sortBy=name;db.users.drop()'
      );

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'VALIDATION_ERROR');
      assert.strictEqual(res.body.message, 'Invalid request payload');

      const sortError = res.body.details.find((d) => d.field === 'query.sortBy');
      assert.ok(sortError, 'Expected validation error detail for query.sortBy');
      assert.ok(
        sortError.message.includes('Invalid sortBy field'),
        `Expected custom invalid sortBy message, got: ${sortError.message}`
      );
    });

    it('should coerce and clamp valid query pagination and sorting parameters (default limit: 20)', async () => {
      const res = await request(app).get('/api/orders');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.query.page, 1);
      assert.strictEqual(res.body.query.limit, 20);
      assert.strictEqual(res.body.query.sortBy, 'createdAt');
      assert.strictEqual(res.body.query.order, 'desc');
    });

    it('should coerce query string values into typed numbers and accept valid pagination', async () => {
      const res = await request(app).get(
        '/api/orders?page=3&limit=25&sortBy=name&order=asc'
      );

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.query.page, 3);
      assert.strictEqual(res.body.query.limit, 25);
      assert.strictEqual(res.body.query.sortBy, 'name');
      assert.strictEqual(res.body.query.order, 'asc');
    });

    it('should reject pagination limit exceeding 100 with HTTP 400', async () => {
      const res = await request(app).get('/api/orders?limit=500');

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'VALIDATION_ERROR');
      assert.strictEqual(res.body.message, 'Invalid request payload');
      const limitError = res.body.details.find((d) => d.field === 'query.limit');
      assert.ok(limitError, 'Expected validation error for query.limit');
    });

    it('should reject malformed route parameter (non-hex, non-UUID) with HTTP 400', async () => {
      const res = await request(app).get('/api/users/malicious-route-id-12345');

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'VALIDATION_ERROR');
      assert.strictEqual(res.body.message, 'Invalid request payload');
      const paramError = res.body.details.find((d) => d.field === 'params.userId');
      assert.ok(paramError, 'Expected validation error for params.userId');
    });

    it('should validate UUID route parameter via uuidParamSchema helper', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const validRes = await request(app).get(`/api/documents/${validUuid}`);
      assert.strictEqual(validRes.status, 200);
      assert.strictEqual(validRes.body.docId, validUuid);

      const invalidRes = await request(app).get('/api/documents/invalid-uuid-format');
      assert.strictEqual(invalidRes.status, 400);
      assert.strictEqual(invalidRes.body.error, 'VALIDATION_ERROR');
      assert.strictEqual(invalidRes.body.message, 'Invalid request payload');
    });

    it('should validate and coerce positive integer route parameter via positiveIntParamSchema', async () => {
      const validRes = await request(app).get('/api/items/42');
      assert.strictEqual(validRes.status, 200);
      assert.strictEqual(validRes.body.itemId, 42); // Coerced to number

      const invalidRes = await request(app).get('/api/items/-10');
      assert.strictEqual(invalidRes.status, 400);
      assert.strictEqual(invalidRes.body.error, 'VALIDATION_ERROR');

      const nonIntRes = await request(app).get('/api/items/abc');
      assert.strictEqual(nonIntRes.status, 400);
    });

    it('should reject invalid MongoDB ObjectId in order route parameter using custom objectIdSchema', async () => {
      const res = await request(app).get('/api/orders/invalid-mongo-id');

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'VALIDATION_ERROR');
      assert.strictEqual(res.body.message, 'Invalid request payload');
      const paramError = res.body.details.find((d) => d.field === 'params.orderId');
      assert.ok(paramError, 'Expected validation error for params.orderId');
      assert.ok(paramError.message.includes('Invalid MongoDB ObjectId'));
    });

    it('should accept valid 24-hex MongoDB ObjectId in route parameter', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      const res = await request(app).get(`/api/orders/${validObjectId}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.orderId, validObjectId);
    });

    it('should validate standalone objectIdSchema helper directly', () => {
      const validId = '507f1f77bcf86cd799439011';
      const parsed = objectIdSchema.safeParse(validId);
      assert.strictEqual(parsed.success, true);

      const invalidId = 'not-a-valid-24-hex-id';
      const invalidParsed = objectIdSchema.safeParse(invalidId);
      assert.strictEqual(invalidParsed.success, false);
      assert.strictEqual(invalidParsed.error.issues[0].message, 'Invalid MongoDB ObjectId');
    });
  });

  // ─── Deep NoSQL Operator Stripping Unit Tests ──────────────────────────────
  describe('stripNoSqlOperators Utility & Gateway Sanitization', () => {
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
