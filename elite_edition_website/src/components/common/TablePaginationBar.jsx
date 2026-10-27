import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * TablePaginationBar
 * Modern, lightweight pagination dock designed to keep DOM element counts low and client memory light.
 * Supports: 25, 50, 100 items per page with instant page navigation.
 */
export default function TablePaginationBar({
  page = 1,
  totalItems = 0,
  pageSize = 25,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  itemName = 'records',
  style = {},
  compact = false
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const startIdx = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(safePage * pageSize, totalItems);

  if (totalItems === 0) {
    return null;
  }

  return (
    <div
      className="table-pagination-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        padding: '0.65rem 1rem',
        margin: '0.75rem 0',
        background: 'var(--surface-color, rgba(255, 255, 255, 0.04))',
        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
        borderRadius: '10px',
        fontSize: '0.82rem',
        color: 'var(--text-secondary, #94a3b8)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
        ...style
      }}
    >
      {/* Items count & range info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
        <span>
          Showing <strong style={{ color: 'var(--text-primary, #0f172a)' }}>{startIdx}–{endIdx}</strong> of{' '}
          <strong style={{ color: 'var(--text-primary, #0f172a)' }}>{totalItems.toLocaleString()}</strong> {itemName}
        </span>
      </div>

      {/* Page navigation controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        {/* Page size selector */}
        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginRight: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem' }}>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const nextSize = Number(e.target.value);
                if (onPageSizeChange) onPageSizeChange(nextSize);
              }}
              style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '6px',
                border: '1px solid var(--border-light, #cbd5e1)',
                background: 'var(--bg-card, #ffffff)',
                color: 'var(--text-primary, #0f172a)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* First Page */}
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange && onPageChange(1)}
          title="First Page"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '30px',
            height: '30px',
            borderRadius: '6px',
            border: '1px solid var(--border-light, #e2e8f0)',
            background: safePage <= 1 ? 'transparent' : 'var(--bg-card, #ffffff)',
            color: safePage <= 1 ? 'var(--text-muted, #94a3b8)' : 'var(--primary, #6366f1)',
            cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
            opacity: safePage <= 1 ? 0.4 : 1,
            transition: 'all 0.15s ease'
          }}
        >
          <ChevronsLeft size={16} />
        </button>

        {/* Prev Page */}
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange && onPageChange(safePage - 1)}
          title="Previous Page"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '30px',
            height: '30px',
            borderRadius: '6px',
            border: '1px solid var(--border-light, #e2e8f0)',
            background: safePage <= 1 ? 'transparent' : 'var(--bg-card, #ffffff)',
            color: safePage <= 1 ? 'var(--text-muted, #94a3b8)' : 'var(--primary, #6366f1)',
            cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
            opacity: safePage <= 1 ? 0.4 : 1,
            transition: 'all 0.15s ease'
          }}
        >
          <ChevronLeft size={16} />
        </button>

        {/* Current Page Pill */}
        <span
          style={{
            padding: '0.2rem 0.65rem',
            borderRadius: '6px',
            background: 'var(--primary-light, rgba(99, 102, 241, 0.1))',
            color: 'var(--primary, #6366f1)',
            fontWeight: 800,
            fontSize: '0.8rem',
            minWidth: '70px',
            textAlign: 'center'
          }}
        >
          {safePage} / {totalPages}
        </span>

        {/* Next Page */}
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange && onPageChange(safePage + 1)}
          title="Next Page"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '30px',
            height: '30px',
            borderRadius: '6px',
            border: '1px solid var(--border-light, #e2e8f0)',
            background: safePage >= totalPages ? 'transparent' : 'var(--bg-card, #ffffff)',
            color: safePage >= totalPages ? 'var(--text-muted, #94a3b8)' : 'var(--primary, #6366f1)',
            cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
            opacity: safePage >= totalPages ? 0.4 : 1,
            transition: 'all 0.15s ease'
          }}
        >
          <ChevronRight size={16} />
        </button>

        {/* Last Page */}
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange && onPageChange(totalPages)}
          title="Last Page"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '30px',
            height: '30px',
            borderRadius: '6px',
            border: '1px solid var(--border-light, #e2e8f0)',
            background: safePage >= totalPages ? 'transparent' : 'var(--bg-card, #ffffff)',
            color: safePage >= totalPages ? 'var(--text-muted, #94a3b8)' : 'var(--primary, #6366f1)',
            cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
            opacity: safePage >= totalPages ? 0.4 : 1,
            transition: 'all 0.15s ease'
          }}
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
}
