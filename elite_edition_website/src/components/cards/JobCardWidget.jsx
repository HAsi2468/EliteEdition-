import React, { useState } from "react";

const STAGE_COLORS = {
  pre_press: "bg-amber-100 text-amber-800 border-amber-300",
  printing: "bg-blue-100 text-blue-800 border-blue-300",
  curing: "bg-purple-100 text-purple-800 border-purple-300",
  cutting: "bg-indigo-100 text-indigo-800 border-indigo-300",
  packaging: "bg-teal-100 text-teal-800 border-teal-300",
  dispatched: "bg-green-100 text-green-800 border-green-300",
};

export function JobCardWidget({ data, onAction }) {
  const [loading, setLoading] = useState(false);

  if (!data) return null;

  const handleAdvance = async () => {
    setLoading(true);
    try {
      await onAction("advance_stage", { jobCardId: data.jobCardId, currentStage: data.stage });
    } finally {
      setLoading(false);
    }
  };

  const stageName = String(data.stage || 'pre_press').replace("_", " ");

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
        <span
          className="text-xs font-semibold uppercase tracking-wider text-slate-500"
          style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase' }}
        >
          Job Card
        </span>
        <span
          className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
            STAGE_COLORS[data.stage] || "bg-slate-100 text-slate-700"
          }`}
          style={{
            fontSize: '0.74rem',
            padding: '2px 8px',
            borderRadius: '9999px',
            fontWeight: 700,
            textTransform: 'capitalize',
            background: data.stage === 'dispatched' ? '#dcfce7' : data.stage === 'printing' ? '#dbeafe' : '#fef3c7',
            color: data.stage === 'dispatched' ? '#166534' : data.stage === 'printing' ? '#1e40af' : '#92400e',
            border: '1px solid currentColor'
          }}
        >
          {stageName}
        </span>
      </div>

      <div
        className="mt-3 space-y-1.5 text-sm"
        style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.84rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b' }}>ID:</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e293b' }}>{data.jobCardId}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b' }}>Item:</span>
          <span style={{ fontWeight: 600, color: '#1e293b' }}>{data.item || "N/A"}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b' }}>Volume:</span>
          <span style={{ fontWeight: 600, color: '#1e293b' }}>{data.allocatedMeters} meters</span>
        </div>
        {data.assignedMachine && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Machine:</span>
            <span style={{ fontWeight: 600, color: '#1e293b' }}>{data.assignedMachine}</span>
          </div>
        )}
        {data.estimatedCompletion && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Est. Completion:</span>
            <span style={{ fontWeight: 600, color: '#2563eb' }}>{data.estimatedCompletion}</span>
          </div>
        )}
      </div>

      <div
        className="mt-4 pt-3 border-t border-slate-100 flex gap-2"
        style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px' }}
      >
        <button
          onClick={handleAdvance}
          disabled={loading || data.stage === "dispatched"}
          style={{
            flex: 1,
            padding: '7px 12px',
            background: data.stage === 'dispatched' ? '#cbd5e1' : '#2563eb',
            color: '#ffffff',
            fontSize: '0.78rem',
            fontWeight: 700,
            borderRadius: '8px',
            border: 'none',
            cursor: data.stage === 'dispatched' ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px'
          }}
        >
          {loading ? "Updating..." : "Next Stage ➔"}
        </button>
        <button
          onClick={() => onAction("view_details", { jobCardId: data.jobCardId })}
          style={{
            padding: '7px 12px',
            background: '#f1f5f9',
            color: '#334155',
            fontSize: '0.78rem',
            fontWeight: 600,
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            cursor: 'pointer'
          }}
        >
          Details
        </button>
      </div>
    </div>
  );
}

export default JobCardWidget;
