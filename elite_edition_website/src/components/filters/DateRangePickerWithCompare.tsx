import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  format,
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfQuarter,
  endOfQuarter,
  subQuarters,
  subYears,
  addMonths,
  isSameDay,
  isWithinInterval,
  differenceInCalendarDays,
  isValid,
  parse,
  isAfter,
  isBefore,
} from 'date-fns';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  RotateCcw,
  GitCompare,
  X,
} from 'lucide-react';

export type ComparisonType = 'previous_period' | 'same_period_last_year';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface DateRangeWithCompareResult {
  from: Date;
  to: Date;
  preset?: string;
  formattedRange: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  compare?: {
    from: Date;
    to: Date;
    type: ComparisonType;
    formattedRange: string;
    startDate: string;
    endDate: string;
  };
}

export interface DateRangePickerWithCompareProps {
  value?: {
    from?: Date | string | null;
    to?: Date | string | null;
    preset?: string;
    compare?: {
      from?: Date | string | null;
      to?: Date | string | null;
      type?: ComparisonType;
    };
  };
  /**
   * Primary callback signature required by specifications
   */
  onDateChange?: (result: DateRangeWithCompareResult) => void;
  /**
   * Backward-compatible alternative alias for onDateChange
   */
  onChange?: (result: any) => void;
  preset?: string;
  datePreset?: string;
  customStart?: string;
  customEnd?: string;
  align?: 'left' | 'right' | 'auto';
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

interface PresetDefinition {
  id: string;
  label: string;
  getRange: () => { from: Date; to: Date };
}

/**
 * Calculates Indian Fiscal Year: 1st April of current financial year to 31st March of next
 */
function getIndianFiscalYearRange(): { from: Date; to: Date } {
  const now = new Date();
  const currentYear = now.getFullYear();
  // In India, April is month index 3
  const fyStartYear = now.getMonth() >= 3 ? currentYear : currentYear - 1;
  const from = startOfDay(new Date(fyStartYear, 3, 1));
  const to = endOfDay(new Date(fyStartYear + 1, 2, 31));
  return { from, to };
}

/**
 * Calculates Comparison period based on selected primary range
 */
export function calculateComparisonRange(
  from: Date,
  to: Date,
  type: ComparisonType
): { from: Date; to: Date } {
  if (type === 'same_period_last_year') {
    return {
      from: startOfDay(subYears(from, 1)),
      to: endOfDay(subYears(to, 1)),
    };
  }

  // 'previous_period': shift back by the exact number of days duration + 1
  const daysDiff = differenceInCalendarDays(to, from) + 1;
  return {
    from: startOfDay(subDays(from, daysDiff)),
    to: endOfDay(subDays(to, daysDiff)),
  };
}

export const DATE_PRESETS: PresetDefinition[] = [
  {
    id: 'today',
    label: 'Today',
    getRange: () => {
      const now = new Date();
      return { from: startOfDay(now), to: endOfDay(now) };
    },
  },
  {
    id: 'yesterday',
    label: 'Yesterday',
    getRange: () => {
      const y = subDays(new Date(), 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    },
  },
  {
    id: 'this_week',
    label: 'This Week',
    getRange: () => {
      const now = new Date();
      // Indian / ISO standard Monday start (weekStartsOn: 1)
      return {
        from: startOfDay(startOfWeek(now, { weekStartsOn: 1 })),
        to: endOfDay(endOfWeek(now, { weekStartsOn: 1 })),
      };
    },
  },
  {
    id: 'last_week',
    label: 'Last Week',
    getRange: () => {
      const prevWeek = subWeeks(new Date(), 1);
      return {
        from: startOfDay(startOfWeek(prevWeek, { weekStartsOn: 1 })),
        to: endOfDay(endOfWeek(prevWeek, { weekStartsOn: 1 })),
      };
    },
  },
  {
    id: 'last_7_days',
    label: 'Last 7 Days',
    getRange: () => {
      const now = new Date();
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    },
  },
  {
    id: 'this_month',
    label: 'This Month',
    getRange: () => {
      const now = new Date();
      return { from: startOfDay(startOfMonth(now)), to: endOfDay(endOfMonth(now)) };
    },
  },
  {
    id: 'previous_month',
    label: 'Previous Month',
    getRange: () => {
      const prevM = subMonths(new Date(), 1);
      return { from: startOfDay(startOfMonth(prevM)), to: endOfDay(endOfMonth(prevM)) };
    },
  },
  {
    id: 'last_30_days',
    label: 'Last 30 Days',
    getRange: () => {
      const now = new Date();
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    },
  },
  {
    id: 'this_quarter',
    label: 'This Quarter',
    getRange: () => {
      const now = new Date();
      return { from: startOfDay(startOfQuarter(now)), to: endOfDay(endOfQuarter(now)) };
    },
  },
  {
    id: 'current_fiscal_year',
    label: 'Current Fiscal Year',
    getRange: () => getIndianFiscalYearRange(),
  },
];

function parseDateInput(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Try YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const d = new Date(trimmed);
      return isValid(d) ? d : null;
    }
    // Try DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(trimmed)) {
      const parsed = parse(trimmed, 'dd/MM/yyyy', new Date());
      return isValid(parsed) ? parsed : null;
    }
    const fallback = new Date(trimmed);
    return isValid(fallback) ? fallback : null;
  }
  return null;
}

