import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import {
  Printer, Calculator, CheckCircle2, Clock, AlertCircle, FileText, Send,
  Paperclip, Image, MessageSquare, Layers, Cpu, Eye, Check, X, RefreshCw,
  User, ShieldCheck, Tag, ArrowRight, Download, Bot
} from 'lucide-react';

const PRODUCTION_STAGES = [
  'Order Received',
  'File Ready/Proofing',
  'Printing',
  'Heat Press/Finishing',
  'Quality Check',
  'Ready for Dispatch'
];

export default function EliteDigitalPrintsSplitView({ initialJobCard = null }) {
  const socket = useSocket();
  const currentUser = api.getCurrentUser() || { name: 'Operator', role: 'Operator' };

  // Selected Job Card & List
  const [jobCards, setJobCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(initialJobCard);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Module 1: Calculator State
  const [calcForm, setCalcForm] = useState({
    width: 36,
    height: 48,
    unit: 'inch',
    materialType: 'Sublimation',
    resolutionPass: '4 Pass',
    wastageFactorPct: 5,
    quantity: 10
  });

  const [calcResult, setCalcResult] = useState(null);
  const [calculating, setCalculating] = useState(false);

  // Module 2: Workspace & Chat State
  const [activeChannel, setActiveChannel] = useState('order-thread'); // 'order-thread', '#sales-team', '#design-studio', '#press-operators', '#dispatch-logistics'
  const [chatMessages, setChatMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [typingUser, setTypingUser] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const chatEndRef = useRef(null);

  // Load Job Cards
  const loadJobCards = async () => {
    setLoading(true);
    try {
      const res = await api.getJobCards({ search, limit: 30 });
      if (res.data) {
        setJobCards(res.data);
        if (!selectedCard && res.data.length > 0) {
          setSelectedCard(res.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load job cards:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobCards();
  }, [search]);

  // Run Calculator
  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const res = await api.calculatePrintCost(calcForm);
      if (res.data) {
        setCalcResult(res.data);
      }
    } catch (err) {
      console.error('Calculator error:', err);
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    handleCalculate();
  }, [calcForm.width, calcForm.height, calcForm.unit, calcForm.materialType, calcForm.resolutionPass, calcForm.wastageFactorPct, calcForm.quantity]);

  // Apply Calculator values to current Job Card
  const handleApplyCalcToCard = async () => {
    if (!selectedCard || !calcResult) return;
    try {
      const updatedSpecs = {
        printSpecifications: {
          width: parseFloat(calcForm.width),
          height: parseFloat(calcForm.height),
          dimensionsUnit: calcForm.unit,
          totalSqFt: calcResult.billableSqFt,
          totalSqMtr: calcResult.billableSqMtr,
          materialType: calcForm.materialType,
          resolutionPass: calcForm.resolutionPass,
          wastageFactorPct: parseFloat(calcForm.wastageFactorPct),
          unitPricePerSqFt: calcResult.ratePerSqFt,
          totalCalculatedCost: calcResult.totalCalculatedCost
        }
      };

      const res = await api.updateJobCard(selectedCard._id, updatedSpecs);
      setSelectedCard(res.data || { ...selectedCard, ...updatedSpecs });
      alert('Cost calculation applied to Job Card #' + selectedCard.jobNo);
    } catch (err) {
      alert(err.message || 'Failed to apply cost to Job Card');
    }
  };

  // Stage Transition Handler (Socket-driven)
  const handleStageChange = async (newStage) => {
    if (!selectedCard) return;
    try {
      // 1. Send API update
      await api.updateJobStage(selectedCard._id, {
        newStage,
        notes: `Transitioned to ${newStage}`
      });

      // 2. Emit Socket.io Event for real-time bot log & live update across clients
      if (socket) {
        socket.emit('update-production-stage', {
          jobCardId: selectedCard._id,
          newStage,
          actorId: currentUser._id || currentUser.id,
          actorName: currentUser.name || currentUser.username || 'Operator'
        });
      }

      setSelectedCard(prev => ({ ...prev, productionStage: newStage }));
    } catch (err) {
      alert(err.message || 'Failed to update stage');
    }
  };

  // Proof Approval Handler
  const handleProofingStatus = async (status, feedback = '') => {
    if (!selectedCard) return;
    try {
      await api.updateJobProofing(selectedCard._id, {
        approvalStatus: status,
        clientFeedback: feedback
      });

      if (socket) {
        socket.emit('update-proof-approval', {
          jobCardId: selectedCard._id,
          status,
          clientFeedback: feedback,
          actorName: currentUser.name || 'Client'
        });
      }

      setSelectedCard(prev => ({
        ...prev,
        proofing: { ...(prev.proofing || {}), approvalStatus: status, clientFeedback: feedback }
      }));
    } catch (err) {
      alert(err.message || 'Failed to update proofing status');
    }
  };

  // Socket Setup for Real-Time Contextual Chat & Board Sync
  useEffect(() => {
    if (!socket || !selectedCard) return;

    const roomId = selectedCard.orderChatRoomId || selectedCard._id;
    socket.emit('join-room', roomId);

    const handleReceiveMessage = (msg) => {
      setChatMessages(prev => [...prev, msg]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    const handleJobStageUpdated = (data) => {
      if (data.jobCardId === selectedCard._id) {
        setSelectedCard(prev => ({ ...prev, productionStage: data.newStage }));
      }
    };

    const handleProofStatusUpdated = (data) => {
      if (data.jobCardId === selectedCard._id) {
        setSelectedCard(prev => ({
          ...prev,
          proofing: { ...(prev.proofing || {}), approvalStatus: data.status, clientFeedback: data.clientFeedback }
        }));
      }
    };

    socket.on('receive-message', handleReceiveMessage);
    socket.on('job-stage-updated', handleJobStageUpdated);
    socket.on('proof-status-updated', handleProofStatusUpdated);

    return () => {
      socket.off('receive-message', handleReceiveMessage);
      socket.off('job-stage-updated', handleJobStageUpdated);
      socket.off('proof-status-updated', handleProofStatusUpdated);
    };
  }, [socket, selectedCard?._id]);

  // Send Chat Message Handler
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedCard || !socket) return;

    const roomId = selectedCard.orderChatRoomId || selectedCard._id;
    socket.emit('send-message', {
      roomId,
      senderId: currentUser._id || currentUser.id,
      content: messageInput
    });

    setMessageInput('');
  };

  // File Upload Handler for Chat Attachment
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedCard) return;
    setUploadingFile(true);
    try {
      const res = await api.uploadImage(file);
      const fileUrl = res.url || res.imageUrl;

      const roomId = selectedCard.orderChatRoomId || selectedCard._id;
      socket.emit('send-message', {
        roomId,
        senderId: currentUser._id || currentUser.id,
        content: `📁 Uploaded file: **${file.name}**`,
        attachment: {
          fileName: file.name,
          fileType: file.type,
          fileUrl,
          fileSize: file.size
        }
      });
    } catch (err) {
      alert('Failed to upload file');
    } finally {
      setUploadingFile(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1.25rem', height: 'calc(100vh - 120px)' }}>
      
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* LEFT PANEL: ELITE DIGITAL PRINTS JOB BILLING & PROOFING ENGINE (60%) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingRight: '0.2rem' }}>
        
        {/* Header Job Selector */}
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#38bdf8,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Printer size={20} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {selectedCard ? `Job Card — #${selectedCard.jobNo}` : 'Select Job Card'}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>
                {selectedCard ? `Party: ${selectedCard.party || 'Standard Client'} • Design: ${selectedCard.designName || selectedCard.designNo || 'Custom'}` : 'Select an order to view execution engine'}
              </p>
            </div>
          </div>

          {/* Search/Select Job Dropdown */}
          <select
            value={selectedCard?._id || ''}
            onChange={e => {
              const matched = jobCards.find(c => c._id === e.target.value);
              if (matched) setSelectedCard(matched);
            }}
            style={{ padding: '0.45rem 0.8rem', fontSize: '0.82rem', background: 'var(--bg-input, #161b26)', border: '1px solid var(--border-light)', borderRadius: 6, color: 'var(--text-primary)', fontWeight: 700 }}
          >
            {jobCards.map(c => (
              <option key={c._id} value={c._id}>#{c.jobNo} - {c.party || 'Client'} ({c.designName || c.designNo || 'Design'})</option>
            ))}
          </select>
        </div>

        {/* 1. DYNAMIC CUSTOM PRINTING COST CALCULATOR */}
        <div className="glass-panel" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', borderLeft: '4px solid #38bdf8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase' }}>
              <Calculator size={16} /> Dynamic Printing Cost & Wastage Calculator
            </div>
            <button className="btn-secondary" onClick={handleApplyCalcToCard} style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
              Apply Cost to Job Card
            </button>
          </div>

          {/* Calculator Form Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem' }}>
            <div>
              <label style={labelStyle}>Width</label>
              <input type="number" value={calcForm.width} onChange={e => setCalcForm(f => ({ ...f, width: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Height</label>
              <input type="number" value={calcForm.height} onChange={e => setCalcForm(f => ({ ...f, height: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Unit</label>
              <select value={calcForm.unit} onChange={e => setCalcForm(f => ({ ...f, unit: e.target.value }))} style={inputStyle}>
                <option value="inch">Inches (in)</option>
                <option value="ft">Feet (ft)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Material</label>
              <select value={calcForm.materialType} onChange={e => setCalcForm(f => ({ ...f, materialType: e.target.value }))} style={inputStyle}>
                <option value="Sublimation">Sublimation Paper</option>
                <option value="Cotton">Cotton Digital</option>
                <option value="Vinyl">Vinyl Print</option>
                <option value="Satin">Satin Fabric</option>
                <option value="Silk">Silk Fabric</option>
                <option value="Polyester">Polyester</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Resolution / Pass</label>
              <select value={calcForm.resolutionPass} onChange={e => setCalcForm(f => ({ ...f, resolutionPass: e.target.value }))} style={inputStyle}>
                <option value="1 Pass">1 Pass (Speed Draft)</option>
                <option value="2 Pass">2 Pass (Standard)</option>
                <option value="4 Pass">4 Pass (High Quality)</option>
                <option value="6 Pass">6 Pass (Fine Detail)</option>
                <option value="8 Pass">8 Pass (Ultra HD)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Wastage %</label>
              <input type="number" value={calcForm.wastageFactorPct} onChange={e => setCalcForm(f => ({ ...f, wastageFactorPct: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Quantity</label>
              <input type="number" value={calcForm.quantity} onChange={e => setCalcForm(f => ({ ...f, quantity: e.target.value }))} style={inputStyle} />
            </div>
          </div>

          {/* Calculator Results Box */}
          {calcResult && (
            <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px dashed rgba(56,189,248,0.3)', borderRadius: 8, padding: '0.75rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Billable Sq. Ft:</span>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{calcResult.billableSqFt} <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>sq ft ({calcResult.billableSqMtr} m²)</span></div>
              </div>
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Rate / Sq. Ft:</span>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>₹ {calcResult.ratePerSqFt}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Wastage Allowance:</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f59e0b' }}>+{calcResult.wastageSqFt} sq ft ({calcForm.wastageFactorPct}%)</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>TOTAL ESTIMATED PRICE</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#34d399' }}>₹ {calcResult.totalCalculatedCost.toLocaleString('en-IN')}</div>
              </div>
            </div>
          )}
        </div>

        {/* 2. DIGITAL JOB CARD PRODUCTION STAGE STEPPER */}
        {selectedCard && (
          <div className="glass-panel" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>
              ⚙️ Production Pipeline Stage Tracker
            </div>

            {/* Stepper Steps */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.4rem', marginTop: '0.2rem' }}>
              {PRODUCTION_STAGES.map((st, idx) => {
                const currentIdx = PRODUCTION_STAGES.indexOf(selectedCard.productionStage || 'Order Received');
                const isPassed = idx <= currentIdx;
                const isCurrent = idx === currentIdx;

                return (
                  <button
                    key={st}
                    onClick={() => handleStageChange(st)}
                    style={{
                      padding: '0.5rem 0.2rem',
                      borderRadius: 6,
                      border: '1px solid',
                      borderColor: isCurrent ? '#38bdf8' : isPassed ? 'rgba(52,211,153,0.4)' : 'var(--border-light)',
                      background: isCurrent ? 'rgba(56,189,248,0.2)' : isPassed ? 'rgba(16,185,129,0.1)' : 'transparent',
                      color: isCurrent ? '#38bdf8' : isPassed ? '#34d399' : 'var(--text-muted)',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span>Stage {idx + 1}</span>
                    <span style={{ textAlign: 'center', lineHeight: 1.1 }}>{st}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. PROOFING & ARTWORK APPROVAL PIPELINE */}
        {selectedCard && (
          <div className="glass-panel" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>
                🎨 Artwork Proofing & Approval Pipeline
              </div>
              <span style={{
                padding: '0.2rem 0.6rem',
                borderRadius: 6,
                fontSize: '0.68rem',
                fontWeight: 800,
                background: selectedCard.proofing?.approvalStatus === 'Approved' ? 'rgba(16,185,129,0.15)' : selectedCard.proofing?.approvalStatus === 'Revision Requested' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                color: selectedCard.proofing?.approvalStatus === 'Approved' ? '#34d399' : selectedCard.proofing?.approvalStatus === 'Revision Requested' ? '#f87171' : '#fbbf24',
                border: `1px solid ${selectedCard.proofing?.approvalStatus === 'Approved' ? 'rgba(16,185,129,0.3)' : selectedCard.proofing?.approvalStatus === 'Revision Requested' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`
              }}>
                Proof Status: {selectedCard.proofing?.approvalStatus || 'Pending'}
              </span>
            </div>

            {/* Artwork Preview Link */}
            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
              <input
                type="text"
                value={selectedCard.proofing?.artworkUrl || selectedCard.imageUrl1 || ''}
                onChange={e => setSelectedCard(prev => ({ ...prev, proofing: { ...(prev.proofing || {}), artworkUrl: e.target.value } }))}
                placeholder="Paste Drive / CDN Artwork File URL (PNG, PDF, TIFF)..."
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                className="btn-secondary"
                onClick={() => handleProofingStatus(selectedCard.proofing?.approvalStatus || 'Pending', selectedCard.proofing?.clientFeedback)}
                style={{ padding: '0.5rem 0.9rem', fontSize: '0.78rem' }}
              >
                Save File
              </button>
            </div>

            {/* Approval Action Buttons */}
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.2rem' }}>
              <button
                onClick={() => handleProofingStatus('Approved')}
                style={{
                  flex: 1,
                  padding: '0.55rem',
                  borderRadius: 6,
                  border: 'none',
                  background: '#10b981',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <CheckCircle2 size={15} /> Approve Proof
              </button>
              <button
                onClick={() => {
                  const fb = window.prompt('Enter Revision Instructions for Design Team:');
                  if (fb) handleProofingStatus('Revision Requested', fb);
                }}
                style={{
                  flex: 1,
                  padding: '0.55rem',
                  borderRadius: 6,
                  border: 'none',
                  background: '#ef4444',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <AlertCircle size={15} /> Request Revision
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* RIGHT PANEL: CONTEXTUAL WORKSPACE & CHAT COLLABORATION (40%)      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        
        {/* Channel Navigation Bar */}
        <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.02)', display: 'flex', gap: '0.4rem', overflowX: 'auto' }}>
          {[
            { id: 'order-thread', label: selectedCard ? `💬 Order #${selectedCard.jobNo}` : '💬 Order Thread' },
            { id: '#sales-team', label: '#sales-team' },
            { id: '#design-studio', label: '#design-studio' },
            { id: '#press-operators', label: '#press-operators' },
            { id: '#dispatch-logistics', label: '#dispatch' }
          ].map(ch => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch.id)}
              style={{
                padding: '0.4rem 0.7rem',
                borderRadius: 6,
                fontSize: '0.75rem',
                fontWeight: 700,
                border: '1px solid',
                borderColor: activeChannel === ch.id ? '#38bdf8' : 'var(--border-light)',
                background: activeChannel === ch.id ? 'rgba(56,189,248,0.15)' : 'transparent',
                color: activeChannel === ch.id ? '#38bdf8' : 'var(--text-muted)',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {ch.label}
            </button>
          ))}
        </div>

        {/* Live Chat Stream */}
        <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {chatMessages.length === 0 ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              <MessageSquare size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
              <div>No messages yet in this contextual thread.</div>
              <div style={{ fontSize: '0.72rem', marginTop: 2 }}>Discuss status, proofs, and artwork files in real time.</div>
            </div>
          ) : (
            chatMessages.map((msg, idx) => {
              const isBot = msg.content && msg.content.includes('🤖');
              const isMe = String(msg.senderId?._id || msg.senderId) === String(currentUser._id || currentUser.id);

              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  
                  {/* Sender Name & Role */}
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2, display: 'flex', gap: '6px' }}>
                    <span style={{ fontWeight: 700 }}>{msg.senderId?.name || msg.senderId?.username || 'Team Member'}</span>
                    <span style={{ background: 'rgba(255,255,255,0.06)', padding: '0 4px', borderRadius: 4 }}>{currentUser.role || 'Member'}</span>
                  </div>

                  {/* Message Content Bubble */}
                  <div style={{
                    maxWidth: '85%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 10,
                    fontSize: '0.82rem',
                    background: isBot ? 'rgba(245,158,11,0.12)' : isMe ? 'linear-gradient(135deg,#38bdf8,#2563eb)' : 'var(--bg-input, #161b26)',
                    color: isBot ? '#fbbf24' : isMe ? '#fff' : 'var(--text-primary)',
                    border: `1px solid ${isBot ? 'rgba(245,158,11,0.3)' : isMe ? 'transparent' : 'var(--border-light)'}`,
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    {msg.content}

                    {/* Attachment rendering */}
                    {msg.attachment?.fileUrl && (
                      <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <a href={msg.attachment.fileUrl} target="_blank" rel="noreferrer" style={{ color: isMe ? '#fff' : '#38bdf8', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Paperclip size={12} /> {msg.attachment.fileName}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-light)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label title="Attach File" style={{ cursor: 'pointer', padding: '0.45rem', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-light)' }}>
            <Paperclip size={16} color="var(--text-muted)" />
            <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>

          <input
            type="text"
            value={messageInput}
            onChange={e => setMessageInput(e.target.value)}
            placeholder={`Message ${activeChannel}...`}
            style={{ ...inputStyle, flex: 1 }}
          />

          <button type="submit" className="btn-primary" style={{ padding: '0.5rem 0.9rem', borderRadius: 6 }}>
            <Send size={15} />
          </button>
        </form>

      </div>

    </div>
  );
}

const labelStyle = {
  fontSize: '0.68rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  marginBottom: '0.25rem',
  display: 'block'
};

const inputStyle = {
  width: '100%',
  padding: '0.45rem 0.65rem',
  fontSize: '0.82rem',
  background: 'var(--bg-input, #161b26)',
  border: '1px solid var(--border-light, #2d3748)',
  borderRadius: '6px',
  color: 'var(--text-primary, #f7fafc)',
  boxSizing: 'border-box'
};
