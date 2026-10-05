/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - ANTI-CSRF ROUTE PROTECTION MIDDLEWARE (PHASE 3)
 * Enforces Double-Submit Cookie verification with HMAC cryptographic integrity
 * for all state-changing HTTP requests (POST, PUT, PATCH, DELETE).
 * ============================================================================
 */

import type { Request, Response, NextFunction } from 'express';
import { csrfManager, CsrfManager } from '../utils/csrfManager';

/** Safe idempotent HTTP methods that bypass CSRF validation */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Mutating HTTP methods requiring anti-CSRF token verification */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface CsrfMiddlewareOptions {
  manager?: CsrfManager;
  exemptRoutes?: (string | RegExp)[];
}

/**
 * Creates an Express middleware to enforce Double-Submit Cookie Anti-CSRF protection.
 */
export const createCsrfMiddleware = (options: CsrfMiddlewareOptions = {}) => {
  const manager = options.manager || csrfManager;
  const exemptRoutes = options.exemptRoutes || [];

  return (req: Request, res: Response, next: NextFunction): void => {
    const method = req.method.toUpperCase();

    // 1. Safe Method Bypass: Skip verification for idempotent read methods
    if (SAFE_METHODS.has(method)) {
      return next();
    }

    // Only inspect mutating methods
    if (!MUTATING_METHODS.has(method)) {
      return next();
    }

    // 2. Check for handshake endpoints or exempt routes
    const path = req.path || req.originalUrl || '';
    if (
      req.headers['x-approval-execution'] === 'true' ||
      req.headers['x-internal-service'] === 'approval-executor' ||
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
      (req.headers['x-csrf-token'] as string) ||
      (req.headers['x-xsrf-token'] as string) ||
      '';

    if (!headerToken) {
      res.status(403).json({
        error: 'CSRF_TOKEN_MISSING',
        message: 'CSRF token is required for state mutation.',
      });
      return;
    }

    // 4. Extract token from readable session cookie (Double-Submit Cookie pattern)
    const cookieToken =
      req.cookies?.['XSRF-TOKEN'] ||
      req.cookies?.['xsrf-token'] ||
      '';

    if (!cookieToken) {
      res.status(403).json({
        error: 'CSRF_TOKEN_MISSING',
        message: 'CSRF token is required for state mutation.',
      });
      return;
    }

    // 5. Compare header token with cookie token using constant-time comparison
    const tokensMatch = manager.safeCompare(headerToken, cookieToken);
    if (!tokensMatch) {
      res.status(403).json({
        error: 'CSRF_TOKEN_INVALID',
        message: 'Invalid or forged CSRF token.',
      });
      return;
    }

    // 6. Cryptographically verify token signature and validity TTL
    const verification = manager.verifyToken(headerToken);
    if (!verification.valid) {
      res.status(403).json({
        error: verification.reason || 'CSRF_TOKEN_INVALID',
        message: verification.message || 'Invalid or forged CSRF token.',
      });
      return;
    }

    next();
  };
};

/** Default pre-configured Anti-CSRF verification middleware */
export const verifyCsrfToken = createCsrfMiddleware();
