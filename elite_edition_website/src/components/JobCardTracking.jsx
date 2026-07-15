import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Search, RefreshCw, Save, Check, Clipboard, ChevronLeft, ChevronRight } from 'lucide-react';

export default function JobCardTracking({ onPreview }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  
  // Date range filters
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Sorting
  const [sortBy, setSortBy] = useState('jobNo');
  const [sortOrder, setSortOrder] = useState('desc');

  // Row edit state: { [cardId]: { billNo, printStatus, printDate, printMtr, fusingStatus, fusingDate, fusingMtr, deliveryStatus, deliveryDate } }
  const [modifiedCards, setModifiedCards] = useState({});
  const [savingIds, setSavingIds] = useState(new Set());

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getJobCards({
        search,
        dateStart,
        dateEnd,
        page,
        limit: 25,
        sortBy,
        sortOrder
      });
      if (res && res.data) {
        setCards(res.data);
        setPages(res.pages || 1);
        setTotal(res.total || 0);
      }
    } catch (err) {
      setError(err.message || 'Failed to load tracking data.');
    } finally {
      setLoading(false);
    }
  }, [search, dateStart, dateEnd, page, sortBy, sortOrder]);

  useEffect(() => {
    fetchCards();
    const interval = setInterval(fetchCards, 30000);
    return () => clearInterval(interval);
  }, [fetchCards]);

  // Handle local cell modifications
  const handleCellChange = (cardId, field, value) => {
    // Find the original card to base modifications on if not already modified
    const originalCard = cards.find(c => c._id === cardId);
    if (!originalCard) return;

    setModifiedCards(prev => {
      const currentMod = prev[cardId] || {
        billNo: originalCard.billNo || '',
        printStatus: originalCard.printStatus || 'Printing Pending',
        printDate: originalCard.printDate || '',
        printMtr: originalCard.printMtr || 0,
        fusingStatus: originalCard.fusingStatus || 'Fusing Pending',
        fusingDate: originalCard.fusingDate || '',
        fusingMtr: originalCard.fusingMtr || 0,
        deliveryStatus: originalCard.deliveryStatus || 'Delivery Pending',
        deliveryDate: originalCard.deliveryDate || '',
      };

      const updated = { ...currentMod, [field]: value };

      // Auto-date fill transitions
      const todayStr = new Date().toISOString().split('T')[0];

      if (field === 'printStatus' && value === 'Printing Done' && !updated.printDate) {
        updated.printDate = todayStr;
      }
      if (field === 'fusingStatus' && value === 'Fusing Done' && !updated.fusingDate) {
        updated.fusingDate = todayStr;
      }
      if (field === 'deliveryStatus' && value === 'Delivery Done' && !updated.deliveryDate) {
        updated.deliveryDate = todayStr;
      }

      return { ...prev, [cardId]: updated };
    });
  };

  // Auto save row to backend
  const handleAutoSave = async (cardId, field, value) => {
    // Find the original card to base modifications on if not already modified
    const originalCard = cards.find(c => c._id === cardId);
    if (!originalCard) return;

    const currentMod = modifiedCards[cardId] || {
      billNo: originalCard.billNo || '',
      printStatus: originalCard.printStatus || 'Printing Pending',
      printDate: originalCard.printDate || '',
      printMtr: originalCard.printMtr || 0,
      fusingStatus: originalCard.fusingStatus || 'Fusing Pending',
      fusingDate: originalCard.fusingDate || '',
      fusingMtr: originalCard.fusingMtr || 0,
      deliveryStatus: originalCard.deliveryStatus || 'Delivery Pending',
      deliveryDate: originalCard.deliveryDate || '',
    };

    const updated = { ...currentMod, [field]: value };

    // Auto-date fill transitions
    const todayStr = new Date().toISOString().split('T')[0];
    if (field === 'printStatus' && value === 'Printing Done' && !updated.printDate) {
      updated.printDate = todayStr;
    }
    if (field === 'fusingStatus' && value === 'Fusing Done' && !updated.fusingDate) {
      updated.fusingDate = todayStr;
    }
    if (field === 'deliveryStatus' && value === 'Delivery Done' && !updated.deliveryDate) {
      updated.deliveryDate = todayStr;
    }

    setSavingIds(prev => {
      const next = new Set(prev);
      next.add(cardId);
      return next;
    });

    try {
      const res = await api.updateJobCard(cardId, updated);
      
      // Update local cards list
      setCards(prev => prev.map(c => c._id === cardId ? { ...c, ...res } : c));
      
      // Remove from modified list
      setModifiedCards(prev => {
        const next = { ...prev };
        delete next[cardId];
        return next;
      });
    } catch (err) {
      alert(err.message || 'Failed to save tracking changes.');
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    }
  };

  // Get value for a cell, merging backend value with any local modifications
  const getValue = (card, field) => {
    if (modifiedCards[card._id] && modifiedCards[card._id][field] !== undefined) {
      return modifiedCards[card._id][field];
    }
    return card[field] ?? '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
      
      {/* Top Banner */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#10b981,#3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clipboard size={22} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Tracking Job Card</h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>
                Track print, fusing, delivery statuses, dates, and meters — {total} total cards
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search Job No, Party, Bill No..."
              style={{ paddingLeft: 32, width: '100%', fontSize: '0.85rem' }}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: '0 1 auto' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>From:</span>
            <input
              type="date"
              value={dateStart}
              onChange={e => { setDateStart(e.target.value); setPage(1); }}
              style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem', width: '135px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: '0 1 auto' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>To:</span>
            <input
              type="date"
              value={dateEnd}
              onChange={e => { setDateEnd(e.target.value); setPage(1); }}
              style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem', width: '135px' }}
            />
          </div>

          <button onClick={fetchCards} className="btn-icon" title="Refresh">
            <RefreshCw size={14} className={loading ? 'spin-loader' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', color: '#fca5a5', fontSize: '0.85rem' }}>{error}</div>
      )}

      {/* Tracker Grid */}
      <div className="glass-panel" style={{ overflowX: 'auto', padding: 0 }}>
        {loading && cards.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <RefreshCw size={32} className="spin-loader" color="var(--primary)" />
            <p style={{ marginTop: '1rem' }}>Loading tracking list...</p>
          </div>
        ) : cards.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No Job Cards found in this date range.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'var(--bg-th)' }}>
                <th 
                  onClick={() => {
                    if (sortBy === 'jobNo') {
                      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('jobNo');
                      setSortOrder('desc');
                    }
                    setPage(1);
                  }}
                  style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                >
                  Job No {sortBy === 'jobNo' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
                <th 
                  onClick={() => {
                    if (sortBy === 'party') {
                      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('party');
                      setSortOrder('asc');
                    }
                    setPage(1);
                  }}
                  style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                >
                  Party {sortBy === 'party' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
                <th style={thStyle}>Bill No</th>
                <th style={thStyle}>Print Status</th>
                <th 
                  onClick={() => {
                    if (sortBy === 'printDate') {
                      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('printDate');
                      setSortOrder('desc');
                    }
                    setPage(1);
                  }}
                  style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                >
                  Print Date {sortBy === 'printDate' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
                <th style={thStyle}>Print Mtr</th>
                <th style={thStyle}>Fusing Status</th>
                <th 
                  onClick={() => {
                    if (sortBy === 'fusingDate') {
                      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('fusingDate');
                      setSortOrder('desc');
                    }
                    setPage(1);
                  }}
                  style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                >
                  Fusing Date {sortBy === 'fusingDate' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
                <th style={thStyle}>Fusing Mtr</th>
                <th style={thStyle}>Delivery Status</th>
                <th 
                  onClick={() => {
                    if (sortBy === 'deliveryDate') {
                      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('deliveryDate');
                      setSortOrder('desc');
                    }
                    setPage(1);
                  }}
                  style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                >
                  Delivery Date {sortBy === 'deliveryDate' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {cards.map(c => {
                const isModified = !!modifiedCards[c._id];
                const isSaving = savingIds.has(c._id);
                return (
                  <tr key={c._id} style={{ borderBottom: '1px solid var(--border-light)', background: isModified ? 'rgba(56, 189, 248, 0.03)' : 'transparent' }}>
                    {/* Job Card No (Clickable for print preview) */}
                    <td style={tdStyle}>
                      <button 
                        onClick={() => onPreview(c)}
                        style={{
                          background: 'none', border: 'none', color: 'var(--primary)',
                          fontWeight: 800, cursor: 'pointer', padding: 0, textDecoration: 'underline',
                          fontSize: '0.8rem', outline: 'none'
                        }}
                      >
                        {c.jobNo}
                      </button>
                    </td>

                    {/* Party */}
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      {c.party || '—'}
                    </td>

                    {/* Bill No */}
                    <td style={tdStyle}>
                      <input
                        type="text"
                        value={getValue(c, 'billNo')}
                        onChange={e => handleCellChange(c._id, 'billNo', e.target.value)}
                        onBlur={e => handleAutoSave(c._id, 'billNo', e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                        placeholder="Bill No"
                        style={{ ...inputStyle, width: '90px' }}
                      />
                    </td>

                    {/* Print Status */}
                    <td style={tdStyle}>
                      <select
                        value={getValue(c, 'printStatus') || 'Printing Pending'}
                        onChange={e => handleAutoSave(c._id, 'printStatus', e.target.value)}
                        style={{
                          ...selectStyle,
                          color: getValue(c, 'printStatus') === 'Printing Done' ? '#34d399' : '#fbbf24',
                          borderColor: getValue(c, 'printStatus') === 'Printing Done' ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)',
                          background: getValue(c, 'printStatus') === 'Printing Done' ? 'rgba(52,211,153,0.06)' : 'rgba(245,158,11,0.06)'
                        }}
                      >
                        <option value="Printing Pending" style={{ color: '#000' }}>Printing Pending</option>
                        <option value="Printing Done" style={{ color: '#000' }}>Printing Done</option>
                      </select>
                    </td>

                    {/* Print Date */}
                    <td style={tdStyle}>
                      <input
                        type="date"
                        value={getValue(c, 'printDate')}
                        onChange={e => handleAutoSave(c._id, 'printDate', e.target.value)}
                        style={{ ...inputStyle, width: '125px' }}
                      />
                    </td>

                    {/* Print Mtr */}
                    <td style={tdStyle}>
                      <input
                        type="number"
                        value={getValue(c, 'printMtr')}
                        onChange={e => handleCellChange(c._id, 'printMtr', parseFloat(e.target.value) || 0)}
                        onBlur={e => handleAutoSave(c._id, 'printMtr', parseFloat(e.target.value) || 0)}
                        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                        style={{ ...inputStyle, width: '70px' }}
                      />
                    </td>

                    {/* Fusing Status */}
                    <td style={tdStyle}>
                      <select
                        value={getValue(c, 'fusingStatus') || 'Fusing Pending'}
                        onChange={e => handleAutoSave(c._id, 'fusingStatus', e.target.value)}
                        style={{
                          ...selectStyle,
                          color: getValue(c, 'fusingStatus') === 'Fusing Done' ? '#34d399' : '#fbbf24',
                          borderColor: getValue(c, 'fusingStatus') === 'Fusing Done' ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)',
                          background: getValue(c, 'fusingStatus') === 'Fusing Done' ? 'rgba(52,211,153,0.06)' : 'rgba(245,158,11,0.06)'
                        }}
                      >
                        <option value="Fusing Pending" style={{ color: '#000' }}>Fusing Pending</option>
                        <option value="Fusing Done" style={{ color: '#000' }}>Fusing Done</option>
                      </select>
                    </td>

                    {/* Fusing Date */}
                    <td style={tdStyle}>
                      <input
                        type="date"
                        value={getValue(c, 'fusingDate')}
                        onChange={e => handleAutoSave(c._id, 'fusingDate', e.target.value)}
                        style={{ ...inputStyle, width: '125px' }}
                      />
                    </td>

                    {/* Fusing Mtr */}
                    <td style={tdStyle}>
                      <input
                        type="number"
                        value={getValue(c, 'fusingMtr')}
                        onChange={e => handleCellChange(c._id, 'fusingMtr', parseFloat(e.target.value) || 0)}
                        onBlur={e => handleAutoSave(c._id, 'fusingMtr', parseFloat(e.target.value) || 0)}
                        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                        style={{ ...inputStyle, width: '70px' }}
                      />
                    </td>

                    {/* Delivery Status */}
                    <td style={tdStyle}>
                      <select
                        value={getValue(c, 'deliveryStatus') || 'Delivery Pending'}
                        onChange={e => handleAutoSave(c._id, 'deliveryStatus', e.target.value)}
                        style={{
                          ...selectStyle,
                          color: getValue(c, 'deliveryStatus') === 'Delivery Done' ? '#34d399' : '#fbbf24',
                          borderColor: getValue(c, 'deliveryStatus') === 'Delivery Done' ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)',
                          background: getValue(c, 'deliveryStatus') === 'Delivery Done' ? 'rgba(52,211,153,0.06)' : 'rgba(245,158,11,0.06)'
                        }}
                      >
                        <option value="Delivery Pending" style={{ color: '#000' }}>Delivery Pending</option>
                        <option value="Delivery Done" style={{ color: '#000' }}>Delivery Done</option>
                      </select>
                    </td>

                    {/* Delivery Date */}
                    <td style={tdStyle}>
                      <input
                        type="date"
                        value={getValue(c, 'deliveryDate')}
                        onChange={e => handleAutoSave(c._id, 'deliveryDate', e.target.value)}
                        style={{ ...inputStyle, width: '125px' }}
                      />
                    </td>

                    {/* Sync Status Indicator */}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {isSaving ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--primary)', justifyContent: 'center', width: '100%' }}>
                          <RefreshCw size={14} className="spin-loader" />
                          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Saving</span>
                        </div>
                      ) : isModified ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#fbbf24', justifyContent: 'center', width: '100%' }}>
                          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#fbbf24' }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Editing</span>
                        </div>
                      ) : (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#34d399', justifyContent: 'center', width: '100%' }}>
                          <Check size={14} />
                          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Saved</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button 
            onClick={() => setPage(p => Math.max(1, p - 1))} 
            disabled={page === 1} 
            className="btn-icon"
            style={{ opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
          >
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Page {page} of {pages}</span>
          <button 
            onClick={() => setPage(p => Math.min(pages, p + 1))} 
            disabled={page === pages} 
            className="btn-icon"
            style={{ opacity: page === pages ? 0.4 : 1, cursor: page === pages ? 'not-allowed' : 'pointer' }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: '0.75rem 0.8rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  fontSize: '0.68rem',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '0.6rem 0.8rem',
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
};

const inputStyle = {
  padding: '0.3rem 0.4rem',
  fontSize: '0.82rem',
  background: 'var(--bg-input, rgba(0,0,0,0.25))',
  border: '1px solid var(--border-light, rgba(255,255,255,0.12))',
  borderRadius: '4px',
  color: 'var(--text-primary)',
  outline: 'none',
  textAlign: 'center',
};

const selectStyle = {
  padding: '0.3rem 0.4rem',
  fontSize: '0.8rem',
  border: '1px solid',
  borderRadius: '4px',
  fontWeight: 700,
  cursor: 'pointer',
  outline: 'none',
};
