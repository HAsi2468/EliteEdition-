/**
 * Type declarations for cookieSecurity (Phase 2 — Cookie Provisioning Utility).
 */
import { Response, CookieOptions } from 'express';

export type CookieType = 'session' | 'refresh' | 'highPrivilege' | 'csrf' | 'custom';

/** Canonical cookie name constants — eliminates magic strings across controllers. */
export declare const COOKIE_NAMES: Readonly<{
  AUTH_TOKEN: 'elite_auth_token';
  REFRESH: 'elite_refresh_token';
  XSRF_TOKEN: 'XSRF-TOKEN';
  SESSION_ID: 'session_id';
}>;

export type KnownCookieName = typeof COOKIE_NAMES[keyof typeof COOKIE_NAMES];

export function getCookieDomain(): string | undefined;
export function isSecureContext(): boolean;
export function getBaseCookieOptions(overrides?: CookieOptions): CookieOptions;
export function getSessionCookieOptions(overrides?: CookieOptions): CookieOptions;
export function getHighPrivilegeCookieOptions(overrides?: CookieOptions): CookieOptions;
export function getCsrfCookieOptions(overrides?: CookieOptions): CookieOptions;

/** Sets a standard session/auth cookie (SameSite=Lax; HttpOnly; Secure). */
export function setSessionCookie(
  res: Response,
  name: string,
  value: string,
  maxAgeOrExpires?: number | Date,
  options?: CookieOptions
): void;

/** Sets a high-privilege mutation cookie (SameSite=Strict; HttpOnly; Secure). */
export function setHighPrivilegeCookie(
  res: Response,
  name: string,
  value: string,
  maxAgeOrExpires?: number | Date,
  options?: CookieOptions
): void;

/** Sets the elite_auth_token cookie. Default maxAge: 24 h. */
export function setAuthTokenCookie(
  res: Response,
  token: string,
  maxAgeMs?: number,
  options?: CookieOptions
): void;

/** Sets the elite_refresh_token cookie scoped to /v1/auth. Default maxAge: 30 d. */
export function setRefreshCookie(
  res: Response,
  token: string,
  maxAgeMs?: number,
  options?: CookieOptions
): void;

/** Sets the client-readable XSRF-TOKEN cookie (HttpOnly=false). */
export function setCsrfCookie(
  res: Response,
  token: string,
  options?: CookieOptions
): void;

/** Sets a generic secure cookie with merged hardened defaults. */
export function setSecureCookie(
  res: Response,
  name: string,
  value: string,
  options?: CookieOptions
): void;

/**
 * Atomically revokes a cookie with identical domain + path scope.
 * Prevents shadow/dangling cookies from scope mismatches.
 */
export function revokeCookie(
  res: Response,
  name: string,
  options?: CookieOptions
): void;

/** Legacy alias for revokeCookie — uses res.clearCookie with hardened defaults. */
export function clearSecureCookie(
  res: Response,
  name: string,
  options?: CookieOptions
): void;

/**
 * Revokes all standard auth cookies (AUTH_TOKEN, REFRESH, XSRF_TOKEN, SESSION_ID)
 * in a single atomic call. Use in logout handlers.
 */
export function revokeAllAuthCookies(
  res: Response,
  options?: CookieOptions
): void;

/**
 * Production runtime guard. Throws if NODE_ENV=production and Secure=false.
 * Call once at application boot.
 * @throws {Error} If Secure flag is disabled in production.
 */
export function assertProductionSecure(): void;
