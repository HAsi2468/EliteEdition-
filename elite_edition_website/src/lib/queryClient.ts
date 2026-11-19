import { QueryClient, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';

export const erpQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export interface OptimisticMutationOptions<TData, TVariables, TCache> {
  queryKey: QueryKey;
  mutationFn: (variables: TVariables) => Promise<TData>;
  updater: (previous: TCache | undefined, variables: TVariables) => TCache;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onRollback?: (error: unknown, variables: TVariables, previous: TCache | undefined) => void;
  invalidateOnSettled?: boolean;
}

/**
 * Reusable TanStack Query mutation hook with instant optimistic cache updates
 * and automatic rollback to the previous snapshot if the server request fails.
 */
export function useOptimisticMutation<TData = unknown, TVariables = void, TCache = unknown>(
  options: OptimisticMutationOptions<TData, TVariables, TCache>
) {
  const queryClient = useQueryClient();
  const {
    queryKey,
    mutationFn,
    updater,
    onSuccess,
    onRollback,
    invalidateOnSettled = true,
  } = options;

  return useMutation<TData, unknown, TVariables, { previous: TCache | undefined }>({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TCache>(queryKey);
      queryClient.setQueryData<TCache>(queryKey, (old) => updater(old, variables));
      return { previous };
    },
    onError: (error, variables, context) => {
      if (context && 'previous' in context) {
        queryClient.setQueryData<TCache>(queryKey, context.previous);
      }
      if (onRollback) {
        onRollback(error, variables, context?.previous);
      }
    },
    onSuccess: (data, variables) => {
      if (onSuccess) onSuccess(data, variables);
    },
    onSettled: () => {
      if (invalidateOnSettled) {
        queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}
