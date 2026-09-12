import React, { useState, useEffect } from 'react';
import {
  Users,
  Zap,
  Flame,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Mail,
  MapPin,
  Building,
  MessageSquare,
  Search,
  Filter,
  RefreshCw,
  Copy,
  Send,
  Trash2,
  Edit,
  ArrowRight,
  TrendingUp,
  Layers,
  ChevronRight,
  FileCode,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { api } from '../services/api';

const SAMPLE_INQUIRIES = [
  {
    label: '🔥 HOT Lead (Urgent Bulk Sublimation Order)',
    source: 'WhatsApp',
    text: `Hi, I am Suresh Patel from Patel Textiles, Surat. My phone number is 9825012345 and email is suresh@pateltex.com. We urgently need quotation for 2000 meters Rayon 58 Sublimation Printing. We have ready artwork and budget around Rs 1,50,000. Need delivery this week! Ready to place order today. Please call back ASAP.`
  },
  {
    label: '⚡ WARM Lead (Sample Yardage Inquiry)',
    source: 'Meta Ads',
    text: `Hello Elite Digital Print team, looking for digital fabric printing for sample yardage in Mumbai. We need around 150 meters Satin 58 fabric printing. Phone: 9819098765, email: info@mumbaifashionhouse.com. Kindly send your complete catalog and rate card.`
  },
  {
    label: '❄️ COLD Lead (General Rate Inquiry)',
    source: 'Web Form',
    text: `Hi, what is your rate per meter for printing?`
  }
];

export default function CrmPanel({ currentUser }) {
  const [activeTab, setActiveTab] = useState('ingest'); // 'ingest' | 'kanban' | 'leads'
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Ingestion State
  const [inquiryText, setInquiryText] = useState('');
  const [leadSource, setLeadSource] = useState('WhatsApp');
  const [qualifying, setQualifying] = useState(false);
  const [currentEvaluation, setCurrentEvaluation] = useState(null);
  const [jsonTab, setJsonTab] = useState(false);

  // Filters State for Lead List / Kanban
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [stageFilter, setStageFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected Lead for Detail Modal
  const [selectedLead, setSelectedLead] = useState(null);
  const [copiedResponse, setCopiedResponse] = useState(false);

  const fetchLeadsData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (priorityFilter !== 'All') params.priority = priorityFilter;
      if (stageFilter !== 'All') params.pipeline_stage = stageFilter;
      if (searchTerm) params.search = searchTerm;
      params.companyEntity = 'Elite Digital Print';

      const res = await api.getLeads(params);
      if (res.success) {
        setLeads(res.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch leads:', err);
      setError(err.message || 'Failed to load leads list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeadsData();
  }, [priorityFilter, stageFilter, searchTerm]);

  // Client-side + Server AI Qualification Trigger
  const handleQualifyLead = async () => {
    if (!inquiryText.trim()) {
      setError('Please enter or paste raw lead inquiry text to evaluate.');
      return;
    }

    setQualifying(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await api.ingestAndQualifyLead({
        rawInquiryText: inquiryText,
        lead_source: leadSource,
        companyEntity: 'Elite Digital Print'
      });

      if (res.success) {
        setCurrentEvaluation(res.evaluationJson || res.data);
        setSuccessMsg('Lead successfully qualified & scored by AI!');
        fetchLeadsData();
      } else {
        setError(res.error || 'Failed to qualify lead.');
      }
    } catch (err) {
      console.error('Lead evaluation error:', err);
      setError(err.message || 'Error occurred during lead qualification.');
    } finally {
      setQualifying(false);
    }
  };

  const handleStageChange = async (leadId, newStage) => {
    try {
      const res = await api.updateLead(leadId, {
        'qualification.pipeline_stage': newStage
      });
      if (res.success) {
        fetchLeadsData();
        if (selectedLead && selectedLead._id === leadId) {
          setSelectedLead(res.data);
        }
      }
    } catch (err) {
      alert('Failed to update stage: ' + err.message);
    }
  };

  const handleDeleteLead = async (leadId) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;
    try {
      const res = await api.deleteLead(leadId);
      if (res.success) {
        setLeads(leads.filter(l => l._id !== leadId));
        if (selectedLead && selectedLead._id === leadId) setSelectedLead(null);
      }
    } catch (err) {
      alert('Failed to delete lead: ' + err.message);
    }
  };

  const handleSendAutoReply = async (leadId) => {
    try {
      const res = await api.sendLeadAutoResponse(leadId);
      if (res.success) {
        setSuccessMsg('Auto-response logged & marked as Contacted!');
        fetchLeadsData();
        if (selectedLead && selectedLead._id === leadId) setSelectedLead(res.data);
      }
    } catch (err) {
      alert('Failed to log response: ' + err.message);
    }
  };

  const loadSample = (sample) => {
    setInquiryText(sample.text);
    setLeadSource(sample.source);
    setCurrentEvaluation(null);
    setSuccessMsg('');
    setError('');
  };

  // Metrics Calculation
  const totalLeads = leads.length;
  const hotLeads = leads.filter(l => l.qualification?.priority === 'HOT').length;
  const warmLeads = leads.filter(l => l.qualification?.priority === 'WARM').length;
  const coldLeads = leads.filter(l => l.qualification?.priority === 'COLD').length;
  const avgScore = totalLeads > 0 
    ? Math.round(leads.reduce((sum, l) => sum + (l.qualification?.lead_score || 0), 0) / totalLeads) 
    : 0;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '1.5rem 2rem', marginBottom: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(236,72,153,0.2), rgba(244,63,94,0.2))', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={24} />
            </div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, background: 'linear-gradient(135deg, #ec4899, #f43f5e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Elite Digital Print — Lead AI Qualification & CRM
            </h1>
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Ingest raw inquiries, score lead intent (0-100), determine priority SLA, and auto-generate instant responses.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button 
            onClick={() => setActiveTab('ingest')}
            className={activeTab === 'ingest' ? 'btn-primary' : 'btn-secondary'}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', fontWeight: 700, borderRadius: '10px' }}
          >
            <Zap size={18} /> ⚡ AI Lead Ingestion
          </button>
          <button 
            onClick={() => setActiveTab('kanban')}
            className={activeTab === 'kanban' ? 'btn-primary' : 'btn-secondary'}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', fontWeight: 700, borderRadius: '10px' }}
          >
            <Layers size={18} /> 📌 Pipeline Kanban
          </button>
          <button 
            onClick={() => setActiveTab('leads')}
            className={activeTab === 'leads' ? 'btn-primary' : 'btn-secondary'}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', fontWeight: 700, borderRadius: '10px' }}
          >
            <Users size={18} /> 📋 Leads Directory ({totalLeads})
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '14px', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
            <Users size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>Total Leads</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{totalLeads}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '14px', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
            <Flame size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>HOT Leads (SLA: 15m)</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ef4444' }}>{hotLeads}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '14px', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
            <Zap size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>WARM Leads (SLA: 4h)</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b' }}>{warmLeads}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '14px', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>COLD / Nurture</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#06b6d4' }}>{coldLeads}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '14px', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>Avg Lead Score</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981' }}>{avgScore} / 100</div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertTriangle size={20} />
          <span style={{ fontWeight: 600 }}>{error}</span>
        </div>
      )}
      {successMsg && (
        <div style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CheckCircle2 size={20} />
          <span style={{ fontWeight: 600 }}>{successMsg}</span>
        </div>
      )}

      {/* TAB 1: AI Lead Ingestion & Qualification */}
      {activeTab === 'ingest' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '1.5rem' }}>
          
          {/* Left Panel: Raw Inquiry Ingestion Form */}
          <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '16px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={20} color="#ec4899" /> Raw Lead Inquiry Ingestion
              </h3>
              <span style={{ fontSize: '0.8rem', padding: '4px 10px', borderRadius: '20px', background: 'rgba(236,72,153,0.15)', color: '#ec4899', fontWeight: 700 }}>
                AI Evaluator Active
              </span>
            </div>

            {/* Quick Sample Presets */}
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ⚡ Quick Test Inquiries (1-Click Fill)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {SAMPLE_INQUIRIES.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => loadSample(sample)}
                    style={{
                      padding: '0.6rem 0.9rem',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-main)',
                      textAlign: 'left',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontWeight: 600
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(236,72,153,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lead Source Selector */}
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                Lead Source Channel
              </label>
              <select
                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', background: 'var(--bg-input, rgba(255,255,255,0.05))', border: '1px solid var(--border-light)', color: 'var(--text-main)', fontWeight: 600 }}
                value={leadSource}
                onChange={e => setLeadSource(e.target.value)}
              >
                <option value="WhatsApp">WhatsApp Message</option>
                <option value="Meta Ads">Meta / Instagram Ads</option>
                <option value="Web Form">Website Inquiry Form</option>
                <option value="Referral">Direct Referral / Phone Call</option>
              </select>
            </div>

            {/* Inquiry Text Area */}
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                Raw Inquiry Message / Customer Notes
              </label>
              <textarea
                rows={7}
                placeholder="Paste unformatted customer inquiry text from WhatsApp, email, or web form here..."
                style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', background: 'var(--bg-input, rgba(0,0,0,0.2))', border: '1px solid var(--border-light)', color: 'var(--text-main)', fontSize: '0.92rem', lineHeight: 1.6, resize: 'vertical' }}
                value={inquiryText}
                onChange={e => setInquiryText(e.target.value)}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleQualifyLead}
                disabled={qualifying || !inquiryText.trim()}
                className="btn-primary"
                style={{ flex: 1, padding: '0.85rem', borderRadius: '12px', fontWeight: 800, fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.6rem' }}
              >
                {qualifying ? <RefreshCw className="spin" size={20} /> : <Zap size={20} />}
                {qualifying ? 'Evaluating & Scoring Lead...' : '⚡ Run AI Qualification & Score'}
              </button>

              <button
                onClick={() => { setInquiryText(''); setCurrentEvaluation(null); }}
                className="btn-secondary"
                style={{ padding: '0.85rem 1.25rem', borderRadius: '12px', fontWeight: 700 }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Right Panel: AI Qualification Results & JSON Inspector */}
          <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '16px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={20} color="#10b981" /> AI Qualification Output
              </h3>
              
              {currentEvaluation && (
                <div style={{ display: 'flex', gap: '0.4rem', background: 'rgba(255,255,255,0.06)', padding: '3px', borderRadius: '8px' }}>
                  <button
                    onClick={() => setJsonTab(false)}
                    style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: !jsonTab ? 'var(--primary, #ec4899)' : 'transparent', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Visual View
                  </button>
                  <button
                    onClick={() => setJsonTab(true)}
                    style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: jsonTab ? 'var(--primary, #ec4899)' : 'transparent', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <FileCode size={14} /> JSON Output
                  </button>
                </div>
              )}
            </div>

            {!currentEvaluation && !qualifying && (
              <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)', border: '2px dashed var(--border-light)', borderRadius: '16px' }}>
                <Zap size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Lead Evaluated Yet</div>
                <p style={{ fontSize: '0.9rem', maxWidth: '350px', margin: '0 auto' }}>
                  Select a test inquiry preset on the left or paste a message and click <strong>⚡ Run AI Qualification & Score</strong> to view lead score & auto-response draft.
                </p>
              </div>
            )}

            {qualifying && (
              <div style={{ padding: '5rem 2rem', textAlign: 'center' }}>
                <RefreshCw size={40} className="spin" color="#ec4899" style={{ marginBottom: '1rem' }} />
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Ingesting & Scoring Lead Attributes...</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                  Applying 0-100 scoring rules & generating SLA action plan
                </div>
              </div>
            )}

            {currentEvaluation && !qualifying && !jsonTab && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* Score & Priority Banner */}
                <div style={{
                  padding: '1.25rem',
                  borderRadius: '14px',
                  background: currentEvaluation.qualification?.priority === 'HOT'
                    ? 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(245,158,11,0.2))'
                    : currentEvaluation.qualification?.priority === 'WARM'
                    ? 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(16,185,129,0.2))'
                    : 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(59,130,246,0.2))',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontWeight: 900,
                        fontSize: '0.85rem',
                        letterSpacing: '0.05em',
                        background: currentEvaluation.qualification?.priority === 'HOT' ? '#ef4444' : currentEvaluation.qualification?.priority === 'WARM' ? '#f59e0b' : '#06b6d4',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {currentEvaluation.qualification?.priority === 'HOT' && <Flame size={14} />}
                        {currentEvaluation.qualification?.priority === 'WARM' && <Zap size={14} />}
                        {currentEvaluation.qualification?.priority === 'COLD' && <Clock size={14} />}
                        {currentEvaluation.qualification?.priority} PRIORITY
                      </span>

                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {currentEvaluation.qualification?.lead_intent}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.4rem' }}>
                      SLA Follow-up: <span style={{ color: '#ec4899', fontWeight: 800 }}>Within {currentEvaluation.action_plan?.sla_follow_up_hours < 1 ? '15 minutes' : currentEvaluation.action_plan?.sla_follow_up_hours + ' hours'}</span>
                    </div>
                  </div>

                  {/* Score Radial Box */}
                  <div style={{ textAlign: 'center', padding: '0.5rem 1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800 }}>Lead Score</div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 900, lineHeight: 1.1, color: currentEvaluation.qualification?.lead_score >= 70 ? '#ef4444' : currentEvaluation.qualification?.lead_score >= 40 ? '#f59e0b' : '#06b6d4' }}>
                      {currentEvaluation.qualification?.lead_score}
                      <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>/100</span>
                    </div>
                  </div>
                </div>

                {/* Extracted Profile Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>Contact Name</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{currentEvaluation.lead_profile?.full_name || 'Not provided'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>Phone Number</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Phone size={14} /> {currentEvaluation.lead_profile?.phone || 'Not provided'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>Product / Service</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{currentEvaluation.inquiry_details?.product_service_interest}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>Est Quantity / Budget</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      {currentEvaluation.inquiry_details?.estimated_quantity ? `${currentEvaluation.inquiry_details.estimated_quantity} units` : 'N/A'} {currentEvaluation.inquiry_details?.estimated_budget ? `(${currentEvaluation.inquiry_details.estimated_budget})` : ''}
                    </div>
                  </div>
                </div>

                {/* Scoring Breakdown Rules Checkboxes */}
                {currentEvaluation.scoring_breakdown && (
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                      📊 Score Breakdown Rules Applied (0 - 100)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <div style={{ color: currentEvaluation.scoring_breakdown.product_sku_matched ? '#34d399' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle2 size={15} /> Product / SKU Mention (+25)
                      </div>
                      <div style={{ color: currentEvaluation.scoring_breakdown.qty_or_budget_provided ? '#34d399' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle2 size={15} /> Order Qty / Budget (+25)
                      </div>
                      <div style={{ color: currentEvaluation.scoring_breakdown.high_urgency_detected ? '#34d399' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle2 size={15} /> High Urgency Timeline (+25)
                      </div>
                      <div style={{ color: currentEvaluation.scoring_breakdown.valid_contact_provided ? '#34d399' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle2 size={15} /> Valid Phone/Email/City (+15)
                      </div>
                      <div style={{ color: currentEvaluation.scoring_breakdown.business_or_bulk_inquiry ? '#34d399' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle2 size={15} /> Bulk / Business Inquiry (+10)
                      </div>
                    </div>
                  </div>
                )}

                {/* Auto Response Draft Box */}
                <div style={{ background: 'rgba(236,72,153,0.08)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(236,72,153,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ec4899', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MessageSquare size={16} /> Instant Auto-Response Draft ({currentEvaluation.auto_response_draft?.channel})
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(currentEvaluation.auto_response_draft?.message || '');
                        setCopiedResponse(true);
                        setTimeout(() => setCopiedResponse(false), 2000);
                      }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Copy size={14} /> {copiedResponse ? 'Copied!' : 'Copy Draft'}
                    </button>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: 1.5, fontStyle: 'italic', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                    "{currentEvaluation.auto_response_draft?.message}"
                  </p>
                </div>

              </div>
            )}

            {/* Standardized Raw Output JSON Inspector */}
            {currentEvaluation && !qualifying && jsonTab && (
              <div style={{ background: '#0f172a', padding: '1.25rem', borderRadius: '12px', border: '1px solid #1e293b', overflowX: 'auto' }}>
                <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.82rem', color: '#38bdf8', lineHeight: 1.5 }}>
                  {JSON.stringify(currentEvaluation, null, 2)}
                </pre>
              </div>
            )}

          </div>

        </div>
      )}

      {/* TAB 2: Lead Kanban Board */}
      {activeTab === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', alignItems: 'start' }}>
          {['New Lead', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost'].map(stage => {
            const stageLeads = leads.filter(l => (l.qualification?.pipeline_stage || 'New Lead') === stage);

            return (
              <div key={stage} className="glass-panel" style={{ padding: '1rem', borderRadius: '14px', border: '1px solid var(--border-light)', minHeight: '500px', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>{stage}</span>
                  <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', fontWeight: 700 }}>
                    {stageLeads.length}
                  </span>
                </div>

                {stageLeads.length === 0 && (
                  <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                    No leads in {stage}
                  </div>
                )}

                {stageLeads.map(lead => (
                  <div
                    key={lead._id}
                    onClick={() => setSelectedLead(lead)}
                    style={{
                      padding: '0.9rem',
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--border-light)',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.72rem',
                        fontWeight: 900,
                        background: lead.qualification?.priority === 'HOT' ? '#ef4444' : lead.qualification?.priority === 'WARM' ? '#f59e0b' : '#06b6d4',
                        color: '#fff'
                      }}>
                        {lead.qualification?.priority} ({lead.qualification?.lead_score} pts)
                      </span>

                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                      {lead.lead_profile?.full_name || 'Anonymous Inquiry'}
                    </div>

                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Tag size={13} /> {lead.inquiry_details?.product_service_interest}
                    </div>

                    {lead.lead_profile?.phone && (
                      <div style={{ fontSize: '0.82rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                        <Phone size={13} /> {lead.lead_profile.phone}
                      </div>
                    )}

                    {/* Quick Move Stage Selector */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <select
                        onClick={e => e.stopPropagation()}
                        onChange={e => handleStageChange(lead._id, e.target.value)}
                        value={stage}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        <option value="New Lead">New Lead</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Qualified">Qualified</option>
                        <option value="Proposal Sent">Proposal Sent</option>
                        <option value="Won">Won</option>
                        <option value="Lost">Lost</option>
                      </select>

                      <button
                        onClick={(e) => { e.stopPropagation(); handleSendAutoReply(lead._id); }}
                        style={{ background: 'rgba(236,72,153,0.15)', border: 'none', color: '#ec4899', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: Leads Directory Table */}
      {activeTab === 'leads' && (
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
          
          {/* Controls Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '250px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search leads..."
                  style={{ width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.2rem', borderRadius: '8px', background: 'var(--bg-input, rgba(255,255,255,0.05))', border: '1px solid var(--border-light)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              <select
                style={{ padding: '0.6rem', borderRadius: '8px', background: 'var(--bg-input, rgba(255,255,255,0.05))', border: '1px solid var(--border-light)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600 }}
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value)}
              >
                <option value="All">All Priorities</option>
                <option value="HOT">🔥 HOT Priority</option>
                <option value="WARM">⚡ WARM Priority</option>
                <option value="COLD">❄️ COLD Priority</option>
              </select>

              <select
                style={{ padding: '0.6rem', borderRadius: '8px', background: 'var(--bg-input, rgba(255,255,255,0.05))', border: '1px solid var(--border-light)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600 }}
                value={stageFilter}
                onChange={e => setStageFilter(e.target.value)}
              >
                <option value="All">All Pipeline Stages</option>
                <option value="New Lead">New Lead</option>
                <option value="Contacted">Contacted</option>
                <option value="Qualified">Qualified</option>
                <option value="Proposal Sent">Proposal Sent</option>
                <option value="Won">Won</option>
                <option value="Lost">Lost</option>
              </select>
            </div>

            <button onClick={fetchLeadsData} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem' }}>
              <RefreshCw size={16} /> Refresh Directory
            </button>
          </div>

          {/* Leads Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.8rem' }}>Lead Score</th>
                  <th style={{ padding: '0.8rem' }}>Lead Name & Contact</th>
                  <th style={{ padding: '0.8rem' }}>Product Interest</th>
                  <th style={{ padding: '0.8rem' }}>Est Qty / Budget</th>
                  <th style={{ padding: '0.8rem' }}>Source</th>
                  <th style={{ padding: '0.8rem' }}>Pipeline Stage</th>
                  <th style={{ padding: '0.8rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No leads matching selected filters. Use ⚡ AI Lead Ingestion tab to evaluate raw inquiries!
                    </td>
                  </tr>
                )}

                {leads.map(lead => (
                  <tr key={lead._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '0.8rem' }}>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 900,
                        background: lead.qualification?.priority === 'HOT' ? '#ef4444' : lead.qualification?.priority === 'WARM' ? '#f59e0b' : '#06b6d4',
                        color: '#fff'
                      }}>
                        {lead.qualification?.priority} ({lead.qualification?.lead_score} pts)
                      </span>
                    </td>
                    <td style={{ padding: '0.8rem' }}>
                      <div style={{ fontWeight: 700 }}>{lead.lead_profile?.full_name || 'Anonymous'}</div>
                      <div style={{ fontSize: '0.8rem', color: '#10b981' }}>{lead.lead_profile?.phone || lead.lead_profile?.email || 'No Contact'}</div>
                    </td>
                    <td style={{ padding: '0.8rem', fontWeight: 600 }}>
                      {lead.inquiry_details?.product_service_interest}
                    </td>
                    <td style={{ padding: '0.8rem' }}>
                      {lead.inquiry_details?.estimated_quantity ? `${lead.inquiry_details.estimated_quantity} units` : '-'}
                    </td>
                    <td style={{ padding: '0.8rem', color: 'var(--text-muted)' }}>
                      {lead.inquiry_details?.lead_source}
                    </td>
                    <td style={{ padding: '0.8rem' }}>
                      <select
                        value={lead.qualification?.pipeline_stage || 'New Lead'}
                        onChange={e => handleStageChange(lead._id, e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-light)', color: 'var(--text-main)', fontSize: '0.8rem', fontWeight: 700 }}
                      >
                        <option value="New Lead">New Lead</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Qualified">Qualified</option>
                        <option value="Proposal Sent">Proposal Sent</option>
                        <option value="Won">Won</option>
                        <option value="Lost">Lost</option>
                      </select>
                    </td>
                    <td style={{ padding: '0.8rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          onClick={() => setSelectedLead(lead)}
                          style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDeleteLead(lead._id)}
                          style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Selected Lead Modal / Drawer */}
      {selectedLead && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '650px', borderRadius: '20px', border: '1px solid var(--border-light)', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontWeight: 900,
                  fontSize: '0.85rem',
                  background: selectedLead.qualification?.priority === 'HOT' ? '#ef4444' : selectedLead.qualification?.priority === 'WARM' ? '#f59e0b' : '#06b6d4',
                  color: '#fff'
                }}>
                  {selectedLead.qualification?.priority} ({selectedLead.qualification?.lead_score} pts)
                </span>
                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>
                  {selectedLead.lead_profile?.full_name || 'Lead Details'}
                </h3>
              </div>

              <button
                onClick={() => setSelectedLead(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', fontWeight: 800 }}
              >
                ✕
              </button>
            </div>

            {/* Lead Raw Inquiry */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Raw Inquiry Message</div>
              <div style={{ padding: '0.85rem', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', fontSize: '0.9rem', lineHeight: 1.6, border: '1px solid var(--border-light)' }}>
                {selectedLead.rawInquiryText}
              </div>
            </div>

            {/* Action Plan & Auto Response */}
            <div style={{ background: 'rgba(236,72,153,0.1)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(236,72,153,0.3)' }}>
              <div style={{ fontWeight: 800, color: '#ec4899', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                Recommended Sales Action Plan
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.6rem' }}>
                👉 {selectedLead.action_plan?.next_action}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Draft Reply ({selectedLead.auto_response_draft?.channel}): "{selectedLead.auto_response_draft?.message}"
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
              {selectedLead.lead_profile?.phone && (
                <a
                  href={`https://wa.me/${selectedLead.lead_profile.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(selectedLead.auto_response_draft?.message || '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary"
                  style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', padding: '0.6rem 1.25rem', borderRadius: '10px', fontWeight: 700 }}
                >
                  <MessageSquare size={16} /> Open WhatsApp Direct
                </a>
              )}
              <button onClick={() => setSelectedLead(null)} className="btn-secondary" style={{ padding: '0.6rem 1.25rem', borderRadius: '10px', fontWeight: 700 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
