import React, { useState } from 'react';
import { BaseSecureInput } from './BaseSecureInput';
import { SecurityValidationEngine } from '../../security/validationEngine';

export interface DateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string | null;
  onChange?: (maskedValue: string, isValid: boolean) => void;
  label?: string;
  error?: string | null;
  helperText?: string;
}

export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  label,
  error: externalError,
  helperText = 'Format: YYYY-MM-DD',
  disabled,
  style = {},
  ...rest
}) => {
  const [internalError, setInternalError] = useState<string | null>(null);
  const stringValue = value != null ? String(value) : '';

  const formatDateMask = (raw: string): string => {
    const digits = String(raw || '').replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  };

  const processChange = (raw: string) => {
    const masked = formatDateMask(raw);

    if (masked.length === 10) {
      const isValid = SecurityValidationEngine.isValidCalendarDate(masked);
      if (!isValid) {
        setInternalError('Invalid calendar date (check month bounds or leap year).');
        if (onChange) onChange(masked, false);
      } else {
        setInternalError(null);
        if (onChange) onChange(masked, true);
      }
    } else {
      setInternalError(null);
      if (onChange) onChange(masked, false);
    }
  };

  const handleBeforeInput = (e: React.FormEvent<HTMLInputElement>) => {
    const inputChar = (e.nativeEvent as InputEvent)?.data ?? (e as unknown as { data?: string })?.data;
    if (!inputChar) return;

    // Only allow numeric digits for date input (delimiters are auto-inserted)
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

    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text/plain');
    processChange(pasted);
  };

  const activeError = externalError || internalError || undefined;

  return (
    <BaseSecureInput label={label} error={activeError} helperText={helperText} isValid={!activeError}>
      {(a11yProps) => (
        <input
          {...rest}
          {...a11yProps}
          type="text"
          placeholder="YYYY-MM-DD"
          maxLength={10}
          value={stringValue}
          disabled={disabled}
          onBeforeInput={handleBeforeInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onChange={(e) => processChange(e.target.value)}
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
