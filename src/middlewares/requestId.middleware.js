/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - REQUEST CORRELATION ID & TELEMETRY MIDDLEWARE
 * Injects cryptographic correlation ID (UUIDv4) into every request and tracks
 * execution duration for structured APM logging.
 * ============================================================================
 */

const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

function requestIdMiddleware(req, res, next) {
  // Respect upstream correlation ID from proxy/client or generate a fresh UUIDv4
  const correlationId = req.headers['x-request-id'] || req.headers['x-correlation-id'] || uuidv4();
  req.id = String(correlationId);
  req.startTime = Date.now();

  res.setHeader('X-Request-ID', req.id);

  res.on('finish', () => {
    req.durationMs = Date.now() - req.startTime;
  });

  next();
}

module.exports = requestIdMiddleware;
