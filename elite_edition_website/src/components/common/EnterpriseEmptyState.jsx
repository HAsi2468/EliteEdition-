import React from 'react';
import { Layers, Plus, RefreshCw, FilterX } from 'lucide-react';

/**
 * EnterpriseEmptyState
 * 
 * Reusable, high-contrast, empty-state placeholder across all data grids,
 * filter results, and list views. Replaces boring empty tables with actionable guidance.
 */
export default function EnterpriseEmptyState({
  icon: Icon = Layers,
  title = 'No records found',
  description = 'There are no items matching your current filters or search criteria.',
  actionLabel,
  onAction,
  actionIcon: ActionIcon = Plus,
  secondaryLabel,
  onSecondaryAction,
  secondaryIcon: SecondaryIcon = FilterX,
  style = {}
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px dashed #cbd5e1',
        margin: '16px 0',
        minHeight: '260px',
        ...style
      }}
    >
      {/* Icon Badge */}
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          border: '1px solid #bfdbfe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#2563eb',
          marginBottom: '16px',
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)'
        }}
      >
        <Icon size={26} strokeWidth={1.8} />
      </div>

      {/* Title */}
      <h3
        style={{
          fontSize: '1rem',
          fontWeight: 700,
          color: '#0f172a',
          margin: '0 0 6px 0',
          letterSpacing: '-0.01em'
        }}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        style={{
          fontSize: '0.8125rem',
          color: '#64748b',
          maxWidth: '380px',
          margin: '0 0 20px 0',
          lineHeight: 1.5
        }}
      >
        {description}
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            <ActionIcon size={15} />
            <span>{actionLabel}</span>
          </button>
        )}

        {secondaryLabel && onSecondaryAction && (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            <SecondaryIcon size={15} />
            <span>{secondaryLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}
