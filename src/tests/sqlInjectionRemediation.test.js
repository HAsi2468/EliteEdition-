/**
 * Automated Verification Suite for Phase 4: SQL Injection Remediation & Parameterized Query Layer
 * Tests:
 * 1. SEC-INJ-01: Parameterized search queries treating SQLi polyglots strictly as literals
 * 2. Safe Dynamic Query Builder & Identifier Allowlisting
 * 3. Static & Runtime Assertions (Zero String Concatenation)
 * 4. Centralized Sanitized Database Error Handler
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');

const {
  safeQuery,
  assertNoRawInterpolation,
  auditRepositoryMethod,
  UnsafeQueryException,
} = require('../db/parameterizedQuery');
const {
  SORT_COLUMNS,
  ALLOWED_TABLES,
  safeQuoteIdentifier,
  resolveSortColumn,
  buildSafeSelectQuery,
  InvalidIdentifierException,
} = require('../db/safeQueryBuilder');
const {
  databaseErrorHandler,
  maskSensitiveParameters,
  isPostgresError,
} = require('../middlewares/databaseErrorHandler');

// In-memory mock database driver simulating out-of-band wire protocol parameterization
class MockDatabaseDriver {
  constructor() {
    this.tables = {
      orders: [
        { id: 'ord-001', customer_name: 'Alpha Fabrics', status: 'COMPLETED', total_amount: 1500.0 },
        { id: 'ord-002', customer_name: 'Beta Textiles', status: 'IN_PROGRESS', total_amount: 3200.0 },
        { id: 'ord-003', customer_name: 'Gamma Garments', status: 'DRAFT', total_amount: 450.0 },
      ],
      users: [
        { id: 'usr-001', username: 'admin', password_hash: '$2b$10$e846/fakehashadmin' },
      ],
    };
  }

  /**
   * Executes a parameterized query by binding parameter placeholders ($1, $2, ...)
   * out-of-band, treating values strictly as data literals (never executable syntax).
   */
  async execute(queryConfig) {
    const { text, values = [] } = queryConfig;

    // Verify query uses parameterized placeholders
    assertNoRawInterpolation(text);

    // If query contains a search pattern like ILIKE $N
    const matchSearch = text.match(/ILIKE\s+\$(\d+)/i);
    if (matchSearch) {
      const paramIndex = parseInt(matchSearch[1], 10) - 1;
      const rawSearchParam = values[paramIndex];
      // Strip leading and trailing % wildcard added by query builder
      const literalSearch = String(rawSearchParam).replace(/^%|%$/g, '');

      // Perform exact literal matching on customer_name without syntax execution
      const filtered = this.tables.orders.filter((row) =>
        row.customer_name.toLowerCase().includes(literalSearch.toLowerCase())
      );

      return {
        rows: filtered,
        rowCount: filtered.length,
        command: 'SELECT',
      };
    }

    return {
      rows: this.tables.orders,
      rowCount: this.tables.orders.length,
      command: 'SELECT',
    };
  }
}

const mockDb = new MockDatabaseDriver();

// Build Express test application for database error middleware integration
function createErrorTestApp() {
  const app = express();
  app.use(express.json());

  // Endpoint triggering PostgreSQL syntax error (code 42601)
  app.get('/api/test-db-error/syntax', (req, res, next) => {
    const error = new Error('syntax error at or near "FROM"');
    error.code = '42601';
    error.severity = 'ERROR';
    error.routine = 'scanner_yyerror';
    error.position = '15';
    error.query = 'SELECT * FROM FROM orders';
    error.parameters = ['secret_token_12345', 'user_input'];
    next(error);
  });

  // Endpoint triggering unique violation error (code 23505)
  app.post('/api/test-db-error/unique', (req, res, next) => {
    const error = new Error('duplicate key value violates unique constraint "users_email_key"');
    error.code = '23505';
    error.table = 'users';
    error.column = 'email';
    error.constraint = 'users_email_key';
    error.detail = 'Key (email)=(admin@example.com) already exists.';
    error.parameters = [{ email: 'admin@example.com', password: 'SecretPassword123' }];
    next(error);
  });

  // Register the centralized database error handler
  app.use(databaseErrorHandler);

  return app;
}

const errorApp = createErrorTestApp();

