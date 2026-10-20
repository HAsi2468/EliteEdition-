/**
 * Dynamic ERP Multi-Filter System - TypeScript Interface Definitions
 * 
 * Provides type contracts for config-driven multi-table filtering across
 * all ERP modules (Orders, Inventory/Lots, Job Cards, Billing, Dispatch).
 */

export type FilterFieldType = 
  | 'text' 
  | 'select' 
  | 'multi-select' 
  | 'date-range' 
  | 'number-range';

export interface FilterOption {
  label: string;
  value: string | number;
  badge?: string;
  count?: number;
  color?: string;
}

export interface DateRangeValue {
  from?: Date | string | null;
  to?: Date | string | null;
  preset?: string;
  compare?: {
    from: Date | string;
    to: Date | string;
    type?: 'previous_period' | 'same_period_last_year';
  };
}

export interface NumberRangeValue {
  min?: number | null;
  max?: number | null;
}

export type FilterValue = 
  | string 
  | number 
  | (string | number)[] 
  | DateRangeValue 
  | NumberRangeValue 
  | null 
  | undefined;

export type FilterState = Record<string, FilterValue>;

export interface FilterFieldConfig {
  /** Unique key identifying the filter in the state object (e.g., 'status', 'partyId', 'createdAt') */
  key: string;
  /** Human-readable label displayed in UI (e.g., 'Order Status', 'Party / Customer') */
  label: string;
  /** Component control type to render */
  type: FilterFieldType;
  /** Placeholder text for inputs */
  placeholder?: string;
  /** If true, renders directly in the primary top toolbar for rapid 1-click access */
  quickFilter?: boolean;
  /** Section / Accordion group inside the slide-over drawer (e.g., 'Workflow', 'Dimensions', 'Financials') */
  section?: string;
  /** Static options list OR an async function that fetches options dynamically from an API */
  options?: FilterOption[] | (() => Promise<FilterOption[]>);
  /** Default value when initialized or reset */
  defaultValue?: FilterValue;
  /** Description or tooltip explanation */
  description?: string;

  // Number range specific options
  min?: number;
  max?: number;
  step?: number;
  unit?: string; // e.g. '₹', 'Mtr', 'Pcs', 'Kg'

  // Select / Multi-Select options
  searchable?: boolean;
}

export interface ActiveFilterChip {
  key: string;
  label: string;
  displayValue: string;
  rawValue: FilterValue;
  type: FilterFieldType;
  /** For multi-select chips, allows removing an individual item without clearing the whole array */
  subValue?: string | number;
}

export interface FilterApiPayload {
  page: number;
  limit: number;
  search?: string;
  filters: Record<string, any>;
  startDate?: string;
  endDate?: string;
  compareStartDate?: string;
  compareEndDate?: string;
  [key: string]: any;
}
