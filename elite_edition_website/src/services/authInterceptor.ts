/**
 * ============================================================================
 * ELITE EDITION ENTERPRISE - SILENT SESSION REFRESH INTERCEPTOR
 * Seamlessly refreshes expired JWT tokens without kicking workstation users offline.
 * ============================================================================
 * 
 * Capabilities:
 * 1. Mutex / Promise Lock: Prevents 10 concurrent requests from triggering 10 refresh calls.
 * 2. Transparent Replay: Re-executes paused 401 calls with the newly minted access token.
 * 3. Graceful Fallback: Cleans session, flushes memory, and redirects to login if refresh fails.
 * 4. Dual Transport Support: Integrates seamlessly with both Fetch and Axios (httpClient).
 */

import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

export interface TokenRefreshResponse {
  tokens?: {
    access?: { token: string; expires?: string | number };
    refresh?: { token: string; expires?: string | number };
  };
  user?: unknown;
}

interface QueuedRequest {
  resolve: (value: Response | PromiseLike<Response>) => void;
  reject: (reason?: unknown) => void;
  url: string;
  init: RequestInit;
}

interface QueuedAxiosRequest {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}

export class SilentAuthInterceptor {
  private isRefreshing = false;
  private failedQueue: QueuedRequest[] = [];
  private failedAxiosQueue: QueuedAxiosRequest[] = [];
  private refreshEndpoint = '/v1/auth/refresh-tokens';
  private refreshPromise: Promise<string> | null = null;

  constructor(endpoint?: string) {
    if (endpoint) this.refreshEndpoint = endpoint;
  }

  public setEndpoint(endpoint: string): void {
    this.refreshEndpoint = endpoint;
  }

  /**
   * Acquire a fresh access token via mutex.
   * If a refresh is already in progress, waits on the single active refresh promise.
   */
  public async getFreshAccessToken(): Promise<string> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const token = await this.performSilentRefresh();
        this.drainQueue(null, token);
        return token;
      } catch (err) {
        this.drainQueue(err, null);
        this.handleSessionTermination();
        throw err;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Enhanced fetch wrapper that intercepts 401 Unauthorized responses
   */
  public async interceptFetch(url: string, init: RequestInit = {}): Promise<Response> {
    // 1. If currently refreshing tokens, queue this incoming request immediately
    if (this.isRefreshing && !url.includes(this.refreshEndpoint) && !url.includes('/auth/login')) {
      return new Promise<Response>((resolve, reject) => {
        this.failedQueue.push({ resolve, reject, url, init });
      });
    }

    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (networkError) {
      throw networkError;
    }

    // 2. Check for 401 Unauthorized (Expired Access Token)
    if (response.status === 401 && !url.includes(this.refreshEndpoint) && !url.includes('/auth/login') && !url.includes('/auth/register')) {
      if (!this.isRefreshing) {
        try {
          const newAccessToken = await this.getFreshAccessToken();

          // 3. Replay the original request with the new access token
          const updatedHeaders = new Headers(init.headers || {});
          updatedHeaders.set('Authorization', `Bearer ${newAccessToken}`);
          const retriedInit: RequestInit = { ...init, headers: updatedHeaders };

          return fetch(url, retriedInit);
        } catch (refreshError) {
          throw refreshError;
        }
      } else {
        // Another request triggered the refresh; wait for it to complete
        return new Promise<Response>((resolve, reject) => {
          this.failedQueue.push({ resolve, reject, url, init });
        });
      }
    }

    return response;
  }

  /**
   * Executes the silent token refresh call
   */
  public async performSilentRefresh(): Promise<string> {
    const refreshToken = typeof localStorage !== 'undefined'
      ? localStorage.getItem('elite_refresh_token')
      : null;

    const response = await fetch(this.refreshEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Includes HTTP-only cookies
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      throw new Error(`Silent token refresh failed with status ${response.status}`);
    }

    const data: TokenRefreshResponse = await response.json();
    const newAccessToken = data.tokens?.access?.token;

    if (!newAccessToken) {
      throw new Error('Refresh response missing access token');
    }

    // Persist new access token in storage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('elite_auth_token', newAccessToken);
      if (data.tokens?.refresh?.token) {
        localStorage.setItem('elite_refresh_token', data.tokens.refresh.token);
      }
    }

    return newAccessToken;
  }

  /**
   * Replays or rejects all queued requests that were paused during the token refresh
   */
  private drainQueue(error: unknown | null, newAccessToken: string | null): void {
    // 1. Drain fetch queue
    for (const item of this.failedQueue) {
      if (error) {
        item.reject(error);
      } else if (newAccessToken) {
        const updatedHeaders = new Headers(item.init.headers || {});
        updatedHeaders.set('Authorization', `Bearer ${newAccessToken}`);
        const updatedInit: RequestInit = { ...item.init, headers: updatedHeaders };

        fetch(item.url, updatedInit)
          .then((res) => item.resolve(res))
          .catch((err) => item.reject(err));
      }
    }
    this.failedQueue = [];

    // 2. Drain axios queue
    for (const item of this.failedAxiosQueue) {
      if (error) {
        item.reject(error);
      } else if (newAccessToken) {
        item.resolve(newAccessToken);
      }
    }
    this.failedAxiosQueue = [];
  }

  /**
   * Gracefully notifies application that refresh has failed, wipes storage, and ends session
   */
  public handleSessionTermination(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('elite_auth_token');
      localStorage.removeItem('elite_refresh_token');
      localStorage.removeItem('elite_user');
      localStorage.removeItem('elite_is_client');
      localStorage.removeItem('elite_client_data');
      localStorage.removeItem('elite_active_department');
    }

    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.clear();
      } catch {}
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('elite-session-expired', {
          detail: { reason: 'REFRESH_TOKEN_EXPIRED', timestamp: Date.now() },
        })
      );
    }
  }

  /**
   * Attaches response interceptor to an Axios instance for seamless 401 handling
   */
  public attachAxiosInterceptor(client: AxiosInstance): void {
    client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

        if (!originalRequest) {
          return Promise.reject(error);
        }

        const is401 = error.response?.status === 401;
        const isAuthEndpoint = originalRequest.url?.includes('/auth/login') ||
                               originalRequest.url?.includes(this.refreshEndpoint) ||
                               originalRequest.url?.includes('/auth/register');

        if (is401 && !originalRequest._retry && !isAuthEndpoint) {
          originalRequest._retry = true;

          try {
            const freshAccessToken = await this.getFreshAccessToken();
            originalRequest.headers.set('Authorization', `Bearer ${freshAccessToken}`);
            return client(originalRequest);
          } catch (refreshErr) {
            return Promise.reject(refreshErr);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  public getPendingQueueSize(): number {
    return this.failedQueue.length + this.failedAxiosQueue.length;
  }

  public isRefreshInProgress(): boolean {
    return this.isRefreshing;
  }
}

export const silentAuth = new SilentAuthInterceptor();
