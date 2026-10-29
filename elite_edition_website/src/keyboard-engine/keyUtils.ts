/**
 * Key Normalization and Collision Handling Utility
 */

export function normalizeCombo(combo: string): string {
  const parts = combo
    .toLowerCase()
    .split('+')
    .map((p) => p.trim());

  const hasCtrl = parts.includes('ctrl') || parts.includes('control') || parts.includes('cmd') || parts.includes('meta');
  const hasAlt = parts.includes('alt') || parts.includes('option');
  const hasShift = parts.includes('shift');

  const mainKeys = parts.filter(
    (p) => !['ctrl', 'control', 'cmd', 'meta', 'alt', 'option', 'shift'].includes(p)
  );

  const normalizedParts: string[] = [];
  if (hasCtrl) normalizedParts.push('ctrl');
  if (hasAlt) normalizedParts.push('alt');
  if (hasShift) normalizedParts.push('shift');

  if (mainKeys.length > 0) {
    let mainKey = mainKeys[0];
    if (mainKey === 'escape') mainKey = 'esc';
    if (mainKey === 'return') mainKey = 'enter';
    normalizedParts.push(mainKey);
  }

  return normalizedParts.join('+');
}

export function eventToCombo(e: KeyboardEvent): string {
  const parts: string[] = [];

  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');

  let key = e.key.toLowerCase();
  if (key === 'escape') key = 'esc';
  if (key === ' ') key = 'space';

  // If the key itself is a modifier, don't append it again
  if (!['control', 'meta', 'alt', 'shift'].includes(key)) {
    parts.push(key);
  }

  return parts.join('+');
}

export function matchesCombo(e: KeyboardEvent, combo: string): boolean {
  const normalizedTarget = normalizeCombo(combo);
  const currentCombo = eventToCombo(e);

  if (normalizedTarget === currentCombo) return true;

  // Handle special case for "?" which is shift+/
  if (combo === '?' && (e.key === '?' || (e.shiftKey && e.key === '/'))) {
    return true;
  }

  return false;
}

export function isTextInputActive(): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!active) return false;

  const tag = active.tagName.toLowerCase();
  if (tag === 'textarea') return true;
  if (tag === 'select') return true;

  if (tag === 'input') {
    const inputType = (active as HTMLInputElement).type?.toLowerCase();
    const nonTextTypes = ['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'range', 'color'];
    return !nonTextTypes.includes(inputType);
  }

  if ((active as HTMLElement).isContentEditable) return true;

  return false;
}
