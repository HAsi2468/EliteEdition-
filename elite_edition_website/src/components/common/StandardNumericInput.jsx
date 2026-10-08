import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import './StandardNumericInput.css';

/**
 * StandardNumericInput
 * 
 * Enterprise Standard High-Throughput Numeric Input Component.
 * Engineered for ERP accounting, production, billing, and inventory environments.
 * 
 * Strict Enterprise Architectural Constraints:
 * 1. Strict Literal Keystrokes:
 *    - Never enforces automated decimal shifting while typing (e.g., typing "1450" stays 1450, NOT 14.50).
 *    - Decimals are ONLY inserted when the operator explicitly presses the "." key.
 *    - No cursor jumping or premature mask enforcement during freeform entry.
 * 
 * 2. On Blur (`onBlur`) & Submission Formatting:
 *    - Automatically formats the display to standard locale notation:
 *      * Whole numbers: 1450 -> "1,450.00" (for currency/meterage) or "1,450" (for pure counts).
 *      * Explicit decimals: 14.5 -> "14.50" (with precision zero-padding).
 *    - Strictly enforces `font-variant-numeric: tabular-nums` for column alignment.
 * 
 * 3. On Focus (`onFocus`) Editing Behavior:
 *    - Strips formatting commas immediately so operator can edit raw digits without hindrance:
 *      * "1,450.00" reverts to "1450.00" (or "1450" if stripTrailingZerosOnFocus).
 *    - Automatically selects all text on single click / Tab focus for immediate 1-keystroke replacement.
 * 
 * 4. Keyboard Accelerators:
 *    - Pressing Enter commits the value and advances focus to the next logical input.
 *    - Pressing Arrow Up / Down increments/decrements by step (1) or 10x with Shift key.
 */

// Helper to sanitize raw input during typing
function sanitizeNumericString(str, allowDecimals = true, allowNegative = false) {
  if (str === null || str === undefined) return '';
  let cleaned = String(str).replace(/,/g, '').trim();

  // Handle negative sign
  let isNegative = false;
  if (allowNegative && cleaned.startsWith('-')) {
    isNegative = true;
    cleaned = cleaned.substring(1);
  }

  // Remove all non-numeric characters except decimal point
  if (allowDecimals) {
    // Keep only digits and decimal points
    cleaned = cleaned.replace(/[^0-9.]/g, '');
    // Allow at most ONE decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
  } else {
    // Pure integers
    cleaned = cleaned.replace(/[^0-9]/g, '');
  }

  return (isNegative ? '-' : '') + cleaned;
}

// Helper to format a numeric value on blur
function formatNumericDisplay(val, { decimals = 2, mode = 'decimal', locale = 'en-IN' } = {}) {
  if (val === null || val === undefined || val === '') return '';
  
  const rawClean = String(val).replace(/,/g, '').trim();
  if (rawClean === '' || rawClean === '-') return '';

  const num = parseFloat(rawClean);
  if (isNaN(num)) return '';

  const targetDecimals = mode === 'integer' || mode === 'count' ? 0 : Math.max(0, decimals);

  try {
    return num.toLocaleString(locale, {
      minimumFractionDigits: targetDecimals,
      maximumFractionDigits: targetDecimals,
      useGrouping: true
    });
  } catch (err) {
    // Fallback to basic toFixed + regex commas
    const fixed = num.toFixed(targetDecimals);
    const [intPart, decPart] = fixed.split('.');
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
  }
}

