import React, { useEffect, useState } from 'react';
import { History, X, Clock, User, ArrowRight, ShieldCheck, Search, Filter } from 'lucide-react';
import api from '../../services/api';
import { TableSkeleton } from './Skeletons';

export default function AuditTrailModal({ entityType = 'JobCard', entityId, entityTitle, onClose }) {
  const [loading, setLoading] = useState(true);
  const [auditList, setAuditList] = useState([]);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchAudit = async () => {
      setLoading(true);
      setError(null);
      try {
        let endpoint = '';
        if (entityType === 'JobCard') {
          endpoint = `/v1/jobCards/${entityId}/audit-trail`;
        } else if (entityType === 'DeliveryChallan') {
          endpoint = `/v1/delivery-challans/${entityId}/audit-trail`;
        }

        const res = await api.get(endpoint);
        if (isMounted) {
          if (res && res.data && Array.isArray(res.data.auditTrail)) {
            setAuditList(res.data.auditTrail.reverse()); // Latest changes first
          } else if (Array.isArray(res?.auditTrail)) {
            setAuditList(res.auditTrail.reverse());
          } else {
            setAuditList([]);
          }
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load audit history.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAudit();
    return () => { isMounted = false; };
  }, [entityType, entityId]);

  const filteredLogs = auditList.filter((log) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (log.performedByName || log.performedBy || '').toLowerCase().includes(q) ||
      (log.details || '').toLowerCase().includes(q) ||
      (log.changesSummary || '').toLowerCase().includes(q) ||
      (log.action || '').toLowerCase().includes(q)
    );
  });

  const getActionBadgeColor = (action) => {
    switch (action) {
      case 'CREATE':
        return { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', color: '#10b981' };
      case 'UPDATE':
      case 'EDIT':
        return { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', color: '#3b82f6' };
      case 'PRINT_ENTRY':
        return { bg: 'rgba(168, 85, 247, 0.15)', border: '#a855f7', color: '#a855f7' };
      case 'FUSING_ENTRY':
        return { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', color: '#f59e0b' };
      default:
        return { bg: 'rgba(100, 116, 139, 0.15)', border: '#64748b', color: '#94a3b8' };
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
      <div
        style={{
          background: 'var(--bg-modal, #0f172a)',
          border: '1px solid var(--border-light, #334155)',
          borderRadius: '16px',
          width: '90%',
          maxWidth: '720px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease'
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light, #334155)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <History size={18} color="#3b82f6" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
                Audit Trail & Version History
              </h3>
              <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)' }}>
                {entityTitle ? `${entityTitle}` : `ID: ${entityId}`} • {auditList.length} revision(s) recorded
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #94a3b8)', padding: '6px', borderRadius: '6px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-light, #1e293b)', background: 'rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search edits by staff, field, or action..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                background: 'var(--bg-input, #1e293b)',
                border: '1px solid var(--border-light, #334155)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.82rem',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Content Stream */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <TableSkeleton rows={5} columns={3} />
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#ef4444' }}>
              <p>{error}</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <ShieldCheck size={36} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <p style={{ margin: 0, fontWeight: 600 }}>No revision records matching search</p>
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem' }}>All historical modifications and entries are permanently audited.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }}>
              {/* Vertical timeline spine */}
              <div style={{ position: 'absolute', left: '16px', top: '10px', bottom: '10px', width: '2px', background: 'var(--border-light, #334155)', zIndex: 0 }} />

              {filteredLogs.map((log, idx) => {
                const badgeStyle = getActionBadgeColor(log.action);
                const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Recent';

                return (
                  <div
                    key={log._id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '14px',
                      position: 'relative',
                      zIndex: 1
                    }}
                  >
                    {/* Circle Node on Timeline */}
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'var(--bg-modal, #0f172a)',
                        border: `2px solid ${badgeStyle.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Clock size={14} color={badgeStyle.color} />
                    </div>

                    {/* Card Content */}
                    <div
                      style={{
                        flex: 1,
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-light, #334155)',
                        borderRadius: '10px',
                        padding: '12px 14px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              background: badgeStyle.bg,
                              border: `1px solid ${badgeStyle.border}`,
                              color: badgeStyle.color
                            }}
                          >
                            {log.action}
                          </span>
                          <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <User size={12} color="#94a3b8" />
                            {log.performedByName || log.performedBy || 'Staff Member'}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{dateStr}</span>
                      </div>

                      {/* Diff Details */}
                      {log.changesSummary ? (
                        <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '6px', padding: '8px 10px', marginTop: '6px' }}>
                          {log.changesSummary.split(';').map((change, cIdx) => (
                            <div key={cIdx} style={{ fontSize: '0.76rem', color: '#cbd5e1', padding: '2px 0', fontFamily: 'monospace' }}>
                              • {change.trim()}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#cbd5e1' }}>
                          {log.details || 'Job Card record updated.'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
