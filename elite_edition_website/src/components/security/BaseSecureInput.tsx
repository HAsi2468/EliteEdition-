import React, { useId } from 'react';

export interface BaseSecureInputChildProps {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby'?: string;
  'aria-required'?: boolean;
  className: string;
}

export interface BaseSecureInputProps {
  label?: string;
  helperText?: string;
  error?: string | null;
  isValid?: boolean;
  required?: boolean;
  id?: string;
  children: (props: BaseSecureInputChildProps) => React.ReactNode;
}

/**
 * Enterprise Base Secure Input Primitive
 * Provides WCAG 2.1 AA accessible wrapping, aria-invalid, and aria-describedby linkage.
 */
export const BaseSecureInput: React.FC<BaseSecureInputProps> = ({
  label,
  helperText,
  error,
  isValid = true,
  required = false,
  id: externalId,
  children,
}) => {
  const generatedId = useId();
  const inputId = externalId || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  const hasError = !isValid || !!error;
  const ariaDescribedBy = hasError ? errorId : helperText ? helperId : undefined;

  const baseInputClassName = `secure-input-field ${
    hasError ? 'border-red-500 focus:ring-red-400' : 'border-slate-300 focus:ring-blue-500'
  }`;

  return (
    <div
      className="secure-input-group"
      style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}
    >
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: hasError ? '#b91c1c' : 'var(--text-primary, #1e293b)',
          }}
        >
          {label}{' '}
          {required && (
            <span aria-hidden="true" style={{ color: '#ef4444' }}>
              *
            </span>
          )}
        </label>
      )}

      {children({
        id: inputId,
        'aria-invalid': hasError,
        'aria-describedby': ariaDescribedBy,
        'aria-required': required,
        className: baseInputClassName,
      })}

      {hasError && error && (
        <div
          id={errorId}
          role="alert"
          style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 600, marginTop: '2px' }}
        >
          {error}
        </div>
      )}

      {!hasError && helperText && (
        <div
          id={helperId}
          style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}
        >
          {helperText}
        </div>
      )}
    </div>
  );
};
