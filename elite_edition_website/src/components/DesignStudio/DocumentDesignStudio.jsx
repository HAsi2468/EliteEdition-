import React, { useState, useEffect } from 'react';
import { 
  FileText, Save, Download, Eye, EyeOff, ZoomIn, ZoomOut, RotateCcw, RotateCw,
  Check, Plus, Sparkles, Layers, Sliders, Printer, Shield, RefreshCw, Clock, History, X 
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

  // Bulk Print & Batch PDF Merger
  const [showBulkPrintModal, setShowBulkPrintModal] = useState(false);
  const [selectedBatchRecordIds, setSelectedBatchRecordIds] = useState([]);
  const [batchCopyOption, setBatchCopyOption] = useState('ORIGINAL');
  const [generatingBatchPdf, setGeneratingBatchPdf] = useState(false);

  // Print History & Audit Logs
  const [printLogs, setPrintLogs] = useState([]);
  const [showPrintLogsModal, setShowPrintLogsModal] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Undo / Redo History Stack
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const pushHistory = (tpl) => {
    if (!tpl) return;
    setHistory((prev) => {
      const next = prev.slice(0, historyIndex + 1);
      return [...next, JSON.parse(JSON.stringify(tpl))].slice(-30);
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 29));
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const targetState = history[historyIndex - 1];
      setActiveTemplate(JSON.parse(JSON.stringify(targetState)));
      setHistoryIndex(historyIndex - 1);
      showStatus('Undo (⌘Z)');
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const targetState = history[historyIndex + 1];
      setActiveTemplate(JSON.parse(JSON.stringify(targetState)));
      setHistoryIndex(historyIndex + 1);
      showStatus('Redo (⌘Y)');
    }
  };

  // Fetch templates for selected document type
  const fetchTemplates = async (docType = documentType) => {
    setLoading(true);
    try {
      const res = await api.getDocumentTemplates(docType);
      if (res && res.data && res.data.length > 0) {
        setTemplates(res.data);
        const defaultTpl = res.data.find((t) => t.isDefault) || res.data[0];
        setActiveTemplate(defaultTpl);
        setHistory([JSON.parse(JSON.stringify(defaultTpl))]);
        setHistoryIndex(0);
      } else {
        setTemplates([]);
        setActiveTemplate(null);
        setHistory([]);
        setHistoryIndex(-1);
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

  // Fetch Print Audit Logs
  const fetchPrintLogs = async (docType = documentType) => {
    setLoadingLogs(true);
    try {
      const res = await api.getPrintLogs(docType);
      if (res && res.data) {
        setPrintLogs(res.data);
      }
    } catch (err) {
      console.warn('Failed to load print logs:', err);
    } finally {
      setLoadingLogs(false);
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

  // Global Keyboard Shortcuts (Nudging, Delete, Undo/Redo)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Do nothing if typing inside input, textarea, or select
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      // Undo: Cmd+Z / Ctrl+Z (without shift)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Cmd+Y / Ctrl+Y OR Cmd+Shift+Z
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') ||
          ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Arrow Nudging (1px, or 10px with Shift)
      if (selectedElementId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const delta = e.shiftKey ? 10 : 1;
        const currentEl = activeTemplate?.elements?.find((el) => el.id === selectedElementId);
        if (!currentEl) return;

        let { x, y } = currentEl;
        if (e.key === 'ArrowUp') y -= delta;
        if (e.key === 'ArrowDown') y += delta;
        if (e.key === 'ArrowLeft') x -= delta;
        if (e.key === 'ArrowRight') x += delta;

        handleUpdateElementPosition(selectedElementId, { x, y });
        return;
      }

      // Delete / Backspace
      if (selectedElementId && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        handleDeleteElement(selectedElementId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, activeTemplate, historyIndex, history]);

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

    setActiveTemplate((prev) => {
      const updated = {
        ...prev,
        elements: [...(prev.elements || []), newElement]
      };
      pushHistory(updated);
      return updated;
    });
    setSelectedElementId(newElement.id);
  };

  // 2. Update Element Props
  const handleUpdateElement = (id, updates) => {
    setActiveTemplate((prev) => {
      const updated = {
        ...prev,
        elements: prev.elements.map((el) => (el.id === id ? { ...el, ...updates } : el))
      };
      pushHistory(updated);
      return updated;
    });
  };

  // 3. Update Element Position/Size
  const handleUpdateElementPosition = (id, coords) => {
    setActiveTemplate((prev) => {
      const updated = {
        ...prev,
        elements: prev.elements.map((el) => (el.id === id ? { ...el, ...coords } : el))
      };
      pushHistory(updated);
      return updated;
    });
  };

  // 4. Delete Element
  const handleDeleteElement = (id) => {
    setActiveTemplate((prev) => {
      const updated = {
        ...prev,
        elements: prev.elements.filter((el) => el.id !== id)
      };
      pushHistory(updated);
      return updated;
    });
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
    setActiveTemplate((prev) => {
      const updated = {
        ...prev,
        elements: [...(prev.elements || []), clone]
      };
      pushHistory(updated);
      return updated;
    });
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

  // 9. Batch PDF Generation & Merge
  const handleGenerateBatchPdf = async () => {
    if (selectedBatchRecordIds.length === 0) {
      showStatus('Please select at least 1 document to merge', 'error');
      return;
    }
    setGeneratingBatchPdf(true);
    try {
      const res = await api.generateBatchPdf({
        documentType,
        recordIds: selectedBatchRecordIds,
        copyOption: batchCopyOption,
        templateId: activeTemplate?._id,
        templateOverride: activeTemplate
      });

      const url = window.URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Batch_${documentType}_Booklet_${selectedBatchRecordIds.length}_Docs.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showStatus(`Merged ${selectedBatchRecordIds.length} documents into PDF!`);
      setShowBulkPrintModal(false);
    } catch (err) {
      console.error('Batch PDF generation failed:', err);
      showStatus('Failed to generate batch PDF booklet', 'error');
    } finally {
      setGeneratingBatchPdf(false);
    }
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
          {/* Bulk Print Queue */}
          <button
            type="button"
            onClick={() => {
              setSelectedBatchRecordIds(recentRecords.map(r => r.id));
              setShowBulkPrintModal(true);
            }}
            style={{
              ...styles.headerBtn,
              backgroundColor: '#f0fdf4',
              color: '#15803d',
              borderColor: '#bbf7d0'
            }}
            title="Batch merge 10-50 documents into 1 printable PDF booklet"
          >
            <Layers size={15} />
            <span>Bulk Print ({recentRecords.length})</span>
          </button>

          {/* Print Audit Log Tracker */}
          <button
            type="button"
            onClick={() => {
              fetchPrintLogs();
              setShowPrintLogsModal(true);
            }}
            style={{ ...styles.headerBtn, backgroundColor: '#ffffff', color: '#475569' }}
            title="View print history, reprint counters & audit trail"
          >
            <Clock size={15} />
            <span>Audit Log</span>
          </button>

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

        {/* Zoom & History Undo/Redo Controls */}
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

          {/* Undo / Redo Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', borderLeft: '1px solid #cbd5e1', paddingLeft: '0.4rem', marginLeft: '0.2rem' }}>
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              style={{ ...styles.zoomBtn, opacity: historyIndex <= 0 ? 0.35 : 1 }}
              title="Undo (Ctrl+Z / ⌘Z)"
            >
              <RotateCcw size={12} color="#0284c7" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              style={{ ...styles.zoomBtn, opacity: historyIndex >= history.length - 1 ? 0.35 : 1 }}
              title="Redo (Ctrl+Y / ⌘Y)"
            >
              <RotateCw size={12} color="#0284c7" />
            </button>
          </div>
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

      {/* ================================================================= */}
      {/* PRINT HISTORY & AUDIT LOG MODAL                                  */}
      {/* ================================================================= */}
      {showPrintLogsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '780px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.25rem',
              borderBottom: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: 34, height: 34, borderRadius: '8px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <History size={18} color="#0284c7" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                    Print History & Statutory Audit Log
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                    Tracking print instances, user timestamps, and reprint counters (Original vs Duplicate)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintLogsModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Table Body */}
            <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
              {loadingLogs ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading print logs...</div>
              ) : printLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                  <Printer size={32} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>No print logs recorded yet for {documentType}.</p>
                  <span style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>Logs are automatically created each time "Print PDF" is invoked.</span>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', textAlign: 'left', height: '32px' }}>
                      <th style={{ padding: '6px 10px', borderRadius: '6px 0 0 6px' }}>Doc #</th>
                      <th style={{ padding: '6px 10px' }}>Party / Client</th>
                      <th style={{ padding: '6px 10px' }}>Template</th>
                      <th style={{ padding: '6px 10px' }}>Copy Type</th>
                      <th style={{ padding: '6px 10px' }}>Printed By</th>
                      <th style={{ padding: '6px 10px', borderRadius: '0 6px 6px 0' }}>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printLogs.map((log) => {
                      const isOriginal = log.printCount === 1;
                      const isDuplicate = log.printCount === 2;
                      const badgeBg = isOriginal ? '#e0f2fe' : isDuplicate ? '#fef3c7' : '#fee2e2';
                      const badgeColor = isOriginal ? '#0369a1' : isDuplicate ? '#b45309' : '#b91c1c';

                      return (
                        <tr key={log._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 800, color: '#0f172a' }}>{log.documentNumber || 'Preview'}</td>
                          <td style={{ padding: '8px 10px', color: '#334155' }}>{log.partyName || '-'}</td>
                          <td style={{ padding: '8px 10px', color: '#64748b' }}>{log.templateName}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.66rem',
                              fontWeight: 800,
                              backgroundColor: badgeBg,
                              color: badgeColor
                            }}>
                              {log.printCount === 1 ? '1st (Original)' : log.printCount === 2 ? '2nd (Duplicate)' : `${log.printCount}th (Reprint)`}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', color: '#475569' }}>{log.printedBy}</td>
                          <td style={{ padding: '8px 10px', color: '#64748b' }}>
                            {new Date(log.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowPrintLogsModal(false)}
                style={{
                  padding: '0.4rem 1rem',
                  borderRadius: '6px',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* BULK PRINT & BATCH PDF BOOKLET MODAL                             */}
      {/* ================================================================= */}
      {showBulkPrintModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '820px',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.25rem',
              borderBottom: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: 34, height: 34, borderRadius: '8px', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={18} color="#16a34a" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                    Bulk Print & Batch PDF Merger
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                    Select multiple {documentType.toLowerCase()}s and merge them into a single consolidated PDF booklet for mill dispatch
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkPrintModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* 1. Copy Type Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                  Statutory Copy Selection:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
                  {[
                    { id: 'ORIGINAL', title: 'Original Only', sub: 'Recipient copy (1 page/doc)', color: '#0284c7', bg: '#f0f9ff' },
                    { id: 'DUPLICATE', title: 'Duplicate Only', sub: 'Transporter copy (1 page/doc)', color: '#dc2626', bg: '#fef2f2' },
                    { id: 'BOTH', title: 'Both Copies (Pair)', sub: 'Original + Duplicate (2 pages/doc)', color: '#7c3aed', bg: '#f5f3ff' }
                  ].map((opt) => {
                    const isSelected = batchCopyOption === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => setBatchCopyOption(opt.id)}
                        style={{
                          padding: '0.65rem 0.85rem',
                          borderRadius: '8px',
                          border: `1.5px solid ${isSelected ? opt.color : '#e2e8f0'}`,
                          backgroundColor: isSelected ? opt.bg : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: isSelected ? opt.color : '#1e293b' }}>
                            {opt.title}
                          </span>
                          <input
                            type="radio"
                            name="batchCopy"
                            checked={isSelected}
                            onChange={() => setBatchCopyOption(opt.id)}
                            style={{ cursor: 'pointer', accentColor: opt.color }}
                          />
                        </div>
                        <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                          {opt.sub}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Documents Checklist */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155' }}>
                    Select Documents to Merge:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedBatchRecordIds.length === recentRecords.length) {
                          setSelectedBatchRecordIds([]);
                        } else {
                          setSelectedBatchRecordIds(recentRecords.map(r => r.id));
                        }
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#0284c7',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {selectedBatchRecordIds.length === recentRecords.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '10px' }}>
                      {selectedBatchRecordIds.length} / {recentRecords.length} Selected
                    </span>
                  </div>
                </div>

                {recentRecords.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                    No recent records available for {documentType}. Create an invoice or delivery challan first.
                  </div>
                ) : (
                  <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', textAlign: 'left', position: 'sticky', top: 0 }}>
                          <th style={{ width: '36px', padding: '6px 10px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={recentRecords.length > 0 && selectedBatchRecordIds.length === recentRecords.length}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedBatchRecordIds(recentRecords.map(r => r.id));
                                else setSelectedBatchRecordIds([]);
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                          </th>
                          <th style={{ padding: '6px 10px' }}>Doc Number</th>
                          <th style={{ padding: '6px 10px' }}>Party / Client Name</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' }}>Amount / Meters</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentRecords.map((r) => {
                          const isChecked = selectedBatchRecordIds.includes(r.id);
                          const docNum = r.dataContext?.invoice?.invoiceNumber || r.dataContext?.challan?.challanNumber || r.dataContext?.jobCard?.jobCardNumber || r.label;
                          const party = r.dataContext?.customer?.name || '-';
                          const amt = r.dataContext?.invoice?.grandTotal !== undefined
                            ? `₹${Number(r.dataContext.invoice.grandTotal).toLocaleString('en-IN')}`
                            : r.dataContext?.challan?.totalMeters !== undefined
                            ? `${r.dataContext.challan.totalMeters} Mtr`
                            : '-';

                          return (
                            <tr
                              key={r.id}
                              onClick={() => {
                                setSelectedBatchRecordIds(prev => 
                                  prev.includes(r.id) ? prev.filter(id => id !== r.id) : [...prev, r.id]
                                );
                              }}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                backgroundColor: isChecked ? '#f0fdf4' : '#ffffff',
                                cursor: 'pointer'
                              }}
                            >
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  style={{ cursor: 'pointer' }}
                                />
                              </td>
                              <td style={{ padding: '8px 10px', fontWeight: 800, color: '#0f172a' }}>{docNum}</td>
                              <td style={{ padding: '8px 10px', color: '#334155' }}>{party}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{amt}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '0.85rem 1.25rem',
              borderTop: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '0.73rem', color: '#64748b' }}>
                Total Output: <strong>{selectedBatchRecordIds.length * (batchCopyOption === 'BOTH' ? 2 : 1)} Pages</strong> in single PDF booklet
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => setShowBulkPrintModal(false)}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    color: '#64748b',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerateBatchPdf}
                  disabled={generatingBatchPdf || selectedBatchRecordIds.length === 0}
                  style={{
                    padding: '0.45rem 1.25rem',
                    borderRadius: '6px',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: (generatingBatchPdf || selectedBatchRecordIds.length === 0) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)'
                  }}
                >
                  {generatingBatchPdf ? <RefreshCw size={15} className="spin-loader" /> : <Download size={15} />}
                  <span>{generatingBatchPdf ? 'Rendering Booklet...' : `Merge & Print (${selectedBatchRecordIds.length} Docs)`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
