import React, { useEffect } from 'react';

/**
 * StickyScrollShadowTracker
 * 
 * Automatically attaches passive scroll listeners to table containers,
 * dynamically applying .is-scrolled-x and .is-scrolled-y classes so that
 * sticky table headers and left-pinned identifier columns display
 * subtle, elevated drop-shadows only when the user scrolls.
 */
export function StickyScrollShadowTracker() {
  useEffect(() => {
    const handleScroll = (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      // Check if target is a table container, scroll wrapper, or contains a table
      const isScrollable = target.scrollWidth > target.clientWidth || target.scrollHeight > target.clientHeight;
      if (!isScrollable) return;

      const hasTable = target.querySelector('table') || target.classList.contains('table-container') || target.classList.contains('table-scroll-wrap');
      if (!hasTable) return;

      // Vertical scroll status
      if (target.scrollTop > 2) {
        target.classList.add('is-scrolled-y');
        const thead = target.querySelector('thead');
        if (thead) thead.classList.add('is-scrolled');
      } else {
        target.classList.remove('is-scrolled-y');
        const thead = target.querySelector('thead');
        if (thead) thead.classList.remove('is-scrolled');
      }

      // Horizontal scroll status
      if (target.scrollLeft > 2) {
        target.classList.add('is-scrolled-x');
      } else {
        target.classList.remove('is-scrolled-x');
      }
    };

    // Listen to capture phase on document to catch all scrollable table wrappers
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });

    return () => {
      document.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, []);

  return null;
}

export default StickyScrollShadowTracker;
