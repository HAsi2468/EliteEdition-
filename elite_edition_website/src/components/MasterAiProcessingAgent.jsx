import React, { useState } from 'react';
import {
  Sparkles,
  Bot,
  CheckCircle,
  Copy,
  Database,
  Send,
  User,
  Building2,
  Briefcase,
  Wrench,
  AlertCircle,
  Clock,
  Flame,
  MessageSquare,
  RefreshCw,
  Zap,
  ArrowRight,
  Check,
  ShieldCheck,
  FileCode
} from 'lucide-react';
import { api } from '../services/api';

const SAMPLE_PRESETS = [
  {
    id: 'preset_lead',
    label: 'Lead Inquiry (WhatsApp)',
    icon: MessageSquare,
    badge: 'LEAD',
    color: '#3b82f6',
    text: `From: Rahul Mehta (+91 98251 44321)
Location: Ring Road Textile Market, Surat, Gujarat
Email: rahul@mehtafashions.com

Message:
Hi team, we are interested in digital printing on 500 meters of pure cotton satin fabric for our summer collection. Please send your design catalog, fabric sample card, and best per meter pricing. Needs urgent delivery next week.`
  },
  {
    id: 'preset_vendor',
    label: 'Vendor Offer (Inks & Fabric)',
    icon: Building2,
    badge: 'VENDOR',
    color: '#8b5cf6',
    text: `Supplier Name: Apex Dyechem Pvt Ltd
Contact: Suresh Patel (Phone: +91 94261 11223)
City: Ahmedabad, Gujarat
Email: suresh@apexdyechem.com

Tax & Payment Details:
GSTIN: 24AAACA1234F1Z9
Bank: HDFC Bank (A/C: 50200012345678, IFSC: HDFC0000123)
UPI: apex@hdfcbank
Payment Terms: Net 30 days
Supply Category: Digital Sublimation Printing Inks, Solvents & Coating Chemicals`
  },
  {
    id: 'preset_employee',
    label: 'Employee Application',
    icon: Briefcase,
    badge: 'EMPLOYEE',
    color: '#10b981',
    text: `Applicant Name: Anjali Verma
Phone: +91 97123 88990
Email: anjali.design@gmail.com
City: Surat

Details:
Joining Department: Design Department
Designation: Senior CAD Textile Print Designer
Monthly Expected Salary: Rs 42,000 per month
Joining Date: 2026-10-01
Emergency Contact: +91 98980 12345 (Father)`
  },
  {
    id: 'preset_worker',
    label: 'Worker Floor Setup',
    icon: Wrench,
    badge: 'WORKER',
    color: '#f59e0b',
    text: `Worker Name: Vikram Singh Operator
Phone: +91 91060 55443
City: Surat, Gujarat

Workstation Details:
Station / Skill: High-Speed Digital Fabric Printing Machine Operator
Wage Model: DAILY_WAGE
Daily Rate: Rs 850 / day
Payout Schedule: WEEKLY (Every Saturday)`
  }
];

