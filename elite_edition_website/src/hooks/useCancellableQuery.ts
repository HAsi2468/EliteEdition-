/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - CANCELLABLE QUERY & FILTER HOOK
 * Binds AbortController to tab switches, debounced search inputs, and component
 * unmounts to ensure stale out-of-order responses never overwrite UI states.
 * ============================================================================
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseCancellableQueryOptions<TData, TParams> {
  queryFn: (params: TParams, signal: AbortSignal) => Promise<TData>;
  initialParams: TParams;
  debounceMs?: number;
  onSuccess?: (data: TData) => void;
  onError?: (error: any) => void;
  autoFetch?: boolean;
}

export function useCancellableQuery<TData, TParams extends Record<string, any>>(
  options: UseCancellableQueryOptions<TData, TParams>
) {
  const {
    queryFn,
    initialParams,
    debounceMs = 300,
    onSuccess,
    onError,
    autoFetch = true,
  } = options;

  const [params, setParamsState] = useState<TParams>(initialParams);
  const [data, setData] = useState<TData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(autoFetch);
  const [error, setError] = useState<any>(null);

  const activeControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);

  // Core executor with AbortController lifecycle
  const executeQuery = useCallback(
    async (currentParams: TParams) => {
      // 1. Immediately abort prior in-flight network query
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
      }

      // 2. Instantiate fresh AbortController
      const controller = new AbortController();
      activeControllerRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const result = await queryFn(currentParams, controller.signal);

        // Discard if component unmounted or request was aborted
        if (!isMountedRef.current || controller.signal.aborted) {
          return;
        }

        setData(result);
        setIsLoading(false);
        if (onSuccess) onSuccess(result);
      } catch (err: any) {
        if (err?.name === 'AbortError' || err?.isCanceled || controller.signal.aborted) {
          // Clean cancellation — do not treat as error or overwrite state
          return;
        }

        if (isMountedRef.current) {
          setError(err);
          setIsLoading(false);
          if (onError) onError(err);
        }
      }
    },
    [queryFn, onSuccess, onError]
  );

  // Sets params with optional debouncing (useful for text search)
  const setParams = useCallback(
    (newParams: TParams | ((prev: TParams) => TParams), debounce = false) => {
      // Abort in-flight query immediately when user types
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (debounce && debounceMs > 0) {
        debounceTimerRef.current = setTimeout(() => {
          setParamsState((prev) => {
            const resolved = typeof newParams === 'function' ? (newParams as any)(prev) : newParams;
            executeQuery(resolved);
            return resolved;
          });
        }, debounceMs);
      } else {
        setParamsState((prev) => {
          const resolved = typeof newParams === 'function' ? (newParams as any)(prev) : newParams;
          executeQuery(resolved);
          return resolved;
        });
      }
    },
    [debounceMs, executeQuery]
  );

  // Trigger query on mount if autoFetch is enabled
  useEffect(() => {
    isMountedRef.current = true;
    if (autoFetch) {
      executeQuery(params);
    }
    return () => {
      isMountedRef.current = false;
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    data,
    isLoading,
    error,
    params,
    setParams,
    refetch: () => executeQuery(params),
    abort: () => {
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
      }
    },
  };
}
