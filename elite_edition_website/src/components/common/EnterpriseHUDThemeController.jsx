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
  ChevronRight
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
 * - Free 2D drag & drop positioning with window boundary clamping.
 * - Persistent dock coordinates in localStorage.
 * - Smooth pointer (mouse + touch) event handling.
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

  // Initial position from localStorage or default bottom-left
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('erp_floating_dock_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const maxX = typeof window !== 'undefined' ? Math.max(10, window.innerWidth - 300) : 1000;
          const maxY = typeof window !== 'undefined' ? Math.max(10, window.innerHeight - 60) : 800;
          return {
            x: Math.min(Math.max(10, parsed.x), maxX),
            y: Math.min(Math.max(10, parsed.y), maxY)
          };
        }
      }
    } catch (e) {}
    return {
      x: 20,
      y: typeof window !== 'undefined' ? Math.max(20, window.innerHeight - 70) : 700
    };
  });

  // Re-check window boundaries on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        const dockEl = dockRef.current;
        const width = dockEl?.offsetWidth || 280;
        const height = dockEl?.offsetHeight || 44;
        const maxX = Math.max(10, window.innerWidth - width - 10);
        const maxY = Math.max(10, window.innerHeight - height - 10);
        return {
          x: Math.min(Math.max(10, prev.x), maxX),
          y: Math.min(Math.max(10, prev.y), maxY)
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    // Only primary button
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

      const dockEl = dockRef.current;
      const width = dockEl?.offsetWidth || 280;
      const height = dockEl?.offsetHeight || 44;
      const maxX = Math.max(10, window.innerWidth - width - 10);
      const maxY = Math.max(10, window.innerHeight - height - 10);

      const nextX = Math.min(Math.max(10, dragStartRef.current.dockX + deltaX), maxX);
      const nextY = Math.min(Math.max(10, dragStartRef.current.dockY + deltaY), maxY);

      setPosition({ x: nextX, y: nextY });
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
          localStorage.setItem('erp_floating_dock_pos', JSON.stringify(current));
        } catch (e) {}
        return current;
      });
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, [position]);

  const toggleCollapsed = (e) => {
    e.stopPropagation();
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('erp_floating_dock_collapsed', String(next));
      } catch (err) {}
      return next;
    });
  };

  // Safe item click wrapper to ignore clicks that occurred during dragging
  const handleItemClick = (action) => (e) => {
    if (hasMovedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    action(e);
  };

  // Determine smart popover placement relative to dock position
  const isDockNearBottom = position.y > 340;
  const isDockNearRight = position.x > (typeof window !== 'undefined' ? window.innerWidth - 330 : 900);

  const popoverStyle = {
    ...(isDockNearBottom ? { bottom: 'calc(100% + 10px)' } : { top: 'calc(100% + 10px)' }),
    ...(isDockNearRight ? { right: 0 } : { left: 0 })
  };

  const isCommActive = activeTab === 'communication' || activeTab === 'workspace';
  const isTaskActive = activeTab === 'task_management';

  return (
    <div
      ref={dockRef}
      className={`floating-enterprise-dock ${isDragging ? 'is-dragging' : ''} ${isIndustrial ? 'is-industrial' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
      onPointerDown={onPointerDown}
      title="Click & Drag freely to position anywhere on your screen"
    >
      {/* Drag Grip Handle */}
      <div className="dock-grip-handle" title="Drag to reposition anywhere">
        <GripVertical size={14} className="dock-grip-icon" />
      </div>

      {/* Button 1: Scale & Industrial HUD Display (100% pill) */}
      <button
        type="button"
        className={`dock-action-btn dock-btn-scale ${isOpen ? 'active' : ''}`}
        onClick={handleItemClick(() => setIsOpen(o => !o))}
        title="Adjust UI Scale & Factory Floor Display Mode"
        aria-label="UI Display Controller"
      >
        <Gauge size={13} style={{ color: isIndustrial ? '#38bdf8' : '#2563eb' }} />
        <span className="dock-btn-label">{Math.round(scale * 100)}%</span>
        {isIndustrial && <span className="dock-hud-indicator">• HUD</span>}
      </button>

      {/* Divider */}
      {isAuthenticated && (hasCommunicationAccess || hasTaskAccess) && !isCollapsed && (
        <div className="dock-divider" />
      )}

      {/* Button 2: Communication / Chat */}
      {isAuthenticated && hasCommunicationAccess && !isCollapsed && (
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
          <MessageSquare size={13} style={{ color: isCommActive ? '#2563eb' : '#475569' }} />
          <span className="dock-btn-label">Chat</span>
          {chatUnreadCount > 0 && (
            <span className="dock-unread-badge">
              {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
            </span>
          )}
        </button>
      )}

      {/* Divider */}
      {isAuthenticated && hasTaskAccess && !isCollapsed && (
        <div className="dock-divider" />
      )}

      {/* Button 3: Task Management */}
      {isAuthenticated && hasTaskAccess && !isCollapsed && (
        <button
          type="button"
          className={`dock-action-btn dock-btn-task ${isTaskActive ? 'active' : ''}`}
          onClick={handleItemClick(() => {
            onNavigateTab('task_management');
          })}
          title="Task Management & Staff Workloads"
          aria-label="Tasks"
        >
          <CheckSquare size={13} style={{ color: isTaskActive ? '#10b981' : '#475569' }} />
          <span className="dock-btn-label">Tasks</span>
        </button>
      )}

      {/* Collapse / Expand Toggle Button */}
      {isAuthenticated && (hasCommunicationAccess || hasTaskAccess) && (
        <button
          type="button"
          className="dock-toggle-btn"
          onClick={toggleCollapsed}
          title={isCollapsed ? "Expand Dock" : "Minimize Dock"}
          aria-label="Toggle Dock Size"
        >
          {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      )}

      {/* Popover Panel for Display Ergonomics (smart absolute positioned) */}
      {isOpen && (
        <div
          className="hud-popover-panel dock-attached-popover"
          style={popoverStyle}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="hud-panel-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sliders size={14} style={{ color: 'var(--primary, #2563eb)' }} />
              <span>Display Ergonomics</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Scale Slider */}
          <div className="hud-scale-slider-row">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700 }}>
              <span>UI Scale Density:</span>
              <span style={{ color: 'var(--primary, #2563eb)' }}>{Math.round(scale * 100)}%</span>
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
              <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>🏭 Factory HUD Mode</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted, #64748b)' }}>Solid 2px high-visibility outlines</div>
            </div>
            <button
              type="button"
              className={`btn-secondary ${isIndustrial ? 'active' : ''}`}
              onClick={handleToggleIndustrial}
              style={{
                fontSize: '0.7rem',
                padding: '0.25rem 0.55rem',
                borderColor: isIndustrial ? '#0284c7' : undefined,
                background: isIndustrial ? 'rgba(2, 132, 199, 0.2)' : undefined,
                color: isIndustrial ? '#38bdf8' : undefined,
                fontWeight: 700,
                cursor: 'pointer'
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
                fontSize: '0.7rem',
                color: 'var(--text-muted, #64748b)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem'
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
