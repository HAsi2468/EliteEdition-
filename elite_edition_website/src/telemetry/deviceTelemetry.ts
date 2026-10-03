/**
 * Zero-Thrash Device & Viewport Telemetry Architecture
 *
 * Implements high-performance, asynchronous viewport and hardware detection
 * without layout-reading loops or un-debounced resize thrashing.
 * Synchronizes hardware state directly to <html data-attributes> via requestAnimationFrame.
 */

import { useSyncExternalStore } from 'react';

export type ScreenTier = 'compact' | 'medium' | 'expanded' | 'ultrawide';
export type PointerMode = 'touch' | 'mouse' | 'stylus';
export type MotionPreference = 'reduced' | 'standard';

export interface DeviceTelemetryState {
  screenTier: ScreenTier;
  pointerMode: PointerMode;
  motion: MotionPreference;
  dpr: number;
  isTouch: boolean;
  hasHover: boolean;
  width: number;
  height: number;
}

// Media Query Breakpoints (CSS baseline: 360px - 1920px+)
const QUERY_COMPACT = '(max-width: 639.98px)';
const QUERY_MEDIUM = '(min-width: 640px) and (max-width: 1023.98px)';
const QUERY_EXPANDED = '(min-width: 1024px) and (max-width: 1919.98px)';
const QUERY_ULTRAWIDE = '(min-width: 1920px)';

const QUERY_POINTER_COARSE = '(pointer: coarse)';
const QUERY_POINTER_FINE = '(pointer: fine)';
const QUERY_HOVER = '(hover: hover)';
const QUERY_REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

// Default Fallback Snapshot (SSR / Pre-init)
const DEFAULT_STATE: DeviceTelemetryState = {
  screenTier: 'expanded',
  pointerMode: 'mouse',
  motion: 'standard',
  dpr: 1,
  isTouch: false,
  hasHover: true,
  width: 1280,
  height: 800,
};

let currentState: DeviceTelemetryState = { ...DEFAULT_STATE };
const listeners = new Set<(state: DeviceTelemetryState) => void>();
let isInitialized = false;
let rafId: number | null = null;

/**
 * Evaluates current hardware and viewport queries without reading layout properties
 */
function evaluateTelemetry(): DeviceTelemetryState {
  if (typeof window === 'undefined') return DEFAULT_STATE;

  const hasMatchMedia = typeof window.matchMedia === 'function';

  // 1. Screen Tier via matchMedia with innerWidth fallback
  let tier: ScreenTier = 'expanded';
  if (hasMatchMedia) {
    if (window.matchMedia(QUERY_COMPACT).matches) {
      tier = 'compact';
    } else if (window.matchMedia(QUERY_MEDIUM).matches) {
      tier = 'medium';
    } else if (window.matchMedia(QUERY_ULTRAWIDE).matches) {
      tier = 'ultrawide';
    } else if (window.matchMedia(QUERY_EXPANDED).matches) {
      tier = 'expanded';
    }
  } else {
    const w = window.innerWidth || 1280;
    if (w < 640) tier = 'compact';
    else if (w < 1024) tier = 'medium';
    else if (w >= 1920) tier = 'ultrawide';
    else tier = 'expanded';
  }

  // 2. Pointer Hardware & Hover Capabilities
  const hasFinePointer = hasMatchMedia && window.matchMedia(QUERY_POINTER_FINE).matches;
  const hasCoarsePointer = hasMatchMedia && window.matchMedia(QUERY_POINTER_COARSE).matches;
  const hasHover = hasMatchMedia ? window.matchMedia(QUERY_HOVER).matches : true;
  const hasTouchCapability =
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0) ||
    hasCoarsePointer;

  let pointerMode: PointerMode = 'mouse';
  if (hasCoarsePointer && !hasHover) {
    pointerMode = 'touch';
  } else if (hasFinePointer && !hasHover) {
    pointerMode = 'stylus';
  } else if (hasFinePointer && hasHover) {
    pointerMode = 'mouse';
  } else if (hasTouchCapability) {
    pointerMode = 'touch';
  }

  // 3. Motion Preference
  const motion: MotionPreference =
    hasMatchMedia && window.matchMedia(QUERY_REDUCED_MOTION).matches
      ? 'reduced'
      : 'standard';

  // 4. Device Pixel Ratio
  const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));

  // 5. Window Inner Dimensions (Avoid offsetWidth/offsetHeight thrashing)
  const width = window.innerWidth || 1280;
  const height = window.innerHeight || 800;

  return {
    screenTier: tier,
    pointerMode,
    motion,
    dpr,
    isTouch: hasTouchCapability,
    hasHover,
    width,
    height,
  };
}

/**
 * Synchronizes hardware state onto the <html> root element inside requestAnimationFrame
 */
