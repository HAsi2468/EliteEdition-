import React, { useState, useEffect } from 'react';
import { Share, PlusSquare, X, Smartphone, Bell, CheckCircle } from 'lucide-react';

/**
 * Apple iOS Web Push Compatibility & PWA Installation Prompt (iOS 16.4+)
 *
 * Apple WebKit strictly enforces that Web Push notifications are ONLY functional
 * when the web application is added to the user's iOS Home Screen (display: standalone).
 *
 * This component detects iOS Safari in regular browser mode and provides
 * clean, step-by-step guidance to install the PWA for background locked-screen alerts.
 */
export function IosInstallPrompt({ forceShow = false, onClose }) {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (forceShow) {
      setShowPrompt(true);
      return;
    }

    // 1. Detect Apple iOS/iPadOS device
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // 2. Detect Standalone PWA mode
    const isStandalone =
      ('standalone' in window.navigator && window.navigator.standalone === true) ||
      window.matchMedia('(display-mode: standalone)').matches;

    // 3. Check if recently dismissed (7-day snooze)
    const dismissedTime = localStorage.getItem('elite_ios_pwa_dismissed');
    const isSnoozed = dismissedTime && Date.now() - parseInt(dismissedTime, 10) < 7 * 86400000;

    if (isIOS && !isStandalone && !isSnoozed) {
      // Delay presentation slightly for optimal user onboarding
      const timer = setTimeout(() => setShowPrompt(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  const handleDismiss = () => {
    setShowPrompt(false);
    try {
      localStorage.setItem('elite_ios_pwa_dismissed', String(Date.now()));
    } catch (e) {}
    if (onClose) onClose();
  };

  if (!showPrompt) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-pwa-title"
      className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl text-slate-100 relative overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-amber-500" />

        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss installation prompt"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Bell size={24} className="animate-bounce" />
          </div>
          <div>
            <h2 id="ios-pwa-title" className="text-base font-bold text-white tracking-tight">
              Enable iOS Push Notifications
            </h2>
            <p className="text-xs text-slate-400">Apple iOS 16.4+ Requirement</p>
          </div>
        </div>

        {/* Explanatory Message */}
        <p className="text-sm text-slate-300 mb-5 leading-relaxed">
          To receive real-time notifications for chat messages and urgent job card updates while your phone is locked:
        </p>

        {/* Step-by-Step Instructions */}
        <div className="space-y-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl p-4 mb-5">
          <div className="flex items-start gap-3 text-xs text-slate-200">
            <div className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center shrink-0 font-bold">
              1
            </div>
            <div className="flex-1 pt-0.5">
              <span>Tap the </span>
              <strong className="text-white inline-flex items-center gap-1 font-semibold">
                Share button <Share size={13} className="text-indigo-400 inline" />
              </strong>
              <span> in the Safari toolbar (at the bottom or top of your screen).</span>
            </div>
          </div>

          <div className="flex items-start gap-3 text-xs text-slate-200">
            <div className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center shrink-0 font-bold">
              2
            </div>
            <div className="flex-1 pt-0.5">
              <span>Scroll down the menu and tap </span>
              <strong className="text-white inline-flex items-center gap-1 font-semibold">
                "Add to Home Screen" <PlusSquare size={13} className="text-indigo-400 inline" />
              </strong>
              <span>.</span>
            </div>
          </div>

          <div className="flex items-start gap-3 text-xs text-slate-200">
            <div className="w-6 h-6 rounded-full bg-emerald-600/30 text-emerald-300 flex items-center justify-center shrink-0 font-bold">
              3
            </div>
            <div className="flex-1 pt-0.5">
              <span>Launch </span>
              <strong className="text-white font-semibold">Elite ERP</strong>
              <span> from your Home Screen to activate Web Push alerts.</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleDismiss}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle size={15} />
            <span>Got It, I'll Add to Home Screen</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default IosInstallPrompt;
