import React, { useState } from 'react';
import { 
  FileText, Printer, Palette, Eye, Layout, CheckSquare, Square, 
  Sliders, CheckCircle2, RefreshCw, Sparkles, Stamp, Layers, 
  HelpCircle, Shield, Info, Smartphone, Monitor
} from 'lucide-react';

const PRESET_COLORS = [
  { label: 'Sky Blue', hex: '#0284c7' },
  { label: 'Royal Indigo', hex: '#6366f1' },
  { label: 'Emerald Green', hex: '#10b981' },
  { label: 'Deep Purple', hex: '#8b5cf6' },
  { label: 'Slate Charcoal', hex: '#334155' },
  { label: 'Crimson Wine', hex: '#e11d48' },
  { label: 'Amber Bronze', hex: '#d97706' },
  { label: 'Midnight Teal', hex: '#0f766e' }
];

export default function CompanyDesignStudio({
  companyEntity = 'Elite Edition',
  accentColor = '#0284c7',
  companyForm = {},
  challanDesign = {},
  reportDesign = {},
  onChangeChallan = () => {},
  onChangeReport = () => {},
  onSave = () => {},
  saving = false
}) {
  const [activeSubTab, setActiveSubTab] = useState('challan'); // 'challan' | 'report'
  const [previewScale, setPreviewScale] = useState(1); // 1 = 100%, 0.85 = compact

  // Safe Challan Design Fallbacks
  const challan = {
    title: challanDesign.title || 'DELIVERY CHALLAN',
    prefix: challanDesign.prefix || `${companyEntity.slice(0, 3).toUpperCase()}/DC/`,
    startingNo: challanDesign.startingNo !== undefined ? challanDesign.startingNo : 1,
    paperSize: challanDesign.paperSize || 'A4',
    orientation: challanDesign.orientation || 'portrait',
    copies: Array.isArray(challanDesign.copies) ? challanDesign.copies : ['Original for Consignee', 'Duplicate for Transporter', 'Triplicate for Supplier'],
    showLogo: challanDesign.showLogo !== false,
    showGstin: challanDesign.showGstin !== false,
    showPhoneEmail: challanDesign.showPhoneEmail !== false,
    showBankDetails: challanDesign.showBankDetails === true,
    showDesignImage: challanDesign.showDesignImage !== false,
    showHsnCode: challanDesign.showHsnCode !== false,
    showRateAndAmount: challanDesign.showRateAndAmount !== false,
    showRemarks: challanDesign.showRemarks !== false,
    signatureLeft: challanDesign.signatureLeft || "Receiver's Signature",
    signatureCenter: challanDesign.signatureCenter || "Prepared / Checked By",
    signatureRight: challanDesign.signatureRight || "Authorized Signatory",
    termsAndConditions: challanDesign.termsAndConditions || '1. Goods received in good condition and as per specification.\n2. Dispute if any subject to Surat jurisdiction only.\n3. Goods once dispatched/delivered will not be taken back.',
    footerNote: challanDesign.footerNote || 'This is a computer generated delivery challan.'
  };

  // Safe Report Design Fallbacks
  const report = {
    themeColor: reportDesign.themeColor || accentColor || '#0284c7',
    paperSize: reportDesign.paperSize || 'A4',
    orientation: reportDesign.orientation || 'landscape',
    density: reportDesign.density || 'compact',
    showLogo: reportDesign.showLogo !== false,
    showKpiSummary: reportDesign.showKpiSummary !== false,
    showGeneratedBy: reportDesign.showGeneratedBy !== false,
    showTimestamp: reportDesign.showTimestamp !== false,
    watermarkText: reportDesign.watermarkText || '',
    footerDisclaimer: reportDesign.footerDisclaimer || 'Confidential ERP Report - For Internal Operations Only.'
  };

  const handleCopyToggle = (copyName) => {
    const current = [...challan.copies];
    const index = current.indexOf(copyName);
    if (index > -1) {
      if (current.length === 1) return; // keep at least one
      current.splice(index, 1);
    } else {
      current.push(copyName);
    }
    onChangeChallan('copies', current);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Studio Header Banner */}
      <div 
        className="glass-panel" 
        style={{ 
          padding: '1.25rem 1.5rem', 
          borderLeft: `5px solid ${accentColor}`,
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '1rem' 
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              🎨 {companyEntity} — Challan & Report Design Studio
            </h3>
            <span 
              style={{ 
                fontSize: '0.72rem', 
                fontWeight: 800, 
                padding: '2px 8px', 
                borderRadius: '999px', 
                background: `${accentColor}25`, 
                color: accentColor, 
                border: `1px solid ${accentColor}50` 
              }}
            >
              LIVE PREVIEW & MULTI-COMPANY BRANDING
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Configure exact letterhead elements, column visibility, numbering format, signature boxes, and color themes.
          </p>
        </div>

        {/* Sub-tab Switcher (Challan vs Report) */}
        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '10px' }}>
          <button
            type="button"
            onClick={() => setActiveSubTab('challan')}
            style={{
              padding: '0.5rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.2s',
              background: activeSubTab === 'challan' ? accentColor : 'transparent',
              color: activeSubTab === 'challan' ? '#ffffff' : 'var(--text-muted)',
              boxShadow: activeSubTab === 'challan' ? '0 2px 10px rgba(0,0,0,0.3)' : 'none'
            }}
          >
            <FileText size={15} /> 📑 Challan Design
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('report')}
            style={{
              padding: '0.5rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.2s',
              background: activeSubTab === 'report' ? accentColor : 'transparent',
              color: activeSubTab === 'report' ? '#ffffff' : 'var(--text-muted)',
              boxShadow: activeSubTab === 'report' ? '0 2px 10px rgba(0,0,0,0.3)' : 'none'
            }}
          >
            <Layers size={15} /> 📊 Report Template
          </button>
        </div>
      </div>

      {/* Main Studio Grid: Controls on Left, Live Preview on Right */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', 
          gap: '1.5rem',
          alignItems: 'start' 
        }}
      >
        {/* ================================================================= */}
        {/* LEFT COLUMN: CONFIGURATION CONTROLS                               */}
        {/* ================================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {activeSubTab === 'challan' ? (
            <>
              {/* Card 1: Document Identity & Prefix */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={16} color={accentColor} /> Document Identity & Numbering
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Challan Document Title *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={challan.title}
                      onChange={(e) => onChangeChallan('title', e.target.value)}
                      placeholder="e.g. DELIVERY CHALLAN / JOB WORK CHALLAN"
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Prefix Code</label>
                    <input
                      type="text"
                      className="form-control"
                      value={challan.prefix}
                      onChange={(e) => onChangeChallan('prefix', e.target.value)}
                      placeholder="e.g. EDP/DC/26-27/"
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Starting Number</label>
                    <input
                      type="number"
                      className="form-control"
                      value={challan.startingNo}
                      onChange={(e) => onChangeChallan('startingNo', Number(e.target.value) || 1)}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Paper Format</label>
                    <select
                      className="form-control"
                      value={challan.paperSize}
                      onChange={(e) => onChangeChallan('paperSize', e.target.value)}
                    >
                      <option value="A4">A4 Standard Sheet</option>
                      <option value="A5">A5 Compact Half-Sheet</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Print Orientation</label>
                    <select
                      className="form-control"
                      value={challan.orientation}
                      onChange={(e) => onChangeChallan('orientation', e.target.value)}
                    >
                      <option value="portrait">Portrait (Vertical)</option>
                      <option value="landscape">Landscape (Horizontal)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Card 2: Header Visibility & Letterhead Toggles */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layout size={16} color={accentColor} /> Header & Letterhead Elements
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                    <input
                      type="checkbox"
                      checked={challan.showLogo}
                      onChange={(e) => onChangeChallan('showLogo', e.target.checked)}
                    />
                    <span>Company Logo</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                    <input
                      type="checkbox"
                      checked={challan.showGstin}
                      onChange={(e) => onChangeChallan('showGstin', e.target.checked)}
                    />
                    <span>GSTIN Number</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                    <input
                      type="checkbox"
                      checked={challan.showPhoneEmail}
                      onChange={(e) => onChangeChallan('showPhoneEmail', e.target.checked)}
                    />
                    <span>Phone & Email Info</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                    <input
                      type="checkbox"
                      checked={challan.showBankDetails}
                      onChange={(e) => onChangeChallan('showBankDetails', e.target.checked)}
                    />
                    <span>Bank Account Details</span>
                  </label>
                </div>
              </div>

              {/* Card 3: Table Columns & Content Toggles */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sliders size={16} color={accentColor} /> Challan Table Columns
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                    <input
                      type="checkbox"
                      checked={challan.showDesignImage}
                      onChange={(e) => onChangeChallan('showDesignImage', e.target.checked)}
                    />
                    <span>Design Thumbnail Image</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                    <input
                      type="checkbox"
                      checked={challan.showHsnCode}
                      onChange={(e) => onChangeChallan('showHsnCode', e.target.checked)}
                    />
                    <span>HSN / SAC Code Column</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                    <input
                      type="checkbox"
                      checked={challan.showRateAndAmount}
                      onChange={(e) => onChangeChallan('showRateAndAmount', e.target.checked)}
                    />
                    <span>Rate & Total Amount</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                    <input
                      type="checkbox"
                      checked={challan.showRemarks}
                      onChange={(e) => onChangeChallan('showRemarks', e.target.checked)}
                    />
                    <span>Remarks / Roll Breakdown</span>
                  </label>
                </div>
              </div>

              {/* Card 4: Copies to Generate */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Stamp size={16} color={accentColor} /> Printed Copy Watermarks
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {['Original for Consignee', 'Duplicate for Transporter', 'Triplicate for Supplier'].map((copy) => {
                    const active = challan.copies.includes(copy);
                    return (
                      <label 
                        key={copy} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.5rem', 
                          cursor: 'pointer', 
                          fontSize: '0.82rem',
                          padding: '0.35rem 0.6rem',
                          borderRadius: '6px',
                          background: active ? `${accentColor}15` : 'transparent',
                          border: `1px solid ${active ? accentColor + '40' : 'transparent'}`
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => handleCopyToggle(copy)}
                        />
                        <span style={{ fontWeight: active ? 700 : 400, color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {copy}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Card 5: Signatures & Authority */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={16} color={accentColor} /> Signature Blocks & Authority
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Left Signature Block</label>
                    <input
                      type="text"
                      className="form-control"
                      value={challan.signatureLeft}
                      onChange={(e) => onChangeChallan('signatureLeft', e.target.value)}
                      placeholder="Receiver's Signature"
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Center Signature Block</label>
                    <input
                      type="text"
                      className="form-control"
                      value={challan.signatureCenter}
                      onChange={(e) => onChangeChallan('signatureCenter', e.target.value)}
                      placeholder="Prepared / Checked By"
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Right Authority Signature</label>
                    <input
                      type="text"
                      className="form-control"
                      value={challan.signatureRight}
                      onChange={(e) => onChangeChallan('signatureRight', e.target.value)}
                      placeholder="Authorized Signatory"
                    />
                  </div>
                </div>
              </div>

              {/* Card 6: Terms & Conditions and Footer Note */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Info size={16} color={accentColor} /> Terms & Conditions (Challan Footer)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Legal Declaration / Terms</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={challan.termsAndConditions}
                      onChange={(e) => onChangeChallan('termsAndConditions', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Bottom Note / Disclaimer</label>
                    <input
                      type="text"
                      className="form-control"
                      value={challan.footerNote}
                      onChange={(e) => onChangeChallan('footerNote', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* REPORT DESIGN SETTINGS */
            <>
              {/* Card 1: Branding Theme Color */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Palette size={16} color={report.themeColor} /> Report Theme Color & Branding
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Selected Accent Color</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => onChangeReport('themeColor', c.hex)}
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          background: c.hex,
                          border: report.themeColor === c.hex ? '3px solid #ffffff' : '2px solid transparent',
                          boxShadow: report.themeColor === c.hex ? `0 0 10px ${c.hex}` : 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'transform 0.15s'
                        }}
                        title={c.label}
                      >
                        {report.themeColor === c.hex && <CheckCircle2 size={16} color="#ffffff" />}
                      </button>
                    ))}
                    <input
                      type="color"
                      value={report.themeColor}
                      onChange={(e) => onChangeReport('themeColor', e.target.value)}
                      style={{ width: '38px', height: '34px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'none' }}
                      title="Custom Color"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Report Paper Size & Density */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layout size={16} color={report.themeColor} /> Page Dimensions & Density
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Report Paper Size</label>
                    <select
                      className="form-control"
                      value={report.paperSize}
                      onChange={(e) => onChangeReport('paperSize', e.target.value)}
                    >
                      <option value="A4">A4 Standard Sheet</option>
                      <option value="A3">A3 Wide Format (Large Data)</option>
                      <option value="Letter">Letter Size</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Default Orientation</label>
                    <select
                      className="form-control"
                      value={report.orientation}
                      onChange={(e) => onChangeReport('orientation', e.target.value)}
                    >
                      <option value="landscape">Landscape (Recommended for Tables)</option>
                      <option value="portrait">Portrait (Vertical Summary)</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Row Density</label>
                    <select
                      className="form-control"
                      value={report.density}
                      onChange={(e) => onChangeReport('density', e.target.value)}
                    >
                      <option value="compact">Compact (Fit Maximum Rows)</option>
                      <option value="comfortable">Comfortable (Spacious Reading)</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Watermark Text</label>
                    <input
                      type="text"
                      className="form-control"
                      value={report.watermarkText}
                      onChange={(e) => onChangeReport('watermarkText', e.target.value)}
                      placeholder="e.g. CONFIDENTIAL / DRAFT"
                    />
                  </div>
                </div>
              </div>

              {/* Card 3: Report Section Toggles */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sliders size={16} color={report.themeColor} /> Report Content Toggles
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                    <input
                      type="checkbox"
                      checked={report.showLogo}
                      onChange={(e) => onChangeReport('showLogo', e.target.checked)}
                    />
                    <span>Letterhead Logo on Reports</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                    <input
                      type="checkbox"
                      checked={report.showKpiSummary}
                      onChange={(e) => onChangeReport('showKpiSummary', e.target.checked)}
                    />
                    <span>Top KPI Metrics Cards</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                    <input
                      type="checkbox"
                      checked={report.showGeneratedBy}
                      onChange={(e) => onChangeReport('showGeneratedBy', e.target.checked)}
                    />
                    <span>"Generated By Staff" Line</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                    <input
                      type="checkbox"
                      checked={report.showTimestamp}
                      onChange={(e) => onChangeReport('showTimestamp', e.target.checked)}
                    />
                    <span>Date & Timestamp Stamp</span>
                  </label>
                </div>
              </div>

              {/* Card 4: Disclaimer & Confidentiality Notice */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Info size={16} color={report.themeColor} /> Report Disclaimer Notice
                </h4>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Footer Disclaimer</label>
                  <input
                    type="text"
                    className="form-control"
                    value={report.footerDisclaimer}
                    onChange={(e) => onChangeReport('footerDisclaimer', e.target.value)}
                    placeholder="Confidential ERP Report - For Internal Operations Only."
                  />
                </div>
              </div>
            </>
          )}

          {/* Save Action Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="btn-primary"
              style={{
                padding: '0.75rem 2rem',
                fontSize: '0.95rem',
                fontWeight: 800,
                background: `linear-gradient(135deg, ${accentColor} 0%, #4c1d95 100%)`,
                borderColor: accentColor,
                boxShadow: `0 4px 18px ${accentColor}40`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                borderRadius: '8px'
              }}
            >
              {saving ? <RefreshCw className="spin" size={16} /> : <CheckCircle2 size={16} />} 
              Save {companyEntity} Design Settings
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* RIGHT COLUMN: REAL-TIME INTERACTIVE LIVE PREVIEW                  */}
        {/* ================================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Eye size={15} color={accentColor} /> Real-Time Document Visual Preview
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>Scale:</span>
              <button
                type="button"
                onClick={() => setPreviewScale(0.85)}
                style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: previewScale === 0.85 ? accentColor : 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                85%
              </button>
              <button
                type="button"
                onClick={() => setPreviewScale(1)}
                style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: previewScale === 1 ? accentColor : 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                100%
              </button>
            </div>
          </div>

          {/* Document Paper Container */}
          <div 
            style={{ 
              background: '#0f172a', 
              borderRadius: '12px', 
              padding: '1.25rem', 
              border: '1px solid var(--border-light)',
              overflowX: 'auto',
              display: 'flex',
              justifyContent: 'center',
              boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)'
            }}
          >
            {activeSubTab === 'challan' ? (
              /* REALISTIC A4/A5 CHALLAN PAPER */
              <div 
                style={{
                  width: challan.orientation === 'landscape' ? '700px' : '520px',
                  minHeight: '740px',
                  background: '#ffffff',
                  color: '#0f172a',
                  padding: '24px 28px',
                  borderRadius: '4px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top center',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  fontSize: '11px',
                  lineHeight: 1.4,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxSizing: 'border-box'
                }}
              >
                {/* Paper Content Top */}
                <div>
                  {/* Copy Badge at top right */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
                    <span 
                      style={{ 
                        fontSize: '9px', 
                        fontWeight: 800, 
                        border: '1px solid #94a3b8', 
                        padding: '2px 8px', 
                        borderRadius: '3px',
                        color: '#475569',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                    >
                      {challan.copies[0] || 'Original for Consignee'}
                    </span>
                  </div>

                  {/* Letterhead Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '12px', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      {challan.showLogo && (
                        companyForm.companyLogo ? (
                          <img 
                            src={companyForm.companyLogo} 
                            alt="Logo" 
                            style={{ height: '48px', maxWidth: '120px', objectFit: 'contain' }} 
                          />
                        ) : (
                          <div style={{ width: '48px', height: '48px', borderRadius: '6px', background: `${accentColor}20`, border: `1px solid ${accentColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor, fontWeight: 800, fontSize: '12px' }}>
                            LOGO
                          </div>
                        )
                      )}
                      <div>
                        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.2px' }}>
                          {companyForm.companyName || companyEntity.toUpperCase()}
                        </h2>
                        <div style={{ fontSize: '9.5px', color: '#475569', marginTop: '2px' }}>
                          {companyForm.companyAddress || 'Surat Textile Market, Surat, Gujarat - 395002'}
                        </div>
                        {challan.showPhoneEmail && (
                          <div style={{ fontSize: '9px', color: '#64748b' }}>
                            Ph: {companyForm.companyPhone || '+91 98790 00000'} | Email: {companyForm.companyEmail || 'info@company.com'}
                          </div>
                        )}
                        {challan.showGstin && companyForm.companyGstin && (
                          <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                            GSTIN: {companyForm.companyGstin} (State: {companyForm.companyState || 'Gujarat'} - {companyForm.companyStateCode || '24'})
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Document Title Stamp */}
                    <div style={{ textAlign: 'right' }}>
                      <div 
                        style={{ 
                          background: '#0f172a', 
                          color: '#ffffff', 
                          padding: '4px 10px', 
                          fontSize: '11px', 
                          fontWeight: 900, 
                          borderRadius: '3px',
                          display: 'inline-block',
                          letterSpacing: '0.5px'
                        }}
                      >
                        {challan.title}
                      </div>
                      <div style={{ fontSize: '10px', fontWeight: 700, marginTop: '6px' }}>
                        Challan No: <span style={{ color: '#0284c7' }}>{challan.prefix}{String(challan.startingNo).padStart(4, '0')}</span>
                      </div>
                      <div style={{ fontSize: '9.5px', color: '#64748b' }}>
                        Date: {new Date().toLocaleDateString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* Consignee / Party Details Box */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', margin: '10px 0', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '8px 10px', background: '#f8fafc' }}>
                    <div>
                      <div style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Consignee / Party (Deliver To):</div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a' }}>SHREE KRISHNA CREATION</div>
                      <div style={{ fontSize: '9px', color: '#475569' }}>Shop 402, Ring Road Textile Market, Surat</div>
                      <div style={{ fontSize: '9px', color: '#0f172a', fontWeight: 600 }}>GSTIN: 24AAACS1234D1Z2</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '9px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Dispatch Info:</div>
                      <div style={{ fontSize: '9px', color: '#334155' }}><strong>Vehicle No:</strong> GJ-05-BT-1234</div>
                      <div style={{ fontSize: '9px', color: '#334155' }}><strong>Transporter:</strong> Surat Golden Express</div>
                      <div style={{ fontSize: '9px', color: '#334155' }}><strong>Place of Supply:</strong> Gujarat (24)</div>
                    </div>
                  </div>

                  {/* Item Table Grid */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '9.5px' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderTop: '1px solid #0f172a', borderBottom: '1px solid #0f172a', textAlign: 'left' }}>
                        <th style={{ padding: '6px 4px', width: '25px', textAlign: 'center' }}>#</th>
                        {challan.showDesignImage && <th style={{ padding: '6px 4px', width: '40px', textAlign: 'center' }}>Image</th>}
                        <th style={{ padding: '6px 6px' }}>Item Description / Quality</th>
                        {challan.showHsnCode && <th style={{ padding: '6px 6px', width: '55px' }}>HSN</th>}
                        <th style={{ padding: '6px 6px', width: '35px', textAlign: 'right' }}>Pcs</th>
                        <th style={{ padding: '6px 6px', width: '50px', textAlign: 'right' }}>Meters</th>
                        {challan.showRateAndAmount && <th style={{ padding: '6px 6px', width: '50px', textAlign: 'right' }}>Rate</th>}
                        {challan.showRateAndAmount && <th style={{ padding: '6px 6px', width: '65px', textAlign: 'right' }}>Amount</th>}
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 4px', textAlign: 'center', color: '#64748b' }}>1</td>
                        {challan.showDesignImage && (
                          <td style={{ padding: '4px', textAlign: 'center' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '3px', background: '#e2e8f0', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#64748b' }}>
                              🎨
                            </div>
                          </td>
                        )}
                        <td style={{ padding: '6px 6px' }}>
                          <strong style={{ color: '#0f172a' }}>D.No: 1042-A</strong> — Poly Crepe Digital Print (44" Panna)
                          {challan.showRemarks && (
                            <div style={{ fontSize: '8.5px', color: '#64748b' }}>Roll Nos: [R1: 22.5m, R2: 23.0m]</div>
                          )}
                        </td>
                        {challan.showHsnCode && <td style={{ padding: '6px 6px', color: '#475569' }}>5407</td>}
                        <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 600 }}>2</td>
                        <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 700 }}>45.50</td>
                        {challan.showRateAndAmount && <td style={{ padding: '6px 6px', textAlign: 'right' }}>₹85.00</td>}
                        {challan.showRateAndAmount && <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 700 }}>₹3,867.50</td>}
                      </tr>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 4px', textAlign: 'center', color: '#64748b' }}>2</td>
                        {challan.showDesignImage && (
                          <td style={{ padding: '4px', textAlign: 'center' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '3px', background: '#e2e8f0', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#64748b' }}>
                              🎨
                            </div>
                          </td>
                        )}
                        <td style={{ padding: '6px 6px' }}>
                          <strong style={{ color: '#0f172a' }}>D.No: 2018-C</strong> — Satin Silk Discharge Print (58" Panna)
                          {challan.showRemarks && (
                            <div style={{ fontSize: '8.5px', color: '#64748b' }}>Roll Nos: [R1: 30.0m]</div>
                          )}
                        </td>
                        {challan.showHsnCode && <td style={{ padding: '6px 6px', color: '#475569' }}>5407</td>}
                        <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 600 }}>1</td>
                        <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 700 }}>30.00</td>
                        {challan.showRateAndAmount && <td style={{ padding: '6px 6px', textAlign: 'right' }}>₹110.00</td>}
                        {challan.showRateAndAmount && <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 700 }}>₹3,300.00</td>}
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid #0f172a', fontWeight: 800, background: '#f8fafc' }}>
                        <td colSpan={challan.showDesignImage ? 3 : 2} style={{ padding: '6px 6px' }}>TOTAL QUANTITY:</td>
                        {challan.showHsnCode && <td></td>}
                        <td style={{ padding: '6px 6px', textAlign: 'right' }}>3 Pcs</td>
                        <td style={{ padding: '6px 6px', textAlign: 'right' }}>75.50 m</td>
                        {challan.showRateAndAmount && <td></td>}
                        {challan.showRateAndAmount && <td style={{ padding: '6px 6px', textAlign: 'right', color: '#0284c7' }}>₹7,167.50</td>}
                      </tr>
                    </tfoot>
                  </table>

                  {/* Bank Details (If Toggled) */}
                  {challan.showBankDetails && companyForm.companyBankName && (
                    <div style={{ marginTop: '10px', padding: '6px 8px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '4px', fontSize: '8.5px' }}>
                      <strong>Bank Details:</strong> {companyForm.companyBankName} | A/C: {companyForm.companyAccountNo} | IFSC: {companyForm.companyIfscCode}
                    </div>
                  )}

                  {/* Terms & Conditions */}
                  <div style={{ marginTop: '14px', borderTop: '1px solid #cbd5e1', paddingTop: '8px' }}>
                    <div style={{ fontSize: '8.5px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Terms & Conditions:</div>
                    <div style={{ fontSize: '8px', color: '#64748b', whiteSpace: 'pre-line', marginTop: '2px' }}>
                      {challan.termsAndConditions}
                    </div>
                  </div>
                </div>

                {/* Bottom Signatures Block */}
                <div style={{ marginTop: '24px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', textAlign: 'center' }}>
                    <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '4px' }}>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: '#334155' }}>{challan.signatureLeft}</div>
                      <div style={{ fontSize: '7.5px', color: '#94a3b8' }}>Sign & Date</div>
                    </div>
                    <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '4px' }}>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: '#334155' }}>{challan.signatureCenter}</div>
                      <div style={{ fontSize: '7.5px', color: '#94a3b8' }}>Inspection Checked</div>
                    </div>
                    <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '4px' }}>
                      <div style={{ fontSize: '9px', fontWeight: 800, color: '#0f172a' }}>For {companyForm.companyName || companyEntity.toUpperCase()}</div>
                      <div style={{ fontSize: '8.5px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>{challan.signatureRight}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '7.5px', color: '#94a3b8' }}>
                    {challan.footerNote}
                  </div>
                </div>
              </div>
            ) : (
              /* REALISTIC REPORT PAPER */
              <div 
                style={{
                  width: report.orientation === 'landscape' ? '720px' : '520px',
                  minHeight: '740px',
                  background: '#ffffff',
                  color: '#0f172a',
                  padding: '24px 28px',
                  borderRadius: '4px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top center',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  fontSize: report.density === 'compact' ? '10px' : '11.5px',
                  lineHeight: 1.4,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxSizing: 'border-box',
                  position: 'relative'
                }}
              >
                {/* Watermark overlay */}
                {report.watermarkText && (
                  <div 
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%) rotate(-35deg)',
                      fontSize: '48px',
                      fontWeight: 900,
                      color: 'rgba(15, 23, 42, 0.04)',
                      letterSpacing: '8px',
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap',
                      textTransform: 'uppercase'
                    }}
                  >
                    {report.watermarkText}
                  </div>
                )}

                <div>
                  {/* Report Header */}
                  <div 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      borderBottom: `3px solid ${report.themeColor}`, 
                      paddingBottom: '12px' 
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {report.showLogo && (
                        companyForm.companyLogo ? (
                          <img 
                            src={companyForm.companyLogo} 
                            alt="Logo" 
                            style={{ height: '36px', maxWidth: '100px', objectFit: 'contain' }} 
                          />
                        ) : (
                          <div style={{ width: '36px', height: '36px', borderRadius: '4px', background: `${report.themeColor}20`, color: report.themeColor, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                            ERP
                          </div>
                        )
                      )}
                      <div>
                        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
                          {companyForm.companyName || companyEntity.toUpperCase()}
                        </h2>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: report.themeColor }}>
                          Operations & Production Analytics Summary
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '9px', color: '#64748b' }}>
                      {report.showTimestamp && (
                        <div><strong>Date:</strong> {new Date().toLocaleDateString('en-IN')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      )}
                      {report.showGeneratedBy && (
                        <div><strong>Generated by:</strong> Administrator</div>
                      )}
                      <div><strong>Scope:</strong> {companyEntity} (All Units)</div>
                    </div>
                  </div>

                  {/* Top KPI Cards (If Toggled) */}
                  {report.showKpiSummary && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '12px' }}>
                      <div style={{ padding: '8px', background: '#f8fafc', borderLeft: `3px solid ${report.themeColor}`, borderRadius: '4px' }}>
                        <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Jobs</div>
                        <div style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>128</div>
                      </div>
                      <div style={{ padding: '8px', background: '#f8fafc', borderLeft: '3px solid #10b981', borderRadius: '4px' }}>
                        <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Printed Mtr</div>
                        <div style={{ fontSize: '14px', fontWeight: 900, color: '#059669' }}>14,850 m</div>
                      </div>
                      <div style={{ padding: '8px', background: '#f8fafc', borderLeft: '3px solid #f59e0b', borderRadius: '4px' }}>
                        <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>In Transit</div>
                        <div style={{ fontSize: '14px', fontWeight: 900, color: '#d97706' }}>12 Batches</div>
                      </div>
                      <div style={{ padding: '8px', background: '#f8fafc', borderLeft: '3px solid #6366f1', borderRadius: '4px' }}>
                        <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Billed Value</div>
                        <div style={{ fontSize: '14px', fontWeight: 900, color: '#4f46e5' }}>₹6,42,800</div>
                      </div>
                    </div>
                  )}

                  {/* Sample Report Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '14px', fontSize: '9px' }}>
                    <thead>
                      <tr style={{ background: report.themeColor, color: '#ffffff', textAlign: 'left' }}>
                        <th style={{ padding: '6px 6px' }}>Date</th>
                        <th style={{ padding: '6px 6px' }}>Batch / Job #</th>
                        <th style={{ padding: '6px 6px' }}>Client / Party</th>
                        <th style={{ padding: '6px 6px' }}>Fabric Quality</th>
                        <th style={{ padding: '6px 6px', textAlign: 'right' }}>Meters</th>
                        <th style={{ padding: '6px 6px', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '6px 6px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 6px' }}>01/10/2026</td>
                        <td style={{ padding: '6px 6px', fontWeight: 700 }}>JOB-2041</td>
                        <td style={{ padding: '6px 6px' }}>Radhe Fashion</td>
                        <td style={{ padding: '6px 6px' }}>Heavy Poly Crepe</td>
                        <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 600 }}>1,250 m</td>
                        <td style={{ padding: '6px 6px', textAlign: 'right' }}>₹81,250</td>
                        <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 6px', borderRadius: '3px', background: '#dcfce7', color: '#15803d', fontSize: '8px', fontWeight: 700 }}>COMPLETED</span>
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                        <td style={{ padding: '6px 6px' }}>01/10/2026</td>
                        <td style={{ padding: '6px 6px', fontWeight: 700 }}>JOB-2042</td>
                        <td style={{ padding: '6px 6px' }}>Kalyan Textiles</td>
                        <td style={{ padding: '6px 6px' }}>Pure Muslin Silk</td>
                        <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 600 }}>840 m</td>
                        <td style={{ padding: '6px 6px', textAlign: 'right' }}>₹75,600</td>
                        <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 6px', borderRadius: '3px', background: '#fef3c7', color: '#b45309', fontSize: '8px', fontWeight: 700 }}>IN PRINT</span>
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 6px' }}>01/10/2026</td>
                        <td style={{ padding: '6px 6px', fontWeight: 700 }}>JOB-2043</td>
                        <td style={{ padding: '6px 6px' }}>Mahavir Prints</td>
                        <td style={{ padding: '6px 6px' }}>Viscose Rayon 14kg</td>
                        <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 600 }}>2,100 m</td>
                        <td style={{ padding: '6px 6px', textAlign: 'right' }}>₹1,47,000</td>
                        <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 6px', borderRadius: '3px', background: '#e0f2fe', color: '#0369a1', fontSize: '8px', fontWeight: 700 }}>FUSING</span>
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: `2px solid ${report.themeColor}`, background: '#f1f5f9', fontWeight: 800 }}>
                        <td colSpan={4} style={{ padding: '6px 6px' }}>AGGREGATE TOTALS:</td>
                        <td style={{ padding: '6px 6px', textAlign: 'right', color: report.themeColor }}>4,190 m</td>
                        <td style={{ padding: '6px 6px', textAlign: 'right', color: report.themeColor }}>₹3,03,850</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Report Footer */}
                <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '8px', color: '#94a3b8' }}>
                  <div>{report.footerDisclaimer}</div>
                  <div>Page 1 of 1</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
