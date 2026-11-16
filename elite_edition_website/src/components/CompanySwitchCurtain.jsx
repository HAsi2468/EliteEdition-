import React from 'react';
import ReactDOM from 'react-dom';
import { ShieldCheck, Sparkles } from 'lucide-react';

/**
 * Elite Edition — Full-Screen Glassy Morphing Brand Curtain
 * Shown briefly when switching between company workspaces (EDP, ES, EE, EF, EON, SO, EW, YJ, EXEDP).
 */
export default function CompanySwitchCurtain({
  curtainState, // null | { code, name, accent, stage: 1 | 2, leaving: boolean }
}) {
  if (!curtainState || typeof document === 'undefined') return null;

  const accent = curtainState.accent || '#38bdf8';
  const isLeaving = Boolean(curtainState.leaving);
  const stage = curtainState.stage || 1;

  return ReactDOM.createPortal(
    <div
      className={`erp-brand-curtain ${isLeaving ? 'is-leaving' : 'is-entering'}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99997,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        background: `radial-gradient(circle at 50% 38%, ${accent}22 0%, rgba(8, 13, 27, 0.96) 55%, rgba(4, 7, 16, 0.98) 100%)`,
        pointerEvents: isLeaving ? 'none' : 'auto',
      }}
    >
      <div
        className="erp-brand-curtain-card"
        style={{
          width: 'min(440px, 92vw)',
          background: 'rgba(15, 23, 42, 0.82)',
          border: `1px solid ${accent}55`,
          borderRadius: '22px',
          padding: '1.75rem 1.5rem',
          boxShadow: `0 28px 70px rgba(0, 0, 0, 0.68), 0 0 42px ${accent}28, inset 0 1px 0 rgba(255, 255, 255, 0.14)`,
          textAlign: 'center',
          color: '#f8fafc',
        }}
      >
        {/* Elite Edition Brand Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.28rem 0.75rem',
            borderRadius: '999px',
            background: 'rgba(56, 189, 248, 0.14)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            color: '#93c5fd',
            fontSize: '0.68rem',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '1rem',
          }}
        >
          <ShieldCheck size={13} color="#38bdf8" />
          <span>Elite Edition ERP</span>
        </div>

        {/* Target Company Code Crest */}
        <div
          style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 0.9rem',
            borderRadius: '18px',
            background: `linear-gradient(135deg, ${accent}38, rgba(15, 23, 42, 0.9))`,
            border: `1.5px solid ${accent}88`,
            boxShadow: `0 0 28px ${accent}40`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: '1.15rem',
            color: '#ffffff',
            letterSpacing: '0.04em',
          }}
        >
          {curtainState.code || 'ERP'}
        </div>

        {/* Company Full Name */}
        <div
          style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: '#ffffff',
            marginBottom: '0.35rem',
          }}
        >
          {curtainState.name || 'Workspace'}
        </div>

        {/* 2-Stage Live Indicator */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            fontSize: '0.8rem',
            color: '#cbd5e1',
            marginBottom: '1.1rem',
          }}
        >
          <Sparkles size={14} color={accent} />
          <span>
            {stage === 1
              ? `Connecting ${curtainState.code || ''} workspace...`
              : 'Syncing records, stock & ledger...'}
          </span>
        </div>

        {/* Smooth Progress Bar */}
        <div
          style={{
            width: '100%',
            height: '5px',
            borderRadius: '999px',
            background: 'rgba(148, 163, 184, 0.18)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: stage === 1 ? '48%' : '92%',
              borderRadius: '999px',
              background: `linear-gradient(90deg, ${accent}, #38bdf8, #818cf8)`,
              boxShadow: `0 0 12px ${accent}`,
              transition: 'width 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
