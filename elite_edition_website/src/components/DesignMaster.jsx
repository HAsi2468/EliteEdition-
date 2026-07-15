import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Search, Edit2, Check, X, RefreshCw, Layers, Save, Trash2, ArrowUpDown } from 'lucide-react';

export default function DesignMaster() {
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  
  // Inline editing row tracking
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Sorting
  const [sortBy, setSortBy] = useState('designName');
  const [sortOrder, setSortOrder] = useState('asc');

  useEffect(() => {
    fetchDesigns();
    const interval = setInterval(fetchDesigns, 30000);
    return () => clearInterval(interval);
  }, [search, sortBy, sortOrder]);

  const fetchDesigns = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getDesigns({
        search,
        sortBy,
        sortOrder,
        limit: 100 // fetch up to 100 designs for the master table
      });
      if (res && res.data) {
        setDesigns(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load master designs.');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (design) => {
    setEditingId(design._id);
    setEditForm({
      top100: design.top100 || 0,
      sleeve100: design.sleeve100 || 0,
      bottom100: design.bottom100 || 0,
      dupatta100: design.dupatta100 || 0,
      cut100: design.cut100 || 0,
      totalMtr100: design.totalMtr100 || 0,
      setCopy100: design.setCopy100 || 0,
    });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };

  const saveEdit = async (id) => {
    setError('');
    try {
      const updated = await api.updateDesign(id, editForm);
      setDesigns(prev => prev.map(d => d._id === id ? { ...d, ...updated } : d));
      setEditingId(null);
    } catch (err) {
      setError(err.message || 'Failed to save changes.');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
      
      {/* Top Banner */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#8b5cf6,#38bdf8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={22} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Design Master Details (100 Pic)</h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>
                Configure baseline parameters per 100 Pcs design-wise
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Design name, designer, fabric..."
              style={{ paddingLeft: 32, width: '100%', fontSize: '0.85rem' }}
            />
          </div>
          <button onClick={fetchDesigns} className="btn-icon" title="Refresh">
            <RefreshCw size={14} className={loading ? 'spin-loader' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', color: '#fca5a5', fontSize: '0.85rem' }}>{error}</div>
      )}

      {/* Master details table */}
      <div className="glass-panel" style={{ overflowX: 'auto', padding: 0 }}>
        {loading && designs.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <RefreshCw size={32} className="spin-loader" color="var(--primary)" />
            <p style={{ marginTop: '1rem' }}>Loading master details...</p>
          </div>
        ) : designs.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No master designs found. Go to "Design Catalogue" to add designs first.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'var(--bg-th)' }}>
                <th 
                  onClick={() => {
                    if (sortBy === 'designName') {
                      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('designName');
                      setSortOrder('asc');
                    }
                  }}
                  style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                >
                  Design Name {sortBy === 'designName' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
                <th style={thStyle}>Designer</th>
                <th style={thStyle}>Fabric</th>
                <th style={thStyle}>Top (100 Pcs)</th>
                <th style={thStyle}>Sleeve (100 Pcs)</th>
                <th style={thStyle}>Bottom (100 Pcs)</th>
                <th style={thStyle}>Dupatta (100 Pcs)</th>
                <th style={thStyle}>Cut (100 Pcs)</th>
                <th style={thStyle}>Total Mtr (100 Pcs)</th>
                <th style={thStyle}>Set Copy (100 Pcs)</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {designs.map(d => {
                const isEditing = editingId === d._id;
                return (
                  <tr key={d._id} style={{ borderBottom: '1px solid var(--border-light)', background: isEditing ? 'rgba(56, 189, 248, 0.03)' : 'transparent' }}>
                    
                    {/* Design Name */}
                    <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--primary)' }}>
                      {d.designName}
                    </td>

                    {/* Designer */}
                    <td style={tdStyle}>{d.designerName || '—'}</td>

                    {/* Fabric */}
                    <td style={tdStyle}>{d.fabricName || '—'}</td>

                    {/* Top */}
                    <td style={tdStyle}>
                      {isEditing ? (
                        <input
                          type="number"
                          name="top100"
                          value={editForm.top100}
                          onChange={handleEditChange}
                          style={inputStyle}
                        />
                      ) : (
                        `${d.top100 || 0} pcs`
                      )}
                    </td>

                    {/* Sleeve */}
                    <td style={tdStyle}>
                      {isEditing ? (
                        <input
                          type="number"
                          name="sleeve100"
                          value={editForm.sleeve100}
                          onChange={handleEditChange}
                          style={inputStyle}
                        />
                      ) : (
                        `${d.sleeve100 || 0} pcs`
                      )}
                    </td>

                    {/* Bottom */}
                    <td style={tdStyle}>
                      {isEditing ? (
                        <input
                          type="number"
                          name="bottom100"
                          value={editForm.bottom100}
                          onChange={handleEditChange}
                          style={inputStyle}
                        />
                      ) : (
                        `${d.bottom100 || 0} pcs`
                      )}
                    </td>

                    {/* Dupatta */}
                    <td style={tdStyle}>
                      {isEditing ? (
                        <input
                          type="number"
                          name="dupatta100"
                          value={editForm.dupatta100}
                          onChange={handleEditChange}
                          style={inputStyle}
                        />
                      ) : (
                        `${d.dupatta100 || 0} pcs`
                      )}
                    </td>

                    {/* Cut */}
                    <td style={tdStyle}>
                      {isEditing ? (
                        <input
                          type="number"
                          name="cut100"
                          value={editForm.cut100}
                          onChange={handleEditChange}
                          style={inputStyle}
                        />
                      ) : (
                        `${d.cut100 || 0} pcs`
                      )}
                    </td>

                    {/* Total Meter */}
                    <td style={tdStyle}>
                      {isEditing ? (
                        <input
                          type="number"
                          name="totalMtr100"
                          value={editForm.totalMtr100}
                          onChange={handleEditChange}
                          style={inputStyle}
                        />
                      ) : (
                        `${d.totalMtr100 || 0} mtr`
                      )}
                    </td>

                    {/* Set Copy */}
                    <td style={tdStyle}>
                      {isEditing ? (
                        <input
                          type="number"
                          name="setCopy100"
                          value={editForm.setCopy100}
                          onChange={handleEditChange}
                          style={inputStyle}
                        />
                      ) : (
                        `${d.setCopy100 || 0} pcs`
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => saveEdit(d._id)}
                            className="btn-primary"
                            style={{ padding: '0.3rem 0.5rem', background: '#10b981', borderColor: '#10b981' }}
                            title="Save Row"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="btn-secondary"
                            style={{ padding: '0.3rem 0.5rem' }}
                            title="Cancel"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(d)}
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                        >
                          <Edit2 size={11} style={{ marginRight: '0.2rem' }} /> Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  padding: '0.75rem 1rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  fontSize: '0.68rem',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap'
};

const tdStyle = {
  padding: '0.75rem 1rem',
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
  verticalAlign: 'middle'
};

const inputStyle = {
  width: '70px',
  padding: '0.25rem 0.4rem',
  fontSize: '0.8rem',
  background: 'var(--bg-input, rgba(0,0,0,0.25))',
  border: '1px solid var(--border-light, rgba(255,255,255,0.12))',
  borderRadius: '4px',
  color: 'var(--text-primary)',
  textAlign: 'center',
  outline: 'none'
};
