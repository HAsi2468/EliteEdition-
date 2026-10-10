/**
 * Hardware Barcode Sniffer
 * 
 * Enterprise-grade ambient keyboard event listener that detects rapid scanner input bursts.
 * Industrial barcode scanners (Honeywell, Zebra, Datalogic, TVS, Syble, etc.) emulate USB HID
 * keyboards, emitting keystrokes at rapid intervals (<30ms per character) terminated by 'Enter'.
 * 
 * Capabilities:
 * - Ambient listening globally across window without requiring an active input field focus.
 * - Intelligent burst analysis: discriminates between human typing (80-250ms+) and scanner input (<30-35ms).
 * - Automatic prevention of form submission when scan finishes with 'Enter'.
 * - Audio confirmation via playSuccessBeep().
 * - Dispatches 'elite:barcode-scanned' CustomEvent and notifies registered subscribers.
 * - Global routing and dispatch actions.
 */

import { playSuccessBeep } from '../utils/audioHelper';

class HardwareBarcodeSniffer {
  constructor() {
    this.buffer = '';
    this.timestamps = [];
    this.maxInterKeyDelay = 45; // Max ms between keys for scanner burst
    this.minBarcodeLength = 3;  // Minimum characters for valid barcode
    this.subscribers = new Set();
    this.isEnabled = true;
    this.cleanupTimer = null;
    this.isInitialized = false;

    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    window.addEventListener('keydown', this.handleKeyDown, true); // Use capture phase
    this.isInitialized = true;
  }

  destroy() {
    if (!this.isInitialized || typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.handleKeyDown, true);
    this.isInitialized = false;
    this.resetBuffer();
  }

  resetBuffer() {
    this.buffer = '';
    this.timestamps = [];
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  handleKeyDown(e) {
    if (!this.isEnabled || !e || typeof e.key !== 'string') return;

    // Ignore modifier keys alone
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
      return;
    }

    const now = performance.now();
    const lastTimestamp = Array.isArray(this.timestamps) && this.timestamps.length > 0 
      ? this.timestamps[this.timestamps.length - 1] 
      : 0;
    const delta = lastTimestamp > 0 ? (now - lastTimestamp) : 0;

    // Check for Scan Terminator (usually Enter)
    if (e.key === 'Enter') {
      if (this.buffer && this.buffer.length >= this.minBarcodeLength) {
        // Calculate average keystroke interval
        const totalDuration = this.timestamps[this.timestamps.length - 1] - this.timestamps[0];
        const avgInterval = totalDuration / Math.max(this.buffer.length - 1, 1);

        // Hardware scanner bursts typically average < 35ms per character
        if (avgInterval <= this.maxInterKeyDelay) {
          // Scanner confirmed!
          e.preventDefault();
          e.stopPropagation();

          const scannedCode = this.buffer.trim();
          this.resetBuffer();

          this.processScannedCode(scannedCode, avgInterval);
          return;
        }
      }
      this.resetBuffer();
      return;
    }

    // Only collect single printable characters
    if (typeof e.key === 'string' && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // If delta exceeds threshold and we already had buffered keys, human typed or burst broke
      if (Array.isArray(this.timestamps) && this.timestamps.length > 0 && delta > this.maxInterKeyDelay) {
        // Reset and start new buffer with this character
        this.buffer = e.key;
        this.timestamps = [now];
      } else {
        this.buffer += e.key;
        this.timestamps.push(now);
      }

      // Safety timeout: if no Enter is pressed within 120ms of the last key, discard burst
      if (this.cleanupTimer) clearTimeout(this.cleanupTimer);
      this.cleanupTimer = setTimeout(() => {
        this.resetBuffer();
      }, 150);
    }
  }

  processScannedCode(code, avgInterval) {
    if (!code) return;

    // 1. Play audible scanner confirmation beep
    playSuccessBeep();

    const scanEventData = {
      code,
      avgInterval: Math.round(avgInterval * 10) / 10,
      timestamp: Date.now(),
      source: 'hardware_scanner'
    };

    // 2. Notify internal subscribers (first priority)
    let handledBySubscriber = false;
    for (const callback of this.subscribers) {
      try {
        const result = callback(scanEventData);
        if (result === true) {
          handledBySubscriber = true;
        }
      } catch (err) {
        console.error('[HardwareBarcodeSniffer] Subscriber callback error:', err);
      }
    }

    // 3. Dispatch global DOM CustomEvent
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('elite:barcode-scanned', {
        detail: {
          ...scanEventData,
          handled: handledBySubscriber
        }
      }));
    }
  }
}

export const hardwareBarcodeSniffer = new HardwareBarcodeSniffer();

// Auto-initialize in browser context
if (typeof window !== 'undefined') {
  hardwareBarcodeSniffer.init();
}
