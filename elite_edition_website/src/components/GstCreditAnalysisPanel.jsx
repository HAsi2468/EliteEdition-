import React, { useState, useMemo } from 'react';
import {
  Calculator,
  ArrowUpRight,
  ArrowDownLeft,
  Scale,
  ShieldCheck,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  FileText,
  ShoppingBag,
  CreditCard,
  Building,
  RotateCcw,
  Calendar,
  ExternalLink,
  Percent,
  Layers,
  ChevronDown,
  Truck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import DateRangePicker, { getDatePresetRange } from './DateRangePicker';
import Gstr1Table12Panel from './Gstr1Table12Panel';
import GtaFreightRcmPanel from './GtaFreightRcmPanel';

// Indian currency formatter
const fmtINR = (val) => {
  const num = Number(val) || 0;
  return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtNum = (val) => {
  const num = Number(val) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Safe date parser supporting ISO, YYYY-MM-DD, and DD-MM-YYYY
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

// ── STATUTORY GST COMPLIANCE ENGINE FEATURE FLAGS ──
// Table 12 HSN Summary is enabled; Freight GTA RCM is kept hidden until explicitly requested
export const SHOW_TABLE_12_TAB = true;
export const SHOW_GTA_FREIGHT_RCM_TAB = false;

export default function GstCreditAnalysisPanel({
  invoices = [],
  purchases = [],
  companyEntity = 'Elite Digital Prints',
  onViewInvoice,
  onViewPurchase,
  refreshData
}) {
  // ── FILTER STATES ──────────────────────────────────────────────────────────
  const [datePreset, setDatePreset] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [activeTab, setActiveTab] = useState('summary'); // 'summary', 'outward', 'inward', 'tds'
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState(companyEntity || 'Elite Digital Prints');
  const [partyTypeFilter, setPartyTypeFilter] = useState('ALL'); // 'ALL', 'B2B', 'B2C'
  const [taxRateFilter, setTaxRateFilter] = useState('ALL'); // 'ALL', '0', '5', '12', '18', '28'
  const [isExporting, setIsExporting] = useState(false);

  // Compute Active Reporting Period Date Boundaries
  const dateRange = useMemo(() => {
    return getDatePresetRange(datePreset, customStart, customEnd);
  }, [datePreset, customStart, customEnd]);

  // ── INVOICE (OUTWARD SALES) PARSER & FILTER ────────────────────────────────
  const parsedInvoices = useMemo(() => {
    return (invoices || []).map((inv) => {
      const parsedDate = parseDateSafe(inv.invoiceDate || inv.date || inv.createdAt);
      const party = inv.customer?.businessName || inv.customer?.name || (typeof inv.customer === 'string' ? inv.customer : '') || inv.customerName || 'Customer';
      const gstin = (inv.customer?.gstin || inv.customerGstin || inv.billingGstin || inv.gstin || '').trim();
      const state = inv.customer?.state || inv.billingState || 'Gujarat';
      const isInterState = inv.taxType === 'IGST' || (inv.igstAmount && Number(inv.igstAmount) > 0);

      const taxable = Number(inv.taxableAmount != null ? inv.taxableAmount : (inv.subtotal != null ? inv.subtotal : (inv.grandTotal || 0) - (inv.totalTax || inv.gstAmount || 0))) || 0;
      const totalTax = Number(inv.totalTax != null ? inv.totalTax : (inv.gstAmount != null ? inv.gstAmount : 0)) || 0;
      
      let cgst = Number(inv.cgstAmount || 0);
      let sgst = Number(inv.sgstAmount || 0);
      let igst = Number(inv.igstAmount || 0);

      if (isInterState) {
        igst = igst || totalTax;
        cgst = 0;
        sgst = 0;
      } else {
        if (!cgst && !sgst && totalTax > 0) {
          cgst = totalTax / 2;
          sgst = totalTax / 2;
        }
      }

      // TDS Details (Deducted by Client on Outward Sales)
      const enableTds = !!inv.enableTds;
      const tdsAmount = Number(inv.tdsAmount || 0);
      const tdsSection = inv.tdsSection || (enableTds && tdsAmount > 0 ? '194C' : '');
      const tdsRate = inv.tdsRate != null ? Number(inv.tdsRate) : (enableTds ? 2 : 0);

      // Estimated overall GST Rate
      let gstRate = 5;
      if (inv.items && Array.isArray(inv.items) && inv.items.length > 0 && inv.items[0].taxRate != null) {
        gstRate = Number(inv.items[0].taxRate);
      } else if (taxable > 0 && totalTax > 0) {
        gstRate = Math.round((totalTax / taxable) * 100);
      }

      return {
        _raw: inv,
        id: inv._id || inv.id,
        invoiceNo: inv.invoiceNo || inv.invoiceNumber || 'INV',
        date: parsedDate,
        dateFormatted: parsedDate ? formatDateDDMMYYYY(parsedDate) : (inv.invoiceDate || '-'),
        partyName: party,
        gstin,
        state,
        isB2B: !!gstin && gstin.length >= 15,
        isInterState,
        taxable,
        cgst,
        sgst,
        igst,
        totalTax,
        grandTotal: Number(inv.grandTotal != null ? inv.grandTotal : inv.totalAmount || 0) || 0,
        enableTds,
        tdsAmount,
        tdsSection,
        tdsRate,
        gstRate,
        companyEntity: inv.companyEntity || companyEntity || 'Elite Digital Prints'
      };
    });
  }, [invoices]);

  // ── PURCHASE (INWARD ITC) PARSER & FILTER ──────────────────────────────────
  const parsedPurchases = useMemo(() => {
    return (purchases || []).map((pur) => {
      const parsedDate = parseDateSafe(pur.date || pur.billDate || pur.purchaseDate || pur.createdAt);
      const party = pur.vendor?.businessName || pur.vendor?.name || pur.vendorName || (typeof pur.vendor === 'string' ? pur.vendor : '') || 'Vendor';
      const gstin = (pur.vendor?.gstin || pur.vendorGstin || pur.gstin || '').trim();
      const state = pur.vendor?.state || pur.state || 'Gujarat';
      const isInterState = pur.taxType === 'IGST' || (pur.igstAmount && Number(pur.igstAmount) > 0);

      const taxable = Number(pur.taxableAmount != null ? pur.taxableAmount : (pur.subtotal != null ? pur.subtotal : (pur.grandTotal || pur.totalAmount || 0) - (pur.totalTax || pur.gstAmount || 0))) || 0;
      const totalTax = Number(pur.totalTax != null ? pur.totalTax : (pur.gstAmount != null ? pur.gstAmount : 0)) || 0;

      let cgst = Number(pur.cgstAmount || 0);
      let sgst = Number(pur.sgstAmount || 0);
      let igst = Number(pur.igstAmount || 0);

      if (isInterState) {
        igst = igst || totalTax;
        cgst = 0;
        sgst = 0;
      } else {
        if (!cgst && !sgst && totalTax > 0) {
          cgst = totalTax / 2;
          sgst = totalTax / 2;
        }
      }

      // TDS Withheld on Purchase (e.g. 194Q / 194C)
      const tdsAmount = Number(pur.tdsAmount || 0);
      const tdsSection = pur.tdsSection || (tdsAmount > 0 ? '194Q' : '');
      const tdsRate = pur.tdsRate != null ? Number(pur.tdsRate) : (tdsAmount > 0 ? 0.1 : 0);

      let gstRate = Number(pur.gstRate || 5);
      if (pur.items && Array.isArray(pur.items) && pur.items.length > 0 && pur.items[0].taxRate != null) {
        gstRate = Number(pur.items[0].taxRate);
      } else if (taxable > 0 && totalTax > 0) {
        gstRate = Math.round((totalTax / taxable) * 100);
      }

      return {
        _raw: pur,
        id: pur._id || pur.id,
        purchaseNo: pur.purchaseNo || 'PUR',
        billNo: pur.billNo || pur.vendorInvoiceNo || '-',
        date: parsedDate,
        dateFormatted: parsedDate ? formatDateDDMMYYYY(parsedDate) : (pur.date || '-'),
        partyName: party,
        gstin,
        state,
        isB2B: !!gstin && gstin.length >= 15,
        isInterState,
        taxable,
        cgst,
        sgst,
        igst,
        totalTax,
        grandTotal: Number(pur.grandTotal != null ? pur.grandTotal : pur.totalAmount || 0) || 0,
        tdsAmount,
        tdsSection,
        tdsRate,
        gstRate,
        companyEntity: pur.companyEntity || companyEntity || 'Elite Digital Prints'
      };
    });
  }, [purchases]);

  // ── FILTERING LOGIC (PERIOD, ENTITY, SEARCH, PARTY TYPE, TAX RATE) ─────────
  const matchesPeriod = (itemDate) => {
    if (!dateRange.start && !dateRange.end) return true;
    if (!itemDate) return true;
    const time = itemDate.getTime();
    if (dateRange.start && time < dateRange.start.getTime()) return false;
    if (dateRange.end && time > dateRange.end.getTime()) return false;
    return true;
  };

  const filteredInvoices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return parsedInvoices.filter((inv) => {
      // Date Period
      if (!matchesPeriod(inv.date)) return false;

      // Entity
      if (entityFilter !== 'ALL') {
        const invEnt = String(inv.companyEntity || '').toLowerCase();
        const filtEnt = String(entityFilter || '').toLowerCase();
        if (!invEnt.includes(filtEnt) && !filtEnt.includes(invEnt)) return false;
      }

      // Party Type (B2B / B2C)
      if (partyTypeFilter === 'B2B' && !inv.isB2B) return false;
      if (partyTypeFilter === 'B2C' && inv.isB2B) return false;

      // Tax Rate Filter
      if (taxRateFilter !== 'ALL' && Math.round(inv.gstRate) !== Number(taxRateFilter)) return false;

      // Search Query
      if (query) {
        const match =
          inv.invoiceNo.toLowerCase().includes(query) ||
          inv.partyName.toLowerCase().includes(query) ||
          inv.gstin.toLowerCase().includes(query) ||
          (inv.tdsSection && inv.tdsSection.toLowerCase().includes(query));
        if (!match) return false;
      }

      return true;
    });
  }, [parsedInvoices, dateRange, entityFilter, partyTypeFilter, taxRateFilter, searchQuery]);

  const filteredPurchases = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return parsedPurchases.filter((pur) => {
      // Date Period
      if (!matchesPeriod(pur.date)) return false;

      // Entity
      if (entityFilter !== 'ALL') {
        const purEnt = String(pur.companyEntity || '').toLowerCase();
        const filtEnt = String(entityFilter || '').toLowerCase();
        if (!purEnt.includes(filtEnt) && !filtEnt.includes(purEnt)) return false;
      }

      // Party Type
      if (partyTypeFilter === 'B2B' && !pur.isB2B) return false;
      if (partyTypeFilter === 'B2C' && pur.isB2B) return false;

      // Tax Rate Filter
      if (taxRateFilter !== 'ALL' && Math.round(pur.gstRate) !== Number(taxRateFilter)) return false;

      // Search Query
      if (query) {
        const match =
          pur.purchaseNo.toLowerCase().includes(query) ||
          pur.billNo.toLowerCase().includes(query) ||
          pur.partyName.toLowerCase().includes(query) ||
          pur.gstin.toLowerCase().includes(query) ||
          (pur.tdsSection && pur.tdsSection.toLowerCase().includes(query));
        if (!match) return false;
      }

      return true;
    });
  }, [parsedPurchases, dateRange, entityFilter, partyTypeFilter, taxRateFilter, searchQuery]);

  // ── RECONCILIATION & AGGREGATE CALCULATIONS ─────────────────────────────────
  const aggregates = useMemo(() => {
    // 1. Outward Liability (Sales / Invoices)
    const outward = filteredInvoices.reduce(
      (acc, inv) => {
        acc.taxable += inv.taxable;
        acc.cgst += inv.cgst;
        acc.sgst += inv.sgst;
        acc.igst += inv.igst;
        acc.totalTax += inv.totalTax;
        acc.grandTotal += inv.grandTotal;
        acc.tdsReceivable += inv.tdsAmount;
        if (inv.isB2B) acc.b2bCount += 1;
        else acc.b2cCount += 1;
        return acc;
      },
      { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0, grandTotal: 0, tdsReceivable: 0, b2bCount: 0, b2cCount: 0 }
    );

    // 2. Inward Input Tax Credit (Purchases / ITC)
    const inward = filteredPurchases.reduce(
      (acc, pur) => {
        acc.taxable += pur.taxable;
        acc.cgst += pur.cgst;
        acc.sgst += pur.sgst;
        acc.igst += pur.igst;
        acc.totalTax += pur.totalTax;
        acc.grandTotal += pur.grandTotal;
        acc.tdsWithheld += pur.tdsAmount;
        if (pur.isB2B) acc.b2bCount += 1;
        else acc.b2cCount += 1;
        return acc;
      },
      { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0, grandTotal: 0, tdsWithheld: 0, b2bCount: 0, b2cCount: 0 }
    );

    // 3. Component Level Balances (Net = Output - Input)
    const cgstNet = outward.cgst - inward.cgst;
    const sgstNet = outward.sgst - inward.sgst;
    const igstNet = outward.igst - inward.igst;
    const totalGstNet = outward.totalTax - inward.totalTax;

    // Rule 88A Optimization preview:
    // IGST credit first offsets IGST liability, then CGST, then SGST.
    let remainingIgstCredit = Math.max(0, inward.igst - outward.igst);
    let netIgstPayable = Math.max(0, outward.igst - inward.igst);

    let netCgstPayable = Math.max(0, outward.cgst - inward.cgst);
    let remainingCgstCredit = Math.max(0, inward.cgst - outward.cgst);

    let netSgstPayable = Math.max(0, outward.sgst - inward.sgst);
    let remainingSgstCredit = Math.max(0, inward.sgst - outward.sgst);

    // Apply leftover IGST credit to CGST first, then SGST
    if (remainingIgstCredit > 0 && netCgstPayable > 0) {
      const offsetCgst = Math.min(remainingIgstCredit, netCgstPayable);
      netCgstPayable -= offsetCgst;
      remainingIgstCredit -= offsetCgst;
    }
    if (remainingIgstCredit > 0 && netSgstPayable > 0) {
      const offsetSgst = Math.min(remainingIgstCredit, netSgstPayable);
      netSgstPayable -= offsetSgst;
      remainingIgstCredit -= offsetSgst;
    }

    const netCashPayable = netIgstPayable + netCgstPayable + netSgstPayable;
    const netCreditCarryForward = remainingIgstCredit + remainingCgstCredit + remainingSgstCredit;

    return {
      outward,
      inward,
      cgstNet,
      sgstNet,
      igstNet,
      totalGstNet,
      netCashPayable,
      netCreditCarryForward,
      tdsNetCredit: outward.tdsReceivable - inward.tdsWithheld
    };
  }, [filteredInvoices, filteredPurchases]);

  // ── ALL TDS ENTRIES MERGED LEDGER ──────────────────────────────────────────
  const tdsLedger = useMemo(() => {
    const list = [];

    // From Invoices (TDS Deducted by Customers - Receivable Asset)
    filteredInvoices.forEach((inv) => {
      if (inv.tdsAmount > 0) {
        list.push({
          type: 'RECEIVABLE',
          source: 'INVOICE',
          docNo: inv.invoiceNo,
          docDate: inv.dateFormatted,
          rawDate: inv.date,
          partyName: inv.partyName,
          gstin: inv.gstin,
          section: inv.tdsSection || '194C',
          rate: inv.tdsRate,
          taxableAmount: inv.taxable,
          grossAmount: inv.grandTotal,
          tdsAmount: inv.tdsAmount,
          status: 'Your Tax Credit (Form 26AS)',
          itemRef: inv._raw
        });
      }
    });

    // From Purchases (TDS Withheld on Vendors - Payable Liability)
    filteredPurchases.forEach((pur) => {
      if (pur.tdsAmount > 0) {
        list.push({
          type: 'WITHHELD',
          source: 'PURCHASE',
          docNo: pur.purchaseNo + (pur.billNo !== '-' ? ` (${pur.billNo})` : ''),
          docDate: pur.dateFormatted,
          rawDate: pur.date,
          partyName: pur.partyName,
          gstin: pur.gstin,
          section: pur.tdsSection || '194Q',
          rate: pur.tdsRate,
          taxableAmount: pur.taxable,
          grossAmount: pur.grandTotal,
          tdsAmount: pur.tdsAmount,
          status: 'To Pay to Govt (Challan 281)',
          itemRef: pur._raw
        });
      }
    });

    // Sort by date descending
    return list.sort((a, b) => {
      const ta = a.rawDate ? a.rawDate.getTime() : 0;
      const tb = b.rawDate ? b.rawDate.getTime() : 0;
      return tb - ta;
    });
  }, [filteredInvoices, filteredPurchases]);

  // ── RATE-WISE TAX DISTRIBUTION ─────────────────────────────────────────────
  const rateWiseBreakdown = useMemo(() => {
    const rates = [0, 5, 12, 18, 28];
    return rates.map((r) => {
      const invForRate = filteredInvoices.filter((i) => Math.round(i.gstRate) === r);
      const purForRate = filteredPurchases.filter((p) => Math.round(p.gstRate) === r);

      const outTaxable = invForRate.reduce((s, i) => s + i.taxable, 0);
      const outTax = invForRate.reduce((s, i) => s + i.totalTax, 0);
      const inTaxable = purForRate.reduce((s, p) => s + p.taxable, 0);
      const inTax = purForRate.reduce((s, p) => s + p.totalTax, 0);

      return {
        rate: `${r}%`,
        outTaxable,
        outTax,
        inTaxable,
        inTax,
        netTax: outTax - inTax
      };
    });
  }, [filteredInvoices, filteredPurchases]);

  // ── EXCEL EXPORT FUNCTIONALITY ─────────────────────────────────────────────
  const handleExportExcel = (mode = 'comprehensive') => {
    try {
      setIsExporting(true);
      const wb = XLSX.utils.book_new();
      const periodLabel = dateRange.labelText.replace(/[^a-zA-Z0-9_-]/g, '_');

      // 1. Summary Sheet
      const summaryData = [
        [`${(companyEntity || 'Elite Digital Prints').toUpperCase()} — GST & TAX REPORT`],
        ['Company:', companyEntity || 'Elite Digital Prints'],
        ['Period:', dateRange.labelText],
        ['Generated On:', new Date().toLocaleString('en-IN')],
        [],
        ['1. GST SUMMARY'],
        ['Tax Type', 'Sales GST', 'Purchase GST Credit', 'Balance', 'Status'],
        [
          'Integrated Tax (IGST)',
          aggregates.outward.igst,
          aggregates.inward.igst,
          aggregates.igstNet,
          aggregates.igstNet > 0 ? 'Need to Pay' : 'Extra Credit'
        ],
        [
          'Central Tax (CGST)',
          aggregates.outward.cgst,
          aggregates.inward.cgst,
          aggregates.cgstNet,
          aggregates.cgstNet > 0 ? 'Need to Pay' : 'Extra Credit'
        ],
        [
          'State Tax (SGST)',
          aggregates.outward.sgst,
          aggregates.inward.sgst,
          aggregates.sgstNet,
          aggregates.sgstNet > 0 ? 'Need to Pay' : 'Extra Credit'
        ],
        [
          'TOTAL GST',
          aggregates.outward.totalTax,
          aggregates.inward.totalTax,
          aggregates.totalGstNet,
          aggregates.totalGstNet > 0 ? 'GST TO PAY' : 'EXTRA GST CREDIT'
        ],
        [],
        ['2. ESTIMATED GST CALCULATION'],
        ['Estimated GST to Pay to Govt:', aggregates.netCashPayable],
        ['Extra GST Credit Saved for Next Month:', aggregates.netCreditCarryForward],
        [],
        ['3. TDS SUMMARY'],
        ['TDS Cut by Customers (Your Credit):', aggregates.outward.tdsReceivable],
        ['TDS Cut from Vendors (To Pay to Govt):', aggregates.inward.tdsWithheld],
        ['Remaining TDS Balance:', aggregates.tdsNetCredit]
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'GST_Executive_Summary');

      // 2. Outward Invoices (GSTR-1 Format)
      if (mode === 'comprehensive' || mode === 'outward') {
        const outwardRows = filteredInvoices.map((inv) => ({
          'Invoice No': inv.invoiceNo,
          'Invoice Date': inv.dateFormatted,
          'Party Name': inv.partyName,
          'GSTIN / UIN': inv.gstin || 'Unregistered',
          'Party Type': inv.isB2B ? 'B2B (Regular)' : 'B2C (Consumer)',
          'Place of Supply': inv.state,
          'Tax Type': inv.isInterState ? 'IGST (Inter-State)' : 'CGST+SGST (Intra-State)',
          'Taxable Value (₹)': inv.taxable,
          'GST Rate (%)': `${inv.gstRate}%`,
          'CGST (₹)': inv.cgst,
          'SGST (₹)': inv.sgst,
          'IGST (₹)': inv.igst,
          'Total GST (₹)': inv.totalTax,
          'TDS Deducted (₹)': inv.tdsAmount,
          'TDS Section': inv.tdsSection || '-',
          'TDS Rate (%)': inv.tdsRate ? `${inv.tdsRate}%` : '-',
          'Invoice Total (₹)': inv.grandTotal,
          'Operating Entity': inv.companyEntity
        }));
        const wsOutward = XLSX.utils.json_to_sheet(outwardRows);
        XLSX.utils.book_append_sheet(wb, wsOutward, 'GSTR1_Outward_Sales');

        // GSTR-1 Table 12 HSN Summary Sheet
        const hsnMapForExport = {};
        filteredInvoices.forEach((inv) => {
          const rawItems = Array.isArray(inv._raw?.items) && inv._raw.items.length > 0
            ? inv._raw.items
            : [{ itemName: 'Textile Supply', hsnCode: '998821', qty: 0, unit: 'OTH', totalAmount: inv.taxable || 0, taxRate: inv.gstRate || 5 }];
          rawItems.forEach((it) => {
            const hsn = String(it.hsnCode || '998821').trim();
            const uqc = /meter|mtr/i.test(it.unit) ? 'MTR' : (hsn.startsWith('99') ? 'OTH' : 'MTR');
            const rate = Number(it.taxRate != null ? it.taxRate : 5);
            const key = `${hsn}_${uqc}_${rate}`;
            if (!hsnMapForExport[key]) {
              hsnMapForExport[key] = {
                'HSN': hsn,
                'Description': it.description || it.itemName || 'Textile Job Work / Supply',
                'UQC': uqc,
                'Total Quantity': 0,
                'Total Value': 0,
                'Taxable Value': 0,
                'Rate (%)': `${rate}%`,
                'Integrated Tax Amount': 0,
                'Central Tax Amount': 0,
                'State/UT Tax Amount': 0,
                'Cess Amount': 0
              };
            }
            const taxable = Number(it.totalAmount != null ? it.totalAmount : (Number(it.qty || 0) * Number(it.unitPrice || 0))) || 0;
            const isInter = inv.isInterState;
            const igst = isInter ? taxable * (rate / 100) : 0;
            const cgst = !isInter ? taxable * (rate / 2 / 100) : 0;
            const sgst = !isInter ? taxable * (rate / 2 / 100) : 0;
            const qty = hsn.startsWith('99') && uqc === 'OTH' ? 0 : Number(it.qty || 0);

            hsnMapForExport[key]['Total Quantity'] += qty;
            hsnMapForExport[key]['Taxable Value'] += taxable;
            hsnMapForExport[key]['Integrated Tax Amount'] += igst;
            hsnMapForExport[key]['Central Tax Amount'] += cgst;
            hsnMapForExport[key]['State/UT Tax Amount'] += sgst;
            hsnMapForExport[key]['Total Value'] += taxable + igst + cgst + sgst;
          });
        });
        const table12Rows = Object.values(hsnMapForExport).map((r) => ({
          ...r,
          'Total Quantity': Math.round(r['Total Quantity'] * 100) / 100,
          'Total Value': Math.round(r['Total Value'] * 100) / 100,
          'Taxable Value': Math.round(r['Taxable Value'] * 100) / 100,
          'Integrated Tax Amount': Math.round(r['Integrated Tax Amount'] * 100) / 100,
          'Central Tax Amount': Math.round(r['Central Tax Amount'] * 100) / 100,
          'State/UT Tax Amount': Math.round(r['State/UT Tax Amount'] * 100) / 100,
          'Cess Amount': 0
        }));
        if (table12Rows.length > 0) {
          const wsTable12 = XLSX.utils.json_to_sheet(table12Rows);
          XLSX.utils.book_append_sheet(wb, wsTable12, 'GSTR1_Table12_HSN');
        }
      }

      // 3. Inward Purchases (GSTR-2B / ITC Format)
      if (mode === 'comprehensive' || mode === 'inward') {
        const inwardRows = filteredPurchases.map((pur) => ({
          'Purchase No': pur.purchaseNo,
          'Vendor Bill No': pur.billNo,
          'Inward Date': pur.dateFormatted,
          'Vendor Name': pur.partyName,
          'Vendor GSTIN': pur.gstin || 'Unregistered',
          'Party Type': pur.isB2B ? 'B2B (Registered)' : 'B2C / Unregistered',
          'Origin State': pur.state,
          'Tax Type': pur.isInterState ? 'IGST (Inter-State)' : 'CGST+SGST (Intra-State)',
          'Taxable Value (₹)': pur.taxable,
          'GST Rate (%)': `${pur.gstRate}%`,
          'Input CGST (₹)': pur.cgst,
          'Input SGST (₹)': pur.sgst,
          'Input IGST (₹)': pur.igst,
          'Total Eligible ITC (₹)': pur.totalTax,
          'TDS Withheld (₹)': pur.tdsAmount,
          'TDS Section': pur.tdsSection || '-',
          'TDS Rate (%)': pur.tdsRate ? `${pur.tdsRate}%` : '-',
          'Total Bill Amount (₹)': pur.grandTotal,
          'Operating Entity': pur.companyEntity
        }));
        const wsInward = XLSX.utils.json_to_sheet(inwardRows);
        XLSX.utils.book_append_sheet(wb, wsInward, 'GSTR2B_Inward_ITC');
      }

      // 4. TDS Credit Ledger
      if (mode === 'comprehensive' || mode === 'tds') {
        const tdsRows = tdsLedger.map((t) => ({
          'Type': t.type === 'RECEIVABLE' ? 'TDS Cut by Customer' : 'TDS Cut from Vendor',
          'Doc Type': t.source,
          'Document Ref': t.docNo,
          'Document Date': t.docDate,
          'Party Name': t.partyName,
          'Party GSTIN': t.gstin || '-',
          'TDS Section': t.section,
          'TDS Rate (%)': `${t.rate}%`,
          'Amount (Without Tax) (₹)': t.taxableAmount,
          'Total Bill (₹)': t.grossAmount,
          'TDS Amount (₹)': t.tdsAmount,
          'Status': t.status
        }));
        const wsTds = XLSX.utils.json_to_sheet(tdsRows);
        XLSX.utils.book_append_sheet(wb, wsTds, 'TDS_Tax_Credit_Ledger');
      }

      const fileName = `GST_Tax_Report_${(companyEntity || 'Company').replace(/[^a-zA-Z0-9]/g, '_')}_${periodLabel}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error('Failed to export GST spreadsheet:', err);
      alert('Could not export spreadsheet. Please check browser permissions.');
    } finally {
      setIsExporting(false);
    }
  };

  // ── QUICK PRINT ────────────────────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '3rem' }}>
      
      {/* ── TOP CONTROL & FILTER HEADER BAR ─────────────────────────────────── */}
      <div
        style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-light, #e2e8f0)',
          borderRadius: '14px',
          padding: '1.2rem 1.4rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, #4f46e5, #3b82f6)',
                  color: '#ffffff',
                  borderRadius: '10px',
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(79, 70, 229, 0.25)'
                }}
              >
                <Calculator size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary, #0f172a)' }}>
                  GST Summary
                </h2>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', fontWeight: 500 }}>
                  Sales GST, Purchase GST Credit, and TDS Details
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {refreshData && (
              <button
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
                  cursor: 'pointer'
                }}
                title="Reload Latest Invoices & Purchases"
              >
                <RefreshCw size={14} /> Refresh
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
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
              title="Print Summary Report"
            >
              <Printer size={14} /> Print
            </button>

            <button
              type="button"
              disabled={isExporting}
              onClick={() => handleExportExcel('comprehensive')}
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
              title="Download Complete GST & TDS Excel File"
            >
              <FileSpreadsheet size={15} />
              {isExporting ? 'Exporting...' : 'Download Excel'}
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.85rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--border-light, #f1f5f9)'
          }}
        >
          {/* Period Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
              <Calendar size={15} color="#4f46e5" />
              <span>Period:</span>
            </div>
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

          {/* Active Company Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>Company:</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 12px',
                fontSize: '0.82rem',
                fontWeight: 800,
                borderRadius: '20px',
                background: 'rgba(79, 70, 229, 0.08)',
                color: '#4f46e5',
                border: '1.5px solid #c7d2fe'
              }}
            >
              🏢 {companyEntity || 'Elite Digital Prints'}
            </span>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 auto', maxWidth: '360px' }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by party, GSTIN, invoice #, section..."
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                fontSize: '0.8rem',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                outline: 'none',
                background: '#f8fafc',
                color: '#1e293b'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Chips Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.76rem', color: '#64748b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span>
              Period: <strong>{dateRange.labelText}</strong>
            </span>
            <span>•</span>
            <span>
              Sales Bills: <strong>{filteredInvoices.length}</strong> (of {parsedInvoices.length})
            </span>
            <span>•</span>
            <span>
              Purchase Bills: <strong>{filteredPurchases.length}</strong> (of {parsedPurchases.length})
            </span>
            <span>•</span>
            <span>
              TDS Entries: <strong>{tdsLedger.length}</strong>
            </span>
          </div>

          {/* Party Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontWeight: 600 }}>Type:</span>
            {[
              { id: 'ALL', label: 'All' },
              { id: 'B2B', label: 'With GST Number' },
              { id: 'B2C', label: 'Without GST Number' }
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPartyTypeFilter(p.id)}
                style={{
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: partyTypeFilter === p.id ? '1px solid #6366f1' : '1px solid #e2e8f0',
                  background: partyTypeFilter === p.id ? '#eef2ff' : '#ffffff',
                  color: partyTypeFilter === p.id ? '#4f46e5' : '#64748b',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 4 EXECUTIVE KPI CARDS: OUTWARD, ITC, NET POSITION & TDS CREDIT ────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem'
        }}
      >
        {/* Card 1: Outward GST Liability (Invoices / Sales) */}
        <div
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%)',
            border: '1.5px solid #ddd6fe',
            borderRadius: '14px',
            padding: '1.15rem 1.25rem',
            boxShadow: '0 4px 14px rgba(124, 58, 237, 0.06)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                SALES GST (TAX ON SALES)
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#4c1d95', marginTop: '0.2rem', fontVariantNumeric: 'tabular-nums' }}>
                {fmtINR(aggregates.outward.totalTax)}
              </div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowUpRight size={20} />
            </div>
          </div>

          <div style={{ fontSize: '0.78rem', color: '#6d28d9', marginTop: '0.5rem', fontWeight: 600 }}>
            Sales Amount (Without Tax): <strong>{fmtINR(aggregates.outward.taxable)}</strong>
          </div>

          <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#ffffff', borderRadius: '4px', border: '1px solid #ddd6fe', color: '#5b21b6', fontWeight: 700 }}>
              CGST: {fmtINR(aggregates.outward.cgst)}
            </span>
            <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#ffffff', borderRadius: '4px', border: '1px solid #ddd6fe', color: '#5b21b6', fontWeight: 700 }}>
              SGST: {fmtINR(aggregates.outward.sgst)}
            </span>
            <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#ffffff', borderRadius: '4px', border: '1px solid #ddd6fe', color: '#5b21b6', fontWeight: 700 }}>
              IGST: {fmtINR(aggregates.outward.igst)}
            </span>
          </div>

          <div style={{ fontSize: '0.72rem', color: '#7c3aed', opacity: 0.85, marginTop: '0.5rem' }}>
            From {filteredInvoices.length} sales bills ({aggregates.outward.b2bCount} with GST, {aggregates.outward.b2cCount} without GST)
          </div>
        </div>

        {/* Card 2: Inward Input Tax Credit (Purchases / ITC) */}
        <div
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%)',
            border: '1.5px solid #a7f3d0',
            borderRadius: '14px',
            padding: '1.15rem 1.25rem',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.06)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                PURCHASE GST CREDIT (ITC)
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#064e3b', marginTop: '0.2rem', fontVariantNumeric: 'tabular-nums' }}>
                {fmtINR(aggregates.inward.totalTax)}
              </div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#d1fae5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowDownLeft size={20} />
            </div>
          </div>

          <div style={{ fontSize: '0.78rem', color: '#047857', marginTop: '0.5rem', fontWeight: 600 }}>
            Purchase Amount (Without Tax): <strong>{fmtINR(aggregates.inward.taxable)}</strong>
          </div>

          <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#ffffff', borderRadius: '4px', border: '1px solid #a7f3d0', color: '#065f46', fontWeight: 700 }}>
              Input CGST: {fmtINR(aggregates.inward.cgst)}
            </span>
            <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#ffffff', borderRadius: '4px', border: '1px solid #a7f3d0', color: '#065f46', fontWeight: 700 }}>
              Input SGST: {fmtINR(aggregates.inward.sgst)}
            </span>
            <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#ffffff', borderRadius: '4px', border: '1px solid #a7f3d0', color: '#065f46', fontWeight: 700 }}>
              Input IGST: {fmtINR(aggregates.inward.igst)}
            </span>
          </div>

          <div style={{ fontSize: '0.72rem', color: '#059669', opacity: 0.85, marginTop: '0.5rem' }}>
            From {filteredPurchases.length} purchase bills
          </div>
        </div>

        {/* Card 3: Net GST Settlement Position (GSTR-3B) */}
        <div
          style={{
            background: aggregates.totalGstNet > 0
              ? 'linear-gradient(135deg, #ffffff 0%, #fff1f2 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
            border: `1.5px solid ${aggregates.totalGstNet > 0 ? '#fecdd3' : '#bbf7d0'}`,
            borderRadius: '14px',
            padding: '1.15rem 1.25rem',
            boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  color: aggregates.totalGstNet > 0 ? '#e11d48' : '#15803d',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                {aggregates.totalGstNet > 0 ? 'GST TO PAY TO GOVT' : 'EXTRA GST CREDIT (SAVED)'}
              </div>
              <div
                style={{
                  fontSize: '1.45rem',
                  fontWeight: 900,
                  color: aggregates.totalGstNet > 0 ? '#9f1239' : '#14532d',
                  marginTop: '0.2rem',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {fmtINR(Math.abs(aggregates.totalGstNet))}
              </div>
            </div>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: aggregates.totalGstNet > 0 ? '#ffe4e6' : '#dcfce7',
                color: aggregates.totalGstNet > 0 ? '#e11d48' : '#15803d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Scale size={20} />
            </div>
          </div>

          <div style={{ fontSize: '0.78rem', color: aggregates.totalGstNet > 0 ? '#be123c' : '#166534', marginTop: '0.5rem', fontWeight: 600 }}>
            {aggregates.totalGstNet > 0 ? (
              <span>⚠️ Sales GST is more than Purchase GST credit. You need to pay the remaining GST.</span>
            ) : (
              <span>✅ Purchase GST credit covers your Sales GST. Extra credit will be used next month.</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.7rem',
                padding: '2px 6px',
                background: '#ffffff',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                color: aggregates.cgstNet > 0 ? '#b91c1c' : '#15803d',
                fontWeight: 700
              }}
            >
              CGST: {aggregates.cgstNet > 0 ? `Pay ${fmtINR(aggregates.cgstNet)}` : `Credit ${fmtINR(Math.abs(aggregates.cgstNet))}`}
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                padding: '2px 6px',
                background: '#ffffff',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                color: aggregates.sgstNet > 0 ? '#b91c1c' : '#15803d',
                fontWeight: 700
              }}
            >
              SGST: {aggregates.sgstNet > 0 ? `Pay ${fmtINR(aggregates.sgstNet)}` : `Credit ${fmtINR(Math.abs(aggregates.sgstNet))}`}
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                padding: '2px 6px',
                background: '#ffffff',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                color: aggregates.igstNet > 0 ? '#b91c1c' : '#15803d',
                fontWeight: 700
              }}
            >
              IGST: {aggregates.igstNet > 0 ? `Pay ${fmtINR(aggregates.igstNet)}` : `Credit ${fmtINR(Math.abs(aggregates.igstNet))}`}
            </span>
          </div>

          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.5rem' }}>
            Monthly calculation for GSTR-3B
          </div>
        </div>

        {/* Card 4: TDS / TDC Tax Credit Ledger (Sec 194C / 194Q) */}
        <div
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)',
            border: '1.5px solid #bfdbfe',
            borderRadius: '14px',
            padding: '1.15rem 1.25rem',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.06)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                TDS SUMMARY (TAX CUT)
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#1e40af', marginTop: '0.2rem', fontVariantNumeric: 'tabular-nums' }}>
                {fmtINR(aggregates.outward.tdsReceivable)}
              </div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={20} />
            </div>
          </div>

          <div style={{ fontSize: '0.78rem', color: '#1d4ed8', marginTop: '0.5rem', fontWeight: 600 }}>
            TDS cut by customers: <strong>Your Credit with Govt (Form 26AS)</strong>
          </div>

          <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#ffffff', borderRadius: '4px', border: '1px solid #bfdbfe', color: '#1e40af', fontWeight: 700 }}>
              Cut by Customers: {fmtINR(aggregates.outward.tdsReceivable)}
            </span>
            <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#ffffff', borderRadius: '4px', border: '1px solid #bfdbfe', color: '#b45309', fontWeight: 700 }}>
              Cut from Vendors: {fmtINR(aggregates.inward.tdsWithheld)}
            </span>
          </div>

          <div style={{ fontSize: '0.72rem', color: '#2563eb', opacity: 0.85, marginTop: '0.5rem' }}>
            Jobwork (1-2%) & Goods (0.1%) TDS
          </div>
        </div>
      </div>

      {/* ── SUB-VIEW NAVIGATION TABS ────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          borderBottom: '2px solid #e2e8f0',
          paddingBottom: '2px',
          overflowX: 'auto'
        }}
      >
        {[
          { id: 'summary', label: '📊 GST Summary & Calculation', icon: Scale },
          ...(SHOW_TABLE_12_TAB ? [{ id: 'table12', label: '📑 Table 12: HSN Summary', icon: Layers }] : []),
          ...(SHOW_GTA_FREIGHT_RCM_TAB ? [{ id: 'gta_rcm', label: '🚚 Freight GTA RCM (Sec 9(3))', icon: Truck }] : []),
          { id: 'outward', label: `🧾 Sales Bills (${filteredInvoices.length})`, icon: ArrowUpRight },
          { id: 'inward', label: `📦 Purchase Bills (${filteredPurchases.length})`, icon: ArrowDownLeft },
          { id: 'tds', label: `💳 TDS List (${tdsLedger.length})`, icon: ShieldCheck }
        ].map((tab) => {
          const active = activeTab === tab.id;
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '8px 16px',
                fontSize: '0.85rem',
                fontWeight: active ? 800 : 600,
                color: active ? '#4f46e5' : '#64748b',
                background: active ? '#ffffff' : 'transparent',
                border: 'none',
                borderBottom: active ? '3px solid #4f46e5' : '3px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <TabIcon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW 1: RECONCILIATION & SETTLEMENT MATRIX (GSTR-3B STYLE)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* GST SET-OFF MATRIX TABLE */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1.25rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                  GST Calculation & Summary (GSTR-3B)
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Sales GST compared with Purchase GST credit (IGST, CGST, SGST)
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleExportExcel('comprehensive')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#059669',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                <FileSpreadsheet size={13} /> Download Summary
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 800 }}>Tax Type</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 800, color: '#7c3aed' }}>
                      (A) Sales GST (To Pay)
                    </th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 800, color: '#059669' }}>
                      (B) Purchase GST Credit (Got)
                    </th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 800, color: '#0284c7' }}>
                      Balance (A - B)
                    </th>
                    <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 800 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {/* IGST */}
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1e293b' }}>
                      Integrated Tax (IGST)
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Outside Gujarat Sales / Purchases</div>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#7c3aed', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtINR(aggregates.outward.igst)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtINR(aggregates.inward.igst)}
                    </td>
                    <td
                      style={{
                        padding: '10px 14px',
                        textAlign: 'right',
                        fontWeight: 800,
                        color: aggregates.igstNet > 0 ? '#dc2626' : '#16a34a',
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      {aggregates.igstNet > 0 ? `+ ${fmtINR(aggregates.igstNet)}` : `- ${fmtINR(Math.abs(aggregates.igstNet))}`}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background: aggregates.igstNet > 0 ? '#fef2f2' : '#ecfdf5',
                          color: aggregates.igstNet > 0 ? '#dc2626' : '#059669',
                          border: `1px solid ${aggregates.igstNet > 0 ? '#fecaca' : '#a7f3d0'}`
                        }}
                      >
                        {aggregates.igstNet > 0 ? 'Need to Pay' : 'Extra Credit'}
                      </span>
                    </td>
                  </tr>

                  {/* CGST */}
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1e293b' }}>
                      Central Tax (CGST)
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Inside Gujarat Central</div>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#7c3aed', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtINR(aggregates.outward.cgst)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtINR(aggregates.inward.cgst)}
                    </td>
                    <td
                      style={{
                        padding: '10px 14px',
                        textAlign: 'right',
                        fontWeight: 800,
                        color: aggregates.cgstNet > 0 ? '#dc2626' : '#16a34a',
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      {aggregates.cgstNet > 0 ? `+ ${fmtINR(aggregates.cgstNet)}` : `- ${fmtINR(Math.abs(aggregates.cgstNet))}`}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background: aggregates.cgstNet > 0 ? '#fef2f2' : '#ecfdf5',
                          color: aggregates.cgstNet > 0 ? '#dc2626' : '#059669',
                          border: `1px solid ${aggregates.cgstNet > 0 ? '#fecaca' : '#a7f3d0'}`
                        }}
                      >
                        {aggregates.cgstNet > 0 ? 'Need to Pay' : 'Extra Credit'}
                      </span>
                    </td>
                  </tr>

                  {/* SGST */}
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1e293b' }}>
                      State Tax (SGST)
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Inside Gujarat State</div>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#7c3aed', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtINR(aggregates.outward.sgst)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtINR(aggregates.inward.sgst)}
                    </td>
                    <td
                      style={{
                        padding: '10px 14px',
                        textAlign: 'right',
                        fontWeight: 800,
                        color: aggregates.sgstNet > 0 ? '#dc2626' : '#16a34a',
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      {aggregates.sgstNet > 0 ? `+ ${fmtINR(aggregates.sgstNet)}` : `- ${fmtINR(Math.abs(aggregates.sgstNet))}`}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background: aggregates.sgstNet > 0 ? '#fef2f2' : '#ecfdf5',
                          color: aggregates.sgstNet > 0 ? '#dc2626' : '#059669',
                          border: `1px solid ${aggregates.sgstNet > 0 ? '#fecaca' : '#a7f3d0'}`
                        }}
                      >
                        {aggregates.sgstNet > 0 ? 'Need to Pay' : 'Extra Credit'}
                      </span>
                    </td>
                  </tr>

                  {/* TOTAL ROW */}
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 900 }}>
                    <td style={{ padding: '12px 14px', color: '#0f172a', fontSize: '0.92rem' }}>
                      TOTAL GST
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: '#6d28d9', fontSize: '1rem', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtINR(aggregates.outward.totalTax)}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: '#047857', fontSize: '1rem', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtINR(aggregates.inward.totalTax)}
                    </td>
                    <td
                      style={{
                        padding: '12px 14px',
                        textAlign: 'right',
                        fontSize: '1.05rem',
                        color: aggregates.totalGstNet > 0 ? '#b91c1c' : '#15803d',
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      {aggregates.totalGstNet > 0 ? `+ ${fmtINR(aggregates.totalGstNet)}` : `- ${fmtINR(Math.abs(aggregates.totalGstNet))}`}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 900,
                          padding: '4px 10px',
                          borderRadius: '14px',
                          background: aggregates.totalGstNet > 0 ? '#ef4444' : '#10b981',
                          color: '#ffffff',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                        }}
                      >
                        {aggregates.totalGstNet > 0 ? 'NET GST TO PAY' : 'EXTRA CREDIT'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Rule 88A Optimization Notice Banner */}
            <div
              style={{
                marginTop: '1.25rem',
                background: 'rgba(79, 70, 229, 0.05)',
                border: '1px solid rgba(79, 70, 229, 0.2)',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}
            >
              <Scale size={20} color="#4f46e5" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.8rem', color: '#334155', lineHeight: 1.5 }}>
                <strong style={{ color: '#4f46e5' }}>💡 Simple Tip:</strong> IGST credit is used first, then CGST and SGST credit. 
                Based on your bills, estimated payment required to government is <strong>{fmtINR(aggregates.netCashPayable)}</strong>, and extra credit left for next month is <strong>{fmtINR(aggregates.netCreditCarryForward)}</strong>.
              </div>
            </div>
          </div>

          {/* TWO-COLUMN DETAILS: RATE BREAKDOWN & COMPLIANCE SUMMARY */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
            
            {/* Rate-Wise Tax Distribution */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '1.25rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.2rem' }}>
                GST Rate Wise Total
              </h3>
              <div style={{ fontSize: '0.76rem', color: '#64748b', marginBottom: '0.85rem' }}>
                Total amounts separated by GST rates (0%, 5%, 12%, 18%, 28%)
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 700 }}>Rate</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: '#7c3aed' }}>Sales Amount</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: '#7c3aed' }}>Sales GST</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: '#059669' }}>Purchase Amount</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: '#059669' }}>Purchase GST</th>
                  </tr>
                </thead>
                <tbody>
                  {rateWiseBreakdown.map((r) => (
                    <tr key={r.rate} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '7px 8px', fontWeight: 800, color: '#1e293b' }}>{r.rate}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtINR(r.outTaxable)}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: '#7c3aed', fontVariantNumeric: 'tabular-nums' }}>{fmtINR(r.outTax)}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtINR(r.inTaxable)}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>{fmtINR(r.inTax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* TDS Summary & Statutory Due Dates */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '1.25rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.2rem' }}>
                  TDS & Monthly Filing Dates
                </h3>
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  TDS details and important monthly government dates
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase' }}>TDS CUT BY CUSTOMERS</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#14532d', marginTop: '0.2rem', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtINR(aggregates.outward.tdsReceivable)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#166534', marginTop: '0.3rem' }}>
                    Your tax credit with govt (Form 26AS)
                  </div>
                </div>

                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>TDS CUT FROM VENDORS</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#78350f', marginTop: '0.2rem', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtINR(aggregates.inward.tdsWithheld)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#92400e', marginTop: '0.3rem' }}>
                    TDS to pay to govt by 7th of next month
                  </div>
                </div>
              </div>

              {/* Statutory Calendar Dates */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  📅 Important Monthly Dates
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.76rem', color: '#334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>GSTR-1 (Sales bills):</span>
                    <strong>By 11th of every month</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>GSTR-2B (Purchase credit):</span>
                    <strong>By 14th of every month</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>GSTR-3B (Pay GST & file return):</span>
                    <strong style={{ color: '#4f46e5' }}>By 20th of every month</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Pay TDS to Govt (Challan 281):</span>
                    <strong style={{ color: '#d97706' }}>By 7th of every month</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── TABLE 12: HSN/SAC SUMMARY EXPANDABLE SECTION (GSTR-1 COMPLIANCE) ── */}
          {SHOW_TABLE_12_TAB && (
            <Gstr1Table12Panel
              invoices={invoices}
              companyEntity={companyEntity}
              companyGstin="24AANFE0044M1ZG"
              refreshData={refreshData}
              isExpandable={true}
              defaultExpanded={false}
              onViewInvoice={onViewInvoice}
            />
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW: TABLE 12: HSN/SAC SUMMARY (GSTR-1 COMPLIANT DEDICATED FULL TAB)
      ══════════════════════════════════════════════════════════════════════ */}
      {SHOW_TABLE_12_TAB && activeTab === 'table12' && (
        <Gstr1Table12Panel
          invoices={invoices}
          companyEntity={companyEntity}
          companyGstin="24AANFE0044M1ZG"
          refreshData={refreshData}
          isExpandable={false}
          defaultExpanded={true}
          onViewInvoice={onViewInvoice}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW: GTA FREIGHT REVERSE CHARGE (RCM) TRACKER (SEC 9(3) & 31(3)(f))
      ══════════════════════════════════════════════════════════════════════ */}
      {SHOW_GTA_FREIGHT_RCM_TAB && activeTab === 'gta_rcm' && (
        <GtaFreightRcmPanel
          companyEntity={companyEntity}
          companyGstin="24AANFE0044M1ZG"
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW 2: OUTWARD SALES REGISTER (INVOICES / GSTR-1)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'outward' && (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '1.25rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                Sales Bills List (Invoices & Sales GST)
              </h3>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                All sales bills in this period with GST and TDS cut by customers
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => handleExportExcel('outward')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#7c3aed',
                  background: '#f5f3ff',
                  border: '1px solid #ddd6fe',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                <FileSpreadsheet size={13} /> Download Sales GST (Excel)
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ textAlign: 'left', padding: '9px 10px', fontWeight: 800 }}>Bill #</th>
                  <th style={{ textAlign: 'left', padding: '9px 10px', fontWeight: 800 }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '9px 10px', fontWeight: 800 }}>Customer Name</th>
                  <th style={{ textAlign: 'left', padding: '9px 10px', fontWeight: 800 }}>GST Number</th>
                  <th style={{ textAlign: 'right', padding: '9px 10px', fontWeight: 800 }}>Bill Amount (Without Tax) (₹)</th>
                  <th style={{ textAlign: 'center', padding: '9px 10px', fontWeight: 800 }}>GST %</th>
                  <th style={{ textAlign: 'right', padding: '9px 10px', fontWeight: 800, color: '#7c3aed' }}>CGST (₹)</th>
                  <th style={{ textAlign: 'right', padding: '9px 10px', fontWeight: 800, color: '#7c3aed' }}>SGST (₹)</th>
                  <th style={{ textAlign: 'right', padding: '9px 10px', fontWeight: 800, color: '#7c3aed' }}>IGST (₹)</th>
                  <th style={{ textAlign: 'right', padding: '9px 10px', fontWeight: 800, color: '#6d28d9' }}>Total GST (₹)</th>
                  <th style={{ textAlign: 'right', padding: '9px 10px', fontWeight: 800, color: '#2563eb' }}>TDS Cut (₹)</th>
                  <th style={{ textAlign: 'right', padding: '9px 10px', fontWeight: 800 }}>Total Bill Amount (₹)</th>
                  <th style={{ textAlign: 'center', padding: '9px 10px', fontWeight: 800 }}>View</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                      No sales bills found for this period.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '8px 10px', fontWeight: 800, color: '#4f46e5' }}>
                        {inv.invoiceNo}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>
                        {inv.dateFormatted}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#1e293b' }}>
                        {inv.partyName}
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{inv.state}</div>
                      </td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: '0.74rem' }}>
                        {inv.gstin ? (
                          <span style={{ color: '#0f172a', fontWeight: 600 }}>{inv.gstin}</span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unregistered (B2C)</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtNum(inv.taxable)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.72rem', padding: '2px 6px', background: '#eef2ff', color: '#4f46e5', borderRadius: '4px', fontWeight: 700 }}>
                          {inv.gstRate}%
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#7c3aed', fontVariantNumeric: 'tabular-nums' }}>
                        {inv.cgst > 0 ? fmtNum(inv.cgst) : '-'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#7c3aed', fontVariantNumeric: 'tabular-nums' }}>
                        {inv.sgst > 0 ? fmtNum(inv.sgst) : '-'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#7c3aed', fontVariantNumeric: 'tabular-nums' }}>
                        {inv.igst > 0 ? fmtNum(inv.igst) : '-'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#6d28d9', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtNum(inv.totalTax)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {inv.tdsAmount > 0 ? (
                          <div>
                            <span style={{ color: '#2563eb', fontWeight: 800 }}>- {fmtNum(inv.tdsAmount)}</span>
                            <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{inv.tdsSection} @ {inv.tdsRate}%</div>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtNum(inv.grandTotal)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        {onViewInvoice && (
                          <button
                            type="button"
                            onClick={() => onViewInvoice(inv._raw)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#4f46e5',
                              background: '#f5f3ff',
                              border: '1px solid #ddd6fe',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                            title="View Full Invoice Details"
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW 3: INWARD PURCHASE REGISTER (PURCHASES / GSTR-2B)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'inward' && (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '1.25rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                Purchase Bills List (Purchases & GST Credit)
              </h3>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                All purchase bills from vendors with GST credit and TDS
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => handleExportExcel('inward')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#059669',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                <FileSpreadsheet size={13} /> Download Purchase GST (Excel)
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ textAlign: 'left', padding: '9px 10px', fontWeight: 800 }}>Purchase # / Bill #</th>
                  <th style={{ textAlign: 'left', padding: '9px 10px', fontWeight: 800 }}>Bill Date</th>
                  <th style={{ textAlign: 'left', padding: '9px 10px', fontWeight: 800 }}>Supplier / Vendor</th>
                  <th style={{ textAlign: 'left', padding: '9px 10px', fontWeight: 800 }}>Vendor GST Number</th>
                  <th style={{ textAlign: 'right', padding: '9px 10px', fontWeight: 800 }}>Purchase Amount (Without Tax) (₹)</th>
                  <th style={{ textAlign: 'center', padding: '9px 10px', fontWeight: 800 }}>GST %</th>
                  <th style={{ textAlign: 'right', padding: '9px 10px', fontWeight: 800, color: '#059669' }}>CGST Credit (₹)</th>
                  <th style={{ textAlign: 'right', padding: '9px 10px', fontWeight: 800, color: '#059669' }}>SGST Credit (₹)</th>
                  <th style={{ textAlign: 'right', padding: '9px 10px', fontWeight: 800, color: '#059669' }}>IGST Credit (₹)</th>
                  <th style={{ textAlign: 'right', padding: '9px 10px', fontWeight: 800, color: '#047857' }}>Total GST Credit (₹)</th>
                  <th style={{ textAlign: 'right', padding: '9px 10px', fontWeight: 800, color: '#b45309' }}>TDS Cut (₹)</th>
                  <th style={{ textAlign: 'right', padding: '9px 10px', fontWeight: 800 }}>Total Bill Amount (₹)</th>
                  <th style={{ textAlign: 'center', padding: '9px 10px', fontWeight: 800 }}>View</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                      No purchase bills found for this period.
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map((pur) => (
                    <tr
                      key={pur.id}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '8px 10px', fontWeight: 800, color: '#0284c7' }}>
                        {pur.purchaseNo}
                        {pur.billNo !== '-' && (
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Bill: {pur.billNo}</div>
                        )}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>
                        {pur.dateFormatted}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#1e293b' }}>
                        {pur.partyName}
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{pur.state}</div>
                      </td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: '0.74rem' }}>
                        {pur.gstin ? (
                          <span style={{ color: '#0f172a', fontWeight: 600 }}>{pur.gstin}</span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unregistered</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtNum(pur.taxable)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.72rem', padding: '2px 6px', background: '#ecfdf5', color: '#059669', borderRadius: '4px', fontWeight: 700 }}>
                          {pur.gstRate}%
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                        {pur.cgst > 0 ? fmtNum(pur.cgst) : '-'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                        {pur.sgst > 0 ? fmtNum(pur.sgst) : '-'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                        {pur.igst > 0 ? fmtNum(pur.igst) : '-'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#047857', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtNum(pur.totalTax)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {pur.tdsAmount > 0 ? (
                          <div>
                            <span style={{ color: '#b45309', fontWeight: 800 }}>- {fmtNum(pur.tdsAmount)}</span>
                            <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{pur.tdsSection}</div>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtNum(pur.grandTotal)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        {onViewPurchase && (
                          <button
                            type="button"
                            onClick={() => onViewPurchase(pur._raw)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#0284c7',
                              background: '#f0f9ff',
                              border: '1px solid #bae6fd',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                            title="View Purchase Bill"
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW 4: TDS / TDC CREDIT & WITHHOLDING REGISTER
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'tds' && (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '1.25rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                TDS List (Tax Cut Details)
              </h3>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                TDS cut by customers (credit for you) and TDS cut from vendor payments (to pay to govt)
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => handleExportExcel('tds')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#2563eb',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                <FileSpreadsheet size={13} /> Download TDS List (Excel)
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ textAlign: 'left', padding: '9px 10px', fontWeight: 800 }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '9px 10px', fontWeight: 800 }}>Bill / Ref #</th>
                  <th style={{ textAlign: 'left', padding: '9px 10px', fontWeight: 800 }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '9px 10px', fontWeight: 800 }}>Party Name</th>
                  <th style={{ textAlign: 'left', padding: '9px 10px', fontWeight: 800 }}>GST / PAN Number</th>
                  <th style={{ textAlign: 'center', padding: '9px 10px', fontWeight: 800 }}>TDS Section</th>
                  <th style={{ textAlign: 'center', padding: '9px 10px', fontWeight: 800 }}>TDS %</th>
                  <th style={{ textAlign: 'right', padding: '9px 10px', fontWeight: 800 }}>Amount (Without Tax) (₹)</th>
                  <th style={{ textAlign: 'right', padding: '9px 10px', fontWeight: 800 }}>Total Bill (₹)</th>
                  <th style={{ textAlign: 'right', padding: '9px 10px', fontWeight: 800, color: '#2563eb' }}>TDS Amount (₹)</th>
                  <th style={{ textAlign: 'center', padding: '9px 10px', fontWeight: 800 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {tdsLedger.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                      No TDS entries found for this period.
                    </td>
                  </tr>
                ) : (
                  tdsLedger.map((t, idx) => (
                    <tr
                      key={idx}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '8px 10px' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: t.type === 'RECEIVABLE' ? '#eff6ff' : '#fffbeb',
                            color: t.type === 'RECEIVABLE' ? '#1e40af' : '#b45309',
                            border: `1px solid ${t.type === 'RECEIVABLE' ? '#bfdbfe' : '#fde68a'}`
                          }}
                        >
                          {t.type === 'RECEIVABLE' ? '📥 Cut by Customer' : '📤 Cut from Vendor'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 800, color: '#4f46e5' }}>
                        {t.docNo}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>
                        {t.docDate}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#1e293b' }}>
                        {t.partyName}
                      </td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: '0.74rem' }}>
                        {t.gstin || '-'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.72rem', padding: '2px 6px', background: '#f1f5f9', color: '#334155', borderRadius: '4px', fontWeight: 800 }}>
                          {t.section}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>
                        {t.rate ? `${t.rate}%` : '-'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtNum(t.taxableAmount)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtNum(t.grossAmount)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, color: t.type === 'RECEIVABLE' ? '#2563eb' : '#d97706', fontVariantNumeric: 'tabular-nums', fontSize: '0.88rem' }}>
                        {fmtINR(t.tdsAmount)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: t.type === 'RECEIVABLE' ? '#166534' : '#92400e', fontWeight: 600 }}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
