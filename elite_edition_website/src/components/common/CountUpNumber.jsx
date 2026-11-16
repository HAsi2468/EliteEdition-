import React, { useEffect, useRef, useState } from 'react';

/**
 * Smooth GPU-friendly KPI number roll-up using requestAnimationFrame.
 */
export default function CountUpNumber({
  value = 0,
  duration = 520,
  prefix = '',
  suffix = '',
  maximumFractionDigits = 0,
}) {
  const numericTarget = Number(value) || 0;
  const [displayValue, setDisplayValue] = useState(numericTarget);
  const prevRef = useRef(0);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setDisplayValue(numericTarget);
      prevRef.current = numericTarget;
      return;
    }

    const startVal = prevRef.current;
    const diff = numericTarget - startVal;
    if (Math.abs(diff) < 0.01) {
      setDisplayValue(numericTarget);
      return;
    }

    let rafId = null;
    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayValue(startVal + diff * eased);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setDisplayValue(numericTarget);
        prevRef.current = numericTarget;
      }
    };

    rafId = requestAnimationFrame(step);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      prevRef.current = numericTarget;
    };
  }, [numericTarget, duration]);

  const formatted = Number(displayValue || 0).toLocaleString('en-IN', {
    maximumFractionDigits,
  });

  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
