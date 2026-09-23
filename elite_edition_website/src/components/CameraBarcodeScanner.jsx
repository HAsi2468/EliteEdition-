import React, { useEffect, useRef, useState, useId } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CameraOff, RefreshCw, Zap, ZapOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { playSuccessBeep, playErrorBeep } from '../utils/audioHelper';

export default function CameraBarcodeScanner({ 
  onScan, 
  onScanSuccess, 
  onClose, 
  compact = false,
  totalPieces,
  totalItems,
  lastScannedItem,
  itemsList = []
}) {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isCompact = isMobile || compact;

  // Unique DOM ID per component instance to avoid DOM collisions
  const reactId = useId();
  const regionId = `reader-camera-scanner-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const [cameraActive, setCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastScannedCode, setLastScannedCode] = useState('');
  const [cameras, setCameras] = useState([]);
  const [currentCameraIdx, setCurrentCameraIdx] = useState(0);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorchSupport, setHasTorchSupport] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const html5QrcodeRef = useRef(null);
  const isStartingRef = useRef(false);
  const isScanningRef = useRef(false);
  const lastScanTimeRef = useRef(0);
  const lastCodeRef = useRef('');

  const onScanRef = useRef(onScan || onScanSuccess);
  useEffect(() => {
    onScanRef.current = onScan || onScanSuccess;
  }, [onScan, onScanSuccess]);

  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      const viewportEl = document.getElementById(regionId);
      if (!viewportEl) return;

      try {
        setErrorMsg('');
        isStartingRef.current = true;

        // Cleanup any previous instance
        if (html5QrcodeRef.current) {
          try {
            if (isScanningRef.current) {
              await html5QrcodeRef.current.stop();
            }
            html5QrcodeRef.current.clear();
          } catch (e) { }
          html5QrcodeRef.current = null;
          isScanningRef.current = false;
        }

        // Standard 1D & 2D formats for retail, warehousing, and logistics
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE
        ];

        const html5Qrcode = new Html5Qrcode(regionId, {
          formatsToSupport,
          verbose: false
        });
        html5QrcodeRef.current = html5Qrcode;

        const config = {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const w = Math.floor(Math.min(viewfinderWidth * 0.88, 300));
            const h = Math.floor(Math.min(viewfinderHeight * 0.72, 130));
            return { width: Math.max(w, 200), height: Math.max(h, 70) };
          }
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

          // Vibration feedback on supported devices
          try {
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate(80);
            }
          } catch (e) { }

          if (isMounted) {
            setLastScannedCode(cleanText);
            playSuccessBeep();
            if (onScanRef.current) {
              onScanRef.current(cleanText);
            }
          }
        };

        const onScanFailureCallback = () => {
          // Frame scan pass with no barcode in view
        };

        // Determine target camera
        let cameraTarget = { facingMode: 'environment' };
        if (cameras.length > 0 && cameras[currentCameraIdx]) {
          cameraTarget = cameras[currentCameraIdx].id;
        }

        try {
          await html5Qrcode.start(cameraTarget, config, onScanSuccessCallback, onScanFailureCallback);
        } catch (initialErr) {
          console.warn('Initial camera target failed, trying fallback to facingMode environment:', initialErr);
          await html5Qrcode.start({ facingMode: 'environment' }, config, onScanSuccessCallback, onScanFailureCallback);
        }

        isScanningRef.current = true;
        isStartingRef.current = false;

        // Ensure iOS Safari plays inline without fullscreen popup
        setTimeout(() => {
          if (!isMounted) return;
          const videoEl = viewportEl.querySelector('video');
          if (videoEl) {
            videoEl.setAttribute('playsinline', 'true');
            videoEl.setAttribute('webkit-playsinline', 'true');
            videoEl.setAttribute('muted', 'true');
            videoEl.play().catch(() => { });
          }
        }, 100);

        if (isMounted) {
          setCameraActive(true);
          // Check for flashlight/torch capability
          try {
            const track = html5Qrcode.getRunningTrack();
            if (track && track.getCapabilities && track.getCapabilities().torch) {
              setHasTorchSupport(true);
            }
          } catch (e) { }
        }
      } catch (err) {
        console.error('Camera initialization error:', err);
        isStartingRef.current = false;
        isScanningRef.current = false;
        if (isMounted) {
          setErrorMsg('Camera access denied or unavailable. Please grant camera permission in your browser.');
          playErrorBeep();
        }
      }
    };

    const timer = setTimeout(() => {
      startScanner();
    }, 50);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      const scanner = html5QrcodeRef.current;
      if (scanner) {
        try {
          if (isScanningRef.current) {
            scanner.stop().then(() => {
              try { scanner.clear(); } catch (e) { }
            }).catch(() => { });
          } else {
            try { scanner.clear(); } catch (e) { }
          }
        } catch (e) { }
      }
      html5QrcodeRef.current = null;
      isScanningRef.current = false;
      isStartingRef.current = false;
    };
  }, [retryCount, currentCameraIdx]);

  const handleToggleTorch = async () => {
    const scanner = html5QrcodeRef.current;
    if (!scanner || !isScanningRef.current) return;
    try {
      const nextTorch = !torchOn;
      await scanner.applyVideoConstraints({ advanced: [{ torch: nextTorch }] });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  };

  const handleSwitchCamera = async () => {
    try {
      let devList = cameras;
      if (devList.length === 0) {
        devList = await Html5Qrcode.getCameras();
        setCameras(devList || []);
      }
      if (devList && devList.length > 1) {
        setCurrentCameraIdx(prev => (prev + 1) % devList.length);
      }
    } catch (e) {
      console.warn('Switch camera error:', e);
    }
  };

  return (
    <div style={styles.scannerWrapper}>
      {/* Header Bar */}
      <div style={styles.topHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, flexWrap: 'wrap' }}>
          <Camera size={16} color="#10b981" />
          <span style={styles.headerTitle}>Mobile Scanner</span>

          {totalPieces !== undefined && (
            <div style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              padding: '0.15rem 0.55rem',
              borderRadius: '20px',
              fontSize: '0.78rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              boxShadow: '0 2px 6px rgba(16,185,129,0.3)',
              letterSpacing: '0.2px'
            }}>
              <span>📦 {totalPieces} PCS</span>
              {totalItems !== undefined && (
                <span style={{ opacity: 0.88, fontSize: '0.7rem', fontWeight: 800 }}>({totalItems} styles)</span>
              )}
            </div>
          )}

          <span style={{
            ...styles.statusBadge,
            background: cameraActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 179, 8, 0.15)',
            color: cameraActive ? '#34d399' : '#facc15',
            borderColor: cameraActive ? 'rgba(16, 185, 129, 0.25)' : 'rgba(234, 179, 8, 0.25)',
          }}>
            {cameraActive ? '⚡ Live' : (errorMsg ? '⚠️ Error' : 'Connecting...')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {/* Torch / Flashlight Toggle */}
          {hasTorchSupport && (
            <button
              type="button"
              onClick={handleToggleTorch}
              style={{ ...styles.iconBtn, background: torchOn ? 'rgba(234, 179, 8, 0.25)' : 'rgba(255,255,255,0.08)', color: torchOn ? '#facc15' : '#94a3b8' }}
              title="Toggle Flashlight / Torch"
            >
              {torchOn ? <Zap size={14} /> : <ZapOff size={14} />}
            </button>
          )}

          {/* Camera Switcher Button */}
          <button
            type="button"
            onClick={handleSwitchCamera}
            style={styles.iconBtn}
            title="Switch Camera Lens"
          >
            <RefreshCw size={14} />
          </button>

          {/* Close Scanner */}
          {onClose && (
            <button type="button" onClick={onClose} style={styles.closeBtn} title="Close Camera Scanner">
              <CameraOff size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Camera Viewport & Laser Scan Effect */}
      <div style={{
        ...styles.cameraViewportContainer,
        minHeight: isCompact ? '180px' : '220px',
      }}>
        {errorMsg ? (
          <div style={styles.errorBox}>
            <AlertCircle size={24} style={{ marginBottom: '0.4rem', color: '#f87171' }} />
            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>{errorMsg}</p>
            <span style={{ fontSize: '0.74rem', opacity: 0.8, marginTop: '0.3rem', display: 'block' }}>
              Ensure camera permission is set to <strong>Allow</strong> in your phone's browser address bar.
            </span>
            <button
              type="button"
              onClick={() => setRetryCount(c => c + 1)}
              style={{
                marginTop: '0.75rem',
                padding: '0.4rem 0.85rem',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              🔄 Retry Camera
            </button>
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

      {/* Real-time Last Scanned Item Banner */}
      {lastScannedItem ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 0.85rem',
          background: 'linear-gradient(135deg, #064e3b 0%, #0f172a 100%)',
          borderTop: '2px solid #10b981'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
            <CheckCircle2 size={18} color="#34d399" style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.86rem', fontWeight: 900, color: '#ecfdf5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {lastScannedItem.skuCode}
                {lastScannedItem.size && lastScannedItem.size !== 'N/A' && (
                  <span style={{ marginLeft: '6px', background: 'rgba(255,255,255,0.18)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800 }}>
                    {lastScannedItem.size}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {lastScannedItem.itemName || 'Scanned Item'}
              </div>
            </div>
          </div>

          {/* Big Live Piece Counter for this scanned SKU */}
          <div style={{
            background: '#10b981',
            color: '#ffffff',
            padding: '0.25rem 0.75rem',
            borderRadius: '8px',
            textAlign: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(16,185,129,0.4)'
          }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9 }}>
              This Style
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, lineHeight: 1.1 }}>
              {lastScannedItem.qty || 1} <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>PCS</span>
            </div>
          </div>
        </div>
      ) : lastScannedCode ? (
        <div style={{
          ...styles.lastScannedBanner,
          padding: isCompact ? '0.35rem 0.65rem' : '0.5rem 0.85rem'
        }}>
          <CheckCircle2 size={15} color="#10b981" />
          <span style={{ fontSize: isCompact ? '0.78rem' : '0.82rem', fontWeight: 800, color: '#ecfdf5' }}>
            Scanned SKU: <span style={{ color: '#34d399', textDecoration: 'underline' }}>{lastScannedCode}</span>
          </span>
        </div>
      ) : null}

      {/* Live Horizontal Scanned SKUs & Pieces Chip Strip */}
      {itemsList && itemsList.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '0.4rem',
          padding: '0.35rem 0.65rem',
          background: '#090d16',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          borderTop: '1px solid rgba(255,255,255,0.07)'
        }}>
          {itemsList.map((item, i) => {
            const isLatest = lastScannedItem && (
              item.skuCode === lastScannedItem.skuCode || 
              (item.skuCode && item.skuCode.toLowerCase() === lastScannedItem.skuCode.toLowerCase())
            );
            return (
              <div key={i} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: isLatest ? 'rgba(16, 185, 129, 0.28)' : 'rgba(255,255,255,0.06)',
                border: isLatest ? '1.5px solid #10b981' : '1px solid rgba(255,255,255,0.12)',
                borderRadius: '6px',
                padding: '0.2rem 0.5rem',
                whiteSpace: 'nowrap',
                fontSize: '0.74rem',
                color: '#f8fafc',
                flexShrink: 0,
                transition: 'all 0.2s ease'
              }}>
                <span style={{ fontWeight: 800 }}>{item.skuCode}</span>
                <span style={{
                  background: isLatest ? '#10b981' : '#334155',
                  color: '#ffffff',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontWeight: 900,
                  fontSize: '0.72rem'
                }}>
                  {item.qty || item.qtyOut || 1} pcs
                </span>
              </div>
            );
          })}
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
    marginBottom: '0.5rem',
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
    padding: '0.12rem 0.4rem',
    borderRadius: '4px',
    border: '1px solid',
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
  },
  errorBox: {
    padding: '1.25rem 1rem',
    color: '#fca5a5',
    textAlign: 'center',
    background: 'rgba(239, 68, 68, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
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
