import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Filter, Download, Eye, Edit, Trash2, Scissors, Calculator, TrendingUp, DollarSign, Layers, ArrowRight, CheckCircle2, History, Package, Truck, Check, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import GarmentJobCardForm from './GarmentJobCardForm';
import GarmentJobCardPrintView from './GarmentJobCardPrintView';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import { matchSearchQuery } from '../utils/searchUtils';
import { triggerEliteAlert, triggerEliteConfirm } from './EliteModalDialog';

import PKDOrdersImportModal from './PKDOrdersImportModal';

const PIPELINE_STAGES = [
  { stage_number: 1, key: '1_fabric_order', name: 'Fabric Order', icon: '🧵', color: '#60a5fa', desc: 'Fabric Procurement & Requisition' },
  { stage_number: 2, key: '2_fabric_checking', name: 'Fabric Checking', icon: '🔍', color: '#818cf8', desc: 'Defect Inspection & Shading' },
  { stage_number: 3, key: '3_cutting', name: 'Cutting', icon: '✂️', color: '#c084fc', desc: 'Laying & Pattern Cutting' },
  { stage_number: 4, key: '4_stitching', name: 'Stitching', icon: '🪡', color: '#f472b6', desc: 'Tailor Assembly & Seam Stitching' },
  { stage_number: 5, key: '5_garment_checking', name: 'Garment Checking', icon: '🔎', color: '#fb7185', desc: 'Quality Audit & Thread Trimming' },
  { stage_number: 6, key: '6_press_and_pack', name: 'Press & Pack', icon: '📦', color: '#fbbf24', desc: 'Steam Pressing & Poly Bagging' },
  { stage_number: 7, key: '7_in_rack', name: 'In Rack', icon: '🗄️', color: '#34d399', desc: 'Finished Goods Rack Storage' },
  { stage_number: 8, key: '8_delivery', name: 'Delivery', icon: '🚚', color: '#10b981', desc: 'Final Dispatch & Delivery' }
];

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
  const [stageFilter, setStageFilter] = useState('All');

  // Analytics State
  const [analytics, setAnalytics] = useState({
    summary: { totalJobs: 0, totalPieces: 0, totalFabricCost: 0, totalStitchingCost: 0, grandTotalCost: 0, avgCostPerPiece: 0 },
    designAnalytics: []
  });

  // Modal States
  const [showForm, setShowForm] = useState(false);
  const [showPKDImportModal, setShowPKDImportModal] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [printCard, setPrintCard] = useState(null);
  
  // Pipeline Stage Transition & History States
  const [transitionCard, setTransitionCard] = useState(null);
  const [historyCard, setHistoryCard] = useState(null);
  const [advancing, setAdvancing] = useState(false);

  // Transition Modal Form State
  const [transPcs, setTransPcs] = useState(0);
  const [transDefects, setTransDefects] = useState(0);
  const [transOperator, setTransOperator] = useState('');
  const [transRack, setTransRack] = useState('');
  const [transRemarks, setTransRemarks] = useState('');
  const [transUserName, setTransUserName] = useState('');

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
        stage: stageFilter !== 'All' ? stageFilter : undefined,
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
  }, [search, dateStart, dateEnd, designFilter, vendorFilter, statusFilter, stageFilter, page]);

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

  const openTransitionModal = (card) => {
    const currentStageNo = card.current_stage || 1;
    setTransitionCard(card);
    setTransPcs(card.total_pieces || 0);
    setTransDefects(0);
    setTransOperator('');
    setTransRack('');
    setTransRemarks('');
    setTransUserName(localStorage.getItem('userName') || 'Operator');
  };

  const handleAdvanceStageSubmit = async (e) => {
    e.preventDefault();
    if (!transitionCard) return;
    setAdvancing(true);
    try {
      const res = await api.advanceGarmentJobCardStage(transitionCard._id, {
        pcs_completed: transPcs,
        defect_pcs: transDefects,
        operator_name: transOperator,
        rack_number: transRack,
        remarks: transRemarks,
        user_name: transUserName
      });
      if (res && res.success) {
        triggerEliteAlert('Stage Advanced!', res.message || 'Job Card successfully moved to next stage.', 'success');
        setTransitionCard(null);
        fetchCards();
        fetchAnalytics();
      }
    } catch (err) {
      triggerEliteAlert('Advance Failed', err.message || 'Failed to advance stage.', 'error');
    } finally {
      setAdvancing(false);
    }
  };

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
      'Job Number', 'Date', 'Design Number', 'Label', 'Current Stage No', 'Current Stage Name', 'Status',
      'Total Pieces', 'Total Fabric Cost (INR)', 'Total Processing Cost (INR)',
      'Overhead Cost (INR)', 'Grand Total Cost (INR)', 'Final Unit Cost (INR/Pc)'
    ];

    const rows = cards.map(c => [
      `"${c.job_number || ''}"`,
      `"${c.date || ''}"`,
      `"${c.design_number || ''}"`,
      `"${c.label || ''}"`,
      c.current_stage || 1,
      `"${c.current_stage_name || 'Fabric Order'}"`,
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
            Elite Stitching — 8-Stage Garment Production ERP
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Multi-stage Lot Handover Tracking (Fabric Order ➔ Fabric Check ➔ Cutting ➔ Stitching ➔ Garment Check ➔ Press & Pack ➔ Rack ➔ Delivery)
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
            onClick={() => setShowPKDImportModal(true)}
            style={{
              background: 'linear-gradient(135deg, rgba(56,189,248,0.15), rgba(16,185,129,0.15))',
              border: '1px solid rgba(56,189,248,0.4)',
              color: '#38bdf8',
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
            📥 Import PKD Orders
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

      {showPKDImportModal && (
        <PKDOrdersImportModal
          onClose={() => setShowPKDImportModal(false)}
          onImportSuccess={() => {
            fetchCards();
            fetchAnalytics();
          }}
        />
      )}

      {/* KPI Analytical Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={kpiLabelStyle}>Total Jobs</span>
            <Layers size={18} color="#60a5fa" />
          </div>
          <span style={kpiValStyle}>{summary.totalJobs || 0}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Active Production Lots</span>
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

      {/* 8-Stage Production Filter Pills */}
      <div style={{
        background: 'var(--bg-card, #1f2937)',
        padding: '0.85rem 1rem',
        borderRadius: '10px',
        border: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          📌 Filter Production Stage (8 Steps):
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            onClick={() => setStageFilter('All')}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '20px',
              border: stageFilter === 'All' ? '1px solid var(--primary)' : '1px solid var(--border-light)',
              background: stageFilter === 'All' ? 'var(--primary)' : 'var(--bg-main, #111827)',
              color: stageFilter === 'All' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            All Stages
          </button>
          {PIPELINE_STAGES.map(st => (
            <button
              key={st.stage_number}
              onClick={() => setStageFilter(String(st.stage_number))}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '20px',
                border: stageFilter === String(st.stage_number) ? `1px solid ${st.color}` : '1px solid var(--border-light)',
                background: stageFilter === String(st.stage_number) ? `${st.color}25` : 'var(--bg-main, #111827)',
                color: stageFilter === String(st.stage_number) ? st.color : 'var(--text-muted)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{st.icon}</span>
              <span>{st.stage_number}. {st.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Filter Bar */}
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

        {(search || dateStart || dateEnd || designFilter || vendorFilter || statusFilter !== 'All' || stageFilter !== 'All') && (
          <button
            onClick={() => { setSearch(''); setDateStart(''); setDateEnd(''); setDesignFilter(''); setVendorFilter(''); setStatusFilter('All'); setStageFilter('All'); }}
            style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Tab Switcher */}
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
                    <th style={tThStyle}>Job Card #</th>
                    <th style={tThStyle}>Design & Label</th>
                    <th style={tThStyle}>Current Production Stage (8 Steps)</th>
                    <th style={tThStyle}>Status</th>
                    <th style={tThStyle}>Volume</th>
                    <th style={tThStyle}>Grand Total</th>
                    <th style={tThStyle}>Cost / Pc</th>
                    <th style={{ ...tThStyle, textAlign: 'right' }}>Stage Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cards
                    .filter(c => matchSearchQuery(c, search, ['job_number', 'design_number', 'label', 'vendor_name', 'finishing', 'status', 'current_stage_name']))
                    .map((c) => {
                      const curStageNo = c.current_stage || 1;
                      const curStageObj = PIPELINE_STAGES.find(s => s.stage_number === curStageNo) || PIPELINE_STAGES[0];
                      const nextStageObj = PIPELINE_STAGES.find(s => s.stage_number === curStageNo + 1);

                      return (
                        <tr key={c._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ ...tTdStyle }}>
                            <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.9rem' }}>{c.job_number}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatDateDDMMYYYY(c.date)}</div>
                          </td>

                          <td style={tTdStyle}>
                            <div style={{ fontWeight: 700 }}>{c.design_number || '—'}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.label || 'No Label'}</div>
                          </td>

                          {/* 8-Stage Visual Stepper Column */}
                          <td style={{ ...tTdStyle, minWidth: '280px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '12px',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  background: `${curStageObj.color}25`,
                                  color: curStageObj.color,
                                  border: `1px solid ${curStageObj.color}50`
                                }}>
                                  {curStageObj.icon} Stage {curStageNo}/8: {curStageObj.name}
                                </span>
                                {c.stage_history && c.stage_history.length > 0 && (
                                  <button
                                    title="View Stage Audit Trail History"
                                    onClick={() => setHistoryCard(c)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.7rem', fontWeight: 600 }}
                                  >
                                    <History size={12} /> Log ({c.stage_history.length})
                                  </button>
                                )}
                              </div>

                              {/* Visual Stepper Dots */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.1rem' }}>
                                {PIPELINE_STAGES.map((s) => {
                                  const isCompleted = s.stage_number < curStageNo;
                                  const isCurrent = s.stage_number === curStageNo;
                                  return (
                                    <div
                                      key={s.stage_number}
                                      title={`Stage ${s.stage_number}: ${s.name}`}
                                      style={{
                                        flex: 1,
                                        height: '6px',
                                        borderRadius: '3px',
                                        background: isCompleted ? '#10b981' : isCurrent ? s.color : 'rgba(255,255,255,0.1)',
                                        boxShadow: isCurrent ? `0 0 8px ${s.color}` : 'none'
                                      }}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          </td>

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
                          <td style={{ ...tTdStyle, fontWeight: 800, color: '#60a5fa' }}>₹{(c.grand_total_cost || 0).toFixed(2)}</td>
                          <td style={{ ...tTdStyle, fontWeight: 900, color: '#fbbf24' }}>₹{(c.final_cost_per_pc || 0).toFixed(2)}</td>

                          {/* Stage Advance Action Button */}
                          <td style={{ ...tTdStyle, textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                              {curStageNo < 8 ? (
                                <button
                                  onClick={() => openTransitionModal(c)}
                                  style={{
                                    background: `linear-gradient(135deg, ${nextStageObj ? nextStageObj.color : '#3b82f6'}, #1d4ed8)`,
                                    border: 'none',
                                    color: '#fff',
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '6px',
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                                  }}
                                >
                                  <span>Send to Stage {curStageNo + 1} ({nextStageObj ? nextStageObj.name : ''})</span>
                                  <ArrowRight size={13} />
                                </button>
                              ) : (
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                  <CheckCircle2 size={14} /> Delivered
                                </span>
                              )}

                              <button
                                title="Print Paper Job Card"
                                onClick={() => setPrintCard(c)}
                                style={actionBtnStyle}
                              >
                                <Eye size={14} color="#34d399" />
                              </button>
                              <button
                                title="Edit Job Card"
                                onClick={() => { setEditingCard(c); setShowForm(true); }}
                                style={actionBtnStyle}
                              >
                                <Edit size={14} color="#60a5fa" />
                              </button>
                              <button
                                title="Delete"
                                onClick={() => handleDelete(c._id, c.job_number)}
                                style={actionBtnStyle}
                              >
                                <Trash2 size={14} color="#f87171" />
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

      {/* Stage Transition Modal */}
      {transitionCard && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1100,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-card, #1f2937)',
            border: '1px solid var(--border-light)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: 'var(--shadow-xl)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(16,185,129,0.2))',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  🔄 Advance Production Stage
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Garment Job Card: #{transitionCard.job_number} (Design: {transitionCard.design_number || 'N/A'})
                </span>
              </div>
              <button
                onClick={() => setTransitionCard(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleAdvanceStageSubmit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* From -> To Stage Banner */}
              {(() => {
                const curNo = transitionCard.current_stage || 1;
                const fromObj = PIPELINE_STAGES.find(s => s.stage_number === curNo) || PIPELINE_STAGES[0];
                const targetObj = PIPELINE_STAGES.find(s => s.stage_number === curNo + 1) || PIPELINE_STAGES[curNo - 1];

                return (
                  <div style={{
                    background: 'var(--bg-main, #111827)',
                    padding: '0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem'
                  }}>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Current Stage</span>
                      <div style={{ fontWeight: 800, color: fromObj.color, fontSize: '0.9rem', marginTop: '0.1rem' }}>
                        {fromObj.icon} {fromObj.stage_number}. {fromObj.name}
                      </div>
                    </div>

                    <ArrowRight size={20} color="var(--primary)" />

                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Target Stage</span>
                      <div style={{ fontWeight: 800, color: targetObj.color, fontSize: '0.9rem', marginTop: '0.1rem' }}>
                        {targetObj.icon} {targetObj.stage_number}. {targetObj.name}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={modalLabelStyle}>Passed / Completed Pcs *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={transPcs}
                    onChange={e => setTransPcs(e.target.value)}
                    style={modalInputStyle}
                  />
                </div>

                <div>
                  <label style={modalLabelStyle}>Defect / Rejected Pcs</label>
                  <input
                    type="number"
                    min="0"
                    value={transDefects}
                    onChange={e => setTransDefects(e.target.value)}
                    style={modalInputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={modalLabelStyle}>Operator / Tailor Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Tailor / Operator"
                    value={transOperator}
                    onChange={e => setTransOperator(e.target.value)}
                    style={modalInputStyle}
                  />
                </div>

                <div>
                  <label style={modalLabelStyle}>Rack Location (If Stage 7)</label>
                  <input
                    type="text"
                    placeholder="e.g. Rack-B-04"
                    value={transRack}
                    onChange={e => setTransRack(e.target.value)}
                    style={modalInputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={modalLabelStyle}>Your Name / User *</label>
                <input
                  type="text"
                  required
                  value={transUserName}
                  onChange={e => setTransUserName(e.target.value)}
                  style={modalInputStyle}
                />
              </div>

              <div>
                <label style={modalLabelStyle}>Handover Remarks / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Additional observations, inspection notes..."
                  value={transRemarks}
                  onChange={e => setTransRemarks(e.target.value)}
                  style={{ ...modalInputStyle, resize: 'none' }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setTransitionCard(null)}
                  style={{ background: 'none', border: '1px solid var(--border-light)', color: 'var(--text-primary)', padding: '0.55rem 1rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={advancing}
                  style={{ background: 'var(--primary)', border: 'none', color: '#fff', padding: '0.55rem 1.25rem', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {advancing ? 'Saving...' : 'Confirm Stage Move ➡️'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stage History Timeline Drawer */}
      {historyCard && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1100,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-card, #1f2937)',
            border: '1px solid var(--border-light)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '85vh',
            boxShadow: 'var(--shadow-xl)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{
              background: 'var(--bg-main, #111827)',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <History size={20} color="var(--primary)" /> Stage Handover Audit Log
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Job Card #{historyCard.job_number} (Design: {historyCard.design_number || 'N/A'})
                </span>
              </div>
              <button
                onClick={() => setHistoryCard(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(!historyCard.stage_history || historyCard.stage_history.length === 0) ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No stage transitions logged yet. Job card is at Stage 1: Fabric Order.
                </div>
              ) : (
                historyCard.stage_history.map((h, i) => (
                  <div key={i} style={{
                    background: 'var(--bg-main, #111827)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '8px',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, color: '#34d399', fontSize: '0.88rem' }}>
                        Step {h.stage_number}: {h.stage_name}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {new Date(h.transitioned_at).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                      Moved from <b>{h.from_stage_name || 'Previous Stage'}</b> by <b>{h.transitioned_by || 'User'}</b>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      <span>👕 Passed: <b>{h.pcs_completed} pcs</b></span>
                      {h.defect_pcs > 0 && <span style={{ color: '#f87171' }}>⚠️ Defects: <b>{h.defect_pcs} pcs</b></span>}
                      {h.operator_name && <span>👤 Operator: <b>{h.operator_name}</b></span>}
                      {h.rack_number && <span>🗄️ Rack: <b>{h.rack_number}</b></span>}
                    </div>

                    {h.remarks && (
                      <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        "{h.remarks}"
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--border-light)', background: 'var(--bg-main, #111827)', textAlign: 'right' }}>
              <button
                onClick={() => setHistoryCard(null)}
                style={{ background: 'var(--primary)', border: 'none', color: '#fff', padding: '0.45rem 1rem', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
              >
                Close Log
              </button>
            </div>
          </div>
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
