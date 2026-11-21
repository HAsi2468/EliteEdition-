import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Command,
  LayoutDashboard,
  Printer,
  Flame,
  Database,
  Receipt,
  Scissors,
  CheckSquare,
  MessageSquare,
  BarChart3,
  Settings,
  Shield,
  Plus,
  ArrowRight,
  Sparkles,
  X
} from 'lucide-react';
import { soundEffects } from '../../services/soundEffects';

export function SpotlightCommandPalette({
  isOpen: propIsOpen,
  onClose: propOnClose,
  onNavigate,
  activeTab,
  currentCompany = 'Elite Edition'
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = propIsOpen !== undefined ? propIsOpen : internalOpen;
  const setIsOpen = (val) => {
    if (propOnClose && typeof val === 'boolean' && !val) {
      propOnClose();
    }
    setInternalOpen(val);
  };

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Global hotkey: Ctrl + K or Cmd + K (or Ctrl/Cmd + Shift + K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(!isOpen);
        if (!isOpen) {
          soundEffects.playClick();
        }
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  const items = useMemo(() => {
    const screens = [
      { id: 'dashboard', label: 'Dashboard & Live Analytics', section: 'Navigation', icon: LayoutDashboard, shortcut: 'Alt+1' },
      { id: 'digital_print', label: 'Digital Print Job Cards & Production', section: 'Navigation', icon: Printer, shortcut: 'Alt+2' },
      { id: 'fusing', label: 'Fusing & Heat Press Department', section: 'Navigation', icon: Flame, shortcut: 'Alt+3' },
      { id: 'raw_materials', label: 'Raw Materials & Gray Fabric Rolls', section: 'Navigation', icon: Database, shortcut: 'Alt+4' },
      { id: 'billing', label: 'Finance & Billing Department', section: 'Navigation', icon: Receipt, shortcut: 'Alt+5' },
      { id: 'stitching_challan', label: 'Stitching & Garment Production', section: 'Navigation', icon: Scissors, shortcut: 'Alt+6' },
      { id: 'task_management', label: 'Task Management & Kanban Board', section: 'Navigation', icon: CheckSquare, shortcut: 'Alt+7' },
      { id: 'communication', label: 'ERP Team Chat & Discussions', section: 'Navigation', icon: MessageSquare, shortcut: 'Alt+8' },
      { id: 'reports', label: 'Reports & Business Intelligence', section: 'Navigation', icon: BarChart3 },
      { id: 'admin', label: 'Admin Control Center & Users', section: 'Administration', icon: Shield },
      { id: 'settings', label: 'Company Profile & Settings', section: 'Administration', icon: Settings },
    ];

    const actions = [
      { id: 'action:inward', label: 'Inward RFD Mill Challan', section: 'Quick Actions', icon: Plus, tab: 'raw_materials' },
      { id: 'action:task', label: 'Create New Task', section: 'Quick Actions', icon: Plus, tab: 'task_management' },
      { id: 'action:invoice', label: 'Generate Sales Invoice', section: 'Quick Actions', icon: Receipt, tab: 'billing' },
    ];

    const all = [...screens, ...actions];
    if (!query.trim()) return all;

    const q = query.toLowerCase().trim();
    return all.filter((item) =>
      item.label.toLowerCase().includes(q) || item.section.toLowerCase().includes(q)
    );
  }, [query]);

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= items.length) {
      setSelectedIndex(Math.max(0, items.length - 1));
    }
  }, [items, selectedIndex]);

  const executeItem = (item) => {
    if (!item) return;
    soundEffects.playClick();
    setIsOpen(false);
    const targetTab = item.tab || item.id;
    if (onNavigate && targetTab && !targetTab.startsWith('action:')) {
      onNavigate(targetTab);
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeItem(items[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        background: 'rgba(2, 6, 23, 0.65)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
    >
      <div
        style={{
          width: '92%',
          maxWidth: '580px',
          borderRadius: '22px',
          background: 'var(--bg-modal, rgba(15, 23, 42, 0.94))',
          backdropFilter: 'blur(32px) saturate(210%)',
          WebkitBackdropFilter: 'blur(32px) saturate(210%)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          borderTop: '1.5px solid rgba(255, 255, 255, 0.65)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 35px rgba(56, 189, 248, 0.18)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '75vh',
        }}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-light, rgba(148, 163, 184, 0.2))',
            position: 'relative',
          }}
        >
          <Search size={20} color="#38bdf8" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={`Search screens, actions, or shortcuts... (${currentCompany})`}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-primary, #f8fafc)',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              fontSize: '0.68rem',
              fontWeight: 700,
              color: 'var(--text-muted, #94a3b8)',
            }}
          >
            ESC
          </div>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {items.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem' }}>
              No matches found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            items.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon || Sparkles;
              return (
                <div
                  key={item.id}
                  onClick={() => executeItem(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    background: isSelected
                      ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.22) 0%, rgba(37, 99, 235, 0.25) 100%)'
                      : 'transparent',
                    border: isSelected ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid transparent',
                    borderTop: isSelected ? '1px solid rgba(255, 255, 255, 0.6)' : '1px solid transparent',
                    color: isSelected ? '#ffffff' : 'var(--text-primary, #e2e8f0)',
                    transition: 'all 0.12s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '9px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isSelected ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                        color: isSelected ? '#38bdf8' : 'var(--text-muted, #94a3b8)',
                      }}
                    >
                      <Icon size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: isSelected ? 700 : 500 }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '0.66rem', color: 'var(--text-muted, #94a3b8)' }}>
                        {item.section}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {item.shortcut && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '5px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: 'var(--text-muted, #94a3b8)',
                        }}
                      >
                        {item.shortcut}
                      </span>
                    )}
                    {isSelected && <ArrowRight size={14} color="#38bdf8" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border-light, rgba(148, 163, 184, 0.15))',
            background: 'rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.68rem',
            color: 'var(--text-muted, #94a3b8)',
          }}
        >
          <div style={{ display: 'flex', gap: '12px' }}>
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
            <span>ESC to close</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Command size={10} /> + K
          </div>
        </div>
      </div>
    </div>
  );
}

export default SpotlightCommandPalette;
