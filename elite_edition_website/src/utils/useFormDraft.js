import { useEffect, useRef } from 'react';

/**
 * Hook to automatically persist and restore form drafts in localStorage
 * Prevents data loss if user refreshes, loses internet, or server updates mid-entry.
 * 
 * @param {string} draftKey - Unique key for this form (e.g. 'fabric_transfer', 'fabric_inward')
 * @param {object} formState - Current state of the form
 * @param {function} setFormState - State setter function
 * @param {boolean} isModalOpen - Whether the form modal is currently active
 */
export function useFormDraft(draftKey, formState, setFormState, isModalOpen = true) {
  const isLoadedRef = useRef(false);
  const storageKey = `elite_draft_${draftKey}`;

  // Restore draft when form opens
  useEffect(() => {
    if (!isModalOpen) {
      isLoadedRef.current = false;
      return;
    }

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          // Check if parsed has at least one non-empty field
          const hasData = Object.values(parsed).some(v => v !== '' && v !== null && v !== undefined);
          if (hasData) {
            setFormState(prev => ({
              ...prev,
              ...parsed
            }));
          }
        }
      }
    } catch (e) {
      console.warn('Could not restore form draft for', draftKey, e);
    }
    isLoadedRef.current = true;
  }, [isModalOpen, draftKey]);

  // Auto-save draft on every change (debounced 400ms)
  useEffect(() => {
    if (!isModalOpen || !isLoadedRef.current) return;

    const timer = setTimeout(() => {
      try {
        // Only save if there is actual input
        const hasData = Object.values(formState || {}).some(v => v !== '' && v !== null && v !== undefined);
        if (hasData) {
          localStorage.setItem(storageKey, JSON.stringify(formState));
        }
      } catch (e) {
        // Storage quota or private browsing
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formState, isModalOpen, storageKey]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {}
  };

  return { clearDraft };
}
