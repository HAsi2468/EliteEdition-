/**
 * Enterprise ERP Keyboard-First Navigation Engine - Types & Interfaces
 * Complies with strict TypeScript rules and enterprise ERP standards.
 */

export const HOTKEY_PRIORITIES = {
  MODAL: 100,       // Highest: Modal dialogs, popovers, drawers
  CELL_EDIT: 80,    // Active cell inline editor in spreadsheet grids
  INPUT: 50,        // Active input fields, comboboxes, textareas
  GRID: 30,         // Data grid matrix traversal (roving tabindex)
  GLOBAL: 10,       // Application-wide fallback hotkeys
} as const;

export type HotkeyPriority = typeof HOTKEY_PRIORITIES[keyof typeof HOTKEY_PRIORITIES] | number;

export interface HotkeyDefinition {
  combo: string; // e.g., 'ctrl+s', 'f2', 'alt+c', 'shift+enter', '?', 'ctrl+enter'
  handler: (e: KeyboardEvent) => boolean | void; // return true to prevent lower priorities
  priority?: HotkeyPriority;
  description: string;
  category?: 'Global' | 'Vouchers' | 'Forms' | 'Grid' | 'Navigation' | 'Masters';
  preventDefault?: boolean;
  stopPropagation?: boolean;
  disabled?: boolean;
  scopeId?: string; // Optional scope (e.g. modal ID, form ID)
}

export interface ShortcutHint {
  key: string;        // Display label, e.g. 'F2', 'Ctrl+S', 'Enter', 'Alt+C'
  label: string;      // Action label, e.g. 'Change Date', 'Save Voucher', 'Next'
  action?: () => void;
  disabled?: boolean;
  category?: string;
  priority?: number;
}

export interface GridCellCoord {
  row: number;
  col: number;
}

export interface GridColumnDef<T = any> {
  key: string;
  header: string;
  width?: string | number;
  isEditable?: boolean;
  align?: 'left' | 'center' | 'right';
  type?: 'text' | 'number' | 'date' | 'select';
  options?: Array<{ label: string; value: any }>;
  render?: (value: any, row: T, rowIndex: number) => React.ReactNode;
}

export interface GridNavigationOptions<T = any> {
  columns: GridColumnDef<T>[];
  rowCount: number;
  onAddRow?: () => void;
  onDeleteRow?: (rowIndex: number) => void;
  onCommitCell?: (rowIndex: number, colKey: string, value: any) => void;
  onToggleSelectRow?: (rowIndex: number) => void;
  initialRow?: number;
  initialCol?: number;
  enableAutoRowInjection?: boolean;
}

export interface EnterAsTabOptions {
  onSubmit?: () => void;
  onCancel?: () => void;
  enableMathEvaluation?: boolean;
  selector?: string;
}
