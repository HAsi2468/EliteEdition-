import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, RefreshCw, Volume2 } from 'lucide-react';
import { playSuccessBeep, playErrorBeep } from '../utils/audioHelper';

export default function CameraBarcodeScanner({ onScan, onClose }) {
  const regionId = 'reader-camera-scanner-viewport';
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastScannedCode, setLastScannedCode] = useState('');
  const scannerRef = useRef(null);
  const html5QrcodeScannerRef = useRef(null);
  const lastScanTimeRef = useRef(0);
  const lastCodeRef = useRef('');

  const onScanRef = useRef(onScan);

  // Keep ref updated on every render without triggering useEffect re-runs
  useEffect(() => {
    onScanRef.current = onScan;
  });

  useEffect(() => {
    let isMounted = true;
    let timer = null;

    const startScanner = async () => {
      try {
        setErrorMsg('');
        const viewportEl = document.getElementById(regionId);
        if (!viewportEl) return;

        const html5Qrcode = new Html5Qrcode(regionId);
        html5QrcodeScannerRef.current = html5Qrcode;

        const config = {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minDim = Math.min(viewfinderWidth, viewfinderHeight);
            return {
              width: Math.floor(viewfinderWidth * 0.85),
              height: Math.floor(Math.min(minDim * 0.7, 130))
            };
          },
          aspectRatio: 1.777778
        };

        await html5Qrcode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            const now = Date.now();
            const cleanText = (decodedText || '').trim();
            if (!cleanText) return;
            
            // Throttle identical scans within 800ms
            if (cleanText === lastCodeRef.current && now - lastScanTimeRef.current < 800) {
              return;
            }

            lastScanTimeRef.current = now;
            lastCodeRef.current = cleanText;

            if (isMounted) {
              setLastScannedCode(cleanText);
              playSuccessBeep();
              if (onScanRef.current) {
                onScanRef.current(cleanText);
              }
            }
          },
          (errorMessage) => {
            // Frame scan failure - normal when no barcode present
          }
        );

        if (isMounted) {
          setCameraActive(true);
        }
      } catch (err) {
        console.error('Camera initialization error:', err);
        if (isMounted) {
          setErrorMsg('Camera access denied or unavailable. Please check permissions.');
          playErrorBeep();
        }
      }
    };

    // Small delay to ensure DOM container is attached before starting Html5Qrcode
    timer = setTimeout(() => {
      startScanner();
    }, 50);

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      const scanner = html5QrcodeScannerRef.current;
      if (scanner) {
        try {
          if (scanner.isScanning) {
            scanner.stop().then(() => {
              try { scanner.clear(); } catch (e) {}
            }).catch(() => {});
          } else {
            try { scanner.clear(); } catch (e) {}
          }
        } catch (e) {
          // ignore synchronous cleanup errors
        }
      }
    };
  }, []); // Run ONLY ONCE on mount

  return (
    <div style={styles.scannerWrapper}>
      <div style={styles.topHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Camera size={16} color="#10b981" />
          <span style={styles.headerTitle}>Mobile Camera Barcode Scanner</span>
          <span style={styles.heightBadge}>30% Height View</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {lastScannedCode && (
            <div style={styles.lastScannedBadge}>
              <Volume2 size={13} color="#10b981" />
              <span>Scanned: {lastScannedCode}</span>
            </div>
          )}
          {onClose && (
            <button onClick={onClose} style={styles.closeBtn} title="Close Camera">
              <CameraOff size={15} />
            </button>
          )}
        </div>
      </div>

      <div style={styles.cameraViewportContainer}>
        {errorMsg ? (
          <div style={styles.errorBox}>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>{errorMsg}</p>
          </div>
        ) : (
          <div id={regionId} style={styles.viewportRegion} />
        )}
      </div>
    </div>
  );
}

const styles = {
  scannerWrapper: {
    background: '#0f172a',
    borderRadius: '10px',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    overflow: 'hidden',
    marginBottom: '1rem',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
  },
  topHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.45rem 0.75rem',
    background: '#1e293b',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#e2e8f0',
  },
  heightBadge: {
    fontSize: '0.68rem',
    fontWeight: '600',
    background: 'rgba(16, 185, 129, 0.15)',
    color: '#34d399',
    padding: '0.15rem 0.4rem',
    borderRadius: '4px',
    border: '1px solid rgba(16, 185, 129, 0.25)',
  },
  lastScannedBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#34d399',
    background: 'rgba(16, 185, 129, 0.15)',
    padding: '0.2rem 0.5rem',
    borderRadius: '6px',
    border: '1px solid rgba(16, 185, 129, 0.3)',
  },
  closeBtn: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#f87171',
    borderRadius: '6px',
    padding: '0.25rem 0.45rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  cameraViewportContainer: {
    position: 'relative',
    width: '100%',
    height: '30vh',
    minHeight: '180px',
    maxHeight: '220px',
    overflow: 'hidden',
    background: '#000000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewportRegion: {
    width: '100%',
    height: '100%',
  },
  errorBox: {
    padding: '1rem',
    color: '#fca5a5',
    textAlign: 'center',
  }
};
