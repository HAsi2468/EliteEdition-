import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  X, 
  FileText, 
  Settings2, 
  Check, 
  SlidersHorizontal,
  RotateCw,
  Maximize
} from 'lucide-react';
import { executeCleanPrint } from '../utils/printService';

const SAVED_PREFS_KEY = 'elite_print_preferences';

export default function PrintOptionsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('Print Document');
  const [content, setContent] = useState('');
  const [resolver, setResolver] = useState(null);

  // Print settings
  const [paperSize, setPaperSize] = useState('A4');
  const [orientation, setOrientation] = useState('portrait');
  const [margin, setMargin] = useState('default');
  const [showHeaders, setShowHeaders] = useState(false);
  const [scale, setScale] = useState(100);

  useEffect(() => {
    // Load persisted user preferences
    try {
      const saved = localStorage.getItem(SAVED_PREFS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.paperSize) setPaperSize(parsed.paperSize);
        if (parsed.orientation) setOrientation(parsed.orientation);
        if (parsed.margin) setMargin(parsed.margin);
        if (typeof parsed.showHeaders === 'boolean') setShowHeaders(parsed.showHeaders);
        if (parsed.scale) setScale(parsed.scale);
      }
    } catch (e) {}

    const handlePrintOptions = (event) => {
      const detail = event.detail || {};
      setTitle(detail.title || 'Print Document');
      setContent(detail.content || '');
      setResolver(() => detail.resolve);

      if (detail.defaultSettings) {
        if (detail.defaultSettings.paperSize) setPaperSize(detail.defaultSettings.paperSize);
        if (detail.defaultSettings.orientation) setOrientation(detail.defaultSettings.orientation);
        if (detail.defaultSettings.margin) setMargin(detail.defaultSettings.margin);
      }

      setIsOpen(true);
    };

    window.addEventListener('elite-print-options', handlePrintOptions);
    return () => {
      window.removeEventListener('elite-print-options', handlePrintOptions);
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    if (resolver) resolver(false);
  };

  const handlePrint = async () => {
    // Persist preferences
    try {
      localStorage.setItem(SAVED_PREFS_KEY, JSON.stringify({
        paperSize,
        orientation,
        margin,
        showHeaders,
        scale
      }));
    } catch (e) {}

    setIsOpen(false);
    if (resolver) resolver(true);

    await executeCleanPrint({
      contentHtml: content,
      title,
      paperSize,
      orientation,
      margin,
      showHeaders,
      scale
    });
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div 
        className="flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200 transition-all duration-200 w-full max-w-lg"
        style={{
          width: '100%',
          maxWidth: '520px',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div 
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Printer size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>
                Print & Page Settings
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                {title}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            style={{
              padding: '0.45rem',
              borderRadius: '6px',
              color: '#64748b',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          
          {/* Paper Type */}
          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
              Paper Format / Media Type
            </label>
            <select
              value={paperSize}
              onChange={(e) => setPaperSize(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
                color: '#1e293b',
                backgroundColor: '#ffffff'
              }}
            >
              <option value="A4">A4 Standard (210 × 297 mm) — Invoices & Reports</option>
              <option value="A5">A5 Half Sheet (148 × 210 mm) — Challans & Vouchers</option>
              <option value="Letter">Letter (8.5 × 11 in)</option>
              <option value="thermal-80">Roll / Thermal Receipt (80 mm continuous)</option>
              <option value="thermal-58">Roll / Thermal Receipt (58 mm mini)</option>
              <option value="sticker-4x6">Shipping Label Sticker (4 × 6 in / 100 × 150 mm)</option>
              <option value="sticker-100x25">Barcode Roll Sticker (100 × 25 mm)</option>
              <option value="auto">Auto / System Default (System printer decides)</option>
            </select>
          </div>

          {/* Orientation */}
          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
              Orientation
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setOrientation('portrait')}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: orientation === 'portrait' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  backgroundColor: orientation === 'portrait' ? '#eff6ff' : '#ffffff',
                  color: orientation === 'portrait' ? '#1d4ed8' : '#475569',
                  fontWeight: orientation === 'portrait' ? 600 : 400,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem'
                }}
              >
                Portrait (Vertical)
              </button>
              <button
                type="button"
                onClick={() => setOrientation('landscape')}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: orientation === 'landscape' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  backgroundColor: orientation === 'landscape' ? '#eff6ff' : '#ffffff',
                  color: orientation === 'landscape' ? '#1d4ed8' : '#475569',
                  fontWeight: orientation === 'landscape' ? 600 : 400,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem'
                }}
              >
                Landscape (Horizontal)
              </button>
            </div>
          </div>

          {/* Margins */}
          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
              Margins
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              {[
                { id: 'default', label: 'Default (10mm)' },
                { id: 'minimum', label: 'Minimum (4mm)' },
                { id: 'none', label: 'None (0mm)' }
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMargin(m.id)}
                  style={{
                    padding: '0.45rem 0.5rem',
                    borderRadius: '6px',
                    border: margin === m.id ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    backgroundColor: margin === m.id ? '#eff6ff' : '#ffffff',
                    color: margin === m.id ? '#1d4ed8' : '#475569',
                    fontWeight: margin === m.id ? 600 : 400,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scale & Headers Footers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                Print Scaling
              </label>
              <select
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  color: '#1e293b',
                  backgroundColor: '#ffffff'
                }}
              >
                <option value={100}>100% (Standard)</option>
                <option value={95}>95% (Fit slight overflow)</option>
                <option value={90}>90% (Compact)</option>
                <option value={80}>80% (Wide tables)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                Browser Headers/Footers
              </label>
              <label 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  marginTop: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  color: '#475569'
                }}
              >
                <input
                  type="checkbox"
                  checked={showHeaders}
                  onChange={(e) => setShowHeaders(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                Include date & URL
              </label>
            </div>
          </div>

          {/* Information tip */}
          <div 
            style={{
              padding: '0.65rem 0.85rem',
              backgroundColor: '#f1f5f9',
              borderRadius: '6px',
              fontSize: '0.75rem',
              color: '#475569',
              borderLeft: '3px solid #2563eb'
            }}
          >
            💡 Clicking <strong>Proceed to Print</strong> will render your document cleanly and open the native system printer dialog where you can choose your physical printer, PDF export, or thermal receipt device.
          </div>
        </div>

        {/* Footer */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc'
          }}
        >
          <button
            type="button"
            onClick={handleClose}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)'
            }}
          >
            <Printer size={16} />
            Proceed to Print
          </button>
        </div>
      </div>
    </div>
  );
}