export default function DateRangePickerWithCompare({
  value,
  onDateChange,
  onChange,
  preset: propPreset,
  datePreset,
  customStart,
  customEnd,
  align = 'auto',
  disabled = false,
  className = '',
  placeholder = 'Select date range',
}: DateRangePickerWithCompareProps) {
  // 1. Initial State Resolution
  const initialPreset = datePreset || propPreset || value?.preset || 'this_month';
  const resolvedPresetDef = DATE_PRESETS.find((p) => p.id === initialPreset);
  const defaultInitialRange = resolvedPresetDef
    ? resolvedPresetDef.getRange()
    : { from: startOfDay(startOfMonth(new Date())), to: endOfDay(endOfMonth(new Date())) };

  const parsedPropFrom = parseDateInput(value?.from || customStart);
  const parsedPropTo = parseDateInput(value?.to || customEnd);

  // Applied (Committed) State
  const [appliedRange, setAppliedRange] = useState<DateRange>({
    from: parsedPropFrom || defaultInitialRange.from,
    to: parsedPropTo || defaultInitialRange.to,
  });
  const [appliedPreset, setAppliedPreset] = useState<string>(initialPreset);
  const [appliedCompareEnabled, setAppliedCompareEnabled] = useState<boolean>(!!value?.compare);
  const [appliedCompareType, setAppliedCompareType] = useState<ComparisonType>(
    value?.compare?.type || 'previous_period'
  );

  // Draft (In-Popover) Working State
  const [draftRange, setDraftRange] = useState<DateRange>(appliedRange);
  const [draftPreset, setDraftPreset] = useState<string>(appliedPreset);
  const [draftCompareEnabled, setDraftCompareEnabled] = useState<boolean>(appliedCompareEnabled);
  const [draftCompareType, setDraftCompareType] = useState<ComparisonType>(appliedCompareType);

  // Calendar Viewport Navigation (Left Calendar Month)
  const [viewMonth, setViewMonth] = useState<Date>(
    draftRange.from ? startOfMonth(draftRange.from) : startOfMonth(subMonths(new Date(), 1))
  );

  // Hover preview state during selection
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  // Popover Visibility & Positioning
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync prop changes
  useEffect(() => {
    if (value?.from && value?.to) {
      const from = parseDateInput(value.from);
      const to = parseDateInput(value.to);
      if (from && to) {
        setAppliedRange({ from, to });
        setDraftRange({ from, to });
      }
    }
  }, [value?.from, value?.to]);

  // Close popover on outside click or escape
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  // Recalculate view month when popover opens
  const handleOpenPopover = () => {
    if (disabled) return;
    setDraftRange(appliedRange);
    setDraftPreset(appliedPreset);
    setDraftCompareEnabled(appliedCompareEnabled);
    setDraftCompareType(appliedCompareType);
    if (appliedRange.from) {
      setViewMonth(startOfMonth(appliedRange.from));
    }
    setIsOpen(!isOpen);
  };

  // Preset Selection Click
  const handleSelectPreset = (p: PresetDefinition) => {
    const range = p.getRange();
    setDraftRange(range);
    setDraftPreset(p.id);
    setViewMonth(startOfMonth(range.from));
  };

  // Day Click in Dual Calendar
  const handleDayClick = (day: Date) => {
    setDraftPreset('custom');

    // Case 1: Starting new selection or both already selected
    if (!draftRange.from || (draftRange.from && draftRange.to)) {
      setDraftRange({ from: startOfDay(day), to: null });
      return;
    }

    // Case 2: Already picked 'from', now picking 'to'
    if (draftRange.from && !draftRange.to) {
      if (isBefore(day, draftRange.from)) {
        // User clicked earlier day: make it the new start
        setDraftRange({ from: startOfDay(day), to: null });
      } else {
        // Complete the range
        setDraftRange({ from: draftRange.from, to: endOfDay(day) });
      }
    }
  };

  // Compute Active Comparison Range for Draft
  const draftCompareRange = useMemo(() => {
    if (!draftCompareEnabled || !draftRange.from || !draftRange.to) return null;
    return calculateComparisonRange(draftRange.from, draftRange.to, draftCompareType);
  }, [draftCompareEnabled, draftRange.from, draftRange.to, draftCompareType]);

  // Apply Changes Commit
  const handleApply = useCallback(() => {
    if (!draftRange.from || !draftRange.to) return;

    setAppliedRange(draftRange);
    setAppliedPreset(draftPreset);
    setAppliedCompareEnabled(draftCompareEnabled);
    setAppliedCompareType(draftCompareType);
    setIsOpen(false);

    const from = draftRange.from;
    const to = draftRange.to;
    const formattedRange = `${format(from, 'dd/MM/yyyy')} - ${format(to, 'dd/MM/yyyy')}`;
    const startDate = format(from, 'yyyy-MM-dd');
    const endDate = format(to, 'yyyy-MM-dd');

    let compareResult: DateRangeWithCompareResult['compare'] = undefined;
    if (draftCompareEnabled && draftCompareRange) {
      compareResult = {
        from: draftCompareRange.from,
        to: draftCompareRange.to,
        type: draftCompareType,
        formattedRange: `${format(draftCompareRange.from, 'dd/MM/yyyy')} - ${format(
          draftCompareRange.to,
          'dd/MM/yyyy'
        )}`,
        startDate: format(draftCompareRange.from, 'yyyy-MM-dd'),
        endDate: format(draftCompareRange.to, 'yyyy-MM-dd'),
      };
    }

    const result: DateRangeWithCompareResult = {
      from,
      to,
      preset: draftPreset,
      formattedRange,
      startDate,
      endDate,
      compare: compareResult,
    };

    if (onDateChange) {
      onDateChange(result);
    }
    if (onChange) {
      // Provide backwards compatible shape with legacy DateRangePicker
      onChange({
        preset: draftPreset,
        dateStart: startDate,
        dateEnd: endDate,
        startDate,
        endDate,
        from,
        to,
        labelText: formattedRange,
        compare: compareResult,
      });
    }
  }, [
    draftRange,
    draftPreset,
    draftCompareEnabled,
    draftCompareType,
    draftCompareRange,
    onDateChange,
    onChange,
  ]);

  // Cancel Handler
  const handleCancel = () => {
    setDraftRange(appliedRange);
    setDraftPreset(appliedPreset);
    setDraftCompareEnabled(appliedCompareEnabled);
    setDraftCompareType(appliedCompareType);
    setIsOpen(false);
  };

  // Trigger Button Formatted Label
  const triggerLabel = useMemo(() => {
    if (!appliedRange.from || !appliedRange.to) return placeholder;
    return `${format(appliedRange.from, 'dd/MM/yyyy')} - ${format(appliedRange.to, 'dd/MM/yyyy')}`;
  }, [appliedRange, placeholder]);

  // Months for Dual Calendar (Left = viewMonth, Right = next month)
  const rightMonth = useMemo(() => addMonths(viewMonth, 1), [viewMonth]);

  return (
    <div className={`relative inline-block text-left ${className}`}>
      {/* ── 1. TRIGGER BUTTON (White bg, rounded-lg, dark font, soft border) ── */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleOpenPopover}
        className={`inline-flex items-center justify-between gap-2.5 px-3 py-2 bg-white text-slate-800 font-medium text-xs sm:text-sm rounded-lg border border-slate-200 shadow-xs hover:border-slate-300 hover:bg-slate-50/80 active:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'cursor-pointer'
        } ${isOpen ? 'ring-2 ring-emerald-500/20 border-emerald-600' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2 truncate">
          <CalendarIcon className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="truncate">{triggerLabel}</span>
        </span>

        {appliedCompareEnabled && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200/80 shrink-0">
            <GitCompare className="w-2.5 h-2.5" />
            <span>Comp</span>
          </span>
        )}

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* ── 2. POPOVER CONTAINER (Dual Month + Sidebar + Compare Footer) ── */}
      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Date Range Picker with Compare Mode"
          className={`absolute z-50 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          style={{ width: 'min(780px, 96vw)' }}
        >
          {/* Main Content: Left Sidebar + Center/Right Dual Calendar */}
          <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100 max-h-[75vh] md:max-h-none overflow-y-auto">
            {/* ── LEFT SIDEBAR: Quick Presets ── */}
            <div className="w-full md:w-64 bg-slate-50/70 p-2.5 flex flex-col gap-0.5 shrink-0 select-none">
              <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Quick Presets
              </div>

              <div className="flex flex-col gap-0.5 overflow-y-auto max-h-56 md:max-h-[380px] pr-1">
                {DATE_PRESETS.map((p) => {
                  const range = p.getRange();
                  const isSelected = draftPreset === p.id;
                  const rangeSubtitle = `${format(range.from, 'dd/MM')} - ${format(range.to, 'dd/MM')}`;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-800 font-semibold border-l-3 border-emerald-600 shadow-2xs'
                          : 'text-slate-700 hover:bg-slate-100/90 font-medium'
                      }`}
                    >
                      <span className="truncate">{p.label}</span>
                      <span
                        className={`text-[11px] tabular-nums shrink-0 ml-2 ${
                          isSelected ? 'text-emerald-700 font-medium' : 'text-slate-400'
                        }`}
                      >
                        {rangeSubtitle}
                      </span>
                    </button>
                  );
                })}

                {/* Custom Range Indicator */}
                <button
                  type="button"
                  onClick={() => setDraftPreset('custom')}
                  className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left mt-1 ${
                    draftPreset === 'custom'
                      ? 'bg-emerald-50 text-emerald-800 font-semibold border-l-3 border-emerald-600 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100 font-medium'
                  }`}
                >
                  <span>Custom Range</span>
                  {draftRange.from && draftRange.to && (
                    <span className="text-[11px] text-slate-400 tabular-nums ml-2">
                      {format(draftRange.from, 'dd/MM')} - {format(draftRange.to, 'dd/MM')}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* ── CENTER/RIGHT: DUAL MONTH INTERACTIVE CALENDAR ── */}
            <div className="flex-1 p-3.5 bg-white flex flex-col gap-3">
              {/* Header Navigation: Prev Month, Current Month Labels, Next Month */}
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => setViewMonth(subMonths(viewMonth, 1))}
                  className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                  title="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center justify-around flex-1 px-4 text-xs font-semibold text-slate-800">
                  <span>{format(viewMonth, 'MMMM yyyy')}</span>
                  <span className="hidden sm:inline text-slate-300">|</span>
                  <span className="hidden sm:inline">{format(rightMonth, 'MMMM yyyy')}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                  className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                  title="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Calendars Grid: 1 Month on Mobile, 2 Months on sm/md */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Month 1: Left */}
                <MonthCalendarView
                  monthDate={viewMonth}
                  range={draftRange}
                  hoverDate={hoverDate}
                  compareRange={draftCompareRange}
                  onDayClick={handleDayClick}
                  onDayHover={setHoverDate}
                />

                {/* Month 2: Right */}
                <div className="hidden sm:block">
                  <MonthCalendarView
                    monthDate={rightMonth}
                    range={draftRange}
                    hoverDate={hoverDate}
                    compareRange={draftCompareRange}
                    onDayClick={handleDayClick}
                    onDayHover={setHoverDate}
                  />
                </div>
              </div>

              {/* Range Status Line */}
              <div className="flex items-center justify-between pt-1 px-1 text-xs text-slate-500 border-t border-slate-100">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                  <span className="font-medium text-slate-700">Selected:</span>
                  <span className="tabular-nums font-semibold text-emerald-800">
                    {draftRange.from ? format(draftRange.from, 'dd/MM/yyyy') : '--/--/----'}
                    {' → '}
                    {draftRange.to ? format(draftRange.to, 'dd/MM/yyyy') : '--/--/----'}
                  </span>
                  {draftRange.from && draftRange.to && (
                    <span className="text-[11px] text-slate-400">
                      ({differenceInCalendarDays(draftRange.to, draftRange.from) + 1} days)
                    </span>
                  )}
                </span>

                {draftCompareEnabled && draftCompareRange && (
                  <span className="flex items-center gap-1.5 text-amber-700">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    <span className="font-medium">Compare:</span>
                    <span className="tabular-nums font-medium">
                      {format(draftCompareRange.from, 'dd/MM/yyyy')} - {format(draftCompareRange.to, 'dd/MM/yyyy')}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── 3. BOTTOM FOOTER: Period Compare Mode Toggle + Action Buttons ── */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Compare to Period Toggle */}
            <div className="flex items-center flex-wrap gap-2.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={draftCompareEnabled}
                  onChange={(e) => setDraftCompareEnabled(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <GitCompare className="w-3.5 h-3.5 text-slate-500" />
                  <span>Compare to period:</span>
                </span>
              </label>

              {draftCompareEnabled && (
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setDraftCompareType('previous_period')}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                      draftCompareType === 'previous_period'
                        ? 'bg-amber-100 text-amber-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Previous Period
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftCompareType('same_period_last_year')}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                      draftCompareType === 'same_period_last_year'
                        ? 'bg-amber-100 text-amber-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Same Period Last Year
                  </button>
                </div>
              )}
            </div>

            {/* Cancel & Apply CTA Buttons */}
            <div className="flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!draftRange.from || !draftRange.to}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                  draftRange.from && draftRange.to
                    ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Single Month Calendar Grid Component
 */
interface MonthCalendarViewProps {
  monthDate: Date;
  range: DateRange;
  hoverDate: Date | null;
  compareRange: { from: Date; to: Date } | null;
  onDayClick: (day: Date) => void;
  onDayHover: (day: Date | null) => void;
}

function MonthCalendarView({
  monthDate,
  range,
  hoverDate,
  compareRange,
  onDayClick,
  onDayHover,
}: MonthCalendarViewProps) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const daysInMonth = monthEnd.getDate();

  // Determine weekday offset for 1st of month (Monday start = 0)
  // getDay() gives 0 for Sunday, 1 for Monday...
  const firstDayOfWeek = (monthStart.getDay() + 6) % 7;

  // Build grid days
  const days: Date[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), i));
  }

  const weekLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const today = new Date();

  // Active or Preview End calculation
  const effectiveEnd = range.to || (range.from && hoverDate && isAfter(hoverDate, range.from) ? hoverDate : null);

  return (
    <div className="w-full select-none" onMouseLeave={() => onDayHover(null)}>
      {/* Day of week labels */}
      <div className="grid grid-cols-7 mb-1.5 text-center text-[11px] font-semibold text-slate-400">
        {weekLabels.map((lbl) => (
          <div key={lbl} className="py-0.5">
            {lbl}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {/* Leading empty slots */}
        {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
          <div key={`empty-${idx}`} className="h-8" />
        ))}

        {days.map((day) => {
          const isStart = range.from && isSameDay(day, range.from);
          const isEnd = effectiveEnd && isSameDay(day, effectiveEnd);
          const isWithin =
            range.from && effectiveEnd && isWithinInterval(day, { start: range.from, end: effectiveEnd });
          const isTodayDate = isSameDay(day, today);

          // Comparison range highlight
          const isInCompare =
            compareRange &&
            isWithinInterval(day, { start: compareRange.from, end: compareRange.to });

          let dayClasses =
            'relative h-8 flex items-center justify-center text-xs font-medium cursor-pointer transition-colors';

          if (isStart && isEnd) {
            dayClasses += ' bg-emerald-600 text-white font-bold rounded-lg shadow-xs z-10';
          } else if (isStart) {
            dayClasses += ' bg-emerald-600 text-white font-bold rounded-l-lg shadow-xs z-10';
          } else if (isEnd) {
            dayClasses += ' bg-emerald-600 text-white font-bold rounded-r-lg shadow-xs z-10';
          } else if (isWithin) {
            dayClasses += ' bg-emerald-50 text-emerald-900 font-semibold';
          } else if (isInCompare) {
            dayClasses += ' bg-amber-50/80 text-amber-900 border-y border-dashed border-amber-300';
          } else {
            dayClasses += ' text-slate-700 hover:bg-slate-100 rounded-md';
          }

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onDayClick(day)}
              onMouseEnter={() => onDayHover(day)}
              className={dayClasses}
            >
              <span>{day.getDate()}</span>
              {isTodayDate && !isStart && !isEnd && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-600" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
