/**
 * Tailwind (v3.3+) equivalents of responsive.css, as drop-in React components.
 * Arbitrary-value classes are used so no tailwind.config change is needed.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** plain text used for truncation + title tooltip */
  text?: (row: T) => string;
  numeric?: boolean;
}

export const tw = {
  wrap: 'relative max-w-full overflow-auto max-h-[70vh] supports-[height:100dvh]:max-h-[70dvh] overscroll-x-contain rounded-lg border border-slate-200',
  table: 'w-max min-w-full border-separate border-spacing-0 text-sm',
  th: 'sticky top-0 z-[2] bg-slate-50 px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-slate-200 min-w-[96px]',
  td: 'bg-white px-3 py-2 border-b border-slate-100 align-middle min-w-[96px] max-w-[200px] sm:max-w-[280px]',
  truncate: 'block truncate',
  num: 'text-right tabular-nums whitespace-nowrap',
  actionsTh: 'sticky right-0 top-0 z-[3] bg-slate-50 px-3 py-2 border-b border-slate-200 w-px whitespace-nowrap shadow-[-6px_0_6px_-6px_rgba(15,23,42,.25)]',
  actionsTd: 'sticky right-0 z-[1] bg-white px-2 py-1 border-b border-slate-100 w-px whitespace-nowrap shadow-[-6px_0_6px_-6px_rgba(15,23,42,.25)]',
  touch: 'inline-flex min-h-[44px] min-w-[44px] items-center justify-center touch-manipulation',
  input: 'min-h-[44px] text-base', // text-base = 16px: no iOS focus zoom
  backdrop: 'fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-slate-900/50 overscroll-contain sm:p-[max(12px,env(safe-area-inset-top))]',
  modal: 'flex w-full sm:w-[min(100%,640px)] flex-col overflow-hidden bg-white rounded-t-xl sm:rounded-xl max-h-[100vh] supports-[height:100dvh]:max-h-[100dvh] sm:max-h-[calc(100dvh-24px)]',
  modalHeader: 'flex flex-none items-center justify-between gap-2 border-b border-slate-200 px-4 py-3',
  modalTitle: 'min-w-0 truncate font-semibold',
  modalBody: 'min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 [scroll-padding-bottom:96px]',
  modalFooter: 'sticky bottom-0 flex flex-none flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] [&>*]:min-h-[44px] [&>*]:flex-1 sm:[&>*]:flex-none',
} as const;

export function ResponsiveTable<T>({ rows, columns, rowKey, actions, caption }: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  actions?: (row: T) => ReactNode;
  caption?: string;
}) {
  return (
    <div className={tw.wrap} role="region" aria-label={caption ?? 'table'} tabIndex={0}>
      <table className={tw.table}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((c) => <th key={c.key} scope="col" className={`${tw.th} ${c.numeric ? 'text-right' : ''}`}>{c.header}</th>)}
            {actions ? <th scope="col" className={tw.actionsTh}><span className="sr-only">Actions</span></th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)}>
              {columns.map((c) => {
                const text = c.text?.(r);
                return (
                  <td key={c.key} className={`${tw.td} ${c.numeric ? tw.num : ''}`}>
                    {text !== undefined ? <span className={tw.truncate} title={text}>{c.cell(r)}</span> : c.cell(r)}
                  </td>
                );
              })}
              {actions ? <td className={tw.actionsTd}><div className="inline-flex gap-2">{actions(r)}</div></td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 360 px-safe modal: sticky footer, scrollable body, safe-area insets, Esc closes (BUG-032), focus restored. */
export function MobileModal({ open, title, onClose, children, footer }: {
  open: boolean; title: string; onClose: () => void; children: ReactNode; footer: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  useKeyboardShortcut('Escape', onClose, { enabled: open, allowInInputs: true, priority: 100 });
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    document.documentElement.classList.add('erp-modal-open');
    panel.current?.focus();
    return () => { document.documentElement.classList.remove('erp-modal-open'); prev?.focus?.(); };
  }, [open]);
  if (!open) return null;
  return (
    <div className={tw.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={tw.modal}>
        <div className={tw.modalHeader}>
          <h2 id={titleId} className={tw.modalTitle} title={title}>{title}</h2>
          <button type="button" aria-label="Close" className={`${tw.touch} flex-none`} onClick={onClose}>✕</button>
        </div>
        <div className={tw.modalBody}>{children}</div>
        <div className={tw.modalFooter}>{footer}</div>
      </div>
    </div>
  );
}

/** Close any open modal on hash-route change (BUG-032: modals persist across routes). */
export function useCloseOnRouteChange(open: boolean, onClose: () => void): void {
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!open) return;
    const h = () => cb.current();
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, [open]);
}
