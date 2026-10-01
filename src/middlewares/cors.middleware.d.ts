/**
 * Type declarations for cors.middleware (Phase 1 — CORS & CSRF Remediation).
 * Consumed by IDEs and TypeScript compilation when requiring the compiled JS.
 */
import type { RequestHandler } from 'express';

/** Structured SecOps event emitted on every rejected cross-origin attempt. */
export interface CorsRejectionEvent {
  event: 'CORS_REJECTED';
  reason: 'NULL_ORIGIN' | 'UNLISTED_ORIGIN' | 'FORBIDDEN_PREFLIGHT';
  rejectedOrigin: string;
  requestIp: string;
  method: string;
  destinationPath: string;
  timestamp: string;
}

export interface CorsMiddlewareOptions {
  /**
   * Additional origin strings merged into the built-in allowlist at boot time.
   * Useful for tenant-specific or env-specific overrides.
   */
  additionalOrigins?: string[] | Set<string>;

  /**
   * Additional anchored regex patterns (MUST be prefixed with ^ and suffixed
   * with $) appended to the built-in pattern list.
   */
  additionalRegexes?: RegExp[];

  /**
   * When `true` (default), requests from unlisted origins receive HTTP 403.
   * Set to `false` only in integration-test pass-through scenarios.
   */
  blockDisallowedWith403?: boolean;

  /**
   * When `true`, suppresses localhost/IP origins even if present in the
   * built-in allowlist. Useful for enforcing production-only policies.
   */
  enforceProductionOriginStrict?: boolean;
}

/**
 * Creates a production-grade hardened CORS middleware engine implementing
 * Phase 1 of the "CORS & CSRF Vulnerability Remediation" specification:
 *
 *   - Dynamic Origin Allowlist Evaluator (Set<string> + anchored RegExp)
 *   - Zero Wildcard Credential Reflection (* + credentials NEVER emitted)
 *   - Strict null-Origin Elimination → HTTP 403
 *   - OPTIONS Preflight Interceptor → HTTP 204 + exact allowed-header surface
 *   - Vary: Origin header to prevent shared-cache CORS poisoning
 *   - Structured SecOps observability logging (Winston) on every rejection
 */
export function createCorsMiddleware(
  options?: CorsMiddlewareOptions,
): RequestHandler;

/** Default authorised origin Set (exact strings, no trailing slashes). */
export const DEFAULT_ALLOWED_ORIGINS: Set<string>;

/** Default anchored regex patterns for sub-domain authorisation. */
export const DEFAULT_ANCHORED_REGEXES: readonly RegExp[];
