import { useState, useCallback } from 'react';

/**
 * useValidationDock
 * 
 * Hook for managing non-blocking validation state and automatic field navigation.
 */
export function useValidationDock() {
  const [errors, setErrors] = useState([]);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const setValidationErrors = useCallback((newErrors) => {
    const list = Array.isArray(newErrors) ? newErrors : [newErrors];
    setErrors(list);

    // Auto-focus the first invalid field immediately
    if (list.length > 0 && typeof window !== 'undefined') {
      const firstErr = list[0];
      const fieldId = firstErr.fieldId || firstErr.id;
      const selector = firstErr.selector;

      setTimeout(() => {
        let el = selector ? document.querySelector(selector) : null;
        if (!el && fieldId) {
          el = document.getElementById(fieldId) ||
            document.querySelector(`[name="${fieldId}"]`) ||
            document.querySelector(`[data-field="${fieldId}"]`);
        }

        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (typeof el.focus === 'function') {
            el.focus();
          }
          if (typeof el.select === 'function') {
            el.select();
          }
          el.classList.remove('dock-field-highlight-pulse');
          void el.offsetWidth;
          el.classList.add('dock-field-highlight-pulse');
          setTimeout(() => {
            el.classList.remove('dock-field-highlight-pulse');
          }, 2200);
        }
      }, 100);
    }
  }, []);

  return {
    errors,
    setErrors: setValidationErrors,
    clearErrors,
    hasErrors: errors.length > 0
  };
}

export default useValidationDock;
