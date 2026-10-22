import React from "react";
import { AlertOctagon, Clock, Activity, ArrowRight, CheckCircle2 } from "lucide-react";

export function BottleneckWatchdogCard({ data, onAction }) {
  if (!data) return null;

  const {
    thresholdHours = 24,
    totalActiveBatches = 0,
    stuckBatchesCount = 0,
    stageCounts = {},
    stuckJobs = [],
    actionPlan
  } = data;

  const handleOpenJobs = (jobNo) => {
    window.dispatchEvent(
      new CustomEvent('erp:navigate', {
        detail: { screen: 'jobcards_list', searchQuery: jobNo || '' }
      })
    );
  };

  const isHealthy = stuckBatchesCount === 0;

  return (
    <div
      style={{
        background: '#ffffff',
        border: isHealthy ? '1px solid #bbf7d0' : '1px solid #fecaca',
        borderRadius: '12px',
        padding: '14px 16px',
        margin: '8px 0',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        maxWidth: '460px',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '10px',
          borderBottom: '1px solid #f1f5f9'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: isHealthy ? '#ecfdf5' : '#fef2f2',
              color: isHealthy ? '#059669' : '#dc2626'
            }}
          >
            {isHealthy ? <CheckCircle2 size={16} /> : <AlertOctagon size={16} />}
          </span>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
              Production Bottleneck Watchdog
            </h4>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
              Monitoring batches active &gt; {thresholdHours}h • {totalActiveBatches} total in progress
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              color: isHealthy ? '#059669' : '#dc2626'
            }}
          >
            {stuckBatchesCount} Stuck
          </span>
        </div>
      </div>

      {/* Stage Queue Pills */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          margin: '10px 0',
          scrollbarWidth: 'none'
        }}
      >
        {Object.entries(stageCounts).map(([stage, info]) => {
          if (!info || info.count === 0) return null;
          return (
            <div
              key={stage}
              style={{
                display: 'inline-flex',
                flexDirection: 'column',
                padding: '4px 8px',
                borderRadius: '6px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                fontSize: '0.70rem',
                minWidth: '80px'
              }}
            >
              <span style={{ color: '#64748b', fontSize: '0.66rem' }}>{stage}</span>
              <span style={{ fontWeight: 700, color: '#1e293b' }}>
                {info.count} jobs ({info.meters}m)
              </span>
            </div>
          );
        })}
      </div>

      {/* Stuck Batches List */}
      {stuckJobs.length > 0 ? (
        <div style={{ margin: '10px 0' }}>
          <p style={{ margin: '0 0 6px 0', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
            Flagged Batches Requiring Action:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {stuckJobs.map((job, idx) => (
              <div
                key={idx}
                onClick={() => handleOpenJobs(job.jobNo)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  background: job.riskLevel === 'CRITICAL' ? '#fff1f2' : '#f8fafc',
                  border: job.riskLevel === 'CRITICAL' ? '1px solid #fecdd3' : '1px solid #e2e8f0',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.78rem', color: '#0f172a' }}>
                      #{job.jobNo}
                    </span>
                    <span
                      style={{
                        padding: '1px 5px',
                        borderRadius: '4px',
                        fontSize: '0.64rem',
                        fontWeight: 700,
                        background: job.riskLevel === 'CRITICAL' ? '#fee2e2' : '#fef3c7',
                        color: job.riskLevel === 'CRITICAL' ? '#991b1b' : '#92400e'
                      }}
                    >
                      {job.riskLevel}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.70rem', color: '#64748b' }}>
                    {job.party} • {job.designName}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>
                    {job.stage}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end' }}>
                    <Clock size={11} />
                    <span>{job.hoursActive}h in stage</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: '10px',
            textAlign: 'center',
            fontSize: '0.76rem',
            color: '#059669',
            background: '#ecfdf5',
            borderRadius: '8px',
            margin: '10px 0'
          }}
        >
          All production stages are moving smoothly.
        </div>
      )}

      {/* Action Plan */}
      <div
        style={{
          padding: '8px 10px',
          background: isHealthy ? '#f0fdf4' : '#fff7ed',
          border: isHealthy ? '1px solid #bbf7d0' : '1px solid #fed7aa',
          borderRadius: '8px',
          fontSize: '0.73rem',
          color: isHealthy ? '#166534' : '#9a3412',
          lineHeight: '1.35',
          margin: '10px 0'
        }}
      >
        {actionPlan}
      </div>

      {/* Quick Action Button */}
      <button
        type="button"
        onClick={() => handleOpenJobs('')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          width: '100%',
          padding: '7px 12px',
          borderRadius: '8px',
          background: isHealthy ? '#0f172a' : '#dc2626',
          color: '#ffffff',
          border: 'none',
          fontSize: '0.76rem',
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'background 0.15s ease'
        }}
      >
        <span>Open Job Cards Panel</span>
        <ArrowRight size={13} />
      </button>
    </div>
  );
}

export default BottleneckWatchdogCard;
