import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Bookmark, BookmarkPlus, Trash2, ChevronDown, Check } from 'lucide-react';
import { parseFilterQuery, serializeFilterQuery } from '../../utils/filterTokenParser';
import './TokenizedFilterBar.css';

/**
 * TokenizedFilterBar
 * 
 * Enterprise syntax-driven filter bar.
 * Converts text syntax like "status:pending", "meters:>100", "party:meera" into
 * interactive, dismissible filter chips. Supports saving presets to localStorage.
 */
export function TokenizedFilterBar({
  filterFields = [
    { key: 'status', label: 'Status', type: 'select', options: ['pending', 'in-progress', 'completed', 'delayed'] },
    { key: 'meters', label: 'Meters', type: 'number', alias: ['meterage', 'qty'] },
    { key: 'party', label: 'Party', type: 'string', alias: ['customer', 'vendor'] },
    { key: 'fabric', label: 'Fabric', type: 'string' }
  ],
  presetStorageKey = 'erp_filter_presets_default',
  defaultQuery = '',
  onChange = () => {},
  placeholder = 'Filter syntax (e.g. status:pending meters:>100) or free search...'
}) {
  const [tokens, setTokens] = useState([]);
  const [inputText, setInputText] = useState(defaultQuery);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [savedPresets, setSavedPresets] = useState([]);
  
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Load presets from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(presetStorageKey);
      if (stored) {
        setSavedPresets(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to load filter presets:', e);
    }
  }, [presetStorageKey]);

  // Save presets to localStorage
  const persistPresets = (newPresets) => {
    setSavedPresets(newPresets);
    try {
      localStorage.setItem(presetStorageKey, JSON.stringify(newPresets));
    } catch (e) {
      console.warn('Failed to persist filter presets:', e);
    }
  };

  // Close menus on click outside
  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
        setShowPresetsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Sync state change upstream
  const notifyChange = (updatedTokens, currentInput) => {
    const serialized = serializeFilterQuery(updatedTokens, currentInput);
    onChange({
      tokens: updatedTokens,
      freeText: currentInput.trim(),
      rawQuery: serialized
    });
  };

  // Process input text when space or Enter is pressed
  const commitInputToken = () => {
    if (!inputText.trim()) return;

    const parsed = parseFilterQuery(inputText, filterFields);
    if (parsed.tokens.length > 0) {
      const mergedTokens = [...tokens, ...parsed.tokens];
      setTokens(mergedTokens);
      setInputText(parsed.freeText);
      notifyChange(mergedTokens, parsed.freeText);
    } else {
      notifyChange(tokens, inputText);
    }
    setShowSuggestions(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitInputToken();
    } else if (e.key === 'Backspace' && !inputText && tokens.length > 0) {
      // Remove last token on backspace in empty input
      const newTokens = tokens.slice(0, -1);
      setTokens(newTokens);
      notifyChange(newTokens, inputText);
    }
  };

  const handleRemoveToken = (tokenId) => {
    const updated = tokens.filter((t) => t.id !== tokenId);
    setTokens(updated);
    notifyChange(updated, inputText);
  };

  const handleClearAll = () => {
    setTokens([]);
    setInputText('');
    notifyChange([], '');
  };

  // Preset operations
  const handleSavePreset = () => {
    if (!presetNameInput.trim()) return;
    const currentQuery = serializeFilterQuery(tokens, inputText);
    const newPreset = {
      id: `pre_${Date.now()}`,
      name: presetNameInput.trim(),
      tokens,
      freeText: inputText.trim(),
      query: currentQuery
    };
    const updated = [...savedPresets, newPreset];
    persistPresets(updated);
    setPresetNameInput('');
  };

  const handleApplyPreset = (preset) => {
    setTokens(preset.tokens || []);
    setInputText(preset.freeText || '');
    notifyChange(preset.tokens || [], preset.freeText || '');
    setShowPresetsMenu(false);
  };

  const handleDeletePreset = (id, e) => {
    e.stopPropagation();
    const updated = savedPresets.filter((p) => p.id !== id);
    persistPresets(updated);
  };

  // Suggested syntax items
  const suggestions = useMemo(() => {
    const currentWord = inputText.split(' ').pop() || '';
    if (!currentWord) {
      return filterFields.map((f) => ({
        syntax: `${f.key}:`,
        desc: `Filter by ${f.label}`
      }));
    }
    return filterFields
      .filter((f) => f.key.startsWith(currentWord.toLowerCase()))
      .map((f) => ({
        syntax: `${f.key}:`,
        desc: `Filter by ${f.label}`
      }));
  }, [inputText, filterFields]);

  return (
    <div className="tokenized-filter-bar" ref={containerRef}>
      <div className="tokenized-filter-box">
        <Search size={15} className="tokenized-filter-search-icon" />

        {/* Existing Dismissible Chips */}
        <div className="tokenized-filter-chips">
          {tokens.map((tok) => (
            <span key={tok.id} className="tokenized-chip">
              <span className="tokenized-chip-key">{tok.label || tok.key}</span>
              {tok.operator && tok.operator !== '=' && (
                <span className="tokenized-chip-op">{tok.operator}</span>
              )}
              <span className="tokenized-chip-val tabular-nums">{String(tok.value)}</span>
              <button
                type="button"
                className="tokenized-chip-remove"
                onClick={() => handleRemoveToken(tok.id)}
                title="Remove filter"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>

        {/* Active Typing Input */}
        <input
          ref={inputRef}
          type="text"
          className="tokenized-input-field"
          value={inputText}
          placeholder={tokens.length === 0 ? placeholder : 'Add filter...'}
          onChange={(e) => {
            setInputText(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
        />

        {/* Actions (Clear, Presets) */}
        <div className="tokenized-filter-actions">
          {(tokens.length > 0 || inputText) && (
            <button
              type="button"
              className="tokenized-action-btn"
              onClick={handleClearAll}
              title="Clear all filters"
            >
              <X size={12} />
              <span>Clear</span>
            </button>
          )}

          {/* Presets Button */}
          <button
            type="button"
            className={`tokenized-action-btn ${showPresetsMenu ? 'active' : ''}`}
            onClick={() => setShowPresetsMenu(!showPresetsMenu)}
          >
            <Bookmark size={13} />
            <span>Presets</span>
            <ChevronDown size={11} />
          </button>
        </div>
      </div>

      {/* Auto-Suggest Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="tokenized-suggest-panel">
          <div className="tokenized-suggest-title">Available Filter Syntax</div>
          {suggestions.map((item, idx) => (
            <div
              key={idx}
              className="tokenized-suggest-item"
              onClick={() => {
                const words = inputText.split(' ');
                words[words.length - 1] = item.syntax;
                setInputText(words.join(' '));
                inputRef.current?.focus();
                setShowSuggestions(false);
              }}
            >
              <span className="tokenized-suggest-syntax">{item.syntax}</span>
              <span className="tokenized-suggest-desc">{item.desc}</span>
            </div>
          ))}
        </div>
      )}

      {/* Preset Popover Menu */}
      {showPresetsMenu && (
        <div className="tokenized-preset-menu">
          <div style={{ padding: '4px 6px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '4px' }}>
            <input
              type="text"
              placeholder="New preset name..."
              value={presetNameInput}
              onChange={(e) => setPresetNameInput(e.target.value)}
              style={{ flex: 1, padding: '4px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
            />
            <button
              type="button"
              onClick={handleSavePreset}
              disabled={!presetNameInput.trim()}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              Save
            </button>
          </div>

          <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
            {savedPresets.length === 0 ? (
              <div style={{ padding: '8px', fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
                No saved presets yet
              </div>
            ) : (
              savedPresets.map((preset) => (
                <div
                  key={preset.id}
                  className="tokenized-preset-item"
                  onClick={() => handleApplyPreset(preset)}
                >
                  <span style={{ fontWeight: 500 }}>{preset.name}</span>
                  <button
                    type="button"
                    onClick={(e) => handleDeletePreset(preset.id, e)}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TokenizedFilterBar;
