import React, { useState } from 'react';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import { cleanDesignNameString } from '../utils/designUtils';
import { FileText, Printer, User, Layers, Calendar, CheckCircle2, Clock } from 'lucide-react';

export default function JobCardTooltip({ card, children, style = {} }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  if (!card) return children;

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 8
    });
  };

  const targetMtr = parseFloat(card.totalMtr || card.consumption || '0') || 0;
  const printedMtr = parseFloat(card.printMtr || '0') || 0;
  const progressPct = targetMtr > 0 ? Math.min(100, Math.round((printedMtr / targetMtr) * 100)) : 0;
  const cleanJobNo = String(card.jobNo || '').replace(/^JOB\s*NO\.?\s*-?\s*/i, '');

  const isDone = card.printStatus === 'Printing Done' || progressPct >= 100;

  return (
    <div
      onMouseEnter={(e) => {
        handleMouseMove(e);
        setShow(true);
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShow(false)}
      style={{ display: 'inline-block', position: 'relative', cursor: 'pointer', ...style }}
    >
      {children}

      {show && (
        <div
          style={{
            position: 'fixed',
            left: `${pos.x}px`,
            top: `${pos.y}px`,
            transform: 'translate(-50%, -100%)',
            zIndex: 99999,
            pointerEvents: 'none',
            width: '280px',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '10px',
            padding: '0.85rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            color: '#f8fafc',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem', marginBottom: '0.55rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileText size={14} color="#38bdf8" />
              <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#38bdf8' }}>
                #{cleanJobNo}
              </span>
              {card.party && (
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
                  ({card.party})
                </span>
              )}
            </div>

            <span
              style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                padding: '0.15rem 0.45rem',
                borderRadius: '4px',
                background: isDone ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: isDone ? '#34d399' : '#fbbf24',
                border: `1px solid ${isDone ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`
              }}
            >
              {isDone ? 'COMPLETED' : 'PENDING'}
            </span>
          </div>

          {/* Body details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.72rem' }}>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.65rem', display: 'block' }}>DESIGN</span>
              <strong style={{ color: '#f1f5f9' }}>{cleanDesignNameString(card.designName || card.designNo || '') || 'N/A'}</strong>
            </div>

            <div>
              <span style={{ color: '#64748b', fontSize: '0.65rem', display: 'block' }}>FABRIC</span>
              <strong style={{ color: '#f1f5f9' }}>{card.fabric || 'N/A'} {card.panna ? `(${card.panna}")` : ''}</strong>
            </div>

            <div>
              <span style={{ color: '#64748b', fontSize: '0.65rem', display: 'block' }}>MACHINE / PASS</span>
              <strong style={{ color: '#38bdf8' }}>{card.machineName || 'Unassigned'} {card.pass ? `(${card.pass})` : ''}</strong>
            </div>

            <div>
              <span style={{ color: '#64748b', fontSize: '0.65rem', display: 'block' }}>OPERATOR</span>
              <strong style={{ color: '#f1f5f9' }}>{card.operatorName || 'Not Set'}</strong>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: '0.65rem', paddingTop: '0.5rem', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              <span style={{ color: '#94a3b8' }}>PRINT PROGRESS</span>
              <span style={{ color: isDone ? '#34d399' : '#38bdf8' }}>
                {printedMtr.toFixed(1)}m / {targetMtr.toFixed(1)}m ({progressPct}%)
              </span>
            </div>
            <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progressPct}%`,
                  height: '100%',
                  background: isDone ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #0284c7, #38bdf8)',
                  borderRadius: '3px',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
