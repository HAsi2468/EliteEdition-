const { z, ZodError } = require('zod');
const httpStatus = require('http-status').default;

/**
 * Deeply sanitizes an object or array by stripping all keys that start with '$'
 * or contain '.' (NoSQL operator & property injection neutralization).
 *
 * @param {*} value
 * @returns {*} Sanitized value
 */
function stripNoSqlOperators(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(stripNoSqlOperators);
  }

  const sanitized = {};
  for (const [key, val] of Object.entries(value)) {
    // Strip MongoDB operators ($gt, $ne, $where, etc.) and dot-notation paths (user.role)
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    sanitized[key] = stripNoSqlOperators(val);
  }
  return sanitized;
}

/**
 * Formats Zod validation issues into standardized, RFC 7807 compliant error details.
 *
 * @param {ZodError} error
 * @param {'body' | 'query' | 'params' | 'headers'} target
 * @returns {Array<{ field: string, message: string, code: string }>}
 */
function formatZodDetails(error, target) {
  return error.issues.map((issue) => {
    let pathString = issue.path.length > 0 ? issue.path.join('.') : '';
    // If unrecognized keys occurred in strict schema, include the key names in field path
    if (issue.code === 'unrecognized_keys' && Array.isArray(issue.keys)) {
      pathString = pathString
        ? `${pathString}.${issue.keys.join(', ')}`
        : issue.keys.join(', ');
    }

    const field = pathString ? `${target}.${pathString}` : target;

    return {
      field,
      message: issue.message,
      code: issue.code || 'invalid_input',
    };
  });
}

/**
 * RFC 7807 Structured Problem Details builder for HTTP 400 Bad Request
 *
 * @param {Array<{ field: string, message: string, code: string }>} details
 * @param {string} instanceUrl
 * @returns {Object}
 */
function createRfc7807ValidationError(details, instanceUrl = '') {
  return {
    type: 'https://tools.ietf.org/html/rfc7807',
    title: 'Bad Request',
    status: httpStatus.BAD_REQUEST,
    error: 'VALIDATION_ERROR',
    message: 'Invalid payload',
    instance: instanceUrl,
    timestamp: new Date().toISOString(),
    details,
  };
}

/**
 * Centralized schema validation middleware factory.
 * Parses, type-checks, and sanitizes incoming HTTP request bodies, route parameters,
 * query strings, and headers, blocking mass-assignment and NoSQL operator injections.
 *
 * @param {{
 *   body?: z.ZodTypeAny,
 *   query?: z.ZodTypeAny,
 *   params?: z.ZodTypeAny,
 *   headers?: z.ZodTypeAny
 * }} schemas
 * @returns {import('express').RequestHandler}
 */
const validateRequest = (schemas = {}) => {
  return async (req, res, next) => {
    try {
      const allDetails = [];
      const targets = ['params', 'query', 'headers', 'body'];

      for (const target of targets) {
        const schema = schemas[target];
        if (!schema) continue;

        // Ensure target container exists
        req[target] = req[target] || {};

        // Perform schema parsing (with strict checking and type coercion)
        const result = await schema.safeParseAsync(req[target]);

        if (!result.success) {
          const details = formatZodDetails(result.error, target);
          allDetails.push(...details);
        } else {
          // On validation success, deeply strip any NoSQL operator keys and overwrite container
          req[target] = stripNoSqlOperators(result.data);
        }
      }

      // If any validation target failed, immediately halt pipeline and return RFC 7807 error
      if (allDetails.length > 0) {
        const rfcError = createRfc7807ValidationError(
          allDetails,
          req.originalUrl || req.url
        );
        return res.status(httpStatus.BAD_REQUEST).json(rfcError);
      }

      return next();
    } catch (unexpectedError) {
      return next(unexpectedError);
    }
  };
};

/**
 * Global middleware layer for untyped inputs:
 * Deeply strips keys starting with '$' or containing '.' across req.body, req.query, and req.params.
 */
const noSqlSanitizerMiddleware = (req, res, next) => {
  if (req.body) req.body = stripNoSqlOperators(req.body);
  if (req.query) req.query = stripNoSqlOperators(req.query);
  if (req.params) req.params = stripNoSqlOperators(req.params);
  next();
};

module.exports = {
  validateRequest,
  stripNoSqlOperators,
  formatZodDetails,
  createRfc7807ValidationError,
  noSqlSanitizerMiddleware,
};
