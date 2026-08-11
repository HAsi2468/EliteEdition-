import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Calculator, Layers, Scissors, DollarSign, Save } from 'lucide-react';
import { api } from '../services/api';

const SIZES = [
  { key: 'xs_34', label: 'XS-34' },
  { key: 's_36',  label: 'S-36' },
  { key: 'm_38',  label: 'M-38' },
  { key: 'l_40',  label: 'L-40' },
  { key: 'xl_42', label: 'XL-42' },
  { key: 'xl2_44',label: '2XL-44' },
  { key: 'xl3_46',label: '3XL-46' },
  { key: 'xl4_48',label: '4XL-48' },
  { key: 'xl5_50',label: '5XL-50' },
  { key: 'xl6_52',label: '6XL-52' }
];

const FABRIC_USES = ['Work', 'Asthar', 'Camisole', 'Lace', 'Digital Print', 'Piping', 'Buttons/Trims', 'Elastic/Zipper', 'Other'];
const PROCESS_TYPES = ['Stitching', 'Embroidery', 'Washing', 'Handwork', 'Finishing & Pressing', 'Packing', 'Other'];

export default function GarmentJobCardForm({ card, onSave, onClose }) {
  const [form, setForm] = useState({
    job_number: '',
    date: new Date().toISOString().split('T')[0],
    design_number: '',
    label: '',
    finishing: '',
    notes: '',
    status: 'Pending',
    size_ratios: {
      xs_34: 0, s_36: 0, m_38: 0, l_40: 0, xl_42: 0,
      xl2_44: 0, xl3_46: 0, xl4_48: 0, xl5_50: 0, xl6_52: 0
    },
    fabric_details: [
      { fabric_use: 'Work', details: '', rate_per_unit: 0, panna_width: '', consumption: 0, purchase_qty: 0, rate_per_pc: 0, amount: 0 }
    ],
    vendor_details: [
      { vendor_name: '', process_type: 'Stitching', rate: 0, quantity: 0, received_quantity: 0, amount: 0 }
    ],
    overhead_cost: 0
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (card) {
      setForm({
        ...card,
        date: card.date || new Date().toISOString().split('T')[0],
        size_ratios: { ...card.size_ratios },
        fabric_details: card.fabric_details && card.fabric_details.length > 0 ? card.fabric_details : [
          { fabric_use: 'Work', details: '', rate_per_unit: 0, panna_width: '', consumption: 0, purchase_qty: 0, rate_per_pc: 0, amount: 0 }
        ],
        vendor_details: card.vendor_details && card.vendor_details.length > 0 ? card.vendor_details : [
          { vendor_name: '', process_type: 'Stitching', rate: 0, quantity: 0, received_quantity: 0, amount: 0 }
        ]
      });
    } else {
      // Auto-fetch next job number
      const fetchNextNo = async () => {
        try {
          const res = await api.getNextGarmentJobNumber();
          if (res && res.nextJobNumber) {
            setForm(f => ({ ...f, job_number: res.nextJobNumber }));
          }
        } catch (e) {
          console.warn('Failed to fetch next garment job number', e);
        }
      };
      fetchNextNo();
    }
  }, [card]);

  // Reactive Calculations
  const totalPieces = SIZES.reduce((sum, s) => sum + (Number(form.size_ratios[s.key]) || 0), 0);

  const calculatedFabrics = form.fabric_details.map(f => {
    const rate = Number(f.rate_per_unit) || 0;
    const cons = Number(f.consumption) || 0;
    const pQty = Number(f.purchase_qty) || 0;
    const ratePc = rate * cons;
    const amt = pQty > 0 ? (pQty * rate) : (totalPieces * ratePc);
    return { ...f, rate_per_pc: Number(ratePc.toFixed(2)), amount: Number(amt.toFixed(2)) };
  });

  const totalFabricCost = calculatedFabrics.reduce((sum, f) => sum + f.amount, 0);

  const calculatedVendors = form.vendor_details.map(v => {
    const rate = Number(v.rate) || 0;
    const qty = Number(v.quantity) || totalPieces;
    const amt = rate * qty;
    return { ...v, quantity: qty, amount: Number(amt.toFixed(2)) };
  });

  const totalStitchingCost = calculatedVendors.reduce((sum, v) => sum + v.amount, 0);
  const overheadCost = Number(form.overhead_cost) || 0;
  const grandTotalCost = totalFabricCost + totalStitchingCost + overheadCost;
  const finalCostPerPc = totalPieces > 0 ? (grandTotalCost / totalPieces) : 0;

  // Size ratio input handler
  const handleSizeChange = (key, val) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setForm(f => ({
      ...f,
      size_ratios: { ...f.size_ratios, [key]: num }
    }));
  };

  // Fabric Table Handlers
  const handleFabricChange = (idx, field, val) => {
    setForm(f => {
      const updated = [...f.fabric_details];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...f, fabric_details: updated };
    });
  };

  const addFabricRow = () => {
    setForm(f => ({
      ...f,
      fabric_details: [
        ...f.fabric_details,
        { fabric_use: 'Asthar', details: '', rate_per_unit: 0, panna_width: '', consumption: 0, purchase_qty: 0, rate_per_pc: 0, amount: 0 }
      ]
    }));
  };

  const removeFabricRow = (idx) => {
    if (form.fabric_details.length <= 1) return;
    setForm(f => ({
      ...f,
      fabric_details: f.fabric_details.filter((_, i) => i !== idx)
    }));
  };

  // Vendor Table Handlers
  const handleVendorChange = (idx, field, val) => {
    setForm(f => {
      const updated = [...f.vendor_details];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...f, vendor_details: updated };
    });
  };

  const addVendorRow = () => {
    setForm(f => ({
      ...f,
      vendor_details: [
        ...f.vendor_details,
        { vendor_name: '', process_type: 'Embroidery', rate: 0, quantity: totalPieces, received_quantity: 0, amount: 0 }
      ]
    }));
  };

  const removeVendorRow = (idx) => {
    if (form.vendor_details.length <= 1) return;
    setForm(f => ({
      ...f,
      vendor_details: f.vendor_details.filter((_, i) => i !== idx)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.job_number.trim()) { setError('Job Number is required.'); return; }
    if (!form.design_number.trim()) { setError('Design Number is required.'); return; }
    
    setSaving(true); setError('');

    const payload = {
      ...form,
      total_pieces: totalPieces,
      fabric_details: calculatedFabrics,
      vendor_details: calculatedVendors,
      total_fabric_cost: Number(totalFabricCost.toFixed(2)),
      total_stitching_cost: Number(totalStitchingCost.toFixed(2)),
      overhead_cost: Number(overheadCost.toFixed(2)),
      grand_total_cost: Number(grandTotalCost.toFixed(2)),
      final_cost_per_pc: Number(finalCostPerPc.toFixed(2))
    };

    try {
      if (card?._id) {
        await api.updateGarmentJobCard(card._id, payload);
      } else {
        await api.createGarmentJobCard(payload);
      }
      onSave();
    } catch (err) {
      setError(err.message || 'Failed to save garment job card.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '1rem' }}>
      <div style={{
        background: 'var(--bg-modal, #111827)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: 1100,
        boxShadow: 'var(--shadow-lg)',
        maxHeight: '96vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(59,130,246,0.05))'
        }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Scissors size={22} color="var(--primary)" />
              {card ? `Edit Garment Job Card #${form.job_number}` : 'New Garment Job Card & Costing ERP'}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              Elite Stitching Department — Dynamic Size Ratios, Material Consumption & Vendor Cost Breakdown
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
              ⚠️ {error}
            </div>
          )}

          {/* 1. Header Specifications Section */}
          <div style={{ background: 'var(--bg-card, #1f2937)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Layers size={16} color="var(--primary)" /> 1. Header & Design Specifications
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Job Number *</label>
                <input
                  type="text"
                  required
                  value={form.job_number}
                  onChange={e => setForm({ ...form, job_number: e.target.value })}
                  style={inputStyle}
                  placeholder="e.g. GJC-1001"
                />
              </div>
              <div>
                <label style={labelStyle}>Date *</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Design Number *</label>
                <input
                  type="text"
                  required
                  value={form.design_number}
                  onChange={e => setForm({ ...form, design_number: e.target.value })}
                  style={inputStyle}
                  placeholder="e.g. ED-904"
                />
              </div>
              <div>
                <label style={labelStyle}>Label / Brand</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={e => setForm({ ...form, label: e.target.value })}
                  style={inputStyle}
                  placeholder="e.g. Elite Premium"
                />
              </div>
              <div>
                <label style={labelStyle}>Finishing Process</label>
                <input
                  type="text"
                  value={form.finishing}
                  onChange={e => setForm({ ...form, finishing: e.target.value })}
                  style={inputStyle}
                  placeholder="e.g. Soft Wash & Steam Press"
                />
              </div>
              <div>
                <label style={labelStyle}>Production Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  style={inputStyle}
                >
                  <option value="Pending">Pending</option>
                  <option value="In Production">In Production</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>
          </div>

          {/* 2. Size Ratio Breakdown Grid */}
          <div style={{ background: 'var(--bg-card, #1f2937)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Calculator size={16} color="var(--primary)" /> 2. Size Ratio Breakdown & Total Pcs
              </h3>
              <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 800, color: '#34d399' }}>
                Total Pieces: {totalPieces} Pcs
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '0.75rem' }}>
              {SIZES.map(s => (
                <div key={s.key} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                    {s.label}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.size_ratios[s.key] || ''}
                    onChange={e => handleSizeChange(s.key, e.target.value)}
                    style={{ ...inputStyle, textAlign: 'center', fontWeight: 700, padding: '0.35rem 0.25rem' }}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 3. Dynamic Fabric & Material Consumption Table */}
          <div style={{ background: 'var(--bg-card, #1f2937)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                🧵 3. Dynamic Fabric & Material Usage
              </h3>
              <button
                type="button"
                onClick={addFabricRow}
                style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <Plus size={14} /> Add Material Row
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.05)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={thStyle}>Use / Category</th>
                    <th style={thStyle}>Details / Quality</th>
                    <th style={thStyle}>Rate / Unit (₹)</th>
                    <th style={thStyle}>Panna / Width</th>
                    <th style={thStyle}>Consumption (Mtr/Pc)</th>
                    <th style={thStyle}>Purchase Qty (Mtr)</th>
                    <th style={thStyle}>Rate/Pc (₹)</th>
                    <th style={thStyle}>Amount (₹)</th>
                    <th style={{ ...thStyle, width: 40 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {calculatedFabrics.map((f, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={tdStyle}>
                        <select
                          value={f.fabric_use}
                          onChange={e => handleFabricChange(idx, 'fabric_use', e.target.value)}
                          style={{ ...inputStyle, padding: '0.3rem' }}
                        >
                          {FABRIC_USES.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="text"
                          value={f.details}
                          onChange={e => handleFabricChange(idx, 'details', e.target.value)}
                          style={{ ...inputStyle, padding: '0.3rem' }}
                          placeholder="e.g. Georgette 60g"
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          step="0.01"
                          value={f.rate_per_unit || ''}
                          onChange={e => handleFabricChange(idx, 'rate_per_unit', parseFloat(e.target.value) || 0)}
                          style={{ ...inputStyle, padding: '0.3rem' }}
                          placeholder="0"
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="text"
                          value={f.panna_width}
                          onChange={e => handleFabricChange(idx, 'panna_width', e.target.value)}
                          style={{ ...inputStyle, padding: '0.3rem' }}
                          placeholder='e.g. 58"'
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          step="0.01"
                          value={f.consumption || ''}
                          onChange={e => handleFabricChange(idx, 'consumption', parseFloat(e.target.value) || 0)}
                          style={{ ...inputStyle, padding: '0.3rem' }}
                          placeholder="0"
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          step="0.01"
                          value={f.purchase_qty || ''}
                          onChange={e => handleFabricChange(idx, 'purchase_qty', parseFloat(e.target.value) || 0)}
                          style={{ ...inputStyle, padding: '0.3rem' }}
                          placeholder="0"
                        />
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text-primary)' }}>
                        ₹{f.rate_per_pc.toFixed(2)}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 800, color: '#34d399' }}>
                        ₹{f.amount.toFixed(2)}
                      </td>
                      <td style={tdStyle}>
                        <button
                          type="button"
                          onClick={() => removeFabricRow(idx)}
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0.2rem' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ textAlign: 'right', marginTop: '0.75rem', fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Subtotal Fabric Cost: <span style={{ color: '#34d399' }}>₹{totalFabricCost.toFixed(2)}</span>
            </div>
          </div>

          {/* 4. Dynamic Vendor & Processing Table */}
          <div style={{ background: 'var(--bg-card, #1f2937)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                🏬 4. Dynamic Vendor & Processing Operations
              </h3>
              <button
                type="button"
                onClick={addVendorRow}
                style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#c084fc', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <Plus size={14} /> Add Vendor Process
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.05)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={thStyle}>Vendor Name</th>
                    <th style={thStyle}>Process Type</th>
                    <th style={thStyle}>Rate / Pc (₹)</th>
                    <th style={thStyle}>Quantity (Pcs)</th>
                    <th style={thStyle}>Received Qty</th>
                    <th style={thStyle}>Amount (₹)</th>
                    <th style={{ ...thStyle, width: 40 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {calculatedVendors.map((v, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={tdStyle}>
                        <input
                          type="text"
                          value={v.vendor_name}
                          onChange={e => handleVendorChange(idx, 'vendor_name', e.target.value)}
                          style={{ ...inputStyle, padding: '0.3rem' }}
                          placeholder="Vendor / Jobworker"
                        />
                      </td>
                      <td style={tdStyle}>
                        <select
                          value={v.process_type}
                          onChange={e => handleVendorChange(idx, 'process_type', e.target.value)}
                          style={{ ...inputStyle, padding: '0.3rem' }}
                        >
                          {PROCESS_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          step="0.01"
                          value={v.rate || ''}
                          onChange={e => handleVendorChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                          style={{ ...inputStyle, padding: '0.3rem' }}
                          placeholder="0"
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          value={v.quantity || ''}
                          onChange={e => handleVendorChange(idx, 'quantity', parseInt(e.target.value, 10) || 0)}
                          style={{ ...inputStyle, padding: '0.3rem' }}
                          placeholder={String(totalPieces)}
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          value={v.received_quantity || ''}
                          onChange={e => handleVendorChange(idx, 'received_quantity', parseInt(e.target.value, 10) || 0)}
                          style={{ ...inputStyle, padding: '0.3rem' }}
                          placeholder="0"
                        />
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 800, color: '#c084fc' }}>
                        ₹{v.amount.toFixed(2)}
                      </td>
                      <td style={tdStyle}>
                        <button
                          type="button"
                          onClick={() => removeVendorRow(idx)}
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0.2rem' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ textAlign: 'right', marginTop: '0.75rem', fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Subtotal Processing Cost: <span style={{ color: '#c084fc' }}>₹{totalStitchingCost.toFixed(2)}</span>
            </div>
          </div>

          {/* 5. Real-time Costing Summary Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(59,130,246,0.1))',
            padding: '1.25rem',
            borderRadius: '12px',
            border: '1px solid rgba(16,185,129,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarSign size={18} color="#34d399" /> 5. Costing Summary & Final Per Unit Calculation
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
              <div style={costCardStyle}>
                <span style={costLabelStyle}>Total Fabric Cost</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#34d399' }}>₹{totalFabricCost.toFixed(2)}</span>
              </div>
              <div style={costCardStyle}>
                <span style={costLabelStyle}>Total Processing Cost</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#c084fc' }}>₹{totalStitchingCost.toFixed(2)}</span>
              </div>
              <div style={{ ...costCardStyle, background: 'rgba(255,255,255,0.05)' }}>
                <span style={costLabelStyle}>Overhead Amount (₹)</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.overhead_cost || ''}
                  onChange={e => setForm({ ...form, overhead_cost: parseFloat(e.target.value) || 0 })}
                  style={{ ...inputStyle, textAlign: 'center', fontWeight: 700, marginTop: '0.2rem' }}
                  placeholder="0.00"
                />
              </div>
              <div style={{ ...costCardStyle, border: '1px solid rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.15)' }}>
                <span style={costLabelStyle}>Grand Total Cost</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#60a5fa' }}>₹{grandTotalCost.toFixed(2)}</span>
              </div>
              <div style={{ ...costCardStyle, border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.15)' }}>
                <span style={costLabelStyle}>Final Cost / Pc</span>
                <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#fbbf24' }}>₹{finalCostPerPc.toFixed(2)}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>({grandTotalCost.toFixed(0)} / {totalPieces} Pcs)</span>
              </div>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Notes / Special Instructions</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              style={{ ...inputStyle, width: '100%', resize: 'vertical' }}
              placeholder="e.g. Include extra 2% margin for trimming..."
            />
          </div>

          {/* Modal Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'var(--bg-card, #374151)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ background: 'var(--primary, #10b981)', border: 'none', color: '#fff', padding: '0.6rem 1.5rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Save size={18} />
              {saving ? 'Saving...' : card ? 'Update Garment Job Card' : 'Save Garment Job Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  marginBottom: '0.35rem',
  display: 'block',
  textTransform: 'uppercase',
  letterSpacing: '0.03em'
};

const inputStyle = {
  width: '100%',
  background: 'var(--bg-main, #111827)',
  border: '1px solid var(--border-light, #374151)',
  borderRadius: '6px',
  color: 'var(--text-primary, #f9fafb)',
  padding: '0.45rem 0.65rem',
  fontSize: '0.85rem',
  outline: 'none'
};

const thStyle = {
  padding: '0.5rem 0.65rem',
  fontWeight: 700,
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--border-light)'
};

const tdStyle = {
  padding: '0.4rem 0.5rem',
  verticalAlign: 'middle'
};

const costCardStyle = {
  background: 'rgba(0,0,0,0.2)',
  padding: '0.75rem',
  borderRadius: '8px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--border-light)'
};

const costLabelStyle = {
  fontSize: '0.7rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  marginBottom: '0.25rem'
};
