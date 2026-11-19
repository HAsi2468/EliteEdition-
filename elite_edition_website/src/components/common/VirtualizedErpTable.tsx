import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface VirtualColumn<T> {
  key: string;
  header: React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  render: (row: T, index: number) => React.ReactNode;
}

export interface VirtualizedErpTableProps<T> {
  rows: T[];
  columns: VirtualColumn<T>[];
  getRowKey: (row: T, index: number) => string | number;
  estimateRowHeight?: number;
  maxHeight?: string | number;
  overscan?: number;
  emptyMessage?: string;
  onRowClick?: (row: T, index: number) => void;
  className?: string;
}

/**
 * High-Performance Virtualized Table powered by @tanstack/react-virtual.
 * Renders only visible rows + overscan window to maintain 60fps on 10,000+ ERP rows.
 */
export function VirtualizedErpTable<T>({
  rows,
  columns,
  getRowKey,
  estimateRowHeight = 46,
  maxHeight = '65vh',
  overscan = 10,
  emptyMessage = 'No records found.',
  onRowClick,
  className = '',
}: VirtualizedErpTableProps<T>) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => estimateRowHeight,
    overscan,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();

  const gridTemplateColumns = columns
    .map((col) => (typeof col.width === 'number' ? `${col.width}px` : col.width || 'minmax(110px, 1fr)'))
    .join(' ');

  return (
    <div
      className={`virtualized-erp-table ${className}`}
      style={{
        border: '1px solid var(--border-light, rgba(148, 163, 184, 0.22))',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'var(--bg-card, rgba(15, 23, 42, 0.72))',
      }}
    >
      <div
        ref={scrollContainerRef}
        style={{
          maxHeight,
          overflowY: 'auto',
          overflowX: 'auto',
          position: 'relative',
          contain: 'layout style',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Sticky Header */}
        <div
          role="row"
          style={{
            display: 'grid',
            gridTemplateColumns,
            position: 'sticky',
            top: 0,
            zIndex: 5,
            background: 'var(--bg-th, rgba(15, 23, 42, 0.94))',
            borderBottom: '1px solid var(--border-light, rgba(148, 163, 184, 0.22))',
            fontSize: '0.72rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--text-muted, #94a3b8)',
            minWidth: 'max-content',
          }}
        >
          {columns.map((col) => (
            <div
              key={col.key}
              role="columnheader"
              style={{
                padding: '10px 12px',
                textAlign: col.align || 'left',
                whiteSpace: 'nowrap',
              }}
            >
              {col.header}
            </div>
          ))}
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted, #94a3b8)', fontSize: '0.84rem' }}>
            {emptyMessage}
          </div>
        ) : (
          <div style={{ height: `${totalHeight}px`, position: 'relative', minWidth: 'max-content' }}>
            {virtualItems.map((virtualRow) => {
              const row = rows[virtualRow.index];
              const key = getRowKey(row, virtualRow.index);
              return (
                <div
                  key={key}
                  role="row"
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  onClick={onRowClick ? () => onRowClick(row, virtualRow.index) : undefined}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    display: 'grid',
                    gridTemplateColumns,
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border-light, rgba(148, 163, 184, 0.14))',
                    fontSize: '0.82rem',
                    color: 'var(--text-primary, #f8fafc)',
                    cursor: onRowClick ? 'pointer' : 'default',
                  }}
                >
                  {columns.map((col) => (
                    <div
                      key={col.key}
                      role="cell"
                      style={{
                        padding: '9px 12px',
                        textAlign: col.align || 'left',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {col.render(row, virtualRow.index)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default VirtualizedErpTable;
