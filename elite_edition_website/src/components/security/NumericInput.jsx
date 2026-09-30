import React from 'react';
import { BaseSecureInput } from './BaseSecureInput';
import { SecurityValidationEngine } from '../../security/validationEngine';

export const NumericInput = ({
  value,
  onChange,
  label,
  error,
  helperText,
  allowDecimal = false,
  decimalPlaces = 2,
  currencySymbol,
  placeholder = allowDecimal ? '0.00' : '0',
  disabled,
  style = {},
  ...rest
}) => {
  // 1. Keystroke Suppression at Event Horizon
  const handleBeforeInput = (e) => {
    const inputChar = e.data;
    if (!inputChar) return;

    if (allowDecimal && inputChar === '.') {
      const currentVal = String(value || '');
      if (currentVal.includes('.')) {
        e.preventDefault();
        return;
      }
      return;
    }

    if (!/^\d$/.test(inputChar)) {
      e.preventDefault();
    }
  };

  const handleKeyDown = (e) => {
    if (
      ['Backspace', 'Tab', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'].includes(e.key) ||
      (e.ctrlKey || e.metaKey)
    ) {
      return;
    }

    if (allowDecimal && e.key === '.') {
      if (String(value || '').includes('.')) {
        e.preventDefault();
      }
      return;
    }

    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  // 2. Clipboard Paste Interception & Sanitization
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text/plain');
    const sanitized = SecurityValidationEngine.sanitizeNumeric(pastedText, {
      allowDecimal,
      decimalPlaces,
    });
    if (onChange) onChange(sanitized);
  };

  return (
    <BaseSecureInput label={label} error={error} helperText={helperText} isValid={!error}>
      {(a11yProps) => (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
          {currencySymbol && (
            <span
              style={{
                position: 'absolute',
                left: '10px',
                color: 'var(--text-muted, #64748b)',
                fontWeight: 700,
                fontSize: '0.9rem',
                pointerEvents: 'none',
              }}
            >
              {currencySymbol}
            </span>
          )}
          <input
            {...rest}
            {...a11yProps}
            type="text"
            inputMode={allowDecimal ? 'decimal' : 'numeric'}
            value={value != null ? value : ''}
            disabled={disabled}
            placeholder={placeholder}
            onBeforeInput={handleBeforeInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onChange={(e) => {
              const sanitized = SecurityValidationEngine.sanitizeNumeric(e.target.value, {
                allowDecimal,
                decimalPlaces,
              });
              if (onChange) onChange(sanitized);
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              paddingLeft: currencySymbol ? '24px' : '12px',
              borderRadius: '6px',
              border: a11yProps['aria-invalid'] ? '1px solid #ef4444' : '1px solid var(--border-color, #cbd5e1)',
              background: 'var(--bg-card, #ffffff)',
              color: 'var(--text-primary, #0f172a)',
              outline: 'none',
              fontSize: '0.9rem',
              ...style
            }}
          />
        </div>
      )}
    </BaseSecureInput>
  );
};

export const CurrencyInput = (props) => (
  <NumericInput {...props} allowDecimal={true} decimalPlaces={2} currencySymbol={props.currencySymbol ?? '₹'} />
);
