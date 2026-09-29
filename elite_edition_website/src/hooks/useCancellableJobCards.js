/**
 * Technical Specification: "Job Card & Lot Status Race Condition Engine" (Phase 4)
 * Tab Navigation & Search AbortController Hook
 * 
 * Directives:
 * 1. Implement request cancellation via AbortController bound to component mount and tab switching.
 * 2. Debounce search input (300ms leading-edge / debounced) and cancel active in-flight GET requests
 *    when new filters trigger.
 * 3. Guarantee that read operations (GET) are cancellable, but mutation operations (POST/PATCH) run to completion.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';

/**
 * Custom hook managing cancellable read operations across tab navigation and search filtering.
 * 
 * @param {object} initialParams
 * @param {string} [initialParams.initialTab='Pending']
 * @param {string} [initialParams.department='digital_print']
 * @param {object} [initialParams.filters={}]
 */
export function useCancellableJobCards({
  initialTab = 'Pending',
  department = 'digital_print',
  filters = {}
} = {}) {
  const [activeTab, setActiveTabState] = useState(initialTab);
  const [searchTerm, setSearchTermState] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // References for AbortControllers
  const activeReadControllerRef = useRef(null);
  const searchDebounceTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Debounce Search Input (300ms)
  // ─────────────────────────────────────────────────────────────────────────────
  const setSearchTerm = useCallback((value) => {
    setSearchTermState(value);

    // Cancel in-flight controller immediately when typing begins to save bandwidth
    if (activeReadControllerRef.current) {
      activeReadControllerRef.current.abort();
    }

    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }

    searchDebounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value.trim());
    }, 300);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Tab Switch Handler: Immediately cancels in-flight requests
  // ─────────────────────────────────────────────────────────────────────────────
  const setActiveTab = useCallback((nextTab) => {
    if (activeReadControllerRef.current) {
      // Abort active read query before switching tab context
      activeReadControllerRef.current.abort();
    }
    setActiveTabState(nextTab);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Core Fetch Routine with Guaranteed Cancellation
  // ─────────────────────────────────────────────────────────────────────────────
  const fetchJobCards = useCallback(async () => {
    // Cancel any previous read query
    if (activeReadControllerRef.current) {
      activeReadControllerRef.current.abort();
    }

    // Create fresh controller for this specific fetch
    const controller = new AbortController();
    activeReadControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const queryParams = {
        department,
        status: activeTab,
        search: debouncedSearch || undefined,
        ...filters
      };

      // READ Operation: Passes controller.signal for safe abortion
      const response = await api.getJobCards(queryParams, {
        signal: controller.signal
      });

      if (!isMountedRef.current || controller.signal.aborted) {
        return; // Discard stale response if unmounted or aborted
      }

      setCards(response?.data || response || []);
      setLoading(false);

    } catch (err) {
      // If error is an intentional cancellation, ignore silently
      if (err.name === 'AbortError' || err.isCanceled || controller.signal.aborted) {
        // Stale query discarded cleanly
        return;
      }

      if (isMountedRef.current) {
        setError(err.message || 'Failed to fetch job cards');
        setLoading(false);
      }
    }
  }, [activeTab, debouncedSearch, department, JSON.stringify(filters)]);

  // Trigger fetch on tab, search, or filter changes
  useEffect(() => {
    fetchJobCards();
  }, [fetchJobCards]);

  // Component Mount / Unmount Lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current);
      }
      if (activeReadControllerRef.current) {
        activeReadControllerRef.current.abort();
      }
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Mutation Execution Guarantee: Mutations run to completion
  // ─────────────────────────────────────────────────────────────────────────────
  const executeNonCancellableMutation = useCallback(async (mutationFn) => {
    // Mutations (POST / PATCH / DELETE) intentionally DO NOT bind to activeReadControllerRef.
    // They run to completion even if the user switches tabs or changes search filters.
    try {
      const result = await mutationFn();
      // On success, refetch active data
      fetchJobCards();
      return result;
    } catch (err) {
      throw err;
    }
  }, [fetchJobCards]);

  return {
    cards,
    loading,
    error,
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    refetch: fetchJobCards,
    executeMutation: executeNonCancellableMutation
  };
}

export default useCancellableJobCards;
