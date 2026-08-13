import React, { useState, useEffect } from 'react';
import { Users, ShieldCheck, UserCheck, X, Sparkles } from 'lucide-react';
import { getScreenGroupInfo } from '../services/screenGroupService';
import { api } from '../services/api';

export default function ScreenGroupRoster({ screenId = 'jobcards', customTitle = '' }) {
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const currentUser = api.getCurrentUser();

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await api.getUsers();
        if (Array.isArray(res)) setAllUsers(res);
        else if (res && Array.isArray(res.data)) setAllUsers(res.data);
      } catch (e) {
        console.warn('Failed to load group users:', e);
      } finally {
        setLoading(false);
      }
    };
    if (showRosterModal) {
      fetchUsers();
    }
  }, [showRosterModal]);

  const groupInfo = getScreenGroupInfo(screenId, allUsers.length > 0 ? allUsers : [currentUser].filter(Boolean));

  return (
    <>
      {/* Sleek Screen Group Badge */}
      <button
        type="button"
        onClick={() => setShowRosterModal(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.35rem 0.75rem',
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '20px',
          color: 'var(--primary, #38bdf8)',
          fontSize: '0.78rem',
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}
        title={`Click to view ${groupInfo.group.name} Members Roster`}
      >
        <Users size={14} />
        <span>{customTitle || groupInfo.group.name}</span>
        <span style={{
          background: 'rgba(56, 189, 248, 0.2)',
          color: '#ffffff',
          padding: '1px 6px',
          borderRadius: '10px',
          fontSize: '0.7rem',
          fontWeight: 800
        }}>
          {groupInfo.members.length} Members
        </span>
      </button>

      {/* Roster Modal */}
      {showRosterModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(5px)',
          zIndex: 10005,
          display: 'flex',
          alignItems: 'center',
          justify: 'center',
          padding: '1rem'
        }}>
          <div style={{
            width: '450px',
            maxWidth: '95vw',
            background: 'var(--bg-card, #161b26)',
            border: '1px solid var(--border-light, rgba(255,255,255,0.1))',
            borderRadius: '14px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(124, 58, 237, 0.15))',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(56, 189, 248, 0.2)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center',
                  color: 'var(--primary)'
                }}>
                  <Users size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    {groupInfo.group.name}
                  </h3>
                  <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                    {groupInfo.group.description}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRosterModal(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--text-muted)', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Body */}
            <div style={{ padding: '1.25rem', overflowY: 'auto', maxHeight: '60vh', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Group Admin Section */}
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <ShieldCheck size={14} /> Group Admin (Website Admin)
                </div>
                <div style={{
                  padding: '0.75rem 1rem',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f59e0b', color: '#000', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>
                      👑
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>System Admin</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Full System & Group Management Access</div>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.68rem', background: '#f59e0b', color: '#000', padding: '2px 8px', borderRadius: '10px', fontWeight: 800 }}>
                    Group Admin
                  </span>
                </div>
              </div>

              {/* Group Members Roster */}
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <UserCheck size={14} /> Screen Group Members ({groupInfo.members.length})
                </div>

                {loading ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading group roster…</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {groupInfo.members.map((u, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.6rem 0.85rem',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--border-light)',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justify: 'space-between'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: u.role === 'admin' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #0284c7, #2563eb)', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
                            {(u.username || u.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                              {u.username || u.name || 'Staff Member'}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              {u.role === 'admin' ? 'Administrator' : 'Staff Access'}
                            </div>
                          </div>
                        </div>

                        <span style={{
                          fontSize: '0.68rem',
                          background: u.role === 'admin' ? 'rgba(245,158,11,0.15)' : 'rgba(56,189,248,0.15)',
                          color: u.role === 'admin' ? '#f59e0b' : 'var(--primary)',
                          border: `1px solid ${u.role === 'admin' ? 'rgba(245,158,11,0.3)' : 'rgba(56,189,248,0.3)'}`,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontWeight: 700
                        }}>
                          {u.role === 'admin' ? 'Admin' : 'Member'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Footer */}
            <div style={{ padding: '0.85rem 1.25rem', background: 'rgba(0,0,0,0.15)', borderTop: '1px solid var(--border-light)', textAlign: 'right' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setShowRosterModal(false)}
                style={{ padding: '0.45rem 1.25rem', fontSize: '0.82rem' }}
              >
                Close Roster
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
