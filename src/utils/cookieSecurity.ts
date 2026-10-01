/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - COOKIE SECURITY UTILITY (PHASE 2)
 * Standardized, hardened cookie provisioning enforcing modern security attributes.
 * Prevents ambient session hijacking, CSRF, and scope-mismatched dangling cookies.
 * ============================================================================
 */

import type { Response, CookieOptions } from 'express';

export type CookieType = 'session' | 'refresh' | 'highPrivilege' | 'csrf' | 'custom';

/** Canonical names for standard cookies — avoids magic strings across controllers */
export const COOKIE_NAMES = Object.freeze({
  AUTH_TOKEN:  'elite_auth_token',
  REFRESH:     'elite_refresh_token',
  XSRF_TOKEN:  'XSRF-TOKEN',
  SESSION_ID:  'session_id',
} as const);

export type KnownCookieName = typeof COOKIE_NAMES[keyof typeof COOKIE_NAMES];

/**
 * Resolves the cookie domain scope.
 * In production: Enforces '.eliteerp.com' or explicit COOKIE_DOMAIN.
 * In local/test environments: Omitted to allow host-only localhost/127.0.0.1 cookies.
 */
export const getCookieDomain = (): string | undefined => {
  if (process.env.COOKIE_DOMAIN) {
    return process.env.COOKIE_DOMAIN;
  }
  if (process.env.NODE_ENV === 'production') {
    return '.eliteedition.in';
  }
  return undefined;
};

/**
 * Checks if the runtime requires HTTPS for cookies.
 */
export const isSecureContext = (): boolean => {
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE === 'true';
  }
  return process.env.NODE_ENV === 'production';
};

/**
 * Builds base cookie options with hardened defaults.
 */
export const getBaseCookieOptions = (overrides: CookieOptions = {}): CookieOptions => {
  const options: CookieOptions = {
    httpOnly: true,
    secure: isSecureContext(),
    sameSite: 'lax',
    path: '/',
    ...overrides,
  };

  const domain = overrides.domain !== undefined ? overrides.domain : getCookieDomain();
  if (domain) {
    options.domain = domain;
  }

  return options;
};

/**
 * Options for standard session and refresh cookies.
 * Enforces: HttpOnly; Secure; SameSite=Lax; Path=/; Domain=.eliteerp.com
 */
export const getSessionCookieOptions = (overrides: CookieOptions = {}): CookieOptions => {
  return getBaseCookieOptions({
    sameSite: 'lax',
    ...overrides,
  });
};

/**
 * Options for high-privilege administrative / financial mutation cookies.
 * Enforces: HttpOnly; Secure; SameSite=Strict; Path=/; Domain=.eliteerp.com
 */
export const getHighPrivilegeCookieOptions = (overrides: CookieOptions = {}): CookieOptions => {
  return getBaseCookieOptions({
    sameSite: 'strict',
    ...overrides,
  });
};

/**
 * Sets a standard session or refresh token cookie.
 */
export const setSessionCookie = (
  res: Response,
  name: string,
  value: string,
  maxAgeOrExpires?: number | Date,
  options: CookieOptions = {}
): void => {
  const cookieOpts = getSessionCookieOptions(options);

  if (typeof maxAgeOrExpires === 'number') {
    cookieOpts.maxAge = maxAgeOrExpires;
  } else if (maxAgeOrExpires instanceof Date) {
    cookieOpts.expires = maxAgeOrExpires;
  }

  res.cookie(name, value, cookieOpts);
};

/**
 * Sets a high-privilege mutation cookie with SameSite=Strict.
 */
export const setHighPrivilegeCookie = (
  res: Response,
  name: string,
  value: string,
  maxAgeOrExpires?: number | Date,
  options: CookieOptions = {}
): void => {
  const cookieOpts = getHighPrivilegeCookieOptions(options);

  if (typeof maxAgeOrExpires === 'number') {
    cookieOpts.maxAge = maxAgeOrExpires;
  } else if (maxAgeOrExpires instanceof Date) {
    cookieOpts.expires = maxAgeOrExpires;
  }

  res.cookie(name, value, cookieOpts);
};

/**
 * Clears a cookie guaranteeing identical path and domain scopes.
 * Eliminates dangling/shadow cookies caused by scope mismatches.
 */
export const clearSecureCookie = (
  res: Response,
  name: string,
  options: CookieOptions = {}
): void => {
  const clearOpts = getBaseCookieOptions({
    ...options,
  });

  delete clearOpts.maxAge;
  delete clearOpts.expires;

  res.clearCookie(name, clearOpts);
};

