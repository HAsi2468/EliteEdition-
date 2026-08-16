import React, { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';

export const PRESET_OPTIONS = [
  { id: 'today', name: 'Today' },
  { id: 'yesterday', name: 'Yesterday' },
  { id: 'this_week', name: 'This Week' },
  { id: 'last_week', name: 'Last Week' },
  { id: 'last_7_days', name: 'Last 7 Days' },
  { id: 'this_month', name: 'This Month' },
  { id: 'previous_month', name: 'Previous Month' },
  { id: 'last_30_days', name: 'Last 30 Days' },
  { id: 'this_quarter', name: 'This Quarter' },
  { id: 'previous_quarter', name: 'Previous Quarter' },
  { id: 'current_fiscal_year', name: 'Current Fiscal Year' },
  { id: 'previous_fiscal_year', name: 'Previous Fiscal Year' },
  { id: 'last_365_days', name: 'Last 365 Days' },
  { id: 'all', name: 'All Time' },
  { id: 'custom', name: 'Custom Range' }
];

export function getDatePresetRange(preset, customStart = '', customEnd = '') {
  const now = new Date();
  let start = null;
  let end = null;
  let labelText = '';

  const formatDate = (d) => {
    if (!d) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const toYMD = (d) => {
    if (!d) return '';
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
  };

  switch (preset) {
    case 'today': {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0);
      end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'this_week': {
      const dayOfWeek = now.getDay();
      const distToMonday = (dayOfWeek + 6) % 7;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distToMonday, 0, 0, 0);
      const sun = new Date(start);
      sun.setDate(start.getDate() + 6);
      end = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate(), 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'last_week': {
      const dayOfWeek = now.getDay();
      const distToMonday = (dayOfWeek + 6) % 7;
      const prevMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distToMonday - 7, 0, 0, 0);
      start = prevMon;
      const prevSun = new Date(prevMon);
      prevSun.setDate(prevMon.getDate() + 6);
      end = new Date(prevSun.getFullYear(), prevSun.getMonth(), prevSun.getDate(), 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'last_7_days': {
      const d7 = new Date(now);
      d7.setDate(now.getDate() - 6);
      start = new Date(d7.getFullYear(), d7.getMonth(), d7.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'this_month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'previous_month': {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'last_30_days': {
      const d30 = new Date(now);
      d30.setDate(now.getDate() - 29);
      start = new Date(d30.getFullYear(), d30.getMonth(), d30.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'this_quarter': {
      const m = now.getMonth();
      const qStartMonth = Math.floor(m / 3) * 3;
      start = new Date(now.getFullYear(), qStartMonth, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), qStartMonth + 3, 0, 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'previous_quarter': {
      const m = now.getMonth();
      const qStartMonth = Math.floor(m / 3) * 3 - 3;
      start = new Date(now.getFullYear(), qStartMonth, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), qStartMonth + 3, 0, 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'current_fiscal_year': {
      const yr = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      start = new Date(yr, 3, 1, 0, 0, 0);
      end = new Date(yr + 1, 2, 31, 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'previous_fiscal_year': {
      const yr = (now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1) - 1;
      start = new Date(yr, 3, 1, 0, 0, 0);
      end = new Date(yr + 1, 2, 31, 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'last_365_days': {
      const d365 = new Date(now);
      d365.setDate(now.getDate() - 364);
      start = new Date(d365.getFullYear(), d365.getMonth(), d365.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      labelText = `${formatDate(start)} - ${formatDate(end)}`;
      break;
    }
    case 'custom': {
      if (customStart) start = new Date(`${customStart}T00:00:00`);
      if (customEnd) end = new Date(`${customEnd}T23:59:59`);
      labelText = start && end ? `${formatDate(start)} - ${formatDate(end)}` : 'Custom Range';
      break;
    }
    case 'all':
    default: {
      start = null;
      end = null;
      labelText = 'All Time Records';
      break;
    }
  }

  const dateStart = start ? toYMD(start) : '';
  const dateEnd = end ? toYMD(end) : '';

  return { start, end, dateStart, dateEnd, labelText };
}

export default function DateRangePicker({
  preset = 'this_month',
  onChange,
  customStart = '',
  customEnd = '',
  onCustomChange,
  theme = 'light', // 'light' (default white style) | 'dark'
  align = 'auto',  // 'auto' | 'left' | 'right'
  style = {},
  buttonStyle = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [localCustomStart, setLocalCustomStart] = useState(customStart);
  const [localCustomEnd, setLocalCustomEnd] = useState(customEnd);

  const containerRef = useRef(null);

  useEffect(() => {
    setLocalCustomStart(customStart);
  }, [customStart]);

  useEffect(() => {
    setLocalCustomEnd(customEnd);
  }, [customEnd]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeRange = getDatePresetRange(preset, localCustomStart, localCustomEnd);
  const activePresetObj = PRESET_OPTIONS.find(p => p.id === preset) || PRESET_OPTIONS[5];

  const handleSelectPreset = (optId) => {
    if (optId === 'custom') {
      if (onChange) {
        const range = getDatePresetRange('custom', localCustomStart, localCustomEnd);
        onChange({ preset: 'custom', ...range });
      }
    } else {
      const range = getDatePresetRange(optId, '', '');
      if (onChange) {
        onChange({ preset: optId, ...range });
      }
      setIsOpen(false);
    }
  };

  const handleApplyCustom = () => {
    if (onCustomChange) {
      onCustomChange(localCustomStart, localCustomEnd);
    }
    const range = getDatePresetRange('custom', localCustomStart, localCustomEnd);
    if (onChange) {
      onChange({ preset: 'custom', ...range });
    }
    setIsOpen(false);
  };

  const isDark = theme === 'dark';

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        zIndex: isOpen ? 99999 : 100,
        ...style
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={activeRange.labelText ? `Active: ${activeRange.labelText}` : activePresetObj.name}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.55rem',
          padding: '0.48rem 0.95rem',
          borderRadius: '8px',
          border: isDark ? '1.5px solid #a78bfa' : '1.5px solid #cbd5e1',
          background: isDark
            ? 'linear-gradient(135deg, #1e1b4b, #312e81)'
            : '#ffffff',
          color: isDark ? '#ffffff' : '#0f172a',
          fontWeight: 700,
          fontSize: '0.82rem',
          cursor: 'pointer',
          boxShadow: isDark
            ? '0 4px 14px rgba(124, 58, 237, 0.35)'
            : '0 2px 6px rgba(15, 23, 42, 0.06)',
          transition: 'all 0.18s ease',
          whiteSpace: 'nowrap',
          ...buttonStyle
        }}
        onMouseEnter={(e) => {
          if (!isDark) {
            e.currentTarget.style.borderColor = '#6366f1';
            e.currentTarget.style.background = '#f8fafc';
          }
        }}
        onMouseLeave={(e) => {
          if (!isDark) {
            e.currentTarget.style.borderColor = '#cbd5e1';
            e.currentTarget.style.background = '#ffffff';
          }
        }}
      >
        <Calendar size={15} color={isDark ? '#a78bfa' : '#4f46e5'} />
        <span>{activePresetObj.name}</span>
        <Calendar size={15} color={isDark ? '#a78bfa' : '#4f46e5'} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: align === 'right' ? 'auto' : 0,
            right: align === 'right' ? 0 : 'auto',
            width: '360px',
            maxWidth: '92vw',
            maxHeight: '400px',
            overflowY: 'auto',
            background: isDark ? '#0f172a' : '#ffffff',
            color: isDark ? '#f8fafc' : '#0f172a',
            borderRadius: '12px',
            boxShadow: isDark
              ? '0 20px 50px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(167, 139, 250, 0.3)'
              : '0 20px 45px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.08)',
            border: isDark
              ? '1px solid rgba(167, 139, 250, 0.35)'
              : '1px solid #cbd5e1',
            zIndex: 99999,
            padding: '0.35rem 0'
          }}
        >
          {PRESET_OPTIONS.map(opt => {
            const rangeInfo = getDatePresetRange(opt.id, localCustomStart, localCustomEnd);
            const isSelected = preset === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => handleSelectPreset(opt.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.85rem',
                  padding: '0.6rem 0.95rem',
                  cursor: 'pointer',
                  background: isSelected
                    ? (isDark ? 'rgba(124, 58, 237, 0.3)' : 'rgba(79, 70, 229, 0.08)')
                    : 'transparent',
                  borderBottom: isDark
                    ? '1px solid rgba(255, 255, 255, 0.06)'
                    : '1px solid #f1f5f9',
                  fontSize: '0.82rem',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span
                  style={{
                    fontWeight: isSelected ? 800 : 600,
                    color: isSelected
                      ? (isDark ? '#a78bfa' : '#4f46e5')
                      : (isDark ? '#e2e8f0' : '#0f172a'),
                    whiteSpace: 'nowrap'
                  }}
                >
                  {opt.name}
                </span>
                <span
                  style={{
                    fontWeight: isSelected ? 700 : 500,
                    fontSize: '0.75rem',
                    color: isSelected
                      ? (isDark ? '#38bdf8' : '#2563eb')
                      : (isDark ? '#94a3b8' : '#64748b'),
                    whiteSpace: 'nowrap'
                  }}
                >
                  {rangeInfo.labelText}
                </span>
              </div>
            );
          })}

          {preset === 'custom' && (
            <div
              style={{
                padding: '0.75rem 1rem',
                background: isDark ? '#1e293b' : '#f8fafc',
                borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}>From</label>
                  <input
                    type="date"
                    value={localCustomStart}
                    onChange={e => setLocalCustomStart(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.35rem',
                      fontSize: '0.8rem',
                      background: isDark ? '#0f172a' : '#ffffff',
                      color: isDark ? '#fff' : '#0f172a',
                      border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                      borderRadius: '6px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}>To</label>
                  <input
                    type="date"
                    value={localCustomEnd}
                    onChange={e => setLocalCustomEnd(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.35rem',
                      fontSize: '0.8rem',
                      background: isDark ? '#0f172a' : '#ffffff',
                      color: isDark ? '#fff' : '#0f172a',
                      border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
                      borderRadius: '6px'
                    }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleApplyCustom}
                style={{
                  padding: '0.45rem',
                  background: 'linear-gradient(135deg, #4f46e5, #4338ca)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
                }}
              >
                Apply Custom Range
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
