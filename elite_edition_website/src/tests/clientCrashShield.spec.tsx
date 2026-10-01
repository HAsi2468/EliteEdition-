// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { RootErrorBoundary, generateIncidentId } from '../components/RootErrorBoundary';
import { RouteErrorBoundary } from '../components/RouteErrorBoundary';
import { SmartActionGroup } from '../components/common/SmartActionGroup';
import {
  setupGlobalCrashListeners,
  normalizeToError,
  isBenignNoise,
} from '../utils/globalCrashListeners';

// Fallback polyfill for jsdom environment if PromiseRejectionEvent is undefined
class SyntheticPromiseRejectionEvent extends Event {
  public promise: Promise<any>;
  public reason: any;

  constructor(
    type: string,
    options: { promise: Promise<any>; reason: any; cancelable?: boolean }
  ) {
    super(type, { cancelable: options.cancelable ?? true });
    this.promise = options.promise;
    this.reason = options.reason;
  }
}

describe('Phase 1: Silent Client-Side Crashes & Resilient Error Telemetry', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleGroupSpy: ReturnType<typeof vi.spyOn>;
  let consoleGroupEndSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Silence expected test error logs
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    consoleErrorSpy.mockRestore();
    consoleGroupSpy.mockRestore();
    consoleGroupEndSpy.mockRestore();
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TC-CRASH-01: Root Error Boundary Fatal Render Crash Isolation
  // ───────────────────────────────────────────────────────────────────────────
  describe('TC-CRASH-01: Root Error Boundary Fatal Render Crash Containment', () => {
    const ProblematicComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
      if (shouldThrow) {
        throw new Error('Undefined prop dereference');
      }
      return <div data-testid="healthy-app-root">Normal Application UI</div>;
    };

    it('renders normal children when no error occurs', () => {
      render(
        <RootErrorBoundary>
          <ProblematicComponent shouldThrow={false} />
        </RootErrorBoundary>
      );

      expect(screen.getByTestId('healthy-app-root')).toBeTruthy();
      expect(screen.getByText('Normal Application UI')).toBeTruthy();
      expect(screen.queryByTestId('root-error-boundary-screen')).toBeNull();
    });

    it('catches render exceptions, isolates the crash, and renders full-page fallback screen', () => {
      render(
        <RootErrorBoundary>
          <ProblematicComponent shouldThrow={true} />
        </RootErrorBoundary>
      );

      // 1. Assert fallback screen renders
      const fallbackScreen = screen.getByTestId('root-error-boundary-screen');
      expect(fallbackScreen).toBeTruthy();

      // 2. Assert no raw white screen / healthy app root unmounted safely
      expect(screen.queryByTestId('healthy-app-root')).toBeNull();

      // 3. Assert title and support incident chip
      expect(screen.getByText('Application Shield Activated')).toBeTruthy();
      const chip = screen.getByTestId('incident-id-chip');
      expect(chip).toBeTruthy();
      expect(chip.textContent).toContain('Support Incident Reference ID');

      // 4. Assert valid Incident ID is present and non-empty
      const incidentText = chip.textContent || '';
      expect(incidentText.length).toBeGreaterThan(20);

      // 5. Assert Action CTAs are present
      expect(screen.getByTestId('hard-refresh-btn')).toBeTruthy();
      expect(screen.getByTestId('recover-view-btn')).toBeTruthy();
      expect(screen.getByTestId('contact-support-btn')).toBeTruthy();
    });

    it('dispatches structured telemetry crash event on window when error is caught', () => {
      const telemetryListener = vi.fn();
      window.addEventListener('elite-telemetry-crash', telemetryListener);

      render(
        <RootErrorBoundary>
          <ProblematicComponent shouldThrow={true} />
        </RootErrorBoundary>
      );

      expect(telemetryListener).toHaveBeenCalledTimes(1);
      const customEvent = telemetryListener.mock.calls[0][0] as CustomEvent;
      expect(customEvent.detail).toBeTruthy();
      expect(customEvent.detail.message).toContain('Undefined prop dereference');
      expect(customEvent.detail.incidentId).toBeTruthy();
      expect(customEvent.detail.timestamp).toBeTruthy();

      window.removeEventListener('elite-telemetry-crash', telemetryListener);
    });

    it('toggles technical diagnostics accordion when user clicks button', () => {
      render(
        <RootErrorBoundary>
          <ProblematicComponent shouldThrow={true} />
        </RootErrorBoundary>
      );

      // Initially details are collapsed
      expect(screen.queryByTestId('crash-technical-details')).toBeNull();

      // Click to expand
      const toggleBtn = screen.getByText('Show Technical Diagnostics');
      fireEvent.click(toggleBtn);

      const details = screen.getByTestId('crash-technical-details');
      expect(details).toBeTruthy();
      expect(details.textContent).toContain('Undefined prop dereference');

      // Click to collapse
      fireEvent.click(screen.getByText('Hide Technical Diagnostics'));
      expect(screen.queryByTestId('crash-technical-details')).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TC-CRASH-02: Route-Level Error Boundary Sub-Tree Isolation
  // ───────────────────────────────────────────────────────────────────────────
  describe('TC-CRASH-02: RouteErrorBoundary Sub-Route Containment', () => {
    const CrashingRoute = () => {
      throw new Error('Network table parser failed on malformed CSV');
    };

    it('isolates sub-route crashes and preserves parent application shell', () => {
      const resetFn = vi.fn();

      render(
        <div data-testid="global-app-shell">
          <header data-testid="top-navigation">Global Navigation Bar</header>
          <aside data-testid="persistent-sidebar">Global Sidebar Menu</aside>
          <main>
            <RouteErrorBoundary routeName="Billing Department" onReset={resetFn}>
              <CrashingRoute />
            </RouteErrorBoundary>
          </main>
        </div>
      );

      // 1. Assert global shell remains completely intact
      expect(screen.getByTestId('global-app-shell')).toBeTruthy();
      expect(screen.getByTestId('top-navigation')).toBeTruthy();
      expect(screen.getByTestId('persistent-sidebar')).toBeTruthy();

      // 2. Assert localized route error card renders inside main
      const routeCard = screen.getByTestId('route-error-boundary-card');
      expect(routeCard).toBeTruthy();
      expect(screen.getByText(/Failed to Render "Billing Department"/i)).toBeTruthy();

      // 3. Assert route actions exist
      expect(screen.getByTestId('reload-route-btn')).toBeTruthy();
      expect(screen.getByTestId('return-dashboard-btn')).toBeTruthy();
    });

    it('dispatches sub-route crash telemetry event on window', () => {
      const routeTelemetryListener = vi.fn();
      window.addEventListener('elite-telemetry-route-crash', routeTelemetryListener);

      render(
        <RouteErrorBoundary routeName="Fabric Inventory">
          <CrashingRoute />
        </RouteErrorBoundary>
      );

      expect(routeTelemetryListener).toHaveBeenCalledTimes(1);
      const event = routeTelemetryListener.mock.calls[0][0] as CustomEvent;
      expect(event.detail.routeName).toBe('Fabric Inventory');
      expect(event.detail.incidentId).toBeTruthy();

      window.removeEventListener('elite-telemetry-route-crash', routeTelemetryListener);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TC-CRASH-04: Global Async Exception & Promise Rejection Interception
  // ───────────────────────────────────────────────────────────────────────────
  describe('TC-CRASH-04: Global Async Exception & Promise Rejection Interception', () => {
    let cleanup: () => void;

    beforeEach(() => {
      cleanup = setupGlobalCrashListeners();
    });

    afterEach(() => {
      cleanup();
    });

    it('captures unhandled promise rejections without crashing active DOM view', () => {
      const toastListener = vi.fn();
      const telemetryListener = vi.fn();

      window.addEventListener('elite-toast', toastListener);
      window.addEventListener('elite-telemetry-async-error', telemetryListener);

      // Render a mounted view
      render(<div data-testid="active-active-view">Live Active Screen View</div>);

      // Dispatch synthetic unhandled rejection
      const syntheticError = new Error('Async background polling timeout');
      const rejectionEvent = new SyntheticPromiseRejectionEvent('unhandledrejection', {
        promise: Promise.reject(syntheticError).catch(() => {}),
        reason: syntheticError,
        cancelable: true,
      });

      act(() => {
        window.dispatchEvent(rejectionEvent);
      });

      // 1. Assert active view stays mounted
      expect(screen.getByTestId('active-active-view')).toBeTruthy();

      // 2. Assert telemetry event dispatched
      expect(telemetryListener).toHaveBeenCalledTimes(1);
      const telemEvt = telemetryListener.mock.calls[0][0] as CustomEvent;
      expect(telemEvt.detail.type).toBe('UNHANDLED_REJECTION');
      expect(telemEvt.detail.message).toContain('Async background polling timeout');

      // 3. Assert non-fatal toast notification was triggered
      expect(toastListener).toHaveBeenCalledTimes(1);
      const toastEvt = toastListener.mock.calls[0][0] as CustomEvent;
      expect(toastEvt.detail.title).toBe('Async Operation Alert');
      expect(toastEvt.detail.message).toContain('Async background polling timeout');

      window.removeEventListener('elite-toast', toastListener);
      window.removeEventListener('elite-telemetry-async-error', telemetryListener);
    });

    it('normalizes irregular thrown values (strings, plain objects, nulls) into standard Error instances', () => {
      // 1. String
      const errFromString = normalizeToError('Database disconnected');
      expect(errFromString).toBeInstanceOf(Error);
      expect(errFromString.message).toBe('Database disconnected');

      // 2. Object with message property
      const errFromObj = normalizeToError({ message: 'Rate limit exceeded', code: 429 });
      expect(errFromObj).toBeInstanceOf(Error);
      expect(errFromObj.message).toBe('Rate limit exceeded');

      // 3. Null / Undefined
      const errFromNull = normalizeToError(null);
      expect(errFromNull).toBeInstanceOf(Error);

      // 4. Native Error instance
      const nativeErr = new Error('Native exception');
      expect(normalizeToError(nativeErr)).toBe(nativeErr);
    });

    it('filters out benign browser extension errors and AbortError cancellations', () => {
      expect(isBenignNoise(new Error('AbortError: Request aborted by user navigation'))).toBe(true);
      expect(isBenignNoise('chrome-extension://xyz123/content.js failed')).toBe(true);
      expect(isBenignNoise('ResizeObserver loop completed with undelivered notifications')).toBe(true);
      expect(isBenignNoise(new Error('Database corruption'))).toBe(false);
    });

    it('generates high-entropy Incident IDs following UUID format', () => {
      const id1 = generateIncidentId();
      const id2 = generateIncidentId();

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
      expect(id1.length).toBeGreaterThan(15);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TC-ACTION-01: Multi-Row Table Action Column (Max 4 Per Row)
  // ───────────────────────────────────────────────────────────────────────────
  describe('TC-ACTION-01: Table Action Column Multi-Row Layout (Max 4 Buttons Per Row)', () => {
    it('renders actions in a single row when action count is 4 or less', () => {
      const fourActions = [
        { id: 'view', label: 'View', onClick: vi.fn() },
        { id: 'edit', label: 'Edit', onClick: vi.fn() },
        { id: 'print', label: 'Print', onClick: vi.fn() },
        { id: 'delete', label: 'Delete', onClick: vi.fn() },
      ];

      const { container } = render(<SmartActionGroup actions={fourActions} />);

      const multiRowContainer = container.querySelector('.smart-action-group-2rows');
      expect(multiRowContainer).toBeNull();

      const rows = container.querySelectorAll('.smart-action-row');
      expect(rows.length).toBe(0);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(4);
    });

    it('automatically converts to a 2nd row on that cell when more than 4 buttons exist (e.g. 7 in Job Card Panel)', () => {
      const sevenActions = [
        { id: 'challan', label: 'Billing / Challan', onClick: vi.fn() },
        { id: 'print', label: 'Print / PDF', onClick: vi.fn() },
        { id: 'preview', label: 'Preview', onClick: vi.fn() },
        { id: 'history', label: 'Audit Log', onClick: vi.fn() },
        { id: 'edit', label: 'Edit', onClick: vi.fn() },
        { id: 'share', label: 'Share', onClick: vi.fn() },
        { id: 'delete', label: 'Delete', onClick: vi.fn() },
      ];

      const { container } = render(<SmartActionGroup actions={sevenActions} />);

      // Must render the 2-row container
      const multiRowContainer = container.querySelector('.smart-action-group-2rows');
      expect(multiRowContainer).toBeTruthy();

      // Must have 2 distinct action rows
      const rows = container.querySelectorAll('.smart-action-row');
      expect(rows.length).toBe(2);

      // Row 1 must have exactly 4 buttons
      const row1Buttons = rows[0].querySelectorAll('button');
      expect(row1Buttons.length).toBe(4);

      // Row 2 must have the remaining 3 buttons
      const row2Buttons = rows[1].querySelectorAll('button');
      expect(row2Buttons.length).toBe(3);

      // Total buttons must still be 7
      expect(screen.getAllByRole('button').length).toBe(7);
    });
  });
});

