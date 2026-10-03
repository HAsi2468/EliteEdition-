import React, { useState, useEffect, useRef } from 'react';

/**
 * Minimal Table Controls Component
 * Provides:
 * 1. Column visibility toggles (stored in localStorage per table + company)
 * 2. Density toggle: 'Comfortable' vs 'Compact'
 * 3. Saved filter presets per user + company
 */

export function TableControls({
  tableId = 'default_table',
  companyId = 'digital_print',
  allColumns = [], // [{ key: 'jobNo', label: 'Job No', defaultVisible: true }]
  visibleColumns = [],
  onVisibleColumnsChange = () => {},
  density = 'comfortable', // 'comfortable' | 'compact'
  onDensityChange = () => {},
  savedViews = [],
  activeViewId = '',
  onSelectView = () => {},
  onSaveCurrentView = () => {},
  style = {}
}) {
  const [showColDropdown, setShowColDropdown] = useState(false);
  const [showDensityDropdown, setShowDensityDropdown] = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  const colRef = useRef(null);
  const densityRef = useRef(null);
  const viewRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (colRef.current && !colRef.current.contains(e.target)) setShowColDropdown(false);
      if (densityRef.current && !densityRef.current.contains(e.target)) setShowDensityDropdown(false);
      if (viewRef.current && !viewRef.current.contains(e.target)) setShowViewDropdown(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const toggleColumn = (key) => {
    let next;
    if (visibleColumns.includes(key)) {
      if (visibleColumns.length <= 1) return; // Keep at least one column visible
      next = visibleColumns.filter((c) => c !== key);
    } else {
      next = [...visibleColumns, key];
    }
    onVisibleColumnsChange(next);
    try {
      localStorage.setItem(`elite_cols_${companyId}_${tableId}`, JSON.stringify(next));
    } catch {}
  };

  const handleDensitySelect = (mode) => {
    onDensityChange(mode);
    setShowDensityDropdown(false);
    try {
      localStorage.setItem(`elite_density_${tableId}`, mode);
    } catch {}
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
        fontSize: '13px',
        ...style
      }}
    >
      {/* 1. Columns Toggle */}
      <div ref={colRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setShowColDropdown(!showColDropdown)}
          style={{
            height: '36px',
            minHeight: '36px',
            padding: '6px 12px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#334155',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>Columns ({visibleColumns.length}/{allColumns.length})</span>
          <span style={{ fontSize: '10px' }}>▼</span>
        </button>

        {showColDropdown && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '6px',
              zIndex: 9999,
              minWidth: '180px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
            }}
          >
            <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
              {allColumns.map((col) => {
                const isChecked = visibleColumns.includes(col.key);
                return (
                  <label
                    key={col.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      fontSize: '13px',
                      color: '#0f172a',
                      cursor: 'pointer',
                      borderRadius: '4px'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleColumn(col.key)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>{col.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. Density Toggle */}
      <div ref={densityRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setShowDensityDropdown(!showDensityDropdown)}
          style={{
            height: '36px',
            minHeight: '36px',
            padding: '6px 12px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#334155',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            textTransform: 'capitalize'
          }}
        >
          <span>Density: {density}</span>
          <span style={{ fontSize: '10px' }}>▼</span>
        </button>

        {showDensityDropdown && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '4px',
              zIndex: 9999,
              minWidth: '140px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
            }}
          >
            <div
              onClick={() => handleDensitySelect('comfortable')}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                backgroundColor: density === 'comfortable' ? '#f1f5f9' : 'transparent',
                fontWeight: density === 'comfortable' ? 600 : 400,
                borderRadius: '4px'
              }}
            >
              Comfortable
            </div>
            <div
              onClick={() => handleDensitySelect('compact')}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                backgroundColor: density === 'compact' ? '#f1f5f9' : 'transparent',
                fontWeight: density === 'compact' ? 600 : 400,
                borderRadius: '4px'
              }}
            >
              Compact
            </div>
          </div>
        )}
      </div>

      {/* 3. Saved Views Selector */}
      {savedViews.length > 0 && (
        <div ref={viewRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowViewDropdown(!showViewDropdown)}
            style={{
              height: '36px',
              minHeight: '36px',
              padding: '6px 12px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>View: {savedViews.find((v) => v.id === activeViewId)?.name || 'Default'}</span>
            <span style={{ fontSize: '10px' }}>▼</span>
          </button>

          {showViewDropdown && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '4px',
                zIndex: 9999,
                minWidth: '160px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
              }}
            >
              {savedViews.map((v) => (
                <div
                  key={v.id}
                  onClick={() => {
                    onSelectView(v.id);
                    setShowViewDropdown(false);
                  }}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    backgroundColor: v.id === activeViewId ? '#f1f5f9' : 'transparent',
                    fontWeight: v.id === activeViewId ? 600 : 400,
                    borderRadius: '4px'
                  }}
                >
                  {v.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TableControls;
