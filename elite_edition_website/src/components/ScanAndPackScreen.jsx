import React, { useState, useRef, useEffect } from 'react';
import { 
  PackageCheck, 
  Barcode, 
  Scan, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Boxes, 
  Layers, 
  Clock, 
  Truck, 
  ArrowRight,
  Maximize2,
  RefreshCw,
  Printer,
  ShieldCheck
} from 'lucide-react';
import EntityBrandBadge from './common/EntityBrandBadge';
import { useHardwareBarcodeSniffer } from '../hooks/useHardwareBarcodeSniffer';

export default function ScanAndPackScreen({ currentUser }) {
  const [scanInput, setScanInput] = useState('');
  const [lastScannedCode, setLastScannedCode] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [hardwareDetected, setHardwareDetected] = useState(false);
  const inputRef = useRef(null);

  // Hook up hardware barcode sniffer
  useHardwareBarcodeSniffer((event) => {
    if (event?.code) {
      setHardwareDetected(true);
      handleProcessScan(event.code, 'Hardware Scanner');
    }
  });

  // Focus input automatically on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleProcessScan = (codeToProcess, source = 'Manual Input') => {
    const trimmed = (codeToProcess || '').trim();
    if (!trimmed) return;

    const newScanEntry = {
      id: Date.now(),
      code: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      source: source
    };

    setLastScannedCode(trimmed);
    setScanHistory(prev => [newScanEntry, ...prev.slice(0, 19)]);
    setScanInput('');

    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    handleProcessScan(scanInput, 'Manual / USB');
  };

  return (
    <div className="scan-and-pack-screen" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', minHeight: '100%' }}>
      {/* Top Header Banner */}
      <div className="glass-panel" style={{
        padding: '1.25rem 1.75rem',
        borderRadius: 'var(--radius-lg, 16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.25), rgba(99, 102, 241, 0.25))',
            border: '1px solid rgba(14, 165, 233, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8'
          }}>
            <PackageCheck size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '700', color: 'var(--text-primary, #ffffff)', letterSpacing: '-0.02em' }}>
                Scan & Pack
              </h2>
              <EntityBrandBadge entityId="elite_online" />
            </div>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)' }}>
              Order Verification, Barcode Inward/Outward & Dispatch Packing Station
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.4rem 0.85rem',
            borderRadius: '999px',
            background: hardwareDetected ? 'rgba(34, 197, 94, 0.12)' : 'rgba(14, 165, 233, 0.12)',
            border: `1px solid ${hardwareDetected ? 'rgba(34, 197, 94, 0.3)' : 'rgba(14, 165, 233, 0.25)'}`,
            fontSize: '0.75rem',
            fontWeight: 600,
            color: hardwareDetected ? '#4ade80' : '#38bdf8'
          }}>
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: hardwareDetected ? '#22c55e' : '#0ea5e9',
              boxShadow: hardwareDetected ? '0 0 8px #22c55e' : '0 0 6px #0ea5e9',
              animation: 'pulse 2s infinite'
            }} />
            <span>{hardwareDetected ? 'Hardware Scanner Active' : 'Ready for Scan Bursts'}</span>
          </div>

          <button 
            type="button"
            onClick={() => {
              setScanHistory([]);
              setLastScannedCode(null);
              if (inputRef.current) inputRef.current.focus();
            }}
            title="Reset Workspace"
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text-muted, #94a3b8)',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.2s ease'
            }}
          >
            <RefreshCw size={13} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Main Barcode Scan Input Strip */}
      <div className="glass-panel" style={{
        padding: '1.5rem',
        borderRadius: 'var(--radius-lg, 16px)',
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <div style={{
              position: 'absolute',
              left: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#38bdf8',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center'
            }}>
              <Barcode size={22} />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder="Scan AWB, Order No, SKU or Barcode (Hardware scanner auto-detected)..."
              style={{
                width: '100%',
                padding: '0.85rem 1rem 0.85rem 3rem',
                fontSize: '0.95rem',
                borderRadius: '10px',
                border: '1px solid rgba(14, 165, 233, 0.3)',
                background: 'rgba(0, 0, 0, 0.4)',
                color: '#ffffff',
                outline: 'none',
                fontFamily: 'monospace',
                letterSpacing: '0.04em',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#0ea5e9';
                e.target.style.boxShadow = '0 0 0 2px rgba(14, 165, 233, 0.2)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(14, 165, 233, 0.3)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              padding: '0.85rem 1.4rem',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
              border: 'none',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 14px rgba(14, 165, 233, 0.35)',
              transition: 'transform 0.15s ease, opacity 0.15s ease'
            }}
          >
            <Scan size={16} />
            <span>Process</span>
          </button>
        </form>

        {lastScannedCode && (
          <div style={{
            marginTop: '1rem',
            padding: '0.65rem 1rem',
            borderRadius: '8px',
            background: 'rgba(14, 165, 233, 0.1)',
            border: '1px solid rgba(14, 165, 233, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8' }}>
              <CheckCircle2 size={16} />
              <span>Last Scanned Barcode: <strong style={{ color: '#ffffff', fontFamily: 'monospace' }}>{lastScannedCode}</strong></span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
              {new Date().toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* Workflow Process Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1rem'
      }}>
        <div className="glass-panel" style={{
          padding: '1.25rem',
          borderRadius: '12px',
          background: 'rgba(15, 23, 42, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
              fontWeight: 700,
              fontSize: '0.85rem'
            }}>1</div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>
              Scan Order / AWB
            </h4>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.4 }}>
            Point your physical scanner or enter shipping tracking number / marketplace order ID to fetch order contents.
          </p>
        </div>

        <div className="glass-panel" style={{
          padding: '1.25rem',
          borderRadius: '12px',
          background: 'rgba(15, 23, 42, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(168, 85, 247, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c084fc',
              fontWeight: 700,
              fontSize: '0.85rem'
            }}>2</div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>
              Verify Item SKUs
            </h4>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.4 }}>
            Scan each item barcode or garment tag. Zero mismatch guarantee prevents wrong items or sizes from being packed.
          </p>
        </div>

        <div className="glass-panel" style={{
          padding: '1.25rem',
          borderRadius: '12px',
          background: 'rgba(15, 23, 42, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(34, 197, 94, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4ade80',
              fontWeight: 700,
              fontSize: '0.85rem'
            }}>3</div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>
              Pack & Dispatch
            </h4>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.4 }}>
            Generate and print invoice/shipping label, mark parcel packed, and automatically log packing event in ERP.
          </p>
        </div>
      </div>

      {/* Main Workspace Area (Blank / Starter Stage) */}
      <div className="glass-panel" style={{
        padding: '3rem 2rem',
        borderRadius: 'var(--radius-lg, 16px)',
        background: 'rgba(15, 23, 42, 0.5)',
        border: '1px dashed rgba(255, 255, 255, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        minHeight: '320px',
        gap: '1rem'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(14, 165, 233, 0.08)',
          border: '1px solid rgba(14, 165, 233, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#38bdf8'
        }}>
          <Boxes size={32} />
        </div>

        <div style={{ maxWidth: '520px' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>
            Scan & Pack Station Ready
          </h3>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.5 }}>
            This blank screen is now registered in the <strong>Elite Online</strong> (EON) module.
            Connect your barcode scanner or scan a shipping label / order barcode above to begin packing.
          </p>
        </div>

        {scanHistory.length > 0 && (
          <div style={{ marginTop: '1.5rem', width: '100%', maxWidth: '600px', textAlign: 'left' }}>
            <h5 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Recent Session Scans ({scanHistory.length})
            </h5>
            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              overflow: 'hidden'
            }}>
              {scanHistory.map((scan) => (
                <div 
                  key={scan.id} 
                  style={{
                    padding: '0.6rem 1rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.85rem'
                  }}
                >
                  <span style={{ fontFamily: 'monospace', color: '#38bdf8', fontWeight: 600 }}>{scan.code}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted, #94a3b8)' }}>{scan.source}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>{scan.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