export const StandardNumericInput = forwardRef(function StandardNumericInput(
  {
    value,
    defaultValue,
    onChange,
    onValueChange,
    onBlur,
    onFocus,
    onKeyDown,
    mode = 'decimal', // 'decimal' | 'integer' | 'count' | 'currency'
    decimals = mode === 'integer' || mode === 'count' ? 0 : 2,
    allowDecimals = mode !== 'integer' && mode !== 'count',
    allowNegative = false,
    min,
    max,
    step = 1,
    stepShift = 10,
    prefix,
    suffix,
    placeholder = mode === 'integer' || mode === 'count' ? '0' : '0.00',
    disabled = false,
    readOnly = false,
    required = false,
    autoSelectOnFocus = true,
    advanceOnEnter = true,
    stripTrailingZerosOnFocus = false,
    locale = 'en-IN',
    align = 'right', // 'right' | 'left' | 'center'
    size = 'md', // 'sm' | 'md' | 'lg'
    className = '',
    style = {},
    inputStyle = {},
    name,
    id,
    title,
    autoFocus = false,
    ...restProps
  },
  ref
) {
  const internalInputRef = useRef(null);
  useImperativeHandle(ref, () => internalInputRef.current);

  const [isFocused, setIsFocused] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const justFocusedRef = useRef(false);
  const prevExternalValueRef = useRef(value);

  // Determine initial display text
  const initialValue = value !== undefined ? value : defaultValue;

  // Sync with external value changes when not actively typing
  useEffect(() => {
    if (!isFocused) {
      if (value !== undefined && value !== null && value !== '') {
        const formatted = formatNumericDisplay(value, { decimals, mode, locale });
        setDisplayText(formatted);
      } else if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '' && prevExternalValueRef.current === undefined) {
        const formatted = formatNumericDisplay(defaultValue, { decimals, mode, locale });
        setDisplayText(formatted);
      } else if (value === '' || value === null) {
        setDisplayText('');
      }
    }
    prevExternalValueRef.current = value;
  }, [value, defaultValue, isFocused, decimals, mode, locale]);

  // Dispatch change notification to parent handlers
  const notifyChange = useCallback((rawStr, origEvent) => {
    const clean = sanitizeNumericString(rawStr, allowDecimals, allowNegative);
    const numericVal = clean === '' || clean === '-' ? null : parseFloat(clean);

    if (typeof onValueChange === 'function') {
      onValueChange(numericVal, clean);
    }

    if (typeof onChange === 'function') {
      // Create a comprehensive synthetic event that works whether parent expects
      // e.target.value (string), e.target.valueAsNumber (number), or directly uses the event
      const syntheticEvent = {
        target: {
          name,
          id,
          value: clean,
          valueAsNumber: numericVal
        },
        currentTarget: {
          name,
          id,
          value: clean,
          valueAsNumber: numericVal
        },
        preventDefault: () => origEvent?.preventDefault?.(),
        stopPropagation: () => origEvent?.stopPropagation?.()
      };
      onChange(syntheticEvent, numericVal, clean);
    }
  }, [allowDecimals, allowNegative, onValueChange, onChange, name, id]);

  // Handle typing inside the input
  const handleChange = (e) => {
    const rawVal = e.target.value;
    const sanitized = sanitizeNumericString(rawVal, allowDecimals, allowNegative);

    // Freeform entry: NEVER enforce automatic decimal shifting or premature formatting
    setDisplayText(sanitized);
    notifyChange(sanitized, e);
  };

  // On Focus: Strip formatting commas and auto-select all text
  const handleFocus = (e) => {
    setIsFocused(true);
    justFocusedRef.current = true;

    // Strip commas so operator sees raw editable digits
    if (displayText) {
      let rawDigits = String(displayText).replace(/,/g, '').trim();
      if (stripTrailingZerosOnFocus && rawDigits.includes('.')) {
        rawDigits = rawDigits.replace(/\.?0+$/, '');
      }
      setDisplayText(rawDigits);
    }

    if (autoSelectOnFocus) {
      // requestAnimationFrame ensures selection survives browser mouseup deselect
      requestAnimationFrame(() => {
        if (internalInputRef.current && isFocused) {
          internalInputRef.current.select();
        }
      });
    }

    if (typeof onFocus === 'function') {
      onFocus(e);
    }
  };

  // Prevent mouseUp from clearing the selection on initial click focus
  const handleMouseUp = (e) => {
    if (justFocusedRef.current) {
      e.preventDefault();
      justFocusedRef.current = false;
    }
  };

  // On Blur: Format to standard locale notation with precision
  const handleBlur = (e) => {
    setIsFocused(false);
    justFocusedRef.current = false;

    if (displayText && displayText.trim() !== '') {
      let clean = sanitizeNumericString(displayText, allowDecimals, allowNegative);
      let num = parseFloat(clean);

      if (!isNaN(num)) {
        // Enforce boundary constraints if provided
        if (min !== undefined && min !== null && num < min) {
          num = min;
          clean = String(min);
        }
        if (max !== undefined && max !== null && num > max) {
          num = max;
          clean = String(max);
        }

        const formatted = formatNumericDisplay(num, { decimals, mode, locale });
        setDisplayText(formatted);
        notifyChange(clean, e);
      } else {
        setDisplayText('');
        notifyChange('', e);
      }
    } else {
      setDisplayText('');
      notifyChange('', e);
    }

    if (typeof onBlur === 'function') {
      onBlur(e);
    }
  };

  // Advance focus to next focusable element on Enter
  const advanceToNextInput = () => {
    if (!internalInputRef.current) return;
    const currentEl = internalInputRef.current;
    const form = currentEl.form || currentEl.closest('form') || currentEl.closest('[data-focus-scope="true"]') || document.body;

    const focusableSelectors = [
      'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
      'select:not([disabled]):not([tabindex="-1"])',
      'textarea:not([disabled]):not([tabindex="-1"])',
      'button:not([disabled]):not([tabindex="-1"])'
    ].join(', ');

    const elements = Array.from(form.querySelectorAll(focusableSelectors));
    const currentIndex = elements.indexOf(currentEl);

    if (currentIndex > -1 && currentIndex < elements.length - 1) {
      const nextEl = elements[currentIndex + 1];
      nextEl.focus();
      if (typeof nextEl.select === 'function') {
        nextEl.select();
      }
    }
  };

  // Handle keyboard accelerators: Enter, Tab, Arrow Up / Down, Escape
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (advanceOnEnter) {
        e.preventDefault();
        // Commit formatting first
        handleBlur(e);
        advanceToNextInput();
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const currentClean = sanitizeNumericString(displayText, allowDecimals, allowNegative);
      const currentNum = currentClean === '' ? 0 : (parseFloat(currentClean) || 0);
      const effectiveStep = e.shiftKey ? stepShift : step;
      let nextNum = e.key === 'ArrowUp' ? currentNum + effectiveStep : currentNum - effectiveStep;

      // Round to precision to avoid floating point anomalies
      const roundFactor = Math.pow(10, decimals);
      nextNum = Math.round(nextNum * roundFactor) / roundFactor;

      if (min !== undefined && min !== null && nextNum < min) nextNum = min;
      if (max !== undefined && max !== null && nextNum > max) nextNum = max;

      const nextStr = String(nextNum);
      setDisplayText(nextStr);
      notifyChange(nextStr, e);

      requestAnimationFrame(() => {
        if (internalInputRef.current) {
          internalInputRef.current.select();
        }
      });
    } else if (e.key === 'Escape') {
      // Revert to original external value
      if (value !== undefined && value !== null) {
        setDisplayText(String(value));
      }
      internalInputRef.current?.blur();
    }

    if (typeof onKeyDown === 'function') {
      onKeyDown(e);
    }
  };

  return (
    <div
      className={`standard-numeric-wrapper standard-numeric-size-${size} ${isFocused ? 'is-focused' : ''} ${disabled ? 'is-disabled' : ''} ${readOnly ? 'is-readonly' : ''} ${className}`}
      style={style}
    >
      {prefix && <span className="standard-numeric-prefix">{prefix}</span>}

      <input
        ref={internalInputRef}
        type="text"
        inputMode={allowDecimals ? 'decimal' : 'numeric'}
        autoComplete="off"
        spellCheck="false"
        name={name}
        id={id}
        title={title}
        value={displayText}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        autoFocus={autoFocus}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onMouseUp={handleMouseUp}
        onKeyDown={handleKeyDown}
        className={`standard-numeric-input standard-numeric-align-${align}`}
        style={{
          textAlign: align,
          ...inputStyle
        }}
        {...restProps}
      />

      {suffix && <span className="standard-numeric-suffix">{suffix}</span>}
    </div>
  );
});

StandardNumericInput.propTypes = {
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  defaultValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onChange: PropTypes.func,
  onValueChange: PropTypes.func,
  onBlur: PropTypes.func,
  onFocus: PropTypes.func,
  onKeyDown: PropTypes.func,
  mode: PropTypes.oneOf(['decimal', 'integer', 'count', 'currency']),
  decimals: PropTypes.number,
  allowDecimals: PropTypes.bool,
  allowNegative: PropTypes.bool,
  min: PropTypes.number,
  max: PropTypes.number,
  step: PropTypes.number,
  stepShift: PropTypes.number,
  prefix: PropTypes.node,
  suffix: PropTypes.node,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  readOnly: PropTypes.bool,
  required: PropTypes.bool,
  autoSelectOnFocus: PropTypes.bool,
  advanceOnEnter: PropTypes.bool,
  stripTrailingZerosOnFocus: PropTypes.bool,
  locale: PropTypes.string,
  align: PropTypes.oneOf(['right', 'left', 'center']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
  style: PropTypes.object,
  inputStyle: PropTypes.object,
  name: PropTypes.string,
  id: PropTypes.string,
  title: PropTypes.string,
  autoFocus: PropTypes.bool
};

export default StandardNumericInput;
