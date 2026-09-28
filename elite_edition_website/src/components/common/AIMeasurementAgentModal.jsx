import React, { useState } from 'react';
import { api } from '../../services/api';
import { Sparkles, Calculator, Check, Copy, X, ArrowRight, Gauge, Thermometer, Layers, AlertCircle, RefreshCw } from 'lucide-react';

const FABRIC_PRESETS = [
  { name: 'French Crepe', panna: '58"', temp: 210, speed: 80, shrinkage: 3.5 },
  { name: 'Poly Crepe', panna: '58"', temp: 210, speed: 80, shrinkage: 3.5 },
  { name: 'Georgette', panna: '44"', temp: 200, speed: 80, shrinkage: 4.0 },
  { name: 'Chiffon', panna: '44"', temp: 200, speed: 80, shrinkage: 4.0 },
  { name: 'Organza', panna: '58"', temp: 195, speed: 80, shrinkage: 1.8 },
  { name: 'Satin', panna: '58"', temp: 205, speed: 80, shrinkage: 2.2 },
  { name: 'Poly Rayon', panna: '44"', temp: 190, speed: 76, shrinkage: 5.2 },
  { name: 'Kohinoor Linen', panna: '58"', temp: 200, speed: 78, shrinkage: 4.5 },
  { name: 'Heavy Velvet', panna: '58"', temp: 205, speed: 70, shrinkage: 3.0 },
];

const GARMENT_PRESETS = [
  { id: 'Kurti', label: 'Kurti (1.75m @ 58" / 2.25m @ 44")' },
  { id: 'Saree', label: 'Saree (5.5m)' },
  { id: 'Dupatta', label: 'Dupatta (2.4m)' },
  { id: 'Gown', label: 'Gown / Anarkali (3.0m @ 58" / 3.75m @ 44")' },
  { id: 'Top', label: 'Top / Tunic (1.35m @ 58" / 1.75m @ 44")' },
  { id: 'Co-ord', label: 'Co-ord Set (3.2m @ 58" / 4.0m @ 44")' },
  { id: 'Custom', label: 'Custom Piece Length' },
];

