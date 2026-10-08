import { useState, useEffect, useRef, useCallback } from 'react';

// Tier 1: High-Speed In-Memory RAM Store (sub-millisecond retrieval)
const ramCache = new Map();

// Tier 2: Storage Helper with Safe Serialization and Expiry TTL
const STORAGE_PREFIX = 'erp_swr_';

function getStoredCache(key, ttlMs) {
  // 1. Check RAM Cache
  if (ramCache.has(key)) {
    const entry = ramCache.get(key);
    if (!ttlMs || Date.now() - entry.timestamp < ttlMs) {
      return entry.data;
    }
    ramCache.delete(key);
  }

  // 2. Check Browser Storage
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!ttlMs || Date.now() - parsed.timestamp < ttlMs) {
          ramCache.set(key, parsed);
          return parsed.data;
        }
        sessionStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      }
    }
  } catch (e) {
    // Ignore storage quota or deserialization glitches
  }

  return null;
}

function setStoredCache(key, data) {
  const entry = { data, timestamp: Date.now() };
  ramCache.set(key, entry);

  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(entry));
    }
  } catch (e) {
    // Storage quota fallback
  }
}

/**
 * Enterprise Stale-While-Revalidate (SWR) Local-First Hook.
 * 
 * Provides instantaneous 0ms UI rendering from RAM/Storage cache while silently
 * revalidating over the network in the background.
 * 
 * @param {string} key - Unique cache key
 * @param {Function} fetcher - Async fetch function returning fresh data
 * @param {object} options
 * @param {number} [options.ttl=600000] - Cache validity TTL in milliseconds (default: 10 minutes)
 * @param {boolean} [options.revalidateOnMount=true] - Whether to revalidate on mount
 * @param {any} [options.initialData=null] - Default fallback data before any cache exists
 */
export function useLocalFirstData(key, fetcher, options = {}) {
  const {
    ttl = 10 * 60 * 1000,
    revalidateOnMount = true,
    initialData = null
  } = options;

  // Read instant cache synchronously so the very first render already has data
  const cached = key ? getStoredCache(key, ttl) : null;

  const [data, setData] = useState(cached !== null ? cached : initialData);
  const [loading, setLoading] = useState(cached === null);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const inFlightPromiseRef = useRef(null);
  const isMountedRef = useRef(true);

  const revalidate = useCallback(async (customFetcher) => {
    if (!key) return;
    const runFetch = customFetcher || fetcherRef.current;
    if (typeof runFetch !== 'function') return;

    setIsValidating(true);

    try {
      // In-flight deduplication
      if (!inFlightPromiseRef.current) {
        inFlightPromiseRef.current = runFetch();
      }
      const freshData = await inFlightPromiseRef.current;
      inFlightPromiseRef.current = null;

      if (!isMountedRef.current) return;

      // Update cache
      setStoredCache(key, freshData);

      // Deep compare JSON to prevent unnecessary re-renders
      setData((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(freshData)) {
          return prev;
        }
        return freshData;
      });

      setLoading(false);
      setIsValidating(false);
      setError(null);
      return freshData;
    } catch (err) {
      inFlightPromiseRef.current = null;
      if (!isMountedRef.current) return;

      setError(err);
      setLoading(false);
      setIsValidating(false);
    }
  }, [key]);

  // Synchronize on key change
  useEffect(() => {
    isMountedRef.current = true;
    if (!key) return;

    const freshCached = getStoredCache(key, ttl);
    if (freshCached !== null) {
      setData(freshCached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    if (revalidateOnMount) {
      revalidate();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [key, ttl, revalidateOnMount, revalidate]);

  // Optimistic Cache Mutator
  const mutate = useCallback((nextData, shouldRevalidate = false) => {
    if (!key) return;
    const resolved = typeof nextData === 'function' ? nextData(data) : nextData;
    setStoredCache(key, resolved);
    setData(resolved);
    if (shouldRevalidate) {
      revalidate();
    }
  }, [key, data, revalidate]);

  return {
    data,
    loading,
    isValidating,
    error,
    mutate,
    revalidate
  };
}

export default useLocalFirstData;
