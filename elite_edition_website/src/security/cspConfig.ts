/**
 * ============================================================================
 * ELITE EDITION ENTERPRISE - CONTENT SECURITY POLICY (CSP) ARCHITECTURE
 * Production-grade defense against Cross-Site Scripting (XSS), Data Injection,
 * Clickjacking, and C2 Server Exfiltration.
 * ============================================================================
 */

export interface CspOptions {
  /**
   * Cryptographic nonce per request. Required for strict inline script execution.
   */
  nonce?: string;
  /**
   * Cloudflare R2 Account ID for S3-compatible asset upload API.
   * e.g. "a1b2c3d4e5f67890" -> https://a1b2c3d4e5f67890.r2.cloudflarestorage.com
   */
  r2AccountId?: string;
  /**
   * Cloudflare R2 public bucket hash / subdomain.
   * e.g. "9a8b7c6d5e" -> https://pub-9a8b7c6d5e.r2.dev
   */
  r2Subdomain?: string;
  /**
   * Enterprise custom production domain.
   * Default: "erp.eliteedition.in"
   */
  customDomain?: string;
  /**
   * Additional trusted connect-src endpoints (e.g. API backend or WebSocket endpoints).
   */
  additionalConnectSrc?: string[];
  /**
   * Additional trusted img-src endpoints.
   */
  additionalImgSrc?: string[];
  /**
   * Reporting endpoint for CSP violations.
   */
  reportUri?: string;
  /**
   * If true, sends Content-Security-Policy-Report-Only instead of blocking.
   */
  reportOnly?: boolean;
}

export const DEFAULT_CSP_CONFIG: Required<Omit<CspOptions, 'nonce' | 'reportUri'>> = {
  r2AccountId: '<ACCOUNT_ID>',
  r2Subdomain: '<R2_SUBDOMAIN>',
  customDomain: 'erp.eliteedition.in',
  additionalConnectSrc: ['https://erp.eliteedition.in', 'wss://erp.eliteedition.in'],
  additionalImgSrc: ['https://erp.eliteedition.in'],
  reportOnly: false,
};

/**
 * Builds structured CSP directives dictionary based on strict enterprise specification.
 */
export function buildCspDirectives(options: CspOptions = {}): Record<string, string[]> {
  const accountId = options.r2AccountId || DEFAULT_CSP_CONFIG.r2AccountId;
  const r2Sub = options.r2Subdomain || DEFAULT_CSP_CONFIG.r2Subdomain;
  const domain = options.customDomain || DEFAULT_CSP_CONFIG.customDomain;

  // 1. Script-src: Strictly 'self' + nonce. Disallows 'unsafe-inline' and 'unsafe-eval'.
  const scriptSrc = ["'self'"];
  if (options.nonce) {
    scriptSrc.push(`'nonce-${options.nonce}'`);
  }

  // 2. Connect-src: 'self' + Cloudflare R2 upload bucket + verified API/WS endpoints
  const connectSrc = [
    "'self'",
    `https://${accountId}.r2.cloudflarestorage.com`,
  ];
  if (domain && !connectSrc.includes(`https://${domain}`)) {
    connectSrc.push(`https://${domain}`);
  }
  if (options.additionalConnectSrc) {
    for (const src of options.additionalConnectSrc) {
      if (!connectSrc.includes(src)) connectSrc.push(src);
    }
  }

  // 3. Img-src: 'self' + data: + Cloudflare R2 public delivery + custom domain
  const imgSrc = [
    "'self'",
    'data:',
    `https://pub-${r2Sub}.r2.dev`,
  ];
  if (domain && !imgSrc.includes(`https://${domain}`)) {
    imgSrc.push(`https://${domain}`);
  }
  if (options.additionalImgSrc) {
    for (const src of options.additionalImgSrc) {
      if (!imgSrc.includes(src)) imgSrc.push(src);
    }
  }

  // 4. Style-src: 'self' + 'unsafe-inline' (for styled CSS tokens / dynamic theme styles)
  const styleSrc = ["'self'", "'unsafe-inline'"];

  // 5. Font-src: 'self' + data: (preloaded local woff2 fonts)
  const fontSrc = ["'self'", 'data:'];

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': scriptSrc,
    'style-src': styleSrc,
    'img-src': imgSrc,
    'font-src': fontSrc,
    'connect-src': connectSrc,
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
  };

  if (options.reportUri) {
    directives['report-uri'] = [options.reportUri];
  }

  return directives;
}

/**
 * Serializes directives dictionary into standard CSP header string.
 */
export function formatCspHeader(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')};`)
    .join(' ');
}

/**
 * Returns formatted CSP header string for current options.
 */
export function generateCspHeader(options: CspOptions = {}): string {
  const directives = buildCspDirectives(options);
  return formatCspHeader(directives);
}

/**
 * Generates Next.js custom headers array for next.config.js / middleware.ts.
 */
export function getNextSecurityHeaders(options: CspOptions = {}) {
  const headerName = options.reportOnly
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';

  return [
    {
      key: headerName,
      value: generateCspHeader(options),
    },
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'X-Frame-Options',
      value: 'DENY',
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
    },
    {
      key: 'Permissions-Policy',
      value: 'camera=(self), microphone=(), geolocation=(), payment=()',
    },
  ];
}

/**
 * Generates production-ready Nginx configuration block for EC2 reverse proxy.
 */
export function generateNginxCspConfig(options: CspOptions = {}): string {
  const csp = generateCspHeader(options);
  const headerDirective = options.reportOnly
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';

  return `# ==============================================================================
# ELITE EDITION ENTERPRISE - NGINX EC2 SECURITY HEADERS (Phase 1)
# ==============================================================================
add_header ${headerDirective} "${csp}" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(self), microphone=(), geolocation=(), payment=()" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
`;
}
