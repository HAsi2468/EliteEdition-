import React, { useState } from 'react';
import { executeConfirmedAction } from './streamService';

/**
 * ConfirmationCardWidget
 * ─────────────────────────────────────────────────────────────────────────────
 * Rendered when the AI returns `requiresConfirmation: true` from
 * request_action_confirmation. Shows the impact summary and expiry timer,
 * then lets the user confirm or reject the action.
 *
 * Props:
 *   data       — tool result: { ticketId, actionType, impactSummary, expiresIn }
 *   onAction   — (actionType, payload) => void
 */
export function ConfirmationCardWidget({ data, onAction }) {
  const [status, setStatus] = useState('idle'); // idle | loading | confirmed | rejected | error
  const [errorMsg, setErrorMsg] = useState('');

  const handleConfirm = async () => {
    if (status !== 'idle') return;
    setStatus('loading');
    try {
      await executeConfirmedAction(data.ticketId);
      setStatus('confirmed');
      if (onAction) onAction('hitl_confirmed', { ticketId: data.ticketId, actionType: data.actionType });
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Confirmation failed.');
    }
  };

  const handleReject = () => {
    setStatus('rejected');
    if (onAction) onAction('hitl_rejected', { ticketId: data.ticketId });
  };

  const actionLabel = (data.actionType || 'Action').replace(/_/g, ' ');

  return (
    <div style={{
      margin: '10px 0',
      maxWidth: '440px',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 4px 16px rgba(239,68,68,0.18)',
      border: '1.5px solid #fca5a5',
      fontFamily: "'Inter', system-ui, sans-serif"
    }}>
      {/* Header bar */}
      <div style={{
        background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span style={{ fontSize: '1rem' }}>⚠️</span>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.84rem', lineHeight: 1.2 }}>
            High-Impact Action Confirmation
          </div>
          <div style={{ color: '#fecaca', fontSize: '0.72rem' }}>
            {actionLabel} · Expires in {data.expiresIn || '5 minutes'}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ background: '#fef2f2', padding: '12px 14px' }}>
        <p style={{ margin: '0 0 10px', fontSize: '0.83rem', color: '#7f1d1d', lineHeight: 1.5 }}>
          <strong>Impact:</strong> {data.impactSummary}
        </p>

        {/* Status feedback */}
        {status === 'confirmed' && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px',
            padding: '8px 12px', color: '#15803d', fontSize: '0.8rem', fontWeight: 600
          }}>
            ✅ Action confirmed and executed successfully.
          </div>
        )}

        {status === 'rejected' && (
          <div style={{
            background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px',
            padding: '8px 12px', color: '#64748b', fontSize: '0.8rem', fontWeight: 600
          }}>
            🚫 Action cancelled — no changes were made.
          </div>
        )}

        {status === 'error' && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px',
            padding: '8px 12px', color: '#b91c1c', fontSize: '0.8rem'
          }}>
            ❌ Error: {errorMsg}
          </div>
        )}

        {/* Action buttons */}
        {status === 'idle' && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button
              onClick={handleReject}
              style={{
                flex: 1, padding: '8px 0', background: '#fff', border: '1.5px solid #e2e8f0',
                borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                color: '#475569', transition: 'all 0.15s ease'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              style={{
                flex: 2, padding: '8px 0',
                background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                border: 'none', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700,
                cursor: 'pointer', color: '#fff', letterSpacing: '0.01em',
                boxShadow: '0 2px 8px rgba(239,68,68,0.35)', transition: 'all 0.15s ease'
              }}
            >
              Confirm {actionLabel}
            </button>
          </div>
        )}

        {status === 'loading' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '0.8rem', color: '#64748b', padding: '4px 0'
          }}>
            <span style={{
              width: '14px', height: '14px', border: '2px solid #ef4444',
              borderTopColor: 'transparent', borderRadius: '50%',
              display: 'inline-block', animation: 'spin 0.7s linear infinite'
            }} />
            Executing action…
          </div>
        )}
      </div>

      {/* Ticket ref */}
      <div style={{
        background: '#fef2f2', borderTop: '1px solid #fecaca',
        padding: '5px 14px', display: 'flex', justifyContent: 'flex-end'
      }}>
        <span style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: 600, fontFamily: 'monospace' }}>
          TKT-{String(data.ticketId || '').slice(-8).toUpperCase()}
        </span>
      </div>
    </div>
  );
}

export default ConfirmationCardWidget;
