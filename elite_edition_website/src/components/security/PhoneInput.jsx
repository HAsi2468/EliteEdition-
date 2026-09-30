import React from 'react';
import { BaseSecureInput } from './BaseSecureInput';
import { SecurityValidationEngine } from '../../security/validationEngine';

export const PhoneInput = ({
  value,
  onChange,
  label,
  error,
  helperText,
  disabled,
  placeholder = '+1 (555) 000-0000',
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

    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text/plain');
    const formatted = SecurityValidationEngine.formatUSPhone(pasted);
    const raw = formatted.replace(/\D/g, '');
    if (onChange) onChange(formatted, raw);
  };

  const handleChange = (e) => {
    const rawInput = e.target.value;
    const formatted = SecurityValidationEngine.formatUSPhone(rawInput);
    const raw = formatted.replace(/\D/g, '');
    if (onChange) onChange(formatted, raw);
  };

  return (
    <BaseSecureInput label={label} error={error} helperText={helperText} isValid={!error}>
      {(a11yProps) => (
        <input
          {...rest}
          {...a11yProps}
          type="tel"
          inputMode="tel"
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
