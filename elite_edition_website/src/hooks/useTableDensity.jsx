import React, { useState, useEffect, useCallback } from 'react';
import { SlidersHorizontal, Check } from 'lucide-react';

const STORAGE_KEY = 'elite_erp_table_density';
const DENSITY_EVENT = 'elite-density-change';

/**
 * Enterprise Table Density Management Hook
 * Supports two ergonomic modes:
 *  - 'compact': 28px row height, dense padding, maximized viewport record visibility
 *  - 'comfortable': 44px row height, spacious padding, high touch & tablet readability
 *
 * Persists user choice in localStorage and synchronizes html[data-user-density].
 */
export function useTableDensity(defaultDensity = 'compact') {
  const [density, setDensityState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'compact' || saved === 'comfortable' || saved === 'dense') {
        return saved === 'dense' ? 'compact' : saved;
      }
    } catch {}
    return defaultDensity;
  });

  const setDensity = useCallback((newDensity) => {
    const normalized = newDensity === 'comfortable' ? 'comfortable' : 'compact';
    setDensityState(normalized);
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch {}
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-user-density', normalized);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DENSITY_EVENT, { detail: { density: normalized } }));
    }
  }, []);

  const toggleDensity = useCallback(() => {
    setDensity(density === 'compact' ? 'comfortable' : 'compact');
  }, [density, setDensity]);

  // Sync with document element on mount
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-user-density', density);
    }

    const handleExternalChange = (e) => {
      if (e.detail?.density && e.detail.density !== density) {
        setDensityState(e.detail.density);
      }
    };

    window.addEventListener(DENSITY_EVENT, handleExternalChange);
    return () => window.removeEventListener(DENSITY_EVENT, handleExternalChange);
  }, [density]);

  return {
    density,
    isCompact: density === 'compact',
    isComfortable: density === 'comfortable',
    setDensity,
    toggleDensity
  };
}

/**
 * Reusable Segmented Density Toggle Button
 */
export function TableDensityToggle({ density: propDensity, onChange, className = '' }) {
  const internal = useTableDensity();
  const currentDensity = propDensity || internal.density;
  const handleChange = onChange || internal.setDensity;

  return (
    <div
      className={`table-density-toggle-group ${className}`}
      role="group"
      aria-label="Table row density"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: '#f1f5f9',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        padding: '2px',
        gap: '2px',
        fontSize: '12px'
      }}
    >
      <button
        type="button"
        title="Compact Density (More rows visible)"
        onClick={() => handleChange('compact')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          borderRadius: '4px',
          border: 'none',
          cursor: 'pointer',
          fontWeight: currentDensity === 'compact' ? 600 : 500,
          background: currentDensity === 'compact' ? '#ffffff' : 'transparent',
          color: currentDensity === 'compact' ? '#1e293b' : '#64748b',
          boxShadow: currentDensity === 'compact' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          transition: 'all 0.15s ease'
        }}
      >
        <span style={{ fontSize: '11px', letterSpacing: '-0.2px' }}>Compact</span>
      </button>

      <button
        type="button"
        title="Comfortable Density (Spacious rows)"
        onClick={() => handleChange('comfortable')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          borderRadius: '4px',
          border: 'none',
          cursor: 'pointer',
          fontWeight: currentDensity === 'comfortable' ? 600 : 500,
          background: currentDensity === 'comfortable' ? '#ffffff' : 'transparent',
          color: currentDensity === 'comfortable' ? '#1e293b' : '#64748b',
          boxShadow: currentDensity === 'comfortable' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          transition: 'all 0.15s ease'
        }}
      >
        <span style={{ fontSize: '11px', letterSpacing: '-0.2px' }}>Comfortable</span>
      </button>
    </div>
  );
}

export default useTableDensity;
