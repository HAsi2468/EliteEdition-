import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import './MaskedInputField.css';

/**
 * Format string according to GSTIN mask: 24ABCDE1234F1Z5
 * Format: 2 digits (state), 5 letters (PAN), 4 digits, 1 letter, 1 digit/letter, 'Z', 1 checksum
 */
export function formatGstin(raw) {
  if (!raw) return '';
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
  return cleaned;
}

export function validateGstin(val) {
  if (!val) return true;
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return regex.test(val);
}

/**
 * Format string according to Indian Vehicle Registration: GJ-05-AB-1234
 */
export function formatVehicleReg(raw) {
  if (!raw) return '';
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  
  let formatted = '';
  // Part 1: State code (2 letters)
  if (cleaned.length > 0) {
    formatted += cleaned.slice(0, 2);
  }
  // Part 2: RTO code (2 digits)
  if (cleaned.length > 2) {
    formatted += '-' + cleaned.slice(2, 4);
  }
  // Part 3: Series (1-2 letters)
  if (cleaned.length > 4) {
    // Find where digits start for last part
    const rest = cleaned.slice(4);
    const lettersMatch = rest.match(/^[A-Z]+/);
    if (lettersMatch) {
      const letters = lettersMatch[0].slice(0, 2);
      formatted += '-' + letters;
      const digits = rest.slice(letters.length).slice(0, 4);
      if (digits.length > 0) {
        formatted += '-' + digits;
      }
    } else {
      formatted += '-' + rest.slice(0, 4);
    }
  }

  return formatted;
}

export function validateVehicleReg(val) {
  if (!val) return true;
  const regex = /^[A-Z]{2}-[0-9]{2}-[A-Z]{1,2}-[0-9]{4}$/;
  return regex.test(val);
}

/**
 * Format currency / decimal amount: 1420.5 -> "1,420.50"
 */
export function formatCurrencyDecimal(num, decimals = 2) {
  if (num === null || num === undefined || num === '') return '';
  const n = typeof num === 'number' ? num : parseFloat(String(num).replace(/,/g, ''));
  if (isNaN(n)) return '';
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * MaskedInputField
 * 
 * Enterprise Smart Masked Input Component:
 * - 'gstin': Tax / GSTIN code formatting & validation
 * - 'vehicle': Vehicle registration formatting (GJ-05-AB-1234)
 * - 'currency' / 'meterage': Decimal formatting with tabular numerals
 */
export function MaskedInputField({
  maskType = 'text', // 'gstin' | 'vehicle' | 'currency' | 'meterage'
  value = '',
  onChange = () => {},
  placeholder = '',
  decimals = 2,
  required = false,
  disabled = false,
  className = '',
  style = {}
}) {
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isValid, setIsValid] = useState(true);

  // Sync external value
  useEffect(() => {
    if (!isFocused) {
      if (maskType === 'gstin') {
        const formatted = formatGstin(String(value || ''));
        setDisplayValue(formatted);
        setIsValid(!required && !formatted ? true : validateGstin(formatted));
      } else if (maskType === 'vehicle') {
        const formatted = formatVehicleReg(String(value || ''));
        setDisplayValue(formatted);
        setIsValid(!required && !formatted ? true : validateVehicleReg(formatted));
      } else if (maskType === 'currency' || maskType === 'meterage') {
        setDisplayValue(formatCurrencyDecimal(value, decimals));
        setIsValid(true);
      } else {
        setDisplayValue(String(value || ''));
      }
    }
  }, [value, isFocused, maskType, decimals, required]);

  const handleChange = (e) => {
    const rawInput = e.target.value;

    if (maskType === 'gstin') {
      const formatted = formatGstin(rawInput);
      setDisplayValue(formatted);
      onChange(formatted);
      if (formatted.length === 15) {
        setIsValid(validateGstin(formatted));
      }
    } else if (maskType === 'vehicle') {
      const formatted = formatVehicleReg(rawInput);
      setDisplayValue(formatted);
      onChange(formatted);
    } else if (maskType === 'currency' || maskType === 'meterage') {
      // While typing, allow digits and decimal point only
      const sanitized = rawInput.replace(/[^0-9.-]/g, '');
      setDisplayValue(sanitized);
      const parsedNum = parseFloat(sanitized);
      onChange(isNaN(parsedNum) ? 0 : parsedNum);
    } else {
      setDisplayValue(rawInput);
      onChange(rawInput);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (maskType === 'gstin') {
      setIsValid(!required && !displayValue ? true : validateGstin(displayValue));
    } else if (maskType === 'vehicle') {
      setIsValid(!required && !displayValue ? true : validateVehicleReg(displayValue));
    } else if (maskType === 'currency' || maskType === 'meterage') {
      const num = parseFloat(String(displayValue).replace(/,/g, ''));
      if (!isNaN(num)) {
        setDisplayValue(formatCurrencyDecimal(num, decimals));
      }
    }
  };

  const handleFocus = (e) => {
    setIsFocused(true);
    if (maskType === 'currency' || maskType === 'meterage') {
      // Strip formatting commas for easier inline editing
      const stripped = String(displayValue).replace(/,/g, '');
      setDisplayValue(stripped);
    }
  };

  return (
    <div className={`masked-input-wrapper ${className}`} style={style}>
      <div className="masked-input-container">
        <input
          type="text"
          className={`masked-input-field ${!isValid ? 'is-invalid' : ''} ${isValid && displayValue && maskType === 'gstin' ? 'is-valid' : ''}`}
          value={displayValue}
          placeholder={placeholder || (maskType === 'gstin' ? '24ABCDE1234F1Z5' : maskType === 'vehicle' ? 'GJ-05-AB-1234' : '0.00')}
          disabled={disabled}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />

        {displayValue && (maskType === 'gstin' || maskType === 'vehicle') && (
          <span className="masked-input-status-icon">
            {isValid ? (
              <CheckCircle2 size={16} color="#10b981" />
            ) : (
              <AlertCircle size={16} color="#ef4444" />
            )}
          </span>
        )}
      </div>

      {!isValid && (
        <p className="masked-input-error-msg">
          {maskType === 'gstin' ? 'Invalid 15-character GSTIN format' : 'Invalid Vehicle Reg format (e.g. GJ-05-AB-1234)'}
        </p>
      )}
    </div>
  );
}

export default MaskedInputField;
