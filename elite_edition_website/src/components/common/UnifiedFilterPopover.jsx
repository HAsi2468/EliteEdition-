import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  SlidersHorizontal,
  Search,
  Check,
  X,
  RotateCcw,
  ChevronRight,
  Filter
} from 'lucide-react';
import './UnifiedFilterPopover.css';

/**
 * Enterprise Unified Filter Popover Component
 * 
 * Replaces cumbersome, bulky multi-row select boxes with a single sleek, 
 * high-density popover filter drawer featuring multi-select capabilities, 
 * category search, quick presets, and active chips bar.
 *
 * @param {Array<object>} filters - Configuration of filter categories:
 *   [
 *     {
 *       id: 'designer',
 *       label: 'Assign Design',
 *       icon?: LucideIcon,
 *       multi?: boolean, // default true
 *       options: string[] | Array<{ value: string, label: string, badge?: string, color?: string }>
 *     }
 *   ]
 * @param {object} values - Active selected values map e.g. { designer: ['DHRUV'], priority: ['High'] }
 * @param {function} onChange - Callback receiving updated values object
 * @param {function} [onClear] - Optional callback when all filters are cleared
 * @param {string} [triggerLabel='Filters'] - Label for trigger button
 * @param {boolean} [showChips=true] - Whether to render active filter chips below toolbar
 * @param {'left'|'right'} [align='left'] - Popover alignment relative to trigger
 */
