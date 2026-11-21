import React from 'react';
import soundEffects from '../../services/soundEffects';

/**
 * 3D Liquid Glass ON/OFF Toggle Switch
 * - Uses <div role="switch"> so global mobile <button> min-height rules never distort its pill shape.
 * - Features frosted translucent liquid glass track, specular rim highlight, and 3D pearl glass sliding knob.
 */
export default function ToggleSwitch({
  checked = false,
  onChange,
  disabled = false,
  size = 'md', // 'sm' | 'md'
  accent = 'emerald', // 'emerald' | 'blue' | 'amber' | 'sky'
  showLabel = true,
  onLabel = 'ON',
  offLabel = 'OFF',
  ariaLabel = 'Toggle switch',
  playSound = true,
  style = {}
}) {
  const isSm = size === 'sm';
  const trackW = isSm ? 40 : 48;
  const trackH = isSm ? 22 : 26;
  const knobSize = isSm ? 16 : 20;
  const offset = isSm ? 2 : 2;
  const knobLeft = checked ? trackW - knobSize - offset - 2 : offset;

  const palette = {
    emerald: {
      bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.92) 0%, rgba(5, 150, 105, 0.96) 100%)',
      border: 'rgba(110, 231, 183, 0.65)',
      glow: '0 4px 14px rgba(16, 185, 129, 0.42), inset 0 1px 1.5px rgba(255, 255, 255, 0.45), inset 0 -1px 2px rgba(0, 0, 0, 0.22)',
      text: '#10b981'
    },
    blue: {
      bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.92) 0%, rgba(37, 99, 235, 0.96) 100%)',
      border: 'rgba(147, 197, 253, 0.65)',
      glow: '0 4px 14px rgba(59, 130, 246, 0.42), inset 0 1px 1.5px rgba(255, 255, 255, 0.45), inset 0 -1px 2px rgba(0, 0, 0, 0.22)',
      text: '#3b82f6'
    },
    sky: {
      bg: 'linear-gradient(135deg, rgba(56, 189, 248, 0.92) 0%, rgba(2, 132, 199, 0.96) 100%)',
      border: 'rgba(186, 230, 253, 0.65)',
      glow: '0 4px 14px rgba(56, 189, 248, 0.42), inset 0 1px 1.5px rgba(255, 255, 255, 0.45), inset 0 -1px 2px rgba(0, 0, 0, 0.22)',
      text: '#38bdf8'
    },
    amber: {
      bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.92) 0%, rgba(217, 119, 6, 0.96) 100%)',
      border: 'rgba(253, 230, 138, 0.65)',
      glow: '0 4px 14px rgba(245, 158, 11, 0.42), inset 0 1px 1.5px rgba(255, 255, 255, 0.45), inset 0 -1px 2px rgba(0, 0, 0, 0.22)',
      text: '#f59e0b'
    }
  }[accent] || {
    bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.92) 0%, rgba(5, 150, 105, 0.96) 100%)',
    border: 'rgba(110, 231, 183, 0.65)',
    glow: '0 4px 14px rgba(16, 185, 129, 0.42), inset 0 1px 1.5px rgba(255, 255, 255, 0.45), inset 0 -1px 2px rgba(0, 0, 0, 0.22)',
    text: '#10b981'
  };

  const handleToggle = (e) => {
    if (disabled) return;
    if (e) e.stopPropagation();
    if (playSound) {
      try { soundEffects.playScrollTick?.(); } catch (_) {}
    }
    try { navigator.vibrate?.(8); } catch (_) {}
    if (onChange) onChange(!checked, e);
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSm ? '6px' : '8px',
        flexShrink: 0,
        opacity: disabled ? 0.55 : 1,
        ...style
      }}
    >
      {showLabel && (
        <span
          style={{
            fontSize: isSm ? '0.68rem' : '0.72rem',
            fontWeight: 800,
            letterSpacing: '0.03em',
            color: checked ? palette.text : 'var(--text-muted, #94a3b8)',
            minWidth: isSm ? '26px' : '30px',
            textAlign: 'right',
            userSelect: 'none'
          }}
        >
          {checked ? onLabel : offLabel}
        </span>
      )}
      <div
        role="switch"
        tabIndex={disabled ? -1 : 0}
        aria-checked={Boolean(checked)}
        aria-disabled={Boolean(disabled)}
        aria-label={ariaLabel}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle(e);
          }
        }}
        style={{
          position: 'relative',
          width: `${trackW}px`,
          minWidth: `${trackW}px`,
          maxWidth: `${trackW}px`,
          height: `${trackH}px`,
          minHeight: `${trackH}px`,
          maxHeight: `${trackH}px`,
          borderRadius: '999px',
          border: checked ? `1px solid ${palette.border}` : '1px solid rgba(148, 163, 184, 0.36)',
          padding: 0,
          boxSizing: 'border-box',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: checked
            ? palette.bg
            : 'linear-gradient(180deg, rgba(51, 65, 85, 0.65) 0%, rgba(30, 41, 59, 0.85) 100%)',
          backdropFilter: 'blur(10px) saturate(160%)',
          WebkitBackdropFilter: 'blur(10px) saturate(160%)',
          boxShadow: checked
            ? palette.glow
            : 'inset 0 2px 4px rgba(0, 0, 0, 0.4), inset 0 -1px 1px rgba(255, 255, 255, 0.14)',
          transition: 'background 0.24s ease, border-color 0.24s ease, box-shadow 0.24s ease',
          userSelect: 'none',
          flexShrink: 0,
          overflow: 'hidden'
        }}
      >
        {/* Specular liquid glass top sheen */}
        <div
          style={{
            position: 'absolute',
            top: '1px',
            left: '6px',
            right: '6px',
            height: '45%',
            borderRadius: '999px',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.34) 0%, rgba(255, 255, 255, 0) 100%)',
            pointerEvents: 'none'
          }}
        />
        {/* 3D Pearl Liquid Glass Knob */}
        <div
          style={{
            position: 'absolute',
            top: `${offset}px`,
            left: `${knobLeft}px`,
            width: `${knobSize}px`,
            height: `${knobSize}px`,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 32% 28%, #ffffff 0%, #f1f5f9 65%, #cbd5e1 100%)',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.38), inset 0 1.5px 2px rgba(255, 255, 255, 0.95)',
            transition: 'left 0.24s cubic-bezier(0.34, 1.4, 0.64, 1)',
            pointerEvents: 'none'
          }}
        />
      </div>
    </div>
  );
}
