// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGridNavigation } from './useGridNavigation';
import { HotkeyProvider } from './HotkeyContext';
import React from 'react';

describe('useGridNavigation', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <HotkeyProvider>{children}</HotkeyProvider>
  );

  const columns = [
    { key: 'col1', header: 'Column 1', isEditable: true },
    { key: 'col2', header: 'Column 2', isEditable: true, type: 'number' as const },
    { key: 'col3', header: 'Column 3', isEditable: true },
  ];

  it('initializes with activeCell at [0, 0] and correct roving tabindex properties', () => {
    const { result } = renderHook(
      () =>
        useGridNavigation({
          columns,
          rowCount: 3,
        }),
      { wrapper }
    );

    expect(result.current.activeCell).toEqual({ row: 0, col: 0 });

    const cell00Props = result.current.getCellProps(0, 0);
    expect(cell00Props.tabIndex).toBe(0);
    expect(cell00Props['aria-selected']).toBe(true);

    const cell01Props = result.current.getCellProps(0, 1);
    expect(cell01Props.tabIndex).toBe(-1);
    expect(cell01Props['aria-selected']).toBe(false);
  });

  it('navigates with arrow keys within row/column bounds', () => {
    const { result } = renderHook(
      () =>
        useGridNavigation({
          columns,
          rowCount: 3,
        }),
      { wrapper }
    );

    // ArrowRight
    act(() => {
      result.current.handleGridKeyDown({
        key: 'ArrowRight',
        preventDefault: vi.fn(),
      } as any);
    });
    expect(result.current.activeCell).toEqual({ row: 0, col: 1 });

    // ArrowDown
    act(() => {
      result.current.handleGridKeyDown({
        key: 'ArrowDown',
        preventDefault: vi.fn(),
      } as any);
    });
    expect(result.current.activeCell).toEqual({ row: 1, col: 1 });

    // End key jumps to last column
    act(() => {
      result.current.handleGridKeyDown({
        key: 'End',
        preventDefault: vi.fn(),
      } as any);
    });
    expect(result.current.activeCell).toEqual({ row: 1, col: 2 });

    // Home key jumps to first column
    act(() => {
      result.current.handleGridKeyDown({
        key: 'Home',
        preventDefault: vi.fn(),
      } as any);
    });
    expect(result.current.activeCell).toEqual({ row: 1, col: 0 });
  });

  it('triggers onAddRow and wraps to new row when committing on last column', () => {
    const onAddRow = vi.fn();
    const onCommitCell = vi.fn();

    const { result } = renderHook(
      () =>
        useGridNavigation({
          columns,
          rowCount: 2,
          initialRow: 1,
          initialCol: 2,
          onAddRow,
          onCommitCell,
          enableAutoRowInjection: true,
        }),
      { wrapper }
    );

    // Enter edit mode
    act(() => {
      result.current.startEditing('450');
    });
    expect(result.current.isEditing).toBe(true);
    expect(result.current.editValue).toBe('450');

    // Commit edit with rightward progression
    act(() => {
      result.current.commitEdit(true);
    });

    expect(onCommitCell).toHaveBeenCalledWith(1, 'col3', '450');
    expect(onAddRow).toHaveBeenCalledTimes(1);
    expect(result.current.activeCell).toEqual({ row: 2, col: 0 });
  });
});
