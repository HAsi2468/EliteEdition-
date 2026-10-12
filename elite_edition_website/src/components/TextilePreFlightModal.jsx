import React, { useState, useEffect } from 'react';
import { 
  X, 
  Cpu, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Droplet, 
  Layers, 
  Maximize2, 
  TrendingUp, 
  RefreshCw,
  Gauge
} from 'lucide-react';
import { textileComputeService } from '../services/textileComputeService';

export default function TextilePreFlightModal({ isOpen, onClose, initialUrl = '' }) {
  const [fileUrl, setFileUrl] = useState(initialUrl || 'https://raw.githubusercontent.com/HAsi2468/EliteEdition-/main/sample_design.jpg');
  const [targetWidth, setTargetWidth] = useState(44);
  const [targetLength, setTargetLength] = useState(100);
  const [minDpi, setMinDpi] = useState(150);
  const [inkRate, setInkRate] = useState(1800);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('full'); // 'quick' | 'full'
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialUrl) {
      setFileUrl(initialUrl);
    }
  }, [initialUrl]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRunAnalysis = async (analysisMode) => {
    setLoading(true);
    setError(null);
    setMode(analysisMode);
    try {
      if (analysisMode === 'quick') {
        const data = await textileComputeService.quickInspect(fileUrl, targetWidth, minDpi);
        setResult(data);
      } else {
        const data = await textileComputeService.fullAnalysis(fileUrl, targetWidth, targetLength, inkRate, minDpi);
        setResult(data);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Compute engine error');
    } finally {
      setLoading(false);
    }
  };

  const channelColors = {
    Cyan: { bg: '#e0f2fe', bar: '#0284c7', text: '#0369a1' },
    Magenta: { bg: '#fce7f3', bar: '#db2777', text: '#be185d' },
    Yellow: { bg: '#fef9c3', bar: '#eab308', text: '#a16207' },
    'Key (Black)': { bg: '#f1f5f9', bar: '#0f172a', text: '#0f172a' },
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        boxSizing: 'border-box',
        animation: 'fadeIn 180ms ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          background: '#ffffff',
          borderRadius: 20,
          boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.4), 0 0 0 1px rgba(226, 232, 240, 0.8)',
          overflowY: 'auto',
          padding: '1.75rem',
          boxSizing: 'border-box',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid #e2e8f0', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#ede9fe',
              color: '#7c3aed',
              boxShadow: '0 2px 6px rgba(124, 58, 237, 0.15)',
            }}>
              <Cpu size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 900, color: '#0f172a' }}>
                  Kyocera KJ4B Droplet & Pre-Flight Simulator
                </h3>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 9999,
                  background: '#ede9fe',
                  color: '#6d28d9',
                  border: '1px solid #ddd6fe',
                  letterSpacing: '0.04em',
                }}>
                  PYTHON COMPUTE
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                Sub-200ms Header Inspect • Kyocera 600 DPI Droplet Physics • Zero-OOM libvips Engine
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Input Form Controls */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 14, marginBottom: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 4 }}>
              Design File URL (TIFF, PSD, PNG, or JPEG)
            </label>
            <input
              type="text"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="e.g. https://.../design_file.tiff"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: '0.78rem',
                fontFamily: 'monospace',
                background: '#ffffff',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, color: '#475569', marginBottom: 3 }}>
                Fabric Width
              </label>
              <select
                value={targetWidth}
                onChange={(e) => setTargetWidth(Number(e.target.value))}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 700, background: '#ffffff' }}
              >
                <option value={44}>44 Inches (Kurti/Top)</option>
                <option value={50}>50 Inches (Garment)</option>
                <option value={58}>58 Inches (Suit/Dupatta)</option>
                <option value={64}>64 Inches (Max Roll)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, color: '#475569', marginBottom: 3 }}>
                Job Length
              </label>
              <input
                type="number"
                value={targetLength}
                onChange={(e) => setTargetLength(Number(e.target.value))}
                style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 700, background: '#ffffff' }}
                placeholder="Meters"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, color: '#475569', marginBottom: 3 }}>
                Min Target DPI
              </label>
              <select
                value={minDpi}
                onChange={(e) => setMinDpi(Number(e.target.value))}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 700, background: '#ffffff' }}
              >
                <option value={150}>150 DPI (Standard)</option>
                <option value={200}>200 DPI (High Detail)</option>
                <option value={300}>300 DPI (Ultra Fine)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, color: '#475569', marginBottom: 3 }}>
                Ink Rate (₹/L)
              </label>
              <input
                type="number"
                value={inkRate}
                onChange={(e) => setInkRate(Number(e.target.value))}
                style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 700, background: '#ffffff' }}
                placeholder="₹1,800/L"
              />
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              onClick={() => handleRunAnalysis('quick')}
              disabled={loading}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Maximize2 size={13} />
              <span>Sub-200ms Header Inspect</span>
            </button>
            <button
              type="button"
              onClick={() => handleRunAnalysis('full')}
              disabled={loading}
              style={{
                padding: '7px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#7c3aed',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 6px rgba(124, 58, 237, 0.3)',
              }}
            >
              <Droplet size={13} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Simulating Droplets...' : 'Run Kyocera KJ4B Simulation'}</span>
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 12, marginBottom: 14, color: '#b91c1c', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Results Presentation */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Status Summary Banner */}
            <div style={{
              background: result.valid ? '#f0fdf4' : '#fff1f2',
              border: `1px solid ${result.valid ? '#bbf7d0' : '#fecdd3'}`,
              borderRadius: 12,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {result.valid ? <CheckCircle2 size={20} color="#16a34a" /> : <AlertTriangle size={20} color="#e11d48" />}
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: result.valid ? '#15803d' : '#be123c' }}>
                    {result.status_message}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Engine: <strong>{result.engine_used || 'pyvips Streaming'}</strong> • Color Mode: <strong>{result.color_space || result.detected_color_mode || 'CMYK'}</strong>
                  </div>
                </div>
              </div>
              <span style={{
                padding: '4px 10px',
                borderRadius: 9999,
                fontWeight: 800,
                fontSize: '0.7rem',
                background: result.resolution_status === 'OPTIMAL' ? '#dcfce7' : '#fef9c3',
                color: result.resolution_status === 'OPTIMAL' ? '#15803d' : '#854d0e',
              }}>
                {result.detected_dpi} DPI ({result.resolution_status || 'CHECKED'})
              </span>
            </div>

            {/* Dimensional & Seam Repeat Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Physical Width</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
                  {result.calculated_width_inches}"
                </div>
                <div style={{ fontSize: '0.65rem', color: result.width_deviation_percent > 5 ? '#e11d48' : '#16a34a', fontWeight: 700 }}>
                  {result.width_deviation_percent || 0}% deviation from {targetWidth}"
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Native Resolution</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
                  {result.native_width_px || result.width_px} × {result.native_height_px || result.height_px} px
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                  {result.detected_dpi} DPI Raster
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Repeat Seam</div>
                <div style={{ fontSize: '0.98rem', fontWeight: 900, color: '#7c3aed', marginTop: 4 }}>
                  {result.repeat_type || 'STRAIGHT_CHECKED'}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                  Boundary Cross-Correlation
                </div>
              </div>
            </div>

            {/* CMYK Channel Droplet Chemistry (When Full Analysis is Run) */}
            {result.channels && (
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>KYOCERA KJ4B CMYK DROPLET COVERAGE</span>
                  <span style={{ color: '#7c3aed' }}>600 DPI Droplet Curve (10.76 mL/m² Max)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
                  {result.channels.map((ch, idx) => {
                    const styling = channelColors[ch.channel] || channelColors['Key (Black)'];
                    return (
                      <div key={idx}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 3 }}>
                          <span style={{ fontWeight: 800, color: styling.text }}>{ch.channel}</span>
                          <span style={{ color: '#475569', fontSize: '0.72rem' }}>
                            <strong>{ch.average_coverage_percent}%</strong> coverage • {ch.consumption_ml_per_meter} mL/m • <strong>₹{ch.cost_inr_per_meter}/m</strong>
                          </span>
                        </div>
                        <div style={{ width: '100%', height: 7, background: '#f1f5f9', borderRadius: 9999, overflow: 'hidden' }}>
                          <div 
                            style={{ 
                              width: `${Math.min(100, ch.average_coverage_percent * 2.5)}%`, 
                              height: '100%', 
                              background: styling.bar, 
                              borderRadius: 9999 
                            }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Job Summary Cost Tile */}
            {result.total_ink_ml_per_linear_meter && (
              <div style={{
                background: '#faf5ff',
                border: '1px solid #e9d5ff',
                borderRadius: 14,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: '#7e22ce' }}>
                    TOTAL INK CONSUMPTION & JOB COST
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#581c87', marginTop: 2 }}>
                    ₹{result.total_job_cost_inr} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#7e22ce' }}>for {targetLength} Meters</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#3b0764' }}>
                    {result.total_ink_ml_per_linear_meter} mL / Meter
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#7e22ce', marginTop: 2 }}>
                    ₹{result.total_ink_cost_inr_per_linear_meter} / linear meter
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            Kyocera KJ4B Physics Profile • Direct API Telemetry
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}