export default function UnifiedFilterPopover(props) {
  const {
    filters: rawFilters,
    categories: rawCategories,
    values: rawValues,
    activeFilters: rawActiveFilters,
    onChange = () => {},
    onClear = null,
    triggerLabel: rawTriggerLabel,
    placeholder: rawPlaceholder,
    showChips = true,
    align = 'left',
    id = 'unified-filter-popover'
  } = props;

  // Support both filters and categories props, and normalize label/name
  const filters = useMemo(() => {
    const list = rawFilters || rawCategories || [];
    return list.map((f) => ({
      ...f,
      label: f.label || f.name || f.id || ''
    }));
  }, [rawFilters, rawCategories]);

  // Support both values and activeFilters props
  const values = rawValues || rawActiveFilters || {};

  // Support both triggerLabel and placeholder props
  const triggerLabel = rawTriggerLabel || rawPlaceholder || 'Filters';

  const [isOpen, setIsOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState(filters[0]?.id || '');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const popoverRef = useRef(null);
  const triggerRef = useRef(null);

  // Set default active category when filters change
  useEffect(() => {
    if (filters.length > 0) {
      const exists = filters.some((f) => f.id === activeCategoryId);
      if (!exists) {
        setActiveCategoryId(filters[0].id);
      }
    }
  }, [filters, activeCategoryId]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Current active category config
  const activeCategory = useMemo(() => {
    return filters.find((f) => f.id === activeCategoryId) || filters[0];
  }, [filters, activeCategoryId]);

  // Normalize options for active category
  const activeOptions = useMemo(() => {
    if (!activeCategory || !activeCategory.options) return [];
    return activeCategory.options
      .map((opt) => {
        if (typeof opt === 'object' && opt !== null) {
          return {
            value: String(opt.value ?? ''),
            label: String(opt.label ?? opt.value ?? ''),
            badge: opt.badge,
            color: opt.color
          };
        }
        return {
          value: String(opt),
          label: String(opt),
          badge: null,
          color: null
        };
      })
      .filter((opt) => opt.value !== '' && opt.value !== 'All');
  }, [activeCategory]);

  // Filter options by search query
  const filteredOptions = useMemo(() => {
    if (!categorySearchQuery.trim()) return activeOptions;
    const q = categorySearchQuery.toLowerCase().trim();
    return activeOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q)
    );
  }, [activeOptions, categorySearchQuery]);

  // Calculate active filter counts across all categories
  const { totalActiveCount, categoryCounts, activeFilterItems } = useMemo(() => {
    let total = 0;
    const counts = {};
    const items = [];

    filters.forEach((cat) => {
      const val = values[cat.id];
      if (Array.isArray(val)) {
        const nonAll = val.filter((v) => v !== 'All' && v !== '');
        counts[cat.id] = nonAll.length;
        total += nonAll.length;
        nonAll.forEach((v) => {
          items.push({
            categoryId: cat.id,
            categoryLabel: cat.label,
            value: v,
            label: v
          });
        });
      } else if (val && val !== 'All' && val !== '') {
        counts[cat.id] = 1;
        total += 1;
        items.push({
          categoryId: cat.id,
          categoryLabel: cat.label,
          value: val,
          label: val
        });
      } else {
        counts[cat.id] = 0;
      }
    });

    return { totalActiveCount: total, categoryCounts: counts, activeFilterItems: items };
  }, [filters, values]);

  // Check if a specific option is selected
  const isOptionSelected = (categoryId, optionValue) => {
    const val = values[categoryId];
    if (Array.isArray(val)) {
      return val.includes(optionValue);
    }
    return val === optionValue;
  };

  // Toggle option selection
  const handleToggleOption = (categoryId, optionValue, isMulti = true) => {
    const current = values[categoryId];
    let next;

    if (isMulti) {
      const arr = Array.isArray(current) ? [...current] : current ? [current] : [];
      if (arr.includes(optionValue)) {
        next = arr.filter((v) => v !== optionValue);
      } else {
        next = [...arr, optionValue];
      }
    } else {
      next = current === optionValue ? '' : optionValue;
    }

    onChange({
      ...values,
      [categoryId]: next
    });
  };

  // Select all options for current category
  const handleSelectAllCategory = () => {
    if (!activeCategory) return;
    const allVals = activeOptions.map((o) => o.value);
    onChange({
      ...values,
      [activeCategory.id]: allVals
    });
  };

  // Clear current category
  const handleClearCategory = (categoryId) => {
    const isMulti = activeCategory?.multi !== false;
    onChange({
      ...values,
      [categoryId]: isMulti ? [] : ''
    });
  };

  // Clear all filters across all categories
  const handleClearAll = () => {
    const cleared = {};
    filters.forEach((f) => {
      cleared[f.id] = f.multi === false ? '' : [];
    });
    onChange(cleared);
    if (onClear) onClear();
  };

  // Remove a single active filter chip
  const handleRemoveChip = (categoryId, valueToRemove) => {
    const current = values[categoryId];
    let next;
    if (Array.isArray(current)) {
      next = current.filter((v) => v !== valueToRemove);
    } else {
      next = '';
    }
    onChange({
      ...values,
      [categoryId]: next
    });
  };

  return (
    <>
      <div className="ufp-container" id={id}>
        {/* Trigger Button */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            setIsOpen((prev) => !prev);
            setCategorySearchQuery('');
          }}
          className={`ufp-trigger-btn ${totalActiveCount > 0 ? 'ufp-active' : ''}`}
          title="Filter and refine records"
          aria-expanded={isOpen}
        >
          <SlidersHorizontal size={14} color={totalActiveCount > 0 ? '#1d4ed8' : '#64748b'} />
          <span>{triggerLabel}</span>
          {totalActiveCount > 0 && (
            <span className="ufp-badge">{totalActiveCount}</span>
          )}
        </button>

        {/* Backdrop for click outside */}
        {isOpen && (
          <div className="ufp-backdrop" onClick={() => setIsOpen(false)} />
        )}

        {/* Popover Dropdown Card */}
        {isOpen && (
          <div
            ref={popoverRef}
            className={`ufp-popover ${align === 'right' ? 'ufp-align-right' : ''}`}
            role="dialog"
            aria-label="Filter Options"
          >
            {/* Header */}
            <div className="ufp-header">
              <div className="ufp-title-wrap">
                <Filter size={15} color="#2563eb" />
                <h3 className="ufp-title">Filters</h3>
                {totalActiveCount > 0 && (
                  <span className="ufp-badge">{totalActiveCount}</span>
                )}
              </div>
              <div className="ufp-header-actions">
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={totalActiveCount === 0}
                  className="ufp-reset-btn"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="ufp-close-btn"
                  aria-label="Close filters"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Two-Column Multi-Filter Body */}
            <div className="ufp-body">
              {/* Left Column: Category Navigation */}
              <div className="ufp-nav">
                {filters.map((cat) => {
                  const Icon = cat.icon || Filter;
                  const count = categoryCounts[cat.id] || 0;
                  const isCurrent = activeCategoryId === cat.id;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setActiveCategoryId(cat.id);
                        setCategorySearchQuery('');
                      }}
                      className={`ufp-nav-item ${isCurrent ? 'ufp-nav-active' : ''}`}
                    >
                      <div className="ufp-nav-label-wrap">
                        <Icon size={13} color={isCurrent ? '#2563eb' : '#64748b'} />
                        <span>{cat.label}</span>
                      </div>
                      {count > 0 && (
                        <span className="ufp-nav-badge">{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Active Category Options */}
              <div className="ufp-options-panel">
                {activeCategory ? (
                  <>
                    <div className="ufp-options-header">
                      <div className="ufp-search-box">
                        <Search
                          size={12}
                          color="#94a3b8"
                          style={{
                            position: 'absolute',
                            left: 7,
                            top: '50%',
                            transform: 'translateY(-50%)'
                          }}
                        />
                        <input
                          type="text"
                          value={categorySearchQuery}
                          onChange={(e) => setCategorySearchQuery(e.target.value)}
                          placeholder={`Search ${(activeCategory?.label || activeCategory?.name || 'options').toLowerCase()}...`}
                          className="ufp-search-input"
                        />
                        {categorySearchQuery && (
                          <button
                            type="button"
                            onClick={() => setCategorySearchQuery('')}
                            style={{
                              position: 'absolute',
                              right: 6,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              color: '#94a3b8'
                            }}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      {activeCategory.multi !== false && (
                        <div className="ufp-quick-actions">
                          <button
                            type="button"
                            onClick={handleSelectAllCategory}
                            className="ufp-text-action"
                          >
                            All
                          </button>
                          <span style={{ color: '#cbd5e1' }}>•</span>
                          <button
                            type="button"
                            onClick={() => handleClearCategory(activeCategory.id)}
                            className="ufp-text-action"
                          >
                            None
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="ufp-options-list">
                      {filteredOptions.length === 0 ? (
                        <div className="ufp-empty-msg">
                          No matching {activeCategory.label.toLowerCase()} found
                        </div>
                      ) : (
                        filteredOptions.map((opt) => {
                          const isSelected = isOptionSelected(
                            activeCategory.id,
                            opt.value
                          );

                          return (
                            <div
                              key={opt.value}
                              className={`ufp-option-item ${isSelected ? 'ufp-selected' : ''}`}
                              onClick={() =>
                                handleToggleOption(
                                  activeCategory.id,
                                  opt.value,
                                  activeCategory.multi !== false
                                )
                              }
                            >
                              <div className="ufp-checkbox">
                                {isSelected && <Check size={11} strokeWidth={3} />}
                              </div>
                              <span className="ufp-option-label" title={opt.label}>
                                {opt.label}
                              </span>
                              {opt.badge && (
                                <span className="ufp-option-badge">{opt.badge}</span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                ) : (
                  <div className="ufp-empty-msg">Select a filter category</div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="ufp-footer">
              <div className="ufp-footer-status">
                {totalActiveCount === 0
                  ? 'No filters applied'
                  : `${totalActiveCount} filter${totalActiveCount > 1 ? 's' : ''} applied`}
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="ufp-apply-btn"
              >
                <span>Done</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Active Filter Chips Bar (Shown when any filter is active) */}
      {showChips && activeFilterItems.length > 0 && (
        <div className="ufp-chips-bar">
          <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
            Active:
          </span>
          {activeFilterItems.map((item) => (
            <span key={`${item.categoryId}-${item.value}`} className="ufp-chip">
              <span className="ufp-chip-category">{item.categoryLabel}:</span>
              <span>{item.label}</span>
              <button
                type="button"
                onClick={() => handleRemoveChip(item.categoryId, item.value)}
                className="ufp-chip-remove"
                title={`Remove ${item.categoryLabel} filter`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={handleClearAll}
            className="ufp-clear-all-chips"
          >
            Clear all
          </button>
        </div>
      )}
    </>
  );
}
