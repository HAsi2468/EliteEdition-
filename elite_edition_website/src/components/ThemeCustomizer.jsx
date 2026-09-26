import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  X, 
  Sun, 
  Moon, 
  RotateCcw, 
  Check, 
  Layout, 
  Palette,
  Sliders
} from 'lucide-react';

const ACCENT_COLORS = [
  { name: 'Phoenix Blue', value: '#3874ff' },
  { name: 'Sky Cyan', value: '#0284c7' },
  { name: 'Emerald Green', value: '#10b981' },
  { name: 'Indigo Velvet', value: '#6366f1' },
  { name: 'Rose Fashion', value: '#f43f5e' },
  { name: 'Amber Gold', value: '#f59e0b' }
];

export default function ThemeCustomizer({ isOpen, onClose, isDarkMode, setIsDarkMode }) {
  const [accentColor, setAccentColor] = useState(() => {
    return localStorage.getItem('elite_accent_color') || '#3874ff';
  });

  const [borderRadius, setBorderRadius] = useState(() => {
    return localStorage.getItem('elite_border_radius') || '10px';
  });

  const [fontScale, setFontScale] = useState(() => {
    return localStorage.getItem('elite_font_scale') || 'normal';
  });

  // Apply accent color
  useEffect(() => {
    document.documentElement.style.setProperty('--primary', accentColor);
    document.documentElement.style.setProperty('--primary-hover', `${accentColor}ee`);
    localStorage.setItem('elite_accent_color', accentColor);
  }, [accentColor]);

  // Apply border radius
  useEffect(() => {
    document.documentElement.style.setProperty('--radius-md', borderRadius);
    localStorage.setItem('elite_border_radius', borderRadius);
  }, [borderRadius]);

  const handleReset = () => {
    setAccentColor('#3874ff');
    setBorderRadius('10px');
    setFontScale('normal');
    setIsDarkMode(false);
    document.documentElement.removeAttribute('data-theme');
    localStorage.removeItem('elite_accent_color');
    localStorage.removeItem('elite_border_radius');
    localStorage.removeItem('elite_font_scale');
    localStorage.setItem('elite_dark_mode', 'false');
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(2px)',
            zIndex: 99990
          }}
        />
      )}

      {/* Drawer Panel */}
      <div className={`theme-customizer-panel ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Palette size={20} style={{ color: 'var(--primary)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Theme Customizer</h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Customize layout & style tokens</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Color Scheme: Dark / Light */}
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Color Mode
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setIsDarkMode(false)}
              style={{
                padding: '0.6rem',
                borderRadius: 8,
                border: !isDarkMode ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                background: !isDarkMode ? 'var(--nav-active-bg)' : 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontWeight: 700,
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Sun size={16} style={{ color: '#f59e0b' }} />
              <span>Light Mode</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDarkMode(true)}
              style={{
                padding: '0.6rem',
                borderRadius: 8,
                border: isDarkMode ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                background: isDarkMode ? 'var(--nav-active-bg)' : 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontWeight: 700,
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Moon size={16} style={{ color: '#818cf8' }} />
              <span>Dark Mode</span>
            </button>
          </div>
        </div>

        {/* Accent Color Palette */}
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Accent Palette
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {ACCENT_COLORS.map(c => (
              <div
                key={c.value}
                onClick={() => setAccentColor(c.value)}
                className={`theme-color-swatch ${accentColor === c.value ? 'active' : ''}`}
                style={{ background: c.value, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
                title={c.name}
              >
                {accentColor === c.value && <Check size={14} strokeWidth={3} />}
              </div>
            ))}
          </div>
        </div>

        {/* Corner Radius */}
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Border Radius Style
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.5rem' }}>
            {[
              { label: 'Sharp', val: '4px' },
              { label: 'Default', val: '10px' },
              { label: 'Pill', val: '16px' }
            ].map(r => (
              <button
                key={r.val}
                type="button"
                onClick={() => setBorderRadius(r.val)}
                style={{
                  padding: '0.5rem',
                  borderRadius: 6,
                  border: borderRadius === r.val ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                  background: borderRadius === r.val ? 'var(--nav-active-bg)' : 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reset button */}
        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
          <button
            onClick={handleReset}
            style={{
              width: '100%',
              padding: '0.65rem',
              borderRadius: 8,
              border: '1px solid var(--border-light)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <RotateCcw size={15} />
            <span>Reset to Default Theme</span>
          </button>
        </div>
      </div>
    </>
  );
}
