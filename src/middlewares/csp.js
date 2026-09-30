const crypto = require('crypto');

/**
 * Enterprise Content Security Policy (CSP) Middleware for Express
 * Enforces Phase 1 Security Specification:
 * - default-src 'self'
 * - script-src 'self' 'nonce-{random}' (disallow 'unsafe-inline' and 'unsafe-eval')
 * - connect-src 'self' https://<ACCOUNT_ID>.r2.cloudflarestorage.com
 * - img-src 'self' data: https://pub-<R2_SUBDOMAIN>.r2.dev https://<CUSTOM_DOMAIN>
 * - object-src 'none'; base-uri 'self'; frame-ancestors 'none'
 */
function createCspMiddleware(options = {}) {
  const r2AccountId = options.r2AccountId || process.env.CLOUDFLARE_R2_ACCOUNT_ID || '<ACCOUNT_ID>';
  const r2Subdomain = options.r2Subdomain || process.env.CLOUDFLARE_R2_SUBDOMAIN || '<R2_SUBDOMAIN>';
  const customDomain = options.customDomain || 'erp.eliteedition.in';
  const reportOnly = !!options.reportOnly;

  return function cspMiddleware(req, res, next) {
    // Generate cryptographically secure random nonce for each request
    const nonce = crypto.randomBytes(16).toString('base64');
    res.locals.cspNonce = nonce;

    const directives = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      `img-src 'self' data: https://pub-${r2Subdomain}.r2.dev https://${customDomain}`,
      `connect-src 'self' https://${r2AccountId}.r2.cloudflarestorage.com https://${customDomain} wss://${customDomain}`,
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ];

    const cspHeader = directives.join('; ') + ';';
    const headerName = reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';

    res.setHeader(headerName, cspHeader);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');

    next();
  };
}

module.exports = {
  createCspMiddleware,
};
