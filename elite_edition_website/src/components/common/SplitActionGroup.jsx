import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, MoreHorizontal, X, Loader2 } from 'lucide-react';
import { useDeviceContext } from '../../hooks/useDeviceContext';
import './SplitActionGroup.css';

/**
 * SplitActionGroup
 * 
 * Enterprise action consolidation pattern.
 * Consolidates sprawling clusters of action buttons (Save, Save & New, Print, Export, Delete)
 * into a responsive, unified component:
 * 
 * 1. Desktop (>=1200px):
 *    Primary button + attached split dropdown chevron showing secondary actions with keyboard shortcuts.
 * 2. Tablet (768px - 1199px):
 *    Touch-friendly primary icon-text button + condensed dropdown menu.
 * 3. Mobile (<768px):
 *    Sticky bottom dock (or inline compact button) with dominant Primary CTA + (...) button triggering
 *    a native gesture swipeable bottom sheet.
 * 
 * @param {Object} props
 * @param {Object} props.primaryAction - Main CTA { label, icon: Icon, onClick, loading, disabled, shortcut }
 * @param {Array} props.secondaryActions - Array of { id, label, icon: Icon, onClick, disabled, isDestructive, shortcut, dividerAfter, subtext, hidden }
 * @param {string} [props.variant='primary'] - 'primary' | 'secondary' | 'danger' | 'success'
 * @param {string} [props.align='right'] - 'left' | 'right' dropdown alignment
 * @param {string} [props.mobilePlacement='dock'] - 'dock' (sticky bottom) | 'inline'
 * @param {string} [props.className='']
 * @param {Object} [props.style={}]
 */
