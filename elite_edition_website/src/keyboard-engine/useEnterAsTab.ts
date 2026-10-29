import { useEffect, useRef, useCallback } from 'react';
import { evaluateMathExpression } from './mathEvaluator';
import { EnterAsTabOptions } from './types';

const FOCUSABLE_SELECTOR = [
  'input:not([type="hidden"]):not([disabled]):not([readonly])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled]):not([tabindex="-1"])',
  '[tabindex="0"]:not([disabled])',
  '[data-enter-target="true"]'
].join(', ');

export function useEnterAsTab<T extends HTMLElement = HTMLFormElement>(
  options: EnterAsTabOptions = {}
) {
  const containerRef = useRef<T | null>(null);
  const lastEnterTimestampRef = useRef<number>(0);
  const lastFocusedElementIdRef = useRef<string | null>(null);

  const {
    onSubmit,
    onCancel,
    enableMathEvaluation = true,
    selector = FOCUSABLE_SELECTOR
  } = options;

  // Retrieve visible, enabled focusable elements in logical DOM or tab order
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    const elements = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(selector)
    );

    return elements.filter((el) => {
      // Must be visible and interactive
      const isVisible = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      const isHidden = el.getAttribute('aria-hidden') === 'true' || el.style.display === 'none' || el.style.visibility === 'hidden';
      const isDisabled = (el as HTMLInputElement).disabled;
      return isVisible && !isHidden && !isDisabled;
    });
  }, [selector]);

  // Handle inline math computation on numeric inputs
  const processMathEvaluation = useCallback((input: HTMLInputElement): boolean => {
    if (!enableMathEvaluation) return false;

    const isNumericInput =
      input.type === 'number' ||
      input.getAttribute('data-type') === 'numeric' ||
      input.classList.contains('math-eval') ||
      /amount|rate|qty|quantity|price|total|discount|tax/i.test(input.name || input.id || '');

    if (!isNumericInput) return false;

    const val = input.value;
    if (!val) return false;

    // Check if the value has any math operators (+, -, *, /, %)
    if (/[+\-*/%]/.test(val)) {
      const result = evaluateMathExpression(val);
      if (result !== null) {
        input.value = String(result);
        // Dispatch synthetic React input & change events
        const inputEvt = new Event('input', { bubbles: true });
        const changeEvt = new Event('change', { bubbles: true });
        input.dispatchEvent(inputEvt);
        input.dispatchEvent(changeEvt);
        return true;
      }
    }
    return false;
  }, [enableMathEvaluation]);

  // Main Keyboard Navigation Listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Submit on Ctrl + Enter or Cmd + Enter
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (onSubmit) {
          onSubmit();
        }
        return;
      }

      // 2. Cancel on Esc
      if (e.key === 'Escape') {
        if (onCancel) {
          e.preventDefault();
          onCancel();
        }
        return;
      }

      // Check if Enter or Shift+Enter was pressed
      if (e.key !== 'Enter') return;

      const active = document.activeElement as HTMLElement | null;
      if (!active || !container.contains(active)) return;

      const isTextarea = active.tagName.toLowerCase() === 'textarea';

      // Textareas insert standard newline on Enter unless Ctrl/Cmd is held
      if (isTextarea && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        return;
      }

      // If on an HTML input, check if we need to evaluate math first
      if (active.tagName.toLowerCase() === 'input') {
        processMathEvaluation(active as HTMLInputElement);
      }

      const focusable = getFocusableElements();
      if (!focusable.length) return;

      const currentIndex = focusable.indexOf(active);

      // Shift + Enter: Navigate Backward
      if (e.shiftKey) {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : focusable.length - 1;
        const target = focusable[prevIndex];
        if (target) {
          target.focus();
          if ((target as HTMLInputElement).select) {
            (target as HTMLInputElement).select();
          }
        }
        return;
      }

      // Standard Enter: Navigate Forward
      e.preventDefault();

      // If active element is a button and not the submit button, allow click
      if (active.tagName.toLowerCase() === 'button' && (active as HTMLButtonElement).type !== 'submit') {
        (active as HTMLButtonElement).click();
      }

      // Check for last field double-tap Enter submit
      const isLastField = currentIndex === focusable.length - 1;
      const now = Date.now();

      if (isLastField) {
        if (now - lastEnterTimestampRef.current < 450) {
          // Double-tap Enter on last field triggers submit
          if (onSubmit) {
            onSubmit();
            return;
          }
        }
        lastEnterTimestampRef.current = now;
      }

      // Shift focus to next field
      const nextIndex = currentIndex < focusable.length - 1 ? currentIndex + 1 : 0;
      const nextTarget = focusable[nextIndex];

      if (nextTarget) {
        nextTarget.focus();
        if ((nextTarget as HTMLInputElement).select) {
          (nextTarget as HTMLInputElement).select();
        }
      }
    };

    // Track focused element for transient focus recovery across async renders
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.id) {
        lastFocusedElementIdRef.current = target.id;
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    container.addEventListener('focusin', handleFocusIn);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('focusin', handleFocusIn);
    };
  }, [getFocusableElements, processMathEvaluation, onSubmit, onCancel]);

  // Focus recovery helper to re-focus after mutations or validations
  const restoreFocus = useCallback(() => {
    if (!lastFocusedElementIdRef.current) return;
    const el = document.getElementById(lastFocusedElementIdRef.current);
    if (el) {
      el.focus();
      if ((el as HTMLInputElement).select) {
        (el as HTMLInputElement).select();
      }
    }
  }, []);

  return {
    containerRef,
    restoreFocus,
    getFocusableElements,
  };
}
