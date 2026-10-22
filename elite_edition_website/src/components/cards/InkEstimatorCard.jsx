import React from "react";
import { Droplet, DollarSign, ShieldAlert, Sliders, ArrowRight } from "lucide-react";

export function InkEstimatorCard({ data, onAction }) {
  if (!data) return null;

  const {
    meters = 0,
    coverageDensity = 'medium',
    pannaWidthInches = 58,
    totalSqMeters = 0,
    totalLiters = 0,
    totalKg = 0,
    colorBreakdown = {},
    costPerMeterINR = 0,
    totalCostINR = 0,
    safetyBufferLiters = 0,
    machineModel = 'Digital Printer',
    summary
  } = data;

  const handleOpenSettings = () => {
    window.dispatchEvent(
      new CustomEvent('erp:navigate', {
        detail: { screen: 'print_settings' }
      })
    );
  };

  const colors = [
    { name: 'Cyan', grams: colorBreakdown.cyanGrams || 0, bg: '#06b6d4', text: '#ffffff' },
    { name: 'Magenta', grams: colorBreakdown.magentaGrams || 0, bg: '#ec4899', text: '#ffffff' },
    { name: 'Yellow', grams: colorBreakdown.yellowGrams || 0, bg: '#eab308', text: '#713f12' },
    { name: 'Black', grams: colorBreakdown.blackGrams || 0, bg: '#1e293b', text: '#ffffff' }
  ];

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '12px',
        padding: '14px 16px',
        margin: '8px 0',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        maxWidth: '440px',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '10px',
          borderBottom: '1px solid #f1f5f9'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: '#eff6ff',
              color: '#2563eb'
            }}
          >
            <Droplet size={15} />
          </span>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
              Ink Consumption & Cost
            </h4>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
              {meters}m • {coverageDensity.toUpperCase()} Coverage • {pannaWidthInches}" Panna
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#2563eb' }}>
            ₹{costPerMeterINR}
          </span>
          <p style={{ margin: 0, fontSize: '0.68rem', color: '#64748b' }}>
            per meter
          </p>
        </div>
      </div>

      {/* Primary KPI Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          margin: '12px 0',
          padding: '8px 10px',
          background: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}
      >
        <div>
          <span style={{ fontSize: '0.70rem', color: '#64748b', display: 'block' }}>Total Ink</span>
          <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
            {totalLiters} L
          </span>
        </div>
        <div>
          <span style={{ fontSize: '0.70rem', color: '#64748b', display: 'block' }}>Weight</span>
          <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
            {totalKg} kg
          </span>
        </div>
        <div>
          <span style={{ fontSize: '0.70rem', color: '#64748b', display: 'block' }}>Batch Cost</span>
          <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#059669' }}>
            ₹{totalCostINR.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* CMYK Color Bars */}
      <div style={{ margin: '10px 0' }}>
        <p style={{ margin: '0 0 6px 0', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
          Estimated CMYK Breakdown:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          {colors.map((c, idx) => (
            <div
              key={idx}
              style={{
                background: c.bg,
                color: c.text,
                padding: '6px 4px',
                borderRadius: '6px',
                textAlign: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}
            >
              <div style={{ fontSize: '0.68rem', fontWeight: 700 }}>{c.name}</div>
              <div style={{ fontSize: '0.76rem', fontWeight: 800 }}>{c.grams}g</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tank Buffer Warning */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 10px',
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '8px',
          fontSize: '0.73rem',
          color: '#92400e',
          lineHeight: '1.3',
          margin: '10px 0'
        }}
      >
        <ShieldAlert size={14} style={{ flexShrink: 0 }} />
        <span>Ensure machine tanks have at least <strong>{safetyBufferLiters} L</strong> buffer before starting print.</span>
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={handleOpenSettings}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          width: '100%',
          padding: '7px 12px',
          borderRadius: '8px',
          background: '#2563eb',
          color: '#ffffff',
          border: 'none',
          fontSize: '0.76rem',
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'background 0.15s ease'
        }}
      >
        <span>Open Digital Print Settings</span>
        <ArrowRight size={13} />
      </button>
    </div>
  );
}

export default InkEstimatorCard;
