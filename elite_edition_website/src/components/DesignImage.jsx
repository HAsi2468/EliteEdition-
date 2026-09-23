import React, { useState, useEffect, useMemo } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { getImageCandidates } from '../utils/imageUrlHelper';

/**
 * Resilient, self-healing Design Image Component.
 * Automatically tries all candidate extensions (.jpg, .jpeg, .png, etc.) and CDN endpoints.
 * Never leaves a broken image icon on screen.
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
  width = 360
}) {
  const candidates = useMemo(
    () => getImageCandidates(rawUrl, designName, { thumbnail, width }),
    [rawUrl, designName, thumbnail, width]
  );
  const [candidateIdx, setCandidateIdx] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [allFailed, setAllFailed] = useState(false);

  // Reset state when candidates change
  useEffect(() => {
    setCandidateIdx(0);
    setHasLoaded(false);
    setAllFailed(false);
  }, [candidates]);

  const currentSrc = candidates[candidateIdx] || '';

  const handleError = () => {
    if (candidateIdx + 1 < candidates.length) {
      setCandidateIdx(prev => prev + 1);
      setHasLoaded(false);
    } else {
      setAllFailed(true);
    }
  };

  const handleLoad = () => {
    setHasLoaded(true);
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
          color: 'var(--text-muted)',
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
        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
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
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#04070d',
        ...style
      }}
      onClick={handleClick}
    >
      {/* Subtle loader shimmer until image successfully loads */}
      {!hasLoaded && (
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            zIndex: 1
          }}
        />
      )}

      <img
        src={currentSrc}
        alt={alt || designName || 'Design'}
        loading="lazy"
        decoding="async"
        onError={handleError}
        onLoad={handleLoad}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          cursor: onZoom ? 'zoom-in' : (onClick ? 'pointer' : 'default'),
          opacity: hasLoaded ? 1 : 0,
          transition: 'opacity 0.2s ease-in-out',
          ...imgStyle
        }}
      />
    </div>
  );
}
