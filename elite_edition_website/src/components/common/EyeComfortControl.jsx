import React, { useState, useEffect, useRef } from 'react';
import { Eye, Sparkles, Type } from 'lucide-react';

const LS_EYE = 'elite_erp_eye_comfort';
const LS_CALM = 'elite_erp_calm_mode';
const LS_DENSITY = 'elite_erp_text_density';

const readLs = (key, fallback) => {
  try {
    const val = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return val !== null ? val : fallback;
  } catch (_) {
    return fallback;
  }
};

export function EyeComfortControl({ compact = false }) {
  const [open, setOpen] = useState(false);
  const [eyeComfort, setEyeComfort] = useState(() => readLs(LS_EYE, 'off') === 'on');
  const [calmMode, setCalmMode] = useState(() => readLs(LS_CALM, 'off') === 'on');
  const [textDensity, setTextDensity] = useState(() => readLs(LS_DENSITY, 'comfort'));
  const wrapRef = useRef(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-eye-comfort', eyeComfort ? 'on' : 'off');
    try { localStorage.setItem(LS_EYE, eyeComfort ? 'on' : 'off'); } catch (_) {}
  }, [eyeComfort]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-calm-mode', calmMode ? 'on' : 'off');
    try { localStorage.setItem(LS_CALM, calmMode ? 'on' : 'off'); } catch (_) {}
  }, [calmMode]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-text-density', textDensity);
    try { localStorage.setItem(LS_DENSITY, textDensity); } catch (_) {}
  }, [textDensity]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const isAnyActive = eyeComfort || calmMode || textDensity !== 'comfort';

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={compact ? 'btn-icon' : 'btn-secondary'}
        title="Eye Comfort, Calm Mode & Text Size"
        aria-label="Eye Comfort & Display Settings"
        style={{
          minWidth: compact ? '40px' : 'auto',
          minHeight: compact ? '40px' : '38px',
          height: compact ? '40px' : '38px',
          padding: compact ? '8px' : '0 10px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '0.78rem',
          fontWeight: 700,
          border: isAnyActive ? '1px solid rgba(251, 191, 36, 0.55)' : '1px solid var(--border-light, rgba(148,163,184,0.3))',
          background: isAnyActive ? 'rgba(245, 158, 11, 0.16)' : undefined,
          color: isAnyActive ? '#f59e0b' : undefined,
        }}
      >
        <Eye size={compact ? 18 : 15} style={{ flexShrink: 0 }} />
        {!compact && <span>Eye Care</span>}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '264px',
            zIndex: 99999,
            borderRadius: '14px',
            padding: '12px',
            background: 'var(--bg-modal, rgba(15, 23, 42, 0.96))',
            backdropFilter: 'blur(20px) saturate(160%)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            border: '1px solid var(--border-light, rgba(148, 163, 184, 0.25))',
            boxShadow: '0 20px 48px rgba(2, 6, 23, 0.45)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #94a3b8)' }}>
            Eye Comfort &amp; Ergonomics
          </div>

          {/* 1. Eye Comfort Warm Blue-Light Filter */}
          <button
            type="button"
            onClick={() => setEyeComfort((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: '10px',
              border: eyeComfort ? '1px solid rgba(245, 158, 11, 0.55)' : '1px solid var(--border-light, rgba(148,163,184,0.22))',
              background: eyeComfort ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
              color: 'var(--text-primary, #f8fafc)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Eye size={13} color="#f59e0b" /> Warm Eye Care
              </div>
              <div style={{ fontSize: '0.67rem', color: 'var(--text-muted, #94a3b8)' }}>Reduces harsh blue light</div>
            </div>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: eyeComfort ? '#f59e0b' : 'var(--text-muted, #94a3b8)' }}>
              {eyeComfort ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* 2. Calm / Low-Motion Mode */}
          <button
            type="button"
            onClick={() => setCalmMode((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: '10px',
              border: calmMode ? '1px solid rgba(56, 189, 248, 0.55)' : '1px solid var(--border-light, rgba(148,163,184,0.22))',
              background: calmMode ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              color: 'var(--text-primary, #f8fafc)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Sparkles size={13} color="#38bdf8" /> Calm / Low Motion
              </div>
              <div style={{ fontSize: '0.67rem', color: 'var(--text-muted, #94a3b8)' }}>No animations or heavy blur</div>
            </div>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: calmMode ? '#38bdf8' : 'var(--text-muted, #94a3b8)' }}>
              {calmMode ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* 3. Text Size / Reading Density */}
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Type size={12} /> Reading Size
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
              {[
                { id: 'compact', label: 'Compact' },
                { id: 'comfort', label: 'Comfort' },
                { id: 'large', label: 'Large' },
              ].map((opt) => {
                const active = textDensity === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTextDensity(opt.id)}
                    style={{
                      padding: '5px 4px',
                      borderRadius: '7px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: active ? '1px solid #38bdf8' : '1px solid var(--border-light, rgba(148,163,184,0.22))',
                      background: active ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
                      color: active ? '#38bdf8' : 'var(--text-primary, #e2e8f0)',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EyeComfortControl;
