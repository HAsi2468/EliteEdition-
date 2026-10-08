import React, { useRef, useEffect } from 'react';
import { X, Plus, ChevronLeft, ChevronRight, Layers, FileText, Package, Receipt, Sparkles } from 'lucide-react';
import './MultiTabBar.css';

/**
 * In-App Multi-Tab System (Browser-like Internal Tab Bar)
 * 
 * Allows ERP operators to keep multiple work contexts open simultaneously
 * (e.g., Job Card 1001, Inward Lot 45, GST Invoice #12) without losing
 * draft forms, active scroll positions, or table filter states.
 */
export function MultiTabBar({
  tabs = [],
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  className = ''
}) {
  const scrollContainerRef = useRef(null);

  // Auto-scroll active tab into view
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const activeEl = scrollContainerRef.current.querySelector('.erp-tab-item.active');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeTabId]);

  const handleScroll = (direction) => {
    if (!scrollContainerRef.current) return;
    const amount = direction === 'left' ? -200 : 200;
    scrollContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <div className={`erp-multi-tab-bar ${className}`}>
      {/* Scroll Left Button */}
      <button
        type="button"
        className="erp-tab-scroll-btn"
        onClick={() => handleScroll('left')}
        title="Scroll tabs left"
      >
        <ChevronLeft size={14} />
      </button>

      {/* Tabs Container */}
      <div className="erp-tabs-scroll-area" ref={scrollContainerRef}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const TabIcon = tab.icon || FileText;

          return (
            <div
              key={tab.id}
              className={`erp-tab-item ${isActive ? 'active' : ''} ${tab.isDirty ? 'has-draft' : ''}`}
              onClick={() => onSelectTab(tab.id)}
              title={`${tab.title} (${tab.id})`}
            >
              <TabIcon size={14} className="erp-tab-icon" />
              <span className="erp-tab-title">{tab.title}</span>

              {/* Unsaved draft indicator dot */}
              {tab.isDirty && (
                <span className="erp-tab-draft-dot" title="Unsaved changes saved to offline draft" />
              )}

              {/* Close Tab Button */}
              {tabs.length > 1 && (
                <button
                  type="button"
                  className="erp-tab-close-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  title="Close tab (Ctrl+W)"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Scroll Right Button */}
      <button
        type="button"
        className="erp-tab-scroll-btn"
        onClick={() => handleScroll('right')}
        title="Scroll tabs right"
      >
        <ChevronRight size={14} />
      </button>

      {/* Add New Tab Button */}
      {onNewTab && (
        <button
          type="button"
          className="erp-tab-add-btn"
          onClick={onNewTab}
          title="Open new workspace tab (Ctrl+T)"
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  );
}

export default MultiTabBar;
