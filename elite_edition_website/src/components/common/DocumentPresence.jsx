import React, { useEffect, useState } from 'react';
import { Users, Eye, Edit3, AlertTriangle } from 'lucide-react';

/**
 * Real-time Collaborative Presence Bar
 * Shows who is currently viewing or editing the active record
 */
export default function DocumentPresence({ socket, docType, docId, currentUser, isEditing = false }) {
  const [viewers, setViewers] = useState([]);

  useEffect(() => {
    if (!socket || !docType || !docId) return;

    // Join document presence room
    socket.emit('document:join', {
      docType,
      docId: String(docId),
      action: isEditing ? 'editing' : 'viewing'
    });

    const handlePresenceUpdate = (data) => {
      if (data && data.docType === docType && String(data.docId) === String(docId)) {
        setViewers(Array.isArray(data.viewers) ? data.viewers : []);
      }
    };

    socket.on('document:presence_update', handlePresenceUpdate);

    return () => {
      socket.emit('document:leave', { docType, docId: String(docId) });
      socket.off('document:presence_update', handlePresenceUpdate);
    };
  }, [socket, docType, docId]);

  // Update editing state dynamically
  useEffect(() => {
    if (!socket || !docType || !docId) return;
    socket.emit('document:action', {
      docType,
      docId: String(docId),
      action: isEditing ? 'editing' : 'viewing'
    });
  }, [socket, docType, docId, isEditing]);

  const currentUserId = String(currentUser?._id || currentUser?.id || '');
  const otherViewers = viewers.filter((v) => String(v.id) !== currentUserId);
  const otherEditor = otherViewers.find((v) => v.action === 'editing');

  if (otherViewers.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '4px 0 10px 0' }}>
      {/* Collision Alert if someone else is editing */}
      {otherEditor && isEditing && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(234, 88, 12, 0.12)',
            border: '1px solid rgba(234, 88, 12, 0.35)',
            color: '#ea580c',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '0.78rem',
            fontWeight: 600,
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <AlertTriangle size={15} color="#ea580c" />
          <span>
            <strong>{otherEditor.name || 'Another staff member'}</strong> is also editing this record. Be mindful of concurrent changes.
          </span>
        </div>
      )}

      {/* Live Presence Avatar Pills */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 8px',
          background: 'var(--bg-card, rgba(255,255,255,0.04))',
          borderRadius: '999px',
          border: '1px solid var(--border-light, rgba(255,255,255,0.1))',
          width: 'fit-content',
          fontSize: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted, #94a3b8)', fontWeight: 600 }}>
          <Users size={13} />
          <span>Viewing now:</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {otherViewers.map((viewer) => {
            const isViewerEditing = viewer.action === 'editing';
            const initials = (viewer.name || 'Staff')
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <div
                key={viewer.id}
                title={`${viewer.name || 'Staff'} (${isViewerEditing ? 'Editing now' : 'Viewing'})`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: isViewerEditing ? 'rgba(234, 88, 12, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  border: `1px solid ${isViewerEditing ? '#ea580c' : '#3b82f6'}`,
                  borderRadius: '999px',
                  padding: '2px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: isViewerEditing ? '#ea580c' : '#3b82f6',
                  transition: 'all 0.2s ease'
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: isViewerEditing ? '#ea580c' : '#3b82f6',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.58rem',
                    fontWeight: 700
                  }}
                >
                  {initials}
                </div>
                <span>{viewer.name?.split(' ')[0] || 'Staff'}</span>
                {isViewerEditing ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#ea580c' }}>
                    <Edit3 size={10} />
                    <span style={{ fontSize: '0.65rem' }}>Editing</span>
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', opacity: 0.8 }}>
                    <Eye size={10} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
