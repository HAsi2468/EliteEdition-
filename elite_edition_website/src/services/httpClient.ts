/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - HTTP CLIENT & CSRF ENGINE (PHASE 2)
 * Hardened Axios transport architecture separating first-party from third-party
 * clients, eliminating ambient credential leakage, and enforcing anti-CSRF tokens.
 * ============================================================================
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios';

/** Mutating HTTP methods requiring anti-CSRF token verification */
const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

/** CSRF handshake endpoint — matches the server route in csrf.middleware.ts */
export const CSRF_REFRESH_ENDPOINT = '/api/v1/auth/csrf-token' as const;

/**
 * First-party hostname patterns. Requests to hostnames NOT matching these
 * should go through externalClient, not httpClient.
 */
const FIRST_PARTY_HOSTNAME_PATTERNS: readonly RegExp[] = Object.freeze([
  /^https?:\/\/(?:[a-z0-9-]+\.)*eliteedition\.in(?::\d+)?$/i,
  /^https?:\/\/(?:app|admin|api|portal)\.eliteerp\.com$/i,
  /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i,
  /^\/v?\d*(?:\/|$)/,   // relative paths (dev proxy)
]);

/**
 * Validates that a URL is targeting a first-party host.
 * Non-fatal warning — does not block the request but alerts developers.
 */
function warnIfExternalUrl(url: string): void {
  if (!url || url.startsWith('/')) return; // relative paths are fine
  const isFirstParty = FIRST_PARTY_HOSTNAME_PATTERNS.some((re) => re.test(url));
  if (!isFirstParty) {
    console.warn(
      `[httpClient] WARNING: Request to external URL "${url}" sent via httpClient ` +
      '(withCredentials=true). Use externalClient for third-party endpoints to prevent credential leakage.',
    );
  }
}

export const isMutatingMethod = (method?: string): boolean => {
  if (!method) return false;
  return MUTATING_METHODS.has(method.toLowerCase());
};

export interface ExtendedRequestConfig extends InternalAxiosRequestConfig {
  _csrfRetried?: boolean;
}

/**
 * In-memory and browser-based CSRF token state manager.
 */
class CsrfTokenManager {
  private inMemoryToken: string | null = null;
  private refreshPromise: Promise<string> | null = null;
  private refreshEndpoint: string = CSRF_REFRESH_ENDPOINT;

  /**
   * Returns current in-memory token.
   */
  public getToken(): string | null {
    return this.inMemoryToken;
  }

  /**
   * Sets in-memory token.
   */
  public setToken(token: string | null): void {
    this.inMemoryToken = token;
  }

  /**
   * Clears token from in-memory state.
   */
  public clearToken(): void {
    this.inMemoryToken = null;
  }

  public getRefreshEndpoint(): string {
    return this.refreshEndpoint;
  }

  public setRefreshEndpoint(endpoint: string): void {
    this.refreshEndpoint = endpoint;
  }

  /**
   * Resolves anti-CSRF token from available sources in order of preference:
   * 1. In-memory state
   * 2. Readable non-HttpOnly cookie (XSRF-TOKEN or csrf_token)
   * 3. DOM Meta tag (<meta name="csrf-token" content="...">)
   */
  public readTokenFromSources(): string | null {
    if (this.inMemoryToken) {
      return this.inMemoryToken;
    }

    if (typeof document !== 'undefined') {
      // 2. Cookie lookup (XSRF-TOKEN or csrf_token)
      if (document.cookie) {
        const match = document.cookie.match(/(?:^|;\s*)(?:XSRF-TOKEN|csrf_token)=([^;]+)/);
        if (match && match[1]) {
          try {
            const decoded = decodeURIComponent(match[1]);
            this.inMemoryToken = decoded;
            return decoded;
          } catch {
            return match[1];
          }
        }
      }

      // 3. Meta tag lookup
      const metaTag = document.querySelector('meta[name="csrf-token"]');
      if (metaTag) {
        const content = metaTag.getAttribute('content');
        if (content) {
          this.inMemoryToken = content;
          return content;
        }
      }
    }

    return null;
  }

  /**
   * Performs an anti-CSRF token refresh handshake against the server.
   * Uses GET (matching GET /api/v1/auth/csrf-token server route).
   * Employs mutex promise locking to avoid concurrent refresh storms:
   * if 10 requests arrive simultaneously on a 403, only ONE GET is issued.
   */
  public async refreshToken(clientInstance?: AxiosInstance): Promise<string> {
    // Mutex: if a refresh is already in flight, return the same Promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const client = clientInstance || httpClient;
        const response = await client.get<{ csrfToken?: string; token?: string }>(
          this.refreshEndpoint,
          {
            // Prevent the request interceptor from injecting a token
            // into the handshake request itself (avoids recursive loop)
            headers: { 'X-Skip-CSRF-Injection': 'true' },
          }
        );

        const freshToken =
          response.data?.csrfToken ||
          response.data?.token ||
          (response.headers['x-csrf-token'] as string) ||
          null;

        if (!freshToken) {
          throw new Error('CSRF Handshake failed: Server did not return a valid CSRF token');
        }

        this.inMemoryToken = freshToken;
        return freshToken;
      } finally {
        // Always release the mutex — even on error — so future retries can proceed
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }
}

