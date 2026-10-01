import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

/**
 * SmartIconButton
 * Clean, modern 36px micro-container icon button with tooltip and aria-label.
 */
export function SmartIconButton({
  icon: Icon,
  label,
  tooltip,
  onClick,
  variant = 'default',
  color,
  bgColor,
  borderColor,
  disabled = false,
  className = '',
  style = {}
}) {
  const titleText = tooltip || label;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`smart-icon-btn ${variant !== 'default' ? variant : ''} ${className}`}
      title={titleText}
      aria-label={label || tooltip}
      style={{
        ...(color ? { color } : {}),
        ...(bgColor ? { backgroundColor: bgColor } : {}),
        ...(borderColor ? { borderColor } : {}),
        ...style
      }}
    >
      {Icon && <Icon size={15} />}
    </button>
  );
}

/**
 * SmartActionGroup
 * Responsive table and card action group.
 * Desktop: Inlines recognized smart icon micro-containers with tooltips.
 * Mobile (<640px): Shows 1-2 primary actions inline and folds secondary actions
 * into a sleek 3-dots (MoreVertical) menu/sheet to prevent line breaks and layout chaos.
 */
export function SmartActionGroup({
  actions = [],
  maxInlineMobile = 2,
  maxPerRow = 4,
  align = 'center',
  style = {}
}) {
  const [isMobile, setIsMobile] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 640 : false;
  });
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showMenu]);

  if (!actions || actions.length === 0) return null;

  // Filter visible actions
  const visibleActions = actions.filter(a => !a.hidden);

  if (!isMobile || visibleActions.length <= maxInlineMobile) {
    // If more than 4 buttons in the action column, convert to a 2nd row on that cell
    if (visibleActions.length > maxPerRow) {
      const rows = [];
      for (let i = 0; i < visibleActions.length; i += maxPerRow) {
        rows.push(visibleActions.slice(i, i + maxPerRow));
      }

      return (
        <div
          className="smart-action-group smart-action-group-2rows"
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            gap: '4px',
            alignItems: align === 'right' ? 'flex-end' : align === 'left' ? 'flex-start' : 'center',
            ...style
          }}
        >
          {rows.map((rowActions, rIdx) => (
            <div
              key={rIdx}
              className="smart-action-row"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                justifyContent: align === 'right' ? 'flex-end' : align === 'left' ? 'flex-start' : 'center'
              }}
            >
              {rowActions.map((action, idx) => (
                <SmartIconButton
                  key={action.id || (rIdx * maxPerRow + idx)}
                  icon={action.icon}
                  label={action.label}
                  tooltip={action.tooltip}
                  onClick={action.onClick}
                  variant={action.variant || 'default'}
                  color={action.color}
                  bgColor={action.bgColor}
                  borderColor={action.borderColor}
                  disabled={action.disabled}
                  style={action.style}
                />
              ))}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div
        className="smart-action-group"
        style={{
          justifyContent: align === 'right' ? 'flex-end' : align === 'left' ? 'flex-start' : 'center',
          ...style
        }}
      >
        {visibleActions.map((action, idx) => (
          <SmartIconButton
            key={action.id || idx}
            icon={action.icon}
            label={action.label}
            tooltip={action.tooltip}
            onClick={action.onClick}
            variant={action.variant || 'default'}
            color={action.color}
            bgColor={action.bgColor}
            borderColor={action.borderColor}
            disabled={action.disabled}
            style={action.style}
          />
        ))}
      </div>
    );
  }

  // Mobile layout: split into inline primary actions and dropdown secondary actions
  const primaryActions = visibleActions.filter(a => a.isPrimary);
  const secondaryActions = visibleActions.filter(a => !a.isPrimary);

  let inlineList = [];
  let menuList = [];

  if (primaryActions.length > 0) {
    inlineList = primaryActions.slice(0, maxInlineMobile);
    menuList = [...primaryActions.slice(maxInlineMobile), ...secondaryActions];
  } else {
    inlineList = visibleActions.slice(0, maxInlineMobile - 1);
    menuList = visibleActions.slice(maxInlineMobile - 1);
  }

  return (
    <div
      className="smart-action-group"
      style={{
        justifyContent: align === 'right' ? 'flex-end' : align === 'left' ? 'flex-start' : 'center',
        position: 'relative',
        ...style
      }}
      ref={menuRef}
    >
      {/* Inline Quick Action(s) */}
      {inlineList.map((action, idx) => (
        <SmartIconButton
          key={action.id || idx}
          icon={action.icon}
          label={action.label}
          tooltip={action.tooltip}
          onClick={action.onClick}
          variant={action.variant || 'default'}
          color={action.color}
          bgColor={action.bgColor}
          borderColor={action.borderColor}
          disabled={action.disabled}
        />
      ))}

      {/* 3-Dots More Menu Trigger */}
      {menuList.length > 0 && (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            type="button"
            onClick={() => setShowMenu(prev => !prev)}
            className="smart-icon-btn"
            title="More Options"
            aria-label="More Options"
            style={{
              background: showMenu ? 'var(--bg-card-hover)' : 'var(--bg-card)',
              color: showMenu ? 'var(--primary)' : 'var(--text-secondary)'
            }}
          >
            <MoreVertical size={16} />
          </button>

          {showMenu && (
            <div className="smart-more-menu-dropdown">
              {menuList.map((action, idx) => {
                const ItemIcon = action.icon;
                const isDanger = action.variant === 'danger';
                return (
                  <button
                    key={action.id || idx}
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      if (action.onClick) action.onClick();
                    }}
                    disabled={action.disabled}
                    className={`smart-more-menu-item ${isDanger ? 'danger-item' : ''}`}
                  >
                    {ItemIcon && <ItemIcon size={16} color={action.color} />}
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SmartActionGroup;
