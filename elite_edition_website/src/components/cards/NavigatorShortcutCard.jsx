import React from "react";
import { Compass, ExternalLink, ArrowRight } from "lucide-react";

export function NavigatorShortcutCard({ data, onAction }) {
  if (!data) return null;

  const {
    targetScreen,
    label,
    department,
    searchQuery,
    message
  } = data;

  const handleNavigate = () => {
    window.dispatchEvent(
      new CustomEvent('erp:navigate', {
        detail: { screen: targetScreen, searchQuery, department }
      })
    );
  };

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '12px',
        padding: '12px 14px',
        margin: '8px 0',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        maxWidth: '400px',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: '#eff6ff',
              color: '#2563eb'
            }}
          >
            <Compass size={16} />
          </span>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.86rem', fontWeight: 800, color: '#0f172a' }}>
              {label || targetScreen}
            </h4>
            <p style={{ margin: 0, fontSize: '0.70rem', color: '#64748b' }}>
              {searchQuery ? `Filter: "${searchQuery}"` : 'Direct Screen Shortcut'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleNavigate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '6px 12px',
            borderRadius: '8px',
            background: '#2563eb',
            color: '#ffffff',
            border: 'none',
            fontSize: '0.76rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'background 0.15s ease'
          }}
        >
          <span>Jump</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

export default NavigatorShortcutCard;
