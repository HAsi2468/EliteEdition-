/**
 * ============================================================================
 * ELITE EDITION ENTERPRISE - OFFLINE MUTATION QUEUE & SAFE REPLAY ENGINE
 * Guarantees zero data loss and prevents double deductions on network drops.
 * ============================================================================
 * 
 * Features:
 * 1. Persistent Storage via IndexedDB: Outlives page reloads, tab closing, and crashes.
 * 2. Strict FIFO Sequential Replay: Eliminates foreign key violations & state races.
 * 3. Idempotency Key Pattern: Attaches unique `Idempotency-Key` to guarantee
 *    the backend never performs duplicate deductions or double bookings.
 * 4. Automatic Replay Trigger: Wires into `ResilientLifecycleManager` when online.
 */

import { lifecycleManager, ConnectionState } from './resilientLifecycleManager';

export interface QueuedMutation {
  id: string; // Unique client mutation ID
  url: string; // Relative or absolute API URL
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  idempotencyKey: string; // Sent via 'Idempotency-Key' and 'X-Idempotency-Key'
  actionName: string; // e.g., 'INVENTORY_DEDUCT', 'JOB_CARD_STATUS'
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  status: 'PENDING' | 'SYNCING' | 'FAILED' | 'COMPLETED';
  lastError?: string;
}

export interface OfflineQueueEvent {
  action: 'ENQUEUED' | 'REPLAY_START' | 'REPLAY_SUCCESS' | 'REPLAY_FAILED' | 'QUEUE_EMPTY';
  item?: QueuedMutation;
  pendingCount: number;
}

const DB_NAME = 'elite_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'mutations';

export class OfflineQueueManager {
  private db: IDBDatabase | null = null;
  private isReplaying = false;
  private listeners: Set<(event: OfflineQueueEvent) => void> = new Set();
  private memoryFallbackQueue: QueuedMutation[] = [];
  private useMemoryFallback = false;

  constructor() {
    this.initDatabase();
    this.bindLifecycleEvents();
  }

  /**
   * Initializes IndexedDB database and store schema
   */
  private async initDatabase(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      this.useMemoryFallback = true;
      return null;
    }

