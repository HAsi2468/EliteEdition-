import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  PlusCircle,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  FileText,
  Download,
  Trash2,
  Eye,
  Sliders,
  Sparkles,
  PackageCheck,
  Building,
  Check,
  X,
  FileSpreadsheet,
  QrCode,
  Tag,
  Scissors,
  Printer,
  ChevronRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { triggerEliteAlert, triggerEliteConfirm } from '../services/dialogService';

const STORAGE_KEY = 'yamunaji_rfd_lots_data';
const LEDGER_STORAGE_KEY = 'yamunaji_rfd_ledger_data';

// Initial Seed Data for Yamunaji RFD Lots
const SEED_LOTS = [
  {
    id: 'YJ-RFD-2026-001',
    lotNumber: 'YJ-RFD-2026-001',
    inwardDate: '2026-10-22',
    millParty: 'Shree Radhe Bleaching & Dyeing',
    challanNo: 'CH-SR-8842',
    fabricQuality: 'Pure Viscose Rayon 14kg',
    panna: '44"',
    gsm: 140,
    totalRolls: 24,
    totalMeters: 2400,
    issuedMeters: 1200,
    ratePerMeter: 68.5,
    qualityGrade: 'A Grade',
    status: 'Partially Issued', // In Stock, Partially Issued, Depleted
    rackLocation: 'Rack YJ-A1',
    remarks: 'Ready for digital sublimation discharge. 0% shrinkage verified.',
    rolls: [
      { rollNo: 'R-01', meters: 100, status: 'Issued', issueTo: 'EDP Job Card #1102' },
      { rollNo: 'R-02', meters: 100, status: 'Issued', issueTo: 'EDP Job Card #1102' },
      { rollNo: 'R-03', meters: 100, status: 'Issued', issueTo: 'EDP Job Card #1102' },
      { rollNo: 'R-04', meters: 100, status: 'Issued', issueTo: 'EDP Job Card #1102' },
      { rollNo: 'R-05', meters: 100, status: 'Issued', issueTo: 'EDP Job Card #1108' },
      { rollNo: 'R-06', meters: 100, status: 'Issued', issueTo: 'EDP Job Card #1108' },
      { rollNo: 'R-07', meters: 100, status: 'Issued', issueTo: 'EDP Job Card #1108' },
      { rollNo: 'R-08', meters: 100, status: 'Issued', issueTo: 'EDP Job Card #1108' },
      { rollNo: 'R-09', meters: 100, status: 'Issued', issueTo: 'EDP Job Card #1114' },
      { rollNo: 'R-10', meters: 100, status: 'Issued', issueTo: 'EDP Job Card #1114' },
      { rollNo: 'R-11', meters: 100, status: 'Issued', issueTo: 'EDP Job Card #1114' },
      { rollNo: 'R-12', meters: 100, status: 'Issued', issueTo: 'EDP Job Card #1114' },
      { rollNo: 'R-13', meters: 100, status: 'In Stock', issueTo: null },
      { rollNo: 'R-14', meters: 100, status: 'In Stock', issueTo: null },
      { rollNo: 'R-15', meters: 100, status: 'In Stock', issueTo: null },
      { rollNo: 'R-16', meters: 100, status: 'In Stock', issueTo: null },
      { rollNo: 'R-17', meters: 100, status: 'In Stock', issueTo: null },
      { rollNo: 'R-18', meters: 100, status: 'In Stock', issueTo: null },
      { rollNo: 'R-19', meters: 100, status: 'In Stock', issueTo: null },
      { rollNo: 'R-20', meters: 100, status: 'In Stock', issueTo: null },
      { rollNo: 'R-21', meters: 100, status: 'In Stock', issueTo: null },
      { rollNo: 'R-22', meters: 100, status: 'In Stock', issueTo: null },
      { rollNo: 'R-23', meters: 100, status: 'In Stock', issueTo: null },
      { rollNo: 'R-24', meters: 100, status: 'In Stock', issueTo: null }
    ]
  },
  {
    id: 'YJ-RFD-2026-002',
    lotNumber: 'YJ-RFD-2026-002',
    inwardDate: '2026-10-24',
    millParty: 'Vrundavan Mills Pvt Ltd',
    challanNo: 'VRUN-CH-4410',
    fabricQuality: 'Pure Modal Satin 60s',
    panna: '44"',
    gsm: 125,
    totalRolls: 30,
    totalMeters: 3000,
    issuedMeters: 800,
    ratePerMeter: 124.0,
    qualityGrade: 'A Grade',
    status: 'Partially Issued',
    rackLocation: 'Rack YJ-B2',
    remarks: 'Premium satin gloss finish. High tensile strength, zero defect certified.',
    rolls: Array.from({ length: 30 }, (_, i) => ({
      rollNo: `R-${String(i + 1).padStart(2, '0')}`,
      meters: 100,
      status: i < 8 ? 'Issued' : 'In Stock',
      issueTo: i < 8 ? 'Digital Print Job Card #1120' : null
    }))
  },
  {
    id: 'YJ-RFD-2026-003',
    lotNumber: 'YJ-RFD-2026-003',
    inwardDate: '2026-10-25',
    millParty: 'Ganesh Textile Processors',
    challanNo: 'GTP-9921',
    fabricQuality: 'Cotton 60x60 Cambric',
    panna: '58"',
    gsm: 90,
    totalRolls: 40,
    totalMeters: 4000,
    issuedMeters: 0,
    ratePerMeter: 54.0,
    qualityGrade: 'A Grade',
    status: 'In Stock',
    rackLocation: 'Rack YJ-A3',
    remarks: 'High absorbency RFD cambric for reactive printing. 58-inch wide panna.',
    rolls: Array.from({ length: 40 }, (_, i) => ({
      rollNo: `R-${String(i + 1).padStart(2, '0')}`,
      meters: 100,
      status: 'In Stock',
      issueTo: null
    }))
  },
  {
    id: 'YJ-RFD-2026-004',
    lotNumber: 'YJ-RFD-2026-004',
    inwardDate: '2026-10-26',
    millParty: 'Shree Ambika Processing Mill',
    challanNo: 'AMB-1029',
    fabricQuality: 'Organza Viscose Gold Weave',
    panna: '44"',
    gsm: 65,
    totalRolls: 20,
    totalMeters: 2000,
    issuedMeters: 0,
    ratePerMeter: 92.0,
    qualityGrade: 'A Grade',
    status: 'In Stock',
    rackLocation: 'Rack YJ-C1',
    remarks: 'Fresh inward today. Inspected on rolling machine.',
    rolls: Array.from({ length: 20 }, (_, i) => ({
      rollNo: `R-${String(i + 1).padStart(2, '0')}`,
      meters: 100,
      status: 'In Stock',
      issueTo: null
    }))
  },
  {
    id: 'YJ-RFD-2026-005',
    lotNumber: 'YJ-RFD-2026-005',
    inwardDate: '2026-10-18',
    millParty: 'Bhagwati Textile Mills',
    challanNo: 'BGW-4512',
    fabricQuality: 'Chanderi Silk 50gm',
    panna: '44"',
    gsm: 75,
    totalRolls: 15,
    totalMeters: 1500,
    issuedMeters: 1500,
    ratePerMeter: 86.0,
    qualityGrade: 'A Grade',
    status: 'Depleted',
    rackLocation: 'Rack YJ-C2',
    remarks: 'All 15 rolls fully issued to EDP printing lines.',
    rolls: Array.from({ length: 15 }, (_, i) => ({
      rollNo: `R-${String(i + 1).padStart(2, '0')}`,
      meters: 100,
      status: 'Issued',
      issueTo: 'Job Card #1098'
    }))
  }
];

