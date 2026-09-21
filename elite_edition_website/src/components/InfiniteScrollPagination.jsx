import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, ArrowDown } from 'lucide-react';

/**
 * Reusable Infinite Scroll with Pagination Dock
 *
 * Provides:
 * - Invisible IntersectionObserver sentinel that auto-triggers `onLoadMore` when scrolled into view
 * - Progress indicator: "Showing X of Y items • Page P of N"
 * - Sleek pulsing loading spinner during background page loads
 * - Manual "Load More" action button (with hover lift)
 * - Navigation buttons (First / Prev / Next / Last) for instant page jumps
 * - Accurate completion pill: only "✓ All Y items loaded" when currentCount >= total
 * - Quick jump to Page 1 or Load All when on later pages
 * - Configurable page size options (e.g. 25, 50, 100, All)
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
  onFirstPage,
  onLastPage,
  onPageChange,
  pageSize = null,
  onPageSizeChange = null,
  pageSizeOptions = [25, 50, 100, 'All'],
  onLoadAll = null,
  scrollContainerRef = null,
  compact = false,
  style = {}
}) {
  const sentinelRef = useRef(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const loadingMoreRef = useRef(loadingMore);
  loadingMoreRef.current = loadingMore;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  const cooldownRef = useRef(false);

  useEffect(() => {
    let ticking = false;

    const checkAutoLoad = () => {
      if (!hasMoreRef.current || loadingMoreRef.current || loadingRef.current || cooldownRef.current) {
        return;
      }
      const sentinel = sentinelRef.current;
      if (!sentinel) return;

      const rect = sentinel.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

      // Trigger automatic infinite scroll when within 600px of viewport bottom
      if (rect.top <= viewportHeight + 600) {
        cooldownRef.current = true;
        if (onLoadMoreRef.current) {
          onLoadMoreRef.current();
        }
        setTimeout(() => {
          cooldownRef.current = false;
        }, 350);
      }
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          checkAutoLoad();
          ticking = false;
        });
        ticking = true;
      }
    };

    // 1. Window scroll & resize listeners for foolproof auto-scrolling
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    // 2. IntersectionObserver with generous 600px margin
    let observer = null;
    const sentinel = sentinelRef.current;
    if (sentinel && window.IntersectionObserver) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            checkAutoLoad();
          }
        },
        {
          root: scrollContainerRef?.current || null,
          rootMargin: '600px',
          threshold: 0
        }
      );
      observer.observe(sentinel);
    }

    // Check immediately on load or when new page/items arrive
    const timer = setTimeout(checkAutoLoad, 150);

    return () => {
      clearTimeout(timer);
      if (observer) observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [scrollContainerRef, page, currentCount]);

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
        {/* Left: Item Counter Chip & Page Size */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: currentCount >= total && total > 0 ? '#10b981' : '#3b82f6',
              boxShadow: currentCount >= total && total > 0 ? '0 0 6px #10b981' : '0 0 6px #3b82f6'
            }}
          />
          <span style={{ fontSize: '0.86rem', color: 'var(--text-main, #1e293b)', fontWeight: 600 }}>
            Showing{' '}
            <span style={{ color: '#2563eb', fontWeight: 700 }}>{currentCount.toLocaleString()}</span>
            {total > 0 && (
              <>
                {' '}of{' '}
                <span style={{ color: 'var(--text-main, #1e293b)', fontWeight: 700 }}>{total.toLocaleString()}</span>
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

          {/* Page Size Selector */}
          {onPageSizeChange && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '0.4rem' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>Per page:</span>
              {(pageSizeOptions || [25, 50, 100, 'All']).map(opt => {
                const isSelected = (opt === 'All' && (pageSize === 'all' || pageSize >= 1000)) || (String(opt) === String(pageSize));
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onPageSizeChange(opt)}
                    style={{
                      padding: '2px 7px',
                      fontSize: '0.72rem',
                      fontWeight: isSelected ? 800 : 600,
                      borderRadius: '6px',
                      border: isSelected ? '1px solid #2563eb' : '1px solid var(--border-color, #cbd5e1)',
                      background: isSelected ? '#2563eb' : 'var(--bg-main, #ffffff)',
                      color: isSelected ? '#ffffff' : 'var(--text-muted, #64748b)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Center: Status & Load More Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {loadingMore ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#2563eb',
                padding: '0.35rem 0.85rem',
                borderRadius: '20px',
                background: 'rgba(37, 99, 235, 0.08)'
              }}
            >
              <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Auto-loading {itemName}...</span>
            </div>
          ) : hasMore ? (
            <div
              onClick={() => onLoadMore && onLoadMore()}
              role="button"
              tabIndex={0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                padding: '0.35rem 0.85rem',
                borderRadius: '12px',
                color: '#2563eb',
                background: 'rgba(37, 99, 235, 0.08)',
                border: '1px dashed rgba(37, 99, 235, 0.35)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                userSelect: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#2563eb';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(37, 99, 235, 0.08)';
                e.currentTarget.style.color = '#2563eb';
              }}
              title="Auto-loads as you scroll down, or click to load now"
            >
              <ArrowDown size={14} />
              <span>Auto-scrolling (Page {page + 1})</span>
            </div>
          ) : total > 0 && currentCount >= total ? (
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
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--text-muted, #64748b)',
                  background: 'var(--bg-muted, #f1f5f9)',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '12px'
                }}
              >
                Page {page} of {pages} ({currentCount} showing)
              </span>
              {page > 1 && (
                <button
                  type="button"
                  onClick={() => onFirstPage ? onFirstPage() : onPageChange ? onPageChange(1) : onPrevPage && onPrevPage(1)}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#2563eb',
                    background: 'rgba(37, 99, 235, 0.08)',
                    border: '1px solid rgba(37, 99, 235, 0.25)',
                    padding: '0.22rem 0.65rem',
                    borderRadius: '10px',
                    cursor: 'pointer'
                  }}
                  title="Go to Page 1 (Newest items)"
                >
                  ⏮ Go to Page 1
                </button>
              )}
              {onLoadAll && currentCount < total && (
                <button
                  type="button"
                  onClick={onLoadAll}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#059669',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '0.22rem 0.65rem',
                    borderRadius: '10px',
                    cursor: 'pointer'
                  }}
                  title="Load all items into view"
                >
                  ⚡ Load All ({total})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Quick Page Navigation (First / Prev / Indicator / Next / Last) */}
        {pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {/* First Page (⏮) */}
            <button
              onClick={() => onFirstPage ? onFirstPage() : onPageChange ? onPageChange(1) : onPrevPage && onPrevPage(1)}
              disabled={page <= 1 || loadingMore}
              type="button"
              title="First page (Page 1)"
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
                opacity: page <= 1 ? 0.4 : 1,
                transition: 'all 0.15s ease'
              }}
            >
              <ChevronsLeft size={16} />
            </button>

            {/* Prev Page (◀) */}
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
                opacity: page <= 1 ? 0.4 : 1,
                transition: 'all 0.15s ease'
              }}
            >
              <ChevronLeft size={16} />
            </button>

            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--text-main, #1e293b)',
                minWidth: '55px',
                textAlign: 'center'
              }}
            >
              {page} / {pages}
            </span>

            {/* Next Page (▶) */}
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
                opacity: page >= pages ? 0.4 : 1,
                transition: 'all 0.15s ease'
              }}
            >
              <ChevronRight size={16} />
            </button>

            {/* Last Page (⏭) */}
            <button
              onClick={() => onLastPage ? onLastPage() : onPageChange ? onPageChange(pages) : null}
              disabled={page >= pages || loadingMore}
              type="button"
              title={`Last page (Page ${pages})`}
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
                opacity: page >= pages ? 0.4 : 1,
                transition: 'all 0.15s ease'
              }}
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