export default function AIMeasurementAgentModal({
  isOpen,
  onClose,
  initialData = {},
  onApply = null
}) {
  const [fabricQuality, setFabricQuality] = useState(initialData.fabric || 'French Crepe');
  const [panna, setPanna] = useState(initialData.panna || '58"');
  const [inputMeters, setInputMeters] = useState(initialData.meters || initialData.fusingMtr || 100);
  const [garmentType, setGarmentType] = useState('Kurti');
  const [customPieceMeters, setCustomPieceMeters] = useState('');
  const [costPerMeter, setCostPerMeter] = useState('');
  const [userPrompt, setUserPrompt] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSelectPreset = (preset) => {
    setFabricQuality(preset.name);
    setPanna(preset.panna);
  };

  const handleCalculate = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await api.calculateAiMeasurement({
        inputMeters: Number(inputMeters) || 0,
        fabricQuality,
        panna,
        garmentType,
        customPieceMeters: garmentType === 'Custom' ? Number(customPieceMeters) : null,
        costPerMeter: costPerMeter ? Number(costPerMeter) : null,
        userPrompt
      });

      if (res && res.calculation) {
        setResult(res.calculation);
      }
    } catch (err) {
      console.error('AI Measurement calculation error:', err);
      // Deterministic client-side fallback calculation
      const mIn = Number(inputMeters) || 100;
      const pNum = parseInt(String(panna).replace(/\D/g, '')) || 58;
      const preset = FABRIC_PRESETS.find(p => p.name.toLowerCase() === fabricQuality.toLowerCase()) || { shrinkage: 3.5 };
      const shrinkMtr = Number(((mIn * preset.shrinkage) / 100).toFixed(2));
      const trimMtr = Number(((mIn * 1.5) / 100).toFixed(2));
      const totalWaste = Number((shrinkMtr + trimMtr).toFixed(2));
      const netOut = Number(Math.max(0, mIn - totalWaste).toFixed(2));
      const pLen = pNum >= 56 ? 1.75 : 2.25;
      const pieces = Math.floor(netOut / pLen);

      setResult({
        inputMeters: mIn,
        fabric: fabricQuality,
        panna,
        shrinkagePct: preset.shrinkage,
        trimLossPct: 1.5,
        shrinkageMeters: shrinkMtr,
        trimmingMeters: trimMtr,
        totalWastageMeters: totalWaste,
        netOutputMeters: netOut,
        efficiencyPct: Number(((netOut / mIn) * 100).toFixed(1)),
        garmentType,
        pieceLengthMeters: pLen,
        expectedPieces: pieces,
        remnantMeters: Number((netOut - (pieces * pLen)).toFixed(2)),
        aiAdvice: `Calculated with textile standards: ${fabricQuality} shrinks approx ${preset.shrinkage}% at sublimation heat. Yield is ${netOut}m net output.`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const summary = `Elite ERP - AI Fabric Measurement Result
Fabric: ${result.fabric} | Panna: ${result.panna}
Raw Roll: ${result.inputMeters} m
Net Fresh Output: ${result.netOutputMeters} m
Total Wastage: ${result.totalWastageMeters} m (${result.shrinkagePct}% Shrinkage + ${result.trimLossPct}% Trim)
Efficiency: ${result.efficiencyPct}%
Yield: ${result.expectedPieces} pieces of ${result.garmentType} (Remnant: ${result.remnantMeters}m)
Advice: ${result.aiAdvice}`;

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyToForm = () => {
    if (!result || !onApply) return;
    onApply({
      freshMtr: result.netOutputMeters,
      wasteMtr: result.totalWastageMeters,
      shrinkageMtr: result.shrinkageMeters,
      efficiencyPct: result.efficiencyPct,
      pieces: result.expectedPieces,
      fabric: result.fabric,
      panna: result.panna
    });
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #dbeafe'
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                AI Textile Measurement Agent
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                Instant fabric shrinkage, net fresh meters & garment yield calculation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Quick Presets */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
              Quick Fabric Presets
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {FABRIC_PRESETS.map(p => {
                const isSelected = fabricQuality.toLowerCase() === p.name.toLowerCase();
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    style={{
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                      color: isSelected ? '#1d4ed8' : '#334155',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {p.name} ({p.shrinkage}%)
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input Grid */}
          <form onSubmit={handleCalculate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
              {/* Raw Meters */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Raw Input (Meters)*
                </label>
                <input
                  type="number"
                  step="any"
                  value={inputMeters}
                  onChange={(e) => setInputMeters(e.target.value)}
                  required
                  placeholder="e.g. 100"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Fabric Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Fabric Quality
                </label>
                <input
                  type="text"
                  value={fabricQuality}
                  onChange={(e) => setFabricQuality(e.target.value)}
                  placeholder="e.g. French Crepe"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Panna */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Panna (Width)
                </label>
                <select
                  value={panna}
                  onChange={(e) => setPanna(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    background: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value='36"'>36" (Small)</option>
                  <option value='44"'>44" (Standard Single)</option>
                  <option value='48"'>48" (Medium Single)</option>
                  <option value='58"'>58" (Double Width)</option>
                  <option value='64"'>64" (Wide Width)</option>
                </select>
              </div>

              {/* Garment Target */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Target Garment
                </label>
                <select
                  value={garmentType}
                  onChange={(e) => setGarmentType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    background: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  {GARMENT_PRESETS.map(g => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Piece Length (Conditional) */}
            {garmentType === 'Custom' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Meters per Custom Piece
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={customPieceMeters}
                  onChange={(e) => setCustomPieceMeters(e.target.value)}
                  placeholder="e.g. 2.15"
                  style={{
                    width: '200px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            {/* Action Row */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                type="submit"
                disabled={loading || !inputMeters}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                }}
              >
                {loading ? <RefreshCw size={16} className="spin-loader" /> : <Calculator size={16} />}
                <span>{loading ? 'Calculating...' : 'Run AI Measurement'}</span>
              </button>
            </div>
          </form>

          {/* Results Display */}
          {result && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}
            >
              {/* 4 KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
                <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 12px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>
                    Fresh Output
                  </span>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#15803d', marginTop: '2px' }}>
                    {result.netOutputMeters} <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>m</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#16a34a' }}>
                    {result.efficiencyPct}% yield
                  </span>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #fed7aa', borderRadius: '8px', padding: '10px 12px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#9a3412', textTransform: 'uppercase' }}>
                    Total Wastage
                  </span>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#c2410c', marginTop: '2px' }}>
                    {result.totalWastageMeters} <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>m</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#ea580c' }}>
                    {result.shrinkagePct}% shrink + {result.trimLossPct}% trim
                  </span>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 12px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>
                    Garment Yield
                  </span>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#1d4ed8', marginTop: '2px' }}>
                    {result.expectedPieces} <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>pcs</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#2563eb' }}>
                    {result.pieceLengthMeters}m / piece
                  </span>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                    Remnant Piece
                  </span>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#334155', marginTop: '2px' }}>
                    {result.remnantMeters} <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>m</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Leftover remnant
                  </span>
                </div>
              </div>

              {/* AI Advice Box */}
              {result.aiAdvice && (
                <div
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #dbeafe',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}
                >
                  <Sparkles size={18} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#1e40af', lineHeight: 1.45, fontWeight: 500 }}>
                    <strong>Shop Floor Advice:</strong> {result.aiAdvice}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          {result ? (
            <button
              type="button"
              onClick={handleCopy}
              style={{
                background: 'transparent',
                border: '1px solid #cbd5e1',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
              <span>{copied ? 'Copied Details' : 'Copy Summary'}</span>
            </button>
          ) : <div />}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer'
              }}
            >
              Close
            </button>

            {result && onApply && (
              <button
                type="button"
                onClick={handleApplyToForm}
                style={{
                  background: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)'
                }}
              >
                <Check size={16} />
                <span>Apply Output ({result.netOutputMeters}m)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
