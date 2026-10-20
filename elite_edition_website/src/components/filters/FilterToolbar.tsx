import React from 'react';
import {
  Search,
  X,
  SlidersHorizontal,
  RotateCcw,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import {
  FilterFieldConfig,
  FilterState,
  ActiveFilterChip,
  FilterValue,
  DateRangeValue,
} from './DynamicFilter.types';
import DateRangePickerWithCompare from './DateRangePickerWithCompare';

export interface FilterToolbarProps {
  configs: FilterFieldConfig[];
  appliedFilters: FilterState;
  activeChips: ActiveFilterChip[];
  activeCount: number;
  onOpenDrawer: () => void;
  onQuickFilterChange: (key: string, value: FilterValue) => void;
  onRemoveChip: (key: string, subValue?: string | number) => void;
  onClearAll: () => void;
  searchInput: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  extraActions?: React.ReactNode;
  className?: string;
}

export default function FilterToolbar({
  configs,
  appliedFilters,
  activeChips,
  activeCount,
  onOpenDrawer,
  onQuickFilterChange,
  onRemoveChip,
  onClearAll,
  searchInput,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  extraActions,
  className = '',
}: FilterToolbarProps) {
  // Extract quick filters (up to 2-3 primary filters configured with quickFilter: true)
  const quickFilterConfigs = configs.filter((c) => c.quickFilter);

  return (
    <div className={`w-full flex flex-col gap-2.5 ${className}`}>
      {/* ── 1. TOP ACTION BAR ── */}
      <div className="flex items-center justify-between flex-wrap gap-2.5 bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200 shadow-2xs">
        {/* Left Side: Search + Quick Dropdowns + More Filters Button */}
        <div className="flex items-center flex-wrap gap-2 flex-1 min-w-[280px]">
          {/* Debounced Search Bar */}
          <div className="relative min-w-[200px] sm:min-w-[260px] flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition-all"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Primary Filters (e.g. Date Range / Status) */}
          {quickFilterConfigs.map((qConfig) => {
            if (qConfig.type === 'date-range') {
              const currentVal = appliedFilters[qConfig.key] as DateRangeValue | undefined;
              return (
                <div key={qConfig.key} className="shrink-0">
                  <DateRangePickerWithCompare
                    value={currentVal}
                    onDateChange={(rangeRes) => {
                      onQuickFilterChange(qConfig.key, {
                        from: rangeRes.from,
                        to: rangeRes.to,
                        preset: rangeRes.preset,
                        compare: rangeRes.compare,
                      });
                    }}
                  />
                </div>
              );
            }

            if (qConfig.type === 'select') {
              const options = Array.isArray(qConfig.options) ? qConfig.options : [];
              const currentVal = appliedFilters[qConfig.key];
              const isSelected = currentVal !== undefined && currentVal !== null && currentVal !== '';

              return (
                <div key={qConfig.key} className="relative shrink-0">
                  <select
                    value={isSelected ? String(currentVal) : ''}
                    onChange={(e) => onQuickFilterChange(qConfig.key, e.target.value || undefined)}
                    className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-lg border appearance-none pr-8 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-500/40 text-emerald-800 font-semibold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600`}
                  >
                    <option value="">All {qConfig.label}</option>
                    {options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              );
            }

            return null;
          })}

          {/* "More Filters" Button with Active Filter Counter Badge */}
          <button
            type="button"
            onClick={onOpenDrawer}
            className={`inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg border transition-all cursor-pointer ${
              activeCount > 0
                ? 'bg-emerald-50 border-emerald-500/50 text-emerald-800 shadow-2xs hover:bg-emerald-100/70'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            <SlidersHorizontal className={`w-3.5 h-3.5 ${activeCount > 0 ? 'text-emerald-700' : 'text-slate-500'}`} />
            <span>More Filters</span>
            {activeCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </button>

          {/* "Clear All" Button if any filters or search are active */}
          {(activeCount > 0 || searchInput) && (
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50/60 rounded-lg transition-colors cursor-pointer"
              title="Reset all search and filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          )}
        </div>

        {/* Right Side: Optional Extra Actions (Export, Print, Refresh, Create) */}
        {extraActions && (
          <div className="flex items-center gap-2 shrink-0">{extraActions}</div>
        )}
      </div>

      {/* ── 2. ACTIVE CHIPS BAR (Dismissible Tags Directly Above Data Table) ── */}
      {activeChips.length > 0 && (
        <div className="flex items-center flex-wrap gap-1.5 px-1 py-0.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 select-none">
            Active:
          </span>

          {activeChips.map((chip, idx) => (
            <span
              key={`${chip.key}_${chip.subValue ?? idx}`}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-md text-xs font-medium bg-emerald-50/80 border border-emerald-200 text-emerald-800 animate-in fade-in duration-150"
            >
              <span className="text-emerald-900 font-semibold">{chip.label}:</span>
              <span className="text-emerald-700 truncate max-w-[200px]">{chip.displayValue}</span>
              <button
                type="button"
                onClick={() => onRemoveChip(chip.key, chip.subValue)}
                className="w-4 h-4 rounded-full hover:bg-emerald-200/60 text-emerald-600 hover:text-emerald-900 flex items-center justify-center transition-colors cursor-pointer ml-0.5"
                title={`Remove ${chip.label} filter`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {/* Quick clear link */}
          {activeChips.length > 1 && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-[11px] text-slate-400 hover:text-rose-600 font-medium underline underline-offset-2 ml-1 cursor-pointer transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