const SEED_LEDGER = [
  {
    id: 'TX-01',
    date: '2026-10-26 11:30 AM',
    lotNumber: 'YJ-RFD-2026-004',
    type: 'INWARD',
    fabricQuality: 'Organza Viscose Gold Weave',
    meters: 2000,
    rolls: 20,
    party: 'Shree Ambika Processing Mill',
    reference: 'Challan #AMB-1029',
    user: 'Harshit Sidapara',
    notes: 'Inward gate inspection passed 100%'
  },
  {
    id: 'TX-02',
    date: '2026-10-25 04:15 PM',
    lotNumber: 'YJ-RFD-2026-002',
    type: 'ISSUED',
    fabricQuality: 'Pure Modal Satin 60s',
    meters: 800,
    rolls: 8,
    party: 'Digital Print Floor (EDP)',
    reference: 'Job Card #1120',
    user: 'Store Manager',
    notes: 'Issued 8 rolls for designer kurti printing run'
  },
  {
    id: 'TX-03',
    date: '2026-10-25 10:00 AM',
    lotNumber: 'YJ-RFD-2026-003',
    type: 'INWARD',
    fabricQuality: 'Cotton 60x60 Cambric',
    meters: 4000,
    rolls: 40,
    party: 'Ganesh Textile Processors',
    reference: 'Challan #GTP-9921',
    user: 'Store Manager',
    notes: 'Bulk RFD lot received for summer collection'
  },
  {
    id: 'TX-04',
    date: '2026-10-23 03:00 PM',
    lotNumber: 'YJ-RFD-2026-001',
    type: 'ISSUED',
    fabricQuality: 'Pure Viscose Rayon 14kg',
    meters: 1200,
    rolls: 12,
    party: 'Digital Print Floor (EDP)',
    reference: 'Job Cards #1102, #1108, #1114',
    user: 'Harshit Sidapara',
    notes: 'Issued 12 rolls for saree print order'
  }
];

