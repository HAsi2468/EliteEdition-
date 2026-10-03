// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  NumericInput,
  CurrencyInput,
  PhoneInput,
  AlphanumericInput,
  DateInput,
  SafeHtml,
} from '../components/security';

describe('Phase 1: Controlled Input Primitives & Keystroke Interceptors', () => {
  // --------------------------------------------------------------------------
  // 1. NumericInput & CurrencyInput
  // --------------------------------------------------------------------------
  describe('NumericInput & CurrencyInput', () => {
    it('allows typing digits and disallows non-numeric characters on keystroke', async () => {
      const user = userEvent.setup();

      const Wrapper = () => {
        const [val, setVal] = useState('');
        return <NumericInput label="Quantity" value={val} onChange={setVal} />;
      };
      render(<Wrapper />);

      const input = screen.getByLabelText(/Quantity/i) as HTMLInputElement;

      // Type digits mixed with injection payloads and letters
      await user.type(input, "123' OR 1=1; <script>45");

      // Letters, quotes, semicolons, and angle brackets are blocked at keystroke level
      expect(input.value).toBe('1231145');
      expect(input.value).not.toContain("'");
      expect(input.value).not.toContain('<');
      expect(input.value).not.toContain('>');
      expect(input.value).not.toContain(';');
      expect(input.value).not.toContain('OR');
      expect(input.value).not.toContain('script');
    });

    it('enforces single decimal point and max 2 decimal places when allowDecimal is true', async () => {
      const user = userEvent.setup();

      const Wrapper = () => {
        const [val, setVal] = useState('');
        return <NumericInput label="Rate" allowDecimal={true} decimalPlaces={2} value={val} onChange={setVal} />;
      };
      render(<Wrapper />);

      const input = screen.getByLabelText(/Rate/i) as HTMLInputElement;

      // Type multiple decimal points
      await user.type(input, '12.34.56.78');

      // Only the first decimal point and max 2 decimal places are retained
      expect(input.value).toBe('12.34');
    });

    it('blocks decimal point entirely when allowDecimal is false', async () => {
      const user = userEvent.setup();

      const Wrapper = () => {
        const [val, setVal] = useState('');
        return <NumericInput label="IntegerOnly" allowDecimal={false} value={val} onChange={setVal} />;
      };
      render(<Wrapper />);

      const input = screen.getByLabelText(/IntegerOnly/i) as HTMLInputElement;
      await user.type(input, '12.34');

      expect(input.value).toBe('1234');
      expect(input.value).not.toContain('.');
    });

    it('sanitizes pasted payloads stripping SQL/XSS injection tokens and enforcing 2 decimal places', () => {
      const handleChange = vi.fn();
      render(<NumericInput label="Price" allowDecimal={true} decimalPlaces={2} onChange={handleChange} />);

      const input = screen.getByLabelText(/Price/i);
      const dirtyPaste = "123.456' OR '1'='1<script>alert(1)</script>";

      fireEvent.paste(input, {
        clipboardData: {
          getData: () => dirtyPaste,
        },
      });

      expect(handleChange).toHaveBeenCalledWith('123.45');
    });

    it('CurrencyInput defaults to decimal precision with currency symbol', () => {
      const handleChange = vi.fn();
      render(<CurrencyInput label="Amount" value="999.50" onChange={handleChange} currencySymbol="₹" />);

      expect(screen.getByText('₹')).toBeDefined();
      const input = screen.getByLabelText(/Amount/i) as HTMLInputElement;
      expect(input.value).toBe('999.50');
      expect(input.inputMode).toBe('decimal');
    });
  });

  // --------------------------------------------------------------------------
  // 2. PhoneInput
  // --------------------------------------------------------------------------
  describe('PhoneInput', () => {
    it('blocks quotes, angle brackets, semicolons, and non-numeric keystrokes during user typing', async () => {
      const user = userEvent.setup();

      const Wrapper = () => {
        const [val, setVal] = useState('');
        return <PhoneInput label="Mobile" value={val} onChange={(formatted) => setVal(formatted)} />;
      };
      render(<Wrapper />);

      const input = screen.getByLabelText(/Mobile/i) as HTMLInputElement;

      // Attempt typing phone number with malicious script and quote injections
      await user.type(input, "415'555<script>;0199");

      // Result should only format clean digits without quotes or script tokens
      expect(input.value).toBe('+1 (415) 555-0199');
      expect(input.value).not.toContain("'");
      expect(input.value).not.toContain('<');
      expect(input.value).not.toContain('>');
      expect(input.value).not.toContain(';');
      expect(input.value).not.toContain('script');
    });

    it('sanitizes pasted phone payloads and formats into standardized mask', () => {
      const handleChange = vi.fn();
      render(<PhoneInput label="Phone" onChange={handleChange} />);

      const input = screen.getByLabelText(/Phone/i);
      const dirtyPaste = '+1 (415) 555-0199 <script>alert(1)</script>';

      fireEvent.paste(input, {
        clipboardData: {
          getData: () => dirtyPaste,
        },
      });

      expect(handleChange).toHaveBeenCalledWith('+1 (415) 555-0199', '14155550199');
    });

    it('supports E.164 formatting mode', () => {
      const handleChange = vi.fn();
      render(<PhoneInput label="International" mode="e164" onChange={handleChange} />);

      const input = screen.getByLabelText(/International/i);
      fireEvent.change(input, { target: { value: '+91 98765 43210' } });

      expect(handleChange).toHaveBeenCalledWith('+919876543210', '919876543210');
    });
  });

  // --------------------------------------------------------------------------
  // 3. AlphanumericInput
  // --------------------------------------------------------------------------
  describe('AlphanumericInput', () => {
    it('intercepts keystrokes and allows strictly ^[a-zA-Z0-9_-\\s]+$, completely eliminating quotes and < >', async () => {
      const user = userEvent.setup();

      const Wrapper = () => {
        const [val, setVal] = useState('');
        return <AlphanumericInput label="Job Card ID" value={val} onChange={setVal} />;
      };
      render(<Wrapper />);

      const input = screen.getByLabelText(/Job Card ID/i) as HTMLInputElement;

      // Type complex injection vector with single quote, double quote, semicolon, angle brackets
      await user.type(input, "JC-2026_01'; <script>alert(1)</script>");

      // Quotes, semicolons, angle brackets, and parentheses are eliminated at entry
      expect(input.value).toBe('JC-2026_01 scriptalert1script');
      expect(input.value).not.toContain("'");
      expect(input.value).not.toContain('"');
      expect(input.value).not.toContain(';');
      expect(input.value).not.toContain('<');
      expect(input.value).not.toContain('>');
      expect(input.value).not.toContain('(');
      expect(input.value).not.toContain(')');
    });

    it('intercepts onKeyDown to block disallowed keys directly', () => {
      const handleChange = vi.fn();
      render(<AlphanumericInput label="SKU" onChange={handleChange} />);

      const input = screen.getByLabelText(/SKU/i);

      // Semicolon
      expect(fireEvent.keyDown(input, { key: ';' })).toBe(false);

      // Quote
      expect(fireEvent.keyDown(input, { key: "'" })).toBe(false);

      // Angle bracket
      expect(fireEvent.keyDown(input, { key: '<' })).toBe(false);

      // Allowed alphanumeric key
      expect(fireEvent.keyDown(input, { key: 'a' })).toBe(true);
    });

    it('cleanses pasted text containing SQL injection and XSS payloads', () => {
      const handleChange = vi.fn();
      render(<AlphanumericInput label="Search Lot" onChange={handleChange} />);

      const input = screen.getByLabelText(/Search Lot/i);
      const malicious = "admin'; DROP TABLE users; -- <script>alert('xss')</script>";

      fireEvent.paste(input, {
        clipboardData: {
          getData: () => malicious,
        },
      });

      expect(handleChange).toHaveBeenCalledWith('admin DROP TABLE users -- scriptalertxssscript');
      expect(handleChange.mock.calls[0][0]).not.toContain("'");
      expect(handleChange.mock.calls[0][0]).not.toContain(";");
      expect(handleChange.mock.calls[0][0]).not.toContain("<");
      expect(handleChange.mock.calls[0][0]).not.toContain(">");
    });
  });

  // --------------------------------------------------------------------------
  // 4. DateInput
  // --------------------------------------------------------------------------
  describe('DateInput', () => {
    it('enforces numeric input and auto-formats YYYY-MM-DD boundary mask on user typing', async () => {
      const user = userEvent.setup();

      const Wrapper = () => {
        const [val, setVal] = useState('');
        return <DateInput label="Dispatch Date" value={val} onChange={(masked) => setVal(masked)} />;
      };
      render(<Wrapper />);

      const input = screen.getByLabelText(/Dispatch Date/i) as HTMLInputElement;

      // Type date digits with attempted injection characters
      await user.type(input, "2026'09<30");

      expect(input.value).toBe('2026-09-30');
      expect(input.value).not.toContain("'");
      expect(input.value).not.toContain('<');
    });

    it('validates calendar date boundaries and detects leap year discrepancies', () => {
      const handleChange = vi.fn();
      const { rerender } = render(<DateInput label="Target Date" onChange={handleChange} />);

      const input = screen.getByLabelText(/Target Date/i);

      // 2024 is a leap year -> Feb 29 is valid
      fireEvent.change(input, { target: { value: '20240229' } });
      expect(handleChange).toHaveBeenLastCalledWith('2024-02-29', true);

      // 2026 is NOT a leap year -> Feb 29 is invalid
      fireEvent.change(input, { target: { value: '20260229' } });
      expect(handleChange).toHaveBeenLastCalledWith('2026-02-29', false);
      expect(screen.getByRole('alert')).toBeDefined();

      // April 31 is invalid (April has only 30 days)
      fireEvent.change(input, { target: { value: '20260431' } });
      expect(handleChange).toHaveBeenLastCalledWith('2026-04-31', false);
    });

    it('sanitizes pasted dates with trailing injection characters', () => {
      const handleChange = vi.fn();
      render(<DateInput label="Event Date" onChange={handleChange} />);

      const input = screen.getByLabelText(/Event Date/i);
      const dirtyDate = "2026-10-15'; DROP TABLE--<script>";

      fireEvent.paste(input, {
        clipboardData: {
          getData: () => dirtyDate,
        },
      });

      expect(handleChange).toHaveBeenCalledWith('2026-10-15', true);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Rich Text Sanitizer Component (<SafeHtml />) - SEC-INJ-02
  // --------------------------------------------------------------------------
  describe('SafeHtml (<SafeHtml />) - SEC-INJ-02', () => {
    it('SEC-INJ-02: neutralizes <script>alert(1)</script> and <img src=x onerror=stealToken()> strictly as inert text without executing scripts', () => {
      const maliciousHtml = '<p>Normal text</p><script>alert(1)</script><img src="x" onerror="stealToken()">';
      const { container } = render(<SafeHtml html={maliciousHtml} />);

      // Verify <script> tag is completely eliminated from DOM
      expect(container.querySelector('script')).toBeNull();

      // Verify <img> tag is either removed or stripped of onerror attribute
      const img = container.querySelector('img');
      if (img) {
        expect(img.getAttribute('onerror')).toBeNull();
      }

      // Verify inert safe text rendered
      expect(container.innerHTML).toContain('<p>Normal text</p>');
      expect(container.innerHTML).not.toContain('stealToken()');
      expect(container.innerHTML).not.toContain('<script>');
    });

    it('automatically forces rel="noopener noreferrer" and target="_blank" on external hyperlinks', () => {
      const externalLinkHtml = '<a href="https://example.com/external-report">View Report</a>';
      const { container } = render(<SafeHtml html={externalLinkHtml} />);

      const anchor = container.querySelector('a');
      expect(anchor).not.toBeNull();
      expect(anchor?.getAttribute('target')).toBe('_blank');
      expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
      expect(anchor?.getAttribute('href')).toBe('https://example.com/external-report');
    });

    it('strips dangerous pseudo-protocols like javascript:, data:, and vbscript: from anchors', () => {
      const dirtyLink = '<a href="javascript:alert(document.cookie)">Malicious Link</a>';
      const { container } = render(<SafeHtml html={dirtyLink} />);

      const anchor = container.querySelector('a');
      expect(anchor?.getAttribute('href')).toBeNull();
    });

    it('strips all dangerous tags like <iframe>, <object>, <embed>, and <style>', () => {
      const dangerousTags = `
        <iframe src="https://attacker.com/leak"></iframe>
        <object data="malware.swf"></object>
        <embed src="exploit.pdf"></embed>
        <style>body { display: none; }</style>
        <b>Safe Bold Content</b>
      `;
      const { container } = render(<SafeHtml html={dangerousTags} />);

      expect(container.querySelector('iframe')).toBeNull();
      expect(container.querySelector('object')).toBeNull();
      expect(container.querySelector('embed')).toBeNull();
      expect(container.querySelector('style')).toBeNull();
      expect(container.querySelector('b')?.textContent).toBe('Safe Bold Content');
    });
  });
});
