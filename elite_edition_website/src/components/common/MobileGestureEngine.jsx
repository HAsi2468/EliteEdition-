import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import soundEffects from '../../services/soundEffects';

/**
 * Global Mobile Gesture Engine for Elite Edition ERP
 * Provides native iOS/Android feel with strict touch-conflict isolation:
 *  #1  Pull-to-Refresh (Global, damped 3D glass spinner pill)
 *  #2  Drag Down to Dismiss Bottom Sheets (.company-quick-sheet-panel, [data-swipe-dismiss="down"])
 *  #3  Swipe-Left to Close Mobile Navigation Drawer (.mobile-drawer-content)
 *  #4  Double-Tap Top Header -> Smooth Scroll to Top
 *  #5  Pinch-to-Zoom & Double-Tap Zoom (1x <-> 2.5x) on Lightbox / Viewer Images
 *  #6  Swipe Down to Close Lightbox Image Viewer when at 1x zoom
 *  #9  Long-Press Company Pill -> Instant Company Switcher
 *  #10 Two-Finger Tap Anywhere -> Instant Global Spotlight Search
 */
export default function MobileGestureEngine({
  onRefresh,
  onCloseDrawer,
  onCloseSheets,
  onOpenCompanySheet,
  onOpenSpotlight
}) {
  const [pullDist, setPullDist] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const callbacksRef = useRef({
    onRefresh,
    onCloseDrawer,
    onCloseSheets,
    onOpenCompanySheet,
    onOpenSpotlight
  });
  callbacksRef.current = {
    onRefresh,
    onCloseDrawer,
    onCloseSheets,
    onOpenCompanySheet,
    onOpenSpotlight
  };

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const isTouchViewport = () =>
      window.innerWidth <= 1024 ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;

    // ── Shared gesture state refs ──
    const ptr = { active: false, startY: 0, startX: 0, dist: 0, triggered: false };
    const drawer = { active: false, el: null, startX: 0, startY: 0, dx: 0, axis: null };
    const sheet = { active: false, el: null, startY: 0, startX: 0, dy: 0, axis: null };
    const twoFinger = { active: false, startTime: 0, p1: null, p2: null, moved: false };
    const pinch = { active: false, img: null, startDist: 0, startScale: 1, currentScale: 1 };
    const imgSwipeDown = { active: false, img: null, startY: 0, dy: 0 };
    let lastHeaderTap = 0;
    let lastImgTap = 0;
    let companyHoldTimer = null;

    const getScrollTop = (el) => {
      let node = el;
      while (node && node !== document.body && node !== document.documentElement) {
        const style = window.getComputedStyle(node);
        const overflowY = style.overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 2) {
          if (node.scrollTop > 2) return node.scrollTop;
        }
        node = node.parentElement;
      }
      return window.scrollY || document.documentElement.scrollTop || 0;
    };

    const findLightboxImage = (target) => {
      if (!target || target.tagName !== 'IMG') return null;
      if (target.dataset?.lightboxImg === 'true' || target.classList?.contains('attachment-viewer-img')) {
        return target;
      }
      // Also detect full-screen fixed modal overlays containing an image
      let node = target.parentElement;
      for (let i = 0; i < 6 && node; i++) {
        const st = window.getComputedStyle(node);
        if (st.position === 'fixed' && parseInt(st.zIndex || '0', 10) >= 9000) {
          return target;
        }
        node = node.parentElement;
      }
      return null;
    };

    const getTouchDistance = (t1, t2) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.hypot(dx, dy);
    };

    const clearCompanyHold = () => {
      if (companyHoldTimer) {
        clearTimeout(companyHoldTimer);
        companyHoldTimer = null;
      }
    };

    const onTouchStart = (e) => {
      if (!isTouchViewport()) return;

      // #10 Two-finger tap detection + #5 Pinch-to-Zoom on lightbox image
      if (e.touches.length === 2) {
        clearCompanyHold();
        ptr.active = false;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const lbImg = findLightboxImage(e.target);
        if (lbImg) {
          pinch.active = true;
          pinch.img = lbImg;
          pinch.startDist = getTouchDistance(t1, t2) || 1;
          pinch.startScale = Number(lbImg.dataset.gestureScale || 1);
          pinch.currentScale = pinch.startScale;
          twoFinger.active = false;
          return;
        }
        twoFinger.active = true;
        twoFinger.startTime = Date.now();
        twoFinger.p1 = { x: t1.clientX, y: t1.clientY };
        twoFinger.p2 = { x: t2.clientX, y: t2.clientY };
        twoFinger.moved = false;
        return;
      }

      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const target = e.target;

      // #9 Long-Press on Company Pill -> Instant Company Switcher
      if (target?.closest?.('.mobile-company-pill')) {
        clearCompanyHold();
        companyHoldTimer = setTimeout(() => {
          companyHoldTimer = null;
          try { navigator.vibrate?.(16); } catch (_) {}
          soundEffects.playGlassWhoosh?.();
          callbacksRef.current.onOpenCompanySheet?.();
        }, 420);
      }

      // #4 Double-Tap Top Header -> Smooth Scroll to Top
      const headerEl = target?.closest?.('.mobile-header, .top-header');
      if (headerEl && !target.closest('button, a, input, select, textarea')) {
        const now = Date.now();
        if (now - lastHeaderTap < 320) {
          lastHeaderTap = 0;
          try { navigator.vibrate?.(10); } catch (_) {}
          soundEffects.playScrollTick?.();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          document.querySelectorAll('.main-content, .workspace-container, .page-scroll-body').forEach((el) => {
            try { el.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) {}
          });
        } else {
          lastHeaderTap = now;
        }
      }

      // #5 Double-Tap Zoom (1x <-> 2.5x) & #6 Swipe-Down to Close on Lightbox Image
      const lbImg = findLightboxImage(target);
      if (lbImg) {
        const now = Date.now();
        if (now - lastImgTap < 300) {
          lastImgTap = 0;
          const prevScale = Number(lbImg.dataset.gestureScale || 1);
          const nextScale = prevScale > 1.2 ? 1 : 2.4;
          lbImg.dataset.gestureScale = String(nextScale);
          lbImg.style.transition = 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)';
          lbImg.style.transform = `scale(${nextScale})`;
          soundEffects.playScrollTick?.();
          try { navigator.vibrate?.(10); } catch (_) {}
          return;
        }
        lastImgTap = now;
        if (Number(lbImg.dataset.gestureScale || 1) <= 1.05) {
          imgSwipeDown.active = true;
          imgSwipeDown.img = lbImg;
          imgSwipeDown.startY = t.clientY;
          imgSwipeDown.dy = 0;
        }
        return;
      }

      // #3 Swipe-Left to Close Mobile Navigation Drawer
      const drawerEl = target?.closest?.('.mobile-drawer-content');
      if (drawerEl) {
        drawer.active = true;
        drawer.el = drawerEl;
        drawer.startX = t.clientX;
        drawer.startY = t.clientY;
        drawer.dx = 0;
        drawer.axis = null;
        return;
      }

      // #2 Drag Down to Dismiss Bottom Sheets
      const sheetEl = target?.closest?.('.company-quick-sheet-panel, .mobile-bottom-sheet, [data-swipe-dismiss="down"]');
      if (sheetEl && sheetEl.scrollTop <= 2) {
        sheet.active = true;
        sheet.el = sheetEl;
        sheet.startY = t.clientY;
        sheet.startX = t.clientX;
        sheet.dy = 0;
        sheet.axis = null;
        return;
      }

      // #1 Pull-to-Refresh (only when scrolled to very top & not inside chat, modal, or form input)
      const inBlockedZone = Boolean(
        target?.closest?.('.phoenix-messages-area, .phoenix-chat-container, .modal-content, [role="dialog"], input, textarea, select')
      );
      if (!inBlockedZone && getScrollTop(target) <= 2) {
        ptr.active = true;
        ptr.startY = t.clientY;
        ptr.startX = t.clientX;
        ptr.dist = 0;
        ptr.triggered = false;
      }
    };

    const onTouchMove = (e) => {
      clearCompanyHold();

      // #5 Pinch-to-Zoom update
      if (pinch.active && e.touches.length === 2 && pinch.img) {
        const dist = getTouchDistance(e.touches[0], e.touches[1]);
        const nextScale = Math.max(1, Math.min(4, pinch.startScale * (dist / pinch.startDist)));
        pinch.currentScale = nextScale;
        pinch.img.style.transition = 'none';
        pinch.img.style.transform = `scale(${nextScale.toFixed(3)})`;
        return;
      }

      // #10 Two-finger drift check
      if (twoFinger.active && e.touches.length === 2) {
        const d1 = Math.hypot(e.touches[0].clientX - twoFinger.p1.x, e.touches[0].clientY - twoFinger.p1.y);
        const d2 = Math.hypot(e.touches[1].clientX - twoFinger.p2.x, e.touches[1].clientY - twoFinger.p2.y);
        if (d1 > 18 || d2 > 18) twoFinger.moved = true;
        return;
      }

      if (e.touches.length !== 1) return;
      const t = e.touches[0];

      // #6 Swipe Down to Close Lightbox Image
      if (imgSwipeDown.active && imgSwipeDown.img) {
        const dy = t.clientY - imgSwipeDown.startY;
        if (dy > 10) {
          imgSwipeDown.dy = dy;
          imgSwipeDown.img.style.transition = 'none';
          imgSwipeDown.img.style.transform = `translateY(${Math.min(140, dy * 0.7)}px) scale(${Math.max(0.84, 1 - dy / 700)})`;
        }
        return;
      }

      // #3 Swipe-Left to Close Drawer
      if (drawer.active && drawer.el) {
        const dx = t.clientX - drawer.startX;
        const dy = t.clientY - drawer.startY;
        if (!drawer.axis && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
          drawer.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
        }
        if (drawer.axis === 'x' && dx < 0) {
          drawer.dx = dx;
          drawer.el.style.transition = 'none';
          drawer.el.style.transform = `translateX(${Math.max(-280, dx)}px)`;
        }
        return;
      }

      // #2 Drag Down to Dismiss Sheet
      if (sheet.active && sheet.el) {
        const dy = t.clientY - sheet.startY;
        const dx = t.clientX - sheet.startX;
        if (!sheet.axis && (Math.abs(dy) > 10 || Math.abs(dx) > 10)) {
          sheet.axis = Math.abs(dy) > Math.abs(dx) * 1.2 ? 'y' : 'x';
        }
        if (sheet.axis === 'y' && dy > 0 && sheet.el.scrollTop <= 2) {
          sheet.dy = dy;
          sheet.el.style.transition = 'none';
          sheet.el.style.transform = `translateY(${Math.min(260, dy * 0.78)}px)`;
        }
        return;
      }

      // #1 Pull-to-Refresh tracking
      if (ptr.active) {
        const dy = t.clientY - ptr.startY;
        const dx = t.clientX - ptr.startX;
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy) * 1.1) {
          ptr.active = false;
          setPullDist(0);
          return;
        }
        const damped = Math.min(92, Math.round(dy * 0.45));
        ptr.dist = damped;
        setPullDist(damped);
        if (damped >= 68 && !ptr.triggered) {
          ptr.triggered = true;
          try { navigator.vibrate?.(12); } catch (_) {}
        }
      }
    };

    const onTouchEnd = () => {
      clearCompanyHold();

      // #5 Finish Pinch-to-Zoom
      if (pinch.active && pinch.img) {
        pinch.img.dataset.gestureScale = String(pinch.currentScale < 1.08 ? 1 : pinch.currentScale);
        if (pinch.currentScale < 1.08) {
          pinch.img.style.transition = 'transform 0.2s ease';
          pinch.img.style.transform = 'scale(1)';
        }
        pinch.active = false;
        pinch.img = null;
      }

      // #10 Finish Two-Finger Tap -> Open Spotlight Search
      if (twoFinger.active) {
        const elapsed = Date.now() - twoFinger.startTime;
        if (!twoFinger.moved && elapsed < 280) {
          try { navigator.vibrate?.(12); } catch (_) {}
          soundEffects.playGlassWhoosh?.();
          callbacksRef.current.onOpenSpotlight?.();
        }
        twoFinger.active = false;
      }

      // #6 Finish Swipe-Down on Lightbox Image
      if (imgSwipeDown.active && imgSwipeDown.img) {
        const img = imgSwipeDown.img;
        const dy = imgSwipeDown.dy;
        img.style.transition = 'transform 0.22s ease';
        img.style.transform = 'translateY(0px) scale(1)';
        if (dy > 90) {
          soundEffects.playGlassWhoosh?.();
          try { navigator.vibrate?.(10); } catch (_) {}
          // Click nearest close button inside overlay or dispatch Escape
          const overlay = img.closest('[role="dialog"]') || img.parentElement?.parentElement;
          const closeBtn = overlay?.querySelector?.('button[title*="Close" i], button[aria-label*="Close" i]');
          if (closeBtn) {
            closeBtn.click();
          } else {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          }
        }
        imgSwipeDown.active = false;
        imgSwipeDown.img = null;
        imgSwipeDown.dy = 0;
      }

      // #3 Finish Swipe-Left Drawer
      if (drawer.active && drawer.el) {
        const el = drawer.el;
        const dx = drawer.dx;
        el.style.transition = 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)';
        if (dx < -72) {
          soundEffects.playGlassWhoosh?.();
          try { navigator.vibrate?.(10); } catch (_) {}
          el.style.transform = 'translateX(-100%)';
          setTimeout(() => {
            el.style.transform = '';
            callbacksRef.current.onCloseDrawer?.();
          }, 160);
        } else {
          el.style.transform = '';
        }
        drawer.active = false;
        drawer.el = null;
        drawer.dx = 0;
        drawer.axis = null;
      }

      // #2 Finish Drag-Down Bottom Sheet
      if (sheet.active && sheet.el) {
        const el = sheet.el;
        const dy = sheet.dy;
        el.style.transition = 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)';
        if (dy > 80) {
          soundEffects.playGlassWhoosh?.();
          try { navigator.vibrate?.(10); } catch (_) {}
          el.style.transform = 'translateY(100%)';
          setTimeout(() => {
            el.style.transform = '';
            callbacksRef.current.onCloseSheets?.();
          }, 160);
        } else {
          el.style.transform = '';
        }
        sheet.active = false;
        sheet.el = null;
        sheet.dy = 0;
        sheet.axis = null;
      }

      // #1 Finish Pull-to-Refresh
      if (ptr.active) {
        const shouldRefresh = ptr.dist >= 68;
        ptr.active = false;
        ptr.dist = 0;
        if (shouldRefresh) {
          setIsRefreshing(true);
          setPullDist(58);
          soundEffects.playRefresh?.();
          try { navigator.vibrate?.(14); } catch (_) {}
          Promise.resolve(callbacksRef.current.onRefresh?.()).finally(() => {
            setTimeout(() => {
              setIsRefreshing(false);
              setPullDist(0);
            }, 650);
          });
        } else {
          setPullDist(0);
        }
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      clearCompanyHold();
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  if (pullDist <= 8 && !isRefreshing) return null;

  const ready = pullDist >= 68 || isRefreshing;

  return (
    <div
      style={{
        position: 'fixed',
        top: `calc(env(safe-area-inset-top, 0px) + ${Math.min(72, pullDist)}px)`,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99998,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '7px 14px',
        borderRadius: '999px',
        background: 'rgba(15, 23, 42, 0.88)',
        border: `1px solid ${ready ? 'rgba(56, 189, 248, 0.55)' : 'rgba(255, 255, 255, 0.18)'}`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 10px 28px rgba(0, 0, 0, 0.4)',
        color: ready ? '#38bdf8' : '#e2e8f0',
        fontSize: '0.75rem',
        fontWeight: 800,
        pointerEvents: 'none',
        transition: isRefreshing ? 'top 0.2s ease' : 'none'
      }}
    >
      <RefreshCw
        size={14}
        style={{
          transform: isRefreshing ? undefined : `rotate(${pullDist * 4}deg)`,
          animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none'
        }}
      />
      <span>{isRefreshing ? 'Refreshing...' : (ready ? 'Release to refresh' : 'Pull to refresh')}</span>
    </div>
  );
}