function syncDomAttributes(state: DeviceTelemetryState): void {
  if (typeof document === 'undefined') return;

  if (rafId !== null) {
    cancelAnimationFrame(rafId);
  }

  rafId = requestAnimationFrame(() => {
    const root = document.documentElement;
    if (!root) return;

    if (root.getAttribute('data-screen-tier') !== state.screenTier) {
      root.setAttribute('data-screen-tier', state.screenTier);
    }
    if (root.getAttribute('data-pointer-mode') !== state.pointerMode) {
      root.setAttribute('data-pointer-mode', state.pointerMode);
    }
    if (root.getAttribute('data-motion') !== state.motion) {
      root.setAttribute('data-motion', state.motion);
    }
    const dprStr = state.dpr.toFixed(2);
    if (root.style.getPropertyValue('--erp-dpr') !== dprStr) {
      root.style.setProperty('--erp-dpr', dprStr);
    }
    rafId = null;
  });
}

/**
 * Notifies all registered state subscribers
 */
function notifySubscribers(): void {
  const nextState = evaluateTelemetry();

  // Check shallow equality to avoid redundant updates
  const hasChanged =
    currentState.screenTier !== nextState.screenTier ||
    currentState.pointerMode !== nextState.pointerMode ||
    currentState.motion !== nextState.motion ||
    currentState.dpr !== nextState.dpr ||
    currentState.isTouch !== nextState.isTouch ||
    currentState.hasHover !== nextState.hasHover;

  currentState = nextState;
  syncDomAttributes(currentState);

  if (hasChanged) {
    listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (err) {
        console.error('[Telemetry] Subscriber notification error:', err);
      }
    });
  }
}

/**
 * Attach matchMedia listeners with cross-browser fallback support
 */
function attachMqlListener(
  query: string,
  handler: (e: MediaQueryListEvent | MediaQueryList) => void
): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};

  try {
    const mql = window.matchMedia(query);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    } else if (typeof mql.addListener === 'function') {
      // Fallback for older Safari / legacy WebKit
      mql.addListener(handler);
      return () => mql.removeListener(handler);
    }
  } catch (err) {
    console.warn('[Telemetry] matchMedia listener attach failed for:', query, err);
  }
  return () => {};
}

/**
 * Singleton Initialization: Sets up zero-thrash asynchronous hardware watchers
 */
export function initERPTelemetry(): () => void {
  if (isInitialized || typeof window === 'undefined') {
    return () => {};
  }
  isInitialized = true;

  // Immediate initial evaluation
  currentState = evaluateTelemetry();
  syncDomAttributes(currentState);

  const cleanups: Array<() => void> = [];

  // Register asynchronous matchMedia listeners for all breakpoints
  const queries = [
    QUERY_COMPACT,
    QUERY_MEDIUM,
    QUERY_EXPANDED,
    QUERY_ULTRAWIDE,
    QUERY_POINTER_COARSE,
    QUERY_POINTER_FINE,
    QUERY_HOVER,
    QUERY_REDUCED_MOTION,
  ];

  queries.forEach((q) => {
    cleanups.push(attachMqlListener(q, () => notifySubscribers()));
  });

  // Watch for orientation / DPR change
  let dprMqlCleanup: (() => void) | null = null;
  const watchDprChange = () => {
    if (dprMqlCleanup) dprMqlCleanup();
    const currentDpr = window.devicePixelRatio || 1;
    dprMqlCleanup = attachMqlListener(`(resolution: ${currentDpr}dppx)`, () => {
      notifySubscribers();
      watchDprChange();
    });
  };
  watchDprChange();

  // Low-frequency window resize handler with requestAnimationFrame debounce (no sync layout read)
  let resizeTimeout: any = null;
  const onWindowResize = () => {
    if (resizeTimeout) return;
    resizeTimeout = setTimeout(() => {
      resizeTimeout = null;
      notifySubscribers();
    }, 120);
  };
  window.addEventListener('resize', onWindowResize, { passive: true });
  cleanups.push(() => window.removeEventListener('resize', onWindowResize));

  return () => {
    cleanups.forEach((c) => c());
    if (dprMqlCleanup) dprMqlCleanup();
    if (rafId !== null) cancelAnimationFrame(rafId);
    isInitialized = false;
  };
}

/**
 * Returns the current synchronous snapshot of device telemetry
 */
export function getDeviceTelemetry(): DeviceTelemetryState {
  return currentState;
}

/**
 * Subscribes to device telemetry updates
 */
export function subscribeDeviceTelemetry(
  callback: (state: DeviceTelemetryState) => void
): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Reactive React Hook: useDeviceTelemetry
 * Powered by React 18/19 useSyncExternalStore for tear-free concurrent updates
 */
export function useDeviceTelemetry(): DeviceTelemetryState {
  return useSyncExternalStore(
    subscribeDeviceTelemetry,
    getDeviceTelemetry,
    () => DEFAULT_STATE
  );
}
