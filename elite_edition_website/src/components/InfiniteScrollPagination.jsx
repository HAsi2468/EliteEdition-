import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Loader2, ArrowDown } from 'lucide-react';

/**
 * Reusable Infinite Scroll with Pagination Dock
 *
 * Provides:
 * - Invisible IntersectionObserver sentinel that auto-triggers `onLoadMore` when scrolled into view
 * - Progress indicator: "Showing X of Y items • Page P of N"
 * - Sleek pulsing loading spinner during background page loads
 * - Manual "Load More" action button (with hover lift)
 * - Navigation buttons (Prev / Next) for instant page jumps
 * - End-of-data completion pill: "✓ All Y items loaded"
 */
export default function InfiniteScrollPagination({
  hasMore = false,
  loading = false,
  loadingMore = false,
  onLoadMore,
  page = 1,
  pages = 1,
  total = 0,
  currentCount = 0,
  itemName = 'items',
  onPrevPage,
  onNextPage,
  scrollContainerRef = null,
  compact = false,
  style = {}
}) {
  const sentinelRef = useRef(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    if (!hasMore || loadingMore || loading) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    let debounceTimer = null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && hasMore) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            if (onLoadMoreRef.current) {
              onLoadMoreRef.current();
            }
          }, 100);
        }
      },
      {
        root: scrollContainerRef?.current || null,
        rootMargin: '200px',
        threshold: 0.01
      }
    );

    observer.observe(sentinel);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      observer.disconnect();
    };
  }, [hasMore, loadingMore, loading, scrollContainerRef]);

  // If no items loaded at all, hide pagination dock
  if (currentCount === 0 && !loading && !loadingMore) return null;

  return (
    <div style={{ width: '100%', marginTop: '1.25rem', marginBottom: '1.25rem', ...style }}>
      {/* Invisible sentinel element observed by IntersectionObserver */}
      <div 
        ref={sentinelRef} 
        style={{ height: '10px', width: '100%', pointerEvents: 'none', opacity: 0 }} 
        aria-hidden="true" 
      />

      {/* Modern Glassmorphic Dock */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.85rem',
          padding: compact ? '0.5rem 0.85rem' : '0.75rem 1.25rem',
          borderRadius: '16px',
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
          backdropFilter: 'blur(10px)',
          transition: 'all 0.2s ease'
        }}
      >
        {/* Left: Item Counter Chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: loadingMore ? '#f59e0b' : hasMore ? '#2563eb' : '#10b981',
              boxShadow: loadingMore 
                ? '0 0 8px #f59e0b' 
                : hasMore 
                  ? '0 0 8px #2563eb' 
                  : '0 0 8px #10b981',
              transition: 'all 0.3s ease'
            }}
          />
          <span style={{ fontSize: '0.86rem', color: 'var(--text-main, #1e293b)', fontWeight: 600 }}>
            Showing{' '}
            <span style={{ color: '#2563eb' }}>{currentCount.toLocaleString()}</span>
            {total > 0 && (
              <>
                {' '}of{' '}
                <span style={{ color: 'var(--text-main, #1e293b)' }}>{total.toLocaleString()}</span>
              </>
            )}{' '}
            {itemName}
          </span>
          {pages > 1 && (
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted, #64748b)',
                background: 'var(--bg-muted, #f1f5f9)',
                padding: '2px 8px',
                borderRadius: '12px'
              }}
            >
              Page {page} of {pages}
            </span>
          )}
        </div>

        {/* Center: Status & Load More Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {loadingMore ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#2563eb',
                padding: '0.35rem 0.85rem',
                borderRadius: '20px',
                background: 'rgba(37, 99, 235, 0.08)'
              }}
            >
              <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Loading more {itemName}...</span>
            </div>
          ) : hasMore ? (
            <button
              onClick={() => onLoadMore && onLoadMore()}
              type="button"
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                padding: '0.4rem 0.95rem',
                borderRadius: '12px',
                color: '#2563eb',
                background: 'rgba(37, 99, 235, 0.06)',
                border: '1px solid rgba(37, 99, 235, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#2563eb';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(37, 99, 235, 0.06)';
                e.currentTarget.style.color = '#2563eb';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              title="Load next page"
            >
              <ArrowDown size={14} />
              <span>Load More (Page {page + 1})</span>
            </button>
          ) : total > 0 ? (
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#10b981',
                background: 'rgba(16, 185, 129, 0.08)',
                padding: '0.25rem 0.75rem',
                borderRadius: '12px'
              }}
            >
              ✓ All {total.toLocaleString()} {itemName} loaded
            </span>
          ) : null}
        </div>

        {/* Right: Quick Page Navigation (Prev / Next) */}
        {pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              onClick={() => onPrevPage && onPrevPage()}
              disabled={page <= 1 || loadingMore}
              type="button"
              title="Previous page"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #e2e8f0)',
                background: 'var(--bg-main, #ffffff)',
                color: page <= 1 ? '#94a3b8' : 'var(--text-main, #1e293b)',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                opacity: page <= 1 ? 0.5 : 1,
                transition: 'all 0.15s ease'
              }}
            >
              <ChevronLeft size={16} />
            </button>

            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-muted, #64748b)',
                minWidth: '45px',
                textAlign: 'center'
              }}
            >
              {page} / {pages}
            </span>

            <button
              onClick={() => onNextPage ? onNextPage() : onLoadMore && onLoadMore()}
              disabled={page >= pages || loadingMore}
              type="button"
              title="Next page"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #e2e8f0)',
                background: 'var(--bg-main, #ffffff)',
                color: page >= pages ? '#94a3b8' : 'var(--text-main, #1e293b)',
                cursor: page >= pages ? 'not-allowed' : 'pointer',
                opacity: page >= pages ? 0.5 : 1,
                transition: 'all 0.15s ease'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
