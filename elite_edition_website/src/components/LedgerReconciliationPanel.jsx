import React, { useState, useMemo, useRef } from 'react';
import {
  Scale,
  UploadCloud,
  FileText,
  Search,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Download,
  Share2,
  Send,
  MessageSquare,
  Bot,
  Plus,
  Trash2,
  Check,
  Copy,
  ArrowRight,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  Edit2,
  Play,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';

// Currency formatter for Indian Rupees
const fmtINR = (val) => {
  const num = Number(val) || 0;
  return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function LedgerReconciliationPanel() {
  // ── Elite Files State (Book A) ─────────────────────────────────────────────
  const [stmt1Name, setStmt1Name] = useState('Elite Files');
  const [stmt1Mode, setStmt1Mode] = useState('file'); // 'file', 'text', 'manual'
  const [stmt1File, setStmt1File] = useState(null);
  const [stmt1Base64, setStmt1Base64] = useState('');
  const [stmt1Text, setStmt1Text] = useState('');
  const [stmt1Parsing, setStmt1Parsing] = useState(false);
  const [stmt1Transactions, setStmt1Transactions] = useState([]);
  const [stmt1OpeningBal, setStmt1OpeningBal] = useState(0);
  const fileInputRef1 = useRef(null);
  const isParsing1Ref = useRef(false);

  // ── Party / Vendor OR Other file State (Book B) ─────────────────────────────
  const [stmt2Name, setStmt2Name] = useState('Party / Vendor OR Other file');
  const [stmt2Mode, setStmt2Mode] = useState('file'); // 'file', 'text', 'manual'
  const [stmt2File, setStmt2File] = useState(null);
  const [stmt2Base64, setStmt2Base64] = useState('');
  const [stmt2Text, setStmt2Text] = useState('');
  const [stmt2Parsing, setStmt2Parsing] = useState(false);
  const [stmt2Transactions, setStmt2Transactions] = useState([]);
  const [stmt2OpeningBal, setStmt2OpeningBal] = useState(0);
  const fileInputRef2 = useRef(null);
  const isParsing2Ref = useRef(false);

  // ── AI Prompt Directive State ─────────────────────────────────────────────
  const [reconciliationPrompt, setReconciliationPrompt] = useState(
    'muje ye dono ledger reconcilation karke do'
  );

  // ── Reconciliation Results ────────────────────────────────────────────────
  const [reconciling, setReconciling] = useState(false);
  const isReconcilingRef = useRef(false);
  const [reconciliationResult, setReconciliationResult] = useState(null);
  const [activeFilterTab, setActiveFilterTab] = useState('all');
  const [matrixSearch, setMatrixSearch] = useState('');

  // ── AI Forensic Audit ─────────────────────────────────────────────────────
  const [auditing, setAuditing] = useState(false);
  const [auditReport, setAuditReport] = useState(null);
  const [showAuditModal, setShowAuditModal] = useState(false);

  // ── Settlement Notice Generator ───────────────────────────────────────────
  const [draftingNotice, setDraftingNotice] = useState(false);
  const [settlementNotice, setSettlementNotice] = useState(null);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeTone, setNoticeTone] = useState('POLITE_PROFESSIONAL');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [partyPhone, setPartyPhone] = useState('');

  // ── Elite AI Financial Copilot ──────────────────────────────────────────────
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am your Universal Elite AI Financial Copilot. Upload or paste any two ledgers, bank statements, or account summaries, and I will assist you with cross-matching, missing voucher identification, and variance resolution.'
    }
  ]);
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const copilotChatEndRef = useRef(null);

  // Statement 1 Calculations
  const stmt1Stats = useMemo(() => {
    const totalDebit = stmt1Transactions.reduce((acc, t) => acc + (Number(t.debit) || 0), 0);
    const totalCredit = stmt1Transactions.reduce((acc, t) => acc + (Number(t.credit) || 0), 0);
    const netBalance = Number(stmt1OpeningBal || 0) + (totalDebit - totalCredit);
    return { totalDebit, totalCredit, netBalance, count: stmt1Transactions.length };
  }, [stmt1Transactions, stmt1OpeningBal]);

  // Statement 2 Calculations
  const stmt2Stats = useMemo(() => {
    const totalDebit = stmt2Transactions.reduce((acc, t) => acc + (Number(t.debit) || 0), 0);
    const totalCredit = stmt2Transactions.reduce((acc, t) => acc + (Number(t.credit) || 0), 0);
    const netBalance = Number(stmt2OpeningBal || 0) + (totalDebit - totalCredit);
    return { totalDebit, totalCredit, netBalance, count: stmt2Transactions.length };
  }, [stmt2Transactions, stmt2OpeningBal]);

  // Helper to parse Statement 1
  const parseStmt1WithData = async (b64, txt, party) => {
    if (isParsing1Ref.current) return false;
    const base64ToUse = b64 !== undefined ? b64 : stmt1Base64;
    const textToUse = txt !== undefined ? txt : stmt1Text;
    const nameToUse = party !== undefined ? party : stmt1Name;
    if (!base64ToUse && !textToUse.trim()) return false;

    isParsing1Ref.current = true;
    setStmt1Parsing(true);
    try {
      const res = await api.parseReconciliationStatement({
        rawText: textToUse,
        imageBase64: base64ToUse,
        partyType: 'general',
        partyName: nameToUse
      });
      if (res?.success && res.parsedData) {
        if (Array.isArray(res.parsedData.transactions) && res.parsedData.transactions.length > 0) {
          setStmt1Transactions(res.parsedData.transactions);
        }
        if (res.parsedData.openingBalance) setStmt1OpeningBal(Number(res.parsedData.openingBalance));
        if (res.parsedData.statementParty && (!stmt1Name || stmt1Name === 'Elite Files' || stmt1Name.includes('Statement 1'))) {
          setStmt1Name(res.parsedData.statementParty);
        }
        return res.parsedData.transactions || [];
      } else {
        alert(res?.message || 'Failed to extract transactions for Elite Files');
      }
    } catch (err) {
      console.error('Error parsing Elite Files:', err);
      const msg = err.response?.data?.message || err.message || 'Error parsing Elite Files with Elite AI';
      alert(msg);
    } finally {
      isParsing1Ref.current = false;
      setStmt1Parsing(false);
    }
    return false;
  };

  // Helper to parse Statement 2 (Party / Other File)
  const parseStmt2WithData = async (b64, txt, party) => {
    if (isParsing2Ref.current) return false;
    const base64ToUse = b64 !== undefined ? b64 : stmt2Base64;
    const textToUse = txt !== undefined ? txt : stmt2Text;
    const nameToUse = party !== undefined ? party : stmt2Name;
    if (!base64ToUse && !textToUse.trim()) return false;

    isParsing2Ref.current = true;
    setStmt2Parsing(true);
    try {
      const res = await api.parseReconciliationStatement({
        rawText: textToUse,
        imageBase64: base64ToUse,
        partyType: 'general',
        partyName: nameToUse
      });
      if (res?.success && res.parsedData) {
        if (Array.isArray(res.parsedData.transactions) && res.parsedData.transactions.length > 0) {
          setStmt2Transactions(res.parsedData.transactions);
        }
        if (res.parsedData.openingBalance) setStmt2OpeningBal(Number(res.parsedData.openingBalance));
        if (res.parsedData.statementParty && (!stmt2Name || stmt2Name === 'Party / Vendor OR Other file' || stmt2Name.includes('Statement 2'))) {
          setStmt2Name(res.parsedData.statementParty);
        }
        return res.parsedData.transactions || [];
      } else {
        alert(res?.message || 'Failed to extract transactions for Party / Vendor OR Other file');
      }
    } catch (err) {
      console.error('Error parsing Party File:', err);
      const msg = err.response?.data?.message || err.message || 'Error parsing Party / Other File with Elite AI';
      alert(msg);
    } finally {
      isParsing2Ref.current = false;
      setStmt2Parsing(false);
    }
    return false;
  };

  // Handle File 1 Upload
  const handleFile1Upload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStmt1File(file);
    if (!stmt1Name || stmt1Name === 'Elite Statement / ERP Ledger' || stmt1Name.includes('Statement 1')) {
      setStmt1Name(file.name.replace(/\.[^/.]+$/, ''));
    }

    // If Excel or CSV, extract text preview via SheetJS
    if (file.name.match(/\.(xlsx|xls|csv)$/i)) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = new Uint8Array(ev.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const localCsv = XLSX.utils.sheet_to_csv(worksheet);
          setStmt1Text(localCsv);
        } catch (err) {
          console.warn('SheetJS preview extraction error:', err);
        }
      };
      reader.readAsArrayBuffer(file);
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target.result;
      setStmt1Base64(b64);
    };
    reader.readAsDataURL(file);
  };

  // Handle File 2 Upload
  const handleFile2Upload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStmt2File(file);
    if (!stmt2Name || stmt2Name === 'Party / Vendor OR Other file' || stmt2Name.includes('Statement 2')) {
      setStmt2Name(file.name.replace(/\.[^/.]+$/, ''));
    }

    // If Excel or CSV, extract text preview via SheetJS
    if (file.name.match(/\.(xlsx|xls|csv)$/i)) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = new Uint8Array(ev.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const localCsv = XLSX.utils.sheet_to_csv(worksheet);
          setStmt2Text(localCsv);
        } catch (err) {
          console.warn('SheetJS preview extraction error:', err);
        }
      };
      reader.readAsArrayBuffer(file);
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target.result;
      setStmt2Base64(b64);
    };
    reader.readAsDataURL(file);
  };

  // Parse Statement 1 via Grok AI button (optional preview)
  const handleParseStmt1 = () => parseStmt1WithData();

  // Parse Statement 2 via Grok AI button (optional preview)
  const handleParseStmt2 = () => parseStmt2WithData();

  // Add Manual Row to Statement 1
  const handleAddRowStmt1 = () => {
    const today = new Date().toISOString().split('T')[0];
    setStmt1Transactions((prev) => [
      { date: today, voucherNo: `VCH-${Math.floor(1000 + Math.random() * 9000)}`, narration: 'Entry', debit: 0, credit: 0 },
      ...prev
    ]);
  };

  // Add Manual Row to Statement 2
  const handleAddRowStmt2 = () => {
    const today = new Date().toISOString().split('T')[0];
    setStmt2Transactions((prev) => [
      { date: today, voucherNo: `VCH-${Math.floor(1000 + Math.random() * 9000)}`, narration: 'Entry', debit: 0, credit: 0 },
      ...prev
    ]);
  };

  // Run Direct AI Reconciliation (Sends both files + prompt directly to Bot API)
  const handleRunReconciliation = async () => {
    if (isReconcilingRef.current) return;

    // Check if user has provided both File 1 and File 2
    const hasStmt1 = !!stmt1File || !!stmt1Base64 || !!stmt1Text.trim() || (Array.isArray(stmt1Transactions) && stmt1Transactions.length > 0);
    const hasStmt2 = !!stmt2File || !!stmt2Base64 || !!stmt2Text.trim() || (Array.isArray(stmt2Transactions) && stmt2Transactions.length > 0);

    if (!hasStmt1 || !hasStmt2) {
      alert('Please upload or select both files: Elite File (File 1) and Party / Vendor File (File 2) before reconciling.');
      return;
    }

    isReconcilingRef.current = true;
    setReconciling(true);
    try {
      // Parse custom prompt directives if present
      const daysMatch = reconciliationPrompt ? reconciliationPrompt.match(/(\d+)\s*days?/i) : null;
      const toleranceDays = daysMatch ? Number(daysMatch[1]) : 20;

      const amtMatch = reconciliationPrompt ? reconciliationPrompt.match(/(?:₹|rs\.?|tolerance|diff)\s*(\d+(?:\.\d+)?)/i) : null;
      const toleranceAmount = amtMatch ? Number(amtMatch[1]) : 2.0;

      const payload = {
        file1Base64: stmt1Base64,
        file1Text: stmt1Text,
        file1Name: stmt1Name || stmt1File?.name || 'Elite Files',
        file2Base64: stmt2Base64,
        file2Text: stmt2Text,
        file2Name: stmt2Name || stmt2File?.name || 'Party / Vendor File',
        stmt1Transactions,
        stmt2Transactions,
        stmt1OpeningBal,
        stmt2OpeningBal,
        toleranceDays,
        toleranceAmount,
        userPrompt: reconciliationPrompt
      };

      const res = await api.reconcileDirectFiles(payload);
      if (res?.success) {
        // Automatically populate extracted transactions into the grids
        if (Array.isArray(res.stmt1Transactions) && res.stmt1Transactions.length > 0) {
          setStmt1Transactions(res.stmt1Transactions);
        }
        if (Array.isArray(res.stmt2Transactions) && res.stmt2Transactions.length > 0) {
          setStmt2Transactions(res.stmt2Transactions);
        }
        if (res.stmt1OpeningBal !== undefined) setStmt1OpeningBal(Number(res.stmt1OpeningBal) || 0);
        if (res.stmt2OpeningBal !== undefined) setStmt2OpeningBal(Number(res.stmt2OpeningBal) || 0);

        setReconciliationResult(res);

        if (res.auditReport) {
          setAuditReport(res.auditReport);
        }
      } else {
        alert(res?.message || 'Reconciliation failed.');
      }
    } catch (err) {
      console.error('Reconciliation error:', err);
      alert('Failed to execute reconciliation: ' + (err.message || ''));
    } finally {
      isReconcilingRef.current = false;
      setReconciling(false);
    }
  };

  // Run Grok Deep Forensic Discrepancy Audit
  const handleRunForensicAudit = async () => {
    if (!reconciliationResult) {
      alert('Please run reconciliation first.');
      return;
    }

    setAuditing(true);
    try {
      const payload = {
        partyName: `${stmt1Name} vs ${stmt2Name}`,
        partyType: 'general',
        erpClosingBalance: stmt1Stats.netBalance,
        statementClosingBalance: stmt2Stats.netBalance,
        variance: reconciliationResult.summary?.variance || (stmt1Stats.netBalance - stmt2Stats.netBalance),
        unmatchedStatementItems: reconciliationResult.unmatchedStatementItems || [],
        unmatchedErpItems: reconciliationResult.unmatchedErpItems || [],
        discrepantItems: reconciliationResult.discrepantItems || [],
        userPrompt: reconciliationPrompt
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
      const msg = err.response?.data?.message || err.message || 'Elite AI audit encountered an error.';
      alert(msg);
    } finally {
      setAuditing(false);
    }
  };

  // Draft Settlement Notice
  const handleDraftNotice = async (overrideTone) => {
    if (!reconciliationResult) {
      alert('Please run reconciliation first.');
      return;
    }
    setDraftingNotice(true);
    const tone = overrideTone || noticeTone;
    try {
      const payload = {
        partyName: stmt2Name,
        partyType: 'counterparty',
        agreedBalance: stmt1Stats.netBalance,
        variance: reconciliationResult.summary?.variance || (stmt1Stats.netBalance - stmt2Stats.netBalance),
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

  // Copy notice
  const handleCopyNotice = (text) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  // Open WhatsApp
  const handleOpenWhatsApp = (text) => {
    const phone = partyPhone.replace(/[^0-9]/g, '');
    const cleanPhone = phone.length === 10 ? `91${phone}` : phone;
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Send Copilot Message
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
          statement1Name: stmt1Name,
          statement1Balance: stmt1Stats.netBalance,
          statement1TxnCount: stmt1Stats.count,
          statement2Name: stmt2Name,
          statement2Balance: stmt2Stats.netBalance,
          statement2TxnCount: stmt2Stats.count,
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
      setTimeout(() => copilotChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  // Export Matrix to Excel
  const handleExportExcel = () => {
    if (!reconciliationResult) {
      alert('No reconciliation data available to export.');
      return;
    }

    const wb = XLSX.utils.book_new();

    // 1. Summary Sheet
    const summaryData = [
      ['ELITE EDITION - RECONCILIATION & AUDIT REPORT'],
      ['Elite Files (Book 1)', stmt1Name],
      ['Party / Other File (Book 2)', stmt2Name],
      ['Date Generated', new Date().toLocaleString('en-IN')],
      [],
      ['RECONCILIATION METRICS', 'VALUES'],
      ['Elite Files Net Balance', stmt1Stats.netBalance],
      ['Party / Other File Net Balance', stmt2Stats.netBalance],
      ['Net Variance / Discrepancy', reconciliationResult.summary?.variance || (stmt1Stats.netBalance - stmt2Stats.netBalance)],
      ['Total Matched Entries', reconciliationResult.summary?.matchedCount || 0],
      ['Probable Matches', reconciliationResult.summary?.probableCount || 0],
      ['Amount Discrepancies', reconciliationResult.summary?.discrepantCount || 0],
      ['In Party File Only (Missing in Elite)', reconciliationResult.summary?.unmatchedStatementCount || 0],
      ['In Elite Files Only (Missing in Party)', reconciliationResult.summary?.unmatchedErpCount || 0]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // 2. Comparison Matrix Sheet (All Items)
    if (filteredMatrixItems && filteredMatrixItems.length > 0) {
      const matrixRows = filteredMatrixItems.map(item => ({
        'Match Status': item._bucket === 'matched' ? 'MATCHED' : item._bucket === 'probable' ? 'PROBABLE' : item._bucket === 'discrepant' ? 'AMOUNT DIFF' : item._bucket === 'unmatchedStmt' ? 'PARTY ONLY' : 'ELITE ONLY',
        'Date': item.date || item.erpDate || item.statementDate || '',
        'Voucher / Ref': item.voucherNo || item.erpVoucherNo || item.ref || '',
        'Narration': item.narration || item.erpNarration || item.statementNarration || '',
        'Elite Amount (₹)': item.erpAmount !== undefined ? item.erpAmount : item.debit ? item.debit : item.credit ? item.credit : '',
        'Party Amount (₹)': item.statementAmount !== undefined ? item.statementAmount : item.amount || '',
        'Difference (₹)': item.difference || 0,
        'Notes': item.reason || item.notes || ''
      }));
      const wsMatrix = XLSX.utils.json_to_sheet(matrixRows);
      XLSX.utils.book_append_sheet(wb, wsMatrix, 'Comparison Matrix');
    }

    // 3. Matched Sheet
    if (reconciliationResult.matchedItems?.length) {
      const wsMatched = XLSX.utils.json_to_sheet(reconciliationResult.matchedItems);
      XLSX.utils.book_append_sheet(wb, wsMatched, 'Matched Entries');
    }

    // 4. Discrepant Sheet
    if (reconciliationResult.discrepantItems?.length) {
      const wsDisc = XLSX.utils.json_to_sheet(reconciliationResult.discrepantItems);
      XLSX.utils.book_append_sheet(wb, wsDisc, 'Discrepancies');
    }

    // 5. Party Only Sheet
    if (reconciliationResult.unmatchedStatementItems?.length) {
      const wsPartyOnly = XLSX.utils.json_to_sheet(reconciliationResult.unmatchedStatementItems);
      XLSX.utils.book_append_sheet(wb, wsPartyOnly, 'In Party Only');
    }

    // 6. Elite Only Sheet
    if (reconciliationResult.unmatchedErpItems?.length) {
      const wsEliteOnly = XLSX.utils.json_to_sheet(reconciliationResult.unmatchedErpItems);
      XLSX.utils.book_append_sheet(wb, wsEliteOnly, 'In Elite Only');
    }

    const fileName = `Reconciliation_${stmt1Name.replace(/[^a-zA-Z0-9]/g, '_')}_vs_${stmt2Name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Filtered Matrix Items
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
        const text = `${item.voucherNo || ''} ${item.erpVoucherNo || ''} ${item.narration || ''} ${item.erpNarration || ''} ${item.amount || ''}`.toLowerCase();
        return text.includes(q);
      });
    }

    return list;
  }, [reconciliationResult, activeFilterTab, matrixSearch]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1rem', color: '#0f172a' }}>
      {/* ── TOP HEADER BANNER ──────────────────────────────────────────────── */}
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
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                Universal AI Ledger &amp; Statement Reconciler
              </h2>
              <span
                style={{
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  border: '1px solid rgba(56, 189, 248, 0.45)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 0 12px rgba(56, 189, 248, 0.25)'
                }}
              >
                <Sparkles size={12} /> Powered by Elite AI
              </span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', opacity: 0.9, color: '#e0e7ff' }}>
              Reconcile any two statements, ledgers, or bank books with automated 3-way fuzzy matching &amp; deep forensic audit
            </p>
          </div>
        </div>

        {/* Right Action Buttons */}
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
              gap: '0.45rem'
            }}
          >
            <Bot size={16} color="#38bdf8" />
            <span>AI Copilot</span>
          </button>

          {reconciliationResult && (
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
          )}
        </div>
      </div>

      {/* ── TWO INGESTION CARDS: ELITE FILES VS PARTY / OTHER FILE ─────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
        {/* ── CARD 1: ELITE FILES (BOOK A) ──────────────────────────────────── */}
        <div style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '14px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
          {/* Card 1 Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
              <span style={{ padding: '3px 9px', borderRadius: '6px', background: '#4f46e5', color: '#ffffff', fontSize: '0.72rem', fontWeight: 800 }}>
                Elite
              </span>
              <input
                type="text"
                value={stmt1Name}
                onChange={(e) => setStmt1Name(e.target.value)}
                style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a', border: 'none', borderBottom: '1px dashed #cbd5e1', outline: 'none', background: 'transparent', width: '85%' }}
              />
            </div>

            {/* Mode Switcher */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '2px', borderRadius: '6px' }}>
              <button
                onClick={() => setStmt1Mode('file')}
                style={{ padding: '0.3rem 0.6rem', border: 'none', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', background: stmt1Mode === 'file' ? '#4f46e5' : 'transparent', color: stmt1Mode === 'file' ? '#ffffff' : '#64748b' }}
              >
                File
              </button>
              <button
                onClick={() => setStmt1Mode('text')}
                style={{ padding: '0.3rem 0.6rem', border: 'none', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', background: stmt1Mode === 'text' ? '#4f46e5' : 'transparent', color: stmt1Mode === 'text' ? '#ffffff' : '#64748b' }}
              >
                Paste
              </button>
              <button
                onClick={() => setStmt1Mode('manual')}
                style={{ padding: '0.3rem 0.6rem', border: 'none', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', background: stmt1Mode === 'manual' ? '#4f46e5' : 'transparent', color: stmt1Mode === 'manual' ? '#ffffff' : '#64748b' }}
              >
                Grid ({stmt1Transactions.length})
              </button>
            </div>
          </div>

          {/* Card 1 Ingestion Area */}
          {stmt1Mode === 'file' && (
            <div
              onClick={() => fileInputRef1.current?.click()}
              style={{ border: '2px dashed #a5b4fc', borderRadius: '10px', padding: '1.25rem', textAlign: 'center', background: '#eef2ff', cursor: 'pointer' }}
            >
              <input type="file" ref={fileInputRef1} onChange={handleFile1Upload} accept="image/*,application/pdf,.xlsx,.xls,.csv" style={{ display: 'none' }} />
              <UploadCloud size={24} color="#4f46e5" style={{ margin: '0 auto 6px auto' }} />
              <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#3730a3' }}>
                {stmt1File ? stmt1File.name : 'Upload Elite File (PDF / Image / Scan / Excel)'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>Tally, Busy, bank statements, photos, or Excel sheets</div>
            </div>
          )}

          {stmt1Mode === 'text' && (
            <textarea
              placeholder="Paste raw ledger text or CSV for Elite Files here..."
              value={stmt1Text}
              onChange={(e) => setStmt1Text(e.target.value)}
              rows={4}
              style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.78rem', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
            />
          )}

          {/* Action to Parse Elite File */}
          {(stmt1Mode === 'file' || stmt1Mode === 'text') && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleParseStmt1}
                disabled={stmt1Parsing || (!stmt1Base64 && !stmt1Text.trim())}
                style={{
                  background: stmt1Parsing ? '#94a3b8' : '#4f46e5',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '7px',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  cursor: stmt1Parsing || (!stmt1Base64 && !stmt1Text.trim()) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Sparkles size={14} className={stmt1Parsing ? 'animate-spin' : ''} />
                <span>{stmt1Parsing ? 'Extracting...' : 'Parse Elite File with AI'}</span>
              </button>
            </div>
          )}

          {/* Card 1 Stats & Table */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '9px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Debit: {fmtINR(stmt1Stats.totalDebit)} | Credit: {fmtINR(stmt1Stats.totalCredit)}</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#1e293b' }}>Balance: {fmtINR(stmt1Stats.netBalance)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#4f46e5' }}>{stmt1Stats.count} entries</span>
              <button onClick={handleAddRowStmt1} style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '5px', padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Plus size={12} /> Add
              </button>
            </div>
          </div>
        </div>

        {/* ── CARD 2: PARTY / VENDOR OR OTHER FILE (BOOK B) ─────────────────── */}
        <div style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '14px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
          {/* Card 2 Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
              <span style={{ padding: '3px 9px', borderRadius: '6px', background: '#0ea5e9', color: '#ffffff', fontSize: '0.72rem', fontWeight: 800 }}>
                Party / Other
              </span>
              <input
                type="text"
                value={stmt2Name}
                onChange={(e) => setStmt2Name(e.target.value)}
                style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a', border: 'none', borderBottom: '1px dashed #cbd5e1', outline: 'none', background: 'transparent', width: '85%' }}
              />
            </div>

            {/* Mode Switcher */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '2px', borderRadius: '6px' }}>
              <button
                onClick={() => setStmt2Mode('file')}
                style={{ padding: '0.3rem 0.6rem', border: 'none', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', background: stmt2Mode === 'file' ? '#0ea5e9' : 'transparent', color: stmt2Mode === 'file' ? '#ffffff' : '#64748b' }}
              >
                File
              </button>
              <button
                onClick={() => setStmt2Mode('text')}
                style={{ padding: '0.3rem 0.6rem', border: 'none', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', background: stmt2Mode === 'text' ? '#0ea5e9' : 'transparent', color: stmt2Mode === 'text' ? '#ffffff' : '#64748b' }}
              >
                Paste
              </button>
              <button
                onClick={() => setStmt2Mode('manual')}
                style={{ padding: '0.3rem 0.6rem', border: 'none', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', background: stmt2Mode === 'manual' ? '#0ea5e9' : 'transparent', color: stmt2Mode === 'manual' ? '#ffffff' : '#64748b' }}
              >
                Grid ({stmt2Transactions.length})
              </button>
            </div>
          </div>

          {/* Card 2 Ingestion Area */}
          {stmt2Mode === 'file' && (
            <div
              onClick={() => fileInputRef2.current?.click()}
              style={{ border: '2px dashed #7dd3fc', borderRadius: '10px', padding: '1.25rem', textAlign: 'center', background: '#f0f9ff', cursor: 'pointer' }}
            >
              <input type="file" ref={fileInputRef2} onChange={handleFile2Upload} accept="image/*,application/pdf,.xlsx,.xls,.csv" style={{ display: 'none' }} />
              <UploadCloud size={24} color="#0284c7" style={{ margin: '0 auto 6px auto' }} />
              <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#0369a1' }}>
                {stmt2File ? stmt2File.name : 'Upload Party / Vendor OR Other file (PDF / Image / Scan / Excel)'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>Party bills, passbooks, vendor invoices, or Excel sheets</div>
            </div>
          )}

          {stmt2Mode === 'text' && (
            <textarea
              placeholder="Paste raw ledger text or CSV for Party / Vendor OR Other file here..."
              value={stmt2Text}
              onChange={(e) => setStmt2Text(e.target.value)}
              rows={4}
              style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.78rem', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
            />
          )}

          {/* Action to Parse Party / Other File */}
          {(stmt2Mode === 'file' || stmt2Mode === 'text') && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleParseStmt2}
                disabled={stmt2Parsing || (!stmt2Base64 && !stmt2Text.trim())}
                style={{
                  background: stmt2Parsing ? '#94a3b8' : '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '7px',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  cursor: stmt2Parsing || (!stmt2Base64 && !stmt2Text.trim()) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Sparkles size={14} className={stmt2Parsing ? 'animate-spin' : ''} />
                <span>{stmt2Parsing ? 'Extracting...' : 'Parse Party / Other File with AI'}</span>
              </button>
            </div>
          )}

          {/* Card 2 Stats & Table */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '9px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Debit: {fmtINR(stmt2Stats.totalDebit)} | Credit: {fmtINR(stmt2Stats.totalCredit)}</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#0369a1' }}>Balance: {fmtINR(stmt2Stats.netBalance)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0284c7' }}>{stmt2Stats.count} entries</span>
              <button onClick={handleAddRowStmt2} style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '5px', padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Plus size={12} /> Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── AI RECONCILIATION PROMPT & RUN ENGINE ───────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: '1.5px solid #c7d2fe',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 4px 20px rgba(99, 102, 241, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-flex', padding: '6px', borderRadius: '8px', background: '#e0e7ff', color: '#4338ca' }}>
              <Sparkles size={16} />
            </span>
            <div>
              <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#1e1b4b' }}>
                AI Reconciliation Prompt & Directives
              </span>
              <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>
                Instruct Elite AI on matching rules, date/amount tolerances, voucher mappings, and missing bill detection.
              </span>
            </div>
          </div>

          {/* Quick preset directives */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            {[
              { label: '⚡ Auto Reconcile', text: 'muje ye dono ledger reconcilation karke do', bg: '#f5f3ff', border: '#ddd6fe', color: '#6d28d9' },
              { label: '🎯 Exact Match', text: 'Match strictly by voucher number and exact amounts.', bg: '#f0fdf4', border: '#bbf7d0', color: '#166534' },
              { label: '📅 Date Flexible (±15 Days)', text: 'Match by voucher with ±15 days date tolerance window.', bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
              { label: '🔍 Find Missing Bills', text: 'Identify and list all bills present in Elite Files but missing from Party statement.', bg: '#faf5ff', border: '#e9d5ff', color: '#7e22ce' },
              { label: '💰 TDS / Rate Diff (±₹100)', text: 'Allow up to ₹100 variance for TDS, roundoff, and rate discrepancies.', bg: '#fffbeb', border: '#fde68a', color: '#b45309' }
            ].map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setReconciliationPrompt(chip.text)}
                style={{
                  background: chip.bg,
                  border: `1px solid ${chip.border}`,
                  borderRadius: '20px',
                  padding: '4px 11px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: chip.color,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt Input Box & Run Button Row */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
            <textarea
              value={reconciliationPrompt}
              onChange={(e) => setReconciliationPrompt(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleRunReconciliation();
                }
              }}
              rows={3}
              placeholder="Write custom prompt (e.g. 'muje ye dono ledger reconcilation karke do')"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.75rem 0.9rem',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.82rem',
                fontFamily: 'inherit',
                lineHeight: 1.45,
                outline: 'none',
                resize: 'vertical',
                background: '#ffffff'
              }}
            />
            <div style={{ position: 'absolute', right: '10px', bottom: '8px', fontSize: '0.65rem', color: '#94a3b8', pointerEvents: 'none' }}>
              Press Ctrl+Enter to Run
            </div>
          </div>

          {/* Prominent Run Button */}
          <button
            onClick={handleRunReconciliation}
            disabled={reconciling || (!stmt1File && !stmt1Base64 && !stmt1Text.trim() && !stmt1Transactions.length && !stmt2File && !stmt2Base64 && !stmt2Text.trim() && !stmt2Transactions.length)}
            style={{
              padding: '0.85rem 2rem',
              borderRadius: '12px',
              border: 'none',
              background: reconciling || (!stmt1File && !stmt1Base64 && !stmt1Text.trim() && !stmt1Transactions.length && !stmt2File && !stmt2Base64 && !stmt2Text.trim() && !stmt2Transactions.length)
                ? '#94a3b8'
                : 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.96rem',
              cursor: reconciling || (!stmt1File && !stmt1Base64 && !stmt1Text.trim() && !stmt1Transactions.length && !stmt2File && !stmt2Base64 && !stmt2Text.trim() && !stmt2Transactions.length) ? 'not-allowed' : 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              minWidth: '180px',
              boxShadow: '0 8px 20px rgba(79, 70, 229, 0.35)',
              transition: 'transform 0.15s, box-shadow 0.15s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Play size={18} fill={reconciling ? 'none' : '#ffffff'} className={reconciling ? 'animate-spin' : ''} />
              <span>{reconciling ? 'Reconciling...' : 'Run'}</span>
            </div>
            <span style={{ fontSize: '0.68rem', opacity: 0.85, fontWeight: 500 }}>
              AI Reconcile Files
            </span>
          </button>
        </div>
      </div>

      {/* ── RECONCILIATION RESULTS DASHBOARD ────────────────────────────────── */}
      {reconciliationResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* AI Direct Prompt Verdict Banner */}
          {reconciliationResult.aiDirectVerdict && (
            <div
              style={{
                background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                border: '1.5px solid #a7f3d0',
                borderRadius: '12px',
                padding: '0.95rem 1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)'
              }}
            >
              <Sparkles size={20} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#047857', letterSpacing: '0.04em' }}>
                  ELITE AI PROMPT ANALYSIS &amp; VERDICT
                </div>
                <div style={{ fontSize: '0.85rem', color: '#064e3b', marginTop: '3px', lineHeight: 1.45, fontWeight: 600 }}>
                  {reconciliationResult.aiDirectVerdict}
                </div>
              </div>
            </div>
          )}
          {/* KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
            {/* Book 1 Balance */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>{stmt1Name.toUpperCase()}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1e293b', marginTop: '4px' }}>
                {fmtINR(stmt1Stats.netBalance)}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>{stmt1Stats.count} entries recorded</div>
            </div>

            {/* Book 2 Balance */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>{stmt2Name.toUpperCase()}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0369a1', marginTop: '4px' }}>
                {fmtINR(stmt2Stats.netBalance)}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>{stmt2Stats.count} entries recorded</div>
            </div>

            {/* Variance */}
            <div
              style={{
                background: Math.abs(reconciliationResult.summary?.variance || (stmt1Stats.netBalance - stmt2Stats.netBalance)) < 1 ? '#f0fdf4' : '#fff1f2',
                border: `1.5px solid ${Math.abs(reconciliationResult.summary?.variance || (stmt1Stats.netBalance - stmt2Stats.netBalance)) < 1 ? '#86efac' : '#fecdd3'}`,
                borderRadius: '12px',
                padding: '1rem'
              }}
            >
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: Math.abs(reconciliationResult.summary?.variance || (stmt1Stats.netBalance - stmt2Stats.netBalance)) < 1 ? '#166534' : '#9f1239' }}>
                NET VARIANCE / DIFFERENCE
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: Math.abs(reconciliationResult.summary?.variance || (stmt1Stats.netBalance - stmt2Stats.netBalance)) < 1 ? '#15803d' : '#e11d48', marginTop: '4px' }}>
                {fmtINR(reconciliationResult.summary?.variance || (stmt1Stats.netBalance - stmt2Stats.netBalance))}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                {Math.abs(reconciliationResult.summary?.variance || (stmt1Stats.netBalance - stmt2Stats.netBalance)) < 1 ? 'Balanced (Zero Variance)' : 'Discrepancy Detected'}
              </div>
            </div>

            {/* AI Forensic Card */}
            <div style={{ background: 'linear-gradient(135deg, #312e81, #1e1b4b)', borderRadius: '12px', padding: '1rem', color: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#a5b4fc', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={13} color="#38bdf8" /> DEEP FORENSIC AUDIT
                </div>
                <div style={{ fontSize: '0.86rem', fontWeight: 800, marginTop: '4px', color: '#ffffff' }}>
                  {auditReport ? 'Audit Report Ready' : 'Investigate Discrepancy Drivers'}
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
                  <button onClick={() => setShowAuditModal(true)} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#ffffff', padding: '0.4rem 0.65rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.74rem', cursor: 'pointer' }}>
                    View
                  </button>
                )}
                <button onClick={() => handleDraftNotice()} disabled={draftingNotice} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#ffffff', padding: '0.4rem 0.65rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.74rem', cursor: draftingNotice ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Share2 size={13} /> Notice
                </button>
              </div>
            </div>
          </div>

          {/* Comparison Matrix Table */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                {[
                  { id: 'all', label: 'All Entries', count: filteredMatrixItems.length },
                  { id: 'matched', label: 'Matched', count: reconciliationResult.summary?.matchedCount || 0, color: '#16a34a' },
                  { id: 'probable', label: 'Probable', count: reconciliationResult.summary?.probableCount || 0, color: '#ca8a04' },
                  { id: 'discrepant', label: 'Discrepancies', count: reconciliationResult.summary?.discrepantCount || 0, color: '#dc2626' },
                  { id: 'unmatchedStmt', label: 'In Party Only', count: reconciliationResult.summary?.unmatchedStatementCount || 0, color: '#ea580c' },
                  { id: 'unmatchedErp', label: 'In Elite Only', count: reconciliationResult.summary?.unmatchedErpCount || 0, color: '#7c3aed' }
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
                        gap: '6px'
                      }}
                    >
                      <span>{tab.label}</span>
                      <span style={{ background: isActive ? 'rgba(255,255,255,0.25)' : '#f1f5f9', color: isActive ? '#ffffff' : tab.color, padding: '1px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search & Excel Export */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f8fafc', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', minWidth: '200px' }}>
                  <Search size={14} color="#94a3b8" />
                  <input
                    type="text"
                    placeholder="Search vouchers, narration..."
                    value={matrixSearch}
                    onChange={(e) => setMatrixSearch(e.target.value)}
                    style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.78rem', width: '100%' }}
                  />
                </div>

                <button
                  onClick={handleExportExcel}
                  title="Download complete reconciliation report in Excel (.xlsx)"
                  style={{
                    background: '#10b981',
                    border: 'none',
                    color: '#ffffff',
                    padding: '0.45rem 0.95rem',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <FileSpreadsheet size={15} />
                  <span>Download in Excel (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* Matrix Table */}
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: 700, fontSize: '0.73rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    <th style={{ padding: '0.75rem 0.85rem', width: '125px' }}>Match Status</th>
                    <th style={{ padding: '0.75rem 0.85rem', width: '110px' }}>Date</th>
                    <th style={{ padding: '0.75rem 0.85rem', width: '150px' }}>Voucher / Ref</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Narration</th>
                    <th style={{ padding: '0.75rem 0.85rem', width: '140px', textAlign: 'right' }}>Elite Files Amount</th>
                    <th style={{ padding: '0.75rem 0.85rem', width: '140px', textAlign: 'right' }}>Party / Other Amount</th>
                    <th style={{ padding: '0.75rem 0.85rem', width: '120px', textAlign: 'right' }}>Difference</th>
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
                      const isBook2Only = item._bucket === 'unmatchedStmt';
                      const isBook1Only = item._bucket === 'unmatchedErp';

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
                      } else if (isBook2Only) {
                        badgeText = 'PARTY ONLY';
                        badgeBg = '#ffedd5';
                        badgeColor = '#c2410c';
                        badgeIcon = <ArrowDownLeft size={13} />;
                      } else if (isBook1Only) {
                        badgeText = 'ELITE ONLY';
                        badgeBg = '#ede9fe';
                        badgeColor = '#6d28d9';
                        badgeIcon = <ArrowUpRight size={13} />;
                      }

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <span style={{ background: badgeBg, color: badgeColor, padding: '3px 8px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              {badgeIcon} {badgeText}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>
                            {item.date || item.erpDate || item.statementDate || '—'}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: 800, color: '#0f172a' }}>
                            {item.voucherNo || item.erpVoucherNo || item.ref || '—'}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <div style={{ color: '#1e293b', fontWeight: 600 }}>{item.narration || item.erpNarration || item.statementNarration || '—'}</div>
                            {item.reason && <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '2px' }}>{item.reason}</div>}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>
                            {item.erpAmount !== undefined ? fmtINR(item.erpAmount) : item.debit ? fmtINR(item.debit) : item.credit ? fmtINR(item.credit) : '—'}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: '#0369a1' }}>
                            {item.statementAmount !== undefined ? fmtINR(item.statementAmount) : item.amount ? fmtINR(item.amount) : '—'}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 800 }}>
                            {item.difference ? <span style={{ color: '#dc2626' }}>{fmtINR(item.difference)}</span> : <span style={{ color: '#16a34a' }}>₹ 0.00</span>}
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

      {/* ── MODAL: GROK FORENSIC AUDIT ──────────────────────────────────────── */}
      {showAuditModal && auditReport && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '16px', width: '100%', maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Sparkles size={22} color="#4f46e5" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                  Elite AI Forensic Audit Report
                </h3>
              </div>
              <button onClick={() => setShowAuditModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '0.4rem 0.6rem', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
            </div>

            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#1e40af', marginBottom: '4px' }}>EXECUTIVE AUDIT SUMMARY</div>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#1e293b', lineHeight: 1.5 }}>{auditReport.auditSummary}</p>
            </div>

            {auditReport.quotaWarning && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.65rem 0.9rem', fontSize: '0.76rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={15} color="#d97706" style={{ flexShrink: 0 }} />
                <span>{auditReport.quotaWarning}</span>
              </div>
            )}

            {auditReport.rootCauses?.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>Identified Root Causes</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {auditReport.rootCauses.map((rc, idx) => (
                    <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.8rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0f172a' }}>{rc.title}</span>
                        {rc.impactAmount ? <span style={{ fontWeight: 800, fontSize: '0.8rem', color: '#dc2626' }}>{fmtINR(rc.impactAmount)}</span> : null}
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#475569' }}>{rc.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
              <button onClick={() => { setShowAuditModal(false); handleDraftNotice(); }} style={{ background: '#4f46e5', border: 'none', color: '#ffffff', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Share2 size={14} /> Draft WhatsApp Notice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: SETTLEMENT NOTICE & WHATSAPP ──────────────────────────────── */}
      {showNoticeModal && settlementNotice && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '16px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <MessageSquare size={22} color="#22c55e" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>Settlement Notice &amp; WhatsApp Dispatch</h3>
              </div>
              <button onClick={() => setShowNoticeModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '0.4rem 0.6rem', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Phone & Tone Input */}
            <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Target Phone # (e.g. 9876543210)"
                value={partyPhone}
                onChange={(e) => setPartyPhone(e.target.value)}
                style={{ padding: '0.45rem 0.75rem', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '0.8rem', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {['POLITE_PROFESSIONAL', 'FRIENDLY_REMINDER', 'FORMAL_AUDIT_NOTICE'].map((t) => (
                  <button key={t} onClick={() => { setNoticeTone(t); handleDraftNotice(t); }} style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: noticeTone === t ? '#22c55e' : '#f8fafc', color: noticeTone === t ? '#ffffff' : '#475569', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                    {t.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '10px', padding: '1rem' }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.8rem', fontFamily: 'inherit', color: '#14532d', lineHeight: 1.5, background: '#ffffff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #bbf7d0', maxHeight: '220px', overflowY: 'auto' }}>
                {settlementNotice.whatsappMessage}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button onClick={() => handleCopyNotice(settlementNotice.whatsappMessage)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', padding: '0.55rem 0.95rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                {copyFeedback ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={() => handleOpenWhatsApp(settlementNotice.whatsappMessage)} style={{ background: '#22c55e', border: 'none', color: '#ffffff', padding: '0.55rem 1.15rem', borderRadius: '8px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Send size={14} /> Send via WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── COPILOT CHAT DRAWER ──────────────────────────────────────────────── */}
      {copilotOpen && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', maxWidth: '100vw', background: '#ffffff', borderLeft: '1.5px solid #cbd5e1', boxShadow: '-15px 0 35px -5px rgba(0,0,0,0.18)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #3730a3', background: 'linear-gradient(135deg, #1e1b4b, #312e81)', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                <Bot size={20} color="#38bdf8" />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>Elite AI Financial Copilot</h4>
                <span style={{ fontSize: '0.72rem', color: '#a5b4fc', fontWeight: 500, display: 'block' }}>Universal Statement Reconciler</span>
              </div>
            </div>
            <button onClick={() => setCopilotOpen(false)} style={{ background: 'rgba(255, 255, 255, 0.12)', border: 'none', color: '#ffffff', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.9rem', transition: 'background 0.15s' }}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', background: '#f8fafc' }}>
            {copilotMessages.map((msg, i) => (
              <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', background: msg.role === 'user' ? '#4f46e5' : '#ffffff', color: msg.role === 'user' ? '#ffffff' : '#0f172a', padding: '0.75rem 0.95rem', borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: msg.role === 'user' ? 'none' : '1px solid #e2e8f0', fontSize: '0.82rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {msg.content}
              </div>
            ))}
            {copilotLoading && (
              <div style={{ alignSelf: 'flex-start', background: '#ffffff', border: '1px solid #e2e8f0', padding: '0.65rem 0.95rem', borderRadius: '12px', fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={14} className="animate-spin" color="#4f46e5" /> Elite AI is reasoning...
              </div>
            )}
            <div ref={copilotChatEndRef} />
          </div>

          <form onSubmit={handleSendCopilotMessage} style={{ padding: '0.85rem', borderTop: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Ask anything about these two statements..."
              value={copilotInput}
              onChange={(e) => setCopilotInput(e.target.value)}
              style={{ flex: 1, padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', outline: 'none' }}
            />
            <button type="submit" disabled={copilotLoading || !copilotInput.trim()} style={{ background: copilotLoading || !copilotInput.trim() ? '#94a3b8' : '#4f46e5', border: 'none', color: '#ffffff', padding: '0.65rem 0.95rem', borderRadius: '8px', cursor: copilotLoading || !copilotInput.trim() ? 'not-allowed' : 'pointer' }}>
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
