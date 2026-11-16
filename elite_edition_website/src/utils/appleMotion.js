import { useEffect, useRef, useState } from 'react';

/**
 * Triggers the native View Transitions API when available and motion is allowed,
 * falling back to synchronous execution on unsupported browsers or reduced-motion.
 */
export function runViewTransition(updateFn) {
  if (typeof updateFn !== 'function') return;
  if (
    typeof document !== 'undefined' &&
    typeof document.startViewTransition === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    try {
      document.startViewTransition(() => {
        updateFn();
      });
      return;
    } catch {
      // Fallback below
    }
  }
  updateFn();
}

/**
 * Smooth Apple Expo-Out number roll-up hook for KPI totals and counters.
 */
export function useAnimatedNumber(targetValue, duration = 420) {
  const numericTarget = Number(targetValue) || 0;
  const [displayValue, setDisplayValue] = useState(numericTarget);
  const prevRef = useRef(numericTarget);

  useEffect(() => {
    const startVal = prevRef.current;
    const diff = numericTarget - startVal;
    if (diff === 0 || (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      prevRef.current = numericTarget;
      setDisplayValue(numericTarget);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();
    const tick = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // Expo-out easing
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const next = startVal + diff * eased;
      setDisplayValue(next);
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        prevRef.current = numericTarget;
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [numericTarget, duration]);

  return displayValue;
}
