import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Building2, MessageSquare, CheckSquare, Package, X, ArrowRight } from 'lucide-react';
import { COMPANIES } from '../config/companiesConfig';

export default function SpotlightSearchModal({
  isOpen,
  onClose,
  onSelectCompany,
  onNavigateTab,
  items = [],
  parties = [],
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = [];

    // 1. Companies
    (COMPANIES || []).forEach((c) => {
      if (!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)) {
        out.push({
          id: `comp-${c.id}`,
          kind: 'Company',
          title: `${c.code} · ${c.name}`,
          subtitle: 'Switch active company workspace',
          icon: <Building2 size={15} color="#38bdf8" />,
          action: () => onSelectCompany(c.id),
        });
      }
    });

    // 2. Quick Modules
    const quickModules = [
      { id: 'communication', title: 'Team Chat & Calls', subtitle: 'Open Communication workspace', icon: <MessageSquare size={15} color="#6ee7b7" /> },
      { id: 'task_management', title: 'Task Manager', subtitle: 'Open Kanban & task board', icon: <CheckSquare size={15} color="#fcd34d" /> },
      { id: 'inventory', title: 'Inventory & Stock Overview', subtitle: 'View SKU stock levels', icon: <Package size={15} color="#93c5fd" /> },
    ];
    quickModules.forEach((m) => {
      if (!q || m.title.toLowerCase().includes(q)) {
        out.push({
          id: `mod-${m.id}`,
          kind: 'Module',
          title: m.title,
          subtitle: m.subtitle,
          icon: m.icon,
          action: () => onNavigateTab(m.id),
        });
      }
    });

    // 3. Matching Inventory SKUs (when query >= 2 chars)
    if (q.length >= 2 && Array.isArray(items)) {
      let count = 0;
      for (const it of items) {
        if (count >= 6) break;
        const sku = String(it.skuCode || it.itemName || '');
        const party = String(it.party || '');
        if (sku.toLowerCase().includes(q) || party.toLowerCase().includes(q)) {
          out.push({
            id: `sku-${it._id || count}`,
            kind: 'SKU',
            title: sku,
            subtitle: `${party || 'Stock'} · ${Number(it.currentlyAvailableStock || 0)} units`,
            icon: <Package size={15} color="#c4b5fd" />,
            action: () => onNavigateTab('inventory'),
          });
          count++;
        }
      }
    }

    // 4. Matching Parties
    if (q.length >= 2 && Array.isArray(parties)) {
      let pCount = 0;
      for (const p of parties) {
        if (pCount >= 4) break;
        const name = String(p.name || p.partyName || '');
        if (name.toLowerCase().includes(q)) {
          out.push({
            id: `party-${p._id || pCount}`,
            kind: 'Party',
            title: name,
            subtitle: p.gstin ? `GSTIN: ${p.gstin}` : 'Vendor / Party',
            icon: <Building2 size={15} color="#fcd34d" />,
            action: () => onNavigateTab('inventory'),
          });
          pCount++;
        }
      }
    }

    return out.slice(0, 14);
  }, [query, items, parties, onSelectCompany, onNavigateTab]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(2, 6, 23, 0.72)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
        paddingLeft: '1rem',
        paddingRight: '1rem',
      }}
    >
      <div
        className="erp-spotlight-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(600px, 96vw)',
          background: 'rgba(15, 23, 42, 0.94)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          borderRadius: '18px',
          boxShadow: '0 28px 70px rgba(0, 0, 0, 0.65)',
          overflow: 'hidden',
          color: '#f8fafc',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.9rem 1.1rem', borderBottom: '1px solid rgba(148,163,184,0.18)' }}>
          <Search size={18} color="#38bdf8" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && results[0]) {
                results[0].action();
                onClose();
              }
            }}
            placeholder="Search companies, modules, SKUs, parties... (Esc to close)"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f8fafc',
              fontSize: '0.95rem',
            }}
          />
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ maxHeight: '52vh', overflowY: 'auto', padding: '0.5rem' }}>
          {results.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
              No matching companies, SKUs, or modules found.
            </div>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  item.action();
                  onClose();
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'transparent',
                  color: '#f8fafc',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                  {item.icon}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.86rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.73rem', color: '#94a3b8' }}>{item.subtitle}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.68rem', color: '#93c5fd', background: 'rgba(59,130,246,0.16)', padding: '2px 7px', borderRadius: '999px', fontWeight: 700 }}>
                    {item.kind}
                  </span>
                  <ArrowRight size={14} color="#64748b" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
