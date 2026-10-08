import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import './ScrollSpyMiniMap.css';

/**
 * ScrollSpyMiniMap
 * 
 * Right-docked vertical section tracker for complex enterprise forms.
 * Monitors viewport intersection with smooth anchor jump, active highlight,
 * and live validation warning badges for invalid inputs inside each section.
 */
export function ScrollSpyMiniMap({ 
  sections = [], 
  containerRef = null,
  className = '' 
}) {
  const [activeSectionId, setActiveSectionId] = useState('');
  const [sectionErrors, setSectionErrors] = useState({}); // { [sectionId]: errorCount }
  const [discoveredSections, setDiscoveredSections] = useState(sections);

  // Auto-discover sections if not explicitly provided
  useEffect(() => {
    if (sections && sections.length > 0) {
      setDiscoveredSections(sections);
      return;
    }

    const root = containerRef?.current || document;
    const foundElements = root.querySelectorAll('[data-form-section="true"], [data-section-id], fieldset[data-section-title]');
    const list = Array.from(foundElements).map((el, idx) => {
      const id = el.id || el.getAttribute('data-section-id') || `form-section-${idx}`;
      if (!el.id) el.id = id;
      const label = el.getAttribute('data-section-title') || el.querySelector('legend, h3, h4')?.textContent?.trim() || `Section ${idx + 1}`;
      return { id, label };
    });

    if (list.length > 0) {
      setDiscoveredSections(list);
    }
  }, [sections, containerRef]);

  // Monitor Viewport Intersection using IntersectionObserver
  useEffect(() => {
    if (!discoveredSections || discoveredSections.length === 0) return;

    const observerCallback = (entries) => {
      // Find entry with largest intersection ratio
      const visibleEntries = entries.filter(e => e.isIntersecting);
      if (visibleEntries.length > 0) {
        visibleEntries.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        setActiveSectionId(visibleEntries[0].target.id);
      }
    };

    const observer = new IntersectionObserver(observerCallback, {
      root: null,
      rootMargin: '-80px 0px -40% 0px',
      threshold: [0.1, 0.4, 0.7]
    });

    discoveredSections.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [discoveredSections]);

  // Live Section Validation Inspection
  const checkValidationErrors = useCallback(() => {
    if (!discoveredSections || discoveredSections.length === 0) return;

    const errors = {};
    discoveredSections.forEach(s => {
      const el = document.getElementById(s.id);
      if (!el) return;

      // Find invalid inputs, required empty inputs, or elements with error classes
      const invalidFields = el.querySelectorAll(':invalid, [aria-invalid="true"], .has-error, .input-error');
      let count = invalidFields.length;

      // Also check standard inputs with custom validity
      const requiredInputs = el.querySelectorAll('input[required], select[required], textarea[required]');
      requiredInputs.forEach(input => {
        if (!input.value || !input.value.trim()) {
          // Count only if not already caught by :invalid
          if (!input.matches(':invalid')) count++;
        }
      });

      if (count > 0) {
        errors[s.id] = count;
      }
    });

    setSectionErrors(errors);
  }, [discoveredSections]);

  useEffect(() => {
    checkValidationErrors();
    const interval = setInterval(checkValidationErrors, 1500);

    const handleFormInput = () => checkValidationErrors();
    const root = containerRef?.current || document;
    root.addEventListener('input', handleFormInput, { passive: true });
    root.addEventListener('change', handleFormInput, { passive: true });

    return () => {
      clearInterval(interval);
      root.removeEventListener('input', handleFormInput);
      root.removeEventListener('change', handleFormInput);
    };
  }, [checkValidationErrors, containerRef]);

  const scrollToSection = (sectionId) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSectionId(sectionId);
    }
  };

  if (!discoveredSections || discoveredSections.length === 0) return null;

  return (
    <div className={`scrollspy-minimap-container ${className}`} role="navigation" aria-label="Form Sections Mini-Map">
      <div className="scrollspy-minimap-rail">
        {discoveredSections.map((sec, idx) => {
          const isActive = activeSectionId === sec.id || (!activeSectionId && idx === 0);
          const errorCount = sectionErrors[sec.id] || 0;

          return (
            <button
              key={sec.id}
              type="button"
              className={`scrollspy-step-btn ${isActive ? 'active' : ''}`}
              onClick={() => scrollToSection(sec.id)}
              title={`${sec.label}${errorCount > 0 ? ` (${errorCount} issues)` : ''}`}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="scrollspy-step-label">{sec.label}</span>
              <div className="scrollspy-step-dot-wrap">
                <span className="scrollspy-step-dot" />
                {errorCount > 0 && (
                  <span className="scrollspy-error-badge" title={`${errorCount} validation issues`}>
                    !
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ScrollSpyMiniMap;
