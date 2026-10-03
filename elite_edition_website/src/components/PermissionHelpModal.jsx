import React, { useState } from 'react';
import {
  ShieldAlert,
  Bell,
  Mic,
  Camera,
  X,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Smartphone,
  Laptop,
  Settings
} from 'lucide-react';

export default function PermissionHelpModal({ isOpen, onClose, onOpenDeviceHub }) {
  const [activePlatform, setActivePlatform] = useState(() => {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
      if (/Android/i.test(ua)) return 'android';
    }
    return 'desktop';
  });

  if (!isOpen) return null;

  const currentNotifPerm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10003,
        background: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          maxHeight: '92vh',
          background: 'var(--bg-card, #ffffff)',
          color: 'var(--text-primary, #0f172a)',
          borderRadius: '16px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.45)',
          border: '1px solid var(--border-light, #e2e8f0)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(37,99,235,0.08) 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(239,68,68,0.35)'
              }}
            >
              <ShieldAlert size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                Unblock Browser Permissions
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-muted, #64748b)' }}>
                Required for real-time incoming voice/video calls, chat & order notifications
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted, #64748b)',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Why this is required banner */}
        <div style={{ padding: '0.85rem 1.5rem', background: 'rgba(239,68,68,0.07)', borderBottom: '1px solid rgba(239,68,68,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
            <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.78rem', lineHeight: 1.45, color: 'var(--text-primary, #1e293b)' }}>
              <strong>Browser blocked or denied permission:</strong> When access is blocked, incoming calls cannot ring and your microphone cannot transmit sound. Because modern browsers prevent websites from asking repeatedly once blocked, you must allow it once in your browser settings.
            </div>
          </div>
        </div>

        {/* Platform Selector Tabs */}
        <div
          style={{
            display: 'flex',
            padding: '0.75rem 1.5rem 0',
            gap: '0.5rem',
            borderBottom: '1px solid var(--border-light, #e2e8f0)'
          }}
        >
          <button
            onClick={() => setActivePlatform('android')}
            style={{
              padding: '0.55rem 0.9rem',
              borderRadius: '8px 8px 0 0',
              border: 'none',
              background: activePlatform === 'android' ? 'var(--bg-th, #f1f5f9)' : 'transparent',
              color: activePlatform === 'android' ? '#2563eb' : 'var(--text-muted, #64748b)',
              fontWeight: 800,
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderBottom: activePlatform === 'android' ? '2px solid #2563eb' : '2px solid transparent'
            }}
          >
            <Smartphone size={15} />
            <span>Android (Chrome / Samsung)</span>
          </button>

          <button
            onClick={() => setActivePlatform('ios')}
            style={{
              padding: '0.55rem 0.9rem',
              borderRadius: '8px 8px 0 0',
              border: 'none',
              background: activePlatform === 'ios' ? 'var(--bg-th, #f1f5f9)' : 'transparent',
              color: activePlatform === 'ios' ? '#2563eb' : 'var(--text-muted, #64748b)',
              fontWeight: 800,
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderBottom: activePlatform === 'ios' ? '2px solid #2563eb' : '2px solid transparent'
            }}
          >
            <Smartphone size={15} />
            <span>iPhone / iPad (Safari & PWA)</span>
          </button>

          <button
            onClick={() => setActivePlatform('desktop')}
            style={{
              padding: '0.55rem 0.9rem',
              borderRadius: '8px 8px 0 0',
              border: 'none',
              background: activePlatform === 'desktop' ? 'var(--bg-th, #f1f5f9)' : 'transparent',
              color: activePlatform === 'desktop' ? '#2563eb' : 'var(--text-muted, #64748b)',
              fontWeight: 800,
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderBottom: activePlatform === 'desktop' ? '2px solid #2563eb' : '2px solid transparent'
            }}
          >
            <Laptop size={15} />
            <span>PC / Mac (Chrome, Edge, Brave)</span>
          </button>
        </div>

        {/* Instructions Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {activePlatform === 'android' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={stepCardStyle}>
                <div style={stepNumStyle}>1</div>
                <div>
                  <div style={stepTitleStyle}>Tap the Tune / Padlock Icon in Chrome URL Bar</div>
                  <div style={stepDescStyle}>
                    At the top of your screen next to the website address, tap the <strong>tune icon 🎛️</strong> or <strong>lock icon 🔒</strong>.
                  </div>
                </div>
              </div>

              <div style={stepCardStyle}>
                <div style={stepNumStyle}>2</div>
                <div>
                  <div style={stepTitleStyle}>Tap "Permissions"</div>
                  <div style={stepDescStyle}>
                    Tap <strong>Permissions</strong> or <strong>Site settings</strong> in the menu that slides up.
                  </div>
                </div>
              </div>

              <div style={stepCardStyle}>
                <div style={stepNumStyle}>3</div>
                <div>
                  <div style={stepTitleStyle}>Toggle "Notifications", "Microphone" & "Camera" to Allowed</div>
                  <div style={stepDescStyle}>
                    Ensure <strong>Notifications</strong> (for ringing) and <strong>Microphone</strong> (for voice calling) are switched to <strong>Allow</strong>. If blocked, tap "Reset permissions".
                  </div>
                </div>
              </div>

              <div style={stepCardStyle}>
                <div style={stepNumStyle}>4</div>
                <div>
                  <div style={stepTitleStyle}>Tap "Reload" or "Check Again" below</div>
                  <div style={stepDescStyle}>
                    Refresh the page once changed to activate calling and notifications immediately.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activePlatform === 'ios' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={stepCardStyle}>
                <div style={stepNumStyle}>1</div>
                <div>
                  <div style={stepTitleStyle}>In Safari: Tap "aA" or Site Settings</div>
                  <div style={stepDescStyle}>
                    Tap the <strong>aA</strong> button on the left of the Safari URL bar, then tap <strong>Website Settings</strong>.
                  </div>
                </div>
              </div>

              <div style={stepCardStyle}>
                <div style={stepNumStyle}>2</div>
                <div>
                  <div style={stepTitleStyle}>Set Microphone & Camera to "Allow"</div>
                  <div style={stepDescStyle}>
                    Under "Website Settings", change <strong>Microphone</strong> and <strong>Camera</strong> from "Deny" to <strong>Allow</strong>.
                  </div>
                </div>
              </div>

              <div style={stepCardStyle}>
                <div style={stepNumStyle}>3</div>
                <div>
                  <div style={stepTitleStyle}>For Notifications (Home Screen App / PWA)</div>
                  <div style={stepDescStyle}>
                    Open iPhone <strong>Settings ⚙️ &gt; Notifications &gt; Elite Edition</strong> and toggle <strong>Allow Notifications</strong> ON with Sound enabled.
                  </div>
                </div>
              </div>

              <div style={stepCardStyle}>
                <div style={stepNumStyle}>4</div>
                <div>
                  <div style={stepTitleStyle}>Reload the App</div>
                  <div style={stepDescStyle}>
                    Tap the reload button below to apply changes and enable incoming rings.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activePlatform === 'desktop' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={stepCardStyle}>
                <div style={stepNumStyle}>1</div>
                <div>
                  <div style={stepTitleStyle}>Click the Tune / Lock Icon in the Address Bar</div>
                  <div style={stepDescStyle}>
                    At the top left of Chrome, Brave, or Edge, click the <strong>tune icon 🎛️</strong> or <strong>padlock 🔒</strong> next to the URL.
                  </div>
                </div>
              </div>

              <div style={stepCardStyle}>
                <div style={stepNumStyle}>2</div>
                <div>
                  <div style={stepTitleStyle}>Switch Toggles to "Allow"</div>
                  <div style={stepDescStyle}>
                    Set <strong>Notifications</strong>, <strong>Microphone</strong>, and <strong>Camera</strong> toggles to <strong>ON / Allow</strong>.
                  </div>
                </div>
              </div>

              <div style={stepCardStyle}>
                <div style={stepNumStyle}>3</div>
                <div>
                  <div style={stepTitleStyle}>Click "Reload"</div>
                  <div style={stepDescStyle}>
                    Click the <strong>Reload</strong> button that appears in your browser or click <strong>Check &amp; Reload App</strong> below.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Current Status Pill */}
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              background: 'var(--bg-th, #f8fafc)',
              border: '1px solid var(--border-light, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
              <Bell size={16} color={currentNotifPerm === 'granted' ? '#16a34a' : '#ef4444'} />
              <span>Current Notification Status:</span>
              <strong
                style={{
                  color: currentNotifPerm === 'granted' ? '#16a34a' : currentNotifPerm === 'denied' ? '#ef4444' : '#f59e0b',
                  textTransform: 'uppercase'
                }}
              >
                {currentNotifPerm}
              </strong>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-light, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-th, #f8fafc)',
            gap: '0.75rem',
            flexWrap: 'wrap'
          }}
        >
          {onOpenDeviceHub && (
            <button
              onClick={() => {
                onClose();
                onOpenDeviceHub();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'transparent',
                border: '1px solid var(--border-light, #cbd5e1)',
                padding: '0.5rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--text-primary, #334155)',
                cursor: 'pointer'
              }}
            >
              <Settings size={15} />
              <span>Full Hardware Hub</span>
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginLeft: 'auto' }}>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted, #64748b)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '0.5rem 0.8rem'
              }}
            >
              Close
            </button>

            <button
              onClick={() => {
                sessionStorage.removeItem('elite_perm_snoozed_session');
                window.location.reload();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#fff',
                border: 'none',
                padding: '0.55rem 1.2rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37,99,235,0.35)'
              }}
            >
              <RefreshCw size={15} />
              <span>I've Allowed It, Check &amp; Reload 🔄</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const stepCardStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.85rem',
  padding: '0.75rem 0.9rem',
  borderRadius: '10px',
  background: 'var(--bg-th, #f8fafc)',
  border: '1px solid var(--border-light, #e2e8f0)'
};

const stepNumStyle = {
  width: 26,
  height: 26,
  borderRadius: '50%',
  background: '#2563eb',
  color: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.78rem',
  fontWeight: 800,
  flexShrink: 0
};

const stepTitleStyle = {
  fontSize: '0.82rem',
  fontWeight: 800,
  color: 'var(--text-primary, #0f172a)'
};

const stepDescStyle = {
  fontSize: '0.74rem',
  color: 'var(--text-muted, #64748b)',
  marginTop: '2px',
  lineHeight: 1.4
};
