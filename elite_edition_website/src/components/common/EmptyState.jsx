import React from 'react';

/**
 * Standardized One-Line Minimal Empty State Component
 * Shows a plain, concise message and optional single action button.
 * No decorative illustrations or redundant icons.
 */

export function EmptyState({
  message = 'No records found',
  actionLabel = '',
  onAction = null,
  style = {}
}) {
  return (
    <div
      style={{
        padding: '32px 16px',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '14px',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        border: '1px dashed #cbd5e1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        margin: '12px 0',
        ...style
      }}
    >
      <span>{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            backgroundColor: '#0f172a',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 14px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
