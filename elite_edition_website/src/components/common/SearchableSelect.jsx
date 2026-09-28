import React, { useState, useRef, useEffect } from 'react';

/**
 * Minimal Searchable Select Dropdown
 * 
 * Rules:
 * - Minimum 16px font on inputs to prevent iOS zoom
 * - 44px minimum tap targets
 * - Keyboard navigable (Up/Down/Enter/Esc)
 * - Zero decorative icons or gradients
 */

export function SearchableSelect({
  options = [],
  value = '',
  onChange = () => {},
  placeholder = 'Select option...',
  disabled = false,
  error = '',
  name = '',
  id = '',
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Normalize options: supports strings or { value, label }
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      return { value: opt.value ?? opt.id ?? '', label: opt.label ?? opt.name ?? String(opt.value) };
    }
    return { value: opt, label: String(opt) };
  });

  const selectedOption = normalizedOptions.find((opt) => String(opt.value) === String(value));

  const filteredOptions = normalizedOptions.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        onChange(filteredOptions[highlightedIndex].value);
        setIsOpen(false);
        setSearchTerm('');
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        ...style
      }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        name={name}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          minHeight: '44px',
          padding: '8px 12px',
          backgroundColor: disabled ? '#f1f5f9' : '#ffffff',
          border: `1px solid ${error ? '#ef4444' : isOpen ? '#0f172a' : '#cbd5e1'}`,
          borderRadius: '8px',
          fontSize: '15px',
          color: selectedOption ? '#0f172a' : '#94a3b8',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          boxSizing: 'border-box'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {error && (
        <span style={{ display: 'block', fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>
          {error}
        </span>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            zIndex: 9999,
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
          }}
        >
          {/* Search Field inside dropdown */}
          <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Filter options..."
              style={{
                width: '100%',
                height: '38px',
                padding: '6px 10px',
                fontSize: '16px', // 16px to prevent mobile zoom
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Options List */}
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px', fontSize: '13px', color: '#64748b', textAlign: 'center' }}>
                No options found
              </div>
            ) : (
              filteredOptions.map((opt, index) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = index === highlightedIndex;
                return (
                  <div
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    style={{
                      minHeight: '44px',
                      padding: '10px 12px',
                      fontSize: '14px',
                      backgroundColor: isHighlighted ? '#f1f5f9' : isSelected ? '#f8fafc' : '#ffffff',
                      color: isSelected ? '#0f172a' : '#334155',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid #f8fafc'
                    }}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <span style={{ fontSize: '12px', color: '#0f172a' }}>✓</span>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchableSelect;
