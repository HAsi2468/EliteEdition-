import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CameraOff, RefreshCw, Volume2, Zap, ZapOff, CheckCircle2 } from 'lucide-react';
import { playSuccessBeep, playErrorBeep } from '../utils/audioHelper';

export default function CameraBarcodeScanner({ onScan, onScanSuccess, onClose, compact = false }) {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isCompact = isMobile || compact;
  const regionId = 'reader-camera-scanner-viewport';
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastScannedCode, setLastScannedCode] = useState('');
  const [cameras, setCameras] = useState([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorchSupport, setHasTorchSupport] = useState(false);

  const html5QrcodeScannerRef = useRef(null);
  const lastScanTimeRef = useRef(0);
  const lastCodeRef = useRef('');

  const onScanRef = useRef(onScan || onScanSuccess);
  useEffect(() => {
    onScanRef.current = onScan || onScanSuccess;
  }, [onScan, onScanSuccess]);

  // Fetch available camera devices on mount
  useEffect(() => {
    Html5Qrcode.getCameras().then((devices) => {
      if (devices && devices.length > 0) {
        setCameras(devices);
        // Prefer back/environment camera if identified by label
        const backCamIdx = devices.findIndex(d => 
          (d.label || '').toLowerCase().includes('back') || 
          (d.label || '').toLowerCase().includes('rear') ||
          (d.label || '').toLowerCase().includes('environment')
        );
        if (backCamIdx > -1) {
          setSelectedCameraIndex(backCamIdx);
        }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let isMounted = true;
    let timer = null;

    const startScanner = async () => {
      try {
        setErrorMsg('');
        const viewportEl = document.getElementById(regionId);
        if (!viewportEl) return;

        // Cleanup existing scanner instance if switching cameras
        if (html5QrcodeScannerRef.current) {
          try {
            if (html5QrcodeScannerRef.current.isScanning) {
              await html5QrcodeScannerRef.current.stop();
            }
            html5QrcodeScannerRef.current.clear();
          } catch (e) {}
        }

        // Configure supported 1D & 2D barcode formats explicitly for fast detection
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.ITF
        ];

        const html5Qrcode = new Html5Qrcode(regionId, {
          formatsToSupport,
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true // Native GPU/NPU acceleration on mobile
          }
        });
        html5QrcodeScannerRef.current = html5Qrcode;

        const config = {
          fps: 22, // High frame rate for fast mobile capture
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const w = Math.floor(Math.min(viewfinderWidth * 0.88, 300));
            const h = Math.floor(Math.min(viewfinderHeight * 0.7, 130));
            return { width: Math.max(w, 200), height: Math.max(h, 75) };
          },
          aspectRatio: isCompact ? 1.777778 : 1.333333
        };

        const onScanSuccessCallback = (decodedText) => {
          const now = Date.now();
          const cleanText = (decodedText || '').trim();
          if (!cleanText) return;
          
          // Throttle identical scans within 800ms
          if (cleanText === lastCodeRef.current && now - lastScanTimeRef.current < 800) {
            return;
          }

          lastScanTimeRef.current = now;
          lastCodeRef.current = cleanText;

          // Trigger haptic vibration feedback on mobile phones (Android / supported)
          try {
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate(80);
            }
          } catch (e) {}

          if (isMounted) {
            setLastScannedCode(cleanText);
            playSuccessBeep();
            if (onScanRef.current) {
              onScanRef.current(cleanText);
            }
          }
        };

        const onScanFailureCallback = () => {
          // Frame scan failure - normal when no barcode present in frame
        };

        // Determine camera target (device ID or facingMode environment)
        const cameraTarget = (cameras.length > 0 && cameras[selectedCameraIndex]) 
          ? cameras[selectedCameraIndex].id 
          : { facingMode: 'environment' };

        try {
          await html5Qrcode.start(cameraTarget, config, onScanSuccessCallback, onScanFailureCallback);
        } catch (initialErr) {
          console.warn('Initial camera target failed, trying fallback to facingMode environment:', initialErr);
          // Fallback for iPhone / Safari when specific device ID fails
          await html5Qrcode.start({ facingMode: 'environment' }, config, onScanSuccessCallback, onScanFailureCallback);
        }

        // iPhone / iOS Safari: Ensure video element plays inline without fullscreen popup
        setTimeout(() => {
          if (!isMounted) return;
          const videoEl = viewportEl.querySelector('video');
          if (videoEl) {
            videoEl.setAttribute('playsinline', 'true');
            videoEl.setAttribute('webkit-playsinline', 'true');
            videoEl.setAttribute('muted', 'true');
            videoEl.play().catch(() => {});
          }
        }, 100);

        if (isMounted) {
          setCameraActive(true);
          // Check if torch/flashlight feature is available on current stream
          try {
            const track = html5Qrcode.getRunningTrack();
            if (track && track.getCapabilities && track.getCapabilities().torch) {
              setHasTorchSupport(true);
            }
          } catch (e) {}
        }
      } catch (err) {
        console.error('Camera initialization error:', err);
        if (isMounted) {
          setErrorMsg('Camera access denied or unavailable. Please check browser camera permissions.');
          playErrorBeep();
        }
      }
    };

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
        } catch (e) {}
      }
    };
  }, [selectedCameraIndex, cameras]);

  const handleToggleTorch = async () => {
    const scanner = html5QrcodeScannerRef.current;
    if (!scanner || !scanner.isScanning) return;
    try {
      const nextTorch = !torchOn;
      await scanner.applyVideoConstraints({ advanced: [{ torch: nextTorch }] });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  };

  const handleSwitchCamera = () => {
    if (cameras.length > 1) {
      setSelectedCameraIndex((prev) => (prev + 1) % cameras.length);
    }
  };

  return (
    <div style={styles.scannerWrapper}>
      {/* Header bar */}
      <div style={styles.topHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Camera size={16} color="#10b981" />
          <span style={styles.headerTitle}>Mobile Barcode Scanner</span>
          <span style={styles.statusBadge}>
            {cameraActive ? '⚡ Live HD Scan' : 'Connecting...'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {/* Torch / Flashlight Toggle */}
          {hasTorchSupport && (
            <button
              onClick={handleToggleTorch}
              style={{ ...styles.iconBtn, background: torchOn ? 'rgba(234, 179, 8, 0.25)' : 'rgba(255,255,255,0.08)', color: torchOn ? '#facc15' : '#94a3b8' }}
              title="Toggle Flashlight / Torch"
            >
              {torchOn ? <Zap size={14} /> : <ZapOff size={14} />}
            </button>
          )}

          {/* Camera Switcher (if phone has multiple rear lenses) */}
          {cameras.length > 1 && (
            <button
              onClick={handleSwitchCamera}
              style={styles.iconBtn}
              title={`Switch Camera (${selectedCameraIndex + 1}/${cameras.length})`}
            >
              <RefreshCw size={14} />
            </button>
          )}

          {/* Close Scanner */}
          {onClose && (
            <button onClick={onClose} style={styles.closeBtn} title="Close Camera Scanner">
              <CameraOff size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Camera Viewport & Laser Scan Effect */}
      <div style={{
        ...styles.cameraViewportContainer,
        height: isCompact ? '180px' : '30vh',
        minHeight: isCompact ? '160px' : '190px',
        maxHeight: isCompact ? '200px' : '260px'
      }}>
        {errorMsg ? (
          <div style={styles.errorBox}>
            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>{errorMsg}</p>
            <span style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.3rem', display: 'block' }}>
              Ensure camera permissions are set to Allow in browser settings.
            </span>
          </div>
        ) : (
          <>
            <div id={regionId} style={styles.viewportRegion} />
            {/* Animated Laser Scanning Beam Effect */}
            {cameraActive && (
              <div className="barcode-laser-beam" />
            )}
          </>
        )}
      </div>

      {/* Footer Scanned Code Banner */}
      {lastScannedCode && (
        <div style={{
          ...styles.lastScannedBanner,
          padding: isCompact ? '0.35rem 0.65rem' : '0.5rem 0.85rem'
        }}>
          <CheckCircle2 size={15} color="#10b981" />
          <span style={{ fontSize: isCompact ? '0.78rem' : '0.82rem', fontWeight: 800, color: '#ecfdf5' }}>
            Scanned SKU: <span style={{ color: '#34d399', textDecoration: 'underline' }}>{lastScannedCode}</span>
          </span>
        </div>
      )}
    </div>
  );
}

const styles = {
  scannerWrapper: {
    background: '#0f172a',
    borderRadius: '12px',
    border: '1px solid rgba(16, 185, 129, 0.4)',
    overflow: 'hidden',
    marginBottom: '0.65rem',
    boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.4), 0 0 15px rgba(16, 185, 129, 0.15)',
  },
  topHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.4rem 0.75rem',
    background: '#1e293b',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    fontSize: '0.8rem',
    fontWeight: '700',
    color: '#f8fafc',
  },
  statusBadge: {
    fontSize: '0.65rem',
    fontWeight: '700',
    background: 'rgba(16, 185, 129, 0.15)',
    color: '#34d399',
    padding: '0.12rem 0.4rem',
    borderRadius: '4px',
    border: '1px solid rgba(16, 185, 129, 0.25)',
  },
  iconBtn: {
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#cbd5e1',
    borderRadius: '6px',
    padding: '0.3rem 0.5rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  closeBtn: {
    background: 'rgba(239, 68, 68, 0.18)',
    border: '1px solid rgba(239, 68, 68, 0.35)',
    color: '#fca5a5',
    borderRadius: '6px',
    padding: '0.3rem 0.55rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  cameraViewportContainer: {
    position: 'relative',
    width: '100%',
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
    padding: '1.5rem 1rem',
    color: '#fca5a5',
    textAlign: 'center',
    background: 'rgba(239, 68, 68, 0.1)',
  },
  lastScannedBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.45rem',
    background: 'rgba(16, 185, 129, 0.18)',
    borderTop: '1px solid rgba(16, 185, 129, 0.3)',
  }
};

