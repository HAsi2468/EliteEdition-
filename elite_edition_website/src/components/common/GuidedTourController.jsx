import React, { useState, useEffect, useCallback } from 'react';
import { Compass, X, ArrowRight, ArrowLeft } from 'lucide-react';
import './GuidedTourController.css';

const DEFAULT_TOUR_STEPS = [
  {
    targetSelector: '#global-brand-header-tabs, .brand-logo-area, .header-container',
    title: 'Enterprise Workspace Hub',
    content: 'Switch between sister enterprises with dynamic luminous branding (EDP, EST, EE, EFB, EON).'
  },
  {
    targetSelector: '#changelog-drawer-trigger, .hud-controller-pill',
    title: 'Display Ergonomics & What\'s New',
    content: 'Adjust UI scaling from 85% to 115%, switch to Factory Floor HUD, and explore latest feature updates.'
  },
  {
    targetSelector: '.zen-exit-pill, [data-context-menu], .erp-table',
    title: 'Zen Mode & Table Context Menus',
    content: 'Press Alt+Z for 100% full-screen data focus, and right-click any row to duplicate, print labels, or copy IDs.'
  }
];

/**
 * GuidedTourController
 * 
 * Step-by-step feature driver that highlights sequential UI elements with a darkened backdrop mask,
 * popover cards, and next/prev progression.
 * Can be triggered via window event `elite:start-tour`.
 */
export function GuidedTourController({ steps = DEFAULT_TOUR_STEPS }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const [cardCoords, setCardCoords] = useState({ top: 100, left: 100 });

  const activeStep = steps[currentStepIdx];

  const updateSpotlight = useCallback(() => {
    if (!activeStep) return;

    let targetEl = null;
    const selectors = activeStep.targetSelector.split(',');
    for (const sel of selectors) {
      const found = document.querySelector(sel.trim());
      if (found) {
        targetEl = found;
        break;
      }
    }

    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const rect = targetEl.getBoundingClientRect();
      setSpotlightRect(rect);

      // Position tour popover card
      const cardWidth = 320;
      const cardHeight = 180;
      let left = rect.left + rect.width / 2 - cardWidth / 2;
      let top = rect.bottom + 16;

      if (top + cardHeight > window.innerHeight) {
        top = Math.max(16, rect.top - cardHeight - 16);
      }
      if (left + cardWidth > window.innerWidth - 16) {
        left = window.innerWidth - cardWidth - 16;
      }
      left = Math.max(16, left);

      setCardCoords({ top, left });
    } else {
      // Fallback to center screen if element not found
      setSpotlightRect(null);
      setCardCoords({
        top: window.innerHeight / 2 - 90,
        left: window.innerWidth / 2 - 160
      });
    }
  }, [activeStep]);

  useEffect(() => {
    const handleStartTour = () => {
      setIsActive(true);
      setCurrentStepIdx(0);
    };

    window.addEventListener('elite:start-tour', handleStartTour);
    return () => window.removeEventListener('elite:start-tour', handleStartTour);
  }, []);

  useEffect(() => {
    if (isActive) {
      updateSpotlight();
      window.addEventListener('resize', updateSpotlight);
      return () => window.removeEventListener('resize', updateSpotlight);
    }
  }, [isActive, currentStepIdx, updateSpotlight]);

  const handleNext = () => {
    if (currentStepIdx < steps.length - 1) {
      setCurrentStepIdx(i => i + 1);
    } else {
      setIsActive(false);
      localStorage.setItem('elite_tour_completed', 'true');
    }
  };

  const handleBack = () => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx(i => i - 1);
    }
  };

  const handleSkip = () => {
    setIsActive(false);
    localStorage.setItem('elite_tour_completed', 'true');
  };

  if (!isActive || !activeStep) return null;

  return (
    <div className="tour-overlay-mask" role="dialog" aria-modal="true" aria-label="Guided Tour">
      {/* SVG Cutout Mask */}
      <svg style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none' }}>
        <defs>
          <mask id="tour-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlightRect && (
              <rect
                x={spotlightRect.left - 6}
                y={spotlightRect.top - 6}
                width={spotlightRect.width + 12}
                height={spotlightRect.height + 12}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(15, 23, 42, 0.75)" mask="url(#tour-spotlight-mask)" />
      </svg>

      {/* Popover Step Card */}
      <div
        className="tour-popover-card"
        style={{ top: `${cardCoords.top}px`, left: `${cardCoords.left}px` }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="tour-step-counter">
            Step {currentStepIdx + 1} of {steps.length}
          </span>
          <button
            type="button"
            onClick={handleSkip}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="tour-step-title">{activeStep.title}</div>
        <div className="tour-step-content">{activeStep.content}</div>

        <div className="tour-footer-actions">
          <button type="button" className="tour-btn skip" onClick={handleSkip}>
            Skip Tour
          </button>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {currentStepIdx > 0 && (
              <button type="button" className="tour-btn back" onClick={handleBack}>
                <ArrowLeft size={12} /> Back
              </button>
            )}
            <button type="button" className="tour-btn next" onClick={handleNext}>
              {currentStepIdx === steps.length - 1 ? 'Finish' : 'Next'} <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GuidedTourController;
