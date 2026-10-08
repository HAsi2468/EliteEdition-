import { useState, useEffect, useRef } from 'react';

/**
 * useValuePulse
 * 
 * Reactive Value Pulse Animation Hook:
 * Triggers a fading 1.2-second soft highlight glow class whenever
 * a watched value changes dynamically.
 */
export function useValuePulse(value, duration = 1200) {
  const [isPulsing, setIsPulsing] = useState(false);
  const isFirstRender = useRef(true);
  const prevValue = useRef(value);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevValue.current = value;
      return;
    }

    if (value !== prevValue.current) {
      prevValue.current = value;
      setIsPulsing(true);

      const timer = setTimeout(() => {
        setIsPulsing(false);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [value, duration]);

  return isPulsing ? 'reactive-value-pulse' : '';
}

export default useValuePulse;
