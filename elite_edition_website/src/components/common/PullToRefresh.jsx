import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, ArrowDown } from 'lucide-react';

/**
 * Enterprise Native-Style Pull-To-Refresh Component
 * Wraps list views and data tables to provide smooth touch-driven refresh.
 * 
 * @param {function} onRefresh - Async callback or function triggered when pulled past threshold
 * @param {React.ReactNode} children - Scrollable table or list content
 * @param {string} [className] - Optional container class
 * @param {object} [style] - Optional container styles
 */
export function PullToRefresh({ onRefresh, children, className = '', style = {} }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const containerRef = useRef(null);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const isEligibleForPull = useRef(false);

  const PULL_THRESHOLD = 70; // px
  const MAX_PULL = 110; // px

  // Detect whether device supports touch input
  const isTouchSupported = typeof window !== 'undefined' && (
    'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0)
  );

  const getScrollTop = () => {
    if (!containerRef.current) return window.scrollY || 0;
    // Find closest scrollable ancestor
    const scrollParent = containerRef.current.closest('.content-area-wrap, section, .app-container') || containerRef.current.parentElement;
    if (scrollParent && scrollParent.scrollTop !== undefined) {
      return scrollParent.scrollTop;
    }
    return containerRef.current.scrollTop || window.scrollY || 0;
  };

  const handleTouchStart = (e) => {
    if (isRefreshing || !e.touches || e.touches.length === 0) return;
    const scrollTop = getScrollTop();

    // Only allow pull-down if user is at the very top of the scrollable container
    if (scrollTop <= 2) {
      isEligibleForPull.current = true;
      touchStartY.current = e.touches[0].clientY;
      touchStartX.current = e.touches[0].clientX;
    } else {
      isEligibleForPull.current = false;
    }
  };

  const handleTouchMove = (e) => {
    if (!isEligibleForPull.current || isRefreshing || !e.touches || e.touches.length === 0) return;
    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const diffY = currentY - touchStartY.current;
    const diffX = Math.abs(currentX - touchStartX.current);

    // If gesture is horizontal (e.g. scrolling table left/right), yield immediately
    if (diffX > Math.abs(diffY)) {
      isEligibleForPull.current = false;
      setPullDistance(0);
      setIsPulling(false);
      return;
    }

    if (diffY > 0) {
      // Damped pull resistance curve
      const resistance = Math.min(MAX_PULL, Math.pow(diffY, 0.85) * 1.8);
      setPullDistance(resistance);
      setIsPulling(true);
    } else {
      setPullDistance(0);
      setIsPulling(false);
    }
  };

  const handleTouchEnd = async () => {
    if (!isEligibleForPull.current || isRefreshing) return;
    isEligibleForPull.current = false;
    setIsPulling(false);

    if (pullDistance >= PULL_THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(54); // Hold at indicator height while refreshing

      try {
        if (typeof onRefresh === 'function') {
          await Promise.resolve(onRefresh());
        } else {
          // Fallback: emit global refresh event
          window.dispatchEvent(new CustomEvent('elite-refresh-data'));
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
      } catch (err) {
        console.warn('Pull-to-refresh handler failed:', err);
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        }, 300);
      }
    } else {
      setPullDistance(0);
    }
  };

  const progress = Math.min(1, pullDistance / PULL_THRESHOLD);
  const isTriggerable = pullDistance >= PULL_THRESHOLD;

  // On PC desktop without touch, render transparently to avoid scroll traps
  if (!isTouchSupported) {
    return (
      <div
        ref={containerRef}
        className={`pull-to-refresh-container ${className}`}
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '100%',
          ...style
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`pull-to-refresh-container ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100%',
        touchAction: 'pan-y',
        overscrollBehaviorY: isPulling ? 'contain' : 'auto',
        WebkitOverflowScrolling: 'touch',
        ...style
      }}
    >
      {/* Pull Indicator Pill */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: `translate(-50%, ${pullDistance - 44}px)`,
            transition: isPulling ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            zIndex: 40,
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '6px 14px',
              backgroundColor: '#ffffff',
              borderRadius: '999px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)',
              border: `1px solid ${isTriggerable || isRefreshing ? '#93c5fd' : '#e2e8f0'}`,
              color: isTriggerable || isRefreshing ? '#2563eb' : '#64748b',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            {isRefreshing ? (
              <>
                <RefreshCw size={14} className="spin-loader" />
                <span>Updating live data...</span>
              </>
            ) : (
              <>
                <div
                  style={{
                    transform: `rotate(${progress * 180}deg)`,
                    transition: 'transform 0.1s linear',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <ArrowDown size={14} />
                </div>
                <span>{isTriggerable ? 'Release to refresh' : 'Pull down to refresh'}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Content with subtle translate during pull */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${Math.min(54, pullDistance * 0.6)}px)` : 'none',
          transition: isPulling ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          minHeight: '100%',
          width: '100%'
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default PullToRefresh;
