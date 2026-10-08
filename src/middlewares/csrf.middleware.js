/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - ANTI-CSRF ROUTE PROTECTION MIDDLEWARE (PHASE 3)
 * Enforces Double-Submit Cookie verification with HMAC cryptographic integrity
 * for all state-changing HTTP requests (POST, PUT, PATCH, DELETE).
 * ============================================================================
 */

const { csrfManager } = require('../utils/csrfManager');

/** Safe idempotent HTTP methods that bypass CSRF validation */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Mutating HTTP methods requiring anti-CSRF token verification */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Creates an Express middleware to enforce Double-Submit Cookie Anti-CSRF protection.
 * @param {Object} [options={}]
 * @param {import('../utils/csrfManager').CsrfManager} [options.manager]
 * @param {Array<string|RegExp>} [options.exemptRoutes]
 */
const createCsrfMiddleware = (options = {}) => {
  const manager = options.manager || csrfManager;
  const exemptRoutes = options.exemptRoutes || [];

  return (req, res, next) => {
    const method = req.method.toUpperCase();

    // 1. Safe Method Bypass: Skip verification for idempotent read methods
    if (SAFE_METHODS.has(method)) {
      return next();
    }

    // Only inspect mutating methods
    if (!MUTATING_METHODS.has(method)) {
      return next();
    }

    // Internal loopback admin approval execution replay
    if (
      req.headers['x-approval-execution'] === 'true' ||
      req.headers['x-internal-service'] === 'approval-executor'
    ) {
      return next();
    }

    // 2. Check for handshake endpoints or exempt routes
    const path = req.path || req.originalUrl || '';
    if (
      path.endsWith('/csrf-token') ||
      path.includes('/auth/csrf-token') ||
      path.includes('/challanVerification') ||
      path.startsWith('/verify/challan') ||
      path.startsWith('/verify/jobcard') ||
      path.startsWith('/verify/invoice')
    ) {
      return next();
    }

    const isExempt = exemptRoutes.some((route) => {
      if (typeof route === 'string') {
        return path === route || path.startsWith(route);
      }
      return route.test(path);
    });

    if (isExempt) {
      return next();
    }

    // 3. Extract Anti-CSRF token from request headers
    const headerToken =
      req.headers['x-csrf-token'] ||
      req.headers['x-xsrf-token'] ||
      '';

    if (!headerToken) {
      return res.status(403).json({
        error: 'CSRF_TOKEN_MISSING',
        message: 'CSRF token is required for state mutation.',
      });
    }

    // 4. Extract token from readable session cookie (Double-Submit Cookie pattern)
    const cookieToken =
      (req.cookies && (req.cookies['XSRF-TOKEN'] || req.cookies['xsrf-token'])) ||
      '';

    if (!cookieToken) {
      return res.status(403).json({
        error: 'CSRF_TOKEN_MISSING',
        message: 'CSRF token is required for state mutation.',
      });
    }

    // 5. Compare header token with cookie token using constant-time comparison
    const tokensMatch = manager.safeCompare(headerToken, cookieToken);
    if (!tokensMatch) {
      return res.status(403).json({
        error: 'CSRF_TOKEN_INVALID',
        message: 'Invalid or forged CSRF token.',
      });
    }

    // 6. Cryptographically verify token signature and validity TTL
    const verification = manager.verifyToken(headerToken);
    if (!verification.valid) {
      return res.status(403).json({
        error: verification.reason || 'CSRF_TOKEN_INVALID',
        message: verification.message || 'Invalid or forged CSRF token.',
      });
    }

    next();
  };
};

/** Default pre-configured Anti-CSRF verification middleware */
const verifyCsrfToken = createCsrfMiddleware();

module.exports = {
  createCsrfMiddleware,
  verifyCsrfToken,
};
