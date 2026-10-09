import React, { useState, useEffect } from 'react';
import { Sparkles, X, CheckCircle, ExternalLink, Zap, Keyboard, Eye, ChevronRight } from 'lucide-react';
import './ChangelogDrawer.css';

const LATEST_RELEASE_ID = 'rel-v3.0.0-architecture-standards';

const RELEASES = [
  {
    id: 'rel-v3.0.0-architecture-standards',
    version: 'v3.0.0',
    date: 'October 2026',
    items: [
      {
        tag: 'NEW FEATURE',
        tagType: 'new-feature',
        title: 'Consolidated Split Action Group',
        mediaType: 'action-preview',
        whatChanged: 'Replaced cluttered row of Save, Print, Export, and Delete buttons with a unified split-button component.',
        whyChanged: 'Frees up 60% more horizontal screen space and eliminates accidental destructive clicks.',
        howToUse: 'Click the primary button to Save directly, or tap the chevron / press Alt+Down to access secondary actions and hotkeys.'
      },
      {
        tag: 'KEYBOARD SHORTCUT',
        tagType: 'keyboard-shortcut',
        title: 'Excel-Grade 2D Grid Traversal (useGridKeyboardNav)',
        mediaType: 'grid-preview',
        whatChanged: 'Full 2D spatial navigation with arrow keys, Enter to commit & step vertically, Tab across cells, and "/" to filter.',
        whyChanged: 'Enables 100% mouse-free rapid ledger and meterage data entry on high-volume factory lines.',
        howToUse: 'Navigate with Arrow keys. Press Enter to commit edits and advance down. Press "/" to jump immediately to table search.'
      },
      {
        tag: 'UI IMPROVEMENT',
        tagType: 'ui-improvement',
        title: 'Zero-CLS Smart Thumbnail Engine',
        mediaType: 'thumb-preview',
        whatChanged: 'High-performance lazy thumbnail grid items locked to 32px–40px with GPU shimmer skeletons and 150ms quick-peek hover popovers.',
        whyChanged: 'Eliminates Cumulative Layout Shift (CLS) on large catalog rosters while allowing operators to inspect textile details without opening a new tab.',
        howToUse: 'Hover over any thumbnail on desktop/tablet to view a 300px popover. Tap on mobile to trigger the pinch-to-zoom lightbox.'
      },
      {
        tag: 'SPEED',
        tagType: 'speed',
        title: 'Strict Literal Numeric Inputs & Tabular Numerals',
        mediaType: 'numeric-preview',
        whatChanged: 'Literal numeric typing with zero unexpected decimal shifting, automatic locale grouping on blur, and font-variant-numeric: tabular-nums.',
        whyChanged: 'Eliminates accounting discrepancies caused by auto-formatting and prevents misalignment in dense numeric columns.',
        howToUse: 'Type raw numbers freely (e.g. "1450"). Decimals are only added when you explicitly type ".".'
      }
    ]
  },
  {
    id: 'rel-v2.9.0-core',
    version: 'v2.9.0',
    date: 'September 2026',
    items: [
      {
        tag: 'UI IMPROVEMENT',
        tagType: 'ui-improvement',
        title: 'Multi-Device Adaptive Viewport Shell (10 Form Factors)',
        mediaType: 'device-preview',
        whatChanged: 'Seamless layout adaptation across 10 desktop, tablet, and mobile PWA variants with safe-area notch handling.',
        whyChanged: 'Ensures field supervisors on tablets and factory workers on handheld scanners get native-grade UX without broken headers.',
        howToUse: 'Install the PWA from your browser menu. The shell automatically adapts navigation controls to your device.'
      }
    ]
  }
];

/**
 * ChangelogDrawer
 * 
 * Enterprise Release Center & "What's New" Drawer.
 * Triggered from header bell or sparkle button with persistent unread badge.
 * Displays itemized release cards with semantic badges, visual media slots,
 * and structured "What changed", "Why it changed", and "How to use it" breakdowns.
 */
