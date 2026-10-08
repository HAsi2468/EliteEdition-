import React from 'react';
import './EnterpriseSkeletons.css';

/**
 * Precision Table Rows Skeleton
 * Matches exact 28px or 32px height of data grids with custom cell width ratios.
 */
export function PrecisionTableSkeleton({
  rowCount = 5,
  rowHeight = 32, // 28 or 32
  columns = [
    { width: '120px' },
    { width: '220px' },
    { width: '140px' },
    { width: '100px' },
    { width: '110px' },
    { width: '80px' }
  ],
  className = ''
}) {
  const heightClass = rowHeight === 28 ? 'height-28' : 'height-32';

  return (
    <div className={`precision-table-skeleton-wrap ${className}`} role="status" aria-label="Loading data table...">
      {Array.from({ length: rowCount }).map((_, rIdx) => (
        <div key={rIdx} className={`skeleton-table-row ${heightClass}`}>
          {columns.map((col, cIdx) => {
            // Stagger random fill widths (between 50% and 85%) for realistic tabular layout
            const fillWidth = 50 + ((rIdx * 17 + cIdx * 29) % 36);
            return (
              <div
                key={cIdx}
                className="skeleton-table-cell"
                style={{ width: col.width, flex: col.flex || (col.width ? undefined : 1) }}
              >
                <div
                  className="skeleton-shimmer skeleton-bar"
                  style={{ width: `${fillWidth}%` }}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * Mobile Card List Skeleton
 * Matches the layout of touch mobile card lists with badge, avatar, and metrics.
 */
export function MobileCardListSkeleton({ count = 3, className = '' }) {
  return (
    <div className={`mobile-card-skeleton-wrap ${className}`} role="status" aria-label="Loading cards...">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="skeleton-mobile-card">
          <div className="skeleton-mobile-header">
            <div className="skeleton-shimmer" style={{ width: '110px', height: '14px' }} />
            <div className="skeleton-shimmer" style={{ width: '60px', height: '18px', borderRadius: '9999px' }} />
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <div className="skeleton-shimmer" style={{ width: '36px', height: '36px', borderRadius: '6px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1 }}>
              <div className="skeleton-shimmer" style={{ width: '70%', height: '12px' }} />
              <div className="skeleton-shimmer" style={{ width: '45%', height: '10px' }} />
            </div>
          </div>

          <div className="skeleton-mobile-body">
            <div>
              <div className="skeleton-shimmer" style={{ width: '40px', height: '10px', marginBottom: '4px' }} />
              <div className="skeleton-shimmer" style={{ width: '80px', height: '12px' }} />
            </div>
            <div>
              <div className="skeleton-shimmer" style={{ width: '40px', height: '10px', marginBottom: '4px' }} />
              <div className="skeleton-shimmer" style={{ width: '65px', height: '12px' }} />
            </div>
          </div>

          <div className="skeleton-mobile-footer">
            <div className="skeleton-shimmer" style={{ width: '90px', height: '11px' }} />
            <div className="skeleton-shimmer" style={{ width: '70px', height: '26px', borderRadius: '4px' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Form Field Grid Skeleton
 * Matches multi-column input forms.
 */
export function FormFieldGridSkeleton({ columns = 3, fields = 6, className = '' }) {
  return (
    <div
      className={`skeleton-form-grid ${className}`}
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))` }}
      role="status"
      aria-label="Loading form fields..."
    >
      {Array.from({ length: fields }).map((_, idx) => (
        <div key={idx} className="skeleton-form-field">
          <div className="skeleton-shimmer skeleton-form-label" />
          <div className="skeleton-shimmer skeleton-form-input" />
        </div>
      ))}
    </div>
  );
}

export default PrecisionTableSkeleton;
