import { RequestHandler } from 'express';

export interface CorsOptions {
  /**
   * Explicit list of authorized origin strings (e.g. ['https://app.eliteerp.com'])
   */
  allowedOrigins?: Set<string> | string[];

  /**
   * Anchored regular expression patterns for dynamic authorized origin matching
   */
  allowedRegexes?: RegExp[];

  /**
   * Whether to reject unauthorized cross-origin requests immediately with HTTP 403.
   * Default: true
   */
  blockDisallowedWith403?: boolean;
}

/**
 * Creates and configures the hardened CORS middleware engine.
 */
export function createCorsMiddleware(options?: CorsOptions): RequestHandler;

/**
 * Default authorized origin Set.
 */
export const DEFAULT_ALLOWED_ORIGINS: Set<string>;

/**
 * Default anchored regex patterns for subdomains.
 */
export const DEFAULT_ANCHORED_REGEXES: RegExp[];
