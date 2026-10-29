import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import {
  HOTKEY_PRIORITIES,
  HotkeyDefinition,
  HotkeyPriority,
  ShortcutHint,
} from './types';
import { matchesCombo, isTextInputActive } from './keyUtils';
import {
  switchActiveSubTab,
  activateSidebarModule,
  focusSidebar,
  focusSearchInput,
  cyclePanes,
  handleGlobalEnterAsTab,
} from './navigationHelpers';

interface HotkeyContextValue {
  registerHotkey: (def: HotkeyDefinition) => () => void;
  registerHudHints: (hints: ShortcutHint[], sourceId: string) => () => void;
  activeHudHints: ShortcutHint[];
  isAltModeActive: boolean;
  isCheatSheetOpen: boolean;
  openCheatSheet: () => void;
  closeCheatSheet: () => void;
  toggleCheatSheet: () => void;
  isKeyboardLockSupported: boolean;
  isKeyboardLockActive: boolean;
  toggleKeyboardLock: () => Promise<void>;
  triggerHierarchicalEsc: () => boolean;
  registerEscHandler: (handler: () => boolean, priority: number) => () => void;
}

const HotkeyContext = createContext<HotkeyContextValue | null>(null);

export const HotkeyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const hotkeysRef = useRef<Map<string, HotkeyDefinition>>(new Map());
  const escHandlersRef = useRef<Array<{ handler: () => boolean; priority: number; id: string }>>([]);
  const hudHintsMapRef = useRef<Map<string, ShortcutHint[]>>(new Map());

  const [activeHudHints, setActiveHudHints] = useState<ShortcutHint[]>([]);
  const [isAltModeActive, setIsAltModeActive] = useState<boolean>(false);
  const [isCheatSheetOpen, setIsCheatSheetOpen] = useState<boolean>(false);
  const [isKeyboardLockActive, setIsKeyboardLockActive] = useState<boolean>(false);

  const altPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAltDownRef = useRef<boolean>(false);

  // Re-calculate active HUD hints whenever registrations change
  const refreshHudHints = useCallback(() => {
    const allHints: ShortcutHint[] = [];
    hudHintsMapRef.current.forEach((hints) => {
      allHints.push(...hints);
    });

    // Deduplicate by key and sort by priority
    const mapByKey = new Map<string, ShortcutHint>();
    allHints.forEach((h) => {
      const hintKey = String(h?.key || '').toUpperCase();
      if (!hintKey) return;
      const existing = mapByKey.get(hintKey);
      if (!existing || (h.priority || 0) >= (existing.priority || 0)) {
        mapByKey.set(hintKey, h);
      }
    });

    const sorted = Array.from(mapByKey.values()).sort(
      (a, b) => (b.priority || 0) - (a.priority || 0)
    );
    setActiveHudHints(sorted);
  }, []);

  const registerHudHints = useCallback((hints: ShortcutHint[], sourceId: string) => {
    hudHintsMapRef.current.set(sourceId, hints);
    refreshHudHints();
    return () => {
      hudHintsMapRef.current.delete(sourceId);
      refreshHudHints();
    };
  }, [refreshHudHints]);

  const registerHotkey = useCallback((def: HotkeyDefinition) => {
    const id = `${def.combo}__${def.priority || HOTKEY_PRIORITIES.GLOBAL}__${Math.random()}`;
    hotkeysRef.current.set(id, def);
    return () => {
      hotkeysRef.current.delete(id);
    };
  }, []);

  const registerEscHandler = useCallback((handler: () => boolean, priority: number) => {
    const id = `esc__${priority}__${Math.random()}`;
    escHandlersRef.current.push({ handler, priority, id });
    escHandlersRef.current.sort((a, b) => b.priority - a.priority);
    return () => {
      escHandlersRef.current = escHandlersRef.current.filter((item) => item.id !== id);
    };
  }, []);

  const triggerHierarchicalEsc = useCallback((): boolean => {
    // Traverse registered ESC handlers in descending priority order
    for (const item of escHandlersRef.current) {
      const handled = item.handler();
      if (handled) return true;
    }
    return false;
  }, []);

  // Keyboard Lock (PWA Fullscreen Mode)
  const isKeyboardLockSupported = typeof navigator !== 'undefined' && 'keyboard' in navigator && !!(navigator as any).keyboard?.lock;

  const toggleKeyboardLock = useCallback(async () => {
    if (!isKeyboardLockSupported) return;
    try {
      const navKey = (navigator as any).keyboard;
      if (isKeyboardLockActive) {
        navKey.unlock();
        setIsKeyboardLockActive(false);
      } else {
        await navKey.lock([
          'Escape', 'Tab', 'KeyF', 'KeyK', 'KeyS', 'KeyP', 'KeyE',
          'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
        ]);
        setIsKeyboardLockActive(true);
      }
    } catch (err) {
      console.warn('[Keyboard Engine] Keyboard lock request failed:', err);
    }
  }, [isKeyboardLockActive, isKeyboardLockSupported]);

  // Master Centralized Hotkey Dispatcher
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Intercept Browser Collisions (F1-F12, Ctrl+S, Ctrl+P, Ctrl+K, Ctrl+Enter, Alt+[Key])
      const rawKey = e.key || '';
      const key = rawKey.toLowerCase();
      const upperKey = rawKey.toUpperCase();
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const isAlt = e.altKey;

      const isFKey = /^f([1-9]|1[0-2])$/i.test(rawKey);
      const isBrowserSave = isCtrlOrMeta && (key === 's' || key === 'a');
      const isBrowserPrint = isCtrlOrMeta && key === 'p';
      const isBrowserSearch = isCtrlOrMeta && (key === 'k' || key === 'e');
      const isSavePrint = isCtrlOrMeta && key === 'enter';

      // Always block default unwanted OS/browser actions for ERP critical hotkeys
      if (isFKey && upperKey !== 'F5' && upperKey !== 'F12') {
        // Block default F1 (Help), F3 (Search), F7 (Caret), F11 etc.
        e.preventDefault();
      }
      if (isBrowserSave || isBrowserPrint || isBrowserSearch || isSavePrint) {
        e.preventDefault();
      }

      // Alt key hold / tap detection for mnemonic badges
      if (e.key === 'Alt') {
        if (!isAltDownRef.current) {
          isAltDownRef.current = true;
          altPressTimerRef.current = setTimeout(() => {
            setIsAltModeActive(true);
            document.body.setAttribute('data-erp-alt-mode', 'true');
          }, 300);
        }
      }

      // 2. Multi-level hierarchical ESC
      if (key === 'escape' || key === 'esc') {
        const handledByEscStack = triggerHierarchicalEsc();
        if (handledByEscStack) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // 3. Question mark (?) shortcut for cheat sheet when not in an editable text input
      if ((e.key === '?' || (e.shiftKey && e.key === '/')) && !isTextInputActive()) {
        e.preventDefault();
        setIsCheatSheetOpen((prev) => !prev);
        return;
      }

      // 4. Gather and Sort Registered Hotkeys by Priority (Descending)
      const registered = Array.from(hotkeysRef.current.values())
        .filter((h) => !h.disabled)
        .sort((a, b) => (b.priority ?? HOTKEY_PRIORITIES.GLOBAL) - (a.priority ?? HOTKEY_PRIORITIES.GLOBAL));

      const inInput = isTextInputActive();

      for (const def of registered) {
        if (matchesCombo(e, def.combo)) {
          const priority = def.priority ?? HOTKEY_PRIORITIES.GLOBAL;

          // If user is inside an input, only allow:
          // - High priority handlers (>= 50: INPUT, CELL_EDIT, MODAL)
          // - OR explicit function keys (F1-F12)
          // - OR Ctrl/Cmd/Alt shortcuts (Ctrl+S, Ctrl+Enter, Alt+C, etc.)
          if (inInput && priority < HOTKEY_PRIORITIES.INPUT) {
            const hasModifier = e.ctrlKey || e.metaKey || e.altKey || isFKey;
            if (!hasModifier) {
              continue;
            }
          }

          if (def.preventDefault !== false) {
            e.preventDefault();
          }
          if (def.stopPropagation !== false) {
            e.stopPropagation();
          }

          const handled = def.handler(e);

          // If handler returns true or handled, halt lower priority processing immediately
          if (handled !== false) {
            return;
          }
        }
      }

      // 5. Universal Sub-Tab Switching (Alt + ArrowRight/Left or Ctrl + ]/[)
      if ((e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) ||
          (isCtrlOrMeta && (e.key === ']' || e.key === '['))) {
        const direction = (e.key === 'ArrowRight' || e.key === ']') ? 'next' : 'prev';
        const switched = switchActiveSubTab(direction);
        if (switched) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // 6. Direct Sub-Tab Jump (Ctrl + 1..9)
      if (isCtrlOrMeta && !e.altKey && /^[1-9]$/.test(e.key)) {
        const switched = switchActiveSubTab(Number(e.key) - 1);
        if (switched) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // 7. Direct Sidebar Module Jump (Alt + 1..9)
      if (e.altKey && !isCtrlOrMeta && /^[1-9]$/.test(e.key)) {
        const activated = activateSidebarModule(Number(e.key) - 1);
        if (activated) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // 8. Focus Sidebar (Alt + S or F10)
      if ((e.altKey && key === 's') || upperKey === 'F10') {
        const focused = focusSidebar();
        if (focused) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // 9. Toggle Sidebar Collapse (Ctrl + B)
      if (isCtrlOrMeta && key === 'b') {
        window.dispatchEvent(new CustomEvent('elite:toggle-sidebar'));
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // 10. Universal Pane Cycler (F6: Sidebar <-> Main Content <-> Search)
      if (upperKey === 'F6') {
        const cycled = cyclePanes();
        if (cycled) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // 11. Quick Search Focus (/ when outside inputs, or Ctrl + F)
      if ((key === '/' && !inInput) || (isCtrlOrMeta && key === 'f')) {
        e.preventDefault();
        const focused = focusSearchInput();
        if (!focused) {
          window.dispatchEvent(new CustomEvent('elite:open-global-search'));
        }
        return;
      }

      // 12. Universal Fallback Enter-As-Tab with Inline Math Evaluation
      if (e.key === 'Enter') {
        const handledTab = handleGlobalEnterAsTab(e);
        if (handledTab) {
          return;
        }
      }
    };

    const clearAltMode = () => {
      if (altPressTimerRef.current) {
        clearTimeout(altPressTimerRef.current);
        altPressTimerRef.current = null;
      }
      setIsAltModeActive(false);
      document.body.removeAttribute('data-erp-alt-mode');
      isAltDownRef.current = false;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        clearAltMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    window.addEventListener('blur', clearAltMode);
    window.addEventListener('click', clearAltMode);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
      window.removeEventListener('blur', clearAltMode);
      window.removeEventListener('click', clearAltMode);
    };
  }, [triggerHierarchicalEsc, isAltModeActive]);

  return (
    <HotkeyContext.Provider
      value={{
        registerHotkey,
        registerHudHints,
        activeHudHints,
        isAltModeActive,
        isCheatSheetOpen,
        openCheatSheet: () => setIsCheatSheetOpen(true),
        closeCheatSheet: () => setIsCheatSheetOpen(false),
        toggleCheatSheet: () => setIsCheatSheetOpen((p) => !p),
        isKeyboardLockSupported,
        isKeyboardLockActive,
        toggleKeyboardLock,
        triggerHierarchicalEsc,
        registerEscHandler,
      }}
    >
      {children}
    </HotkeyContext.Provider>
  );
};

export function useHotkeysContext(): HotkeyContextValue {
  const context = useContext(HotkeyContext);
  if (!context) {
    throw new Error('useHotkeysContext must be used within a HotkeyProvider');
  }
  return context;
}
