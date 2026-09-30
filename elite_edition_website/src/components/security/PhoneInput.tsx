import React from 'react';
import { BaseSecureInput } from './BaseSecureInput';
import { SecurityValidationEngine } from '../../security/validationEngine';

export interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string | null;
  onChange?: (formatted: string, rawDigits: string) => void;
  label?: string;
  error?: string | null;
  helperText?: string;
  mode?: 'mask' | 'e164';
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  label,
  error,
  helperText,
  disabled,
  placeholder = '+1 (555) 000-0000',
  mode = 'mask',
  style = {},
  ...rest
}) => {
  const stringValue = value != null ? String(value) : '';

  // 1. Keystroke Interception
  const handleBeforeInput = (e: React.FormEvent<HTMLInputElement>) => {
    const inputChar = (e.nativeEvent as InputEvent)?.data ?? (e as unknown as { data?: string })?.data;
    if (!inputChar) return;

    // In E164 mode, allow leading '+' if at index 0
    if (mode === 'e164' && inputChar === '+') {
      const target = e.target as HTMLInputElement;
      if ((target.selectionStart ?? 0) === 0 && !stringValue.includes('+')) {
        return;
      }
      e.preventDefault();
      return;
    }

    // Suppress quotes, angle brackets, semicolons, and non-digits
    if (!/^\d+$/.test(inputChar)) {
      e.preventDefault();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      ['Backspace', 'Tab', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', 'Escape'].includes(e.key) ||
      e.ctrlKey ||
      e.metaKey
    ) {
      return;
    }

    if (mode === 'e164' && e.key === '+') {
      const target = e.target as HTMLInputElement;
      if ((target.selectionStart ?? 0) === 0 && !stringValue.includes('+')) {
        return;
      }
      e.preventDefault();
      return;
    }

    // Block quotes, angle brackets, semicolons, letters, symbols
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  // 2. Clipboard Paste Hygiene
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text/plain');

    if (mode === 'e164') {
      const formatted = SecurityValidationEngine.formatE164Phone(pasted);
      const rawDigits = formatted.replace(/\D/g, '');
      if (onChange) onChange(formatted, rawDigits);
    } else {
      const formatted = SecurityValidationEngine.formatUSPhone(pasted);
      const rawDigits = formatted.replace(/\D/g, '');
      if (onChange) onChange(formatted, rawDigits);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawInput = e.target.value;

    if (mode === 'e164') {
      const formatted = SecurityValidationEngine.formatE164Phone(rawInput);
      const rawDigits = formatted.replace(/\D/g, '');
      if (onChange) onChange(formatted, rawDigits);
    } else {
      const formatted = SecurityValidationEngine.formatUSPhone(rawInput);
      const rawDigits = formatted.replace(/\D/g, '');
      if (onChange) onChange(formatted, rawDigits);
    }
  };

  return (
    <BaseSecureInput label={label} error={error} helperText={helperText} isValid={!error}>
      {(a11yProps) => (
        <input
          {...rest}
          {...a11yProps}
          type="tel"
          inputMode="tel"
          value={stringValue}
          disabled={disabled}
          placeholder={mode === 'e164' ? '+15550000000' : placeholder}
          onBeforeInput={handleBeforeInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onChange={handleChange}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '6px',
            border: a11yProps['aria-invalid'] ? '1px solid #ef4444' : '1px solid var(--border-color, #cbd5e1)',
            background: 'var(--bg-card, #ffffff)',
            color: 'var(--text-primary, #0f172a)',
            outline: 'none',
            fontSize: '0.9rem',
            ...style,
          }}
        />
      )}
    </BaseSecureInput>
  );
};
