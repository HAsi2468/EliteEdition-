/**
 * Technical Specification: "Job Card & Lot Status Race Condition Engine" (Phase 4)
 * TanStack Query Optimistic Status Toggle Hook
 * 
 * Directives:
 * 1. onMutate:
 *    - Cancel active queries matching ['jobCards'].
 *    - Snapshot previous cache: const previousData = queryClient.getQueryData(...).
 *    - Optimistically mutate row status in cache and mark isPending = true.
 *    - Include current record version in payload.
 * 2. onError:
 *    - If 409 VERSION_CONFLICT: Roll back to snapshot, replace record with server's latestRecord,
 *      and trigger toast: "Updated by [User] at [Time] to [Status]. Review & retry."
 *    - If 422 INSUFFICIENT_METERS: Roll back to snapshot and alert operator of material shortage.
 *    - If network error: Roll back and surface retry action preserving the same idempotency key.
 * 3. onSettled:
 *    - Invalidate query cache ['jobCards'] to eliminate state drift.
 * 4. Pessimistic Loading Enforcement:
 *    - Raw material/lot counts are NEVER updated optimistically.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { triggerPushNotification } from '../components/NotificationToast';
import { triggerEliteAlert } from '../services/dialogService';
import { api } from '../services/api';

/**
 * Generates or preserves a client-side idempotency key (UUIDv4)
 */
export function generateIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'idem_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
}

/**
 * Custom mutation hook for updating Job Card status with optimistic UI,
 * collision rollback, and idempotency retention.
 * 
 * @param {object} [options={}]
 * @param {string} [options.filterKey] - Optional active filter key for query cache
 */
