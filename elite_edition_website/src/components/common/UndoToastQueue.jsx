import React, { useState, useEffect, useRef } from 'react';
import { Undo2, X, AlertCircle } from 'lucide-react';
import './UndoToastQueue.css';

/**
 * UndoToastQueue
 * 
 * Principal Enterprise Optimistic Action Queue.
 * Replaces disruptive blocking confirmation dialogs (window.confirm) with an optimistic
 * 6-second undo toast action bar. Supports multiple concurrent queued operations.
 */

let queueAddListener = null;

/**
 * Global dispatcher to trigger an optimistic undoable action
 * @param {object} param0
 * @param {string} param0.label - e.g. "Deleted Job Card #JC-9021"
 * @param {any} param0.item - The data object / record being deleted or modified
 * @param {Function} param0.onUndo - Callback executed if user clicks "Undo"
 * @param {Function} param0.onCommit - Callback executed when 6s expires without undo
 * @param {number} [param0.duration=6000] - Duration in ms (default 6000ms / 6s)
 */
export function queueUndoAction({
  label = 'Action performed',
  item,
  onUndo = () => {},
  onCommit = () => {},
  duration = 6000
}) {
  if (queueAddListener) {
    queueAddListener({
      id: `undo_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      label,
      item,
      onUndo,
      onCommit,
      duration,
      createdAt: Date.now(),
      remainingMs: duration
    });
  }
}

// Backward-compatible alias for existing callers
export const triggerUndoDelete = queueUndoAction;

export function UndoToastQueueContainer() {
  const [toasts, setToasts] = useState([]);
  const toastsRef = useRef(toasts);
  toastsRef.current = toasts;

  // Register listener for new queued toasts
  useEffect(() => {
    queueAddListener = (newToast) => {
      setToasts((prev) => [...prev, newToast]);
    };

    return () => {
      queueAddListener = null;
    };
  }, []);

  // Timer ticker loop updating remainingMs every 100ms
  useEffect(() => {
    if (toasts.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const updated = [];

      toastsRef.current.forEach((t) => {
        const elapsed = now - t.createdAt;
        const remaining = Math.max(0, t.duration - elapsed);

        if (remaining <= 0) {
          // Timeout reached: execute commit callback
          try {
            t.onCommit?.(t.item);
          } catch (err) {
            console.error('Error committing action after undo timeout:', err);
          }
        } else {
          updated.push({
            ...t,
            remainingMs: remaining
          });
        }
      });

      setToasts(updated);
    }, 100);

    return () => clearInterval(interval);
  }, [toasts.length]);

  const handleUndo = (toastId) => {
    const target = toasts.find((t) => t.id === toastId);
    if (target) {
      try {
        target.onUndo?.(target.item);
      } catch (err) {
        console.error('Error in onUndo callback:', err);
      }
    }
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  };

  const handleDismiss = (toastId) => {
    const target = toasts.find((t) => t.id === toastId);
    if (target) {
      try {
        target.onCommit?.(target.item);
      } catch (err) {
        console.error('Error committing action on dismiss:', err);
      }
    }
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="undo-toast-stack" role="region" aria-label="Undoable actions queue">
      {toasts.map((toast) => {
        const progressPercent = (toast.remainingMs / toast.duration) * 100;
        const secondsLeft = Math.ceil(toast.remainingMs / 1000);

        return (
          <div key={toast.id} className="undo-toast-card">
            <div className="undo-toast-content">
              <span className="undo-toast-label">{toast.label}</span>
              <span className="undo-toast-countdown tabular-nums">({secondsLeft}s)</span>
            </div>

            <div className="undo-toast-actions">
              <button
                type="button"
                className="undo-btn-trigger"
                onClick={() => handleUndo(toast.id)}
              >
                Undo
              </button>

              <button
                type="button"
                className="undo-btn-dismiss"
                onClick={() => handleDismiss(toast.id)}
                title="Dismiss and commit immediately"
                aria-label="Dismiss and commit"
              >
                <X size={15} />
              </button>
            </div>

            {/* Linear Progress Countdown Bar */}
            <div
              className="undo-toast-progressbar"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default UndoToastQueueContainer;
