import React, { useState, useRef, useEffect, useCallback } from 'react';
import './MultiPaneCanvas.css';

/**
 * MultiPaneCanvas
 * 
 * Spatial Master-Detail Shuffler layout:
 * - 3-pane architecture: Navigator (Alt+1) | Master List (Alt+2) | Detail Canvas (Alt+3)
 * - Interactive draggable divider rails with min/max width constraints
 * - Keyboard pane hopping with visual active-ring highlights
 */
export function MultiPaneCanvas({
  navigatorTitle = 'Navigator',
  masterTitle = 'Master Records',
  detailTitle = 'Detail View',
  navigatorContent,
  masterContent,
  detailContent,
  initialNavWidth = 240,
  initialMasterWidth = 340,
  className = ''
}) {
  const [navWidth, setNavWidth] = useState(initialNavWidth);
  const [masterWidth, setMasterWidth] = useState(initialMasterWidth);
  const [activePane, setActivePane] = useState(2); // 1: Navigator, 2: Master, 3: Detail
  const [isDragging, setIsDragging] = useState(null); // 'nav' or 'master'

  const containerRef = useRef(null);
  const navRef = useRef(null);
  const masterRef = useRef(null);
  const detailRef = useRef(null);

  // Keyboard Pane Hopping (Alt + 1, Alt + 2, Alt + 3)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === '1') {
          e.preventDefault();
          setActivePane(1);
          navRef.current?.focus();
        } else if (e.key === '2') {
          e.preventDefault();
          setActivePane(2);
          masterRef.current?.focus();
        } else if (e.key === '3') {
          e.preventDefault();
          setActivePane(3);
          detailRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Draggable Divider Handlers
  const handleMouseDown = (divider) => (e) => {
    e.preventDefault();
    setIsDragging(divider);
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;

    if (isDragging === 'nav') {
      const newWidth = Math.max(160, Math.min(400, mouseX));
      setNavWidth(newWidth);
    } else if (isDragging === 'master') {
      const newWidth = Math.max(220, Math.min(600, mouseX - navWidth));
      setMasterWidth(newWidth);
    }
  }, [isDragging, navWidth]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className={`multi-pane-container ${className}`}>
      {/* Pane 1: Navigator */}
      <section
        ref={navRef}
        tabIndex={0}
        onClick={() => setActivePane(1)}
        className={`multi-pane-panel pane-navigator ${activePane === 1 ? 'is-active-pane' : ''}`}
        style={{ width: `${navWidth}px`, flexShrink: 0 }}
        aria-label="Navigation Pane"
      >
        <div className="multi-pane-header">
          <span>{navigatorTitle}</span>
          <span className="multi-pane-badge">Alt + 1</span>
        </div>
        <div className="multi-pane-body">
          {navigatorContent}
        </div>
      </section>

      {/* Divider 1 */}
      <div
        className={`multi-pane-divider ${isDragging === 'nav' ? 'is-dragging' : ''}`}
        onMouseDown={handleMouseDown('nav')}
        title="Drag to resize Navigator"
      />

      {/* Pane 2: Master List */}
      <section
        ref={masterRef}
        tabIndex={0}
        onClick={() => setActivePane(2)}
        className={`multi-pane-panel pane-master ${activePane === 2 ? 'is-active-pane' : ''}`}
        style={{ width: `${masterWidth}px`, flexShrink: 0 }}
        aria-label="Master List Pane"
      >
        <div className="multi-pane-header">
          <span>{masterTitle}</span>
          <span className="multi-pane-badge">Alt + 2</span>
        </div>
        <div className="multi-pane-body">
          {masterContent}
        </div>
      </section>

      {/* Divider 2 */}
      <div
        className={`multi-pane-divider ${isDragging === 'master' ? 'is-dragging' : ''}`}
        onMouseDown={handleMouseDown('master')}
        title="Drag to resize Master List"
      />

      {/* Pane 3: Detail Canvas */}
      <section
        ref={detailRef}
        tabIndex={0}
        onClick={() => setActivePane(3)}
        className={`multi-pane-panel pane-detail ${activePane === 3 ? 'is-active-pane' : ''}`}
        aria-label="Detail Canvas Pane"
      >
        <div className="multi-pane-header">
          <span>{detailTitle}</span>
          <span className="multi-pane-badge">Alt + 3</span>
        </div>
        <div className="multi-pane-body">
          {detailContent}
        </div>
      </section>
    </div>
  );
}

export default MultiPaneCanvas;
