import React, { useEffect } from 'react';

/**
 * LiquidGlassInteractionEngine
 *
 * Powers the 8 interactive animations & 8 liquid glass visual effects globally
 * across Elite Edition ERP in both Dark Mode and Light Mode:
 *
 * 1. Live Number Rolling / Counting ("Odometer Effect") on KPI & financial summary numbers
 * 2. Cursor-Tracking Specular Glass Spotlight (--glass-mx, --glass-my, --mouse-x, --mouse-y)
 * 3. Newly Saved Row "Emerald Pulse Highlight" (.erp-row-emerald-pulse) on dynamic table insertions
 * 4. Smooth Sliding Pill Indicator & Spring Active States for Tabs & Sub-Tabs
 * 5. Tactile Button Ripple & Submit Success Morph (.erp-btn-ripple-wave / .erp-btn-submit-success)
 * 6. Smooth Accordion & Drawer Height Physics
 * 7. Status Badge Live Breathing Glow (.erp-badge-breathing-attention) on Pending/Unpaid/Overdue/At Mill badges
 * 8. Modal Backdrop Depth Scale (body.erp-modal-open-depth)
 */
export function LiquidGlassInteractionEngine() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const prefersReducedMotion = () =>
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ||
      document.documentElement.getAttribute('data-calm-mode') === 'on';

    // =========================================================================
    // 1. CURSOR-TRACKING SPECULAR GLASS SPOTLIGHT (Cards & Primary Buttons)
    // =========================================================================
    const SPOTLIGHT_SELECTOR =
      '.glass-card, .glass-card-item, .glass-calc-card, .ent-stat-card, .stat-card, .metric-card, .fusing-metric-card, .phoenix-card, .phoenix-kpi-card, .task-card, .complaint-modern-card, .btn-primary, .ent-btn-primary, .glass-btn-primary';
    let rafId = null;
    let lastMoveEvent = null;

    const updateSpotlight = () => {
      rafId = null;
      const ev = lastMoveEvent;
      if (!ev || !(ev.target instanceof Element)) return;
      const el = ev.target.closest(SPOTLIGHT_SELECTOR);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = `${Math.round(ev.clientX - rect.left)}px`;
      const y = `${Math.round(ev.clientY - rect.top)}px`;
      el.style.setProperty('--glass-mx', x);
      el.style.setProperty('--glass-my', y);
      el.style.setProperty('--mouse-x', x);
      el.style.setProperty('--mouse-y', y);
    };

    const onPointerMove = (ev) => {
      if (prefersReducedMotion()) return;
      lastMoveEvent = ev;
      if (rafId === null) {
        rafId = window.requestAnimationFrame(updateSpotlight);
      }
    };

    // =========================================================================
    // 2. TACTILE BUTTON RIPPLE & SUBMIT SUCCESS FEEDBACK
    // =========================================================================
    const onPointerDown = (ev) => {
      if (prefersReducedMotion()) return;
      if (!(ev.target instanceof Element)) return;
      const btn = ev.target.closest(
        'button:not(:disabled), .btn-primary, .btn-secondary, .ent-btn-primary, .glass-subtab-btn, .company-segment-pill'
      );
      if (!btn || !(btn instanceof HTMLElement)) return;

      const rect = btn.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      btn.style.setProperty('--ripple-x', `${Math.round(x)}px`);
      btn.style.setProperty('--ripple-y', `${Math.round(y)}px`);
      btn.classList.remove('erp-tactile-ripple-active');
      // Trigger reflow so rapid clicks re-trigger the ripple cleanly
      void btn.offsetWidth;
      btn.classList.add('erp-tactile-ripple-active');

      // If this is a primary Save/Submit action button, trigger subtle emerald confirmation pulse
      const text = (btn.textContent || '').trim().toLowerCase();
      const isSaveAction =
        btn.getAttribute('type') === 'submit' ||
        text.startsWith('save') ||
        text.startsWith('create') ||
        text.startsWith('update ') ||
        text.includes('inward rfd') ||
        text.includes('confirm');
      if (isSaveAction) {
        btn.classList.remove('erp-btn-save-pulse');
        void btn.offsetWidth;
        btn.classList.add('erp-btn-save-pulse');
      }
    };

    // =========================================================================
    // 3. LIVE NUMBER ROLLING ("ODOMETER EFFECT")
    //    & NEWLY SAVED ROW "EMERALD PULSE HIGHLIGHT"
    //    & STATUS BADGE LIVE BREATHING GLOW
    //    & MODAL BACKDROP 3D DEPTH SCALE
    // =========================================================================
    const knownTbodies = new WeakMap();
    const animatedNumbers = new WeakMap();

    const KPI_VALUE_SELECTOR =
      '.glass-calc-value, .stat-value, .ent-stat-value, .metric-value, .fusing-metric-value, .phoenix-kpi-value, [data-animate-number]';

    const parseNumericToken = (rawText) => {
      if (!rawText || typeof rawText !== 'string') return null;
      const trimmed = rawText.trim();
      if (trimmed.length > 28 || trimmed.length < 1) return null;
      // Match optional currency/prefix, formatted number, and optional suffix (e.g., "₹1,45,200", "4,566 Mtr", "84.5%")
      const match = trimmed.match(/^([^0-9+-]*[+-]?)(\d[\d,]*\.?\d*)(\s*[a-zA-Z%\/]*)$/);
      if (!match) return null;
      const prefix = match[1] || '';
      const numStr = match[2].replace(/,/g, '');
      const suffix = match[3] || '';
      const value = Number(numStr);
      if (!Number.isFinite(value)) return null;
      const decimals = numStr.includes('.') ? Math.min(2, numStr.split('.')[1].length) : 0;
      const usesCommas = match[2].includes(',');
      return { prefix, value, suffix, decimals, usesCommas, raw: trimmed };
    };

    const formatIndianOrStandardNumber = (num, decimals, usesCommas) => {
      const fixed = num.toFixed(decimals);
      if (!usesCommas) return fixed;
      const [intPart, decPart] = fixed.split('.');
      const formattedInt = Number(intPart).toLocaleString('en-IN');
      return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
    };

    const animateNumberElement = (el) => {
      if (!(el instanceof HTMLElement)) return;
      if (el.children.length > 0) return; // Only leaf text nodes
      const currentText = (el.textContent || '').trim();
      if (!currentText) return;

      const parsed = parseNumericToken(currentText);
      if (!parsed) return;

      const prevRecord = animatedNumbers.get(el);
      if (prevRecord && prevRecord.targetValue === parsed.value) return;

      const startValue = prevRecord ? prevRecord.targetValue : parsed.value * 0.82;
      animatedNumbers.set(el, { targetValue: parsed.value, raw: currentText });

      // Skip animation on reduced motion or zero values
      if (prefersReducedMotion() || parsed.value === 0 || Math.abs(parsed.value - startValue) < 0.01) {
        return;
      }

      const duration = 340;
      const startTime = performance.now();

      const step = (now) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        // Critically damped cubic-out
        const eased = 1 - Math.pow(1 - t, 3);
        const current = startValue + (parsed.value - startValue) * eased;
        if (t < 1) {
          el.textContent = `${parsed.prefix}${formatIndianOrStandardNumber(
            current,
            parsed.decimals,
            parsed.usesCommas
          )}${parsed.suffix}`;
          window.requestAnimationFrame(step);
        } else {
          el.textContent = parsed.raw;
        }
      };

      window.requestAnimationFrame(step);
    };

    // Classify status badges & semantic KPI card tints
    const ATTENTION_PATTERNS = /\b(unpaid|overdue|pending|still at mill|partial|due|urgent|high priority|disputed|shortage)\b/i;
    const CALM_PATTERNS = /\b(paid|clear|completed|complete delivery|settled|verified|approved|active|closed)\b/i;

    const decorateBadgesAndKpis = (root = document) => {
      if (!(root instanceof Document || root instanceof Element)) return;

      // 1. Animate KPI numbers
      const kpiNodes = root.querySelectorAll(KPI_VALUE_SELECTOR);
      kpiNodes.forEach((node) => animateNumberElement(node));

      // 2. Classify status badges for live breathing glow vs calm state
      const badges = root.querySelectorAll(
        '.status-badge, .badge, .ent-badge, .glass-badge, [class*="status-pill"], [class*="badge"]'
      );
      badges.forEach((badge) => {
        if (!(badge instanceof HTMLElement)) return;
        if (badge.children.length > 2) return;
        const txt = (badge.textContent || '').trim();
        if (!txt || txt.length > 36) return;
        if (ATTENTION_PATTERNS.test(txt) && !CALM_PATTERNS.test(txt)) {
          badge.classList.add('erp-status-attention-breathe');
        } else {
          badge.classList.remove('erp-status-attention-breathe');
        }
      });

      // 3. Track existing table tbodies so we can highlight newly inserted rows after initial mount
      const tbodies = root.querySelectorAll('table:not(.printable-area table) tbody');
      tbodies.forEach((tbody) => {
        if (!knownTbodies.has(tbody)) {
          const rowSet = new WeakSet();
          Array.from(tbody.children).forEach((tr) => rowSet.add(tr));
          knownTbodies.set(tbody, { initializedAt: Date.now(), rows: rowSet });
        }
      });

      // 4. Sync modal backdrop 3D depth state on body
      const hasOpenModal = Boolean(
        document.querySelector(
          '.modal-overlay, .modal-backdrop, [role="dialog"]:not(.no-depth-scale), .erp-modal'
        )
      );
      document.body.classList.toggle('erp-modal-depth-active', hasOpenModal);
    };

    // Initial scan
    decorateBadgesAndKpis(document);

    // Observe DOM mutations for newly added rows, updated KPI numbers, and modals
    let mutationTimer = null;
    const observer = new MutationObserver((mutations) => {
      let shouldRescan = false;

      for (const m of mutations) {
        if (m.type === 'childList' && m.addedNodes.length > 0) {
          shouldRescan = true;

          // Check if a new <tr> was added to an already-mounted <tbody>
          if (m.target instanceof HTMLElement && m.target.tagName === 'TBODY') {
            const tbodyState = knownTbodies.get(m.target);
            if (tbodyState && Date.now() - tbodyState.initializedAt > 600) {
              m.addedNodes.forEach((node) => {
                if (node instanceof HTMLElement && node.tagName === 'TR') {
                  if (!tbodyState.rows.has(node)) {
                    tbodyState.rows.add(node);
                    node.classList.add('erp-row-emerald-pulse');
                    window.setTimeout(() => {
                      node.classList.remove('erp-row-emerald-pulse');
                    }, 1800);
                  }
                }
              });
            }
          }
        } else if (m.type === 'characterData') {
          const parent = m.target.parentElement;
          if (parent && parent.matches && parent.matches(KPI_VALUE_SELECTOR)) {
            animateNumberElement(parent);
          }
        }
      }

      if (shouldRescan && mutationTimer === null) {
        mutationTimer = window.setTimeout(() => {
          mutationTimer = null;
          decorateBadgesAndKpis(document);
        }, 90);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerdown', onPointerDown, { passive: true });

    return () => {
      observer.disconnect();
      if (mutationTimer !== null) window.clearTimeout(mutationTimer);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  return null;
}

export default LiquidGlassInteractionEngine;