export default function MasterAiProcessingAgent() {
  const [inputText, setInputText] = useState(SAMPLE_PRESETS[0].text);
  const [loading, setLoading] = useState(false);
  const [processedResult, setProcessedResult] = useState(null);
  const [rawJsonText, setRawJsonText] = useState('');
  const [processingMode, setProcessingMode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedReply, setCopiedReply] = useState(false);
  const [upserting, setUpserting] = useState(false);
  const [upsertSuccess, setUpsertSuccess] = useState(null);
  const [history, setHistory] = useState([]);

  const handleProcessInput = async () => {
    if (!inputText.trim()) {
      setErrorMsg('Please enter or select a payload text to process.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setUpsertSuccess(null);

    try {
      const res = await api.processMasterAiInput({ inputText });
      if (res && res.data) {
        setProcessedResult(res.data);
        setRawJsonText(JSON.stringify(res.data, null, 2));
        setProcessingMode(res.mode || 'AI Processing');
        
        // Add to history
        setHistory(prev => [
          {
            id: Date.now(),
            timestamp: new Date().toLocaleTimeString(),
            record_type: res.data.record_type,
            name: res.data.common_directory?.name || 'Unknown',
            mode: res.mode
          },
          ...prev.slice(0, 9)
        ]);
      } else {
        throw new Error('Invalid response structure from AI Processing Agent.');
      }
    } catch (err) {
      console.error('Master AI Error:', err);
      setErrorMsg(err.message || 'Failed to process AI input.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(rawJsonText);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleCopyReply = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedReply(true);
    setTimeout(() => setCopiedReply(false), 2000);
  };

  const handleUpsertToDb = async () => {
    let payloadToCommit = processedResult;
    try {
      payloadToCommit = JSON.parse(rawJsonText);
    } catch (e) {
      alert('Invalid JSON in raw JSON editor. Please fix formatting before submitting.');
      return;
    }

    setUpserting(true);
    setUpsertSuccess(null);
    try {
      const res = await api.upsertMasterAiRecord(payloadToCommit);
      if (res && res.success) {
        setUpsertSuccess(res.message || 'Record successfully upserted into ERP/CRM database!');
      } else {
        throw new Error(res?.error || 'Database upsert failed');
      }
    } catch (err) {
      alert(`Upsert Error: ${err.message}`);
    } finally {
      setUpserting(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header Banner */}
      <div style={styles.headerCard}>
        <div style={styles.headerTop}>
          <div style={styles.headerTitleGroup}>
            <div style={styles.aiBadge}>
              <Bot size={22} color="#4f46e5" />
              <span>MASTER AI AGENT</span>
            </div>
            <h1 style={styles.title}>Elite ERP Master AI Processing Agent</h1>
            <p style={styles.subtitle}>
              Ingest unstructured incoming text, webhooks, WhatsApp transcripts, or forms to auto-classify intent, standardize contact directories, calculate lead scores, and output database-ready JSON.
            </p>
          </div>
          <div style={styles.statusPills}>
            <div style={styles.liveStatusPill}>
              <span style={styles.statusDot}></span>
              <span>ERP & CRM Synchronized</span>
            </div>
            <div style={styles.modePill}>
              <ShieldCheck size={14} color="#10b981" />
              <span>Strict Schema Validation</span>
            </div>
          </div>
        </div>

        {/* Preset Selector Buttons */}
        <div style={styles.presetsContainer}>
          <span style={styles.presetsLabel}>Quick Test Sample Payloads:</span>
          <div style={styles.presetsGrid}>
            {SAMPLE_PRESETS.map((preset) => {
              const IconComp = preset.icon;
              const isSelected = inputText === preset.text;
              return (
                <button
                  key={preset.id}
                  onClick={() => {
                    setInputText(preset.text);
                    setErrorMsg('');
                  }}
                  style={{
                    ...styles.presetBtn,
                    ...(isSelected ? styles.presetBtnActive : {}),
                    borderColor: isSelected ? preset.color : 'var(--border-color, #e2e8f0)'
                  }}
                >
                  <IconComp size={15} color={preset.color} />
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Workspace Split View */}
      <div style={styles.workspaceSplit}>
        {/* Left Column: Input Payload Textarea */}
        <div style={styles.inputColumn}>
          <div style={styles.cardHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileCode size={18} color="var(--primary, #4f46e5)" />
              <h3 style={styles.cardTitle}>Raw Payload Input</h3>
            </div>
            <button
              onClick={() => setInputText('')}
              style={styles.clearBtn}
            >
              Clear
            </button>
          </div>

          <div style={styles.textareaWrapper}>
            <textarea
              style={styles.textarea}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste raw incoming WhatsApp message, Meta lead webhook JSON, vendor email, or worker registration details here..."
              rows={14}
            />
          </div>

          {errorMsg && (
            <div style={styles.errorBox}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div style={styles.actionRow}>
            <button
              onClick={handleProcessInput}
              disabled={loading}
              style={{
                ...styles.processBtn,
                ...(loading ? styles.processBtnDisabled : {})
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={18} className="spin-animation" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Processing & Classifying Payload...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Run AI Agent Classification</span>
                </>
              )}
            </button>
          </div>

          {/* Processing History List */}
          {history.length > 0 && (
            <div style={styles.historySection}>
              <h4 style={styles.historyTitle}>Recent Ingestions History</h4>
              <div style={styles.historyList}>
                {history.map((item) => (
                  <div key={item.id} style={styles.historyCard}>
                    <div style={styles.historyHeader}>
                      <span
                        style={{
                          ...styles.recordTypeTag,
                          backgroundColor:
                            item.record_type === 'LEAD' ? '#dbeafe' :
                            item.record_type === 'VENDOR' ? '#f3e8ff' :
                            item.record_type === 'EMPLOYEE' ? '#d1fae5' : '#fef3c7',
                          color:
                            item.record_type === 'LEAD' ? '#1e40af' :
                            item.record_type === 'VENDOR' ? '#6b21a8' :
                            item.record_type === 'EMPLOYEE' ? '#065f46' : '#92400e'
                        }}
                      >
                        {item.record_type}
                      </span>
                      <span style={styles.historyTime}>{item.timestamp}</span>
                    </div>
                    <div style={styles.historyName}>{item.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: AI Output & Schema Inspector */}
        <div style={styles.outputColumn}>
          {!processedResult && !loading ? (
            <div style={styles.emptyState}>
              <Bot size={48} color="#94a3b8" />
              <h3>Awaiting Input Payload</h3>
              <p>Select a sample preset or paste raw unstructured text on the left, then click <strong>"Run AI Agent Classification"</strong> to analyze and extract database-ready JSON.</p>
            </div>
          ) : loading ? (
            <div style={styles.loadingState}>
              <RefreshCw size={40} color="#4f46e5" style={{ animation: 'spin 1s linear infinite' }} />
              <h3>Analyzing Entity & Standardizing Fields...</h3>
              <p>Extracting common directory, calculating lead score, and formatting strict JSON schema.</p>
            </div>
          ) : (
            <div style={styles.outputContent}>
              {/* Classification Badge Card */}
              <div style={styles.classificationBanner}>
                <div style={styles.classificationInfo}>
                  <span style={styles.classifiedLabel}>CLASSIFIED ENTITY TYPE</span>
                  <div style={styles.classifiedValueRow}>
                    <span
                      style={{
                        ...styles.classifiedBadge,
                        backgroundColor:
                          processedResult.record_type === 'LEAD' ? '#2563eb' :
                          processedResult.record_type === 'VENDOR' ? '#7c3aed' :
                          processedResult.record_type === 'EMPLOYEE' ? '#059669' : '#d97706'
                      }}
                    >
                      {processedResult.record_type}
                    </span>
                    <span style={styles.operationTag}>
                      {processedResult.operation || 'UPSERT_RECORD'}
                    </span>
                  </div>
                </div>

                <div style={styles.modeBadge}>
                  <Zap size={14} color="#f59e0b" />
                  <span>Mode: {processingMode}</span>
                </div>
              </div>

              {/* Common Directory Card */}
              {processedResult.common_directory && (
                <div style={styles.sectionCard}>
                  <h4 style={styles.sectionTitle}>
                    <User size={16} color="var(--primary, #4f46e5)" />
                    Standardized Contact Directory
                  </h4>
                  <div style={styles.directoryGrid}>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>Contact Name</span>
                      <span style={styles.fieldValue}>{processedResult.common_directory.name || 'N/A'}</span>
                    </div>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>Primary Phone</span>
                      <span style={styles.fieldValue}>{processedResult.common_directory.primary_phone || 'N/A'}</span>
                    </div>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>WhatsApp Phone</span>
                      <span style={styles.fieldValue}>{processedResult.common_directory.whatsapp_phone || 'N/A'}</span>
                    </div>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>Email Address</span>
                      <span style={styles.fieldValue}>{processedResult.common_directory.email || 'N/A'}</span>
                    </div>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>City / Location</span>
                      <span style={styles.fieldValue}>
                        {[processedResult.common_directory.city, processedResult.common_directory.state].filter(Boolean).join(', ') || 'N/A'}
                      </span>
                    </div>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>Account Status</span>
                      <span style={{ ...styles.fieldValue, color: '#10b981' }}>
                        {processedResult.common_directory.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Category Specific Block: LEAD */}
              {processedResult.record_type === 'LEAD' && processedResult.lead_data && (
                <div style={styles.sectionCard}>
                  <h4 style={styles.sectionTitle}>
                    <Flame size={16} color="#ef4444" />
                    Lead Intelligence & Sales Guidance
                  </h4>
                  <div style={styles.leadGrid}>
                    <div style={styles.scoreMeterCard}>
                      <span style={styles.fieldLabel}>Lead Score (0-100)</span>
                      <div style={styles.scoreGauge}>
                        <div
                          style={{
                            ...styles.scoreBar,
                            width: `${processedResult.lead_data.lead_score || 50}%`,
                            backgroundColor:
                              (processedResult.lead_data.lead_score || 0) >= 80 ? '#10b981' :
                              (processedResult.lead_data.lead_score || 0) >= 50 ? '#f59e0b' : '#ef4444'
                          }}
                        ></div>
                      </div>
                      <div style={styles.scoreTextRow}>
                        <span style={styles.scoreNumber}>{processedResult.lead_data.lead_score || 0} / 100</span>
                        <span
                          style={{
                            ...styles.priorityPill,
                            backgroundColor:
                              processedResult.lead_data.priority === 'HOT' ? '#fee2e2' :
                              processedResult.lead_data.priority === 'WARM' ? '#fef3c7' : '#e0f2fe',
                            color:
                              processedResult.lead_data.priority === 'HOT' ? '#991b1b' :
                              processedResult.lead_data.priority === 'WARM' ? '#92400e' : '#075985'
                          }}
                        >
                          {processedResult.lead_data.priority || 'WARM'} PRIORITY
                        </span>
                      </div>
                    </div>

                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>Product / SKU Interest</span>
                      <span style={styles.fieldValue}>{processedResult.lead_data.product_or_sku_interest || 'N/A'}</span>
                    </div>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>Quantity Inquiry</span>
                      <span style={styles.fieldValue}>{processedResult.lead_data.quantity ? `${processedResult.lead_data.quantity} meters/pcs` : 'N/A'}</span>
                    </div>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>Source Channel</span>
                      <span style={styles.fieldValue}>{processedResult.lead_data.source || 'WhatsApp'}</span>
                    </div>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>SLA Follow-up Window</span>
                      <span style={styles.fieldValue}>{processedResult.lead_data.sla_followup_hours || 1} Hour(s)</span>
                    </div>
                    <div style={{ ...styles.fieldBox, gridColumn: 'span 2' }}>
                      <span style={styles.fieldLabel}>Suggested Next Sales Action</span>
                      <span style={{ ...styles.fieldValue, fontWeight: '600', color: '#1e40af' }}>
                        {processedResult.lead_data.suggested_next_action || 'Follow up with pricing catalog'}
                      </span>
                    </div>
                  </div>

                  {/* Instant Reply Preview */}
                  {processedResult.lead_data.instant_reply_text && (
                    <div style={styles.replyBox}>
                      <div style={styles.replyBoxHeader}>
                        <span style={styles.replyBoxTitle}>Personalized Instant WhatsApp Reply:</span>
                        <button
                          onClick={() => handleCopyReply(processedResult.lead_data.instant_reply_text)}
                          style={styles.copyReplyBtn}
                        >
                          {copiedReply ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedReply ? 'Copied!' : 'Copy Reply'}</span>
                        </button>
                      </div>
                      <p style={styles.replyText}>{processedResult.lead_data.instant_reply_text}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Category Specific Block: VENDOR */}
              {processedResult.record_type === 'VENDOR' && processedResult.vendor_data && (
                <div style={styles.sectionCard}>
                  <h4 style={styles.sectionTitle}>
                    <Building2 size={16} color="#7c3aed" />
                    Supplier & Tax Compliance Details
                  </h4>
                  <div style={styles.directoryGrid}>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>Company Name</span>
                      <span style={styles.fieldValue}>{processedResult.vendor_data.company_name || 'N/A'}</span>
                    </div>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>GST / Tax ID</span>
                      <span style={styles.fieldValue}>{processedResult.vendor_data.gst_or_tax_id || 'N/A'}</span>
                    </div>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>Bank Account</span>
                      <span style={styles.fieldValue}>{processedResult.vendor_data.bank_account || 'N/A'}</span>
                    </div>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>Bank IFSC Code</span>
                      <span style={styles.fieldValue}>{processedResult.vendor_data.bank_ifsc || 'N/A'}</span>
                    </div>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>Payment Terms</span>
                      <span style={{ ...styles.fieldValue, fontWeight: '700', color: '#6b21a8' }}>
                        {processedResult.vendor_data.payment_terms || 'Net 30'}
                      </span>
                    </div>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>Supplied Category</span>
                      <span style={styles.fieldValue}>{processedResult.vendor_data.supplied_items || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Category Specific Block: EMPLOYEE */}
              {processedResult.record_type === 'EMPLOYEE' && processedResult.employee_data && (
                <div style={styles.sectionCard}>
                  <h4 style={styles.sectionTitle}>
                    <Briefcase size={16} color="#059669" />
                    Salaried Employee Roster Data
                  </h4>
                  <div style={styles.directoryGrid}>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>Department</span>
                      <span style={styles.fieldValue}>{processedResult.employee_data.department || 'N/A'}</span>
                    </div>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>Designation</span>
                      <span style={styles.fieldValue}>{processedResult.employee_data.designation || 'N/A'}</span>
                    </div>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>Monthly Salary</span>
                      <span style={{ ...styles.fieldValue, fontWeight: '700', color: '#059669' }}>
                        {processedResult.employee_data.monthly_salary ? `₹${processedResult.employee_data.monthly_salary.toLocaleString('en-IN')}` : 'N/A'}
                      </span>
                    </div>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>Joining Date</span>
                      <span style={styles.fieldValue}>{processedResult.employee_data.joining_date || 'N/A'}</span>
                    </div>
                    <div style={{ ...styles.fieldBox, gridColumn: 'span 2' }}>
                      <span style={styles.fieldLabel}>Emergency Contact</span>
                      <span style={styles.fieldValue}>{processedResult.employee_data.emergency_contact || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Category Specific Block: WORKER */}
              {processedResult.record_type === 'WORKER' && processedResult.worker_data && (
                <div style={styles.sectionCard}>
                  <h4 style={styles.sectionTitle}>
                    <Wrench size={16} color="#d97706" />
                    Shop-Floor Worker & Wage Configuration
                  </h4>
                  <div style={styles.directoryGrid}>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>Station / Skill</span>
                      <span style={styles.fieldValue}>{processedResult.worker_data.station_or_skill || 'N/A'}</span>
                    </div>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>Wage Model</span>
                      <span style={{ ...styles.fieldValue, fontWeight: '700', color: '#d97706' }}>
                        {processedResult.worker_data.wage_model || 'DAILY_WAGE'}
                      </span>
                    </div>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>Rate Amount</span>
                      <span style={styles.fieldValue}>
                        {processedResult.worker_data.rate_amount ? `₹${processedResult.worker_data.rate_amount}` : 'N/A'}
                      </span>
                    </div>
                    <div style={styles.fieldBox}>
                      <span style={styles.fieldLabel}>Payout Schedule</span>
                      <span style={styles.fieldValue}>{processedResult.worker_data.payout_schedule || 'WEEKLY'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Raw Database JSON Inspector */}
              <div style={styles.jsonCard}>
                <div style={styles.jsonHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Database size={16} color="#38bdf8" />
                    <span style={styles.jsonTitle}>Raw Database-Ready JSON Output</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={handleCopyJson} style={styles.copyJsonBtn}>
                      {copiedJson ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
                    </button>
                  </div>
                </div>

                <textarea
                  style={styles.jsonTextarea}
                  value={rawJsonText}
                  onChange={(e) => setRawJsonText(e.target.value)}
                  rows={12}
                />

                {upsertSuccess && (
                  <div style={styles.successBanner}>
                    <CheckCircle size={18} color="#10b981" />
                    <span>{upsertSuccess}</span>
                  </div>
                )}

                <div style={styles.upsertRow}>
                  <button
                    onClick={handleUpsertToDb}
                    disabled={upserting}
                    style={{
                      ...styles.upsertBtn,
                      ...(upserting ? styles.processBtnDisabled : {})
                    }}
                  >
                    {upserting ? (
                      <>
                        <RefreshCw size={16} className="spin-animation" style={{ animation: 'spin 1s linear infinite' }} />
                        <span>Upserting to ERP DB...</span>
                      </>
                    ) : (
                      <>
                        <Database size={16} />
                        <span>Upsert Record directly into ERP / CRM DB</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    maxWidth: '1600px',
    margin: '0 auto',
    width: '100%',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
  },
  headerCard: {
    backgroundColor: 'var(--surface, #ffffff)',
    borderRadius: '16px',
    padding: '1.5rem',
    boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)',
    border: '1px solid var(--border-color, #e2e8f0)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem'
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '1rem'
  },
  headerTitleGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    maxWidth: '850px'
  },
  aiBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.25rem 0.75rem',
    borderRadius: '20px',
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    color: '#4f46e5',
    fontSize: '0.75rem',
    fontWeight: '700',
    letterSpacing: '0.05em',
    width: 'fit-content'
  },
  title: {
    fontSize: '1.65rem',
    fontWeight: '800',
    color: 'var(--text-main, #0f172a)',
    margin: 0
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'var(--text-muted, #64748b)',
    lineHeight: '1.45',
    margin: 0
  },
  statusPills: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    alignItems: 'flex-end'
  },
  liveStatusPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.4rem 0.85rem',
    borderRadius: '20px',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#166534',
    fontSize: '0.8rem',
    fontWeight: '600'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#22c55e'
  },
  modePill: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.35rem 0.75rem',
    borderRadius: '20px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#475569',
    fontSize: '0.75rem',
    fontWeight: '600'
  },
  presetsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid var(--border-color, #f1f5f9)'
  },
  presetsLabel: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--text-muted, #64748b)'
  },
  presetsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '0.75rem'
  },
  presetBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.6rem 0.9rem',
    borderRadius: '10px',
    backgroundColor: 'var(--surface-subtle, #f8fafc)',
    border: '1px solid #e2e8f0',
    color: 'var(--text-main, #334155)',
    fontSize: '0.82rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'left'
  },
  presetBtnActive: {
    backgroundColor: 'rgba(79, 70, 229, 0.05)',
    boxShadow: '0 2px 8px rgba(79, 70, 229, 0.1)'
  },
  workspaceSplit: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
    alignItems: 'start'
  },
  inputColumn: {
    backgroundColor: 'var(--surface, #ffffff)',
    borderRadius: '16px',
    padding: '1.5rem',
    boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)',
    border: '1px solid var(--border-color, #e2e8f0)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: 'var(--text-main, #0f172a)',
    margin: 0
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted, #64748b)',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
    padding: '0.2rem 0.5rem'
  },
  textareaWrapper: {
    width: '100%'
  },
  textarea: {
    width: '100%',
    padding: '1rem',
    borderRadius: '12px',
    border: '1px solid var(--border-color, #cbd5e1)',
    backgroundColor: 'var(--input-bg, #f8fafc)',
    color: 'var(--text-main, #0f172a)',
    fontFamily: 'Fira Code, monospace, sans-serif',
    fontSize: '0.88rem',
    lineHeight: '1.5',
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box'
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    fontSize: '0.85rem'
  },
  actionRow: {
    display: 'flex',
    justifyContent: 'flex-end'
  },
  processBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.6rem',
    padding: '0.85rem 1.5rem',
    borderRadius: '12px',
    backgroundColor: '#4f46e5',
    color: '#ffffff',
    fontSize: '0.95rem',
    fontWeight: '700',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
    transition: 'all 0.2s ease'
  },
  processBtnDisabled: {
    opacity: '0.65',
    cursor: 'not-allowed'
  },
  historySection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    paddingTop: '1rem',
    borderTop: '1px solid #f1f5f9'
  },
  historyTitle: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--text-muted, #64748b)',
    margin: 0
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  historyCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 0.75rem',
    borderRadius: '8px',
    backgroundColor: '#f8fafc',
    fontSize: '0.8rem'
  },
  historyHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  recordTypeTag: {
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
    fontSize: '0.7rem',
    fontWeight: '700'
  },
  historyTime: {
    color: '#94a3b8',
    fontSize: '0.75rem'
  },
  historyName: {
    fontWeight: '600',
    color: '#334155'
  },
  outputColumn: {
    backgroundColor: 'var(--surface, #ffffff)',
    borderRadius: '16px',
    padding: '1.5rem',
    boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)',
    border: '1px solid var(--border-color, #e2e8f0)',
    minHeight: '550px',
    display: 'flex',
    flexDirection: 'column'
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '3rem 1.5rem',
    color: '#64748b',
    gap: '0.75rem'
  },
  loadingState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '3rem 1.5rem',
    color: '#4f46e5',
    gap: '0.75rem'
  },
  outputContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem'
  },
  classificationBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.25rem',
    borderRadius: '12px',
    backgroundColor: 'var(--surface-subtle, #f8fafc)',
    border: '1px solid var(--border-color, #e2e8f0)'
  },
  classificationInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem'
  },
  classifiedLabel: {
    fontSize: '0.7rem',
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: '0.05em'
  },
  classifiedValueRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem'
  },
  classifiedBadge: {
    padding: '0.3rem 0.9rem',
    borderRadius: '6px',
    color: '#ffffff',
    fontSize: '1rem',
    fontWeight: '800',
    letterSpacing: '0.05em'
  },
  operationTag: {
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    backgroundColor: '#e2e8f0',
    color: '#334155',
    fontSize: '0.75rem',
    fontWeight: '600',
    fontFamily: 'monospace'
  },
  modeBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.3rem 0.65rem',
    borderRadius: '20px',
    backgroundColor: '#fffbeb',
    border: '1px solid #fef3c7',
    color: '#b45309',
    fontSize: '0.75rem',
    fontWeight: '600'
  },
  sectionCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
    padding: '1rem',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff'
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.92rem',
    fontWeight: '700',
    color: '#0f172a',
    margin: 0
  },
  directoryGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem'
  },
  fieldBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    padding: '0.6rem 0.75rem',
    borderRadius: '8px',
    backgroundColor: '#f8fafc',
    border: '1px solid #f1f5f9'
  },
  fieldLabel: {
    fontSize: '0.72rem',
    fontWeight: '600',
    color: '#64748b'
  },
  fieldValue: {
    fontSize: '0.88rem',
    fontWeight: '600',
    color: '#0f172a',
    wordBreak: 'break-word'
  },
  leadGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem'
  },
  scoreMeterCard: {
    gridColumn: 'span 2',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    padding: '0.75rem',
    borderRadius: '10px',
    backgroundColor: '#f0f9ff',
    border: '1px solid #bae6fd'
  },
  scoreGauge: {
    height: '10px',
    width: '100%',
    backgroundColor: '#e0f2fe',
    borderRadius: '5px',
    overflow: 'hidden'
  },
  scoreBar: {
    height: '100%',
    borderRadius: '5px',
    transition: 'width 0.5s ease'
  },
  scoreTextRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  scoreNumber: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: '#0369a1'
  },
  priorityPill: {
    padding: '0.2rem 0.55rem',
    borderRadius: '12px',
    fontSize: '0.72rem',
    fontWeight: '800'
  },
  replyBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '0.85rem',
    borderRadius: '10px',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0'
  },
  replyBoxHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  replyBoxTitle: {
    fontSize: '0.78rem',
    fontWeight: '700',
    color: '#166534'
  },
  copyReplyBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.25rem 0.6rem',
    borderRadius: '6px',
    backgroundColor: '#ffffff',
    border: '1px solid #86efac',
    color: '#15803d',
    fontSize: '0.75rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  replyText: {
    fontSize: '0.85rem',
    color: '#14532d',
    margin: 0,
    lineHeight: '1.4',
    fontStyle: 'italic'
  },
  jsonCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    padding: '1rem',
    borderRadius: '12px',
    backgroundColor: '#0f172a',
    color: '#f8fafc'
  },
  jsonHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  jsonTitle: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: '#38bdf8'
  },
  copyJsonBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.3rem 0.75rem',
    borderRadius: '6px',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#f8fafc',
    fontSize: '0.75rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  jsonTextarea: {
    width: '100%',
    padding: '0.85rem',
    borderRadius: '8px',
    backgroundColor: '#020617',
    border: '1px solid #1e293b',
    color: '#38bdf8',
    fontFamily: 'Fira Code, monospace',
    fontSize: '0.82rem',
    lineHeight: '1.45',
    resize: 'vertical',
    boxSizing: 'border-box'
  },
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid #10b981',
    color: '#34d399',
    fontSize: '0.85rem',
    fontWeight: '600'
  },
  upsertRow: {
    display: 'flex',
    justifyContent: 'flex-end'
  },
  upsertBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.25rem',
    borderRadius: '10px',
    backgroundColor: '#10b981',
    color: '#ffffff',
    fontSize: '0.9rem',
    fontWeight: '700',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
  }
};
