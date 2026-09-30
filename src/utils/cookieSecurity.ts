/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - COOKIE SECURITY UTILITY (PHASE 2)
 * Standardized, hardened cookie provisioning enforcing modern security attributes.
 * Prevents ambient session hijacking, CSRF, and scope-mismatched dangling cookies.
 * ============================================================================
 */

import type { Response, CookieOptions } from 'express';

export type CookieType = 'session' | 'refresh' | 'highPrivilege' | 'custom';

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
 * Sets the standard client-readable XSRF-TOKEN cookie for client-side SPA hydration.
 */
export const setCsrfCookie = (
  res: Response,
  token: string,
  options: CookieOptions = {}
): void => {
  const cookieOpts = getCsrfCookieOptions(options);
  res.cookie('XSRF-TOKEN', token, cookieOpts);
};

