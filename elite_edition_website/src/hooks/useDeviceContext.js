import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Breakpoint Constants according to Enterprise ERP Architecture Specs
 * - Mobile (sm): < 768px
 * - Tablet (md/lg): 768px - 1199px (Master-detail split panes)
 * - Desktop (xl/2xl): >= 1200px (High-density multi-column grids)
 */
export const BREAKPOINTS = {
  MOBILE_MAX: 767,
  TABLET_MIN: 768,
  TABLET_MAX: 1199,
  DESKTOP_MIN: 1200,
  DESKTOP_WIDE: 1600,
};

/**
 * useDeviceContext
 * Enterprise-grade device & layout sensory hook.
 * Detects:
 *  - Breakpoint bracket (sm, md, lg, xl, 2xl)
 *  - Device tier: isMobile, isTablet, isDesktop
 *  - PWA Standalone Mode (display-mode: standalone / navigator.standalone)
 *  - Touch capability & pointer density
 *  - Orientation & dynamic viewport dimensions (dvh / dvw)
 */
export function useDeviceContext() {
  const getDeviceState = useCallback(() => {
    if (typeof window === 'undefined') {
      return {
        width: 1280,
        height: 800,
        breakpoint: 'xl',
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isPWA: false,
        isTouch: false,
        orientation: 'landscape',
        platform: 'desktop',
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Unified Breakpoint Bracketing
    let breakpoint = 'sm';
    if (width >= BREAKPOINTS.DESKTOP_WIDE) {
      breakpoint = '2xl';
    } else if (width >= BREAKPOINTS.DESKTOP_MIN) {
      breakpoint = 'xl';
    } else if (width >= 992) {
      breakpoint = 'lg';
    } else if (width >= BREAKPOINTS.TABLET_MIN) {
      breakpoint = 'md';
    } else {
      breakpoint = 'sm';
    }

    const isMobile = width < BREAKPOINTS.TABLET_MIN;
    const isTablet = width >= BREAKPOINTS.TABLET_MIN && width <= BREAKPOINTS.TABLET_MAX;
    const isDesktop = width >= BREAKPOINTS.DESKTOP_MIN;

    // PWA Standalone Detection
    const isPWA =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: window-controls-overlay)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');

    // Pointer & Touch detection
    const isTouch =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches;

    // Platform user agent breakdown
    const ua = navigator.userAgent || '';
    let platform = 'desktop';
    if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      platform = 'ios';
    } else if (/Android/.test(ua)) {
      platform = 'android';
    }

    const orientation = width >= height ? 'landscape' : 'portrait';

    return {
      width,
      height,
      breakpoint,
      isMobile,
      isTablet,
      isDesktop,
      isPWA,
      isTouch,
      orientation,
      platform,
    };
  }, []);

  const [device, setDevice] = useState(getDeviceState);

  useEffect(() => {
    let timeoutId = null;

    const handleResize = () => {
      // Debounce slightly to prevent thrashing during fast window resizing / orientation flips
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setDevice(getDeviceState());
      }, 50);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    // Listen to standalone PWA changes
    const pwaQuery = window.matchMedia('(display-mode: standalone)');
    const handlePwaChange = () => setDevice(getDeviceState());
    if (pwaQuery.addEventListener) {
      pwaQuery.addEventListener('change', handlePwaChange);
    } else if (pwaQuery.addListener) {
      pwaQuery.addListener(handlePwaChange);
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (pwaQuery.removeEventListener) {
        pwaQuery.removeEventListener('change', handlePwaChange);
      } else if (pwaQuery.removeListener) {
        pwaQuery.removeListener(handlePwaChange);
      }
    };
  }, [getDeviceState]);

  return device;
}
