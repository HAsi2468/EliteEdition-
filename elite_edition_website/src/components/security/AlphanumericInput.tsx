import React from 'react';
import { BaseSecureInput } from './BaseSecureInput';
import { SecurityValidationEngine } from '../../security/validationEngine';

export interface AlphanumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string | null;
  onChange?: (value: string) => void;
  label?: string;
  error?: string | null;
  helperText?: string;
  allowSpaces?: boolean;
}

export const AlphanumericInput: React.FC<AlphanumericInputProps> = ({
  value,
  onChange,
  label,
  error,
  helperText,
  allowSpaces = true,
  placeholder,
  disabled,
  style = {},
  ...rest
}) => {
  const stringValue = value != null ? String(value) : '';

  // 1. Keystroke Suppression at Event Horizon
  const handleBeforeInput = (e: React.FormEvent<HTMLInputElement>) => {
    const inputChar = (e.nativeEvent as InputEvent)?.data ?? (e as unknown as { data?: string })?.data;
    if (!inputChar) return;

    // Strict allowlist: letters, digits, underscore, hyphen, and optional whitespace
    const validPattern = allowSpaces ? /^[a-zA-Z0-9_\-\s]+$/ : /^[a-zA-Z0-9_\-]+$/;
    if (!validPattern.test(inputChar)) {
      e.preventDefault();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Permit navigation, control, selection, and clipboard shortcuts
    if (
      ['Backspace', 'Tab', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', 'Escape'].includes(e.key) ||
      e.ctrlKey ||
      e.metaKey
    ) {
      return;
    }

    if (allowSpaces && e.key === ' ') {
      return;
    }

    // Suppress symbols: quotes, semicolons, slashes, angle brackets, backticks
    if (!/^[a-zA-Z0-9_\-]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  // 2. Clipboard Paste Hygiene: strip injection tokens before updating state
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text/plain');
    const sanitized = SecurityValidationEngine.sanitizeAlphanumeric(pasted, allowSpaces);
    if (onChange) {
      onChange(sanitized);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = SecurityValidationEngine.sanitizeAlphanumeric(e.target.value, allowSpaces);
    if (onChange) {
      onChange(sanitized);
    }
  };

  return (
    <BaseSecureInput label={label} error={error} helperText={helperText} isValid={!error}>
      {(a11yProps) => (
        <input
          {...rest}
          {...a11yProps}
          type="text"
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
