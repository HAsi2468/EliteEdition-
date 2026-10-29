import { evaluateMathExpression } from './mathEvaluator';

/**
 * Enterprise ERP Navigation Helpers
 * Powers zero-mouse keyboard-first workflow across:
 * 1. Side panels & Sidebar navigation
 * 2. Sub-screens & Sub-tab switching
 * 3. Main screen forms & Universal Enter-as-Tab with inline math evaluation
 */

/**
 * Handle inline math computation on numeric inputs
 * Supports standard arithmetic and percentage calculations (e.g. 1000-10%, 150*12)
 */
export function processInputMath(input: HTMLInputElement): boolean {
  if (!input || input.tagName?.toLowerCase() !== 'input') return false;

  const val = input.value;
  if (!val || typeof val !== 'string') return false;

  // Check if the value contains arithmetic operators (+, -, *, /, %)
  if (!/[+\-*/%]/.test(val)) return false;

  const result = evaluateMathExpression(val);
  if (result !== null) {
    // Use prototype setter to trigger React synthetic state updates
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement?.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(input, String(result));
    } else {
      input.value = String(result);
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  return false;
}

/**
 * Universal Fallback Enter-As-Tab Dispatcher
 * Seamlessly advances focus forward on Enter and backward on Shift+Enter across forms,
 * modals, drawers, and data tables.
 */
export function handleGlobalEnterAsTab(e: KeyboardEvent): boolean {
  if (e.key !== 'Enter') return false;

  // Ignore if meta / ctrl / alt modifiers are active (allow browser/app hotkeys)
  if (e.ctrlKey || e.metaKey || e.altKey) return false;

  const active = document.activeElement as HTMLElement | null;
  if (!active) return false;

  const tag = active.tagName.toLowerCase();

  // Textareas insert standard newlines on Enter; Ctrl+Enter handles submit elsewhere
  if (tag === 'textarea') return false;

  // Regular buttons handle standard Enter activation (clicks)
  if (tag === 'button') return false;

  // Only handle text/number inputs and selects
  if (tag !== 'input' && tag !== 'select') return false;

  const inputEl = active as HTMLInputElement;
  const inputType = (inputEl.type || 'text').toLowerCase();

  // Non-navigable types
  if (['checkbox', 'radio', 'submit', 'button', 'reset', 'file'].includes(inputType)) {
    return false;
  }

  // Check opt-out
  if (active.closest('[data-no-enter-tab="true"]')) {
    return false;
  }

  // 1. Process arithmetic evaluation if present on input
  if (tag === 'input') {
    processInputMath(inputEl);
  }

  // 2. Identify nearest logical scope (dialog, form, modal, or main content)
  const container =
    active.closest('form') ||
    active.closest('[role="dialog"]') ||
    active.closest('.modal-content, .elite-modal-dialog, .drawer, .card') ||
    document.getElementById('main-content-area') ||
    document.body;

  const selector = [
    'input:not([type="hidden"]):not([disabled]):not([readonly])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button[type="submit"]:not([disabled])',
    'button.btn-primary:not([disabled])',
    '[data-enter-target="true"]'
  ].join(', ');

  const elements = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter((el) => {
    const isVisible = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const isHidden =
      el.getAttribute('aria-hidden') === 'true' ||
      el.style.display === 'none' ||
      el.style.visibility === 'hidden';
    const isDisabled = (el as HTMLInputElement).disabled;
    return isVisible && !isHidden && !isDisabled;
  });

  if (!elements.length) return false;

  const currentIndex = elements.indexOf(active);
  if (currentIndex === -1) return false;

  // Shift + Enter: Navigate Backward
  if (e.shiftKey) {
    e.preventDefault();
    e.stopPropagation();
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : elements.length - 1;
    const target = elements[prevIndex];
    if (target) {
      target.focus();
      if ((target as HTMLInputElement).select) {
        (target as HTMLInputElement).select();
      }
    }
    return true;
  }

  // Normal Enter: Navigate Forward
  e.preventDefault();
  e.stopPropagation();

  const isLastField = currentIndex === elements.length - 1;
  if (isLastField) {
    const parentForm = active.closest('form');
    if (parentForm) {
      if (typeof parentForm.requestSubmit === 'function') {
        parentForm.requestSubmit();
      } else {
        const submitBtn = parentForm.querySelector<HTMLButtonElement>(
          'button[type="submit"], input[type="submit"]'
        );
        submitBtn?.click();
      }
      return true;
    }
  }

  const nextIndex = currentIndex < elements.length - 1 ? currentIndex + 1 : 0;
  const nextTarget = elements[nextIndex];

  if (nextTarget) {
    nextTarget.focus();
    if ((nextTarget as HTMLInputElement).select) {
      (nextTarget as HTMLInputElement).select();
    }
  }

  return true;
}

/**
 * Universal Sub-Tab Switcher
 * Finds visible sub-tabs in the active screen and cycles forward/backward or jumps to specific index
 */
export function switchActiveSubTab(direction: 'next' | 'prev' | number): boolean {
  if (typeof document === 'undefined') return false;

  const contentArea = document.getElementById('main-content-area') || document.body;

  const candidateSelectors = [
    '[role="tablist"]',
    '.inv-sub-tab-bar',
    '.gst-sub-tab-bar',
    '.sub-tab-bar',
    '.ent-tabs-container',
    '.nav-tabs',
    '.sub-tabs'
  ];

  let tabButtons: HTMLElement[] = [];
  for (const selector of candidateSelectors) {
    const container = contentArea.querySelector(selector);
    if (container) {
      const btns = Array.from(
        container.querySelectorAll<HTMLElement>('button:not([disabled]), [role="tab"]:not([disabled])')
      ).filter((b) => (b.offsetWidth || b.offsetHeight || b.getClientRects().length) > 0);
      if (btns.length > 1) {
        tabButtons = btns;
        break;
      }
    }
  }

  // Fallback: look for buttons with tab-like classes in main content
  if (tabButtons.length === 0) {
    const standaloneTabBtns = Array.from(
      contentArea.querySelectorAll<HTMLElement>(
        'button.ent-tab-btn, button.sub-tab, button[role="tab"], button[data-subtab]'
      )
    ).filter((b) => (b.offsetWidth || b.offsetHeight || b.getClientRects().length) > 0);

    if (standaloneTabBtns.length > 1) {
      const parent = standaloneTabBtns[0].parentElement;
      if (parent) {
        tabButtons = Array.from(parent.querySelectorAll<HTMLElement>('button:not([disabled])')).filter(
          (b) => (b.offsetWidth || b.offsetHeight || b.getClientRects().length) > 0
        );
      }
    }
  }

  if (tabButtons.length <= 1) return false;

  // Determine active tab index
  let activeIndex = -1;
  tabButtons.forEach((btn, idx) => {
    const isSelected = btn.getAttribute('aria-selected') === 'true';
    const hasActiveClass =
      btn.classList.contains('active') ||
      btn.classList.contains('is-active') ||
      btn.classList.contains('selected');
    const styleAttr = btn.getAttribute('style') || '';
    const hasActiveStyle =
      styleAttr.includes('font-weight: 700') ||
      styleAttr.includes('fontWeight: 700') ||
      styleAttr.includes('border-bottom: 2px') ||
      styleAttr.includes('border-bottom: 3px');

    if (isSelected || hasActiveClass || hasActiveStyle) {
      activeIndex = idx;
    }
  });

  if (activeIndex === -1) activeIndex = 0;

  let targetIndex: number;
  if (typeof direction === 'number') {
    if (direction < 0 || direction >= tabButtons.length) return false;
    targetIndex = direction;
  } else if (direction === 'next') {
    targetIndex = (activeIndex + 1) % tabButtons.length;
  } else {
    targetIndex = (activeIndex - 1 + tabButtons.length) % tabButtons.length;
  }

  const targetBtn = tabButtons[targetIndex];
  if (targetBtn) {
    targetBtn.focus();
    targetBtn.click();
    return true;
  }

  return false;
}

/**
 * Focus Left Sidebar Navigation
 */
export function focusSidebar(): boolean {
  if (typeof document === 'undefined') return false;

  const sidebar = document.getElementById('erp-sidebar-nav');
  if (!sidebar) return false;

  const activeBtn =
    sidebar.querySelector<HTMLElement>('button[data-sidebar-nav="true"][aria-current="page"]') ||
    sidebar.querySelector<HTMLElement>('button[data-sidebar-nav="true"]:not([disabled])');

  if (activeBtn) {
    activeBtn.focus();
    return true;
  }

  sidebar.focus();
  return true;
}

/**
 * Focus Main Screen Content Area
 */
export function focusMainContent(): boolean {
  if (typeof document === 'undefined') return false;

  const content = document.getElementById('main-content-area');
  if (!content) return false;

  const firstInput = content.querySelector<HTMLElement>(
    'input:not([type="hidden"]):not([disabled]), button:not([disabled]), [tabindex="0"]'
  );

  if (firstInput) {
    firstInput.focus();
    if ((firstInput as HTMLInputElement).select) {
      (firstInput as HTMLInputElement).select();
    }
    return true;
  }

  content.focus();
  return true;
}

/**
 * Focus Primary Search Input on the active screen
 */
export function focusSearchInput(): boolean {
  if (typeof document === 'undefined') return false;

  const searchInput = document.querySelector<HTMLElement>(
    'input[type="search"]:not([disabled]), input.table-search-input:not([disabled]), input[placeholder*="search" i]:not([disabled]), input[placeholder*="Search" i]:not([disabled])'
  );

  if (searchInput) {
    searchInput.focus();
    if ((searchInput as HTMLInputElement).select) {
      (searchInput as HTMLInputElement).select();
    }
    return true;
  }

  return false;
}

/**
 * Universal F6 Pane Cycler
 * Cycles focus between Sidebar ↔ Main Screen Content ↔ Top Search
 */
let currentPaneIndex = 0;
export function cyclePanes(): boolean {
  if (typeof document === 'undefined') return false;

  const panes = [
    { name: 'sidebar', focus: focusSidebar },
    { name: 'main', focus: focusMainContent },
    { name: 'search', focus: focusSearchInput }
  ];

  for (let i = 1; i <= panes.length; i++) {
    const nextIdx = (currentPaneIndex + i) % panes.length;
    const pane = panes[nextIdx];
    if (pane.focus()) {
      currentPaneIndex = nextIdx;
      return true;
    }
  }

  return false;
}

/**
 * Activate the nth visible module in the sidebar (0-indexed)
 */
export function activateSidebarModule(index: number): boolean {
  if (typeof document === 'undefined') return false;

  const sidebar = document.getElementById('erp-sidebar-nav');
  if (!sidebar) return false;

  const buttons = Array.from(
    sidebar.querySelectorAll<HTMLButtonElement>('button[data-sidebar-nav="true"]:not([disabled])')
  );

  if (index >= 0 && index < buttons.length) {
    const btn = buttons[index];
    btn.focus();
    btn.click();
    return true;
  }

  return false;
}
