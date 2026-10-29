/**
 * Enterprise Keyboard-First Navigation Engine - Public API
 */

import './keyboardStyles.css';

// Types & Enums
export * from './types';

// Core Utilities
export { evaluateMathExpression } from './mathEvaluator';
export { normalizeCombo, matchesCombo, isTextInputActive } from './keyUtils';
export {
  processInputMath,
  handleGlobalEnterAsTab,
  switchActiveSubTab,
  focusSidebar,
  focusMainContent,
  focusSearchInput,
  cyclePanes,
  activateSidebarModule,
} from './navigationHelpers';

// Context & Priority Dispatcher
export {
  HotkeyProvider,
  useHotkeysContext,
} from './HotkeyContext';

// Hooks
export { useHotkeys, useHudHints } from './useHotkeys';
export { useEnterAsTab } from './useEnterAsTab';
export { useGridNavigation } from './useGridNavigation';

// Components
export { HotkeyHUD } from './components/HotkeyHUD';
export { ShortcutCheatSheetModal } from './components/ShortcutCheatSheetModal';
export { KeyboardNavOnboardingBanner } from './components/KeyboardNavOnboardingBanner';
export { MnemonicBadge } from './components/MnemonicBadge';
export { VoucherEntryExample } from './components/VoucherEntryExample';
