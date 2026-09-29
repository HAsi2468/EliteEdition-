import { useState, useEffect, useRef } from 'react';
import { triggerPushNotification } from '../components/NotificationToast';

/**
 * Enterprise Form Auto-recovery Hook
 * Caches active multi-step forms in sessionStorage so refreshing or switching tabs never wipes user input.
 * 
 * @param {string} draftKey - Unique key for this form (e.g. 'garment_job_card', 'bulk_inward', 'fabric_transfer')
 * @param {object} formState - Current state of the form
 * @param {function} setFormState - State setter function
 * @param {boolean} [isFormActive=true] - Whether the form modal/view is currently active
 * @param {object} [options={}] - Additional options
 * @param {boolean} [options.notifyOnRestore=true] - Show subtle toast when draft restored
 */
export function useFormDraft(
  draftKey, 
  formState, 
  setFormState, 
  isFormActive = true, 
  options = {}
) {
  const { notifyOnRestore = true } = options;
  const isLoadedRef = useRef(false);
  const latestStateRef = useRef(formState);
  latestStateRef.current = formState;

  const storageKey = `elite_session_draft_${draftKey}`;

  // Restore draft when form activates
  useEffect(() => {
    if (!isFormActive) {
      isLoadedRef.current = false;
      return;
    }

    try {
      // Prioritize sessionStorage, fallback to localStorage
      const saved = sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          // Check if parsed has at least one non-empty value
          const hasData = Object.values(parsed).some(v => {
            if (Array.isArray(v)) return v.length > 0;
            if (typeof v === 'object' && v !== null) return Object.values(v).some(nested => nested !== '' && nested !== 0 && nested !== null);
            return v !== '' && v !== null && v !== undefined && v !== 0;
          });

          if (hasData) {
            setFormState(prev => {
              if (typeof prev === 'object' && prev !== null) {
                return { ...prev, ...parsed };
              }
              return parsed;
            });

            if (notifyOnRestore) {
              triggerPushNotification(
                'Draft Restored',
                'Your unsaved form progress was automatically recovered.',
                'info'
              );
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not restore form draft for', draftKey, e);
    }
    isLoadedRef.current = true;
  }, [isFormActive, draftKey]);

  // Auto-save draft on every change (debounced 350ms)
  useEffect(() => {
    if (!isFormActive || !isLoadedRef.current) return;

    const timer = setTimeout(() => {
      try {
        const hasData = Object.values(formState || {}).some(v => {
          if (Array.isArray(v)) return v.length > 0;
          if (typeof v === 'object' && v !== null) return Object.values(v).some(nested => nested !== '' && nested !== 0 && nested !== null);
          return v !== '' && v !== null && v !== undefined;
        });

        if (hasData) {
          const payload = JSON.stringify(formState);
          sessionStorage.setItem(storageKey, payload);
        }
      } catch (e) {
        // Quota exceeded or private browsing
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [formState, isFormActive, storageKey]);

  // Flush on tab hide / page reload to prevent any loss of latest keystrokes
  useEffect(() => {
    const handleFlush = () => {
      if (!isFormActive || !isLoadedRef.current) return;
      try {
        if (latestStateRef.current) {
          sessionStorage.setItem(storageKey, JSON.stringify(latestStateRef.current));
        }
      } catch (e) {}
    };

    window.addEventListener('beforeunload', handleFlush);
    document.addEventListener('visibilitychange', handleFlush);

    return () => {
      window.removeEventListener('beforeunload', handleFlush);
      document.removeEventListener('visibilitychange', handleFlush);
    };
  }, [isFormActive, storageKey]);

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(storageKey);
      localStorage.removeItem(storageKey);
    } catch (e) {}
  };

  return { clearDraft };
}

export default useFormDraft;
