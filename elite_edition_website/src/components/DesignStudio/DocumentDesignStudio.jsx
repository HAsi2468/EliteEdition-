import React, { useState, useEffect } from 'react';
import { 
  FileText, Save, Download, Eye, EyeOff, ZoomIn, ZoomOut, RotateCcw, 
  Check, Plus, Sparkles, Layers, Sliders, Printer, Shield, RefreshCw 
} from 'lucide-react';
import TokenPalette from './TokenPalette';
import A4Canvas from './A4Canvas';
import PropertyInspector from './PropertyInspector';
import { MOCK_DATA_CONTEXT } from '../../utils/tokenResolver';
import { api } from '../../services/api';

export default function DocumentDesignStudio({
  initialDocType = 'INVOICE',
  companyEntity = 'Elite Edition',
  onClose = null
}) {
  const [documentType, setDocumentType] = useState(initialDocType);
  const [templates, setTemplates] = useState([]);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [isPreview, setIsPreview] = useState(false);
  const [zoom, setZoom] = useState(0.85);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Real ERP Records for live test previewing
  const [recentRecords, setRecentRecords] = useState([]);
  const [selectedRecordId, setSelectedRecordId] = useState('mock');

  // Fetch templates for selected document type
  const fetchTemplates = async (docType = documentType) => {
    setLoading(true);
    try {
      const res = await api.getDocumentTemplates(docType);
      if (res && res.data && res.data.length > 0) {
        setTemplates(res.data);
        const defaultTpl = res.data.find((t) => t.isDefault) || res.data[0];
        setActiveTemplate(defaultTpl);
      } else {
        setTemplates([]);
        setActiveTemplate(null);
      }
    } catch (err) {
      console.error('Failed to load document templates:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch real ERP records for selected document type
  const fetchRecentRecords = async (docType = documentType) => {
    try {
      const res = await api.getRecentRecords(docType);
      if (res && res.data) {
        setRecentRecords(res.data);
      } else {
        setRecentRecords([]);
      }
    } catch (err) {
      console.warn('Failed to load recent ERP records for studio:', err);
    }
  };

  useEffect(() => {
    fetchTemplates(documentType);
    fetchRecentRecords(documentType);
    setSelectedRecordId('mock');
  }, [documentType]);

  const showStatus = (msg, type = 'success') => {
    setStatusMessage({ msg, type });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // 1. Add Element
  const handleAddElement = (type, defaultProps = {}) => {
    if (!activeTemplate) return;
    const newElement = {
      id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type,
      x: 30,
      y: 60,
      width: defaultProps.width || 180,
      height: defaultProps.height || 36,
      content: defaultProps.content || '',
      fieldBinding: defaultProps.fieldBinding || '',
      tableConfig: defaultProps.tableConfig || {},
      style: {
        fontSize: 12,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'left',
        color: '#0f172a',
        backgroundColor: 'transparent',
        borderWidth: 0,
        borderRadius: 0,
        padding: 0,
        zIndex: (activeTemplate.elements?.length || 0) + 1,
        ...defaultProps.style
      }
    };

    setActiveTemplate((prev) => ({
      ...prev,
      elements: [...(prev.elements || []), newElement]
    }));
    setSelectedElementId(newElement.id);
  };

  // 2. Update Element Props
  const handleUpdateElement = (id, updates) => {
    setActiveTemplate((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => (el.id === id ? { ...el, ...updates } : el))
    }));
  };

  // 3. Update Element Position/Size
  const handleUpdateElementPosition = (id, coords) => {
    setActiveTemplate((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => (el.id === id ? { ...el, ...coords } : el))
    }));
  };

  // 4. Delete Element
  const handleDeleteElement = (id) => {
    setActiveTemplate((prev) => ({
      ...prev,
      elements: prev.elements.filter((el) => el.id !== id)
    }));
    if (selectedElementId === id) setSelectedElementId(null);
  };

  // 5. Duplicate Element
  const handleDuplicateElement = (el) => {
    const clone = {
      ...JSON.parse(JSON.stringify(el)),
      id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      x: (el.x || 0) + 15,
      y: (el.y || 0) + 15
    };
    setActiveTemplate((prev) => ({
      ...prev,
      elements: [...(prev.elements || []), clone]
    }));
    setSelectedElementId(clone.id);
  };

  // 6. Save Template
  const handleSaveTemplate = async () => {
    if (!activeTemplate) return;
    setSaving(true);
    try {
      let res;
      if (activeTemplate._id) {
        res = await api.updateDocumentTemplate(activeTemplate._id, activeTemplate);
      } else {
        res = await api.createDocumentTemplate(activeTemplate);
      }
      if (res && res.data) {
        setActiveTemplate(res.data);
        showStatus('Template saved successfully!');
        fetchTemplates(documentType);
      }
    } catch (err) {
      console.error('Failed to save template:', err);
      showStatus('Failed to save template', 'error');
    } finally {
      setSaving(false);
    }
  };

  // 7. Generate Production PDF
  const handleGeneratePdf = async () => {
    if (!activeTemplate) return;
    setGeneratingPdf(true);
    try {
      const selectedRec = recentRecords.find((r) => r.id === selectedRecordId);
      const customDataContext = selectedRec ? selectedRec.dataContext : null;

      const response = await api.generateTemplatePdf({
        documentType: activeTemplate.documentType,
        mockData: !customDataContext,
        dataContext: customDataContext,
        templateOverride: activeTemplate
      });

      // Create download blob
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${activeTemplate.name.replace(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showStatus('PDF rendered and downloaded!');
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      showStatus('Failed to generate PDF buffer', 'error');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Quick Alignment Actions for selected element
  const handleAlignElement = (alignment) => {
    if (!selectedElementId || !activeTemplate) return;
    const el = activeTemplate.elements.find((e) => e.id === selectedElementId);
    if (!el) return;

    let baseWidth = 595;
    let baseHeight = 842;
    if (activeTemplate.pageSize === 'A5') { baseWidth = 420; baseHeight = 595; }
    else if (activeTemplate.pageSize === '4x6') { baseWidth = 288; baseHeight = 432; }
    else if (activeTemplate.pageSize === '3x2') { baseWidth = 216; baseHeight = 144; }
    const isLandscape = activeTemplate.orientation === 'landscape';
    const cWidth = isLandscape ? baseHeight : baseWidth;
    const cHeight = isLandscape ? baseWidth : baseHeight;
    const margins = activeTemplate.margins || { top: 20, bottom: 20, left: 20, right: 20 };

    let updates = {};
    if (alignment === 'left') updates = { x: margins.left };
    else if (alignment === 'center-h') updates = { x: Math.round((cWidth - el.width) / 2) };
    else if (alignment === 'right') updates = { x: cWidth - margins.right - el.width };
    else if (alignment === 'top') updates = { y: margins.top };
    else if (alignment === 'center-v') updates = { y: Math.round((cHeight - el.height) / 2) };
    else if (alignment === 'bottom') updates = { y: cHeight - margins.bottom - el.height };

    handleUpdateElement(selectedElementId, updates);
  };

  // 8. New Template
  const handleCreateNewTemplate = () => {
    const newTpl = {
      name: `Custom ${documentType} Template (${templates.length + 1})`,
      documentType,
      pageSize: 'A4',
      orientation: 'portrait',
      margins: { top: 20, bottom: 20, left: 20, right: 20 },
      elements: [
        {
          id: `el_head_${Date.now()}`,
          type: 'text',
          x: 20,
          y: 20,
          width: 300,
          height: 30,
          content: '{{company.name}}',
          style: { fontSize: 16, fontWeight: '800', color: '#0f172a' }
        }
      ],
      isDefault: false
    };
    setActiveTemplate(newTpl);
    setSelectedElementId(null);
  };

  const selectedElement = activeTemplate?.elements?.find((el) => el.id === selectedElementId);
  const selectedRecord = recentRecords.find((r) => r.id === selectedRecordId);
  const currentDataContext = selectedRecord ? selectedRecord.dataContext : (MOCK_DATA_CONTEXT[documentType] || MOCK_DATA_CONTEXT);

  return (
    <div style={styles.studioContainer}>
      {/* ================================================================= */}
      {/* TOP BAR / CONTROL HEADER                                          */}
      {/* ================================================================= */}
      <div style={styles.topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={styles.logoBadge}>
            <Sliders size={18} color="#0284c7" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={styles.title}>Document Design Studio</h3>
              <span style={styles.versionBadge}>v2.0 Visual Engine</span>
            </div>
            <p style={styles.subtitle}>
              Design, customize, and print pixel-perfect A4 & Thermal templates for {companyEntity}
            </p>
          </div>
        </div>

        {/* Center Document Type Selector (Includes Thermal Labels) */}
        <div style={styles.docTypePills}>
          {[
            { id: 'INVOICE', label: 'Invoices' },
            { id: 'CHALLAN', label: 'Challans' },
            { id: 'JOB_CARD', label: 'Job Cards' },
            { id: 'SHIPPING_LABEL', label: '4x6" Shipping' },
            { id: 'ROLL_LABEL', label: '3x2" Roll Barcode' }
          ].map((item) => {
            const isActive = documentType === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setDocumentType(item.id);
                  setSelectedElementId(null);
                }}
                style={{
                  ...styles.docTypeBtn,
                  backgroundColor: isActive ? '#0284c7' : 'transparent',
                  color: isActive ? '#ffffff' : '#64748b'
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Right Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {/* Live Mock / Real Record Preview Toggle */}
          <button
            type="button"
            onClick={() => setIsPreview(!isPreview)}
            style={{
              ...styles.headerBtn,
              backgroundColor: isPreview ? '#e0f2fe' : '#ffffff',
              color: isPreview ? '#0284c7' : '#334155',
              borderColor: isPreview ? '#bae6fd' : '#cbd5e1'
            }}
            title="Toggle between token keys and realistic preview"
          >
            {isPreview ? <EyeOff size={15} /> : <Eye size={15} />}
            <span>{isPreview ? 'Design Mode' : 'Live Preview'}</span>
          </button>

          {/* Download Puppeteer PDF */}
          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={generatingPdf || !activeTemplate}
            style={{ ...styles.headerBtn, backgroundColor: '#ffffff', color: '#0f172a' }}
            title="Generate & Stream PDF from Puppeteer"
          >
            {generatingPdf ? <RefreshCw size={15} className="spin-loader" /> : <Download size={15} />}
            <span>{generatingPdf ? 'Rendering PDF...' : 'Print PDF'}</span>
          </button>

          {/* Save Template Button */}
          <button
            type="button"
            onClick={handleSaveTemplate}
            disabled={saving || !activeTemplate}
            style={styles.saveBtn}
          >
            {saving ? <RefreshCw size={15} className="spin-loader" /> : <Save size={15} />}
            <span>{saving ? 'Saving...' : 'Save Template'}</span>
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* SECONDARY SUB-BAR: TEMPLATE, REAL RECORD, ALIGNMENT & ZOOM       */}
      {/* ================================================================= */}
      <div style={styles.subBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569' }}>Active Template:</span>
          <select
            value={activeTemplate?._id || ''}
            onChange={(e) => {
              const tpl = templates.find((t) => t._id === e.target.value);
              if (tpl) {
                setActiveTemplate(tpl);
                setSelectedElementId(null);
              }
            }}
            style={styles.templateSelect}
          >
            {templates.map((tpl) => (
              <option key={tpl._id} value={tpl._id}>
                {tpl.name} {tpl.isDefault ? '★ (Default)' : ''}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleCreateNewTemplate}
            style={styles.subBtn}
            title="Create blank new template"
          >
            <Plus size={13} /> New Blank
          </button>

          {/* Real ERP Data Source Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>Data Source:</span>
            <select
              value={selectedRecordId}
              onChange={(e) => setSelectedRecordId(e.target.value)}
              style={{
                padding: '0.3rem 0.55rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.72rem',
                fontWeight: 600,
                color: selectedRecordId === 'mock' ? '#64748b' : '#0284c7',
                backgroundColor: selectedRecordId === 'mock' ? '#ffffff' : '#f0f9ff',
                outline: 'none',
                cursor: 'pointer',
                maxWidth: '240px'
              }}
            >
              <option value="mock">🧪 Mock Test Data</option>
              {recentRecords.map((r) => (
                <option key={r.id} value={r.id}>
                  📄 {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Alignment Toolbar (Shown when an element is selected) */}
          {selectedElementId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', backgroundColor: '#e2e8f0', padding: '2px 4px', borderRadius: '6px', marginLeft: '0.5rem' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569', padding: '0 3px' }}>Align:</span>
              <button type="button" onClick={() => handleAlignElement('left')} style={styles.alignBtn} title="Align Left Margins">⇥ Left</button>
              <button type="button" onClick={() => handleAlignElement('center-h')} style={styles.alignBtn} title="Center Horizontally">↔ Center</button>
              <button type="button" onClick={() => handleAlignElement('right')} style={styles.alignBtn} title="Align Right Margins">⇤ Right</button>
              <button type="button" onClick={() => handleAlignElement('top')} style={styles.alignBtn} title="Align Top Margins">⤒ Top</button>
              <button type="button" onClick={() => handleAlignElement('bottom')} style={styles.alignBtn} title="Align Bottom Margins">⤓ Bottom</button>
            </div>
          )}
        </div>

        {/* Status Notification Toast */}
        {statusMessage && (
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '6px',
              backgroundColor: statusMessage.type === 'error' ? '#fef2f2' : '#f0fdf4',
              color: statusMessage.type === 'error' ? '#ef4444' : '#16a34a',
              border: `1px solid ${statusMessage.type === 'error' ? '#fecaca' : '#bbf7d0'}`
            }}
          >
            {statusMessage.msg}
          </div>
        )}

        {/* Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            type="button"
            onClick={() => setZoom(Math.max(0.4, Number((zoom - 0.1).toFixed(2))))}
            style={styles.zoomBtn}
          >
            <ZoomOut size={13} />
          </button>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', minWidth: '38px', textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom(Math.min(1.4, Number((zoom + 0.1).toFixed(2))))}
            style={styles.zoomBtn}
          >
            <ZoomIn size={13} />
          </button>
          <button
            type="button"
            onClick={() => setZoom(0.85)}
            style={styles.zoomBtn}
            title="Reset Zoom to 85%"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 3-PANEL STUDIO WORKSPACE                                          */}
      {/* ================================================================= */}
      <div style={styles.workspaceGrid}>
        {/* LEFT PANEL: Elements & Tokens */}
        <div style={styles.leftPanel}>
          <TokenPalette
            onAddElement={handleAddElement}
            onInsertToken={(tokenKey) => {
              if (selectedElementId) {
                const el = activeTemplate.elements.find((e) => e.id === selectedElementId);
                if (el) {
                  handleUpdateElement(selectedElementId, {
                    content: `${el.content || ''} {{${tokenKey}}}`
                  });
                }
              } else {
                handleAddElement('dynamic_text', {
                  content: `{{${tokenKey}}}`,
                  fieldBinding: tokenKey
                });
              }
            }}
          />
        </div>

        {/* CENTER PANEL: Canvas */}
        <div style={styles.centerPanel}>
          {activeTemplate ? (
            <A4Canvas
              template={activeTemplate}
              selectedElementId={selectedElementId}
              onSelectElement={setSelectedElementId}
              onUpdateElementPosition={handleUpdateElementPosition}
              isPreview={isPreview}
              zoom={zoom}
              dataContext={currentDataContext}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
              Loading template canvas...
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Property & Document Setup Inspector */}
        <div style={styles.rightPanel}>
          <PropertyInspector
            selectedElement={selectedElement}
            activeTemplate={activeTemplate}
            onUpdateTemplate={(updates) => setActiveTemplate((prev) => ({ ...prev, ...updates }))}
            onUpdateElement={handleUpdateElement}
            onDeleteElement={handleDeleteElement}
            onDuplicateElement={handleDuplicateElement}
          />
        </div>
      </div>
    </div>
  );
}

const styles = {
  studioContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 120px)',
    minHeight: '680px',
    backgroundColor: '#f1f5f9',
    borderRadius: '14px',
    border: '1px solid #cbd5e1',
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1.25rem',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    flexWrap: 'wrap',
    gap: '0.75rem'
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: '10px',
    backgroundColor: '#e0f2fe',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: '-0.02em'
  },
  versionBadge: {
    fontSize: '0.65rem',
    fontWeight: '800',
    padding: '2px 7px',
    borderRadius: '10px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0'
  },
  subtitle: {
    margin: '2px 0 0 0',
    fontSize: '0.72rem',
    color: '#64748b'
  },
  docTypePills: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: '9px',
    padding: '3px',
    border: '1px solid #e2e8f0'
  },
  docTypeBtn: {
    border: 'none',
    padding: '0.35rem 0.85rem',
    borderRadius: '7px',
    fontSize: '0.72rem',
    fontWeight: '800',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  headerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.45rem 0.85rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '0.75rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.15s'
  },
  saveBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.45rem 0.95rem',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    fontSize: '0.75rem',
    fontWeight: '800',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)'
  },
  subBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.5rem 1.25rem',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0'
  },
  templateSelect: {
    padding: '0.35rem 0.65rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '0.75rem',
    fontWeight: '600',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    outline: 'none'
  },
  subBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    padding: '0.35rem 0.65rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    fontSize: '0.72rem',
    fontWeight: '700',
    color: '#334155',
    cursor: 'pointer'
  },
  zoomBtn: {
    width: 26,
    height: 26,
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#475569'
  },
  alignBtn: {
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    fontSize: '0.68rem',
    fontWeight: '700',
    color: '#334155',
    cursor: 'pointer'
  },
  workspaceGrid: {
    display: 'grid',
    gridTemplateColumns: '270px 1fr 310px',
    flex: 1,
    overflow: 'hidden'
  },
  leftPanel: {
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e2e8f0',
    overflowY: 'auto'
  },
  centerPanel: {
    backgroundColor: '#cbd5e1',
    overflow: 'auto',
    position: 'relative'
  },
  rightPanel: {
    backgroundColor: '#ffffff',
    borderLeft: '1px solid #e2e8f0',
    overflowY: 'auto'
  }
};
