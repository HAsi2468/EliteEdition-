import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle2, RefreshCw, Trash2, CloudCheck } from 'lucide-react';
import { triggerPushNotification } from '../components/NotificationToast';

const DB_NAME = 'EliteErpDraftDB';
const DB_VERSION = 1;
const STORE_NAME = 'form_drafts';

/**
 * Lightweight native IndexedDB Promise wrapper for fast form persistence
 */
function openDraftDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGetDraft(key) {
  try {
    const db = await openDraftDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.data : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbSetDraft(key, data) {
  try {
    const db = await openDraftDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ key, data, updatedAt: Date.now() });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return false;
  }
}

async function idbDeleteDraft(key) {
  try {
    const db = await openDraftDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Enterprise Form Auto-recovery Hook
 * Dual-layer draft persistence: IndexedDB (high capacity, async) + LocalStorage/SessionStorage (immediate flush).
 * 
 * @param {string} draftKey - Unique key for this form (e.g. 'garment_job_card', 'bulk_inward')
 * @param {object} formState - Current state of the form
 * @param {function} setFormState - State setter function
 * @param {boolean} [isFormActive=true] - Whether the form modal/view is currently active
 * @param {object} [options={}] - Additional options
 */
export function useFormDraft(
  draftKey,
  formState,
  setFormState,
  isFormActive = true,
  options = {}
) {
  const { notifyOnRestore = true, debounceMs = 300 } = options;
  const isLoadedRef = useRef(false);
  const latestStateRef = useRef(formState);
  latestStateRef.current = formState;

  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'restored' | 'error'
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [hasDraft, setHasDraft] = useState(false);

  const storageKey = `elite_draft_${draftKey}`;

  // Helper to check if payload has actual user content
  const hasSubstantialData = useCallback((val) => {
    if (!val || typeof val !== 'object') return false;
    return Object.values(val).some((v) => {
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'object' && v !== null) {
        return Object.values(v).some((nested) => nested !== '' && nested !== 0 && nested !== null);
      }
      return v !== '' && v !== null && v !== undefined && v !== 0;
    });
  }, []);

  // 1. Restore draft on mount or form activation
  useEffect(() => {
    if (!isFormActive) {
      isLoadedRef.current = false;
      return;
    }

    let isCancelled = false;

    async function restore() {
      try {
        // Attempt IndexedDB first
        let savedData = await idbGetDraft(storageKey);

        // Fallback to localStorage / sessionStorage if IDB returned null
        if (!savedData && typeof window !== 'undefined') {
          const raw = localStorage.getItem(storageKey) || sessionStorage.getItem(storageKey);
          if (raw) {
            savedData = JSON.parse(raw);
          }
        }

        if (savedData && hasSubstantialData(savedData) && !isCancelled) {
          setFormState((prev) => {
            if (typeof prev === 'object' && prev !== null) {
              return { ...prev, ...savedData };
            }
            return savedData;
          });

          setHasDraft(true);
          setSaveStatus('restored');
          setLastSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

          if (notifyOnRestore) {
            triggerPushNotification(
              'Draft Restored',
              'Unsaved form progress was automatically recovered from offline persistence.',
              'info'
            );
          }
        }
      } catch (err) {
        console.warn('Could not restore form draft for', draftKey, err);
      } finally {
        if (!isCancelled) {
          isLoadedRef.current = true;
        }
      }
    }

    restore();

    return () => {
      isCancelled = true;
    };
  }, [isFormActive, draftKey, storageKey, setFormState, notifyOnRestore, hasSubstantialData]);

  // 2. Debounced Auto-Save
  useEffect(() => {
    if (!isFormActive || !isLoadedRef.current) return;

    if (!hasSubstantialData(formState)) {
      return;
    }

    setSaveStatus('saving');

    const timer = setTimeout(async () => {
      try {
        const payload = JSON.stringify(formState);
        // Synchronous fallback
        try {
          localStorage.setItem(storageKey, payload);
          sessionStorage.setItem(storageKey, payload);
        } catch {}

        // High-capacity IndexedDB async save
        await idbSetDraft(storageKey, formState);

        setSaveStatus('saved');
        setHasDraft(true);
        setLastSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch (e) {
        setSaveStatus('error');
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [formState, isFormActive, storageKey, debounceMs, hasSubstantialData]);

  // 3. Flush on unload/visibility change
  useEffect(() => {
    const handleFlush = () => {
      if (!isFormActive || !isLoadedRef.current) return;
      try {
        if (latestStateRef.current && hasSubstantialData(latestStateRef.current)) {
          const payload = JSON.stringify(latestStateRef.current);
          localStorage.setItem(storageKey, payload);
          sessionStorage.setItem(storageKey, payload);
          idbSetDraft(storageKey, latestStateRef.current);
        }
      } catch (e) {}
    };

    window.addEventListener('beforeunload', handleFlush);
    document.addEventListener('visibilitychange', handleFlush);

    return () => {
      window.removeEventListener('beforeunload', handleFlush);
      document.removeEventListener('visibilitychange', handleFlush);
    };
  }, [isFormActive, storageKey, hasSubstantialData]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      sessionStorage.removeItem(storageKey);
      idbDeleteDraft(storageKey);
      setHasDraft(false);
      setSaveStatus('idle');
      setLastSavedAt(null);
    } catch (e) {}
  }, [storageKey]);

  return {
    clearDraft,
    saveStatus,
    lastSavedAt,
    hasDraft
  };
}

/**
 * Visual Draft Status Badge for Form Headers/Footers
 */
export function DraftStatusBadge({ saveStatus = 'saved', lastSavedAt, onClear, className = '' }) {
  if (saveStatus === 'idle' && !lastSavedAt) return null;

  return (
    <div
      className={`erp-draft-status-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 500,
        backgroundColor: saveStatus === 'error' ? '#fef2f2' : '#f0fdf4',
        border: `1px solid ${saveStatus === 'error' ? '#fecaca' : '#bbf7d0'}`,
        color: saveStatus === 'error' ? '#b91c1c' : '#15803d',
        transition: 'all 0.2s ease'
      }}
    >
      {saveStatus === 'saving' ? (
        <RefreshCw size={12} className="spin-loader" />
      ) : (
        <CheckCircle2 size={12} color="#16a34a" />
      )}

      <span>
        {saveStatus === 'saving'
          ? 'Saving draft...'
          : saveStatus === 'restored'
          ? 'Draft recovered'
          : `Draft saved ${lastSavedAt ? `(${lastSavedAt})` : ''}`}
      </span>

      {onClear && (
        <button
          type="button"
          onClick={onClear}
          title="Clear saved draft"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            marginLeft: '2px',
            cursor: 'pointer',
            color: '#94a3b8',
            display: 'inline-flex',
            alignItems: 'center'
          }}
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}

export default useFormDraft;
