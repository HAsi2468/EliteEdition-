import React, { useState } from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal, Plus, X, Image, Smile } from 'lucide-react';
import { api } from '../services/api';

const DEMO_POSTS = [
  { id: 'p1', author: 'Harshit Sidapara', role: 'Admin', avatar: 'HS', color: '#6366f1', time: '2m ago', content: '🎉 Job Card EDP-1094 successfully completed! Great work by the production team. 240 Kurta Sets delivered on time.', likes: 12, comments: 3, liked: false, media: null },
  { id: 'p2', author: 'Production Team', role: 'Production', avatar: 'PT', color: '#22c55e', time: '1h ago', content: 'Fabric inward for the new Winter batch is done. Total 8,500 meters of premium cotton received from Surat suppliers. Quality check passed ✅', likes: 8, comments: 1, liked: false, media: null },
  { id: 'p3', author: 'QA Department', role: 'QA', avatar: 'QA', color: '#f59e0b', time: '3h ago', content: '⚠️ QA Alert: Batch B-1052 has 3 rejected pieces. Stitching defect noted in neck area. Rework in progress. Estimated completion: tomorrow EOD.', likes: 5, comments: 7, liked: false, media: null },
  { id: 'p4', author: 'Design Department', role: 'Designer', avatar: 'DD', color: '#a855f7', time: '5h ago', content: '🎨 Winter 2026 catalogue is now ready! 48 new designs across Kurta Sets, Anarkalis, and Lehengas. Sending for review today.', likes: 21, comments: 9, liked: true, media: null },
  { id: 'p5', author: 'Accounts Dept', role: 'Accounts', avatar: 'AC', color: '#38bdf8', time: '1d ago', content: '💰 Monthly billing for September is complete. Total invoices raised: ₹24.8L. Collections pending: ₹6.2L. Follow-up required with 3 parties.', likes: 4, comments: 2, liked: false, media: null },
];

const COLORS = ['#6366f1','#38bdf8','#22c55e','#f59e0b','#ec4899','#a855f7','#ef4444'];

export default function ActivityFeed({ currentUser }) {
  const [posts, setPosts] = useState(DEMO_POSTS);
  const [showCompose, setShowCompose] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [expandedComments, setExpandedComments] = useState({});

  const toggleLike = (id) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p));
  };

  const submitPost = () => {
    if (!newPost.trim()) return;
    const post = {
      id: `p${Date.now()}`,
      author: currentUser?.name || 'You',
      role: currentUser?.role || 'Staff',
      avatar: (currentUser?.name || 'Y').slice(0,2).toUpperCase(),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      time: 'just now',
      content: newPost.trim(),
      likes: 0, comments: 0, liked: false, media: null,
    };
    setPosts(prev => [post, ...prev]);
    setNewPost('');
    setShowCompose(false);
  };

  const userInitials = (currentUser?.name || 'U').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const userColor = '#6366f1';

  return (
    <div style={{ display: 'flex', gap: '1.25rem', height: '100%', overflow: 'auto' }}>
      {/* Feed */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Compose box */}
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: userColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.88rem', color: '#fff', flexShrink: 0 }}>
              {userInitials}
            </div>
            {showCompose ? (
              <div style={{ flex: 1 }}>
                <textarea value={newPost} onChange={e => setNewPost(e.target.value)} placeholder="Share an update with your team..." rows={3} autoFocus
                  style={{ width: '100%', resize: 'none', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '0.65rem 0.9rem', color: 'var(--text-primary)', fontSize: '0.88rem', fontFamily: 'var(--font-sans)', outline: 'none', lineHeight: 1.5 }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button onClick={() => setShowCompose(false)} style={{ padding: '0.4rem 0.8rem', borderRadius: '7px', background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={submitPost} style={{ padding: '0.4rem 0.9rem', borderRadius: '7px', background: 'linear-gradient(135deg,#6366f1,#38bdf8)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>Post</button>
                </div>
              </div>
            ) : (
              <div onClick={() => setShowCompose(true)} style={{ flex: 1, padding: '0.6rem 1rem', borderRadius: '999px', border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'text' }}>
                What's happening in production today?
              </div>
            )}
          </div>
        </div>

        {/* Posts */}
        {posts.map(post => (
          <div key={post.id} className="feed-card">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: post.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.88rem', color: '#fff', flexShrink: 0 }}>
                  {post.avatar}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>{post.author}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{post.role} · {post.time}</div>
                </div>
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}><MoreHorizontal size={16} /></button>
            </div>
            {/* Content */}
            <div style={{ padding: '0.75rem 1rem', fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.65 }}>
              {post.content}
            </div>
            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', padding: '0 0.6rem 0.75rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.6rem' }}>
              <button onClick={() => toggleLike(post.id)} className={`feed-action-btn${post.liked ? ' liked' : ''}`}>
                <Heart size={14} fill={post.liked ? '#f87171' : 'none'} /> {post.likes}
              </button>
              <button onClick={() => setExpandedComments(p => ({...p, [post.id]: !p[post.id]}))} className="feed-action-btn">
                <MessageCircle size={14} /> {post.comments}
              </button>
              <button className="feed-action-btn"><Share2 size={14} /> Share</button>
            </div>
            {/* Comments placeholder */}
            {expandedComments[post.id] && (
              <div style={{ padding: '0.5rem 1rem 0.85rem', borderTop: '1px solid var(--border-light)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center', padding: '0.5rem 0' }}>
                  {post.comments > 0 ? `${post.comments} comments — open Communication module to reply` : 'No comments yet. Be the first!'}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Sidebar */}
      <div style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Active users */}
        <div className="glass-panel" style={{ padding: '0.85rem' }}>
          <div style={{ fontWeight: 800, fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.65rem' }}>Active Now</div>
          {['Harshit', 'Ravi K.', 'Priya D.', 'Ankit M.'].map((name, i) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.45rem' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: COLORS[i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#fff' }}>
                  {name.split(' ').map(w=>w[0]).join('')}
                </div>
                <div className="presence-dot online" style={{ position: 'absolute', bottom: 0, right: 0 }} />
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
            </div>
          ))}
        </div>

        {/* Quick stats */}
        <div className="glass-panel" style={{ padding: '0.85rem' }}>
          <div style={{ fontWeight: 800, fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.65rem' }}>Today's Activity</div>
          {[
            { label: 'Posts', value: '12', color: '#6366f1' },
            { label: 'Job Cards Updated', value: '8', color: '#22c55e' },
            { label: 'QA Passed', value: '6', color: '#38bdf8' },
            { label: 'Alerts', value: '2', color: '#f87171' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{s.label}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
