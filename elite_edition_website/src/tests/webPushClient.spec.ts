// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { urlBase64ToUint8Array, WebPushClientManager } from '../services/webPushClient';

describe('Web Push Notification Client Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('correctly converts Base64 URL-safe VAPID key to Uint8Array', () => {
    const sampleVapidKey = 'BM4d22guTlUHVhOgcRjaBjQv24k_dRivLGlAz79cN3AlWAge3nwE9lB0PFer6qjFzNZely7Rsm9a5pxxWkMfiiQ';
    const uint8Array = urlBase64ToUint8Array(sampleVapidKey);

    expect(uint8Array).toBeInstanceOf(Uint8Array);
    expect(uint8Array.length).toBe(65); // Standard P-256 public key uncompressed length
  });

  it('checks push support in browser environment', () => {
    const manager = new WebPushClientManager();
    // In jsdom without ServiceWorker mock, it should report false gracefully
    const supported = manager.isPushSupported();
    expect(typeof supported).toBe('boolean');
  });

  it('beacons active room focus to /v1/notifications/focus', () => {
    const manager = new WebPushClientManager();
    localStorage.setItem('elite_user', JSON.stringify({ id: 'user_123' }));

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    manager.setActiveRoom('room_fabric_dept');

    expect(global.fetch).toHaveBeenCalledWith(
      '/v1/notifications/focus',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-User-Id': 'user_123',
        }),
        body: JSON.stringify({ roomId: 'room_fabric_dept' }),
      })
    );
  });
});
