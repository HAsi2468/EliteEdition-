/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - OPTIMISTIC MUTATION HOOK (OCC & CONCURRENCY)
 * Provides pre-mutation snapshotting, instant optimistic UI updates,
 * 409 collision rollbacks, conflict toast alerts, and automatic re-fetch.
 * ============================================================================
 */

import { useState, useCallback, useRef } from 'react';

export interface OptimisticMutationOptions<TData, TVariables> {
  /**
   * Primary mutation function making the network call
   */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /**
   * Called immediately before the mutation request starts to calculate optimistic state
   */
  onMutate?: (variables: TVariables, currentData: TData) => TData;
  /**
   * Re-fetch function to retrieve the ground-truth server record after success or rollback
   */
  refetch?: () => Promise<TData | void>;
  /**
   * Callback fired upon successful mutation
   */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /**
   * Custom notification or toast handler
   */
  onConflict?: (error: any, rollbackData: TData) => void;
}

export function useOptimisticMutation<TData, TVariables = any>(
  initialData: TData,
  options: OptimisticMutationOptions<TData, TVariables>
) {
  const [data, setData] = useState<TData>(initialData);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<any>(null);

  // Store pre-mutation snapshot for atomic rollback
  const snapshotRef = useRef<TData>(initialData);

  const mutate = useCallback(
    async (variables: TVariables): Promise<TData | null> => {
      setIsLoading(true);
      setError(null);

      // 1. Take atomic snapshot of current state
      snapshotRef.current = data;

      // 2. Apply optimistic UI update immediately
      if (options.onMutate) {
        try {
          const optimisticData = options.onMutate(variables, data);
          setData(optimisticData);
        } catch (optimisticErr) {
          console.warn('[useOptimisticMutation] Optimistic update failed:', optimisticErr);
        }
      }

      try {
        // 3. Execute network mutation
        const result = await options.mutationFn(variables);
        setData(result);
        if (options.onSuccess) {
          options.onSuccess(result, variables);
        }
        setIsLoading(false);
        return result;
      } catch (err: any) {
        // 4. Collision or failure: check if HTTP 409 Conflict
        const isConflict =
          err?.status === 409 ||
          err?.response?.status === 409 ||
          err?.code === 'STALE_RECORD_CONFLICT' ||
          err?.code === 'VERSION_CONFLICT' ||
          (typeof err?.message === 'string' &&
            (err.message.includes('modified by another user') ||
              err.message.includes('409') ||
              err.message.includes('Conflict')));

        // Roll back immediately to pre-mutation snapshot
        setData(snapshotRef.current);
        setError(err);
        setIsLoading(false);

        if (isConflict) {
          const operator = err?.updatedByName || 'another operator';
          const alertMessage = `Conflict detected: Record was modified by ${operator}. Reverting to database state.`;

          if (options.onConflict) {
            options.onConflict(err, snapshotRef.current);
          } else if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('elite-toast-notification', {
                detail: {
                  type: 'error',
                  title: 'Version Conflict (HTTP 409)',
                  message: alertMessage,
                },
              })
            );
          }

          // Automatically re-fetch latest database state to sync workstation
          if (options.refetch) {
            try {
              const freshData = await options.refetch();
              if (freshData) setData(freshData as TData);
            } catch (refetchErr) {
              console.error('[useOptimisticMutation] Post-rollback re-fetch failed:', refetchErr);
            }
          }
        }

        throw err;
      }
    },
    [data, options]
  );

  return {
    data,
    setData,
    mutate,
    isLoading,
    error,
    rollback: () => setData(snapshotRef.current),
  };
}
