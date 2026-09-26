import React, { useState } from 'react';
import {
  Inbox, Send, FileText, Trash2, Star, Archive, Tag,
  Search, Plus, X, ChevronRight, Reply, Forward,
  MoreHorizontal, Paperclip, RefreshCw, Edit3, ArrowLeft,
  Mail, Check, AlertCircle
} from 'lucide-react';

const FOLDERS = [
  { id: 'inbox',  label: 'Inbox',    icon: '📬', count: 5 },
  { id: 'sent',   label: 'Sent',     icon: '📤', count: 0 },
  { id: 'drafts', label: 'Drafts',   icon: '📝', count: 2 },
  { id: 'spam',   label: 'Spam',     icon: '⚠️', count: 1 },
  { id: 'trash',  label: 'Trash',    icon: '🗑️', count: 0 },
];

const LABELS = [
  { id: 'work',     label: 'Work',     color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  { id: 'personal', label: 'Personal', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  { id: 'payments', label: 'Payments', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  { id: 'invoices', label: 'Invoices', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
];

const DEMO_EMAILS = [
  { id: 'e1', from: 'Harshit Sidapara', email: 'harshit@eliteedition.in', subject: 'Monthly Fabric Report - September 2026', preview: 'Please find attached the fabric consumption report for September. All numbers have been cross-verified with the inventory system.', body: 'Hi Team,\n\nPlease find attached the fabric consumption report for September. All numbers have been cross-verified with the inventory system.\n\nKey Highlights:\n- Total Fabric In: 12,450 meters\n- Total Fabric Out: 11,890 meters\n- Wastage: 560 meters (4.5%)\n\nBest regards,\nHarshit', date: '2026-09-24 09:15', unread: true, starred: true, label: 'work', attachments: ['fabric_report_sep.pdf'] },
  { id: 'e2', from: 'Production Team', email: 'production@eliteedition.in', subject: 'Job Card EDP-1094 Completed', preview: 'Job Card EDP-1094 has been successfully completed and moved to QA inspection stage.', body: 'Job Card EDP-1094 has been successfully completed and moved to QA inspection stage.\n\nDetails:\n- Design: Kurta Set - Floral Print\n- Qty: 240 pcs\n- Completed by: Ravi Kumar\n- Time taken: 3 days', date: '2026-09-24 08:30', unread: true, starred: false, label: 'work', attachments: [] },
  { id: 'e3', from: 'Accounts Dept', email: 'accounts@eliteedition.in', subject: 'Invoice INV-2026-0892 Pending', preview: 'This is a reminder that Invoice INV-2026-0892 for ₹1,24,500 is pending payment from Elite Online.', body: 'Dear Team,\n\nThis is a reminder that Invoice INV-2026-0892 for ₹1,24,500 is pending payment from Elite Online.\n\nDue Date: 30 September 2026\nAmount: ₹1,24,500\n\nKindly ensure payment is processed before the due date.\n\nRegards,\nAccounts Team', date: '2026-09-23 14:20', unread: true, starred: false, label: 'invoices', attachments: ['invoice_0892.pdf'] },
  { id: 'e4', from: 'Unicommerce System', email: 'noreply@unicommerce.com', subject: 'New Orders Synced: 47 orders', preview: '47 new orders have been synced from Myntra and other channels. Please review pending dispatch list.', body: '47 new orders have been synced successfully.\n\nBreakdown:\n- Myntra: 32 orders\n- Amazon: 8 orders\n- Flipkart: 7 orders\n\nPending dispatch: 12 orders\n\nClick here to view full dispatch list.', date: '2026-09-23 10:05', unread: false, starred: false, label: 'work', attachments: [] },
  { id: 'e5', from: 'Quality Assurance', email: 'qa@eliteedition.in', subject: 'QA Fail Report - Batch B-1052', preview: '3 pieces from Batch B-1052 have failed QA inspection. Please review and decide on rework vs reject.', body: 'QA Inspection Report\n\nBatch: B-1052\nDesign: Cotton Casual Kurta\n\nFailed Items: 3 pcs\nReasons:\n1. Stitching defect - neck area (2 pcs)\n2. Color mismatch - sleeve (1 pc)\n\nRecommendation: Rework on 2 pcs, reject 1 pc\n\nPlease confirm action within 24 hours.', date: '2026-09-22 16:45', unread: false, starred: true, label: 'work', attachments: ['qa_report_b1052.pdf'] },
  { id: 'e6', from: 'HR Team', email: 'hr@eliteedition.in', subject: 'September Salary Processed', preview: 'Salaries for September 2026 have been processed. Credits will reflect by end of day.', body: 'Dear Team,\n\nSalaries for September 2026 have been successfully processed.\n\nCredits will reflect in your accounts by end of business day today.\n\nFor any discrepancies, please contact HR within 3 working days.\n\nRegards,\nHR Team', date: '2026-09-21 11:00', unread: false, starred: false, label: 'payments', attachments: [] },
  { id: 'e7', from: 'Design Department', email: 'design@eliteedition.in', subject: 'New Design Catalogue Ready for Review', preview: 'The Winter 2026 design catalogue with 48 new designs is ready. Please review and approve before production starts.', body: 'Hi Team,\n\nThe Winter 2026 design catalogue is ready for review.\n\nTotal new designs: 48\nCategories: Kurta Sets (24), Anarkali (12), Salwar Suits (8), Lehengas (4)\n\nPlease review the attached catalogue and provide approvals/rejections by September 27.\n\nRegards,\nDesign Team', date: '2026-09-20 09:30', unread: false, starred: false, label: 'work', attachments: ['winter_catalogue_2026.pdf', 'design_sheet.xlsx'] },
];

const AVATAR_COLORS = ['#6366f1','#38bdf8','#22c55e','#f59e0b','#ec4899','#a855f7'];

function getAvatarColor(name) {
  let h = 0;
  for (let c of name) h = (h * 31 + c.charCodeAt(0)) & 0xfffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function formatEmailTime(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function InboxModule({ currentUser }) {
  const [emails, setEmails] = useState(DEMO_EMAILS);
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [search, setSearch] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [composeForm, setComposeForm] = useState({ to: '', subject: '', body: '' });

  const toggleStar = (id) => setEmails(prev => prev.map(e => e.id === id ? { ...e, starred: !e.starred } : e));
  const markRead = (id) => setEmails(prev => prev.map(e => e.id === id ? { ...e, unread: false } : e));
  const deleteEmail = (id) => { setEmails(prev => prev.filter(e => e.id !== id)); setSelectedEmail(null); };

  const openEmail = (email) => {
    markRead(email.id);
    setSelectedEmail(email);
  };

  const filtered = emails.filter(e => {
    const matchSearch = search ? (e.subject.toLowerCase().includes(search.toLowerCase()) || e.from.toLowerCase().includes(search.toLowerCase()) || e.preview.toLowerCase().includes(search.toLowerCase())) : true;
    return matchSearch;
  });

  const unreadCount = emails.filter(e => e.unread).length;

  const sendCompose = () => {
    const newEmail = {
      id: `e${Date.now()}`,
      from: currentUser?.name || 'You',
      email: currentUser?.email || 'you@eliteedition.in',
      subject: composeForm.subject || '(No Subject)',
      preview: composeForm.body.slice(0, 80),
      body: composeForm.body,
      date: new Date().toISOString().slice(0,16).replace('T',' '),
      unread: false, starred: false, label: 'work', attachments: []
    };
    setEmails(prev => [newEmail, ...prev]);
    setShowCompose(false);
    setComposeForm({ to: '', subject: '', body: '' });
  };

  return (
    <div style={{ display: 'flex', height: '100%', gap: '1rem' }}>
      {/* Sidebar */}
      <div className="glass-panel" style={{ width: '200px', flexShrink: 0, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <button onClick={() => setShowCompose(true)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.55rem 0.75rem', borderRadius: '10px', background: 'linear-gradient(135deg,#6366f1,#38bdf8)', color: '#fff', border: 'none', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
          <Edit3 size={14} /> Compose
        </button>

        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.15rem' }}>Folders</div>
        {FOLDERS.map(f => (
          <button key={f.id} onClick={() => { setActiveFolder(f.id); setSelectedEmail(null); }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.6rem', borderRadius: '8px',
              background: activeFolder === f.id ? 'var(--nav-active-bg)' : 'transparent',
              border: activeFolder === f.id ? '1px solid var(--primary)' : '1px solid transparent',
              color: activeFolder === f.id ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', width: '100%', transition: 'all 0.15s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span>{f.icon}</span> {f.label}
            </div>
            {(f.id === 'inbox' ? unreadCount : f.count) > 0 && (
              <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '0.62rem', fontWeight: 800 }}>
                {f.id === 'inbox' ? unreadCount : f.count}
              </span>
            )}
          </button>
        ))}

        <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>Labels</div>
          {LABELS.map(l => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.3rem 0.6rem', borderRadius: '6px', marginBottom: '0.2rem', cursor: 'pointer' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.color, flexShrink: 0 }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Email List */}
      <div className="glass-panel" style={{ width: selectedEmail ? '300px' : 'auto', flex: selectedEmail ? 'none' : 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
        {/* List header */}
        <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            {FOLDERS.find(f => f.id === activeFolder)?.label} 
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginLeft: '0.35rem' }}>({filtered.length})</span>
          </div>
          <div style={{ position: 'relative', flex: 1, maxWidth: '180px' }}>
            <Search size={12} style={{ position: 'absolute', left: '0.55rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ paddingLeft: '1.8rem', fontSize: '0.78rem', width: '100%' }} />
          </div>
        </div>
        {/* Email list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 1rem', fontSize: '0.85rem' }}>No emails found</div>
          ) : filtered.map(email => {
            const lbl = LABELS.find(l => l.id === email.label);
            return (
              <button key={email.id} onClick={() => openEmail(email)} className={`email-list-item${email.unread ? ' unread' : ''}`}
                style={{ borderLeft: selectedEmail?.id === email.id ? '3px solid var(--primary)' : '3px solid transparent' }}>
                <div className="email-avatar" style={{ background: getAvatarColor(email.from), fontSize: '0.72rem' }}>
                  {email.from.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem', marginBottom: '2px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: email.unread ? 800 : 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.from}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0 }}>{formatEmailTime(email.date)}</span>
                  </div>
                  <div className="email-subject">{email.subject}</div>
                  <div className="email-preview">{email.preview}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '4px' }}>
                    {lbl && <span className="email-label-chip" style={{ background: lbl.bg, color: lbl.color }}>{lbl.label}</span>}
                    {email.attachments?.length > 0 && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>📎 {email.attachments.length}</span>}
                    {email.starred && <span style={{ fontSize: '0.65rem' }}>⭐</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Email Detail */}
      {selectedEmail && (
        <div className="glass-panel" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={() => setSelectedEmail(null)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
              <ArrowLeft size={14} /> Back
            </button>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button onClick={() => toggleStar(selectedEmail.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>{selectedEmail.starred ? '⭐' : '☆'}</button>
              <button onClick={() => deleteEmail(selectedEmail.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', display: 'flex', alignItems: 'center' }}><Trash2 size={14} /></button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem', lineHeight: 1.3 }}>{selectedEmail.subject}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
              <div className="email-avatar" style={{ background: getAvatarColor(selectedEmail.from), width: '40px', height: '40px', fontSize: '0.88rem' }}>
                {selectedEmail.from.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{selectedEmail.from}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{selectedEmail.email} · {selectedEmail.date}</div>
              </div>
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', background: 'var(--bg-card)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-light)', marginBottom: '1rem' }}>
              {selectedEmail.body}
            </div>
            {selectedEmail.attachments?.length > 0 && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Attachments</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {selectedEmail.attachments.map(att => (
                    <div key={att} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-card)', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                      📎 {att}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-light)', display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => { setComposeForm({ to: selectedEmail.email, subject: `Re: ${selectedEmail.subject}`, body: `\n\n---\nOn ${selectedEmail.date}, ${selectedEmail.from} wrote:\n${selectedEmail.body.slice(0,100)}...` }); setShowCompose(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
              <Reply size={13} /> Reply
            </button>
            <button style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: '8px', background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>
              <Forward size={13} /> Forward
            </button>
          </div>
        </div>
      )}

      {/* Compose Modal */}
      {showCompose && (
        <div className="modal-overlay" onClick={() => setShowCompose(false)}>
          <div className="modal-content" style={{ maxWidth: '520px', padding: '1.25rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', margin: 0 }}>New Message</h3>
              <button onClick={() => setShowCompose(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', width: '45px', flexShrink: 0 }}>To:</span>
                <input value={composeForm.to} onChange={e => setComposeForm(p=>({...p,to:e.target.value}))} placeholder="Recipient email..." style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.85rem' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', width: '45px', flexShrink: 0 }}>Sub:</span>
                <input value={composeForm.subject} onChange={e => setComposeForm(p=>({...p,subject:e.target.value}))} placeholder="Subject..." style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.85rem' }} />
              </div>
              <textarea value={composeForm.body} onChange={e => setComposeForm(p=>({...p,body:e.target.value}))} rows={8} placeholder="Write your message..." style={{ width: '100%', resize: 'vertical', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.75rem', color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'var(--font-sans)', outline: 'none', lineHeight: 1.6 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontFamily: 'var(--font-sans)' }}>
                  📎 Attach
                </button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setShowCompose(false)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>Discard</button>
                  <button onClick={sendCompose} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1.2rem', borderRadius: '8px', background: 'linear-gradient(135deg,#6366f1,#38bdf8)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                    <Send size={13} /> Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
