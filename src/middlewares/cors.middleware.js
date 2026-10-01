const logger = require('../config/logger');

/**
 * Production-Grade Hardened CORS Middleware Engine
 *
 * Implements Phase 1 of Technical Specification: "CORS & CSRF Vulnerability Remediation"
 * - Dynamic Origin Allowlist Evaluator with strict string equality & anchored regexes
 * - Clean Preflight (OPTIONS) Routing with HTTP 204 termination
 * - Zero Wildcard Credential Reflection (* + credentials)
 * - Strict 'null' Origin Elimination (sandboxed iframes, file://, data: URIs)
 * - Structured SecOps Observability Logging via Winston
 */

// Default trusted exact origin allowlist (Set for O(1) exact lookups)
const DEFAULT_ALLOWED_ORIGINS = new Set([
  'https://erp.eliteedition.in',
  'http://erp.eliteedition.in',
  'https://eliteedition.in',
  'http://eliteedition.in',
  'https://www.eliteedition.in',
  'http://www.eliteedition.in',
  'https://app.eliteerp.com',
  'https://admin.eliteerp.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://3.7.174.180',
  'https://3.7.174.180'
]);

// Anchored regular expression patterns for dynamic multi-subdomain validation
// CRITICAL: Anchored strictly with ^ and $ and escaped dots to prevent prefix/suffix domain hijackings
const DEFAULT_ANCHORED_REGEXES = [
  /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*eliteedition\.in(?::\d+)?$/,
  /^https:\/\/(?:app|admin|portal)\.eliteerp\.com$/,
  /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/,
  /^https?:\/\/3\.7\.174\.180(?::\d+)?$/
];

// Permitted preflight methods
const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

// Permitted preflight request headers
const ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-User-Id';

// Preflight cache duration: 24 hours (in seconds)
const PREFLIGHT_MAX_AGE = '86400';

/**
 * Creates and configures the hardened CORS middleware
 * @param {Object} [options]
 * @param {Set<string>|Array<string>} [options.allowedOrigins] - Explicit origin strings
 * @param {Array<RegExp>} [options.allowedRegexes] - Anchored regex patterns
 * @param {boolean} [options.blockDisallowedWith403=true] - Return 403 for disallowed cross-origin requests
 * @returns {import('express').RequestHandler}
 */
function createCorsMiddleware(options = {}) {
  const allowlistSet = new Set(DEFAULT_ALLOWED_ORIGINS);
  
  // Merge caller-supplied additional origins (new API: additionalOrigins; legacy alias: allowedOrigins)
  const callerOrigins = options.additionalOrigins || options.allowedOrigins;
  if (callerOrigins) {
    callerOrigins.forEach((orig) => {
      if (typeof orig === 'string' && orig.trim()) {
        allowlistSet.add(orig.trim());
      }
    });
  }

  // Load any dynamic origins from environment configuration
  if (process.env.CORS_ALLOWED_ORIGINS) {
    process.env.CORS_ALLOWED_ORIGINS.split(',').forEach((orig) => {
      const trimmed = orig.trim();
      if (trimmed) allowlistSet.add(trimmed);
    });
  }

  const allowlistRegexes = options.allowedRegexes || DEFAULT_ANCHORED_REGEXES;
  const blockWith403 = options.blockDisallowedWith403 !== false;

  /**
   * Evaluates if a given origin is explicitly authorized
   * @param {string} origin
   * @returns {boolean}
   */
  function isOriginAllowed(origin) {
    if (!origin || typeof origin !== 'string') return false;

    const trimmed = origin.trim().replace(/\/+$/, '');

    // CRITICAL: Explicitly block 'null' origin (RFC 6454 opaque origins from sandboxed iframes, file://, data:)
    if (trimmed.toLowerCase() === 'null') {
      return false;
    }

    // 1. Check exact allowlist Set
    if (allowlistSet.has(trimmed)) {
      return true;
    }

    // 2. Check anchored regular expressions
    for (let i = 0; i < allowlistRegexes.length; i++) {
      if (allowlistRegexes[i].test(trimmed)) {
        return true;
      }
    }

    return false;
  }

  return function corsMiddleware(req, res, next) {
    const origin = req.headers.origin;

    // Case 1: Same-Origin or Server-to-Server request (No Origin header present)
    if (!origin) {
      // Browser did not send an Origin header; allow request to proceed without reflecting CORS headers
      return next();
    }

    const trimmedOrigin = origin.trim();

    // Case 2: Detect 'null' origin explicitly
    if (trimmedOrigin.toLowerCase() === 'null') {
      logger.warn('Blocked suspicious cross-origin request with null origin', {
        timestamp: new Date().toISOString(),
        rejectedOrigin: 'null',
        requestIp: req.ip || req.socket?.remoteAddress || 'unknown',
        method: req.method,
        destinationPath: req.originalUrl || req.url,
        reason: 'SEC-CORS-NULL-ORIGIN-REJECTED'
      });

      return res.status(403).json({
        error: 'CORS_FORBIDDEN',
        message: 'Cross-origin request rejected: null origin is prohibited.'
      });
    }

    // Case 3: Origin evaluation against explicit allowlist
    const allowed = isOriginAllowed(trimmedOrigin);

    if (allowed) {
      // Set exact origin reflection (NEVER wildcard '*')
      res.setHeader('Access-Control-Allow-Origin', trimmedOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');

      // Preflight OPTIONS handling
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
        res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
        res.setHeader('Access-Control-Max-Age', PREFLIGHT_MAX_AGE);
        res.setHeader('Content-Length', '0');
        return res.status(204).end();
      }

      return next();
    }

    // Case 4: Unauthorized Origin
    logger.warn('Rejected unauthorized cross-origin request', {
      timestamp: new Date().toISOString(),
      rejectedOrigin: trimmedOrigin,
      requestIp: req.ip || req.socket?.remoteAddress || 'unknown',
      method: req.method,
      destinationPath: req.originalUrl || req.url,
      reason: 'SEC-CORS-UNLISTED-ORIGIN'
    });

    // For preflight OPTIONS from unauthorized origin: reject immediately with 403
    if (req.method === 'OPTIONS') {
      return res.status(403).json({
        error: 'CORS_FORBIDDEN',
        message: 'Preflight cross-origin request rejected: Origin not allowed.'
      });
    }

    // For normal methods (GET, POST, etc.) from unauthorized origin:
    if (blockWith403) {
      return res.status(403).json({
        error: 'CORS_FORBIDDEN',
        message: 'Cross-origin request forbidden: Origin not allowed.'
      });
    }

    // Alternatively omit CORS headers completely so browser isolates response
    return next();
  };
}

module.exports = {
  createCorsMiddleware,
  DEFAULT_ALLOWED_ORIGINS,
  DEFAULT_ANCHORED_REGEXES
};
