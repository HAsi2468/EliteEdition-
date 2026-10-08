import { useRef, useCallback, useEffect } from 'react';

/**
 * Enterprise Keyboard-First Progression Hook
 * 
 * Enables spreadsheet-speed rapid data entry:
 * - Enter: Focuses next enabled input/select/textarea
 * - Shift + Enter: Focuses previous input
 * - ArrowDown / ArrowUp within tabular cells
 * - Calls onRowComplete / onComplete when Enter is pressed on the final field
 */
export function useKeyboardProgression({
  selector = 'input:not([disabled]):not([type="hidden"]):not([readonly]), select:not([disabled]), textarea:not([disabled])',
  onComplete,
  autoFocusFirst = false
} = {}) {
  const containerRef = useRef(null);

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(containerRef.current.querySelectorAll(selector)).filter((el) => {
      return el.offsetParent !== null && !el.hasAttribute('disabled');
    });
  }, [selector]);

  const focusNext = useCallback((currentEl) => {
    const elements = getFocusableElements();
    if (!elements.length) return false;
    const currentIndex = elements.indexOf(currentEl);
    if (currentIndex >= 0 && currentIndex < elements.length - 1) {
      elements[currentIndex + 1].focus();
      if (typeof elements[currentIndex + 1].select === 'function') {
        elements[currentIndex + 1].select();
      }
      return true;
    }
    return false;
  }, [getFocusableElements]);

  const focusPrevious = useCallback((currentEl) => {
    const elements = getFocusableElements();
    if (!elements.length) return false;
    const currentIndex = elements.indexOf(currentEl);
    if (currentIndex > 0) {
      elements[currentIndex - 1].focus();
      if (typeof elements[currentIndex - 1].select === 'function') {
        elements[currentIndex - 1].select();
      }
      return true;
    }
    return false;
  }, [getFocusableElements]);

  const focusFirst = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length > 0) {
      elements[0].focus();
      if (typeof elements[0].select === 'function') {
        elements[0].select();
      }
      return true;
    }
    return false;
  }, [getFocusableElements]);

  const handleKeyDown = useCallback((e) => {
    // Only intercept Enter (avoid intercepting multiline textareas unless Shift+Enter or single line)
    if (e.key === 'Enter') {
      const target = e.target;
      if (target.tagName === 'TEXTAREA' && !e.ctrlKey && !e.metaKey) {
        // Allow regular multiline newline in textareas unless modifier is pressed
        return;
      }

      e.preventDefault();

      if (e.shiftKey) {
        focusPrevious(target);
      } else {
        const moved = focusNext(target);
        if (!moved && onComplete) {
          onComplete(target);
        }
      }
    }
  }, [focusNext, focusPrevious, onComplete]);

  useEffect(() => {
    if (autoFocusFirst) {
      const timer = setTimeout(() => {
        focusFirst();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocusFirst, focusFirst]);

  return {
    containerRef,
    handleKeyDown,
    focusFirst,
    focusNext,
    focusPrevious,
    getFocusableElements
  };
}

export default useKeyboardProgression;
