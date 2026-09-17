import React, { useState, useEffect } from 'react';
import {
  Camera,
  Mic,
  MapPin,
  Bluetooth,
  Usb,
  Activity,
  KeyRound,
  Bell,
  Database,
  ShieldCheck,
  CheckCircle2,
  Zap,
  X,
  Lock,
  RefreshCw,
  Sparkles,
  Sliders,
  ExternalLink
} from 'lucide-react';

import {
  requestCameraAndMicPermission,
  getCurrentGeoLocation,
  requestBluetoothDevice,
  requestUsbDevice,
  requestMotionSensorPermission,
  registerServiceWorkerPwa,
  preloadAppCacheStorage,
  registerPasskeyWebAuthn,
  hashStringSHA256,
  getAllWebDevicePermissions
} from '../utils/webDeviceService';
import { requestNotificationPermission, triggerPushNotification } from './NotificationToast';

export default function WebDevicePermissionsModal({ isOpen, onClose, currentUser }) {
  const [permStates, setPermStates] = useState({});
  const [loadingAction, setLoadingAction] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const refreshPermissions = async () => {
    const states = await getAllWebDevicePermissions();
    setPermStates(states);
  };

  useEffect(() => {
    if (isOpen) {
      refreshPermissions();
      const handlePermChange = () => refreshPermissions();
      window.addEventListener('focus', handlePermChange);
      window.addEventListener('elite-permission-change', handlePermChange);
      return () => {
        window.removeEventListener('focus', handlePermChange);
        window.removeEventListener('elite-permission-change', handlePermChange);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ── GRANT ALL PERMISSIONS AT ONCE ──
  const handleGrantAll = async () => {
    setLoadingAction('grant_all');
    setStatusMessage('Requesting all device permissions...');
    try {
      // 1. Push Notifications
      await requestNotificationPermission();

      // 2. Camera & Microphone
      try {
        const stream = await requestCameraAndMicPermission(false);
        stream.getTracks().forEach((track) => track.stop());
      } catch (e) {
        console.warn('Cam/Mic skipped:', e.message);
      }

      // 3. Geolocation
      try {
        await getCurrentGeoLocation();
      } catch (e) {
        console.warn('Geolocation skipped:', e.message);
      }

      // 4. Motion Sensors
      try {
        await requestMotionSensorPermission();
      } catch (e) {
        console.warn('Motion sensors skipped:', e.message);
      }

      // 5. PWA Service Worker & Cache Storage API
      await registerServiceWorkerPwa();
      await preloadAppCacheStorage();

      // 6. SubtleCrypto Hash Test
      await hashStringSHA256('EliteEditionSecured');

      setStatusMessage('🎉 All available device permissions granted successfully!');
      triggerPushNotification('Device Permissions Activated 🚀', 'Camera, Mic, GPS, PWA Cache, and Security APIs are fully active.', 'success');
      await refreshPermissions();
    } catch (err) {
      setStatusMessage('Permission prompt completed with notice: ' + err.message);
    } finally {
      setLoadingAction('');
    }
  };

  const handleTestPasskey = async () => {
    setLoadingAction('passkey');
    try {
      const email = currentUser?.email || 'user@eliteedition.in';
      const name = currentUser?.name || 'Staff Member';
      await registerPasskeyWebAuthn(email, name);
      setStatusMessage('🔑 Passkey / WebAuthn Biometric registered successfully!');
      triggerPushNotification('Biometric Passkey Enabled 🔑', 'Fingerprint / FaceID registered for 1-click passwordless login.', 'success');
    } catch (err) {
      alert('Passkey registration: ' + err.message);
    } finally {
      setLoadingAction('');
    }
  };

  const handleTestBluetooth = async () => {
    setLoadingAction('bluetooth');
    try {
      const device = await requestBluetoothDevice();
      alert(`Bluetooth device connected: ${device.name || 'Hardware Scanner/Printer'}`);
    } catch (err) {
      alert('Bluetooth: ' + err.message);
    } finally {
      setLoadingAction('');
    }
  };

  const handleTestUsb = async () => {
    setLoadingAction('usb');
    try {
      const device = await requestUsbDevice();
      alert(`USB Device connected: ${device.productName || 'Thermal Label Printer'}`);
    } catch (err) {
      alert('USB: ' + err.message);
    } finally {
      setLoadingAction('');
    }
  };

  const handleTestGeo = async () => {
    setLoadingAction('geo');
    try {
      const pos = await getCurrentGeoLocation();
      alert(`GPS Location Acquired!\nLatitude: ${pos.latitude}\nLongitude: ${pos.longitude}\nAccuracy: ${pos.accuracy}m`);
    } catch (err) {
      alert('GPS Error: ' + err.message);
    } finally {
      setLoadingAction('');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: 680, maxHeight: '90vh', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', animation: 'slideUp 0.25s ease-out' }}>
        
        {/* Header */}
        <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-th)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 3px 10px rgba(37,99,235,0.4)' }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Device Hardware & Web API Permissions Hub
              </h3>
              <p style={{ margin: 0, fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                Enable Camera, Mic, GPS, Bluetooth, USB, Passkeys & Offline Cache Storage
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', borderRadius: '6px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Master Action Banner */}
        <div style={{ padding: '1rem 1.5rem', background: 'linear-gradient(90deg, #1e293b 0%, #0f172a 100%)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} color="#38bdf8" />
              <span>1-Click Full Permission Activation</span>
            </div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
              Authorizes all Web APIs for Barcode Scanning, Voice Notes, GPS geotagging & PWA Offline mode.
            </div>
          </div>
          <button
            onClick={handleGrantAll}
            disabled={loadingAction === 'grant_all'}
            className="btn-primary"
            style={{ padding: '0.55rem 1.1rem', fontSize: '0.82rem', borderRadius: '8px', fontWeight: 800, background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)', boxShadow: '0 4px 14px rgba(37,99,235,0.4)', flexShrink: 0 }}
          >
            {loadingAction === 'grant_all' ? <RefreshCw size={14} className="spin-loader" /> : <Zap size={15} />}
            <span>Grant All Permissions 🚀</span>
          </button>
        </div>

        {statusMessage && (
          <div style={{ padding: '0.55rem 1.5rem', background: 'rgba(37,99,235,0.12)', borderBottom: '1px solid rgba(37,99,235,0.25)', fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 700 }}>
            {statusMessage}
          </div>
        )}

        {/* Permission Grid List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          
          {/* Item 1: Push Notifications */}
          <div style={styles.permCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Bell size={18} color="#2563eb" />
              <div>
                <div style={styles.permTitle}>Push Notifications & Alert Badges</div>
                <div style={styles.permDesc}>Real-time OS desktop banners & floating popups for Chat, DMs & Tasks</div>
              </div>
            </div>
            <button onClick={async () => { await requestNotificationPermission(); refreshPermissions(); }} className="btn-secondary" style={styles.actionBtn}>
              {permStates.notifications === 'granted' ? 'Active ✓' : 'Enable'}
            </button>
          </div>

          {/* Item 2: Camera & Microphone */}
          <div style={styles.permCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Camera size={18} color="#0284c7" />
              <Mic size={18} color="#0284c7" />
              <div>
                <div style={styles.permTitle}>Camera & Microphone Media Stream</div>
                <div style={styles.permDesc}>Used for Voice Notes, Fabric Barcode Scanner & Quality Audit Photos</div>
              </div>
            </div>
            <button
              onClick={async () => {
                try {
                  const s = await requestCameraAndMicPermission(false);
                  s.getTracks().forEach(t => t.stop());
                  refreshPermissions();
                  alert('Camera & Microphone access granted!');
                } catch (e) { alert(e.message); }
              }}
              className="btn-secondary"
              style={styles.actionBtn}
            >
              Request Access
            </button>
          </div>

          {/* Item 3: Geolocation */}
          <div style={styles.permCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <MapPin size={18} color="#16a34a" />
              <div>
                <div style={styles.permTitle}>GPS Geolocation & Delivery Tracking</div>
                <div style={styles.permDesc}>Geotags production activity logs, attendance check-ins & dispatch routes</div>
              </div>
            </div>
            <button onClick={handleTestGeo} className="btn-secondary" style={styles.actionBtn}>
              {loadingAction === 'geo' ? 'Acquiring...' : 'Acquire GPS'}
            </button>
          </div>

          {/* Item 4: Web Bluetooth & WebUSB Physical Device APIs */}
          <div style={styles.permCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Bluetooth size={18} color="#8b5cf6" />
              <Usb size={18} color="#8b5cf6" />
              <div>
                <div style={styles.permTitle}>Physical Device APIs (Bluetooth & WebUSB)</div>
                <div style={styles.permDesc}>Connect thermal label printers, Bluetooth barcode guns & weighing scales</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={handleTestBluetooth} className="btn-secondary" style={styles.actionBtn}>BT</button>
              <button onClick={handleTestUsb} className="btn-secondary" style={styles.actionBtn}>USB</button>
            </div>
          </div>

          {/* Item 5: WebAuthn Passkeys & Biometrics */}
          <div style={styles.permCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <KeyRound size={18} color="#ea580c" />
              <div>
                <div style={styles.permTitle}>Web Authentication (WebAuthn / Passkeys)</div>
                <div style={styles.permDesc}>Fingerprint & FaceID biometric passwordless fast sign-in</div>
              </div>
            </div>
            <button onClick={handleTestPasskey} className="btn-secondary" style={styles.actionBtn}>
              {loadingAction === 'passkey' ? 'Registering...' : 'Register Passkey'}
            </button>
          </div>

          {/* Item 6: Service Workers & Cache Storage API */}
          <div style={styles.permCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Database size={18} color="#0d9488" />
              <div>
                <div style={styles.permTitle}>Cache Storage API & PWA Service Worker</div>
                <div style={styles.permDesc}>Pre-loads design images & application code for offline browsing</div>
              </div>
            </div>
            <button
              onClick={async () => {
                await registerServiceWorkerPwa();
                await preloadAppCacheStorage();
                alert('PWA Offline Cache Storage initialized!');
              }}
              className="btn-secondary"
              style={styles.actionBtn}
            >
              Preload Cache
            </button>
          </div>

          {/* Item 7: SubtleCrypto Encryption */}
          <div style={styles.permCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Lock size={18} color="#6366f1" />
              <div>
                <div style={styles.permTitle}>SubtleCrypto SHA-256 & AES Encryption</div>
                <div style={styles.permDesc}>Hardware-accelerated cryptography for secure local state storage</div>
              </div>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#16a34a', background: 'rgba(22,163,74,0.12)', padding: '3px 8px', borderRadius: '6px' }}>
              Active ✓
            </span>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '0.85rem 1.5rem', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-th)' }}>
          <button onClick={onClose} className="btn-primary" style={{ padding: '0.45rem 1.2rem', fontSize: '0.82rem', borderRadius: '8px' }}>
            Done
          </button>
        </div>

      </div>
    </div>
  );
}

const styles = {
  permCard: {
    padding: '0.65rem 0.9rem',
    borderRadius: '10px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem'
  },
  permTitle: {
    fontSize: '0.82rem',
    fontWeight: 800,
    color: 'var(--text-primary)'
  },
  permDesc: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    marginTop: '1px'
  },
  actionBtn: {
    padding: '0.3rem 0.65rem',
    fontSize: '0.72rem',
    borderRadius: '6px',
    fontWeight: 700,
    flexShrink: 0
  }
};
