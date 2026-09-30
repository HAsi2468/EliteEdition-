import { Response, CookieOptions } from 'express';

export type CookieType = 'session' | 'refresh' | 'highPrivilege' | 'custom';

export function getCookieDomain(): string | undefined;

export function isSecureContext(): boolean;

export function getBaseCookieOptions(overrides?: CookieOptions): CookieOptions;

export function getSessionCookieOptions(overrides?: CookieOptions): CookieOptions;

export function getHighPrivilegeCookieOptions(overrides?: CookieOptions): CookieOptions;

export function setSessionCookie(
  res: Response,
  name: string,
  value: string,
  maxAgeOrExpires?: number | Date,
  options?: CookieOptions
): void;

export function setHighPrivilegeCookie(
  res: Response,
  name: string,
  value: string,
  maxAgeOrExpires?: number | Date,
  options?: CookieOptions
): void;

export function clearSecureCookie(
  res: Response,
  name: string,
  options?: CookieOptions
): void;

export function setSecureCookie(
  res: Response,
  name: string,
  value: string,
  options?: CookieOptions
): void;
