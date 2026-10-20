import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  Calendar,
  Hash,
  SlidersHorizontal,
} from 'lucide-react';
import {
  FilterFieldConfig,
  FilterState,
  FilterValue,
  FilterOption,
  NumberRangeValue,
  DateRangeValue,
} from './DynamicFilter.types';
import DateRangePickerWithCompare from './DateRangePickerWithCompare';

export interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  configs: FilterFieldConfig[];
  draftFilters: FilterState;
  setDraftFilter: (key: string, value: FilterValue) => void;
  onApply: () => void;
  onReset: () => void;
  activeCount: number;
}

export default function FilterDrawer({
  isOpen,
  onClose,
  configs,
  draftFilters,
  setDraftFilter,
  onApply,
  onReset,
  activeCount,
}: FilterDrawerProps) {
  // Only display secondary filters in the drawer (or all filters if desired)
  const drawerConfigs = useMemo(() => {
    // Show all configs or only non-quick filters. In standard ERP drawers, we show all filters grouped neatly.
    return configs;
  }, [configs]);

  // Group configs by accordion section
  const sections = useMemo(() => {
    const map = new Map<string, FilterFieldConfig[]>();
    drawerConfigs.forEach((cfg) => {
      const sec = cfg.section || 'General Details';
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(cfg);
    });
    return Array.from(map.entries()).map(([title, fields]) => ({ title, fields }));
  }, [drawerConfigs]);

  // Collapsible section open/close state (Default all open)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (sections.length > 0) {
      const initial: Record<string, boolean> = {};
      sections.forEach((s) => {
        initial[s.title] = true;
      });
      setOpenSections(initial);
    }
  }, [sections]);

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  // Prevent background body scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99990] flex justify-end">
      {/* ── 1. BACKDROP OVERLAY ── */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity duration-200 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── 2. SLIDE-OVER DRAWER CONTAINER ── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filter Options Drawer"
        className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-250 border-l border-slate-200 select-none"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/10 text-emerald-700 flex items-center justify-center font-bold">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Advanced Filters</h2>
              <p className="text-[11px] text-slate-500">Refine enterprise records across parameters</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                {activeCount} active
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              aria-label="Close filters"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawer Body: Collapsible Accordion Sections */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {sections.map(({ title, fields }) => {
            const isSectionOpen = openSections[title] ?? true;

            // Check how many filters are active in this specific section
            const sectionActiveCount = fields.filter((f) => {
              const val = draftFilters[f.key];
              if (val === undefined || val === null || val === '') return false;
              if (Array.isArray(val)) return val.length > 0;
              if (typeof val === 'object') {
                return Object.values(val).some((v) => v !== null && v !== undefined && v !== '');
              }
              return true;
            }).length;

            return (
              <div
                key={title}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs"
              >
                {/* Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleSection(title)}
                  className="flex items-center justify-between w-full px-4 py-3 bg-slate-50/60 hover:bg-slate-100/60 transition-colors text-left font-semibold text-xs text-slate-700 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    {isSectionOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span>{title}</span>
                  </span>

                  {sectionActiveCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {sectionActiveCount}
                    </span>
                  )}
                </button>

                {/* Accordion Content */}
                {isSectionOpen && (
                  <div className="p-4 space-y-4 border-t border-slate-100 divide-y divide-slate-100">
                    {fields.map((field) => (
                      <div key={field.key} className="pt-3 first:pt-0">
                        <FieldControl
                          config={field}
                          value={draftFilters[field.key]}
                          onChange={(val) => setDraftFilter(field.key, val)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Drawer Footer: Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50/60 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onApply}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-sm transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Apply Filters</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Individual Filter Field Control Renderer
 */
interface FieldControlProps {
  config: FilterFieldConfig;
  value: FilterValue;
  onChange: (val: FilterValue) => void;
}

function FieldControl({ config, value, onChange }: FieldControlProps) {
  const [resolvedOptions, setResolvedOptions] = useState<FilterOption[]>(() => {
    return Array.isArray(config.options) ? config.options : [];
  });
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Async options fetch if options is a function
  useEffect(() => {
    if (typeof config.options === 'function') {
      let isMounted = true;
      setIsLoadingOptions(true);
      config
        .options()
        .then((opts) => {
          if (isMounted) setResolvedOptions(opts);
        })
        .catch((err) => console.warn(`[FilterDrawer] Error fetching options for ${config.key}:`, err))
        .finally(() => {
          if (isMounted) setIsLoadingOptions(false);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [config]);

  // Filtered options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return resolvedOptions;
    const term = searchTerm.toLowerCase();
    return resolvedOptions.filter((o) => o.label.toLowerCase().includes(term));
  }, [resolvedOptions, searchTerm]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <span>{config.label}</span>
          {config.description && (
            <span className="text-[10px] text-slate-400" title={config.description}>
              (?)
            </span>
          )}
        </label>

        {value !== undefined && value !== null && value !== '' && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-[10px] text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── 1. TEXT INPUT ── */}
      {config.type === 'text' && (
        <div className="relative">
          <input
            type="text"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={config.placeholder || `Filter by ${config.label}...`}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition-all"
          />
          {typeof value === 'string' && value.length > 0 && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* ── 2. SELECT (Single choice) ── */}
      {config.type === 'select' && (
        <select
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition-all cursor-pointer"
        >
          <option value="">All {config.label}</option>
          {resolvedOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label} {opt.count !== undefined ? `(${opt.count})` : ''}
            </option>
          ))}
        </select>
      )}

      {/* ── 3. MULTI-SELECT (Tag clouds / Searchable checkbox list) ── */}
      {config.type === 'multi-select' && (
        <div className="space-y-2">
          {config.searchable && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search choices..."
                className="w-full pl-8 pr-3 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-md placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 border border-slate-100 rounded-lg bg-slate-50/50">
            {isLoadingOptions ? (
              <span className="text-[11px] text-slate-400 p-2">Loading options...</span>
            ) : filteredOptions.length === 0 ? (
              <span className="text-[11px] text-slate-400 p-2">No matching options</span>
            ) : (
              filteredOptions.map((opt) => {
                const currentArr = Array.isArray(value) ? value : [];
                const isChecked = currentArr.some((v) => String(v) === String(opt.value));

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      if (isChecked) {
                        const next = currentArr.filter((v) => String(v) !== String(opt.value));
                        onChange(next.length > 0 ? next : undefined);
                      } else {
                        onChange([...currentArr, opt.value]);
                      }
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      isChecked
                        ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {opt.badge && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-black/10">{opt.badge}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── 4. NUMBER RANGE (Min & Max with unit) ── */}
      {config.type === 'number-range' && (
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">
              {config.unit || 'Min'}
            </span>
            <input
              type="number"
              min={config.min}
              max={config.max}
              step={config.step || 1}
              value={typeof value === 'object' && value && (value as NumberRangeValue).min !== null ? (value as NumberRangeValue).min ?? '' : ''}
              onChange={(e) => {
                const num = e.target.value === '' ? null : Number(e.target.value);
                const current = (typeof value === 'object' && value ? (value as NumberRangeValue) : {}) as NumberRangeValue;
                onChange({ ...current, min: num });
              }}
              placeholder="Min"
              className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition-all"
            />
          </div>

          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">
              {config.unit || 'Max'}
            </span>
            <input
              type="number"
              min={config.min}
              max={config.max}
              step={config.step || 1}
              value={typeof value === 'object' && value && (value as NumberRangeValue).max !== null ? (value as NumberRangeValue).max ?? '' : ''}
              onChange={(e) => {
                const num = e.target.value === '' ? null : Number(e.target.value);
                const current = (typeof value === 'object' && value ? (value as NumberRangeValue) : {}) as NumberRangeValue;
                onChange({ ...current, max: num });
              }}
              placeholder="Max"
              className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition-all"
            />
          </div>
        </div>
      )}

      {/* ── 5. DATE RANGE (Integration of DateRangePickerWithCompare) ── */}
      {config.type === 'date-range' && (
        <div className="w-full">
          <DateRangePickerWithCompare
            value={typeof value === 'object' && value ? (value as DateRangeValue) : undefined}
            onDateChange={(rangeResult) => {
              onChange({
                from: rangeResult.from,
                to: rangeResult.to,
                preset: rangeResult.preset,
                compare: rangeResult.compare,
              });
            }}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}