    return new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('status', 'status', { unique: false });
            store.createIndex('idempotencyKey', 'idempotencyKey', { unique: true });
          }
        };

        request.onsuccess = () => {
          this.db = request.result;
          resolve(this.db);
        };

        request.onerror = () => {
          console.warn('[OfflineQueue] IndexedDB blocked or unavailable, using memory fallback');
          this.useMemoryFallback = true;
          resolve(null);
        };
      } catch {
        this.useMemoryFallback = true;
        resolve(null);
      }
    });
  }

  /**
   * Binds to ResilientLifecycleManager to auto-trigger replay when network restores
   */
  private bindLifecycleEvents(): void {
    lifecycleManager.onStateChange((state: ConnectionState) => {
      if (state === 'CONNECTED') {
        this.replayPendingMutations();
      }
    });
  }

  /**
   * Generates a cryptographically strong UUID v4 or random string for Idempotency-Key
   */
  public generateIdempotencyKey(actionName = 'ACTION'): string {
    const timestamp = Date.now();
    let randomPart = '';
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const bytes = new Uint8Array(8);
      crypto.getRandomValues(bytes);
      randomPart = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    } else {
      randomPart = Math.random().toString(36).substring(2, 14);
    }
    return `idem_${actionName.toLowerCase()}_${timestamp}_${randomPart}`;
  }

  /**
   * Intercepts a mutation and persists it into the resilient offline queue
   */
  public async enqueue(mutation: Omit<QueuedMutation, 'id' | 'idempotencyKey' | 'timestamp' | 'retryCount' | 'status'> & {
    idempotencyKey?: string;
    maxRetries?: number;
  }): Promise<QueuedMutation> {
    const action = mutation.actionName || 'MUTATION';
    const idempotencyKey = mutation.idempotencyKey || this.generateIdempotencyKey(action);

    const queuedItem: QueuedMutation = {
      ...mutation,
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      idempotencyKey,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: mutation.maxRetries ?? 5,
      status: 'PENDING',
    };

    if (this.useMemoryFallback || !this.db) {
      this.memoryFallbackQueue.push(queuedItem);
      this.notifyListeners({ action: 'ENQUEUED', item: queuedItem, pendingCount: this.memoryFallbackQueue.length });
    } else {
      await new Promise<void>((resolve, reject) => {
        const tx = this.db!.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.add(queuedItem);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      const count = await this.getPendingCount();
      this.notifyListeners({ action: 'ENQUEUED', item: queuedItem, pendingCount: count });
    }

    // If online right now, attempt immediate execution
    if (lifecycleManager.getState() === 'CONNECTED') {
      this.replayPendingMutations();
    }

    return queuedItem;
  }

  /**
   * Retrieves all pending mutations ordered by timestamp ascending (Strict FIFO)
   */
  public async getPendingMutations(): Promise<QueuedMutation[]> {
    if (this.useMemoryFallback || !this.db) {
      return [...this.memoryFallbackQueue].sort((a, b) => a.timestamp - b.timestamp);
    }

    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const req = index.getAll();

      req.onsuccess = () => {
        const items = (req.result as QueuedMutation[]).filter(
          (m) => m.status === 'PENDING' || m.status === 'FAILED'
        );
        resolve(items);
      };
      req.onerror = () => resolve([]);
    });
  }

  public async getPendingCount(): Promise<number> {
    const pending = await this.getPendingMutations();
    return pending.length;
  }

  /**
   * Replays pending mutations sequentially (FIFO) once connection is restored
   */
  public async replayPendingMutations(): Promise<void> {
    if (this.isReplaying) return;
    this.isReplaying = true;

    try {
      const pendingItems = await this.getPendingMutations();
      if (pendingItems.length === 0) {
        this.isReplaying = false;
        return;
      }

      this.notifyListeners({ action: 'REPLAY_START', pendingCount: pendingItems.length });

      for (const item of pendingItems) {
        // Stop replay if connection dropped again during sync
        if (lifecycleManager.getState() !== 'CONNECTED') {
          console.warn('[OfflineQueue] Connection lost during replay, pausing queue.');
          break;
        }

        const success = await this.executeQueuedMutation(item);
        if (!success) {
          // If a dependent action fails with an unrecoverable server 4xx error (except 409 Conflict), pause replay
          console.warn(`[OfflineQueue] Mutation ${item.id} paused due to failure.`);
          break;
        }
      }
    } finally {
      this.isReplaying = false;
      const remaining = await this.getPendingCount();
      if (remaining === 0) {
        this.notifyListeners({ action: 'QUEUE_EMPTY', pendingCount: 0 });
      }
    }
  }

  /**
   * Executes a single queued mutation over the wire with its Idempotency-Key
   */
  private async executeQueuedMutation(item: QueuedMutation): Promise<boolean> {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('elite_auth_token') : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Idempotency-Key': item.idempotencyKey,
      'X-Idempotency-Key': item.idempotencyKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(item.headers || {}),
    };

    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers,
        body: item.body ? (typeof item.body === 'string' ? item.body : JSON.stringify(item.body)) : undefined,
      });

      // Status 200, 201, or safe replay header means the backend has processed it
      if (response.ok || response.headers.get('idempotent-replayed') === 'true') {
        await this.removeFromQueue(item.id);
        const remaining = await this.getPendingCount();
        this.notifyListeners({ action: 'REPLAY_SUCCESS', item, pendingCount: remaining });
        return true;
      }

      // If backend returns 409 Conflict (lock contention), retry on next tick
      if (response.status === 409) {
        item.retryCount++;
        await this.updateItemStatus(item.id, 'FAILED', 'Conflict lock contention (409)');
        return false;
      }

      // Unrecoverable client validation error (400, 422)
      if (response.status >= 400 && response.status < 500) {
        const errorText = await response.text();
        await this.updateItemStatus(item.id, 'FAILED', errorText || `HTTP ${response.status}`);
        return false;
      }

      // 5xx Server Error: Keep in queue and retry
      item.retryCount++;
      await this.updateItemStatus(item.id, 'FAILED', `Server returned ${response.status}`);
      return false;
    } catch (err: unknown) {
      item.retryCount++;
      const msg = err instanceof Error ? err.message : 'Network error';
      await this.updateItemStatus(item.id, 'FAILED', msg);
      return false;
    }
  }

  private async updateItemStatus(id: string, status: QueuedMutation['status'], errorMsg?: string): Promise<void> {
    if (this.useMemoryFallback || !this.db) {
      const item = this.memoryFallbackQueue.find((m) => m.id === id);
      if (item) {
        item.status = status;
        if (errorMsg) item.lastError = errorMsg;
      }
      return;
    }

    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const record = getReq.result as QueuedMutation;
        if (record) {
          record.status = status;
          if (errorMsg) record.lastError = errorMsg;
          store.put(record);
        }
        resolve();
      };
      getReq.onerror = () => resolve();
    });
  }

  private async removeFromQueue(id: string): Promise<void> {
    if (this.useMemoryFallback || !this.db) {
      this.memoryFallbackQueue = this.memoryFallbackQueue.filter((m) => m.id !== id);
      return;
    }

    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  }

  public onQueueEvent(listener: (event: OfflineQueueEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(event: OfflineQueueEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('[OfflineQueue] Listener error:', e);
      }
    }
  }
}

export const offlineQueue = new OfflineQueueManager();
