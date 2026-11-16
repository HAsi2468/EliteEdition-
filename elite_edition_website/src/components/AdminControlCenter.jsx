import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity, RefreshCw, CheckCircle2, XCircle, Lock, Megaphone,
  ShieldCheck, Clock, Users, Server, Sparkles, LogOut, HardDrive, TrendingUp,
  Cloud, Download, Mail, Database
} from 'lucide-react';
import { api } from '../services/api';
import { triggerPushNotification } from './NotificationToast';
import PartyAgeingDashboard from './PartyAgeingDashboard';

const cardStyle = {
  background: 'rgba(15, 23, 42, 0.78)',
  border: '1px solid rgba(148, 163, 184, 0.22)',
  borderRadius: '14px',
  padding: '1rem 1.15rem',
  color: '#f8fafc',
};

const inputStyle = {
  width: '100%',
  padding: '0.5rem 0.7rem',
  borderRadius: '8px',
  border: '1px solid rgba(148, 163, 184, 0.28)',
  background: 'rgba(11, 17, 32, 0.85)',
  color: '#f8fafc',
  fontSize: '0.84rem',
  boxSizing: 'border-box',
};

const btnPrimary = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.4rem',
  padding: '0.5rem 0.9rem',
  borderRadius: '8px',
  border: '1px solid rgba(56, 189, 248, 0.4)',
  background: 'rgba(37, 99, 235, 0.85)',
  color: '#ffffff',
  fontWeight: 700,
  fontSize: '0.8rem',
  cursor: 'pointer',
};

