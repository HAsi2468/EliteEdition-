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
  UserPlus
} from 'lucide-react';
import { api } from '../services/api';

const STAGES = [
  { id: 'All', label: 'All Leads', color: 'var(--text-muted)' },
  { id: 'New', label: 'New Inquiry', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  { id: 'Contacted', label: 'Contacted', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
  { id: 'In Discussion', label: 'In Discussion', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  { id: 'Quotation Sent', label: 'Quotation Sent', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)' },
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

  // Stats calculation
  const totalLeadsCount = leads.length;
  const newLeadsCount = leads.filter((l) => l.stage === 'New').length;
  const activeDiscussionCount = leads.filter((l) => l.stage === 'In Discussion' || l.stage === 'Quotation Sent').length;
  const confirmedCount = leads.filter((l) => l.stage === 'Order Confirmed').length;
  const totalPipelineVal = leads.reduce((sum, l) => sum + (Number(l.estimatedValue) || 0), 0);

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
          background: 'linear-gradient(135deg, rgba(236,72,153,0.1) 0%, rgba(244,63,94,0.05) 100%)',
          border: '1px solid rgba(236,72,153,0.2)',
          marginBottom: '1.5rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 8px 16px rgba(236, 72, 153, 0.3)'
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
            background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
            color: '#fff',
            border: 'none',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(236, 72, 153, 0.35)',
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
          <div style={{ fontSize: '0.8rem', color: '#ec4899', fontWeight: 600, textTransform: 'uppercase' }}>Total Pipeline Value</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '4px', color: '#ec4899' }}>
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
                background: 'var(--primary-color, #ec4899)',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Search
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                  border: isActive ? `1.5px solid ${s.color || '#ec4899'}` : '1px solid var(--border-light)',
                  background: isActive ? (s.bg || 'rgba(236,72,153,0.15)') : 'transparent',
                  color: isActive ? (s.color || '#ec4899') : 'var(--text-muted)',
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
          ) : leads.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Users size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>No Leads Found</div>
              <p style={{ margin: '0 auto', fontSize: '0.88rem', maxWidth: '350px' }}>
                No customer inquiries match your selected stage or search filters. Click <strong>+ Add New Lead</strong> to create one.
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
                  {leads.map((lead) => {
                    const isSelected = selectedLead?._id === lead._id;
                    const stageObj = STAGES.find((s) => s.id === lead.stage) || STAGES[1];

                    return (
                      <tr
                        key={lead._id}
                        onClick={() => setSelectedLead(lead)}
                        style={{
                          borderBottom: '1px solid var(--border-light)',
                          background: isSelected ? 'rgba(236,72,153,0.08)' : 'transparent',
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
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: lead.estimatedValue ? '#ec4899' : 'var(--text-muted)' }}>
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
                <strong style={{ color: '#ec4899' }}>
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
                    Phone / WhatsApp *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9876543210"
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
                    Company / Brand Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Prints & Apparel"
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
                    {SOURCES.map((src) => (
                      <option key={src} value={src}>{src}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                    Stage
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
                      <option key={s.id} value={s.id}>{s.label}</option>
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
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                    Est. Value (₹)
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
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                  Follow-up Date
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

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                  Customer Requirement / Product Interest
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Wants 500 Meters Digital Printing on French Crepe fabric by Friday..."
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
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-muted)' }}>
                  Internal Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Quoted ₹120/meter. Customer checking sample."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '9px 18px',
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
                    padding: '9px 22px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
                    color: '#fff',
                    border: 'none',
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