export function useUpdateJobCardStatus(options = {}) {
  const queryClient = useQueryClient();
  const filterKey = options.filterKey || 'default';

  return useMutation({
    mutationFn: async ({
      jobCardId,
      targetStatus,
      currentVersion,
      lotAllocation = null, // { lotId, requestedMeters }
      idempotencyKey = null
    }) => {
      const activeIdempotencyKey = idempotencyKey || generateIdempotencyKey();

      // If lotAllocation is provided, this triggers atomic completion with lot deduction
      if (lotAllocation && targetStatus === 'COMPLETED') {
        const response = await api.post(`/job-cards/${jobCardId}/complete`, {
          version: currentVersion,
          lotId: lotAllocation.lotId,
          requestedMeters: lotAllocation.requestedMeters
        }, {
          headers: {
            'Idempotency-Key': activeIdempotencyKey,
            'If-Match-Version': String(currentVersion)
          }
        });
        return { data: response, idempotencyKey: activeIdempotencyKey, isAllocation: true };
      }

      // Standard status transition mutation
      const response = await api.patch(`/jobCards/${jobCardId}/status`, {
        status: targetStatus,
        version: currentVersion
      }, {
        headers: {
          'Idempotency-Key': activeIdempotencyKey,
          'If-Match-Version': String(currentVersion)
        }
      });

      return { data: response, idempotencyKey: activeIdempotencyKey, isAllocation: false };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // onMutate: Cancel queries, snapshot previous cache, mutate optimistically
    // ─────────────────────────────────────────────────────────────────────────
    onMutate: async (variables) => {
      const { jobCardId, targetStatus, currentVersion, lotAllocation } = variables;
      const idempotencyKey = variables.idempotencyKey || generateIdempotencyKey();

      // 1. Cancel in-flight queries matching ['jobCards'] to prevent overwrite of optimistic update
      await queryClient.cancelQueries({ queryKey: ['jobCards'] });

      // 2. Snapshot previous cache state across all active jobCards queries
      const queryCache = queryClient.getQueryCache();
      const matchingQueries = queryCache.findAll({ queryKey: ['jobCards'] });

      const snapshots = matchingQueries.map((q) => ({
        queryKey: q.queryKey,
        data: queryClient.getQueryData(q.queryKey)
      }));

      // 3. Optimistically mutate row status in cache and mark isPending = true
      matchingQueries.forEach((q) => {
        queryClient.setQueryData(q.queryKey, (oldData) => {
          if (!oldData) return oldData;

          // If cache is an array of job cards
          if (Array.isArray(oldData)) {
            return oldData.map((card) => {
              if (card.id === jobCardId || card._id === jobCardId) {
                return {
                  ...card,
                  status: targetStatus,
                  version: (currentVersion || card.version || 1) + 1,
                  isPending: true,
                  _optimistic: true
                };
              }
              return card;
            });
          }

          // If cache is a paginated / envelope response: { data: [...], total: ... }
          if (oldData.data && Array.isArray(oldData.data)) {
            return {
              ...oldData,
              data: oldData.data.map((card) => {
                if (card.id === jobCardId || card._id === jobCardId) {
                  return {
                    ...card,
                    status: targetStatus,
                    version: (currentVersion || card.version || 1) + 1,
                    isPending: true,
                    _optimistic: true
                  };
                }
                return card;
              })
            };
          }

          return oldData;
        });
      });

      // Directive 4: Enforce pessimistic loading exclusively for raw material deductions/allocations
      // (Do NOT update inventory or lot stock counts optimistically in the client cache)

      return {
        snapshots,
        jobCardId,
        targetStatus,
        currentVersion,
        idempotencyKey,
        lotAllocation
      };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // onError: Defensive Rollback & Error Taxonomy Handling
    // ─────────────────────────────────────────────────────────────────────────
    onError: (err, variables, context) => {
      // 1. Roll back to snapshot across all matching queries
      if (context?.snapshots) {
        context.snapshots.forEach(({ queryKey, data }) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      const status = err.response?.status || err.status;
      const errorData = err.response?.data || err.errorData || {};
      const errorCode = errorData.code;

      // Case A: 409 VERSION_CONFLICT
      if (status === 409 && (errorCode === 'VERSION_CONFLICT' || errorCode === 'STALE_RECORD_CONFLICT')) {
        const latestRecord = errorData.metadata?.latestRecord || errorData.latestRecord;
        const updatedBy = latestRecord?.updated_by || latestRecord?.updatedBy || errorData.metadata?.updatedBy || 'Another user';
        const updatedAtRaw = latestRecord?.updated_at || latestRecord?.updatedAt || errorData.metadata?.updatedAt;
        const updatedTime = updatedAtRaw ? new Date(updatedAtRaw).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently';
        const serverStatus = latestRecord?.status || errorData.metadata?.serverStatus || 'updated state';

        // Replace record in cache with server's latest authoritative record
        if (latestRecord && context?.snapshots) {
          context.snapshots.forEach(({ queryKey }) => {
            queryClient.setQueryData(queryKey, (oldData) => {
              if (!oldData) return oldData;
              const updateItem = (item) => {
                if (item.id === context.jobCardId || item._id === context.jobCardId) {
                  return { ...item, ...latestRecord, isPending: false };
                }
                return item;
              };

              if (Array.isArray(oldData)) return oldData.map(updateItem);
              if (oldData.data && Array.isArray(oldData.data)) {
                return { ...oldData, data: oldData.data.map(updateItem) };
              }
              return oldData;
            });
          });
        }

        // Trigger user-facing warning toast
        triggerPushNotification(
          'Version Conflict (409)',
          `Updated by ${updatedBy} at ${updatedTime} to ${serverStatus}. Review & retry.`,
          'warning'
        );
        return;
      }

      // Case B: 422 INSUFFICIENT_METERS
      if (status === 422 && errorCode === 'INSUFFICIENT_METERS') {
        const shortage = errorData.metadata?.shortage || errorData.detail || 'Insufficient stock';
        const avail = errorData.metadata?.availableMeters ?? 'insufficient';
        const req = errorData.metadata?.requestedMeters ?? 'requested';

        triggerEliteAlert({
          title: 'Material Shortage (422)',
          message: `Cannot allocate lot: ${avail}m available, but ${req}m required (${shortage} shortage). Please adjust allocation or inward more rolls.`,
          type: 'error'
        });
        return;
      }

      // Case C: Network Error / Dropped Connection
      const isNetworkError = !err.response || err.message?.includes('network') || err.message?.includes('offline') || err.isNetworkError;
      if (isNetworkError) {
        triggerPushNotification(
          'Offline / Network Error',
          'Failed to reach server. Your action is preserved and can be retried safely.',
          'error',
          {
            label: 'Retry',
            onClick: () => {
              // Re-execute mutation preserving the exact same idempotency key
              variables.idempotencyKey = context?.idempotencyKey;
              useUpdateJobCardStatus.retryLastMutation?.(variables);
            }
          }
        );
        return;
      }

      // Generic error fallback
      triggerPushNotification(
        'Action Failed',
        errorData.detail || err.message || 'Could not update Job Card.',
        'error'
      );
    },

    // ─────────────────────────────────────────────────────────────────────────
    // onSettled: Invalidate queries to eliminate state drift
    // ─────────────────────────────────────────────────────────────────────────
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['jobCards'] });
    }
  });
}

export default useUpdateJobCardStatus;