export default function AdminControlCenter({ users = [], onRefreshUsers }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [booksLockDate, setBooksLockDate] = useState('');
  const [gstApiProvider, setGstApiProvider] = useState('gstincheck');
  const [savingLock, setSavingLock] = useState(false);

  const [broadcastTitle, setBroadcastTitle] = useState('System Notice');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('Accountant');
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  const [companyFinancials, setCompanyFinancials] = useState([]);
  const [chatStorage, setChatStorage] = useState(null);
  const [cleaningChat, setCleaningChat] = useState(false);

  const [dailyBackups, setDailyBackups] = useState([]);
  const [r2Backups, setR2Backups] = useState([]);
  const [backingUpR2, setBackingUpR2] = useState(false);
  const [emailingBackup, setEmailingBackup] = useState(false);
  const [qaBotEnabled, setQaBotEnabled] = useState(true);
  const [togglingBot, setTogglingBot] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [res, finRes, chatRes, dailyRes, r2Res] = await Promise.all([
        api.getAdminControlOverview(),
        api.getAdminCompanyFinancials().catch(() => null),
        api.getAdminChatStorage().catch(() => null),
        api.listBackupHistory().catch(() => null),
        api.listR2Backups().catch(() => null),
      ]);
      if (res?.success && res.data) {
        setData(res.data);
        setBooksLockDate(res.data.settings?.booksLockDate || '');
        setGstApiProvider(res.data.settings?.gstApiProvider || 'gstincheck');
        setQaBotEnabled(res.data.settings?.qaBotEnabled !== false);
      }
      if (finRes?.success && Array.isArray(finRes.data)) setCompanyFinancials(finRes.data);
      if (chatRes?.success && chatRes.data) setChatStorage(chatRes.data);
      if (dailyRes?.success && Array.isArray(dailyRes.backups)) setDailyBackups(dailyRes.backups);
      if (r2Res?.success && Array.isArray(r2Res.backups)) setR2Backups(r2Res.backups);
    } catch (e) {
      triggerPushNotification('Control Center', e.message || 'Failed to load overview', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleApproveSample = async (task) => {
    try {
      await api.approveAdminSampleDesign(task._id, task.designNo || task.designName);
      triggerPushNotification('Sample Approved', `${task.designNo || task.designName || 'Design'} published to Design Catalog`, 'success');
      loadOverview();
    } catch (e) {
      alert(e.message || 'Approval failed');
    }
  };

  const handleRejectSample = async (task) => {
    const reason = window.prompt('Rejection reason (optional):') || '';
    try {
      await api.rejectAdminSampleDesign(task._id, reason);
      triggerPushNotification('Sample Rejected', 'Sample design marked rejected', 'warning');
      loadOverview();
    } catch (e) {
      alert(e.message || 'Rejection failed');
    }
  };

  const handleTriggerSync = async () => {
    setSyncing(true);
    try {
      const res = await api.triggerAdminSync();
      triggerPushNotification('Sync Started', res?.message || 'Catalog & Uniware sync triggered', 'success');
    } catch (e) {
      alert(e.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveLock = async () => {
    setSavingLock(true);
    try {
      await api.saveAdminBooksLock({ booksLockDate, gstApiProvider });
      triggerPushNotification('Settings Saved', 'Books Lock & GST provider updated', 'success');
      loadOverview();
    } catch (e) {
      alert(e.message || 'Save failed');
    } finally {
      setSavingLock(false);
    }
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;
    setSendingBroadcast(true);
    try {
      await api.sendAdminBroadcast({ title: broadcastTitle, message: broadcastMsg });
      setBroadcastMsg('');
      triggerPushNotification('Broadcast Sent', 'Live announcement sent to connected staff', 'success');
      loadOverview();
    } catch (e2) {
      alert(e2.message || 'Broadcast failed');
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedUserId) return alert('Select a user first');
    setApplyingTemplate(true);
    try {
      await api.applyAdminRoleTemplate(selectedUserId, selectedTemplate);
      triggerPushNotification('Permissions Updated', `Applied ${selectedTemplate} preset`, 'success');
      if (onRefreshUsers) onRefreshUsers();
    } catch (e) {
      alert(e.message || 'Failed to apply preset');
    } finally {
      setApplyingTemplate(false);
    }
  };

  const health = data?.systemHealth;
  const pendingSamples = data?.pendingSamples || [];
  const overdueTasks = data?.overdueTasks || [];
  const recentUsers = data?.recentUsers || [];
  const templates = data?.roleTemplates || ['Accountant', 'Designer', 'Dispatch', 'Sales', 'Manager'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1rem', color: '#f8fafc' }}>
          <Server size={18} color="#38bdf8" /> Enterprise Control Center
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleTriggerSync} disabled={syncing} style={{ ...btnPrimary, background: 'rgba(16, 185, 129, 0.22)', borderColor: 'rgba(52, 211, 153, 0.45)', color: '#6ee7b7' }}>
            <RefreshCw size={14} className={syncing ? 'spin-loader' : ''} />
            <span>{syncing ? 'Syncing...' : 'Sync Uniware & Images'}</span>
          </button>
          <button type="button" onClick={loadOverview} disabled={loading} style={{ ...btnPrimary, background: 'rgba(30, 41, 59, 0.85)', borderColor: 'rgba(148, 163, 184, 0.35)' }}>
            <RefreshCw size={14} className={loading ? 'spin-loader' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* System Health Row */}
      {health && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '0.75rem' }}>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>SERVER UPTIME</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#6ee7b7', marginTop: '0.2rem' }}>
              {Math.floor((health.uptimeSeconds || 0) / 60)}m {(health.uptimeSeconds || 0) % 60}s
            </div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>MEMORY (HEAP / RSS)</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#93c5fd', marginTop: '0.2rem' }}>
              {health.heapUsedMb} / {health.rssMb} MB
            </div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>INVENTORY / DESIGNS</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.2rem' }}>
              {health.counts?.inventory || 0} / {health.counts?.designs || 0}
            </div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>INVOICES / EXPENSES</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fcd34d', marginTop: '0.2rem' }}>
              {health.counts?.invoices || 0} / {health.counts?.expenses || 0}
            </div>
          </div>
        </div>
      )}

      {/* Main 2-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '1rem' }}>
        {/* Sample Design Approval Queue */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}>
              <Sparkles size={16} color="#fbbf24" /> Sample Design Queue ({pendingSamples.length})
            </div>
          </div>
          <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pendingSamples.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No pending sample designs for catalog approval.</div>
            ) : (
              pendingSamples.map((t) => (
                <div key={t._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', background: 'rgba(11, 17, 32, 0.72)', padding: '0.55rem 0.7rem', borderRadius: '10px', border: '1px solid rgba(148,163,184,0.16)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.designNo || t.designName || 'Sample'} {t.category ? `· ${t.category}` : ''}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      Status: {t.status || 'Pending'} {t.party ? `· ${t.party}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                    <button type="button" onClick={() => handleApproveSample(t)} title="Approve & Publish" style={{ ...btnPrimary, padding: '0.35rem 0.55rem', background: 'rgba(16,185,129,0.2)', borderColor: 'rgba(52,211,153,0.45)', color: '#6ee7b7' }}>
                      <CheckCircle2 size={14} /> Approve
                    </button>
                    <button type="button" onClick={() => handleRejectSample(t)} title="Reject" style={{ ...btnPrimary, padding: '0.35rem 0.55rem', background: 'rgba(239,68,68,0.2)', borderColor: 'rgba(248,113,113,0.45)', color: '#fca5a5' }}>
                      <XCircle size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Role Templates */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            <ShieldCheck size={16} color="#38bdf8" /> Role Permission Presets
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} style={inputStyle}>
              <option value="">-- Select Staff User --</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name || u.username} ({u.role || 'staff'})
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {templates.map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => setSelectedTemplate(tpl)}
                  style={{
                    ...btnPrimary,
                    background: selectedTemplate === tpl ? 'rgba(37, 99, 235, 0.85)' : 'rgba(30, 41, 59, 0.75)',
                    borderColor: selectedTemplate === tpl ? '#60a5fa' : 'rgba(148,163,184,0.25)',
                  }}
                >
                  {tpl}
                </button>
              ))}
            </div>
            <button type="button" onClick={handleApplyTemplate} disabled={applyingTemplate} style={btnPrimary}>
              {applyingTemplate ? 'Applying...' : `Apply ${selectedTemplate} Preset to User`}
            </button>
          </div>
        </div>

        {/* Period Lock & GST API */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            <Lock size={16} color="#fcd34d" /> Books Lock Date & GST Provider
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Freeze Invoices / Expenses Before Date</div>
              <input type="date" value={booksLockDate} onChange={(e) => setBooksLockDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '0.25rem' }}>GSTIN Lookup Provider</div>
              <select value={gstApiProvider} onChange={(e) => setGstApiProvider(e.target.value)} style={inputStyle}>
                <option value="gstincheck">GSTINCheck</option>
                <option value="sandbox">Sandbox.co.in</option>
                <option value="cashfree">Cashfree / Setu</option>
              </select>
            </div>
            <button type="button" onClick={handleSaveLock} disabled={savingLock} style={btnPrimary}>
              {savingLock ? 'Saving...' : 'Save Financial Controls'}
            </button>
          </div>
        </div>

        {/* Company-Wide Broadcast */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            <Megaphone size={16} color="#f472b6" /> Live Staff Broadcast
          </div>
          <form onSubmit={handleSendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            <input type="text" value={broadcastTitle} onChange={(e) => setBroadcastTitle(e.target.value)} placeholder="Announcement title..." style={inputStyle} />
            <textarea rows={2} value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)} placeholder="Message for all online staff..." style={inputStyle} />
            <button type="submit" disabled={sendingBroadcast || !broadcastMsg.trim()} style={btnPrimary}>
              {sendingBroadcast ? 'Sending...' : 'Send Broadcast Now'}
            </button>
            {data?.settings?.lastBroadcast?.message && (
              <div style={{ fontSize: '0.73rem', color: '#94a3b8' }}>
                Last sent: &ldquo;{data.settings.lastBroadcast.message}&rdquo; ({new Date(data.settings.lastBroadcast.sentAt).toLocaleString()})
              </div>
            )}
          </form>
        </div>

        {/* Overdue Tasks */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            <Clock size={16} color="#fca5a5" /> Overdue Tasks ({overdueTasks.length})
          </div>
          <div style={{ maxHeight: '210px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {overdueTasks.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: '#6ee7b7' }}>No overdue tasks across departments.</div>
            ) : (
              overdueTasks.map((t) => (
                <div key={t._id} style={{ background: 'rgba(11,17,32,0.72)', padding: '0.45rem 0.65rem', borderRadius: '8px', fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span style={{ color: '#f8fafc', fontWeight: 600 }}>{t.title}</span>
                  <span style={{ color: '#fca5a5', flexShrink: 0 }}>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : ''}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity + Force Logout */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            <Users size={16} color="#6ee7b7" /> Recent User Activity & Sessions
          </div>
          <div style={{ maxHeight: '210px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {recentUsers.map((u) => (
              <div key={u._id} style={{ background: 'rgba(11,17,32,0.72)', padding: '0.45rem 0.65rem', borderRadius: '8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#f8fafc', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.name || u.username} ({u.role || 'staff'})
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Active'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`Force logout ${u.name || u.username}?`)) return;
                    try {
                      await api.forceLogoutAdminUser(u._id);
                      triggerPushNotification('Session Ended', `Force logout signal sent to ${u.name || u.username}`, 'warning');
                    } catch (e) {
                      alert(e.message || 'Failed');
                    }
                  }}
                  title="Force Logout User"
                  style={{ ...btnPrimary, padding: '0.3rem 0.5rem', fontSize: '0.72rem', background: 'rgba(239,68,68,0.2)', borderColor: 'rgba(248,113,113,0.45)', color: '#fca5a5', flexShrink: 0 }}
                >
                  <LogOut size={12} /> Logout
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Storage & Cleanup */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            <HardDrive size={16} color="#38bdf8" /> Chat Storage & Attachment Cleanup
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ background: 'rgba(11,17,32,0.72)', padding: '0.5rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>TOTAL MSGS</div>
              <div style={{ fontWeight: 800, color: '#f8fafc' }}>{chatStorage?.totalMessages ?? 0}</div>
            </div>
            <div style={{ background: 'rgba(11,17,32,0.72)', padding: '0.5rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>MEDIA MSGS</div>
              <div style={{ fontWeight: 800, color: '#93c5fd' }}>{chatStorage?.mediaMessages ?? 0}</div>
            </div>
            <div style={{ background: 'rgba(11,17,32,0.72)', padding: '0.5rem', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>&gt; 90D OLD</div>
              <div style={{ fontWeight: 800, color: '#fcd34d' }}>{chatStorage?.oldMedia90d ?? 0}</div>
            </div>
          </div>
          <button
            type="button"
            disabled={cleaningChat}
            onClick={async () => {
              if (!window.confirm('Clear chat attachment references older than 90 days?')) return;
              setCleaningChat(true);
              try {
                const res = await api.cleanupAdminChatStorage(90);
                triggerPushNotification('Chat Cleanup', `Cleared ${res?.cleared || 0} old attachment(s)`, 'success');
                loadOverview();
              } catch (e) {
                alert(e.message || 'Cleanup failed');
              } finally {
                setCleaningChat(false);
              }
            }}
            style={{ ...btnPrimary, width: '100%', background: 'rgba(245,158,11,0.2)', borderColor: 'rgba(251,191,36,0.45)', color: '#fcd34d' }}
          >
            {cleaningChat ? 'Cleaning...' : 'Prune Attachments Older Than 90 Days'}
          </button>
        </div>
      </div>

      {/* Cross-Company Executive Financial Summary */}
      {companyFinancials.length > 0 && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            <TrendingUp size={16} color="#6ee7b7" /> Cross-Company Financial Summary
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.22)', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '0.45rem 0.6rem' }}>Company</th>
                  <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right' }}>Invoices</th>
                  <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right' }}>Total Sales</th>
                  <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right' }}>Total Expenses</th>
                  <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right' }}>Net Position</th>
                </tr>
              </thead>
              <tbody>
                {companyFinancials.map((row) => (
                  <tr key={row.companyEntity} style={{ borderBottom: '1px solid rgba(148,163,184,0.12)' }}>
                    <td style={{ padding: '0.5rem 0.6rem', fontWeight: 700, color: '#f8fafc' }}>{row.companyEntity}</td>
                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', color: '#94a3b8' }}>{row.invoiceCount}</td>
                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', color: '#93c5fd', fontWeight: 600 }}>₹ {Number(row.totalSales || 0).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', color: '#fcd34d', fontWeight: 600 }}>₹ {Number(row.totalExpenses || 0).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 800, color: row.netPosition >= 0 ? '#6ee7b7' : '#fca5a5' }}>
                      ₹ {Number(row.netPosition || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Automated Scheduled Backups to Cloud (S3/R2) & Restore UI */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cloud size={18} color="#38bdf8" />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#f8fafc' }}>
                Automated Cloud Backups (R2 / S3) &amp; Restore
              </div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                {dailyBackups.length} local daily snapshot(s) · {r2Backups.length} Cloudflare R2 cloud snapshot(s)
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={togglingBot}
              onClick={async () => {
                setTogglingBot(true);
                try {
                  const next = !qaBotEnabled;
                  const res = await api.toggleAdminQaBotAccess(next);
                  setQaBotEnabled(res?.qaBotEnabled !== false);
                  triggerPushNotification('QA Bot Access', res?.message || 'Updated QA Bot access', 'success');
                } catch (e) {
                  triggerPushNotification('Error', e.message || 'Failed to toggle QA Bot access', 'error');
                } finally {
                  setTogglingBot(false);
                }
              }}
              style={{
                ...btnPrimary,
                background: qaBotEnabled ? 'rgba(16, 185, 129, 0.22)' : 'rgba(239, 68, 68, 0.22)',
                borderColor: qaBotEnabled ? 'rgba(52, 211, 153, 0.45)' : 'rgba(248, 113, 113, 0.45)',
                color: qaBotEnabled ? '#6ee7b7' : '#fca5a5',
              }}
              title="Toggle Main Admin API access for qa-bot"
            >
              <ShieldCheck size={14} /> QA Bot Admin: {qaBotEnabled ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              disabled={backingUpR2}
              onClick={async () => {
                setBackingUpR2(true);
                try {
                  const res = await api.triggerR2Backup();
                  triggerPushNotification('Cloud Backup', res?.message || 'Database snapshot uploaded to R2', 'success');
                  loadOverview();
                } catch (e) {
                  triggerPushNotification('Backup Error', e.message || 'R2 backup failed', 'error');
                } finally {
                  setBackingUpR2(false);
                }
              }}
              style={btnPrimary}
            >
              <Database size={14} /> {backingUpR2 ? 'Uploading to R2...' : 'Backup Now to R2'}
            </button>
            <button
              type="button"
              disabled={emailingBackup}
              onClick={async () => {
                setEmailingBackup(true);
                try {
                  const res = await api.sendBackupEmail();
                  triggerPushNotification('DR Email Sent', res?.message || 'Backup email dispatched', 'success');
                } catch (e) {
                  triggerPushNotification('Email Failed', e.message || 'Could not email backup', 'error');
                } finally {
                  setEmailingBackup(false);
                }
              }}
              style={{ ...btnPrimary, background: 'rgba(16, 185, 129, 0.22)', borderColor: 'rgba(16, 185, 129, 0.45)', color: '#6ee7b7' }}
            >
              <Mail size={14} /> {emailingBackup ? 'Sending...' : 'Email DR Snapshot'}
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: '230px', overflowY: 'auto' }}>
          {dailyBackups.length === 0 && r2Backups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.82rem' }}>
              No snapshots listed yet. Click <strong>Backup Now to R2</strong> to create an immediate full database snapshot.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.22)', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '0.45rem 0.5rem' }}>Snapshot File</th>
                  <th style={{ padding: '0.45rem 0.5rem' }}>Storage</th>
                  <th style={{ padding: '0.45rem 0.5rem', textAlign: 'right' }}>Size</th>
                  <th style={{ padding: '0.45rem 0.5rem' }}>Created</th>
                  <th style={{ padding: '0.45rem 0.5rem', textAlign: 'right' }}>Restore / Download</th>
                </tr>
              </thead>
              <tbody>
                {dailyBackups.slice(0, 8).map((b) => (
                  <tr key={`local-${b.fileName}`} style={{ borderBottom: '1px solid rgba(148,163,184,0.12)' }}>
                    <td style={{ padding: '0.45rem 0.5rem', fontWeight: 600, color: '#f8fafc' }}>{b.fileName}</td>
                    <td style={{ padding: '0.45rem 0.5rem', color: '#93c5fd' }}>Daily + Cloud</td>
                    <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: '#cbd5e1' }}>{b.sizeMB ? `${b.sizeMB} MB` : '—'}</td>
                    <td style={{ padding: '0.45rem 0.5rem', color: '#94a3b8' }}>
                      {b.modifiedAt ? new Date(b.modifiedAt).toLocaleString('en-IN') : '—'}
                    </td>
                    <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await api.downloadAuthenticatedFile(`/backup/download-archive/${encodeURIComponent(b.fileName)}`, b.fileName);
                          } catch (e) {
                            triggerPushNotification('Download Failed', e.message || 'Could not download archive', 'error');
                          }
                        }}
                        style={{ ...btnPrimary, padding: '0.28rem 0.6rem', fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.16)' }}
                      >
                        <Download size={12} /> Download
                      </button>
                    </td>
                  </tr>
                ))}
                {r2Backups.slice(0, 6).map((r) => (
                  <tr key={`r2-${r.key || r.fileName}`} style={{ borderBottom: '1px solid rgba(148,163,184,0.12)' }}>
                    <td style={{ padding: '0.45rem 0.5rem', fontWeight: 600, color: '#f8fafc' }}>{r.fileName || r.key}</td>
                    <td style={{ padding: '0.45rem 0.5rem', color: '#6ee7b7' }}>Cloudflare R2</td>
                    <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: '#cbd5e1' }}>
                      {r.size ? `${(r.size / (1024 * 1024)).toFixed(2)} MB` : '—'}
                    </td>
                    <td style={{ padding: '0.45rem 0.5rem', color: '#94a3b8' }}>
                      {r.lastModified ? new Date(r.lastModified).toLocaleString('en-IN') : '—'}
                    </td>
                    <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right' }}>
                      {r.url ? (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ ...btnPrimary, padding: '0.28rem 0.6rem', fontSize: '0.72rem', textDecoration: 'none', background: 'rgba(16, 185, 129, 0.2)' }}
                        >
                          <Download size={12} /> R2 Link
                        </a>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Synced</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Cross-Company Party Ageing & Automated Payment Reminders */}
      <PartyAgeingDashboard allowCompanyFilter={true} />
    </div>
  );
}
