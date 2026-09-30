import React from 'react';
import { BaseSecureInput } from './BaseSecureInput';
import { SecurityValidationEngine } from '../../security/validationEngine';

export const AlphanumericInput = ({
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
  const handleKeyDown = (e) => {
    if (
      ['Backspace', 'Tab', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'].includes(e.key) ||
      (e.ctrlKey || e.metaKey)
    ) {
      return;
    }

    if (allowSpaces && e.key === ' ') {
      return;
    }

    // Suppress symbols: quotes, semicolons, slashes, angle brackets
    if (!/^[a-zA-Z0-9_\-]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text/plain');
    const sanitized = SecurityValidationEngine.sanitizeAlphanumeric(pasted, allowSpaces);
    if (onChange) onChange(sanitized);
  };

  const handleChange = (e) => {
    const sanitized = SecurityValidationEngine.sanitizeAlphanumeric(e.target.value, allowSpaces);
    if (onChange) onChange(sanitized);
  };

  return (
    <BaseSecureInput label={label} error={error} helperText={helperText} isValid={!error}>
      {(a11yProps) => (
        <input
          {...rest}
          {...a11yProps}
          type="text"
          value={value != null ? value : ''}
          disabled={disabled}
          placeholder={placeholder}
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
            ...style
          }}
        />
      )}
    </BaseSecureInput>
  );
};
