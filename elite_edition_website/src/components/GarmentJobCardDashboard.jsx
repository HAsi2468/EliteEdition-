import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Filter, Download, Eye, Edit, Trash2, Scissors, Calculator, TrendingUp, DollarSign, Layers } from 'lucide-react';
import { api } from '../services/api';
import GarmentJobCardForm from './GarmentJobCardForm';
import GarmentJobCardPrintView from './GarmentJobCardPrintView';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import { matchSearchQuery } from '../utils/searchUtils';
import { triggerEliteAlert, triggerEliteConfirm } from './EliteModalDialog';

export default function GarmentJobCardDashboard() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [designFilter, setDesignFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Analytics State
  const [analytics, setAnalytics] = useState({
    summary: { totalJobs: 0, totalPieces: 0, totalFabricCost: 0, totalStitchingCost: 0, grandTotalCost: 0, avgCostPerPiece: 0 },
    designAnalytics: []
  });

  // Modal States
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [printCard, setPrintCard] = useState(null);

  // Active Sub View
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'analytics'

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getGarmentJobCards({
        search,
        dateStart,
        dateEnd,
        design_number: designFilter,
        vendor_name: vendorFilter,
        status: statusFilter,
        page,
        limit: 25
      });
      if (res && res.success) {
        setCards(res.data || []);
        setTotal(res.total || 0);
        setPages(res.pages || 1);
      }
    } catch (err) {
      setError(err.message || 'Failed to load garment job cards.');
    } finally {
      setLoading(false);
    }
  }, [search, dateStart, dateEnd, designFilter, vendorFilter, statusFilter, page]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await api.getGarmentJobCardAnalytics({
        dateStart,
        dateEnd,
        design_number: designFilter
      });
      if (res && res.success) {
        setAnalytics({
          summary: res.summary || {},
          designAnalytics: res.designAnalytics || []
        });
      }
    } catch (e) {
      console.warn('Failed to load garment analytics', e);
    }
  }, [dateStart, dateEnd, designFilter]);

  useEffect(() => {
    fetchCards();
    fetchAnalytics();
  }, [fetchCards, fetchAnalytics]);

  const handleDelete = async (id, jobNo) => {
    const confirmed = await triggerEliteConfirm({
      title: 'Delete Garment Job Card',
      message: `Are you sure you want to delete Garment Job Card "${jobNo}"?`,
      confirmText: 'Delete Job Card',
      type: 'danger'
    });
    if (!confirmed) return;
    try {
      await api.deleteGarmentJobCard(id);
      fetchCards();
      fetchAnalytics();
    } catch (err) {
      triggerEliteAlert('Delete Failed', err.message || 'Failed to delete job card.', 'error');
    }
  };

  const handleExportCSV = () => {
    if (!cards.length) {
      triggerEliteAlert('Export Notice', 'No job card data available to export.', 'warning');
      return;
    }
    
    const headers = [
      'Job Number', 'Date', 'Design Number', 'Label', 'Finishing', 'Status',
      'Total Pieces', 'Total Fabric Cost (INR)', 'Total Processing Cost (INR)',
      'Overhead Cost (INR)', 'Grand Total Cost (INR)', 'Final Unit Cost (INR/Pc)'
    ];

    const rows = cards.map(c => [
      `"${c.job_number || ''}"`,
      `"${c.date || ''}"`,
      `"${c.design_number || ''}"`,
      `"${c.label || ''}"`,
      `"${c.finishing || ''}"`,
      `"${c.status || ''}"`,
      c.total_pieces || 0,
      (c.total_fabric_cost || 0).toFixed(2),
      (c.total_stitching_cost || 0).toFixed(2),
      (c.overhead_cost || 0).toFixed(2),
      (c.grand_total_cost || 0).toFixed(2),
      (c.final_cost_per_pc || 0).toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Garment_Job_Cards_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const { summary, designAnalytics } = analytics;

  return (
    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header & Main Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
            <Scissors size={26} color="var(--primary)" />
            Elite Stitching — Garment Manufacturing ERP & Analytics
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Garment Job Cards, Size Ratios, Material Consumption & Real-time Unit Cost Calculations
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={handleExportCSV}
            style={{
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.3)',
              color: '#60a5fa',
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem'
            }}
          >
            <Download size={16} /> Export CSV
          </button>
          <button
            onClick={() => { setEditingCard(null); setShowForm(true); }}
            style={{
              background: 'var(--primary, #10b981)',
              border: 'none',
              color: '#fff',
              padding: '0.55rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              boxShadow: 'var(--shadow-md)'
            }}
          >
            <Plus size={18} /> + New Garment Job Card
          </button>
        </div>
      </div>

      {/* KPI Analytical Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={kpiLabelStyle}>Total Jobs</span>
            <Layers size={18} color="#60a5fa" />
          </div>
          <span style={kpiValStyle}>{summary.totalJobs || 0}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Job Cards Recorded</span>
        </div>

        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={kpiLabelStyle}>Total Garments</span>
            <Calculator size={18} color="#34d399" />
          </div>
          <span style={{ ...kpiValStyle, color: '#34d399' }}>{summary.totalPieces || 0} Pcs</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Manufactured Volume</span>
        </div>

        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={kpiLabelStyle}>Fabric Expense</span>
            <DollarSign size={18} color="#34d399" />
          </div>
          <span style={{ ...kpiValStyle, color: '#34d399' }}>₹{(summary.totalFabricCost || 0).toLocaleString('en-IN')}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Raw Material Cost</span>
        </div>

        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={kpiLabelStyle}>Stitching & Labor</span>
            <Scissors size={18} color="#c084fc" />
          </div>
          <span style={{ ...kpiValStyle, color: '#c084fc' }}>₹{(summary.totalStitchingCost || 0).toLocaleString('en-IN')}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Vendor Operations</span>
        </div>

        <div style={{ ...kpiCardStyle, border: '1px solid rgba(245,158,11,0.3)', background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(0,0,0,0.2))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={kpiLabelStyle}>Avg Cost / Piece</span>
            <TrendingUp size={18} color="#fbbf24" />
          </div>
          <span style={{ ...kpiValStyle, color: '#fbbf24' }}>₹{(summary.avgCostPerPiece || 0).toFixed(2)}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Grand Total / Total Pcs</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{
        background: 'var(--bg-card, #1f2937)',
        padding: '1rem',
        borderRadius: '10px',
        border: '1px solid var(--border-light)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        alignItems: 'center'
      }}>
        <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', background: 'var(--bg-main, #111827)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '0.4rem 0.65rem' }}>
          <Search size={16} color="var(--text-muted)" style={{ marginRight: '0.4rem' }} />
          <input
            type="text"
            placeholder="Search Job No, Design No, Label..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem', width: '100%' }}
          />
        </div>

        <input
          type="date"
          title="Start Date"
          value={dateStart}
          onChange={e => setDateStart(e.target.value)}
          style={filterInputStyle}
        />
        <input
          type="date"
          title="End Date"
          value={dateEnd}
          onChange={e => setDateEnd(e.target.value)}
          style={filterInputStyle}
        />

        <input
          type="text"
          placeholder="Filter Design No..."
          value={designFilter}
          onChange={e => setDesignFilter(e.target.value)}
          style={filterInputStyle}
        />

        <input
          type="text"
          placeholder="Filter Vendor..."
          value={vendorFilter}
          onChange={e => setVendorFilter(e.target.value)}
          style={filterInputStyle}
        />

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={filterInputStyle}
        >
          <option value="All">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="In Production">In Production</option>
          <option value="Completed">Completed</option>
        </select>

        {(search || dateStart || dateEnd || designFilter || vendorFilter || statusFilter !== 'All') && (
          <button
            onClick={() => { setSearch(''); setDateStart(''); setDateEnd(''); setDesignFilter(''); setVendorFilter(''); setStatusFilter('All'); }}
            style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Tab Switcher: Job Cards List vs Design Analytics Matrix */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', gap: '1rem' }}>
        <button
          onClick={() => setActiveTab('list')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'list' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'list' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 700,
            padding: '0.6rem 0.5rem',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Garment Job Cards ({total})
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'analytics' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'analytics' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 700,
            padding: '0.6rem 0.5rem',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Design Unit Cost Analytics ({designAnalytics.length})
        </button>
      </div>

      {/* Main Table Content */}
      {activeTab === 'list' ? (
        <div style={{ background: 'var(--bg-card, #1f2937)', borderRadius: '10px', border: '1px solid var(--border-light)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading Garment Job Cards...</div>
          ) : error ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#f87171' }}>{error}</div>
          ) : cards.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No Garment Job Cards found matching criteria. Click "+ New Garment Job Card" to create one.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={tThStyle}>Job No</th>
                    <th style={tThStyle}>Date</th>
                    <th style={tThStyle}>Design No</th>
                    <th style={tThStyle}>Label</th>
                    <th style={tThStyle}>Status</th>
                    <th style={tThStyle}>Total Pcs</th>
                    <th style={tThStyle}>Fabric Cost</th>
                    <th style={tThStyle}>Processing</th>
                    <th style={tThStyle}>Grand Total</th>
                    <th style={tThStyle}>Cost / Pc</th>
                    <th style={{ ...tThStyle, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cards
                    .filter(c => matchSearchQuery(c, search, ['job_number', 'design_number', 'label', 'vendor_name', 'finishing', 'status']))
                    .map((c) => (
                    <tr key={c._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ ...tTdStyle, fontWeight: 800, color: 'var(--primary)' }}>{c.job_number}</td>
                      <td style={tTdStyle}>{formatDateDDMMYYYY(c.date)}</td>
                      <td style={{ ...tTdStyle, fontWeight: 700 }}>{c.design_number || '—'}</td>
                      <td style={tTdStyle}>{c.label || '—'}</td>
                      <td style={tTdStyle}>
                        <span style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '12px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: c.status === 'Completed' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                          color: c.status === 'Completed' ? '#34d399' : '#fbbf24'
                        }}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ ...tTdStyle, fontWeight: 700 }}>{c.total_pieces || 0} Pcs</td>
                      <td style={tTdStyle}>₹{(c.total_fabric_cost || 0).toFixed(2)}</td>
                      <td style={tTdStyle}>₹{(c.total_stitching_cost || 0).toFixed(2)}</td>
                      <td style={{ ...tTdStyle, fontWeight: 800, color: '#60a5fa' }}>₹{(c.grand_total_cost || 0).toFixed(2)}</td>
                      <td style={{ ...tTdStyle, fontWeight: 900, color: '#fbbf24' }}>₹{(c.final_cost_per_pc || 0).toFixed(2)}</td>
                      <td style={{ ...tTdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            title="Print Paper Job Card"
                            onClick={() => setPrintCard(c)}
                            style={actionBtnStyle}
                          >
                            <Eye size={15} color="#34d399" />
                          </button>
                          <button
                            title="Edit Job Card"
                            onClick={() => { setEditingCard(c); setShowForm(true); }}
                            style={actionBtnStyle}
                          >
                            <Edit size={15} color="#60a5fa" />
                          </button>
                          <button
                            title="Delete"
                            onClick={() => handleDelete(c._id, c.job_number)}
                            style={actionBtnStyle}
                          >
                            <Trash2 size={15} color="#f87171" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Page {page} of {pages} ({total} entries)</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  style={pageBtnStyle}
                >
                  Previous
                </button>
                <button
                  disabled={page >= pages}
                  onClick={() => setPage(p => p + 1)}
                  style={pageBtnStyle}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Design Unit Cost Analytics Matrix */
        <div style={{ background: 'var(--bg-card, #1f2937)', borderRadius: '10px', border: '1px solid var(--border-light)', padding: '1rem', overflowX: 'auto' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 1rem 0' }}>
            📊 Design-wise Average Manufacturing Cost Matrix
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={tThStyle}>Design Number</th>
                <th style={tThStyle}>Job Cards Count</th>
                <th style={tThStyle}>Total Volume (Pcs)</th>
                <th style={tThStyle}>Cumulative Total Cost</th>
                <th style={tThStyle}>Average Cost / Piece</th>
              </tr>
            </thead>
            <tbody>
              {designAnalytics.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No design analytics recorded.
                  </td>
                </tr>
              ) : (
                designAnalytics.map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ ...tTdStyle, fontWeight: 800 }}>{d.design_number}</td>
                    <td style={tTdStyle}>{d.job_count} Jobs</td>
                    <td style={{ ...tTdStyle, fontWeight: 700 }}>{d.total_pcs} Pcs</td>
                    <td style={{ ...tTdStyle, fontWeight: 800, color: '#60a5fa' }}>₹{d.total_cost.toLocaleString('en-IN')}</td>
                    <td style={{ ...tTdStyle, fontWeight: 900, color: '#fbbf24' }}>₹{d.avg_cost_per_pc.toFixed(2)} / Pc</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <GarmentJobCardForm
          card={editingCard}
          onClose={() => setShowForm(false)}
          onSave={() => {
            setShowForm(false);
            fetchCards();
            fetchAnalytics();
          }}
        />
      )}

      {/* Printable Modal View */}
      {printCard && (
        <GarmentJobCardPrintView
          card={printCard}
          onClose={() => setPrintCard(null)}
        />
      )}
    </div>
  );
}

const kpiCardStyle = {
  background: 'var(--bg-card, #1f2937)',
  padding: '1rem',
  borderRadius: '10px',
  border: '1px solid var(--border-light)',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem'
};

const kpiLabelStyle = {
  fontSize: '0.72rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.03em'
};

const kpiValStyle = {
  fontSize: '1.35rem',
  fontWeight: 900,
  color: 'var(--text-primary)'
};

const filterInputStyle = {
  background: 'var(--bg-main, #111827)',
  border: '1px solid var(--border-light, #374151)',
  borderRadius: '6px',
  color: 'var(--text-primary)',
  padding: '0.4rem 0.6rem',
  fontSize: '0.8rem',
  outline: 'none'
};

const tThStyle = {
  padding: '0.65rem 0.85rem',
  fontWeight: 700,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--border-light)'
};

const tTdStyle = {
  padding: '0.65rem 0.85rem',
  verticalAlign: 'middle'
};

const actionBtnStyle = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--border-light)',
  borderRadius: '6px',
  padding: '0.35rem 0.5rem',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center'
};

const pageBtnStyle = {
  background: 'var(--bg-main, #111827)',
  border: '1px solid var(--border-light)',
  color: 'var(--text-primary)',
  padding: '0.3rem 0.75rem',
  borderRadius: '6px',
  fontSize: '0.8rem',
  cursor: 'pointer'
};
