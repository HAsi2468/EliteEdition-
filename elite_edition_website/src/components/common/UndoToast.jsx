import React, { useState, useEffect } from 'react';

/**
 * Minimal Undo Toast Component
 * Displays a non-blocking toast when an item is deleted, allowing user to Undo within 5 seconds.
 * Triggers `onUndo()` or executes the deferred delete `onCommit()` after timeout.
 */

let undoToastTrigger = null;

export function triggerUndoDelete({ item, label = 'Item deleted', onUndo, onCommit, duration = 5000 }) {
  if (undoToastTrigger) {
    undoToastTrigger({ item, label, onUndo, onCommit, duration });
  }
}

export function UndoToastContainer() {
  const [activeToast, setActiveToast] = useState(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    undoToastTrigger = (config) => {
      setActiveToast(config);
      setCountdown(Math.ceil((config.duration || 5000) / 1000));
    };

    return () => {
      undoToastTrigger = null;
    };
  }, []);

  useEffect(() => {
    if (!activeToast) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (activeToast.onCommit) {
            activeToast.onCommit(activeToast.item);
          }
          setActiveToast(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeToast]);

  const handleUndo = () => {
    if (activeToast && activeToast.onUndo) {
      activeToast.onUndo(activeToast.item);
    }
    setActiveToast(null);
  };

  if (!activeToast) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        borderRadius: '8px',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 100000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        fontSize: '13px'
      }}
    >
      <span>
        {activeToast.label} ({countdown}s)
      </span>
      <button
        type="button"
        onClick={handleUndo}
        style={{
          backgroundColor: '#334155',
          color: '#ffffff',
          border: 'none',
          borderRadius: '4px',
          padding: '4px 10px',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer'
        }}
      >
        Undo
      </button>
    </div>
  );
}

export default UndoToastContainer;
