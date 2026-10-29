import { useEffect, useRef } from 'react';
import { useHotkeysContext } from './HotkeyContext';
import { HotkeyDefinition, ShortcutHint } from './types';

export function useHotkeys(
  hotkeys: HotkeyDefinition[],
  deps: any[] = []
): void {
  const { registerHotkey } = useHotkeysContext();
  const hotkeysRef = useRef(hotkeys);
  hotkeysRef.current = hotkeys;

  useEffect(() => {
    const unregisterFns = hotkeysRef.current.map((def) => {
      return registerHotkey({
        ...def,
        handler: (e) => def.handler(e),
      });
    });

    return () => {
      unregisterFns.forEach((unreg) => unreg());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerHotkey, ...deps]);
}

/**
 * useHudHints: Convenient hook to publish context-aware shortcut hints to the bottom HUD bar
 */
export function useHudHints(hints: ShortcutHint[], sourceId: string): void {
  const { registerHudHints } = useHotkeysContext();
  const hintsRef = useRef(hints);
  hintsRef.current = hints;

  useEffect(() => {
    return registerHudHints(hintsRef.current, sourceId);
  }, [registerHudHints, sourceId]);
}
