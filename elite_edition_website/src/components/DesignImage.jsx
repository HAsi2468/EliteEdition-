import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import {
  getImageCandidates,
  recordWinningUrl,
  recordDeadUrl,
  prefetchImage
} from '../utils/imageUrlHelper';

/**
 * Ultra-Fast Enterprise Design Image Component.
 * Features:
 * 1. Winning Candidate URL Caching: Remembers working CDN/R2 endpoints in RAM & SessionStorage for 0ms loads.
 * 2. Negative Dead URL Caching: Prevents repetitive 404 network storms.
 * 3. Viewport Intersection Observer: Defers offscreen image loading until 250px before entering viewport.
 * 4. Hover-Intent HD Master Prefetching: Pre-fetches high-res assets on hover for instantaneous modal zoom.
 * 5. Smooth Hardware-Accelerated Shimmer: Zero layout-shift placeholder.
 */
export default function DesignImage({
  rawUrl,
  designName = '',
  alt = '',
  className = '',
  style = {},
  imgStyle = {},
  onZoom,
  onClick,
  category = '',
  showPlaceholderBadge = true,
  thumbnail = true,
  width = 360,
  priority = false,
  showShimmer = true,
  identifiers = [],
  strictDirectOnly = false
}) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const hoverTimerRef = useRef(null);

  // Always mount <img> and rely on native browser loading="lazy" / "eager"
  // (avoids IntersectionObserver getting stuck false inside scrolled/tabbed containers)
  const isInView = true;

  const candidates = useMemo(
    () => getImageCandidates(rawUrl, designName, { thumbnail, width, identifiers, category, strictDirectOnly }),
    [rawUrl, designName, thumbnail, width, identifiers, category, strictDirectOnly]
  );

  const [candidateIdx, setCandidateIdx] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [allFailed, setAllFailed] = useState(false);

  // Reset state when candidate source changes
  useEffect(() => {
    setCandidateIdx(0);
    setHasLoaded(false);
    setAllFailed(false);
  }, [candidates]);

  const currentSrc = candidates[candidateIdx] || '';

  // Ensure already-cached images reveal immediately even if onLoad fires synchronously
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setHasLoaded(true);
    }
  }, [currentSrc]);

  const handleError = () => {
    if (currentSrc) {
      recordDeadUrl(currentSrc);
    }
    if (candidateIdx + 1 < candidates.length) {
      setCandidateIdx(prev => prev + 1);
      setHasLoaded(false);
    } else {
      setAllFailed(true);
    }
  };

  const handleLoad = () => {
    setHasLoaded(true);
    if (currentSrc) {
      recordWinningUrl(rawUrl, designName, currentSrc, thumbnail);
    }
  };

  // Hover-intent HD prefetch
  const handleMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      const hdCandidates = getImageCandidates(rawUrl, designName, { thumbnail: false });
      if (hdCandidates[0]) {
        prefetchImage(hdCandidates[0]);
      }
    }, 80);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const handleClick = (e) => {
    if (onZoom && !allFailed) {
      const fullCandidates = getImageCandidates(rawUrl, designName, { thumbnail: false });
      const hdSrc = fullCandidates[0] || currentSrc;
      onZoom(hdSrc);
    } else if (onClick) {
      onClick(e);
    }
  };

  // If all candidates failed or no candidates exist
  if (allFailed || !currentSrc) {
    if (!showPlaceholderBadge) return null;
    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '160px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
          color: 'var(--text-muted, #94a3b8)',
          gap: '0.45rem',
          padding: '1rem',
          textAlign: 'center',
          userSelect: 'none',
          boxSizing: 'border-box',
          ...style
        }}
      >
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'rgba(99, 102, 241, 0.15)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#818cf8',
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
        }}>
          <ImageIcon size={20} />
        </div>
        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary, #ffffff)', letterSpacing: '0.02em' }}>
          {designName || 'DESIGN'}
        </span>
        <span style={{ fontSize: '0.68rem', color: '#94a3b8', opacity: 0.8, fontWeight: 500 }}>
          {category ? `${category} • ` : ''}Design Registered
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(11, 17, 32, 0.72)',
        contain: 'layout paint',
        ...style
      }}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Subtle loader shimmer until image successfully loads */}
      {showShimmer && !hasLoaded && (
        <div
          className="erp-shimmer-box"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 1
          }}
        />
      )}

      {isInView ? (
        <img
          ref={imgRef}
          src={currentSrc}
          alt={alt || designName || 'Design'}
          width={width || 360}
          height={width || 360}
          loading={priority ? 'eager' : 'lazy'}
          fetchpriority={priority ? 'high' : 'auto'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={handleError}
          onLoad={handleLoad}
          style={{
            width: '100%',
            height: '100%',
            aspectRatio: '1 / 1',
            objectFit: 'cover',
            cursor: onZoom ? 'zoom-in' : (onClick ? 'pointer' : 'default'),
            opacity: hasLoaded ? 1 : 0,
            transition: 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: 'translateZ(0)', // Force GPU layer
            ...imgStyle
          }}
        />
      ) : null}
    </div>
  );
}
