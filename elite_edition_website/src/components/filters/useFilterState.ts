import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import {
  FilterFieldConfig,
  FilterState,
  FilterValue,
  ActiveFilterChip,
  FilterApiPayload,
  DateRangeValue,
  NumberRangeValue,
} from './DynamicFilter.types';

export interface UseFilterStateOptions {
  configs: FilterFieldConfig[];
  initialState?: FilterState;
  syncWithUrl?: boolean;
  debounceMs?: number;
  onFilterChange?: (filters: FilterState, payload: FilterApiPayload) => void;
}

export function useFilterState({
  configs,
  initialState = {},
  syncWithUrl = false,
  debounceMs = 300,
  onFilterChange,
}: UseFilterStateOptions) {
  // 1. Initial State Resolution (Optionally parse URL search params)
  const resolvedInitialState = useMemo<FilterState>(() => {
    const base: FilterState = {};

    // Defaults from config
    configs.forEach((cfg) => {
      if (cfg.defaultValue !== undefined) {
        base[cfg.key] = cfg.defaultValue;
      }
    });

    // Overrides from initial state prop
    Object.assign(base, initialState);

    // URL overrides if enabled in browser
    if (syncWithUrl && typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        configs.forEach((cfg) => {
          const urlVal = params.get(cfg.key);
          if (urlVal !== null) {
            if (cfg.type === 'multi-select') {
              base[cfg.key] = urlVal.split(',').filter(Boolean);
            } else if (cfg.type === 'number-range') {
              const minVal = params.get(`${cfg.key}_min`);
              const maxVal = params.get(`${cfg.key}_max`);
              base[cfg.key] = {
                min: minVal ? Number(minVal) : null,
                max: maxVal ? Number(maxVal) : null,
              };
            } else if (cfg.type === 'date-range') {
              const fromVal = params.get(`${cfg.key}_from`);
              const toVal = params.get(`${cfg.key}_to`);
              base[cfg.key] = {
                from: fromVal || null,
                to: toVal || null,
              };
            } else {
              base[cfg.key] = urlVal;
            }
          }
        });
      } catch (err) {
        console.warn('[useFilterState] Error parsing URL search params:', err);
      }
    }

    return base;
  }, [configs, initialState, syncWithUrl]);

  // Applied (Committed) Filter State
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(resolvedInitialState);

  // Draft (In-Drawer) Working State
  const [draftFilters, setDraftFilters] = useState<FilterState>(resolvedInitialState);

  // Search Query with debounce
  const [searchInput, setSearchInput] = useState<string>(() => {
    if (syncWithUrl && typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('q') || '';
    }
    return '';
  });
  const [debouncedSearch, setDebouncedSearch] = useState<string>(searchInput);

  // Drawer Open State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [searchInput, debounceMs]);

  // Sync to URL Search Params if enabled
  useEffect(() => {
    if (!syncWithUrl || typeof window === 'undefined') return;

    try {
      const url = new URL(window.location.href);
      const params = url.searchParams;

      // Handle search
      if (debouncedSearch) {
        params.set('q', debouncedSearch);
      } else {
        params.delete('q');
      }

      // Handle filters
      configs.forEach((cfg) => {
        const val = appliedFilters[cfg.key];
        if (val === undefined || val === null || val === '') {
          params.delete(cfg.key);
          params.delete(`${cfg.key}_min`);
          params.delete(`${cfg.key}_max`);
          params.delete(`${cfg.key}_from`);
          params.delete(`${cfg.key}_to`);
          return;
        }

        if (cfg.type === 'multi-select' && Array.isArray(val)) {
          if (val.length > 0) {
            params.set(cfg.key, val.join(','));
          } else {
            params.delete(cfg.key);
          }
        } else if (cfg.type === 'number-range' && typeof val === 'object') {
          const numRange = val as NumberRangeValue;
          if (numRange.min !== null && numRange.min !== undefined) {
            params.set(`${cfg.key}_min`, String(numRange.min));
          } else {
            params.delete(`${cfg.key}_min`);
          }
          if (numRange.max !== null && numRange.max !== undefined) {
            params.set(`${cfg.key}_max`, String(numRange.max));
          } else {
            params.delete(`${cfg.key}_max`);
          }
        } else if (cfg.type === 'date-range' && typeof val === 'object') {
          const dRange = val as DateRangeValue;
          if (dRange.from) {
            const fStr = dRange.from instanceof Date ? format(dRange.from, 'yyyy-MM-dd') : String(dRange.from);
            params.set(`${cfg.key}_from`, fStr);
          } else {
            params.delete(`${cfg.key}_from`);
          }
          if (dRange.to) {
            const tStr = dRange.to instanceof Date ? format(dRange.to, 'yyyy-MM-dd') : String(dRange.to);
            params.set(`${cfg.key}_to`, tStr);
          } else {
            params.delete(`${cfg.key}_to`);
          }
        } else {
          params.set(cfg.key, String(val));
        }
      });

      window.history.replaceState({}, '', `${url.pathname}?${params.toString()}`);
    } catch (e) {
      console.warn('[useFilterState] Error updating URL params:', e);
    }
  }, [appliedFilters, debouncedSearch, configs, syncWithUrl]);

  // Synchronize draft state when drawer opens
  const openDrawer = useCallback(() => {
    setDraftFilters(appliedFilters);
    setIsDrawerOpen(true);
  }, [appliedFilters]);

  const closeDrawer = useCallback(() => {
    setDraftFilters(appliedFilters);
    setIsDrawerOpen(false);
  }, [appliedFilters]);

  // Update a single draft filter (used inside Drawer before applying)
  const setDraftFilter = useCallback((key: string, value: FilterValue) => {
    setDraftFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  // Update a single quick filter (instantly applied from top toolbar)
  const setQuickFilter = useCallback(
    (key: string, value: FilterValue) => {
      setAppliedFilters((prev) => {
        const next = { ...prev, [key]: value };
        setDraftFilters(next);
        return next;
      });
    },
    []
  );

  // Commit all draft filters from drawer
  const applyDraftFilters = useCallback(() => {
    setAppliedFilters(draftFilters);
    setIsDrawerOpen(false);
  }, [draftFilters]);

  // Reset all filters to empty / default state
  const resetFilters = useCallback(() => {
    const fresh: FilterState = {};
    configs.forEach((cfg) => {
      if (cfg.defaultValue !== undefined) {
        fresh[cfg.key] = cfg.defaultValue;
      }
    });
    setAppliedFilters(fresh);
    setDraftFilters(fresh);
    setSearchInput('');
    setDebouncedSearch('');
  }, [configs]);

  // Remove a specific active chip (e.g. user clicked 'x' on [Status: In Progress x])
  const removeFilter = useCallback((key: string, subValue?: string | number) => {
    setAppliedFilters((prev) => {
      const currentVal = prev[key];

      // Multi-select: remove specific item from array
      if (Array.isArray(currentVal) && subValue !== undefined) {
        const updated = currentVal.filter((v) => v !== subValue);
        const next = {
          ...prev,
          [key]: updated.length > 0 ? updated : undefined,
        };
        setDraftFilters(next);
        return next;
      }

      // Single value: delete key
      const next = { ...prev };
      delete next[key];
      setDraftFilters(next);
      return next;
    });
  }, []);

  // Active Filter Count Calculation
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    configs.forEach((cfg) => {
      const val = appliedFilters[cfg.key];
      if (val === undefined || val === null || val === '') return;

      if (Array.isArray(val)) {
        if (val.length > 0) count++;
      } else if (cfg.type === 'number-range' && typeof val === 'object') {
        const nr = val as NumberRangeValue;
        if (nr.min !== null || nr.max !== null) count++;
      } else if (cfg.type === 'date-range' && typeof val === 'object') {
        const dr = val as DateRangeValue;
        if (dr.from || dr.to) count++;
      } else {
        count++;
      }
    });
    return count;
  }, [configs, appliedFilters]);

  // Active Chips Calculation (Used for rendering dismissible tags above the grid)
  const activeChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];

    configs.forEach((cfg) => {
      const val = appliedFilters[cfg.key];
      if (val === undefined || val === null || val === '') return;

      // 1. Multi-Select: create a chip for each selected item
      if (cfg.type === 'multi-select' && Array.isArray(val)) {
        val.forEach((itemVal) => {
          let labelText = String(itemVal);
          if (Array.isArray(cfg.options)) {
            const opt = cfg.options.find((o) => String(o.value) === String(itemVal));
            if (opt) labelText = opt.label;
          }
          chips.push({
            key: cfg.key,
            label: cfg.label,
            displayValue: labelText,
            rawValue: val,
            type: cfg.type,
            subValue: itemVal,
          });
        });
        return;
      }

      // 2. Select: single chip
      if (cfg.type === 'select') {
        let labelText = String(val);
        if (Array.isArray(cfg.options)) {
          const opt = cfg.options.find((o) => String(o.value) === String(val));
          if (opt) labelText = opt.label;
        }
        chips.push({
          key: cfg.key,
          label: cfg.label,
          displayValue: labelText,
          rawValue: val,
          type: cfg.type,
        });
        return;
      }

      // 3. Date Range: e.g. "01/10/2026 - 31/10/2026"
      if (cfg.type === 'date-range' && typeof val === 'object') {
        const dr = val as DateRangeValue;
        if (dr.from || dr.to) {
          const fromStr = dr.from ? (dr.from instanceof Date ? format(dr.from, 'dd/MM/yyyy') : String(dr.from)) : '';
          const toStr = dr.to ? (dr.to instanceof Date ? format(dr.to, 'dd/MM/yyyy') : String(dr.to)) : '';
          const disp = fromStr && toStr ? `${fromStr} - ${toStr}` : fromStr || toStr;
          chips.push({
            key: cfg.key,
            label: cfg.label,
            displayValue: disp,
            rawValue: val,
            type: cfg.type,
          });
        }
        return;
      }

      // 4. Number Range: e.g. "₹1,000 - ₹50,000"
      if (cfg.type === 'number-range' && typeof val === 'object') {
        const nr = val as NumberRangeValue;
        const u = cfg.unit || '';
        if (nr.min !== null || nr.max !== null) {
          let disp = '';
          if (nr.min !== null && nr.max !== null) {
            disp = `${u}${nr.min} - ${u}${nr.max}`;
          } else if (nr.min !== null) {
            disp = `≥ ${u}${nr.min}`;
          } else {
            disp = `≤ ${u}${nr.max}`;
          }
          chips.push({
            key: cfg.key,
            label: cfg.label,
            displayValue: disp,
            rawValue: val,
            type: cfg.type,
          });
        }
        return;
      }

      // 5. Text input
      chips.push({
        key: cfg.key,
        label: cfg.label,
        displayValue: String(val),
        rawValue: val,
        type: cfg.type,
      });
    });

    return chips;
  }, [configs, appliedFilters]);

  // Construct API Query Payload (e.g., { page: 1, limit: 50, search, filters, startDate, endDate })
  const getApiPayload = useCallback(
    ({ page = 1, limit = 50 }: { page?: number; limit?: number } = {}): FilterApiPayload => {
      const payloadFilters: Record<string, any> = {};
      let startDate: string | undefined = undefined;
      let endDate: string | undefined = undefined;
      let compareStartDate: string | undefined = undefined;
      let compareEndDate: string | undefined = undefined;

      configs.forEach((cfg) => {
        const val = appliedFilters[cfg.key];
        if (val === undefined || val === null || val === '') return;

        if (cfg.type === 'date-range' && typeof val === 'object') {
          const dr = val as DateRangeValue;
          if (dr.from) {
            startDate = dr.from instanceof Date ? format(dr.from, 'yyyy-MM-dd') : String(dr.from);
          }
          if (dr.to) {
            endDate = dr.to instanceof Date ? format(dr.to, 'yyyy-MM-dd') : String(dr.to);
          }
          if (dr.compare) {
            if (dr.compare.from) {
              compareStartDate =
                dr.compare.from instanceof Date
                  ? format(dr.compare.from, 'yyyy-MM-dd')
                  : String(dr.compare.from);
            }
            if (dr.compare.to) {
              compareEndDate =
                dr.compare.to instanceof Date ? format(dr.compare.to, 'yyyy-MM-dd') : String(dr.compare.to);
            }
          }
          payloadFilters[cfg.key] = { startDate, endDate, compareStartDate, compareEndDate };
        } else {
          payloadFilters[cfg.key] = val;
        }
      });

      const payload: FilterApiPayload = {
        page,
        limit,
        search: debouncedSearch || undefined,
        filters: payloadFilters,
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        ...(compareStartDate ? { compareStartDate } : {}),
        ...(compareEndDate ? { compareEndDate } : {}),
      };

      return payload;
    },
    [configs, appliedFilters, debouncedSearch]
  );

  // Trigger change callback when filters or debounced search changes
  const prevPayloadRef = useRef<string>('');
  useEffect(() => {
    if (!onFilterChange) return;
    const payload = getApiPayload({ page: 1, limit: 50 });
    const payloadStr = JSON.stringify(payload);
    if (payloadStr !== prevPayloadRef.current) {
      prevPayloadRef.current = payloadStr;
      onFilterChange(appliedFilters, payload);
    }
  }, [appliedFilters, debouncedSearch, getApiPayload, onFilterChange]);

  return {
    appliedFilters,
    draftFilters,
    searchInput,
    setSearchInput,
    debouncedSearch,
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    setDraftFilter,
    setQuickFilter,
    applyDraftFilters,
    resetFilters,
    removeFilter,
    activeFiltersCount,
    activeChips,
    getApiPayload,
  };
}