export function SplitActionGroup({
  primaryAction,
  secondaryActions = [],
  variant = 'primary',
  align = 'right',
  mobilePlacement = 'dock',
  className = '',
  style = {},
}) {
  const { isMobile, isTablet, isDesktop } = useDeviceContext();
  const [isOpen, setIsOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(-1);
  const groupRef = useRef(null);
  const menuRef = useRef(null);

  // Filter out hidden secondary actions
  const visibleSecondary = secondaryActions.filter((a) => !a?.hidden);
  const hasSecondary = visibleSecondary.length > 0;

  // Touch gesture state for mobile bottom sheet
  const [touchOffset, setTouchOffset] = useState(0);
  const touchStartYRef = useRef(0);
  const isDraggingRef = useRef(false);

  // Close menu handler
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setActiveItemIndex(-1);
    setTouchOffset(0);
  }, []);

  // Keyboard shortcut listener (Ctrl/Cmd + key)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Primary Action Shortcut (default Cmd/Ctrl + S if configured or matches)
      if (primaryAction?.shortcut) {
        const key = primaryAction.shortcut.toLowerCase().replace('mod+', '').replace('ctrl+', '').replace('cmd+', '');
        if (isMod && e.key.toLowerCase() === key) {
          e.preventDefault();
          if (!primaryAction.disabled && !primaryAction.loading) {
            primaryAction.onClick?.(e);
          }
          return;
        }
      }

      // Secondary Action Shortcuts
      for (const item of visibleSecondary) {
        if (item.shortcut) {
          const key = item.shortcut.toLowerCase().replace('mod+', '').replace('ctrl+', '').replace('cmd+', '');
          if (isMod && e.key.toLowerCase() === key) {
            e.preventDefault();
            if (!item.disabled) {
              item.onClick?.(e);
              handleClose();
            }
            return;
          }
        }
      }

      // Dropdown navigation via keyboard
      if (isOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleClose();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveItemIndex((prev) => (prev + 1) % visibleSecondary.length);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveItemIndex((prev) => (prev - 1 + visibleSecondary.length) % visibleSecondary.length);
        } else if (e.key === 'Enter' && activeItemIndex >= 0) {
          e.preventDefault();
          const target = visibleSecondary[activeItemIndex];
          if (target && !target.disabled) {
            target.onClick?.(e);
            handleClose();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [primaryAction, visibleSecondary, isOpen, activeItemIndex, handleClose]);

  // Click outside listener for desktop/tablet dropdown
  useEffect(() => {
    if (!isOpen || isMobile) return;

    const handlePointerDown = (e) => {
      if (groupRef.current && !groupRef.current.contains(e.target)) {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isOpen, isMobile, handleClose]);

  // Mobile Bottom Sheet Gesture Tracking
  const handleTouchStart = (e) => {
    touchStartYRef.current = e.touches[0].clientY;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e) => {
    if (!isDraggingRef.current) return;
    const diff = e.touches[0].clientY - touchStartYRef.current;
    if (diff > 0) {
      setTouchOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (touchOffset > 80) {
      handleClose();
    } else {
      setTouchOffset(0);
    }
  };

  if (!primaryAction) return null;

  const PrimaryIcon = primaryAction.icon;

  // =========================================================================
  // MOBILE RENDER (<768px): Sticky Bottom Dock or Compact Inline + Bottom Sheet
  // =========================================================================
  if (isMobile && mobilePlacement === 'dock') {
    return (
      <>
        <div className={`split-mobile-dock ${className}`} style={style}>
          <button
            type="button"
            className="split-mobile-primary-btn"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled || primaryAction.loading}
            aria-label={primaryAction.label}
          >
            {primaryAction.loading ? (
              <Loader2 size={18} className="spin-loader" />
            ) : PrimaryIcon ? (
              <PrimaryIcon size={18} />
            ) : null}
            <span>{primaryAction.label}</span>
          </button>

          {hasSecondary && (
            <button
              type="button"
              className="split-mobile-more-btn"
              onClick={() => setIsOpen(true)}
              aria-label="More actions"
              aria-haspopup="dialog"
              aria-expanded={isOpen}
            >
              <MoreHorizontal size={20} />
            </button>
          )}
        </div>

        {/* Mobile Bottom Sheet Modal */}
        {isOpen && (
          <div className="split-sheet-overlay" onClick={handleClose}>
            <div
              className="split-sheet-panel"
              onClick={(e) => e.stopPropagation()}
              style={{
                transform: `translateY(${touchOffset}px)`,
                transition: isDraggingRef.current ? 'none' : 'transform 0.2s ease-out',
              }}
            >
              {/* Swipe Drag Pill */}
              <div
                className="split-sheet-handle-bar"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />

              <div className="split-sheet-header">
                <span className="split-sheet-title">Actions</span>
                <button
                  type="button"
                  className="split-sheet-close"
                  onClick={handleClose}
                  aria-label="Close action sheet"
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
                {visibleSecondary.map((action, idx) => {
                  const ItemIcon = action.icon;
                  return (
                    <React.Fragment key={action.id || action.label || idx}>
                      <button
                        type="button"
                        className={`split-sheet-item ${action.isDestructive ? 'is-destructive' : ''}`}
                        disabled={action.disabled}
                        onClick={(e) => {
                          action.onClick?.(e);
                          handleClose();
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {ItemIcon && <ItemIcon size={18} />}
                          <div>
                            <div>{action.label}</div>
                            {action.subtext && (
                              <div className="split-sheet-item-subtext">{action.subtext}</div>
                            )}
                          </div>
                        </div>
                        {action.shortcut && (
                          <span className="split-item-shortcut">{action.shortcut}</span>
                        )}
                      </button>
                      {action.dividerAfter && <div className="split-dropdown-divider" />}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // =========================================================================
  // DESKTOP (>=1200px) & TABLET (768px-1199px) / INLINE MOBILE RENDER
  // =========================================================================
  const isTabletMode = isTablet;

  return (
    <div
      ref={groupRef}
      className={`split-action-group variant-${variant} ${isTabletMode ? 'is-tablet' : ''} ${className}`}
      style={style}
    >
      {/* Primary Action Button */}
      <button
        type="button"
        className={`split-btn-primary ${!hasSecondary ? 'is-solo' : ''}`}
        onClick={primaryAction.onClick}
        disabled={primaryAction.disabled || primaryAction.loading}
        title={primaryAction.shortcut ? `${primaryAction.label} (${primaryAction.shortcut})` : primaryAction.label}
      >
        {primaryAction.loading ? (
          <Loader2 size={16} className="spin-loader" />
        ) : PrimaryIcon ? (
          <PrimaryIcon size={16} />
        ) : null}
        <span>{primaryAction.label}</span>
      </button>

      {/* Split Arrow Toggle Trigger */}
      {hasSecondary && (
        <button
          type="button"
          className="split-btn-toggle"
          onClick={() => setIsOpen((prev) => !prev)}
          disabled={primaryAction.disabled}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label="Additional actions"
        >
          <ChevronDown
            size={16}
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
            }}
          />
        </button>
      )}

      {/* Floating Dropdown Menu */}
      {isOpen && hasSecondary && (
        <div
          ref={menuRef}
          role="menu"
          className={`split-dropdown-menu ${align === 'left' ? 'align-left' : ''}`}
          aria-orientation="vertical"
        >
          {visibleSecondary.map((action, idx) => {
            const ItemIcon = action.icon;
            const isFocused = activeItemIndex === idx;

            return (
              <React.Fragment key={action.id || action.label || idx}>
                <button
                  type="button"
                  role="menuitem"
                  className={`split-dropdown-item ${action.isDestructive ? 'is-destructive' : ''} ${isFocused ? 'is-focused' : ''}`}
                  disabled={action.disabled}
                  onClick={(e) => {
                    action.onClick?.(e);
                    handleClose();
                  }}
                >
                  <span className="split-item-content">
                    {ItemIcon && <ItemIcon size={15} />}
                    <span>{action.label}</span>
                  </span>
                  {action.shortcut && (
                    <span className="split-item-shortcut">{action.shortcut}</span>
                  )}
                </button>
                {action.dividerAfter && <div className="split-dropdown-divider" />}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SplitActionGroup;
