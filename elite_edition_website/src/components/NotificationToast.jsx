import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X, Bell, Trash2, CheckCheck, BellRing, ExternalLink } from 'lucide-react';

export const triggerGlobalDataRefresh = (source = 'all') => {
  window.dispatchEvent(new CustomEvent('elite-data-refresh', { detail: { source, timestamp: Date.now() } }));
};

export const getNotificationHistory = () => {
  try {
    const raw = localStorage.getItem('elite_notification_history');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

export const saveNotificationHistory = (history) => {
  try {
    localStorage.setItem('elite_notification_history', JSON.stringify(history.slice(0, 100))); // Keep max 100 history items
    window.dispatchEvent(new CustomEvent('elite-notification-history-update'));
  } catch (e) {
    console.warn('Failed to save notification history', e);
  }
};

// ── Audio Chime Synthesizer (Works 100% on HTTP & HTTPS without external files) ──
const playNotificationSound = (type = 'info') => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    
    if (type === 'success') {
      // High double chime (C5 -> E5 -> G5)
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.2);
    } else if (type === 'warning' || type === 'error') {
      // Gentle warning double beep
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(349.23, now + 0.12);
    } else {
      // Soft gentle chime (E5 -> A5)
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.15);
    }

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {
    // Audio Context un-muted on user interaction
  }
};

// ── Tab Title Flasher (Bounces browser tab title when on another tab/window) ──
let titleFlashTimer = null;
let originalDocumentTitle = document.title || 'Elite Edition';

const flashBrowserTabTitle = (text) => {
  if (document.hidden) {
    if (titleFlashTimer) clearInterval(titleFlashTimer);
    let step = 0;
    titleFlashTimer = setInterval(() => {
      document.title = (step % 2 === 0) ? `🔔 ${text}` : `⚡ ${originalDocumentTitle}`;
      step++;
    }, 1000);

    const onFocus = () => {
      clearInterval(titleFlashTimer);
      document.title = originalDocumentTitle;
      window.removeEventListener('focus', onFocus);
    };
    window.addEventListener('focus', onFocus);
  }
};

export const triggerPushNotification = (title, message, type = 'info', actionTab = null) => {
  const item = {
    id: Date.now() + Math.random().toString(36).substring(2, 7),
    title,
    message: message || '',
    type,
    actionTab,
    timestamp: new Date().toISOString(),
    read: false,
  };

  // 1. Save to persistent notification history
  const history = getNotificationHistory();
  saveNotificationHistory([item, ...history]);

  // 2. Play audio sound alert (HTTP & HTTPS supported)
  playNotificationSound(type);

  // 3. Flash browser tab title if window/tab is in background
  flashBrowserTabTitle(title);

  // 4. Dispatch custom event for floating toast
  const event = new CustomEvent('elite-toast', { detail: item });
  window.dispatchEvent(event);

  // 5. Trigger native OS/Browser push notification (if HTTPS and permission granted)
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: message || '',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'elite-notification-' + item.id,
      });
    } catch (e) {
      console.warn('Native notification failed:', e);
    }
  }
};

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    alert('This browser does not support desktop notifications.');
    return 'unsupported';
  }
  if (Notification.permission === 'granted') {
    triggerPushNotification('Push Notifications Active 🔔', 'Real-time alerts active for Chat, Tasks, Job Cards, and Sales.', 'info');
    return 'granted';
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      triggerPushNotification('Notifications Enabled! 🎉', 'You will now receive real-time popups for Chat, Tasks, and Operations.', 'success');
    } else if (perm === 'denied') {
      alert('Notification permission is currently BLOCKED in your browser.\n\nTo enable notifications:\n1. Click the Lock/Settings icon 🔒 next to the website URL at the top left of your browser bar.\n2. Change "Notifications" from Block to Allow.\n3. Refresh the page.');
    }
    return perm;
  } catch (e) {
    console.error('Failed to request notification permission:', e);
    return Notification.permission;
  }
};

