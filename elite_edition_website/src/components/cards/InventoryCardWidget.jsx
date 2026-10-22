import React from "react";

export function InventoryCardWidget({ data, onAction }) {
  if (!data) return null;

  return (
    <div
      className="my-2 p-4 bg-white border border-slate-200 rounded-xl shadow-sm max-w-md w-full"
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '14px 16px',
        margin: '8px 0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        maxWidth: '420px',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      <div
        className="flex items-center justify-between pb-2 border-b border-slate-100"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '8px',
          borderBottom: '1px solid #f1f5f9'
        }}
      >
        <div>
          <h4
            className="text-sm font-semibold text-slate-900 m-0"
            style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}
          >
            {data.itemCode}
          </h4>
          <p
            className="text-xs text-slate-500 m-0"
            style={{ margin: 0, fontSize: '0.74rem', color: '#64748b' }}
          >
            Warehouse Stock Status
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span
            className="text-lg font-bold text-slate-900"
            style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}
          >
            {Number(data.totalAvailable || 0).toLocaleString('en-IN')}
          </span>
          <span
            className="text-xs text-slate-500 ml-1"
            style={{ fontSize: '0.74rem', color: '#64748b', marginLeft: '4px' }}
          >
            {data.units || "meters"}
          </span>
        </div>
      </div>

      {data.breakdown && data.breakdown.length > 0 && (
        <div style={{ marginTop: '10px' }}>
          <p
            className="text-xs font-medium text-slate-500 mb-1.5"
            style={{ margin: '0 0 6px 0', fontSize: '0.74rem', fontWeight: 600, color: '#64748b' }}
          >
            Lot Allocation:
          </p>
          <div
            className="space-y-1.5 max-h-32 overflow-y-auto"
            style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '130px', overflowY: 'auto' }}
          >
            {data.breakdown.map((lot, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-100"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#f8fafc',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #f1f5f9',
                  fontSize: '0.78rem'
                }}
              >
                <span style={{ fontFamily: 'monospace', color: '#475569', fontWeight: 600 }}>
                  {lot.lotNumber || `Lot #${idx + 1}`}
                </span>
                <span style={{ color: '#64748b' }}>{lot.warehouse || 'Godown Bay'}</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{lot.qty} m</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className="mt-4 pt-3 border-t border-slate-100 flex gap-2"
        style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px' }}
      >
        <button
          onClick={() => onAction("reserve_stock", { itemCode: data.itemCode })}
          style={{
            flex: 1,
            padding: '7px 12px',
            background: '#059669',
            color: '#ffffff',
            fontSize: '0.78rem',
            fontWeight: 700,
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            transition: 'background 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          Reserve Stock
        </button>
      </div>
    </div>
  );
}

export default InventoryCardWidget;
