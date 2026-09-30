/**
 * ============================================================================
 * ELITE EDITION ENTERPRISE - SILENT SESSION REFRESH INTERCEPTOR
 * Seamlessly refreshes expired JWT tokens without kicking workstation users offline.
 * ============================================================================
 * 
 * Capabilities:
 * 1. Mutex / Promise Lock: Prevents 10 concurrent requests from triggering 10 refresh calls.
 * 2. Transparent Replay: Re-executes paused 401 calls with the newly minted access token.
 * 3. Graceful Fallback: Cleans session and notifies UI only if the refresh token is genuinely invalid.
 */

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

export class SilentAuthInterceptor {
  private isRefreshing = false;
  private failedQueue: QueuedRequest[] = [];
  private refreshEndpoint = '/v1/auth/refresh-tokens';

  constructor(endpoint?: string) {
    if (endpoint) this.refreshEndpoint = endpoint;
  }

  /**
   * Enhanced fetch wrapper that intercepts 401 Unauthorized responses
   */
  public async interceptFetch(url: string, init: RequestInit = {}): Promise<Response> {
    // 1. If currently refreshing tokens, queue this incoming request immediately
    if (this.isRefreshing && !url.includes(this.refreshEndpoint)) {
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
    if (response.status === 401 && !url.includes(this.refreshEndpoint) && !url.includes('/auth/login')) {
      if (!this.isRefreshing) {
        this.isRefreshing = true;

        try {
          const newAccessToken = await this.performSilentRefresh();

          // 3. Replay the original request with the new access token
          const updatedHeaders = new Headers(init.headers || {});
          updatedHeaders.set('Authorization', `Bearer ${newAccessToken}`);
          const retriedInit: RequestInit = { ...init, headers: updatedHeaders };

          // 4. Drain and replay all queued pending requests
          this.drainQueue(null, newAccessToken);
          this.isRefreshing = false;

          return fetch(url, retriedInit);
        } catch (refreshError) {
          this.drainQueue(refreshError, null);
          this.isRefreshing = false;
          this.handleSessionTermination();
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
  private async performSilentRefresh(): Promise<string> {
    const refreshToken = typeof localStorage !== 'undefined'
      ? localStorage.getItem('elite_refresh_token')
      : null;

    const response = await fetch(this.refreshEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Includes HTTP-only cookies if configured
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
  }

  /**
   * Gracefully notifies application that refresh has failed and session must end
   */
  private handleSessionTermination(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('elite_auth_token');
      localStorage.removeItem('elite_refresh_token');
      localStorage.removeItem('elite_user');
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('elite-session-expired', {
          detail: { reason: 'REFRESH_TOKEN_EXPIRED', timestamp: Date.now() },
        })
      );
    }
  }

  public getPendingQueueSize(): number {
    return this.failedQueue.length;
  }

  public isRefreshInProgress(): boolean {
    return this.isRefreshing;
  }
}

export const silentAuth = new SilentAuthInterceptor();
