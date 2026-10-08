import React, { useState, useEffect } from 'react';
import { Scan, Search, Copy, Check, X, ArrowUpRight } from 'lucide-react';
import './BarcodeSnifferHUD.css';

/**
 * BarcodeSnifferHUD
 * 
 * Ambient enterprise Heads-Up Display rendering live scanner burst telemetry.
 * Listens to 'elite:barcode-scanned' events and renders an interactive, non-blocking
 * toast allowing one-click lookup or clipboard copy.
 */
export function BarcodeSnifferHUD({ onGlobalSearch }) {
  const [activeScan, setActiveScan] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleScanEvent = (e) => {
      const data = e.detail;
      if (!data || !data.code) return;

      // Identify document type heuristically
      let typeLabel = 'Generic Barcode';
      const c = data.code.toUpperCase();
      if (c.startsWith('JC-') || c.startsWith('JCD-')) typeLabel = 'Job Card';
      else if (c.startsWith('CH-') || c.startsWith('DC-')) typeLabel = 'Challan';
      else if (c.startsWith('INV-')) typeLabel = 'Invoice';
      else if (c.startsWith('PUR-') || c.startsWith('BILL-')) typeLabel = 'Purchase';
      else if (c.startsWith('ROLL-') || c.startsWith('LOT-')) typeLabel = 'Fabric Lot/Roll';
      else if (c.length >= 8 && /^\d+$/.test(c)) typeLabel = 'EAN/UPC Code';

      setActiveScan({
        ...data,
        typeLabel,
        id: Date.now()
      });
      setCopied(false);
    };

    window.addEventListener('elite:barcode-scanned', handleScanEvent);
    return () => window.removeEventListener('elite:barcode-scanned', handleScanEvent);
  }, []);

  // Auto-dismiss after 4.5 seconds
  useEffect(() => {
    if (!activeScan) return;
    const timer = setTimeout(() => {
      setActiveScan(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [activeScan]);

  if (!activeScan) return null;

  const handleCopy = () => {
    if (!activeScan?.code) return;
    navigator.clipboard.writeText(activeScan.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLookup = () => {
    if (typeof onGlobalSearch === 'function') {
      onGlobalSearch(activeScan.code);
    } else {
      // Dispatch global search event
      window.dispatchEvent(new CustomEvent('elite:open-global-search', {
        detail: { query: activeScan.code }
      }));
    }
    setActiveScan(null);
  };

  return (
    <div className="barcode-hud-container" role="status" aria-live="polite">
      <div className="barcode-hud-toast">
        <div className="barcode-hud-icon">
          <Scan size={18} color="#ffffff" />
        </div>

        <div className="barcode-hud-content">
          <div className="barcode-hud-title">
            <span>Hardware Barcode Sniffer</span>
            <span className={`barcode-hud-badge ${activeScan.handled ? 'handled' : ''}`}>
              {activeScan.handled ? 'Routed' : activeScan.typeLabel}
            </span>
          </div>
          <div className="barcode-hud-code" title={activeScan.code}>
            {activeScan.code}
          </div>
        </div>

        <div className="barcode-hud-actions">
          <button
            type="button"
            className="barcode-hud-btn"
            onClick={handleCopy}
            title="Copy scanned ID"
          >
            {copied ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {!activeScan.handled && (
            <button
              type="button"
              className="barcode-hud-btn"
              onClick={handleLookup}
              title="Search ID globally across ERP"
              style={{ background: 'rgba(59, 130, 246, 0.25)', borderColor: 'rgba(59, 130, 246, 0.5)' }}
            >
              <Search size={13} />
              <span>Lookup</span>
            </button>
          )}

          <button
            type="button"
            className="barcode-hud-close"
            onClick={() => setActiveScan(null)}
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default BarcodeSnifferHUD;
