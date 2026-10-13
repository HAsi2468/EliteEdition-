import React, { useState } from 'react';
import { 
  Type, Variable, Table, Image, Minus, QrCode, Square, Search, 
  ChevronDown, ChevronRight, Copy, Check, Plus, Sparkles 
} from 'lucide-react';
import { ERP_TOKEN_CATEGORIES } from '../../utils/tokenResolver';

export default function TokenPalette({ onAddElement, onInsertToken }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [copiedToken, setCopiedToken] = useState(null);

  const toggleCategory = (cat) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleCopy = (tokenKey) => {
    const text = `{{${tokenKey}}}`;
    navigator.clipboard.writeText(text);
    setCopiedToken(tokenKey);
    setTimeout(() => setCopiedToken(null), 1500);
  };

  const primitives = [
    {
      type: 'text',
      label: 'Plain Text',
      icon: Type,
      color: '#3b82f6',
      defaultProps: {
        width: 180,
        height: 30,
        content: 'Custom Static Heading',
        style: { fontSize: 13, fontWeight: '700', color: '#0f172a' }
      }
    },
    {
      type: 'dynamic_text',
      label: 'Dynamic Field',
      icon: Variable,
      color: '#10b981',
      defaultProps: {
        width: 220,
        height: 32,
        content: 'Invoice: {{invoice.invoiceNumber}}',
        fieldBinding: 'invoice.invoiceNumber',
        style: { fontSize: 12, fontWeight: '600', color: '#0f172a' }
      }
    },
    {
      type: 'dynamic_table',
      label: 'Dynamic Table',
      icon: Table,
      color: '#8b5cf6',
      defaultProps: {
        width: 555,
        height: 250,
        tableConfig: {
          columns: [
            { key: 'sr', label: 'Sr', width: '35px', align: 'center', field: 'index' },
            { key: 'description', label: 'Description', width: '220px', align: 'left', field: 'description' },
            { key: 'hsn', label: 'HSN/SAC', width: '70px', align: 'center', field: 'hsn' },
            { key: 'qty', label: 'Qty/Mtr', width: '70px', align: 'right', field: 'quantity' },
            { key: 'rate', label: 'Rate (₹)', width: '70px', align: 'right', field: 'rate' },
            { key: 'total', label: 'Total (₹)', width: '90px', align: 'right', field: 'total' }
          ],
          showHeader: true,
          striped: true,
          borderColor: '#e2e8f0',
          headerBg: '#0f172a',
          headerColor: '#ffffff',
          rowHeight: 25
        },
        style: { fontSize: 9.5, color: '#0f172a' }
      }
    },
    {
      type: 'image',
      label: 'Company Logo',
      icon: Image,
      color: '#f59e0b',
      defaultProps: {
        width: 120,
        height: 50,
        content: 'https://cdn.eliteedition.in/brand/logo.png',
        style: { backgroundColor: 'transparent' }
      }
    },
    {
      type: 'divider',
      label: 'Divider Line',
      icon: Minus,
      color: '#64748b',
      defaultProps: {
        width: 555,
        height: 2,
        style: { borderWidth: 2, borderStyle: 'solid', borderColor: '#0284c7' }
      }
    },
    {
      type: 'qr_code',
      label: 'UPI QR Code',
      icon: QrCode,
      color: '#ec4899',
      defaultProps: {
        width: 80,
        height: 80,
        content: 'upi://pay?pa=eliteedition@icici&pn=Elite%20Edition&am={{invoice.grandTotal}}',
        style: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 3, backgroundColor: '#ffffff' }
      }
    },
    {
      type: 'rect',
      label: 'Box Container',
      icon: Square,
      color: '#06b6d4',
      defaultProps: {
        width: 260,
        height: 70,
        style: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8 }
      }
    }
  ];

  const filteredCategories = ERP_TOKEN_CATEGORIES.map((cat) => ({
    ...cat,
    tokens: cat.tokens.filter(
      (t) =>
        t.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.key.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter((cat) => cat.tokens.length > 0);

  return (
    <div style={styles.container}>
      {/* 1. Header */}
      <div style={styles.sectionHeader}>
        <span style={styles.sectionTitle}>Elements & Primitives</span>
        <span style={styles.badge}>Palette</span>
      </div>

      {/* 2. Primitives Grid */}
      <div style={styles.primitivesGrid}>
        {primitives.map((prim) => {
          const Icon = prim.icon;
          return (
            <button
              key={prim.type}
              type="button"
              onClick={() => onAddElement(prim.type, prim.defaultProps)}
              style={styles.primitiveBtn}
              title={`Click to add ${prim.label} to canvas`}
            >
              <div style={{ ...styles.iconBox, backgroundColor: `${prim.color}15`, color: prim.color }}>
                <Icon size={16} />
              </div>
              <span style={styles.primitiveLabel}>{prim.label}</span>
              <Plus size={13} style={{ marginLeft: 'auto', color: '#94a3b8' }} />
            </button>
          );
        })}
      </div>

      {/* 3. ERP Dynamic Data Tokens Header & Search */}
      <div style={{ ...styles.sectionHeader, marginTop: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Sparkles size={14} color="#f59e0b" />
          <span style={styles.sectionTitle}>ERP Data Tokens</span>
        </div>
        <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Click to insert</span>
      </div>

      {/* Search Input */}
      <div style={styles.searchBox}>
        <Search size={14} color="#64748b" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search tokens (gstin, total, name)..."
          style={styles.searchInput}
        />
      </div>

      {/* Token Categories Accordion */}
      <div style={styles.tokenCategoriesList}>
        {filteredCategories.map((cat) => {
          const isCollapsed = collapsedCategories[cat.category];
          return (
            <div key={cat.category} style={styles.categoryCard}>
              <div
                onClick={() => toggleCategory(cat.category)}
                style={styles.categoryHeader}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: cat.color }} />
                  <span style={styles.categoryTitle}>{cat.category}</span>
                </div>
                {isCollapsed ? <ChevronRight size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
              </div>

              {!isCollapsed && (
                <div style={styles.tokenList}>
                  {cat.tokens.map((tok) => {
                    const isCopied = copiedToken === tok.key;
                    return (
                      <div key={tok.key} style={styles.tokenRow}>
                        <div
                          style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                          onClick={() => onInsertToken ? onInsertToken(tok.key) : handleCopy(tok.key)}
                          title={`Click to bind or insert {{${tok.key}}}`}
                        >
                          <div style={styles.tokenLabel}>{tok.label}</div>
                          <code style={styles.tokenKey}>&#123;&#123;{tok.key}&#125;&#125;</code>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(tok.key)}
                          style={styles.copyBtn}
                          title="Copy token key to clipboard"
                        >
                          {isCopied ? <Check size={12} color="#10b981" /> : <Copy size={12} color="#94a3b8" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '1rem',
    overflowY: 'auto',
    boxSizing: 'border-box'
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.65rem'
  },
  sectionTitle: {
    fontSize: '0.82rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: '#0f172a'
  },
  badge: {
    fontSize: '0.65rem',
    fontWeight: '700',
    padding: '2px 7px',
    borderRadius: '12px',
    backgroundColor: '#e0f2fe',
    color: '#0369a1'
  },
  primitivesGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '0.45rem'
  },
  primitiveBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.55rem 0.75rem',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease'
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: '7px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  primitiveLabel: {
    fontSize: '0.8rem',
    fontWeight: '600'
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.45rem 0.65rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    marginBottom: '0.75rem'
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    fontSize: '0.78rem',
    width: '100%',
    color: '#0f172a'
  },
  tokenCategoriesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem'
  },
  categoryCard: {
    border: '1px solid #e2e8f0',
    borderRadius: '9px',
    backgroundColor: '#ffffff',
    overflow: 'hidden'
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.5rem 0.7rem',
    backgroundColor: '#f8fafc',
    cursor: 'pointer',
    borderBottom: '1px solid #f1f5f9'
  },
  categoryTitle: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#334155'
  },
  tokenList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    padding: '0.5rem'
  },
  tokenRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.35rem 0.5rem',
    borderRadius: '6px',
    backgroundColor: '#f8fafc',
    border: '1px solid #f1f5f9',
    gap: '0.4rem'
  },
  tokenLabel: {
    fontSize: '0.72rem',
    fontWeight: '600',
    color: '#1e293b',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  tokenKey: {
    fontSize: '0.68rem',
    color: '#0284c7',
    fontFamily: 'monospace',
    wordBreak: 'break-all'
  },
  copyBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
};
