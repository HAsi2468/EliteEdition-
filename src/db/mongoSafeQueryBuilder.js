/**
 * Safe Dynamic Query Builder & Field Allowlisting for MongoDB / Mongoose
 *
 * Implements strict programmatic dictionaries for sorting, filtering, and text searching,
 * eliminating NoSQL injection, unauthorized field enumeration, and ReDoS attacks.
 */

const { safeRegexEscape, assertNoUnsanitizedOperators } = require('./mongoSafeQuery');

class InvalidMongoIdentifierException extends Error {
  constructor(message, identifier) {
    super(message);
    this.name = 'InvalidMongoIdentifierException';
    this.identifier = identifier;
  }
}

/**
 * Strict programmatic allowlist mapping client sort fields to verified Mongoose schema paths.
 */
const ALLOWED_SORT_FIELDS = Object.freeze({
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  name: 'name',
  status: 'status',
  totalAmount: 'totalAmount',
  jobNumber: 'jobNumber',
  lotNumber: 'lotNumber',
  totalMeters: 'totalMeters',
  email: 'email',
  id: '_id',
});

/**
 * Programmatic allowlist of filterable Mongoose schema paths.
 */
const ALLOWED_FILTER_FIELDS = Object.freeze({
  status: 'status',
  companyId: 'companyId',
  createdBy: 'createdBy',
  clientName: 'clientName',
  fabricType: 'fabricType',
  isDeleted: 'isDeleted',
  role: 'role',
  department: 'department',
});

/**
 * Safe projection mask excluding sensitive authentication and internal attributes.
 */
const SAFE_DEFAULT_PROJECTION = Object.freeze({
  password: 0,
  passwordHash: 0,
  salt: 0,
  tokens: 0,
  refreshTokens: 0,
  __v: 0,
});

/**
 * Resolves client-requested sort parameters against the verified allowlist.
 *
 * @param {string} clientSort Client sort field name
 * @param {'asc' | 'desc' | 'ASC' | 'DESC'} [order='desc'] Direction
 * @param {Record<string, string>} [dictionary=ALLOWED_SORT_FIELDS]
 * @returns {Record<string, 1 | -1>} Mongoose sort object (e.g. { createdAt: -1 })
 * @throws {InvalidMongoIdentifierException}
 */
function resolveMongoSort(clientSort = 'createdAt', order = 'desc', dictionary = ALLOWED_SORT_FIELDS) {
  if (!clientSort || typeof clientSort !== 'string') {
    throw new InvalidMongoIdentifierException('Sort field must be a non-empty string', clientSort);
  }

  const trimmed = clientSort.trim();

  // Programmatic dictionary lookup
  let resolvedPath = null;
  if (Object.prototype.hasOwnProperty.call(dictionary, trimmed)) {
    resolvedPath = dictionary[trimmed];
  } else {
    // Check if client provided the direct DB field name in dictionary values
    const directMatch = Object.values(dictionary).find((val) => val === trimmed);
    if (directMatch) {
      resolvedPath = directMatch;
    }
  }

  if (!resolvedPath) {
    throw new InvalidMongoIdentifierException(
      `Unauthorized sortBy field '${clientSort}'. Allowed fields: [${Object.keys(dictionary).join(', ')}]`,
      clientSort
    );
  }

  const sortDirection = String(order).toLowerCase() === 'asc' ? 1 : -1;
  return { [resolvedPath]: sortDirection };
}

/**
 * Builds a sanitized, secure MongoDB query definition with safe filters,
 * literal text searching, allowlisted sorting, and clamped pagination.
 *
 * @param {{
 *   filter?: Record<string, any>,
 *   search?: string | null,
 *   searchFields?: string[],
 *   sortBy?: string,
 *   order?: 'asc' | 'desc' | 'ASC' | 'DESC',
 *   page?: number,
 *   limit?: number,
 *   sortDictionary?: Record<string, string>,
 *   filterDictionary?: Record<string, string>,
 *   customProjection?: Record<string, number>
 * }} options
 * @returns {{
 *   filter: Record<string, any>,
 *   sort: Record<string, 1 | -1>,
 *   skip: number,
 *   limit: number,
 *   projection: Record<string, number>
 * }}
 */
function buildSafeMongoQuery(options = {}) {
  const {
    filter = {},
    search = null,
    searchFields = ['name', 'jobNumber', 'lotNumber', 'clientName', 'email'],
    sortBy = 'createdAt',
    order = 'desc',
    page = 1,
    limit = 20,
    sortDictionary = ALLOWED_SORT_FIELDS,
    filterDictionary = ALLOWED_FILTER_FIELDS,
    customProjection = null,
  } = options;

  const safeFilter = {};

  // 1. Process and sanitize filter fields against programmatic allowlist
  if (filter && typeof filter === 'object') {
    // Enforce zero operator injection in incoming filter values
    assertNoUnsanitizedOperators(filter);

    for (const [key, val] of Object.entries(filter)) {
      if (val === undefined) continue;

      const schemaPath =
        filterDictionary[key] || (Object.values(filterDictionary).includes(key) ? key : null);

      if (!schemaPath) {
        throw new InvalidMongoIdentifierException(
          `Unauthorized filter field '${key}'. Allowed filter fields: [${Object.keys(filterDictionary).join(', ')}]`,
          key
        );
      }

      // Exact scalar assignment - immune to operator injection
      safeFilter[schemaPath] = val;
    }
  }

  // 2. Safe Literal Text Search (neutralizing NoSQL regex injections)
  if (search && typeof search === 'string' && search.trim().length > 0) {
    const escapedTerm = safeRegexEscape(search.trim());
    // Create literal case-insensitive regex without unescaped user-controlled syntax
    const literalRegex = new RegExp(escapedTerm, 'i');

    const searchConditions = searchFields.map((field) => ({
      [field]: literalRegex,
    }));

    if (searchConditions.length > 0) {
      safeFilter.$or = searchConditions;
    }
  }

  // 3. Resolve allowlisted sorting
  const sort = resolveMongoSort(sortBy, order, sortDictionary);

  // 4. Clamped Pagination
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (safePage - 1) * safeLimit;

  // 5. Secure Projection (prevents password/token leakage)
  const projection = customProjection || SAFE_DEFAULT_PROJECTION;

  return {
    filter: safeFilter,
    sort,
    skip,
    limit: safeLimit,
    projection,
  };
}

module.exports = {
  ALLOWED_SORT_FIELDS,
  ALLOWED_FILTER_FIELDS,
  SAFE_DEFAULT_PROJECTION,
  resolveMongoSort,
  buildSafeMongoQuery,
  InvalidMongoIdentifierException,
};
