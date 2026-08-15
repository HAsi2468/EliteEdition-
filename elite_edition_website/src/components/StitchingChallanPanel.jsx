import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Filter, Download, Eye, Edit, Trash2, Printer, X, Save, RefreshCw, FileText, CheckCircle, Receipt } from 'lucide-react';
import { api } from '../services/api';
import { matchSearchQuery } from '../utils/searchUtils';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import { triggerEliteAlert, triggerEliteConfirm } from './EliteModalDialog';

const MAX_ITEMS = 30;

const DEFAULT_ITEM = () => ({
  designNo: '',
  particulars: 'Garment Goods',
  pcs: '',
  rate: '',
  amount: 0
});

export default function StitchingChallanPanel({ onNavigateToBilling }) {
  const [challans, setChallans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [selectedChallanIds, setSelectedChallanIds] = useState([]);

  const handleMergeSelected = () => {
    if (selectedChallanIds.length === 0) return;

    if (selectedChallanIds.length > 4) {
      triggerEliteAlert('Too Many Challans', 'Maximum 4 Challans can be merged into a single Invoice. Please deselect some Challans and try again.', 'error');
      return;
    }

    const selected = challans.filter(c => selectedChallanIds.includes(c._id));

    const partyNames = new Set(selected.map(c => (c.billTo || c.partyName || '').trim().toLowerCase()).filter(Boolean));
    if (partyNames.size > 1) {
      const partyList = [...new Set(selected.map(c => c.billTo || c.partyName).filter(Boolean))].join(', ');
      triggerEliteAlert('Customer Mismatch', `Cannot merge Challans from different customers. Selected Challans belong to multiple customers: ${partyList}`, 'error');
      return;
    }

    if (onNavigateToBilling) {
      onNavigateToBilling(selected);
    }
  };

  const [showModal, setShowModal] = useState(false);
  const [editingChallan, setEditingChallan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [printChallan, setPrintChallan] = useState(null);

  // Form State
  const [formState, setFormState] = useState({
    challanNo: '',
    date: new Date().toISOString().split('T')[0],
    partyName: '',
    billTo: '',
    shipTo: '',
    deliveryBy: '',
    vendorChallanNo: '',
    notes: '',
    items: Array.from({ length: 5 }, DEFAULT_ITEM)
  });

  const fetchChallans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getStitchingChallans({ search, dateStart, dateEnd });
      setChallans(res?.data || []);
    } catch (e) {
      console.error('Error fetching stitching challans:', e);
    } finally {
      setLoading(false);
    }
  }, [search, dateStart, dateEnd]);

  useEffect(() => {
    fetchChallans();
  }, [fetchChallans]);

  const openNew = async () => {
    setEditingChallan(null);
    setFormError('');
    setFormState({
      challanNo: '',
      date: new Date().toISOString().split('T')[0],
      partyName: '',
      billTo: '',
      shipTo: '',
      deliveryBy: '',
      vendorChallanNo: '',
      notes: '',
      items: Array.from({ length: 5 }, DEFAULT_ITEM)
    });
    setShowModal(true);

    try {
      const res = await api.getNextStitchingChallanNo();
      if (res && res.nextNo) {
        setFormState(prev => ({ ...prev, challanNo: res.nextNo }));
      }
    } catch (e) {
      console.warn('Failed to fetch next PCH number:', e);
    }
  };

  const openEdit = (c) => {
    setEditingChallan(c);
    setFormError('');
    let items = Array.isArray(c.items) && c.items.length > 0 ? c.items.map(it => ({
      designNo: it.designNo || '',
      particulars: it.particulars || 'Garment Goods',
      pcs: it.pcs != null ? it.pcs : '',
      rate: it.rate != null ? it.rate : '',
      amount: (parseFloat(it.pcs || 0) * parseFloat(it.rate || 0))
    })) : Array.from({ length: 5 }, DEFAULT_ITEM);

    setFormState({
      challanNo: c.challanNo || '',
      date: c.date ? new Date(c.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      partyName: c.partyName || '',
      billTo: c.billTo || '',
      shipTo: c.shipTo || '',
      deliveryBy: c.deliveryBy || '',
      vendorChallanNo: c.vendorChallanNo || '',
      notes: c.notes || '',
      items
    });
    setShowModal(true);
  };

  const handleItemChange = (index, field, value) => {
    setFormState(prev => {
      const updated = [...prev.items];
      const cur = { ...updated[index], [field]: value };

      if (field === 'pcs' || field === 'rate') {
        const pcsVal = parseFloat(field === 'pcs' ? value : cur.pcs) || 0;
        const rateVal = parseFloat(field === 'rate' ? value : cur.rate) || 0;
        cur.amount = parseFloat((pcsVal * rateVal).toFixed(2));
      }

      updated[index] = cur;
      return { ...prev, items: updated };
    });
  };

  const addItemRow = () => {
    if (formState.items.length >= MAX_ITEMS) {
      triggerEliteAlert('Item Limit Reached', `Maximum limit of ${MAX_ITEMS} items reached per Challan.`, 'warning');
      return;
    }
    setFormState(prev => ({ ...prev, items: [...prev.items, DEFAULT_ITEM()] }));
  };

  const removeItemRow = (index) => {
    setFormState(prev => {
      if (prev.items.length <= 1) return prev;
      return { ...prev, items: prev.items.filter((_, i) => i !== index) };
    });
  };

  // Calculations
  const calculatedTotalPcs = formState.items.reduce((sum, it) => sum + (parseFloat(it.pcs) || 0), 0);
  const calculatedTotalAmount = formState.items.reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formState.challanNo.trim()) {
      setFormError('Challan No is required (e.g. PCH-1).');
      return;
    }
    if (!formState.partyName.trim()) {
      setFormError('Party Name is required.');
      return;
    }

    const validItems = formState.items.filter(it => (parseFloat(it.pcs) || 0) > 0 || (it.designNo && it.designNo.trim()));
    if (validItems.length === 0) {
      setFormError('Please enter at least 1 item with quantity or design no.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const payload = {
        ...formState,
        items: validItems
      };

      if (editingChallan) {
        await api.updateStitchingChallan(editingChallan._id, payload);
      } else {
        await api.createStitchingChallan(payload);
      }
      setShowModal(false);
      fetchChallans();
    } catch (err) {
      setFormError(err.message || 'Failed to save Challan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, no) => {
    const confirmed = await triggerEliteConfirm({
      title: 'Delete Stitching Challan',
      message: `Are you sure you want to delete Stitching Challan #${no}? This action cannot be undone.`,
      confirmText: 'Delete Challan',
      type: 'danger'
    });
    if (!confirmed) return;
    try {
      await api.deleteStitchingChallan(id);
      fetchChallans();
    } catch (err) {
      triggerEliteAlert('Delete Failed', err.message || 'Failed to delete.', 'error');
    }
  };

  const handleDownloadPdf = async (c) => {
    try {
      await api.downloadStitchingChallanPdf(c._id, c.challanNo);
    } catch (e) {
      triggerEliteAlert('PDF Error', 'Error downloading PDF: ' + e.message, 'error');
    }
  };

  // KPI calculations
  const totalChallansCount = challans.length;
  const grandTotalPcs = challans.reduce((sum, c) => sum + (c.totalPcs || 0), 0);
  const grandTotalAmt = challans.reduce((sum, c) => sum + (c.totalAmount || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Banner */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#2563eb,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={22} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Elite Edition — Garment Delivery Challans
                </h2>
                <span style={{ background: 'rgba(37,99,235,0.15)', color: '#60a5fa', fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(37,99,235,0.3)' }}>
                  PCH Sequence
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>
                Garment delivery challans with Elite Edition logo & auto PCH numbering (up to 30 items per challan)
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button onClick={fetchChallans} className="btn-icon" title="Refresh">
              <RefreshCw size={15} className={loading ? 'spin-loader' : ''} />
            </button>
            <button onClick={openNew} className="btn-primary" style={{ padding: '0.55rem 1.25rem' }}>
              <Plus size={16} /> New Stitching Challan
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Challans</span>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>{totalChallansCount}</span>
        </div>
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Garments (Pcs)</span>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399' }}>{grandTotalPcs.toLocaleString()} Pcs</span>
        </div>
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Value (₹)</span>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#60a5fa' }}>₹{grandTotalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search Challan No, Party, Design No..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: '2rem', paddingRight: '0.75rem', paddingTop: '0.45rem', paddingBottom: '0.45rem', fontSize: '0.85rem' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>From:</span>
          <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>To:</span>
          <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} />
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedChallanIds.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 1.1rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', borderRadius: '10px', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)' }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={16} color="#34d399" />
            <span>{selectedChallanIds.length} Stitching Challan{selectedChallanIds.length > 1 ? 's' : ''} Selected</span>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              onClick={async () => {
                if (selectedChallanIds.length === 0) return;
                try {
                  await api.downloadBulkStitchingChallanPdf(selectedChallanIds, `Combined_Stitching_Challans_${selectedChallanIds.length}_Items.pdf`);
                  triggerEliteAlert('Download Successful', `${selectedChallanIds.length} Stitching Challans merged into 1 single multi-page PDF document.`, 'success');
                } catch (e) {
                  triggerEliteAlert('Download Failed', 'Failed to generate combined PDF: ' + e.message, 'error');
                }
              }}
              className="btn-primary"
              style={{ padding: '0.45rem 1.1rem', fontSize: '0.82rem', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Download size={15} />
              Download Combined PDF ({selectedChallanIds.length})
            </button>
            <button
              onClick={handleMergeSelected}
              className="btn-primary"
              style={{ padding: '0.45rem 1.1rem', fontSize: '0.82rem', background: 'linear-gradient(135deg, #7c3aed, #6366f1)', border: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Receipt size={15} />
              Merge & Create Invoice ({selectedChallanIds.length}/4)
            </button>
            <button
              onClick={() => setSelectedChallanIds([])}
              className="btn-secondary"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Challan Data Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} className="spin-loader" color="var(--primary)" />
            <p style={{ marginTop: '0.75rem' }}>Loading Stitching Challans...</p>
          </div>
        ) : challans.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <FileText size={40} style={{ opacity: 0.4 }} />
            <h4 style={{ marginTop: '0.75rem', color: 'var(--text-primary)' }}>No Stitching Challans Found</h4>
            <p style={{ fontSize: '0.8rem', marginTop: 4 }}>Click "+ New Stitching Challan" to create your first PCH delivery challan.</p>
            <button onClick={openNew} className="btn-primary" style={{ marginTop: '1rem', padding: '0.5rem 1.2rem' }}>
              <Plus size={14} /> Create PCH-1
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-light)' }}>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={selectedChallanIds.length > 0 && selectedChallanIds.length === challans.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedChallanIds(challans.map(c => c._id));
                        else setSelectedChallanIds([]);
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 700 }}>Challan No</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 700 }}>Date</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 700 }}>Party Name</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center' }}>Total Pcs</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>Total Amount</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 700 }}>Delivery By</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {challans
                  .filter(c => matchSearchQuery(c, search, ['challanNo', 'partyName', 'billTo', 'shipTo', 'deliveryBy', 'vendorChallanNo', 'items.designNo', 'items.particulars']))
                  .map(c => (
                  <tr key={c._id} style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.15s' }}>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedChallanIds.includes(c._id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedChallanIds(prev => [...prev, c._id]);
                          else setSelectedChallanIds(prev => prev.filter(id => id !== c._id));
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: 'var(--primary)' }}>
                      {c.challanNo}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {c.status === 'INVOICED' ? (
                        <span style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(52,211,153,0.3)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          ✓ INVOICED
                        </span>
                      ) : (
                        <span style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(251,191,36,0.3)' }}>
                          PENDING
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>
                      {formatDateDDMMYYYY(c.date)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {c.partyName || '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 800, color: '#34d399' }}>
                      {c.totalPcs || 0} Pcs
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#60a5fa' }}>
                      {c.totalAmount ? `₹${c.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>
                      {c.deliveryBy || '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                        <button
                          onClick={() => handleDownloadPdf(c)}
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                          title="Download PDF"
                        >
                          <FileText size={13} /> PDF
                        </button>
                        <button
                          onClick={() => onNavigateToBilling && onNavigateToBilling(c)}
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(99,102,241,0.2))', color: '#a78bfa', borderColor: 'rgba(124,58,237,0.4)' }}
                          title="Generate Bill"
                        >
                          <Receipt size={13} /> Bill
                        </button>
                        <button
                          onClick={() => openEdit(c)}
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                          title="Edit"
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(c._id, c.challanNo)}
                          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', padding: '0.35rem 0.5rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Entry Form Modal */}
      {showModal && (
        <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '1.5rem' }}>
          <div style={{ background: 'var(--bg-modal,#161b26)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 950, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }}>
            
            {/* Header */}
            <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg,#2563eb,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={18} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {editingChallan ? `Edit Stitching Challan — ${editingChallan.challanNo}` : `New Stitching Challan — ${formState.challanNo || 'PCH-1'}`}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Elite Edition Garment Delivery Challan (Max 30 items)</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="btn-icon"><X size={16} /></button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '1.25rem 1.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {formError && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', padding: '0.6rem 0.9rem', borderRadius: '6px', color: '#fca5a5', fontSize: '0.8rem' }}>
                  {formError}
                </div>
              )}

              {/* Top Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Challan No *</label>
                    <span style={{ fontSize: '0.65rem', color: '#34d399', fontWeight: 800 }}>⚡ Auto PCH</span>
                  </div>
                  <input
                    type="text"
                    value={formState.challanNo}
                    onChange={e => setFormState(prev => ({ ...prev, challanNo: e.target.value }))}
                    placeholder="PCH-1"
                    readOnly
                    required
                    style={{ padding: '0.45rem 0.7rem', fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)', background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.3)', cursor: 'not-allowed' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date *</label>
                  <input
                    type="date"
                    value={formState.date}
                    onChange={e => setFormState(prev => ({ ...prev, date: e.target.value }))}
                    required
                    style={{ padding: '0.45rem 0.7rem', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Party Name *</label>
                  <input
                    type="text"
                    value={formState.partyName}
                    onChange={e => setFormState(prev => ({ ...prev, partyName: e.target.value }))}
                    placeholder="Customer / Party Name"
                    required
                    style={{ padding: '0.45rem 0.7rem', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Delivery By / Transport</label>
                  <input
                    type="text"
                    value={formState.deliveryBy}
                    onChange={e => setFormState(prev => ({ ...prev, deliveryBy: e.target.value }))}
                    placeholder="Vehicle / Driver / Transport"
                    style={{ padding: '0.45rem 0.7rem', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Bill To</label>
                  <input
                    type="text"
                    value={formState.billTo}
                    onChange={e => setFormState(prev => ({ ...prev, billTo: e.target.value }))}
                    placeholder="Billing details..."
                    style={{ padding: '0.45rem 0.7rem', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ship To</label>
                  <input
                    type="text"
                    value={formState.shipTo}
                    onChange={e => setFormState(prev => ({ ...prev, shipTo: e.target.value }))}
                    placeholder="Shipping details..."
                    style={{ padding: '0.45rem 0.7rem', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* 30 Items Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    📦 Challan Items ({formState.items.length}/{MAX_ITEMS})
                  </span>
                  {formState.items.length < MAX_ITEMS && (
                    <button
                      type="button"
                      onClick={addItemRow}
                      style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)', color: '#60a5fa', fontSize: '0.7rem', fontWeight: 700, padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Plus size={13} /> Add Row
                    </button>
                  )}
                </div>

                <div style={{ overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-light)' }}>
                        <th style={{ width: '35px', padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>#</th>
                        <th style={{ width: '130px', padding: '0.5rem', color: 'var(--text-muted)' }}>Design No</th>
                        <th style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Particulars / Goods Description</th>
                        <th style={{ width: '90px', padding: '0.5rem', textAlign: 'right', color: 'var(--text-muted)' }}>Pcs (Qty)</th>
                        <th style={{ width: '90px', padding: '0.5rem', textAlign: 'right', color: 'var(--text-muted)' }}>Rate (₹)</th>
                        <th style={{ width: '100px', padding: '0.5rem', textAlign: 'right', color: 'var(--text-muted)' }}>Amount (₹)</th>
                        <th style={{ width: '40px', padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted)' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formState.items.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ padding: '0.35rem' }}>
                            <input
                              type="text"
                              value={it.designNo}
                              onChange={e => handleItemChange(idx, 'designNo', e.target.value)}
                              placeholder="e.g. PKD-1001"
                              style={{ width: '100%', padding: '0.3rem 0.4rem', fontSize: '0.8rem', fontWeight: 700 }}
                            />
                          </td>
                          <td style={{ padding: '0.35rem' }}>
                            <input
                              type="text"
                              value={it.particulars}
                              onChange={e => handleItemChange(idx, 'particulars', e.target.value)}
                              placeholder="Garment Particulars"
                              style={{ width: '100%', padding: '0.3rem 0.4rem', fontSize: '0.8rem' }}
                            />
                          </td>
                          <td style={{ padding: '0.35rem' }}>
                            <input
                              type="number"
                              value={it.pcs}
                              onChange={e => handleItemChange(idx, 'pcs', e.target.value)}
                              placeholder="0"
                              style={{ width: '100%', padding: '0.3rem 0.4rem', fontSize: '0.8rem', textAlign: 'right', fontWeight: 700, color: '#34d399' }}
                            />
                          </td>
                          <td style={{ padding: '0.35rem' }}>
                            <input
                              type="number"
                              step="0.01"
                              value={it.rate}
                              onChange={e => handleItemChange(idx, 'rate', e.target.value)}
                              placeholder="0.00"
                              style={{ width: '100%', padding: '0.3rem 0.4rem', fontSize: '0.8rem', textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: '0.35rem', textAlign: 'right', fontWeight: 800, color: '#60a5fa' }}>
                            ₹{(it.amount || 0).toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {formState.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItemRow(idx)}
                                style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}
                              >
                                <X size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Calculation Card */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.25)', padding: '0.85rem 1.25rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Pieces</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#34d399' }}>{calculatedTotalPcs} Pcs</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Grand Total Amount</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#60a5fa' }}>₹{calculatedTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Notes / Special Instructions</label>
                <textarea
                  value={formState.notes}
                  onChange={e => setFormState(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  placeholder="Any delivery instructions..."
                  style={{ width: '100%', padding: '0.45rem 0.7rem', fontSize: '0.85rem' }}
                />
              </div>

              {/* Actions Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ padding: '0.5rem 1.2rem' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '0.5rem 1.5rem' }}>
                  <Save size={14} style={{ marginRight: '0.25rem' }} /> {saving ? 'Saving...' : 'Save Stitching Challan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Modal Paper Layout (@media print) */}
      {printChallan && (
        <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '1rem' }}>
          <div style={{ background: '#fff', color: '#000', borderRadius: '8px', width: '100%', maxWidth: 850, padding: '1.5rem', maxHeight: '95vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }} className="no-print">
              <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1e3a8a' }}>Print View — {printChallan.challanNo}</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => window.print()} className="btn-primary" style={{ padding: '0.4rem 1rem' }}>
                  <Printer size={14} /> Print Now
                </button>
                <button onClick={() => setPrintChallan(null)} className="btn-secondary" style={{ padding: '0.4rem 1rem' }}>
                  Close
                </button>
              </div>
            </div>

            {/* Paper Layout */}
            <div style={{ border: '2px solid #1e40af', padding: '1.25rem', fontFamily: 'Arial, sans-serif' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e40af' }}>GARMENT DELIVERY CHALLAN</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e3a8a', letterSpacing: '1px' }}>ELITE EDITION</span>
                <span style={{ fontSize: '0.75rem', color: '#475569' }}>Mo. +91 99098 66667</span>
              </div>

              <div style={{ textAlign: 'center', margin: '0.75rem 0' }}>
                <img src="/Logo.png" alt="Elite Edition Logo" style={{ height: '50px', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} />
                <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px' }}>
                  Plot No-B/37, Siddheshwar Soc., Punagam Main Road, Surat | GSTIN: 24AANFE0044M1ZG
                </div>
              </div>

              <div style={{ borderTop: '2px solid #1e40af', borderBottom: '1px solid #cbd5e1', padding: '0.5rem 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem', background: '#f8fafc' }}>
                <div><strong>CHALLAN NO:</strong> {printChallan.challanNo}</div>
                <div style={{ textAlign: 'right' }}><strong>DATE:</strong> {formatDateDDMMYYYY(printChallan.date)}</div>
                <div><strong>PARTY NAME:</strong> {printChallan.partyName || '—'}</div>
                <div style={{ textAlign: 'right' }}><strong>TRANSPORT:</strong> {printChallan.deliveryBy || '—'}</div>
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ background: '#1e40af', color: '#fff' }}>
                    <th style={{ padding: '0.4rem', border: '1px solid #1e40af' }}>SR</th>
                    <th style={{ padding: '0.4rem', border: '1px solid #1e40af' }}>DESIGN NO</th>
                    <th style={{ padding: '0.4rem', border: '1px solid #1e40af' }}>PARTICULARS</th>
                    <th style={{ padding: '0.4rem', border: '1px solid #1e40af', textAlign: 'right' }}>PCS (QTY)</th>
                    <th style={{ padding: '0.4rem', border: '1px solid #1e40af', textAlign: 'right' }}>RATE (₹)</th>
                    <th style={{ padding: '0.4rem', border: '1px solid #1e40af', textAlign: 'right' }}>AMOUNT (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(printChallan.items || []).map((it, i) => (
                    <tr key={i}>
                      <td style={{ padding: '0.35rem', border: '1px solid #cbd5e1', textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ padding: '0.35rem', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{it.designNo || '—'}</td>
                      <td style={{ padding: '0.35rem', border: '1px solid #cbd5e1' }}>{it.particulars || 'Garment Goods'}</td>
                      <td style={{ padding: '0.35rem', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 'bold' }}>{it.pcs || 0}</td>
                      <td style={{ padding: '0.35rem', border: '1px solid #cbd5e1', textAlign: 'right' }}>{it.rate ? `₹${it.rate.toFixed(2)}` : '—'}</td>
                      <td style={{ padding: '0.35rem', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 'bold' }}>{it.amount ? `₹${it.amount.toFixed(2)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #1e40af', paddingTop: '0.5rem', marginTop: '0.5rem', fontSize: '0.85rem', fontWeight: 'bold' }}>
                <span>TOTAL PIECES: {printChallan.totalPcs || 0} Pcs</span>
                {printChallan.totalAmount > 0 && (
                  <span>TOTAL AMOUNT: ₹{(printChallan.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                )}
              </div>

              {printChallan.notes && (
                <div style={{ fontSize: '0.75rem', fontStyle: 'italic', marginTop: '0.5rem', color: '#475569' }}>
                  Notes: {printChallan.notes}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem', fontSize: '0.78rem', fontWeight: 'bold' }}>
                <div>PREPARED BY</div>
                <div>RECEIVER'S SIGNATURE</div>
                <div style={{ textAlign: 'right' }}>
                  <div>FOR ELITE EDITION</div>
                  <div style={{ marginTop: '1.8rem', fontWeight: 'normal' }}>(Authorized Signatory)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
