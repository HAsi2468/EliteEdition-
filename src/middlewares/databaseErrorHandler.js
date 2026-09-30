/**
 * Centralized Sanitized Database Error Handler Middleware
 *
 * Intercepts PostgreSQL driver exceptions (e.g., 42601 syntax error, 23505 unique violation).
 * Logs raw query, parameters, and stack traces internally with sensitive parameters masked.
 * Returns safe, non-revealing RFC 7807 error responses to the client, preventing schema leakage.
 */

const httpStatus = require('http-status').default;
const logger = require('../config/logger');

// Sensitive field names to redact in database parameter logs
const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'apikey',
  'api_key',
  'auth',
  'authorization',
  'creditcard',
  'cardnumber',
  'cvv',
  'ssn',
  'accesstoken',
  'refreshtoken',
];

/**
 * Deeply masks sensitive parameters before writing to internal audit logs.
 *
 * @param {*} value
 * @returns {*} Sanitized parameters
 */
function maskSensitiveParameters(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    // Check if value looks like a JWT or long auth token
    if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(value)) {
      return '[REDACTED_JWT_TOKEN]';
    }
    // Check for BCrypt hash format
    if (/^\$2[aby]\$[0-9]{2}\$[A-Za-z0-9./]{53}$/.test(value)) {
      return '[REDACTED_HASH]';
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(maskSensitiveParameters);
  }

  if (typeof value === 'object') {
    const masked = {};
    for (const [k, v] of Object.entries(value)) {
      const lowerKey = k.toLowerCase().replace(/[-_]/g, '');
      if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk))) {
        masked[k] = '[REDACTED]';
      } else {
        masked[k] = maskSensitiveParameters(v);
      }
    }
    return masked;
  }

  return value;
}

/**
 * Checks whether an error is originated from the PostgreSQL database driver.
 *
 * @param {Error} err
 * @returns {boolean}
 */
function isPostgresError(err) {
  if (!err || typeof err !== 'object') return false;

  // Standard PostgreSQL driver error properties
  return (
    typeof err.code === 'string' &&
    /^[0-9A-Z]{5}$/.test(err.code) &&
    (err.routine !== undefined ||
      err.severity !== undefined ||
      err.schema !== undefined ||
      err.table !== undefined)
  );
}

/**
 * Express error-handling middleware for database exceptions.
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function databaseErrorHandler(err, req, res, next) {
  if (!isPostgresError(err)) {
    return next(err);
  }

  const { code, routine, position, table, column, constraint } = err;
  const rawQuery = err.query || req.lastExecutedQuery || 'N/A';
  const rawParams = err.parameters || req.lastExecutedParams || [];

  // 1. Internal Secure Logging with sensitive fields masked
  logger.error('[Database Driver Exception Captured]', {
    code,
    routine,
    position,
    table,
    column,
    constraint,
    query: rawQuery,
    parameters: maskSensitiveParameters(rawParams),
    stack: err.stack,
    url: req.originalUrl || req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  const timestamp = new Date().toISOString();
  const instance = req.originalUrl || req.url || '';

  // 2. Client Response Sanitization
  // Code 23505: unique_violation
  if (code === '23505') {
    return res.status(httpStatus.CONFLICT).json({
      type: 'https://tools.ietf.org/html/rfc7807',
      title: 'Conflict',
      status: httpStatus.CONFLICT,
      error: 'RESOURCE_CONFLICT',
      message: 'A resource with the specified identifier already exists',
      instance,
      timestamp,
    });
  }

  // Code 23503: foreign_key_violation
  if (code === '23503') {
    return res.status(httpStatus.BAD_REQUEST).json({
      type: 'https://tools.ietf.org/html/rfc7807',
      title: 'Bad Request',
      status: httpStatus.BAD_REQUEST,
      error: 'FOREIGN_KEY_VIOLATION',
      message: 'Referenced related entity does not exist or cannot be modified',
      instance,
      timestamp,
    });
  }

  // Code 22P02: invalid_text_representation (e.g. malformed uuid or int)
  if (code === '22P02') {
    return res.status(httpStatus.BAD_REQUEST).json({
      type: 'https://tools.ietf.org/html/rfc7807',
      title: 'Bad Request',
      status: httpStatus.BAD_REQUEST,
      error: 'INVALID_DATA_FORMAT',
      message: 'Supplied identifier or data format is invalid',
      instance,
      timestamp,
    });
  }

  // Default Fallback: Completely redact all SQL syntax errors (42601), undefined tables (42P01),
  // undefined columns (42703), or connection failures (08006).
  return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
    type: 'https://tools.ietf.org/html/rfc7807',
    title: 'Internal Server Error',
    status: httpStatus.INTERNAL_SERVER_ERROR,
    error: 'DATABASE_ERROR',
    message: 'An internal error occurred',
    instance,
    timestamp,
  });
}

module.exports = {
  databaseErrorHandler,
  maskSensitiveParameters,
  isPostgresError,
};
