// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResilientLifecycleManager } from '../services/resilientLifecycleManager';
import { OfflineQueueManager, QueuedMutation } from '../services/offlineQueue';
import { SilentAuthInterceptor } from '../services/authInterceptor';

describe('Enterprise ERP Resilient Connectivity & Network Recovery Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  // --------------------------------------------------------------------------
  // 1. ResilientLifecycleManager Tests
  // --------------------------------------------------------------------------
  describe('ResilientLifecycleManager', () => {
    it('calculates bounded exponential backoff with randomized jitter', () => {
      const manager = new ResilientLifecycleManager({
        baseReconnectDelayMs: 1000,
        maxReconnectDelayMs: 16000,
        jitterFactor: 0.25,
      });

      // Attempt 0: Base 1000ms ± 25% -> 750ms to 1250ms (bounded at min 1000)
      const delay0 = manager.calculateBackoffDelay(0);
      expect(delay0).toBeGreaterThanOrEqual(750);
      expect(delay0).toBeLessThanOrEqual(1250);

      // Attempt 3: 1000 * 2^3 = 8000ms ± 25% -> 6000ms to 10000ms
      const delay3 = manager.calculateBackoffDelay(3);
      expect(delay3).toBeGreaterThanOrEqual(6000);
      expect(delay3).toBeLessThanOrEqual(10000);

      // Attempt 10: Cap at 16000ms ± 25% -> 12000ms to 20000ms
      const delay10 = manager.calculateBackoffDelay(10);
      expect(delay10).toBeGreaterThanOrEqual(12000);
      expect(delay10).toBeLessThanOrEqual(20000);
    });

    it('treats HTTP 200, 304, and 401 as proof of backend connectivity', async () => {
      const manager = new ResilientLifecycleManager({ pingEndpoint: '/ping-test' });

      // Mock fetch returning 401 Unauthorized (which proves WAN/LAN connectivity to our API server)
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      } as Response);

      const isOnline = await manager.probeNow('test');
      expect(isOnline).toBe(true);
      expect(manager.getState()).toBe('CONNECTED');
    });

    it('transitions to RECONNECTING and then OFFLINE on consecutive fetch failures', async () => {
      const manager = new ResilientLifecycleManager({ pingEndpoint: '/ping-test' });

      global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

      // First failure -> RECONNECTING
      await manager.probeNow('attempt-1');
      expect(manager.getState()).toBe('RECONNECTING');

      // Second failure -> OFFLINE
      await manager.probeNow('attempt-2');
      expect(manager.getState()).toBe('OFFLINE');
    });
  });

  // --------------------------------------------------------------------------
  // 2. OfflineQueueManager Tests
  // --------------------------------------------------------------------------
  describe('OfflineQueueManager', () => {
    it('enqueues mutations with unique Idempotency-Key and preserves FIFO order', async () => {
      const queue = new OfflineQueueManager();

      const item1 = await queue.enqueue({
        url: '/v1/inventory/deduct',
        method: 'POST',
        actionName: 'LOT_DEDUCT',
        body: { lotId: 'LOT-101', quantity: 50 },
      });

      const item2 = await queue.enqueue({
        url: '/v1/job-cards/update-status',
        method: 'PATCH',
        actionName: 'JOB_STATUS',
        body: { jobCardId: 'JC-900', status: 'STITCHING_COMPLETE' },
      });

      expect(item1.idempotencyKey).toMatch(/^idem_lot_deduct_\d+_[a-f0-9]+$/);
      expect(item2.idempotencyKey).toMatch(/^idem_job_status_\d+_[a-f0-9]+$/);

      const pending = await queue.getPendingMutations();
      expect(pending.length).toBeGreaterThanOrEqual(2);
      expect(pending[0].actionName).toBe('LOT_DEDUCT');
      expect(pending[1].actionName).toBe('JOB_STATUS');
    });

    it('replays queued actions with Idempotency-Key and clears them upon success', async () => {
      const queue = new OfflineQueueManager();

      await queue.enqueue({
        url: '/v1/inventory/adjust',
        method: 'POST',
        actionName: 'STOCK_ADJUST',
        body: { sku: 'COTTON-60', delta: -10 },
      });

      // Mock server accepting the replay with Idempotent-Replayed: true header
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'idempotent-replayed': 'true' }),
      } as Response);

      await queue.replayPendingMutations();

      const remaining = await queue.getPendingCount();
      expect(remaining).toBe(0);
      expect(global.fetch).toHaveBeenCalledWith(
        '/v1/inventory/adjust',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Idempotency-Key': expect.stringMatching(/^idem_stock_adjust_/),
          }),
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // 3. SilentAuthInterceptor Tests
  // --------------------------------------------------------------------------
  describe('SilentAuthInterceptor', () => {
    it('catches 401, triggers single silent refresh, and replays concurrent requests with new token', async () => {
      const interceptor = new SilentAuthInterceptor('/v1/auth/refresh-tokens');

      localStorage.setItem('elite_auth_token', 'expired_access_token');
      localStorage.setItem('elite_refresh_token', 'valid_refresh_token');

      let refreshCallsCount = 0;

      // Mock fetch:
      // - Calls to /v1/auth/refresh-tokens succeed with new tokens
      // - Initial calls to /v1/orders fail with 401 if using 'expired_access_token'
      // - Retried calls to /v1/orders succeed if using 'new_fresh_token'
      global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('/v1/auth/refresh-tokens')) {
          refreshCallsCount++;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              tokens: {
                access: { token: 'new_fresh_token' },
                refresh: { token: 'new_refresh_token' },
              },
            }),
          } as Response;
        }

        const authHeader = (init?.headers as Headers)?.get('Authorization') ||
          (init?.headers as Record<string, string>)?.[`Authorization`];

        if (authHeader === 'Bearer new_fresh_token') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: 'secure_order_data' }),
          } as Response;
        }

        return {
          ok: false,
          status: 401,
          json: async () => ({ message: 'Token expired' }),
        } as Response;
      });

      // Fire 3 concurrent API requests while token is expired
      const [res1, res2, res3] = await Promise.all([
        interceptor.interceptFetch('/v1/orders/1'),
        interceptor.interceptFetch('/v1/orders/2'),
        interceptor.interceptFetch('/v1/orders/3'),
      ]);

      // Verify ONLY ONE refresh call was dispatched (Mutex lock verified!)
      expect(refreshCallsCount).toBe(1);

      // Verify all 3 requests were safely replayed and succeeded
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res3.status).toBe(200);

      // Verify new tokens were committed to storage
      expect(localStorage.getItem('elite_auth_token')).toBe('new_fresh_token');
      expect(localStorage.getItem('elite_refresh_token')).toBe('new_refresh_token');
    });

    it('rejects queue and dispatches elite-session-expired if refresh token is genuinely invalid', async () => {
      const interceptor = new SilentAuthInterceptor('/v1/auth/refresh-tokens');

      const expiredHandler = vi.fn();
      window.addEventListener('elite-session-expired', expiredHandler);

      // Mock refresh failure (e.g. 401 invalid refresh token)
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/v1/auth/refresh-tokens')) {
          return {
            ok: false,
            status: 401,
            text: async () => 'Invalid refresh token',
          } as Response;
        }
        return {
          ok: false,
          status: 401,
        } as Response;
      });

      await expect(interceptor.interceptFetch('/v1/orders/test')).rejects.toThrow();
      expect(expiredHandler).toHaveBeenCalled();
      expect(localStorage.getItem('elite_auth_token')).toBeNull();

      window.removeEventListener('elite-session-expired', expiredHandler);
    });
  });
});