/**
 * General helper to set a secure cookie with custom options merged on secure defaults.
 */
export const setSecureCookie = (
  res: Response,
  name: string,
  value: string,
  options: CookieOptions = {}
): void => {
  const cookieOpts = getBaseCookieOptions(options);
  res.cookie(name, value, cookieOpts);
};

/**
 * Options for CSRF token cookie (XSRF-TOKEN).
 * Enforces: SameSite=Lax; Secure; Path=/; HttpOnly=false (readable by SPA for Double-Submit header injection)
 */
export const getCsrfCookieOptions = (overrides: CookieOptions = {}): CookieOptions => {
  return getBaseCookieOptions({
    httpOnly: false,
    sameSite: 'lax',
    ...overrides,
  });
};

/**
 * Sets the readable CSRF (XSRF-TOKEN) cookie for client-side SPA hydration.
 * HttpOnly: false — intentionally readable by browser JS for Double-Submit header injection.
 */
export const setCsrfCookie = (
  res: Response,
  token: string,
  options: CookieOptions = {}
): void => {
  const cookieOpts = getCsrfCookieOptions(options);
  res.cookie(COOKIE_NAMES.XSRF_TOKEN, token, cookieOpts);
};

/**
 * Sets the standard authentication token cookie (HttpOnly; Secure; SameSite=Lax).
 * Default maxAge: 24 hours (86 400 000 ms).
 */
export const setAuthTokenCookie = (
  res: Response,
  token: string,
  maxAgeMs: number = 24 * 60 * 60 * 1000,
  options: CookieOptions = {}
): void => {
  const cookieOpts = getSessionCookieOptions({ maxAge: maxAgeMs, ...options });
  res.cookie(COOKIE_NAMES.AUTH_TOKEN, token, cookieOpts);
};

/**
 * Sets the refresh token cookie (HttpOnly; Secure; SameSite=Lax; Path=/v1/auth).
 * Uses a tighter path to minimise cookie scope surface.
 * Default maxAge: 30 days.
 */
export const setRefreshCookie = (
  res: Response,
  token: string,
  maxAgeMs: number = 30 * 24 * 60 * 60 * 1000,
  options: CookieOptions = {}
): void => {
  const cookieOpts = getSessionCookieOptions({
    maxAge: maxAgeMs,
    path: '/v1/auth',
    ...options,
  });
  res.cookie(COOKIE_NAMES.REFRESH, token, cookieOpts);
};

/**
 * Atomically revokes a cookie using identical scope (domain + path) to its
 * set counterpart. Prevents shadow/dangling cookies caused by scope mismatches.
 *
 * CRITICAL: The `path` and `domain` arguments MUST match what was used when
 * the cookie was originally set, otherwise the browser will not delete it.
 */
export const revokeCookie = (
  res: Response,
  name: string,
  options: CookieOptions = {}
): void => {
  // Build options using the same defaults as the setter, then clear age/expiry
  const clearOpts = getBaseCookieOptions({ ...options });
  delete clearOpts.maxAge;
  delete clearOpts.expires;
  // Force expiry into the past to guarantee removal across all browsers
  clearOpts.expires = new Date(0);
  res.clearCookie(name, clearOpts);
};

/**
 * Convenience: revokes all standard auth cookies in one call.
 * Useful on logout handlers to guarantee a clean slate.
 */
export const revokeAllAuthCookies = (
  res: Response,
  options: CookieOptions = {}
): void => {
  revokeCookie(res, COOKIE_NAMES.AUTH_TOKEN, options);
  revokeCookie(res, COOKIE_NAMES.XSRF_TOKEN, options);
  // Refresh token has a different path — override it
  revokeCookie(res, COOKIE_NAMES.REFRESH, { ...options, path: '/v1/auth' });
  revokeCookie(res, COOKIE_NAMES.SESSION_ID, options);
};

/**
 * Production runtime guard — throws if Secure flag would be suppressed in production.
 * Call once at application boot to catch misconfigured COOKIE_SECURE=false deployments.
 *
 * @throws {Error} If NODE_ENV=production and Secure flag is disabled.
 */
export const assertProductionSecure = (): void => {
  if (process.env.NODE_ENV === 'production' && !isSecureContext()) {
    throw new Error(
      '[CookieSecurity] FATAL: Secure cookie flag is DISABLED in a production environment. ' +
      'Set COOKIE_SECURE=true or ensure NODE_ENV is not "production" for non-HTTPS deployments. ' +
      'Emitting non-Secure cookies in production exposes session tokens over plaintext HTTP.'
    );
  }
};
