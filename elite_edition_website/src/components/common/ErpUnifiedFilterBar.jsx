import React, { useMemo } from 'react';
import { Filter, Search, RotateCcw, X } from 'lucide-react';
import DateRangePicker from '../DateRangePicker';
import UnifiedFilterPopover from './UnifiedFilterPopover';
import './ErpUnifiedFilterBar.css';

/**
 * ErpUnifiedFilterBar
 * 
 * Standardized, enterprise-wide Filter Toolbar.
 * Combines DateRangePicker + UnifiedFilterPopover + Search + Reset/Clear Button
 * across every screen in the ERP for 100% visual and functional consistency.
 */
export default function ErpUnifiedFilterBar({
  // Search
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search records...',

  // Date Filter
  showDatePicker = true,
  datePreset = 'all',
  onDateChange,
  customDateStart = '',
  customDateEnd = '',
  onCustomDateChange,

  // Multi-Filter Popover
  showFilterPopover = true,
  categories = [],
  activeFilters = {},
  onFilterChange,
  filterPlaceholder = 'Filters',
  showChips = true,

  // Label
  label = 'Filter & Period:',
  icon: LabelIcon = Filter,

  // Reset / Clear
  onReset,
  hasActiveFiltersOverride,

  // Slot for right-side buttons/actions/badges
  rightContent,
  children,
  className = '',
  style = {}
}) {
  // Determine if any filter is actively applied
  const isFilterActive = useMemo(() => {
    if (typeof hasActiveFiltersOverride === 'boolean') {
      return hasActiveFiltersOverride;
    }

    const hasSearch = Boolean(searchQuery && searchQuery.trim() !== '');
    const hasNonDefaultDate = Boolean(
      (datePreset && datePreset !== 'all') || customDateStart || customDateEnd
    );
    const hasCategoryFilters = Object.keys(activeFilters || {}).some(
      (k) => Array.isArray(activeFilters[k]) ? activeFilters[k].length > 0 : Boolean(activeFilters[k])
    );

    return hasSearch || hasNonDefaultDate || hasCategoryFilters;
  }, [hasActiveFiltersOverride, searchQuery, datePreset, customDateStart, customDateEnd, activeFilters]);

  const handleClearAll = () => {
    if (onReset) {
      onReset();
    } else {
      if (onSearchChange) onSearchChange('');
      if (onFilterChange) onFilterChange({});
      if (onDateChange) onDateChange({ preset: 'all', dateStart: '', dateEnd: '' });
      if (onCustomDateChange) onCustomDateChange('', '');
    }
  };

  return (
    <div className={`erp-unified-filter-bar ${className}`} style={style}>
      <div className="erp-unified-filter-row">
        <div className="erp-unified-filter-group">
          {label && (
            <span className="erp-filter-label-pill">
              <LabelIcon size={15} color="#2563eb" />
              <span>{label}</span>
            </span>
          )}

          {/* Optional Search Field */}
          {onSearchChange && (
            <div className="erp-filter-search-box">
              <Search size={14} className="erp-filter-search-icon" />
              <input
                type="text"
                value={searchQuery || ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="erp-filter-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0
                  }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {/* Standard Date Range Picker */}
          {showDatePicker && (
            <DateRangePicker
              preset={datePreset}
              onChange={onDateChange || (() => {})}
              customStart={customDateStart}
              customEnd={customDateEnd}
              onCustomChange={onCustomDateChange}
            />
          )}

          {/* Standard Unified Multi-Select Popover */}
          {showFilterPopover && categories && categories.length > 0 && (
            <UnifiedFilterPopover
              categories={categories}
              activeFilters={activeFilters}
              onChange={onFilterChange || (() => {})}
              onClear={handleClearAll}
              placeholder={filterPlaceholder}
              showChips={showChips}
            />
          )}

          {/* Clear / Reset Button */}
          {isFilterActive && (
            <button
              type="button"
              onClick={handleClearAll}
              className="erp-filter-reset-btn"
              title="Reset all filters and date selection"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}

          {children}
        </div>

        {rightContent && (
          <div className="erp-unified-filter-actions">
            {rightContent}
          </div>
        )}
      </div>
    </div>
  );
}