export default function NotificationToastContainer({ toasts, setToasts }) {
  useEffect(() => {
    const handleToastEvent = (e) => {
      const toastDetail = e.detail;
      setToasts(prev => [toastDetail, ...prev.slice(0, 4)]);

      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastDetail.id));
      }, 5000);
    };

    window.addEventListener('elite-toast', handleToastEvent);
    return () => window.removeEventListener('elite-toast', handleToastEvent);
  }, [setToasts]);

  if (!toasts || !toasts.length) return null;

  return (
    <div style={styles.container}>
      {toasts.map(toast => {
        const getIcon = () => {
          switch (toast.type) {
            case 'success': return <CheckCircle2 size={18} color="var(--success)" />;
            case 'warning': return <AlertTriangle size={18} color="var(--warning)" />;
            case 'danger': return <XCircle size={18} color="var(--danger)" />;
            default: return <Info size={18} color="var(--primary)" />;
          }
        };

        const borderColor = toast.type === 'success' ? 'var(--success)' : toast.type === 'warning' ? 'var(--warning)' : toast.type === 'danger' ? 'var(--danger)' : 'var(--primary)';

        return (
          <div key={toast.id} style={{ ...styles.toastCard, borderLeft: `4px solid ${borderColor}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
              <div style={{ marginTop: '2px', flexShrink: 0 }}>{getIcon()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.title}>{toast.title}</div>
                {toast.message && <div style={styles.message}>{toast.message}</div>}
              </div>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                style={styles.closeBtn}
                title="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
            <div className="toast-progress-bar" style={{ background: borderColor }} />
          </div>
        );
      })}
    </div>
  );
}

// ── Notification History Drawer / Modal ──────────────────────────────────────
export function NotificationHistoryDrawer({ isOpen, onClose, onSelectTab }) {
  const [history, setHistory] = useState(getNotificationHistory());
  const [permStatus, setPermStatus] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'));

  const refreshHistory = () => setHistory(getNotificationHistory());

  useEffect(() => {
    if (isOpen) refreshHistory();
    const handleUpdate = () => refreshHistory();
    window.addEventListener('elite-notification-history-update', handleUpdate);
    return () => window.removeEventListener('elite-notification-history-update', handleUpdate);
  }, [isOpen]);

  if (!isOpen) return null;

  const unreadCount = history.filter(h => !h.read).length;

  const markAllAsRead = () => {
    const updated = history.map(h => ({ ...h, read: true }));
    saveNotificationHistory(updated);
    setHistory(updated);
  };

  const clearHistory = () => {
    saveNotificationHistory([]);
    setHistory([]);
  };

  const markSingleRead = (id) => {
    const updated = history.map(h => h.id === id ? { ...h, read: true } : h);
    saveNotificationHistory(updated);
    setHistory(updated);
  };

  const handleEnablePush = async () => {
    const res = await requestNotificationPermission();
    setPermStatus(res);
  };

  const formatTime = (isoStr) => {
    if (!isoStr) return '';
    try {
      const dt = new Date(isoStr);
      const diffMs = Date.now() - dt.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHrs = Math.floor(diffMins / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', zIndex: 10001, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ width: '420px', maxWidth: '100vw', height: '100%', background: 'var(--bg-card, #161b26)', borderLeft: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 40px rgba(0,0,0,0.8)', animation: 'slideInRight 0.25s ease-out' }}>
        
        {/* Drawer Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <BellRing size={20} color="var(--primary)" />
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Notification History</h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.35rem', borderRadius: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Browser Push Permission / HTTP Notice Banner */}
        {window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? (
          <div style={{ padding: '0.75rem 1.25rem', background: 'rgba(245,158,11,0.12)', borderBottom: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Info size={18} color="#fbbf24" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.73rem', color: '#fbbf24', lineHeight: 1.3 }}>
              <strong>HTTP Mode Active:</strong> Audio Chimes 🎵, Browser Tab Flashing 🔔 & In-App Toasts work 100%! <em>(OS desktop popups require HTTPS/SSL)</em>.
            </div>
          </div>
        ) : permStatus !== 'granted' ? (
          <div style={{ padding: '0.75rem 1.25rem', background: 'rgba(56,189,248,0.12)', borderBottom: '1px solid rgba(56,189,248,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>
              Enable OS Desktop Notifications for real-time alerts.
            </div>
            <button onClick={handleEnablePush} className="btn-primary" style={{ padding: '0.25rem 0.65rem', fontSize: '0.72rem', flexShrink: 0 }}>
              Enable Push
            </button>
          </div>
        ) : null}

        {/* Toolbar */}
        <div style={{ padding: '0.65rem 1.25rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.1)' }}>
          <button onClick={markAllAsRead} disabled={unreadCount === 0} style={{ background: 'none', border: 'none', color: unreadCount > 0 ? 'var(--primary)' : 'var(--text-muted)', fontSize: '0.75rem', cursor: unreadCount > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
            <CheckCheck size={14} /> Mark all read
          </button>
          <button onClick={clearHistory} disabled={history.length === 0} style={{ background: 'none', border: 'none', color: history.length > 0 ? 'var(--danger)' : 'var(--text-muted)', fontSize: '0.75rem', cursor: history.length > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
            <Trash2 size={14} /> Clear history
          </button>
        </div>

        {/* Notification List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
          {history.length === 0 ? (
            <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Bell size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p style={{ margin: 0, fontSize: '0.88rem' }}>No notifications received yet.</p>
              <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Notifications for chat messages, tasks, and system events will appear here.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {history.map(item => {
                const getIcon = () => {
                  switch (item.type) {
                    case 'success': return <CheckCircle2 size={16} color="var(--success)" />;
                    case 'warning': return <AlertTriangle size={16} color="var(--warning)" />;
                    case 'danger': return <XCircle size={16} color="var(--danger)" />;
                    default: return <Info size={16} color="var(--primary)" />;
                  }
                };

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      markSingleRead(item.id);
                      if (item.actionTab && onSelectTab) {
                        onSelectTab(item.actionTab);
                        onClose();
                      }
                    }}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '8px',
                      background: item.read ? 'rgba(255,255,255,0.02)' : 'rgba(56,189,248,0.08)',
                      border: item.read ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(56,189,248,0.25)',
                      cursor: item.actionTab ? 'pointer' : 'default',
                      transition: 'all 0.15s ease',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                      <div style={{ marginTop: '2px', flexShrink: 0 }}>{getIcon()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: item.read ? 600 : 700, color: 'var(--text-primary)' }}>{item.title}</span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{formatTime(item.timestamp)}</span>
                        </div>
                        {item.message && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.35 }}>{item.message}</p>}
                        {item.actionTab && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: 'var(--primary)', marginTop: '0.4rem', fontWeight: 600 }}>
                            <span>Open Module</span> <ExternalLink size={10} />
                          </div>
                        )}
                      </div>
                      {!item.read && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: '5px' }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    top: '1.25rem',
    right: '1.25rem',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
    maxWidth: '360px',
    width: 'calc(100vw - 2.5rem)',
    pointerEvents: 'none',
  },
  toastCard: {
    pointerEvents: 'auto',
    background: 'var(--bg-card, rgba(22, 27, 38, 0.94))',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-md)',
    padding: '0.85rem 1rem',
    boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(56, 189, 248, 0.15)',
    animation: 'toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    position: 'relative',
    overflow: 'hidden',
  },
  title: {
    fontSize: '0.88rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    lineHeight: '1.3',
  },
  message: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    marginTop: '0.2rem',
    lineHeight: '1.35',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '2px',
    borderRadius: '4px',
    lineHeight: 1,
  }
};
