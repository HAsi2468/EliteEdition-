/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - COOKIE SECURITY UTILITY (PHASE 2)
 * Standardized, hardened cookie provisioning enforcing modern security attributes.
 * Prevents ambient session hijacking, CSRF, and scope-mismatched dangling cookies.
 * ============================================================================
 */

/**
 * Resolves the cookie domain scope.
 * In production: Enforces '.eliteerp.com' or explicit COOKIE_DOMAIN.
 * In local/test environments: Omitted to allow host-only localhost/127.0.0.1 cookies.
 * @returns {string | undefined}
 */
const getCookieDomain = () => {
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
 * @returns {boolean}
 */
const isSecureContext = () => {
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE === 'true';
  }
  return process.env.NODE_ENV === 'production';
};

/**
 * Builds base cookie options with hardened defaults.
 * @param {import('express').CookieOptions} [overrides={}]
 * @returns {import('express').CookieOptions}
 */
const getBaseCookieOptions = (overrides = {}) => {
  const options = {
    httpOnly: true,
    secure: isSecureContext(),
    sameSite: 'lax',
    path: '/',
    ...overrides,
  };

  // Only assign domain if resolved (avoid undefined property on options object)
  const domain = overrides.domain !== undefined ? overrides.domain : getCookieDomain();
  if (domain) {
    options.domain = domain;
  }

  return options;
};

/**
 * Options for standard session and refresh cookies.
 * Enforces: HttpOnly; Secure; SameSite=Lax; Path=/; Domain=.eliteerp.com
 * @param {import('express').CookieOptions} [overrides={}]
 * @returns {import('express').CookieOptions}
 */
const getSessionCookieOptions = (overrides = {}) => {
  return getBaseCookieOptions({
    sameSite: 'lax',
    ...overrides,
  });
};

/**
 * Options for high-privilege administrative / financial mutation cookies.
 * Enforces: HttpOnly; Secure; SameSite=Strict; Path=/; Domain=.eliteerp.com
 * @param {import('express').CookieOptions} [overrides={}]
 * @returns {import('express').CookieOptions}
 */
const getHighPrivilegeCookieOptions = (overrides = {}) => {
  return getBaseCookieOptions({
    sameSite: 'strict',
    ...overrides,
  });
};

/**
 * Sets a standard session or refresh token cookie.
 * 
 * @param {import('express').Response} res
 * @param {string} name
 * @param {string} value
 * @param {number | Date} [maxAgeOrExpires]
 * @param {import('express').CookieOptions} [options={}]
 */
const setSessionCookie = (res, name, value, maxAgeOrExpires, options = {}) => {
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
 * 
 * @param {import('express').Response} res
 * @param {string} name
 * @param {string} value
 * @param {number | Date} [maxAgeOrExpires]
 * @param {import('express').CookieOptions} [options={}]
 */
const setHighPrivilegeCookie = (res, name, value, maxAgeOrExpires, options = {}) => {
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
 * 
 * @param {import('express').Response} res
 * @param {string} name
 * @param {import('express').CookieOptions} [options={}]
 */
const clearSecureCookie = (res, name, options = {}) => {
  const clearOpts = getBaseCookieOptions({
    ...options,
  });

  // Remove maxAge and expires for deletion
  delete clearOpts.maxAge;
  delete clearOpts.expires;

  res.clearCookie(name, clearOpts);
};

/**
 * General helper to set a secure cookie with custom options merged on secure defaults.
 * 
 * @param {import('express').Response} res
 * @param {string} name
 * @param {string} value
 * @param {import('express').CookieOptions} [options={}]
 */
const setSecureCookie = (res, name, value, options = {}) => {
  const cookieOpts = getBaseCookieOptions(options);
  res.cookie(name, value, cookieOpts);
};

module.exports = {
  getCookieDomain,
  isSecureContext,
  getBaseCookieOptions,
  getSessionCookieOptions,
  getHighPrivilegeCookieOptions,
  setSessionCookie,
  setHighPrivilegeCookie,
  clearSecureCookie,
  setSecureCookie,
};
