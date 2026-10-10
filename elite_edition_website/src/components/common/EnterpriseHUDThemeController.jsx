import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sliders,
  Gauge,
  RotateCcw,
  X,
  MessageSquare,
  CheckSquare,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Zap
} from 'lucide-react';
import './EnterpriseHUDThemeController.css';

/**
 * EnterpriseFloatingActionDock (EnterpriseHUDThemeController)
 * 
 * Houses 3 core persistent floating actions that any user can freely drag anywhere on the screen:
 * 1. UI Scale & Ergonomics / HUD Theme (100% button with Gauge icon)
 * 2. Communication / Workforce Chat (with unread badge)
 * 3. Tasks / Task Manager (with active status indicator)
 * 
 * Features:
 * - Free 2D drag & drop positioning with dynamic window boundary clamping.
 * - Auto-realigns if screen is resized or position overflows window edges.
 * - Single-button compact collapsed mode vs. full 3-button island mode.
 * - Collision-aware popover placement (smart up/down and left/right flip).
 */
export function EnterpriseHUDThemeController({
  activeTab = '',
  onNavigateTab = () => {},
  hasCommunicationAccess = true,
  hasTaskAccess = true,
  chatUnreadCount = 0,
  isAuthenticated = true
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [isIndustrial, setIsIndustrial] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('erp_floating_dock_collapsed') === 'true';
    } catch (e) {
      return false;
    }
  });

  const dockRef = useRef(null);
  const isDraggingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, dockX: 0, dockY: 0 });

  // Safe clamping helper ensuring the dock is never cut off on any screen edge
  const getClampedCoordinates = useCallback((targetX, targetY) => {
    if (typeof window === 'undefined') return { x: targetX, y: targetY };
    const dockEl = dockRef.current;
    const width = dockEl?.offsetWidth || 260;
    const height = dockEl?.offsetHeight || 44;
    const minPadding = 12;

    const maxX = Math.max(minPadding, window.innerWidth - width - minPadding);
    const maxY = Math.max(minPadding, window.innerHeight - height - minPadding);

    return {
      x: Math.min(Math.max(minPadding, targetX), maxX),
      y: Math.min(Math.max(minPadding, targetY), maxY)
    };
  }, []);

  // Initial position from localStorage or clean bottom-right
  const [position, setPosition] = useState(() => {
    if (typeof window === 'undefined') return { x: 20, y: 700 };
    try {
      const saved = localStorage.getItem('erp_floating_dock_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          // Guard against old positions that were cut off on the right
          const maxX = Math.max(12, window.innerWidth - 280);
          const maxY = Math.max(12, window.innerHeight - 56);
          return {
            x: Math.min(Math.max(12, parsed.x), maxX),
            y: Math.min(Math.max(12, parsed.y), maxY)
          };
        }
      }
    } catch (e) {}

    // Default: Clean top-right under header, with safe margin from right edge
    return {
      x: Math.max(12, window.innerWidth - 290),
      y: 68
    };
  });

  // Re-check and auto-clamp dock position on window resize or when expanded/collapsed
  useEffect(() => {
    const handleReclamp = () => {
      setPosition(prev => getClampedCoordinates(prev.x, prev.y));
    };

    // Run slightly deferred to allow DOM to measure after render/collapse
    const timer = setTimeout(handleReclamp, 40);
    window.addEventListener('resize', handleReclamp);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleReclamp);
    };
  }, [isCollapsed, getClampedCoordinates]);

  // Initialize scale and HUD theme from localStorage
  useEffect(() => {
    const savedScale = localStorage.getItem('erp_ui_scale');
    if (savedScale) {
      const parsed = parseFloat(savedScale);
      if (!isNaN(parsed) && parsed >= 0.85 && parsed <= 1.15) {
        setScale(parsed);
        document.documentElement.style.setProperty('--erp-scale', parsed);
        document.body.style.zoom = parsed;
      }
    }

    const savedTheme = localStorage.getItem('erp_hud_theme');
    if (savedTheme === 'industrial') {
      setIsIndustrial(true);
      document.documentElement.setAttribute('data-hud-theme', 'industrial');
    }
  }, []);

  const handleScaleChange = (newScale) => {
    setScale(newScale);
    localStorage.setItem('erp_ui_scale', newScale);
    document.documentElement.style.setProperty('--erp-scale', newScale);
    document.body.style.zoom = newScale;
  };

  const handleToggleIndustrial = () => {
    const next = !isIndustrial;
    setIsIndustrial(next);
    if (next) {
      localStorage.setItem('erp_hud_theme', 'industrial');
      document.documentElement.setAttribute('data-hud-theme', 'industrial');
    } else {
      localStorage.removeItem('erp_hud_theme');
      document.documentElement.removeAttribute('data-hud-theme');
    }
  };

  const handleReset = () => {
    handleScaleChange(1);
    if (isIndustrial) handleToggleIndustrial();
  };

  // Pointer drag listeners
  const onPointerDown = useCallback((e) => {
    // Only primary mouse/touch button
    if (e.button !== undefined && e.button !== 0) return;
    
    // Don't drag if target is inside popover panel
    if (e.target.closest('.hud-popover-panel')) return;

    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      dockX: position.x,
      dockY: position.y
    };

    const onPointerMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = moveEvent.clientX - dragStartRef.current.mouseX;
      const deltaY = moveEvent.clientY - dragStartRef.current.mouseY;

      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        hasMovedRef.current = true;
        setIsDragging(true);
      }

      const nextX = dragStartRef.current.dockX + deltaX;
      const nextY = dragStartRef.current.dockY + deltaY;

      setPosition(getClampedCoordinates(nextX, nextY));
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      setTimeout(() => {
        setIsDragging(false);
        hasMovedRef.current = false;
      }, 50);

      setPosition(current => {
        try {
          const clamped = getClampedCoordinates(current.x, current.y);
          localStorage.setItem('erp_floating_dock_pos', JSON.stringify(clamped));
          return clamped;
        } catch (err) {
          return current;
        }
      });
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, [position, getClampedCoordinates]);

  const toggleCollapsed = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('erp_floating_dock_collapsed', String(next));
      } catch (err) {}
      return next;
    });
  };

  // Double-click grip handle to snap back to default top-right corner
  const handleDoubleClickGrip = (e) => {
    e.stopPropagation();
    const defaultPos = getClampedCoordinates(window.innerWidth - 290, 68);
    setPosition(defaultPos);
    try {
      localStorage.setItem('erp_floating_dock_pos', JSON.stringify(defaultPos));
    } catch (err) {}
  };

  // Safe item click wrapper to ignore clicks during drag
  const handleItemClick = (action) => (e) => {
    if (hasMovedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    action(e);
  };

  // Determine smart popover placement relative to dock position
  const isDockNearBottom = position.y > (typeof window !== 'undefined' ? window.innerHeight - 340 : 340);
  const isDockNearRight = position.x > (typeof window !== 'undefined' ? window.innerWidth - 320 : 900);

  const popoverStyle = {
    ...(isDockNearBottom ? { bottom: 'calc(100% + 12px)' } : { top: 'calc(100% + 12px)' }),
    ...(isDockNearRight ? { right: 0 } : { left: 0 })
  };

  const isCommActive = activeTab === 'communication' || activeTab === 'workspace';
  const isTaskActive = activeTab === 'task_management';

  return (
    <div
      ref={dockRef}
      className={`floating-enterprise-dock ${isDragging ? 'is-dragging' : ''} ${isCollapsed ? 'is-collapsed' : ''} ${isIndustrial ? 'is-industrial' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
      onPointerDown={onPointerDown}
      title="Click & Drag freely to position anywhere on your screen. Double-click grip to reset."
    >
      {/* Drag Grip Handle */}
      <div 
        className="dock-grip-handle" 
        onDoubleClick={handleDoubleClickGrip}
        title="Drag anywhere (Double click to reset position)"
      >
        <GripVertical size={14} />
      </div>

      {/* ── COLLAPSED MODE: Single Smart Pill Button ── */}
      {isCollapsed ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            className="dock-master-orb-btn"
            onClick={toggleCollapsed}
            title="Expand Floating Action Dock"
            aria-label="Expand Dock"
          >
            <Zap size={13} style={{ color: '#38bdf8' }} />
            <span className="dock-scale-badge">{Math.round(scale * 100)}%</span>
            {chatUnreadCount > 0 && (
              <span className="dock-unread-badge">
                {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            className="dock-toggle-btn"
            onClick={toggleCollapsed}
            title="Expand to full controls"
            aria-label="Expand"
          >
            <ChevronLeft size={12} />
          </button>
        </div>
      ) : (
        /* ── EXPANDED MODE: Full 3-Action Dock ── */
        <>
          {/* Button 1: Scale & Industrial HUD Display */}
          <button
            type="button"
            className={`dock-action-btn dock-btn-scale ${isOpen ? 'active' : ''}`}
            onClick={handleItemClick(() => setIsOpen(o => !o))}
            title="Adjust UI Scale & Factory Floor Ergonomics"
            aria-label="UI Display Controller"
          >
            <Gauge size={13} style={{ color: isIndustrial ? '#38bdf8' : '#38bdf8' }} />
            <span className="dock-scale-badge">{Math.round(scale * 100)}%</span>
            {isIndustrial && <span className="dock-hud-indicator">HUD</span>}
          </button>

          {/* Divider */}
          {isAuthenticated && (hasCommunicationAccess || hasTaskAccess) && (
            <div className="dock-divider" />
          )}

          {/* Button 2: Communication / Chat */}
          {isAuthenticated && hasCommunicationAccess && (
            <button
              type="button"
              className={`dock-action-btn dock-btn-comm ${isCommActive ? 'active' : ''}`}
              onClick={handleItemClick(() => {
                onNavigateTab('communication');
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  window.dispatchEvent(new CustomEvent('elite-open-chat-list'));
                }
              })}
              title="Inter-Department Communication & Team Chat"
              aria-label="Communication"
            >
              <MessageSquare size={13} style={{ color: isCommActive ? '#60a5fa' : '#94a3b8' }} />
              <span style={{ fontWeight: 700 }}>Chat</span>
              {chatUnreadCount > 0 && (
                <span className="dock-unread-badge">
                  {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                </span>
              )}
            </button>
          )}

          {/* Divider */}
          {isAuthenticated && hasTaskAccess && (
            <div className="dock-divider" />
          )}

          {/* Button 3: Task Management */}
          {isAuthenticated && hasTaskAccess && (
            <button
              type="button"
              className={`dock-action-btn dock-btn-task ${isTaskActive ? 'active' : ''}`}
              onClick={handleItemClick(() => {
                onNavigateTab('task_management');
              })}
              title="Task Management & Staff Workloads"
              aria-label="Tasks"
            >
              <CheckSquare size={13} style={{ color: isTaskActive ? '#34d399' : '#94a3b8' }} />
              <span style={{ fontWeight: 700 }}>Tasks</span>
            </button>
          )}

          {/* Collapse to Single Button Toggle */}
          {isAuthenticated && (hasCommunicationAccess || hasTaskAccess) && (
            <button
              type="button"
              className="dock-toggle-btn"
              onClick={toggleCollapsed}
              title="Minimize to compact button"
              aria-label="Minimize Dock"
            >
              <ChevronRight size={12} />
            </button>
          )}
        </>
      )}

      {/* Popover Panel for Display Ergonomics (smart absolute positioned) */}
      {isOpen && (
        <div
          className="hud-popover-panel dock-attached-popover"
          style={popoverStyle}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="hud-panel-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Sliders size={14} style={{ color: '#38bdf8' }} />
              <span style={{ fontWeight: 800 }}>Display Ergonomics</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Scale Slider */}
          <div className="hud-scale-slider-row">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700 }}>
              <span>UI Scale Density:</span>
              <span style={{ color: '#38bdf8', fontWeight: 800 }}>{Math.round(scale * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.85"
              max="1.15"
              step="0.05"
              value={scale}
              onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
              className="hud-scale-slider"
            />
            <div className="hud-scale-labels">
              <span>85% (Dense)</span>
              <span>100% (Default)</span>
              <span>115% (Comfort)</span>
            </div>
          </div>

          {/* Industrial High Contrast Theme Toggle */}
          <div className="hud-theme-toggle-row">
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc' }}>🏭 Factory HUD Mode</div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Solid 2px high-visibility outlines</div>
            </div>
            <button
              type="button"
              className={`btn-secondary ${isIndustrial ? 'active' : ''}`}
              onClick={handleToggleIndustrial}
              style={{
                fontSize: '0.7rem',
                padding: '0.3rem 0.65rem',
                borderColor: isIndustrial ? '#38bdf8' : 'rgba(255,255,255,0.15)',
                background: isIndustrial ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.06)',
                color: isIndustrial ? '#38bdf8' : '#e2e8f0',
                fontWeight: 800,
                cursor: 'pointer',
                borderRadius: '6px'
              }}
            >
              {isIndustrial ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Reset Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.2rem' }}>
            <button
              type="button"
              onClick={handleReset}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '0.72rem',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontWeight: 600
              }}
            >
              <RotateCcw size={11} /> Reset Defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EnterpriseHUDThemeController;
