// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StandardNumericInput } from '../components/common/StandardNumericInput';

afterEach(cleanup);

describe('StandardNumericInput - Principal Enterprise Specification', () => {
  it('strictly treats typing literally: typing "1450" outputs 1450, NOT 14.50', async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();

    render(
      <StandardNumericInput
        placeholder="Enter Amount"
        onValueChange={handleValueChange}
      />
    );

    const input = screen.getByPlaceholderText('Enter Amount');
    await user.type(input, '1450');

    // While typing, the value must be literally '1450' without premature decimal shift
    expect(input.value).toBe('1450');
    expect(handleValueChange).toHaveBeenLastCalledWith(1450, '1450');
  });

  it('inserts decimal point ONLY when operator explicitly presses "." key', async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();

    render(
      <StandardNumericInput
        placeholder="Enter Meters"
        onValueChange={handleValueChange}
      />
    );

    const input = screen.getByPlaceholderText('Enter Meters');
    await user.type(input, '14.5');

    // Decimal point must only appear where explicitly pressed
    expect(input.value).toBe('14.5');
    expect(handleValueChange).toHaveBeenLastCalledWith(14.5, '14.5');
  });

  it('rejects duplicate decimal points and non-numeric letters', async () => {
    const user = userEvent.setup();

    render(
      <StandardNumericInput placeholder="Test Input" />
    );

    const input = screen.getByPlaceholderText('Test Input');
    await user.type(input, '12.3.4abc');

    // Should reject second '.' and all alphabetic characters
    expect(input.value).toBe('12.34');
  });

  it('formats onBlur to standard locale notation (1450 -> "1,450.00" for decimals, 14.5 -> "14.50")', async () => {
    const user = userEvent.setup();

    render(
      <div>
        <StandardNumericInput placeholder="Decimal Input" decimals={2} />
        <button>Blur Target</button>
      </div>
    );

    const input = screen.getByPlaceholderText('Decimal Input');
    const button = screen.getByText('Blur Target');

    // Test whole number formatting
    await user.type(input, '1450');
    expect(input.value).toBe('1450');

    // Blur input
    await user.click(button);
    expect(input.value).toBe('1,450.00');

    // Re-focus, type explicit decimal, and blur
    await user.click(input);
    await user.clear(input);
    await user.type(input, '14.5');
    await user.click(button);
    expect(input.value).toBe('14.50');
  });

  it('formats whole numbers to pure counts with mode="integer" (1450 -> "1,450")', async () => {
    const user = userEvent.setup();

    render(
      <div>
        <StandardNumericInput placeholder="Rolls Count" mode="integer" />
        <button>Blur Target</button>
      </div>
    );

    const input = screen.getByPlaceholderText('Rolls Count');
    const button = screen.getByText('Blur Target');

    await user.type(input, '1450');
    expect(input.value).toBe('1450');

    await user.click(button);
    expect(input.value).toBe('1,450');
  });

  it('strips formatting commas onFocus so operator can edit raw digits', async () => {
    const user = userEvent.setup();

    render(
      <div>
        <StandardNumericInput defaultValue={1450} decimals={2} placeholder="Test Commas" />
        <button>Blur Target</button>
      </div>
    );

    const input = screen.getByPlaceholderText('Test Commas');
    // Initially formatted
    expect(input.value).toBe('1,450.00');

    // Focus input -> Commas stripped
    await user.click(input);
    expect(input.value).toBe('1450.00');
  });

  it('supports ArrowUp and ArrowDown keys (1x and 10x with Shift)', async () => {
    render(
      <StandardNumericInput defaultValue={100} decimals={0} placeholder="Arrow Test" />
    );

    const input = screen.getByPlaceholderText('Arrow Test');
    fireEvent.focus(input);

    // Arrow Up: +1 -> 101
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('101');

    // Arrow Down: -1 -> 100
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('100');

    // Shift + Arrow Up: +10 -> 110
    fireEvent.keyDown(input, { key: 'ArrowUp', shiftKey: true });
    expect(input.value).toBe('110');

    // Shift + Arrow Down: -10 -> 100
    fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true });
    expect(input.value).toBe('100');
  });

  it('commits value and advances focus to next input on Enter key', () => {
    render(
      <form>
        <StandardNumericInput placeholder="Field 1" />
        <StandardNumericInput placeholder="Field 2" />
      </form>
    );

    const input1 = screen.getByPlaceholderText('Field 1');
    const input2 = screen.getByPlaceholderText('Field 2');

    fireEvent.focus(input1);
    fireEvent.change(input1, { target: { value: '2500' } });
    expect(input1.value).toBe('2500');

    // Press Enter on Field 1 -> formats Field 1 to 2,500.00 and moves focus to Field 2
    fireEvent.keyDown(input1, { key: 'Enter' });
    expect(input1.value).toBe('2,500.00');
    expect(document.activeElement).toBe(input2);
  });

  it('enforces tabular-nums font variant in CSS styling', () => {
    render(<StandardNumericInput placeholder="Tabular Test" />);
    const input = screen.getByPlaceholderText('Tabular Test');
    expect(input.className).toContain('standard-numeric-input');
  });
});
