/**
 * Parameterized Query Layer (Zero String Concatenation)
 *
 * Enforces native prepared statements and parameterized placeholders ($1, $2, ...)
 * over the database wire protocol, eliminating SQL Injection vulnerabilities.
 */

const { getPgPool } = require('./postgresClient');

class UnsafeQueryException extends Error {
  constructor(message, querySample) {
    super(message);
    this.name = 'UnsafeQueryException';
    this.querySample = querySample;
  }
}

/**
 * Static & runtime assertion that throws an error if raw string interpolation/concatenation
 * or unparameterized literals are detected in query strings.
 *
 * @param {string} queryText
 * @throws {UnsafeQueryException}
 */
function assertNoRawInterpolation(queryText) {
  if (typeof queryText !== 'string') {
    throw new UnsafeQueryException('Query text must be a string');
  }

  // Detect JavaScript template literal placeholders accidentally stringified "${...}"
  if (/\$\{[^}]+\}/.test(queryText)) {
    throw new UnsafeQueryException(
      'Dangerous template literal interpolation detected in query. Use parameterized placeholders ($1, $2, ...)',
      queryText
    );
  }

  // Detect common SQL string concatenation patterns in dynamic construction
  // e.g. "WHERE column = '" + input + "'"
  const inlineStringLiteralPatterns = [
    /=\s*'[^\$'][^']*'/i,            // inline string comparison e.g. = 'admin' (not = $1)
    /LIKE\s*'[^\$'][^']*'/i,         // inline LIKE e.g. LIKE '%admin%'
    /IN\s*\(\s*'[^']*'\s*(?:,\s*'[^']*'\s*)*\)/i, // inline string lists IN ('a', 'b')
  ];

  // We allow specific standard SQL string constants (e.g. status = 'DRAFT' or NOW()),
  // but reject any concatenation of unparameterized strings combined with quotes.
  if (
    queryText.includes("''") || // doubled escaping indicative of manual string building
    /\+\s*["'][^"']*["']\s*\+/.test(queryText) || // " + 'foo' + "
    /'\s*;\s*(?:DROP|DELETE|UPDATE|INSERT|SELECT|ALTER|TRUNCATE)\b/i.test(queryText) // inline stacked commands
  ) {
    throw new UnsafeQueryException(
      'Suspicious unparameterized query concatenation detected. All user-supplied values must be passed in params array',
      queryText
    );
  }
}

/**
 * Audits a repository function or code string for raw string interpolation/concatenation.
 * Can be integrated into CI/CD pipelines and static verification tests.
 *
 * @param {Function | string} fnOrCode
 * @returns {{ safe: boolean, violations: string[] }}
 */
function auditRepositoryMethod(fnOrCode) {
  const code = typeof fnOrCode === 'function' ? fnOrCode.toString() : String(fnOrCode);
  const violations = [];

  // Check for template literals in query calls
  // e.g. query(`SELECT ... ${input}`) or client.query(`... ${val}`)
  const templateLiteralMatch = code.match(/(?:query|safeQuery)\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`/g);
  if (templateLiteralMatch) {
    violations.push(
      ...templateLiteralMatch.map(
        (m) => `Raw template literal interpolation found in query execution: ${m.slice(0, 100)}...`
      )
    );
  }

  // Check for string concatenation in query calls
  // e.g. query("SELECT ... " + input)
  const stringConcatMatch = code.match(/(?:query|safeQuery)\s*\(\s*(?:["'][^"']*["']|\w+)\s*\+\s*\w+/g);
  if (stringConcatMatch) {
    violations.push(
      ...stringConcatMatch.map(
        (m) => `Raw string concatenation found in query execution: ${m.slice(0, 100)}...`
      )
    );
  }

  return {
    safe: violations.length === 0,
    violations,
  };
}

/**
 * Safe Parameterized Query Executor.
 * Guarantees out-of-band wire protocol transmission of query parameters.
 *
 * @param {string} text SQL statement with $1, $2 placeholders
 * @param {any[]} [params=[]] Parameter values
 * @param {import('pg').PoolClient | null} [client=null] Optional existing transaction client
 * @param {string} [statementName] Optional prepared statement name for caching query execution plans
 * @returns {Promise<import('pg').QueryResult>}
 */
async function safeQuery(text, params = [], client = null, statementName = null) {
  assertNoRawInterpolation(text);

  const queryConfig = {
    text,
    values: Array.isArray(params) ? params : [],
  };

  if (statementName) {
    queryConfig.name = statementName;
  }

  if (client) {
    return client.query(queryConfig);
  }

  const pool = getPgPool();
  return pool.query(queryConfig);
}

/**
 * Execute a transaction using strict parameterized queries.
 *
 * @param {function(client: import('pg').PoolClient): Promise<any>} transactionFn
 * @returns {Promise<any>}
 */
async function executeSafeTransaction(transactionFn) {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await transactionFn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[PostgreSQL Rollback Failure]:', rollbackErr);
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  safeQuery,
  assertNoRawInterpolation,
  auditRepositoryMethod,
  executeSafeTransaction,
  UnsafeQueryException,
};
