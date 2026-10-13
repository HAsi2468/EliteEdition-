import React from 'react';
import { 
  Trash2, Copy, AlignLeft, AlignCenter, AlignRight, Bold, Type, 
  Layers, Move, Maximize2, Palette, Table, Link2, Sparkles, Plus, X 
} from 'lucide-react';
import { ERP_TOKEN_CATEGORIES } from '../../utils/tokenResolver';

export default function PropertyInspector({
  selectedElement,
  activeTemplate,
  onUpdateTemplate,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement
}) {
  if (!selectedElement) {
    const stamp = activeTemplate?.stamp || {};
    const watermark = activeTemplate?.watermark || {};

    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <span style={styles.elementBadge}>PAGE SETUP</span>
            <div style={styles.elementIdText}>Document & Print Settings</div>
          </div>
        </div>

        {/* Page Dimensions & Sizing */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <Maximize2 size={13} color="#0284c7" /> Page Dimensions & Sizing
          </div>
          <div style={styles.grid2}>
            <div>
              <label style={styles.label}>Format Preset</label>
              <select
                value={activeTemplate?.pageSize || 'A4'}
                onChange={(e) => onUpdateTemplate && onUpdateTemplate({ pageSize: e.target.value })}
                style={styles.select}
              >
                <option value="A4">A4 (Standard 210x297mm)</option>
                <option value="A5">A5 (Half Sheet 148x210mm)</option>
                <option value="4x6">4x6" Thermal Shipping Label</option>
                <option value="3x2">3x2" Fabric Roll Barcode</option>
              </select>
            </div>
            <div>
              <label style={styles.label}>Orientation</label>
              <select
                value={activeTemplate?.orientation || 'portrait'}
                onChange={(e) => onUpdateTemplate && onUpdateTemplate({ orientation: e.target.value })}
                style={styles.select}
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
          </div>
        </div>

        {/* GST Statutory Rubber Stamp */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <Sparkles size={13} color="#dc2626" /> GST Copy Stamp
          </div>
          <p style={{ fontSize: '0.68rem', color: '#64748b', margin: '0 0 0.5rem 0' }}>
            Prints an authentic angled statutory copy badge in the top-right corner.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.6rem' }}>
            {[
              { label: 'None', text: '', color: '#64748b' },
              { label: 'Original', text: 'ORIGINAL FOR RECIPIENT', color: '#0284c7' },
              { label: 'Duplicate', text: 'DUPLICATE FOR TRANSPORTER', color: '#dc2626' },
              { label: 'Triplicate', text: 'TRIPLICATE FOR SUPPLIER', color: '#78350f' },
              { label: 'PAID', text: 'PAID', color: '#16a34a' },
              { label: 'DRAFT', text: 'DRAFT', color: '#f59e0b' },
              { label: 'CANCELLED', text: 'CANCELLED', color: '#991b1b' }
            ].map((p) => {
              const isCurrent = stamp.enabled && stamp.text === p.text;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    if (onUpdateTemplate) {
                      onUpdateTemplate({
                        stamp: {
                          enabled: !!p.text,
                          text: p.text,
                          color: p.color
                        }
                      });
                    }
                  }}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '5px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    border: `1px solid ${isCurrent ? p.color : '#e2e8f0'}`,
                    backgroundColor: isCurrent ? `${p.color}15` : '#ffffff',
                    color: isCurrent ? p.color : '#475569',
                    cursor: 'pointer'
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Translucent Watermark */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <Palette size={13} color="#6366f1" /> Background Watermark
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <label style={styles.label}>Watermark Text</label>
            <input
              type="text"
              value={watermark.text || ''}
              placeholder="e.g. ELITE EDITION or CONFIDENTIAL"
              onChange={(e) => {
                if (onUpdateTemplate) {
                  onUpdateTemplate({
                    watermark: {
                      ...watermark,
                      enabled: !!e.target.value.trim(),
                      text: e.target.value
                    }
                  });
                }
              }}
              style={styles.input}
            />
          </div>
          <div>
            <label style={styles.label}>Opacity: {Math.round((watermark.opacity || 0.08) * 100)}%</label>
            <input
              type="range"
              min="0.02"
              max="0.30"
              step="0.01"
              value={watermark.opacity || 0.08}
              onChange={(e) => {
                if (onUpdateTemplate) {
                  onUpdateTemplate({
                    watermark: {
                      ...watermark,
                      opacity: parseFloat(e.target.value)
                    }
                  });
                }
              }}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '1rem 0.5rem', color: '#94a3b8', fontSize: '0.72rem' }}>
          💡 Click any element on the canvas to inspect its font, size, position, and data bindings.
        </div>
      </div>
    );
  }

  const { id, type, x, y, width, height, content = '', fieldBinding = '', tableConfig = {}, style = {} } = selectedElement;

  const handleStyleChange = (key, value) => {
    onUpdateElement(id, {
      style: { ...style, [key]: value }
    });
  };

  const handleTableColumnChange = (index, field, value) => {
    const updatedCols = [...(tableConfig.columns || [])];
    updatedCols[index] = { ...updatedCols[index], [field]: value };
    onUpdateElement(id, {
      tableConfig: { ...tableConfig, columns: updatedCols }
    });
  };

  const handleAddTableColumn = () => {
    const updatedCols = [
      ...(tableConfig.columns || []),
      { key: `col_${Date.now()}`, label: 'New Column', width: '80px', align: 'left', field: 'field' }
    ];
    onUpdateElement(id, {
      tableConfig: { ...tableConfig, columns: updatedCols }
    });
  };

  const handleRemoveTableColumn = (index) => {
    const updatedCols = (tableConfig.columns || []).filter((_, idx) => idx !== index);
    onUpdateElement(id, {
      tableConfig: { ...tableConfig, columns: updatedCols }
    });
  };

  return (
    <div style={styles.container}>
      {/* 1. Header Toolbar with Element Type & Quick Actions */}
      <div style={styles.header}>
        <div>
          <span style={styles.elementBadge}>{type.toUpperCase()}</span>
          <div style={styles.elementIdText}>ID: {id.slice(0, 8)}...</div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            type="button"
            onClick={() => onDuplicateElement(selectedElement)}
            style={styles.actionBtn}
            title="Duplicate element"
          >
            <Copy size={13} color="#475569" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteElement(id)}
            style={{ ...styles.actionBtn, backgroundColor: '#fef2f2', borderColor: '#fecaca' }}
            title="Delete element"
          >
            <Trash2 size={13} color="#ef4444" />
          </button>
        </div>
      </div>

      {/* 2. Position & Geometry */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <Move size={13} color="#0284c7" />
          <span>Coordinates & Dimensions</span>
        </div>
        <div style={styles.grid2}>
          <div>
            <label style={styles.label}>X (Left px)</label>
            <input
              type="number"
              value={Math.round(x)}
              onChange={(e) => onUpdateElement(id, { x: Number(e.target.value) || 0 })}
              style={styles.input}
            />
          </div>
          <div>
            <label style={styles.label}>Y (Top px)</label>
            <input
              type="number"
              value={Math.round(y)}
              onChange={(e) => onUpdateElement(id, { y: Number(e.target.value) || 0 })}
              style={styles.input}
            />
          </div>
          <div>
            <label style={styles.label}>Width (px)</label>
            <input
              type="number"
              value={Math.round(width)}
              onChange={(e) => onUpdateElement(id, { width: Math.max(10, Number(e.target.value) || 10) })}
              style={styles.input}
            />
          </div>
          <div>
            <label style={styles.label}>Height (px)</label>
            <input
              type="number"
              value={Math.round(height)}
              onChange={(e) => onUpdateElement(id, { height: Math.max(2, Number(e.target.value) || 2) })}
              style={styles.input}
            />
          </div>
        </div>
      </div>

      {/* 3. Content & Dynamic Token Binding (if not a pure rect or divider) */}
      {type !== 'divider' && type !== 'rect' && type !== 'dynamic_table' && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <Link2 size={13} color="#10b981" />
            <span>Content & Data Binding</span>
          </div>

          <div style={{ marginBottom: '0.6rem' }}>
            <label style={styles.label}>ERP Field Binding (Direct Model Key)</label>
            <select
              value={fieldBinding}
              onChange={(e) => onUpdateElement(id, { fieldBinding: e.target.value })}
              style={styles.select}
            >
              <option value="">-- None (Use Static Template String) --</option>
              {ERP_TOKEN_CATEGORIES.map((cat) => (
                <optgroup key={cat.category} label={cat.category}>
                  {cat.tokens.map((tok) => (
                    <option key={tok.key} value={tok.key}>
                      {tok.label} ({tok.key})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label style={styles.label}>
              {type === 'image' ? 'Image URL' : 'Template Text (Supports {{tokens}})'}
            </label>
            <textarea
              rows={type === 'image' ? 2 : 3}
              value={content}
              onChange={(e) => onUpdateElement(id, { content: e.target.value })}
              placeholder={type === 'image' ? 'https://example.com/logo.png' : 'e.g. Inv: {{invoice.invoiceNumber}}'}
              style={styles.textarea}
            />
          </div>
        </div>
      )}

      {/* 4. Dynamic Table Specific Configuration */}
      {type === 'dynamic_table' && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <Table size={13} color="#8b5cf6" />
            <span>Table Configuration & Columns</span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.65rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={tableConfig.striped !== false}
                onChange={(e) => onUpdateElement(id, { tableConfig: { ...tableConfig, striped: e.target.checked } })}
              />
              <span>Striped Rows</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={tableConfig.showHeader !== false}
                onChange={(e) => onUpdateElement(id, { tableConfig: { ...tableConfig, showHeader: e.target.checked } })}
              />
              <span>Show Header</span>
            </label>
          </div>

          <div style={styles.grid2}>
            <div>
              <label style={styles.label}>Header Background</label>
              <input
                type="color"
                value={tableConfig.headerBg || '#0f172a'}
                onChange={(e) => onUpdateElement(id, { tableConfig: { ...tableConfig, headerBg: e.target.value } })}
                style={styles.colorInput}
              />
            </div>
            <div>
              <label style={styles.label}>Header Text Color</label>
              <input
                type="color"
                value={tableConfig.headerColor || '#ffffff'}
                onChange={(e) => onUpdateElement(id, { tableConfig: { ...tableConfig, headerColor: e.target.value } })}
                style={styles.colorInput}
              />
            </div>
          </div>

          {/* Columns Editor */}
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <label style={styles.label}>Columns ({tableConfig.columns?.length || 0})</label>
              <button
                type="button"
                onClick={handleAddTableColumn}
                style={styles.smallAddBtn}
              >
                <Plus size={11} /> Add Col
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {(tableConfig.columns || []).map((col, idx) => (
                <div key={idx} style={styles.colRow}>
                  <input
                    type="text"
                    value={col.label}
                    onChange={(e) => handleTableColumnChange(idx, 'label', e.target.value)}
                    placeholder="Header Label"
                    style={{ ...styles.input, flex: 2 }}
                  />
                  <input
                    type="text"
                    value={col.field}
                    onChange={(e) => handleTableColumnChange(idx, 'field', e.target.value)}
                    placeholder="Field key"
                    style={{ ...styles.input, flex: 1.5 }}
                    title="e.g. description, hsn, quantity, rate, total"
                  />
                  <select
                    value={col.align || 'left'}
                    onChange={(e) => handleTableColumnChange(idx, 'align', e.target.value)}
                    style={{ ...styles.select, flex: 1, padding: '3px' }}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRemoveTableColumn(idx)}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. Typography & Styling */}
      {type !== 'divider' && type !== 'rect' && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <Type size={13} color="#f59e0b" />
            <span>Typography</span>
          </div>

          <div style={styles.grid2}>
            <div>
              <label style={styles.label}>Font Size (px)</label>
              <input
                type="number"
                value={style.fontSize || 12}
                onChange={(e) => handleStyleChange('fontSize', Number(e.target.value) || 12)}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Font Weight</label>
              <select
                value={style.fontWeight || 'normal'}
                onChange={(e) => handleStyleChange('fontWeight', e.target.value)}
                style={styles.select}
              >
                <option value="normal">Normal (400)</option>
                <option value="600">Semi Bold (600)</option>
                <option value="700">Bold (700)</option>
                <option value="800">Extra Bold (800)</option>
                <option value="900">Black (900)</option>
              </select>
            </div>
          </div>

          {/* Text Alignment & Color */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.6rem' }}>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              <button
                type="button"
                onClick={() => handleStyleChange('textAlign', 'left')}
                style={{ ...styles.toolBtn, backgroundColor: style.textAlign === 'left' ? '#e2e8f0' : 'transparent' }}
              >
                <AlignLeft size={13} />
              </button>
              <button
                type="button"
                onClick={() => handleStyleChange('textAlign', 'center')}
                style={{ ...styles.toolBtn, backgroundColor: style.textAlign === 'center' ? '#e2e8f0' : 'transparent' }}
              >
                <AlignCenter size={13} />
              </button>
              <button
                type="button"
                onClick={() => handleStyleChange('textAlign', 'right')}
                style={{ ...styles.toolBtn, backgroundColor: style.textAlign === 'right' ? '#e2e8f0' : 'transparent' }}
              >
                <AlignRight size={13} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <label style={{ ...styles.label, margin: 0 }}>Color:</label>
              <input
                type="color"
                value={style.color || '#0f172a'}
                onChange={(e) => handleStyleChange('color', e.target.value)}
                style={styles.colorInput}
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. Appearance, Border & Background */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <Palette size={13} color="#06b6d4" />
          <span>Borders & Background</span>
        </div>

        <div style={styles.grid2}>
          <div>
            <label style={styles.label}>Background</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input
                type="color"
                value={style.backgroundColor && style.backgroundColor !== 'transparent' ? style.backgroundColor : '#ffffff'}
                onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                style={styles.colorInput}
              />
              <button
                type="button"
                onClick={() => handleStyleChange('backgroundColor', 'transparent')}
                style={{ fontSize: '0.65rem', padding: '2px 5px', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', background: '#f8fafc' }}
              >
                Clear
              </button>
            </div>
          </div>
          <div>
            <label style={styles.label}>Border Width</label>
            <input
              type="number"
              value={style.borderWidth || 0}
              onChange={(e) => handleStyleChange('borderWidth', Number(e.target.value) || 0)}
              style={styles.input}
            />
          </div>
          <div>
            <label style={styles.label}>Border Color</label>
            <input
              type="color"
              value={style.borderColor || '#cbd5e1'}
              onChange={(e) => handleStyleChange('borderColor', e.target.value)}
              style={styles.colorInput}
            />
          </div>
          <div>
            <label style={styles.label}>Corner Radius</label>
            <input
              type="number"
              value={style.borderRadius || 0}
              onChange={(e) => handleStyleChange('borderRadius', Number(e.target.value) || 0)}
              style={styles.input}
            />
          </div>
        </div>

        {/* Z-Index & Layering */}
        <div style={{ marginTop: '0.6rem' }}>
          <label style={styles.label}>Layer Order (Z-Index)</label>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => handleStyleChange('zIndex', Math.max(1, (style.zIndex || 1) - 1))}
              style={styles.layerBtn}
            >
              Send Back ({(style.zIndex || 1) - 1})
            </button>
            <button
              type="button"
              onClick={() => handleStyleChange('zIndex', (style.zIndex || 1) + 1)}
              style={styles.layerBtn}
            >
              Bring Front ({(style.zIndex || 1) + 1})
            </button>
          </div>
        </div>
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
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '2rem',
    textAlign: 'center',
    color: '#94a3b8'
  },
  emptyIconBox: {
    width: 48,
    height: 48,
    borderRadius: '12px',
    backgroundColor: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '0.75rem'
  },
  emptyTitle: {
    margin: '0 0 0.35rem 0',
    fontSize: '0.92rem',
    fontWeight: '700',
    color: '#334155'
  },
  emptyText: {
    margin: 0,
    fontSize: '0.75rem',
    lineHeight: '1.45',
    color: '#64748b'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '0.75rem',
    borderBottom: '1px solid #f1f5f9',
    marginBottom: '0.75rem'
  },
  elementBadge: {
    fontSize: '0.68rem',
    fontWeight: '800',
    padding: '2px 8px',
    borderRadius: '6px',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    letterSpacing: '0.04em'
  },
  elementIdText: {
    fontSize: '0.65rem',
    color: '#94a3b8',
    marginTop: '2px',
    fontFamily: 'monospace'
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: '7px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  section: {
    padding: '0.75rem',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    backgroundColor: '#ffffff',
    marginBottom: '0.75rem'
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.76rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#0f172a',
    letterSpacing: '0.04em',
    marginBottom: '0.6rem'
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem'
  },
  label: {
    display: 'block',
    fontSize: '0.7rem',
    fontWeight: '600',
    color: '#64748b',
    marginBottom: '0.25rem'
  },
  input: {
    width: '100%',
    padding: '0.4rem 0.55rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '0.78rem',
    outline: 'none',
    boxSizing: 'border-box'
  },
  select: {
    width: '100%',
    padding: '0.4rem 0.55rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '0.78rem',
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: '#ffffff'
  },
  textarea: {
    width: '100%',
    padding: '0.4rem 0.55rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '0.78rem',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    resize: 'vertical'
  },
  colorInput: {
    width: 32,
    height: 26,
    padding: 0,
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  toolBtn: {
    width: 28,
    height: 26,
    border: '1px solid #e2e8f0',
    borderRadius: '5px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  layerBtn: {
    flex: 1,
    padding: '0.35rem',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    fontSize: '0.72rem',
    fontWeight: '600',
    color: '#334155',
    cursor: 'pointer'
  },
  smallAddBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    border: 'none',
    background: '#e0f2fe',
    color: '#0284c7',
    fontSize: '0.68rem',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  colRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    backgroundColor: '#f8fafc',
    padding: '4px',
    borderRadius: '6px',
    border: '1px solid #f1f5f9'
  }
};
