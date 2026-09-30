// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  httpClient,
  externalClient,
  csrfManager,
  isMutatingMethod,
} from '../services/httpClient';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

describe('HTTP Transport Security & CSRF Token Interceptor (Phase 2)', () => {
  beforeEach(() => {
    csrfManager.clearToken();
    if (typeof document !== 'undefined') {
      document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      const meta = document.querySelector('meta[name="csrf-token"]');
      if (meta) meta.remove();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isMutatingMethod', () => {
    it('identifies POST, PUT, PATCH, DELETE as mutating', () => {
      expect(isMutatingMethod('POST')).toBe(true);
      expect(isMutatingMethod('post')).toBe(true);
      expect(isMutatingMethod('PUT')).toBe(true);
      expect(isMutatingMethod('PATCH')).toBe(true);
      expect(isMutatingMethod('DELETE')).toBe(true);
    });

    it('identifies GET, HEAD, OPTIONS as non-mutating safe methods', () => {
      expect(isMutatingMethod('GET')).toBe(false);
      expect(isMutatingMethod('get')).toBe(false);
      expect(isMutatingMethod('HEAD')).toBe(false);
      expect(isMutatingMethod('OPTIONS')).toBe(false);
      expect(isMutatingMethod(undefined)).toBe(false);
    });
  });

  describe('Directive 2: Client Separation (httpClient vs externalClient)', () => {
    it('enforces withCredentials: true on first-party httpClient', async () => {
      let capturedConfig: InternalAxiosRequestConfig | null = null;

      httpClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          data: { status: 'ok' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse;
      };

      await httpClient.get('/test-endpoint');
      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig!.withCredentials).toBe(true);
    });

    it('enforces withCredentials: false on externalClient (third-party CDNs, S3, R2 presigned URLs)', async () => {
      let capturedConfig: InternalAxiosRequestConfig | null = null;

      externalClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          data: { uploaded: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse;
      };

      // Even if caller attempts to pass withCredentials: true, interceptor forces it to false
      await externalClient.put('https://r2.cloudflare.com/presigned-upload-key', { data: 'test' }, {
        withCredentials: true as unknown as boolean,
      });

      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig!.withCredentials).toBe(false);
    });

    it('externalClient strips ambient authorization and CSRF headers to prevent ambient token leakage', async () => {
      let capturedConfig: InternalAxiosRequestConfig | null = null;

      externalClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          data: { ok: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse;
      };

      await externalClient.post('https://analytics.thirdparty.com/track', {}, {
        headers: {
          'Authorization': 'Bearer ambient_jwt_secret',
          'X-CSRF-Token': 'sensitive_csrf_token',
          'X-User-Id': 'usr_12345',
        } as any,
      });

      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig!.headers['Authorization']).toBeUndefined();
      expect(capturedConfig!.headers['X-CSRF-Token']).toBeUndefined();
      expect(capturedConfig!.headers['X-User-Id']).toBeUndefined();
    });
  });

  describe('Directive 3: CSRF Token Interception & Re-Sync Handshake', () => {
    it('attaches X-CSRF-Token header on POST and DELETE mutating requests', async () => {
      csrfManager.setToken('anti_csrf_secret_token_123');

      let capturedPostConfig: InternalAxiosRequestConfig | null = null;
      let capturedDeleteConfig: InternalAxiosRequestConfig | null = null;

      httpClient.defaults.adapter = async (config) => {
        if (config.method?.toLowerCase() === 'post') capturedPostConfig = config;
        if (config.method?.toLowerCase() === 'delete') capturedDeleteConfig = config;
        return {
          data: { success: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse;
      };

      await httpClient.post('/api/orders', { qty: 10 });
      expect(capturedPostConfig).not.toBeNull();
      expect(capturedPostConfig!.headers['X-CSRF-Token']).toBe('anti_csrf_secret_token_123');

      await httpClient.delete('/api/orders/99');
      expect(capturedDeleteConfig).not.toBeNull();
      expect(capturedDeleteConfig!.headers['X-CSRF-Token']).toBe('anti_csrf_secret_token_123');
    });

    it('omits X-CSRF-Token header on safe read-only GET requests', async () => {
      csrfManager.setToken('anti_csrf_secret_token_123');

      let capturedGetConfig: InternalAxiosRequestConfig | null = null;

      httpClient.defaults.adapter = async (config) => {
        capturedGetConfig = config;
        return {
          data: { user: 'admin' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse;
      };

      await httpClient.get('/api/orders');
      expect(capturedGetConfig).not.toBeNull();
      expect(capturedGetConfig!.headers['X-CSRF-Token']).toBeUndefined();
    });

    it('reads token from readable cookie (XSRF-TOKEN) when in-memory store is empty', async () => {
      document.cookie = 'XSRF-TOKEN=cookie_token_val_456; path=/';

      let capturedConfig: InternalAxiosRequestConfig | null = null;
      httpClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          data: { saved: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse;
      };

      await httpClient.post('/api/settings', { theme: 'dark' });
      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig!.headers['X-CSRF-Token']).toBe('cookie_token_val_456');
    });

    it('reads token from meta tag when in-memory store and cookie are empty', async () => {
      const meta = document.createElement('meta');
      meta.name = 'csrf-token';
      meta.content = 'meta_tag_token_789';
      document.head.appendChild(meta);

      let capturedConfig: InternalAxiosRequestConfig | null = null;
      httpClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          data: { updated: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse;
      };

      await httpClient.put('/api/profile', { name: 'Admin' });
      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig!.headers['X-CSRF-Token']).toBe('meta_tag_token_789');
    });

    it('re-syncs and replays request once on HTTP 403 CSRF_TOKEN_EXPIRED', async () => {
      csrfManager.setToken('stale_expired_token');

      let attemptCount = 0;
      let handshakeInvoked = false;

      httpClient.defaults.adapter = async (config) => {
        // Intercept the token handshake endpoint
        if (config.url?.includes('/csrf-token')) {
          handshakeInvoked = true;
          return {
            data: { csrfToken: 'new_freshly_minted_token' },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          } as AxiosResponse;
        }

        attemptCount++;
        if (attemptCount === 1) {
          // First attempt fails with 403 CSRF_TOKEN_EXPIRED
          const err = new Error('Request failed with status code 403') as any;
          err.response = {
            status: 403,
            data: { code: 'CSRF_TOKEN_EXPIRED', message: 'CSRF token expired' },
            headers: {},
            config,
          };
          err.config = config;
          throw err;
        }

        // Second (replayed) attempt succeeds
        return {
          data: { replayedSuccessfully: true, tokenUsed: config.headers['X-CSRF-Token'] },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse;
      };

      const response = await httpClient.post('/api/payout', { amount: 5000 });

      expect(handshakeInvoked).toBe(true);
      expect(attemptCount).toBe(2);
      expect(response.data.replayedSuccessfully).toBe(true);
      expect(response.data.tokenUsed).toBe('new_freshly_minted_token');
      expect(csrfManager.getToken()).toBe('new_freshly_minted_token');
    });
  });
});
