import React, { useState } from 'react';
import { BaseSecureInput } from './BaseSecureInput';
import { SecurityValidationEngine } from '../../security/validationEngine';

export const DateInput = ({
  value,
  onChange,
  label,
  error: externalError,
  helperText = 'Format: YYYY-MM-DD',
  disabled,
  style = {},
  ...rest
}) => {
  const [internalError, setInternalError] = useState(null);

  const formatDateMask = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  };

  const processChange = (raw) => {
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
          value={value != null ? value : ''}
          disabled={disabled}
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
            ...style
          }}
        />
      )}
    </BaseSecureInput>
  );
};
