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

    const onWinScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      document.body.classList.toggle('erp-page-scrolled', scrollTop > 8);
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const ratio = Math.min(1, Math.max(0, scrollTop / maxScroll));
      document.documentElement.style.setProperty('--erp-scroll-progress', ratio.toFixed(4));
    };
    window.addEventListener('scroll', onWinScroll, { passive: true });
    onWinScroll();

    // VisionOS-style cursor spotlight on glass & KPI cards (desktop pointer only)
    const isFinePointer = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const onPointerMove = (e) => {
      const card = e.target instanceof Element
        ? e.target.closest('.ent-stat-card, .stat-card, .metric-card, .glass-calc-card, .fusing-metric-card, .glass-card-item')
        : null;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
      card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    };
    if (isFinePointer) {
      document.addEventListener('pointermove', onPointerMove, { passive: true });
    }

    return () => {
      document.removeEventListener('scroll', handleScroll, { capture: true });
      window.removeEventListener('scroll', onWinScroll);
      if (isFinePointer) {
        document.removeEventListener('pointermove', onPointerMove);
      }
    };
  }, []);

  return <div className="erp-scroll-progress" aria-hidden="true" />;
}

export default StickyScrollShadowTracker;
