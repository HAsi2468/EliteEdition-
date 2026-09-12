import React, { useState, useEffect } from 'react';
import {
  Bot, UserCheck, Briefcase, Users, HardHat, Plus, Search, MessageSquare,
  Phone, Mail, MapPin, Sparkles, TrendingUp, CheckCircle2, Trash2, Edit3,
  Copy, FileText, Send, RefreshCw, X, AlertCircle, Building2, CreditCard
} from 'lucide-react';
import api from '../services/api';

const RECORD_TYPES = [
  { key: 'ALL', label: 'All Connections', icon: Users, color: '#38bdf8' },
  { key: 'LEAD', label: 'Sales Leads', icon: TrendingUp, color: '#f59e0b' },
  { key: 'VENDOR', label: 'Vendors & Suppliers', icon: Building2, color: '#10b981' },
  { key: 'EMPLOYEE', label: 'Salaried Employees', icon: Briefcase, color: '#a855f7' },
  { key: 'WORKER', label: 'Factory Workers', icon: HardHat, color: '#ec4899' }
];

export default function BusinessConnectionPanel({ currentUser }) {
  const [connections, setConnections] = useState([]);
  const [counts, setCounts] = useState({ total: 0, lead: 0, vendor: 0, employee: 0, worker: 0 });
  const [loading, setLoading] = useState(false);
  const [activeType, setActiveType] = useState('ALL');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Master AI Processing State
  const [rawText, setRawText] = useState('');
  const [aiParsing, setAiParsing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [showAiModal, setShowAiModal] = useState(false);

  // Manual Add / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    record_type: 'LEAD',
    common_directory: {
      name: '', primary_phone: '', whatsapp_phone: '', email: '', city: '', state: '', address: '', is_active: true
    },
    lead_data: {
      business_name: '', product_or_sku_interest: '', quantity: '', budget: '', source: 'Direct',
      lead_score: 50, priority: 'WARM', pipeline_stage: 'New Lead', suggested_next_action: '', sla_followup_hours: 1, instant_reply_text: ''
    },
    vendor_data: {
      company_name: '', gst_or_tax_id: '', bank_account: '', bank_ifsc: '', upi_id: '', payment_terms: 'Advance', supplied_items: ''
    },
    employee_data: {
      department: 'Production', designation: '', monthly_salary: '', joining_date: '', emergency_contact: ''
    },
    worker_data: {
      station_or_skill: '', wage_model: 'DAILY_WAGE', rate_amount: '', payout_schedule: 'WEEKLY'
    }
  });

  // Note Modal State
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [activeConnectionForNote, setActiveConnectionForNote] = useState(null);
  const [noteText, setNoteText] = useState('');

  const fetchConnections = async () => {
    setLoading(true);
    try {
      const res = await api.getBusinessConnections({
        record_type: activeType,
        search: search,
        priority: priorityFilter
      });
      setConnections(res.connections || []);
      if (res.counts) setCounts(res.counts);
    } catch (err) {
      console.error('Error fetching connections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, [activeType, priorityFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchConnections();
  };

  // Run Master AI Ingestion
  const handleRunMasterAI = async () => {
    if (!rawText.trim()) {
      alert('Please enter or paste unstructured text to process with Master AI Agent.');
      return;
    }
    setAiParsing(true);
    try {
      const parsed = await api.parseBusinessConnectionAI(rawText);
      setAiResult(parsed);
      setFormData(parsed);
      setShowAiModal(true);
    } catch (err) {
      console.error('AI Parsing Error:', err);
      alert('Failed to parse text with Master AI. Please check server logs.');
    } finally {
      setAiParsing(false);
    }
  };

  // Save Connection (From AI Modal or Manual Form)
  const handleSaveConnection = async () => {
    if (!formData.common_directory?.name) {
      alert('Name is required in common directory.');
      return;
    }
    try {
      if (editingId) {
        await api.updateBusinessConnection(editingId, formData);
        alert('Connection updated successfully!');
      } else {
        await api.createBusinessConnection(formData);
        alert('Business Connection saved/upserted successfully!');
      }
      setShowModal(false);
      setShowAiModal(false);
      setRawText('');
      setAiResult(null);
      setEditingId(null);
      fetchConnections();
    } catch (err) {
      console.error('Save connection error:', err);
      alert('Failed to save connection: ' + (err.message || 'Server error'));
    }
  };

  // Delete Connection
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this connection?')) return;
    try {
      await api.deleteBusinessConnection(id);
      fetchConnections();
    } catch (err) {
      alert('Failed to delete connection.');
    }
  };

  // Add Note
  const handleAddNote = async () => {
    if (!noteText.trim() || !activeConnectionForNote) return;
    try {
      await api.addBusinessConnectionNote(activeConnectionForNote._id, {
        text: noteText,
        createdBy: currentUser?.name || 'Staff'
      });
      setNoteText('');
      setShowNoteModal(false);
      fetchConnections();
    } catch (err) {
      alert('Failed to add note.');
    }
  };

  // Open Edit Form
  const handleOpenEdit = (item) => {
    setEditingId(item._id);
    setFormData({
      record_type: item.record_type,
      companyEntity: item.companyEntity || 'Elite Digital Print',
      common_directory: item.common_directory || {},
      lead_data: item.lead_data || {},
      vendor_data: item.vendor_data || {},
      employee_data: item.employee_data || {},
      worker_data: item.worker_data || {}
    });
    setShowModal(true);
  };

  return (
    <div style={{ padding: '1.2rem', color: 'var(--text-primary)', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header & Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Bot size={28} color="#38bdf8" /> Business Connections &amp; Master AI Agent
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Centralized ERP/CRM Directory for Sales Leads, Vendors, Salaried Employees &amp; Factory Workers.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({
                record_type: 'LEAD',
                common_directory: { name: '', primary_phone: '', whatsapp_phone: '', email: '', city: '', state: '', address: '', is_active: true },
                lead_data: { business_name: '', product_or_sku_interest: '', quantity: '', budget: '', source: 'Direct', lead_score: 50, priority: 'WARM', pipeline_stage: 'New Lead', suggested_next_action: '', sla_followup_hours: 1, instant_reply_text: '' },
                vendor_data: { company_name: '', gst_or_tax_id: '', bank_account: '', bank_ifsc: '', upi_id: '', payment_terms: 'Advance', supplied_items: '' },
                employee_data: { department: 'Production', designation: '', monthly_salary: '', joining_date: '', emergency_contact: '' },
                worker_data: { station_or_skill: '', wage_model: 'DAILY_WAGE', rate_amount: '', payout_schedule: 'WEEKLY' }
              });
              setShowModal(true);
            }}
            style={{
              padding: '0.55rem 1.1rem', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.4)',
              background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)', color: '#fff',
              fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: '0 4px 14px rgba(37,99,235,0.3)'
            }}
          >
            <Plus size={16} /> New Connection
          </button>
        </div>
      </div>

      {/* Category Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {RECORD_TYPES.map(cat => {
          const Icon = cat.icon;
          const isSelected = activeType === cat.key;
          let count = counts.total;
          if (cat.key === 'LEAD') count = counts.lead;
          if (cat.key === 'VENDOR') count = counts.vendor;
          if (cat.key === 'EMPLOYEE') count = counts.employee;
          if (cat.key === 'WORKER') count = counts.worker;

          return (
            <div
              key={cat.key}
              onClick={() => setActiveType(cat.key)}
              style={{
                background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'var(--bg-card, rgba(15, 23, 42, 0.6))',
                border: isSelected ? `2px solid ${cat.color}` : '1px solid var(--border-light, rgba(255,255,255,0.08))',
                borderRadius: '12px', padding: '1rem', cursor: 'pointer', transition: 'all 0.2s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>{cat.label}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: isSelected ? cat.color : 'var(--text-primary)', marginTop: '2px' }}>
                  {count}
                </div>
              </div>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: `${cat.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={22} color={cat.color} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Master AI Agent Processing Box */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '14px', padding: '1.2rem', marginBottom: '1.5rem',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="#f59e0b" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
              Master AI Agent Processing Engine
            </h3>
            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: 700 }}>
              Gemini 1.5 Powered
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Auto-classifies into LEAD, VENDOR, EMPLOYEE, or WORKER</span>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
          <textarea
            rows={3}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste any unstructured message, Meta Ad inquiry, WhatsApp text, Vendor GST detail, or Worker daily wage note here... (e.g. 'Hi, Rahul Traders here from Surat +919898123456. Need 1000m Satin digital print @ Rs 45/m')"
            style={{
              width: '100%', padding: '0.75rem', borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#f8fafc', fontSize: '0.88rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            {rawText && (
              <button
                type="button"
                onClick={() => setRawText('')}
                style={{ padding: '0.45rem 0.9rem', borderRadius: '6px', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Clear
              </button>
            )}
            <button
              type="button"
              disabled={aiParsing}
              onClick={handleRunMasterAI}
              style={{
                padding: '0.55rem 1.4rem', borderRadius: '8px', border: 'none',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff',
                fontSize: '0.85rem', fontWeight: 800, cursor: aiParsing ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(245,158,11,0.3)',
                opacity: aiParsing ? 0.7 : 1
              }}
            >
              {aiParsing ? <RefreshCw size={16} className="spin" /> : <Bot size={16} />}
              {aiParsing ? 'Master AI Processing...' : 'Ingest with Master AI'}
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '1rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', flex: 1, maxWidth: '450px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by Name, Phone, City, GST, Skill, Department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '0.5rem 0.6rem 0.5rem 2.2rem', borderRadius: '8px',
                border: '1px solid var(--border-light, rgba(255,255,255,0.12))',
                background: 'var(--bg-input, rgba(15,23,42,0.6))', color: 'var(--text-primary)', fontSize: '0.85rem'
              }}
            />
          </div>
          <button type="submit" style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
            Filter
          </button>
        </form>

        {activeType === 'LEAD' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Priority:</span>
            {['ALL', 'HOT', 'WARM', 'COLD'].map(p => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                style={{
                  padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                  border: priorityFilter === p ? '1.5px solid #38bdf8' : '1px solid var(--border-light)',
                  background: priorityFilter === p ? 'rgba(56,189,248,0.15)' : 'transparent',
                  color: priorityFilter === p ? '#38bdf8' : 'var(--text-muted)'
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Directory Data List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
          <div>Loading Directory Records...</div>
        </div>
      ) : connections.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--bg-card, rgba(15,23,42,0.4))', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
          <Users size={36} color="var(--text-muted)" style={{ marginBottom: '8px' }} />
          <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>No connections found</h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>Try running the Master AI Agent above or adding a new record manually.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
          {connections.map(item => {
            const dir = item.common_directory || {};
            const recordType = item.record_type;

            return (
              <div
                key={item._id}
                style={{
                  background: 'var(--bg-card, rgba(15, 23, 42, 0.7))',
                  border: '1px solid var(--border-light, rgba(255,255,255,0.08))',
                  borderRadius: '12px', padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem',
                  position: 'relative', backdropFilter: 'blur(10px)', transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.04em',
                      background: recordType === 'LEAD' ? 'rgba(245,158,11,0.15)' : recordType === 'VENDOR' ? 'rgba(16,185,129,0.15)' : recordType === 'EMPLOYEE' ? 'rgba(168,85,247,0.15)' : 'rgba(236,72,153,0.15)',
                      color: recordType === 'LEAD' ? '#f59e0b' : recordType === 'VENDOR' ? '#10b981' : recordType === 'EMPLOYEE' ? '#a855f7' : '#ec4899',
                      border: `1px solid ${recordType === 'LEAD' ? '#f59e0b40' : recordType === 'VENDOR' ? '#10b98140' : recordType === 'EMPLOYEE' ? '#a855f740' : '#ec489940'}`,
                      marginBottom: '4px'
                    }}>
                      {recordType}
                    </span>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {dir.name || 'Unnamed Record'}
                    </h4>
                    {item.lead_data?.business_name && (
                      <div style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 600, marginTop: '2px' }}>
                        🏢 {item.lead_data.business_name}
                      </div>
                    )}
                    {item.vendor_data?.company_name && (
                      <div style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600, marginTop: '2px' }}>
                        🏭 {item.vendor_data.company_name}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => handleOpenEdit(item)} title="Edit Connection" style={{ padding: '4px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                      <Edit3 size={15} />
                    </button>
                    <button onClick={() => handleDelete(item._id)} title="Delete" style={{ padding: '4px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Common Directory Info */}
                <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--text-muted)' }}>
                  {dir.primary_phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={14} color="#38bdf8" />
                      <span>{dir.primary_phone}</span>
                      {dir.whatsapp_phone && (
                        <a
                          href={`https://wa.me/${dir.whatsapp_phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ marginLeft: '4px', color: '#25d366', fontWeight: 700, fontSize: '0.75rem', textDecoration: 'none' }}
                        >
                          💬 WhatsApp
                        </a>
                      )}
                    </div>
                  )}
                  {dir.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={14} color="#a855f7" />
                      <span>{dir.email}</span>
                    </div>
                  )}
                  {(dir.city || dir.state) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={14} color="#f59e0b" />
                      <span>{[dir.city, dir.state].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* Specific Category Data Block */}
                {recordType === 'LEAD' && item.lead_data && (
                  <div style={{ background: 'rgba(245,158,11,0.06)', borderRadius: '8px', padding: '0.65rem 0.75rem', border: '1px solid rgba(245,158,11,0.2)', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, color: '#f59e0b' }}>
                        Interest: {item.lead_data.product_or_sku_interest || 'N/A'}
                      </span>
                      <span style={{
                        fontWeight: 800, padding: '1px 6px', borderRadius: '4px',
                        background: item.lead_data.priority === 'HOT' ? '#ef444420' : item.lead_data.priority === 'WARM' ? '#f59e0b20' : '#3b82f620',
                        color: item.lead_data.priority === 'HOT' ? '#ef4444' : item.lead_data.priority === 'WARM' ? '#f59e0b' : '#3b82f6'
                      }}>
                        {item.lead_data.priority} (Score: {item.lead_data.lead_score || 50})
                      </span>
                    </div>
                    {item.lead_data.quantity && <div><strong>Quantity:</strong> {item.lead_data.quantity} mtr</div>}
                    {item.lead_data.suggested_next_action && <div style={{ marginTop: '4px', color: '#f8fafc' }}><strong>Next Task:</strong> {item.lead_data.suggested_next_action}</div>}
                    {item.lead_data.instant_reply_text && (
                      <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Instant WhatsApp Reply:</div>
                        <div style={{ fontStyle: 'italic', color: '#cbd5e1', fontSize: '0.75rem', margin: '2px 0 4px' }}>"{item.lead_data.instant_reply_text}"</div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(item.lead_data.instant_reply_text);
                            alert('Instant reply copied to clipboard!');
                          }}
                          style={{ padding: '2px 8px', borderRadius: '4px', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#38bdf8', fontSize: '0.7rem', cursor: 'pointer' }}
                        >
                          <Copy size={11} style={{ marginRight: '4px' }} /> Copy Instant Reply
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {recordType === 'VENDOR' && item.vendor_data && (
                  <div style={{ background: 'rgba(16,185,129,0.06)', borderRadius: '8px', padding: '0.65rem 0.75rem', border: '1px solid rgba(16,185,129,0.2)', fontSize: '0.78rem' }}>
                    <div style={{ fontWeight: 700, color: '#10b981', marginBottom: '2px' }}>Items: {item.vendor_data.supplied_items || 'General Supplies'}</div>
                    {item.vendor_data.gst_or_tax_id && <div><strong>GST:</strong> {item.vendor_data.gst_or_tax_id}</div>}
                    {item.vendor_data.payment_terms && <div><strong>Payment Terms:</strong> {item.vendor_data.payment_terms}</div>}
                    {(item.vendor_data.bank_account || item.vendor_data.upi_id) && (
                      <div style={{ marginTop: '4px', fontSize: '0.72rem', color: '#94a3b8' }}>
                        Bank A/C: {item.vendor_data.bank_account || 'N/A'} ({item.vendor_data.bank_ifsc || 'No IFSC'}) | UPI: {item.vendor_data.upi_id || 'N/A'}
                      </div>
                    )}
                  </div>
                )}

                {recordType === 'EMPLOYEE' && item.employee_data && (
                  <div style={{ background: 'rgba(168,85,247,0.06)', borderRadius: '8px', padding: '0.65rem 0.75rem', border: '1px solid rgba(168,85,247,0.2)', fontSize: '0.78rem' }}>
                    <div style={{ fontWeight: 700, color: '#a855f7', marginBottom: '2px' }}>
                      {item.employee_data.department} — {item.employee_data.designation || 'Staff'}
                    </div>
                    {item.employee_data.monthly_salary && <div><strong>Monthly Salary:</strong> ₹{item.employee_data.monthly_salary.toLocaleString('en-IN')}</div>}
                    {item.employee_data.joining_date && <div><strong>Joined:</strong> {item.employee_data.joining_date}</div>}
                  </div>
                )}

                {recordType === 'WORKER' && item.worker_data && (
                  <div style={{ background: 'rgba(236,72,153,0.06)', borderRadius: '8px', padding: '0.65rem 0.75rem', border: '1px solid rgba(236,72,153,0.2)', fontSize: '0.78rem' }}>
                    <div style={{ fontWeight: 700, color: '#ec4899', marginBottom: '2px' }}>
                      Station: {item.worker_data.station_or_skill || 'General Operator'}
                    </div>
                    <div><strong>Wage Model:</strong> {item.worker_data.wage_model} ({item.worker_data.payout_schedule} Payout)</div>
                    {item.worker_data.rate_amount && <div><strong>Rate / Wage:</strong> ₹{item.worker_data.rate_amount}</div>}
                  </div>
                )}

                {/* Footer Notes Action */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid var(--border-light, rgba(255,255,255,0.06))' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Notes: {item.notes?.length || 0}
                  </span>
                  <button
                    onClick={() => {
                      setActiveConnectionForNote(item);
                      setShowNoteModal(true);
                    }}
                    style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-light)', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.72rem', cursor: 'pointer' }}
                  >
                    + Add Note
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual / Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '650px', background: '#0f172a', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '14px', padding: '1.25rem', color: '#f8fafc', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.6rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8' }}>
                {editingId ? 'Edit Business Connection' : 'Create New Business Connection'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {/* Record Type Switcher */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Classification Category:</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['LEAD', 'VENDOR', 'EMPLOYEE', 'WORKER'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormData(f => ({ ...f, record_type: t }))}
                    style={{
                      flex: 1, padding: '0.5rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer',
                      border: formData.record_type === t ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                      background: formData.record_type === t ? 'rgba(56,189,248,0.15)' : 'rgba(15,23,42,0.6)',
                      color: formData.record_type === t ? '#38bdf8' : '#94a3b8'
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Common Directory Fields */}
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b', marginBottom: '6px' }}>📍 Common Directory Contact Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Full Name *</label>
                <input
                  type="text"
                  value={formData.common_directory?.name || ''}
                  onChange={e => setFormData(f => ({ ...f, common_directory: { ...f.common_directory, name: e.target.value } }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Primary Phone</label>
                <input
                  type="text"
                  value={formData.common_directory?.primary_phone || ''}
                  onChange={e => setFormData(f => ({ ...f, common_directory: { ...f.common_directory, primary_phone: e.target.value } }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>WhatsApp Phone</label>
                <input
                  type="text"
                  value={formData.common_directory?.whatsapp_phone || ''}
                  onChange={e => setFormData(f => ({ ...f, common_directory: { ...f.common_directory, whatsapp_phone: e.target.value } }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Email Address</label>
                <input
                  type="text"
                  value={formData.common_directory?.email || ''}
                  onChange={e => setFormData(f => ({ ...f, common_directory: { ...f.common_directory, email: e.target.value } }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>City</label>
                <input
                  type="text"
                  value={formData.common_directory?.city || ''}
                  onChange={e => setFormData(f => ({ ...f, common_directory: { ...f.common_directory, city: e.target.value } }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>State</label>
                <input
                  type="text"
                  value={formData.common_directory?.state || ''}
                  onChange={e => setFormData(f => ({ ...f, common_directory: { ...f.common_directory, state: e.target.value } }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* Category Specific Form Section */}
            {formData.record_type === 'LEAD' && (
              <>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b', marginBottom: '6px' }}>🎯 Sales Lead Intelligence Data</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Business / Firm Name</label>
                    <input type="text" value={formData.lead_data?.business_name || ''} onChange={e => setFormData(f => ({ ...f, lead_data: { ...f.lead_data, business_name: e.target.value } }))} style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Product / Fabric Interest</label>
                    <input type="text" value={formData.lead_data?.product_or_sku_interest || ''} onChange={e => setFormData(f => ({ ...f, lead_data: { ...f.lead_data, product_or_sku_interest: e.target.value } }))} style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Quantity (Meters)</label>
                    <input type="number" value={formData.lead_data?.quantity || ''} onChange={e => setFormData(f => ({ ...f, lead_data: { ...f.lead_data, quantity: Number(e.target.value) } }))} style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Priority</label>
                    <select value={formData.lead_data?.priority || 'WARM'} onChange={e => setFormData(f => ({ ...f, lead_data: { ...f.lead_data, priority: e.target.value } }))} style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem' }}>
                      <option value="HOT">HOT</option>
                      <option value="WARM">WARM</option>
                      <option value="COLD">COLD</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {formData.record_type === 'VENDOR' && (
              <>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981', marginBottom: '6px' }}>🏭 Vendor &amp; Payment Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Company Name</label>
                    <input type="text" value={formData.vendor_data?.company_name || ''} onChange={e => setFormData(f => ({ ...f, vendor_data: { ...f.vendor_data, company_name: e.target.value } }))} style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>GST Number</label>
                    <input type="text" value={formData.vendor_data?.gst_or_tax_id || ''} onChange={e => setFormData(f => ({ ...f, vendor_data: { ...f.vendor_data, gst_or_tax_id: e.target.value } }))} style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Bank Account No</label>
                    <input type="text" value={formData.vendor_data?.bank_account || ''} onChange={e => setFormData(f => ({ ...f, vendor_data: { ...f.vendor_data, bank_account: e.target.value } }))} style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>IFSC Code</label>
                    <input type="text" value={formData.vendor_data?.bank_ifsc || ''} onChange={e => setFormData(f => ({ ...f, vendor_data: { ...f.vendor_data, bank_ifsc: e.target.value } }))} style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem' }} />
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button type="button" onClick={() => setShowModal(false)} style={{ padding: '0.5rem 1.2rem', borderRadius: '6px', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleSaveConnection} style={{ padding: '0.5rem 1.4rem', borderRadius: '6px', border: 'none', background: '#38bdf8', color: '#0f172a', fontWeight: 800, cursor: 'pointer' }}>Save Record</button>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {showNoteModal && activeConnectionForNote && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '480px', background: '#0f172a', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '14px', padding: '1.25rem', color: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
                Add Note — {activeConnectionForNote.common_directory?.name}
              </h3>
              <button onClick={() => setShowNoteModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <textarea
              rows={4}
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Type internal note, followup comment, or payment detail..."
              style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.8rem' }}>
              <button onClick={() => setShowNoteModal(false)} style={{ padding: '0.45rem 1rem', borderRadius: '6px', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleAddNote} style={{ padding: '0.45rem 1.2rem', borderRadius: '6px', border: 'none', background: '#38bdf8', color: '#0f172a', fontWeight: 800, cursor: 'pointer' }}>Save Note</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
