import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock, Mail, MessageCircle, MessageSquare, RefreshCw, Search, AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';
import { triggerPushNotification } from './NotificationToast';
import CountUpNumber from './common/CountUpNumber';

const fmtINR = (val) =>
  `₹ ${Number(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const cardBox = {
  background: 'rgba(15, 23, 42, 0.78)',
  border: '1px solid rgba(148, 163, 184, 0.22)',
  borderRadius: '14px',
  padding: '1rem 1.15rem',
  color: '#f8fafc',
};

/**
 * Party Ageing & Automated Payment Reminders Dashboard (30 / 60 / 90+ Days).
 */
export default function PartyAgeingDashboard({ companyEntity = 'ALL', allowCompanyFilter = true }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ totalDue: 0, b0_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0, partyCount: 0 });
  const [parties, setParties] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(companyEntity || 'ALL');
  const [bucketFilter, setBucketFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sendingKey, setSendingKey] = useState('');

  useEffect(() => {
    if (!allowCompanyFilter && companyEntity) {
      setSelectedCompany(companyEntity);
    }
  }, [allowCompanyFilter, companyEntity]);

  const loadAgeing = useCallback(async () => {
    setLoading(true);
    try {
      const target = allowCompanyFilter ? selectedCompany : companyEntity;
      const res = await api.getPartyAgeing(target);
      if (res?.success) {
        setSummary(res.summary || { totalDue: 0, b0_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0, partyCount: 0 });
        setParties(Array.isArray(res.parties) ? res.parties : []);
      }
    } catch (e) {
      triggerPushNotification('Party Ageing', e.message || 'Failed to load ageing data', 'error');
    } finally {
      setLoading(false);
    }
  }, [allowCompanyFilter, companyEntity, selectedCompany]);

  useEffect(() => {
    loadAgeing();
  }, [loadAgeing]);

  const companyOptions = useMemo(() => {
    const set = new Set(parties.map((p) => p.companyEntity).filter(Boolean));
    return ['ALL', ...Array.from(set).sort()];
  }, [parties]);

  const filteredParties = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parties.filter((p) => {
      if (bucketFilter === '30+' && p.maxDaysOverdue <= 30) return false;
      if (bucketFilter === '60+' && p.maxDaysOverdue <= 60) return false;
      if (bucketFilter === '90+' && p.maxDaysOverdue <= 90) return false;
      if (!q) return true;
      return (
        p.partyName.toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q) ||
        (p.gstin || '').toLowerCase().includes(q) ||
        (p.companyEntity || '').toLowerCase().includes(q)
      );
    });
  }, [parties, bucketFilter, search]);

  const handleReminder = async (party, channel) => {
    const key = `${party.companyEntity}-${party.partyName}-${channel}`;
    setSendingKey(key);
    try {
      const res = await api.sendPaymentReminder({
        partyName: party.partyName,
        phone: party.phone,
        email: party.email,
        totalDue: party.totalDue,
        maxDaysOverdue: party.maxDaysOverdue,
        companyEntity: party.companyEntity,
        channel,
      });
      if (channel === 'whatsapp' && res?.whatsappUrl) {
        window.open(res.whatsappUrl, '_blank', 'noopener,noreferrer');
      }
      triggerPushNotification('Payment Reminder', res?.message || 'Reminder dispatched', 'success');
    } catch (e) {
      triggerPushNotification('Reminder Failed', e.message || 'Could not send reminder', 'error');
    } finally {
      setSendingKey('');
    }
  };

  return (
    <div style={cardBox}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={18} color="#fbbf24" />
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#f8fafc' }}>
              Party Ageing &amp; Payment Reminders (30 / 60 / 90+ Days)
            </div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
              {summary.partyCount} parties with pending receivables · 1-click WhatsApp, Email &amp; Team Chat follow-up
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={loadAgeing}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.4rem 0.75rem',
            borderRadius: '8px',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            background: 'rgba(30, 41, 59, 0.85)',
            color: '#e2e8f0',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} /> {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Ageing Bucket Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', marginBottom: '0.9rem' }}>
        <div style={{ background: 'rgba(11, 17, 32, 0.75)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '10px', padding: '0.65rem 0.8rem' }}>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>TOTAL RECEIVABLE</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}><CountUpNumber value={summary.totalDue} prefix="₹ " /></div>
        </div>
        <div style={{ background: 'rgba(11, 17, 32, 0.75)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '0.65rem 0.8rem' }}>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>0–30 DAYS</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#34d399', marginTop: '2px' }}><CountUpNumber value={summary.b0_30} prefix="₹ " /></div>
        </div>
        <div style={{ background: 'rgba(11, 17, 32, 0.75)', border: '1px solid rgba(251, 191, 36, 0.25)', borderRadius: '10px', padding: '0.65rem 0.8rem' }}>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>31–60 DAYS</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fbbf24', marginTop: '2px' }}><CountUpNumber value={summary.b31_60} prefix="₹ " /></div>
        </div>
        <div style={{ background: 'rgba(11, 17, 32, 0.75)', border: '1px solid rgba(249, 115, 22, 0.3)', borderRadius: '10px', padding: '0.65rem 0.8rem' }}>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>61–90 DAYS</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fb923c', marginTop: '2px' }}><CountUpNumber value={summary.b61_90} prefix="₹ " /></div>
        </div>
        <div style={{ background: 'rgba(127, 29, 29, 0.25)', border: '1px solid rgba(248, 113, 113, 0.38)', borderRadius: '10px', padding: '0.65rem 0.8rem' }}>
          <div style={{ fontSize: '0.68rem', color: '#fca5a5', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={11} /> 90+ DAYS CRITICAL
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f87171', marginTop: '2px' }}><CountUpNumber value={summary.b90_plus} prefix="₹ " /></div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.85rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search party name, phone, GSTIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.7rem 0.45rem 2rem',
              borderRadius: '8px',
              border: '1px solid rgba(148, 163, 184, 0.28)',
              background: 'rgba(11, 17, 32, 0.85)',
              color: '#f8fafc',
              fontSize: '0.8rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {allowCompanyFilter && (
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            style={{
              padding: '0.45rem 0.7rem',
              borderRadius: '8px',
              border: '1px solid rgba(148, 163, 184, 0.28)',
              background: 'rgba(11, 17, 32, 0.85)',
              color: '#f8fafc',
              fontSize: '0.8rem',
            }}
          >
            {companyOptions.map((c) => (
              <option key={c} value={c}>{c === 'ALL' ? 'All Companies' : c}</option>
            ))}
          </select>
        )}

        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            { id: 'ALL', label: 'All' },
            { id: '30+', label: '30+ Days' },
            { id: '60+', label: '60+ Days' },
            { id: '90+', label: '90+ Critical' },
          ].map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBucketFilter(b.id)}
              style={{
                padding: '0.38rem 0.65rem',
                borderRadius: '8px',
                border: bucketFilter === b.id ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(148, 163, 184, 0.22)',
                background: bucketFilter === b.id ? 'rgba(37, 99, 235, 0.4)' : 'rgba(11, 17, 32, 0.75)',
                color: bucketFilter === b.id ? '#ffffff' : '#cbd5e1',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxHeight: '360px', overflowY: 'auto' }}>
        {filteredParties.length === 0 ? (
          loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', padding: '0.5rem 0' }}>
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="erp-shimmer-box" style={{ height: '42px', width: '100%' }} />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.84rem' }}>
              No overdue invoices matching the current filter.
            </div>
          )
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.22)', color: '#94a3b8', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>Party</th>
                <th style={{ padding: '0.5rem' }}>Company</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>0–30d</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>31–60d</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>61–90d</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>90+d</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total Due</th>
                <th style={{ padding: '0.5rem', textAlign: 'center' }}>Remind</th>
              </tr>
            </thead>
            <tbody>
              {filteredParties.map((p) => (
                <tr key={`${p.companyEntity}-${p.partyName}`} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.12)' }}>
                  <td style={{ padding: '0.5rem' }}>
                    <div style={{ fontWeight: 700, color: '#f8fafc' }}>{p.partyName}</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      {p.invoiceCount} inv · max {p.maxDaysOverdue}d {p.phone ? `· ${p.phone}` : ''}
                    </div>
                  </td>
                  <td style={{ padding: '0.5rem', color: '#cbd5e1', fontSize: '0.75rem' }}>{p.companyEntity}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', color: '#34d399' }}>{p.b0_30 > 0 ? fmtINR(p.b0_30) : '—'}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', color: '#fbbf24' }}>{p.b31_60 > 0 ? fmtINR(p.b31_60) : '—'}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', color: '#fb923c' }}>{p.b61_90 > 0 ? fmtINR(p.b61_90) : '—'}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', color: '#f87171', fontWeight: 700 }}>{p.b90_plus > 0 ? fmtINR(p.b90_plus) : '—'}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', color: '#38bdf8', fontWeight: 800 }}>{fmtINR(p.totalDue)}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
                      <button
                        type="button"
                        title="Send WhatsApp Reminder"
                        disabled={Boolean(sendingKey)}
                        onClick={() => handleReminder(p, 'whatsapp')}
                        style={{ padding: '0.3rem 0.45rem', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.45)', background: 'rgba(16, 185, 129, 0.16)', color: '#6ee7b7', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', fontWeight: 700 }}
                      >
                        <MessageCircle size={12} /> WA
                      </button>
                      <button
                        type="button"
                        title={p.email ? `Email ${p.email}` : 'No email on party'}
                        disabled={!p.email || Boolean(sendingKey)}
                        onClick={() => handleReminder(p, 'email')}
                        style={{ padding: '0.3rem 0.45rem', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.45)', background: 'rgba(56, 189, 248, 0.16)', color: p.email ? '#93c5fd' : '#64748b', cursor: p.email ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', fontWeight: 700 }}
                      >
                        <Mail size={12} />
                      </button>
                      <button
                        type="button"
                        title="Notify Team in Chat"
                        disabled={Boolean(sendingKey)}
                        onClick={() => handleReminder(p, 'chat')}
                        style={{ padding: '0.3rem 0.45rem', borderRadius: '6px', border: '1px solid rgba(168, 85, 247, 0.45)', background: 'rgba(168, 85, 247, 0.16)', color: '#d8b4fe', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', fontWeight: 700 }}
                      >
                        <MessageSquare size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
