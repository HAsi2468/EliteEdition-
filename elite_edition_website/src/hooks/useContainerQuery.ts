import { useState, useRef, useEffect, useCallback } from 'react';

export interface ContainerDimensions {
  width: number;
  height: number;
  isCompact: boolean;   // < 520px
  isMedium: boolean;    // 520px - 899px
  isExpanded: boolean;  // >= 900px
}

/**
 * High-Performance Container Query Hook
 *
 * Measures parent/slot containment dimensions via ResizeObserver,
 * scheduled with requestAnimationFrame to prevent layout thrashing and loop warnings.
 */
export function useContainerQuery<T extends HTMLElement = HTMLDivElement>() {
  const elementRef = useRef<T | null>(null);
  const [dimensions, setDimensions] = useState<ContainerDimensions>({
    width: 0,
    height: 0,
    isCompact: true,
    isMedium: false,
    isExpanded: false,
  });

  const rafIdRef = useRef<number | null>(null);

  const updateDimensions = useCallback((entryWidth: number, entryHeight: number) => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      setDimensions((prev) => {
        const roundedWidth = Math.round(entryWidth);
        const roundedHeight = Math.round(entryHeight);

        if (prev.width === roundedWidth && prev.height === roundedHeight) {
          return prev;
        }

        return {
          width: roundedWidth,
          height: roundedHeight,
          isCompact: roundedWidth < 520,
          isMedium: roundedWidth >= 520 && roundedWidth < 900,
          isExpanded: roundedWidth >= 900,
        };
      });
      rafIdRef.current = null;
    });
  }, []);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentBoxSize && entry.contentBoxSize[0]) {
          updateDimensions(entry.contentBoxSize[0].inlineSize, entry.contentBoxSize[0].blockSize);
        } else if (entry.contentRect) {
          updateDimensions(entry.contentRect.width, entry.contentRect.height);
        }
      }
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [updateDimensions]);

  return { ref: elementRef, ...dimensions };
}

export default useContainerQuery;
