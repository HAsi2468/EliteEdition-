import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { Search, RefreshCw, Save, Check, Clipboard, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Download } from 'lucide-react';
import JobCardTooltip from './JobCardTooltip';
import DateRangePicker, { getDatePresetRange } from './DateRangePicker';
import InfiniteScrollPagination from './InfiniteScrollPagination';

const formatDateDDMMYYYY = (d) => {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const year = dt.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return String(d);
  }
};

export default function JobCardTracking({ onPreview }) {
  const currentUser = api.getCurrentUser();
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin' || currentUser?.username?.toLowerCase() === 'admin' || currentUser?.isAdmin === true;

  const defaultThisMonth = getDatePresetRange('this_month');
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  
  // Date range & Status filters
  const [datePreset, setDatePreset] = useState('this_month');
  const [dateStart, setDateStart] = useState(defaultThisMonth.dateStart);
  const [dateEnd, setDateEnd] = useState(defaultThisMonth.dateEnd);
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');

  const [printStatusFilter, setPrintStatusFilter] = useState('All');
  const [fusingStatusFilter, setFusingStatusFilter] = useState('All');
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState('All');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Sorting
  const [sortBy, setSortBy] = useState('jobNo');
  const [sortOrder, setSortOrder] = useState('desc');

  // Row edit state: { [cardId]: { billNo, printStatus, printDate, printMtr, fusingStatus, fusingDate, fusingMtr, deliveryStatus, deliveryDate } }
  const [modifiedCards, setModifiedCards] = useState({});
  const [savingIds, setSavingIds] = useState(new Set());

  // Collapsible print run history state
  const [expandedCardIds, setExpandedCardIds] = useState(new Set());
  const [printLogsMap, setPrintLogsMap] = useState({});
  const [loadingLogsMap, setLoadingLogsMap] = useState({});

  const toggleExpandCard = useCallback(async (card) => {
    const cardId = card._id;
    setExpandedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });

    if (!printLogsMap[cardId]) {
      setLoadingLogsMap(prev => ({ ...prev, [cardId]: true }));
      try {
        const res = await api.getJobCardPrintLogs(card._id || card.jobNo);
        if (res && res.data) {
          setPrintLogsMap(prev => ({ ...prev, [cardId]: res.data }));
        } else {
          setPrintLogsMap(prev => ({ ...prev, [cardId]: [] }));
        }
      } catch (err) {
        console.error('Failed to load print logs for job card:', card.jobNo, err);
        setPrintLogsMap(prev => ({ ...prev, [cardId]: [] }));
      } finally {
        setLoadingLogsMap(prev => ({ ...prev, [cardId]: false }));
      }
    }
  }, [printLogsMap]);

  const pageRef = useRef(page);
  pageRef.current = page;
  const loadingMoreRef = useRef(false);

  const fetchCards = useCallback(async (isSilent = false, targetPage = 1) => {
    if (isSilent && loadingMoreRef.current) return;
    if (!isSilent && cards.length === 0) setLoading(true);
    setError('');
    try {
      const effectivePage = isSilent ? 1 : targetPage;
      const res = await api.getJobCards({
        search,
        dateStart,
        dateEnd,
        printStatus: printStatusFilter,
        fusingStatus: fusingStatusFilter,
        deliveryStatus: deliveryStatusFilter,
        page: effectivePage,
        limit: 50,
        sortBy,
        sortOrder,
        skipStats: isSilent ? 'true' : undefined
      });
      if (res && res.data) {
        if (isSilent) {
          // Merge incoming fresh data into existing cards state without shrinking or resetting scroll
          setCards(prev => {
            const freshMap = new Map();
            res.data.forEach(c => freshMap.set(c._id || c.id, c));
            return prev.map(c => freshMap.get(c._id || c.id) || c);
          });
          if (res.total !== undefined) setTotal(res.total);
          if (res.pages !== undefined) setPages(res.pages);
        } else {
          setCards(res.data);
          setPages(res.pages || 1);
          setTotal(res.total || 0);
          setPage(targetPage);
          pageRef.current = targetPage;
        }
      }
    } catch (err) {
      if (!isSilent) setError(err.message || 'Failed to load tracking data.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [search, dateStart, dateEnd, printStatusFilter, fusingStatusFilter, deliveryStatusFilter, sortBy, sortOrder]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || pageRef.current >= pages) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const nextPage = pageRef.current + 1;
      const res = await api.getJobCards({
        search,
        dateStart,
        dateEnd,
        printStatus: printStatusFilter,
        fusingStatus: fusingStatusFilter,
        deliveryStatus: deliveryStatusFilter,
        page: nextPage,
        limit: 50,
        sortBy,
        sortOrder,
        skipStats: 'true'
      });
      if (res && res.data && res.data.length > 0) {
        setCards(prev => {
          const map = new Map();
          prev.forEach(c => map.set(c._id || c.id, c));
          res.data.forEach(c => map.set(c._id || c.id, c));
          return Array.from(map.values());
        });
        setPage(nextPage);
        pageRef.current = nextPage;
        if (res.pages) setPages(res.pages);
        if (res.total !== undefined) setTotal(res.total);
      }
    } catch (e) {
      console.warn('Failed to load more tracking cards:', e);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [pages, search, dateStart, dateEnd, printStatusFilter, fusingStatusFilter, deliveryStatusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchCards(false, 1);
    const interval = setInterval(() => fetchCards(true, 1), 30000);
    const handleDataRefresh = () => fetchCards(true, 1);
    window.addEventListener('elite-data-refresh', handleDataRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('elite-data-refresh', handleDataRefresh);
    };
  }, [fetchCards]);

  // Handle local cell modifications
  const handleCellChange = (cardId, field, value) => {
    // Find the original card to base modifications on if not already modified
    const originalCard = cards.find(c => c._id === cardId);
    if (!originalCard) return;

    setModifiedCards(prev => {
      const currentMod = prev[cardId] || {
        billNo: originalCard.billNo || '',
        printStatus: originalCard.printStatus || 'Printing Pending',
        printDate: originalCard.printDate || '',
        printMtr: originalCard.printMtr || 0,
        fusingStatus: originalCard.fusingStatus || 'Fusing Pending',
        fusingDate: originalCard.fusingDate || '',
        fusingMtr: originalCard.fusingMtr || 0,
        deliveryStatus: originalCard.deliveryStatus || 'Delivery Pending',
        deliveryDate: originalCard.deliveryDate || '',
      };

      const updated = { ...currentMod, [field]: value };

      // Auto-date fill transitions
      const todayStr = new Date().toISOString().split('T')[0];

      if (field === 'printStatus' && value === 'Printing Done' && !updated.printDate) {
        updated.printDate = todayStr;
      }
      if (field === 'fusingStatus' && value === 'Fusing Done' && !updated.fusingDate) {
        updated.fusingDate = todayStr;
      }
      if (field === 'deliveryStatus' && value === 'Delivery Done' && !updated.deliveryDate) {
        updated.deliveryDate = todayStr;
      }

      return { ...prev, [cardId]: updated };
    });
  };

  // Auto save row to backend
  const handleAutoSave = async (cardId, field, value) => {
    // Find the original card to base modifications on if not already modified
    const originalCard = cards.find(c => c._id === cardId);
    if (!originalCard) return;

    const currentMod = modifiedCards[cardId] || {
      billNo: originalCard.billNo || '',
      printStatus: originalCard.printStatus || 'Printing Pending',
      printDate: originalCard.printDate || '',
      printMtr: originalCard.printMtr || 0,
      fusingStatus: originalCard.fusingStatus || 'Fusing Pending',
      fusingDate: originalCard.fusingDate || '',
      fusingMtr: originalCard.fusingMtr || 0,
      deliveryStatus: originalCard.deliveryStatus || 'Delivery Pending',
      deliveryDate: originalCard.deliveryDate || '',
    };

    const updated = { ...currentMod, [field]: value };

    // Auto-date fill transitions
    const todayStr = new Date().toISOString().split('T')[0];
    if (field === 'printStatus' && value === 'Printing Done' && !updated.printDate) {
      updated.printDate = todayStr;
    }
    if (field === 'fusingStatus' && value === 'Fusing Done' && !updated.fusingDate) {
      updated.fusingDate = todayStr;
    }
    if (field === 'deliveryStatus' && value === 'Delivery Done' && !updated.deliveryDate) {
      updated.deliveryDate = todayStr;
    }

    setSavingIds(prev => {
      const next = new Set(prev);
      next.add(cardId);
      return next;
    });

    try {
      const res = await api.updateJobCard(cardId, updated);
      
      // Update local cards list
      setCards(prev => prev.map(c => c._id === cardId ? { ...c, ...res, ...updated } : c));
      
      // Remove from modified list
      setModifiedCards(prev => {
        const next = { ...prev };
        delete next[cardId];
        return next;
      });
    } catch (err) {
      alert(err.message || 'Failed to save tracking changes.');
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    }
  };

  // Get value for a cell, merging backend value with any local modifications
  const getValue = (card, field) => {
    let val = card[field] ?? '';
    if (modifiedCards[card._id] && modifiedCards[card._id][field] !== undefined) {
      val = modifiedCards[card._id][field];
    }
    if ((field === 'printDate' || field === 'fusingDate' || field === 'deliveryDate') && val) {
      if (typeof val === 'string' && val.includes('T')) {
        return val.split('T')[0];
      }
    }
    return val;
  };

  const handleDownloadInvoicePdf = async (invoiceId, invoiceNo) => {
    if (!invoiceId) {
      alert(`Invoice #${invoiceNo} ID not found.`);
      return;
    }
    try {
      await api.downloadInvoicePdf(invoiceId, invoiceNo);
    } catch (err) {
      alert(`Failed to download invoice PDF: ${err.message}`);
    }
  };

  // 🖨️ PDF REPORT GENERATOR (Respects all date, print, fusing, delivery, and search filters)
  const handleDownloadTrackingPdfReport = () => {
    if (!cards || cards.length === 0) {
      alert('No job card tracking records found for the active filter criteria.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups for this site to view/download the PDF Tracking Report.');
      return;
    }

    let totalJobMtrSum = 0;
    let totalPrintMtrSum = 0;
    let totalPendingPrintMtrSum = 0;
    let totalFusingMtrSum = 0;

    cards.forEach(c => {
      const jm = parseFloat(String(c.totalMtr || c.consumption || '0').replace(/[^\d.]/g, '')) || 0;
      const pm = parseFloat(String(getValue(c, 'printMtr') || '0').replace(/[^\d.]/g, '')) || 0;
      const fm = parseFloat(String(getValue(c, 'fusingMtr') || '0').replace(/[^\d.]/g, '')) || 0;
      const ppm = getValue(c, 'printStatus') === 'Printing Done' ? 0 : Math.max(0, jm - pm);

      totalJobMtrSum += jm;
      totalPrintMtrSum += pm;
      totalPendingPrintMtrSum += ppm;
      totalFusingMtrSum += fm;
    });

    const activeRangeText = dateStart && dateEnd ? `${formatDateDDMMYYYY(dateStart)} to ${formatDateDDMMYYYY(dateEnd)}` : (dateStart ? `From ${formatDateDDMMYYYY(dateStart)}` : 'All Dates');
    const nowStr = `${formatDateDDMMYYYY(new Date())} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>JobCard_Tracking_Report_${new Date().toISOString().split('T')[0]}</title>
        <style>
          @page { size: A4 landscape; margin: 8mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #fff; margin: 0; padding: 12px; font-size: 10.5px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #4f46e5; padding-bottom: 10px; margin-bottom: 10px; }
          .title { font-size: 17px; font-weight: 900; color: #312e81; text-transform: uppercase; letter-spacing: 0.5px; }
          .subtitle { font-size: 10px; color: #64748b; margin-top: 2px; font-weight: 600; }
          .meta { text-align: right; font-size: 9px; color: #475569; line-height: 1.4; }
          
          .filter-strip { display: flex; gap: 12px; justify-content: space-between; align-items: center; background: #f8fafc; border: 1.5px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; font-size: 9.5px; flex-wrap: wrap; }
          .filter-item span { color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 8.5px; }
          .filter-item strong { color: #0f172a; font-weight: 800; }

          .kpi-row { display: flex; gap: 8px; margin-bottom: 12px; }
          .kpi-card { flex: 1; padding: 8px 10px; border-radius: 6px; background: #f8fafc; border: 1px solid #cbd5e1; }
          .kpi-label { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; }
          .kpi-val { font-size: 15px; font-weight: 900; color: #0f172a; margin-top: 2px; }

          table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 9.5px; }
          th { background: #0f172a; color: #fff; font-size: 8px; text-transform: uppercase; padding: 6px 6px; text-align: left; font-weight: 800; letter-spacing: 0.03em; }
          td { padding: 5px 6px; border-bottom: 1px solid #e2e8f0; color: #334155; vertical-align: middle; }
          tr:nth-child(even) td { background: #f8fafc; }
          .bold { font-weight: 800; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          
          .status-badge { display: inline-block; padding: 2px 5px; border-radius: 4px; font-size: 8px; font-weight: 800; text-align: center; }
          .done-badge { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
          .pending-badge { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }

          .total-row td { background: #e2e8f0 !important; font-weight: 900 !important; color: #0f172a !important; font-size: 10px; border-top: 2px solid #94a3b8; }
          .footer { margin-top: 15px; border-top: 1px solid #cbd5e1; padding-top: 6px; font-size: 8.5px; color: #94a3b8; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">ELITE EDITION — JOBCARD TRACKING AUDIT REPORT</div>
            <div class="subtitle">Complete Status, Dates, and Production Meters Summary</div>
          </div>
          <div class="meta">
            <div><strong>Generated On:</strong> ${nowStr}</div>
            <div><strong>Generated By:</strong> ${currentUser?.name || currentUser?.username || 'Admin'}</div>
          </div>
        </div>

        <!-- ACTIVE FILTER SUMMARY STRIP -->
        <div class="filter-strip">
          <div class="filter-item"><span>REPORTING PERIOD:</span> <strong>${activeRangeText}</strong></div>
          <div class="filter-item"><span>PRINT FILTER:</span> <strong>${printStatusFilter === 'Printing Done' ? 'PD (Done)' : printStatusFilter === 'Printing Pending' ? 'PP (Pending)' : 'All'}</strong></div>
          <div class="filter-item"><span>FUSING FILTER:</span> <strong>${fusingStatusFilter === 'Fusing Done' ? 'FD (Done)' : fusingStatusFilter === 'Fusing Pending' ? 'FP (Pending)' : 'All'}</strong></div>
          <div class="filter-item"><span>DELIVERY FILTER:</span> <strong>${deliveryStatusFilter === 'Delivery Done' ? 'DD (Done)' : deliveryStatusFilter === 'Delivery Pending' ? 'DP (Pending)' : 'All'}</strong></div>
          <div class="filter-item"><span>SEARCH:</span> <strong>${search || 'All Records'}</strong></div>
        </div>

        <!-- KPI SUMMARY CARDS -->
        <div class="kpi-row">
          <div class="kpi-card" style="border-left: 4px solid #7c3aed;">
            <div class="kpi-label">Total Job Cards</div>
            <div class="kpi-val" style="color: #6d28d9;">${cards.length}</div>
          </div>
          <div class="kpi-card" style="border-left: 4px solid #0284c7;">
            <div class="kpi-label">Total Target Job Meters</div>
            <div class="kpi-val" style="color: #0369a1;">${totalJobMtrSum.toFixed(2)} mtr</div>
          </div>
          <div class="kpi-card" style="border-left: 4px solid #059669;">
            <div class="kpi-label">Total Printed Meters</div>
            <div class="kpi-val" style="color: #047857;">${totalPrintMtrSum.toFixed(2)} mtr</div>
          </div>
          <div class="kpi-card" style="border-left: 4px solid #d97706;">
            <div class="kpi-label">Total Pending Print Meters</div>
            <div class="kpi-val" style="color: #b45309;">${totalPendingPrintMtrSum.toFixed(2)} mtr</div>
          </div>
        </div>

        <!-- DATA TABLE -->
        <table>
          <thead>
            <tr>
              <th style="width: 25px; text-align: center;">#</th>
              <th style="width: 70px;">JOB NO</th>
              <th>PARTY / CLIENT NAME</th>
              <th style="width: 75px;">BILL NO</th>
              <th style="width: 60px; text-align: center;">JOB MTR</th>
              <th style="width: 40px; text-align: center;">PRINT</th>
              <th style="width: 70px; text-align: center;">PRINT DATE</th>
              <th style="width: 60px; text-align: center;">PRINT MTR</th>
              <th style="width: 65px; text-align: center;">PENDING MTR</th>
              <th style="width: 40px; text-align: center;">FUSING</th>
              <th style="width: 70px; text-align: center;">FUSING DATE</th>
              <th style="width: 60px; text-align: center;">FUSING MTR</th>
              <th style="width: 40px; text-align: center;">DELIVERY</th>
              <th style="width: 70px; text-align: center;">DELIVERY DATE</th>
            </tr>
          </thead>
          <tbody>
            ${cards.map((c, i) => {
              const pStatus = getValue(c, 'printStatus') || 'Printing Pending';
              const fStatus = getValue(c, 'fusingStatus') || 'Fusing Pending';
              const dStatus = getValue(c, 'deliveryStatus') || 'Delivery Pending';

              const pDate = getValue(c, 'printDate') ? formatDateDDMMYYYY(getValue(c, 'printDate')) : '—';
              const fDate = getValue(c, 'fusingDate') ? formatDateDDMMYYYY(getValue(c, 'fusingDate')) : '—';
              const dDate = getValue(c, 'deliveryDate') ? formatDateDDMMYYYY(getValue(c, 'deliveryDate')) : '—';

              const jmVal = parseFloat(String(c.totalMtr || c.consumption || '0').replace(/[^\d.]/g, '')) || 0;
              const pmVal = parseFloat(String(getValue(c, 'printMtr') || '0').replace(/[^\d.]/g, '')) || 0;
              const ppmVal = pStatus === 'Printing Done' ? 0 : Math.max(0, jmVal - pmVal);

              const jMtrStr = c.totalMtr ? `${c.totalMtr} mtr` : (c.consumption ? `${c.consumption} mtr` : '—');
              const pMtrStr = getValue(c, 'printMtr') || '—';
              const ppmStr = ppmVal > 0 ? `${ppmVal.toFixed(1)} mtr` : '0 mtr';
              const fMtrStr = getValue(c, 'fusingMtr') ? `${getValue(c, 'fusingMtr')} mtr` : '—';

              return `
                <tr>
                  <td class="text-center bold" style="color: #64748b;">${i + 1}</td>
                  <td class="bold" style="color: #1d4ed8;">${c.jobNo || '—'}</td>
                  <td class="bold" style="color: #0f172a;">${c.party || '—'}</td>
                  <td>${getValue(c, 'billNo') || '—'}</td>
                  <td class="text-center bold" style="color: #6d28d9;">${jMtrStr}</td>
                  <td class="text-center">
                    <span class="status-badge ${pStatus === 'Printing Done' ? 'done-badge' : 'pending-badge'}">${pStatus === 'Printing Done' ? 'PD' : 'PP'}</span>
                  </td>
                  <td class="text-center">${pDate}</td>
                  <td class="text-center bold" style="color: #0284c7;">${pMtrStr}</td>
                  <td class="text-center bold" style="color: ${ppmVal > 0 ? '#b45309' : '#059669'};">${ppmStr}</td>
                  <td class="text-center">
                    <span class="status-badge ${fStatus === 'Fusing Done' ? 'done-badge' : 'pending-badge'}">${fStatus === 'Fusing Done' ? 'FD' : 'FP'}</span>
                  </td>
                  <td class="text-center">${fDate}</td>
                  <td class="text-center bold" style="color: #059669;">${fMtrStr}</td>
                  <td class="text-center">
                    <span class="status-badge ${dStatus === 'Delivery Done' ? 'done-badge' : 'pending-badge'}">${dStatus === 'Delivery Done' ? 'DD' : 'DP'}</span>
                  </td>
                  <td class="text-center">${dDate}</td>
                </tr>
              `;
            }).join('')}
            <tr class="total-row">
              <td colSpan="4" class="bold">TOTAL SUMMARY (${cards.length} JOB CARDS)</td>
              <td class="text-center bold" style="color: #6d28d9;">${totalJobMtrSum.toFixed(2)} mtr</td>
              <td colSpan="2"></td>
              <td class="text-center bold" style="color: #0284c7;">${totalPrintMtrSum.toFixed(2)} mtr</td>
              <td class="text-center bold" style="color: #b45309;">${totalPendingPrintMtrSum.toFixed(2)} mtr</td>
              <td colSpan="2"></td>
              <td class="text-center bold" style="color: #059669;">${totalFusingMtrSum.toFixed(2)} mtr</td>
              <td colSpan="2"></td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <div>Elite Edition ERP — Job Card Tracking & Production Audit System</div>
          <div>Total Records: ${cards.length}</div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 250);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
      
      {/* Top Banner */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#10b981,#3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clipboard size={22} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Tracking Job Card</h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>
                Track print, fusing, delivery statuses, dates, and meters — {total} total cards
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search Job No, Party, Bill No..."
              style={{ paddingLeft: 32, width: '100%', fontSize: '0.85rem' }}
            />
          </div>
          
          <DateRangePicker
            preset={datePreset}
            onChange={({ preset: p, dateStart: ds, dateEnd: de }) => {
              setDatePreset(p);
              setDateStart(ds);
              setDateEnd(de);
              setPage(1);
            }}
            customStart={customDateStart}
            customEnd={customDateEnd}
            onCustomChange={(s, e) => {
              setCustomDateStart(s);
              setCustomDateEnd(e);
            }}
          />

          {/* Print Status Filter */}
          <select
            value={printStatusFilter}
            onChange={e => { setPrintStatusFilter(e.target.value); setPage(1); }}
            style={{
              padding: '0.45rem 0.75rem',
              fontSize: '0.82rem',
              fontWeight: 800,
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: printStatusFilter === 'Printing Done' ? '#059669' : printStatusFilter === 'Printing Pending' ? '#d97706' : '#0f172a',
              cursor: 'pointer'
            }}
          >
            <option value="All">Print: All</option>
            <option value="Printing Done">Print: PD</option>
            <option value="Printing Pending">Print: PP</option>
          </select>

          {/* Fusing Status Filter */}
          <select
            value={fusingStatusFilter}
            onChange={e => { setFusingStatusFilter(e.target.value); setPage(1); }}
            style={{
              padding: '0.45rem 0.75rem',
              fontSize: '0.82rem',
              fontWeight: 800,
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: fusingStatusFilter === 'Fusing Done' ? '#059669' : fusingStatusFilter === 'Fusing Pending' ? '#d97706' : '#0f172a',
              cursor: 'pointer'
            }}
          >
            <option value="All">Fusing: All</option>
            <option value="Fusing Done">Fusing: FD</option>
            <option value="Fusing Pending">Fusing: FP</option>
          </select>

          {/* Delivery Status Filter */}
          <select
            value={deliveryStatusFilter}
            onChange={e => { setDeliveryStatusFilter(e.target.value); setPage(1); }}
            style={{
              padding: '0.45rem 0.75rem',
              fontSize: '0.82rem',
              fontWeight: 800,
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: deliveryStatusFilter === 'Delivery Done' ? '#059669' : deliveryStatusFilter === 'Delivery Pending' ? '#d97706' : '#0f172a',
              cursor: 'pointer'
            }}
          >
            <option value="All">Delivery: All</option>
            <option value="Delivery Done">Delivery: DD</option>
            <option value="Delivery Pending">Delivery: DP</option>
          </select>

          {/* Download PDF Tracking Report Button */}
          <button
            onClick={handleDownloadTrackingPdfReport}
            title="Generate & Download / Print PDF Tracking Report"
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)',
              whiteSpace: 'nowrap',
              marginLeft: 'auto'
            }}
          >
            <Download size={15} />
            <span>Download PDF Report</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', color: '#fca5a5', fontSize: '0.85rem' }}>{error}</div>
      )}

      {/* Tracker Grid */}
      <div className="glass-panel" style={{ overflowX: 'auto', padding: 0 }}>
        {loading && cards.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <RefreshCw size={32} className="spin-loader" color="var(--primary)" />
            <p style={{ marginTop: '1rem' }}>Loading tracking list...</p>
          </div>
        ) : cards.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No Job Cards found in this date range.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'var(--bg-th)' }}>
                <th style={{ ...thStyle, width: '28px', textAlign: 'center' }}></th>
                <th 
                  onClick={() => {
                    if (sortBy === 'jobNo') {
                      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('jobNo');
                      setSortOrder('desc');
                    }
                    setPage(1);
                  }}
                  style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                >
                  Job No {sortBy === 'jobNo' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
                <th 
                  onClick={() => {
                    if (sortBy === 'party') {
                      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('party');
                      setSortOrder('asc');
                    }
                    setPage(1);
                  }}
                  style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                >
                  Party {sortBy === 'party' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
                <th style={thStyle}>Bill No</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Job Mtr</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Print</th>
                <th 
                  onClick={() => {
                    if (sortBy === 'printDate') {
                      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('printDate');
                      setSortOrder('desc');
                    }
                    setPage(1);
                  }}
                  style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                >
                  Print Date {sortBy === 'printDate' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Print Mtr</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Pending Mtr</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Fusing</th>
                <th 
                  onClick={() => {
                    if (sortBy === 'fusingDate') {
                      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('fusingDate');
                      setSortOrder('desc');
                    }
                    setPage(1);
                  }}
                  style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                >
                  Fusing Date {sortBy === 'fusingDate' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Fusing Mtr</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Delivery</th>
                <th 
                  onClick={() => {
                    if (sortBy === 'deliveryDate') {
                      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortBy('deliveryDate');
                      setSortOrder('desc');
                    }
                    setPage(1);
                  }}
                  style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                >
                  Delivery Date {sortBy === 'deliveryDate' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {cards.map(c => {
                const isModified = !!modifiedCards[c._id];
                const isSaving = savingIds.has(c._id);
                const isExpanded = expandedCardIds.has(c._id);
                const logs = printLogsMap[c._id] || [];
                const isLoadingLogs = !!loadingLogsMap[c._id];

                return (
                  <React.Fragment key={c._id}>
                    <tr style={{ borderBottom: '1px solid var(--border-light)', background: isExpanded ? 'rgba(56, 189, 248, 0.06)' : isModified ? 'rgba(56, 189, 248, 0.03)' : 'transparent' }}>
                      {/* Expand History Toggle */}
                      <td style={{ ...tdStyle, textAlign: 'center', width: '28px' }}>
                        <button
                          onClick={() => toggleExpandCard(c)}
                          title={isExpanded ? "Collapse Print Run History" : "Expand Print Run History"}
                          style={{
                            background: isExpanded ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                            border: '1px solid',
                            borderColor: isExpanded ? '#38bdf8' : 'rgba(255,255,255,0.15)',
                            borderRadius: '4px',
                            color: isExpanded ? '#38bdf8' : 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            outline: 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      </td>

                      {/* Job Card No (Clickable for print preview) */}
                      <td style={tdStyle}>
                        <JobCardTooltip card={c}>
                          <button 
                            onClick={() => onPreview(c)}
                            style={{
                              background: 'none', border: 'none', color: 'var(--primary)',
                              fontWeight: 800, cursor: 'pointer', padding: 0, textDecoration: 'underline',
                              fontSize: '0.8rem', outline: 'none'
                            }}
                          >
                            {c.jobNo}
                          </button>
                        </JobCardTooltip>
                      </td>

                      {/* Party */}
                      <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {c.party || '—'}
                      </td>

                      {/* Bill No */}
                      <td style={tdStyle}>
                        {c.invoices && c.invoices.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '110px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {c.invoices.map((inv, iIdx) => (
                                <button
                                  key={inv.invoiceId || iIdx}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadInvoicePdf(inv.invoiceId, inv.invoiceNo);
                                  }}
                                  title={`Invoice: ${inv.invoiceNo}\nMeters: ${inv.meters} mtr\nDate: ${formatDateDDMMYYYY(inv.date)}\nAmount: ₹${(inv.amount || 0).toLocaleString('en-IN')}\nClick to Download PDF`}
                                  style={{
                                    background: 'rgba(56, 189, 248, 0.12)',
                                    border: '1px solid rgba(56, 189, 248, 0.35)',
                                    color: '#38bdf8',
                                    borderRadius: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    padding: '2px 5px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.15s'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.25)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.12)'}
                                >
                                  <span>📄 {inv.invoiceNo}</span>
                                  {inv.meters ? (
                                    <span style={{ color: '#34d399', fontSize: '0.65rem' }}>({inv.meters}m)</span>
                                  ) : null}
                                  {inv.date ? (
                                    <span style={{ color: '#cbd5e1', fontSize: '0.65rem' }}>• {formatDateDDMMYYYY(inv.date)}</span>
                                  ) : null}
                                </button>
                              ))}
                            </div>
                            {c.invoices.length > 1 && (
                              <span style={{ fontSize: '0.65rem', color: '#34d399', fontWeight: 700 }}>
                                Delivered: {c.deliveredMtr || c.invoices.reduce((s, x) => s + (x.meters || 0), 0)}m ({c.invoices.length} bills)
                              </span>
                            )}
                          </div>
                        ) : getValue(c, 'billNo') ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span
                              style={{
                                background: 'rgba(56, 189, 248, 0.12)',
                                border: '1px solid rgba(56, 189, 248, 0.35)',
                                color: '#38bdf8',
                                borderRadius: '4px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                padding: '2px 6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                whiteSpace: 'nowrap'
                              }}
                              title="Auto-synced Bill No"
                            >
                              📄 {getValue(c, 'billNo')}
                            </span>
                            {isAdmin && (
                              <button
                                type="button"
                                title="Edit Bill No"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const currentVal = getValue(c, 'billNo');
                                  const newVal = prompt('Edit Bill No for this job card:', currentVal);
                                  if (newVal !== null && newVal !== currentVal) {
                                    handleCellChange(c._id, 'billNo', newVal);
                                    handleAutoSave(c._id, 'billNo', newVal);
                                  }
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  padding: '1px 3px',
                                  fontSize: '0.72rem',
                                  opacity: 0.7
                                }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                              >
                                ✏️
                              </button>
                            )}
                          </div>
                        ) : isAdmin ? (
                          <input
                            type="text"
                            value={getValue(c, 'billNo')}
                            onChange={e => handleCellChange(c._id, 'billNo', e.target.value)}
                            onBlur={e => handleAutoSave(c._id, 'billNo', e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                            placeholder="Bill No"
                            title="Auto-synced from Billing Invoice. (Admin can edit)"
                            style={{ ...inputStyle, width: '100px', fontWeight: 700 }}
                          />
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* Job Mtr (Total target meters from Job Card) */}
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800, color: '#a78bfa', fontSize: '0.78rem' }}>
                        {c.totalMtr ? `${c.totalMtr} mtr` : (c.consumption ? `${c.consumption} mtr` : '—')}
                      </td>

                      {/* Print Status */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <select
                          value={getValue(c, 'printStatus') || 'Printing Pending'}
                          onChange={e => handleAutoSave(c._id, 'printStatus', e.target.value)}
                          style={{
                            ...selectStyle,
                            color: getValue(c, 'printStatus') === 'Printing Done' ? '#34d399' : '#fbbf24',
                            borderColor: getValue(c, 'printStatus') === 'Printing Done' ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)',
                            background: getValue(c, 'printStatus') === 'Printing Done' ? 'rgba(52,211,153,0.06)' : 'rgba(245,158,11,0.06)'
                          }}
                        >
                          <option value="Printing Pending" style={{ color: '#000' }}>PP</option>
                          <option value="Printing Done" style={{ color: '#000' }}>PD</option>
                        </select>
                      </td>

                      {/* Print Date */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <input
                          type="date"
                          value={getValue(c, 'printDate')}
                          disabled={!isAdmin}
                          readOnly={!isAdmin}
                          onChange={e => isAdmin && handleAutoSave(c._id, 'printDate', e.target.value)}
                          title={!isAdmin ? "Only Admin can edit Print Date directly. (Auto-updated from Printing Dept)" : "Edit Print Date"}
                          style={{
                            ...inputStyle,
                            width: '120px',
                            opacity: !isAdmin ? 0.75 : 1,
                            cursor: !isAdmin ? 'not-allowed' : 'pointer',
                            background: !isAdmin ? 'rgba(255,255,255,0.03)' : inputStyle.background
                          }}
                        />
                      </td>

                      {/* Print Mtr */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <input
                            type="text"
                            value={getValue(c, 'printMtr')}
                            disabled={!isAdmin}
                            readOnly={!isAdmin}
                            onChange={e => isAdmin && handleCellChange(c._id, 'printMtr', e.target.value)}
                            onBlur={e => isAdmin && handleAutoSave(c._id, 'printMtr', e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && isAdmin && e.target.blur()}
                            placeholder="0 mtr"
                            title={!isAdmin ? "Only Admin can edit Print Meters directly. (Auto-updated from Printing Dept)" : "Edit Print Meters"}
                            style={{
                              ...inputStyle,
                              width: '80px',
                              fontWeight: 700,
                              color: '#38bdf8',
                              opacity: !isAdmin ? 0.75 : 1,
                              cursor: !isAdmin ? 'not-allowed' : 'text',
                              background: !isAdmin ? 'rgba(255,255,255,0.03)' : inputStyle.background
                            }}
                          />
                          <button
                            onClick={() => toggleExpandCard(c)}
                            title="View Printing Run History"
                            style={{
                              background: isExpanded ? 'rgba(56, 189, 248, 0.25)' : 'rgba(56, 189, 248, 0.1)',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              borderRadius: '4px',
                              color: '#38bdf8',
                              cursor: 'pointer',
                              padding: '2px 4px',
                              fontSize: '0.65rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              outline: 'none'
                            }}
                          >
                            {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          </button>
                        </div>
                      </td>

                      {/* Pending Print Mtr */}
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800 }}>
                        {(() => {
                          const targetM = parseFloat(String(c.totalMtr || c.consumption || '0').replace(/[^\d.]/g, '')) || 0;
                          const printM = parseFloat(String(getValue(c, 'printMtr') || '0').replace(/[^\d.]/g, '')) || 0;
                          const pDone = getValue(c, 'printStatus') === 'Printing Done';
                          const pendM = pDone ? 0 : Math.max(0, targetM - printM);

                          return pendM > 0 ? (
                            <span style={{ color: '#d97706', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                              {pendM.toFixed(1)} mtr
                            </span>
                          ) : (
                            <span style={{ color: '#34d399' }}>0 mtr</span>
                          );
                        })()}
                      </td>

                      {/* Fusing Status */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <select
                          value={getValue(c, 'fusingStatus') || 'Fusing Pending'}
                          disabled={!isAdmin}
                          onChange={e => isAdmin && handleAutoSave(c._id, 'fusingStatus', e.target.value)}
                          title={!isAdmin ? "Auto-updated from Fusing Department" : "Edit Fusing Status"}
                          style={{
                            ...selectStyle,
                            color: getValue(c, 'fusingStatus') === 'Fusing Done' ? '#34d399' : '#fbbf24',
                            borderColor: getValue(c, 'fusingStatus') === 'Fusing Done' ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)',
                            background: getValue(c, 'fusingStatus') === 'Fusing Done' ? 'rgba(52,211,153,0.06)' : 'rgba(245,158,11,0.06)',
                            opacity: !isAdmin ? 0.9 : 1,
                            cursor: !isAdmin ? 'default' : 'pointer'
                          }}
                        >
                          <option value="Fusing Pending" style={{ color: '#000' }}>FP</option>
                          <option value="Fusing Done" style={{ color: '#000' }}>FD</option>
                        </select>
                      </td>

                      {/* Fusing Date */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <input
                          type="date"
                          value={getValue(c, 'fusingDate')}
                          disabled={!isAdmin}
                          readOnly={!isAdmin}
                          onChange={e => isAdmin && handleAutoSave(c._id, 'fusingDate', e.target.value)}
                          title={!isAdmin ? "Auto-updated from Fusing Department" : "Edit Fusing Date"}
                          style={{
                            ...inputStyle,
                            width: '120px',
                            opacity: !isAdmin ? 0.8 : 1,
                            cursor: !isAdmin ? 'default' : 'pointer',
                            background: !isAdmin ? 'rgba(255,255,255,0.03)' : inputStyle.background
                          }}
                        />
                      </td>

                      {/* Fusing Mtr */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <input
                          type="number"
                          value={getValue(c, 'fusingMtr')}
                          disabled={!isAdmin}
                          readOnly={!isAdmin}
                          onChange={e => isAdmin && handleCellChange(c._id, 'fusingMtr', parseFloat(e.target.value) || 0)}
                          onBlur={e => isAdmin && handleAutoSave(c._id, 'fusingMtr', parseFloat(e.target.value) || 0)}
                          onKeyDown={e => e.key === 'Enter' && isAdmin && e.target.blur()}
                          title={!isAdmin ? "Auto-updated from Fusing Department" : "Edit Fusing Meters"}
                          style={{
                            ...inputStyle,
                            width: '65px',
                            fontWeight: 700,
                            color: '#fb923c',
                            opacity: !isAdmin ? 0.85 : 1,
                            cursor: !isAdmin ? 'default' : 'text',
                            background: !isAdmin ? 'rgba(255,255,255,0.03)' : inputStyle.background
                          }}
                        />
                      </td>

                      {/* Delivery Status */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <select
                          value={getValue(c, 'deliveryStatus') || 'Delivery Pending'}
                          onChange={e => handleAutoSave(c._id, 'deliveryStatus', e.target.value)}
                          style={{
                            ...selectStyle,
                            color: getValue(c, 'deliveryStatus') === 'Delivery Done' ? '#34d399' : '#fbbf24',
                            borderColor: getValue(c, 'deliveryStatus') === 'Delivery Done' ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)',
                            background: getValue(c, 'deliveryStatus') === 'Delivery Done' ? 'rgba(52,211,153,0.06)' : 'rgba(245,158,11,0.06)'
                          }}
                        >
                          <option value="Delivery Pending" style={{ color: '#000' }}>DP</option>
                          <option value="Delivery Done" style={{ color: '#000' }}>DD</option>
                        </select>
                      </td>

                      {/* Delivery Date */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <input
                          type="date"
                          value={getValue(c, 'deliveryDate')}
                          onChange={e => handleAutoSave(c._id, 'deliveryDate', e.target.value)}
                          style={{ ...inputStyle, width: '120px' }}
                        />
                        {c.invoices && c.invoices.length > 1 && (
                          <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: '2px', whiteSpace: 'nowrap' }} title="Synced from latest delivery invoice">
                            Latest of {c.invoices.length} delivery dates
                          </div>
                        )}
                      </td>

                      {/* Sync Status Indicator */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {isSaving ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--primary)', justifyContent: 'center', width: '100%' }}>
                            <RefreshCw size={14} className="spin-loader" />
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Saving</span>
                          </div>
                        ) : isModified ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#fbbf24', justifyContent: 'center', width: '100%' }}>
                            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#fbbf24' }} />
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Editing</span>
                          </div>
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#34d399', justifyContent: 'center', width: '100%' }}>
                            <Check size={14} />
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Saved</span>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* COLLAPSIBLE PRINT RUN HISTORY SUB-ROW (WHITE THEME) */}
                    {isExpanded && (
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                        <td colSpan={15} style={{ padding: '0.85rem 1.2rem' }}>
                          <div style={{
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            padding: '0.85rem 1.1rem',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
                          }}>
                            {/* Sub-row Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                              <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0284c7', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>🖨️ Printing Run History — Job #{c.jobNo}</span>
                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>({c.party || 'No Party'})</span>
                              </div>

                              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', fontWeight: 700, flexWrap: 'wrap' }}>
                                <span style={{ background: '#eff6ff', padding: '0.25rem 0.65rem', borderRadius: '6px', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>
                                  Target Job Mtr: <strong>{c.totalMtr ? `${c.totalMtr} mtr` : (c.consumption ? `${c.consumption} mtr` : '0 mtr')}</strong>
                                </span>
                                <span style={{ background: '#ecfdf5', padding: '0.25rem 0.65rem', borderRadius: '6px', border: '1px solid #a7f3d0', color: '#047857' }}>
                                  Total Printed: <strong>{getValue(c, 'printMtr') || '0 mtr'}</strong>
                                </span>
                                <span style={{ background: '#f3e8ff', padding: '0.25rem 0.65rem', borderRadius: '6px', border: '1px solid #ddd6fe', color: '#6b21a8' }}>
                                  Total Runs: <strong>{logs.length} run(s)</strong>
                                </span>
                              </div>
                            </div>

                            {/* Sub-row Table */}
                            {isLoadingLogs ? (
                              <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.78rem' }}>
                                Loading print run logs...
                              </div>
                            ) : logs.length === 0 ? (
                              <div style={{ padding: '0.85rem', textAlign: 'center', color: '#64748b', fontSize: '0.78rem', background: '#f8fafc', borderRadius: '6px' }}>
                                No individual print run entries logged for this job card yet.
                              </div>
                            ) : (
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                                <thead>
                                  <tr style={{ borderBottom: '2px solid #cbd5e1', color: '#475569', textTransform: 'uppercase', fontSize: '0.68rem', fontWeight: 800 }}>
                                    <th style={{ padding: '0.45rem 0.6rem' }}>Run #</th>
                                    <th style={{ padding: '0.45rem 0.6rem' }}>Date & Time</th>
                                    <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right' }}>Meters Printed</th>
                                    <th style={{ padding: '0.45rem 0.6rem' }}>Machine</th>
                                    <th style={{ padding: '0.45rem 0.6rem' }}>Pass</th>
                                    <th style={{ padding: '0.45rem 0.6rem' }}>Operator</th>
                                    <th style={{ padding: '0.45rem 0.6rem' }}>Shift</th>
                                    <th style={{ padding: '0.45rem 0.6rem' }}>Remarks / Notes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {logs.map((log, idx) => (
                                    <tr key={log._id || idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                      <td style={{ padding: '0.45rem 0.6rem', fontWeight: 800, color: '#7c3aed' }}>
                                        Run #{logs.length - idx}
                                      </td>
                                      <td style={{ padding: '0.45rem 0.6rem', color: '#0f172a', fontWeight: 700 }}>
                                        {log.date ? new Date(log.date).toLocaleDateString('en-GB') : (log.created_date_time ? new Date(log.created_date_time).toLocaleDateString('en-GB') : '—')}
                                      </td>
                                      <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', fontWeight: 800, color: '#0284c7' }}>
                                        {log.meters || 0} mtr
                                      </td>
                                      <td style={{ padding: '0.45rem 0.6rem', color: '#1e293b', fontWeight: 700 }}>
                                        {log.machineName || '—'}
                                      </td>
                                      <td style={{ padding: '0.45rem 0.6rem', color: '#334155' }}>
                                        {log.pass || '—'}
                                      </td>
                                      <td style={{ padding: '0.45rem 0.6rem', color: '#334155' }}>
                                        {log.operatorName || '—'}
                                      </td>
                                      <td style={{ padding: '0.45rem 0.6rem', color: '#334155' }}>
                                        {log.shift || '—'}
                                      </td>
                                      <td style={{ padding: '0.45rem 0.6rem', color: '#64748b', fontStyle: 'italic' }}>
                                        {log.notes || '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Infinite Scroll & Pagination */}
      <InfiniteScrollPagination
        hasMore={page < pages}
        loading={loading && cards.length === 0}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
        page={page}
        pages={pages}
        total={total}
        currentCount={cards.length}
        itemName="tracking cards"
        onPrevPage={() => {
          const prevPage = Math.max(1, page - 1);
          fetchCards(false, prevPage);
        }}
        onNextPage={() => {
          if (page < pages) {
            loadMore();
          }
        }}
      />
    </div>
  );
}

const thStyle = {
  padding: '0.6rem 0.45rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  fontSize: '0.66rem',
  letterSpacing: '0.03em',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '0.45rem 0.4rem',
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
};

const inputStyle = {
  padding: '0.25rem 0.35rem',
  fontSize: '0.78rem',
  background: 'var(--bg-input, rgba(0,0,0,0.25))',
  border: '1px solid var(--border-light, rgba(255,255,255,0.12))',
  borderRadius: '4px',
  color: 'var(--text-primary)',
  outline: 'none',
  textAlign: 'center',
};

const selectStyle = {
  padding: '0.25rem 0.3rem',
  fontSize: '0.78rem',
  border: '1px solid',
  borderRadius: '6px',
  fontWeight: 800,
  cursor: 'pointer',
  outline: 'none',
  textAlign: 'center',
  width: '64px',
  display: 'inline-block'
};