export const csrfManager = new CsrfTokenManager();

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. FIRST-PARTY API CLIENT (httpClient)
 * Strictly designated for first-party ERP endpoints.
 * Enforces withCredentials: true and injects X-CSRF-Token into mutating requests.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const httpClient: AxiosInstance = axios.create({
  baseURL: (import.meta as Record<string, any>)?.env?.VITE_API_BASE_URL || '/v1',
  withCredentials: true, // STRICTLY for first-party endpoints
  timeout: 30000,
  headers: {
    'Accept': 'application/json',
  },
});

/** Request Interceptor: Attach X-CSRF-Token for mutating methods */
httpClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    // Guarantee withCredentials is always true for first-party client
    config.withCredentials = true;

    // Non-fatal baseURL scope check — warns if URL targets a third-party host
    if (config.url) warnIfExternalUrl(config.url);

    // Mutating requests (POST, PUT, PATCH, DELETE) require X-CSRF-Token
    if (isMutatingMethod(config.method)) {
      const url = config.url || '';
      const skipHeader = config.headers?.['X-Skip-CSRF-Injection'];

      // Avoid injecting token on handshake endpoint or when explicitly skipped
      if (!url.includes('/csrf-token') && !skipHeader) {
        const token = csrfManager.readTokenFromSources();
        if (token) {
          config.headers.set('X-CSRF-Token', token);
        } else {
          // Token not found — warn in development so the issue is visible
          // The request still goes through; the server CSRF middleware will
          // reject it with 403 if it genuinely requires a token.
          if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
            console.warn(
              `[httpClient] No CSRF token available for ${config.method?.toUpperCase()} ${url}. ` +
              'Ensure the CSRF handshake (GET /api/v1/auth/csrf-token) has been called at app startup.',
            );
          }
        }
      }
    }

    // Strip the internal marker before wire transmission
    if (config.headers?.['X-Skip-CSRF-Injection']) {
      delete config.headers['X-Skip-CSRF-Injection'];
    }

    return config;
  },
  (error: unknown) => Promise.reject(error)
);

/** Response Interceptor: Handle CSRF_TOKEN_EXPIRED / CSRF_TOKEN_INVALID re-sync */
httpClient.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,
  async (error: AxiosError): Promise<AxiosResponse> => {
    const originalRequest = error.config as ExtendedRequestConfig | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const data = error.response?.data as { code?: string; error?: string; message?: string } | undefined;
    const errorCode = data?.code || data?.error;

    const isCsrfError =
      status === 403 &&
      (errorCode === 'CSRF_TOKEN_EXPIRED' ||
        errorCode === 'CSRF_TOKEN_INVALID' ||
        (typeof data?.message === 'string' && data.message.toLowerCase().includes('csrf')));

    // If CSRF error and request has not yet been retried, refresh token and replay once
    if (isCsrfError && !originalRequest._csrfRetried) {
      originalRequest._csrfRetried = true;

      try {
        const freshToken = await csrfManager.refreshToken(httpClient);
        originalRequest.headers.set('X-CSRF-Token', freshToken);
        return httpClient(originalRequest);
      } catch (refreshErr) {
        csrfManager.clearToken();
        return Promise.reject(refreshErr);
      }
    }

    // Handle 401 Unauthorized via SilentAuthInterceptor queue and replay
    const is401 = status === 401;
    const isAuthRoute =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/register');

    if (is401 && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true;
      try {
        const { silentAuth } = await import('./authInterceptor');
        const freshAccessToken = await silentAuth.getFreshAccessToken();
        originalRequest.headers.set('Authorization', `Bearer ${freshAccessToken}`);
        return httpClient(originalRequest);
      } catch (refreshErr) {
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 2. STRIPPED EXTERNAL CLIENT (externalClient)
 * Designated for third-party endpoints, external CDNs, analytics providers,
 * and Cloudflare R2 / AWS S3 presigned upload URLs.
 * Strictly guarantees withCredentials: false and strips all ambient auth/CSRF tokens.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const externalClient: AxiosInstance = axios.create({
  withCredentials: false, // Strictly stripped for third-party endpoints
  timeout: 60000,
});

/** Request Interceptor: Strict isolation against credential and token leakage */
externalClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    // Explicitly enforce withCredentials: false
    config.withCredentials = false;

    // Purge ambient sensitive headers if accidentally attached
    if (config.headers) {
      delete config.headers['Authorization'];
      delete config.headers['X-CSRF-Token'];
      delete config.headers['X-User-Id'];
      delete config.headers['X-User-Role'];
      delete config.headers['X-Company-Id'];
    }

    return config;
  },
  (error: unknown) => Promise.reject(error)
);
