/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - CENTRALIZED ERROR HANDLING MIDDLEWARE
 * Standardizes API error responses: { success: false, code, message, requestId }
 * Never leaks stack traces, internal paths, or DB driver internals in production.
 * ============================================================================
 */

const httpStatus = require('http-status').default;
const config = require('../config/config');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

/**
 * Maps numeric HTTP status codes to standardized error code strings
 */
function getStandardErrorCode(statusCode, rawCode) {
  if (rawCode && typeof rawCode === 'string' && /^[A-Z0-9_]+$/.test(rawCode)) {
    return rawCode;
  }
  switch (statusCode) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 422: return 'UNPROCESSABLE_ENTITY';
    case 429: return 'TOO_MANY_REQUESTS';
    default:  return 'INTERNAL_SERVER_ERROR';
  }
}

/**
 * Sanitizes error messages for public client consumption
 */
function sanitizeClientErrorMessage(statusCode, rawMessage) {
  if (config.env === 'development') {
    return rawMessage;
  }
  if (statusCode >= 500) {
    return 'An internal server error occurred. Our engineering team has been notified.';
  }
  // Sanitize internal database driver strings
  if (typeof rawMessage === 'string') {
    if (rawMessage.includes('E11000') || rawMessage.includes('duplicate key')) {
      return 'A record with this identifier already exists.';
    }
    if (rawMessage.includes('Cast to ObjectId failed') || rawMessage.includes('BSONError')) {
      return 'The requested resource identifier format is invalid.';
    }
  }
  return rawMessage || 'An unexpected error occurred';
}

const errorConverter = (err, req, res, next) => {
  let error = err;
  if (!(error instanceof ApiError)) {
    const statusCode =
      error.statusCode ||
      (error.name === 'ValidationError' ? httpStatus.BAD_REQUEST : httpStatus.INTERNAL_SERVER_ERROR);
    const message = error.message || httpStatus[statusCode];
    error = new ApiError(statusCode, message, false, err.stack);
    if (err.code) error.code = err.code;
  }
  next(error);
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode;
  if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
  }

  const requestId = req.id || req.headers?.['x-request-id'] || 'unknown';
  const durationMs = req.startTime ? Date.now() - req.startTime : undefined;
  const errorCode = getStandardErrorCode(statusCode, err.code);
  const clientMessage = sanitizeClientErrorMessage(statusCode, err.message);

  res.locals.errorMessage = err.message;

  // Standardized RFC-compliant response contract
  const response = {
    success: false,
    code: errorCode,
    message: clientMessage,
    requestId,
    ...(config.env === 'development' && {
      stack: err.stack,
      rawError: err.message,
    }),
  };

  // Structured APM logging with correlation ID and duration
  const logMeta = {
    requestId,
    durationMs,
    statusCode,
    errorCode,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
  };

  if (statusCode >= 500) {
    logger.error(`API Error: ${err.message}`, { ...logMeta, stack: err.stack });
  } else {
    logger.warn(`API Warning: ${err.message}`, logMeta);
  }

  res.status(statusCode).json(response);
};

module.exports = {
  errorConverter,
  errorHandler,
  getStandardErrorCode,
  sanitizeClientErrorMessage,
};
