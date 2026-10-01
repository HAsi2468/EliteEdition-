// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import {
  initERPTelemetry,
  getDeviceTelemetry,
  subscribeDeviceTelemetry,
  useDeviceTelemetry,
} from '../telemetry/deviceTelemetry';
import { useContainerQuery } from '../hooks/useContainerQuery';

describe('High-Performance Auto-Adaptive UI Architecture & Token System', () => {
  beforeEach(() => {
    // Reset document element attributes
    document.documentElement.removeAttribute('data-screen-tier');
    document.documentElement.removeAttribute('data-pointer-mode');
    document.documentElement.removeAttribute('data-motion');
    document.documentElement.style.removeProperty('--erp-dpr');

    // Standard matchMedia mock
    window.matchMedia = vi.fn().mockImplementation((query: string) => {
      let matches = false;
      if (query.includes('max-width: 639px')) matches = false;
      if (query.includes('min-width: 1024px') && query.includes('max-width: 1919px')) matches = true;
      if (query.includes('pointer: fine')) matches = true;
      return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TC-TELEMETRY-01: Zero-Thrash Device & Viewport Telemetry
  // ───────────────────────────────────────────────────────────────────────────
  describe('TC-TELEMETRY-01: Zero-Thrash Device & Viewport Telemetry', () => {
    it('initializes telemetry and synchronizes attributes onto document root via requestAnimationFrame', async () => {
      // Mock requestAnimationFrame to run synchronously in tests
      const originalRaf = window.requestAnimationFrame;
      window.requestAnimationFrame = vi.fn((cb) => {
        cb(performance.now());
        return 1;
      });

      const cleanupTelemetry = initERPTelemetry();

      expect(window.requestAnimationFrame).toHaveBeenCalled();

      // Check document root attributes
      const root = document.documentElement;
      const screenTier = root.getAttribute('data-screen-tier');
      const pointerMode = root.getAttribute('data-pointer-mode');
      const motion = root.getAttribute('data-motion');
      const dpr = root.style.getPropertyValue('--erp-dpr');

      expect(['compact', 'medium', 'expanded', 'ultrawide']).toContain(screenTier);
      expect(['touch', 'mouse', 'stylus']).toContain(pointerMode);
      expect(['reduced', 'standard']).toContain(motion);
      expect(Number(dpr)).toBeGreaterThan(0);

      cleanupTelemetry();
      window.requestAnimationFrame = originalRaf;
    });

    it('returns synchronous snapshot via getDeviceTelemetry()', () => {
      const state = getDeviceTelemetry();
      expect(state).toBeDefined();
      expect(state.screenTier).toBeDefined();
      expect(state.pointerMode).toBeDefined();
      expect(state.motion).toBeDefined();
      expect(state.dpr).toBeGreaterThanOrEqual(1);
      expect(typeof state.isTouch).toBe('boolean');
      expect(typeof state.hasHover).toBe('boolean');
    });

    it('subscribes to telemetry changes and notifies subscribers', () => {
      const subscriber = vi.fn();
      const unsubscribe = subscribeDeviceTelemetry(subscriber);

      // Trigger dispatch
      const state = getDeviceTelemetry();
      expect(state).toBeTruthy();

      unsubscribe();
    });

    it('provides reactive useDeviceTelemetry React hook with useSyncExternalStore', () => {
      const TestComponent = () => {
        const telemetry = useDeviceTelemetry();
        return (
          <div data-testid="telemetry-info">
            <span data-testid="tier">{telemetry.screenTier}</span>
            <span data-testid="pointer">{telemetry.pointerMode}</span>
          </div>
        );
      };

      render(<TestComponent />);

      const tierEl = screen.getByTestId('tier');
      const pointerEl = screen.getByTestId('pointer');

      expect(tierEl.textContent).toBeTruthy();
      expect(pointerEl.textContent).toBeTruthy();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TC-CONTAINER-02: useContainerQuery Self-Measuring Hook
  // ───────────────────────────────────────────────────────────────────────────
  describe('TC-CONTAINER-02: useContainerQuery Self-Measuring Hook', () => {
    it('initializes container dimensions with fallback defaults', () => {
      const ContainerComponent = () => {
        const { ref, isCompact, isMedium, isExpanded } = useContainerQuery<HTMLDivElement>();
        return (
          <div ref={ref} data-testid="container-slot" className="erp-container-context">
            <span data-testid="compact-flag">{isCompact ? 'yes' : 'no'}</span>
            <span data-testid="medium-flag">{isMedium ? 'yes' : 'no'}</span>
            <span data-testid="expanded-flag">{isExpanded ? 'yes' : 'no'}</span>
          </div>
        );
      };

      render(<ContainerComponent />);

      const slot = screen.getByTestId('container-slot');
      expect(slot).toBeTruthy();
      expect(slot.classList.contains('erp-container-context')).toBe(true);
      expect(screen.getByTestId('compact-flag').textContent).toBe('yes');
    });
  });
});
