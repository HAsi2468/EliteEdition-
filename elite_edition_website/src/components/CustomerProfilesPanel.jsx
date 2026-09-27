import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Building,
  Briefcase,
  Star,
  Clock,
  Calendar,
  MessageSquare,
  Edit2,
  Trash2,
  ExternalLink,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Tag,
  X,
  Printer,
  LayoutGrid,
  List,
  Sparkles,
  Send,
  UserCheck
} from 'lucide-react';

const CUSTOMER_TYPES = [
  'All',
  'Boutique / Designer',
  'Wholesaler / Trader',
  'Garment Manufacturer',
  'Retail Brand',
  'Fabric Merchant',
  'Exporter',
  'Individual / Other'
];

const STATUS_CONFIG = {
  'VIP Client': { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe', badge: '⭐ VIP' },
  'Active': { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', badge: '🟢 Active' },
  'Lead': { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', badge: '🔵 Lead' },
  'Inactive': { bg: '#f8fafc', color: '#64748b', border: '#cbd5e1', badge: '⚪ Inactive' }
};

export default function CustomerProfilesPanel({ currentUser, onSwitchToLeads, onAddNewLeadForCustomer }) {
  const [profiles, setProfiles] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, leads: 0, vip: 0, totalPipelineValue: 0, totalOrders: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [sortBy, setSortBy] = useState('createdAt'); // 'createdAt' | 'totalValue' | 'totalInquiries' | 'name'

  // Selected Profile for Detail Drawer
  const [selectedProfile, setSelectedProfile] = useState(null);

  // Add / Edit Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    companyName: '',
    email: '',
    address: '',
    city: '',
    state: 'Gujarat',
    gstin: '',
    customerType: 'Boutique / Designer',
    status: 'Lead',
    creditLimit: '',
    paymentTerms: 'Immediate / Advance',
    notes: '',
    tags: ''
  });

  // Interaction Log Form
  const [interactionType, setInteractionType] = useState('Call');
  const [interactionNote, setInteractionNote] = useState('');
  const [loggingInteraction, setLoggingInteraction] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, [statusFilter, typeFilter, sortBy]);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'All') params.status = statusFilter;
      if (typeFilter !== 'All') params.customerType = typeFilter;
      if (search.trim()) params.search = search.trim();
      params.sortBy = sortBy;

      const res = await api.getCustomerProfiles(params);
      if (res && res.success) {
        setProfiles(res.data || []);
        if (res.stats) setStats(res.stats);
      }
    } catch (err) {
      console.error('Error fetching customer profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchProfiles();
  };

  const handleSyncAllFromLeads = async () => {
    setSyncing(true);
    try {
      const res = await api.syncAllCustomerProfiles();
      if (res && res.success) {
        alert(res.message || 'Customer profiles synced with leads!');
        fetchProfiles();
      }
    } catch (err) {
      alert('Error syncing profiles: ' + (err.message || 'Server error'));
    } finally {
      setSyncing(false);
    }
  };

  const openCreateModal = () => {
    setEditingProfile(null);
    setFormData({
      name: '',
      phone: '',
      companyName: '',
      email: '',
      address: '',
      city: '',
      state: 'Gujarat',
      gstin: '',
      customerType: 'Boutique / Designer',
      status: 'Lead',
      creditLimit: '',
      paymentTerms: 'Immediate / Advance',
      notes: '',
      tags: ''
    });
    setShowEditModal(true);
  };

  const openEditModal = (profile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name || '',
      phone: profile.phone || '',
      companyName: profile.companyName || '',
      email: profile.email || '',
      address: profile.address || '',
      city: profile.city || '',
      state: profile.state || 'Gujarat',
      gstin: profile.gstin || '',
      customerType: profile.customerType || 'Boutique / Designer',
      status: profile.status || 'Lead',
      creditLimit: profile.creditLimit || '',
      paymentTerms: profile.paymentTerms || 'Immediate / Advance',
      notes: profile.notes || '',
      tags: Array.isArray(profile.tags) ? profile.tags.join(', ') : ''
    });
    setShowEditModal(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      alert('Customer Name and Phone number are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        tags: formData.tags
          ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : []
      };

      if (editingProfile) {
        const res = await api.updateCustomerProfile(editingProfile._id, payload);
        if (res && res.success) {
          setShowEditModal(false);
          fetchProfiles();
          if (selectedProfile && selectedProfile._id === editingProfile._id) {
            setSelectedProfile(res.data);
          }
        }
      } else {
        const res = await api.createCustomerProfile(payload);
        if (res && res.success) {
          setShowEditModal(false);
          fetchProfiles();
        }
      }
    } catch (err) {
      alert('Error saving profile: ' + (err.message || 'Server error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfile = async (profileId) => {
    if (!window.confirm('Are you sure you want to delete this customer profile? This will not delete past orders.')) {
      return;
    }
    try {
      await api.deleteCustomerProfile(profileId);
      setProfiles((prev) => prev.filter((p) => p._id !== profileId));
      if (selectedProfile && selectedProfile._id === profileId) {
        setSelectedProfile(null);
      }
    } catch (err) {
      alert('Error deleting profile: ' + err.message);
    }
  };

  const handleAddInteraction = async (e) => {
    e.preventDefault();
    if (!selectedProfile || !interactionNote.trim()) return;

    setLoggingInteraction(true);
    try {
      const res = await api.addCustomerProfileInteraction(selectedProfile._id, {
        type: interactionType,
        author: currentUser?.name || 'Admin',
        note: interactionNote.trim()
      });
      if (res && res.success) {
        setSelectedProfile(res.data);
        setInteractionNote('');
        fetchProfiles();
      }
    } catch (err) {
      alert('Failed to log interaction: ' + err.message);
    } finally {
      setLoggingInteraction(false);
    }
  };

  const openWhatsApp = (phone, name = '') => {
    if (!phone) return;
    const cleanNum = phone.replace(/[^0-9]/g, '');
    const formatted = cleanNum.length === 10 ? `91${cleanNum}` : cleanNum;
    const msg = encodeURIComponent(`Hello ${name || 'Sir/Madam'}, greetings from Elite Digital Print! How can we assist you with your fabric & printing requirements?`);
    window.open(`https://wa.me/${formatted}?text=${msg}`, '_blank');
  };

  const openCall = (phone) => {
    if (!phone) return;
    window.open(`tel:${phone}`);
  };

  // Export PDF Directory
  const handleExportPDF = () => {
    if (profiles.length === 0) {
      alert('No customer profiles to export.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to export directory PDF.');
      return;
    }

    const title = `Customer Directory Report - Elite Digital Print`;
    const now = new Date().toLocaleString('en-IN');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 25px; color: #0f172a; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 15px; }
          .title { font-size: 20px; font-weight: 800; color: #2563eb; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
          th { background: #eff6ff; color: #1e40af; text-align: left; padding: 8px 10px; border-bottom: 1.5px solid #bfdbfe; font-weight: 700; }
          td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #f8fafc; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">ELITE DIGITAL PRINT &amp; FABRICS</div>
            <div style="font-size: 12px; color: #64748b; font-weight: 600;">Customer Profiles &amp; Client Directory (${profiles.length} Profiles)</div>
          </div>
          <div style="font-size: 11px; color: #64748b; text-align: right;">Generated: ${now}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>CUSTOMER NAME</th>
              <th>COMPANY / BRAND</th>
              <th>CONTACT / PHONE</th>
              <th>EMAIL</th>
              <th>LOCATION</th>
              <th>TYPE</th>
              <th>INQUIRIES</th>
              <th>TOTAL VALUE</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            ${profiles
              .map(
                (p, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><strong>${p.name || '--'}</strong></td>
                <td>${p.companyName || '--'}</td>
                <td>${p.phone || '--'}</td>
                <td>${p.email || '--'}</td>
                <td>${p.city || ''}${p.state ? ', ' + p.state : ''}</td>
                <td>${p.customerType || '--'}</td>
                <td>${p.totalInquiries || 1}</td>
                <td>₹${(Number(p.totalValue) || 0).toLocaleString('en-IN')}</td>
                <td>${p.status || 'Lead'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── Top KPI Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '1.1rem',
            boxShadow: '0 2px 6px rgba(15,23,42,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Total Profiles
            </span>
            <span style={{ background: '#eff6ff', color: '#2563eb', padding: '4px', borderRadius: '8px' }}>
              <Users size={16} />
            </span>
          </div>
          <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{stats.total || profiles.length}</span>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Person &amp; Company Directory</span>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '1.1rem',
            boxShadow: '0 2px 6px rgba(15,23,42,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
              Active Clients
            </span>
            <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '4px', borderRadius: '8px' }}>
              <CheckCircle2 size={16} />
            </span>
          </div>
          <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16a34a' }}>{stats.active || 0}</span>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Regular placing orders</span>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '1.1rem',
            boxShadow: '0 2px 6px rgba(15,23,42,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>
              Leads in Pipeline
            </span>
            <span style={{ background: '#eff6ff', color: '#2563eb', padding: '4px', borderRadius: '8px' }}>
              <Clock size={16} />
            </span>
          </div>
          <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563eb' }}>{stats.leads || 0}</span>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>In discussion / quoted</span>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '1.1rem',
            boxShadow: '0 2px 6px rgba(15,23,42,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' }}>
              VIP / High Value
            </span>
            <span style={{ background: '#f5f3ff', color: '#7c3aed', padding: '4px', borderRadius: '8px' }}>
              <Star size={16} />
            </span>
          </div>
          <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#7c3aed' }}>{stats.vip || 0}</span>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>High volume clients</span>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '1.1rem',
            boxShadow: '0 2px 6px rgba(15,23,42,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
              Pipeline Value
            </span>
            <span style={{ background: '#f0f9ff', color: '#0284c7', padding: '4px', borderRadius: '8px' }}>
              <DollarSign size={16} />
            </span>
          </div>
          <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0284c7' }}>
            ₹{(stats.totalPipelineValue || 0).toLocaleString('en-IN')}
          </span>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Estimated cumulative value</span>
        </div>
      </div>

      {/* ── Toolbar: Search, Filters, View Modes & Action Buttons ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '1rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          boxShadow: '0 1px 3px rgba(15,23,42,0.04)'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: '1 1 320px', minWidth: '240px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search by customer name, phone, company, city, or requirements..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#0f172a',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Search
            </button>
          </form>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleSyncAllFromLeads}
              disabled={syncing}
              title="Scan and synchronize all new customer leads into profiles automatically"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} className={syncing ? 'spinning' : ''} />
              <span>{syncing ? 'Syncing...' : 'Sync from Leads'}</span>
            </button>

            <button
              onClick={handleExportPDF}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                background: '#f8fafc',
                color: '#334155',
                border: '1px solid #cbd5e1',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              <Printer size={14} color="#2563eb" />
              <span>Export PDF</span>
            </button>

            <button
              onClick={openCreateModal}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(37,99,235,0.25)'
              }}
            >
              <Plus size={16} />
              <span>Add New Profile</span>
            </button>
          </div>
        </div>

        {/* Filter Pills & Sorting */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.65rem' }}>
          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflowX: 'auto', paddingBottom: '2px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginRight: '4px' }}>Status:</span>
            {['All', 'Active', 'Lead', 'VIP Client', 'Inactive'].map((st) => {
              const isActive = statusFilter === st;
              return (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: isActive ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                    background: isActive ? '#eff6ff' : '#f8fafc',
                    color: isActive ? '#1d4ed8' : '#64748b',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {st}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Customer Type Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  outline: 'none'
                }}
              >
                {CUSTOMER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  outline: 'none'
                }}
              >
                <option value="createdAt">Most Recent</option>
                <option value="totalValue">Highest Value</option>
                <option value="totalInquiries">Most Inquiries</option>
                <option value="name">Alphabetical (A-Z)</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '2px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'cards' ? '#ffffff' : 'transparent',
                  color: viewMode === 'cards' ? '#2563eb' : '#64748b',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  boxShadow: viewMode === 'cards' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                <LayoutGrid size={13} />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'table' ? '#ffffff' : 'transparent',
                  color: viewMode === 'table' ? '#2563eb' : '#64748b',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                <List size={13} />
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Profiles Content (Cards or Table + Detail Drawer) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedProfile ? '1fr 380px' : '1fr', gap: '1.25rem', alignItems: 'start' }}>
        {/* Left Column: Profiles List */}
        <div>
          {loading ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <RefreshCw size={36} className="spinning" style={{ marginBottom: '12px', color: '#2563eb' }} />
              <div style={{ fontWeight: 700 }}>Loading customer profiles...</div>
            </div>
          ) : profiles.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#64748b', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <Users size={48} style={{ opacity: 0.3, marginBottom: '1rem', color: '#2563eb' }} />
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>No Customer Profiles Found</div>
              <p style={{ margin: '0 auto 1.5rem', fontSize: '0.88rem', maxWidth: '420px', color: '#64748b' }}>
                Customer profiles are automatically created whenever you save an <strong>Add New Customer Lead</strong>, or you can add one manually.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  onClick={handleSyncAllFromLeads}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  Import Existing Leads
                </button>
                <button
                  onClick={openCreateModal}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  + Add New Profile
                </button>
              </div>
            </div>
          ) : viewMode === 'cards' ? (
            /* ── Cards Grid View ── */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: '1rem' }}>
              {profiles.map((profile) => {
                const statusConf = STATUS_CONFIG[profile.status] || STATUS_CONFIG.Lead;
                const isSelected = selectedProfile && selectedProfile._id === profile._id;
                const initials = (profile.name || 'C')
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <div
                    key={profile._id}
                    onClick={() => setSelectedProfile(profile)}
                    style={{
                      background: '#ffffff',
                      border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '1.15rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem',
                      boxShadow: isSelected ? '0 8px 20px rgba(37,99,235,0.12)' : '0 2px 6px rgba(15,23,42,0.03)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.transform = '';
                      }
                    }}
                  >
                    {/* Header Row: Avatar, Name, Company, Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.95rem',
                            flexShrink: 0,
                            boxShadow: '0 2px 8px rgba(37,99,235,0.2)'
                          }}
                        >
                          {initials}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {profile.name}
                          </h4>
                          {profile.companyName && (
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <Building size={12} color="#64748b" /> {profile.companyName}
                            </div>
                          )}
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          background: statusConf.bg,
                          color: statusConf.color,
                          border: `1px solid ${statusConf.border}`,
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}
                      >
                        {statusConf.badge}
                      </span>
                    </div>

                    {/* Contact Info Pills */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.78rem', color: '#475569', background: '#f8fafc', padding: '0.6rem 0.75rem', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                          <Phone size={13} color="#2563eb" /> {profile.phone}
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openWhatsApp(profile.phone, profile.name);
                            }}
                            title="Open WhatsApp Chat"
                            style={{
                              background: '#dcfce7',
                              border: '1px solid #bbf7d0',
                              color: '#16a34a',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <MessageSquare size={11} /> WA
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCall(profile.phone);
                            }}
                            title="Call customer"
                            style={{
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              color: '#1d4ed8',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Call
                          </button>
                        </div>
                      </div>

                      {profile.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Mail size={12} color="#64748b" /> {profile.email}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <MapPin size={12} color="#64748b" /> {profile.city || 'Location N/A'}{profile.state ? `, ${profile.state}` : ''}
                        </span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe', padding: '1px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                          {profile.customerType}
                        </span>
                      </div>
                    </div>

                    {/* Requirement Preview */}
                    {profile.latestRequirement && (
                      <div style={{ fontSize: '0.75rem', color: '#334155', background: '#fefce8', border: '1px solid #fef08a', padding: '0.45rem 0.65rem', borderRadius: '8px' }}>
                        <span style={{ fontWeight: 700, color: '#854d0e', textTransform: 'uppercase', fontSize: '0.65rem', display: 'block' }}>
                          Latest Requirement
                        </span>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                          {profile.latestRequirement}
                        </div>
                      </div>
                    )}

                    {/* Stats Footer: Inquiries, Total Value, Actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '0.6rem', marginTop: 'auto' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
                        <div>
                          <span style={{ color: '#64748b', fontSize: '0.68rem', display: 'block' }}>Inquiries</span>
                          <span style={{ fontWeight: 800, color: '#0f172a' }}>{profile.totalInquiries || 1}</span>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', fontSize: '0.68rem', display: 'block' }}>Value</span>
                          <span style={{ fontWeight: 800, color: '#2563eb' }}>₹{(Number(profile.totalValue) || 0).toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(profile);
                          }}
                          title="Edit Customer Profile"
                          style={{
                            padding: '4px 8px',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            color: '#1d4ed8',
                            cursor: 'pointer'
                          }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProfile(profile._id);
                          }}
                          title="Delete Profile"
                          style={{
                            padding: '4px 8px',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            color: '#dc2626',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Table View ── */
            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 14px', fontWeight: 800, color: '#475569' }}>PERSON / NAME</th>
                      <th style={{ padding: '10px 14px', fontWeight: 800, color: '#475569' }}>COMPANY &amp; TYPE</th>
                      <th style={{ padding: '10px 14px', fontWeight: 800, color: '#475569' }}>CONTACT</th>
                      <th style={{ padding: '10px 14px', fontWeight: 800, color: '#475569' }}>CITY / STATE</th>
                      <th style={{ padding: '10px 14px', fontWeight: 800, color: '#475569' }}>INQUIRIES</th>
                      <th style={{ padding: '10px 14px', fontWeight: 800, color: '#475569' }}>TOTAL VALUE</th>
                      <th style={{ padding: '10px 14px', fontWeight: 800, color: '#475569' }}>STATUS</th>
                      <th style={{ padding: '10px 14px', fontWeight: 800, color: '#475569', textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((profile) => {
                      const statusConf = STATUS_CONFIG[profile.status] || STATUS_CONFIG.Lead;
                      const isSelected = selectedProfile && selectedProfile._id === profile._id;

                      return (
                        <tr
                          key={profile._id}
                          onClick={() => setSelectedProfile(profile)}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: isSelected ? '#eff6ff' : '#ffffff',
                            cursor: 'pointer',
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.background = '#ffffff';
                          }}
                        >
                          <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f172a' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#2563eb', color: '#fff', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {(profile.name || 'C').charAt(0).toUpperCase()}
                              </div>
                              <span>{profile.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{profile.companyName || '--'}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{profile.customerType}</div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 600, color: '#2563eb' }}>{profile.phone}</div>
                            {profile.email && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{profile.email}</div>}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#475569' }}>
                            {profile.city || 'N/A'}{profile.state ? `, ${profile.state}` : ''}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>
                            {profile.totalInquiries || 1}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 800, color: '#2563eb' }}>
                            ₹{(Number(profile.totalValue) || 0).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                padding: '0.18rem 0.5rem',
                                borderRadius: '6px',
                                background: statusConf.bg,
                                color: statusConf.color,
                                border: `1px solid ${statusConf.border}`
                              }}
                            >
                              {statusConf.badge}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openWhatsApp(profile.phone, profile.name);
                                }}
                                style={{ padding: '4px 6px', background: '#dcfce7', border: '1px solid #bbf7d0', color: '#16a34a', borderRadius: '4px', cursor: 'pointer' }}
                                title="WhatsApp"
                              >
                                <MessageSquare size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(profile);
                                }}
                                style={{ padding: '4px 6px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#1d4ed8', borderRadius: '4px', cursor: 'pointer' }}
                                title="Edit"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProfile(profile._id);
                                }}
                                style={{ padding: '4px 6px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '4px', cursor: 'pointer' }}
                                title="Delete"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Column: Selected Customer Profile Detail Drawer ── */}
        {selectedProfile && (
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 4px 12px rgba(15,23,42,0.06)',
              position: 'sticky',
              top: '1rem'
            }}
          >
            {/* Drawer Top Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff', fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {(selectedProfile.name || 'C').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{selectedProfile.name}</h3>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{selectedProfile.companyName || 'No Company'}</div>
                </div>
              </div>
              <button onClick={() => setSelectedProfile(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}>
                <X size={18} />
              </button>
            </div>

            {/* Quick Action Buttons */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => openWhatsApp(selectedProfile.phone, selectedProfile.name)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '7px',
                  borderRadius: '8px',
                  background: '#dcfce7',
                  border: '1px solid #bbf7d0',
                  color: '#16a34a',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                <MessageSquare size={13} /> WhatsApp
              </button>
              <button
                onClick={() => openCall(selectedProfile.phone)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '7px',
                  borderRadius: '8px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1d4ed8',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                <Phone size={13} /> Call
              </button>
              <button
                onClick={() => openEditModal(selectedProfile)}
                style={{
                  padding: '7px 10px',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
                title="Edit Customer Profile"
              >
                <Edit2 size={13} />
              </button>
            </div>

            {/* Profile Overview Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Customer Type:</span>
                <span style={{ fontWeight: 700, color: '#7c3aed' }}>{selectedProfile.customerType}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Status:</span>
                <span style={{ fontWeight: 700, color: STATUS_CONFIG[selectedProfile.status]?.color || '#2563eb' }}>{selectedProfile.status}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Phone:</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{selectedProfile.phone}</span>
              </div>
              {selectedProfile.email && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Email:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedProfile.email}</span>
                </div>
              )}
              {selectedProfile.city && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>City / State:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedProfile.city}{selectedProfile.state ? `, ${selectedProfile.state}` : ''}</span>
                </div>
              )}
              {selectedProfile.gstin && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>GSTIN:</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{selectedProfile.gstin}</span>
                </div>
              )}
              {selectedProfile.paymentTerms && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Payment Terms:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedProfile.paymentTerms}</span>
                </div>
              )}
            </div>

            {/* Inquiries & Leads History */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                  Inquiry &amp; Lead History ({selectedProfile.leadHistory?.length || 0})
                </span>
                {onAddNewLeadForCustomer && (
                  <button
                    onClick={() => onAddNewLeadForCustomer(selectedProfile)}
                    style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    + New Lead
                  </button>
                )}
              </div>

              {selectedProfile.leadHistory && selectedProfile.leadHistory.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {selectedProfile.leadHistory.map((lead, idx) => (
                    <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem', fontSize: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: '#2563eb' }}>{lead.stage || 'Inquiry'}</span>
                        <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                          {lead.date ? new Date(lead.date).toLocaleDateString('en-IN') : ''}
                        </span>
                      </div>
                      {lead.requirement && (
                        <div style={{ color: '#334155', marginTop: '3px', lineHeight: '1.3' }}>
                          {lead.requirement}
                        </div>
                      )}
                      {lead.estimatedValue > 0 && (
                        <div style={{ fontWeight: 700, color: '#16a34a', marginTop: '3px' }}>
                          ₹{Number(lead.estimatedValue).toLocaleString('en-IN')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', padding: '0.5rem', textAlign: 'center' }}>
                  No past lead history recorded yet.
                </div>
              )}
            </div>

            {/* Quick Log Interaction Form */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                Log Client Interaction
              </span>
              <form onSubmit={handleAddInteraction} style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {['Call', 'WhatsApp', 'Meeting', 'Note'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setInteractionType(type)}
                      style={{
                        flex: 1,
                        padding: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        borderRadius: '4px',
                        border: interactionType === type ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                        background: interactionType === type ? '#eff6ff' : '#f8fafc',
                        color: interactionType === type ? '#1d4ed8' : '#64748b',
                        cursor: 'pointer'
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input
                    type="text"
                    placeholder="Enter discussion notes / follow-up summary..."
                    value={interactionNote}
                    onChange={(e) => setInteractionNote(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.78rem',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={loggingInteraction || !interactionNote.trim()}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    Save
                  </button>
                </div>
              </form>

              {/* Interaction Logs History */}
              {selectedProfile.interactionLogs && selectedProfile.interactionLogs.length > 0 && (
                <div style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '140px', overflowY: 'auto' }}>
                  {selectedProfile.interactionLogs.map((log, i) => (
                    <div key={i} style={{ background: '#f8fafc', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid #f1f5f9', fontSize: '0.72rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontWeight: 600 }}>
                        <span>
                          <strong>{log.type}</strong> by {log.author || 'Admin'}
                        </span>
                        <span>{new Date(log.date).toLocaleDateString('en-IN')}</span>
                      </div>
                      <div style={{ color: '#1e293b', marginTop: '2px' }}>{log.note}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Add / Edit Customer Profile Modal ── */}
      {showEditModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
          onClick={() => !saving && setShowEditModal(false)}
        >
          <div
            style={{
              position: 'relative',
              background: '#ffffff',
              borderRadius: '18px',
              width: '100%',
              maxWidth: '620px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(15,23,42,0.25)',
              border: '1px solid #e2e8f0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                  {editingProfile ? 'Edit Customer Profile' : 'Add New Customer Profile'}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Manage complete person profile, company info, and customer relationship settings.
                </p>
              </div>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Row 1: Name & Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Customer / Person Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Phone / Mobile *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +91 98251 44321"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Row 2: Company & Email */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Company / Firm Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sharma Creations"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="rahul@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Row 3: Customer Type & Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Customer Category / Type
                  </label>
                  <select
                    value={formData.customerType}
                    onChange={(e) => setFormData({ ...formData, customerType: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  >
                    {CUSTOMER_TYPES.filter((t) => t !== 'All').map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Profile Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  >
                    <option value="Lead">Lead (In Discussion)</option>
                    <option value="Active">Active (Regular Client)</option>
                    <option value="VIP Client">VIP Client (High Volume)</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Row 4: City, State, GSTIN */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    City / Town
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Surat"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    State
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Gujarat"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    GSTIN (Tax ID)
                  </label>
                  <input
                    type="text"
                    placeholder="24AAAAA0000A1Z5"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Row 5: Payment Terms & Tags */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Payment Terms
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Advance / 15 Days Credit"
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Digital Print, Crepe, High Value"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Row 6: Address & Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shop 204, Millennium Textile Market, Ring Road, Surat"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Internal Relationship Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Important preferences, fabric requirements, sample notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#64748b',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '9px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer'
                  }}
                >
                  {saving ? 'Saving...' : editingProfile ? 'Update Profile' : 'Save Customer Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
