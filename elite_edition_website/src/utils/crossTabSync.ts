/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - CROSS-TAB SYNCHRONIZATION BUS
 * Powered by BroadcastChannel API with graceful localStorage fallback.
 * Ensures instant synchronization of authentication, session termination,
 * company switches, and operational state across all open browser tabs.
 * ============================================================================
 */

export type SyncEventType =
  | 'AUTH_LOGOUT'
  | 'AUTH_LOGIN'
  | 'COMPANY_SWITCH'
  | 'DATA_INVALIDATED'
  | 'THEME_CHANGED';

export interface SyncMessage {
  type: SyncEventType;
  payload?: any;
  timestamp: number;
  tabId: string;
}

const CHANNEL_NAME = 'elite_erp_cross_tab_bus';
const currentTabId = typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

type MessageHandler = (msg: SyncMessage) => void;
const subscribers = new Set<MessageHandler>();

let channel: BroadcastChannel | null = null;

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      const msg = event.data;
      if (msg && msg.tabId !== currentTabId) {
        notifySubscribers(msg);
      }
    };
  } catch (err) {
    console.warn('[CrossTabSync] BroadcastChannel init failed, falling back to storage events:', err);
    channel = null;
  }
}

// Fallback to storage event for older browsers or if BroadcastChannel is restricted
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === `__${CHANNEL_NAME}__` && event.newValue) {
      try {
        const msg: SyncMessage = JSON.parse(event.newValue);
        if (msg && msg.tabId !== currentTabId) {
          notifySubscribers(msg);
        }
      } catch (_) {}
    }
  });
}

function notifySubscribers(msg: SyncMessage) {
  subscribers.forEach((handler) => {
    try {
      handler(msg);
    } catch (err) {
      console.error('[CrossTabSync] Subscriber error:', err);
    }
  });
}

/**
 * Broadcast an event to all other open tabs.
 */
export function broadcastCrossTab(type: SyncEventType, payload?: any): void {
  const msg: SyncMessage = {
    type,
    payload,
    timestamp: Date.now(),
    tabId: currentTabId,
  };

  if (channel) {
    try {
      channel.postMessage(msg);
      return;
    } catch (err) {
      console.warn('[CrossTabSync] postMessage failed:', err);
    }
  }

  // Fallback via localStorage update
  try {
    localStorage.setItem(`__${CHANNEL_NAME}__`, JSON.stringify(msg));
  } catch (_) {}
}

/**
 * Subscribe to cross-tab synchronization events.
 */
export function subscribeCrossTab(handler: MessageHandler): () => void {
  subscribers.add(handler);
  return () => {
    subscribers.delete(handler);
  };
}

/**
 * Initialize automated cross-tab lifecycle hooks (e.g. instant multi-tab logout).
 */
export function initCrossTabSync(): void {
  if (typeof window === 'undefined') return;

  subscribeCrossTab((msg) => {
    switch (msg.type) {
      case 'AUTH_LOGOUT': {
        console.warn('[CrossTabSync] Received logout signal from another tab. Terminating local session.');
        try {
          localStorage.removeItem('elite_auth_token');
          localStorage.removeItem('elite_user');
          sessionStorage.clear();
        } catch (_) {}
        // Dispatch local event for App / auth context to re-render login screen
        window.dispatchEvent(new CustomEvent('elite-session-expired', { detail: { reason: 'cross-tab-logout' } }));
        break;
      }
      case 'COMPANY_SWITCH': {
        console.info('[CrossTabSync] Company switch broadcast received:', msg.payload);
        window.dispatchEvent(new CustomEvent('elite-department-changed', { detail: msg.payload }));
        break;
      }
      case 'DATA_INVALIDATED': {
        window.dispatchEvent(new CustomEvent('elite-data-refresh', { detail: msg.payload }));
        break;
      }
      default:
        break;
    }
  });
}
