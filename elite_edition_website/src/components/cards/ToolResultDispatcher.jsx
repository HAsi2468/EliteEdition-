import React from "react";
import { JobCardWidget } from "./JobCardWidget";
import { InventoryCardWidget } from "./InventoryCardWidget";

export function ToolResultDispatcher({ toolName, result, onCardAction }) {
  if (!result || result.error) {
    return (
      <div
        className="my-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg max-w-md"
        style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          padding: '10px 12px',
          borderRadius: '8px',
          fontSize: '0.78rem',
          margin: '6px 0',
          maxWidth: '420px'
        }}
      >
        <strong>Error executing {toolName}:</strong> {result?.error || result?.message || "Unknown error"}
      </div>
    );
  }

  // Handle nested result data wrapper if present
  const unwrappedData = result.data ? { ...result, ...result.data } : result;

  switch (toolName) {
    case "get_job_card_status":
    case "update_job_stage":
    case "manage_production_job":
      return <JobCardWidget data={unwrappedData} onAction={onCardAction} />;

    case "check_stock_balance":
    case "inventory_lookup_and_reserve":
      return <InventoryCardWidget data={unwrappedData} onAction={onCardAction} />;

    default:
      // Fallback for tools without dedicated custom widgets
      return (
        <div
          className="my-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 max-w-md overflow-hidden"
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '0.76rem',
            fontFamily: 'monospace',
            color: '#334155',
            margin: '6px 0',
            maxWidth: '420px'
          }}
        >
          <div style={{ fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
            ⚡ {toolName} Result:
          </div>
          <pre
            className="overflow-x-auto m-0"
            style={{ margin: 0, overflowX: 'auto', maxHeight: '160px', whiteSpace: 'pre-wrap' }}
          >
            {JSON.stringify(unwrappedData, null, 2)}
          </pre>
        </div>
      );
  }
}

export default ToolResultDispatcher;
