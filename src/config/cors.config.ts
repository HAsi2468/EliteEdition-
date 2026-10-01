/**
 * ============================================================================
 * ELITE ERP ENTERPRISE — CORS SECURITY CONFIGURATION (Phase 1)
 * Technical Specification: "CORS & CSRF Vulnerability Remediation"
 *
 * Single source of truth for all CORS policy constants.
 * Consumed by cors.middleware.ts and the automated verification suite.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Canonical allowed-method string – passed verbatim into the response header
// ---------------------------------------------------------------------------
export const CORS_ALLOWED_METHODS =
  'GET, POST, PUT, PATCH, DELETE, OPTIONS' as const;

// ---------------------------------------------------------------------------
// Canonical allowed-header string – only exactly these headers are surfaced
// ---------------------------------------------------------------------------
export const CORS_ALLOWED_HEADERS =
  'Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-User-Id' as const;

// ---------------------------------------------------------------------------
// Preflight cache duration: 86 400 s = 24 hours
// Minimises round-trips without sacrificing flexibility.
// ---------------------------------------------------------------------------
export const CORS_MAX_AGE = '86400' as const;

// ---------------------------------------------------------------------------
// Exposed response headers available to browser JS (minimal surface)
// ---------------------------------------------------------------------------
export const CORS_EXPOSE_HEADERS =
  'Content-Length, X-Request-Id' as const;

// ---------------------------------------------------------------------------
// Explicit allowlist — Set<string> for O(1) exact-match lookup.
// CRITICAL: Always include the protocol. No trailing slashes.
// ---------------------------------------------------------------------------
export const CORS_ORIGIN_ALLOWLIST: Set<string> = new Set<string>([
  // Production Elite ERP origins
  'https://erp.eliteedition.in',
  'http://erp.eliteedition.in',
  'https://eliteedition.in',
  'http://eliteedition.in',
  'https://www.eliteedition.in',
  'http://www.eliteedition.in',
  // Public ERP SaaS origins
  'https://app.eliteerp.com',
  'https://admin.eliteerp.com',
  'https://portal.eliteerp.com',
  // Local development & CI
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  // EC2 / direct server (dev only — guarded by NODE_ENV in middleware)
  'http://3.7.174.180',
  'https://3.7.174.180',
]);

// ---------------------------------------------------------------------------
// Anchored regex patterns for dynamic sub-domain validation.
//
// SECURITY RULES:
//   ① Every pattern MUST start with ^ and end with $.
//   ② Literal dots MUST be escaped as \. to prevent substring matches.
//   ③ No un-escaped wildcards (.* / .+) that could match attacker domains.
//
// Attack vectors explicitly blocked:
//   - https://fakeeliteedition.in          → blocked (prefix injection)
//   - https://eliteedition.in.attacker.com → blocked (suffix injection)
//   - https://app.eliteerp.com.evil.com    → blocked (subdomain append)
// ---------------------------------------------------------------------------
export const CORS_ORIGIN_REGEXES: readonly RegExp[] = Object.freeze([
  // All legitimate subdomains of eliteedition.in (http or https, optional port)
  /^https?:\/\/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*eliteedition\.in(?::\d{1,5})?$/i,

  // Explicit eliteerp.com subdomain allowlist (app | admin | portal) — HTTPS only
  /^https:\/\/(?:app|admin|portal)\.eliteerp\.com$/,

  // Local development: localhost and 127.0.0.1 with any port (http only)
  /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/,

  // Server IP — development only; enforced in middleware via NODE_ENV check
  /^https?:\/\/3\.7\.174\.180(?::\d{1,5})?$/,
]);

// ---------------------------------------------------------------------------
// Origins that MUST always be blocked regardless of configuration overrides.
// Use this set to catch dangerous edge-cases before the allowlist check.
// ---------------------------------------------------------------------------
export const CORS_HARDCODED_DENY_KEYWORDS: readonly string[] = Object.freeze([
  'null',       // RFC 6454 opaque origin — sandboxed iframes, file://, data: URIs
  'undefined',  // Defensive: broken/missing origin from some malformed clients
]);

// ---------------------------------------------------------------------------
// Whether unrecognised cross-origin requests should receive HTTP 403.
// Set to false only in testing environments where you want passthrough.
// ---------------------------------------------------------------------------
export const CORS_BLOCK_DISALLOWED_WITH_403 = true as const;

// ---------------------------------------------------------------------------
// Merge any additional origins declared in the CORS_ALLOWED_ORIGINS env var.
// Format: comma-separated strings, e.g. "https://a.com,https://b.com"
// ---------------------------------------------------------------------------
export function buildAllowlistFromEnv(base: Set<string>): Set<string> {
  const merged = new Set<string>(base);
  const envOrigins = process.env.CORS_ALLOWED_ORIGINS ?? '';
  if (envOrigins.trim()) {
    for (const raw of envOrigins.split(',')) {
      const trimmed = raw.trim();
      if (trimmed) merged.add(trimmed);
    }
  }
  return merged;
}