export function ChangelogDrawer({ triggerOnly = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const lastRead = localStorage.getItem('last_read_release_id');
    if (lastRead !== LATEST_RELEASE_ID) {
      setUnreadCount(1);
    } else {
      setUnreadCount(0);
    }
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    setUnreadCount(0);
    localStorage.setItem('last_read_release_id', LATEST_RELEASE_ID);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // Helper to render media slot preview
  const renderMediaSlot = (type) => {
    switch (type) {
      case 'action-preview':
        return (
          <div className="changelog-media-slot">
            <div className="changelog-mini-action-group">
              <span className="mini-btn-primary">Save Changes</span>
              <span className="mini-btn-chevron">▼</span>
            </div>
            <span className="changelog-media-caption">Unified Split Action Trigger</span>
          </div>
        );
      case 'grid-preview':
        return (
          <div className="changelog-media-slot">
            <div className="changelog-mini-grid">
              <div className="mini-grid-cell">1,450.00</div>
              <div className="mini-grid-cell active">2,890.50 [Active]</div>
              <div className="mini-grid-cell">780.00</div>
            </div>
            <span className="changelog-media-caption">2D Arrow Key Traversal & Vertical Enter Step</span>
          </div>
        );
      case 'thumb-preview':
        return (
          <div className="changelog-media-slot">
            <div className="changelog-mini-thumb-demo">
              <div className="mini-thumb-box">36px</div>
              <span className="mini-arrow">➔</span>
              <div className="mini-popover-box">300px Quick-Peek</div>
            </div>
            <span className="changelog-media-caption">Zero-CLS Shimmer & 150ms Hover Popover</span>
          </div>
        );
      default:
        return (
          <div className="changelog-media-slot">
            <Zap size={20} style={{ color: '#38bdf8' }} />
            <span className="changelog-media-caption">High Performance Enterprise Architecture</span>
          </div>
        );
    }
  };

  return (
    <>
      <button
        type="button"
        id="changelog-drawer-trigger"
        className="changelog-trigger-btn"
        onClick={handleOpen}
        title="What's New in Elite Edition ERP"
        aria-label="What's New Release Center"
      >
        <Sparkles size={16} style={{ color: unreadCount > 0 ? '#f59e0b' : 'currentColor' }} />
        {unreadCount > 0 && <span className="changelog-unread-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <>
          <div className="changelog-drawer-backdrop" onClick={handleClose} />
          <aside
            className="changelog-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="What's New & Release Updates"
          >
            <div className="changelog-drawer-header">
              <div className="changelog-drawer-title">
                <Sparkles size={18} style={{ color: '#f59e0b' }} />
                <span>What's New & Release Center</span>
              </div>
              <button
                type="button"
                className="changelog-close-btn"
                onClick={handleClose}
                aria-label="Close release drawer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="changelog-drawer-body">
              {RELEASES.map((rel) => (
                <div key={rel.id} className="changelog-release-group">
                  <div className="changelog-version-header">
                    <span className="changelog-version-badge">{rel.version}</span>
                    <span className="changelog-date-text">{rel.date}</span>
                  </div>

                  {rel.items.map((item, idx) => (
                    <div key={idx} className="changelog-item-card">
                      <div className="changelog-card-top">
                        <span className={`changelog-badge changelog-badge-${item.tagType}`}>
                          {item.tag}
                        </span>
                      </div>
                      <h4 className="changelog-card-heading">{item.title}</h4>

                      {/* Visual Media Slot */}
                      {renderMediaSlot(item.mediaType)}

                      {/* Expanded 3-Point Breakdown */}
                      <div className="changelog-breakdown">
                        <div className="changelog-breakdown-row">
                          <span className="breakdown-label">What Changed:</span>
                          <span className="breakdown-text">{item.whatChanged}</span>
                        </div>
                        <div className="changelog-breakdown-row">
                          <span className="breakdown-label">Why It Changed:</span>
                          <span className="breakdown-text">{item.whyChanged}</span>
                        </div>
                        <div className="changelog-breakdown-row">
                          <span className="breakdown-label">How To Use It:</span>
                          <span className="breakdown-text">{item.howToUse}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </aside>
        </>
      )}
    </>
  );
}

export default ChangelogDrawer;
