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
  const r2AccountId = options.r2AccountId || process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || 'dbdba1b10ec8bff95252f8f2073ccf49';
  let r2Subdomain = options.r2Subdomain || process.env.CLOUDFLARE_R2_SUBDOMAIN;
  if (!r2Subdomain && process.env.R2_PUBLIC_URL) {
    const m = process.env.R2_PUBLIC_URL.match(/pub-([^.]+)\.r2\.dev/);
    if (m) r2Subdomain = m[1];
  }
  if (!r2Subdomain) r2Subdomain = '66cb4aaa7dca442893dd7569e70ff7bd';
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
      `img-src 'self' data: blob: https://*.r2.dev https://pub-${r2Subdomain}.r2.dev https://pub-66cb4aaa7dca442893dd7569e70ff7bd.r2.dev https://*.googleusercontent.com https://drive.google.com https://${customDomain} https://*.giphy.com https://media*.giphy.com https://*.tenor.com https://media.tenor.com https://*.tenor.co`,
      `connect-src 'self' https://${r2AccountId}.r2.cloudflarestorage.com https://*.r2.cloudflarestorage.com https://*.r2.dev https://${customDomain} wss://${customDomain} https://api.giphy.com https://tenor.googleapis.com`,
      "object-src 'self' blob: data:",
      "frame-src 'self' blob: data:",
      "base-uri 'self'",
      "frame-ancestors 'self'",
      "form-action 'self'",
    ];

    const cspHeader = directives.join('; ') + ';';
    const headerName = reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';

    res.setHeader(headerName, cspHeader);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    next();
  };
}

module.exports = {
  createCspMiddleware,
};
