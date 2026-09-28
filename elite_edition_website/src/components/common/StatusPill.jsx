import React from 'react';

/**
 * Standardized Minimal Status Pill Component (Text Only, No Decorative Icons)
 * 
 * Maps status strings across ERP to 4 canonical categories:
 * - Pending: Amber (#fffbeb, text: #92400e, border: #fde68a)
 * - In Progress: Blue (#eff6ff, text: #1e40af, border: #bfdbfe)
 * - Done: Green (#ecfdf5, text: #065f46, border: #a7f3d0)
 * - Delayed / Failed: Red (#fef2f2, text: #991b1b, border: #fecaca)
 */

export function normalizeStatusCategory(rawStatus) {
  if (!rawStatus) return 'pending';
  const s = String(rawStatus).toLowerCase().trim();

  // Done / Success
  if (
    s === 'done' ||
    s === 'completed' ||
    s === 'dispatched' ||
    s === 'delivered' ||
    s === 'success' ||
    s === 'paid' ||
    s === 'approved' ||
    s === 'active' ||
    s === 'finished'
  ) {
    return 'done';
  }

  // In Progress
  if (
    s === 'in progress' ||
    s === 'in_progress' ||
    s === 'printing' ||
    s === 'fusing' ||
    s === 'stitching' ||
    s === 'processing' ||
    s === 'partially paid' ||
    s === 'partial' ||
    s === 'assigned' ||
    s === 'open'
  ) {
    return 'in_progress';
  }

  // Delayed / Failed / Cancelled
  if (
    s === 'delayed' ||
    s === 'failed' ||
    s === 'rejected' ||
    s === 'cancelled' ||
    s === 'overdue' ||
    s === 'error' ||
    s === 'issue'
  ) {
    return 'delayed';
  }

  // Default: Pending / Queued / New / Draft
  return 'pending';
}

const STATUS_THEMES = {
  done: {
    bg: '#ecfdf5',
    text: '#065f46',
    border: '#a7f3d0',
    label: 'Done'
  },
  in_progress: {
    bg: '#eff6ff',
    text: '#1e40af',
    border: '#bfdbfe',
    label: 'In Progress'
  },
  delayed: {
    bg: '#fef2f2',
    text: '#991b1b',
    border: '#fecaca',
    label: 'Delayed'
  },
  pending: {
    bg: '#fffbeb',
    text: '#92400e',
    border: '#fde68a',
    label: 'Pending'
  }
};

export function StatusPill({ status, label, style = {} }) {
  const category = normalizeStatusCategory(status);
  const theme = STATUS_THEMES[category] || STATUS_THEMES.pending;
  const displayText = label || status || theme.label;

  return (
    <span
      className={`status-pill status-${category}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2px 8px',
        fontSize: '12px',
        fontWeight: 500,
        lineHeight: 1.4,
        borderRadius: '4px',
        backgroundColor: theme.bg,
        color: theme.text,
        border: `1px solid ${theme.border}`,
        whiteSpace: 'nowrap',
        textTransform: 'capitalize',
        letterSpacing: '0.01em',
        fontVariantNumeric: 'tabular-nums',
        ...style
      }}
    >
      {displayText}
    </span>
  );
}

export default StatusPill;
