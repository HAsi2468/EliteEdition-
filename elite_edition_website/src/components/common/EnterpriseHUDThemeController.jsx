import React, { useState, useEffect } from 'react';
import { Sliders, Sun, Moon, Gauge, RotateCcw, X, Check } from 'lucide-react';
import './EnterpriseHUDThemeController.css';

/**
 * EnterpriseHUDThemeController
 * 
 * Controls:
 * 1. Industrial High-Contrast HUD Theme (solid 2px high-visibility outlines for factory shop floors).
 * 2. Dynamic UI Scale Slider (fluidly scaling UI density between 85% and 115%).
 * Persistent in localStorage.
 */
export function EnterpriseHUDThemeController() {
  const [isOpen, setIsOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [isIndustrial, setIsIndustrial] = useState(false);

  // Initialize from localStorage
  useEffect(() => {
    const savedScale = localStorage.getItem('erp_ui_scale');
    if (savedScale) {
      const parsed = parseFloat(savedScale);
      if (!isNaN(parsed) && parsed >= 0.85 && parsed <= 1.15) {
        setScale(parsed);
        document.documentElement.style.setProperty('--erp-scale', parsed);
        document.body.style.zoom = parsed;
      }
    }

    const savedTheme = localStorage.getItem('erp_hud_theme');
    if (savedTheme === 'industrial') {
      setIsIndustrial(true);
      document.documentElement.setAttribute('data-hud-theme', 'industrial');
    }
  }, []);

  const handleScaleChange = (newScale) => {
    setScale(newScale);
    localStorage.setItem('erp_ui_scale', newScale);
    document.documentElement.style.setProperty('--erp-scale', newScale);
    document.body.style.zoom = newScale;
  };

  const handleToggleIndustrial = () => {
    const next = !isIndustrial;
    setIsIndustrial(next);
    if (next) {
      localStorage.setItem('erp_hud_theme', 'industrial');
      document.documentElement.setAttribute('data-hud-theme', 'industrial');
    } else {
      localStorage.removeItem('erp_hud_theme');
      document.documentElement.removeAttribute('data-hud-theme');
    }
  };

  const handleReset = () => {
    handleScaleChange(1);
    if (isIndustrial) handleToggleIndustrial();
  };

  return (
    <>
      <button
        type="button"
        className="hud-controller-pill"
        onClick={() => setIsOpen(o => !o)}
        title="Adjust UI Scale & Factory Floor Display Mode"
        aria-label="UI Display Controller"
      >
        <Gauge size={13} style={{ color: isIndustrial ? '#38bdf8' : 'var(--primary)' }} />
        <span>{Math.round(scale * 100)}%</span>
        {isIndustrial && <span style={{ color: '#38bdf8', fontSize: '0.65rem' }}>• HUD</span>}
      </button>

      {isOpen && (
        <div className="hud-popover-panel">
          <div className="hud-panel-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sliders size={14} style={{ color: 'var(--primary)' }} />
              <span>Display Ergonomics</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Scale Slider */}
          <div className="hud-scale-slider-row">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700 }}>
              <span>UI Scale Density:</span>
              <span style={{ color: 'var(--primary)' }}>{Math.round(scale * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.85"
              max="1.15"
              step="0.05"
              value={scale}
              onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
              className="hud-scale-slider"
            />
            <div className="hud-scale-labels">
              <span>85% (Dense)</span>
              <span>100% (Default)</span>
              <span>115% (Comfort)</span>
            </div>
          </div>

          {/* Industrial High Contrast Theme Toggle */}
          <div className="hud-theme-toggle-row">
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>🏭 Factory HUD Mode</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Solid 2px high-visibility outlines</div>
            </div>
            <button
              type="button"
              className={`btn-secondary ${isIndustrial ? 'active' : ''}`}
              onClick={handleToggleIndustrial}
              style={{
                fontSize: '0.7rem',
                padding: '0.25rem 0.55rem',
                borderColor: isIndustrial ? '#0284c7' : undefined,
                background: isIndustrial ? 'rgba(2, 132, 199, 0.2)' : undefined,
                color: isIndustrial ? '#38bdf8' : undefined,
                fontWeight: 700
              }}
            >
              {isIndustrial ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Reset Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.2rem' }}>
            <button
              type="button"
              onClick={handleReset}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              <RotateCcw size={11} /> Reset Defaults
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default EnterpriseHUDThemeController;
