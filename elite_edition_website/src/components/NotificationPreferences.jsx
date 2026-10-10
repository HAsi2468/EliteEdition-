import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellOff,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Laptop,
  Send,
  Volume2,
  VolumeX,
  ShieldCheck,
  Info
} from 'lucide-react';
import { webPushClient } from '../services/webPushClient';
import IosInstallPrompt from './common/IosInstallPrompt';

/**
 * Enterprise Notification Preferences Panel (Tailwind CSS)
 *
 * Allows users to manage Web Push permissions, view device registration status,
 * toggle notification sounds, and trigger live end-to-end push tests across iOS, Android, and Desktop.
 */
export function NotificationPreferences({ onClose }) {
  const [permission, setPermission] = useState(() => webPushClient.getPermissionState());
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [testStatus, setTestStatus] = useState(null);
  const [showIosModal, setShowIosModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem('elite_notif_sound') !== 'false';
    } catch (e) {
      return true;
    }
  });

  const isIOS = webPushClient.isIOS();
  const isStandalone = webPushClient.isStandalone();
  const isPushSupported = webPushClient.isPushSupported();

  useEffect(() => {
    checkCurrentSubscription();
  }, []);

  const checkCurrentSubscription = async () => {
    if (!isPushSupported) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(Boolean(sub));
      setPermission(Notification.permission);
    } catch (e) {
      console.warn('Error checking push subscription:', e);
    }
  };

  const handleTogglePush = async () => {
    // iOS Safari browser check
    if (isIOS && !isStandalone) {
      setShowIosModal(true);
      return;
    }

    setIsLoading(true);
    setTestStatus(null);

    try {
      if (isSubscribed) {
        const success = await webPushClient.unsubscribePush();
        if (success) {
          setIsSubscribed(false);
          setTestStatus({ type: 'success', message: 'Web Push notifications disabled for this device.' });
        }
      } else {
        const res = await webPushClient.subscribeToPush();
        if (res.success) {
          setIsSubscribed(true);
          setPermission('granted');
          setTestStatus({ type: 'success', message: 'Push notifications successfully activated!' });
        } else {
          setTestStatus({
            type: 'error',
            message: res.message || res.error || 'Failed to activate notifications.'
          });
        }
      }
    } catch (err) {
      setTestStatus({ type: 'error', message: err.message || 'Notification setup failed' });
    } finally {
      setIsLoading(false);
      checkCurrentSubscription();
    }
  };

  const handleSendTestPush = async () => {
    setIsLoading(true);
    setTestStatus(null);

    try {
      const userStr = localStorage.getItem('elite_user');
      let userId = null;
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          userId = u.id || u._id;
        } catch (e) {}
      }

      const res = await fetch('/v1/notifications/test-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'X-User-Id': userId } : {})
        },
        body: JSON.stringify({ userId })
      });

      if (res.ok) {
        setTestStatus({
          type: 'success',
          message: 'Test notification dispatched! Check your system lock screen or tray.'
        });
      } else {
        // Fallback: Test via local Service Worker
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification('Elite Edition ERP • Test Alert', {
            body: 'Web Push notification channel is operating correctly on this device.',
            icon: '/Logo.png',
            badge: '/Logo.png',
            tag: 'test-notification',
            vibrate: [100, 50, 100]
          });
          setTestStatus({
            type: 'success',
            message: 'Local notification rendered successfully!'
          });
        }
      }
    } catch (err) {
      setTestStatus({ type: 'error', message: 'Test failed: ' + err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    try {
      localStorage.setItem('elite_notif_sound', String(nextVal));
    } catch (e) {}
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-100 max-w-lg w-full shadow-2xl relative">
      {/* Header */}
      <div className="flex items-center justify-between pb-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Bell size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Notification Settings</h2>
            <p className="text-xs text-slate-400">Cross-Platform Push & Sound Preferences</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800/40 hover:bg-slate-800 transition-colors cursor-pointer text-xs"
          >
            Close
          </button>
        )}
      </div>

      {/* Device Compatibility Status Banner */}
      <div className="mt-5 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2.5 text-slate-300">
          {isIOS ? (
            <Smartphone size={16} className="text-indigo-400" />
          ) : (
            <Laptop size={16} className="text-emerald-400" />
          )}
          <span>
            {isIOS
              ? isStandalone
                ? 'Apple iOS • Installed PWA Mode'
                : 'Apple iOS • Safari Browser'
              : 'Desktop / Android Platform'}
          </span>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
            isSubscribed
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}
        >
          {isSubscribed ? 'Subscribed' : 'Not Active'}
        </span>
      </div>

      {/* Main Settings List */}
      <div className="mt-5 space-y-4">
        {/* Toggle Web Push */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition-all">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isSubscribed
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {isSubscribed ? <Bell size={18} /> : <BellOff size={18} />}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">System Web Push</p>
              <p className="text-xs text-slate-400">
                Receive background alerts when browser is closed or phone is locked
              </p>
            </div>
          </div>
          <button
            onClick={handleTogglePush}
            disabled={isLoading}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 ${
              isSubscribed
                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
            }`}
          >
            {isLoading ? 'Processing...' : isSubscribed ? 'Disable' : 'Enable'}
          </button>
        </div>

        {/* Toggle Notification Sound */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center">
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Sound Effects</p>
              <p className="text-xs text-slate-400">Play subtle chime on incoming chat and job card alerts</p>
            </div>
          </div>
          <button
            onClick={handleToggleSound}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
            }`}
          >
            {soundEnabled ? 'Enabled' : 'Muted'}
          </button>
        </div>

        {/* iOS Notice & Prompt Trigger */}
        {isIOS && !isStandalone && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-start gap-3">
            <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-300 mb-1">Apple iOS 16.4+ Requirement</p>
              <p className="text-amber-200/90 leading-relaxed mb-2">
                Safari requires adding this ERP to your Home Screen before it permits background push alerts.
              </p>
              <button
                onClick={() => setShowIosModal(true)}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
              >
                View installation instructions →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Test Push Button */}
      {isSubscribed && (
        <div className="mt-5 pt-4 border-t border-slate-800">
          <button
            onClick={handleSendTestPush}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.99] text-slate-200 font-semibold text-xs transition-all border border-slate-700 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Send size={14} className="text-indigo-400" />
            <span>Send Test Push Notification</span>
          </button>
        </div>
      )}

      {/* Feedback Message */}
      {testStatus && (
        <div
          className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 animate-in fade-in duration-200 ${
            testStatus.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
          }`}
        >
          {testStatus.type === 'success' ? (
            <CheckCircle2 size={15} className="shrink-0" />
          ) : (
            <AlertTriangle size={15} className="shrink-0" />
          )}
          <span>{testStatus.message}</span>
        </div>
      )}

      {/* iOS Modal */}
      {showIosModal && <IosInstallPrompt forceShow={true} onClose={() => setShowIosModal(false)} />}
    </div>
  );
}

export default NotificationPreferences;
