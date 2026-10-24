import React from 'react';

/**
 * Enterprise Shimmer Skeleton Suite for Elite Edition ERP
 * Delivers perceived 0ms instantaneous loading states with responsive glassmorphism.
 */

export function ShimmerBox({ width = '100%', height = '16px', borderRadius = '6px', style = {}, className = '' }) {
  return (
    <div
      className={`elite-shimmer-box ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style
      }}
    />
  );
}

export function JobCardSkeletonItem() {
  return (
    <div
      style={{
        padding: '1.25rem',
        borderRadius: '16px',
        background: 'rgba(30, 41, 59, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Top Header: Job No + Status Pill */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ShimmerBox width="95px" height="22px" borderRadius="6px" />
        <ShimmerBox width="80px" height="22px" borderRadius="12px" />
      </div>

      {/* Middle: Design Thumbnail + Details */}
      <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
        <ShimmerBox width="68px" height="68px" borderRadius="12px" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <ShimmerBox width="75%" height="15px" borderRadius="4px" />
          <ShimmerBox width="55%" height="13px" borderRadius="4px" />
          <div style={{ display: 'flex', gap: '6px' }}>
            <ShimmerBox width="45px" height="18px" borderRadius="6px" />
            <ShimmerBox width="45px" height="18px" borderRadius="6px" />
          </div>
        </div>
      </div>

      {/* Progress meter bar */}
      <ShimmerBox width="100%" height="6px" borderRadius="3px" style={{ margin: '4px 0' }} />

      {/* Footer: Date + Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.6rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <ShimmerBox width="80px" height="12px" borderRadius="4px" />
        <div style={{ display: 'flex', gap: '8px' }}>
          <ShimmerBox width="30px" height="28px" borderRadius="6px" />
          <ShimmerBox width="30px" height="28px" borderRadius="6px" />
          <ShimmerBox width="60px" height="28px" borderRadius="6px" />
        </div>
      </div>
    </div>
  );
}

export function JobCardSkeletonGrid({ count = 6 }) {
  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.15rem',
          width: '100%'
        }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <JobCardSkeletonItem key={i} />
        ))}
      </div>
      <SkeletonStyles />
    </>
  );
}

export function ChatStreamSkeleton({ count = 5 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem', width: '100%' }}>
      {Array.from({ length: count }).map((_, i) => {
        const isRight = i % 2 === 1;
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: '0.75rem',
              alignSelf: isRight ? 'flex-end' : 'flex-start',
              maxWidth: '75%',
              flexDirection: isRight ? 'row-reverse' : 'row',
              alignItems: 'flex-end'
            }}
          >
            {/* Avatar */}
            <ShimmerBox width="34px" height="34px" borderRadius="50%" style={{ flexShrink: 0 }} />

            {/* Bubble */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '0.85rem 1.1rem',
                borderRadius: isRight ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: isRight ? 'rgba(37, 99, 235, 0.18)' : 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                minWidth: '160px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
              }}
            >
              <ShimmerBox width={isRight ? '90px' : '110px'} height="11px" borderRadius="3px" style={{ opacity: 0.6 }} />
              <ShimmerBox width={isRight ? '160px' : '220px'} height="14px" borderRadius="4px" />
              {i % 3 === 0 && <ShimmerBox width="140px" height="14px" borderRadius="4px" />}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                <ShimmerBox width="42px" height="9px" borderRadius="3px" style={{ opacity: 0.4 }} />
              </div>
            </div>
          </div>
        );
      })}
      <SkeletonStyles />
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: '1rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
        {Array.from({ length: cols }).map((_, c) => (
          <ShimmerBox key={c} width={`${100 / cols}%`} height="14px" borderRadius="4px" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: '1rem', padding: '0.85rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <ShimmerBox key={c} width={`${100 / cols}%`} height="13px" borderRadius="4px" />
          ))}
        </div>
      ))}
      <SkeletonStyles />
    </div>
  );
}

export function SkeletonStyles() {
  return (
    <style>{`
      @keyframes eliteShimmerAnimation {
        0% {
          background-position: -200% 0;
        }
        100% {
          background-position: 200% 0;
        }
      }

      .elite-shimmer-box {
        background: linear-gradient(
          90deg,
          rgba(255, 255, 255, 0.04) 25%,
          rgba(255, 255, 255, 0.12) 50%,
          rgba(255, 255, 255, 0.04) 75%
        );
        background-size: 200% 100%;
        animation: eliteShimmerAnimation 1.6s ease-in-out infinite;
      }

      /* Light mode fallback when parent is not dark */
      :root[data-theme="light"] .elite-shimmer-box,
      .light-theme .elite-shimmer-box,
      .theme-light .elite-shimmer-box {
        background: linear-gradient(
          90deg,
          #f1f5f9 25%,
          #e2e8f0 50%,
          #f1f5f9 75%
        );
        background-size: 200% 100%;
        animation: eliteShimmerAnimation 1.6s ease-in-out infinite;
      }
    `}</style>
  );
}
