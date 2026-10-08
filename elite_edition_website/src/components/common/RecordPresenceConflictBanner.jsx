import React, { useState } from 'react';
import { Users, AlertTriangle, GitMerge, Check, X, ArrowRight, RefreshCw } from 'lucide-react';
import './RecordPresenceConflictBanner.css';

/**
 * RecordPresenceConflictBanner
 * 
 * Enterprise Real-Time Presence & Conflict Detection Component.
 * - Displays active operators viewing or editing this record.
 * - Detects concurrent edit conflicts and displays a non-blocking warning banner.
 * - Provides a "Compare & Merge" modal allowing side-by-side resolution.
 */
export function RecordPresenceConflictBanner({
  viewingUsers = [],
  editingUser = null,
  hasConflict = false,
  conflictDetails = null, // { remoteUser, remoteTime, localValues: {}, serverValues: {} }
  onResolveConflict = () => {},
  className = ''
}) {
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [resolvedChoices, setResolvedChoices] = useState({});

  // Initialize per-field choices when conflict is opened
  const handleOpenMerge = () => {
    if (conflictDetails) {
      const initial = {};
      const fields = Object.keys({
        ...(conflictDetails.localValues || {}),
        ...(conflictDetails.serverValues || {})
      });
      fields.forEach((f) => {
        initial[f] = 'local'; // default to operator's local change
      });
      setResolvedChoices(initial);
    }
    setIsMergeModalOpen(true);
  };

  const handleApplyMerge = () => {
    if (!conflictDetails) return;
    const mergedResult = {};
    Object.entries(resolvedChoices).forEach(([field, choice]) => {
      mergedResult[field] = choice === 'server'
        ? conflictDetails.serverValues?.[field]
        : conflictDetails.localValues?.[field];
    });

    onResolveConflict({
      action: 'merged',
      data: mergedResult
    });
    setIsMergeModalOpen(false);
  };

  const handleForceOverwrite = () => {
    onResolveConflict({
      action: 'overwrite',
      data: conflictDetails?.localValues
    });
    setIsMergeModalOpen(false);
  };

  const handleDiscardMine = () => {
    onResolveConflict({
      action: 'discard',
      data: conflictDetails?.serverValues
    });
    setIsMergeModalOpen(false);
  };

  const conflictFields = Object.keys({
    ...(conflictDetails?.localValues || {}),
    ...(conflictDetails?.serverValues || {})
  });

  return (
    <div className={`record-presence-container ${className}`}>
      {/* ── 1. Live Presence Ribbon ── */}
      <div className="record-presence-ribbon">
        <div className="record-presence-users">
          <span className={`record-presence-dot ${editingUser ? 'editing' : ''}`} />
          {editingUser ? (
            <span>
              <strong>{editingUser.name}</strong> is currently editing this record...
            </span>
          ) : (
            <span>
              {viewingUsers.length > 0 
                ? `${viewingUsers.length} operator${viewingUsers.length > 1 ? 's' : ''} viewing this record`
                : 'Live presence active'}
            </span>
          )}
        </div>

        {viewingUsers.length > 0 && (
          <div className="record-presence-avatars">
            {viewingUsers.slice(0, 5).map((u, idx) => (
              <div key={u.id || idx} className="record-presence-avatar" title={`${u.name} (${u.role || 'Operator'})`}>
                {u.initials || u.name?.slice(0, 2).toUpperCase() || 'OP'}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 2. Concurrent Edit Conflict Banner ── */}
      {hasConflict && (
        <div className="record-conflict-banner">
          <div className="record-conflict-info">
            <AlertTriangle size={20} color="#b91c1c" />
            <div>
              <h4 className="record-conflict-title">Concurrent Edit Conflict Detected</h4>
              <p className="record-conflict-desc">
                {conflictDetails?.remoteUser || 'Another operator'} committed changes to this record at{' '}
                {conflictDetails?.remoteTime || 'a moment ago'}. Your local edits have not been overwritten.
              </p>
            </div>
          </div>

          <button type="button" className="record-conflict-btn" onClick={handleOpenMerge}>
            <GitMerge size={14} />
            <span>Compare & Merge</span>
          </button>
        </div>
      )}

      {/* ── 3. Compare & Merge Diff Modal ── */}
      {isMergeModalOpen && (
        <div className="merge-modal-overlay" onClick={() => setIsMergeModalOpen(false)}>
          <div className="merge-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="merge-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GitMerge size={18} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
                  Resolve Data Conflicts
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="merge-modal-body">
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                Select which value to keep for each conflicting field, or choose to overwrite / discard entirely.
              </p>

              <table className="merge-diff-table">
                <thead>
                  <tr>
                    <th style={{ width: '140px' }}>Field</th>
                    <th>Your Local Edit</th>
                    <th>Server Version</th>
                    <th style={{ width: '160px', textAlign: 'center' }}>Keep Version</th>
                  </tr>
                </thead>
                <tbody>
                  {conflictFields.map((field) => {
                    const localVal = conflictDetails?.localValues?.[field];
                    const serverVal = conflictDetails?.serverValues?.[field];
                    const choice = resolvedChoices[field] || 'local';

                    return (
                      <tr key={field}>
                        <td>
                          <strong style={{ textTransform: 'capitalize' }}>{field}</strong>
                        </td>
                        <td style={{ color: choice === 'local' ? '#16a34a' : '#64748b' }}>
                          <span className="tabular-nums">{String(localVal ?? '—')}</span>
                        </td>
                        <td style={{ color: choice === 'server' ? '#16a34a' : '#64748b' }}>
                          <span className="tabular-nums">{String(serverVal ?? '—')}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="merge-choice-pill">
                            <button
                              type="button"
                              className={`merge-choice-btn ${choice === 'local' ? 'active' : ''}`}
                              onClick={() => setResolvedChoices((prev) => ({ ...prev, [field]: 'local' }))}
                            >
                              Mine
                            </button>
                            <button
                              type="button"
                              className={`merge-choice-btn ${choice === 'server' ? 'active' : ''}`}
                              onClick={() => setResolvedChoices((prev) => ({ ...prev, [field]: 'server' }))}
                            >
                              Server
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="merge-modal-footer">
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleDiscardMine}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  Discard My Edits
                </button>
                <button
                  type="button"
                  onClick={handleForceOverwrite}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: '1px solid #fca5a5',
                    background: '#fef2f2',
                    color: '#b91c1c',
                    cursor: 'pointer'
                  }}
                >
                  Force Overwrite Server
                </button>
              </div>

              <button
                type="button"
                onClick={handleApplyMerge}
                style={{
                  padding: '6px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  background: '#2563eb',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                Apply Merged Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecordPresenceConflictBanner;
