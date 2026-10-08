import React, { useState, useEffect, useRef, useMemo } from 'react';
import { evaluateNumericFormula } from '../../utils/safeFormulaEvaluator';
import './NumericExpressionInput.css';

/**
 * NumericExpressionInput
 * 
 * Enterprise In-Field Inline Formula Evaluation Field.
 * Allows operators to enter mathematical expressions like:
 * - "120 * 3" -> evaluates to 360
 * - "500 - 10%" -> evaluates to 450 (discount)
 * - "1000 + 18%" -> evaluates to 1180 (GST addition)
 * - "(150 + 50) / 2" -> evaluates to 100
 * 
 * Automatically evaluates on blur or Enter, provides live preview while editing,
 * and preserves exact 14px body typography with tabular numerals.
 */
export function NumericExpressionInput({
  value,
  onChange = () => {},
  placeholder = '0.00',
  precision = 2,
  min,
  max,
  disabled = false,
  className = '',
  style = {},
  prefix,
  suffix,
  autoSelectOnFocus = true
}) {
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [lastValidValue, setLastValidValue] = useState(value);
  const inputRef = useRef(null);

  // Sync external value when not actively typing
  useEffect(() => {
    if (!isFocused) {
      if (value !== undefined && value !== null && !isNaN(value)) {
        setText(String(value));
        setLastValidValue(value);
      } else {
        setText('');
      }
    }
  }, [value, isFocused]);

  // Check if current text contains algebraic operators
  const containsFormula = useMemo(() => {
    return /[+\-*/%^()]/.test(text);
  }, [text]);

  // Live real-time preview computation
  const liveEvaluation = useMemo(() => {
    if (!containsFormula || !isFocused) return null;
    return evaluateNumericFormula(text, { precision });
  }, [text, containsFormula, isFocused, precision]);

  // Commit and evaluate expression
  const commitValue = () => {
    if (!text.trim()) {
      onChange(0);
      return;
    }

    const result = evaluateNumericFormula(text, { precision });

    if (result.success) {
      let finalVal = result.value;
      if (min !== undefined && finalVal < min) finalVal = min;
      if (max !== undefined && finalVal > max) finalVal = max;

      setText(String(finalVal));
      setLastValidValue(finalVal);
      onChange(finalVal);
    } else {
      // Revert to last valid value on formula error
      setText(String(lastValidValue ?? ''));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValue();
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setText(String(lastValidValue ?? ''));
      inputRef.current?.blur();
    }
  };

  const handleFocus = (e) => {
    setIsFocused(true);
    if (autoSelectOnFocus) {
      e.target.select();
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    commitValue();
  };

  return (
    <div className={`numeric-expr-wrapper ${className}`} style={style}>
      <span className={`numeric-expr-icon ${containsFormula ? 'is-active' : ''}`} title="Supports math expressions: +, -, *, /, %">
        fx
      </span>

      <input
        ref={inputRef}
        type="text"
        className={`numeric-expr-input ${liveEvaluation && !liveEvaluation.success ? 'has-error' : ''}`}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />

      {/* Real-time preview pill while operator types formula */}
      {liveEvaluation && isFocused && (
        <span className={`numeric-expr-preview-pill ${!liveEvaluation.success ? 'error' : ''}`}>
          {liveEvaluation.success ? `= ${liveEvaluation.value}` : 'Syntax error'}
        </span>
      )}
    </div>
  );
}
