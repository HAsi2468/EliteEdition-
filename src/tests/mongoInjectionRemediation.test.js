/**
 * Automated Verification Suite for Phase 4: MongoDB / Mongoose NoSQL Injection Remediation
 * Tests:
 * 1. SEC-INJ-01: NoSQL Operator & Regex Special Character Injection Neutralization
 * 2. Safe Dynamic Query Builder & Programmatic Field Allowlisting
 * 3. Static & Runtime Assertions (Zero Unsanitized Query Operators)
 * 4. Centralized Sanitized MongoDB Error Handler (Code 11000, CastError, Sensitive Redaction)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');

const {
  safeRegexEscape,
  assertNoUnsanitizedOperators,
  auditMongoRepositoryMethod,
  UnsafeMongoQueryException,
} = require('../db/mongoSafeQuery');
const {
  ALLOWED_SORT_FIELDS,
  ALLOWED_FILTER_FIELDS,
  resolveMongoSort,
  buildSafeMongoQuery,
  InvalidMongoIdentifierException,
} = require('../db/mongoSafeQueryBuilder');
const {
  mongoErrorHandler,
  maskSensitiveParameters,
  isMongoError,
} = require('../middlewares/mongoErrorHandler');

// In-memory mock MongoDB collection simulating literal regex matching & projection
class MockMongoCollection {
  constructor() {
    this.documents = [
      { _id: '507f1f77bcf86cd799439011', name: 'Alpha Fabrics', status: 'COMPLETED', email: 'alpha@fabrics.com' },
      { _id: '507f1f77bcf86cd799439012', name: 'Beta Textiles', status: 'IN_PROGRESS', email: 'beta@textiles.com' },
      { _id: '507f1f77bcf86cd799439013', name: '.* Special Wildcard Company', status: 'DRAFT', email: 'wild@card.com' },
      { _id: '507f1f77bcf86cd799439014', name: "admin' OR '1'='1", status: 'COMPLETED', email: 'injection@sample.com' },
    ];
  }

  find(queryConfig) {
    const { filter = {}, sort = { createdAt: -1 }, skip = 0, limit = 20, projection = {} } = queryConfig;

    let results = [...this.documents];

    // Filter by exact match
    for (const [key, val] of Object.entries(filter)) {
      if (key === '$or' && Array.isArray(val)) {
        results = results.filter((doc) =>
          val.some((orClause) => {
            const [orKey, orPattern] = Object.entries(orClause)[0];
            const docVal = String(doc[orKey] || '');
            return orPattern instanceof RegExp ? orPattern.test(docVal) : docVal === String(orPattern);
          })
        );
      } else {
        results = results.filter((doc) => doc[key] === val);
      }
    }

    // Apply sorting
    const [sortField, sortDir] = Object.entries(sort)[0] || ['createdAt', -1];
    results.sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      return sortDir === 1 ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });

    // Apply pagination
    results = results.slice(skip, skip + limit);

    // Apply projection (exclude 0 fields)
    return results.map((doc) => {
      const projected = { ...doc };
      for (const [pKey, pVal] of Object.entries(projection)) {
        if (pVal === 0) delete projected[pKey];
      }
      return projected;
    });
  }
}

const mockCollection = new MockMongoCollection();

// Build Express test application for MongoDB error handler middleware integration
function createErrorTestApp() {
  const app = express();
  app.use(express.json());

  // Endpoint triggering Mongo duplicate key error (code 11000)
  app.post('/api/test-mongo-error/duplicate', (req, res, next) => {
    const error = new Error('E11000 duplicate key error collection: elite_erp.users index: email_1 dup key: { email: "admin@example.com" }');
    error.name = 'MongoServerError';
    error.code = 11000;
    error.keyPattern = { email: 1 };
    error.keyValue = { email: 'admin@example.com' };
    next(error);
  });

  // Endpoint triggering Mongoose CastError
  app.get('/api/test-mongo-error/cast', (req, res, next) => {
    const error = new Error('Cast to ObjectId failed for value "malicious-id" (type string) at path "_id" for model "User"');
    error.name = 'CastError';
    error.kind = 'ObjectId';
    error.value = 'malicious-id';
    error.path = '_id';
    error.model = 'User';
    next(error);
  });

  // Endpoint triggering Mongoose ValidationError
  app.post('/api/test-mongo-error/validation', (req, res, next) => {
    const error = new Error('User validation failed: email: Path `email` is required.');
    error.name = 'ValidationError';
    error.errors = {
      email: {
        message: 'Path `email` is required.',
        name: 'ValidatorError',
        path: 'email',
        kind: 'required',
      },
    };
    next(error);
  });

  // Endpoint triggering MongoNetworkError (connection/cluster details)
  app.get('/api/test-mongo-error/network', (req, res, next) => {
    const error = new Error('failed to connect to server [cluster0.mongodb.net:27017] on first connect [MongoNetworkError]');
    error.name = 'MongoNetworkError';
    next(error);
  });

  // Register the centralized MongoDB error handler
  app.use(mongoErrorHandler);

  return app;
}

const errorApp = createErrorTestApp();

describe('Phase 4: MongoDB / Mongoose NoSQL Injection Remediation', () => {
  // ─── 1. SEC-INJ-01: NoSQL Operator & Regex Special Character Neutralization 
  describe('SEC-INJ-01: NoSQL Operator & Regex Special Character Neutralization', () => {
    it('SEC-INJ-01 [Vector #1]: Should reject NoSQL operator object {"$gt": ""} in query filter with UnsafeMongoQueryException', () => {
      const maliciousFilter = {
        status: { $gt: '' },
      };

      assert.throws(
        () => assertNoUnsanitizedOperators(maliciousFilter),
        UnsafeMongoQueryException,
        'Expected UnsafeMongoQueryException for $gt operator'
      );
    });

    it('SEC-INJ-01 [Vector #2]: Should reject dangerous arbitrary evaluation operator {"$where": "sleep(5000)"}', () => {
      const maliciousFilter = {
        $where: 'sleep(5000)',
      };

      assert.throws(
        () => assertNoUnsanitizedOperators(maliciousFilter),
        UnsafeMongoQueryException,
        'Expected UnsafeMongoQueryException for $where operator'
      );
    });

    it('SEC-INJ-01 [Vector #3]: Should escape regex wildcards ".*" into literal string match without selecting all records', () => {
      // If unescaped, ".*" would match every document in MongoDB!
      const queryConfig = buildSafeMongoQuery({
        search: '.*',
        searchFields: ['name'],
      });

      // Assert that search was escaped to literal regex /\.\*/i
      const searchClause = queryConfig.filter.$or[0].name;
      assert.ok(searchClause instanceof RegExp);
      assert.strictEqual(searchClause.source, '\\.\\*');

      // Execute search against mock collection
      const results = mockCollection.find(queryConfig);

      // Only the document with literal ".* Special Wildcard Company" should match!
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, '.* Special Wildcard Company');
    });

    it('SEC-INJ-01 [Vector #4]: Should treat SQL/command polyglot "admin\' OR \'1\'=\'1" strictly as literal substring', () => {
      const queryConfig = buildSafeMongoQuery({
        search: "admin' OR '1'='1",
        searchFields: ['name'],
      });

      const results = mockCollection.find(queryConfig);
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, "admin' OR '1'='1");
    });

    it('safeRegexEscape: should escape all regex special characters', () => {
      const specialCharacters = '.*+?^${}()|[]\\-';
      const escaped = safeRegexEscape(specialCharacters);
      assert.strictEqual(escaped, '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\\\-');
    });
  });

  // ─── 2. Safe Dynamic Query Builder & Field Allowlisting ───────────────────
  describe('Safe Dynamic Query Builder & Field Allowlisting', () => {
    it('resolveMongoSort: should map verified client sort fields to Mongoose sort objects', () => {
      assert.deepStrictEqual(resolveMongoSort('createdAt', 'desc'), { createdAt: -1 });
      assert.deepStrictEqual(resolveMongoSort('name', 'asc'), { name: 1 });
      assert.deepStrictEqual(resolveMongoSort('status', 'asc'), { status: 1 });
      assert.deepStrictEqual(resolveMongoSort('id', 'desc'), { _id: -1 });
    });

    it('resolveMongoSort: should immediately reject unlisted/malicious sortBy keys with InvalidMongoIdentifierException', () => {
      const maliciousFields = [
        'password',
        'passwordHash',
        'isAdmin',
        'roles.0',
        '$where',
        '__proto__',
        'nonExistentField',
      ];

      for (const field of maliciousFields) {
        assert.throws(
          () => resolveMongoSort(field),
          InvalidMongoIdentifierException,
          `Expected InvalidMongoIdentifierException for: ${field}`
        );
      }
    });

    it('buildSafeMongoQuery: should enforce filter allowlist and reject undeclared filter fields', () => {
      assert.throws(
        () =>
          buildSafeMongoQuery({
            filter: { isAdmin: true },
          }),
        InvalidMongoIdentifierException
      );
    });

    it('buildSafeMongoQuery: should build query with clamped pagination and safe projection mask', () => {
      const query = buildSafeMongoQuery({
        filter: { status: 'COMPLETED' },
        sortBy: 'name',
        order: 'asc',
        page: 2,
        limit: 15,
      });

      assert.deepStrictEqual(query.filter, { status: 'COMPLETED' });
      assert.deepStrictEqual(query.sort, { name: 1 });
      assert.strictEqual(query.skip, 15);
      assert.strictEqual(query.limit, 15);
      assert.strictEqual(query.projection.password, 0);
      assert.strictEqual(query.projection.__v, 0);
    });
  });

  // ─── 3. Static Code Analysis / Repository Method Audit ────────────────────
  describe('Mongoose Repository Method Static Code Audit', () => {
    it('auditMongoRepositoryMethod: should detect direct HTTP request objects passed into Mongoose find()', () => {
      function vulnerableMethod(req) {
        return Model.find(req.query);
      }

      const audit = auditMongoRepositoryMethod(vulnerableMethod);
      assert.strictEqual(audit.safe, false);
      assert.ok(audit.violations.length > 0);
      assert.ok(audit.violations[0].includes('raw HTTP request container'));
    });

    it('auditMongoRepositoryMethod: should approve sanitized query building methods', () => {
      function safeMethod(req) {
        const queryConfig = buildSafeMongoQuery({
          filter: { status: 'ACTIVE' },
          search: req.query.search,
        });
        return Model.find(queryConfig.filter);
      }

      const audit = auditMongoRepositoryMethod(safeMethod);
      assert.strictEqual(audit.safe, true);
      assert.strictEqual(audit.violations.length, 0);
    });
  });

  // ─── 4. Centralized Sanitized MongoDB Error Handler ───────────────────────
  describe('Centralized Sanitized MongoDB & Mongoose Error Handler', () => {
    it('should intercept MongoServerError code 11000 duplicate key and return safe HTTP 409 Conflict', async () => {
      const res = await request(errorApp).post('/api/test-mongo-error/duplicate');

      assert.strictEqual(res.status, 409);
      assert.strictEqual(res.body.error, 'RESOURCE_CONFLICT');
      assert.strictEqual(res.body.message, 'A resource with the specified identifier already exists');
      assert.strictEqual(res.body.type, 'https://tools.ietf.org/html/rfc7807');

      // Assert NO collection name, index name, or database name leaked in client response
      const bodyString = JSON.stringify(res.body);
      assert.ok(!bodyString.includes('elite_erp'));
      assert.ok(!bodyString.includes('email_1'));
      assert.ok(!bodyString.includes('11000'));
    });

    it('should intercept Mongoose CastError and return safe HTTP 400 Bad Request', async () => {
      const res = await request(errorApp).get('/api/test-mongo-error/cast');

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'INVALID_DATA_FORMAT');
      assert.strictEqual(res.body.message, 'Invalid identifier or data format');

      const bodyString = JSON.stringify(res.body);
      assert.ok(!bodyString.includes('ObjectId'));
      assert.ok(!bodyString.includes('User'));
    });

    it('should intercept Mongoose ValidationError and return structured HTTP 400 details', async () => {
      const res = await request(errorApp).post('/api/test-mongo-error/validation');

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'VALIDATION_ERROR');
      assert.strictEqual(res.body.message, 'Invalid request payload');
      assert.ok(Array.isArray(res.body.details));
      assert.strictEqual(res.body.details[0].field, 'body.email');
    });

    it('should intercept MongoNetworkError and return safe HTTP 500 without leaking cluster hostnames', async () => {
      const res = await request(errorApp).get('/api/test-mongo-error/network');

      assert.strictEqual(res.status, 500);
      assert.strictEqual(res.body.error, 'DATABASE_ERROR');
      assert.strictEqual(res.body.message, 'An internal error occurred');

      const bodyString = JSON.stringify(res.body);
      assert.ok(!bodyString.includes('cluster0.mongodb.net'));
      assert.ok(!bodyString.includes('27017'));
    });

    it('maskSensitiveParameters: should mask passwords, JWTs, hashes, and secrets in audit logs', () => {
      const sample = {
        email: 'user@example.com',
        password: 'PlainPassword123!',
        sessionPayload: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig',
        hash: '$2b$10$wK1B6.yG5Nl4K6f4b6q2euK7T3j4n9f2b8l0a6c4e2g8i0k2m4o6q',
        normalData: 'Order Notes',
      };

      const masked = maskSensitiveParameters(sample);
      assert.strictEqual(masked.email, 'user@example.com');
      assert.strictEqual(masked.password, '[REDACTED]');
      assert.strictEqual(masked.sessionPayload, '[REDACTED_JWT_TOKEN]');
      assert.strictEqual(masked.hash, '[REDACTED_HASH]');
      assert.strictEqual(masked.normalData, 'Order Notes');
    });

    it('isMongoError: should accurately identify MongoDB and Mongoose errors', () => {
      const mongoErr = new Error('E11000 duplicate');
      mongoErr.name = 'MongoServerError';
      mongoErr.code = 11000;
      assert.strictEqual(isMongoError(mongoErr), true);

      const standardErr = new Error('General JS TypeError');
      assert.strictEqual(isMongoError(standardErr), false);
    });
  });
});
