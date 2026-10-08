import { useEffect } from 'react';
import { hardwareBarcodeSniffer } from '../services/hardwareBarcodeSniffer';

/**
 * useHardwareBarcodeSniffer
 * 
 * Reusable React hook for listening to hardware scanner bursts inside components.
 * 
 * @param {Function} onScan - Callback function invoked when a hardware barcode is scanned. Receives { code, avgInterval, timestamp, source }
 * @param {boolean} enabled - Whether the listener is active (defaults to true)
 */
export function useHardwareBarcodeSniffer(onScan, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof onScan !== 'function') return;

    const unsubscribe = hardwareBarcodeSniffer.subscribe(onScan);
    return () => {
      unsubscribe();
    };
  }, [onScan, enabled]);
}
