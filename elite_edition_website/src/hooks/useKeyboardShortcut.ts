/**
 * useKeyboardShortcut – bulletproof keyboard shortcut guard (React 18, TypeScript).
 *
 * PREVENTIVE: the QA log (BUG-001..062) contains NO keyboard-shortcut or key-collision
 * defect. The only keyboard item logged is BUG-032 (Esc does not close the PDF preview),
 * which this hook also covers via `allowInInputs` + the "Escape" combo.
 *
 * Features
 *  - Skips events whose target is <input>, <textarea>, <select>, [contenteditable],
 *    role="textbox" | "combobox" | "searchbox" | "spinbutton" (incl. inside shadow DOM via composedPath()).
 *  - Skips IME composition (isComposing / keyCode 229) so Hindi/Gujarati IMEs never fire shortcuts.
 *  - "Mod" maps to ⌘ Cmd on Apple platforms and Ctrl elsewhere (userAgentData → platform → UA).
 *  - Combo registry: one shared window listener; many components register/unregister.
 *  - Scopes + priority: the highest-priority enabled binding wins (e.g. a modal over a page).
 *  - Ignores auto-repeat by default; cleans up on unmount; SSR-safe.
 */
import { useEffect, useRef } from 'react';

export type Combo = string; // e.g. "Mod+S", "Shift+Mod+K", "Escape", "Alt+N", "?"

export interface ShortcutOptions {
  /** Fire even when focus is in an editable field (use for Escape / Mod+Enter on forms). */
  allowInInputs?: boolean;
  /** Higher wins when two bindings share a combo (default 0; modals use 100). */
  priority?: number;
  /** Disable without unregistering (e.g. while a submit is in flight). */
  enabled?: boolean;
  /** Call preventDefault (default true). Mod+S otherwise opens the browser "Save page" dialog. */
  preventDefault?: boolean;
  /** Fire on auto-repeat keydown (default false). */
  allowRepeat?: boolean;
  /** Optional description for a "?" help overlay. */
  description?: string;
}

interface Binding {
  id: number;
  combo: NormalizedCombo;
  handler: (e: KeyboardEvent) => void;
  opts: Required<Omit<ShortcutOptions, 'description'>> & { description?: string };
}

interface NormalizedCombo {
  key: string; // lower-case KeyboardEvent.key, or code-derived for letters/digits
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
  raw: string;
}

/* ------------------------------------------------------------------ platform */

export function isApplePlatform(nav: Navigator | undefined = typeof navigator !== 'undefined' ? navigator : undefined): boolean {
  if (!nav) return false;
  const uaData = (nav as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const p = (uaData?.platform || nav.platform || nav.userAgent || '').toLowerCase();
  return /mac|iphone|ipad|ipod/.test(p);
}

/* ------------------------------------------------------------------ parsing */

const KEY_ALIASES: Record<string, string> = {
  esc: 'escape', return: 'enter', space: ' ', spacebar: ' ', del: 'delete',
  up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright', plus: '+',
};

export function parseCombo(combo: Combo, apple = isApplePlatform()): NormalizedCombo {
  const parts = combo.split('+').map((s) => s.trim()).filter(Boolean);
  // support "Mod++" (plus key)
  if (combo.endsWith('++')) parts.push('+');
  const out: NormalizedCombo = { key: '', ctrl: false, meta: false, alt: false, shift: false, raw: combo };
  for (const p of parts) {
    const l = p.toLowerCase();
    if (l === 'mod') apple ? (out.meta = true) : (out.ctrl = true);
    else if (l === 'ctrl' || l === 'control') out.ctrl = true;
    else if (l === 'cmd' || l === 'meta' || l === 'command') out.meta = true;
    else if (l === 'alt' || l === 'option' || l === 'opt') out.alt = true;
    else if (l === 'shift') out.shift = true;
    else out.key = KEY_ALIASES[l] ?? l;
  }
  if (!out.key) throw new Error(`Shortcut "${combo}" has no key`);
  return out;
}

/** Layout-independent key: Alt/Option on macOS changes e.key ("ß" for Alt+S), so use e.code for letters/digits. */
export function eventKey(e: Pick<KeyboardEvent, 'key' | 'code'>): string {
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(e.code)) return e.code.slice(5);
  return (e.key || '').toLowerCase();
}

export function matches(e: KeyboardEvent, c: NormalizedCombo): boolean {
  // Shift is implied for printable symbols like "?" – only compare shift when the combo key is a letter/named key.
  const symbol = c.key.length === 1 && !/[a-z0-9]/.test(c.key);
  const key = symbol ? (e.key || '').toLowerCase() : eventKey(e);
  return key === c.key && e.ctrlKey === c.ctrl && e.metaKey === c.meta && e.altKey === c.alt && (symbol || e.shiftKey === c.shift);
}

/* ------------------------------------------------------------------ editable-target guard */

const EDITABLE_ROLES = new Set(['textbox', 'combobox', 'searchbox', 'spinbutton']);
const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'image', 'range', 'color']);

export function isEditableElement(el: Element | null | undefined): boolean {
  if (!el || typeof (el as HTMLElement).tagName !== 'string') return false;
  const h = el as HTMLElement;
  const tag = h.tagName.toLowerCase();
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag === 'input') return !NON_TEXT_INPUTS.has(((h as HTMLInputElement).type || 'text').toLowerCase());
  if (h.isContentEditable || h.getAttribute('contenteditable') === '' || h.getAttribute('contenteditable') === 'true') return true;
  const role = h.getAttribute('role');
  return !!role && EDITABLE_ROLES.has(role.toLowerCase());
}

