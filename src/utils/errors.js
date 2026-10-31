/**
 * Centralized Error-Mapping Utility and Middleware (BUG-052, BUG-014, BUG-015, BUG-041, BUG-016)
 * - AppError: Custom operational error with HTTP status, code, and structured fields
 * - errorMapper: Sanitizes raw Mongoose/driver exceptions and prevents leaking internal details
 */
const crypto = require('crypto');
const mongoose = require('mongoose');

class AppError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.statusCode = status;
    this.code = code;
    this.fields = fields;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorMapper = (err, req, res, _next) => {
  const requestId = (req.get?.('x-request-id') || req.id || crypto.randomUUID()).slice(0, 64);
  if (res.headersSent) {
    if (res.destroy) res.destroy();
    return;
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      code: err.code,
      message: err.message,
      fields: err.fields,
      requestId
    });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const fields = {};
    for (const [path, e] of Object.entries(err.errors || {})) {
      fields[path] = e.kind === 'enum'
        ? 'Choose a value from the list.'
        : e.kind === 'required'
          ? 'Required.'
          : 'Invalid value.';
    }
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_FAILED',
      message: 'Please correct the highlighted fields.',
      fields,
      requestId
    });
  }

  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_ID',
      message: `Invalid value for ${err.path}.`,
      fields: { [err.path]: 'Invalid value.' },
      requestId
    });
  }

  if (err && (err.code === 11000 || err.code === '11000')) {
    const keyValue = err.keyValue || {};
    const field = Object.keys(keyValue).find((k) => k !== 'companyId') || 'value';
    return res.status(409).json({
      success: false,
      code: 'DUPLICATE',
      message: `This ${field} already exists.`,
      fields: { [field]: 'Already in use.' },
      requestId
    });
  }

  if (err && (err.type === 'entity.parse.failed' || err.name === 'SyntaxError')) {
    return res.status(400).json({
      success: false,
      code: 'BAD_JSON',
      message: 'Malformed request body.',
      requestId
    });
  }

  // Generic fallback: log full error internally, return sanitized 500 without leaking driver internals
  console.error('[unhandled error]', { requestId, method: req.method, url: req.originalUrl, err: err.message, stack: err.stack });
  return res.status(500).json({
    success: false,
    code: 'INTERNAL',
    message: 'Something went wrong. Please retry or quote the request id.',
    requestId
  });
};

module.exports = {
  AppError,
  errorMapper
};

