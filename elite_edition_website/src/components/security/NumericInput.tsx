import React from 'react';
import { BaseSecureInput } from './BaseSecureInput';
import { SecurityValidationEngine } from '../../security/validationEngine';

export interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string | number | null;
  onChange?: (value: string) => void;
  label?: string;
  error?: string | null;
  helperText?: string;
  allowDecimal?: boolean;
  decimalPlaces?: number;
  currencySymbol?: string;
}

export const NumericInput: React.FC<NumericInputProps> = ({
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
  const stringValue = value != null ? String(value) : '';

  // 1. Keystroke Suppression at Event Horizon
  const handleBeforeInput = (e: React.FormEvent<HTMLInputElement>) => {
    const inputChar = (e.nativeEvent as InputEvent)?.data ?? (e as unknown as { data?: string })?.data;
    if (!inputChar) return;

    // Decimal point handling
    if (allowDecimal && inputChar === '.') {
      if (stringValue.includes('.')) {
        e.preventDefault();
      }
      return;
    }

    // Only numeric digits allowed
    if (!/^\d+$/.test(inputChar)) {
      e.preventDefault();
      return;
    }

    // Enforce decimal places limit if typing after the decimal point
    const target = e.target as HTMLInputElement;
    const selStart = target.selectionStart ?? stringValue.length;
    const dotIndex = stringValue.indexOf('.');
    if (allowDecimal && dotIndex !== -1 && selStart > dotIndex) {
      const decPart = stringValue.slice(dotIndex + 1);
      const isReplacingSelection = (target.selectionEnd ?? selStart) > selStart;
      if (decPart.length >= decimalPlaces && !isReplacingSelection) {
        e.preventDefault();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow navigation, control, and editing keys
    if (
      ['Backspace', 'Tab', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', 'Escape'].includes(e.key) ||
      e.ctrlKey ||
      e.metaKey
    ) {
      return;
    }

    if (allowDecimal && e.key === '.') {
      if (stringValue.includes('.')) {
        e.preventDefault();
      }
      return;
    }

    // Suppress non-digits
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  // 2. Clipboard Paste Interception & Sanitization
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text/plain');
    const sanitized = SecurityValidationEngine.sanitizeNumeric(pastedText, {
      allowDecimal,
      decimalPlaces,
    });
    if (onChange) {
      onChange(sanitized);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = SecurityValidationEngine.sanitizeNumeric(e.target.value, {
      allowDecimal,
      decimalPlaces,
    });
    if (onChange) {
      onChange(sanitized);
    }
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
            value={stringValue}
            disabled={disabled}
            placeholder={placeholder}
            onBeforeInput={handleBeforeInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onChange={handleChange}
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
              ...style,
            }}
          />
        </div>
      )}
    </BaseSecureInput>
  );
};

export interface CurrencyInputProps extends NumericInputProps {
  currencySymbol?: string;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = (props) => (
  <NumericInput
    {...props}
    allowDecimal={true}
    decimalPlaces={2}
    currencySymbol={props.currencySymbol ?? '₹'}
  />
);
