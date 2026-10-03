/**
 * ============================================================================
 * ELITE ERP ENTERPRISE - GLOBAL ASYNC CRASH SHIELD (PHASE 1)
 * Traps unhandled promise rejections, background timer errors, and uncaught
 * exceptions so that async failures never bubble up to unmount the active DOM.
 * ============================================================================
 */

import { triggerPushNotification } from '../components/NotificationToast';

export interface NormalizedErrorInfo {
  error: Error;
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  isUnhandledRejection: boolean;
  timestamp: string;
}

/**
 * Normalizes irregular thrown entities (strings, custom plain objects, nulls, undefined)
 * into standard JavaScript `Error` instances while preserving available stack traces.
 */
export function normalizeToError(reason: unknown): Error {
  if (reason instanceof Error) {
    return reason;
  }

  if (typeof reason === 'string') {
    return new Error(reason);
  }

  if (reason && typeof reason === 'object') {
    try {
      const rec = reason as Record<string, any>;
      const message =
        rec.message ||
        rec.error ||
        rec.msg ||
        rec.description ||
        JSON.stringify(reason);
      const err = new Error(String(message));
      if (typeof rec.stack === 'string') {
        err.stack = rec.stack;
      }
      return err;
    } catch {
      return new Error('Non-serializable rejection object');
    }
  }

  return new Error(String(reason || 'Unhandled Promise rejection with null/empty payload'));
}

/**
 * Determines whether an error is harmless third-party noise (browser extensions,
 * abort cancellations) that should not trigger user-facing notifications.
 */
export function isBenignNoise(errorOrMessage: unknown): boolean {
  if (!errorOrMessage) return true;

  const msg =
    errorOrMessage instanceof Error
      ? `${errorOrMessage.message} ${errorOrMessage.stack || ''}`
      : String(errorOrMessage);

  return (
    msg.includes('AbortError') ||
    msg.includes('canceled') ||
    msg.includes('cancelled') ||
    msg.includes('ResizeObserver loop') ||
    msg.includes('Script error') ||
    msg.includes('runtime.sendMessage') ||
    msg.includes('Extension context') ||
    msg.includes('Receiving end does not exist') ||
    msg.includes('Tab not found') ||
    msg.includes('chrome-extension://') ||
    msg.includes('moz-extension://') ||
    msg.includes('safari-extension://')
  );
}

/**
 * Initializes global browser rejection listeners on `window`.
 * Returns a teardown cleanup function for testing and HMR.
 */
export function setupGlobalCrashListeners(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  /**
   * 1. Window Error Interceptor
   * Intercepts uncaught exceptions in event listeners, script tags, and setTimeouts.
   */
  const errorHandler = (event: ErrorEvent): boolean | void => {
    const error = event.error ? normalizeToError(event.error) : normalizeToError(event.message);

    if (isBenignNoise(error)) {
      return;
    }

    const info: NormalizedErrorInfo = {
      error,
      message: error.message,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      isUnhandledRejection: false,
      timestamp: new Date().toISOString(),
    };

    console.error('🛡️ [GlobalCrashShield] Intercepted Uncaught Runtime Error:', info);

    // Dispatch telemetry event for analytics & monitoring
    window.dispatchEvent(
      new CustomEvent('elite-telemetry-async-error', {
        detail: {
          type: 'UNCAUGHT_EXCEPTION',
          message: info.message,
          source: info.source,
          lineno: info.lineno,
          colno: info.colno,
          timestamp: info.timestamp,
        },
      })
    );

    // Display non-fatal, non-intrusive toast notification
    const displayMsg =
      info.message.length > 140 ? `${info.message.substring(0, 140)}...` : info.message;
    triggerPushNotification('Background System Notice', displayMsg, 'warning');

    // Prevent default browser error reporting if applicable
    return false;
  };

  /**
   * 2. Unhandled Promise Rejection Interceptor
   * Intercepts unhandled Promise.reject() in async API calls, websockets, and background tasks.
   */
  const unhandledRejectionHandler = (event: PromiseRejectionEvent): void => {
    const error = normalizeToError(event.reason);

    if (isBenignNoise(error)) {
      return;
    }

    const info: NormalizedErrorInfo = {
      error,
      message: error.message,
      isUnhandledRejection: true,
      timestamp: new Date().toISOString(),
    };

    console.error('🛡️ [GlobalCrashShield] Intercepted Unhandled Promise Rejection:', info);

    // Dispatch telemetry event for background crash loggers
    window.dispatchEvent(
      new CustomEvent('elite-telemetry-async-error', {
        detail: {
          type: 'UNHANDLED_REJECTION',
          message: info.message,
          stack: error.stack,
          timestamp: info.timestamp,
        },
      })
    );

    // Prevent promise rejections from killing or unmounting the active UI DOM
    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    // Display gentle, non-intrusive user alert
    const displayMsg =
      info.message.length > 150 ? `${info.message.substring(0, 150)}...` : info.message;
    triggerPushNotification('Async Operation Alert', displayMsg, 'warning');
  };

  window.addEventListener('error', errorHandler);
  window.addEventListener('unhandledrejection', unhandledRejectionHandler);

  // Return teardown function
  return () => {
    window.removeEventListener('error', errorHandler);
    window.removeEventListener('unhandledrejection', unhandledRejectionHandler);
  };
}
