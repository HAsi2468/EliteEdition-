import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';

/**
 * Minimal Global Search Modal
 * Triggered by Ctrl+K / Cmd+K on desktop or search button in mobile top bar.
 * Queries across Job Cards, Invoices, Parties, Stock scoped to active company.
 */

export function GlobalSearchModal({ isOpen, onClose, onSelectResult, activeCompanyId = 'digital_print' }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const stored = localStorage.getItem(`elite_recent_searches_${activeCompanyId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setSearchTerm('');
      setResults([]);
    }
  }, [isOpen]);

  // Debounced search query
  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const res = await api.globalSearch(trimmed, activeCompanyId);
        if (!controller.signal.aborted) {
          setResults(res?.results || []);
          setSelectedIndex(0);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm, activeCompanyId]);

  const saveRecentSearch = (term) => {
    if (!term) return;
    try {
      const updated = [term, ...recentSearches.filter((s) => s !== term)].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem(`elite_recent_searches_${activeCompanyId}`, JSON.stringify(updated));
    } catch {}
  };

  const handleSelect = (item) => {
    saveRecentSearch(searchTerm.trim() || item.title);
    onClose();
    if (onSelectResult) {
      onSelectResult(item);
    } else if (item.route) {
      window.location.hash = item.route;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(2px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '16px',
        paddingTop: 'min(12vh, 80px)'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '600px',
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '80vh'
        }}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #e2e8f0',
            gap: '12px'
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search job cards, invoices, parties, stock..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '16px', // 16px prevents iOS zoom
              color: '#0f172a',
              backgroundColor: 'transparent'
            }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '12px',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              fontSize: '11px',
              color: '#334155',
              cursor: 'pointer',
              padding: '2px 6px'
            }}
          >
            Esc
          </button>
        </div>

        {/* Results Container */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
          {loading && (
            <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              Searching...
            </div>
          )}

          {!loading && !searchTerm && recentSearches.length > 0 && (
            <div style={{ padding: '8px 16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                Recent Searches
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {recentSearches.map((term, i) => (
                  <button
                    key={i}
                    onClick={() => setSearchTerm(term)}
                    style={{
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '12px',
                      color: '#0f172a',
                      cursor: 'pointer'
                    }}
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!loading && searchTerm && results.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
              No results found for "{searchTerm}"
            </div>
          )}

          {!loading && results.length > 0 && (
            <div>
              <div style={{ padding: '4px 16px 8px', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                {results.length} Results
              </div>
              {results.map((res, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={`${res.category}-${res.id}`}
                    onClick={() => handleSelect(res)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: isSelected ? '#f1f5f9' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid #f8fafc',
                      minHeight: '44px'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                        {res.title}
                      </div>
                      <div style={{ fontSize: '12px', color: '#475569' }}>
                        {res.subtitle}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          backgroundColor: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          color: '#475569',
                          marginRight: res.meta ? '8px' : '0'
                        }}
                      >
                        {res.category}
                      </span>
                      {res.meta && (
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                          {res.meta}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GlobalSearchModal;
