/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - ANTI-CSRF TOKEN LIFECYCLE ENGINE (PHASE 3)
 * Implements Double-Submit Cookie pattern with HMAC verification (256-bit CSPRNG).
 * Provides constant-time signature and token comparison to eliminate timing attacks.
 * ============================================================================
 */

const crypto = require('crypto');
const { setCsrfCookie } = require('./cookieSecurity');

/** Default CSRF Token Time-To-Live: 24 Hours in milliseconds */
const DEFAULT_CSRF_TTL_MS = 24 * 60 * 60 * 1000;

class CsrfManager {
  /**
   * @param {string} [secret]
   * @param {number} [ttlMs=86400000]
   */
  constructor(secret, ttlMs = DEFAULT_CSRF_TTL_MS) {
    this.secret =
      secret ||
      process.env.CSRF_SECRET ||
      process.env.JWT_SECRET ||
      'elite_erp_enterprise_csrf_secret_32bytes_min_key';
    this.ttlMs = ttlMs;
  }

  /**
   * Returns current active HMAC server secret.
   * @returns {string}
   */
  getSecret() {
    return this.secret;
  }

  /**
   * Sets the HMAC server secret.
   * @param {string} newSecret
   */
  setSecret(newSecret) {
    this.secret = newSecret;
  }

  /**
   * Generates a cryptographically secure, HMAC-signed anti-CSRF token.
   * Format: <rawTokenHex>.<timestampBase36>.<hmacSignatureHex>
   * - rawToken: 256-bit CSPRNG (32 bytes hex, 64 characters)
   * - timestamp: Creation epoch in ms encoded in base 36
   * - signature: HMAC-SHA256(rawToken.timestamp, secret)
   * @returns {string}
   */
  generateToken() {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now().toString(36);
    const payload = `${rawToken}.${timestamp}`;
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');

    return `${payload}.${signature}`;
  }

  /**
   * Performs constant-time comparison between two strings.
   * Pre-hashes inputs with HMAC-SHA256 to guarantee identical buffer lengths
   * and eliminate length side-channel information disclosure.
   * @param {string} a
   * @param {string} b
   * @returns {boolean}
   */
  safeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') {
      return false;
    }

    const hmacA = crypto.createHmac('sha256', this.secret).update(a).digest();
    const hmacB = crypto.createHmac('sha256', this.secret).update(b).digest();

    return crypto.timingSafeEqual(hmacA, hmacB);
  }

  /**
   * Verifies the cryptographic integrity and expiration of a CSRF token.
   * @param {string} [token]
   * @returns {{ valid: boolean, reason?: string, message?: string }}
   */
  verifyToken(token) {
    if (!token || typeof token !== 'string') {
      return {
        valid: false,
        reason: 'CSRF_TOKEN_MISSING',
        message: 'CSRF token is required for state mutation.',
      };
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return {
        valid: false,
        reason: 'CSRF_TOKEN_INVALID',
        message: 'Invalid or forged CSRF token format.',
      };
    }

    const [rawToken, timestampStr, providedSignature] = parts;

    // Validate rawToken format (64-character hex)
    if (!rawToken || rawToken.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(rawToken)) {
      return {
        valid: false,
        reason: 'CSRF_TOKEN_INVALID',
        message: 'Invalid or forged CSRF token.',
      };
    }

    // Validate signature format (64-character hex)
    if (!providedSignature || providedSignature.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(providedSignature)) {
      return {
        valid: false,
        reason: 'CSRF_TOKEN_INVALID',
        message: 'Invalid or forged CSRF token.',
      };
    }

    // Recompute expected HMAC signature
    const payload = `${rawToken}.${timestampStr}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');

    // Constant-time comparison of HMAC signature
    const isSignatureValid = this.safeCompare(providedSignature, expectedSignature);
    if (!isSignatureValid) {
      return {
        valid: false,
        reason: 'CSRF_TOKEN_INVALID',
        message: 'Invalid or forged CSRF token signature.',
      };
    }

    // Check expiration timestamp
    const timestampMs = parseInt(timestampStr, 36);
    if (isNaN(timestampMs)) {
      return {
        valid: false,
        reason: 'CSRF_TOKEN_INVALID',
        message: 'Invalid CSRF token timestamp format.',
      };
    }

    const age = Date.now() - timestampMs;
    if (age < 0 || age > this.ttlMs) {
      return {
        valid: false,
        reason: 'CSRF_TOKEN_EXPIRED',
        message: 'CSRF token expired. Re-authenticate or refresh.',
      };
    }

    return { valid: true };
  }

  /**
   * Sets the client-readable XSRF-TOKEN cookie on the response.
   * @param {import('express').Response} res
   * @param {string} token
   */
  issueCookie(res, token) {
    setCsrfCookie(res, token);
  }

  /**
   * Express Handshake Endpoint Controller:
   * GET /api/v1/auth/csrf-token
   * Returns new token in JSON and sets the XSRF-TOKEN cookie.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  handshakeHandler = (req, res) => {
    const token = this.generateToken();
    this.issueCookie(res, token);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(200).json({
      success: true,
      csrfToken: token,
      token, // Compatibility alias
    });
  };
}

// Global singleton instance
const csrfManager = new CsrfManager();

module.exports = {
  DEFAULT_CSRF_TTL_MS,
  CsrfManager,
  csrfManager,
};
