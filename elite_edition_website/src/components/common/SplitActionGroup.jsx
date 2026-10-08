import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
 * Supports both interfaces:
 *  - actions: [{ id, label, icon, isPrimary, isDanger, shortcut, handler, loading, disabled }]
 *  - primaryAction: { label, icon, onClick, loading, disabled, shortcut } + secondaryActions: [...]
 */
export function SplitActionGroup({
  actions,
  primaryAction: propPrimary,
  secondaryActions: propSecondary = [],
  variant = 'primary',
  align = 'right',
  mobilePlacement = 'dock',
  className = '',
  style = {},
  confirmDestructive = true
}) {
  const { isMobile, isTablet, isDesktop } = useDeviceContext();
  const [isOpen, setIsOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(-1);
  const groupRef = useRef(null);
  const menuRef = useRef(null);

  // Normalize actions array input vs primaryAction/secondaryActions input
  const primaryAction = useMemo(() => {
    if (propPrimary) return propPrimary;
    if (Array.isArray(actions) && actions.length > 0) {
      const primary = actions.find((a) => a.isPrimary) || actions[0];
      return {
        ...primary,
        onClick: primary.handler || primary.onClick
      };
    }
    return { label: 'Submit', onClick: () => {} };
  }, [actions, propPrimary]);

  const visibleSecondary = useMemo(() => {
    if (propSecondary && propSecondary.length > 0) {
      return propSecondary.filter((a) => !a?.hidden);
    }
    if (Array.isArray(actions) && actions.length > 0) {
      const primary = actions.find((a) => a.isPrimary) || actions[0];
      return actions
        .filter((a) => a !== primary && !a?.hidden)
        .map((a) => ({
          ...a,
          isDestructive: a.isDanger || a.isDestructive,
          onClick: a.handler || a.onClick
        }));
    }
    return [];
  }, [actions, propSecondary]);

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

  // Safe execution with destructive action confirmation prompt
  const handleItemClick = useCallback((action, e) => {
    if (action.disabled || action.loading) return;

    if ((action.isDestructive || action.isDanger) && confirmDestructive) {
      const confirmed = window.confirm(
        action.confirmMessage || `Are you sure you want to perform "${action.label}"? This action cannot be undone.`
      );
      if (!confirmed) return;
    }

    action.onClick?.(e);
    handleClose();
  }, [confirmDestructive, handleClose]);

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
            if (!item.disabled && !item.loading) {
              handleItemClick(item, e);
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
            handleItemClick(target, e);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [primaryAction, visibleSecondary, isOpen, activeItemIndex, handleClose, handleItemClick]);

  // Click outside listener for desktop/tablet dropdown
  useEffect(() => {
    if (!isOpen || isMobile) return;

    const handleClickOutside = (e) => {
      if (groupRef.current && !groupRef.current.contains(e.target)) {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, isMobile, handleClose]);

  // Mobile touch swipe gesture handlers for bottom sheet
  const handleTouchStart = (e) => {
    touchStartYRef.current = e.touches[0].clientY;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e) => {
    if (!isDraggingRef.current) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartYRef.current;
    if (diff > 0) {
      setTouchOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    if (touchOffset > 80) {
      handleClose();
    } else {
      setTouchOffset(0);
    }
  };

  const PrimaryIcon = primaryAction.icon;

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. RENDERERS
  // ─────────────────────────────────────────────────────────────────────────────

  // Mobile Bottom Dock / Inline Placement (<768px)
  if (isMobile) {
    const isDock = mobilePlacement === 'dock';

    return (
      <div
        ref={groupRef}
        className={`split-action-group is-mobile ${isDock ? 'is-docked' : ''} ${className}`}
        style={style}
      >
        <div className="split-mobile-bar">
          {/* Dominant Primary CTA */}
          <button
            type="button"
            className={`split-btn-primary ${variant}`}
            disabled={primaryAction.disabled || primaryAction.loading}
            onClick={primaryAction.onClick}
          >
            {primaryAction.loading ? (
              <Loader2 size={16} className="spin-loader" />
            ) : (
              PrimaryIcon && <PrimaryIcon size={16} />
            )}
            <span>{primaryAction.label}</span>
          </button>

          {/* Overflow (...) trigger */}
          {hasSecondary && (
            <button
              type="button"
              className="split-btn-mobile-more"
              onClick={() => setIsOpen(true)}
              aria-label="More actions"
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
                        disabled={action.disabled || action.loading}
                        onClick={(e) => handleItemClick(action, e)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {action.loading ? (
                            <Loader2 size={18} className="spin-loader" />
                          ) : (
                            ItemIcon && <ItemIcon size={18} />
                          )}
                          <div>
                            <div>{action.label}</div>
                            {action.subtext && (
                              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>
                                {action.subtext}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                      {action.dividerAfter && <div className="split-sheet-divider" />}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Tablet View (768px - 1199px): Condensed Icon-Text + Popover
  if (isTablet) {
    return (
      <div
        ref={groupRef}
        className={`split-action-group is-tablet ${className}`}
        style={style}
      >
        <button
          type="button"
          className={`split-btn-primary ${variant}`}
          disabled={primaryAction.disabled || primaryAction.loading}
          onClick={primaryAction.onClick}
        >
          {primaryAction.loading ? (
            <Loader2 size={15} className="spin-loader" />
          ) : (
            PrimaryIcon && <PrimaryIcon size={15} />
          )}
          <span>{primaryAction.label}</span>
        </button>

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
              size={14}
              style={{
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
              }}
            />
          </button>
        )}

        {/* Dropdown Popover */}
        {isOpen && hasSecondary && (
          <div
            ref={menuRef}
            role="menu"
            className={`split-dropdown-menu ${align === 'left' ? 'align-left' : ''}`}
            aria-orientation="vertical"
          >
            {visibleSecondary.map((action, idx) => {
              const ItemIcon = action.icon;
              return (
                <React.Fragment key={action.id || action.label || idx}>
                  <button
                    type="button"
                    role="menuitem"
                    className={`split-dropdown-item ${action.isDestructive ? 'is-destructive' : ''}`}
                    disabled={action.disabled || action.loading}
                    onClick={(e) => handleItemClick(action, e)}
                  >
                    <span className="split-item-content">
                      {action.loading ? (
                        <Loader2 size={14} className="spin-loader" />
                      ) : (
                        ItemIcon && <ItemIcon size={14} />
                      )}
                      <span>{action.label}</span>
                    </span>
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

  // Desktop View (>=1200px): Fused Split Button + Hotkey Dropdown
  return (
    <div
      ref={groupRef}
      className={`split-action-group is-desktop ${className}`}
      style={style}
    >
      {/* Primary Action Button */}
      <button
        type="button"
        className={`split-btn-primary ${variant}`}
        disabled={primaryAction.disabled || primaryAction.loading}
        onClick={primaryAction.onClick}
        title={primaryAction.shortcut ? `${primaryAction.label} (${primaryAction.shortcut})` : primaryAction.label}
      >
        {primaryAction.loading ? (
          <Loader2 size={15} className="spin-loader" />
        ) : (
          PrimaryIcon && <PrimaryIcon size={15} />
        )}
        <span>{primaryAction.label}</span>
        {primaryAction.shortcut && (
          <span className="split-btn-shortcut">{primaryAction.shortcut}</span>
        )}
      </button>

      {/* Split Chevron Trigger */}
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
                  disabled={action.disabled || action.loading}
                  onClick={(e) => handleItemClick(action, e)}
                >
                  <span className="split-item-content">
                    {action.loading ? (
                      <Loader2 size={15} className="spin-loader" />
                    ) : (
                      ItemIcon && <ItemIcon size={15} />
                    )}
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
