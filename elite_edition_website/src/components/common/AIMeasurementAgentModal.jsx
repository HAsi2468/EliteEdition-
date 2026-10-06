import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  FABRIC_PRESETS,
  GARMENT_PRESETS,
  findFabricPreset,
  calculateTextileYield
} from '../../utils/textileCalculation';
import {
  Sparkles,
  Calculator,
  Check,
  Copy,
  X,
  Gauge,
  Thermometer,
  Layers,
  RefreshCw,
  Sliders,
  DollarSign
} from 'lucide-react';

export { FABRIC_PRESETS, GARMENT_PRESETS };

export function triggerAIMeasurementModal(initialData = {}, onApply = null) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open-ai-measurement', { detail: { initialData, onApply } }));
  }
}

export default function AIMeasurementAgentModal({
  isOpen,
  onClose,
  initialData = {},
  onApply = null
}) {
  const initialFabric = initialData.fabric || initialData.fabricQuality || 'French Crepe';
  const initialPanna = initialData.panna || '58"';
  const initialMeters = initialData.meters || initialData.fusingMtr || initialData.totalMtr || initialData.printedMtr || 100;

  const [fabricQuality, setFabricQuality] = useState(initialFabric);
  const [panna, setPanna] = useState(initialPanna);
  const [inputMeters, setInputMeters] = useState(initialMeters);
  const [garmentType, setGarmentType] = useState(initialData.garmentType || 'Kurti');
  const [customPieceMeters, setCustomPieceMeters] = useState('');
  const [shrinkageOverride, setShrinkageOverride] = useState('');
  const [costPerMeter, setCostPerMeter] = useState('');
  const [userPrompt, setUserPrompt] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // Sync state whenever initialData changes
  useEffect(() => {
    if (isOpen) {
      const f = initialData.fabric || initialData.fabricQuality || 'French Crepe';
      const p = initialData.panna || '58"';
      const m = initialData.meters || initialData.fusingMtr || initialData.totalMtr || initialData.printedMtr || 100;
      setFabricQuality(f);
      setPanna(p);
      setInputMeters(m);
      if (initialData.garmentType) setGarmentType(initialData.garmentType);
      
      const preset = findFabricPreset(f);
      setShrinkageOverride(preset.shrinkage);

      // Auto-run baseline calculation upon opening
      const baseCalc = calculateTextileYield({
        inputMeters: m,
        fabricQuality: f,
        panna: p,
        garmentType: initialData.garmentType || 'Kurti',
        shrinkageOverride: preset.shrinkage
      });
      setResult(baseCalc);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSelectPreset = (preset) => {
    setFabricQuality(preset.name);
    setPanna(preset.panna);
    setShrinkageOverride(preset.shrinkage);
    
    // Recalculate instantly
    const updated = calculateTextileYield({
      inputMeters,
      fabricQuality: preset.name,
      panna: preset.panna,
      garmentType,
      customPieceMeters: garmentType === 'Custom' ? Number(customPieceMeters) : null,
      costPerMeter: costPerMeter ? Number(costPerMeter) : null,
      shrinkageOverride: preset.shrinkage
    });
    setResult(updated);
  };

  const handleCalculate = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);

    const mNum = Math.max(0, Number(inputMeters) || 0);
    const shrinkNum = shrinkageOverride !== '' ? Number(shrinkageOverride) : null;

    try {
      // 1. Try backend AI endpoint
      const res = await api.calculateAiMeasurement({
        inputMeters: mNum,
        fabricQuality,
        panna,
        garmentType,
        customPieceMeters: garmentType === 'Custom' ? Number(customPieceMeters) : null,
        costPerMeter: costPerMeter ? Number(costPerMeter) : null,
        shrinkageOverride: shrinkNum,
        userPrompt
      });

      if (res && res.calculation) {
        setResult(res.calculation);
        return;
      }
    } catch (err) {
      console.warn('Backend AI measurement call failed, using local domain calculation engine:', err.message);
    }

    // 2. High-precision deterministic domain engine fallback
    const localRes = calculateTextileYield({
      inputMeters: mNum,
      fabricQuality,
      panna,
      garmentType,
      customPieceMeters: garmentType === 'Custom' ? Number(customPieceMeters) : null,
      costPerMeter: costPerMeter ? Number(costPerMeter) : null,
      shrinkageOverride: shrinkNum
    });
    setResult(localRes);
    setLoading(false);
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
Parameters: ${result.recommendedTemp} @ ${result.recommendedSpeed}
Advice: ${result.aiAdvice}`;

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyToForm = () => {
    if (!result || !onApply) return;
    onApply({
      inputMeters: result.inputMeters,
      freshMtr: result.netOutputMeters,
      wasteMtr: result.totalWastageMeters,
      shrinkageMtr: result.shrinkageMeters,
      shrinkagePct: result.shrinkagePct,
      freshYieldPct: result.efficiencyPct,
      efficiencyPct: result.efficiencyPct,
      pieces: result.expectedPieces,
      expectedPieces: result.expectedPieces,
      fabric: result.fabric,
      panna: result.panna,
      temp: result.recommendedTemp,
      temperature: result.recommendedTemp,
      speed: result.recommendedSpeed,
      result
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
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(4px)',
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
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '92vh',
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
            background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)'
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800, color: '#0f172a' }}>
                AI Textile Measurement & Yield Agent
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                Thermal sublimation shrinkage calibration, net fresh meters & garment piece estimator
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
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Quick Presets */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>
              Standard Textile Presets
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
                      fontSize: '0.76rem',
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
              {/* Raw Meters */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Raw Input (MTR)*
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
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Fabric Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Fabric Quality
                </label>
                <input
                  type="text"
                  value={fabricQuality}
                  onChange={(e) => setFabricQuality(e.target.value)}
                  placeholder="e.g. French Crepe"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Panna */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Panna (Width)
                </label>
                <select
                  value={panna}
                  onChange={(e) => setPanna(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
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

              {/* Shrinkage % Override */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Shrinkage %
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={shrinkageOverride}
                  onChange={(e) => setShrinkageOverride(e.target.value)}
                  placeholder="Auto (e.g. 3.5)"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Garment Target */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Garment Target
                </label>
                <select
                  value={garmentType}
                  onChange={(e) => setGarmentType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    background: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  {GARMENT_PRESETS.map(g => (
                    <option key={g.id} value={g.id}>{g.id}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Piece Length (Conditional) */}
            {garmentType === 'Custom' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Meters Per Piece (Custom)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={customPieceMeters}
                  onChange={(e) => setCustomPieceMeters(e.target.value)}
                  placeholder="e.g. 2.15"
                  style={{
                    width: '180px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            {/* Action Row */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
              <button
                type="submit"
                disabled={loading || !inputMeters}
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)'
                }}
              >
                {loading ? <RefreshCw size={15} className="spin-loader" /> : <Calculator size={15} />}
                <span>{loading ? 'Calculating...' : 'Recalculate AI Yield'}</span>
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
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              {/* 4 KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 12px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>
                    Fresh Output
                  </span>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#15803d', marginTop: '2px' }}>
                    {result.netOutputMeters} <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>m</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#16a34a' }}>
                    {result.efficiencyPct}% yield
                  </span>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #fed7aa', borderRadius: '8px', padding: '10px 12px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#9a3412', textTransform: 'uppercase' }}>
                    Wastage & Trim
                  </span>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#c2410c', marginTop: '2px' }}>
                    {result.totalWastageMeters} <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>m</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#ea580c' }}>
                    {result.shrinkagePct}% shrink + {result.trimLossPct}% trim
                  </span>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 12px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>
                    Garment Yield
                  </span>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#1d4ed8', marginTop: '2px' }}>
                    {result.expectedPieces} <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>pcs</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#2563eb' }}>
                    {result.pieceLengthMeters}m / piece
                  </span>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                    Machine Settings
                  </span>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#334155', marginTop: '4px' }}>
                    {result.recommendedTemp}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {result.recommendedSpeed}
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
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}
                >
                  <Sparkles size={16} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#1e40af', lineHeight: 1.45, fontWeight: 500 }}>
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
                <span>Apply Output ({result.netOutputMeters}m / {result.expectedPieces} pcs)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
