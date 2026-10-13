import React, { useState, useMemo } from 'react';
import {
  FileText,
  Layers,
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Building,
  Calendar,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Percent,
  Sparkles,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import DateRangePicker, { getDatePresetRange } from './DateRangePicker';
import { formatDateDDMMYYYY } from '../utils/dateUtils';

// Standard Indian Currency Formatter
const fmtINR = (val) => {
  const num = Number(val) || 0;
  return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtNum = (val) => {
  const num = Number(val) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Safe date parser
function parseDateSafe(dateVal) {
  if (!dateVal) return null;
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) return dateVal;
  const str = String(dateVal).trim();
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyy) {
    return new Date(parseInt(ddmmyyyy[3], 10), parseInt(ddmmyyyy[2], 10) - 1, parseInt(ddmmyyyy[1], 10), 12, 0, 0);
  }
  const yyyymmdd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (yyyymmdd) {
    return new Date(parseInt(yyyymmdd[1], 10), parseInt(yyyymmdd[2], 10) - 1, parseInt(yyyymmdd[3], 10), 12, 0, 0);
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

// Statutory HSN/SAC Description Mapping
const HSN_STANDARD_DESCRIPTIONS = {
  '9988': 'Textile Job Work / Manufacturing Services on Physical Inputs Owned by Others',
  '998821': 'Textile Job Work / Digital Printing, Dyeing & Bleaching Services',
  '998822': 'Knitting, Weaving and Stitching Job Work Services',
  '998829': 'Other Manufacturing Services on Textile Inputs',
  '9983': 'Design, Graphic and Digital Artwork Services',
  '5407': 'Woven Fabrics of Synthetic Filament Yarn (Polyester, Nylon)',
  '5408': 'Woven Fabrics of Artificial Filament Yarn',
  '5208': 'Woven Fabrics of Cotton (Powerloom / Mill Made)',
  '5209': 'Woven Fabrics of Cotton (Heavy Weight)',
  '5512': 'Woven Fabrics of Synthetic Staple Fibres',
  '5513': 'Woven Fabrics of Synthetic Staple Fibres (Mixed with Cotton)',
  '5514': 'Woven Fabrics of Synthetic Staple Fibres (Heavy Weight)',
  '5515': 'Other Woven Fabrics of Synthetic Staple Fibres',
  '5516': 'Woven Fabrics of Artificial Staple Fibres',
  '6001': 'Pile Fabrics (Including Terry Towelling)',
  '6006': 'Other Knitted or Crocheted Fabrics',
  '6203': 'Mens / Boys Suits, Ensembles, Trousers',
  '6204': 'Womens / Girls Suits, Ensembles, Dresses, Skirts, Trousers',
  '6302': 'Bed Linen, Table Linen, Toilet Linen and Kitchen Linen',
  '6307': 'Other Made Up Textile Articles'
};

const UQC_MAP = {
  MTR: 'MTR - METERS',
  KGS: 'KGS - KILOGRAMS',
  PCS: 'PCS - PIECES',
  NOS: 'NOS - NUMBERS',
  ROL: 'ROL - ROLLS',
  YDS: 'YDS - YARDS',
  SQM: 'SQM - SQUARE METERS',
  SQF: 'SQF - SQUARE FEET',
  OTH: 'OTH - OTHERS / NA'
};

function normalizeUqc(unit, hsnCode) {
  const u = String(unit || '').trim().toLowerCase();
  const hsn = String(hsnCode || '').trim();
  const isService = hsn.startsWith('99');

  if (/meter|mtr/i.test(u)) return 'MTR';
  if (/kg|kilo/i.test(u)) return 'KGS';
  if (/pc|piece/i.test(u)) return 'PCS';
  if (/no|number|nos/i.test(u)) return 'NOS';
  if (/roll/i.test(u)) return 'ROL';
  if (/yard|yd/i.test(u)) return 'YDS';
  if (/sqm|sq\.mt|sq\s*mtr/i.test(u)) return 'SQM';
  if (/sqf|sq\.ft/i.test(u)) return 'SQF';
  if (isService && (!u || /na|none|oth|other|service|job/i.test(u))) return 'OTH';
  if (u.length === 3 && /^[A-Z]{3}$/i.test(u)) return u.toUpperCase();
  return isService ? 'OTH' : 'MTR';
}

function resolveHsnDescription(hsnCode, rawDesc, rawItemName) {
  const code = String(hsnCode || '').trim();
  if (HSN_STANDARD_DESCRIPTIONS[code]) return HSN_STANDARD_DESCRIPTIONS[code];
  const prefix4 = code.substring(0, 4);
  if (HSN_STANDARD_DESCRIPTIONS[prefix4]) return HSN_STANDARD_DESCRIPTIONS[prefix4];
  if (rawDesc && rawDesc.trim() && rawDesc.trim().length > 2) return rawDesc.trim();
  if (rawItemName && rawItemName.trim() && rawItemName.trim().length > 2) return rawItemName.trim();
  if (code.startsWith('99')) return 'Textile Job Work / Processing Services';
  return 'Textile Fabrics / Goods';
}

export default function Gstr1Table12Panel({
  invoices = [],
  companyEntity = 'Elite Digital Prints',
  companyGstin = '24AANFE0044M1ZG',
  refreshData,
  isExpandable = false,
  defaultExpanded = true,
  onViewInvoice
}) {
  // ── FILTER STATES ──────────────────────────────────────────────────────────
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [datePreset, setDatePreset] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [partyTypeFilter, setPartyTypeFilter] = useState('ALL'); // 'ALL', 'B2B', 'B2C'
  const [entityFilter, setEntityFilter] = useState(companyEntity || 'ALL');
  const [turnoverTier, setTurnoverTier] = useState('LE_5CR'); // 'LE_5CR' (Min 4 Digits) or 'GT_5CR' (Min 6 Digits)
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedHsnRows, setExpandedHsnRows] = useState({});
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Compute Active Date Range
  const dateRange = useMemo(() => {
    return getDatePresetRange(datePreset, customStart, customEnd);
  }, [datePreset, customStart, customEnd]);

  // Filter Invoices
  const filteredInvoices = useMemo(() => {
    return (invoices || []).filter((inv) => {
      // Exclude cancelled invoices
      if (inv.invoiceStatus === 'CANCELLED' || inv.status === 'CANCELLED') return false;

      // Period Filter
      const parsedDate = parseDateSafe(inv.invoiceDate || inv.date || inv.createdAt);
      if (dateRange.start && parsedDate && parsedDate.getTime() < dateRange.start.getTime()) return false;
      if (dateRange.end && parsedDate && parsedDate.getTime() > dateRange.end.getTime()) return false;

      // Entity Filter
      if (entityFilter !== 'ALL') {
        const invEnt = String(inv.companyEntity || '').toLowerCase();
        const filtEnt = String(entityFilter || '').toLowerCase();
        if (!invEnt.includes(filtEnt) && !filtEnt.includes(invEnt)) return false;
      }

      // Party Type Filter
      const custGstin = (inv.customer?.gstin || inv.customerGstin || inv.gstin || '').trim();
      const isB2B = !!custGstin && custGstin.length >= 15;
      if (partyTypeFilter === 'B2B' && !isB2B) return false;
      if (partyTypeFilter === 'B2C' && isB2B) return false;

      return true;
    });
  }, [invoices, dateRange, entityFilter, partyTypeFilter]);

  // Aggregate by (HSN/SAC + UQC + Tax Rate)
  const aggregatedData = useMemo(() => {
    const groups = {};

    filteredInvoices.forEach((inv) => {
      const isInterState = inv.taxType === 'IGST' ||
        (inv.customer?.stateCode && String(inv.customer.stateCode).trim() !== '24') ||
        (inv.customer?.state && !inv.customer.state.toLowerCase().includes('gujarat')) ||
        (Number(inv.igstAmount || 0) > 0);

      const custName = inv.customer?.businessName || inv.customer?.name || inv.customerName || 'Customer';
      const custGstin = (inv.customer?.gstin || inv.customerGstin || inv.gstin || '').trim();
      const isB2B = !!custGstin && custGstin.length >= 15;
      const invDate = inv.invoiceDate || inv.date;
      const invNo = inv.invoiceNo || inv.invoiceNumber || 'INV';

      const items = Array.isArray(inv.items) && inv.items.length > 0
        ? inv.items
        : [{
            itemName: 'Textile Digital Printing / Supply',
            hsnCode: '998821',
            qty: 0,
            unit: 'OTH',
            totalAmount: inv.taxableAmount || inv.subtotal || 0,
            taxRate: 5
          }];

      items.forEach((it) => {
        const rawHsn = it.hsnCode || '998821';
        const hsn = String(rawHsn).trim() || 'UNMAPPED';
        const uqc = normalizeUqc(it.unit, hsn);
        const taxRate = Number(it.taxRate != null ? it.taxRate : 5);
        const isService = hsn.startsWith('99');

        // Total quantity: omit or 0 for service/SAC without physical quantity
        const qty = isService && (/oth/i.test(uqc) || Number(it.qty) <= 0) ? 0 : Number(it.qty || 0);

        // Taxable amount
        const taxable = Number(
          it.totalAmount != null
            ? it.totalAmount
            : (Number(it.qty || 0) * Number(it.unitPrice || 0) - Number(it.discountAmt || 0))
        ) || 0;

        let igst = 0;
        let cgst = 0;
        let sgst = 0;
        const cess = 0;

        if (isInterState) {
          igst = taxable * (taxRate / 100);
        } else {
          cgst = taxable * (taxRate / 2 / 100);
          sgst = taxable * (taxRate / 2 / 100);
        }

        const totalVal = taxable + igst + cgst + sgst + cess;

        const groupKey = `${hsn}_${uqc}_${taxRate}`;
        if (!groups[groupKey]) {
          groups[groupKey] = {
            hsn,
            description: resolveHsnDescription(hsn, it.description, it.itemName),
            uqc,
            uqcLabel: UQC_MAP[uqc] || uqc,
            taxRate,
            isService,
            totalQuantity: 0,
            totalValue: 0,
            taxableValue: 0,
            igstAmount: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            cessAmount: 0,
            itemsCount: 0,
            contributingInvoices: []
          };
        }

        const g = groups[groupKey];
        g.totalQuantity += qty;
        g.taxableValue += taxable;
        g.igstAmount += igst;
        g.cgstAmount += cgst;
        g.sgstAmount += sgst;
        g.cessAmount += cess;
        g.totalValue += totalVal;
        g.itemsCount += 1;

        if (!g.contributingInvoices.some((ci) => ci.id === (inv._id || inv.id || invNo))) {
          g.contributingInvoices.push({
            id: inv._id || inv.id || invNo,
            invoiceNo: invNo,
            date: invDate,
            dateFormatted: formatDateDDMMYYYY(invDate),
            customerName: custName,
            gstin: custGstin,
            isB2B,
            qty: it.qty,
            taxable,
            taxRate,
            totalAmount: totalVal,
            challanNo: it.ourChallanNo || inv.ourChallanNo || '',
            jobNo: it.jobNo || ''
          });
        }
      });
    });

    const rows = Object.values(groups).sort((a, b) => a.hsn.localeCompare(b.hsn));

    // Summary Totals
    const totals = rows.reduce(
      (acc, r) => {
        acc.totalQuantity += r.totalQuantity;
        acc.totalValue += r.totalValue;
        acc.taxableValue += r.taxableValue;
        acc.igstAmount += r.igstAmount;
        acc.cgstAmount += r.cgstAmount;
        acc.sgstAmount += r.sgstAmount;
        acc.cessAmount += r.cessAmount;
        return acc;
      },
      {
        totalQuantity: 0,
        totalValue: 0,
        taxableValue: 0,
        igstAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        cessAmount: 0
      }
    );

    return { rows, totals };
  }, [filteredInvoices]);

  // Search Filter
  const displayedRows = useMemo(() => {
    if (!searchQuery.trim()) return aggregatedData.rows;
    const q = searchQuery.trim().toLowerCase();
    return aggregatedData.rows.filter(
      (r) =>
        r.hsn.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.uqc.toLowerCase().includes(q)
    );
  }, [aggregatedData.rows, searchQuery]);

  // Toggle Row Expansion
  const toggleRowExpansion = (key) => {
    setExpandedHsnRows((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Check HSN Digits Compliance
  const checkDigitCompliance = (hsn, isService) => {
    const cleanDigits = String(hsn).replace(/\D/g, '');
    const len = cleanDigits.length;
    const minRequired = turnoverTier === 'GT_5CR' ? 6 : 4;

    if (len < minRequired) {
      return {
        isValid: false,
        badgeText: `⚠️ ${len} Digits (Needs ${minRequired}+)`,
        color: '#b91c1c',
        bg: '#fef2f2',
        border: '#fecaca'
      };
    }
    if (isService) {
      return {
        isValid: true,
        badgeText: `✓ ${len}-Digit SAC`,
        color: '#4338ca',
        bg: '#eef2ff',
        border: '#c7d2fe'
      };
    }
    return {
      isValid: true,
      badgeText: `✓ ${len}-Digit HSN`,
      color: '#047857',
      bg: '#ecfdf5',
      border: '#a7f3d0'
    };
  };

  // ── COPY TABLE TO CLIPBOARD (TSV FOR CA PORTAL ENTRY) ────────────────────────
  const handleCopyTable = async () => {
    try {
      const headers = [
        'HSN / SAC',
        'Description',
        'UQC',
        'Total Quantity',
        'Total Value',
        'Taxable Value',
        'Rate (%)',
        'IGST',
        'CGST',
        'SGST',
        'Cess'
      ];

      const lines = [headers.join('\t')];

      aggregatedData.rows.forEach((r) => {
        lines.push(
          [
            r.hsn,
            r.description,
            r.uqc,
            r.isService && r.totalQuantity === 0 ? '-' : r.totalQuantity.toFixed(2),
            r.totalValue.toFixed(2),
            r.taxableValue.toFixed(2),
            `${r.taxRate}%`,
            r.igstAmount.toFixed(2),
            r.cgstAmount.toFixed(2),
            r.sgstAmount.toFixed(2),
            r.cessAmount.toFixed(2)
          ].join('\t')
        );
      });

      // Total Row
      lines.push(
        [
          'TOTAL',
          'Grand Total Summary',
          '',
          aggregatedData.totals.totalQuantity.toFixed(2),
          aggregatedData.totals.totalValue.toFixed(2),
          aggregatedData.totals.taxableValue.toFixed(2),
          '',
          aggregatedData.totals.igstAmount.toFixed(2),
          aggregatedData.totals.cgstAmount.toFixed(2),
          aggregatedData.totals.sgstAmount.toFixed(2),
          aggregatedData.totals.cessAmount.toFixed(2)
        ].join('\t')
      );

      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to copy table:', err);
      alert('Could not copy to clipboard. Please check browser permissions.');
    }
  };

  // ── EXPORT EXCEL (OFFICIAL GST OFFLINE TOOL SCHEMA) ────────────────────────
  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // Format Year_Month from date range
      const endD = dateRange.end || new Date();
      const yyyy = endD.getFullYear();
      const mm = String(endD.getMonth() + 1).padStart(2, '0');
      const periodTag = `${yyyy}_${mm}`;

      // Strictly follow official GST Offline Tool schema:
      // HSN | Description | UQC | Total Quantity | Total Value | Taxable Value | Integrated Tax Amount | Central Tax Amount | State/UT Tax Amount | Cess Amount
      const exportRows = aggregatedData.rows.map((r) => ({
        'HSN': String(r.hsn),
        'Description': r.description,
        'UQC': r.uqc,
        'Total Quantity': r.isService && r.totalQuantity === 0 ? 0 : Math.round(r.totalQuantity * 100) / 100,
        'Total Value': Math.round(r.totalValue * 100) / 100,
        'Taxable Value': Math.round(r.taxableValue * 100) / 100,
        'Rate (%)': `${r.taxRate}%`,
        'Integrated Tax Amount': Math.round(r.igstAmount * 100) / 100,
        'Central Tax Amount': Math.round(r.cgstAmount * 100) / 100,
        'State/UT Tax Amount': Math.round(r.sgstAmount * 100) / 100,
        'Cess Amount': Math.round(r.cessAmount * 100) / 100
      }));

      // Add Summary Row
      exportRows.push({
        'HSN': 'TOTAL',
        'Description': 'GSTR-1 Table 12 Grand Total',
        'UQC': '',
        'Total Quantity': Math.round(aggregatedData.totals.totalQuantity * 100) / 100,
        'Total Value': Math.round(aggregatedData.totals.totalValue * 100) / 100,
        'Taxable Value': Math.round(aggregatedData.totals.taxableValue * 100) / 100,
        'Rate (%)': '',
        'Integrated Tax Amount': Math.round(aggregatedData.totals.igstAmount * 100) / 100,
        'Central Tax Amount': Math.round(aggregatedData.totals.cgstAmount * 100) / 100,
        'State/UT Tax Amount': Math.round(aggregatedData.totals.sgstAmount * 100) / 100,
        'Cess Amount': Math.round(aggregatedData.totals.cessAmount * 100) / 100
      });

      const ws = XLSX.utils.json_to_sheet(exportRows);

      // Auto-fit column widths
      ws['!cols'] = [
        { wch: 12 }, // HSN
        { wch: 45 }, // Description
        { wch: 10 }, // UQC
        { wch: 16 }, // Total Quantity
        { wch: 18 }, // Total Value
        { wch: 18 }, // Taxable Value
        { wch: 10 }, // Rate
        { wch: 22 }, // Integrated Tax Amount
        { wch: 20 }, // Central Tax Amount
        { wch: 20 }, // State/UT Tax Amount
        { wch: 14 }  // Cess Amount
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'GSTR1_Table12_HSN');

      const fileName = `GSTR1_Table12_HSN_Summary_${companyGstin || 'GSTIN'}_${periodTag}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error('Failed to export GSTR-1 Table 12 Excel:', err);
      alert('Could not export Table 12 Excel. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // ── EXPORT CSV ─────────────────────────────────────────────────────────────
  const handleExportCsv = () => {
    try {
      const endD = dateRange.end || new Date();
      const yyyy = endD.getFullYear();
      const mm = String(endD.getMonth() + 1).padStart(2, '0');
      const periodTag = `${yyyy}_${mm}`;

      const headers = [
        'HSN',
        'Description',
        'UQC',
        'Total Quantity',
        'Total Value',
        'Taxable Value',
        'Integrated Tax Amount',
        'Central Tax Amount',
        'State/UT Tax Amount',
        'Cess Amount'
      ];

      const rows = aggregatedData.rows.map((r) => [
        `"${r.hsn}"`,
        `"${r.description.replace(/"/g, '""')}"`,
        `"${r.uqc}"`,
        r.isService && r.totalQuantity === 0 ? 0 : r.totalQuantity.toFixed(2),
        r.totalValue.toFixed(2),
        r.taxableValue.toFixed(2),
        r.igstAmount.toFixed(2),
        r.cgstAmount.toFixed(2),
        r.sgstAmount.toFixed(2),
        r.cessAmount.toFixed(2)
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute(
        'download',
        `GSTR1_Table12_HSN_Summary_${companyGstin || 'GSTIN'}_${periodTag}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export CSV:', err);
    }
  };

  return (
    <div
      id="gstr1-table12-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-light, #e2e8f0)',
        borderRadius: '16px',
        padding: '1.4rem',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)',
        transition: 'all 0.2s ease'
      }}
    >
      {/* ── HEADER & COLLAPSE CONTROL ───────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          cursor: isExpandable ? 'pointer' : 'default',
          userSelect: 'none'
        }}
        onClick={isExpandable ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              color: '#ffffff',
              borderRadius: '12px',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
            }}
          >
            <Layers size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: 900,
                  color: 'var(--text-primary, #0f172a)',
                  letterSpacing: '-0.02em'
                }}
              >
                Table 12: HSN/SAC Summary (GSTR-1 Compliant)
              </h2>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  color: '#4338ca',
                  background: '#eef2ff',
                  border: '1px solid #c7d2fe',
                  borderRadius: '9999px'
                }}
              >
                <Sparkles size={11} /> Table 12
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
              Auto-aggregated outward supplies for textile job work, printed fabrics, and goods.
            </div>
          </div>
        </div>

        {/* Action Buttons on Header */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}
          onClick={(e) => e.stopPropagation()}
        >
          {refreshData && (
            <button
              id="btn-refresh-table12"
              type="button"
              onClick={refreshData}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '7px 12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#475569',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Recalculate Table 12 Aggregates"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          )}

          <button
            id="btn-copy-table12"
            type="button"
            onClick={handleCopyTable}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 13px',
              fontSize: '0.8rem',
              fontWeight: 800,
              color: copiedSuccess ? '#047857' : '#334155',
              background: copiedSuccess ? '#ecfdf5' : '#f8fafc',
              border: copiedSuccess ? '1px solid #a7f3d0' : '1px solid #cbd5e1',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Copy Tab-Separated Values for Direct Entry into CA / GST Portal"
          >
            {copiedSuccess ? <Check size={14} color="#059669" /> : <Copy size={14} />}
            <span>{copiedSuccess ? 'Copied for Portal!' : 'Copy Table'}</span>
          </button>

          <button
            id="btn-export-csv-table12"
            type="button"
            onClick={handleExportCsv}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '7px 12px',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#475569',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
            title="Download CSV for GST Offline Tool"
          >
            <Download size={14} /> CSV
          </button>

          <button
            id="btn-export-excel-table12"
            type="button"
            disabled={isExporting}
            onClick={handleExportExcel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              fontSize: '0.82rem',
              fontWeight: 800,
              color: '#ffffff',
              background: 'linear-gradient(135deg, #059669, #10b981)',
              border: 'none',
              borderRadius: '8px',
              boxShadow: '0 3px 8px rgba(16, 185, 129, 0.25)',
              cursor: isExporting ? 'not-allowed' : 'pointer'
            }}
            title="Download GST-Compliant Excel Workbook"
          >
            <FileSpreadsheet size={15} />
            <span>{isExporting ? 'Exporting...' : 'Export Table 12 (Excel)'}</span>
          </button>

          {isExpandable && (
            <div style={{ color: '#64748b', padding: '4px' }}>
              {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </div>
          )}
        </div>
      </div>

      {/* ── EXPANDABLE CONTENT ──────────────────────────────────────────────── */}
      {isExpanded && (
        <>
          {/* ── KPI HIGHLIGHT CARDS ────────────────────────────────────────── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.85rem'
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '0.9rem 1.1rem'
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                TOTAL TAXABLE VALUE
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
                {fmtINR(aggregatedData.totals.taxableValue)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '3px' }}>
                Across {aggregatedData.rows.length} HSN Slabs
              </div>
            </div>

            <div
              style={{
                background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                border: '1px solid #bfdbfe',
                borderRadius: '12px',
                padding: '0.9rem 1.1rem'
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af' }}>
                TOTAL OUTWARD GST
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1e3a8a', marginTop: '4px' }}>
                {fmtINR(
                  aggregatedData.totals.igstAmount +
                  aggregatedData.totals.cgstAmount +
                  aggregatedData.totals.sgstAmount
                )}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#3b82f6', marginTop: '3px' }}>
                IGST: {fmtINR(aggregatedData.totals.igstAmount)} | CGST+SGST: {fmtINR(aggregatedData.totals.cgstAmount + aggregatedData.totals.sgstAmount)}
              </div>
            </div>

            <div
              style={{
                background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
                border: '1px solid #a7f3d0',
                borderRadius: '12px',
                padding: '0.9rem 1.1rem'
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065f46' }}>
                TOTAL GOODS QUANTITY
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#064e3b', marginTop: '4px' }}>
                {fmtNum(aggregatedData.totals.totalQuantity)} <span style={{ fontSize: '0.85rem' }}>MTR</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#059669', marginTop: '3px' }}>
                Meters / Physical supply
              </div>
            </div>

            <div
              style={{
                background: 'linear-gradient(135deg, #faf5ff, #f3e8ff)',
                border: '1px solid #e9d5ff',
                borderRadius: '12px',
                padding: '0.9rem 1.1rem'
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b21a8' }}>
                GROSS INVOICE VALUE
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#581c87', marginTop: '4px' }}>
                {fmtINR(aggregatedData.totals.totalValue)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#7e22ce', marginTop: '3px' }}>
                From {filteredInvoices.length} Outward Invoices
              </div>
            </div>
          </div>

          {/* ── FILTER & SETTINGS BAR ─────────────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.85rem',
              padding: '0.85rem 1rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
              {/* Period Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Calendar size={15} color="#4f46e5" />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Period:</span>
                <DateRangePicker
                  preset={datePreset}
                  onChange={({ preset: p, dateStart, dateEnd }) => {
                    setDatePreset(p);
                    if (p === 'custom' && dateStart && dateEnd) {
                      setCustomStart(dateStart);
                      setCustomEnd(dateEnd);
                    }
                  }}
                  customStart={customStart}
                  customEnd={customEnd}
                  onCustomChange={(s, e) => {
                    setCustomStart(s);
                    setCustomEnd(e);
                  }}
                />
              </div>

              {/* Entity / Branch Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Building size={15} color="#4f46e5" />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Entity:</span>
                <select
                  id="select-entity-table12"
                  value={entityFilter}
                  onChange={(e) => setEntityFilter(e.target.value)}
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155'
                  }}
                >
                  <option value="ALL">All Entities (Combined)</option>
                  <option value="Elite Digital Prints">Elite Digital Prints ({companyGstin})</option>
                  <option value="Elite Online">Elite Online</option>
                </select>
              </div>

              {/* Party Type (B2B vs B2C) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Filter size={14} color="#4f46e5" />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Supply Type:</span>
                <select
                  id="select-party-type-table12"
                  value={partyTypeFilter}
                  onChange={(e) => setPartyTypeFilter(e.target.value)}
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155'
                  }}
                >
                  <option value="ALL">All Supplies (B2B + B2C)</option>
                  <option value="B2B">B2B (Registered Taxpayers)</option>
                  <option value="B2C">B2C (Consumers / Unregistered)</option>
                </select>
              </div>

              {/* Turnover Tier Validation Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <CheckCircle2 size={14} color="#059669" />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Turnover:</span>
                <select
                  id="select-turnover-tier-table12"
                  value={turnoverTier}
                  onChange={(e) => setTurnoverTier(e.target.value)}
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155'
                  }}
                  title="Statutory HSN Digits Requirement based on annual turnover"
                >
                  <option value="LE_5CR">Turnover ≤ ₹5 Cr (Min 4 Digits)</option>
                  <option value="GT_5CR">Turnover &gt; ₹5 Cr (Mandatory 6 Digits)</option>
                </select>
              </div>
            </div>

            {/* In-Table Search */}
            <div style={{ position: 'relative', minWidth: '180px' }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
              />
              <input
                id="input-search-table12"
                type="text"
                placeholder="Search HSN code / description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 10px 5px 30px',
                  fontSize: '0.8rem',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#1e293b'
                }}
              />
            </div>
          </div>

          {/* ── DATA TABLE ────────────────────────────────────────────────────── */}
          <div
            style={{
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y',
              overscrollBehaviorX: 'contain',
              maxWidth: '100%',
              border: '1px solid var(--border-light, #e2e8f0)',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}
          >
            <table
              id="table-gstr1-table12"
              style={{
                width: '100%',
                minWidth: '920px',
                borderCollapse: 'collapse',
                fontSize: '0.83rem',
                textAlign: 'left'
              }}
            >
              <thead>
                <tr
                  style={{
                    background: 'linear-gradient(180deg, #1e293b, #0f172a)',
                    color: '#ffffff',
                    fontWeight: 800,
                    whiteSpace: 'nowrap'
                  }}
                >
                  <th style={{ padding: '12px 14px', width: '30px' }}>#</th>
                  <th style={{ padding: '12px 14px' }}>HSN / SAC Code</th>
                  <th style={{ padding: '12px 14px', minWidth: '220px' }}>Description of Outward Supplies</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>UQC</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Quantity</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Value (₹)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Taxable Value (₹)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Rate (%)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>IGST (₹)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>CGST (₹)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>SGST (₹)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Cess (₹)</th>
                </tr>
              </thead>

              <tbody>
                {displayedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={12}
                      style={{
                        padding: '3rem',
                        textAlign: 'center',
                        color: 'var(--text-muted, #64748b)'
                      }}
                    >
                      <Layers size={36} style={{ margin: '0 auto 10px', color: '#cbd5e1' }} />
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1e293b' }}>
                        No Outward Supplies Found
                      </div>
                      <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                        No sales transactions found for the selected reporting period and entity filter.
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((r, idx) => {
                    const rowKey = `${r.hsn}_${r.uqc}_${r.taxRate}`;
                    const isRowExpanded = !!expandedHsnRows[rowKey];
                    const compliance = checkDigitCompliance(r.hsn, r.isService);

                    return (
                      <React.Fragment key={rowKey}>
                        <tr
                          onClick={() => toggleRowExpansion(rowKey)}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: idx % 2 === 0 ? 'var(--bg-card, #ffffff)' : '#f8fafc',
                            cursor: 'pointer',
                            transition: 'background 0.12s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f1f5f9';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              idx % 2 === 0 ? 'var(--bg-card, #ffffff)' : '#f8fafc';
                          }}
                        >
                          {/* Row Index with expand icon */}
                          <td style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {isRowExpanded ? (
                                <ChevronDown size={14} color="#4f46e5" />
                              ) : (
                                <ChevronRight size={14} color="#94a3b8" />
                              )}
                              <span>{idx + 1}</span>
                            </div>
                          </td>

                          {/* HSN / SAC Code with Compliance Badge */}
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                style={{
                                  fontWeight: 800,
                                  fontFamily: 'monospace',
                                  fontSize: '0.9rem',
                                  color: '#0f172a'
                                }}
                              >
                                {r.hsn}
                              </span>
                              <span
                                style={{
                                  display: 'inline-block',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '6px',
                                  color: compliance.color,
                                  background: compliance.bg,
                                  border: `1px solid ${compliance.border}`
                                }}
                                title={`Statutory validation: ${compliance.badgeText}`}
                              >
                                {compliance.badgeText}
                              </span>
                            </div>
                          </td>

                          {/* Description */}
                          <td style={{ padding: '10px 14px', color: '#1e293b', fontWeight: 600 }}>
                            <div>{r.description}</div>
                            {r.isService && (
                              <div style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: 500 }}>
                                SAC (Services Contract / Processing)
                              </div>
                            )}
                          </td>

                          {/* UQC */}
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                background: r.uqc === 'MTR' ? '#ecfdf5' : '#f1f5f9',
                                color: r.uqc === 'MTR' ? '#065f46' : '#475569',
                                border: r.uqc === 'MTR' ? '1px solid #a7f3d0' : '1px solid #cbd5e1'
                              }}
                            >
                              {r.uqc}
                            </span>
                          </td>

                          {/* Total Quantity */}
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                            {r.isService && r.totalQuantity === 0 ? (
                              <span style={{ color: '#94a3b8' }}>-</span>
                            ) : (
                              fmtNum(r.totalQuantity)
                            )}
                          </td>

                          {/* Total Value */}
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                            {fmtINR(r.totalValue)}
                          </td>

                          {/* Taxable Value */}
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                            {fmtINR(r.taxableValue)}
                          </td>

                          {/* Tax Rate (%) */}
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 7px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                background: '#f5f3ff',
                                color: '#6d28d9',
                                border: '1px solid #ddd6fe'
                              }}
                            >
                              {r.taxRate}%
                            </span>
                          </td>

                          {/* IGST */}
                          <td
                            style={{
                              padding: '10px 14px',
                              textAlign: 'right',
                              fontWeight: r.igstAmount > 0 ? 800 : 400,
                              color: r.igstAmount > 0 ? '#1e40af' : '#94a3b8'
                            }}
                          >
                            {fmtINR(r.igstAmount)}
                          </td>

                          {/* CGST */}
                          <td
                            style={{
                              padding: '10px 14px',
                              textAlign: 'right',
                              fontWeight: r.cgstAmount > 0 ? 800 : 400,
                              color: r.cgstAmount > 0 ? '#047857' : '#94a3b8'
                            }}
                          >
                            {fmtINR(r.cgstAmount)}
                          </td>

                          {/* SGST */}
                          <td
                            style={{
                              padding: '10px 14px',
                              textAlign: 'right',
                              fontWeight: r.sgstAmount > 0 ? 800 : 400,
                              color: r.sgstAmount > 0 ? '#047857' : '#94a3b8'
                            }}
                          >
                            {fmtINR(r.sgstAmount)}
                          </td>

                          {/* Cess */}
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#94a3b8' }}>
                            {fmtINR(r.cessAmount)}
                          </td>
                        </tr>

                        {/* ── EXPANDED AUDIT TRAIL ROW ──────────────────────── */}
                        {isRowExpanded && (
                          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                            <td colSpan={12} style={{ padding: '12px 20px' }}>
                              <div
                                style={{
                                  background: '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '10px',
                                  padding: '12px 16px',
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '8px'
                                  }}
                                >
                                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155' }}>
                                    🔍 Audit Breakdown: Invoices contributing to HSN {r.hsn} ({r.contributingInvoices.length} Invoices)
                                  </div>
                                  <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                    Click any invoice number to view details
                                  </div>
                                </div>

                                <div style={{ overflowX: 'auto', maxHeight: '200px' }}>
                                  <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 700 }}>
                                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Invoice #</th>
                                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Date</th>
                                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Customer</th>
                                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>GSTIN</th>
                                        <th style={{ padding: '6px 8px', textAlign: 'center' }}>Type</th>
                                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty</th>
                                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Taxable</th>
                                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total (Incl. Tax)</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {r.contributingInvoices.map((ci, cIdx) => (
                                        <tr
                                          key={cIdx}
                                          style={{ borderBottom: '1px solid #f1f5f9' }}
                                        >
                                          <td style={{ padding: '6px 8px' }}>
                                            <span
                                              style={{
                                                fontWeight: 800,
                                                color: '#4f46e5',
                                                cursor: onViewInvoice ? 'pointer' : 'default',
                                                textDecoration: onViewInvoice ? 'underline' : 'none'
                                              }}
                                              onClick={() => {
                                                if (onViewInvoice) {
                                                  const fullInv = filteredInvoices.find(
                                                    (x) => (x._id || x.id || x.invoiceNo) === ci.id
                                                  );
                                                  if (fullInv) onViewInvoice(fullInv);
                                                }
                                              }}
                                            >
                                              {ci.invoiceNo}
                                            </span>
                                          </td>
                                          <td style={{ padding: '6px 8px', color: '#64748b' }}>
                                            {ci.dateFormatted}
                                          </td>
                                          <td style={{ padding: '6px 8px', fontWeight: 600, color: '#1e293b' }}>
                                            {ci.customerName}
                                          </td>
                                          <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#475569' }}>
                                            {ci.gstin || '-'}
                                          </td>
                                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                            <span
                                              style={{
                                                fontSize: '0.7rem',
                                                fontWeight: 700,
                                                padding: '1px 5px',
                                                borderRadius: '4px',
                                                background: ci.isB2B ? '#eef2ff' : '#f1f5f9',
                                                color: ci.isB2B ? '#4338ca' : '#64748b'
                                              }}
                                            >
                                              {ci.isB2B ? 'B2B' : 'B2C'}
                                            </span>
                                          </td>
                                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>
                                            {ci.qty ? `${fmtNum(ci.qty)} MTR` : '-'}
                                          </td>
                                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>
                                            {fmtINR(ci.taxable)}
                                          </td>
                                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                            {fmtINR(ci.totalAmount)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>

              {/* ── STICKY BOLD SUMMARY TOTALS ROW ────────────────────────────── */}
              {displayedRows.length > 0 && (
                <tfoot>
                  <tr
                    style={{
                      background: 'linear-gradient(180deg, #f1f5f9, #e2e8f0)',
                      fontWeight: 900,
                      borderTop: '2px solid #cbd5e1',
                      borderBottom: '2px solid #cbd5e1',
                      color: '#0f172a',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <td colSpan={3} style={{ padding: '14px', fontSize: '0.9rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#4f46e5' }}>●</span>
                        <span>TOTAL / SUMMARY (Table 12 Compliant)</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px', textAlign: 'center', color: '#64748b' }}>-</td>
                    <td style={{ padding: '14px', textAlign: 'right', fontSize: '0.92rem' }}>
                      {fmtNum(aggregatedData.totals.totalQuantity)}
                    </td>
                    <td style={{ padding: '14px', textAlign: 'right', fontSize: '0.92rem' }}>
                      {fmtINR(aggregatedData.totals.totalValue)}
                    </td>
                    <td style={{ padding: '14px', textAlign: 'right', fontSize: '0.95rem', color: '#1e1b4b' }}>
                      {fmtINR(aggregatedData.totals.taxableValue)}
                    </td>
                    <td style={{ padding: '14px', textAlign: 'center', color: '#64748b' }}>-</td>
                    <td style={{ padding: '14px', textAlign: 'right', fontSize: '0.92rem', color: '#1e40af' }}>
                      {fmtINR(aggregatedData.totals.igstAmount)}
                    </td>
                    <td style={{ padding: '14px', textAlign: 'right', fontSize: '0.92rem', color: '#047857' }}>
                      {fmtINR(aggregatedData.totals.cgstAmount)}
                    </td>
                    <td style={{ padding: '14px', textAlign: 'right', fontSize: '0.92rem', color: '#047857' }}>
                      {fmtINR(aggregatedData.totals.sgstAmount)}
                    </td>
                    <td style={{ padding: '14px', textAlign: 'right', fontSize: '0.88rem', color: '#64748b' }}>
                      {fmtINR(aggregatedData.totals.cessAmount)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* ── STATUTORY FOOTER GUIDANCE NOTE ───────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
              padding: '10px 14px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              fontSize: '0.78rem',
              color: '#64748b'
            }}
          >
            <Info size={16} color="#4f46e5" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <b style={{ color: '#1e293b' }}>Statutory GSTR-1 Table 12 Filing Rule:</b> Line items under the same HSN with different tax slabs (e.g. 5% vs 12%) are aggregated as distinct line items. For SAC codes (services like digital printing job work), quantity is optional and mapped as <code>OTH</code> (Others). Use <b>Copy Table</b> to paste directly into your CA's software or GST Offline Utility.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
