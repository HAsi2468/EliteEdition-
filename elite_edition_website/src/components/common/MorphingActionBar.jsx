import React, { useState, useEffect, useRef } from 'react';
import './MorphingActionBar.css';

/**
 * MorphingActionBar
 * 
 * Sticky header toolbar that transitions smoothly into a compact glassmorphic
 * floating pill (`backdrop-blur-md`) when the user scrolls down, collapsing
 * secondary button labels into clean icon-only buttons with tooltips.
 */
export function MorphingActionBar({
  title,
  subtitle,
  badgeText,
  icon: Icon,
  actions = [], // Array of { id, label, icon: IconComponent, primary, onClick, disabled, title }
  scrollThreshold = 90,
  className = ''
}) {
  const [isFloating, setIsFloating] = useState(false);
  const triggerRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      if (scrollY > scrollThreshold) {
        setIsFloating(true);
      } else {
        setIsFloating(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [scrollThreshold]);

  return (
    <>
      {/* Invisible anchor element to reserve layout space when floating */}
      <div ref={triggerRef} style={{ height: isFloating ? '54px' : '0px', transition: 'height 200ms ease' }} />

      <div className={`morphing-action-bar-wrapper ${isFloating ? 'is-floating' : ''} ${className}`}>
        <div className="morphing-action-bar" role="toolbar" aria-label="Action Toolbar">
          <div className="morphing-bar-lead">
            {Icon && <Icon size={18} style={{ color: isFloating ? '#38bdf8' : 'var(--primary)' }} />}
            <div>
              <span className="morphing-bar-title">{title}</span>
              {!isFloating && subtitle && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 400 }}>
                  {subtitle}
                </span>
              )}
            </div>
            {badgeText && <span className="morphing-bar-badge">{badgeText}</span>}
          </div>

          <div className="morphing-bar-actions">
            {actions.map((act) => {
              const ActionIcon = act.icon;
              return (
                <button
                  key={act.id}
                  type="button"
                  id={`action-btn-${act.id}`}
                  onClick={act.onClick}
                  disabled={act.disabled}
                  title={act.title || act.label}
                  className={`morphing-action-btn ${act.primary ? 'primary' : 'secondary'} ${!act.primary ? 'collapsible' : ''}`}
                >
                  {ActionIcon && <ActionIcon size={15} />}
                  <span className="btn-text-label">{act.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

export default MorphingActionBar;
