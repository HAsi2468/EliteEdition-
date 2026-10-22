import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Scale,
  UploadCloud,
  FileText,
  Search,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Download,
  Share2,
  Send,
  MessageSquare,
  History,
  Save,
  ArrowRight,
  ChevronDown,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  Check,
  Copy,
  Plus,
  Trash2,
  ExternalLink,
  ShieldAlert,
  Bot
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';
import DateRangePicker, { getDatePresetRange } from './DateRangePicker';

// Formatter for Indian Rupees
const fmtINR = (val) => {
  const num = Number(val) || 0;
  return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtNum = (val) => {
  const num = Number(val) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function LedgerReconciliationPanel({ companyEntity = 'Elite Edition', customers = [], vendors = [] }) {
  // ── 1. Party & ERP Scope ───────────────────────────────────────────────────
  const [partyType, setPartyType] = useState('customer'); // 'customer' or 'vendor'
  const [selectedParty, setSelectedParty] = useState(null); // { _id, name, gstin, phone, balance }
  const [partySearchQuery, setPartySearchQuery] = useState('');
  const [partiesList, setPartiesList] = useState([]);
  const [loadingParties, setLoadingParties] = useState(false);
  const [isPartyDropdownOpen, setIsPartyDropdownOpen] = useState(false);

  // Date Range state
  const [datePreset, setDatePreset] = useState('current_fiscal_year');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // ── 2. Internal ERP Ledger Data ───────────────────────────────────────────
  const [erpLoading, setErpLoading] = useState(false);
  const [erpData, setErpData] = useState({
    partyName: '',
    partyType: 'customer',
    totalDebit: 0,
    totalCredit: 0,
    closingBalance: 0,
    transactions: []
  });

  // ── 3. Statement Ingestion State ──────────────────────────────────────────
  const [statementSource, setStatementSource] = useState('file'); // 'file', 'text', 'manual'
  const [statementFile, setStatementFile] = useState(null);
  const [statementBase64, setStatementBase64] = useState('');
  const [rawStatementText, setRawStatementText] = useState('');
  const [parsingStatement, setParsingStatement] = useState(false);
  const [parsedStatement, setParsedStatement] = useState({
    partyName: '',
    statementPeriod: { startDate: '', endDate: '' },
    openingBalance: 0,
    openingBalanceType: 'DR',
    closingBalance: 0,
    closingBalanceType: 'DR',
    transactions: []
  });
  const fileInputRef = useRef(null);

  // ── 4. Reconciliation Execution & Results ────────────────────────────────
  const [reconciling, setReconciling] = useState(false);
  const [reconciliationResult, setReconciliationResult] = useState(null);
  const [activeFilterTab, setActiveFilterTab] = useState('all'); // 'all', 'matched', 'probable', 'discrepant', 'unmatchedStmt', 'unmatchedErp'
  const [matrixSearch, setMatrixSearch] = useState('');

  // ── 5. AI Forensic Audit (Grok Reasoning) ─────────────────────────────────
  const [auditing, setAuditing] = useState(false);
  const [auditReport, setAuditReport] = useState(null);
  const [showAuditModal, setShowAuditModal] = useState(false);

  // ── 6. Settlement Notice Generator ────────────────────────────────────────
  const [draftingNotice, setDraftingNotice] = useState(false);
  const [settlementNotice, setSettlementNotice] = useState(null);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeTone, setNoticeTone] = useState('POLITE_PROFESSIONAL');
  const [copyFeedback, setCopyFeedback] = useState(false);

  // ── 7. Grok Financial Copilot Chat ────────────────────────────────────────
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am your Grok Financial Copilot. I analyze ledger transactions, detect TDS / GST variances, identify missing payment vouchers, and guide dispute resolution. How can I help with this party account?'
    }
  ]);
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const copilotChatEndRef = useRef(null);

  // ── 8. Session Management & History ───────────────────────────────────────
  const [savingSession, setSavingSession] = useState(false);
  const [sessionSaveSuccess, setSessionSaveSuccess] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historySessions, setHistorySessions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Calculate Active Date Range Bounds
  const activeRange = useMemo(() => {
    return getDatePresetRange(datePreset, customStart, customEnd);
  }, [datePreset, customStart, customEnd]);

  // Load Party Master List when partyType changes or search query updates
  useEffect(() => {
    let isMounted = true;
    async function loadParties() {
      setLoadingParties(true);
      try {
        const res = await api.getReconciliationParties({
          partyType,
          search: partySearchQuery,
          companyEntity
        });
        if (isMounted && res?.success && Array.isArray(res.parties)) {
          setPartiesList(res.parties);
        }
      } catch (err) {
        console.warn('Failed to load parties:', err);
      } finally {
        if (isMounted) setLoadingParties(false);
      }
    }

    const timer = setTimeout(loadParties, 250);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [partyType, partySearchQuery, companyEntity]);

  // Fetch ERP Ledger for selected party
  const fetchErpLedgerData = async (party) => {
    const targetParty = party || selectedParty;
    if (!targetParty) return;

    setErpLoading(true);
    try {
      const res = await api.getErpLedger({
        partyType,
        partyName: targetParty.name,
        partyId: targetParty._id,
        startDate: activeRange.start ? activeRange.start.toISOString().split('T')[0] : '',
        endDate: activeRange.end ? activeRange.end.toISOString().split('T')[0] : '',
        companyEntity
      });

      if (res?.success) {
        setErpData({
          partyName: res.partyName || targetParty.name,
          partyType: res.partyType || partyType,
          totalDebit: res.totalDebit || 0,
          totalCredit: res.totalCredit || 0,
          closingBalance: res.closingBalance || 0,
          transactions: res.transactions || []
        });
      }
    } catch (err) {
      console.error('Failed to fetch ERP ledger:', err);
    } finally {
      setErpLoading(false);
    }
  };

  // When party changes, fetch ERP ledger automatically
  const handleSelectParty = (party) => {
    setSelectedParty(party);
    setIsPartyDropdownOpen(false);
    fetchErpLedgerData(party);
  };

  // Convert File to Base64
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatementFile(file);
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setStatementBase64(uploadEvent.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Parse External Statement with Grok AI
  const handleParseStatement = async () => {
    if (!statementBase64 && !rawStatementText.trim()) {
      alert('Please upload a statement image/PDF or paste statement text.');
      return;
    }

    setParsingStatement(true);
    try {
      const res = await api.parseReconciliationStatement({
        rawText: rawStatementText,
        imageBase64: statementBase64,
        partyType,
        partyName: selectedParty?.name || ''
      });

      if (res?.success && res.parsedData) {
        setParsedStatement({
          partyName: res.parsedData.partyName || selectedParty?.name || '',
          statementPeriod: res.parsedData.statementPeriod || {},
          openingBalance: Number(res.parsedData.openingBalance || 0),
          openingBalanceType: res.parsedData.openingBalanceType || 'DR',
          closingBalance: Number(res.parsedData.closingBalance || 0),
          closingBalanceType: res.parsedData.closingBalanceType || 'DR',
          transactions: Array.isArray(res.parsedData.transactions) ? res.parsedData.transactions : []
        });
      } else {
        alert(res?.message || 'Failed to extract transactions from document');
      }
    } catch (err) {
      console.error('Error parsing statement:', err);
      alert('Error parsing statement with AI. Please verify input data.');
    } finally {
      setParsingStatement(false);
    }
  };

  // Add Manual Statement Entry
  const handleAddManualStatementRow = () => {
    const today = new Date().toISOString().split('T')[0];
    const newRow = {
      date: today,
      voucherNo: `VCH-${Math.floor(1000 + Math.random() * 9000)}`,
      type: 'INVOICE',
      narration: 'Manual statement entry',
      debit: 0,
      credit: 0,
      balance: 0,
      ref: ''
    };
    setParsedStatement((prev) => ({
      ...prev,
      transactions: [newRow, ...prev.transactions]
    }));
  };

  // Delete Statement Entry
  const handleDeleteStatementRow = (index) => {
    setParsedStatement((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((_, i) => i !== index)
    }));
  };

  // Update Statement Entry field
  const handleUpdateStatementRow = (index, field, value) => {
    setParsedStatement((prev) => {
      const updated = [...prev.transactions];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, transactions: updated };
    });
  };

  // Run Automated 3-Way Reconciliation
  const handleRunReconciliation = async () => {
    if (!selectedParty) {
      alert('Please select a party first.');
      return;
    }
    if (!erpData.transactions.length && !parsedStatement.transactions.length) {
      alert('Neither ERP entries nor External Statement entries were found to reconcile.');
      return;
    }

    setReconciling(true);
    try {
      const payload = {
        partyType,
        partyName: selectedParty.name,
        partyId: selectedParty._id,
        statementItems: parsedStatement.transactions,
        statementOpeningBalance: parsedStatement.openingBalance,
        statementClosingBalance: parsedStatement.closingBalance,
        startDate: activeRange.start ? activeRange.start.toISOString().split('T')[0] : '',
        endDate: activeRange.end ? activeRange.end.toISOString().split('T')[0] : ''
      };

      const res = await api.runReconciliationMatching(payload);
      if (res?.success) {
        setReconciliationResult(res);
      } else {
        alert(res?.message || 'Reconciliation failed.');
      }
    } catch (err) {
      console.error('Reconciliation error:', err);
      alert('Failed to execute reconciliation.');
    } finally {
      setReconciling(false);
    }
  };

  // Run Grok Deep Forensic Discrepancy Investigation
  const handleRunForensicAudit = async () => {
    if (!reconciliationResult) {
      alert('Please run reconciliation first before initiating deep forensic audit.');
      return;
    }

    setAuditing(true);
    try {
      const payload = {
        partyName: selectedParty?.name || erpData.partyName,
        partyType,
        erpClosingBalance: reconciliationResult.summary?.erpClosingBalance || 0,
        statementClosingBalance: reconciliationResult.summary?.statementClosingBalance || 0,
        variance: reconciliationResult.summary?.variance || 0,
        unmatchedStatementItems: reconciliationResult.unmatchedStatementItems || [],
        unmatchedErpItems: reconciliationResult.unmatchedErpItems || [],
        discrepantItems: reconciliationResult.discrepantItems || []
      };

      const res = await api.runGrokForensicAudit(payload);
      if (res?.success && res.auditReport) {
        setAuditReport(res.auditReport);
        setShowAuditModal(true);
      } else {
        alert(res?.message || 'Failed to complete forensic audit.');
      }
    } catch (err) {
      console.error('Forensic audit error:', err);
      alert('Grok AI audit encountered an error.');
    } finally {
      setAuditing(false);
    }
  };

  // Generate WhatsApp / Email Settlement Notice
  const handleDraftNotice = async (overrideTone) => {
    if (!reconciliationResult) {
      alert('Please run reconciliation first.');
      return;
    }

    setDraftingNotice(true);
    const tone = overrideTone || noticeTone;
    try {
      const payload = {
        partyName: selectedParty?.name || erpData.partyName,
        partyType,
        agreedBalance: reconciliationResult.summary?.erpClosingBalance || 0,
        variance: reconciliationResult.summary?.variance || 0,
        disputedItems: [
          ...(reconciliationResult.discrepantItems || []),
          ...(reconciliationResult.unmatchedStatementItems || []).slice(0, 5),
          ...(reconciliationResult.unmatchedErpItems || []).slice(0, 5)
        ],
        tone
      };

      const res = await api.draftSettlementNotice(payload);
      if (res?.success && res.notice) {
        setSettlementNotice(res.notice);
        setShowNoticeModal(true);
      }
    } catch (err) {
      console.error('Settlement notice error:', err);
    } finally {
      setDraftingNotice(false);
    }
  };

  // Copy Settlement Notice to Clipboard
  const handleCopyNotice = (text) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  // Open Direct WhatsApp Link
  const handleOpenWhatsApp = (text) => {
    const phone = (selectedParty?.phone || '').replace(/[^0-9]/g, '');
    const cleanPhone = phone.length === 10 ? `91${phone}` : phone;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Grok Copilot Chat Send Message
  const handleSendCopilotMessage = async (e) => {
    if (e) e.preventDefault();
    if (!copilotInput.trim() || copilotLoading) return;

    const userMsg = copilotInput.trim();
    setCopilotInput('');
    const newHistory = [...copilotMessages, { role: 'user', content: userMsg }];
    setCopilotMessages(newHistory);
    setCopilotLoading(true);

    try {
      const res = await api.sendGrokCopilotMessage({
        query: userMsg,
        conversationHistory: newHistory,
        erpContext: {
          party: selectedParty,
          partyType,
          erpDataSummary: {
            totalDebit: erpData.totalDebit,
            totalCredit: erpData.totalCredit,
            closingBalance: erpData.closingBalance,
            txnCount: erpData.transactions.length
          },
          reconciliationSummary: reconciliationResult?.summary || null
        }
      });

      if (res?.success && res.reply) {
        setCopilotMessages((prev) => [...prev, { role: 'assistant', content: res.reply }]);
      }
    } catch (err) {
      setCopilotMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Apologies, I encountered an issue accessing the analysis engine. Please try again.' }
      ]);
    } finally {
      setCopilotLoading(false);
      setTimeout(() => {
        copilotChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // Save Reconciliation Session to Database
  const handleSaveSession = async () => {
    if (!reconciliationResult) {
      alert('No reconciliation result to save.');
      return;
    }

    setSavingSession(true);
    try {
      const payload = {
        partyType,
        partyName: selectedParty?.name || erpData.partyName,
        partyId: selectedParty?._id,
        partyGstin: selectedParty?.gstin || '',
        partyPhone: selectedParty?.phone || '',
        period: {
          startDate: activeRange.start ? activeRange.start.toISOString().split('T')[0] : '',
          endDate: activeRange.end ? activeRange.end.toISOString().split('T')[0] : ''
        },
        erpBalance: reconciliationResult.summary?.erpClosingBalance || 0,
        statementBalance: reconciliationResult.summary?.statementClosingBalance || 0,
        variance: reconciliationResult.summary?.variance || 0,
        status: Math.abs(reconciliationResult.summary?.variance || 0) < 1 ? 'RECONCILED' : 'DISCREPANCY_FOUND',
        summary: reconciliationResult.summary,
        matchedItems: reconciliationResult.matchedItems || [],
        probableItems: reconciliationResult.probableItems || [],
        discrepantItems: reconciliationResult.discrepantItems || [],
        unmatchedStatementItems: reconciliationResult.unmatchedStatementItems || [],
        unmatchedErpItems: reconciliationResult.unmatchedErpItems || [],
        aiAuditReport: auditReport,
        settlementNotice
      };

      const res = await api.saveReconciliationSession(payload);
      if (res?.success) {
        setSessionSaveSuccess(true);
        setTimeout(() => setSessionSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Save session error:', err);
      alert('Failed to save reconciliation session.');
    } finally {
      setSavingSession(false);
    }
  };

  // Load Past Sessions History
  const handleLoadHistory = async () => {
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const res = await api.getReconciliationHistory();
      if (res?.success && Array.isArray(res.sessions)) {
        setHistorySessions(res.sessions);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Restore session from history
  const handleRestoreSession = (session) => {
    if (!session) return;
    setPartyType(session.partyType || 'customer');
    setSelectedParty({
      _id: session.partyId,
      name: session.partyName,
      gstin: session.partyGstin,
      phone: session.partyPhone,
      balance: session.erpBalance
    });
    setReconciliationResult({
      summary: session.summary,
      matchedItems: session.matchedItems || [],
      probableItems: session.probableItems || [],
      discrepantItems: session.discrepantItems || [],
      unmatchedStatementItems: session.unmatchedStatementItems || [],
      unmatchedErpItems: session.unmatchedErpItems || []
    });
    if (session.aiAuditReport) setAuditReport(session.aiAuditReport);
    if (session.settlementNotice) setSettlementNotice(session.settlementNotice);
    setShowHistoryModal(false);
  };

  // Export Matrix to Excel (.xlsx)
  const handleExportExcel = () => {
    if (!reconciliationResult) {
      alert('No reconciliation data available to export.');
      return;
    }

    const wb = XLSX.utils.book_new();

    // 1. Summary Sheet
    const summaryData = [
      ['ELITE EDITION - LEDGER RECONCILIATION REPORT'],
      ['Party Name', selectedParty?.name || erpData.partyName],
      ['Party Type', partyType.toUpperCase()],
      ['Company Entity', companyEntity],
      ['Period', activeRange.labelText],
      ['Date Generated', new Date().toLocaleString('en-IN')],
      [],
      ['RECONCILIATION SUMMARY'],
      ['ERP Closing Balance', reconciliationResult.summary?.erpClosingBalance || 0],
      ['Statement Closing Balance', reconciliationResult.summary?.statementClosingBalance || 0],
      ['Net Variance', reconciliationResult.summary?.variance || 0],
      ['Total Matched Entries', reconciliationResult.summary?.matchedCount || 0],
      ['Probable Matches', reconciliationResult.summary?.probableCount || 0],
      ['Amount Discrepancies', reconciliationResult.summary?.discrepantCount || 0],
      ['Unmatched in Statement', reconciliationResult.summary?.unmatchedStatementCount || 0],
      ['Unmatched in ERP', reconciliationResult.summary?.unmatchedErpCount || 0]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // 2. Matched Sheet
    if (reconciliationResult.matchedItems?.length) {
      const matchedData = reconciliationResult.matchedItems.map((m) => ({
        Date: m.date || m.erpDate,
        'Voucher No': m.voucherNo || m.erpVoucherNo,
        Narration: m.narration || m.erpNarration,
        'ERP Debit': m.erpDebit || 0,
        'ERP Credit': m.erpCredit || 0,
        'Statement Debit': m.statementDebit || 0,
        'Statement Credit': m.statementCredit || 0,
        'Match Type': m.matchType || 'EXACT'
      }));
      const wsMatched = XLSX.utils.json_to_sheet(matchedData);
      XLSX.utils.book_append_sheet(wb, wsMatched, 'Matched Entries');
    }

    // 3. Discrepant Sheet
    if (reconciliationResult.discrepantItems?.length) {
      const discData = reconciliationResult.discrepantItems.map((d) => ({
        Date: d.statementDate || d.erpDate,
        Voucher: d.voucherNo || d.erpVoucherNo,
        'Statement Amount': d.statementAmount,
        'ERP Amount': d.erpAmount,
        Difference: d.difference,
        Narration: d.erpNarration || d.statementNarration,
        Note: d.reason || 'Amount Mismatch'
      }));
      const wsDisc = XLSX.utils.json_to_sheet(discData);
      XLSX.utils.book_append_sheet(wb, wsDisc, 'Discrepancies');
    }

    // 4. Missing in Statement
    if (reconciliationResult.unmatchedStatementItems?.length) {
      const wsUnmatched = XLSX.utils.json_to_sheet(reconciliationResult.unmatchedStatementItems);
      XLSX.utils.book_append_sheet(wb, wsUnmatched, 'Missing in Statement');
    }

    // 5. Missing in ERP
    if (reconciliationResult.unmatchedErpItems?.length) {
      const wsUnmatchedErp = XLSX.utils.json_to_sheet(reconciliationResult.unmatchedErpItems);
      XLSX.utils.book_append_sheet(wb, wsUnmatchedErp, 'Missing in ERP');
    }

    const fileName = `Ledger_Reconciliation_${(selectedParty?.name || 'Party').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Filtered Items for Comparison Matrix Table
  const filteredMatrixItems = useMemo(() => {
    if (!reconciliationResult) return [];

    let list = [];
    if (activeFilterTab === 'all') {
      list = [
        ...(reconciliationResult.matchedItems || []).map((i) => ({ ...i, _bucket: 'matched' })),
        ...(reconciliationResult.probableItems || []).map((i) => ({ ...i, _bucket: 'probable' })),
        ...(reconciliationResult.discrepantItems || []).map((i) => ({ ...i, _bucket: 'discrepant' })),
        ...(reconciliationResult.unmatchedStatementItems || []).map((i) => ({ ...i, _bucket: 'unmatchedStmt' })),
        ...(reconciliationResult.unmatchedErpItems || []).map((i) => ({ ...i, _bucket: 'unmatchedErp' }))
      ];
    } else if (activeFilterTab === 'matched') {
      list = (reconciliationResult.matchedItems || []).map((i) => ({ ...i, _bucket: 'matched' }));
    } else if (activeFilterTab === 'probable') {
      list = (reconciliationResult.probableItems || []).map((i) => ({ ...i, _bucket: 'probable' }));
    } else if (activeFilterTab === 'discrepant') {
      list = (reconciliationResult.discrepantItems || []).map((i) => ({ ...i, _bucket: 'discrepant' }));
    } else if (activeFilterTab === 'unmatchedStmt') {
      list = (reconciliationResult.unmatchedStatementItems || []).map((i) => ({ ...i, _bucket: 'unmatchedStmt' }));
    } else if (activeFilterTab === 'unmatchedErp') {
      list = (reconciliationResult.unmatchedErpItems || []).map((i) => ({ ...i, _bucket: 'unmatchedErp' }));
    }

    if (matrixSearch.trim()) {
      const q = matrixSearch.toLowerCase();
      list = list.filter((item) => {
        const text = `${item.voucherNo || ''} ${item.erpVoucherNo || ''} ${item.narration || ''} ${item.erpNarration || ''} ${item.ref || ''} ${item.amount || ''} ${item.erpAmount || ''}`.toLowerCase();
        return text.includes(q);
      });
    }

    return list;
  }, [reconciliationResult, activeFilterTab, matrixSearch]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', color: 'var(--text-primary, #0f172a)' }}>
      {/* ── TOP HEADER & ACTIONS BAR ────────────────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
          borderRadius: '16px',
          padding: '1.35rem 1.6rem',
          color: '#ffffff',
          boxShadow: '0 10px 25px -5px rgba(49, 46, 129, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 255, 255, 0.25)'
            }}
          >
            <Scale size={24} color="#38bdf8" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                AI 3-Way Ledger Reconciliation Hub
              </h2>
              <span
                style={{
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  padding: '2px 9px',
                  borderRadius: '20px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Sparkles size={12} /> Grok Reasoning AI
              </span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', opacity: 0.85 }}>
              Automated cross-matching between internal ERP books and external customer/vendor statements with forensic audit
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setCopilotOpen(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#ffffff',
              padding: '0.55rem 0.9rem',
              borderRadius: '9px',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.2s'
            }}
          >
            <Bot size={16} color="#38bdf8" />
            <span>AI Copilot</span>
          </button>

          <button
            onClick={handleLoadHistory}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#ffffff',
              padding: '0.55rem 0.9rem',
              borderRadius: '9px',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.2s'
            }}
          >
            <History size={16} />
            <span>History</span>
          </button>

          {reconciliationResult && (
            <>
              <button
                onClick={handleSaveSession}
                disabled={savingSession}
                style={{
                  background: sessionSaveSuccess ? '#10b981' : 'rgba(255, 255, 255, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#ffffff',
                  padding: '0.55rem 0.9rem',
                  borderRadius: '9px',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  transition: 'all 0.2s'
                }}
              >
                {sessionSaveSuccess ? <Check size={16} /> : <Save size={16} />}
                <span>{sessionSaveSuccess ? 'Saved!' : 'Save Session'}</span>
              </button>

              <button
                onClick={handleExportExcel}
                style={{
                  background: '#10b981',
                  border: 'none',
                  color: '#ffffff',
                  padding: '0.55rem 0.95rem',
                  borderRadius: '9px',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
                }}
              >
                <Download size={16} />
                <span>Export Excel</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── STEP 1: PARTY SELECTION & ERP BOOK BALANCE ───────────────────────── */}
      <div
        style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-light, #e2e8f0)',
          borderRadius: '14px',
          padding: '1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#4f46e5',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              1
            </span>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Select Party & Accounting Period</h3>
          </div>

          {/* Party Type Toggle: Customer vs Vendor */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <button
              onClick={() => {
                setPartyType('customer');
                setSelectedParty(null);
                setErpData({ partyName: '', partyType: 'customer', totalDebit: 0, totalCredit: 0, closingBalance: 0, transactions: [] });
              }}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: partyType === 'customer' ? '#4f46e5' : 'transparent',
                color: partyType === 'customer' ? '#ffffff' : '#64748b',
                transition: 'all 0.15s'
              }}
            >
              Customers (Debtors / Sales)
            </button>
            <button
              onClick={() => {
                setPartyType('vendor');
                setSelectedParty(null);
                setErpData({ partyName: '', partyType: 'vendor', totalDebit: 0, totalCredit: 0, closingBalance: 0, transactions: [] });
              }}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: partyType === 'vendor' ? '#4f46e5' : 'transparent',
                color: partyType === 'vendor' ? '#ffffff' : '#64748b',
                transition: 'all 0.15s'
              }}
            >
              Vendors (Creditors / Purchases)
            </button>
          </div>
        </div>

        {/* Inputs Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
          {/* Party Search Dropdown */}
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginBottom: '0.35rem' }}>
              {partyType === 'customer' ? 'Customer Account' : 'Vendor Account'}
            </label>
            <div
              onClick={() => setIsPartyDropdownOpen(!isPartyDropdownOpen)}
              style={{
                border: '1.5px solid #cbd5e1',
                borderRadius: '9px',
                padding: '0.65rem 0.85rem',
                background: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedParty ? (
                  <div>
                    <span style={{ fontWeight: 800, color: '#0f172a' }}>{selectedParty.name}</span>
                    {selectedParty.gstin && (
                      <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '6px' }}>({selectedParty.gstin})</span>
                    )}
                  </div>
                ) : (
                  <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Search or choose {partyType}...</span>
                )}
              </div>
              <ChevronDown size={16} color="#64748b" />
            </div>

            {/* Dropdown Menu */}
            {isPartyDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  background: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '10px',
                  boxShadow: '0 15px 35px -5px rgba(0,0,0,0.18)',
                  zIndex: 50,
                  maxHeight: '280px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ padding: '0.5rem', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, background: '#ffffff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f8fafc', padding: '0.35rem 0.6rem', borderRadius: '7px', border: '1px solid #e2e8f0' }}>
                    <Search size={14} color="#94a3b8" />
                    <input
                      type="text"
                      placeholder={`Filter ${partyType}s...`}
                      value={partySearchQuery}
                      onChange={(e) => setPartySearchQuery(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.8rem' }}
                      autoFocus
                    />
                  </div>
                </div>

                {loadingParties ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>Loading parties...</div>
                ) : partiesList.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>No parties found matching query</div>
                ) : (
                  partiesList.map((p) => (
                    <div
                      key={p._id}
                      onClick={() => handleSelectParty(p)}
                      style={{
                        padding: '0.6rem 0.85rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.83rem', color: '#0f172a' }}>{p.name}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          {p.gstin ? `GST: ${p.gstin}` : 'No GSTIN'} {p.phone ? `• Tel: ${p.phone}` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.8rem', color: Number(p.balance) >= 0 ? '#16a34a' : '#dc2626' }}>
                          {fmtINR(p.balance)}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>ERP Bal</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Date Range Picker */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginBottom: '0.35rem' }}>
              Reconciliation Period ({activeRange.labelText})
            </label>
            <DateRangePicker
              preset={datePreset}
              onChange={({ preset: p, customStart: cs, customEnd: ce }) => {
                setDatePreset(p);
                if (cs) setCustomStart(cs);
                if (ce) setCustomEnd(ce);
              }}
              customStart={customStart}
              customEnd={customEnd}
            />
          </div>

          {/* Action to Refresh / Fetch ERP Books */}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={() => fetchErpLedgerData()}
              disabled={erpLoading || !selectedParty}
              style={{
                width: '100%',
                padding: '0.65rem 1rem',
                borderRadius: '9px',
                border: 'none',
                background: erpLoading ? '#94a3b8' : '#4f46e5',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.84rem',
                cursor: erpLoading || !selectedParty ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
              }}
            >
              <RefreshCw size={16} className={erpLoading ? 'animate-spin' : ''} />
              <span>{erpLoading ? 'Fetching Books...' : 'Load ERP Ledger'}</span>
            </button>
          </div>
        </div>

        {/* Selected Party Summary Bar */}
        {selectedParty && (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '0.85rem 1.1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
                  {selectedParty.name}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  GSTIN: {selectedParty.gstin || 'Unregistered'} • Phone: {selectedParty.phone || 'N/A'} • Entity: {companyEntity}
                </div>
              </div>
            </div>

            {/* ERP Ledger Stats Cards */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Total Debits (Sales)</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#2563eb' }}>{fmtINR(erpData.totalDebit)}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Total Credits (Payments)</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#16a34a' }}>{fmtINR(erpData.totalCredit)}</span>
              </div>
              <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '1rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>ERP Closing Balance</span>
                <span style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>{fmtINR(erpData.closingBalance)}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Txn Count</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#475569' }}>{erpData.transactions.length} entries</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── STEP 2: EXTERNAL STATEMENT INGESTION & GROK VISION PARSER ────────── */}
      <div
        style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-light, #e2e8f0)',
          borderRadius: '14px',
          padding: '1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#0ea5e9',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              2
            </span>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>
              Ingest Counterparty Statement (PDF, Image, or Tally Text)
            </h3>
          </div>

          {/* Statement Input Mode Selector */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <button
              onClick={() => setStatementSource('file')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: statementSource === 'file' ? '#0ea5e9' : 'transparent',
                color: statementSource === 'file' ? '#ffffff' : '#64748b'
              }}
            >
              PDF / Statement Photo
            </button>
            <button
              onClick={() => setStatementSource('text')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: statementSource === 'text' ? '#0ea5e9' : 'transparent',
                color: statementSource === 'text' ? '#ffffff' : '#64748b'
              }}
            >
              Paste Tally / Excel Text
            </button>
            <button
              onClick={() => setStatementSource('manual')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: statementSource === 'manual' ? '#0ea5e9' : 'transparent',
                color: statementSource === 'manual' ? '#ffffff' : '#64748b'
              }}
            >
              Manual Grid ({parsedStatement.transactions.length})
            </button>
          </div>
        </div>

        {/* File Dropzone */}
        {statementSource === 'file' && (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed #93c5fd',
              borderRadius: '12px',
              padding: '1.75rem',
              textAlign: 'center',
              background: '#f0f9ff',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'border-color 0.2s'
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*,application/pdf"
              style={{ display: 'none' }}
            />
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
              <UploadCloud size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0369a1' }}>
                {statementFile ? statementFile.name : 'Click to Upload Party Ledger PDF or Image'}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                Supports scanned statements, Tally screenshots, Busy exports, bank slips (JPG, PNG, PDF up to 10MB)
              </div>
            </div>
            {statementFile && (
              <span style={{ fontSize: '0.72rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                {(statementFile.size / 1024).toFixed(1)} KB Ready
              </span>
            )}
          </div>
        )}

        {/* Text Paste Area */}
        {statementSource === 'text' && (
          <div>
            <textarea
              placeholder="Paste raw ledger text copied from Tally Prime, Busy, Excel, or WhatsApp here...
Example:
01/04/2024  INV-0492  Tax Invoice  1,25,000.00  Dr
15/04/2024  NEFT-491  Bank Payment  50,000.00  Cr"
              value={rawStatementText}
              onChange={(e) => setRawStatementText(e.target.value)}
              rows={5}
              style={{
                width: '100%',
                padding: '0.85rem',
                borderRadius: '9px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.82rem',
                fontFamily: 'monospace',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        )}

        {/* Parse Statement Action */}
        {(statementSource === 'file' || statementSource === 'text') && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
              Uses Grok Vision to auto-extract date, voucher number, debit, credit & balance
            </span>
            <button
              onClick={handleParseStatement}
              disabled={parsingStatement || (!statementBase64 && !rawStatementText.trim())}
              style={{
                padding: '0.65rem 1.25rem',
                borderRadius: '9px',
                border: 'none',
                background: parsingStatement ? '#94a3b8' : 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.84rem',
                cursor: parsingStatement || (!statementBase64 && !rawStatementText.trim()) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
              }}
            >
              <Sparkles size={16} className={parsingStatement ? 'animate-spin' : ''} />
              <span>{parsingStatement ? 'AI Extracting Ledger...' : 'Parse Statement with Grok AI'}</span>
            </button>
          </div>
        )}

        {/* Parsed Statement Review Grid */}
        {parsedStatement.transactions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <CheckCircle2 size={18} color="#16a34a" />
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#16a34a' }}>
                  Extracted {parsedStatement.transactions.length} Transactions from Statement
                </span>
                <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  (Closing: {fmtINR(parsedStatement.closingBalance)} {parsedStatement.closingBalanceType})
                </span>
              </div>
              <button
                onClick={handleAddManualStatementRow}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Plus size={14} /> Add Entry
              </button>
            </div>

            {/* Editable Statement Table */}
            <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 5 }}>
                  <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
                    <th style={{ padding: '0.5rem 0.75rem', width: '110px' }}>Date</th>
                    <th style={{ padding: '0.5rem 0.75rem', width: '140px' }}>Voucher / Ref</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Narration</th>
                    <th style={{ padding: '0.5rem 0.75rem', width: '110px', textAlign: 'right' }}>Debit (₹)</th>
                    <th style={{ padding: '0.5rem 0.75rem', width: '110px', textAlign: 'right' }}>Credit (₹)</th>
                    <th style={{ padding: '0.5rem 0.5rem', width: '40px', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {parsedStatement.transactions.map((tx, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.35rem 0.75rem' }}>
                        <input
                          type="date"
                          value={tx.date || ''}
                          onChange={(e) => handleUpdateStatementRow(idx, 'date', e.target.value)}
                          style={{ width: '100%', border: '1px solid transparent', padding: '2px', fontSize: '0.76rem', background: 'transparent' }}
                        />
                      </td>
                      <td style={{ padding: '0.35rem 0.75rem' }}>
                        <input
                          type="text"
                          value={tx.voucherNo || tx.ref || ''}
                          onChange={(e) => handleUpdateStatementRow(idx, 'voucherNo', e.target.value)}
                          style={{ width: '100%', border: '1px solid transparent', padding: '2px', fontSize: '0.76rem', fontWeight: 700 }}
                        />
                      </td>
                      <td style={{ padding: '0.35rem 0.75rem' }}>
                        <input
                          type="text"
                          value={tx.narration || ''}
                          onChange={(e) => handleUpdateStatementRow(idx, 'narration', e.target.value)}
                          style={{ width: '100%', border: '1px solid transparent', padding: '2px', fontSize: '0.76rem' }}
                        />
                      </td>
                      <td style={{ padding: '0.35rem 0.75rem', textAlign: 'right' }}>
                        <input
                          type="number"
                          value={tx.debit || 0}
                          onChange={(e) => handleUpdateStatementRow(idx, 'debit', Number(e.target.value))}
                          style={{ width: '100%', border: '1px solid transparent', padding: '2px', fontSize: '0.76rem', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}
                        />
                      </td>
                      <td style={{ padding: '0.35rem 0.75rem', textAlign: 'right' }}>
                        <input
                          type="number"
                          value={tx.credit || 0}
                          onChange={(e) => handleUpdateStatementRow(idx, 'credit', Number(e.target.value))}
                          style={{ width: '100%', border: '1px solid transparent', padding: '2px', fontSize: '0.76rem', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}
                        />
                      </td>
                      <td style={{ padding: '0.35rem 0.5rem', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteStatementRow(idx)}
                          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── STEP 3: EXECUTE 3-WAY RECONCILIATION MATCHING ENGINE ─────────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
          border: '1.5px solid #bfdbfe',
          borderRadius: '14px',
          padding: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#3b82f6', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Scale size={20} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#1e3a8a' }}>
              Run Automated 3-Way Reconciliation
            </h4>
            <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
              Matches ERP invoices & payments against statement entries with fuzzy reference detection
            </span>
          </div>
        </div>

        <button
          onClick={handleRunReconciliation}
          disabled={reconciling || !selectedParty}
          style={{
            padding: '0.75rem 1.6rem',
            borderRadius: '10px',
            border: 'none',
            background: reconciling || !selectedParty ? '#94a3b8' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '0.9rem',
            cursor: reconciling || !selectedParty ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            boxShadow: '0 6px 18px rgba(37, 99, 235, 0.3)'
          }}
        >
          <Scale size={18} className={reconciling ? 'animate-spin' : ''} />
          <span>{reconciling ? 'Reconciling Ledger...' : 'Run Automated Reconciliation'}</span>
        </button>
      </div>

      {/* ── STEP 4: RECONCILIATION KPI DASHBOARD & RESULTS MATRIX ─────────────── */}
      {reconciliationResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Executive KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
            {/* ERP Book Balance */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
              <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>ERP BOOK BALANCE</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1e293b', marginTop: '4px' }}>
                {fmtINR(reconciliationResult.summary?.erpClosingBalance)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                {reconciliationResult.summary?.erpTransactionsCount} ERP transactions
              </div>
            </div>

            {/* Counterparty Statement Balance */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
              <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>STATEMENT BALANCE</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0369a1', marginTop: '4px' }}>
                {fmtINR(reconciliationResult.summary?.statementClosingBalance)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                {reconciliationResult.summary?.statementTransactionsCount} external entries
              </div>
            </div>

            {/* Net Variance */}
            <div
              style={{
                background: Math.abs(reconciliationResult.summary?.variance || 0) < 1 ? '#f0fdf4' : '#fff1f2',
                border: `1.5px solid ${Math.abs(reconciliationResult.summary?.variance || 0) < 1 ? '#86efac' : '#fecdd3'}`,
                borderRadius: '12px',
                padding: '1rem'
              }}
            >
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: Math.abs(reconciliationResult.summary?.variance || 0) < 1 ? '#166534' : '#9f1239' }}>
                NET VARIANCE / DIFFERENCE
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: Math.abs(reconciliationResult.summary?.variance || 0) < 1 ? '#15803d' : '#e11d48', marginTop: '4px' }}>
                {fmtINR(reconciliationResult.summary?.variance)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                {Math.abs(reconciliationResult.summary?.variance || 0) < 1 ? 'Perfect Zero Variance' : 'Ledger Out of Balance'}
              </div>
            </div>

            {/* AI Forensic Audit Card & Action */}
            <div style={{ background: 'linear-gradient(135deg, #312e81, #1e1b4b)', borderRadius: '12px', padding: '1rem', color: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#a5b4fc', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={13} color="#38bdf8" /> DEEP FORENSIC AUDIT
                </div>
                <div style={{ fontSize: '0.86rem', fontWeight: 800, marginTop: '4px' }}>
                  {auditReport ? 'Audit Report Ready' : 'Investigate Root Causes'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  onClick={handleRunForensicAudit}
                  disabled={auditing}
                  style={{
                    background: '#38bdf8',
                    border: 'none',
                    color: '#0f172a',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    fontWeight: 800,
                    fontSize: '0.74rem',
                    cursor: auditing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Sparkles size={13} className={auditing ? 'animate-spin' : ''} />
                  <span>{auditing ? 'Auditing...' : auditReport ? 'Re-Audit' : 'Run Audit'}</span>
                </button>
                {auditReport && (
                  <button
                    onClick={() => setShowAuditModal(true)}
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      color: '#ffffff',
                      padding: '0.4rem 0.65rem',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '0.74rem',
                      cursor: 'pointer'
                    }}
                  >
                    View
                  </button>
                )}
                <button
                  onClick={() => handleDraftNotice()}
                  disabled={draftingNotice}
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    color: '#ffffff',
                    padding: '0.4rem 0.65rem',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '0.74rem',
                    cursor: draftingNotice ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Share2 size={13} />
                  <span>Notice</span>
                </button>
              </div>
            </div>
          </div>

          {/* Breakdown Tabs Filter */}
          <div
            style={{
              background: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-light, #e2e8f0)',
              borderRadius: '14px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              {/* Category Pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                {[
                  { id: 'all', label: 'All Entries', count: filteredMatrixItems.length },
                  { id: 'matched', label: 'Matched (Exact)', count: reconciliationResult.summary?.matchedCount || 0, color: '#16a34a' },
                  { id: 'probable', label: 'Probable Matches', count: reconciliationResult.summary?.probableCount || 0, color: '#ca8a04' },
                  { id: 'discrepant', label: 'Discrepancies', count: reconciliationResult.summary?.discrepantCount || 0, color: '#dc2626' },
                  { id: 'unmatchedStmt', label: 'Missing in Statement', count: reconciliationResult.summary?.unmatchedStatementCount || 0, color: '#ea580c' },
                  { id: 'unmatchedErp', label: 'Missing in ERP', count: reconciliationResult.summary?.unmatchedErpCount || 0, color: '#7c3aed' }
                ].map((tab) => {
                  const isActive = activeFilterTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveFilterTab(tab.id)}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: isActive ? '#4f46e5' : '#e2e8f0',
                        background: isActive ? '#4f46e5' : '#ffffff',
                        color: isActive ? '#ffffff' : '#475569',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s'
                      }}
                    >
                      <span>{tab.label}</span>
                      <span
                        style={{
                          background: isActive ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                          color: isActive ? '#ffffff' : tab.color || '#475569',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          fontSize: '0.7rem'
                        }}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search Inside Table */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f8fafc', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', minWidth: '220px' }}>
                <Search size={14} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Filter vouchers, narration..."
                  value={matrixSearch}
                  onChange={(e) => setMatrixSearch(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.78rem', width: '100%' }}
                />
              </div>
            </div>

            {/* Comparison Matrix Table */}
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '0.65rem 0.85rem', width: '120px' }}>Status</th>
                    <th style={{ padding: '0.65rem 0.85rem', width: '110px' }}>Date</th>
                    <th style={{ padding: '0.65rem 0.85rem', width: '150px' }}>Voucher / Ref</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Description & Narration</th>
                    <th style={{ padding: '0.65rem 0.85rem', width: '120px', textAlign: 'right' }}>ERP Amount</th>
                    <th style={{ padding: '0.65rem 0.85rem', width: '120px', textAlign: 'right' }}>Statement Amount</th>
                    <th style={{ padding: '0.65rem 0.85rem', width: '110px', textAlign: 'right' }}>Diff / Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMatrixItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                        No records match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredMatrixItems.map((item, idx) => {
                      const isMatched = item._bucket === 'matched';
                      const isProbable = item._bucket === 'probable';
                      const isDiscrepant = item._bucket === 'discrepant';
                      const isMissingStmt = item._bucket === 'unmatchedStmt';
                      const isMissingErp = item._bucket === 'unmatchedErp';

                      let badgeText = 'MATCHED';
                      let badgeBg = '#dcfce7';
                      let badgeColor = '#15803d';
                      let badgeIcon = <CheckCircle2 size={13} />;

                      if (isProbable) {
                        badgeText = 'PROBABLE';
                        badgeBg = '#fef9c3';
                        badgeColor = '#a16207';
                        badgeIcon = <HelpCircle size={13} />;
                      } else if (isDiscrepant) {
                        badgeText = 'AMOUNT DIFF';
                        badgeBg = '#fee2e2';
                        badgeColor = '#b91c1c';
                        badgeIcon = <AlertTriangle size={13} />;
                      } else if (isMissingStmt) {
                        badgeText = 'ERP ONLY';
                        badgeBg = '#ffedd5';
                        badgeColor = '#c2410c';
                        badgeIcon = <ArrowUpRight size={13} />;
                      } else if (isMissingErp) {
                        badgeText = 'STMT ONLY';
                        badgeBg = '#ede9fe';
                        badgeColor = '#6d28d9';
                        badgeIcon = <ArrowDownLeft size={13} />;
                      }

                      return (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: idx % 2 === 0 ? '#ffffff' : '#fafafa'
                          }}
                        >
                          {/* Status Badge */}
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <span
                              style={{
                                background: badgeBg,
                                color: badgeColor,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              {badgeIcon} {badgeText}
                            </span>
                          </td>

                          {/* Date */}
                          <td style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>
                            {item.date || item.erpDate || item.statementDate || '—'}
                          </td>

                          {/* Voucher No */}
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: 800, color: '#0f172a' }}>
                            {item.voucherNo || item.erpVoucherNo || item.ref || '—'}
                          </td>

                          {/* Narration */}
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <div style={{ color: '#1e293b', fontWeight: 600 }}>
                              {item.narration || item.erpNarration || item.statementNarration || '—'}
                            </div>
                            {item.reason && (
                              <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '2px' }}>
                                Note: {item.reason}
                              </div>
                            )}
                          </td>

                          {/* ERP Amount */}
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>
                            {item.erpAmount !== undefined ? fmtINR(item.erpAmount) : item.debit ? fmtINR(item.debit) : item.credit ? fmtINR(item.credit) : '—'}
                          </td>

                          {/* Statement Amount */}
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: '#0369a1' }}>
                            {item.statementAmount !== undefined ? fmtINR(item.statementAmount) : item.amount ? fmtINR(item.amount) : '—'}
                          </td>

                          {/* Difference */}
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 800 }}>
                            {item.difference ? (
                              <span style={{ color: '#dc2626' }}>{fmtINR(item.difference)}</span>
                            ) : (
                              <span style={{ color: '#16a34a' }}>₹ 0.00</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: GROK DEEP FORENSIC AUDIT REPORT ───────────────────────────── */}
      {showAuditModal && auditReport && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '16px', width: '100%', maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#312e81', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                    Grok AI Forensic Audit Report
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    Party: {selectedParty?.name || erpData.partyName} • Dispute Risk: <strong>{auditReport.disputeRisk || 'MEDIUM'}</strong>
                  </span>
                </div>
              </div>
              <button onClick={() => setShowAuditModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '0.4rem 0.6rem', cursor: 'pointer', fontSize: '1rem', color: '#64748b' }}>
                ✕
              </button>
            </div>

            {/* Executive Summary */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#1e40af', marginBottom: '4px' }}>
                EXECUTIVE AUDIT SUMMARY
              </div>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#1e293b', lineHeight: 1.5 }}>
                {auditReport.auditSummary || 'No summary generated.'}
              </p>
            </div>

            {/* Root Causes */}
            {auditReport.rootCauses?.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                  Identified Root Causes & Discrepancy Drivers
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {auditReport.rootCauses.map((rc, idx) => (
                    <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.8rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0f172a' }}>{rc.title}</span>
                        {rc.impactAmount ? (
                          <span style={{ fontWeight: 800, fontSize: '0.8rem', color: '#dc2626' }}>{fmtINR(rc.impactAmount)}</span>
                        ) : null}
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#475569' }}>{rc.description}</p>
                      {rc.evidence && (
                        <div style={{ fontSize: '0.72rem', color: '#2563eb', marginTop: '4px' }}>
                          Evidence: {rc.evidence}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Action Steps for Accounts Team */}
            {auditReport.recommendedActions?.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                  Action Steps for Accounts Team
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {auditReport.recommendedActions.map((ra, idx) => (
                    <div key={idx} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                      <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#166534' }}>{ra.action}</div>
                        <div style={{ fontSize: '0.76rem', color: '#1e293b', marginTop: '2px' }}>{ra.instruction}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
              <button
                onClick={() => {
                  setShowAuditModal(false);
                  handleDraftNotice();
                }}
                style={{
                  background: '#4f46e5',
                  border: 'none',
                  color: '#ffffff',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Share2 size={14} />
                <span>Draft WhatsApp Settlement Notice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: SETTLEMENT NOTICE & WHATSAPP SENDER ───────────────────────── */}
      {showNoticeModal && settlementNotice && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '16px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#22c55e', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageSquare size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                    Reconciliation Notice & WhatsApp Draft
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    Party: {selectedParty?.name || erpData.partyName} • Phone: {selectedParty?.phone || 'Not provided'}
                  </span>
                </div>
              </div>
              <button onClick={() => setShowNoticeModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '0.4rem 0.6rem', cursor: 'pointer', fontSize: '1rem', color: '#64748b' }}>
                ✕
              </button>
            </div>

            {/* Tone Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b' }}>Tone:</span>
              {[
                { id: 'POLITE_PROFESSIONAL', label: 'Polite & Professional' },
                { id: 'FRIENDLY_REMINDER', label: 'Friendly Reminder' },
                { id: 'FORMAL_AUDIT_NOTICE', label: 'Formal CA Audit' }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setNoticeTone(t.id);
                    handleDraftNotice(t.id);
                  }}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: noticeTone === t.id ? '#22c55e' : '#f8fafc',
                    color: noticeTone === t.id ? '#ffffff' : '#475569',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* WhatsApp Message Preview */}
            <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 800, fontSize: '0.8rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <MessageSquare size={14} /> WhatsApp Message Format
                </span>
                <button
                  onClick={() => handleCopyNotice(settlementNotice.whatsappMessage)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #86efac',
                    color: '#166534',
                    padding: '0.25rem 0.55rem',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {copyFeedback ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copyFeedback ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.8rem',
                  fontFamily: 'inherit',
                  color: '#14532d',
                  lineHeight: 1.5,
                  background: '#ffffff',
                  padding: '0.85rem',
                  borderRadius: '8px',
                  border: '1px solid #bbf7d0',
                  maxHeight: '220px',
                  overflowY: 'auto'
                }}
              >
                {settlementNotice.whatsappMessage}
              </pre>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                Opens WhatsApp Web or mobile app directly
              </span>
              <div style={{ display: 'flex', gap: '0.65rem' }}>
                <button
                  onClick={() => handleCopyNotice(settlementNotice.whatsappMessage)}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    padding: '0.55rem 0.95rem',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Copy Message
                </button>
                <button
                  onClick={() => handleOpenWhatsApp(settlementNotice.whatsappMessage)}
                  style={{
                    background: '#22c55e',
                    border: 'none',
                    color: '#ffffff',
                    padding: '0.55rem 1.15rem',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
                  }}
                >
                  <Send size={14} />
                  <span>Send via WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DRAWER: GROK FINANCIAL COPILOT CHAT ──────────────────────────────── */}
      {copilotOpen && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', maxWidth: '100vw', background: '#ffffff', borderLeft: '1.5px solid #cbd5e1', boxShadow: '-15px 0 35px -5px rgba(0,0,0,0.18)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
          {/* Copilot Header */}
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #1e1b4b, #312e81)', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={20} color="#38bdf8" />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Grok Financial Copilot</h4>
                <span style={{ fontSize: '0.72rem', color: '#a5b4fc' }}>Live Ledger Context Attached</span>
              </div>
            </div>
            <button onClick={() => setCopilotOpen(false)} style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.2rem', cursor: 'pointer' }}>
              ✕
            </button>
          </div>

          {/* Chat Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', background: '#f8fafc' }}>
            {copilotMessages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: msg.role === 'user' ? '#4f46e5' : '#ffffff',
                  color: msg.role === 'user' ? '#ffffff' : '#0f172a',
                  padding: '0.75rem 0.95rem',
                  borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  border: msg.role === 'user' ? 'none' : '1px solid #e2e8f0',
                  fontSize: '0.82rem',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap'
                }}
              >
                {msg.content}
              </div>
            ))}
            {copilotLoading && (
              <div style={{ alignSelf: 'flex-start', background: '#ffffff', border: '1px solid #e2e8f0', padding: '0.65rem 0.95rem', borderRadius: '12px', fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={14} className="animate-spin" color="#4f46e5" />
                <span>Grok is reasoning...</span>
              </div>
            )}
            <div ref={copilotChatEndRef} />
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendCopilotMessage} style={{ padding: '0.85rem', borderTop: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Ask anything about this party ledger..."
              value={copilotInput}
              onChange={(e) => setCopilotInput(e.target.value)}
              style={{
                flex: 1,
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.82rem',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={copilotLoading || !copilotInput.trim()}
              style={{
                background: copilotLoading || !copilotInput.trim() ? '#94a3b8' : '#4f46e5',
                border: 'none',
                color: '#ffffff',
                padding: '0.65rem 0.95rem',
                borderRadius: '8px',
                cursor: copilotLoading || !copilotInput.trim() ? 'not-allowed' : 'pointer'
              }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      {/* ── MODAL: SESSIONS HISTORY ─────────────────────────────────────────── */}
      {showHistoryModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '16px', width: '100%', maxWidth: '750px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <History size={22} color="#4f46e5" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                  Reconciliation Sessions History
                </h3>
              </div>
              <button onClick={() => setShowHistoryModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '0.4rem 0.6rem', cursor: 'pointer', fontSize: '1rem', color: '#64748b' }}>
                ✕
              </button>
            </div>

            {loadingHistory ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading past sessions...</div>
            ) : historySessions.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No saved reconciliation sessions found yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {historySessions.map((s, idx) => (
                  <div
                    key={s._id || idx}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '0.95rem 1.15rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#f8fafc'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>{s.partyName}</div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                        Type: {s.partyType?.toUpperCase()} • Reconciled on: {new Date(s.createdAt || Date.now()).toLocaleDateString('en-IN')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: Math.abs(s.variance || 0) < 1 ? '#16a34a' : '#dc2626' }}>
                          Variance: {fmtINR(s.variance)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{s.status}</div>
                      </div>
                      <button
                        onClick={() => handleRestoreSession(s)}
                        style={{
                          background: '#4f46e5',
                          border: 'none',
                          color: '#ffffff',
                          padding: '0.4rem 0.85rem',
                          borderRadius: '6px',
                          fontWeight: 700,
                          fontSize: '0.76rem',
                          cursor: 'pointer'
                        }}
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
