import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Building, CreditCard, Save, RefreshCw, FileText, Upload, Image as ImageIcon, Trash2, Plus, Sliders, CheckCircle2 } from 'lucide-react';
import { triggerEliteAlert } from './EliteModalDialog';

const getCompanyAccentColor = (entity) => {
  return 'var(--primary)';
};

export default function CompanySettingsPanel({ companyEntity = 'Elite Edition' }) {
  const accentColor = getCompanyAccentColor(companyEntity);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    companyName: companyEntity.toUpperCase(),
    companyGstin: '',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    companyLogo: '',
    companyState: 'Gujarat',
    companyStateCode: '24',
    companyBankName: '',
    companyAccountNo: '',
    companyIfscCode: '',
    invoicePrefix: companyEntity === 'Elite Fabtex' ? 'EF-2627-' : companyEntity === 'Elite Edition' ? 'EE-2627-' : 'EDP-INV-',
    startingInvoiceNo: companyEntity === 'Elite Online' ? 1001 : 1,
    companyTerms: 'Payment due within 30 days from invoice date. Subject to Surat jurisdiction.',
    categories: [],
    paperTypes: [],
    fabrics: [],
    widths: [],
    passes: []
  });

  const [newTagInput, setNewTagInput] = useState({
    categories: '',
    paperTypes: '',
    fabrics: '',
    widths: '',
    passes: ''
  });

  useEffect(() => {
    loadSettings();
  }, [companyEntity]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.getCompanySettings(companyEntity);
      if (res && res.data) {
        setForm(f => ({
          ...f,
          ...res.data,
          categories: Array.isArray(res.data.categories) ? res.data.categories : [],
          paperTypes: Array.isArray(res.data.paperTypes) ? res.data.paperTypes : [],
          fabrics: Array.isArray(res.data.fabrics) ? res.data.fabrics : [],
          widths: Array.isArray(res.data.widths) ? res.data.widths : [],
          passes: Array.isArray(res.data.passes) ? res.data.passes : []
        }));
      }
    } catch (err) {
      console.warn('Failed to load company settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      triggerEliteAlert('File Too Large', 'Please upload a logo image smaller than 2MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setForm(f => ({ ...f, companyLogo: uploadEvent.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setForm(f => ({ ...f, companyLogo: '' }));
  };

  const handleAddTag = (field) => {
    const val = (newTagInput[field] || '').trim();
    if (!val) return;
    if (form[field]?.includes(val)) return;
    setForm(f => ({ ...f, [field]: [...(f[field] || []), val] }));
    setNewTagInput(t => ({ ...t, [field]: '' }));
  };

  const handleRemoveTag = (field, tagToRemove) => {
    setForm(f => ({ ...f, [field]: f[field].filter(t => t !== tagToRemove) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateCompanySettings({ ...form, companyEntity });
      triggerEliteAlert({
        title: 'Settings Saved',
        message: `Company Settings for "${companyEntity}" updated successfully!`
      });
    } catch (err) {
      triggerEliteAlert({
        title: 'Save Failed',
        message: err.message || 'Failed to update company settings.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  if (loading) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw className="spin" size={28} style={{ color: accentColor, marginBottom: '0.5rem' }} />
        <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>Loading Official Settings for {companyEntity}...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1040px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '1.5rem 1.75rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          borderLeft: `5px solid ${accentColor}`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.25)`
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              🏢 {companyEntity} — Corporate Profile & Settings
            </h2>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '999px',
                background: `${accentColor}25`,
                color: accentColor,
                border: `1px solid ${accentColor}50`
              }}
            >
              ISOLATED COMPANY SCOPE
            </span>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: '0.35rem', marginBottom: 0 }}>
            Manage official letterhead logo, legal address, GSTIN, bank details, invoice numbering prefix, and custom dynamic dropdowns for <strong>{companyEntity}</strong>.
          </p>
        </div>

        <button onClick={loadSettings} className="btn-secondary" style={{ padding: '0.55rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Company Logo & Letterhead Header */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderTop: `3px solid ${accentColor}` }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: accentColor, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <ImageIcon size={18} /> Company Letterhead Logo (Printed on Invoice PDFs)
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem', flexWrap: 'wrap' }}>
            <div
              style={{
                width: '200px',
                height: '85px',
                borderRadius: '12px',
                border: `2px dashed ${form.companyLogo ? accentColor : 'var(--border-light)'}`,
                background: 'rgba(0,0,0,0.25)',
                display: 'flex',
                alignItems: 'center',
                justify: 'center',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: form.companyLogo ? `0 4px 16px ${accentColor}25` : 'none'
              }}
            >
              {form.companyLogo ? (
                <img src={form.companyLogo} alt="Company Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem' }}>
                  No Logo Uploaded (Default will be used)
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label
                  className="btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    padding: '0.65rem 1.25rem',
                    background: accentColor,
                    borderColor: accentColor
                  }}
                >
                  <Upload size={16} /> Upload Company Logo Image
                  <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleLogoUpload} style={{ display: 'none' }} />
                </label>

                {form.companyLogo && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    style={{
                      color: '#ef4444',
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      padding: '0.6rem 1rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <Trash2 size={14} /> Remove Logo
                  </button>
                )}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Recommended: Transparent PNG logo (Max 2MB). This exact logo will print at the top left of all Tax Invoice PDFs for <strong>{companyEntity}</strong>.
              </span>
            </div>
          </div>
        </div>

        {/* Company Business Profile */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <Building size={18} color={accentColor} /> Legal Business Profile & GSTIN
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div>
              <label className="form-label">Company / Firm Legal Name *</label>
              <input
                type="text"
                name="companyName"
                value={form.companyName}
                onChange={handleChange}
                className="form-control"
                style={{ fontWeight: 600 }}
                required
              />
            </div>

            <div>
              <label className="form-label">GSTIN Number</label>
              <input
                type="text"
                name="companyGstin"
                value={form.companyGstin}
                onChange={handleChange}
                placeholder="24AAAAA0000A1Z5"
                className="form-control"
                style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}
              />
            </div>

            <div>
              <label className="form-label">Phone / Mobile</label>
              <input
                type="text"
                name="companyPhone"
                value={form.companyPhone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
                className="form-control"
              />
            </div>

            <div>
              <label className="form-label">Email Address</label>
              <input
                type="email"
                name="companyEmail"
                value={form.companyEmail}
                onChange={handleChange}
                placeholder="billing@company.com"
                className="form-control"
              />
            </div>

            <div>
              <label className="form-label">State Name</label>
              <input
                type="text"
                name="companyState"
                value={form.companyState}
                onChange={handleChange}
                className="form-control"
              />
            </div>

            <div>
              <label className="form-label">State GST Code</label>
              <input
                type="text"
                name="companyStateCode"
                value={form.companyStateCode}
                onChange={handleChange}
                placeholder="24"
                className="form-control"
              />
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label className="form-label">Registered Office & Factory Address</label>
            <textarea
              name="companyAddress"
              value={form.companyAddress}
              onChange={handleChange}
              rows={3}
              className="form-control"
              placeholder="Full address printed on Tax Invoices"
            />
          </div>
        </div>

        {/* Bank & Payment Details */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#10b981', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <CreditCard size={18} /> Bank Account Details (Printed on Invoices)
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div>
              <label className="form-label">Bank Name</label>
              <input
                type="text"
                name="companyBankName"
                value={form.companyBankName}
                onChange={handleChange}
                placeholder="HDFC Bank / ICICI Bank"
                className="form-control"
              />
            </div>

            <div>
              <label className="form-label">Account Number</label>
              <input
                type="text"
                name="companyAccountNo"
                value={form.companyAccountNo}
                onChange={handleChange}
                placeholder="50200012345678"
                className="form-control"
              />
            </div>

            <div>
              <label className="form-label">IFSC Code</label>
              <input
                type="text"
                name="companyIfscCode"
                value={form.companyIfscCode}
                onChange={handleChange}
                placeholder="HDFC0001234"
                className="form-control"
                style={{ textTransform: 'uppercase' }}
              />
            </div>
          </div>
        </div>

        {/* Invoice Numbering & Sequence */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f59e0b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <FileText size={18} /> Invoice Prefix & Numbering Sequence
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div>
              <label className="form-label">Invoice Prefix</label>
              <input
                type="text"
                name="invoicePrefix"
                value={form.invoicePrefix}
                onChange={handleChange}
                placeholder={companyEntity === 'Elite Fabtex' ? 'EF-2627-' : 'EE-2627-'}
                className="form-control"
              />
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                Preview generated invoice: <strong>{form.invoicePrefix}{String(form.startingInvoiceNo || 1).padStart(4, '0')}</strong>
              </span>
            </div>

            <div>
              <label className="form-label">Starting Sequence Number</label>
              <input
                type="number"
                name="startingInvoiceNo"
                value={form.startingInvoiceNo}
                onChange={handleChange}
                className="form-control"
              />
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label className="form-label">Terms & Conditions (Printed on Invoice Footer)</label>
            <textarea
              name="companyTerms"
              value={form.companyTerms}
              onChange={handleChange}
              rows={3}
              className="form-control"
            />
          </div>
        </div>

        {/* Dynamic Values & Dropdowns */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ec4899', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <Sliders size={18} /> Dynamic Settings & Custom Dropdowns
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {/* Product Categories */}
            <div>
              <label className="form-label">Product Categories</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  value={newTagInput.categories}
                  onChange={(e) => setNewTagInput(t => ({ ...t, categories: e.target.value }))}
                  placeholder="Add category..."
                  className="form-control"
                />
                <button type="button" onClick={() => handleAddTag('categories')} className="btn-secondary" style={{ padding: '0.4rem 0.85rem' }}>
                  <Plus size={16} />
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {form.categories?.map(tag => (
                  <span key={tag} style={{ background: 'rgba(236,72,153,0.15)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.3)', padding: '3px 10px', borderRadius: '6px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    {tag} <Trash2 size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveTag('categories', tag)} />
                  </span>
                ))}
              </div>
            </div>

            {/* Fabrics */}
            <div>
              <label className="form-label">Fabric Types</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  value={newTagInput.fabrics}
                  onChange={(e) => setNewTagInput(t => ({ ...t, fabrics: e.target.value }))}
                  placeholder="Add fabric..."
                  className="form-control"
                />
                <button type="button" onClick={() => handleAddTag('fabrics')} className="btn-secondary" style={{ padding: '0.4rem 0.85rem' }}>
                  <Plus size={16} />
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {form.fabrics?.map(tag => (
                  <span key={tag} style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', padding: '3px 10px', borderRadius: '6px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    {tag} <Trash2 size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveTag('fabrics', tag)} />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Save Action */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
            style={{
              padding: '0.85rem 3rem',
              fontSize: '1rem',
              fontWeight: 800,
              background: `linear-gradient(135deg, ${accentColor} 0%, #4c1d95 100%)`,
              borderColor: accentColor,
              boxShadow: `0 4px 18px ${accentColor}40`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.6rem'
            }}
          >
            {saving ? <RefreshCw className="spin" size={18} /> : <CheckCircle2 size={18} />} Save All Company Settings
          </button>
        </div>
      </form>
    </div>
  );
}
