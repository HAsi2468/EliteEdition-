import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import './CellHoverPeek.css';

/**
 * CellHoverPeek
 * 
 * Lightweight UI tooltip component that detects if cell text overflows its container.
 * On hover, renders a non-disruptive overlay card showing full text with a 1-click clipboard copy button.
 * Can be used as a wrapper or mounted globally for delegated automatic detection.
 */
export function CellHoverPeek({
  text,
  title = 'Full Value',
  children,
  className = '',
  maxWidth = 360
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [copied, setCopied] = useState(false);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const hoverTimeoutRef = useRef(null);

  const rawText = text || (typeof children === 'string' ? children : '');

  const handleMouseEnter = () => {
    const el = triggerRef.current;
    if (!el) return;

    // Check if element is truncated or has overflow
    const isOverflowing = el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
    if (!isOverflowing && !text) return; // Only peek if actually truncated or explicit text provided

    hoverTimeoutRef.current = setTimeout(() => {
      const rect = el.getBoundingClientRect();
      const popoverWidth = Math.min(maxWidth, window.innerWidth - 32);
      
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 16) {
        left = window.innerWidth - popoverWidth - 16;
      }
      left = Math.max(16, left);

      let top = rect.bottom + 6;
      if (top + 160 > window.innerHeight) {
        top = Math.max(16, rect.top - 140);
      }

      setCoords({ top, left });
      setIsOpen(true);
    }, 180); // Subtle 180ms debounce so it doesn't flicker while sweeping mouse
  };

  const handleMouseLeave = (e) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    // Don't close immediately if moving into the popover card
    if (popoverRef.current && popoverRef.current.contains(e.relatedTarget)) {
      return;
    }
    setIsOpen(false);
    setCopied(false);
  };

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  return (
    <>
      <span
        ref={triggerRef}
        className={`cell-hover-peek-trigger truncate ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {children || text}
      </span>

      {isOpen && rawText && (
        <div
          ref={popoverRef}
          className="cell-hover-peek-popover"
          style={{ top: `${coords.top}px`, left: `${coords.left}px`, maxWidth: `${maxWidth}px` }}
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="cell-hover-peek-header">
            <span className="cell-hover-peek-title">{title}</span>
            <button
              type="button"
              className={`cell-hover-peek-copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
              title="Copy to clipboard"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="cell-hover-peek-content">
            {rawText}
          </div>
          <div className="cell-hover-peek-meta">
            <span>{rawText.length} characters</span>
            <span style={{ opacity: 0.7 }}>Click copy to capture</span>
          </div>
        </div>
      )}
    </>
  );
}

export default CellHoverPeek;
