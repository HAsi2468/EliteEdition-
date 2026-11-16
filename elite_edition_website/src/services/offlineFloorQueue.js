/**
 * Offline Queue for Factory Floor Scanners & Logs (PWA)
 * Persists scanPack, jobPrintLog, and jobFusingLog mutations in IndexedDB
 * (with localStorage fallback) when factory Wi-Fi drops, and auto-syncs when online.
 */

const DB_NAME = 'elite_erp_offline_v1';
const STORE_NAME = 'floor_queue';
const LS_FALLBACK_KEY = 'elite_floor_offline_queue_v1';

let flushingPromise = null;
let initialized = false;

function notifyQueueChange(count) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('elite-floor-queue-updated', { detail: { count } }));
  }
}

function openQueueDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB unavailable'));
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

function readLsFallback() {
  try {
    const raw = localStorage.getItem(LS_FALLBACK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeLsFallback(items) {
  try {
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(items));
  } catch (_) {}
}

export async function listFloorQueue() {
  try {
    const db = await openQueueDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = Array.isArray(req.result) ? req.result : [];
        rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (_) {
    return readLsFallback();
  }
}

export async function getFloorQueueCount() {
  const items = await listFloorQueue();
  return items.length;
}

export async function enqueueFloorAction({ endpoint, method = 'POST', body, label = 'Floor Action' }) {
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    endpoint,
    method,
    body,
    label,
    createdAt: Date.now(),
  };

  try {
    const db = await openQueueDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (_) {
    const list = readLsFallback();
    list.push(item);
    writeLsFallback(list);
  }

  const count = await getFloorQueueCount();
  notifyQueueChange(count);
  return item;
}

async function removeQueuedItem(id) {
  try {
    const db = await openQueueDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (_) {
    const list = readLsFallback().filter((x) => x.id !== id);
    writeLsFallback(list);
  }
}

export function isLikelyNetworkError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!err) return false;
  const msg = String(err.message || err).toLowerCase();
  return (
    err.name === 'TypeError' ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('err_internet_disconnected')
  );
}

export async function flushFloorQueue(requestFn) {
  if (flushingPromise) return flushingPromise;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const remaining = await getFloorQueueCount();
    return { synced: 0, remaining };
  }

  flushingPromise = (async () => {
    let synced = 0;
    const items = await listFloorQueue();
    for (const item of items) {
      try {
        await requestFn(item.endpoint, {
          method: item.method || 'POST',
          body: JSON.stringify(item.body || {}),
        });
        await removeQueuedItem(item.id);
        synced += 1;
      } catch (err) {
        if (isLikelyNetworkError(err)) {
          break;
        }
        // Drop permanent 4xx validation failures so they don't block the queue forever
        await removeQueuedItem(item.id);
      }
    }
    const remaining = await getFloorQueueCount();
    notifyQueueChange(remaining);
    return { synced, remaining };
  })();

  try {
    return await flushingPromise;
  } finally {
    flushingPromise = null;
  }
}

export function initOfflineFloorQueueSync(requestFn) {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('online', () => {
    flushFloorQueue(requestFn).catch(() => {});
  });

  setInterval(() => {
    if (navigator.onLine) {
      getFloorQueueCount()
        .then((c) => {
          if (c > 0) flushFloorQueue(requestFn).catch(() => {});
        })
        .catch(() => {});
    }
  }, 25000);

  if (navigator.onLine) {
    setTimeout(() => {
      flushFloorQueue(requestFn).catch(() => {});
    }, 3000);
  }
}
