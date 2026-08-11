import React from 'react';
import { Printer, X } from 'lucide-react';

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

export default function GarmentJobCardPrintView({ card, onClose }) {
  if (!card) return null;

  const handlePrint = () => {
    window.print();
  };

  const sr = card.size_ratios || {};
  const totalPcs = card.total_pieces || 0;

  return (
    <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '1rem', overflowY: 'auto' }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-garment-card, #printable-garment-card * { visibility: visible; }
          #printable-garment-card {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: #fff !important;
            color: #000 !important;
            padding: 15px !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print { display: none !important; }
          table { page-break-inside: avoid; }
        }
      `}</style>

      <div style={{
        background: 'var(--bg-modal, #111827)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: 900,
        boxShadow: 'var(--shadow-lg)',
        margin: '0 auto 2rem auto',
        overflow: 'hidden'
      }}>
        {/* Action Header */}
        <div className="no-print" style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-card, #1f2937)'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Garment Job Card Print Preview
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handlePrint}
              style={{
                background: 'var(--primary, #10b981)',
                border: 'none',
                color: '#fff',
                padding: '0.5rem 1.25rem',
                borderRadius: '6px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <Printer size={16} /> Print / Save PDF
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Card Area */}
        <div id="printable-garment-card" style={{ padding: '2rem', background: '#fff', color: '#111827', fontFamily: 'Inter, sans-serif' }}>
          {/* Company Title Header */}
          <div style={{ borderBottom: '3px double #111827', paddingBottom: '0.75rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#111827' }}>
                ELITE STITCHING
              </h1>
              <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.8rem', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>
                GARMENT MANUFACTURING JOB CARD & PRODUCTION SHEET
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#059669' }}>
                {card.job_number}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Date: {card.date || '—'}</div>
            </div>
          </div>

          {/* Key Info Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', border: '1px solid #d1d5db', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', background: '#f9fafb' }}>
            <div>
              <span style={pLabel}>Design No:</span>
              <div style={pValue}>{card.design_number || '—'}</div>
            </div>
            <div>
              <span style={pLabel}>Label / Brand:</span>
              <div style={pValue}>{card.label || '—'}</div>
            </div>
            <div>
              <span style={pLabel}>Finishing Process:</span>
              <div style={pValue}>{card.finishing || '—'}</div>
            </div>
            <div>
              <span style={pLabel}>Status:</span>
              <div style={{ ...pValue, color: card.status === 'Completed' ? '#059669' : '#d97706' }}>
                {card.status}
              </div>
            </div>
          </div>

          {/* Size Breakdown Table */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h4 style={pSectionHeader}>SIZE BREAKDOWN & TOTAL PIECES</h4>
            <table style={pTable}>
              <thead>
                <tr style={pTrHead}>
                  {SIZES.map(s => <th key={s.key} style={pTh}>{s.label}</th>)}
                  <th style={{ ...pTh, background: '#111827', color: '#fff' }}>TOTAL PCS</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {SIZES.map(s => (
                    <td key={s.key} style={{ ...pTd, textAlign: 'center', fontWeight: 700 }}>
                      {sr[s.key] || 0}
                    </td>
                  ))}
                  <td style={{ ...pTd, textAlign: 'center', fontWeight: 900, fontSize: '1.05rem', background: '#ecfdf5', color: '#047857' }}>
                    {totalPcs} Pcs
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Fabric & Material Usage */}
          {card.fabric_details && card.fabric_details.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={pSectionHeader}>FABRIC & MATERIAL CONSUMPTION</h4>
              <table style={pTable}>
                <thead>
                  <tr style={pTrHead}>
                    <th style={pTh}>Use</th>
                    <th style={pTh}>Details</th>
                    <th style={pTh}>Rate/Mtr (₹)</th>
                    <th style={pTh}>Panna</th>
                    <th style={pTh}>Cons. (Mtr/Pc)</th>
                    <th style={pTh}>Purch. Qty</th>
                    <th style={pTh}>Rate/Pc (₹)</th>
                    <th style={pTh}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {card.fabric_details.map((f, i) => (
                    <tr key={i}>
                      <td style={pTd}>{f.fabric_use || '—'}</td>
                      <td style={pTd}>{f.details || '—'}</td>
                      <td style={pTd}>₹{f.rate_per_unit || 0}</td>
                      <td style={pTd}>{f.panna_width || '—'}</td>
                      <td style={pTd}>{f.consumption || 0}</td>
                      <td style={pTd}>{f.purchase_qty || 0}</td>
                      <td style={pTd}>₹{(f.rate_per_pc || 0).toFixed(2)}</td>
                      <td style={{ ...pTd, fontWeight: 700 }}>₹{(f.amount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={7} style={{ ...pTd, textAlign: 'right', fontWeight: 800 }}>Subtotal Fabric Cost:</td>
                    <td style={{ ...pTd, fontWeight: 900, color: '#047857' }}>₹{(card.total_fabric_cost || 0).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Vendor Processing Details */}
          {card.vendor_details && card.vendor_details.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={pSectionHeader}>VENDOR & PROCESSING OPERATIONS</h4>
              <table style={pTable}>
                <thead>
                  <tr style={pTrHead}>
                    <th style={pTh}>Vendor Name</th>
                    <th style={pTh}>Process Type</th>
                    <th style={pTh}>Rate/Pc (₹)</th>
                    <th style={pTh}>Quantity (Pcs)</th>
                    <th style={pTh}>Recd. Qty</th>
                    <th style={pTh}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {card.vendor_details.map((v, i) => (
                    <tr key={i}>
                      <td style={pTd}>{v.vendor_name || '—'}</td>
                      <td style={pTd}>{v.process_type || '—'}</td>
                      <td style={pTd}>₹{v.rate || 0}</td>
                      <td style={pTd}>{v.quantity || 0}</td>
                      <td style={pTd}>{v.received_quantity || 0}</td>
                      <td style={{ ...pTd, fontWeight: 700 }}>₹{(v.amount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={5} style={{ ...pTd, textAlign: 'right', fontWeight: 800 }}>Subtotal Processing Cost:</td>
                    <td style={{ ...pTd, fontWeight: 900, color: '#6d28d9' }}>₹{(card.total_stitching_cost || 0).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Costing Summary & Notes */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ border: '1px solid #d1d5db', padding: '0.75rem', borderRadius: '6px', background: '#f9fafb' }}>
              <span style={pLabel}>Special Notes / Instructions:</span>
              <div style={{ fontSize: '0.82rem', marginTop: '0.3rem', whiteSpace: 'pre-wrap', color: '#374151' }}>
                {card.notes || 'No extra notes recorded.'}
              </div>
            </div>

            <div style={{ border: '2px solid #059669', padding: '0.75rem', borderRadius: '6px', background: '#ecfdf5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.2rem 0' }}>
                <span>Fabric Subtotal:</span> <strong>₹{(card.total_fabric_cost || 0).toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.2rem 0' }}>
                <span>Processing Subtotal:</span> <strong>₹{(card.total_stitching_cost || 0).toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.2rem 0' }}>
                <span>Overhead Amount:</span> <strong>₹{(card.overhead_cost || 0).toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 900, borderTop: '1px solid #059669', paddingTop: '0.4rem', marginTop: '0.4rem', color: '#047857' }}>
                <span>GRAND TOTAL:</span> <span>₹{(card.grand_total_cost || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 900, background: '#059669', color: '#fff', padding: '0.35rem 0.5rem', borderRadius: '4px', marginTop: '0.5rem' }}>
                <span>FINAL COST / PC:</span> <span>₹{(card.final_cost_per_pc || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem', paddingTop: '1rem', borderTop: '1px dashed #9ca3af', fontSize: '0.8rem', fontWeight: 700, color: '#4b5563' }}>
            <div>Cutting Master Sign</div>
            <div>Stitching Supervisor Sign</div>
            <div>Quality Checker Sign</div>
            <div>Authorized Manager</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const pLabel = { fontSize: '0.68rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', display: 'block' };
const pValue = { fontSize: '0.88rem', fontWeight: 800, color: '#111827', marginTop: '0.1rem' };
const pSectionHeader = { fontSize: '0.8rem', fontWeight: 900, color: '#111827', margin: '0 0 0.4rem 0', textTransform: 'uppercase', letterSpacing: '0.04em' };
const pTable = { width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' };
const pTrHead = { background: '#f3f4f6', textAlign: 'left' };
const pTh = { padding: '0.4rem 0.5rem', border: '1px solid #d1d5db', fontWeight: 800, fontSize: '0.7rem' };
const pTd = { padding: '0.35rem 0.5rem', border: '1px solid #d1d5db' };