describe('Phase 4: SQL Injection Remediation & Parameterized Query Layer', () => {
  // ─── 1. SEC-INJ-01: Parameterized Out-of-Band Wire Protocol Verification ────
  describe('SEC-INJ-01: Parameterized Out-of-Band Literal Transmission', () => {
    it('SEC-INJ-01 [Vector #1]: Should treat "\' OR 1=1 --" strictly as literal search without syntax error or leakage', async () => {
      const maliciousPayload = "' OR 1=1 --";

      const queryConfig = buildSafeSelectQuery({
        table: 'orders',
        search: maliciousPayload,
        searchColumns: ['customer_name'],
      });

      // Assert placeholder $1 is generated and value is passed in values array
      assert.ok(queryConfig.text.includes('ILIKE $1'));
      assert.strictEqual(queryConfig.values[0], `%' OR 1=1 --%`);

      // Execute against parameterized driver
      const result = await mockDb.execute(queryConfig);

      // Must NOT return all rows as an unparameterized SQLi would!
      assert.strictEqual(
        result.rowCount,
        0,
        'Expected 0 rows: malicious string was treated strictly as a literal text search'
      );
      assert.ok(Array.isArray(result.rows));
    });

    it('SEC-INJ-01 [Vector #2]: Should treat "\'; DROP TABLE orders; --" strictly as literal without command execution', async () => {
      const maliciousPayload = "'; DROP TABLE orders; --";

      const queryConfig = buildSafeSelectQuery({
        table: 'orders',
        search: maliciousPayload,
        searchColumns: ['customer_name'],
      });

      assert.ok(queryConfig.text.includes('ILIKE $1'));
      assert.strictEqual(queryConfig.values[0], `%'; DROP TABLE orders; --%`);

      const result = await mockDb.execute(queryConfig);
      assert.strictEqual(result.rowCount, 0);

      // Verify table data remains completely intact
      assert.strictEqual(mockDb.tables.orders.length, 3);
    });

    it('SEC-INJ-01 [Vector #3]: Should treat "\' UNION SELECT null, username, password FROM users --" strictly as literal', async () => {
      const maliciousPayload = "' UNION SELECT null, username, password FROM users --";

      const queryConfig = buildSafeSelectQuery({
        table: 'orders',
        search: maliciousPayload,
        searchColumns: ['customer_name'],
      });

      const result = await mockDb.execute(queryConfig);
      assert.strictEqual(result.rowCount, 0);

      // Assert no unioned rows or password hashes were leaked
      assert.ok(!result.rows.some((r) => r.password_hash !== undefined));
    });

    it('should return exact match when legitimate search term is provided', async () => {
      const queryConfig = buildSafeSelectQuery({
        table: 'orders',
        search: 'Alpha',
        searchColumns: ['customer_name'],
      });

      const result = await mockDb.execute(queryConfig);
      assert.strictEqual(result.rowCount, 1);
      assert.strictEqual(result.rows[0].customer_name, 'Alpha Fabrics');
    });
  });

  // ─── 2. Safe Dynamic Query Builder & Identifier Allowlisting ───────────────
  describe('Safe Dynamic Query Builder & Identifier Allowlisting', () => {
    it('should map client sort fields to verified database columns via SORT_COLUMNS', () => {
      assert.strictEqual(resolveSortColumn('createdAt'), '"created_at"');
      assert.strictEqual(resolveSortColumn('name'), '"customer_name"');
      assert.strictEqual(resolveSortColumn('status'), '"status"');
      assert.strictEqual(resolveSortColumn('totalAmount'), '"total_amount"');
    });

    it('should immediately reject unlisted/malicious sortBy identifier with InvalidIdentifierException', () => {
      const maliciousInputs = [
        'id;DROP TABLE users;',
        'users.password',
        'sleep(5)',
        '1,2,3',
        'status; DELETE FROM orders;',
        'admin_secret_col',
      ];

      for (const input of maliciousInputs) {
        assert.throws(
          () => resolveSortColumn(input),
          InvalidIdentifierException,
          `Expected InvalidIdentifierException for input: ${input}`
        );
      }
    });

    it('safeQuoteIdentifier: should double-quote valid identifiers and reject illegal characters', () => {
      assert.strictEqual(safeQuoteIdentifier('created_at'), '"created_at"');
      assert.strictEqual(safeQuoteIdentifier('order_status'), '"order_status"');

      // Rejections
      assert.throws(() => safeQuoteIdentifier('col;DROP TABLE users;'), InvalidIdentifierException);
      assert.throws(() => safeQuoteIdentifier('col"name'), InvalidIdentifierException);
      assert.throws(() => safeQuoteIdentifier('123starts_with_num'), InvalidIdentifierException);
      assert.throws(() => safeQuoteIdentifier('col with spaces'), InvalidIdentifierException);
    });

    it('buildSafeSelectQuery: should build query with clamped pagination and verified where clauses', () => {
      const queryConfig = buildSafeSelectQuery({
        table: 'orders',
        select: ['id', 'status'],
        where: { status: 'COMPLETED' },
        sortBy: 'createdAt',
        order: 'asc',
        page: 2,
        limit: 15,
      });

      assert.strictEqual(
        queryConfig.text,
        'SELECT "id", "status" FROM "orders" WHERE "status" = $1 ORDER BY "created_at" ASC LIMIT $2 OFFSET $3'
      );
      assert.deepStrictEqual(queryConfig.values, ['COMPLETED', 15, 15]);
    });

    it('buildSafeSelectQuery: should throw error on unlisted filter column', () => {
      assert.throws(
        () =>
          buildSafeSelectQuery({
            table: 'orders',
            where: { 'evil_col; DROP TABLE users;': 'value' },
          }),
        InvalidIdentifierException
      );
    });
  });

  // ─── 3. Parameterized Query Layer & Static Assertions ──────────────────────
  describe('Parameterized Query Layer & Static String Concatenation Assertions', () => {
    it('assertNoRawInterpolation: should pass for clean parameterized query', () => {
      assert.doesNotThrow(() => {
        assertNoRawInterpolation('SELECT * FROM orders WHERE id = $1 AND status = $2');
      });
    });

    it('assertNoRawInterpolation: should throw UnsafeQueryException on template literal placeholder', () => {
      assert.throws(
        () => {
          assertNoRawInterpolation('SELECT * FROM orders WHERE id = ${userInput}');
        },
        UnsafeQueryException,
        'Expected UnsafeQueryException for template literal placeholder'
      );
    });

    it('assertNoRawInterpolation: should throw UnsafeQueryException on stacked commands', () => {
      assert.throws(
        () => {
          assertNoRawInterpolation("SELECT * FROM orders WHERE status = 'DRAFT'; DROP TABLE users;");
        },
        UnsafeQueryException
      );
    });

    it('auditRepositoryMethod: should statically detect raw string interpolation in repository code', () => {
      function vulnerableRepositoryMethod(client, input) {
        return client.query(`SELECT * FROM users WHERE username = '${input}'`);
      }

      const audit = auditRepositoryMethod(vulnerableRepositoryMethod);
      assert.strictEqual(audit.safe, false);
      assert.ok(audit.violations.length > 0);
      assert.ok(audit.violations[0].includes('Raw template literal interpolation'));
    });

    it('auditRepositoryMethod: should statically approve clean parameterized repository methods', () => {
      function safeRepositoryMethod(client, input) {
        return safeQuery('SELECT * FROM users WHERE username = $1', [input], client);
      }

      const audit = auditRepositoryMethod(safeRepositoryMethod);
      assert.strictEqual(audit.safe, true);
      assert.strictEqual(audit.violations.length, 0);
    });
  });

  // ─── 4. Centralized Sanitized Database Error Handler ───────────────────────
  describe('Centralized Sanitized Database Error Handler', () => {
    it('should intercept PostgreSQL syntax error (42601) and return safe HTTP 500 without leaking query details', async () => {
      const res = await request(errorApp).get('/api/test-db-error/syntax');

      assert.strictEqual(res.status, 500);
      assert.strictEqual(res.body.error, 'DATABASE_ERROR');
      assert.strictEqual(res.body.message, 'An internal error occurred');
      assert.strictEqual(res.body.type, 'https://tools.ietf.org/html/rfc7807');

      // Assert NO SQL syntax, table names, or tokens were leaked to the client
      const bodyString = JSON.stringify(res.body);
      assert.ok(!bodyString.includes('42601'), 'Error code must not be exposed in client response');
      assert.ok(!bodyString.includes('scanner_yyerror'), 'Internal routine must not be exposed');
      assert.ok(!bodyString.includes('FROM FROM'), 'Raw query must not be exposed');
      assert.ok(!bodyString.includes('secret_token'), 'Sensitive parameter must not be exposed');
    });

    it('should intercept unique constraint violation (23505) and return safe HTTP 409 Conflict', async () => {
      const res = await request(errorApp).post('/api/test-db-error/unique');

      assert.strictEqual(res.status, 409);
      assert.strictEqual(res.body.error, 'RESOURCE_CONFLICT');
      assert.strictEqual(res.body.message, 'A resource with the specified identifier already exists');

      // Assert constraint name and internal detail are not leaked
      const bodyString = JSON.stringify(res.body);
      assert.ok(!bodyString.includes('users_email_key'));
      assert.ok(!bodyString.includes('SecretPassword123'));
    });

    it('maskSensitiveParameters: should redact passwords, tokens, and hashes in audit payloads', () => {
      const sensitiveData = {
        username: 'john_doe',
        password: 'PlainSecretPassword!@#',
        sessionPayload: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig',
        userHash: '$2b$10$wK1B6.yG5Nl4K6f4b6q2euK7T3j4n9f2b8l0a6c4e2g8i0k2m4o6q',
        normalField: 'Fabric Details',
      };

      const masked = maskSensitiveParameters(sensitiveData);

      assert.strictEqual(masked.username, 'john_doe');
      assert.strictEqual(masked.password, '[REDACTED]');
      assert.strictEqual(masked.sessionPayload, '[REDACTED_JWT_TOKEN]');
      assert.strictEqual(masked.userHash, '[REDACTED_HASH]');
      assert.strictEqual(masked.normalField, 'Fabric Details');
    });

    it('isPostgresError: should accurately identify PostgreSQL driver errors', () => {
      const pgErr = new Error('relation "orders" does not exist');
      pgErr.code = '42P01';
      pgErr.routine = 'RangeVarGetRelid';

      assert.strictEqual(isPostgresError(pgErr), true);

      const standardErr = new Error('Generic JavaScript TypeError');
      assert.strictEqual(isPostgresError(standardErr), false);
    });
  });
});
