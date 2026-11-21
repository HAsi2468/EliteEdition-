import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { getPendingMutations, syncPendingMutations } from '../../services/offlineSyncQueue';
import api from '../../services/api';

export default function OfflineSyncBadge() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showRecentSync, setShowRecentSync] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingMutations(api);
    };
    const handleOffline = () => setIsOnline(false);

    const updatePending = async () => {
      const items = await getPendingMutations();
      setPendingCount(items.length);
    };

    const handleSyncStatus = (e) => {
      if (e.detail?.syncing !== undefined) setIsSyncing(e.detail.syncing);
      updatePending();
    };

    const handleSynced = () => {
      setShowRecentSync(true);
      setTimeout(() => setShowRecentSync(false), 3000);
      updatePending();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('elite:offline-queue-changed', updatePending);
    window.addEventListener('elite:offline-sync-status', handleSyncStatus);
    window.addEventListener('elite:offline-synced', handleSynced);

    updatePending();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('elite:offline-queue-changed', updatePending);
      window.removeEventListener('elite:offline-sync-status', handleSyncStatus);
      window.removeEventListener('elite:offline-synced', handleSynced);
    };
  }, []);

  if (isOnline && pendingCount === 0 && !showRecentSync) {
    return null; // Keep clean when perfectly online
  }

  return (
    <div
      className="offline-sync-badge-pill"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        borderRadius: '999px',
        fontSize: '0.72rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        background: !isOnline
          ? 'rgba(239, 68, 68, 0.15)'
          : isSyncing
          ? 'rgba(59, 130, 246, 0.15)'
          : showRecentSync
          ? 'rgba(16, 185, 129, 0.15)'
          : 'rgba(245, 158, 11, 0.15)',
        border: `1px solid ${
          !isOnline
            ? '#ef4444'
            : isSyncing
            ? '#3b82f6'
            : showRecentSync
            ? '#10b981'
            : '#f59e0b'
        }`,
        color: !isOnline
          ? '#ef4444'
          : isSyncing
          ? '#3b82f6'
          : showRecentSync
          ? '#10b981'
          : '#f59e0b',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        animation: 'fadeIn 0.2s ease',
        cursor: isOnline && pendingCount > 0 ? 'pointer' : 'default'
      }}
      onClick={() => {
        if (isOnline && pendingCount > 0 && !isSyncing) {
          syncPendingMutations(api);
        }
      }}
      title={
        !isOnline
          ? `Offline Mode (${pendingCount} queued)`
          : isOnline && pendingCount > 0
          ? 'Click to sync queued actions now'
          : 'Sync status'
      }
    >
      {!isOnline ? (
        <>
          <WifiOff size={13} style={{ animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
          <span className="hidden sm:inline">Offline</span>
          {pendingCount > 0 && <span style={{ fontSize: '0.68rem', fontWeight: 700 }}>({pendingCount})</span>}
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw size={13} className="spin" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
          <span className="hidden sm:inline">Syncing</span>
          <span style={{ fontSize: '0.68rem', fontWeight: 700 }}>({pendingCount})</span>
        </>
      ) : showRecentSync ? (
        <>
          <CheckCircle2 size={13} style={{ flexShrink: 0 }} />
          <span className="hidden sm:inline">Synced</span>
        </>
      ) : (
        <>
          <Wifi size={13} style={{ flexShrink: 0 }} />
          <span className="hidden sm:inline">Queued</span>
          <span style={{ fontSize: '0.68rem', fontWeight: 700 }}>({pendingCount})</span>
        </>
      )}
    </div>
  );
}
