/**
 * ============================================================================
 * ELITE EDITION ENTERPRISE - WEB PUSH CLIENT & SUBSCRIPTION MANAGER
 * Bridges browser ServiceWorker PushManager with backend push dispatcher.
 * ============================================================================
 */

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface ClientPushSubscriptionJSON {
  endpoint: string;
  expirationTime: number | null;
  keys: PushSubscriptionKeys;
}

/**
 * Converts a URL-safe Base64 VAPID public key to a Uint8Array required by PushManager
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export class WebPushClientManager {
  private currentRoomId: string | null = null;
  private hasInitializedFocusListeners = false;

  /**
   * Checks current Notification permission status
   */
  public getPermissionState(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  /**
   * Checks if ServiceWorker & Push API are supported by the browser
   */
  public isPushSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  /**
   * Detects if the current device is running iOS (iPhone/iPad)
   */
  public isIOS(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
  }

  /**
   * Detects if the web app is running in Standalone PWA mode.
   * On iOS, navigator.standalone is true when opened from the Home Screen icon.
   * On Android / Desktop Chrome, display-mode: standalone matches.
   */
  public isStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    const isStandaloneNav = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;
    return isStandaloneNav || isDisplayStandalone;
  }

  /**
   * Subscribes the workstation browser to system push notifications
   */
  public async subscribeToPush(userId?: string): Promise<{ success: boolean; subscription?: PushSubscription; error?: string; message?: string }> {
    // 1. Strict iOS standalone check
    if (this.isIOS() && !this.isStandalone()) {
      return {
        success: false,
        error: 'IOS_NOT_STANDALONE',
        message: 'On iPhone/iPad, Apple requires installing to the Home Screen first.\n\n1. Tap the Share button (⬆️) in Safari.\n2. Tap "Add to Home Screen".\n3. Open the installed Elite Edition app from your Home Screen to enable notifications.',
      };
    }

    if (!this.isPushSupported()) {
      return { success: false, error: 'UNSUPPORTED', message: 'Web Push is not supported on this browser or platform.' };
    }

    try {
      // 2. Request OS / Browser notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return { success: false, error: 'PERMISSION_DENIED', message: 'Notification permission was dismissed or blocked by the user.' };
      }

      // 2. Await active service worker registration
      const registration = await navigator.serviceWorker.ready;

      // 3. Fetch public VAPID key from backend
      const vapidResponse = await fetch('/v1/notifications/vapid-key');
      if (!vapidResponse.ok) {
        throw new Error(`Failed to retrieve VAPID key: HTTP ${vapidResponse.status}`);
      }
      const { publicKey } = await vapidResponse.json();

      // 4. Convert key to Uint8Array and subscribe with PushManager
      const convertedVapidKey = urlBase64ToUint8Array(publicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // Guarantees all pushes display a user-visible notification
        applicationServerKey: convertedVapidKey as unknown as BufferSource,
      });

      // 5. Send subscription payload to backend database
      const userStr = typeof localStorage !== 'undefined' ? localStorage.getItem('elite_user') : null;
      let effectiveUserId = userId;
      if (!effectiveUserId && userStr) {
        try {
          const userObj = JSON.parse(userStr);
          effectiveUserId = userObj.id || userObj._id;
        } catch (e) {}
      }

      // Extract CSRF token from cookie if available
      let csrfToken = '';
      try {
        const m = document.cookie.match(/(?:^|;\s*)(?:XSRF-TOKEN|xsrf-token)=([^;]*)/);
        if (m) csrfToken = decodeURIComponent(m[1]);
      } catch (e) {}

      const deviceType = this.isIOS() ? 'ios' : (/Android/i.test(navigator.userAgent) ? 'android' : 'desktop');

      const saveResponse = await fetch('/v1/notifications/subscribe', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
          ...(effectiveUserId ? { 'X-User-Id': effectiveUserId } : {}),
        },
        body: JSON.stringify({
          userId: effectiveUserId,
          subscription: subscription.toJSON(),
          deviceFingerprint: `${navigator.platform}_${navigator.vendor}`,
          deviceType,
          userAgent: navigator.userAgent,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to register subscription on ERP server');
      }

      this.initSmartFocusListeners(effectiveUserId);
      return { success: true, subscription };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown push registration failure';
      console.error('[WebPushClient] Registration error:', err);
      return { success: false, error: msg };
    }
  }

  /**
   * Unsubscribes from push notifications
   */
  public async unsubscribePush(): Promise<boolean> {
    if (!this.isPushSupported()) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        // Notify backend to drop subscription record
        await fetch('/v1/notifications/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
      }
      return true;
    } catch (e) {
      console.error('[WebPushClient] Unsubscribe error:', e);
      return false;
    }
  }

  /**
   * Smart Focus & Background State Reporting:
   * Notifies backend which room is currently visible so duplicate OS notifications are suppressed.
   */
  public setActiveRoom(roomId: string | null): void {
    this.currentRoomId = roomId;
    this.beaconFocusState(roomId);
  }

  private initSmartFocusListeners(userId?: string): void {
    if (this.hasInitializedFocusListeners || typeof window === 'undefined') return;
    this.hasInitializedFocusListeners = true;

    // When tab is blurred or hidden, clear active room focus so OS push notifications fire
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.beaconFocusState(null, userId);
      } else if (document.visibilityState === 'visible' && this.currentRoomId) {
        this.beaconFocusState(this.currentRoomId, userId);
      }
    });

    window.addEventListener('blur', () => {
      this.beaconFocusState(null, userId);
    });

    window.addEventListener('focus', () => {
      if (this.currentRoomId) {
        this.beaconFocusState(this.currentRoomId, userId);
      }
    });
  }

  private beaconFocusState(roomId: string | null, userId?: string): void {
    const userStr = typeof localStorage !== 'undefined' ? localStorage.getItem('elite_user') : null;
    let uId = userId;
    if (!uId && userStr) {
      try {
        const userObj = JSON.parse(userStr);
        uId = userObj.id || userObj._id;
      } catch (e) {}
    }

    if (!uId) return;

    fetch('/v1/notifications/focus', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': uId,
      },
      body: JSON.stringify({ roomId }),
      keepalive: true, // Ensures beacon fires even during tab teardown
    }).catch(() => {});
  }
}

export const webPushClient = new WebPushClientManager();

/**
 * Universal helper to subscribe user to push notifications
 */
export async function subscribeUserToPush(userId?: string): Promise<{ success: boolean; subscription?: PushSubscription; error?: string; message?: string }> {
  return webPushClient.subscribeToPush(userId);
}

export default webPushClient;
