import React from 'react';

/**
 * Minimal Skeleton Shimmer Component
 * Replaces plain spinners with layout-matching content placeholders.
 */

export function SkeletonBlock({ width = '100%', height = '1rem', style = {} }) {
  return (
    <div
      className="skeleton-pulse"
      style={{
        width,
        height,
        backgroundColor: '#e2e8f0',
        borderRadius: '6px',
        ...style
      }}
    />
  );
}

export function SkeletonCard({ count = 4 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', width: '100%' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}
        >
          <SkeletonBlock width="45%" height="0.875rem" />
          <SkeletonBlock width="70%" height="1.75rem" />
          <SkeletonBlock width="35%" height="0.75rem" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }) {
  return (
    <div
      style={{
        width: '100%',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        overflow: 'hidden'
      }}
    >
      {/* Table Header Placeholder */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          padding: '0.75rem 1rem',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          gap: '1rem'
        }}
      >
        {Array.from({ length: cols }).map((_, c) => (
          <SkeletonBlock key={c} width="60%" height="0.875rem" />
        ))}
      </div>

      {/* Table Body Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            padding: '0.875rem 1rem',
            borderBottom: r === rows - 1 ? 'none' : '1px solid #f1f5f9',
            gap: '1rem',
            alignItems: 'center'
          }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBlock key={c} width={c === 0 ? '75%' : c === cols - 1 ? '40%' : '65%'} height="0.9375rem" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonForm({ fields = 4 }) {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        width: '100%'
      }}
    >
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <SkeletonBlock width="30%" height="0.875rem" />
          <SkeletonBlock width="100%" height="2.5rem" style={{ borderRadius: '6px' }} />
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
        <SkeletonBlock width="80px" height="2.25rem" />
        <SkeletonBlock width="100px" height="2.25rem" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0' }}>
      {/* Header Bar Placeholder */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <SkeletonBlock width="180px" height="1.5rem" />
          <SkeletonBlock width="260px" height="0.875rem" />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <SkeletonBlock width="110px" height="2.25rem" style={{ borderRadius: '8px' }} />
          <SkeletonBlock width="120px" height="2.25rem" style={{ borderRadius: '8px' }} />
        </div>
      </div>

      {/* KPI Cards Placeholder */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SkeletonBlock width="45%" height="0.8rem" />
              <SkeletonBlock width="24px" height="24px" style={{ borderRadius: '6px' }} />
            </div>
            <SkeletonBlock width="70%" height="1.75rem" />
            <SkeletonBlock width="40%" height="0.75rem" />
          </div>
        ))}
      </div>

      {/* Filter / Search Bar Placeholder */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <SkeletonBlock width="240px" height="2.25rem" style={{ borderRadius: '6px' }} />
        <SkeletonBlock width="130px" height="2.25rem" style={{ borderRadius: '6px' }} />
        <SkeletonBlock width="130px" height="2.25rem" style={{ borderRadius: '6px' }} />
        <div style={{ flex: 1 }} />
        <SkeletonBlock width="90px" height="2.25rem" style={{ borderRadius: '6px' }} />
      </div>

      {/* Main Table Placeholder */}
      <div style={{ flex: 1 }}>
        <SkeletonTable rows={7} cols={6} />
      </div>
    </div>
  );
}

export const ModuleSkeleton = DashboardSkeleton;

export default {
  SkeletonBlock,
  SkeletonCard,
  SkeletonTable,
  SkeletonForm,
  DashboardSkeleton,
  ModuleSkeleton
};
