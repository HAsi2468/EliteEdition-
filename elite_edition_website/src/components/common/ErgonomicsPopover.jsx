import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Sliders, X, RotateCcw, Monitor, ShieldCheck, Check } from 'lucide-react';

/**
 * ErgonomicsPopover
 * 
 * Strict viewport boundary-aware popover for UI scale density and Factory Floor HUD mode.
 * Rendered via createPortal into document.body with auto-flip and edge-shifting to
 * prevent any clipping or viewport overflow regardless of zoom or dock position.
 */
export function ErgonomicsPopover({
  isOpen,
  onClose,
  anchorRef,
  scale = 1,
  onScaleChange,
  isIndustrial = false,
  onToggleIndustrial,
  onResetDefaults,
}) {
  const popoverRef = useRef(null);
  const [coords, setCoords] = useState({ top: null, bottom: null, left: null });

  // Calculate clamped viewport bounds
  const updatePosition = useCallback(() => {
    if (!anchorRef?.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const POPOVER_WIDTH = 320;
    const PADDING = 16;
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

    // Vertical placement: place above if in lower half of screen
    const placeAbove = rect.top > windowHeight / 2;
    let computedTop = null;
    let computedBottom = null;

    if (placeAbove) {
      computedBottom = Math.max(PADDING, windowHeight - rect.top + 10);
    } else {
      computedTop = Math.max(PADDING, rect.bottom + 10);
    }

    // Horizontal placement: align with dock's right or left, clamped within viewport padding
    let computedLeft = rect.left;
    if (rect.right > windowWidth - POPOVER_WIDTH - PADDING) {
      computedLeft = Math.max(PADDING, rect.right - POPOVER_WIDTH);
    } else {
      computedLeft = Math.max(PADDING, rect.left);
    }
    // Hard clamp to prevent horizontal scroll spill
    computedLeft = Math.min(computedLeft, windowWidth - POPOVER_WIDTH - PADDING);

    setCoords({
      top: computedTop !== null ? `${computedTop}px` : 'auto',
      bottom: computedBottom !== null ? `${computedBottom}px` : 'auto',
      left: `${computedLeft}px`,
    });
  }, [anchorRef]);

  // Recalculate on open, scroll, or resize
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  // Click outside and escape key dismiss
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        anchorRef?.current &&
        !anchorRef.current.contains(e.target)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen || typeof document === 'undefined') return null;

  const currentPercent = Math.round(scale * 100);

  const presets = [
    { value: 0.85, label: '85%', tag: 'Dense', desc: 'Max data overview' },
    { value: 1.0, label: '100%', tag: 'Default', desc: 'Standard balance' },
    { value: 1.15, label: '115%', tag: 'Comfort', desc: 'Enhanced touch' },
  ];

  return createPortal(
    <>
      {/* Click-outside backdrop trap */}
      <div
        className="fixed inset-0 z-[99998] bg-slate-900/10 backdrop-blur-[0.5px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Popover Panel with strict viewport bounding */}
      <div
        ref={popoverRef}
        role="dialog"
        aria-label="Display Ergonomics Settings"
        className="fixed z-[99999] w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-5rem)] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl border border-blue-200 text-slate-900 box-border animate-in fade-in zoom-in-95 duration-150"
        style={{
          top: coords.top,
          bottom: coords.bottom,
          left: coords.left,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 border border-blue-200 text-blue-600">
              <Sliders size={15} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold tracking-tight text-slate-900 leading-none">
                Display Ergonomics
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Scale & Factory Floor Comfort
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Close Panel (Esc)"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* UI Scale Density Slider */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Monitor size={13} className="text-blue-600" />
              UI Scale Density:
            </span>
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-black text-blue-700 border border-blue-200">
              {currentPercent}%
            </span>
          </div>

          <input
            type="range"
            min="0.75"
            max="1.25"
            step="0.05"
            value={scale}
            onChange={(e) => onScaleChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 my-2 focus:outline-none"
            aria-label="Scale density slider"
          />

          {/* Preset Buttons */}
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            {presets.map((preset) => {
              const isSelected = Math.abs(scale - preset.value) < 0.02;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => onScaleChange(preset.value)}
                  className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-xs font-bold transition-all border ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <span className="text-[13px] font-black leading-tight">{preset.label}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                    {preset.tag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Factory HUD Mode Toggle */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 mb-4 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 text-amber-700">
                <ShieldCheck size={14} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">Factory HUD Mode</div>
                <div className="text-[10px] text-slate-500">2px solid contrast for factory glare</div>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isIndustrial}
              onClick={onToggleIndustrial}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isIndustrial ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  isIndustrial ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer: Reset Defaults */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onResetDefaults}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors py-1 px-1.5 rounded-md hover:bg-slate-100"
          >
            <RotateCcw size={12} />
            <span>Reset to 100%</span>
          </button>
          <span className="text-[11px] text-slate-400 font-medium">
            Saved to device
          </span>
        </div>
      </div>
    </>,
    document.body
  );
}

export default ErgonomicsPopover;
