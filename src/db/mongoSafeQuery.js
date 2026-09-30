/**
 * MongoDB / Mongoose Safe Query & Parameterization Layer
 *
 * Eliminates NoSQL Injection & Query Selector Injections across the data access layer.
 * Enforces scalar primitives, escapes regex wildcards into literal strings,
 * and neutralizes arbitrary code execution vectors ($where, $expr, $function).
 */

class UnsafeMongoQueryException extends Error {
  constructor(message, querySample) {
    super(message);
    this.name = 'UnsafeMongoQueryException';
    this.querySample = querySample;
  }
}

/**
 * Escapes all regular expression special characters in a string.
 * Guarantees that user search input is treated strictly as a literal substring,
 * neutralizing regex injection, wildcards, and ReDoS catastrophic backtracking.
 *
 * @param {string} str
 * @returns {string} Regex-escaped string
 */
function safeRegexEscape(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
}

/**
 * Deeply inspects a filter or query predicate.
 * Throws an UnsafeMongoQueryException if any dangerous MongoDB operators
 * ($where, $expr, $regex, $gt, $ne, etc.) or dot-notation injections are found
 * inside untrusted user-supplied objects.
 *
 * @param {*} value
 * @param {string} [path='']
 * @throws {UnsafeMongoQueryException}
 */
function assertNoUnsanitizedOperators(value, path = '') {
  if (value === null || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      assertNoUnsanitizedOperators(value[i], `${path}[${i}]`);
    }
    return;
  }

  for (const [key, val] of Object.entries(value)) {
    const currentPath = path ? `${path}.${key}` : key;

    // Detect NoSQL operator keys starting with '$'
    if (key.startsWith('$')) {
      throw new UnsafeMongoQueryException(
        `Disallowed MongoDB operator '${key}' detected in query filter at path '${currentPath}'. User input must be a scalar primitive.`,
        value
      );
    }

    // Detect untrusted dot-notation property path injection (e.g. 'roles.0' or 'profile.isAdmin')
    if (key.includes('.')) {
      throw new UnsafeMongoQueryException(
        `Disallowed dot-notation path injection '${key}' detected in query filter at path '${currentPath}'.`,
        value
      );
    }

    assertNoUnsanitizedOperators(val, currentPath);
  }
}

/**
 * Static code auditor for Mongoose repository methods.
 * Detects patterns where untrusted raw objects (e.g. req.query, req.body) are passed
 * directly into Mongoose Model.find(), Model.findOne(), or Model.updateOne().
 *
 * @param {Function | string} fnOrCode
 * @returns {{ safe: boolean, violations: string[] }}
 */
function auditMongoRepositoryMethod(fnOrCode) {
  const code = typeof fnOrCode === 'function' ? fnOrCode.toString() : String(fnOrCode);
  const violations = [];

  // Check for direct Model.find(req.query) or Model.findOne(req.body)
  const directReqMatch = code.match(/\.(?:find|findOne|updateOne|updateMany|countDocuments)\s*\(\s*req\.(?:query|body|params)/g);
  if (directReqMatch) {
    violations.push(
      ...directReqMatch.map(
        (m) => `Direct injection risk: raw HTTP request container passed directly to Mongoose query: ${m}`
      )
    );
  }

  // Check for unescaped RegExp instantiation e.g. new RegExp(userInput) or RegExp(search) without escape
  const rawRegExpMatch = code.match(/new\s+RegExp\s*\(\s*(?!safeRegexEscape)[a-zA-Z0-9_.]+\s*[,)]/g);
  if (rawRegExpMatch) {
    violations.push(
      ...rawRegExpMatch.map(
        (m) => `Raw RegExp construction without safeRegexEscape: ${m}`
      )
    );
  }

  return {
    safe: violations.length === 0,
    violations,
  };
}

/**
 * Executes a safe Mongoose find query with operator assertion and timeout limits.
 *
 * @param {import('mongoose').Model} model Mongoose model instance
 * @param {Record<string, any>} filter Validated query filter
 * @param {{
 *   projection?: Record<string, number> | string,
 *   sort?: Record<string, number>,
 *   skip?: number,
 *   limit?: number,
 *   maxTimeMS?: number
 * }} [options={}]
 * @returns {Promise<any[]>}
 */
async function safeMongoFind(model, filter = {}, options = {}) {
  assertNoUnsanitizedOperators(filter);

  const {
    projection = null,
    sort = { createdAt: -1 },
    skip = 0,
    limit = 20,
    maxTimeMS = 5000,
  } = options;

  let query = model.find(filter);

  if (projection) {
    query = query.select(projection);
  }

  if (sort) {
    query = query.sort(sort);
  }

  if (skip > 0) {
    query = query.skip(skip);
  }

  if (limit > 0) {
    query = query.limit(limit);
  }

  return query.maxTimeMS(maxTimeMS).lean().exec();
}

module.exports = {
  safeRegexEscape,
  assertNoUnsanitizedOperators,
  auditMongoRepositoryMethod,
  safeMongoFind,
  UnsafeMongoQueryException,
};
