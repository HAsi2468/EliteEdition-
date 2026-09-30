/**
 * Centralized Sanitized MongoDB & Mongoose Error Handler Middleware
 *
 * Intercepts MongoDB driver exceptions (e.g., MongoServerError code 11000 duplicate key,
 * Mongoose CastError, ValidationError, MongoNetworkError).
 * Logs raw query details and stack traces internally with sensitive parameters masked.
 * Returns safe, non-revealing RFC 7807 problem details to the client, preventing schema & topology leakage.
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
  'hash',
  'salt',
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
      if (typeof v === 'string' && /^\$2[aby]\$[0-9]{2}\$[A-Za-z0-9./]{53}$/.test(v)) {
        masked[k] = '[REDACTED_HASH]';
      } else if (typeof v === 'string' && /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(v)) {
        masked[k] = '[REDACTED_JWT_TOKEN]';
      } else if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk))) {
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
 * Checks whether an error is originated from MongoDB or Mongoose.
 *
 * @param {Error} err
 * @returns {boolean}
 */
function isMongoError(err) {
  if (!err || typeof err !== 'object') return false;

  return (
    err.name === 'MongoServerError' ||
    err.name === 'MongoError' ||
    err.name === 'CastError' ||
    err.name === 'ValidationError' ||
    err.name === 'MongoNetworkError' ||
    err.name === 'MongoServerSelectionError' ||
    err.code === 11000 ||
    err.code === 11001 ||
    Boolean(err.keyPattern)
  );
}

/**
 * Express error-handling middleware for MongoDB and Mongoose exceptions.
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function mongoErrorHandler(err, req, res, next) {
  if (!isMongoError(err)) {
    return next(err);
  }

  const { name, code, message } = err;
  const rawQuery = req.lastExecutedFilter || req.body || {};

  // 1. Internal Secure Logging with sensitive fields masked
  logger.error('[MongoDB Driver Exception Captured]', {
    name,
    code,
    message: err.message,
    stack: err.stack,
    query: maskSensitiveParameters(rawQuery),
    url: req.originalUrl || req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  const timestamp = new Date().toISOString();
  const instance = req.originalUrl || req.url || '';

  // 2. Handle Duplicate Key Error (Code 11000 / 11001)
  if (code === 11000 || code === 11001) {
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

  // 3. Handle Mongoose CastError (invalid ObjectId, type conversion failure)
  if (name === 'CastError') {
    return res.status(httpStatus.BAD_REQUEST).json({
      type: 'https://tools.ietf.org/html/rfc7807',
      title: 'Bad Request',
      status: httpStatus.BAD_REQUEST,
      error: 'INVALID_DATA_FORMAT',
      message: 'Invalid identifier or data format',
      instance,
      timestamp,
    });
  }

  // 4. Handle Mongoose Schema ValidationError
  if (name === 'ValidationError' && err.errors) {
    const details = Object.entries(err.errors).map(([field, item]) => ({
      field: `body.${field}`,
      message: item.message || 'Invalid value',
      code: item.kind || 'invalid_input',
    }));

    return res.status(httpStatus.BAD_REQUEST).json({
      type: 'https://tools.ietf.org/html/rfc7807',
      title: 'Bad Request',
      status: httpStatus.BAD_REQUEST,
      error: 'VALIDATION_ERROR',
      message: 'Invalid request payload',
      instance,
      timestamp,
      details,
    });
  }

  // 5. Default Fallback: Redact replica set topology, hostnames, and internal database errors
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
  mongoErrorHandler,
  maskSensitiveParameters,
  isMongoError,
};