export default function YamunajiRfdPanel({ companyEntity = 'Yamunaji', onNavigate }) {
  // State
  const [activeTab, setActiveTab] = useState('inventory'); // inventory, inward, issuance, inspection, ledger
  const [lots, setLots] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed reading RFD lots from storage:', e);
    }
    return SEED_LOTS;
  });

  const [ledger, setLedger] = useState(() => {
    try {
      const saved = localStorage.getItem(LEDGER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed reading RFD ledger from storage:', e);
    }
    return SEED_LEDGER;
  });

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [qualityFilter, setQualityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [showInwardModal, setShowInwardModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedLotForRolls, setSelectedLotForRolls] = useState(null);
  const [selectedLotForIssue, setSelectedLotForIssue] = useState(null);

  // Form State for Inward
  const [inwardForm, setInwardForm] = useState({
    lotNumber: '',
    inwardDate: new Date().toISOString().split('T')[0],
    millParty: '',
    challanNo: '',
    fabricQuality: 'Pure Viscose Rayon 14kg',
    panna: '44"',
    gsm: 140,
    totalRolls: 20,
    totalMeters: 2000,
    ratePerMeter: 65,
    qualityGrade: 'A Grade',
    rackLocation: 'Rack YJ-A1',
    remarks: ''
  });

  // Form State for Issuance
  const [issueForm, setIssueForm] = useState({
    lotId: '',
    issuedMeters: 200,
    issuedRolls: 2,
    issueTo: 'EDP Digital Print Job Card',
    referenceDoc: '',
    operatorName: 'Store Operator',
    notes: ''
  });

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lots));
    } catch (e) {
      console.error('Error saving lots to localStorage:', e);
    }
  }, [lots]);

  useEffect(() => {
    try {
      localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(ledger));
    } catch (e) {
      console.error('Error saving ledger to localStorage:', e);
    }
  }, [ledger]);

  // Aggregate Stats
  const stats = useMemo(() => {
    let totalInStockMeters = 0;
    let totalInStockRolls = 0;
    let totalIssuedMeters = 0;
    let totalValuation = 0;
    let activeLotsCount = 0;

    lots.forEach(lot => {
      const balance = Math.max(0, (lot.totalMeters || 0) - (lot.issuedMeters || 0));
      totalInStockMeters += balance;
      totalIssuedMeters += (lot.issuedMeters || 0);
      totalValuation += balance * (lot.ratePerMeter || 0);

      const inStockRolls = (lot.rolls || []).filter(r => r.status === 'In Stock').length;
      totalInStockRolls += inStockRolls > 0 ? inStockRolls : Math.round(balance / 100);

      if (lot.status !== 'Depleted') activeLotsCount++;
    });

    return {
      totalInStockMeters,
      totalInStockRolls,
      totalIssuedMeters,
      totalValuation,
      activeLotsCount,
      totalLots: lots.length
    };
  }, [lots]);

  // Filtered Lots
  const filteredLots = useMemo(() => {
    return lots.filter(lot => {
      if (qualityFilter !== 'ALL' && lot.fabricQuality !== qualityFilter) return false;
      if (statusFilter !== 'ALL' && lot.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchLot = (lot.lotNumber || '').toLowerCase().includes(q);
        const matchMill = (lot.millParty || '').toLowerCase().includes(q);
        const matchChallan = (lot.challanNo || '').toLowerCase().includes(q);
        const matchQuality = (lot.fabricQuality || '').toLowerCase().includes(q);
        const matchRack = (lot.rackLocation || '').toLowerCase().includes(q);
        return matchLot || matchMill || matchChallan || matchQuality || matchRack;
      }
      return true;
    });
  }, [lots, qualityFilter, statusFilter, searchQuery]);

  // Unique Qualities for Filter
  const availableQualities = useMemo(() => {
    const set = new Set();
    lots.forEach(l => { if (l.fabricQuality) set.add(l.fabricQuality); });
    return Array.from(set);
  }, [lots]);

  // Handle Inward Submission
  const handleCreateInwardLot = (e) => {
    e.preventDefault();
    if (!inwardForm.millParty.trim()) {
      triggerEliteAlert('Please enter the Mill / Processing Party name.', 'Missing Party');
      return;
    }
    const totalMeters = Number(inwardForm.totalMeters) || 0;
    const totalRolls = Number(inwardForm.totalRolls) || 1;
    if (totalMeters <= 0) {
      triggerEliteAlert('Total meters must be greater than zero.', 'Invalid Meters');
      return;
    }

    const nextId = `YJ-RFD-2026-${String(lots.length + 1).padStart(3, '0')}`;
    const lotNumber = inwardForm.lotNumber.trim() || nextId;

    // Generate individual rolls
    const avgRollMeters = Math.round(totalMeters / totalRolls);
    const rollsList = Array.from({ length: totalRolls }, (_, i) => ({
      rollNo: `R-${String(i + 1).padStart(2, '0')}`,
      meters: avgRollMeters,
      status: 'In Stock',
      issueTo: null
    }));

    const newLot = {
      id: nextId,
      lotNumber,
      inwardDate: inwardForm.inwardDate,
      millParty: inwardForm.millParty.trim(),
      challanNo: inwardForm.challanNo.trim() || 'Direct Inward',
      fabricQuality: inwardForm.fabricQuality,
      panna: inwardForm.panna,
      gsm: Number(inwardForm.gsm) || 120,
      totalRolls,
      totalMeters,
      issuedMeters: 0,
      ratePerMeter: Number(inwardForm.ratePerMeter) || 0,
      qualityGrade: inwardForm.qualityGrade,
      status: 'In Stock',
      rackLocation: inwardForm.rackLocation.trim() || 'Floor Bay YJ',
      remarks: inwardForm.remarks.trim(),
      rolls: rollsList
    };

    const newLedgerEntry = {
      id: `TX-${Date.now()}`,
      date: new Date().toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      lotNumber,
      type: 'INWARD',
      fabricQuality: newLot.fabricQuality,
      meters: totalMeters,
      rolls: totalRolls,
      party: newLot.millParty,
      reference: `Challan #${newLot.challanNo}`,
      user: 'Yamunaji Operations',
      notes: newLot.remarks || 'Standard RFD Batch Inward'
    };

    setLots(prev => [newLot, ...prev]);
    setLedger(prev => [newLedgerEntry, ...prev]);
    setShowInwardModal(false);

    // Reset Form
    setInwardForm({
      lotNumber: '',
      inwardDate: new Date().toISOString().split('T')[0],
      millParty: '',
      challanNo: '',
      fabricQuality: 'Pure Viscose Rayon 14kg',
      panna: '44"',
      gsm: 140,
      totalRolls: 20,
      totalMeters: 2000,
      ratePerMeter: 65,
      qualityGrade: 'A Grade',
      rackLocation: 'Rack YJ-A1',
      remarks: ''
    });

    triggerEliteAlert(`RFD Lot ${lotNumber} (${totalMeters} Meters) successfully added to Yamunaji Stock!`, 'Inward Successful');
  };

  // Open Issue Modal for a Lot
  const handleOpenIssueModal = (lot) => {
    setSelectedLotForIssue(lot);
    const balanceMtrs = Math.max(0, lot.totalMeters - lot.issuedMeters);
    setIssueForm({
      lotId: lot.id,
      issuedMeters: Math.min(200, balanceMtrs),
      issuedRolls: Math.max(1, Math.min(2, Math.round(balanceMtrs / 100))),
      issueTo: 'EDP Digital Print Job Card',
      referenceDoc: `JC-${Date.now().toString().slice(-4)}`,
      operatorName: 'Store Operator',
      notes: `Issued from ${lot.lotNumber} for digital printing`
    });
    setShowIssueModal(true);
  };

  // Handle Fabric Issuance
  const handleConfirmIssuance = (e) => {
    e.preventDefault();
    if (!selectedLotForIssue) return;

    const metersToIssue = Number(issueForm.issuedMeters) || 0;
    const rollsToIssue = Number(issueForm.issuedRolls) || 0;
    const currentBalance = Math.max(0, selectedLotForIssue.totalMeters - selectedLotForIssue.issuedMeters);

    if (metersToIssue <= 0) {
      triggerEliteAlert('Please enter a valid meter count to issue.', 'Invalid Quantity');
      return;
    }

    if (metersToIssue > currentBalance) {
      triggerEliteAlert(`Cannot issue ${metersToIssue} Mtr! Available balance is only ${currentBalance} Mtr.`, 'Insufficient Stock');
      return;
    }

    // Update lot state
    setLots(prev => prev.map(lot => {
      if (lot.id === selectedLotForIssue.id) {
        const newIssued = (lot.issuedMeters || 0) + metersToIssue;
        const newStatus = newIssued >= lot.totalMeters ? 'Depleted' : 'Partially Issued';

        // Update rolls status
        let rollsPendingToMark = rollsToIssue;
        const updatedRolls = (lot.rolls || []).map(r => {
          if (r.status === 'In Stock' && rollsPendingToMark > 0) {
            rollsPendingToMark--;
            return {
              ...r,
              status: 'Issued',
              issueTo: issueForm.issueTo + (issueForm.referenceDoc ? ` (${issueForm.referenceDoc})` : '')
            };
          }
          return r;
        });

        return {
          ...lot,
          issuedMeters: newIssued,
          status: newStatus,
          rolls: updatedRolls
        };
      }
      return lot;
    }));

    // Add to ledger
    const newLedgerEntry = {
      id: `TX-${Date.now()}`,
      date: new Date().toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      lotNumber: selectedLotForIssue.lotNumber,
      type: 'ISSUED',
      fabricQuality: selectedLotForIssue.fabricQuality,
      meters: metersToIssue,
      rolls: rollsToIssue,
      party: issueForm.issueTo,
      reference: issueForm.referenceDoc || 'Production Issue',
      user: issueForm.operatorName || 'Yamunaji Operations',
      notes: issueForm.notes
    };

    setLedger(prev => [newLedgerEntry, ...prev]);
    setShowIssueModal(false);
    setSelectedLotForIssue(null);

    triggerEliteAlert(`Successfully issued ${metersToIssue} Mtr from Lot ${selectedLotForIssue.lotNumber} to ${issueForm.issueTo}.`, 'Issuance Completed');
  };

  // Delete Lot
  const handleDeleteLot = (lot) => {
    triggerEliteConfirm(
      `Are you sure you want to delete Lot ${lot.lotNumber}? This will remove ${lot.totalMeters} Mtr from records.`,
      () => {
        setLots(prev => prev.filter(l => l.id !== lot.id));
        triggerEliteAlert(`Lot ${lot.lotNumber} removed.`, 'Lot Deleted');
      },
      null,
      'Delete RFD Lot',
      'Delete Lot',
      'Cancel'
    );
  };

  // Export CSV
  const handleExportCSV = () => {
    if (lots.length === 0) {
      triggerEliteAlert('No lot data available to export.', 'Export');
      return;
    }
    const headers = ['Lot Number', 'Inward Date', 'Mill / Party', 'Challan No', 'Fabric Quality', 'Panna', 'GSM', 'Total Rolls', 'Total Meters', 'Issued Meters', 'Balance Meters', 'Rate/Mtr', 'Status', 'Rack'];
    const rows = lots.map(l => [
      l.lotNumber,
      l.inwardDate,
      `"${l.millParty}"`,
      l.challanNo,
      `"${l.fabricQuality}"`,
      l.panna,
      l.gsm,
      l.totalRolls,
      l.totalMeters,
      l.issuedMeters,
      Math.max(0, l.totalMeters - l.issuedMeters),
      l.ratePerMeter,
      l.status,
      l.rackLocation
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Yamunaji_RFD_Stock_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '2.5rem' }}>
      {/* 🌟 Top Header Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem 1.5rem',
          borderLeft: '5px solid #0ea5e9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.04) 0%, rgba(2, 132, 199, 0.08) 100%)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              background: '#0ea5e920',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #0ea5e940',
              boxShadow: '0 2px 8px rgba(14, 165, 233, 0.2)'
            }}
          >
            <Layers size={24} color="#0ea5e9" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                Yamunaji (YJ) — RFD Fabric Operations
              </h2>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: '#0ea5e91a',
                  color: '#0284c7',
                  border: '1px solid #0ea5e933',
                  textTransform: 'uppercase'
                }}
              >
                Ready For Dyeing / Discharge
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '3px 0 0' }}>
              Raw fabric lot inward, panna & GSM quality testing, roll inventory tracking, and direct issuance to digital printing.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleExportCSV}
            className="btn-secondary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            title="Download CSV Spreadsheet"
          >
            <FileSpreadsheet size={15} /> Export Stock
          </button>
          <button
            onClick={() => setShowInwardModal(true)}
            className="btn-primary"
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
              border: 'none',
              boxShadow: '0 2px 6px rgba(14, 165, 233, 0.3)'
            }}
          >
            <PlusCircle size={16} /> + New RFD Inward Batch
          </button>
        </div>
      </div>

      {/* 📊 Executive Quick Metrics HUD */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem'
        }}
      >
        {/* Card 1: Total RFD Balance */}
        <div className="glass-panel" style={{ padding: '1.1rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              In-Stock RFD Fabric
            </span>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={16} color="#0284c7" />
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0284c7' }}>
            {stats.totalInStockMeters.toLocaleString('en-IN')} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Mtr</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 700, color: '#0ea5e9' }}>{stats.totalInStockRolls} Rolls</span> across warehouse racks
          </div>
        </div>

        {/* Card 2: Active Lots */}
        <div className="glass-panel" style={{ padding: '1.1rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Active Batches / Lots
            </span>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PackageCheck size={16} color="#15803d" />
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#16a34a' }}>
            {stats.activeLotsCount} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Lots</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 700, color: '#16a34a' }}>100% Inspected</span> & Ready for printing
          </div>
        </div>

        {/* Card 3: Total Issued */}
        <div className="glass-panel" style={{ padding: '1.1rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Issued to Production
            </span>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowUpRight size={16} color="#7c3aed" />
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#7c3aed' }}>
            {stats.totalIssuedMeters.toLocaleString('en-IN')} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Mtr</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Allocated to Digital Printing & Job Cards
          </div>
        </div>

        {/* Card 4: Inventory Valuation */}
        <div className="glass-panel" style={{ padding: '1.1rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Stock Valuation (YJ)
            </span>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} color="#b45309" />
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#d97706' }}>
            ₹ {stats.totalValuation.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Based on supplier inward purchase rate
          </div>
        </div>
      </div>

      {/* 🧭 Secondary Nav Pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('inventory')}
          className="tab-pill"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: activeTab === 'inventory' ? 800 : 600,
            background: activeTab === 'inventory' ? '#0ea5e9' : 'transparent',
            color: activeTab === 'inventory' ? '#ffffff' : '#64748b',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Layers size={14} /> RFD Lot Inventory ({lots.length})
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className="tab-pill"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: activeTab === 'ledger' ? 800 : 600,
            background: activeTab === 'ledger' ? '#0ea5e9' : 'transparent',
            color: activeTab === 'ledger' ? '#ffffff' : '#64748b',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Clock size={14} /> Stock Movement Ledger ({ledger.length})
        </button>
      </div>

      {/* ======================================================== */}
      {/* 📦 TAB 1: RFD LOT INVENTORY TABLE                         */}
      {/* ======================================================== */}
      {activeTab === 'inventory' && (
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          {/* Filter Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginBottom: '1.25rem'
            }}
          >
            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: 260, flex: 1, maxWidth: 360 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search Lot #, Mill / Party, Quality, Rack..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '32px', height: '36px', fontSize: '0.82rem', width: '100%' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {/* Quality Filter */}
              <select
                value={qualityFilter}
                onChange={(e) => setQualityFilter(e.target.value)}
                className="input-field"
                style={{ height: '36px', fontSize: '0.8rem', minWidth: 150 }}
              >
                <option value="ALL">All Fabric Qualities</option>
                {availableQualities.map(q => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-field"
                style={{ height: '36px', fontSize: '0.8rem', minWidth: 130 }}
              >
                <option value="ALL">All Statuses</option>
                <option value="In Stock">In Stock</option>
                <option value="Partially Issued">Partially Issued</option>
                <option value="Depleted">Depleted</option>
              </select>

              <button
                onClick={() => { setSearchQuery(''); setQualityFilter('ALL'); setStatusFilter('ALL'); }}
                className="btn-secondary"
                style={{ height: '36px', padding: '0 10px', fontSize: '0.78rem' }}
                title="Reset Filters"
              >
                <RefreshCw size={13} /> Reset
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="table-container" style={{ overflowX: 'auto' }}>
            {filteredLots.length === 0 ? (
              <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Layers size={36} style={{ color: '#94a3b8', margin: '0 auto 0.75rem', display: 'block' }} />
                <h4 style={{ margin: '0 0 4px', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700 }}>
                  No RFD lots matching filter criteria
                </h4>
                <p style={{ margin: 0, fontSize: '0.82rem' }}>
                  Try adjusting your search terms or add a new inward batch.
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 12px' }}>Lot Number</th>
                    <th style={{ padding: '10px 12px' }}>Date</th>
                    <th style={{ padding: '10px 12px' }}>Mill / Processing Party</th>
                    <th style={{ padding: '10px 12px' }}>Fabric Quality</th>
                    <th style={{ padding: '10px 12px' }}>Panna / Width</th>
                    <th style={{ padding: '10px 12px' }}>GSM</th>
                    <th style={{ padding: '10px 12px' }}>Rolls</th>
                    <th style={{ padding: '10px 12px' }}>Total Inward</th>
                    <th style={{ padding: '10px 12px' }}>Available Balance</th>
                    <th style={{ padding: '10px 12px' }}>Rack</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLots.map((lot) => {
                    const balance = Math.max(0, lot.totalMeters - lot.issuedMeters);
                    const percentage = Math.round((balance / (lot.totalMeters || 1)) * 100);
                    const isDepleted = lot.status === 'Depleted' || balance === 0;
                    const inStockRolls = (lot.rolls || []).filter(r => r.status === 'In Stock').length;

                    return (
                      <tr
                        key={lot.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background 0.12s ease'
                        }}
                        className="hover-row"
                      >
                        {/* Lot Number */}
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0284c7' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{lot.lotNumber}</span>
                            <span
                              style={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: '#f0fdf4',
                                color: '#16a34a',
                                border: '1px solid #bbf7d0'
                              }}
                            >
                              {lot.qualityGrade || 'A Grade'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                            Challan: {lot.challanNo}
                          </div>
                        </td>

                        {/* Date */}
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                          {lot.inwardDate ? new Date(lot.inwardDate).toLocaleDateString('en-IN') : '--'}
                        </td>

                        {/* Mill Party */}
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {lot.millParty}
                        </td>

                        {/* Quality */}
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                          <span style={{ background: '#f8fafc', padding: '3px 8px', borderRadius: '5px', border: '1px solid #e2e8f0' }}>
                            {lot.fabricQuality}
                          </span>
                        </td>

                        {/* Panna */}
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>
                          {lot.panna}
                        </td>

                        {/* GSM */}
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                          {lot.gsm ? `${lot.gsm} GSM` : '--'}
                        </td>

                        {/* Rolls */}
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                          <span style={{ color: '#0284c7' }}>{inStockRolls}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}> / {lot.totalRolls}</span>
                        </td>

                        {/* Total Inward */}
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {lot.totalMeters.toLocaleString('en-IN')} Mtr
                        </td>

                        {/* Available Balance */}
                        <td style={{ padding: '10px 12px', minWidth: 140 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                            <span style={{ fontWeight: 800, color: isDepleted ? '#94a3b8' : '#0f172a' }}>
                              {balance.toLocaleString('en-IN')} Mtr
                            </span>
                            <span style={{ fontSize: '0.7rem', color: isDepleted ? '#94a3b8' : '#0284c7', fontWeight: 700 }}>
                              {percentage}%
                            </span>
                          </div>
                          {/* Mini Progress Bar */}
                          <div style={{ height: '5px', width: '100%', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${percentage}%`,
                                background: isDepleted ? '#94a3b8' : percentage > 50 ? '#0ea5e9' : '#f59e0b',
                                transition: 'width 0.3s ease'
                              }}
                            />
                          </div>
                        </td>

                        {/* Rack Location */}
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#475569' }}>
                            📍 {lot.rackLocation || 'Bay YJ'}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: isDepleted ? '#f1f5f9' : lot.status === 'Partially Issued' ? '#fef3c7' : '#e0f2fe',
                              color: isDepleted ? '#64748b' : lot.status === 'Partially Issued' ? '#b45309' : '#0369a1',
                              border: `1px solid ${isDepleted ? '#e2e8f0' : lot.status === 'Partially Issued' ? '#fde68a' : '#bae6fd'}`
                            }}
                          >
                            {lot.status}
                          </span>
                        </td>

                        {/* Action Buttons */}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              onClick={() => setSelectedLotForRolls(lot)}
                              className="btn-secondary"
                              style={{ padding: '4px 7px', fontSize: '0.72rem', height: '28px' }}
                              title="View Individual Rolls Breakdown"
                            >
                              <Eye size={13} /> Rolls
                            </button>

                            {!isDepleted && (
                              <button
                                onClick={() => handleOpenIssueModal(lot)}
                                className="btn-primary"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '0.72rem',
                                  height: '28px',
                                  background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                                title="Issue meters to Digital Print / Production"
                              >
                                <ArrowUpRight size={13} /> Issue
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteLot(lot)}
                              style={{
                                padding: '4px 6px',
                                fontSize: '0.72rem',
                                height: '28px',
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                borderRadius: '4px'
                              }}
                              title="Delete Lot"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 📜 TAB 2: AUDIT LEDGER                                    */}
      {/* ======================================================== */}
      {activeTab === 'ledger' && (
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Yamunaji RFD Stock Movement Ledger
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Complete chronologic history of all fabric inward batches and issuance dispatches.
              </p>
            </div>
          </div>

          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px' }}>Timestamp</th>
                  <th style={{ padding: '10px 12px' }}>Type</th>
                  <th style={{ padding: '10px 12px' }}>Lot Number</th>
                  <th style={{ padding: '10px 12px' }}>Fabric Quality</th>
                  <th style={{ padding: '10px 12px' }}>Meters</th>
                  <th style={{ padding: '10px 12px' }}>Rolls</th>
                  <th style={{ padding: '10px 12px' }}>Source / Destination</th>
                  <th style={{ padding: '10px 12px' }}>Reference</th>
                  <th style={{ padding: '10px 12px' }}>Operator</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((item) => {
                  const isInward = item.type === 'INWARD';
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {item.date}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '5px',
                            background: isInward ? '#dcfce7' : '#ede9fe',
                            color: isInward ? '#15803d' : '#6d28d9',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          {isInward ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                          {item.type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0284c7' }}>
                        {item.lotNumber}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                        {item.fabricQuality}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: isInward ? '#16a34a' : '#7c3aed' }}>
                        {isInward ? `+${item.meters}` : `-${item.meters}`} Mtr
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                        {item.rolls} Rolls
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.party}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                        {item.reference}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        👤 {item.user}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ➕ MODAL: NEW INWARD RFD LOT                              */}
      {/* ======================================================== */}
      {showInwardModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: 620,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: 14,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PlusCircle size={20} color="#0284c7" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                    + New RFD Fabric Inward Batch
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Record receiving of Ready For Dyeing / Discharge lot at Yamunaji
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowInwardModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Inward Form */}
            <form onSubmit={handleCreateInwardLot} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Lot Number (Optional, auto-generated if blank)
                  </label>
                  <input
                    type="text"
                    placeholder={`YJ-RFD-2026-${String(lots.length + 1).padStart(3, '0')}`}
                    value={inwardForm.lotNumber}
                    onChange={(e) => setInwardForm(prev => ({ ...prev, lotNumber: e.target.value }))}
                    className="input-field"
                    style={{ height: '36px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Inward Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={inwardForm.inwardDate}
                    onChange={(e) => setInwardForm(prev => ({ ...prev, inwardDate: e.target.value }))}
                    className="input-field"
                    style={{ height: '36px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Mill / Processing Party Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Shree Radhe Textiles / Vrundavan Mills"
                    value={inwardForm.millParty}
                    onChange={(e) => setInwardForm(prev => ({ ...prev, millParty: e.target.value }))}
                    className="input-field"
                    style={{ height: '36px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Mill Challan / LR Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CH-9981"
                    value={inwardForm.challanNo}
                    onChange={(e) => setInwardForm(prev => ({ ...prev, challanNo: e.target.value }))}
                    className="input-field"
                    style={{ height: '36px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Fabric Quality *
                  </label>
                  <select
                    value={inwardForm.fabricQuality}
                    onChange={(e) => setInwardForm(prev => ({ ...prev, fabricQuality: e.target.value }))}
                    className="input-field"
                    style={{ height: '36px', fontSize: '0.82rem', width: '100%' }}
                  >
                    <option value="Pure Viscose Rayon 14kg">Pure Viscose Rayon 14kg</option>
                    <option value="Pure Modal Satin 60s">Pure Modal Satin 60s</option>
                    <option value="Cotton 60x60 Cambric">Cotton 60x60 Cambric</option>
                    <option value="Organza Viscose Gold Weave">Organza Viscose Gold Weave</option>
                    <option value="Chanderi Silk 50gm">Chanderi Silk 50gm</option>
                    <option value="Pure Linen Slub 60s">Pure Linen Slub 60s</option>
                    <option value="Viscose Crepe 80gm">Viscose Crepe 80gm</option>
                    <option value="Georgette 60gm Pure">Georgette 60gm Pure</option>
                    <option value="Heavy Cotton Twill 200 GSM">Heavy Cotton Twill 200 GSM</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Panna / Width *
                  </label>
                  <select
                    value={inwardForm.panna}
                    onChange={(e) => setInwardForm(prev => ({ ...prev, panna: e.target.value }))}
                    className="input-field"
                    style={{ height: '36px', fontSize: '0.82rem', width: '100%' }}
                  >
                    <option value='44"'>44 inches</option>
                    <option value='48"'>48 inches</option>
                    <option value='54"'>54 inches</option>
                    <option value='58"'>58 inches</option>
                    <option value='60"'>60 inches</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Fabric GSM
                  </label>
                  <input
                    type="number"
                    placeholder="140"
                    value={inwardForm.gsm}
                    onChange={(e) => setInwardForm(prev => ({ ...prev, gsm: e.target.value }))}
                    className="input-field"
                    style={{ height: '36px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Total Rolls / Thaan *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={inwardForm.totalRolls}
                    onChange={(e) => setInwardForm(prev => ({ ...prev, totalRolls: e.target.value }))}
                    className="input-field"
                    style={{ height: '36px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Total Meters *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={inwardForm.totalMeters}
                    onChange={(e) => setInwardForm(prev => ({ ...prev, totalMeters: e.target.value }))}
                    className="input-field"
                    style={{ height: '36px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Rate / Mtr (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={inwardForm.ratePerMeter}
                    onChange={(e) => setInwardForm(prev => ({ ...prev, ratePerMeter: e.target.value }))}
                    className="input-field"
                    style={{ height: '36px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Quality Grade
                  </label>
                  <select
                    value={inwardForm.qualityGrade}
                    onChange={(e) => setInwardForm(prev => ({ ...prev, qualityGrade: e.target.value }))}
                    className="input-field"
                    style={{ height: '36px', fontSize: '0.82rem', width: '100%' }}
                  >
                    <option value="A Grade">A Grade (Export Quality)</option>
                    <option value="B Grade">B Grade (Commercial Grade)</option>
                    <option value="Inspection Pending">Inspection Pending</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Warehouse Rack / Shelf Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rack YJ-A1, Floor Bay 2"
                    value={inwardForm.rackLocation}
                    onChange={(e) => setInwardForm(prev => ({ ...prev, rackLocation: e.target.value }))}
                    className="input-field"
                    style={{ height: '36px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Inspection Notes & Remarks
                </label>
                <textarea
                  placeholder="Specify weave quality, shrinkage %, visual defect notes..."
                  value={inwardForm.remarks}
                  onChange={(e) => setInwardForm(prev => ({ ...prev, remarks: e.target.value }))}
                  className="input-field"
                  rows={2}
                  style={{ fontSize: '0.82rem', width: '100%', resize: 'vertical' }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
                <button
                  type="button"
                  onClick={() => setShowInwardModal(false)}
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.82rem',
                    background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Check size={16} /> Save Inward RFD Lot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 🚀 MODAL: ISSUE RFD FABRIC TO PRODUCTION                 */}
      {/* ======================================================== */}
      {showIssueModal && selectedLotForIssue && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: 520,
              background: '#ffffff',
              borderRadius: 14,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowUpRight size={20} color="#7c3aed" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                    Issue RFD Fabric to Production
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    From Lot {selectedLotForIssue.lotNumber} ({selectedLotForIssue.fabricQuality})
                  </span>
                </div>
              </div>
              <button
                onClick={() => { setShowIssueModal(false); setSelectedLotForIssue(null); }}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Current Stock Banner */}
            <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Current Balance</span>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0ea5e9' }}>
                  {Math.max(0, selectedLotForIssue.totalMeters - selectedLotForIssue.issuedMeters).toLocaleString('en-IN')} Mtr
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Panna / Width</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>
                  {selectedLotForIssue.panna} ({selectedLotForIssue.gsm} GSM)
                </span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleConfirmIssuance} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Meters to Issue *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="1"
                    max={Math.max(0, selectedLotForIssue.totalMeters - selectedLotForIssue.issuedMeters)}
                    value={issueForm.issuedMeters}
                    onChange={(e) => setIssueForm(prev => ({ ...prev, issuedMeters: e.target.value }))}
                    className="input-field"
                    style={{ height: '36px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Rolls to Issue *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={issueForm.issuedRolls}
                    onChange={(e) => setIssueForm(prev => ({ ...prev, issuedRolls: e.target.value }))}
                    className="input-field"
                    style={{ height: '36px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Destination Department / Client *
                </label>
                <select
                  value={issueForm.issueTo}
                  onChange={(e) => setIssueForm(prev => ({ ...prev, issueTo: e.target.value }))}
                  className="input-field"
                  style={{ height: '36px', fontSize: '0.82rem', width: '100%' }}
                >
                  <option value="EDP Digital Print Job Card">EDP Digital Print Job Card</option>
                  <option value="Sampling & Design Studio">Sampling & Design Studio</option>
                  <option value="Outside Job Work Dyeing">Outside Job Work Dyeing</option>
                  <option value="Direct Client Delivery">Direct Client Delivery</option>
                  <option value="Stitching Unit (ES)">Stitching Unit (ES)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Job Card / Voucher Ref #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JC-1142"
                    value={issueForm.referenceDoc}
                    onChange={(e) => setIssueForm(prev => ({ ...prev, referenceDoc: e.target.value }))}
                    className="input-field"
                    style={{ height: '36px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Operator / Issued By
                  </label>
                  <input
                    type="text"
                    value={issueForm.operatorName}
                    onChange={(e) => setIssueForm(prev => ({ ...prev, operatorName: e.target.value }))}
                    className="input-field"
                    style={{ height: '36px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
                <button
                  type="button"
                  onClick={() => { setShowIssueModal(false); setSelectedLotForIssue(null); }}
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.82rem',
                    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <ArrowUpRight size={16} /> Confirm Fabric Issuance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 🔍 MODAL: INDIVIDUAL ROLLS BREAKDOWN                     */}
      {/* ======================================================== */}
      {selectedLotForRolls && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: 680,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: 14,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                    Rolls Breakdown: {selectedLotForRolls.lotNumber}
                  </h3>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1' }}>
                    {selectedLotForRolls.fabricQuality}
                  </span>
                </div>
                <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  Supplier: {selectedLotForRolls.millParty} | Panna: {selectedLotForRolls.panna} | Rack: {selectedLotForRolls.rackLocation}
                </span>
              </div>
              <button
                onClick={() => setSelectedLotForRolls(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Rolls Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.65rem' }}>
              {(selectedLotForRolls.rolls || []).map((roll, idx) => {
                const isIssued = roll.status === 'Issued';
                return (
                  <div
                    key={idx}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 8,
                      border: `1px solid ${isIssued ? '#e2e8f0' : '#bbf7d0'}`,
                      background: isIssued ? '#f8fafc' : '#f0fdf4',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.8rem', color: isIssued ? '#94a3b8' : '#15803d' }}>
                        {roll.rollNo}
                      </span>
                      <span
                        style={{
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          background: isIssued ? '#e2e8f0' : '#dcfce7',
                          color: isIssued ? '#64748b' : '#15803d'
                        }}
                      >
                        {roll.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: isIssued ? '#94a3b8' : '#0f172a' }}>
                      {roll.meters} Mtr
                    </div>

                    {isIssued && roll.issueTo && (
                      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px', lineHeight: 1.2 }}>
                        Issued to: {roll.issueTo}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
              <button
                onClick={() => setSelectedLotForRolls(null)}
                className="btn-primary"
                style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
