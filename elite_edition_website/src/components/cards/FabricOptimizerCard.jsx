import React from "react";
import { Scissors, CheckCircle, AlertTriangle, Layers, ArrowRight } from "lucide-react";

export function FabricOptimizerCard({ data, onAction }) {
  if (!data) return null;

  const {
    fabricQuality,
    targetMeters,
    jobCardId,
    selectedRolls = [],
    totalSuppliedMeters = 0,
    remnantMeters = 0,
    efficiencyPct = 95,
    recommendation
  } = data;

  const handleOpenFabric = () => {
    window.dispatchEvent(
      new CustomEvent('erp:navigate', {
        detail: { screen: 'jobcards_fabric', searchQuery: fabricQuality }
      })
    );
  };

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
              background: '#ecfdf5',
              color: '#059669'
            }}
          >
            <Scissors size={15} />
          </span>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
              {fabricQuality}
            </h4>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
              Cut-Plan & Waste Optimizer {jobCardId ? `• Job #${jobCardId}` : ''}
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#059669' }}>
            {efficiencyPct}%
          </span>
          <p style={{ margin: 0, fontSize: '0.68rem', color: '#64748b' }}>
            Material Yield
          </p>
        </div>
      </div>

      {/* Target vs Supplied Bar */}
      <div style={{ margin: '12px 0 8px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
          <span style={{ color: '#475569' }}>Required: <strong>{targetMeters}m</strong></span>
          <span style={{ color: '#059669' }}>Supplied: <strong>{totalSuppliedMeters}m</strong></span>
          <span style={{ color: remnantMeters > 15 ? '#d97706' : '#10b981' }}>
            Remnant: <strong>+{remnantMeters}m</strong>
          </span>
        </div>
        <div
          style={{
            height: '6px',
            width: '100%',
            background: '#e2e8f0',
            borderRadius: '9999px',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, efficiencyPct)}%`,
              background: 'linear-gradient(90deg, #10b981, #059669)',
              borderRadius: '9999px'
            }}
          />
        </div>
      </div>

      {/* Recommended Roll List */}
      <div style={{ margin: '10px 0' }}>
        <p style={{ margin: '0 0 6px 0', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
          Recommended Rolls from Godown ({selectedRolls.length}):
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {selectedRolls.map((roll, idx) => (
            <div
              key={idx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 8px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                fontSize: '0.74rem'
              }}
            >
              <Layers size={12} color="#2563eb" />
              <span style={{ fontWeight: 600, color: '#1e293b' }}>
                {roll.lotNo} TP#{roll.tpNo}
              </span>
              <span style={{ color: '#059669', fontWeight: 700 }}>
                {roll.meters}m
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Operator Advice Note */}
      <div
        style={{
          padding: '8px 10px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '8px',
          fontSize: '0.74rem',
          color: '#166534',
          lineHeight: '1.35',
          margin: '10px 0'
        }}
      >
        💡 {recommendation}
      </div>

      {/* Quick Action Button */}
      <button
        type="button"
        onClick={handleOpenFabric}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          width: '100%',
          padding: '7px 12px',
          borderRadius: '8px',
          background: '#0f172a',
          color: '#ffffff',
          border: 'none',
          fontSize: '0.76rem',
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'background 0.15s ease'
        }}
      >
        <span>Open Fabric Godown Inward</span>
        <ArrowRight size={13} />
      </button>
    </div>
  );
}

export default FabricOptimizerCard;
