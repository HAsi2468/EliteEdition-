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
  Zap,
  Scale
} from 'lucide-react';
import './EnterpriseHUDThemeController.css';
import ErgonomicsPopover from './ErgonomicsPopover';

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
  isAuthenticated = true,
  isDocked = false
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
          // If stored in old dangerous top-right position covering header controls, move to bottom right
          if (parsed.y < 120 && parsed.x > window.innerWidth - 450) {
            return {
              x: Math.max(12, window.innerWidth - 300),
              y: Math.max(12, window.innerHeight - 80)
            };
          }
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

    // Default: Clean bottom-right with safe margin from edges
    return {
      x: Math.max(12, window.innerWidth - 300),
      y: Math.max(12, window.innerHeight - 80)
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

  // Helper to cleanly apply UI scale to document root without breaking body margins or window scrolling
  const applyScale = useCallback((targetScale) => {
    if (typeof document === 'undefined') return;

    // 1. Clear any legacy zoom on body that caused horizontal blank voids & jittery scroller
    document.body.style.zoom = '';

    // 2. Set CSS custom property for fluid font & padding scaling
    document.documentElement.style.setProperty('--erp-scale', String(targetScale));

    // 3. Apply root zoom to documentElement smoothly
    if (Math.abs(targetScale - 1) < 0.005) {
      document.documentElement.style.zoom = '';
      document.documentElement.classList.remove('erp-scaled-dense', 'erp-scaled-comfort');
    } else {
      document.documentElement.style.zoom = String(targetScale);
      if (targetScale < 1) {
        document.documentElement.classList.add('erp-scaled-dense');
        document.documentElement.classList.remove('erp-scaled-comfort');
      } else {
        document.documentElement.classList.add('erp-scaled-comfort');
        document.documentElement.classList.remove('erp-scaled-dense');
      }
    }
  }, []);

  // Initialize scale and HUD theme from localStorage
  useEffect(() => {
    document.body.style.zoom = '';
    const savedScale = localStorage.getItem('erp_ui_scale');
    if (savedScale) {
      const parsed = parseFloat(savedScale);
      if (!isNaN(parsed) && parsed >= 0.85 && parsed <= 1.15) {
        setScale(parsed);
        applyScale(parsed);
      } else {
        applyScale(1);
      }
    } else {
      applyScale(1);
    }

    const savedTheme = localStorage.getItem('erp_hud_theme');
    if (savedTheme === 'industrial') {
      setIsIndustrial(true);
      document.documentElement.setAttribute('data-hud-theme', 'industrial');
    }

    return () => {
      document.body.style.zoom = '';
    };
  }, [applyScale]);

  const rafRef = useRef(null);

  const handleScaleChange = (newScale) => {
    const clamped = Math.min(1.15, Math.max(0.85, Math.round(newScale * 100) / 100));
    setScale(clamped);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      applyScale(clamped);
      try {
        localStorage.setItem('erp_ui_scale', String(clamped));
      } catch (e) {}
    });
  };

  const handlePresetSelect = (presetVal) => {
    handleScaleChange(presetVal);
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

    // Check if target is a clickable button/icon
    const isInteractiveBtn = Boolean(e.target.closest('button, .dock-action-btn, .dock-circle-fab-btn, .dock-btn-collapse'));

    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      dockX: position.x,
      dockY: position.y
    };

    const isTouch = e.pointerType === 'touch' || (typeof window !== 'undefined' && window.innerWidth < 768);
    // On touch screens, finger taps have 10-18px wobble. Don't treat taps as drags.
    const dragThreshold = isTouch ? (isInteractiveBtn ? 22 : 12) : (isInteractiveBtn ? 10 : 5);

    const onPointerMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = moveEvent.clientX - dragStartRef.current.mouseX;
      const deltaY = moveEvent.clientY - dragStartRef.current.mouseY;

      if (Math.abs(deltaX) > dragThreshold || Math.abs(deltaY) > dragThreshold) {
        hasMovedRef.current = true;
        setIsDragging(true);
      }

      if (hasMovedRef.current) {
        const nextX = dragStartRef.current.dockX + deltaX;
        const nextY = dragStartRef.current.dockY + deltaY;
        setPosition(getClampedCoordinates(nextX, nextY));
      }
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

  const isCommActive = activeTab === 'communication' || activeTab === 'workspace';
  const isTaskActive = activeTab === 'task_management';
  const isReconcileActive = activeTab === 'reconciliation' || activeTab === 'ledger-reconciliation';

  // Completely suppress the floating dock on mobile screens and inside the communication / chat workspace
  const [isMobileScreen, setIsMobileScreen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Floating dock / circular lightning button removed across all devices
  return null;
}

export default EnterpriseHUDThemeController;