/** Walks composedPath() so editors inside shadow roots / rich-text wrappers are detected. */
export function isTypingContext(e: KeyboardEvent): boolean {
  const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
  for (const node of path) {
    if (node instanceof Element && isEditableElement(node)) return true;
    if (node instanceof Element && node.closest?.('[contenteditable="true"],[contenteditable=""]')) return true;
  }
  return isEditableElement(e.target as Element | null);
}

export function isComposing(e: KeyboardEvent): boolean {
  // keyCode 229 = IME processing (Safari/Chrome on Android don't always set isComposing)
  return e.isComposing || e.keyCode === 229;
}

/* ------------------------------------------------------------------ registry */

class ShortcutRegistry {
  private bindings: Binding[] = [];
  private seq = 0;
  private attached = false;
  private readonly onKeyDown = (e: KeyboardEvent): void => this.dispatch(e);

  register(combo: Combo, handler: (e: KeyboardEvent) => void, o: ShortcutOptions = {}): () => void {
    const b: Binding = {
      id: ++this.seq,
      combo: parseCombo(combo),
      handler,
      opts: {
        allowInInputs: o.allowInInputs ?? false,
        priority: o.priority ?? 0,
        enabled: o.enabled ?? true,
        preventDefault: o.preventDefault ?? true,
        allowRepeat: o.allowRepeat ?? false,
        description: o.description,
      },
    };
    this.bindings.push(b);
    this.attach();
    return () => {
      this.bindings = this.bindings.filter((x) => x.id !== b.id);
      if (this.bindings.length === 0) this.detach();
    };
  }

  list(): Array<{ combo: string; description?: string }> {
    return this.bindings.map((b) => ({ combo: b.combo.raw, description: b.opts.description }));
  }

  dispatch(e: KeyboardEvent): void {
    if (e.defaultPrevented || isComposing(e)) return;
    const typing = isTypingContext(e);
    let best: Binding | undefined;
    for (const b of this.bindings) {
      if (!b.opts.enabled) continue;
      if (e.repeat && !b.opts.allowRepeat) continue;
      if (typing && !b.opts.allowInInputs) continue;
      if (!matches(e, b.combo)) continue;
      // highest priority wins; among equals, the most recently registered (innermost component) wins
      if (!best || b.opts.priority > best.opts.priority || (b.opts.priority === best.opts.priority && b.id > best.id)) best = b;
    }
    if (!best) return;
    if (best.opts.preventDefault) e.preventDefault();
    e.stopPropagation();
    best.handler(e);
  }

  private attach(): void {
    if (this.attached || typeof window === 'undefined') return;
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
    this.attached = true;
  }

  private detach(): void {
    if (!this.attached || typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.onKeyDown, { capture: true });
    this.attached = false;
  }

  /** test helper */
  reset(): void { this.bindings = []; this.detach(); }
}

export const shortcutRegistry = new ShortcutRegistry();

/* ------------------------------------------------------------------ hooks */

/**
 * Register one shortcut for the lifetime of the component.
 * The latest handler is always called (ref), so inline arrow functions do not re-register.
 *
 *   useKeyboardShortcut('Mod+S', () => save(), { enabled: !locked, description: 'Save' });
 *   useKeyboardShortcut('Escape', onClose, { allowInInputs: true, priority: 100 });   // BUG-032
 */
export function useKeyboardShortcut(combo: Combo, handler: (e: KeyboardEvent) => void, options: ShortcutOptions = {}): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const { allowInInputs, priority, enabled, preventDefault, allowRepeat, description } = options;

  useEffect(() => {
    const unregister = shortcutRegistry.register(combo, (e) => handlerRef.current(e), {
      allowInInputs, priority, enabled, preventDefault, allowRepeat, description,
    });
    return unregister; // cleanup on unmount or when combo/options change
  }, [combo, allowInInputs, priority, enabled, preventDefault, allowRepeat, description]);
}

/** Register a map of shortcuts at once: useShortcutMap({ 'Mod+S': save, 'Mod+Enter': submit }). */
export function useShortcutMap(map: Record<Combo, (e: KeyboardEvent) => void>, options: ShortcutOptions = {}): void {
  const mapRef = useRef(map);
  mapRef.current = map;
  const keys = Object.keys(map).sort().join('|');
  const { allowInInputs, priority, enabled, preventDefault, allowRepeat } = options;
  useEffect(() => {
    const offs = keys.split('|').filter(Boolean).map((combo) =>
      shortcutRegistry.register(combo, (e) => mapRef.current[combo]?.(e), { allowInInputs, priority, enabled, preventDefault, allowRepeat }),
    );
    return () => offs.forEach((off) => off());
  }, [keys, allowInInputs, priority, enabled, preventDefault, allowRepeat]);
}

/** Human label for UI hints: "⌘S" on Mac, "Ctrl+S" elsewhere. */
export function formatCombo(combo: Combo, apple = isApplePlatform()): string {
  const c = parseCombo(combo, apple);
  const key = c.key.length === 1 ? c.key.toUpperCase() : c.key[0].toUpperCase() + c.key.slice(1);
  if (apple) return `${c.ctrl ? '⌃' : ''}${c.alt ? '⌥' : ''}${c.shift ? '⇧' : ''}${c.meta ? '⌘' : ''}${key}`;
  return [c.ctrl && 'Ctrl', c.meta && 'Win', c.alt && 'Alt', c.shift && 'Shift', key].filter(Boolean).join('+');
}
