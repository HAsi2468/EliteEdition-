import React, { useState, useEffect } from 'react';
import { Sparkles, X, CheckCircle, ExternalLink, Zap } from 'lucide-react';
import './ChangelogDrawer.css';

const LATEST_RELEASE_ID = 'rel-v2.9.0-ux-polish';

const RELEASES = [
  {
    id: 'rel-v2.9.0-ux-polish',
    version: 'v2.9.0',
    date: 'October 2026',
    items: [
      {
        tag: 'NEW UI',
        tagClass: 'tag-new-ui',
        title: 'Zen Focus Mode (Alt + Z)',
        bullets: [
          'Instant 100% viewport expansion for high-density data tables.',
          'Hides header & sidebar with cubic-bezier transitions.',
          'Docked on-screen escape pill with hotkey exit.'
        ]
      },
      {
        tag: 'TACTILE',
        tagClass: 'tag-tactile',
        title: 'Physical Tactile Response & Cell Peek',
        bullets: [
          'scale(0.98) micro-compression on buttons & cards.',
          'Dual-offset accessible focus rings for keyboard navigation.',
          'Truncated text hover magnifier with 1-click clipboard copy.'
        ]
      },
      {
        tag: 'LAYOUT',
        tagClass: 'tag-layout',
        title: 'Spatial Multi-Pane & Compare Dock',
        bullets: [
          '3-Pane canvas with draggable divider rails (Alt+1, 2, 3).',
          'Side-by-side entity compare dock with discrepancy highlighting.',
          'Form ScrollSpy mini-map with real-time field validation badges.'
        ]
      },
      {
        tag: 'SPEED',
        tagClass: 'tag-speed',
        title: 'Factory HUD & UI Scale Slider',
        bullets: [
          'High-contrast industrial HUD mode for factory floor tablets.',
          'Dynamic UI scale density slider (85% to 115%).'
        ]
      }
    ]
  },
  {
    id: 'rel-v2.8.0-core',
    version: 'v2.8.0',
    date: 'October 2026',
    items: [
      {
        tag: 'LAYOUT',
        tagClass: 'tag-layout',
        title: 'Multi-Entity Dynamic Accents & Brand Badges',
        bullets: [
          'Visual company badges (EDP, EST, EE, EFB, EON).',
          'Clean workspace tabs and hardware barcode sniffer HUD.'
        ]
      }
    ]
  }
];

/**
 * ChangelogDrawer
 * 
 * Header notification trigger button (sparkle icon) with an unread count badge.
 * Slide-over drawer with release notes grouped by date.
 * Persists "last_read_release_id" in localStorage to clear unread badge once opened.
 */
export function ChangelogDrawer({ triggerOnly = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    const lastRead = localStorage.getItem('last_read_release_id');
    if (lastRead !== LATEST_RELEASE_ID) {
      setHasUnread(true);
    }
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    setHasUnread(false);
    localStorage.setItem('last_read_release_id', LATEST_RELEASE_ID);
  };

  return (
    <>
      <button
        type="button"
        id="changelog-drawer-trigger"
        className="changelog-trigger-btn"
        onClick={handleOpen}
        title="What's New in Elite Edition ERP"
        aria-label="What's New Changelog"
      >
        <Sparkles size={16} style={{ color: hasUnread ? '#f59e0b' : 'currentColor' }} />
        {hasUnread && <span className="changelog-unread-badge">1</span>}
      </button>

      {isOpen && (
        <>
          <div className="changelog-drawer-backdrop" onClick={() => setIsOpen(false)} />
          <aside className="changelog-drawer" role="dialog" aria-modal="true" aria-label="What's New in Elite Edition">
            <div className="changelog-drawer-header">
              <div className="changelog-drawer-title">
                <Sparkles size={18} style={{ color: '#f59e0b' }} />
                <span>What's New & Updates</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="changelog-drawer-body">
              {RELEASES.map(rel => (
                <div key={rel.id} className="changelog-release-group">
                  <div className="changelog-date-badge">
                    {rel.version} • {rel.date}
                  </div>

                  {rel.items.map((item, idx) => (
                    <div key={idx} className="changelog-item-card">
                      <div className="changelog-card-top">
                        <span className={`changelog-tag ${item.tagClass}`}>{item.tag}</span>
                      </div>
                      <div className="changelog-card-heading">{item.title}</div>
                      <ul className="changelog-bullets">
                        {item.bullets.map((b, bIdx) => (
                          <li key={bIdx}>{b}</li>
                        ))}
                      </ul>
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
