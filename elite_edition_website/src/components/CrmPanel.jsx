import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  MessageSquare,
  Building,
  Calendar,
  IndianRupee,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  Filter,
  X,
  AlertCircle,
  Tag,
  ChevronRight,
  ExternalLink,
  UserPlus,
  Printer
} from 'lucide-react';
import { api } from '../services/api';
import DateRangePicker, { getDatePresetRange } from './DateRangePicker';

const STAGES = [
  { id: 'All', label: 'All Leads', color: 'var(--text-muted)' },
  { id: 'New', label: 'New Inquiry', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  { id: 'Contacted', label: 'Contacted', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
  { id: 'In Discussion', label: 'In Discussion', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  { id: 'Quotation Sent', label: 'Quotation Sent', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.12)' },
  { id: 'Order Confirmed', label: 'Order Confirmed', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
  { id: 'Lost', label: 'Closed / Lost', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' }
];

const SOURCES = ['WhatsApp', 'Phone Call', 'Reference', 'Instagram', 'Direct Visit', 'Other'];
const PRIORITIES = ['High', 'Medium', 'Low'];

export default function CrmPanel({ currentUser }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  // Date Range Filter State
  const [datePreset, setDatePreset] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    companyName: '',
    email: '',
    source: 'WhatsApp',
    stage: 'New',
    priority: 'Medium',
    estimatedValue: '',
    requirement: '',
    notes: '',
    followUpDate: '',
    assignedTo: currentUser?.name || 'Unassigned'
  });

  const [saving, setSaving] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  useEffect(() => {
    fetchLeads();
  }, [stageFilter, priorityFilter]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = {};
      if (stageFilter !== 'All') params.stage = stageFilter;
      if (priorityFilter !== 'All') params.priority = priorityFilter;
      if (search.trim()) params.search = search.trim();

      const res = await api.getLeads(params);
      if (res && res.success) {
        setLeads(res.data || []);
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLeads();
  };

  // Filter leads by date range
  const dateRangeInfo = getDatePresetRange(datePreset, customStart, customEnd);
  const filteredLeads = leads.filter((lead) => {
    if (!dateRangeInfo.dateStart && !dateRangeInfo.dateEnd) return true;
    const leadDate = lead.createdAt ? new Date(lead.createdAt) : lead.followUpDate ? new Date(lead.followUpDate) : null;
    if (!leadDate || isNaN(leadDate.getTime())) return true;
    const leadYMD = leadDate.toISOString().split('T')[0];
    if (dateRangeInfo.dateStart && leadYMD < dateRangeInfo.dateStart) return false;
    if (dateRangeInfo.dateEnd && leadYMD > dateRangeInfo.dateEnd) return false;
    return true;
  });

  // Export PDF Report
  const handleExportPDF = () => {
    const listToExport = filteredLeads;
    if (!listToExport || listToExport.length === 0) {
      alert('No leads to export.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to export PDF.');
      return;
    }

    const reportTitle = `CRM & Customer Lead Pipeline Report (${stageFilter})`;
    const generatedTime = new Date().toLocaleString('en-IN');
    const dateFilterLabel = dateRangeInfo.labelText || 'All Time Records';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${reportTitle}</title>
        <style>
          body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 25px; color: #0f172a; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
          .company { font-size: 22px; font-weight: 800; color: #2563eb; letter-spacing: -0.5px; }
          .subtitle { font-size: 14px; font-weight: 600; color: #475569; margin-top: 4px; }
          .meta { font-size: 11px; color: #64748b; text-align: right; }
          .summary-cards { display: flex; gap: 15px; margin-bottom: 20px; }
          .kpi { flex: 1; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
          .kpi-label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; }
          .kpi-value { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px; }
          .blue { color: #2563eb; } .green { color: #16a34a; } .amber { color: #d97706; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th { background: #eff6ff; color: #1e40af; text-align: left; padding: 10px 12px; font-weight: 700; border-bottom: 1.5px solid #bfdbfe; }
          td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; color: #334155; vertical-align: top; }
          tr:nth-child(even) { background: #f8fafc; }
          .stage-badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-weight: 700; font-size: 10px; }
          .footer { margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          @media print {
            body { margin: 15px; }
            @page { size: A4 landscape; margin: 10mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="company">Elite Digital Prints</div>
            <div class="subtitle">${reportTitle}</div>
          </div>
          <div class="meta">
            <div>Generated: <strong>${generatedTime}</strong></div>
            <div>Date Filter: <strong>${dateFilterLabel}</strong></div>
          </div>
        </div>

        <div class="summary-cards">
          <div class="kpi">
            <div class="kpi-label">Filtered Inquiries</div>
            <div class="kpi-value">${listToExport.length}</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Active Discussions</div>
            <div class="kpi-value amber">${activeDiscussionCount}</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Confirmed Orders</div>
            <div class="kpi-value green">${confirmedCount}</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Pipeline Value</div>
            <div class="kpi-value blue">₹${totalPipelineVal.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>Customer / Company</th>
              <th>Phone & Source</th>
              <th>Requirement Details</th>
              <th>Est. Value (₹)</th>
              <th>Stage</th>
              <th>Priority</th>
              <th>Follow-Up Date</th>
            </tr>
          </thead>
          <tbody>
            ${listToExport
              .map((lead, idx) => {
                const valStr = lead.estimatedValue ? '₹' + Number(lead.estimatedValue).toLocaleString('en-IN') : '-';
                const followUpStr = lead.followUpDate ? new Date(lead.followUpDate).toLocaleDateString('en-IN') : '-';

                return `
                <tr>
                  <td>${idx + 1}</td>
                  <td style="font-weight: 700; color: #0f172a;">
                    ${lead.name || 'Unnamed Customer'}
                    ${lead.companyName ? '<br/><span style="font-size: 11px; color: #64748b; font-weight: normal;">🏢 ' + lead.companyName + '</span>' : ''}
                  </td>
                  <td>
                    ${lead.phone || '-'}
                    ${lead.source ? '<br/><span style="font-size: 10px; color: #64748b;">Via ' + lead.source + '</span>' : ''}
                  </td>
                  <td style="max-width: 250px;">${lead.requirement || '-'}</td>
                  <td style="font-weight: 700; color: #2563eb;">${valStr}</td>
                  <td><span class="stage-badge" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;">${lead.stage || 'New'}</span></td>
                  <td style="font-weight: 700; color: ${lead.priority === 'High' ? '#dc2626' : '#d97706'};">${lead.priority || 'Medium'}</td>
                  <td>${followUpStr}</td>
                </tr>
              `;
              })
              .join('')}
          </tbody>
        </table>

        <div class="footer">
          Elite Digital Prints — CRM & Customer Lead Pipeline Report &bull; Page 1 of 1
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const openAddModal = () => {
    setEditingLead(null);
    setFormData({
      name: '',
      phone: '',
      companyName: '',
      email: '',
      source: 'WhatsApp',
      stage: 'New',
      priority: 'Medium',
      estimatedValue: '',
      requirement: '',
      notes: '',
      followUpDate: '',
      assignedTo: currentUser?.name || 'Unassigned'
    });
    setShowModal(true);
  };

  const openEditModal = (lead) => {
    setEditingLead(lead);
    setFormData({
      name: lead.name || '',
      phone: lead.phone || '',
      companyName: lead.companyName || '',
      email: lead.email || '',
      source: lead.source || 'WhatsApp',
      stage: lead.stage || 'New',
      priority: lead.priority || 'Medium',
      estimatedValue: lead.estimatedValue || '',
      requirement: lead.requirement || '',
      notes: lead.notes || '',
      followUpDate: lead.followUpDate ? new Date(lead.followUpDate).toISOString().split('T')[0] : '',
      assignedTo: lead.assignedTo || currentUser?.name || 'Unassigned'
    });
    setShowModal(true);
  };

  const handleSaveLead = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      alert('Please fill in Customer Name and Phone Number');
      return;
    }

    setSaving(true);
    try {
      if (editingLead) {
        await api.updateLead(editingLead._id, formData);
      } else {
        await api.createLead(formData);
      }
      setShowModal(false);
      fetchLeads();
    } catch (err) {
      alert('Error saving lead: ' + (err.message || 'Server error'));
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStageChange = async (leadId, newStage) => {
    try {
      await api.updateLead(leadId, { stage: newStage });
      setLeads((prev) =>
        prev.map((l) => (l._id === leadId ? { ...l, stage: newStage } : l))
      );
      if (selectedLead && selectedLead._id === leadId) {
        setSelectedLead((prev) => ({ ...prev, stage: newStage }));
      }
    } catch (err) {
      alert('Failed to update stage');
    }
  };

  const handleDeleteLead = async (leadId) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;
    try {
      await api.deleteLead(leadId);
      setLeads((prev) => prev.filter((l) => l._id !== leadId));
      if (selectedLead?._id === leadId) setSelectedLead(null);
    } catch (err) {
      alert('Error deleting lead');
    }
  };

  const openWhatsApp = (phone, name = '') => {
    if (!phone) return;
    const cleanNum = phone.replace(/[^0-9]/g, '');
    const formatted = cleanNum.length === 10 ? `91${cleanNum}` : cleanNum;
    const msg = encodeURIComponent(`Hello ${name || 'Sir/Madam'}, thank you for contacting Elite Digital Print. How can we assist you today?`);
    window.open(`https://wa.me/${formatted}?text=${msg}`, '_blank');
  };

  // Stats calculation over filteredLeads
  const totalLeadsCount = filteredLeads.length;
  const newLeadsCount = filteredLeads.filter((l) => l.stage === 'New').length;
  const activeDiscussionCount = filteredLeads.filter((l) => l.stage === 'In Discussion' || l.stage === 'Quotation Sent').length;
  const confirmedCount = filteredLeads.filter((l) => l.stage === 'Order Confirmed').length;
  const totalPipelineVal = filteredLeads.reduce((sum, l) => sum + (Number(l.estimatedValue) || 0), 0);

  return (
    <div className="crm-container" style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto', color: 'var(--text-main)' }}>
      {/* Top Banner Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '1.5rem 1.8rem',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(59,130,246,0.06) 100%)',
          border: '1px solid rgba(37,99,235,0.25)',
          marginBottom: '1.5rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 8px 16px rgba(37, 99, 235, 0.35)'
            }}
          >
            <Users size={28} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
              CRM & Lead Management
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Track customer inquiries, sales pipeline, follow-ups, and orders cleanly.
            </p>
          </div>
        </div>

        <button
          onClick={openAddModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
            color: '#fff',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
            transition: 'all 0.2s ease'
          }}
        >
          <UserPlus size={18} />
          Add New Lead
        </button>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '14px', border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Inquiries</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '4px', color: 'var(--text-main)' }}>{totalLeadsCount}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '14px', border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '0.8rem', color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase' }}>New Leads</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '4px', color: '#3b82f6' }}>{newLeadsCount}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '14px', border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600, textTransform: 'uppercase' }}>Active Discussions</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '4px', color: '#f59e0b' }}>{activeDiscussionCount}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '14px', border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600, textTransform: 'uppercase' }}>Orders Confirmed</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '4px', color: '#10b981' }}>{confirmedCount}</div>
        </div>
        <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '14px', border: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600, textTransform: 'uppercase' }}>Total Pipeline Value</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '4px', color: '#2563eb' }}>
            ₹{totalPipelineVal.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div
        className="glass-panel"
        style={{
          padding: '1.2rem',
          borderRadius: '14px',
          border: '1px solid var(--border-light)',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: '1', minWidth: '260px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search by customer name, phone, company, or requirement..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 38px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>
            <button
              type="submit"
              style={{
                padding: '9px 16px',
                borderRadius: '10px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Search
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            >
              <option value="All">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            <DateRangePicker
              preset={datePreset}
              onChange={({ preset, dateStart, dateEnd }) => {
                setDatePreset(preset);
                if (preset === 'custom') {
                  setCustomStart(dateStart);
                  setCustomEnd(dateEnd);
                }
              }}
              customStart={customStart}
              customEnd={customEnd}
              onCustomChange={(s, e) => {
                setCustomStart(s);
                setCustomEnd(e);
              }}
            />

            <button
              onClick={handleExportPDF}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                background: '#ffffff',
                color: '#0f172a',
                border: '1px solid var(--border-light)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(15,23,42,0.06)'
              }}
              title="Export PDF Report of Leads Pipeline"
            >
              <Printer size={15} color="#2563eb" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Stage Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {STAGES.map((s) => {
            const isActive = stageFilter === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setStageFilter(s.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  border: isActive ? `1.5px solid ${s.color || '#2563eb'}` : '1px solid var(--border-light)',
                  background: isActive ? (s.bg || 'rgba(37,99,235,0.15)') : 'transparent',
                  color: isActive ? (s.color || '#2563eb') : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Grid (List + Details Drawer) */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedLead ? '1fr 380px' : '1fr', gap: '1.5rem' }}>
        {/* Leads Table */}
        <div className="glass-panel" style={{ borderRadius: '16px', border: '1px solid var(--border-light)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Clock size={36} className="spinning" style={{ marginBottom: '12px' }} />
              <div>Loading leads...</div>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Users size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>No Leads Found</div>
              <p style={{ margin: '0 auto', fontSize: '0.88rem', maxWidth: '350px' }}>
                No customer inquiries match your selected stage, date range or search filters. Click <strong>+ Add New Lead</strong> to create one.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'rgba(0,0,0,0.03)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>CUSTOMER / COMPANY</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>CONTACT / WHATSAPP</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>REQUIREMENT</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>VALUE (₹)</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>STAGE / STATUS</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => {
                    const isSelected = selectedLead?._id === lead._id;
                    const stageObj = STAGES.find((s) => s.id === lead.stage) || STAGES[1];

                    return (
                      <tr
                        key={lead._id}
                        onClick={() => setSelectedLead(lead)}
                        style={{
                          borderBottom: '1px solid var(--border-light)',
                          background: isSelected ? 'rgba(37,99,235,0.1)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        {/* Customer */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{lead.name}</div>
                          {lead.companyName && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <Building size={12} />
                              {lead.companyName}
                            </div>
                          )}
                        </td>

                        {/* Contact */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 600 }}>{lead.phone}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openWhatsApp(lead.phone, lead.name);
                              }}
                              title="Chat on WhatsApp"
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                background: '#25D366',
                                color: '#fff',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700
                              }}
                            >
                              <MessageSquare size={12} />
                              WhatsApp
                            </button>
                          </div>
                          {lead.source && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Via {lead.source}
                            </div>
                          )}
                        </td>

                        {/* Requirement */}
                        <td style={{ padding: '12px 16px', maxWidth: '240px' }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-main)' }}>
                            {lead.requirement || 'No notes added'}
                          </div>
                          {lead.followUpDate && (
                            <div style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <Calendar size={12} />
                              Follow-up: {new Date(lead.followUpDate).toLocaleDateString('en-IN')}
                            </div>
                          )}
                        </td>

                        {/* Value */}
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: lead.estimatedValue ? '#2563eb' : 'var(--text-muted)' }}>
                          {lead.estimatedValue ? `₹${Number(lead.estimatedValue).toLocaleString('en-IN')}` : '-'}
                        </td>

                        {/* Stage Dropdown */}
                        <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>
                          <select
                            value={lead.stage || 'New'}
                            onChange={(e) => handleQuickStageChange(lead._id, e.target.value)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '20px',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              border: `1px solid ${stageObj.color}`,
                              background: stageObj.bg,
                              color: stageObj.color,
                              cursor: 'pointer',
                              outline: 'none'
                            }}
                          >
                            {STAGES.filter((s) => s.id !== 'All').map((s) => (
                              <option key={s.id} value={s.id} style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '12px 16px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              onClick={() => openEditModal(lead)}
                              title="Edit Lead"
                              style={{
                                padding: '6px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-light)',
                                background: 'transparent',
                                color: 'var(--text-muted)',
                                cursor: 'pointer'
                              }}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteLead(lead._id)}
                              title="Delete Lead"
                              style={{
                                padding: '6px',
                                borderRadius: '6px',
                                border: '1px solid rgba(239,68,68,0.3)',
                                background: 'rgba(239,68,68,0.1)',
                                color: '#ef4444',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Lead Details Drawer */}
        {selectedLead && (
          <div
            className="glass-panel"
            style={{
              padding: '1.5rem',
              borderRadius: '16px',
              border: '1px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.2rem',
              height: 'fit-content',
              position: 'sticky',
              top: '1rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Lead Details</h3>
              <button
                onClick={() => setSelectedLead(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{selectedLead.name}</div>
              {selectedLead.companyName && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <Building size={14} />
                  {selectedLead.companyName}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => openWhatsApp(selectedLead.phone, selectedLead.name)}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: '10px',
                  background: '#25D366',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <MessageSquare size={16} />
                WhatsApp
              </button>
              <a
                href={`tel:${selectedLead.phone}`}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#3b82f6',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  textDecoration: 'none'
                }}
              >
                <Phone size={16} />
                Call
              </a>
            </div>

            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Phone: </span>
                <strong>{selectedLead.phone}</strong>
              </div>
              {selectedLead.email && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Email: </span>
                  <strong>{selectedLead.email}</strong>
                </div>
              )}
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Source: </span>
                <strong>{selectedLead.source}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Priority: </span>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: selectedLead.priority === 'High' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: selectedLead.priority === 'High' ? '#ef4444' : '#f59e0b'
                  }}
                >
                  {selectedLead.priority}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Est. Value: </span>
                <strong style={{ color: '#2563eb' }}>
                  {selectedLead.estimatedValue ? `₹${Number(selectedLead.estimatedValue).toLocaleString('en-IN')}` : 'Not set'}
                </strong>
              </div>
            </div>

            {selectedLead.requirement && (
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, uppercase: 'true', marginBottom: '6px' }}>
                  Requirement / Details
                </div>
                <div style={{ padding: '10px', borderRadius: '8px', background: 'var(--bg-input)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                  {selectedLead.requirement}
                </div>
              </div>
            )}

            {selectedLead.notes && (
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, uppercase: 'true', marginBottom: '6px' }}>
                  Internal Notes
                </div>
                <div style={{ padding: '10px', borderRadius: '8px', background: 'var(--bg-input)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                  {selectedLead.notes}
                </div>
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem', display: 'flex', gap: '8px' }}>
              <button
                onClick={() => openEditModal(selectedLead)}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  background: 'transparent',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Edit Lead
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Lead Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '18px',
              padding: '1.8rem',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-card, #1e1e2d)',
              color: 'var(--text-main)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                {editingLead ? 'Edit Lead' : 'Add New Customer Lead'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveLead} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +91 98251 44321"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                    Company / Firm Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sharma Creations"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="rahul@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                    Lead Source
                  </label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem'
                    }}
                  >
                    {SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                    Pipeline Stage
                  </label>
                  <select
                    value={formData.stage}
                    onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem'
                    }}
                  >
                    {STAGES.filter((s) => s.id !== 'All').map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem'
                    }}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                    Estimated Order Value (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 50000"
                    value={formData.estimatedValue}
                    onChange={(e) => setFormData({ ...formData, estimatedValue: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                    Next Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={formData.followUpDate}
                    onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                  Fabric / Printing Requirement Details
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Needs 500 meters of Digital Organza print by next week..."
                  value={formData.requirement}
                  onChange={(e) => setFormData({ ...formData, requirement: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                  Internal Follow-up Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Sent digital swatch samples on WhatsApp..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {saving ? 'Saving...' : editingLead ? 'Update Lead' : 'Save Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
