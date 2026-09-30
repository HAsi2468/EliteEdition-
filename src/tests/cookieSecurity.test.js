const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  getCookieDomain,
  isSecureContext,
  getBaseCookieOptions,
  getSessionCookieOptions,
  getHighPrivilegeCookieOptions,
  setSessionCookie,
  setHighPrivilegeCookie,
  clearSecureCookie,
  setSecureCookie,
} = require('../utils/cookieSecurity');

describe('Cookie Security & Specification Phase 2 Engine', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.COOKIE_DOMAIN;
    delete process.env.COOKIE_SECURE;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('SEC-COOKIE-01: Session / Refresh cookies enforce HttpOnly, SameSite=Lax, Path=/ and .eliteedition.in in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.COOKIE_DOMAIN;

    const opts = getSessionCookieOptions();
    assert.equal(opts.httpOnly, true);
    assert.equal(opts.secure, true);
    assert.equal(opts.sameSite, 'lax');
    assert.equal(opts.path, '/');
    assert.equal(opts.domain, '.eliteedition.in');
  });

  it('SEC-COOKIE-02: High-privilege cookies enforce SameSite=Strict and Secure in production', () => {
    process.env.NODE_ENV = 'production';

    const opts = getHighPrivilegeCookieOptions();
    assert.equal(opts.httpOnly, true);
    assert.equal(opts.secure, true);
    assert.equal(opts.sameSite, 'strict');
    assert.equal(opts.path, '/');
    assert.equal(opts.domain, '.eliteedition.in');
  });

  it('SEC-COOKIE-03: Respects custom COOKIE_DOMAIN and COOKIE_SECURE flags', () => {
    process.env.COOKIE_DOMAIN = '.custom-erp.com';
    process.env.COOKIE_SECURE = 'true';

    const opts = getSessionCookieOptions();
    assert.equal(opts.domain, '.custom-erp.com');
    assert.equal(opts.secure, true);
  });

  it('SEC-COOKIE-04: setSessionCookie calls res.cookie with standardized options and expiration', () => {
    process.env.NODE_ENV = 'production';

    let capturedName = '';
    let capturedVal = '';
    let capturedOpts = null;

    const mockRes = {
      cookie: (name, val, opts) => {
        capturedName = name;
        capturedVal = val;
        capturedOpts = opts;
      },
    };

    const expDate = new Date(Date.now() + 86400000);
    setSessionCookie(mockRes, 'session_id', 'sess_abc123', expDate);

    assert.equal(capturedName, 'session_id');
    assert.equal(capturedVal, 'sess_abc123');
    assert.equal(capturedOpts.httpOnly, true);
    assert.equal(capturedOpts.secure, true);
    assert.equal(capturedOpts.sameSite, 'lax');
    assert.equal(capturedOpts.path, '/');
    assert.equal(capturedOpts.domain, '.eliteedition.in');
    assert.equal(capturedOpts.expires.getTime(), expDate.getTime());
  });

  it('SEC-COOKIE-05: setHighPrivilegeCookie sets SameSite=Strict on mutation action cookies', () => {
    process.env.NODE_ENV = 'production';

    let capturedOpts = null;
    const mockRes = {
      cookie: (_name, _val, opts) => {
        capturedOpts = opts;
      },
    };

    setHighPrivilegeCookie(mockRes, 'payout_token', 'high_priv_token', 3600000);

    assert.equal(capturedOpts.sameSite, 'strict');
    assert.equal(capturedOpts.httpOnly, true);
    assert.equal(capturedOpts.secure, true);
    assert.equal(capturedOpts.maxAge, 3600000);
    assert.equal(capturedOpts.domain, '.eliteedition.in');
    assert.equal(capturedOpts.path, '/');
  });

  it('SEC-COOKIE-06: clearSecureCookie guarantees identical path and domain scopes to prevent shadow cookies', () => {
    process.env.NODE_ENV = 'production';

    let clearedName = '';
    let clearedOpts = null;

    const mockRes = {
      clearCookie: (name, opts) => {
        clearedName = name;
        clearedOpts = opts;
      },
    };

    clearSecureCookie(mockRes, 'session_id');

    assert.equal(clearedName, 'session_id');
    assert.equal(clearedOpts.path, '/');
    assert.equal(clearedOpts.domain, '.eliteedition.in');
    assert.equal(clearedOpts.httpOnly, true);
    assert.equal(clearedOpts.secure, true);
    assert.equal(clearedOpts.sameSite, 'lax');
    assert.equal(clearedOpts.maxAge, undefined);
    assert.equal(clearedOpts.expires, undefined);
  });
});
