import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Layers,
  PlusCircle,
  Search,
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
  Scissors,
  Printer,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Truck,
  Plus,
  X,
  FileSpreadsheet,
  PackageCheck,
  Building,
  Check,
  ChevronDown,
  Hash,
  Sparkles,
  Calendar,
  ClipboardList,
  Boxes,
  Settings,
  Edit2,
  Sliders,
  MapPin,
  Phone,
  User,
  Briefcase,
  Lock
} from 'lucide-react';
import { triggerEliteAlert, triggerEliteConfirm } from '../services/dialogService';
import { api } from '../services/api';
import EnterpriseEmptyState from './common/EnterpriseEmptyState';
import ErpUnifiedFilterBar from './common/ErpUnifiedFilterBar';
import { getDatePresetRange } from './DateRangePicker';

const STORAGE_GRAY_KEY = 'yamunaji_gray_lots_data';
const STORAGE_MILL_CHALLAN_KEY = 'yamunaji_mill_challans_data';
const STORAGE_RFD_KEY = 'yamunaji_rfd_lots_data';
const STORAGE_CONFIGS_KEY = 'yamunaji_master_configurations';
const STORAGE_CLEAN_SLATE_KEY = 'yamunaji_clean_slate_20261028_cleared';

// ==========================================
// DEFAULT MASTER CONFIGURATIONS (SURAT TEXTILES)
// ==========================================
export const DEFAULT_CONFIGS = {
  weavers: [],
  qualities: [],
  mills: [],
  processes: []
};

export const STANDARD_SURAT_CONFIGS = {
  weavers: [
    { name: 'Maruti Weaving Works', gst: '24AABCM1234F1Z8', address: 'Plot 42, GIDC Pandesara', city: 'Surat, Gujarat', phone: '+91 98251 12345', contactPerson: 'Rameshbhai Patel', broker: 'Shree Krishna Agency', processTypes: '', notes: 'Quality loom weaving' },
    { name: 'Jay Ambe Textiles', gst: '24AAACJ5678K1Z2', address: 'Shed 12, Sachin Industrial Area', city: 'Surat, Gujarat', phone: '+91 98980 67890', contactPerson: 'Ketanbhai Shah', broker: 'Harikrishna Brokerage', processTypes: '', notes: 'Standard viscose & modal' },
    { name: 'Radha Krishna Loom Mills', gst: '24AABCR9012M1Z4', address: 'Plot 88, Road No. 8, Khatodara GIDC', city: 'Surat, Gujarat', phone: '+91 98253 44556', contactPerson: 'Ashokbhai Dholakiya', broker: 'Direct', processTypes: '', notes: 'Prompt gray delivery' }
  ],
  qualities: [
    'Pure Viscose Rayon 14kg',
    'Pure Modal Satin 60s',
    'Cotton 60x60 Cambric',
    'Organza Viscose Gold Weave',
    'Chanderi Silk 50gm',
    'Pure Linen Slub 60s',
    'Viscose Crepe 80gm',
    'Georgette 60gm Pure',
    'Heavy Cotton Twill 200 GSM',
    'Dola Silk Heavy 80gm'
  ],
  mills: [
    { name: 'Shree Radhe Bleaching & Dyeing Processors', gst: '24AAACR1234A1Z5', address: 'Plot 112-116, Road No. 12, Sachin GIDC', city: 'Surat, Gujarat - 394230', phone: '+91 98250 11999', contactPerson: 'Maheshbhai (Mill Manager)', processTypes: 'RFD Bleaching, Scouring & Heat Setting', notes: 'Turnaround: 2-3 Days. Loss/Shrinkage avg 2.5-3%' },
    { name: 'Vrundavan Mills Pvt Ltd', gst: '24AABCV5678B1Z0', address: 'Block 402, GIDC Pandesara, Opp. Water Tank', city: 'Surat, Gujarat - 394221', phone: '+91 98241 88776', contactPerson: 'Kishorebhai Desai', processTypes: 'Mercerizing & RFD Bleaching, Bio Wash', notes: 'Specialist for 60s Cambric & Pure Modal' },
    { name: 'Ganesh Textile Processors', gst: '24AAACG9012C1Z8', address: 'Plot 55, Kadodara Road, Palsana GIDC', city: 'Surat, Gujarat - 394317', phone: '+91 99798 22334', contactPerson: 'Rajubhai Kothari', processTypes: 'Soft Finish & Wash RFD, Stenter Finishing', notes: 'Fast delivery for urgent job card requirements' },
    { name: 'Bhagwati Dyeing House', gst: '24AAACB7890E1Z1', address: 'Plot 18, Road No. 3, Hojiwala Industrial Estate', city: 'Surat, Gujarat - 394230', phone: '+91 98795 44332', contactPerson: 'Girishbhai Parmar', processTypes: 'Bio Wash & Zero Shrinkage Finish', notes: 'Continuous bleaching range (CBR)' }
  ],
  processes: [
    'RFD Bleaching, Scouring & Heat Setting',
    'Mercerizing & RFD Bleaching',
    'Soft Finish & Wash RFD',
    'High Tensile Heat Setting',
    'Bio Wash & Zero Shrinkage Finish'
  ]
};

// ==========================================
// PARTY NORMALIZATION & HELPER UTILITIES
// ==========================================
export const normalizeParty = (item, defaultCity = 'Surat, Gujarat') => {
  if (!item) return { name: '', gst: '', address: '', city: defaultCity, phone: '', contactPerson: '', broker: '', processTypes: '', notes: '' };
  if (typeof item === 'string') {
    return {
      name: item,
      gst: '',
      address: '',
      city: defaultCity,
      phone: '',
      contactPerson: '',
      broker: '',
      processTypes: '',
      notes: ''
    };
  }
  return {
    name: item.name || '',
    gst: item.gst || '',
    address: item.address || '',
    city: item.city || defaultCity,
    phone: item.phone || '',
    contactPerson: item.contactPerson || '',
    broker: item.broker || '',
    processTypes: item.processTypes || '',
    notes: item.notes || ''
  };
};

export const getPartyName = (p) => (typeof p === 'string' ? p : p?.name || '');

// ==========================================
// SEED DATA FOR GRAY FABRIC (Clean slate, no dummy data)
// ==========================================
const SEED_GRAY_LOTS = [];
const SEED_MILL_CHALLANS = [];
const SEED_RFD_LOTS = [];

export default function YamunajiRfdPanel({ companyEntity = 'Yamunaji', onNavigate }) {
  // Master Screen Mode: 'gray' (Gray Fabric) or 'rfd' (RFD Fabric)
  const [screenMode, setScreenMode] = useState('gray');

  // Sub-tabs for Gray: 'weaver_inward' or 'mill_outward'
  const [graySubTab, setGraySubTab] = useState('weaver_inward');

  // Master Configuration State (Weavers, Qualities, Mills, Processes)
  const [configs, setConfigs] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CONFIGS_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (p && typeof p === 'object') {
          return {
            weavers: Array.isArray(p.weavers) ? p.weavers.map(w => normalizeParty(w)) : [],
            qualities: Array.isArray(p.qualities) ? p.qualities : [],
            mills: Array.isArray(p.mills) ? p.mills.map(m => normalizeParty(m)) : [],
            processes: Array.isArray(p.processes) ? p.processes : []
          };
        }
      }
    } catch (e) {}
    return {
      weavers: [],
      qualities: [],
      mills: [],
      processes: []
    };
  });

  // Save Configs on Change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_CONFIGS_KEY, JSON.stringify(configs)); } catch (e) {}
  }, [configs]);

  // Data States (Clean slate, auto-clears previous test/demo lots)
  const [grayLots, setGrayLots] = useState(() => {
    try {
      if (localStorage.getItem(STORAGE_CLEAN_SLATE_KEY) !== 'true') {
        localStorage.removeItem(STORAGE_GRAY_KEY);
        localStorage.removeItem(STORAGE_MILL_CHALLAN_KEY);
        localStorage.removeItem(STORAGE_RFD_KEY);
        localStorage.setItem(STORAGE_CLEAN_SLATE_KEY, 'true');
        return [];
      }
      const saved = localStorage.getItem(STORAGE_GRAY_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (Array.isArray(p)) return p;
      }
    } catch (e) {}
    return [];
  });

  const [millChallans, setMillChallans] = useState(() => {
    try {
      if (localStorage.getItem(STORAGE_CLEAN_SLATE_KEY) !== 'true') return [];
      const saved = localStorage.getItem(STORAGE_MILL_CHALLAN_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (Array.isArray(p)) return p;
      }
    } catch (e) {}
    return [];
  });

  const [rfdLots, setRfdLots] = useState(() => {
    try {
      if (localStorage.getItem(STORAGE_CLEAN_SLATE_KEY) !== 'true') return [];
      const saved = localStorage.getItem(STORAGE_RFD_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (Array.isArray(p)) return p;
      }
    } catch (e) {}
    return [];
  });

  // Ensure clean slate on component mount
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_CLEAN_SLATE_KEY) !== 'true') {
        localStorage.removeItem(STORAGE_GRAY_KEY);
        localStorage.removeItem(STORAGE_MILL_CHALLAN_KEY);
        localStorage.removeItem(STORAGE_RFD_KEY);
        localStorage.setItem(STORAGE_CLEAN_SLATE_KEY, 'true');
        setGrayLots([]);
        setMillChallans([]);
        setRfdLots([]);
      }
    } catch (e) {}
  }, []);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsActiveTab, setSettingsActiveTab] = useState('weavers'); // 'weavers' | 'qualities' | 'mills' | 'processes'
  const [newSettingInput, setNewSettingInput] = useState('');
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [editingItemValue, setEditingItemValue] = useState('');

  // Party Detail Modal State (for Weavers and Processing Mills)
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [partyModalMode, setPartyModalMode] = useState('add'); // 'add' | 'edit'
  const [partyModalType, setPartyModalType] = useState('weavers'); // 'weavers' | 'mills'
  const [partyModalIndex, setPartyModalIndex] = useState(null);
  const [partySearchTerm, setPartySearchTerm] = useState('');
  const [partyModalForm, setPartyModalForm] = useState({
    name: '',
    gst: '',
    address: '',
    city: 'Surat, Gujarat',
    phone: '',
    contactPerson: '',
    broker: '',
    processTypes: '',
    notes: ''
  });

  const [showWeaverInwardModal, setShowWeaverInwardModal] = useState(false);
  const [showMillChallanModal, setShowMillChallanModal] = useState(false);
  const [showPrintChallanModal, setShowPrintChallanModal] = useState(null);
  const [selectedGrayLotForView, setSelectedGrayLotForView] = useState(null);

  // Edit states for Challans, Gray Lots, and RFD Lots
  const [editingMillChallan, setEditingMillChallan] = useState(null);
  const [editChallanForm, setEditChallanForm] = useState(null);

  const [editingGrayLot, setEditingGrayLot] = useState(null);
  const [editGrayLotForm, setEditGrayLotForm] = useState(null);

  const [editingRfdLot, setEditingRfdLot] = useState(null);
  const [editRfdLotForm, setEditRfdLotForm] = useState(null);
  const [viewingRfdTpsLot, setViewingRfdTpsLot] = useState(null);

  // Accordion expansion state for Mill Outward Challans
  const [expandedChallanIds, setExpandedChallanIds] = useState([]);
  const toggleExpandChallan = (challanId) => {
    setExpandedChallanIds(prev =>
      prev.includes(challanId) ? prev.filter(id => id !== challanId) : [...prev, challanId]
    );
  };

  // Inward RFD Lot Modal & Total Meter / Shortage / Mill Balance tracking
  const [showInwardRfdModal, setShowInwardRfdModal] = useState(false);
  const [inwardRfdForm, setInwardRfdForm] = useState({
    lotNumber: '',
    inwardDate: new Date().toISOString().split('T')[0],
    sourceChallanId: '',
    millParty: '',
    millChallanNo: '',
    fabricQuality: '',
    graySentMeters: '',
    receivedRfdMeters: '',
    shortagePercent: '', // User enters shortage in %
    shortageMeters: '',
    receivedRollsCount: '',
    isChallanClosed: true, // true = 0 mtr left at mill; false = partial receipt
    isChallanClosedUserOverridden: false,
    notes: '',
    // Mill Jobwork Invoice parameters
    invoiceNo: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    processRatePerMeter: '',
    hsnCode: '998821',
    gstRate: '5',
    paymentTerms: '30 Days',
    postToPurchase: false
  });

  // Filter for gray lots: 'all' | 'pending' | 'invoiced'
  const [grayInvoiceFilter, setGrayInvoiceFilter] = useState('all');

  // Modal state for attaching an invoice to an existing lot that was received with "Invoice Pending"
  const [attachingInvoiceLot, setAttachingInvoiceLot] = useState(null);
  const [attachInvoiceForm, setAttachInvoiceForm] = useState({
    invoiceNo: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    hsnCode: '5208',
    ratePerMeter: '',
    gstRate: '5',
    paymentTerms: '30 Days',
    postToPurchase: true
  });

  // Form State for Weaver Inward with TP details (Clean, no dummy/default values)
  const [weaverForm, setWeaverForm] = useState({
    lotNumber: '',
    inwardDate: new Date().toISOString().split('T')[0],
    weaverParty: '',
    weaverChallanNo: '',
    fabricQuality: '',
    ratePerMeter: '',
    rackLocation: '',
    remarks: '',
    // Invoice arrival option: 'received' (with challan) or 'pending' (will arrive later)
    invoiceReceivedOption: 'received',
    invoiceNo: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    hsnCode: '5208',
    gstRate: '5',
    paymentTerms: '30 Days',
    postToPurchase: true,
    tps: [
      { srNo: 1, tpNo: 'TP-1', tpMtr: '' }
    ]
  });

  // Direct numeric row count input state for auto-adding TP rows instantly
  const [tpCountInput, setTpCountInput] = useState('');

  // Standard ERP Multi-Filter States (DateRangePicker + UnifiedFilterPopover)
  const [datePreset, setDatePreset] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [activeFilters, setActiveFilters] = useState({});

  // Form State for Mill Outward Challan (Clean, no dummy/default values)
  const [millChallanForm, setMillChallanForm] = useState({
    challanNo: '',
    challanDate: new Date().toISOString().split('T')[0],
    fabricQuality: '',
    selectedLotId: 'all',
    millParty: '',
    vehicleNo: '',
    driverName: '',
    processRequired: '',
    selectedTpKeys: {}, // key: "lotId__tpIndex" -> boolean
    notes: ''
  });

  // Sync Data to LocalStorage
  useEffect(() => {
    try { localStorage.setItem(STORAGE_GRAY_KEY, JSON.stringify(grayLots)); } catch (e) {}
  }, [grayLots]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_MILL_CHALLAN_KEY, JSON.stringify(millChallans)); } catch (e) {}
  }, [millChallans]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_RFD_KEY, JSON.stringify(rfdLots)); } catch (e) {}
  }, [rfdLots]);

  // Aggregate Metrics
  const grayStats = useMemo(() => {
    let inStockMtrs = 0;
    let inStockTps = 0;
    let atMillMtrs = 0;
    let totalGrayValuation = 0;
    let pendingInvoiceCount = 0;
    let pendingInvoiceMtrs = 0;

    grayLots.forEach(lot => {
      const availableTps = (lot.tps || []).filter(t => t.status === 'In Stock');
      const inStockMtr = availableTps.reduce((sum, t) => sum + (Number(t.tpMtr) || 0), 0);
      inStockMtrs += inStockMtr;
      inStockTps += availableTps.length;
      atMillMtrs += (lot.sentToMillMeters || 0);
      totalGrayValuation += inStockMtr * (lot.ratePerMeter || 0);

      const isPending = lot.invoiceStatus === 'Pending' || (!lot.invoiceNo && !lot.purchaseNo);
      if (isPending) {
        pendingInvoiceCount++;
        pendingInvoiceMtrs += (lot.totalMeters || 0);
      }
    });

    return {
      inStockMtrs,
      inStockTps,
      atMillMtrs,
      totalGrayValuation,
      totalLots: grayLots.length,
      pendingInvoiceCount,
      pendingInvoiceMtrs: parseFloat(pendingInvoiceMtrs.toFixed(1))
    };
  }, [grayLots]);

  // 🏭 Live Mill Balances (Tracking how much fabric is still in mills across challans)
  const millBalanceStats = useMemo(() => {
    let totalSentToMills = 0;
    let totalReceivedFromMills = 0;
    let totalShortageMtrs = 0;
    let stillAtMillMtrs = 0;
    let openChallansCount = 0;

    millChallans.forEach(ch => {
      const sentMtr = parseFloat(ch.totalMeters) || 0;
      totalSentToMills += sentMtr;

      const receivedLots = rfdLots.filter(l => l.sourceChallanId === ch.id || (ch.challanNo && l.millChallanNo === ch.challanNo));
      const chReceivedMtrs = receivedLots.reduce((sum, l) => sum + (parseFloat(l.receivedRfdMeters) || 0), 0);
      const chShortageMtrs = receivedLots.reduce((sum, l) => sum + (parseFloat(l.shrinkageLossMeters) || 0), 0);

      totalReceivedFromMills += chReceivedMtrs;
      totalShortageMtrs += chShortageMtrs;

      const isClosed = ch.isClosed || ch.status === 'Fully Received' || (receivedLots.some(l => l.isChallanClosed));
      const chPending = isClosed
        ? 0
        : Math.max(0, parseFloat((sentMtr - (chReceivedMtrs + chShortageMtrs)).toFixed(1)));

      stillAtMillMtrs += chPending;
      if (chPending > 0) openChallansCount++;
    });

    const avgShortagePct = totalSentToMills > 0 ? parseFloat(((totalShortageMtrs / totalSentToMills) * 100).toFixed(1)) : 0;

    return {
      totalSentToMills: parseFloat(totalSentToMills.toFixed(1)),
      totalReceivedFromMills: parseFloat(totalReceivedFromMills.toFixed(1)),
      totalShortageMtrs: parseFloat(totalShortageMtrs.toFixed(1)),
      stillAtMillMtrs: parseFloat(stillAtMillMtrs.toFixed(1)),
      openChallansCount,
      avgShortagePct
    };
  }, [millChallans, rfdLots]);

  const rfdStats = useMemo(() => {
    let inStockRfdMtrs = 0;
    let inStockRolls = 0;
    let totalGraySent = 0;
    let totalShortageMtrs = 0;

    rfdLots.forEach(lot => {
      const bal = Math.max(0, (lot.receivedRfdMeters || 0) - (lot.issuedMeters || 0));
      inStockRfdMtrs += bal;
      inStockRolls += (parseInt(lot.receivedRollsCount) || (lot.tps ? lot.tps.length : 0) || (lot.rolls ? lot.rolls.length : 0) || 1);
      totalGraySent += (parseFloat(lot.graySentMeters) || 0);
      totalShortageMtrs += (parseFloat(lot.shrinkageLossMeters) || 0);
    });

    const avgShortagePercent = totalGraySent > 0 ? parseFloat(((totalShortageMtrs / totalGraySent) * 100).toFixed(1)) : 0;
    return {
      inStockRfdMtrs: parseFloat(inStockRfdMtrs.toFixed(1)),
      inStockRolls,
      totalRfdLots: rfdLots.length,
      totalGraySent: parseFloat(totalGraySent.toFixed(1)),
      totalShortageMtrs: parseFloat(totalShortageMtrs.toFixed(1)),
      avgShortagePercent
    };
  }, [rfdLots]);

  // ==========================================
  // MASTER CONFIGURATION HANDLERS
  // ==========================================
  const handleOpenAddParty = (type) => {
    setPartyModalType(type);
    setPartyModalMode('add');
    setPartyModalIndex(null);
    setPartyModalForm({
      name: '',
      gst: '',
      address: '',
      city: 'Surat, Gujarat',
      phone: '',
      contactPerson: '',
      broker: '',
      processTypes: type === 'mills' ? (configs.processes[0] || 'RFD Bleaching, Scouring & Heat Setting') : '',
      notes: ''
    });
    setShowPartyModal(true);
  };

  const handleOpenEditParty = (type, index, item) => {
    const party = normalizeParty(item);
    setPartyModalType(type);
    setPartyModalMode('edit');
    setPartyModalIndex(index);
    setPartyModalForm({ ...party });
    setShowPartyModal(true);
  };

  const handleSaveParty = (e) => {
    e.preventDefault();
    if (!partyModalForm.name.trim()) {
      triggerEliteAlert('Please enter Party / Firm Name.', 'Missing Name');
      return;
    }
    const cleanParty = {
      name: partyModalForm.name.trim(),
      gst: partyModalForm.gst.trim().toUpperCase(),
      address: partyModalForm.address.trim(),
      city: partyModalForm.city.trim() || 'Surat, Gujarat',
      phone: partyModalForm.phone.trim(),
      contactPerson: partyModalForm.contactPerson.trim(),
      broker: partyModalForm.broker.trim(),
      processTypes: partyModalForm.processTypes.trim(),
      notes: partyModalForm.notes.trim()
    };

    setConfigs(prev => {
      const list = [...(prev[partyModalType] || [])];
      if (partyModalMode === 'add') {
        list.push(cleanParty);
      } else if (partyModalIndex !== null) {
        list[partyModalIndex] = cleanParty;
      }
      const updated = { ...prev, [partyModalType]: list };
      try { localStorage.setItem(STORAGE_CONFIGS_KEY, JSON.stringify(updated)); } catch (err) {}
      return updated;
    });

    setShowPartyModal(false);
    triggerEliteAlert(
      `${partyModalType === 'weavers' ? 'Weaver' : 'Processing Mill'} "${cleanParty.name}" details saved to Master!`,
      'Party Saved'
    );
  };

  const handleAddMasterSetting = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const val = newSettingInput.trim();
    if (!val) return;
    const currentList = configs[settingsActiveTab] || [];
    if (currentList.some(item => (typeof item === 'string' ? item : item.name).toLowerCase() === val.toLowerCase())) {
      triggerEliteAlert(`"${val}" is already present in ${settingsActiveTab}!`, 'Duplicate Item');
      return;
    }
    const tabLabel = settingsActiveTab === 'qualities' ? 'Fabric Qualities' : settingsActiveTab === 'processes' ? 'Process Types' : settingsActiveTab === 'weavers' ? 'Weavers' : 'Processing Mills';
    setConfigs(prev => {
      const updatedList = (settingsActiveTab === 'weavers' || settingsActiveTab === 'mills')
        ? [...(prev[settingsActiveTab] || []), normalizeParty(val)]
        : [...(prev[settingsActiveTab] || []), val];
      const updated = {
        ...prev,
        [settingsActiveTab]: updatedList
      };
      try { localStorage.setItem(STORAGE_CONFIGS_KEY, JSON.stringify(updated)); } catch (err) {}
      return updated;
    });
    setNewSettingInput('');
    triggerEliteAlert(`"${val}" has been saved to ${tabLabel}!`, 'Saved to Master');
  };

  const handleCloseSettingsModal = () => {
    const val = newSettingInput.trim();
    if (val) {
      const currentList = configs[settingsActiveTab] || [];
      const isDuplicate = currentList.some(item => (typeof item === 'string' ? item : item.name).toLowerCase() === val.toLowerCase());
      if (!isDuplicate) {
        setConfigs(prev => {
          const updatedList = (settingsActiveTab === 'weavers' || settingsActiveTab === 'mills')
            ? [...(prev[settingsActiveTab] || []), normalizeParty(val)]
            : [...(prev[settingsActiveTab] || []), val];
          const updated = {
            ...prev,
            [settingsActiveTab]: updatedList
          };
          try { localStorage.setItem(STORAGE_CONFIGS_KEY, JSON.stringify(updated)); } catch (err) {}
          return updated;
        });
      }
    }
    setNewSettingInput('');
    setEditingItemIndex(null);
    setShowSettingsModal(false);
  };

  const handleRestoreStandardDefaults = async () => {
    const confirmed = await triggerEliteConfirm({
      title: 'Load Standard Surat Defaults',
      message: 'Would you like to populate standard Surat textile defaults (Weavers, Fabric Qualities, Mills, and Process Types)? Existing entries will be preserved.',
      confirmText: 'Load Defaults',
      cancelText: 'Cancel',
      type: 'info'
    });
    if (confirmed) {
      setConfigs(prev => {
        const mergedWeavers = [...(prev.weavers || [])];
        STANDARD_SURAT_CONFIGS.weavers.forEach(sw => {
          if (!mergedWeavers.some(w => getPartyName(w).toLowerCase() === sw.name.toLowerCase())) {
            mergedWeavers.push(sw);
          }
        });

        const mergedQualities = [...(prev.qualities || [])];
        STANDARD_SURAT_CONFIGS.qualities.forEach(sq => {
          if (!mergedQualities.some(q => q.toLowerCase() === sq.toLowerCase())) {
            mergedQualities.push(sq);
          }
        });

        const mergedMills = [...(prev.mills || [])];
        STANDARD_SURAT_CONFIGS.mills.forEach(sm => {
          if (!mergedMills.some(m => getPartyName(m).toLowerCase() === sm.name.toLowerCase())) {
            mergedMills.push(sm);
          }
        });

        const mergedProcesses = [...(prev.processes || [])];
        STANDARD_SURAT_CONFIGS.processes.forEach(sp => {
          if (!mergedProcesses.some(p => p.toLowerCase() === sp.toLowerCase())) {
            mergedProcesses.push(sp);
          }
        });

        const updated = {
          weavers: mergedWeavers,
          qualities: mergedQualities,
          mills: mergedMills,
          processes: mergedProcesses
        };
        try { localStorage.setItem(STORAGE_CONFIGS_KEY, JSON.stringify(updated)); } catch (err) {}
        return updated;
      });
      triggerEliteAlert('Standard Surat textile presets loaded successfully!', 'Defaults Loaded');
    }
  };

  const handleStartEditMasterSetting = (index, value) => {
    setEditingItemIndex(index);
    setEditingItemValue(typeof value === 'object' ? value.name : value);
  };

  const handleSaveEditMasterSetting = (index) => {
    const val = editingItemValue.trim();
    if (!val) return;
    setConfigs(prev => {
      const updatedList = [...prev[settingsActiveTab]];
      if (typeof updatedList[index] === 'object') {
        updatedList[index] = { ...updatedList[index], name: val };
      } else {
        updatedList[index] = val;
      }
      const updated = { ...prev, [settingsActiveTab]: updatedList };
      try { localStorage.setItem(STORAGE_CONFIGS_KEY, JSON.stringify(updated)); } catch (err) {}
      return updated;
    });
    setEditingItemIndex(null);
    setEditingItemValue('');
    triggerEliteAlert(`Updated to "${val}".`, 'Item Updated');
  };

  const handleDeleteMasterSetting = async (index, item) => {
    const itemName = typeof item === 'object' ? item.name : item;
    const confirmed = await triggerEliteConfirm({
      title: 'Delete Master Item',
      message: `Are you sure you want to remove "${itemName}" from master list?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });
    if (confirmed) {
      setConfigs(prev => {
        const currentList = prev[settingsActiveTab] || [];
        const updatedList = currentList.filter((it, idx) => {
          if (idx === index) return false;
          if (typeof it === 'object' && typeof item === 'object' && it.name && item.name) {
            return it.name.trim().toLowerCase() !== item.name.trim().toLowerCase();
          }
          if (typeof it === 'string' && typeof item === 'string') {
            return it.trim().toLowerCase() !== item.trim().toLowerCase();
          }
          return true;
        });
        const updated = {
          ...prev,
          [settingsActiveTab]: updatedList
        };
        try { localStorage.setItem(STORAGE_CONFIGS_KEY, JSON.stringify(updated)); } catch (err) {}
        return updated;
      });
      triggerEliteAlert(`"${itemName}" removed from master list.`, 'Item Removed');
    }
  };

  // ==========================================
  // WEAVER INWARD FORM TP ROW HELPERS
  // ==========================================
  const handleTpChange = (index, field, value) => {
    setWeaverForm(prev => {
      const updated = [...prev.tps];
      if (field === 'tpMtr') {
        const clean = value.replace(/[^0-9.]/g, '');
        const parts = clean.split('.');
        const validVal = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : clean;
        updated[index] = { ...updated[index], [field]: validVal };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return { ...prev, tps: updated };
    });
  };

  // Auto-generate rows when user inputs number of received TPs
  const handleSetTpRowCount = (val) => {
    setTpCountInput(val);
    const count = parseInt(val, 10);
    if (isNaN(count) || count < 1) {
      return;
    }
    const safeCount = Math.min(Math.max(count, 1), 500);
    setWeaverForm(prev => {
      const current = [...prev.tps];
      if (current.length === safeCount) return prev;
      if (current.length < safeCount) {
        const needed = safeCount - current.length;
        const newRows = [];
        for (let i = 0; i < needed; i++) {
          const nextSr = current.length + i + 1;
          newRows.push({
            srNo: nextSr,
            tpNo: `TP-${nextSr}`,
            tpMtr: ''
          });
        }
        return { ...prev, tps: [...current, ...newRows] };
      } else {
        const trimmed = current.slice(0, safeCount).map((item, idx) => ({ ...item, srNo: idx + 1 }));
        return { ...prev, tps: trimmed };
      }
    });
  };

  const handleAddTpRow = () => {
    setWeaverForm(prev => {
      const nextSr = prev.tps.length + 1;
      const updated = [...prev.tps, { srNo: nextSr, tpNo: `TP-${nextSr}`, tpMtr: '' }];
      setTpCountInput(String(updated.length));
      return {
        ...prev,
        tps: updated
      };
    });
  };

  const handleAddMultipleTpRows = (count = 5) => {
    setWeaverForm(prev => {
      const updated = [...prev.tps];
      for (let i = 0; i < count; i++) {
        const nextSr = updated.length + 1;
        updated.push({ srNo: nextSr, tpNo: `TP-${nextSr}`, tpMtr: '' });
      }
      setTpCountInput(String(updated.length));
      return { ...prev, tps: updated };
    });
  };

  const handleClearAllTps = () => {
    setTpCountInput('1');
    setWeaverForm(prev => ({
      ...prev,
      tps: [{ srNo: 1, tpNo: 'TP-1', tpMtr: '' }]
    }));
  };

  const handleRemoveTpRow = (index) => {
    setWeaverForm(prev => {
      const filtered = prev.tps.filter((_, idx) => idx !== index);
      const reIndexed = filtered.map((item, idx) => ({ ...item, srNo: idx + 1 }));
      const result = reIndexed.length > 0 ? reIndexed : [{ srNo: 1, tpNo: 'TP-1', tpMtr: '' }];
      setTpCountInput(String(result.length));
      return { ...prev, tps: result };
    });
  };

  const handleTpKeyDown = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === weaverForm.tps.length - 1) {
        handleAddTpRow();
      }
      setTimeout(() => {
        const nextInput = document.getElementById(`tp-mtr-input-${index + 1}`);
        if (nextInput) nextInput.focus();
      }, 50);
    }
  };

  const weaverFormSummary = useMemo(() => {
    let totalMtrs = 0;
    let filledTps = 0;
    weaverForm.tps.forEach(tp => {
      const m = parseFloat(tp.tpMtr);
      if (!isNaN(m) && m > 0) {
        totalMtrs += m;
        filledTps++;
      }
    });
    const roundMtrs = parseFloat(totalMtrs.toFixed(2));
    const rate = parseFloat(weaverForm.ratePerMeter) || 0;
    const gstPct = parseFloat(weaverForm.gstRate) || 0;
    const taxableAmount = parseFloat((roundMtrs * rate).toFixed(2));
    const gstAmount = parseFloat(((taxableAmount * gstPct) / 100).toFixed(2));
    const grandTotal = parseFloat((taxableAmount + gstAmount).toFixed(2));

    return {
      totalMtrs: roundMtrs,
      totalTps: filledTps,
      filledTps,
      avgMtr: filledTps > 0 ? (totalMtrs / filledTps).toFixed(2) : 0,
      rate,
      gstPct,
      taxableAmount,
      gstAmount,
      grandTotal
    };
  }, [weaverForm.tps, weaverForm.ratePerMeter, weaverForm.gstRate]);

  const selectedWeaverDetails = useMemo(() => {
    const name = (weaverForm.weaverParty || '').trim().toLowerCase();
    if (!name) return null;
    const found = (configs.weavers || []).find(w => getPartyName(w).toLowerCase() === name);
    return found ? normalizeParty(found) : null;
  }, [weaverForm.weaverParty, configs.weavers]);

  const selectedMillDetails = useMemo(() => {
    const name = (millChallanForm.millParty || '').trim().toLowerCase();
    if (!name) return null;
    const found = (configs.mills || []).find(m => getPartyName(m).toLowerCase() === name);
    return found ? normalizeParty(found) : null;
  }, [millChallanForm.millParty, configs.mills]);

  const handleSaveWeaverInward = async (e) => {
    e.preventDefault();
    if (!weaverForm.weaverParty.trim()) {
      triggerEliteAlert('Please enter Weaver / Loom Owner Party Name.', 'Missing Weaver');
      return;
    }
    if (!weaverForm.fabricQuality) {
      triggerEliteAlert('Please select Fabric Quality from the dropdown.', 'Missing Quality');
      return;
    }
    const validTps = weaverForm.tps.filter(t => {
      const m = parseFloat(t.tpMtr);
      return !isNaN(m) && m > 0;
    });

    if (validTps.length === 0) {
      triggerEliteAlert('Please enter meters for at least one TP.', 'No TP Meters');
      return;
    }

    const nextId = `GRAY-2026-${String(grayLots.length + 1).padStart(3, '0')}`;
    const lotNumber = weaverForm.lotNumber.trim() || nextId;
    const totalMeters = validTps.reduce((sum, t) => sum + parseFloat(t.tpMtr), 0);
    const roundMtrs = parseFloat(totalMeters.toFixed(2));
    const ratePerMtr = parseFloat(weaverForm.ratePerMeter) || 0;
    const gstPct = parseFloat(weaverForm.gstRate) || 0;
    const taxableAmt = parseFloat((roundMtrs * ratePerMtr).toFixed(2));
    const gstAmt = parseFloat(((taxableAmt * gstPct) / 100).toFixed(2));
    const totalInvAmt = Math.round(taxableAmt + gstAmt);
    const roundOffVal = parseFloat((totalInvAmt - (taxableAmt + gstAmt)).toFixed(2));

    const isPending = weaverForm.invoiceReceivedOption === 'pending';
    let createdPurchaseNo = '';
    let createdPurchaseId = '';

    // Auto-create Purchase in Billing Register if enabled, not pending, and rate is provided
    if (!isPending && weaverForm.postToPurchase && ratePerMtr > 0) {
      try {
        let nextPurNo = '';
        try {
          const numRes = await api.getNextPurchaseNo(companyEntity);
          if (numRes && (numRes.purchaseNo || numRes.nextPurchaseNo || numRes.data)) {
            nextPurNo = numRes.purchaseNo || numRes.nextPurchaseNo || numRes.data;
          }
        } catch (numErr) {
          console.warn('Could not fetch next purchase no from backend:', numErr);
        }

        if (!nextPurNo) {
          const curYear = new Date().getFullYear();
          nextPurNo = `PUR-${curYear}-${String(Date.now()).slice(-4)}`;
        }

        let dueDateObj = new Date(weaverForm.invoiceDate || weaverForm.inwardDate || new Date());
        const term = weaverForm.paymentTerms || '30 Days';
        if (term === '15 Days') dueDateObj.setDate(dueDateObj.getDate() + 15);
        else if (term === '45 Days') dueDateObj.setDate(dueDateObj.getDate() + 45);
        else if (term === '60 Days') dueDateObj.setDate(dueDateObj.getDate() + 60);
        else if (term === 'Immediate Cash') { /* same day */ }
        else dueDateObj.setDate(dueDateObj.getDate() + 30);

        const purchasePayload = {
          companyEntity,
          purchaseNo: nextPurNo,
          billNo: (weaverForm.invoiceNo || weaverForm.weaverChallanNo || lotNumber).trim(),
          purchaseType: 'inventory',
          ourChallanNo: lotNumber,
          date: weaverForm.invoiceDate || weaverForm.inwardDate,
          dueDate: dueDateObj.toISOString().split('T')[0],
          vendorName: weaverForm.weaverParty.trim(),
          vendor: {
            name: weaverForm.weaverParty.trim(),
            businessName: weaverForm.weaverParty.trim(),
            phone: selectedWeaverDetails?.phone || '',
            gstin: selectedWeaverDetails?.gst || '',
            billingAddress: selectedWeaverDetails?.address || '',
            shippingAddress: selectedWeaverDetails?.address || '',
            state: 'Gujarat',
            stateCode: '24'
          },
          items: [{
            itemName: `${weaverForm.fabricQuality} (Gray Fabric)`,
            description: `Yamunaji Gray Lot ${lotNumber} from ${weaverForm.weaverParty.trim()} (${validTps.length} TPs)`,
            fabric: weaverForm.fabricQuality,
            fabricName: weaverForm.fabricQuality,
            lotNo: lotNumber,
            partyChallan: weaverForm.weaverChallanNo || '',
            ourChallanNo: lotNumber,
            hsnCode: weaverForm.hsnCode || '5208',
            quantity: roundMtrs,
            qty: roundMtrs,
            unit: 'Meters',
            rate: ratePerMtr,
            unitPrice: ratePerMtr,
            discountPct: 0,
            discountAmt: 0,
            taxRate: gstPct,
            taxAmount: gstAmt,
            amount: taxableAmt,
            totalAmount: totalInvAmt
          }],
          itemName: `${weaverForm.fabricQuality} (Gray Fabric)`,
          quantity: roundMtrs,
          unit: 'Meters',
          rate: ratePerMtr,
          subtotal: taxableAmt,
          subtotalAmount: taxableAmt,
          taxableAmount: taxableAmt,
          discountType: 'flat',
          discountValue: 0,
          discountTotal: 0,
          taxType: 'CGST_SGST',
          gstRate: gstPct,
          cgstAmount: parseFloat((gstAmt / 2).toFixed(2)),
          sgstAmount: parseFloat((gstAmt / 2).toFixed(2)),
          igstAmount: 0,
          totalTax: gstAmt,
          gstAmount: gstAmt,
          enableRoundOff: true,
          roundOff: roundOffVal,
          totalAmount: totalInvAmt,
          grandTotal: totalInvAmt,
          paidAmount: 0,
          balanceDue: totalInvAmt,
          paymentStatus: 'UNPAID',
          notes: `Yamunaji Gray Fabric Inward Lot ${lotNumber} | Weaver: ${weaverForm.weaverParty.trim()} | Challan: ${weaverForm.weaverChallanNo || 'N/A'}`,
          terms: term
        };

        const purRes = await api.createBillingPurchase(purchasePayload);
        const savedPur = (purRes && purRes.data) ? purRes.data : { ...purchasePayload, id: `pur_${Date.now()}` };
        createdPurchaseNo = savedPur.purchaseNo || nextPurNo;
        createdPurchaseId = savedPur._id || savedPur.id || '';

        // Sync with local cache for EliteBillingDepartment
        try {
          const cacheKey = `elite_purchases_${companyEntity}`;
          const cached = localStorage.getItem(cacheKey);
          let currentList = cached ? JSON.parse(cached) : [];
          if (!Array.isArray(currentList)) currentList = [];
          currentList.unshift(savedPur);
          localStorage.setItem(cacheKey, JSON.stringify(currentList));
        } catch (cErr) {}

        // Dispatch window event so billing updates live
        window.dispatchEvent(new CustomEvent('elite-data-refresh', { detail: { source: 'billing' } }));
      } catch (purErr) {
        console.error('Failed to create purchase in backend:', purErr);
      }
    }

    const newGrayLot = {
      id: nextId,
      lotNumber,
      inwardDate: weaverForm.inwardDate,
      weaverParty: weaverForm.weaverParty.trim(),
      weaverChallanNo: weaverForm.weaverChallanNo.trim() || 'Direct Inward',
      fabricQuality: weaverForm.fabricQuality,
      totalTps: validTps.length,
      totalMeters: roundMtrs,
      sentToMillMeters: 0,
      ratePerMeter: ratePerMtr,
      status: 'In Stock',
      rackLocation: weaverForm.rackLocation.trim() || '',
      remarks: weaverForm.remarks.trim(),
      // Invoice & Purchase parameters
      invoiceStatus: isPending ? 'Pending' : 'Invoiced',
      invoiceReceivedOption: weaverForm.invoiceReceivedOption,
      invoiceNo: isPending ? '' : (weaverForm.invoiceNo || '').trim(),
      invoiceDate: isPending ? null : (weaverForm.invoiceDate || weaverForm.inwardDate),
      hsnCode: weaverForm.hsnCode || '5208',
      gstRate: gstPct,
      taxableAmount: isPending ? 0 : taxableAmt,
      gstAmount: isPending ? 0 : gstAmt,
      grandTotal: isPending ? 0 : totalInvAmt,
      paymentTerms: weaverForm.paymentTerms || '30 Days',
      postToPurchase: !isPending && weaverForm.postToPurchase,
      purchaseNo: createdPurchaseNo || null,
      purchaseId: createdPurchaseId || null,
      tps: validTps.map((t, idx) => ({
        srNo: idx + 1,
        tpNo: t.tpNo ? t.tpNo.trim() : String(idx + 1),
        tpMtr: parseFloat(t.tpMtr),
        status: 'In Stock',
        millChallanNo: null
      }))
    };

    setGrayLots(prev => [newGrayLot, ...prev]);
    setShowWeaverInwardModal(false);

    // Auto-save weaver party to master configs if not yet present
    const enteredWeaver = weaverForm.weaverParty.trim();
    if (enteredWeaver) {
      setConfigs(prev => {
        const list = prev.weavers || [];
        if (!list.some(w => getPartyName(w).toLowerCase() === enteredWeaver.toLowerCase())) {
          const updated = { ...prev, weavers: [...list, normalizeParty(enteredWeaver)] };
          try { localStorage.setItem(STORAGE_CONFIGS_KEY, JSON.stringify(updated)); } catch (err) {}
          return updated;
        }
        return prev;
      });
    }

    // Auto-save fabric quality to master configs if not yet present
    const enteredQuality = (weaverForm.fabricQuality || '').trim();
    if (enteredQuality) {
      setConfigs(prev => {
        const list = prev.qualities || [];
        if (!list.some(q => q.toLowerCase() === enteredQuality.toLowerCase())) {
          const updated = { ...prev, qualities: [...list, enteredQuality] };
          try { localStorage.setItem(STORAGE_CONFIGS_KEY, JSON.stringify(updated)); } catch (err) {}
          return updated;
        }
        return prev;
      });
    }

    // Reset Form to clean slate
    setWeaverForm({
      lotNumber: '',
      inwardDate: new Date().toISOString().split('T')[0],
      weaverParty: '',
      weaverChallanNo: '',
      fabricQuality: '',
      ratePerMeter: '',
      rackLocation: '',
      remarks: '',
      invoiceReceivedOption: 'received',
      invoiceNo: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      hsnCode: '5208',
      gstRate: '5',
      paymentTerms: '30 Days',
      postToPurchase: true,
      tps: [
        { srNo: 1, tpNo: 'TP-1', tpMtr: '' }
      ]
    });
    setTpCountInput('');

    let successMsg = `Gray Fabric Lot ${lotNumber} (${validTps.length} TPs, ${roundMtrs.toFixed(1)} Mtr) successfully inwarded!`;
    if (isPending) {
      successMsg += `\n⏳ Marked as 'Invoice Pending'. You can attach the invoice later.`;
    } else if (createdPurchaseNo) {
      successMsg += `\n🧾 Purchase Bill ${createdPurchaseNo} (₹${totalInvAmt.toLocaleString('en-IN')}) posted to Purchase Register.`;
    }
    triggerEliteAlert(successMsg, isPending ? 'Inward Saved (Invoice Pending)' : 'Inward & Purchase Saved');
  };

  // Open modal to attach invoice for a pending lot
  const handleOpenAttachInvoice = (lot) => {
    setAttachingInvoiceLot(lot);
    setAttachInvoiceForm({
      invoiceNo: lot.invoiceNo || '',
      invoiceDate: lot.invoiceDate || new Date().toISOString().split('T')[0],
      hsnCode: lot.hsnCode || '5208',
      ratePerMeter: lot.ratePerMeter > 0 ? String(lot.ratePerMeter) : '',
      gstRate: String(lot.gstRate !== undefined ? lot.gstRate : '5'),
      paymentTerms: lot.paymentTerms || '30 Days',
      postToPurchase: true
    });
  };

  // Save attached invoice and post to purchase register
  const handleSaveAttachInvoice = async (e) => {
    e.preventDefault();
    if (!attachingInvoiceLot) return;
    if (!attachInvoiceForm.invoiceNo.trim()) {
      triggerEliteAlert('Please enter the Weaver Invoice / Bill Number.', 'Missing Invoice Number');
      return;
    }
    const rate = parseFloat(attachInvoiceForm.ratePerMeter) || 0;
    if (rate <= 0) {
      triggerEliteAlert('Please enter a valid Rate per Meter (greater than 0).', 'Invalid Rate');
      return;
    }

    const roundMtrs = parseFloat(attachingInvoiceLot.totalMeters.toFixed(2));
    const gstPct = parseFloat(attachInvoiceForm.gstRate) || 0;
    const taxableAmt = parseFloat((roundMtrs * rate).toFixed(2));
    const gstAmt = parseFloat(((taxableAmt * gstPct) / 100).toFixed(2));
    const totalInvAmt = Math.round(taxableAmt + gstAmt);
    const roundOffVal = parseFloat((totalInvAmt - (taxableAmt + gstAmt)).toFixed(2));

    let createdPurchaseNo = '';
    let createdPurchaseId = '';

    if (attachInvoiceForm.postToPurchase) {
      try {
        let nextPurNo = '';
        try {
          const numRes = await api.getNextPurchaseNo(companyEntity);
          if (numRes && (numRes.purchaseNo || numRes.nextPurchaseNo || numRes.data)) {
            nextPurNo = numRes.purchaseNo || numRes.nextPurchaseNo || numRes.data;
          }
        } catch (numErr) {}
        if (!nextPurNo) {
          nextPurNo = `PUR-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
        }

        let dueDateObj = new Date(attachInvoiceForm.invoiceDate || new Date());
        const term = attachInvoiceForm.paymentTerms || '30 Days';
        if (term === '15 Days') dueDateObj.setDate(dueDateObj.getDate() + 15);
        else if (term === '45 Days') dueDateObj.setDate(dueDateObj.getDate() + 45);
        else if (term === '60 Days') dueDateObj.setDate(dueDateObj.getDate() + 60);
        else if (term === 'Immediate Cash') { /* same day */ }
        else dueDateObj.setDate(dueDateObj.getDate() + 30);

        const weaverDetails = (configs.weavers || []).find(w => getPartyName(w).toLowerCase() === (attachingInvoiceLot.weaverParty || '').toLowerCase());
        const normWeaver = weaverDetails ? normalizeParty(weaverDetails) : null;

        const purchasePayload = {
          companyEntity,
          purchaseNo: nextPurNo,
          billNo: attachInvoiceForm.invoiceNo.trim(),
          purchaseType: 'inventory',
          ourChallanNo: attachingInvoiceLot.lotNumber,
          date: attachInvoiceForm.invoiceDate,
          dueDate: dueDateObj.toISOString().split('T')[0],
          vendorName: attachingInvoiceLot.weaverParty,
          vendor: {
            name: attachingInvoiceLot.weaverParty,
            businessName: attachingInvoiceLot.weaverParty,
            phone: normWeaver?.phone || '',
            gstin: normWeaver?.gst || '',
            billingAddress: normWeaver?.address || '',
            shippingAddress: normWeaver?.address || '',
            state: 'Gujarat',
            stateCode: '24'
          },
          items: [{
            itemName: `${attachingInvoiceLot.fabricQuality} (Gray Fabric)`,
            description: `Yamunaji Gray Lot ${attachingInvoiceLot.lotNumber} from ${attachingInvoiceLot.weaverParty}`,
            fabric: attachingInvoiceLot.fabricQuality,
            fabricName: attachingInvoiceLot.fabricQuality,
            lotNo: attachingInvoiceLot.lotNumber,
            partyChallan: attachingInvoiceLot.weaverChallanNo || '',
            ourChallanNo: attachingInvoiceLot.lotNumber,
            hsnCode: attachInvoiceForm.hsnCode || '5208',
            quantity: roundMtrs,
            qty: roundMtrs,
            unit: 'Meters',
            rate: rate,
            unitPrice: rate,
            taxRate: gstPct,
            taxAmount: gstAmt,
            amount: taxableAmt,
            totalAmount: totalInvAmt
          }],
          itemName: `${attachingInvoiceLot.fabricQuality} (Gray Fabric)`,
          quantity: roundMtrs,
          unit: 'Meters',
          rate: rate,
          subtotal: taxableAmt,
          taxableAmount: taxableAmt,
          discountType: 'flat',
          discountValue: 0,
          discountTotal: 0,
          taxType: 'CGST_SGST',
          gstRate: gstPct,
          cgstAmount: parseFloat((gstAmt / 2).toFixed(2)),
          sgstAmount: parseFloat((gstAmt / 2).toFixed(2)),
          igstAmount: 0,
          totalTax: gstAmt,
          gstAmount: gstAmt,
          enableRoundOff: true,
          roundOff: roundOffVal,
          totalAmount: totalInvAmt,
          grandTotal: totalInvAmt,
          paidAmount: 0,
          balanceDue: totalInvAmt,
          paymentStatus: 'UNPAID',
          notes: `Weaver Invoice attached to Lot ${attachingInvoiceLot.lotNumber} | Challan: ${attachingInvoiceLot.weaverChallanNo || 'N/A'}`,
          terms: term
        };

        const purRes = await api.createBillingPurchase(purchasePayload);
        const savedPur = (purRes && purRes.data) ? purRes.data : { ...purchasePayload, id: `pur_${Date.now()}` };
        createdPurchaseNo = savedPur.purchaseNo || nextPurNo;
        createdPurchaseId = savedPur._id || savedPur.id || '';

        try {
          const cacheKey = `elite_purchases_${companyEntity}`;
          const cached = localStorage.getItem(cacheKey);
          let currentList = cached ? JSON.parse(cached) : [];
          if (!Array.isArray(currentList)) currentList = [];
          currentList.unshift(savedPur);
          localStorage.setItem(cacheKey, JSON.stringify(currentList));
        } catch (cErr) {}

        window.dispatchEvent(new CustomEvent('elite-data-refresh', { detail: { source: 'billing' } }));
      } catch (purErr) {
        console.error('Failed to auto-create purchase when attaching invoice:', purErr);
      }
    }

    setGrayLots(prev => prev.map(l => {
      if (l.id === attachingInvoiceLot.id) {
        return {
          ...l,
          invoiceNo: attachInvoiceForm.invoiceNo.trim(),
          invoiceDate: attachInvoiceForm.invoiceDate,
          hsnCode: attachInvoiceForm.hsnCode || '5208',
          ratePerMeter: rate,
          gstRate: gstPct,
          taxableAmount: taxableAmt,
          gstAmount: gstAmt,
          grandTotal: totalInvAmt,
          paymentTerms: attachInvoiceForm.paymentTerms || '30 Days',
          invoiceStatus: 'Invoiced',
          purchaseNo: createdPurchaseNo || l.purchaseNo || null,
          purchaseId: createdPurchaseId || l.purchaseId || null
        };
      }
      return l;
    }));

    setAttachingInvoiceLot(null);

    let msg = `Invoice ${attachInvoiceForm.invoiceNo} successfully attached to Lot ${attachingInvoiceLot.lotNumber}!`;
    if (createdPurchaseNo) {
      msg += `\n🧾 Purchase Bill ${createdPurchaseNo} (₹${totalInvAmt.toLocaleString('en-IN')}) posted to Purchase Register.`;
    }
    triggerEliteAlert(msg, 'Invoice Attached & Saved');
  };

  // ==========================================
  // MILL OUTWARD CHALLAN HELPERS
  // ==========================================
  // All unique fabric qualities with live stock counters
  const grayStockQualities = useMemo(() => {
    const map = new Map();
    // Pre-populate with master configs
    (configs.qualities || []).forEach(q => {
      map.set(q, { inStockTps: 0, totalTps: 0, inStockMtr: 0 });
    });
    // Tally from actual gray lots
    grayLots.forEach(lot => {
      const q = lot.fabricQuality || 'Gray Fabric';
      if (!map.has(q)) {
        map.set(q, { inStockTps: 0, totalTps: 0, inStockMtr: 0 });
      }
      const data = map.get(q);
      (lot.tps || []).forEach(tp => {
        data.totalTps += 1;
        if (tp.status === 'In Stock') {
          data.inStockTps += 1;
          data.inStockMtr += Number(tp.tpMtr) || 0;
        }
      });
    });

    return Array.from(map.entries()).map(([quality, stats]) => ({
      quality,
      ...stats
    }));
  }, [grayLots, configs.qualities]);

  // Inward Challans/Lots matching the selected Fabric Quality
  const lotsMatchingQuality = useMemo(() => {
    const selectedQ = millChallanForm.fabricQuality;
    if (!selectedQ) return grayLots;
    return grayLots.filter(lot => lot.fabricQuality === selectedQ);
  }, [grayLots, millChallanForm.fabricQuality]);

  // Inward lots filtered by selected inward challan/lot
  const lotsForOutwardSelection = useMemo(() => {
    if (!millChallanForm.selectedLotId || millChallanForm.selectedLotId === 'all') {
      return lotsMatchingQuality;
    }
    return lotsMatchingQuality.filter(lot => String(lot.id) === String(millChallanForm.selectedLotId));
  }, [lotsMatchingQuality, millChallanForm.selectedLotId]);

  // All TPs in the filtered lots for outward dispatch display:
  // Shows BOTH In Stock (selectable) and Already Outwarded (disabled, non-selectable)
  const displayedTpsForOutward = useMemo(() => {
    const list = [];
    lotsForOutwardSelection.forEach(lot => {
      (lot.tps || []).forEach((tp, tpIdx) => {
        const isOutwarded = tp.status === 'Sent to Mill';
        const isInStock = tp.status === 'In Stock';
        list.push({
          lotId: lot.id,
          lotNumber: lot.lotNumber,
          weaverParty: lot.weaverParty,
          weaverChallanNo: lot.weaverChallanNo || lot.lotNumber,
          fabricQuality: lot.fabricQuality,
          tpIndex: tpIdx,
          srNo: tp.srNo,
          tpNo: tp.tpNo,
          tpMtr: tp.tpMtr,
          status: tp.status,
          millChallanNo: tp.millChallanNo,
          isOutwarded,
          isInStock
        });
      });
    });
    return list;
  }, [lotsForOutwardSelection]);

  const availableInStockTpsCount = useMemo(() => {
    return displayedTpsForOutward.filter(t => t.isInStock).length;
  }, [displayedTpsForOutward]);

  const outwardedTpsCount = useMemo(() => {
    return displayedTpsForOutward.filter(t => t.isOutwarded).length;
  }, [displayedTpsForOutward]);

  // Only In-Stock TPs that are checked
  const selectedMillTps = useMemo(() => {
    return displayedTpsForOutward.filter(t => {
      if (!t.isInStock) return false;
      const key = `${t.lotId}__${t.tpIndex}`;
      return Boolean(millChallanForm.selectedTpKeys[key]);
    });
  }, [displayedTpsForOutward, millChallanForm.selectedTpKeys]);

  const millSelectedTotalMtrs = useMemo(() => {
    return selectedMillTps.reduce((sum, t) => sum + (Number(t.tpMtr) || 0), 0);
  }, [selectedMillTps]);

  const handleToggleTpSelection = (lotId, tpIndex, isInStock) => {
    if (!isInStock) return; // Cannot select already outwarded TP
    const key = `${lotId}__${tpIndex}`;
    setMillChallanForm(prev => ({
      ...prev,
      selectedTpKeys: {
        ...prev.selectedTpKeys,
        [key]: !prev.selectedTpKeys[key]
      }
    }));
  };

  const handleSelectAllInStock = () => {
    const updated = { ...millChallanForm.selectedTpKeys };
    displayedTpsForOutward.forEach(t => {
      if (t.isInStock) {
        const key = `${t.lotId}__${t.tpIndex}`;
        updated[key] = true;
      }
    });
    setMillChallanForm(prev => ({ ...prev, selectedTpKeys: updated }));
  };

  const handleDeselectAllInStock = () => {
    setMillChallanForm(prev => ({ ...prev, selectedTpKeys: {} }));
  };

  const handleQualityChangeForOutward = (quality) => {
    setMillChallanForm(prev => ({
      ...prev,
      fabricQuality: quality,
      selectedLotId: 'all',
      selectedTpKeys: {} // clear selection when switching quality
    }));
  };

  const openMillChallanModal = (preselectedQuality) => {
    let qual = preselectedQuality || millChallanForm.fabricQuality;
    if (!qual) {
      for (const lot of grayLots) {
        if ((lot.tps || []).some(t => t.status === 'In Stock')) {
          qual = lot.fabricQuality;
          break;
        }
      }
      if (!qual) qual = configs.qualities[0] || 'Pure Viscose Rayon 14kg';
    }
    setMillChallanForm(prev => ({
      ...prev,
      fabricQuality: qual,
      selectedLotId: 'all',
      selectedTpKeys: {}
    }));
    setShowMillChallanModal(true);
  };

  // ==========================================
  // UNIFIED MULTI-FILTER ENGINE & DATASETS
  // ==========================================
  const dateRangeBounds = useMemo(() => {
    if (!datePreset || datePreset === 'all') return { start: '', end: '' };
    const res = getDatePresetRange(datePreset, customDateStart, customDateEnd);
    return {
      start: res?.dateStart || dateStart || '',
      end: res?.dateEnd || dateEnd || ''
    };
  }, [datePreset, customDateStart, customDateEnd, dateStart, dateEnd]);

  const matchesDateRange = useCallback((itemDateStr) => {
    if (!datePreset || datePreset === 'all') return true;
    if (!itemDateStr) return false;

    const cleanDateStr = String(itemDateStr).trim().split('T')[0];
    let formattedItemDate = cleanDateStr;
    const dmy = cleanDateStr.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (dmy) {
      formattedItemDate = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    }

    const { start: effectiveStart, end: effectiveEnd } = dateRangeBounds;
    if (effectiveStart && formattedItemDate < effectiveStart) return false;
    if (effectiveEnd && formattedItemDate > effectiveEnd) return false;
    return true;
  }, [datePreset, dateRangeBounds]);

  const availableWeaverOptions = useMemo(() => {
    const set = new Set();
    (configs.weavers || []).forEach(w => {
      const name = typeof w === 'string' ? w : w?.name;
      if (name) set.add(name);
    });
    grayLots.forEach(l => {
      if (l.weaverParty) set.add(l.weaverParty);
    });
    return Array.from(set).sort();
  }, [configs.weavers, grayLots]);

  const availableQualityOptions = useMemo(() => {
    const set = new Set();
    (configs.qualities || []).forEach(q => {
      if (q) set.add(q);
    });
    grayLots.forEach(l => {
      if (l.fabricQuality) set.add(l.fabricQuality);
    });
    millChallans.forEach(c => {
      if (c.fabricQuality) set.add(c.fabricQuality);
    });
    rfdLots.forEach(r => {
      if (r.fabricQuality) set.add(r.fabricQuality);
    });
    return Array.from(set).sort();
  }, [configs.qualities, grayLots, millChallans, rfdLots]);

  const availableMillOptions = useMemo(() => {
    const set = new Set();
    (configs.mills || []).forEach(m => {
      const name = typeof m === 'string' ? m : m?.name;
      if (name) set.add(name);
    });
    millChallans.forEach(c => {
      if (c.millParty) set.add(c.millParty);
    });
    rfdLots.forEach(r => {
      if (r.millParty) set.add(r.millParty);
    });
    return Array.from(set).sort();
  }, [configs.mills, millChallans, rfdLots]);

  const filterCategories = useMemo(() => {
    if (screenMode === 'gray' && graySubTab === 'weaver_inward') {
      return [
        {
          id: 'quality',
          label: 'Fabric Quality',
          multi: true,
          options: availableQualityOptions
        },
        {
          id: 'weaver',
          label: 'Weaver / Loom Owner',
          multi: true,
          options: availableWeaverOptions
        },
        {
          id: 'status',
          label: 'Stock Status',
          multi: true,
          options: [
            { value: 'in_warehouse', label: 'In Warehouse (Available)' },
            { value: 'at_mill', label: 'At Mill (Sent Outward)' },
            { value: 'closed', label: 'Fully Dispatched / Cleared' }
          ]
        }
      ];
    } else if (screenMode === 'gray' && graySubTab === 'mill_outward') {
      return [
        {
          id: 'mill',
          label: 'Processing Mill',
          multi: true,
          options: availableMillOptions
        },
        {
          id: 'quality',
          label: 'Fabric Quality',
          multi: true,
          options: availableQualityOptions
        },
        {
          id: 'status',
          label: 'Challan Status',
          multi: true,
          options: [
            { value: 'open', label: 'At Mill (Pending)' },
            { value: 'partial', label: 'Partially Received' },
            { value: 'closed', label: 'Fully Received / Closed' }
          ]
        }
      ];
    } else {
      // RFD Mode
      return [
        {
          id: 'mill',
          label: 'Processing Mill',
          multi: true,
          options: availableMillOptions
        },
        {
          id: 'quality',
          label: 'Fabric Quality',
          multi: true,
          options: availableQualityOptions
        },
        {
          id: 'status',
          label: 'Delivery Status',
          multi: true,
          options: [
            { value: 'closed', label: 'Final Delivery' },
            { value: 'partial', label: 'Partial Delivery' },
            { value: 'high_shortage', label: 'High Shortage (>4%)' }
          ]
        }
      ];
    }
  }, [screenMode, graySubTab, availableQualityOptions, availableWeaverOptions, availableMillOptions]);

  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setDatePreset('all');
    setDateStart('');
    setDateEnd('');
    setCustomDateStart('');
    setCustomDateEnd('');
    setActiveFilters({});
  }, []);

  // Filtered Gray Fabric Lots
  const filteredGrayLots = useMemo(() => {
    return grayLots.filter(lot => {
      if (!matchesDateRange(lot.inwardDate)) return false;

      // Quality filter
      if (activeFilters.quality && activeFilters.quality.length > 0) {
        if (!activeFilters.quality.includes(lot.fabricQuality)) return false;
      }

      // Weaver filter
      if (activeFilters.weaver && activeFilters.weaver.length > 0) {
        if (!activeFilters.weaver.includes(lot.weaverParty)) return false;
      }

      // Status filter
      if (activeFilters.status && activeFilters.status.length > 0) {
        const availableTps = (lot.tps || []).filter(t => t.status === 'In Stock');
        const inWarehouseMtr = availableTps.reduce((sum, t) => sum + (Number(t.tpMtr) || 0), 0);
        const atMillMtr = (lot.tps || []).filter(t => t.status === 'Sent to Mill').reduce((sum, t) => sum + (Number(t.tpMtr) || 0), 0);
        const isClosed = inWarehouseMtr <= 0 && atMillMtr <= 0 && (lot.totalMeters || 0) > 0;

        const matchesStatus = activeFilters.status.some(st => {
          if (st === 'in_warehouse') return inWarehouseMtr > 0;
          if (st === 'at_mill') return atMillMtr > 0;
          if (st === 'closed') return isClosed;
          return true;
        });
        if (!matchesStatus) return false;
      }

      // Invoice Status filter (Pending vs Invoiced)
      if (grayInvoiceFilter === 'pending') {
        const isPending = lot.invoiceStatus === 'Pending' || (!lot.invoiceNo && !lot.purchaseNo);
        if (!isPending) return false;
      } else if (grayInvoiceFilter === 'invoiced') {
        const isInvoiced = lot.invoiceStatus === 'Invoiced' || Boolean(lot.invoiceNo || lot.purchaseNo);
        if (!isInvoiced) return false;
      }

      if (searchQuery && searchQuery.trim() !== '') {
        const q = searchQuery.trim().toLowerCase();
        const matchLot = lot.lotNumber && lot.lotNumber.toLowerCase().includes(q);
        const matchWeaver = lot.weaverParty && lot.weaverParty.toLowerCase().includes(q);
        const matchChallan = lot.weaverChallanNo && String(lot.weaverChallanNo).toLowerCase().includes(q);
        const matchQuality = lot.fabricQuality && lot.fabricQuality.toLowerCase().includes(q);
        const matchTps = (lot.tps || []).some(t => String(t.tpNo || '').toLowerCase().includes(q) || String(t.srNo || '').includes(q));
        if (!matchLot && !matchWeaver && !matchChallan && !matchQuality && !matchTps) return false;
      }
      return true;
    });
  }, [grayLots, matchesDateRange, activeFilters, searchQuery, grayInvoiceFilter]);

  // Filtered Mill Outward Challans
  const filteredMillChallans = useMemo(() => {
    return millChallans.filter(ch => {
      if (!matchesDateRange(ch.challanDate)) return false;

      // Mill filter
      if (activeFilters.mill && activeFilters.mill.length > 0) {
        if (!activeFilters.mill.includes(ch.millParty)) return false;
      }

      // Quality filter
      if (activeFilters.quality && activeFilters.quality.length > 0) {
        if (!activeFilters.quality.includes(ch.fabricQuality)) return false;
      }

      // Status filter
      if (activeFilters.status && activeFilters.status.length > 0) {
        const sentMtr = parseFloat(ch.totalMeters) || 0;
        const chRfdLots = rfdLots.filter(l => l.sourceChallanId === ch.id || (ch.challanNo && l.millChallanNo === ch.challanNo));
        const chReceivedMtrs = chRfdLots.reduce((sum, l) => sum + (parseFloat(l.receivedRfdMeters) || 0), 0);
        const chShortageMtrs = chRfdLots.reduce((sum, l) => sum + (parseFloat(l.shrinkageLossMeters) || 0), 0);
        const isClosed = ch.isClosed || ch.status === 'Fully Received' || chRfdLots.some(l => l.isChallanClosed);
        const stillAtMill = isClosed ? 0 : Math.max(0, parseFloat((sentMtr - (chReceivedMtrs + chShortageMtrs)).toFixed(1)));
        const isPartiallyReceived = chReceivedMtrs > 0 && stillAtMill > 0;
        const isFullyReceived = isClosed || (chReceivedMtrs > 0 && stillAtMill === 0);
        const isOpen = stillAtMill > 0 && chReceivedMtrs === 0;

        const matchesStatus = activeFilters.status.some(st => {
          if (st === 'open') return isOpen;
          if (st === 'partial') return isPartiallyReceived;
          if (st === 'closed') return isFullyReceived;
          return true;
        });
        if (!matchesStatus) return false;
      }

      if (searchQuery && searchQuery.trim() !== '') {
        const q = searchQuery.trim().toLowerCase();
        const matchNo = ch.challanNo && ch.challanNo.toLowerCase().includes(q);
        const matchMill = ch.millParty && ch.millParty.toLowerCase().includes(q);
        const matchProcess = ch.processRequired && ch.processRequired.toLowerCase().includes(q);
        const matchVehicle = ch.vehicleNo && ch.vehicleNo.toLowerCase().includes(q);
        const matchQuality = ch.fabricQuality && ch.fabricQuality.toLowerCase().includes(q);
        if (!matchNo && !matchMill && !matchProcess && !matchVehicle && !matchQuality) return false;
      }
      return true;
    });
  }, [millChallans, rfdLots, matchesDateRange, activeFilters, searchQuery]);

  // Filtered RFD Processed Lots
  const filteredRfdLots = useMemo(() => {
    return rfdLots.filter(lot => {
      const lotDate = lot.inwardDate || lot.receivedDate;
      if (!matchesDateRange(lotDate)) return false;

      // Mill filter
      if (activeFilters.mill && activeFilters.mill.length > 0) {
        if (!activeFilters.mill.includes(lot.millParty)) return false;
      }

      // Quality filter
      if (activeFilters.quality && activeFilters.quality.length > 0) {
        if (!activeFilters.quality.includes(lot.fabricQuality)) return false;
      }

      // Status filter
      if (activeFilters.status && activeFilters.status.length > 0) {
        const isHighShortage = (lot.shrinkagePercent || 0) > 4.0;
        const isClosed = Boolean(lot.isChallanClosed);
        const isPartial = !isClosed;

        const matchesStatus = activeFilters.status.some(st => {
          if (st === 'high_shortage') return isHighShortage;
          if (st === 'closed') return isClosed;
          if (st === 'partial') return isPartial;
          return true;
        });
        if (!matchesStatus) return false;
      }

      if (searchQuery && searchQuery.trim() !== '') {
        const q = searchQuery.trim().toLowerCase();
        const matchLot = lot.lotNumber && lot.lotNumber.toLowerCase().includes(q);
        const matchMill = lot.millParty && lot.millParty.toLowerCase().includes(q);
        const matchChallan = lot.millChallanNo && String(lot.millChallanNo).toLowerCase().includes(q);
        const matchQuality = lot.fabricQuality && lot.fabricQuality.toLowerCase().includes(q);
        if (!matchLot && !matchMill && !matchChallan && !matchQuality) return false;
      }
      return true;
    });
  }, [rfdLots, matchesDateRange, activeFilters, searchQuery]);

  const handleCreateMillChallan = (e) => {
    e.preventDefault();
    if (!millChallanForm.millParty.trim()) {
      triggerEliteAlert('Please select or enter the Processing Mill name.', 'Missing Mill');
      return;
    }
    if (selectedMillTps.length === 0) {
      triggerEliteAlert('Please select at least one Gray Fabric TP to send to the mill.', 'No TPs Selected');
      return;
    }

    const challanNo = millChallanForm.challanNo.trim() || `MILL-CH-${String(millChallans.length + 101)}`;
    const totalMtrs = parseFloat(millSelectedTotalMtrs.toFixed(2));
    const primaryQuality = millChallanForm.fabricQuality || selectedMillTps[0]?.fabricQuality || 'Gray Fabric';
    const matchedMill = selectedMillDetails;

    const newChallan = {
      id: challanNo,
      challanNo,
      challanDate: millChallanForm.challanDate,
      millParty: millChallanForm.millParty.trim(),
      millGst: matchedMill?.gst || '',
      millAddress: matchedMill?.address || '',
      millCity: matchedMill?.city || 'Surat, Gujarat',
      millPhone: matchedMill?.phone || '',
      millContact: matchedMill?.contactPerson || '',
      vehicleNo: millChallanForm.vehicleNo.trim() || 'By Hand / Tempo',
      driverName: millChallanForm.driverName.trim() || 'Driver',
      processRequired: millChallanForm.processRequired,
      fabricQuality: primaryQuality,
      lotNumber: Array.from(new Set(selectedMillTps.map(t => t.lotNumber).filter(Boolean))).join(', ') || 'GRAY-LOT-MIX',
      totalTps: selectedMillTps.length,
      totalMeters: totalMtrs,
      status: 'At Mill',
      tps: selectedMillTps.map((t, idx) => ({
        srNo: idx + 1,
        lotNumber: t.lotNumber,
        tpNo: t.tpNo,
        tpMtr: t.tpMtr
      })),
      notes: millChallanForm.notes.trim()
    };

    setGrayLots(prev => prev.map(lot => {
      let lotHasSent = false;
      let additionalSentMtrs = 0;

      const updatedTps = (lot.tps || []).map((tp, tpIdx) => {
        const key = `${lot.id}__${tpIdx}`;
        if (millChallanForm.selectedTpKeys[key]) {
          lotHasSent = true;
          additionalSentMtrs += Number(tp.tpMtr) || 0;
          return {
            ...tp,
            status: 'Sent to Mill',
            millChallanNo: challanNo
          };
        }
        return tp;
      });

      if (lotHasSent) {
        const newSentMtr = (lot.sentToMillMeters || 0) + additionalSentMtrs;
        const allSent = updatedTps.every(t => t.status === 'Sent to Mill');
        return {
          ...lot,
          sentToMillMeters: parseFloat(newSentMtr.toFixed(2)),
          status: allSent ? 'Fully at Mill' : 'Partially at Mill',
          tps: updatedTps
        };
      }
      return lot;
    }));

    setMillChallans(prev => [newChallan, ...prev]);
    setShowMillChallanModal(false);

    // Auto-save mill party to master configs if not yet present
    const enteredMill = millChallanForm.millParty.trim();
    if (enteredMill) {
      setConfigs(prev => {
        const list = prev.mills || [];
        if (!list.some(m => getPartyName(m).toLowerCase() === enteredMill.toLowerCase())) {
          const updated = { ...prev, mills: [...list, normalizeParty(enteredMill)] };
          try { localStorage.setItem(STORAGE_CONFIGS_KEY, JSON.stringify(updated)); } catch (err) {}
          return updated;
        }
        return prev;
      });
    }

    // Auto-save process required to master configs if entered and not present
    const enteredProcess = (millChallanForm.processRequired || '').trim();
    if (enteredProcess) {
      setConfigs(prev => {
        const list = prev.processes || [];
        if (!list.some(p => p.toLowerCase() === enteredProcess.toLowerCase())) {
          const updated = { ...prev, processes: [...list, enteredProcess] };
          try { localStorage.setItem(STORAGE_CONFIGS_KEY, JSON.stringify(updated)); } catch (err) {}
          return updated;
        }
        return prev;
      });
    }

    setMillChallanForm({
      challanNo: '',
      challanDate: new Date().toISOString().split('T')[0],
      fabricQuality: '',
      selectedLotId: 'all',
      millParty: '',
      vehicleNo: '',
      driverName: '',
      processRequired: '',
      selectedTpKeys: {},
      notes: ''
    });

    triggerEliteAlert(`Mill Outward Challan ${challanNo} (${primaryQuality}) created for ${selectedMillTps.length} TPs (${totalMtrs} Mtr)!`, 'Challan Created');
  };

  // ==========================================
  // ✏️ Edit & Delete Handlers: Mill Challans
  // ==========================================
  const handleOpenEditMillChallan = (ch) => {
    setEditingMillChallan(ch);
    setEditChallanForm({
      challanNo: ch.challanNo || '',
      challanDate: ch.challanDate || '',
      millParty: ch.millParty || '',
      fabricQuality: ch.fabricQuality || '',
      processRequired: ch.processRequired || '',
      vehicleNo: ch.vehicleNo || '',
      driverName: ch.driverName || '',
      status: ch.status || 'In Processing at Mill',
      notes: ch.notes || ''
    });
  };

  const handleSaveEditMillChallan = (e) => {
    e.preventDefault();
    if (!editingMillChallan || !editChallanForm) return;

    const selectedMill = configs.mills.find(m => getPartyName(m) === editChallanForm.millParty);
    const oldChallanNo = editingMillChallan.challanNo;
    const newChallanNo = editChallanForm.challanNo.trim();

    setMillChallans(prev => prev.map(ch => {
      if (ch.id === editingMillChallan.id) {
        return {
          ...ch,
          ...editChallanForm,
          challanNo: newChallanNo,
          millGst: selectedMill?.gstin || ch.millGst,
          millAddress: selectedMill?.address || ch.millAddress,
          millPhone: selectedMill?.phone || ch.millPhone,
          millContact: selectedMill?.contactPerson || ch.millContact
        };
      }
      return ch;
    }));

    // If Challan # was updated, synchronize TPs in grayLots
    if (oldChallanNo && newChallanNo && oldChallanNo !== newChallanNo) {
      setGrayLots(prev => prev.map(lot => ({
        ...lot,
        tps: (lot.tps || []).map(tp => {
          if (tp.millChallanNo === oldChallanNo) {
            return { ...tp, millChallanNo: newChallanNo };
          }
          return tp;
        })
      })));
    }

    triggerEliteAlert(`Challan ${newChallanNo} updated successfully!`, 'Challan Updated');
    setEditingMillChallan(null);
    setEditChallanForm(null);
  };

  const handleDeleteMillChallan = async (ch) => {
    const confirmed = await triggerEliteConfirm({
      title: 'Delete Mill Challan',
      message: `Are you sure you want to delete Mill Challan "${ch.challanNo}"? All ${ch.totalTps} TPs (${ch.totalMeters.toFixed(1)} Mtr) will be restored to warehouse In-Stock inventory.`,
      confirmText: 'Delete Challan',
      cancelText: 'Cancel',
      type: 'danger'
    });
    if (!confirmed) return;

    // 1. Revert TPs in grayLots back to 'In Stock'
    if (ch.tps && ch.tps.length > 0) {
      const challanTpNos = new Set(ch.tps.map(t => String(t.tpNo)));
      setGrayLots(prev => prev.map(lot => {
        let lotChanged = false;
        let restoredMtr = 0;
        const updatedTps = (lot.tps || []).map(tp => {
          if (challanTpNos.has(String(tp.tpNo)) && tp.status === 'Sent to Mill') {
            lotChanged = true;
            restoredMtr += Number(tp.tpMtr) || 0;
            return { ...tp, status: 'In Stock', millChallanNo: null };
          }
          return tp;
        });

        if (lotChanged) {
          const newSentMtr = Math.max(0, (lot.sentToMillMeters || 0) - restoredMtr);
          const hasRemainingSent = updatedTps.some(t => t.status === 'Sent to Mill');
          return {
            ...lot,
            sentToMillMeters: parseFloat(newSentMtr.toFixed(2)),
            status: hasRemainingSent ? 'Partially at Mill' : 'In Stock',
            tps: updatedTps
          };
        }
        return lot;
      }));
    }

    // 2. Remove challan from millChallans
    setMillChallans(prev => prev.filter(c => c.id !== ch.id));
    triggerEliteAlert(`Mill Challan ${ch.challanNo} deleted successfully. TPs returned to warehouse stock.`, 'Challan Deleted');
  };

  // ==========================================
  // ✏️ Edit & Delete Handlers: Gray Fabric Lots
  // ==========================================
  const handleOpenEditGrayLot = (lot) => {
    setEditingGrayLot(lot);
    setEditGrayLotForm({
      lotNumber: lot.lotNumber || '',
      inwardDate: lot.inwardDate || '',
      weaverParty: lot.weaverParty || '',
      weaverChallanNo: lot.weaverChallanNo || '',
      fabricQuality: lot.fabricQuality || '',
      ratePerMeter: lot.ratePerMeter || 0,
      invoiceNo: lot.invoiceNo || '',
      invoiceDate: lot.invoiceDate || lot.inwardDate || '',
      hsnCode: lot.hsnCode || '5208',
      gstRate: lot.gstRate !== undefined ? lot.gstRate : '5',
      paymentTerms: lot.paymentTerms || '30 Days',
      purchaseNo: lot.purchaseNo || '',
      purchaseId: lot.purchaseId || '',
      notes: lot.notes || lot.remarks || '',
      tps: (lot.tps || []).map(t => ({ ...t }))
    });
  };

  const handleSaveEditGrayLot = async (e) => {
    e.preventDefault();
    if (!editingGrayLot || !editGrayLotForm) return;

    const validTps = (editGrayLotForm.tps || []).map((t, idx) => ({
      ...t,
      srNo: idx + 1,
      tpNo: t.tpNo || String(idx + 1),
      tpMtr: parseFloat(t.tpMtr) || 0
    }));

    const totalMeters = validTps.reduce((sum, t) => sum + t.tpMtr, 0);
    const roundMtrs = parseFloat(totalMeters.toFixed(2));
    const sentToMillMeters = validTps.filter(t => t.status === 'Sent to Mill').reduce((sum, t) => sum + t.tpMtr, 0);
    const hasSent = sentToMillMeters > 0;
    const hasRemainingInStock = validTps.some(t => t.status === 'In Stock');

    let newStatus = 'In Stock';
    if (hasSent && hasRemainingInStock) newStatus = 'Partially at Mill';
    else if (hasSent && !hasRemainingInStock) newStatus = 'Fully at Mill';

    const ratePerMtr = parseFloat(editGrayLotForm.ratePerMeter) || 0;
    const gstPct = parseFloat(editGrayLotForm.gstRate) || 0;
    const taxableAmt = parseFloat((roundMtrs * ratePerMtr).toFixed(2));
    const gstAmt = parseFloat(((taxableAmt * gstPct) / 100).toFixed(2));
    const totalInvAmt = Math.round(taxableAmt + gstAmt);

    // If already linked to a Billing Purchase ID, update it
    if (editGrayLotForm.purchaseId) {
      try {
        const updatePayload = {
          billNo: (editGrayLotForm.invoiceNo || editGrayLotForm.weaverChallanNo || editGrayLotForm.lotNumber).trim(),
          date: editGrayLotForm.invoiceDate || editGrayLotForm.inwardDate,
          vendorName: editGrayLotForm.weaverParty,
          items: [{
            itemName: `${editGrayLotForm.fabricQuality} (Gray Fabric)`,
            fabric: editGrayLotForm.fabricQuality,
            lotNo: editGrayLotForm.lotNumber.trim(),
            partyChallan: editGrayLotForm.weaverChallanNo,
            hsnCode: editGrayLotForm.hsnCode || '5208',
            quantity: roundMtrs,
            qty: roundMtrs,
            unit: 'Meters',
            rate: ratePerMtr,
            unitPrice: ratePerMtr,
            taxRate: gstPct,
            taxAmount: gstAmt,
            amount: taxableAmt,
            totalAmount: totalInvAmt
          }],
          quantity: roundMtrs,
          subtotal: taxableAmt,
          taxableAmount: taxableAmt,
          gstRate: gstPct,
          totalTax: gstAmt,
          gstAmount: gstAmt,
          grandTotal: totalInvAmt,
          totalAmount: totalInvAmt,
          terms: editGrayLotForm.paymentTerms || '30 Days'
        };
        await api.updateBillingPurchase(editGrayLotForm.purchaseId, updatePayload);
        window.dispatchEvent(new CustomEvent('elite-data-refresh', { detail: { source: 'billing' } }));
      } catch (upErr) {
        console.warn('Failed to update linked billing purchase:', upErr);
      }
    }

    setGrayLots(prev => prev.map(l => {
      if (l.id === editingGrayLot.id) {
        return {
          ...l,
          lotNumber: editGrayLotForm.lotNumber.trim(),
          inwardDate: editGrayLotForm.inwardDate,
          weaverParty: editGrayLotForm.weaverParty,
          weaverChallanNo: editGrayLotForm.weaverChallanNo,
          fabricQuality: editGrayLotForm.fabricQuality,
          ratePerMeter: ratePerMtr,
          invoiceNo: (editGrayLotForm.invoiceNo || '').trim(),
          invoiceDate: editGrayLotForm.invoiceDate || editGrayLotForm.inwardDate,
          hsnCode: editGrayLotForm.hsnCode || '5208',
          gstRate: gstPct,
          taxableAmount: taxableAmt,
          gstAmount: gstAmt,
          grandTotal: totalInvAmt,
          paymentTerms: editGrayLotForm.paymentTerms || '30 Days',
          remarks: editGrayLotForm.notes,
          notes: editGrayLotForm.notes,
          tps: validTps,
          totalTps: validTps.length,
          totalMeters: roundMtrs,
          sentToMillMeters: parseFloat(sentToMillMeters.toFixed(2)),
          status: newStatus
        };
      }
      return l;
    }));

    triggerEliteAlert(`Gray Lot ${editGrayLotForm.lotNumber} updated successfully!`, 'Lot Updated');
    setEditingGrayLot(null);
    setEditGrayLotForm(null);
  };

  const handleDeleteGrayLot = async (lot) => {
    if (lot.sentToMillMeters > 0 || (lot.tps || []).some(t => t.status === 'Sent to Mill')) {
      triggerEliteAlert(
        `Cannot delete Lot "${lot.lotNumber}". ${lot.sentToMillMeters.toFixed(1)} Mtr is currently dispatched to a mill in active Outward Challans. Please delete or modify the associated Challan first.`,
        'Cannot Delete Lot In Use'
      );
      return;
    }

    const confirmed = await triggerEliteConfirm({
      title: 'Delete Gray Fabric Lot',
      message: `Are you sure you want to delete Lot "${lot.lotNumber}" (${lot.totalTps} TPs, ${lot.totalMeters.toFixed(1)} Mtr)? This will permanently remove it from inventory.`,
      confirmText: 'Delete Lot',
      cancelText: 'Cancel',
      type: 'danger'
    });
    if (!confirmed) return;

    setGrayLots(prev => prev.filter(l => l.id !== lot.id));
    triggerEliteAlert(`Gray Lot ${lot.lotNumber} deleted successfully.`, 'Lot Deleted');
  };

  // ==========================================
  // 🥻 INWARD RFD FABRIC & MILL BALANCE TRACKING
  // ==========================================
  const handleOpenInwardRfdModal = (challan = null) => {
    if (challan) {
      const sentMtr = parseFloat(challan.totalMeters) || 0;
      const prevLots = rfdLots.filter(l => l.sourceChallanId === challan.id || (challan.challanNo && l.millChallanNo === challan.challanNo));
      const prevReceived = prevLots.reduce((sum, l) => sum + (parseFloat(l.receivedRfdMeters) || 0), 0);
      const prevShortage = prevLots.reduce((sum, l) => sum + (parseFloat(l.shrinkageLossMeters) || 0), 0);
      const currentAtMill = Math.max(0, parseFloat((sentMtr - (prevReceived + prevShortage)).toFixed(1)));

      const cleanChallanNo = (challan.challanNo || '').replace(/[^a-zA-Z0-9]/g, '');
      const suggestedLot = `YJ-RFD-${cleanChallanNo || String(rfdLots.length + 1).padStart(3, '0')}`;

      setInwardRfdForm({
        lotNumber: suggestedLot,
        inwardDate: new Date().toISOString().split('T')[0],
        sourceChallanId: challan.id,
        millParty: challan.millParty || '',
        millChallanNo: challan.challanNo || '',
        fabricQuality: challan.fabricQuality || '',
        graySentMeters: String(currentAtMill > 0 ? currentAtMill : sentMtr),
        receivedRfdMeters: '',
        shortagePercent: '',
        shortageMeters: '',
        receivedRollsCount: String(challan.totalTps || ''),
        isChallanClosed: true,
        isChallanClosedUserOverridden: false,
        notes: `Received from Mill Challan ${challan.challanNo}`
      });
    } else {
      setInwardRfdForm({
        lotNumber: `YJ-RFD-${String(rfdLots.length + 1).padStart(3, '0')}`,
        inwardDate: new Date().toISOString().split('T')[0],
        sourceChallanId: '',
        millParty: '',
        millChallanNo: '',
        fabricQuality: '',
        graySentMeters: '',
        receivedRfdMeters: '',
        shortagePercent: '',
        shortageMeters: '',
        receivedRollsCount: '',
        isChallanClosed: true,
        isChallanClosedUserOverridden: false,
        notes: ''
      });
    }
    setShowInwardRfdModal(true);
  };

  const handleSelectSourceChallan = (challanId) => {
    if (!challanId) {
      setInwardRfdForm(prev => ({
        ...prev,
        sourceChallanId: '',
        millParty: '',
        millChallanNo: '',
        fabricQuality: '',
        graySentMeters: '',
        receivedRfdMeters: '',
        shortagePercent: '',
        shortageMeters: '',
        receivedRollsCount: '',
        notes: ''
      }));
      return;
    }

    const ch = millChallans.find(c => String(c.id) === String(challanId));
    if (!ch) return;

    const sentMtr = parseFloat(ch.totalMeters) || 0;
    const prevLots = rfdLots.filter(l => l.sourceChallanId === ch.id || (ch.challanNo && l.millChallanNo === ch.challanNo));
    const prevReceived = prevLots.reduce((sum, l) => sum + (parseFloat(l.receivedRfdMeters) || 0), 0);
    const prevShortage = prevLots.reduce((sum, l) => sum + (parseFloat(l.shrinkageLossMeters) || 0), 0);
    const currentAtMill = Math.max(0, parseFloat((sentMtr - (prevReceived + prevShortage)).toFixed(1)));

    const cleanChallanNo = (ch.challanNo || '').replace(/[^a-zA-Z0-9]/g, '');
    const suggestedLot = `YJ-RFD-${cleanChallanNo || String(rfdLots.length + 1).padStart(3, '0')}`;

    setInwardRfdForm(prev => ({
      ...prev,
      sourceChallanId: ch.id,
      lotNumber: suggestedLot,
      millParty: ch.millParty || '',
      millChallanNo: ch.challanNo || '',
      fabricQuality: ch.fabricQuality || '',
      graySentMeters: String(currentAtMill > 0 ? currentAtMill : sentMtr),
      receivedRfdMeters: '',
      shortagePercent: '',
      shortageMeters: '',
      receivedRollsCount: String(ch.totalTps || ''),
      isChallanClosed: true,
      isChallanClosedUserOverridden: false,
      notes: `Received from Mill Challan ${ch.challanNo}`
    }));
  };

  const handleSubmitInwardRfd = async (e) => {
    e.preventDefault();
    if (!inwardRfdForm.millParty.trim()) {
      triggerEliteAlert('Please select or enter the Processing Mill name.', 'Missing Mill');
      return;
    }
    if (!inwardRfdForm.fabricQuality) {
      triggerEliteAlert('Please select Fabric Quality from the dropdown.', 'Missing Quality');
      return;
    }

    const graySent = parseFloat(inwardRfdForm.graySentMeters) || 0;
    const receivedRfd = parseFloat(inwardRfdForm.receivedRfdMeters) || 0;

    if (receivedRfd <= 0) {
      triggerEliteAlert('Please enter valid Total Received RFD Meters (must be greater than 0).', 'Invalid Meters');
      return;
    }

    // Shortage calculations (percentage-based)
    let shortagePct = parseFloat(inwardRfdForm.shortagePercent);
    let shortageMtr = parseFloat(inwardRfdForm.shortageMeters);

    if (!isNaN(shortagePct) && graySent > 0) {
      shortageMtr = parseFloat(((graySent * shortagePct) / 100).toFixed(1));
    } else if (!isNaN(shortageMtr) && graySent > 0) {
      shortagePct = parseFloat(((shortageMtr / graySent) * 100).toFixed(2));
    } else if (graySent > 0 && receivedRfd > 0 && graySent > receivedRfd) {
      shortageMtr = parseFloat((graySent - receivedRfd).toFixed(1));
      shortagePct = parseFloat(((shortageMtr / graySent) * 100).toFixed(2));
    } else {
      shortageMtr = 0;
      shortagePct = 0;
    }

    // Remaining at mill for this challan
    const stillAtMill = inwardRfdForm.isChallanClosed
      ? 0
      : Math.max(0, parseFloat((graySent - (receivedRfd + shortageMtr)).toFixed(1)));

    const lotNumber = inwardRfdForm.lotNumber.trim() || `YJ-RFD-${String(rfdLots.length + 1).padStart(3, '0')}`;

    let createdPurchaseNo = '';
    let createdPurchaseId = '';
    const procRate = parseFloat(inwardRfdForm.processRatePerMeter) || 0;
    const gstPct = parseFloat(inwardRfdForm.gstRate) || 0;
    const taxableAmt = parseFloat((receivedRfd * procRate).toFixed(2));
    const gstAmt = parseFloat(((taxableAmt * gstPct) / 100).toFixed(2));
    const totalInvAmt = Math.round(taxableAmt + gstAmt);

    if (inwardRfdForm.postToPurchase && procRate > 0) {
      try {
        let nextPurNo = '';
        try {
          const numRes = await api.getNextPurchaseNo(companyEntity);
          if (numRes && (numRes.purchaseNo || numRes.nextPurchaseNo || numRes.data)) {
            nextPurNo = numRes.purchaseNo || numRes.nextPurchaseNo || numRes.data;
          }
        } catch (numErr) {}

        if (!nextPurNo) {
          const curYear = new Date().getFullYear();
          nextPurNo = `PUR-${curYear}-${String(Date.now()).slice(-4)}`;
        }

        const purPayload = {
          companyEntity,
          purchaseNo: nextPurNo,
          billNo: (inwardRfdForm.invoiceNo || inwardRfdForm.millChallanNo || lotNumber).trim(),
          purchaseType: 'expense',
          ourChallanNo: lotNumber,
          date: inwardRfdForm.invoiceDate || inwardRfdForm.inwardDate,
          vendorName: inwardRfdForm.millParty.trim(),
          items: [{
            itemName: `${inwardRfdForm.fabricQuality} - Mill Processing Jobwork`,
            description: `RFD Inward Lot ${lotNumber} from ${inwardRfdForm.millParty.trim()}`,
            fabric: inwardRfdForm.fabricQuality,
            lotNo: lotNumber,
            partyChallan: inwardRfdForm.millChallanNo,
            hsnCode: inwardRfdForm.hsnCode || '998821',
            quantity: receivedRfd,
            qty: receivedRfd,
            unit: 'Meters',
            rate: procRate,
            unitPrice: procRate,
            taxRate: gstPct,
            taxAmount: gstAmt,
            amount: taxableAmt,
            totalAmount: totalInvAmt
          }],
          quantity: receivedRfd,
          rate: procRate,
          subtotal: taxableAmt,
          taxableAmount: taxableAmt,
          gstRate: gstPct,
          totalTax: gstAmt,
          gstAmount: gstAmt,
          grandTotal: totalInvAmt,
          totalAmount: totalInvAmt,
          paymentStatus: 'UNPAID',
          notes: `Mill Job Work Bill for RFD Lot ${lotNumber}`,
          terms: inwardRfdForm.paymentTerms || '30 Days'
        };

        const purRes = await api.createBillingPurchase(purPayload);
        const savedPur = (purRes && purRes.data) ? purRes.data : { ...purPayload, id: `pur_${Date.now()}` };
        createdPurchaseNo = savedPur.purchaseNo || nextPurNo;
        createdPurchaseId = savedPur._id || savedPur.id || '';
        window.dispatchEvent(new CustomEvent('elite-data-refresh', { detail: { source: 'billing' } }));
      } catch (purErr) {
        console.warn('Failed to auto-create mill purchase:', purErr);
      }
    }

    const newRfdLot = {
      id: `RFD-LOT-${Date.now()}`,
      lotNumber,
      inwardDate: inwardRfdForm.inwardDate,
      millParty: inwardRfdForm.millParty.trim(),
      millChallanNo: inwardRfdForm.millChallanNo.trim() || 'Direct Mill Inward',
      fabricQuality: inwardRfdForm.fabricQuality,
      graySentMeters: graySent,
      receivedRfdMeters: receivedRfd,
      receivedRollsCount: parseInt(inwardRfdForm.receivedRollsCount) || 1,
      shrinkageLossMeters: shortageMtr,
      shrinkagePercent: shortagePct,
      stillAtMillMeters: stillAtMill,
      isChallanClosed: inwardRfdForm.isChallanClosed,
      status: 'In Stock',
      issuedMeters: 0,
      notes: inwardRfdForm.notes.trim(),
      sourceChallanId: inwardRfdForm.sourceChallanId || null,
      invoiceNo: (inwardRfdForm.invoiceNo || '').trim(),
      invoiceDate: inwardRfdForm.invoiceDate || inwardRfdForm.inwardDate,
      processRatePerMeter: procRate,
      hsnCode: inwardRfdForm.hsnCode || '998821',
      gstRate: gstPct,
      taxableAmount: taxableAmt,
      gstAmount: gstAmt,
      grandTotal: totalInvAmt,
      purchaseNo: createdPurchaseNo || null,
      purchaseId: createdPurchaseId || null
    };

    setRfdLots(prev => [newRfdLot, ...prev]);

    // Auto-save mill party to master configs if not yet present
    const enteredMill = (inwardRfdForm.millParty || '').trim();
    if (enteredMill) {
      setConfigs(prev => {
        const list = prev.mills || [];
        if (!list.some(m => getPartyName(m).toLowerCase() === enteredMill.toLowerCase())) {
          const updated = { ...prev, mills: [...list, normalizeParty(enteredMill)] };
          try { localStorage.setItem(STORAGE_CONFIGS_KEY, JSON.stringify(updated)); } catch (err) {}
          return updated;
        }
        return prev;
      });
    }

    // Auto-save fabric quality to master configs if not yet present
    const enteredQuality = (inwardRfdForm.fabricQuality || '').trim();
    if (enteredQuality) {
      setConfigs(prev => {
        const list = prev.qualities || [];
        if (!list.some(q => q.toLowerCase() === enteredQuality.toLowerCase())) {
          const updated = { ...prev, qualities: [...list, enteredQuality] };
          try { localStorage.setItem(STORAGE_CONFIGS_KEY, JSON.stringify(updated)); } catch (err) {}
          return updated;
        }
        return prev;
      });
    }

    // Update Mill Challan status & pending meters
    if (inwardRfdForm.sourceChallanId) {
      setMillChallans(prev => prev.map(ch => {
        if (ch.id === inwardRfdForm.sourceChallanId) {
          const isClosed = inwardRfdForm.isChallanClosed || stillAtMill <= 0;
          return {
            ...ch,
            isClosed,
            status: isClosed ? 'Fully Received' : 'Partially Received'
          };
        }
        return ch;
      }));
    }

    setShowInwardRfdModal(false);
    setInwardRfdForm({
      lotNumber: '',
      inwardDate: new Date().toISOString().split('T')[0],
      sourceChallanId: '',
      millParty: '',
      millChallanNo: '',
      fabricQuality: '',
      graySentMeters: '',
      receivedRfdMeters: '',
      shortagePercent: '',
      shortageMeters: '',
      receivedRollsCount: '',
      isChallanClosed: true,
      isChallanClosedUserOverridden: false,
      notes: '',
      invoiceNo: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      processRatePerMeter: '',
      hsnCode: '998821',
      gstRate: '5',
      paymentTerms: '30 Days',
      postToPurchase: false
    });

    let rfdMsg = `RFD Fabric Lot "${lotNumber}" inwarded (${receivedRfd} Mtr). Shortage: ${shortageMtr} Mtr (${shortagePct}%). Still at Mill: ${stillAtMill} Mtr.`;
    if (createdPurchaseNo) {
      rfdMsg += `\n🧾 Mill Jobwork Bill ${createdPurchaseNo} (₹${totalInvAmt.toLocaleString('en-IN')}) posted to Purchases.`;
    }
    triggerEliteAlert(rfdMsg, 'RFD Inward Successful');
  };

  // ==========================================
  // ✏️ Edit & Delete Handlers: RFD Fabric Lots
  // ==========================================
  const handleOpenEditRfdLot = (lot) => {
    setEditingRfdLot(lot);
    const graySent = lot.graySentMeters || 0;
    const lossMtr = lot.shrinkageLossMeters || 0;
    const pct = lot.shrinkagePercent || (graySent > 0 ? parseFloat(((lossMtr / graySent) * 100).toFixed(2)) : 0);
    setEditRfdLotForm({
      lotNumber: lot.lotNumber || '',
      inwardDate: lot.inwardDate || '',
      millParty: lot.millParty || '',
      millChallanNo: lot.millChallanNo || '',
      fabricQuality: lot.fabricQuality || '',
      graySentMeters: graySent,
      receivedRfdMeters: lot.receivedRfdMeters || 0,
      shortagePercent: pct,
      shortageMeters: lossMtr,
      stillAtMillMeters: lot.stillAtMillMeters || 0,
      receivedRollsCount: lot.receivedRollsCount || 1,
      status: lot.status || 'In Stock',
      notes: lot.notes || ''
    });
  };

  const handleSaveEditRfdLot = (e) => {
    e.preventDefault();
    if (!editingRfdLot || !editRfdLotForm) return;

    setRfdLots(prev => prev.map(l => {
      if (l.id === editingRfdLot.id) {
        const graySent = parseFloat(editRfdLotForm.graySentMeters) || 0;
        const receivedRfd = parseFloat(editRfdLotForm.receivedRfdMeters) || 0;
        let shortagePct = parseFloat(editRfdLotForm.shortagePercent);
        let shortageMtr = parseFloat(editRfdLotForm.shortageMeters);

        if (!isNaN(shortagePct) && graySent > 0) {
          shortageMtr = parseFloat(((graySent * shortagePct) / 100).toFixed(1));
        } else if (!isNaN(shortageMtr) && graySent > 0) {
          shortagePct = parseFloat(((shortageMtr / graySent) * 100).toFixed(2));
        } else {
          shortageMtr = 0;
          shortagePct = 0;
        }

        const stillAtMill = parseFloat(editRfdLotForm.stillAtMillMeters) || 0;

        return {
          ...l,
          ...editRfdLotForm,
          graySentMeters: graySent,
          receivedRfdMeters: receivedRfd,
          shrinkageLossMeters: shortageMtr,
          shrinkagePercent: shortagePct,
          stillAtMillMeters: stillAtMill
        };
      }
      return l;
    }));

    triggerEliteAlert(`RFD Lot ${editRfdLotForm.lotNumber} updated successfully!`, 'Lot Updated');
    setEditingRfdLot(null);
    setEditRfdLotForm(null);
  };

  const handleDeleteRfdLot = async (lot) => {
    const confirmed = await triggerEliteConfirm({
      title: 'Delete RFD Fabric Lot',
      message: `Are you sure you want to delete RFD Lot "${lot.lotNumber}" (${lot.receivedRfdMeters} Mtr)? This will permanently remove it from RFD inventory.`,
      confirmText: 'Delete RFD Lot',
      cancelText: 'Cancel',
      type: 'danger'
    });
    if (!confirmed) return;

    setRfdLots(prev => prev.filter(l => l.id !== lot.id));
    triggerEliteAlert(`RFD Lot ${lot.lotNumber} deleted successfully.`, 'Lot Deleted');
  };

  const handlePrintChallanA4 = () => {
    const el = document.getElementById('printable-mill-challan-a4');
    if (!el) {
      window.print();
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Delivery Challan ${showPrintChallanModal?.challanNo || ''} - 2 Copies A4</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 5mm 7mm;
            }
            * {
              box-sizing: border-box;
            }
            html, body {
              margin: 0;
              padding: 0;
              height: 100%;
              background: #ffffff;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #0f172a;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            table {
              border-collapse: collapse;
            }
            .no-print {
              display: none !important;
            }
            .single-page-print {
              width: 100%;
              height: 285mm;
              max-height: 285mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              box-sizing: border-box;
              overflow: hidden;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .single-page-print .challan-copy-block {
              height: 138mm;
              max-height: 138mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              overflow: hidden;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .single-page-print .challan-cut-line {
              height: 7mm;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0;
            }
            .single-page-print .challan-table-wrapper {
              flex: 1 1 auto;
              display: flex;
              flex-direction: column;
              min-height: 0;
            }
            .single-page-print .challan-table-wrapper table {
              height: 100%;
              flex: 1;
            }
            .multi-page-print {
              display: block;
              width: 100%;
            }
            .multi-page-print .challan-copy-block {
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              min-height: 280mm;
              box-sizing: border-box;
            }
            .multi-page-print .challan-copy-block:first-of-type {
              page-break-after: always !important;
              break-after: page !important;
              margin-bottom: 0 !important;
            }
            .multi-page-print .challan-copy-block:last-of-type {
              page-break-before: always !important;
              break-before: page !important;
              margin-top: 0 !important;
            }
            .page-break-always {
              page-break-before: always !important;
              break-before: page !important;
              margin-top: 0 !important;
            }
          </style>
        </head>
        <body>
          ${el.outerHTML}
          <script>
            window.onload = function() {
              window.focus();
              setTimeout(function() {
                window.print();
              }, 250);
            };
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '3rem' }}>
      {/* 🌟 Master Header Banner */}
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
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.05) 0%, rgba(2, 132, 199, 0.08) 100%)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: '#0ea5e920',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #0ea5e940',
              boxShadow: '0 2px 8px rgba(14, 165, 233, 0.2)'
            }}
          >
            <Layers size={26} color="#0ea5e9" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                Yamunaji — Fabric Process
              </h2>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: '#0ea5e91a',
                  color: '#0284c7',
                  border: '1px solid #0ea5e933'
                }}
              >
                WEAVER TO MILL TO RFD
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '3px 0 0' }}>
              Weaver Gray Fabric inward with TP Details (Sr No, TP No, TP Mtr) & Mill Delivery Outward Challans.
            </p>
          </div>
        </div>

        {/* Master Action Controls: Settings + Mode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* ⚙️ SETTINGS BUTTON */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
            }}
            title="Configure Weaver Names, Fabric Qualities, Processing Mills & Process Types"
          >
            <Settings size={15} color="#0284c7" /> Settings
          </button>

          {/* Primary Screen Mode Switcher: Gray Fabric vs. RFD Fabric */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#ffffff',
              borderRadius: '10px',
              padding: '4px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
              gap: '4px'
            }}
          >
            <button
              onClick={() => setScreenMode('gray')}
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '7px',
                border: 'none',
                background: screenMode === 'gray' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent',
                color: screenMode === 'gray' ? '#ffffff' : '#475569',
                fontWeight: screenMode === 'gray' ? 800 : 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: screenMode === 'gray' ? '0 2px 4px rgba(2, 132, 199, 0.25)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Boxes size={15} /> Gray Fabric
            </button>

            <button
              onClick={() => setScreenMode('rfd')}
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '7px',
                border: 'none',
                background: screenMode === 'rfd' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent',
                color: screenMode === 'rfd' ? '#ffffff' : '#475569',
                fontWeight: screenMode === 'rfd' ? 800 : 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: screenMode === 'rfd' ? '0 2px 4px rgba(2, 132, 199, 0.25)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Layers size={15} /> RFD Fabric
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 🧶 SCREEN MODE 1: GRAY FABRIC (WEAVER TO MILL)            */}
      {/* ======================================================== */}
      {screenMode === 'gray' && (
        <>
          {/* Quick Stats HUD for Gray Fabric */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '1rem'
            }}
          >
            {/* Stat 1: In-Stock Gray Meters */}
            <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #0284c7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  In-Stock Gray Fabric
                </span>
                <Boxes size={16} color="#0284c7" />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0284c7' }}>
                {grayStats.inStockMtrs.toLocaleString('en-IN', { maximumFractionDigits: 1 })} <span style={{ fontSize: '0.85rem' }}>Mtr</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                <span style={{ fontWeight: 700, color: '#0284c7' }}>{grayStats.inStockTps} TPs</span> ready in warehouse
              </div>
            </div>

            {/* Stat 2: Sent to Mill for RFD */}
            <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Sent to Mill (Outward)
                </span>
                <Truck size={16} color="#f59e0b" />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#d97706' }}>
                {grayStats.atMillMtrs.toLocaleString('en-IN', { maximumFractionDigits: 1 })} <span style={{ fontSize: '0.85rem' }}>Mtr</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                Currently in processing at dye houses
              </div>
            </div>

            {/* Stat 3: Outward Challans Created */}
            <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Mill Delivery Challans
                </span>
                <ClipboardList size={16} color="#10b981" />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#059669' }}>
                {millChallans.length} <span style={{ fontSize: '0.85rem' }}>Challans</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                Outward to Shree Radhe, Vrundavan, etc.
              </div>
            </div>

            {/* Stat 4: Gray Stock Valuation */}
            <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Gray Inventory Value
                </span>
                <TrendingUp size={16} color="#8b5cf6" />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#7c3aed' }}>
                ₹ {grayStats.totalGrayValuation.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                Purchase rate from weavers
              </div>
            </div>

            {/* Stat 5: Pending Invoices */}
            <div
              className="glass-panel"
              onClick={() => setGrayInvoiceFilter(prev => prev === 'pending' ? 'all' : 'pending')}
              style={{
                padding: '1rem',
                borderLeft: '4px solid #f59e0b',
                cursor: 'pointer',
                background: grayInvoiceFilter === 'pending' ? 'rgba(254, 243, 199, 0.45)' : undefined,
                boxShadow: grayInvoiceFilter === 'pending' ? '0 0 0 2px #f59e0b' : undefined,
                transition: 'all 0.2s ease'
              }}
              title="Click to filter lots with pending invoices"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: grayInvoiceFilter === 'pending' ? '#b45309' : '#64748b', textTransform: 'uppercase' }}>
                  Pending Invoices
                </span>
                <Clock size={16} color="#f59e0b" />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#d97706' }}>
                {grayStats.pendingInvoiceCount} <span style={{ fontSize: '0.85rem' }}>Lots</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                {grayStats.pendingInvoiceMtrs.toLocaleString('en-IN', { maximumFractionDigits: 1 })} Mtr invoice awaited
                {grayInvoiceFilter === 'pending' && <span style={{ marginLeft: 6, fontWeight: 800, color: '#b45309' }}>• FILTER ACTIVE</span>}
              </div>
            </div>
          </div>

          {/* Sub Navigation Bar for Gray Fabric */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => setGraySubTab('weaver_inward')}
                className="tab-pill"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: graySubTab === 'weaver_inward' ? 800 : 600,
                  background: graySubTab === 'weaver_inward' ? '#0ea5e9' : 'transparent',
                  color: graySubTab === 'weaver_inward' ? '#ffffff' : '#64748b',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <Boxes size={14} /> Weaver Inward & Gray Stock ({grayLots.length} Lots)
              </button>

              <button
                onClick={() => setGraySubTab('mill_outward')}
                className="tab-pill"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: graySubTab === 'mill_outward' ? 800 : 600,
                  background: graySubTab === 'mill_outward' ? '#0ea5e9' : 'transparent',
                  color: graySubTab === 'mill_outward' ? '#ffffff' : '#64748b',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <Truck size={14} /> Mill Outward Challans ({millChallans.length})
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <button
                onClick={() => setShowWeaverInwardModal(true)}
                className="btn-primary"
                style={{
                  padding: '0.45rem 1rem',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                  border: 'none'
                }}
              >
                <PlusCircle size={16} /> + New Weaver Gray Inward
              </button>

              <button
                onClick={() => openMillChallanModal()}
                className="btn-primary"
                style={{
                  padding: '0.45rem 1rem',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #059669, #10b981)',
                  border: 'none'
                }}
              >
                <Truck size={16} /> + Create Challan for Mill
              </button>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* 🔍 STANDARDIZED ERP UNIFIED FILTER TOOLBAR                */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <ErpUnifiedFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder={
              graySubTab === 'weaver_inward'
                ? "Search Lot #, Weaver, Challan #, Quality..."
                : "Search Challan #, Mill, Vehicle, Quality..."
            }
            datePreset={datePreset}
            onDateChange={({ preset: p, dateStart: ds, dateEnd: de }) => {
              setDatePreset(p);
              setDateStart(ds || '');
              setDateEnd(de || '');
            }}
            customDateStart={customDateStart}
            customDateEnd={customDateEnd}
            onCustomDateChange={(s, e) => {
              setCustomDateStart(s);
              setCustomDateEnd(e);
              setDateStart(s);
              setDateEnd(e);
            }}
            categories={filterCategories}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            filterPlaceholder="Multiple Filters"
            showChips={true}
            onReset={handleResetFilters}
            style={{ marginBottom: '1rem' }}
          />

          {/* ======================================================== */}
          {/* 📋 SUB-TAB 1: WEAVER INWARD & GRAY FABRIC LOTS           */}
          {/* ======================================================== */}
          {graySubTab === 'weaver_inward' && (
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Gray Fabric Inward Lots (Received from Weavers)
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Each lot contains full TP breakdown. Track arrival of Weaver commercial invoices and post to purchase register.
                  </p>
                </div>

                {/* Quick Filter Pills: All / Pending Invoices / Invoiced */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '3px 4px', borderRadius: 8 }}>
                  <button
                    type="button"
                    onClick={() => setGrayInvoiceFilter('all')}
                    style={{
                      border: 'none',
                      background: grayInvoiceFilter === 'all' ? '#ffffff' : 'transparent',
                      color: grayInvoiceFilter === 'all' ? '#0f172a' : '#64748b',
                      fontWeight: grayInvoiceFilter === 'all' ? 800 : 600,
                      boxShadow: grayInvoiceFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    All Lots ({grayLots.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrayInvoiceFilter('pending')}
                    style={{
                      border: 'none',
                      background: grayInvoiceFilter === 'pending' ? '#fef3c7' : 'transparent',
                      color: grayInvoiceFilter === 'pending' ? '#92400e' : '#64748b',
                      fontWeight: grayInvoiceFilter === 'pending' ? 800 : 600,
                      boxShadow: grayInvoiceFilter === 'pending' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Clock size={12} color="#b45309" />
                    ⏳ Bill Pending ({grayStats.pendingInvoiceCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrayInvoiceFilter('invoiced')}
                    style={{
                      border: 'none',
                      background: grayInvoiceFilter === 'invoiced' ? '#dcfce7' : 'transparent',
                      color: grayInvoiceFilter === 'invoiced' ? '#166534' : '#64748b',
                      fontWeight: grayInvoiceFilter === 'invoiced' ? 800 : 600,
                      boxShadow: grayInvoiceFilter === 'invoiced' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Check size={12} color="#15803d" />
                    ✓ Invoiced ({grayLots.length - grayStats.pendingInvoiceCount})
                  </button>
                </div>
              </div>

              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 12px' }}>Lot Number</th>
                      <th style={{ padding: '10px 12px' }}>Inward Date</th>
                      <th style={{ padding: '10px 12px' }}>Weaver / Loom Owner</th>
                      <th style={{ padding: '10px 12px' }}>Weaver Challan #</th>
                      <th style={{ padding: '10px 12px' }}>Quality</th>
                      <th style={{ padding: '10px 12px' }}>Total TPs</th>
                      <th style={{ padding: '10px 12px' }}>Total Gray Mtr</th>
                      <th style={{ padding: '10px 12px' }}>At Mill Mtr</th>
                      <th style={{ padding: '10px 12px' }}>In Warehouse</th>
                      <th style={{ padding: '10px 12px' }}>Status</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', minWidth: '220px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGrayLots.length === 0 ? (
                      <tr>
                        <td colSpan="11" style={{ padding: '1.5rem 0.5rem' }}>
                          {grayLots.length === 0 ? (
                            <EnterpriseEmptyState
                              icon={Boxes}
                              title="Clean Slate — Ready for First Inward"
                              description="All test data has been cleared. Click '+ New Weaver Gray Inward' to record incoming fabric lots with individual roll meterages."
                              actionLabel="+ New Weaver Gray Inward"
                              onAction={() => setShowWeaverInwardModal(true)}
                            />
                          ) : (
                            <EnterpriseEmptyState
                              icon={Search}
                              title="No Fabric Lots Found"
                              description="No gray fabric lots match your selected date range or filter settings."
                              actionLabel="Reset All Filters"
                              onAction={handleResetFilters}
                            />
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredGrayLots.map(lot => {
                      const availableTps = (lot.tps || []).filter(t => t.status === 'In Stock');
                      const inWarehouseMtr = availableTps.reduce((sum, t) => sum + (Number(t.tpMtr) || 0), 0);

                      return (
                        <tr key={lot.id} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover-row">
                          <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0284c7' }}>
                            {lot.lotNumber}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                            {lot.inwardDate}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {lot.weaverParty}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ color: '#0f172a', fontWeight: 600 }}>{lot.weaverChallanNo || 'N/A'}</div>
                            {lot.invoiceNo ? (
                              <div style={{ fontSize: '0.71rem', color: '#0284c7', fontWeight: 700, marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <FileText size={11} color="#0284c7" /> Inv: {lot.invoiceNo}
                              </div>
                            ) : (
                              <div style={{ marginTop: 2 }}>
                                <span style={{ fontSize: '0.64rem', background: '#fef3c7', color: '#b45309', padding: '1px 5px', borderRadius: 4, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <Clock size={10} color="#b45309" /> Bill Pending
                                </span>
                              </div>
                            )}
                            {lot.purchaseNo && (
                              <div style={{ marginTop: 2 }}>
                                <span style={{ fontSize: '0.64rem', background: '#dcfce7', color: '#166534', padding: '1px 5px', borderRadius: 4, fontWeight: 800 }}>
                                  ✓ {lot.purchaseNo}
                                </span>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                            <span style={{ background: '#f8fafc', padding: '3px 8px', borderRadius: '5px', border: '1px solid #e2e8f0' }}>
                              {lot.fabricQuality}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0284c7' }}>
                            {lot.totalTps} TPs
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a' }}>
                              {lot.totalMeters.toFixed(1)} Mtr
                            </div>
                            {lot.ratePerMeter > 0 && (
                              <div style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 700, marginTop: 2 }}>
                                @ ₹{lot.ratePerMeter} = ₹{(lot.grandTotal || (lot.totalMeters * lot.ratePerMeter)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#d97706', fontWeight: 700 }}>
                            {(lot.sentToMillMeters || 0).toFixed(1)} Mtr
                          </td>
                          <td style={{ padding: '10px 12px', color: '#16a34a', fontWeight: 800 }}>
                            {inWarehouseMtr.toFixed(1)} Mtr
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: '5px',
                                background: lot.status === 'In Stock' ? '#dcfce7' : lot.status === 'Fully at Mill' ? '#f1f5f9' : '#fef3c7',
                                color: lot.status === 'In Stock' ? '#15803d' : lot.status === 'Fully at Mill' ? '#64748b' : '#b45309'
                              }}
                            >
                              {lot.status}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                              {(!lot.invoiceNo && !lot.purchaseNo) && (
                                <button
                                  onClick={() => handleOpenAttachInvoice(lot)}
                                  className="btn-primary"
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: '0.74rem',
                                    height: '28px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                    border: 'none',
                                    color: '#fff',
                                    fontWeight: 700,
                                    borderRadius: 5,
                                    boxShadow: '0 2px 4px rgba(217, 119, 6, 0.2)'
                                  }}
                                  title="Weaver Bill arrived? Click to enter bill number & rate"
                                >
                                  <FileText size={13} /> Attach Bill
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedGrayLotForView(lot)}
                                className="btn-secondary"
                                style={{ padding: '3px 8px', fontSize: '0.74rem', height: '28px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="View TPs breakdown"
                              >
                                <Eye size={13} /> View ({lot.tps?.length || 0})
                              </button>
                              <button
                                onClick={() => handleOpenEditGrayLot(lot)}
                                className="btn-secondary"
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '0.74rem',
                                  height: '28px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: '#f8fafc',
                                  color: '#0f172a',
                                  border: '1px solid #cbd5e1'
                                }}
                                title="Edit Gray Lot"
                              >
                                <Edit2 size={13} /> Edit
                              </button>
                              <button
                                onClick={() => handleDeleteGrayLot(lot)}
                                className="btn-secondary"
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '0.74rem',
                                  height: '28px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: '#fef2f2',
                                  color: '#dc2626',
                                  border: '1px solid #fecaca'
                                }}
                                title="Delete Gray Lot"
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 🚚 SUB-TAB 2: MILL OUTWARD CHALLANS                      */}
          {/* ======================================================== */}
          {graySubTab === 'mill_outward' && (
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Outward Delivery Challans to Processing Mills
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Delivery challans sent with vehicle/tempo to dyeing mills for processing gray fabric into RFD.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                  <button
                    onClick={() => openMillChallanModal()}
                    className="btn-primary"
                    style={{
                      padding: '0.45rem 1rem',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'linear-gradient(135deg, #059669, #10b981)',
                      border: 'none'
                    }}
                  >
                    <PlusCircle size={15} /> + Create Outward Challan
                  </button>
                </div>
              </div>

              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 12px' }}>Challan No</th>
                      <th style={{ padding: '10px 12px' }}>Date</th>
                      <th style={{ padding: '10px 12px' }}>Processing Mill Name</th>
                      <th style={{ padding: '10px 12px' }}>Fabric Quality</th>
                      <th style={{ padding: '10px 12px' }}>Dispatched Gray</th>
                      <th style={{ padding: '10px 12px' }}>Received RFD</th>
                      <th style={{ padding: '10px 12px' }}>Mill Shortage</th>
                      <th style={{ padding: '10px 12px' }}>Still at Mill</th>
                      <th style={{ padding: '10px 12px' }}>Status</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', minWidth: '220px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMillChallans.length === 0 ? (
                      <tr>
                        <td colSpan="11" style={{ padding: '1.5rem 0.5rem' }}>
                          {millChallans.length === 0 ? (
                            <EnterpriseEmptyState
                              icon={ClipboardList}
                              title="No Mill Delivery Challans"
                              description="No outward challans sent to mills yet. Click '+ Create Challan for Mill' to dispatch gray fabric rolls to dye houses."
                              actionLabel="+ Create Challan for Mill"
                              onAction={() => openMillChallanModal()}
                            />
                          ) : (
                            <EnterpriseEmptyState
                              icon={Search}
                              title="No Challans Match Filters"
                              description="No outward challans match your selected date range or filter criteria."
                              actionLabel="Reset All Filters"
                              onAction={handleResetFilters}
                            />
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredMillChallans.map(ch => {
                      const sentMtr = parseFloat(ch.totalMeters) || 0;
                      const chRfdLots = rfdLots.filter(l => l.sourceChallanId === ch.id || (ch.challanNo && l.millChallanNo === ch.challanNo));
                      const chReceivedMtrs = chRfdLots.reduce((sum, l) => sum + (parseFloat(l.receivedRfdMeters) || 0), 0);
                      const chShortageMtrs = chRfdLots.reduce((sum, l) => sum + (parseFloat(l.shrinkageLossMeters) || 0), 0);
                      const isClosed = ch.isClosed || ch.status === 'Fully Received' || chRfdLots.some(l => l.isChallanClosed);
                      const stillAtMill = isClosed ? 0 : Math.max(0, parseFloat((sentMtr - (chReceivedMtrs + chShortageMtrs)).toFixed(1)));
                      const isPartiallyReceived = chReceivedMtrs > 0 && stillAtMill > 0;
                      const isFullyReceived = isClosed || (chReceivedMtrs > 0 && stillAtMill === 0);
                      const isExpanded = expandedChallanIds.includes(ch.id);

                      return (
                      <React.Fragment key={ch.id}>
                        <tr
                          onClick={() => toggleExpandChallan(ch.id)}
                          style={{
                            borderBottom: isExpanded ? 'none' : '1px solid #f1f5f9',
                            background: isExpanded ? '#f0f9ff' : undefined,
                            borderLeft: isExpanded ? '3px solid #0284c7' : '3px solid transparent',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease'
                          }}
                          className="hover-row"
                        >
                          <td style={{ padding: '10px 12px', fontWeight: 800, color: '#059669', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <ChevronDown
                                size={15}
                                style={{
                                  color: isExpanded ? '#0284c7' : '#94a3b8',
                                  transition: 'transform 0.2s ease',
                                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                  flexShrink: 0
                                }}
                              />
                              <span>{ch.challanNo}</span>
                              {chRfdLots.length > 0 && (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    marginLeft: '3px',
                                    padding: '1px 6px',
                                    fontSize: '0.68rem',
                                    fontWeight: 800,
                                    borderRadius: '999px',
                                    background: '#dcfce7',
                                    color: '#15803d',
                                    border: '1px solid #bbf7d0'
                                  }}
                                >
                                  {chRfdLots.length} Recv
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                            {ch.challanDate}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {ch.millParty}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0284c7' }}>
                            {ch.fabricQuality || 'Gray Fabric'}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0f172a' }}>
                            {sentMtr.toFixed(1)} Mtr
                            <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>
                              {ch.totalTps} TPs
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0284c7' }}>
                            {chReceivedMtrs > 0 ? `${chReceivedMtrs.toFixed(1)} Mtr` : '0.0 Mtr'}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {chShortageMtrs > 0 ? (
                              <span style={{ color: '#d97706', fontWeight: 700 }}>
                                -{chShortageMtrs.toFixed(1)} Mtr
                                <span style={{ fontSize: '0.7rem', display: 'block', color: '#b45309' }}>
                                  ({sentMtr > 0 ? ((chShortageMtrs / sentMtr) * 100).toFixed(1) : 0}%)
                                </span>
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>0.0 Mtr</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {stillAtMill > 0 ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  borderRadius: '5px',
                                  fontSize: '0.78rem',
                                  fontWeight: 800,
                                  background: '#fffbeb',
                                  color: '#b45309',
                                  border: '1px solid #fde68a'
                                }}
                              >
                                {stillAtMill.toFixed(1)} Mtr
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  borderRadius: '5px',
                                  fontSize: '0.74rem',
                                  fontWeight: 800,
                                  background: '#f0fdf4',
                                  color: '#16a34a',
                                  border: '1px solid #bbf7d0'
                                }}
                              >
                                0.0 Mtr (Clear)
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: '5px',
                                background: isFullyReceived ? '#dcfce7' : isPartiallyReceived ? '#e0f2fe' : '#fef3c7',
                                color: isFullyReceived ? '#15803d' : isPartiallyReceived ? '#0369a1' : '#b45309',
                                border: `1px solid ${isFullyReceived ? '#bbf7d0' : isPartiallyReceived ? '#bae6fd' : '#fde68a'}`
                              }}
                            >
                              {isFullyReceived ? 'Fully Received' : isPartiallyReceived ? 'Partially Received' : 'At Mill (Pending)'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                              {!isFullyReceived && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenInwardRfdModal(ch);
                                  }}
                                  className="btn-secondary"
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: '0.74rem',
                                    height: '28px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: '#ecfdf5',
                                    color: '#059669',
                                    border: '1px solid #a7f3d0',
                                    fontWeight: 700
                                  }}
                                  title="Inward RFD meters back from this Mill Challan"
                                >
                                  <PackageCheck size={13} /> Receive RFD
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowPrintChallanModal(ch);
                                }}
                                className="btn-primary"
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '0.74rem',
                                  height: '28px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: '#0ea5e9'
                                }}
                                title="Print / Save PDF (2 Copies A4)"
                              >
                                <Printer size={13} /> Print
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditMillChallan(ch);
                                }}
                                className="btn-secondary"
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '0.74rem',
                                  height: '28px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: '#f8fafc',
                                  color: '#0f172a',
                                  border: '1px solid #cbd5e1'
                                }}
                                title="Edit Challan"
                              >
                                <Edit2 size={13} /> Edit
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteMillChallan(ch);
                                }}
                                className="btn-secondary"
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '0.74rem',
                                  height: '28px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: '#fef2f2',
                                  color: '#dc2626',
                                  border: '1px solid #fecaca'
                                }}
                                title="Delete Challan"
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* 🔽 EXPANDED SUB-ROW: DISPLAY RECEIVED CHALLANS FROM MILL */}
                        {isExpanded && (
                          <tr key={`${ch.id}-expanded`} style={{ background: '#f8fafc' }}>
                            <td
                              colSpan={10}
                              style={{
                                padding: '0',
                                borderBottom: '2px solid #cbd5e1',
                                borderLeft: '3px solid #0284c7'
                              }}
                            >
                              <div
                                style={{
                                  padding: '16px 20px',
                                  background: 'linear-gradient(180deg, #f0f9ff 0%, #f8fafc 40px, #ffffff 100%)',
                                  borderTop: '1px solid #bae6fd'
                                }}
                              >
                                {/* Header bar of expanded section */}
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '10px',
                                    marginBottom: '14px'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div
                                      style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 8,
                                        background: '#e0f2fe',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#0284c7'
                                      }}
                                    >
                                      <PackageCheck size={20} />
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span>Received Delivery Challans from Mill</span>
                                        <span
                                          style={{
                                            fontSize: '0.72rem',
                                            fontWeight: 800,
                                            color: '#0369a1',
                                            background: '#e0f2fe',
                                            padding: '2px 8px',
                                            borderRadius: 6,
                                            border: '1px solid #bae6fd'
                                          }}
                                        >
                                          Outward Challan #{ch.challanNo}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                                          ({ch.millParty} • {ch.fabricQuality || 'Gray Fabric'})
                                        </span>
                                      </div>
                                      <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 3 }}>
                                        Dispatched Gray: <strong style={{ color: '#0f172a' }}>{sentMtr.toFixed(1)} Mtr ({ch.totalTps} TPs)</strong>
                                        <span style={{ margin: '0 8px', color: '#cbd5e1' }}>|</span>
                                        Total Received RFD: <strong style={{ color: '#0284c7' }}>{chReceivedMtrs.toFixed(1)} Mtr</strong>
                                        <span style={{ margin: '0 8px', color: '#cbd5e1' }}>|</span>
                                        Shortage Loss: <strong style={{ color: '#d97706' }}>{chShortageMtrs.toFixed(1)} Mtr ({sentMtr > 0 ? ((chShortageMtrs / sentMtr) * 100).toFixed(1) : 0}%)</strong>
                                        <span style={{ margin: '0 8px', color: '#cbd5e1' }}>|</span>
                                        Fabric Still at Mill: <strong style={{ color: stillAtMill > 0 ? '#b45309' : '#16a34a' }}>{stillAtMill.toFixed(1)} Mtr</strong>
                                      </div>
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenInwardRfdModal(ch);
                                      }}
                                      className="btn-primary"
                                      style={{
                                        padding: '6px 12px',
                                        fontSize: '0.76rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                        border: 'none',
                                        borderRadius: 6,
                                        boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
                                        fontWeight: 700
                                      }}
                                    >
                                      <PlusCircle size={14} /> + Record Received Delivery from Mill
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleExpandChallan(ch.id);
                                      }}
                                      style={{
                                        padding: '5px 10px',
                                        fontSize: '0.74rem',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: 6,
                                        background: '#ffffff',
                                        color: '#64748b',
                                        cursor: 'pointer'
                                      }}
                                      title="Close expanded view"
                                    >
                                      Close
                                    </button>
                                  </div>
                                </div>

                                {/* Content of received challans */}
                                {chRfdLots.length > 0 ? (
                                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflowX: 'auto', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                      <thead>
                                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                                          <th style={{ padding: '8px 10px' }}>RFD Lot #</th>
                                          <th style={{ padding: '8px 10px' }}>Inward Date</th>
                                          <th style={{ padding: '8px 10px' }}>Mill Delivery / LR #</th>
                                          <th style={{ padding: '8px 10px' }}>Quality</th>
                                          <th style={{ padding: '8px 10px' }}>Received RFD</th>
                                          <th style={{ padding: '8px 10px' }}>Shortage Loss</th>
                                          <th style={{ padding: '8px 10px' }}>Still At Mill</th>
                                          <th style={{ padding: '8px 10px' }}>Warehouse Balance</th>
                                          <th style={{ padding: '8px 10px' }}>Delivery Status</th>
                                          <th style={{ padding: '8px 10px', textAlign: 'center', minWidth: '150px' }}>Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {chRfdLots.map((lot, idx) => {
                                          const balance = Math.max(0, lot.receivedRfdMeters - (lot.issuedMeters || 0));
                                          const rolls = lot.receivedRollsCount || (lot.tps ? lot.tps.length : 1);
                                          const isHighShortage = (lot.shrinkagePercent || 0) > 4.0;
                                          return (
                                            <tr key={lot.id || idx} style={{ borderBottom: idx < chRfdLots.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                              <td style={{ padding: '8px 10px', fontWeight: 800, color: '#0284c7' }}>
                                                {lot.lotNumber}
                                              </td>
                                              <td style={{ padding: '8px 10px', color: '#64748b' }}>
                                                {lot.inwardDate}
                                              </td>
                                              <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0f172a' }}>
                                                {lot.millChallanNo || ch.challanNo}
                                              </td>
                                              <td style={{ padding: '8px 10px', color: '#334155' }}>
                                                {lot.fabricQuality || ch.fabricQuality}
                                              </td>
                                              <td style={{ padding: '8px 10px', fontWeight: 800, color: '#0f172a' }}>
                                                {lot.receivedRfdMeters} Mtr
                                                <span style={{ display: 'block', fontSize: '0.68rem', color: '#059669', fontWeight: 600 }}>
                                                  {rolls} Rolls/TPs
                                                </span>
                                              </td>
                                              <td style={{ padding: '8px 10px' }}>
                                                <span
                                                  style={{
                                                    display: 'inline-block',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    background: isHighShortage ? '#fef2f2' : '#f0fdf4',
                                                    color: isHighShortage ? '#dc2626' : '#16a34a',
                                                    border: `1px solid ${isHighShortage ? '#fecaca' : '#bbf7d0'}`
                                                  }}
                                                >
                                                  {lot.shrinkageLossMeters > 0 ? `-${lot.shrinkageLossMeters} Mtr` : '0 Mtr'} ({lot.shrinkagePercent || 0}%)
                                                </span>
                                              </td>
                                              <td style={{ padding: '8px 10px' }}>
                                                {(lot.stillAtMillMeters || 0) > 0 ? (
                                                  <span style={{ color: '#b45309', fontWeight: 700 }}>
                                                    {lot.stillAtMillMeters} Mtr
                                                  </span>
                                                ) : (
                                                  <span style={{ color: '#16a34a', fontWeight: 700 }}>
                                                    0 Mtr (Clear)
                                                  </span>
                                                )}
                                              </td>
                                              <td style={{ padding: '8px 10px', fontWeight: 800, color: '#16a34a' }}>
                                                {balance.toFixed(1)} Mtr
                                              </td>
                                              <td style={{ padding: '8px 10px' }}>
                                                <span
                                                  style={{
                                                    fontSize: '0.66rem',
                                                    fontWeight: 800,
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    background: lot.isChallanClosed ? '#dcfce7' : '#e0f2fe',
                                                    color: lot.isChallanClosed ? '#15803d' : '#0369a1',
                                                    border: `1px solid ${lot.isChallanClosed ? '#bbf7d0' : '#bae6fd'}`
                                                  }}
                                                >
                                                  {lot.isChallanClosed ? 'Final Delivery' : 'Partial Delivery'}
                                                </span>
                                              </td>
                                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setViewingRfdTpsLot(lot);
                                                    }}
                                                    style={{
                                                      padding: '3px 6px',
                                                      fontSize: '0.7rem',
                                                      border: '1px solid #cbd5e1',
                                                      borderRadius: '4px',
                                                      background: '#f8fafc',
                                                      color: '#334155',
                                                      cursor: 'pointer',
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      gap: '3px'
                                                    }}
                                                    title="View Details"
                                                  >
                                                    <Eye size={11} /> View
                                                  </button>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleOpenEditRfdLot(lot);
                                                    }}
                                                    style={{
                                                      padding: '3px 6px',
                                                      fontSize: '0.7rem',
                                                      border: '1px solid #cbd5e1',
                                                      borderRadius: '4px',
                                                      background: '#ffffff',
                                                      color: '#0f172a',
                                                      cursor: 'pointer',
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      gap: '3px'
                                                    }}
                                                    title="Edit Received Delivery"
                                                  >
                                                    <Edit2 size={11} /> Edit
                                                  </button>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleDeleteRfdLot(lot);
                                                    }}
                                                    style={{
                                                      padding: '3px 6px',
                                                      fontSize: '0.7rem',
                                                      border: '1px solid #fecaca',
                                                      borderRadius: '4px',
                                                      background: '#fef2f2',
                                                      color: '#dc2626',
                                                      cursor: 'pointer',
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      gap: '3px'
                                                    }}
                                                    title="Delete Received Delivery"
                                                  >
                                                    <Trash2 size={11} /> Delete
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      padding: '1.25rem',
                                      textAlign: 'center',
                                      border: '1px dashed #cbd5e1',
                                      borderRadius: 8,
                                      background: '#ffffff'
                                    }}
                                  >
                                    <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#475569', marginBottom: 8 }}>
                                      No delivery received from mill yet for Challan #{ch.challanNo}
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenInwardRfdModal(ch);
                                      }}
                                      className="btn-primary"
                                      style={{
                                        padding: '5px 12px',
                                        fontSize: '0.74rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                        border: 'none',
                                        borderRadius: 6,
                                        fontWeight: 700
                                      }}
                                    >
                                      <PlusCircle size={13} /> + Record Received Delivery
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                    }))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* 🥻 SCREEN MODE 2: RFD FABRIC (PROCESSED LOTS)             */}
      {/* ======================================================== */}
      {screenMode === 'rfd' && (
        <>
          {/* RFD Quick HUD with Still at Mill & Shortage KPIs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '1rem'
            }}
          >
            <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #0284c7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  In-Stock RFD Fabric
                </span>
                <Layers size={16} color="#0284c7" />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0284c7' }}>
                {rfdStats.inStockRfdMtrs.toLocaleString('en-IN', { maximumFractionDigits: 1 })} <span style={{ fontSize: '0.85rem' }}>Mtr</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                Available balance for Digital Printing
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Fabric Still at Mill
                </span>
                <Truck size={16} color="#f59e0b" />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#d97706' }}>
                {millBalanceStats.stillAtMillMtrs.toLocaleString('en-IN', { maximumFractionDigits: 1 })} <span style={{ fontSize: '0.85rem' }}>Mtr</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                <strong style={{ color: '#b45309' }}>{millBalanceStats.openChallansCount}</strong> open challans pending from mills
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #ef4444' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Total Mill Shortage / Loss
                </span>
                <TrendingUp size={16} color="#ef4444" />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#dc2626' }}>
                {millBalanceStats.totalShortageMtrs || 0} <span style={{ fontSize: '0.85rem' }}>Mtr</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#b91c1c', marginLeft: 6 }}>
                  ({millBalanceStats.avgShortagePct || 0}%)
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                Total shrinkage loss during scouring & heat set
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  In-Stock Rolls & Lots
                </span>
                <Boxes size={16} color="#10b981" />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#059669' }}>
                {rfdStats.inStockRolls} <span style={{ fontSize: '0.85rem' }}>Rolls</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', marginLeft: 6 }}>
                  ({rfdLots.length} Lots)
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                Processed ready fabric lots
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* 🔍 STANDARDIZED ERP UNIFIED FILTER TOOLBAR                */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <ErpUnifiedFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search RFD Lot #, Mill, Challan #, Quality..."
            datePreset={datePreset}
            onDateChange={({ preset: p, dateStart: ds, dateEnd: de }) => {
              setDatePreset(p);
              setDateStart(ds || '');
              setDateEnd(de || '');
            }}
            customDateStart={customDateStart}
            customDateEnd={customDateEnd}
            onCustomDateChange={(s, e) => {
              setCustomDateStart(s);
              setCustomDateEnd(e);
              setDateStart(s);
              setDateEnd(e);
            }}
            categories={filterCategories}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            filterPlaceholder="Multiple Filters"
            showChips={true}
            onReset={handleResetFilters}
            style={{ marginBottom: '1rem' }}
          />

          {/* RFD Inventory Table */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Processed RFD Fabric Inventory (Ready For Dyeing / Discharge)
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Track received meters, mill shortage loss %, and pending fabric balance still remaining at processing mills.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleOpenInwardRfdModal()}
                className="btn-primary"
                style={{
                  padding: '0.45rem 1rem',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  border: 'none',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
                }}
              >
                <PlusCircle size={15} /> + Inward RFD Lot (Total Mtr & Shortage)
              </button>
            </div>

            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 12px' }}>Lot Number</th>
                    <th style={{ padding: '10px 12px' }}>Inward Date</th>
                    <th style={{ padding: '10px 12px' }}>Processing Mill</th>
                    <th style={{ padding: '10px 12px' }}>Mill Challan #</th>
                    <th style={{ padding: '10px 12px' }}>Fabric Quality</th>
                    <th style={{ padding: '10px 12px' }}>Gray Sent</th>
                    <th style={{ padding: '10px 12px' }}>RFD Received</th>
                    <th style={{ padding: '10px 12px' }}>Shortage Loss</th>
                    <th style={{ padding: '10px 12px' }}>Still at Mill</th>
                    <th style={{ padding: '10px 12px' }}>Available Balance</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', minWidth: '160px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRfdLots.length === 0 ? (
                    <tr>
                      <td colSpan="12" style={{ padding: '1.5rem 0.5rem' }}>
                        {rfdLots.length === 0 ? (
                          <EnterpriseEmptyState
                            icon={Layers}
                            title="Clean Slate — Ready for RFD Inward"
                            description="No RFD fabric lots exist in the system. Click '+ Inward RFD Lot' or inward from an outward mill challan to record received fabric."
                            actionLabel="+ Inward RFD Lot"
                            onAction={() => handleOpenInwardRfdModal()}
                          />
                        ) : (
                          <EnterpriseEmptyState
                            icon={Search}
                            title="No RFD Lots Found"
                            description="No RFD lots match your selected date range or filter settings."
                            actionLabel="Reset All Filters"
                            onAction={handleResetFilters}
                          />
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredRfdLots.map(lot => {
                    const balance = Math.max(0, lot.receivedRfdMeters - (lot.issuedMeters || 0));
                    const isHighShortage = (lot.shrinkagePercent || 0) > 4.0;
                    const rolls = lot.receivedRollsCount || (lot.tps ? lot.tps.length : 1);
                    return (
                      <tr key={lot.id} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover-row">
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0284c7' }}>
                          {lot.lotNumber}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                          {lot.inwardDate}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {lot.millParty}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#64748b' }}>
                          {lot.millChallanNo}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                          {lot.fabricQuality}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                          {lot.graySentMeters} Mtr
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0f172a' }}>
                          {lot.receivedRfdMeters} Mtr
                          <span style={{ display: 'block', fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>
                            {rolls} Rolls
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              background: isHighShortage ? '#fef2f2' : '#f0fdf4',
                              color: isHighShortage ? '#dc2626' : '#16a34a',
                              border: `1px solid ${isHighShortage ? '#fecaca' : '#bbf7d0'}`
                            }}
                          >
                            {lot.shrinkageLossMeters > 0 ? `-${lot.shrinkageLossMeters} Mtr` : '0 Mtr'} ({lot.shrinkagePercent || 0}%)
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {(lot.stillAtMillMeters || 0) > 0 ? (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                background: '#fffbeb',
                                color: '#b45309',
                                border: '1px solid #fde68a'
                              }}
                            >
                              {lot.stillAtMillMeters} Mtr
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                background: '#f8fafc',
                                color: '#64748b'
                              }}
                            >
                              0 Mtr
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: '#16a34a' }}>
                          {balance.toFixed(1)} Mtr
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: '5px',
                              background: '#e0f2fe',
                              color: '#0369a1'
                            }}
                          >
                            {lot.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                            <button
                              onClick={() => setViewingRfdTpsLot(lot)}
                              className="btn-secondary"
                              style={{
                                padding: '3px 8px',
                                fontSize: '0.74rem',
                                height: '28px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#f0f9ff',
                                color: '#0284c7',
                                border: '1px solid #bae6fd',
                                fontWeight: 600
                              }}
                              title="View Lot Reconciliation Details"
                            >
                              <Eye size={13} /> View
                            </button>
                            <button
                              onClick={() => handleOpenEditRfdLot(lot)}
                              className="btn-secondary"
                              style={{
                                padding: '3px 8px',
                                fontSize: '0.74rem',
                                height: '28px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#f8fafc',
                                color: '#0f172a',
                                border: '1px solid #cbd5e1'
                              }}
                              title="Edit RFD Lot"
                            >
                              <Edit2 size={13} /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteRfdLot(lot)}
                              className="btn-secondary"
                              style={{
                                padding: '3px 8px',
                                fontSize: '0.74rem',
                                height: '28px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#fef2f2',
                                color: '#dc2626',
                                border: '1px solid #fecaca'
                              }}
                              title="Delete RFD Lot"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ======================================================== */}
      {/* ⚙️ MODAL: MASTER CONFIGURATION SETTINGS                  */}
      {/* ======================================================== */}
      {showSettingsModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 10500,
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
              maxWidth: 780,
              maxHeight: '92vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: 14,
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Settings size={22} color="#0284c7" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                    Yamunaji Master Configuration Settings
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Configure dropdown values for Weaver Names, Fabric Qualities, Processing Mills & Process Types.
                  </span>
                </div>
              </div>
              <button
                onClick={handleCloseSettingsModal}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Sub Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => { setSettingsActiveTab('weavers'); setEditingItemIndex(null); setNewSettingInput(''); setPartySearchTerm(''); }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: settingsActiveTab === 'weavers' ? 800 : 600,
                  background: settingsActiveTab === 'weavers' ? '#0ea5e9' : 'transparent',
                  color: settingsActiveTab === 'weavers' ? '#ffffff' : '#64748b',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                🧵 Weavers ({configs.weavers?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => { setSettingsActiveTab('qualities'); setEditingItemIndex(null); setNewSettingInput(''); }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: settingsActiveTab === 'qualities' ? 800 : 600,
                  background: settingsActiveTab === 'qualities' ? '#0ea5e9' : 'transparent',
                  color: settingsActiveTab === 'qualities' ? '#ffffff' : '#64748b',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                🥻 Fabric Qualities ({configs.qualities?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => { setSettingsActiveTab('mills'); setEditingItemIndex(null); setNewSettingInput(''); setPartySearchTerm(''); }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: settingsActiveTab === 'mills' ? 800 : 600,
                  background: settingsActiveTab === 'mills' ? '#0ea5e9' : 'transparent',
                  color: settingsActiveTab === 'mills' ? '#ffffff' : '#64748b',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                🏭 Processing Mills ({configs.mills?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => { setSettingsActiveTab('processes'); setEditingItemIndex(null); setNewSettingInput(''); }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: settingsActiveTab === 'processes' ? 800 : 600,
                  background: settingsActiveTab === 'processes' ? '#0ea5e9' : 'transparent',
                  color: settingsActiveTab === 'processes' ? '#ffffff' : '#64748b',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                ⚙️ Process Types ({configs.processes?.length || 0})
              </button>
            </div>

            {/* TAB CONTENT: PARTY TABS (WEAVERS & MILLS) */}
            {(settingsActiveTab === 'weavers' || settingsActiveTab === 'mills') ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* Quick Add Bar & Full Details Button */}
                <form onSubmit={handleAddMasterSetting} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <input
                      type="text"
                      placeholder={`Enter ${settingsActiveTab === 'weavers' ? 'Weaver / Loom Owner Name' : 'Processing Mill Name'} (e.g. Maruti Weaving)...`}
                      value={newSettingInput}
                      onChange={(e) => setNewSettingInput(e.target.value)}
                      className="input-field"
                      style={{ height: '36px', fontSize: '0.82rem', width: '100%' }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{
                      height: '36px',
                      padding: '0 14px',
                      fontSize: '0.82rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                      border: 'none',
                      borderRadius: 8,
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Plus size={15} /> + Add {settingsActiveTab === 'weavers' ? 'Weaver' : 'Mill'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAddParty(settingsActiveTab)}
                    className="btn-secondary"
                    style={{
                      height: '36px',
                      padding: '0 12px',
                      fontSize: '0.80rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      borderRadius: 8,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      color: '#0369a1',
                      borderColor: '#bae6fd',
                      background: '#f0f9ff'
                    }}
                    title="Add with complete GST, factory address, phone and broker details"
                  >
                    <Building size={14} /> + Full Details (GST)
                  </button>
                </form>

                {/* Filter / Search Bar (if items exist) */}
                {(configs[settingsActiveTab] || []).length > 0 && (
                  <div style={{ position: 'relative' }}>
                    <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      placeholder={`Filter existing ${settingsActiveTab === 'weavers' ? 'weavers' : 'mills'} by name, GSTIN, city, phone...`}
                      value={partySearchTerm}
                      onChange={(e) => setPartySearchTerm(e.target.value)}
                      className="input-field"
                      style={{ paddingLeft: '32px', height: '32px', fontSize: '0.78rem', width: '100%' }}
                    />
                  </div>
                )}

                {/* Party Cards List */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.65rem', maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc' }}>
                  {(() => {
                    const rawList = configs[settingsActiveTab] || [];
                    const filtered = rawList.filter(item => {
                      if (!partySearchTerm.trim()) return true;
                      const p = normalizeParty(item);
                      const term = partySearchTerm.toLowerCase();
                      return (
                        p.name.toLowerCase().includes(term) ||
                        p.gst.toLowerCase().includes(term) ||
                        p.address.toLowerCase().includes(term) ||
                        p.city.toLowerCase().includes(term) ||
                        p.phone.toLowerCase().includes(term) ||
                        p.contactPerson.toLowerCase().includes(term) ||
                        p.broker.toLowerCase().includes(term)
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                          {partySearchTerm.trim() ? (
                            <div>
                              <div>No {settingsActiveTab} found matching "{partySearchTerm}".</div>
                              <div style={{ marginTop: '10px' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const term = partySearchTerm.trim();
                                    if (!term) return;
                                    setConfigs(prev => {
                                      const updatedList = [...(prev[settingsActiveTab] || []), normalizeParty(term)];
                                      const updated = { ...prev, [settingsActiveTab]: updatedList };
                                      try { localStorage.setItem(STORAGE_CONFIGS_KEY, JSON.stringify(updated)); } catch (err) {}
                                      return updated;
                                    });
                                    setPartySearchTerm('');
                                    triggerEliteAlert(`"${term}" added to ${settingsActiveTab}!`, 'Saved to Master');
                                  }}
                                  className="btn-primary"
                                  style={{ padding: '5px 14px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                >
                                  <Plus size={14} /> + Add "{partySearchTerm}" to Master
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              No {settingsActiveTab} registered yet. Enter a name above to add to master.
                            </div>
                          )}
                        </div>
                      );
                    }

                    return filtered.map((item, idx) => {
                      const party = normalizeParty(item);
                      const originalIndex = rawList.indexOf(item);
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            padding: '11px 14px',
                            borderRadius: 8,
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0f172a' }}>
                                {party.name}
                              </span>
                              {party.gst ? (
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '1px 8px', borderRadius: 4, letterSpacing: '0.04em' }}>
                                  GSTIN: {party.gst}
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic', background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>
                                  No GST Listed
                                </span>
                              )}
                              {party.broker && (
                                <span style={{ fontSize: '0.72rem', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', padding: '1px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <Briefcase size={11} color="#64748b" /> Agent: {party.broker}
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => handleOpenEditParty(settingsActiveTab, originalIndex >= 0 ? originalIndex : idx, item)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  background: '#f8fafc',
                                  border: '1px solid #cbd5e1',
                                  color: '#334155',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                                title="Edit Party Details"
                              >
                                <Edit2 size={12} color="#0284c7" /> Edit Details
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMasterSetting(originalIndex >= 0 ? originalIndex : idx, item)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  background: '#fef2f2',
                                  border: '1px solid #fecaca',
                                  color: '#ef4444',
                                  cursor: 'pointer'
                                }}
                                title="Delete Party"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Address, Phone, Contact Grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '6px', fontSize: '0.78rem', color: '#475569', marginTop: 2 }}>
                            {(party.address || party.city) && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <MapPin size={13} color="#0284c7" style={{ flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {party.address ? `${party.address}, ${party.city}` : party.city}
                                </span>
                              </div>
                            )}
                            {party.phone && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Phone size={13} color="#16a34a" style={{ flexShrink: 0 }} />
                                <span>{party.phone}</span>
                              </div>
                            )}
                            {party.contactPerson && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <User size={13} color="#6366f1" style={{ flexShrink: 0 }} />
                                <span>Contact: <strong>{party.contactPerson}</strong></span>
                              </div>
                            )}
                            {party.processTypes && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Sliders size={13} color="#d97706" style={{ flexShrink: 0 }} />
                                <span>Processes: {party.processTypes}</span>
                              </div>
                            )}
                          </div>

                          {party.notes && (
                            <div style={{ fontSize: '0.72rem', color: '#64748b', background: '#f8fafc', padding: '3px 8px', borderRadius: 4, marginTop: 2 }}>
                              📝 {party.notes}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : (
              /* TAB CONTENT: QUALITIES, PROCESSES */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* Quick Add Bar */}
                <form onSubmit={handleAddMasterSetting} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    required
                    placeholder={
                      settingsActiveTab === 'qualities' ? 'Enter Fabric Quality (e.g. Cotton 60x60 Cambric, Pure Viscose Rayon)...' :
                      'Enter Process Type (e.g. RFD Bleaching, Scouring & Heat Setting)...'
                    }
                    value={newSettingInput}
                    onChange={(e) => setNewSettingInput(e.target.value)}
                    className="input-field"
                    style={{ height: '36px', fontSize: '0.82rem', flex: 1 }}
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ height: '36px', padding: '0 16px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '5px', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    <Plus size={15} /> + Add to Master
                  </button>
                </form>

                {/* Items List */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.5rem', maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', background: '#f8fafc' }}>
                  {(configs[settingsActiveTab] || []).length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                      No items configured for {settingsActiveTab === 'qualities' ? 'Fabric Qualities' : 'Process Types'}. Type a name above and click "+ Add to Master".
                    </div>
                  ) : (
                    (configs[settingsActiveTab] || []).map((item, idx) => {
                      const isEditing = editingItemIndex === idx;
                      const textVal = typeof item === 'object' ? item.name : item;
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: 6,
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                          }}
                        >
                          {isEditing ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, marginRight: '10px' }}>
                              <input
                                type="text"
                                value={editingItemValue}
                                onChange={(e) => setEditingItemValue(e.target.value)}
                                className="input-field"
                                style={{ height: '30px', fontSize: '0.8rem', width: '100%' }}
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEditMasterSetting(idx)}
                                className="btn-primary"
                                style={{ height: '30px', padding: '0 10px', fontSize: '0.74rem', background: '#0284c7', border: 'none', borderRadius: 6 }}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingItemIndex(null)}
                                className="btn-secondary"
                                style={{ height: '30px', padding: '0 8px', fontSize: '0.74rem' }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1e293b' }}>
                              {textVal}
                            </span>
                          )}

                          {!isEditing && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() => handleStartEditMasterSetting(idx, item)}
                                style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', padding: 4 }}
                                title="Edit / Rename"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMasterSetting(idx, item)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer with Save & Close */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
              <button
                type="button"
                onClick={handleCloseSettingsModal}
                className="btn-primary"
                style={{
                  padding: '0.45rem 1.4rem',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                  border: 'none',
                  borderRadius: 8,
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)'
                }}
              >
                <Check size={15} /> Save & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 🏛️ SUB-MODAL: ADD / EDIT PARTY DETAILS (GST, ADDRESS, ETC)*/}
      {/* ======================================================== */}
      {showPartyModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(5px)',
            zIndex: 10600,
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
              maxWidth: 580,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: 14,
              boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.15rem'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building size={22} color="#0284c7" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                    {partyModalMode === 'add' ? '+ Add New' : 'Edit'} {partyModalType === 'weavers' ? 'Weaver Party' : 'Processing Mill'} Details
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    Enter party GSTIN, complete address, phone, contact person and brokerage details.
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowPartyModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveParty} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                  Party / Firm Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder={partyModalType === 'weavers' ? 'e.g. Maruti Weaving Works' : 'e.g. Shree Radhe Bleaching & Dyeing Processors'}
                  value={partyModalForm.name}
                  onChange={(e) => setPartyModalForm(prev => ({ ...prev, name: e.target.value }))}
                  className="input-field"
                  style={{ height: '36px', fontSize: '0.85rem', width: '100%', fontWeight: 700 }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                    GSTIN (GST Number)
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="e.g. 24AABCM1234F1Z8"
                    value={partyModalForm.gst}
                    onChange={(e) => setPartyModalForm(prev => ({ ...prev, gst: e.target.value.toUpperCase() }))}
                    className="input-field"
                    style={{ height: '34px', fontSize: '0.82rem', width: '100%', letterSpacing: '0.04em', fontFamily: 'monospace' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                    Phone / Mobile
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +91 98251 12345"
                    value={partyModalForm.phone}
                    onChange={(e) => setPartyModalForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="input-field"
                    style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                  Factory / Office Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Plot No. 42-45, Phase-2, GIDC Pandesara"
                  value={partyModalForm.address}
                  onChange={(e) => setPartyModalForm(prev => ({ ...prev, address: e.target.value }))}
                  className="input-field"
                  style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                    City & State
                  </label>
                  <input
                    type="text"
                    placeholder="Surat, Gujarat - 394221"
                    value={partyModalForm.city}
                    onChange={(e) => setPartyModalForm(prev => ({ ...prev, city: e.target.value }))}
                    className="input-field"
                    style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hareshbhai Patel"
                    value={partyModalForm.contactPerson}
                    onChange={(e) => setPartyModalForm(prev => ({ ...prev, contactPerson: e.target.value }))}
                    className="input-field"
                    style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>
              </div>

              {partyModalType === 'weavers' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                    Broker / Textile Agent
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Dalal or Direct"
                    value={partyModalForm.broker}
                    onChange={(e) => setPartyModalForm(prev => ({ ...prev, broker: e.target.value }))}
                    className="input-field"
                    style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                    Process Specializations / Services
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. RFD Bleaching, Scouring, Mercerizing, Bio Wash"
                    value={partyModalForm.processTypes}
                    onChange={(e) => setPartyModalForm(prev => ({ ...prev, processTypes: e.target.value }))}
                    className="input-field"
                    style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                  Notes / Payment Terms
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. 30 Days Credit. Fast turnaround on 14kg rayon."
                  value={partyModalForm.notes}
                  onChange={(e) => setPartyModalForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="input-field"
                  style={{ fontSize: '0.82rem', width: '100%', resize: 'none', padding: '6px 8px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowPartyModal(false)}
                  className="btn-secondary"
                  style={{ height: '36px', padding: '0 16px', fontSize: '0.82rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ height: '36px', padding: '0 18px', fontSize: '0.82rem', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', border: 'none', fontWeight: 700 }}
                >
                  Save Party Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ➕ MODAL 1: WEAVER GRAY INWARD WITH TP DETAILS TABLE     */}
      {/* ======================================================== */}
      {showWeaverInwardModal && (
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
              width: '96vw',
              maxWidth: 1260,
              height: 'min(92vh, 880px)',
              maxHeight: '92vh',
              overflow: 'hidden',
              background: '#ffffff',
              borderRadius: 16,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              padding: '1rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.6rem', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Boxes size={20} color="#0284c7" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                      + Inward Gray Fabric from Weaver
                    </h3>
                    <span style={{ fontSize: '0.7rem', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 4, fontWeight: 800 }}>
                      Warehouse Stock Inward
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Enter weaver & quality on the left. Put number of received TPs on the right to auto-generate roll rows instantly.
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowWeaverInwardModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Inward Form - 2 Column Split Layout */}
            <form onSubmit={handleSaveWeaverInward} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(360px, 1fr) minmax(420px, 1.15fr)',
                  gap: '1rem',
                  flex: 1,
                  minHeight: 0
                }}
              >
                {/* ⬅️ LEFT COLUMN: All Details & Invoice Integration */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', height: '100%', minHeight: 0, overflowY: 'auto', paddingRight: '6px' }}>
                  {/* Card 1: Lot & Weaver Details */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.4rem', marginBottom: '0.2rem' }}>
                      <Boxes size={15} color="#0284c7" />
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                        Lot Identification & Weaver
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: 2 }}>
                          Lot Number (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder={`GRAY-2026-${String(grayLots.length + 1).padStart(3, '0')}`}
                          value={weaverForm.lotNumber}
                          onChange={(e) => setWeaverForm(prev => ({ ...prev, lotNumber: e.target.value }))}
                          className="input-field"
                          style={{ height: '32px', fontSize: '0.82rem', width: '100%' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: 2 }}>
                          Inward Date *
                        </label>
                        <input
                          type="date"
                          required
                          value={weaverForm.inwardDate}
                          onChange={(e) => setWeaverForm(prev => ({ ...prev, inwardDate: e.target.value }))}
                          className="input-field"
                          style={{ height: '32px', fontSize: '0.82rem', width: '100%' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '0.65rem' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>
                            Weaver / Loom Owner Name *
                          </label>
                          <button
                            type="button"
                            onClick={() => { setSettingsActiveTab('weavers'); setShowSettingsModal(true); }}
                            style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.66rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            ⚙️ Manage
                          </button>
                        </div>
                        <input
                          type="text"
                          required
                          list="weavers-master-datalist"
                          placeholder="Select or enter weaver name..."
                          value={weaverForm.weaverParty}
                          onChange={(e) => setWeaverForm(prev => ({ ...prev, weaverParty: e.target.value }))}
                          className="input-field"
                          style={{ height: '32px', fontSize: '0.82rem', width: '100%' }}
                        />
                        <datalist id="weavers-master-datalist">
                          {(configs.weavers || []).map((w, idx) => {
                            const party = normalizeParty(w);
                            return (
                              <option
                                key={idx}
                                value={party.name}
                                label={party.gst ? `GST: ${party.gst} | ${party.address || party.city}` : ''}
                              />
                            );
                          })}
                        </datalist>

                        {selectedWeaverDetails && (
                          <div style={{ marginTop: 4, fontSize: '0.7rem', background: '#ffffff', padding: '3px 6px', borderRadius: 5, border: '1px solid #cbd5e1', color: '#475569', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {selectedWeaverDetails.gst && (
                              <span style={{ fontWeight: 800, color: '#16a34a' }}>GSTIN: {selectedWeaverDetails.gst}</span>
                            )}
                            {selectedWeaverDetails.city && (
                              <span style={{ color: '#0284c7' }}>📍 {selectedWeaverDetails.city}</span>
                            )}
                            {selectedWeaverDetails.phone && (
                              <span>📞 {selectedWeaverDetails.phone}</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: 2 }}>
                          Weaver Gray Challan No
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. CH-8901"
                          value={weaverForm.weaverChallanNo}
                          onChange={(e) => setWeaverForm(prev => ({ ...prev, weaverChallanNo: e.target.value }))}
                          className="input-field"
                          style={{ height: '32px', fontSize: '0.82rem', width: '100%' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '0.65rem' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>
                            Fabric Quality *
                          </label>
                          <button
                            type="button"
                            onClick={() => { setSettingsActiveTab('qualities'); setShowSettingsModal(true); }}
                            style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.66rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            ⚙️ Manage
                          </button>
                        </div>
                        <select
                          value={weaverForm.fabricQuality}
                          onChange={(e) => setWeaverForm(prev => ({ ...prev, fabricQuality: e.target.value }))}
                          className="input-field"
                          style={{ height: '32px', fontSize: '0.82rem', width: '100%' }}
                          required
                        >
                          <option value="">-- Select Fabric Quality * --</option>
                          {(configs.qualities || []).map(q => (
                            <option key={q} value={q}>{q}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: 2 }}>
                          Rate / Mtr (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="e.g. 42.50"
                          value={weaverForm.ratePerMeter}
                          onChange={(e) => setWeaverForm(prev => ({ ...prev, ratePerMeter: e.target.value }))}
                          className="input-field"
                          style={{ height: '32px', fontSize: '0.82rem', width: '100%' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: 2 }}>
                          Rack / Warehouse Location (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Rack A-04"
                          value={weaverForm.rackLocation}
                          onChange={(e) => setWeaverForm(prev => ({ ...prev, rackLocation: e.target.value }))}
                          className="input-field"
                          style={{ height: '32px', fontSize: '0.82rem', width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: 2 }}>
                          Remarks / Notes
                        </label>
                        <input
                          type="text"
                          placeholder="Optional remarks..."
                          value={weaverForm.remarks}
                          onChange={(e) => setWeaverForm(prev => ({ ...prev, remarks: e.target.value }))}
                          className="input-field"
                          style={{ height: '32px', fontSize: '0.82rem', width: '100%' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Weaver Commercial Invoice Details */}
                  <div style={{
                    border: weaverForm.invoiceReceivedOption === 'pending' ? '1.5px solid #f59e0b' : '1.5px solid #0284c7',
                    borderRadius: 10,
                    background: weaverForm.invoiceReceivedOption === 'pending' ? '#fffdf7' : '#f8fafc',
                    padding: '0.85rem 1rem',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <FileText size={16} color={weaverForm.invoiceReceivedOption === 'pending' ? '#d97706' : '#0284c7'} />
                        <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
                          Weaver Commercial Invoice Status
                        </span>
                        <span style={{
                          fontSize: '0.68rem',
                          background: weaverForm.invoiceReceivedOption === 'pending' ? '#fef3c7' : '#e0f2fe',
                          color: weaverForm.invoiceReceivedOption === 'pending' ? '#b45309' : '#0369a1',
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontWeight: 800
                        }}>
                          {weaverForm.invoiceReceivedOption === 'pending' ? '⏳ Bill Pending' : '✓ Bill Received'}
                        </span>
                      </div>

                      {weaverForm.invoiceReceivedOption === 'received' && (
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 800, color: weaverForm.postToPurchase ? '#0369a1' : '#64748b', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={weaverForm.postToPurchase}
                            onChange={e => setWeaverForm(prev => ({ ...prev, postToPurchase: e.target.checked }))}
                            style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#0284c7' }}
                          />
                          Auto-Post Purchase
                        </label>
                      )}
                    </div>

                    {/* Radio Options: Received with Challan vs Pending / Arrives Later */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                      <div
                        onClick={() => setWeaverForm(prev => ({ ...prev, invoiceReceivedOption: 'received' }))}
                        style={{
                          border: weaverForm.invoiceReceivedOption === 'received' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                          background: weaverForm.invoiceReceivedOption === 'received' ? '#eff6ff' : '#ffffff',
                          borderRadius: 8,
                          padding: '6px 10px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <input
                          type="radio"
                          name="weaverInvoiceOption"
                          checked={weaverForm.invoiceReceivedOption === 'received'}
                          onChange={() => setWeaverForm(prev => ({ ...prev, invoiceReceivedOption: 'received' }))}
                          style={{ cursor: 'pointer', accentColor: '#0284c7' }}
                        />
                        <div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: weaverForm.invoiceReceivedOption === 'received' ? '#0369a1' : '#334155' }}>
                            📄 Bill Received
                          </div>
                          <div style={{ fontSize: '0.66rem', color: '#64748b' }}>
                            Invoice received with challan
                          </div>
                        </div>
                      </div>

                      <div
                        onClick={() => setWeaverForm(prev => ({ ...prev, invoiceReceivedOption: 'pending' }))}
                        style={{
                          border: weaverForm.invoiceReceivedOption === 'pending' ? '2px solid #f59e0b' : '1px solid #cbd5e1',
                          background: weaverForm.invoiceReceivedOption === 'pending' ? '#fffbeb' : '#ffffff',
                          borderRadius: 8,
                          padding: '6px 10px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <input
                          type="radio"
                          name="weaverInvoiceOption"
                          checked={weaverForm.invoiceReceivedOption === 'pending'}
                          onChange={() => setWeaverForm(prev => ({ ...prev, invoiceReceivedOption: 'pending' }))}
                          style={{ cursor: 'pointer', accentColor: '#f59e0b' }}
                        />
                        <div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: weaverForm.invoiceReceivedOption === 'pending' ? '#b45309' : '#334155' }}>
                            ⏳ Bill Pending
                          </div>
                          <div style={{ fontSize: '0.66rem', color: '#64748b' }}>
                            Invoice pending / to be received later
                          </div>
                        </div>
                      </div>
                    </div>

                    {weaverForm.invoiceReceivedOption === 'pending' ? (
                      <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <Clock size={16} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
                        <div style={{ fontSize: '0.74rem', color: '#92400e', lineHeight: 1.45 }}>
                          <strong>Invoice Pending:</strong> Fabric is inwarded to stock now so mill dispatch won't be delayed. You can attach the bill later with 1-click.
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.55rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#334155', marginBottom: 2 }}>
                              Invoice No
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. INV-2026/89"
                              value={weaverForm.invoiceNo}
                              onChange={e => setWeaverForm(prev => ({ ...prev, invoiceNo: e.target.value }))}
                              className="input-field"
                              style={{ height: '30px', fontSize: '0.8rem', width: '100%' }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#334155', marginBottom: 2 }}>
                              Invoice Date
                            </label>
                            <input
                              type="date"
                              value={weaverForm.invoiceDate}
                              onChange={e => setWeaverForm(prev => ({ ...prev, invoiceDate: e.target.value }))}
                              className="input-field"
                              style={{ height: '30px', fontSize: '0.8rem', width: '100%' }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#334155', marginBottom: 2 }}>
                              HSN Code
                            </label>
                            <input
                              type="text"
                              list="fabric-hsn-datalist"
                              placeholder="5208"
                              value={weaverForm.hsnCode}
                              onChange={e => setWeaverForm(prev => ({ ...prev, hsnCode: e.target.value }))}
                              className="input-field"
                              style={{ height: '30px', fontSize: '0.8rem', width: '100%' }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#334155', marginBottom: 2 }}>
                              GST Rate %
                            </label>
                            <select
                              value={weaverForm.gstRate}
                              onChange={e => setWeaverForm(prev => ({ ...prev, gstRate: e.target.value }))}
                              className="input-field"
                              style={{ height: '30px', fontSize: '0.8rem', width: '100%' }}
                            >
                              <option value="5">5% (Textile Fabric)</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="0">0% (Nil)</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#334155', marginBottom: 2 }}>
                              Payment Terms
                            </label>
                            <select
                              value={weaverForm.paymentTerms}
                              onChange={e => setWeaverForm(prev => ({ ...prev, paymentTerms: e.target.value }))}
                              className="input-field"
                              style={{ height: '30px', fontSize: '0.8rem', width: '100%' }}
                            >
                              <option value="30 Days">30 Days</option>
                              <option value="15 Days">15 Days</option>
                              <option value="45 Days">45 Days</option>
                              <option value="60 Days">60 Days</option>
                              <option value="Immediate Cash">Cash</option>
                            </select>
                          </div>
                        </div>

                        {/* Live Financial Calculations Ribbon */}
                        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '0.74rem' }}>
                            <span style={{ color: '#475569' }}>
                              Taxable: <strong style={{ color: '#0f172a' }}>₹{weaverFormSummary.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                            </span>
                            <span style={{ color: '#475569' }}>
                              GST ({weaverFormSummary.gstPct}%): <strong style={{ color: '#0f172a' }}>₹{weaverFormSummary.gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                            </span>
                          </div>

                          <div style={{ fontSize: '0.84rem', fontWeight: 900, color: '#16a34a' }}>
                            Total Bill: <span style={{ fontSize: '0.96rem', color: '#059669' }}>₹{weaverFormSummary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* ➡️ RIGHT COLUMN: TP Breakdown Entries Table */}
                <div style={{
                  background: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: 12,
                  padding: '0.75rem 0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  height: '100%',
                  minHeight: 0
                }}>
                  {/* Header with Title and the User's requested Auto-Generate Input */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.45rem', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Hash size={16} color="#0284c7" />
                      <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0f172a' }}>
                        TP (Piece) Breakdown Entries
                      </span>
                      <span style={{ fontSize: '0.7rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 7px', borderRadius: 4, fontWeight: 800 }}>
                        {weaverForm.tps.length} Rows
                      </span>
                    </div>

                    {/* ⚡ DIRECT INPUT FIELD: Type number of received TPs to auto-add rows! */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#eff6ff', border: '1.5px solid #38bdf8', padding: '3px 8px', borderRadius: 8 }}>
                      <label htmlFor="received-tp-auto-count" style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0369a1', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        📦 Received TPs / Rolls:
                      </label>
                      <input
                        id="received-tp-auto-count"
                        type="number"
                        min="1"
                        max="500"
                        placeholder="e.g. 25"
                        value={tpCountInput !== '' ? tpCountInput : weaverForm.tps.length}
                        onChange={(e) => handleSetTpRowCount(e.target.value)}
                        style={{
                          width: '68px',
                          height: '28px',
                          fontSize: '0.85rem',
                          fontWeight: 900,
                          color: '#0284c7',
                          textAlign: 'center',
                          background: '#ffffff',
                          border: '1.5px solid #0284c7',
                          borderRadius: 6,
                          outline: 'none'
                        }}
                        title="Put the number of received TPs here (e.g. 25) to auto-add that exact number of rows immediately!"
                      />
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0369a1' }}>TPs</span>
                    </div>
                  </div>

                  {/* Quick Presets / Actions toolbar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#64748b', flexShrink: 0 }}>
                    <span>Type meters and press <kbd style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>Enter ↵</kbd> to jump to next TP.</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleAddMultipleTpRows(5)}
                        className="btn-secondary"
                        style={{ padding: '2px 7px', fontSize: '0.7rem', height: '24px' }}
                        title="Add 5 more rows"
                      >
                        +5
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddMultipleTpRows(10)}
                        className="btn-secondary"
                        style={{ padding: '2px 7px', fontSize: '0.7rem', height: '24px' }}
                        title="Add 10 more rows"
                      >
                        +10
                      </button>
                      <button
                        type="button"
                        onClick={handleAddTpRow}
                        className="btn-secondary"
                        style={{ padding: '2px 7px', fontSize: '0.7rem', height: '24px', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}
                        title="Add 1 row"
                      >
                        +1 Row
                      </button>
                      {weaverForm.tps.length > 1 && (
                        <button
                          type="button"
                          onClick={handleClearAllTps}
                          style={{ padding: '2px 7px', fontSize: '0.7rem', height: '24px', background: 'none', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}
                          title="Reset rows to 1"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Scrollable Table of TPs with flexible height */}
                  <div style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    background: '#ffffff'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 3, background: '#f8fafc' }}>
                        <tr style={{ textAlign: 'left', color: '#475569', fontSize: '0.7rem', textTransform: 'uppercase', borderBottom: '1.5px solid #cbd5e1' }}>
                          <th style={{ padding: '6px 6px', width: 44, textAlign: 'center' }}>Sr</th>
                          <th style={{ padding: '6px 6px', width: 105, textAlign: 'center' }}>TP No.</th>
                          <th style={{ padding: '6px 12px', textAlign: 'right' }}>TP Meter (Mtr) *</th>
                          <th style={{ padding: '6px 6px', width: 36, textAlign: 'center' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {weaverForm.tps.map((tp, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                            <td style={{ padding: '3px 6px', fontWeight: 800, color: '#64748b', textAlign: 'center', fontSize: '0.76rem' }}>
                              {tp.srNo}
                            </td>
                            <td style={{ padding: '3px 6px' }}>
                              <input
                                type="text"
                                value={tp.tpNo}
                                onChange={(e) => handleTpChange(idx, 'tpNo', e.target.value)}
                                placeholder={`TP-${idx + 1}`}
                                className="input-field"
                                style={{ height: '28px', fontSize: '0.78rem', width: '100%', textAlign: 'center' }}
                              />
                            </td>
                            <td style={{ padding: '3px 6px' }}>
                              <input
                                id={`tp-mtr-input-${idx}`}
                                type="text"
                                inputMode="decimal"
                                value={tp.tpMtr}
                                onChange={(e) => handleTpChange(idx, 'tpMtr', e.target.value)}
                                onKeyDown={(e) => handleTpKeyDown(e, idx)}
                                placeholder="e.g. 102.5"
                                className="input-field"
                                style={{
                                  height: '28px',
                                  fontSize: '0.84rem',
                                  fontWeight: 800,
                                  color: '#0f172a',
                                  width: '100%',
                                  textAlign: 'right',
                                  paddingRight: '12px',
                                  fontVariantNumeric: 'tabular-nums',
                                  background: tp.tpMtr ? '#f0fdf4' : '#ffffff',
                                  borderColor: tp.tpMtr ? '#86efac' : '#cbd5e1'
                                }}
                              />
                            </td>
                            <td style={{ padding: '3px 6px', textAlign: 'center' }}>
                              {weaverForm.tps.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTpRow(idx)}
                                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 2 }}
                                  title="Delete this row"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* TP Live Summary Bar */}
                  <div style={{
                    background: '#f1f5f9',
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.76rem',
                    flexShrink: 0
                  }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span>
                        Filled Pieces: <strong style={{ color: '#0284c7' }}>{weaverFormSummary.filledTps || weaverFormSummary.totalTps}</strong> / {weaverForm.tps.length}
                      </span>
                      {weaverFormSummary.filledTps > 0 && (
                        <span style={{ color: '#64748b' }}>
                          Avg: <strong>{(weaverFormSummary.totalMtrs / weaverFormSummary.filledTps).toFixed(1)} Mtr/TP</strong>
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.84rem', fontWeight: 900, color: '#0f172a' }}>
                      Total Gray: <span style={{ color: '#0284c7', fontSize: '1.04rem' }}>{weaverFormSummary.totalMtrs}</span> Mtr
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', flexShrink: 0, borderTop: '1px solid #e2e8f0', paddingTop: '0.65rem', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>Quality: <strong style={{ color: '#0f172a' }}>{weaverForm.fabricQuality || 'Not Selected'}</strong></span>
                  <span>•</span>
                  <span>Total: <strong style={{ color: '#0284c7' }}>{weaverFormSummary.totalMtrs} Mtr</strong> ({weaverFormSummary.filledTps || 0} TPs)</span>
                  <span>•</span>
                  <span style={{
                    fontSize: '0.68rem',
                    padding: '2px 7px',
                    borderRadius: 4,
                    fontWeight: 800,
                    background: weaverForm.invoiceReceivedOption === 'pending' ? '#fef3c7' : '#dcfce7',
                    color: weaverForm.invoiceReceivedOption === 'pending' ? '#b45309' : '#15803d'
                  }}>
                    {weaverForm.invoiceReceivedOption === 'pending' ? '⏳ Bill Pending' : '✓ Bill Received'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowWeaverInwardModal(false)}
                    className="btn-secondary"
                    style={{ padding: '0.45rem 1.1rem', fontSize: '0.82rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{
                      padding: '0.45rem 1.35rem',
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Check size={16} /> Save Gray Fabric Inward
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 🚚 MODAL 2: CREATE OUTWARD CHALLAN FOR PROCESSING MILL   */}
      {/* ======================================================== */}
      {showMillChallanModal && (
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
              maxWidth: 780,
              maxHeight: '92vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: 14,
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Truck size={22} color="#15803d" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                    + Create Delivery Challan for Mill
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Select Gray Fabric TPs from stock to dispatch to the processing mill for RFD.
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowMillChallanModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateMillChallan} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                    Challan No (Auto if blank)
                  </label>
                  <input
                    type="text"
                    placeholder={`MILL-CH-${String(millChallans.length + 101)}`}
                    value={millChallanForm.challanNo}
                    onChange={(e) => setMillChallanForm(prev => ({ ...prev, challanNo: e.target.value }))}
                    className="input-field"
                    style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                    Challan Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={millChallanForm.challanDate}
                    onChange={(e) => setMillChallanForm(prev => ({ ...prev, challanDate: e.target.value }))}
                    className="input-field"
                    style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155' }}>
                      Processing / Dyeing Mill Name *
                    </label>
                    <button
                      type="button"
                      onClick={() => { setSettingsActiveTab('mills'); setShowSettingsModal(true); }}
                      style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      ⚙️ Manage Mills
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <input
                      type="text"
                      required
                      list="mills-master-datalist"
                      placeholder="Select or enter processing mill name..."
                      value={millChallanForm.millParty}
                      onChange={(e) => setMillChallanForm(prev => ({ ...prev, millParty: e.target.value }))}
                      className="input-field"
                      style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
                    />
                    <datalist id="mills-master-datalist">
                      {(configs.mills || []).map((m, idx) => {
                        const party = normalizeParty(m);
                        return (
                          <option
                            key={idx}
                            value={party.name}
                            label={party.gst ? `GST: ${party.gst} | ${party.address || party.city}` : ''}
                          />
                        );
                      })}
                    </datalist>

                    {selectedMillDetails && (
                      <div style={{ fontSize: '0.72rem', background: '#f0fdf4', padding: '4px 8px', borderRadius: 6, border: '1px solid #bbf7d0', color: '#166534', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {selectedMillDetails.gst && (
                          <span style={{ fontWeight: 800 }}>
                            GSTIN: {selectedMillDetails.gst}
                          </span>
                        )}
                        {selectedMillDetails.address && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                            <MapPin size={11} color="#16a34a" /> {selectedMillDetails.address}, {selectedMillDetails.city}
                          </span>
                        )}
                        {selectedMillDetails.phone && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                            <Phone size={11} color="#16a34a" /> {selectedMillDetails.phone}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                    Vehicle / Tempo No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. GJ-05-XX-1234"
                    value={millChallanForm.vehicleNo}
                    onChange={(e) => setMillChallanForm(prev => ({ ...prev, vehicleNo: e.target.value }))}
                    className="input-field"
                    style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155' }}>
                    Process Instructions for Mill
                  </label>
                  <button
                    type="button"
                    onClick={() => { setSettingsActiveTab('processes'); setShowSettingsModal(true); }}
                    style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    ⚙️ Manage Processes
                  </button>
                </div>
                <input
                  type="text"
                  list="processes-master-datalist"
                  placeholder="e.g. RFD Bleaching, Scouring, Mercerizing & Heat Setting"
                  value={millChallanForm.processRequired}
                  onChange={(e) => setMillChallanForm(prev => ({ ...prev, processRequired: e.target.value }))}
                  className="input-field"
                  style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
                />
                <datalist id="processes-master-datalist">
                  {(configs.processes || []).map(p => <option key={p} value={p} />)}
                </datalist>
              </div>

              {/* 🧵 1. SELECT FABRIC QUALITY & INWARD CHALLAN */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <Layers size={15} color="#0284c7" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>
                    1. Select Fabric Quality & Inward Challan
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', marginLeft: 'auto' }}>
                    (Only inward challans & TPs of selected quality are shown)
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                  {/* Fabric Quality Selector */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                      Fabric Quality *
                    </label>
                    <select
                      value={millChallanForm.fabricQuality}
                      onChange={(e) => handleQualityChangeForOutward(e.target.value)}
                      className="input-field"
                      style={{ height: '34px', fontSize: '0.8rem', width: '100%', fontWeight: 700 }}
                    >
                      <option value="">-- Select Fabric Quality * --</option>
                      {grayStockQualities.map(item => (
                        <option key={item.quality} value={item.quality}>
                          {item.quality} {item.inStockTps > 0 ? `(${item.inStockTps} In Stock, ${item.inStockMtr.toFixed(0)} Mtr)` : `(0 In Stock)`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Inward Challan / Lot Selector */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                      Filter by Weaver Challan / Lot
                    </label>
                    <select
                      value={millChallanForm.selectedLotId}
                      onChange={(e) => setMillChallanForm(prev => ({ ...prev, selectedLotId: e.target.value }))}
                      className="input-field"
                      style={{ height: '34px', fontSize: '0.8rem', width: '100%' }}
                    >
                      <option value="all">
                        All Inward Challans ({lotsMatchingQuality.length} Lots Available)
                      </option>
                      {lotsMatchingQuality.map(lot => {
                        const inStockCount = (lot.tps || []).filter(t => t.status === 'In Stock').length;
                        return (
                          <option key={lot.id} value={lot.id}>
                            Lot #{lot.lotNumber} | Weaver: {lot.weaverParty} | Ch: {lot.weaverChallanNo || lot.lotNumber} ({inStockCount} in stock)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>

              {/* 📦 2. SELECT TP PIECES TO SEND TO MILL */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: '#f8fafc', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                      2. Select TP Pieces for Outward Challan
                    </span>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b' }}>
                      Quality: <strong style={{ color: '#0284c7' }}>{millChallanForm.fabricQuality}</strong> • Available to Send: <strong style={{ color: '#16a34a' }}>{availableInStockTpsCount} TPs</strong>
                      {outwardedTpsCount > 0 && ` • Already Outwarded: ${outwardedTpsCount} TPs (Locked)`}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      disabled={availableInStockTpsCount === 0}
                      onClick={handleSelectAllInStock}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        borderRadius: 4,
                        border: '1px solid #bbf7d0',
                        background: '#f0fdf4',
                        color: '#166534',
                        cursor: availableInStockTpsCount > 0 ? 'pointer' : 'not-allowed',
                        opacity: availableInStockTpsCount > 0 ? 1 : 0.6
                      }}
                    >
                      Select All Available ({availableInStockTpsCount})
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllInStock}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        borderRadius: 4,
                        border: '1px solid #e2e8f0',
                        background: '#ffffff',
                        color: '#64748b',
                        cursor: 'pointer'
                      }}
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '4px' }}>
                  {displayedTpsForOutward.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                      No gray fabric pieces found for <strong>{millChallanForm.fabricQuality}</strong>. Please inward gray fabric from weaver first or select another quality.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '6px 8px', width: 40, textAlign: 'center' }}>Select</th>
                          <th style={{ padding: '6px 8px' }}>Lot #</th>
                          <th style={{ padding: '6px 8px' }}>Weaver Challan / Party</th>
                          <th style={{ padding: '6px 8px' }}>Quality</th>
                          <th style={{ padding: '6px 8px' }}>TP No</th>
                          <th style={{ padding: '6px 8px' }}>TP Meter</th>
                          <th style={{ padding: '6px 8px' }}>Status / Outward Info</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedTpsForOutward.map((tp, idx) => {
                          const key = `${tp.lotId}__${tp.tpIndex}`;
                          const isSelected = Boolean(millChallanForm.selectedTpKeys[key]);
                          return (
                            <tr
                              key={idx}
                              onClick={() => {
                                if (tp.isInStock) {
                                  handleToggleTpSelection(tp.lotId, tp.tpIndex, true);
                                }
                              }}
                              style={{
                                cursor: tp.isInStock ? 'pointer' : 'not-allowed',
                                background: tp.isOutwarded
                                  ? '#f8fafc'
                                  : isSelected
                                    ? '#ecfdf5'
                                    : '#ffffff',
                                borderBottom: '1px solid #f1f5f9',
                                opacity: tp.isOutwarded ? 0.72 : 1,
                                transition: 'background 0.15s ease'
                              }}
                            >
                              <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                {tp.isOutwarded ? (
                                  <input
                                    type="checkbox"
                                    disabled
                                    checked={false}
                                    title="Already outwarded to mill"
                                    style={{ cursor: 'not-allowed' }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleTpSelection(tp.lotId, tp.tpIndex, true)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                )}
                              </td>
                              <td style={{ padding: '6px 8px', fontWeight: 700, color: tp.isOutwarded ? '#64748b' : '#0284c7' }}>
                                {tp.lotNumber}
                              </td>
                              <td style={{ padding: '6px 8px', color: tp.isOutwarded ? '#94a3b8' : '#334155' }}>
                                <div style={{ fontWeight: 600 }}>{tp.weaverParty}</div>
                                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Ch: {tp.weaverChallanNo}</div>
                              </td>
                              <td style={{ padding: '6px 8px', color: tp.isOutwarded ? '#94a3b8' : '#334155' }}>
                                {tp.fabricQuality}
                              </td>
                              <td style={{ padding: '6px 8px', fontWeight: 800, color: tp.isOutwarded ? '#94a3b8' : '#0f172a' }}>
                                TP-{tp.tpNo}
                              </td>
                              <td style={{ padding: '6px 8px', fontWeight: 800, color: tp.isOutwarded ? '#94a3b8' : '#059669' }}>
                                {tp.tpMtr} Mtr
                              </td>
                              <td style={{ padding: '6px 8px' }}>
                                {tp.isOutwarded ? (
                                  <span
                                    style={{
                                      fontSize: '0.68rem',
                                      fontWeight: 800,
                                      padding: '2px 8px',
                                      borderRadius: 4,
                                      background: '#f1f5f9',
                                      color: '#64748b',
                                      border: '1px solid #cbd5e1',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3
                                    }}
                                  >
                                    <Lock size={10} color="#64748b" /> Already Outwarded ({tp.millChallanNo || 'At Mill'})
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: '0.68rem',
                                      fontWeight: 800,
                                      padding: '2px 8px',
                                      borderRadius: 4,
                                      background: '#dcfce7',
                                      color: '#15803d',
                                      border: '1px solid #bbf7d0',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3
                                    }}
                                  >
                                    <CheckCircle2 size={10} color="#16a34a" /> In Stock (Available)
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Selection Footer */}
                <div style={{ background: '#f0fdf4', padding: '8px 12px', borderTop: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 700 }}>
                    Selected for Mill: <strong>{selectedMillTps.length} TPs</strong>
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#15803d' }}>
                    Challan Total: {millSelectedTotalMtrs.toFixed(1)} Mtr
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
                <button
                  type="button"
                  onClick={() => setShowMillChallanModal(false)}
                  className="btn-secondary"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedMillTps.length === 0}
                  className="btn-primary"
                  style={{
                    padding: '0.45rem 1.25rem',
                    fontSize: '0.82rem',
                    background: selectedMillTps.length > 0 ? 'linear-gradient(135deg, #059669, #10b981)' : '#94a3b8',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Check size={16} /> Confirm & Generate Mill Challan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 🔍 MODAL 3: VIEW INDIVIDUAL TPS IN A GRAY LOT            */}
      {/* ======================================================== */}
      {selectedGrayLotForView && (
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
              maxWidth: 640,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: 14,
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                  TP Breakdown: {selectedGrayLotForView.lotNumber}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Weaver: {selectedGrayLotForView.weaverParty} | Quality: {selectedGrayLotForView.fabricQuality}
                </span>
              </div>
              <button
                onClick={() => setSelectedGrayLotForView(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Invoice & Purchase Metadata Badge */}
            {(selectedGrayLotForView.invoiceNo || selectedGrayLotForView.ratePerMeter > 0 || selectedGrayLotForView.purchaseNo) && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.76rem' }}>
                {selectedGrayLotForView.invoiceNo && (
                  <span><strong style={{ color: '#475569' }}>Invoice / Bill:</strong> <span style={{ fontWeight: 800, color: '#0284c7' }}>{selectedGrayLotForView.invoiceNo}</span></span>
                )}
                {selectedGrayLotForView.invoiceDate && (
                  <span><strong style={{ color: '#475569' }}>Date:</strong> {selectedGrayLotForView.invoiceDate}</span>
                )}
                {selectedGrayLotForView.hsnCode && (
                  <span><strong style={{ color: '#475569' }}>HSN:</strong> {selectedGrayLotForView.hsnCode}</span>
                )}
                {selectedGrayLotForView.ratePerMeter > 0 && (
                  <span><strong style={{ color: '#475569' }}>Rate:</strong> ₹{selectedGrayLotForView.ratePerMeter}/Mtr</span>
                )}
                {selectedGrayLotForView.gstRate !== undefined && (
                  <span><strong style={{ color: '#475569' }}>GST:</strong> {selectedGrayLotForView.gstRate}%</span>
                )}
                {selectedGrayLotForView.grandTotal ? (
                  <span style={{ fontWeight: 800, color: '#16a34a' }}>
                    <strong>Invoice Total:</strong> ₹{Number(selectedGrayLotForView.grandTotal).toLocaleString('en-IN')}
                  </span>
                ) : null}
                {selectedGrayLotForView.purchaseNo && (
                  <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 5, fontWeight: 800, border: '1px solid #bbf7d0' }}>
                    ✓ Purchase Reg: {selectedGrayLotForView.purchaseNo}
                  </span>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.6rem' }}>
              {(selectedGrayLotForView.tps || []).map((tp, idx) => {
                const isSent = tp.status === 'Sent to Mill';
                return (
                  <div
                    key={idx}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 8,
                      border: `1px solid ${isSent ? '#fde68a' : '#bbf7d0'}`,
                      background: isSent ? '#fefce8' : '#f0fdf4',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>
                        Sr #{tp.srNo}
                      </span>
                      <span
                        style={{
                          fontSize: '0.62rem',
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          background: isSent ? '#fef3c7' : '#dcfce7',
                          color: isSent ? '#b45309' : '#15803d'
                        }}
                      >
                        {tp.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                      TP: {tp.tpNo}
                    </div>

                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
                      {tp.tpMtr} Mtr
                    </div>

                    {isSent && tp.millChallanNo && (
                      <div style={{ fontSize: '0.65rem', color: '#b45309', fontWeight: 700 }}>
                        Challan: {tp.millChallanNo}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
              <button
                onClick={() => setSelectedGrayLotForView(null)}
                className="btn-primary"
                style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 🖨️ MODAL 4: PROFESSIONAL MILL DELIVERY CHALLAN (PRINT)   */}
      {/* ======================================================== */}
      {showPrintChallanModal && (
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
              maxWidth: 780,
              maxHeight: '94vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: 12,
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            {/* Top Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0f172a' }}>
                  Delivery Challan to Processing Mill
                </span>
                <span style={{ marginLeft: 8, fontSize: '0.72rem', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 4, fontWeight: 800, border: '1px solid #bbf7d0' }}>
                  2 Copies on A4 (Original + Duplicate)
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handlePrintChallanA4}
                  className="btn-primary"
                  style={{ padding: '0.4rem 0.95rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', background: '#0284c7' }}
                >
                  <Printer size={15} /> Print / Save PDF (2 Copies A4)
                </button>
                <button
                  onClick={() => setShowPrintChallanModal(null)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Embedded Print Styles for A4 Portrait 2-Copies */}
            <style>{`
              @page {
                size: A4 portrait;
                margin: 5mm 7mm;
              }
              @media print {
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  height: 100% !important;
                  background: #ffffff !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                body * {
                  visibility: hidden !important;
                }
                .no-print {
                  display: none !important;
                }
                #printable-mill-challan-a4, #printable-mill-challan-a4 * {
                  visibility: visible !important;
                }
                #printable-mill-challan-a4 {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #ffffff !important;
                }
                .single-page-print {
                  width: 100% !important;
                  height: 285mm !important;
                  max-height: 285mm !important;
                  display: flex !important;
                  flex-direction: column !important;
                  justify-content: space-between !important;
                  box-sizing: border-box !important;
                  overflow: hidden !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                .single-page-print .challan-copy-block {
                  height: 138mm !important;
                  max-height: 138mm !important;
                  box-sizing: border-box !important;
                  display: flex !important;
                  flex-direction: column !important;
                  justify-content: space-between !important;
                  overflow: hidden !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                .single-page-print .challan-cut-line {
                  height: 7mm !important;
                  display: flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                  margin: 0 !important;
                }
                .single-page-print .challan-table-wrapper {
                  flex: 1 1 auto !important;
                  display: flex !important;
                  flex-direction: column !important;
                  min-height: 0 !important;
                }
                .single-page-print .challan-table-wrapper table {
                  height: 100% !important;
                  flex: 1 !important;
                }
                .multi-page-print {
                  display: block !important;
                  width: 100% !important;
                }
                .multi-page-print .challan-copy-block {
                  display: flex !important;
                  flex-direction: column !important;
                  justify-content: space-between !important;
                  min-height: 280mm !important;
                  box-sizing: border-box !important;
                }
                .multi-page-print .challan-copy-block:first-of-type {
                  page-break-after: always !important;
                  break-after: page !important;
                  margin-bottom: 0 !important;
                }
                .multi-page-print .challan-copy-block:last-of-type {
                  page-break-before: always !important;
                  break-before: page !important;
                  margin-top: 0 !important;
                }
                .page-break-always {
                  page-break-before: always !important;
                  break-before: page !important;
                  margin-top: 0 !important;
                }
              }
            `}</style>

            {/* Helper to render each Challan copy */}
            {(() => {
              const tpsList = showPrintChallanModal.tps || [];
              const numCols = 4;
              const numRows = Math.ceil(tpsList.length / numCols);
              const isMultiPage = numRows > 13; // > 13 rows per copy means each copy needs full A4 page

              // Dynamic sizing for fit-to-paper without dead whitespace at the bottom
              let rowPaddingY = '1.5px';
              let tableFontSize = '0.60rem';
              let headerFontSize = '0.62rem';
              let tableSrFontSize = '0.58rem';
              let cellPaddingX = '2px';
              let metaGridMarginBottom = '4px';
              let metaGridPaddingBottom = '4px';
              let headerMarginBottom = '4px';
              let signatureLineHeight = '14px';

              if (!isMultiPage) {
                if (numRows <= 4) {
                  rowPaddingY = '6px';
                  tableFontSize = '0.68rem';
                  headerFontSize = '0.68rem';
                  tableSrFontSize = '0.64rem';
                  cellPaddingX = '3px';
                  metaGridMarginBottom = '6px';
                  metaGridPaddingBottom = '5px';
                  headerMarginBottom = '5px';
                  signatureLineHeight = '22px';
                } else if (numRows <= 7) {
                  rowPaddingY = '4.5px';
                  tableFontSize = '0.64rem';
                  headerFontSize = '0.64rem';
                  tableSrFontSize = '0.60rem';
                  cellPaddingX = '3px';
                  metaGridMarginBottom = '5px';
                  metaGridPaddingBottom = '4px';
                  headerMarginBottom = '4px';
                  signatureLineHeight = '18px';
                } else if (numRows <= 10) {
                  rowPaddingY = '3px';
                  tableFontSize = '0.62rem';
                  headerFontSize = '0.62rem';
                  tableSrFontSize = '0.58rem';
                  cellPaddingX = '2px';
                  metaGridMarginBottom = '4px';
                  metaGridPaddingBottom = '4px';
                  headerMarginBottom = '4px';
                  signatureLineHeight = '16px';
                } else {
                  rowPaddingY = '1.5px';
                  tableFontSize = '0.60rem';
                  headerFontSize = '0.60rem';
                  tableSrFontSize = '0.56rem';
                  cellPaddingX = '2px';
                  metaGridMarginBottom = '3px';
                  metaGridPaddingBottom = '3px';
                  headerMarginBottom = '3px';
                  signatureLineHeight = '13px';
                }
              }

              const renderCopy = (copyLabel, copyColor, extraProps = {}) => {
                const tableRows = Array.from({ length: numRows }, (_, rowIdx) => {
                  return Array.from({ length: numCols }, (_, colIdx) => {
                    const itemIdx = colIdx * numRows + rowIdx;
                    return tpsList[itemIdx] || null;
                  });
                });
                return (
                  <div
                    className={`challan-copy-block ${extraProps.className || ''}`}
                    style={{
                      border: '1.5px solid #0f172a',
                      padding: '6px 12px',
                      borderRadius: 4,
                      background: '#ffffff',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      color: '#0f172a',
                      boxSizing: 'border-box',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      ...(extraProps.style || {})
                    }}
                  >
                    <div>
                      {/* Company Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1.5px solid #0f172a', paddingBottom: '3px', marginBottom: headerMarginBottom }}>
                        <div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 900, letterSpacing: '0.03em', lineHeight: 1.1, color: '#0f172a' }}>
                            YAMUNAJI
                          </div>
                          <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#1e293b', marginTop: 1 }}>
                            TEXTILE GRAY & RFD PROCESSING DIVISION — SURAT, GUJARAT
                          </div>
                          <div style={{ fontSize: '0.6rem', color: '#475569', marginTop: 1 }}>
                            GSTIN: <strong>24AAGFY0182C1ZP</strong> | Ring Road Textile Market, Surat - 395002 | Phone: +91 98250 12345
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ display: 'inline-block', border: `1.5px solid ${copyColor}`, background: `${copyColor}15`, color: copyColor, padding: '2px 8px', fontSize: '0.64rem', fontWeight: 900, borderRadius: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            {copyLabel}
                          </span>
                          <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#0f172a', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            DELIVERY CHALLAN (PROCESSING MILL)
                          </div>
                        </div>
                      </div>

                      {/* Meta Info Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '0.75rem', borderBottom: '1px solid #0f172a', paddingBottom: metaGridPaddingBottom, marginBottom: metaGridMarginBottom, fontSize: '0.68rem' }}>
                        <div>
                          <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700 }}>TO (PROCESSING MILL):</div>
                          <div style={{ fontSize: '0.84rem', fontWeight: 900, color: '#0f172a', marginTop: 1 }}>{showPrintChallanModal.millParty}</div>
                          {showPrintChallanModal.millGst && (
                            <div style={{ fontSize: '0.66rem', fontWeight: 800, color: '#0369a1', marginTop: 1 }}>
                              GSTIN: {showPrintChallanModal.millGst}
                            </div>
                          )}
                          {(showPrintChallanModal.millAddress || showPrintChallanModal.millCity) && (
                            <div style={{ fontSize: '0.62rem', color: '#334155', marginTop: 1 }}>
                              {showPrintChallanModal.millAddress ? `${showPrintChallanModal.millAddress}, ` : ''}{showPrintChallanModal.millCity || ''}
                            </div>
                          )}
                          {showPrintChallanModal.millPhone && (
                            <div style={{ fontSize: '0.61rem', color: '#475569', marginTop: 1 }}>
                              Phone: {showPrintChallanModal.millPhone} {showPrintChallanModal.millContact ? `(${showPrintChallanModal.millContact})` : ''}
                            </div>
                          )}
                          <div style={{ marginTop: 2, fontSize: '0.66rem' }}><strong>Process Required:</strong> {showPrintChallanModal.processRequired}</div>
                        </div>

                        <div style={{ textAlign: 'right', fontSize: '0.68rem', lineHeight: 1.35 }}>
                          <div><strong>Challan No:</strong> <span style={{ fontSize: '0.82rem', fontWeight: 900, color: '#059669' }}>{showPrintChallanModal.challanNo}</span></div>
                          <div><strong>Date:</strong> {showPrintChallanModal.challanDate}</div>
                          <div><strong>Quality:</strong> {showPrintChallanModal.fabricQuality}</div>
                        </div>
                      </div>
                    </div>

                    {/* 4-Column TP Breakdown Table */}
                    <div className="challan-table-wrapper" style={{ flex: !isMultiPage ? '1 1 auto' : 'none', display: 'flex', flexDirection: 'column', minHeight: 0, marginBottom: '3px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', height: !isMultiPage ? '100%' : 'auto', fontSize: tableFontSize, border: '1.5px solid #0f172a' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #0f172a', textAlign: 'center', fontWeight: 800 }}>
                            {[0, 1, 2, 3].map((cIdx) => (
                              <React.Fragment key={cIdx}>
                                <th style={{ padding: `2px ${cellPaddingX}`, width: '4%', borderRight: '1px solid #cbd5e1', fontSize: headerFontSize }}>Sr</th>
                                <th style={{ padding: `2px ${cellPaddingX}`, width: '10%', borderRight: '1px solid #cbd5e1', fontSize: headerFontSize }}>TP No.</th>
                                <th style={{ padding: `2px ${cellPaddingX}`, width: '11%', borderRight: cIdx < 3 ? '1.5px solid #0f172a' : 'none', fontSize: headerFontSize }}>Mtr</th>
                              </React.Fragment>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tableRows.map((cols, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'center', background: rIdx % 2 === 1 ? '#fafafa' : '#ffffff' }}>
                              {cols.map((item, cIdx) => (
                                <React.Fragment key={cIdx}>
                                  <td style={{ padding: `${rowPaddingY} ${cellPaddingX}`, borderRight: '1px solid #cbd5e1', fontWeight: 700, color: item ? '#475569' : 'transparent', fontSize: tableSrFontSize }}>
                                    {item ? item.srNo : '-'}
                                  </td>
                                  <td style={{ padding: `${rowPaddingY} ${cellPaddingX}`, borderRight: '1px solid #cbd5e1', fontWeight: 800, color: item ? '#0f172a' : 'transparent', fontSize: tableFontSize }}>
                                    {item ? item.tpNo : '-'}
                                  </td>
                                  <td style={{ padding: `${rowPaddingY} ${cellPaddingX}`, fontWeight: 800, color: item ? '#0f172a' : 'transparent', borderRight: cIdx < 3 ? '1.5px solid #0f172a' : 'none', fontSize: tableFontSize }}>
                                    {item ? Number(item.tpMtr).toFixed(1) : '-'}
                                  </td>
                                </React.Fragment>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#f8fafc', borderTop: '1.5px solid #0f172a', fontWeight: 900 }}>
                            <td colSpan={6} style={{ padding: '3px 6px', borderRight: '1.5px solid #0f172a', textAlign: 'left', fontSize: '0.68rem' }}>
                              TOTAL TPs: {showPrintChallanModal.totalTps}
                            </td>
                            <td colSpan={6} style={{ padding: '3px 6px', textAlign: 'right', fontSize: '0.70rem' }}>
                              GRAND TOTAL METERS: {showPrintChallanModal.totalMeters.toFixed(1)} Mtr
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Notes if any */}
                    {showPrintChallanModal.notes && (
                      <div style={{ fontSize: '0.62rem', marginBottom: '4px', background: '#f8fafc', padding: '2px 6px', border: '1px solid #e2e8f0' }}>
                        <strong>Notes:</strong> {showPrintChallanModal.notes}
                      </div>
                    )}

                    {/* Signatures */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: 'auto', paddingTop: '4px', fontSize: '0.64rem' }}>
                      <div>
                        <div style={{ height: signatureLineHeight }}></div>
                        <div style={{ borderTop: '1px solid #0f172a', width: '135px', fontWeight: 700 }}>
                          Receiver's Signature (Mill)
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ height: signatureLineHeight }}></div>
                        <div style={{ borderTop: '1px solid #0f172a', width: '135px', marginLeft: 'auto', fontWeight: 700 }}>
                          For YAMUNAJI (Authorized)
                        </div>
                      </div>
                    </div>
                  </div>
                );
              };

              return (
                <div
                  id="printable-mill-challan-a4"
                  className={isMultiPage ? 'multi-page-print' : 'single-page-print'}
                  style={isMultiPage ? { display: 'block' } : { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '280mm', boxSizing: 'border-box' }}
                >
                  {renderCopy('ORIGINAL - MILL COPY', '#0284c7', {
                    style: isMultiPage ? { pageBreakAfter: 'always', breakAfter: 'page', marginBottom: '24px' } : {}
                  })}

                  {/* Cut Line for 1-Page (<= 50 TPs) or Page Break Banner for 2-Pages (> 50 TPs) */}
                  {!isMultiPage ? (
                    <div
                      className="challan-cut-line"
                      style={{
                        height: '7mm',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        margin: '0',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', borderTop: '1.5px dashed #475569' }} />
                      <span style={{ position: 'relative', background: '#ffffff', padding: '0 12px', fontSize: '0.62rem', color: '#475569', fontWeight: 800, letterSpacing: '0.06em' }}>
                        ✂ CUT HERE — 2 COPIES ON A4 (ORIGINAL ABOVE • DUPLICATE BELOW) ✂
                      </span>
                    </div>
                  ) : (
                    <div className="no-print" style={{ borderTop: '2px dashed #9333ea', margin: '14px 0', position: 'relative', textAlign: 'center' }}>
                      <span style={{ position: 'relative', top: '-9px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 4, padding: '3px 14px', fontSize: '0.64rem', color: '#7c3aed', fontWeight: 900, letterSpacing: '0.05em' }}>
                        📄 PAGE BREAK — DUPLICATE COPY PRINTS COMPLETELY ON PAGE 2 OF PDF
                      </span>
                    </div>
                  )}

                  {renderCopy('DUPLICATE - SENDER / OFFICE COPY', '#7c3aed', {
                    className: isMultiPage ? 'page-break-always' : '',
                    style: isMultiPage ? { pageBreakBefore: 'always', breakBefore: 'page' } : {}
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ✏️ MODAL: EDIT MILL OUTWARD CHALLAN                       */}
      {/* ======================================================== */}
      {editingMillChallan && editChallanForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '620px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: 12,
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>
                  Edit Mill Outward Challan
                </span>
                <span style={{ marginLeft: 8, fontSize: '0.74rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 4, fontWeight: 800 }}>
                  {editingMillChallan.challanNo}
                </span>
              </div>
              <button
                onClick={() => { setEditingMillChallan(null); setEditChallanForm(null); }}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditMillChallan} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Challan Number
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editChallanForm.challanNo}
                    onChange={e => setEditChallanForm({ ...editChallanForm, challanNo: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Challan Date
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={editChallanForm.challanDate}
                    onChange={e => setEditChallanForm({ ...editChallanForm, challanDate: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Processing Mill
                  </label>
                  <select
                    className="input-field"
                    value={editChallanForm.millParty}
                    onChange={e => setEditChallanForm({ ...editChallanForm, millParty: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  >
                    {configs.mills.map((m, idx) => (
                      <option key={idx} value={getPartyName(m)}>
                        {getPartyName(m)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Fabric Quality
                  </label>
                  <select
                    className="input-field"
                    value={editChallanForm.fabricQuality}
                    onChange={e => setEditChallanForm({ ...editChallanForm, fabricQuality: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  >
                    {configs.qualities.map((q, idx) => (
                      <option key={idx} value={q}>{q}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Process Required
                  </label>
                  <select
                    className="input-field"
                    value={editChallanForm.processRequired}
                    onChange={e => setEditChallanForm({ ...editChallanForm, processRequired: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  >
                    {configs.processes.map((p, idx) => (
                      <option key={idx} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Status
                  </label>
                  <select
                    className="input-field"
                    value={editChallanForm.status}
                    onChange={e => setEditChallanForm({ ...editChallanForm, status: e.target.value })}
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  >
                    <option value="In Processing at Mill">In Processing at Mill</option>
                    <option value="Ready for Pickup">Ready for Pickup</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Vehicle / Transport No.
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editChallanForm.vehicleNo}
                    onChange={e => setEditChallanForm({ ...editChallanForm, vehicleNo: e.target.value })}
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Driver / Contact Name
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editChallanForm.driverName}
                    onChange={e => setEditChallanForm({ ...editChallanForm, driverName: e.target.value })}
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                  Notes / Instructions
                </label>
                <textarea
                  className="input-field"
                  value={editChallanForm.notes}
                  onChange={e => setEditChallanForm({ ...editChallanForm, notes: e.target.value })}
                  rows={2}
                  style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </div>

              <div style={{ background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                <span><strong>Total TPs:</strong> {editingMillChallan.totalTps} TPs</span>
                <span><strong>Total Meters:</strong> {editingMillChallan.totalMeters.toFixed(1)} Mtr</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => { setEditingMillChallan(null); setEditChallanForm(null); }}
                  className="btn-secondary"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '0.45rem 1.25rem', fontSize: '0.82rem', background: '#0284c7' }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ✏️ MODAL: EDIT GRAY FABRIC LOT                           */}
      {/* ======================================================== */}
      {editingGrayLot && editGrayLotForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: 12,
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>
                  Edit Gray Fabric Inward Lot
                </span>
                <span style={{ marginLeft: 8, fontSize: '0.74rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 4, fontWeight: 800 }}>
                  {editingGrayLot.lotNumber}
                </span>
              </div>
              <button
                onClick={() => { setEditingGrayLot(null); setEditGrayLotForm(null); }}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditGrayLot} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Lot Number
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editGrayLotForm.lotNumber}
                    onChange={e => setEditGrayLotForm({ ...editGrayLotForm, lotNumber: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Inward Date
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={editGrayLotForm.inwardDate}
                    onChange={e => setEditGrayLotForm({ ...editGrayLotForm, inwardDate: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Weaver / Loom Owner
                  </label>
                  <select
                    className="input-field"
                    value={editGrayLotForm.weaverParty}
                    onChange={e => setEditGrayLotForm({ ...editGrayLotForm, weaverParty: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  >
                    {configs.weavers.map((w, idx) => (
                      <option key={idx} value={getPartyName(w)}>{getPartyName(w)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Weaver Challan #
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editGrayLotForm.weaverChallanNo}
                    onChange={e => setEditGrayLotForm({ ...editGrayLotForm, weaverChallanNo: e.target.value })}
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Fabric Quality
                  </label>
                  <select
                    className="input-field"
                    value={editGrayLotForm.fabricQuality}
                    onChange={e => setEditGrayLotForm({ ...editGrayLotForm, fabricQuality: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  >
                    {configs.qualities.map((q, idx) => (
                      <option key={idx} value={q}>{q}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Rate per Meter (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    value={editGrayLotForm.ratePerMeter}
                    onChange={e => setEditGrayLotForm({ ...editGrayLotForm, ratePerMeter: e.target.value })}
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  />
                </div>
              </div>

              {/* Invoice & Purchase Details for Edit */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0369a1' }}>
                  🧾 Invoice & Purchase Registration Details
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: 2 }}>
                      Invoice / Bill No
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={editGrayLotForm.invoiceNo}
                      onChange={e => setEditGrayLotForm({ ...editGrayLotForm, invoiceNo: e.target.value })}
                      style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.78rem', border: '1px solid #cbd5e1', borderRadius: 5 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: 2 }}>
                      Invoice Date
                    </label>
                    <input
                      type="date"
                      className="input-field"
                      value={editGrayLotForm.invoiceDate}
                      onChange={e => setEditGrayLotForm({ ...editGrayLotForm, invoiceDate: e.target.value })}
                      style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.78rem', border: '1px solid #cbd5e1', borderRadius: 5 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: 2 }}>
                      HSN Code
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={editGrayLotForm.hsnCode}
                      onChange={e => setEditGrayLotForm({ ...editGrayLotForm, hsnCode: e.target.value })}
                      style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.78rem', border: '1px solid #cbd5e1', borderRadius: 5 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: 2 }}>
                      GST Rate %
                    </label>
                    <select
                      className="input-field"
                      value={editGrayLotForm.gstRate}
                      onChange={e => setEditGrayLotForm({ ...editGrayLotForm, gstRate: e.target.value })}
                      style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.78rem', border: '1px solid #cbd5e1', borderRadius: 5 }}
                    >
                      <option value="5">5% (Standard Fabric)</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="0">0%</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: 2 }}>
                      Payment Terms
                    </label>
                    <select
                      className="input-field"
                      value={editGrayLotForm.paymentTerms}
                      onChange={e => setEditGrayLotForm({ ...editGrayLotForm, paymentTerms: e.target.value })}
                      style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.78rem', border: '1px solid #cbd5e1', borderRadius: 5 }}
                    >
                      <option value="30 Days">30 Days Credit</option>
                      <option value="15 Days">15 Days Credit</option>
                      <option value="45 Days">45 Days Credit</option>
                      <option value="60 Days">60 Days Credit</option>
                      <option value="Immediate Cash">Immediate / Cash</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                  Notes / Remarks
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={editGrayLotForm.notes}
                  onChange={e => setEditGrayLotForm({ ...editGrayLotForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </div>

              {/* TP Breakdown in Edit Gray Lot */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                  TP Breakdown ({(editGrayLotForm.tps || []).length} TPs)
                </label>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.7rem', textAlign: 'left' }}>
                        <th style={{ padding: '5px 8px', width: 45 }}>Sr</th>
                        <th style={{ padding: '5px 8px' }}>TP No.</th>
                        <th style={{ padding: '5px 8px' }}>TP Meter (Mtr)</th>
                        <th style={{ padding: '5px 8px', width: 100 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(editGrayLotForm.tps || []).map((tp, idx) => {
                        const isSent = tp.status === 'Sent to Mill';
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 8px', color: '#64748b', fontWeight: 700 }}>{tp.srNo || idx + 1}</td>
                            <td style={{ padding: '4px 8px' }}>
                              <input
                                type="text"
                                value={tp.tpNo}
                                disabled={isSent}
                                onChange={e => {
                                  const val = e.target.value;
                                  setEditGrayLotForm(prev => {
                                    const nextTps = [...(prev.tps || [])];
                                    nextTps[idx] = { ...nextTps[idx], tpNo: val };
                                    return { ...prev, tps: nextTps };
                                  });
                                }}
                                className="input-field"
                                style={{ height: '26px', fontSize: '0.78rem', padding: '2px 6px', width: '100%' }}
                              />
                            </td>
                            <td style={{ padding: '4px 8px' }}>
                              <input
                                type="number"
                                step="0.1"
                                value={tp.tpMtr}
                                disabled={isSent}
                                onChange={e => {
                                  const val = e.target.value;
                                  setEditGrayLotForm(prev => {
                                    const nextTps = [...(prev.tps || [])];
                                    nextTps[idx] = { ...nextTps[idx], tpMtr: val };
                                    return { ...prev, tps: nextTps };
                                  });
                                }}
                                className="input-field"
                                style={{ height: '26px', fontSize: '0.78rem', padding: '2px 6px', width: '100%', fontWeight: 700 }}
                              />
                            </td>
                            <td style={{ padding: '4px 8px' }}>
                              <span style={{
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: isSent ? '#fef3c7' : '#dcfce7',
                                color: isSent ? '#b45309' : '#15803d'
                              }}>
                                {tp.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                <span><strong>Total TPs:</strong> {(editGrayLotForm.tps || []).length} TPs</span>
                <span>
                  <strong>Total Meters:</strong>{' '}
                  {(editGrayLotForm.tps || []).reduce((sum, t) => sum + (parseFloat(t.tpMtr) || 0), 0).toFixed(1)} Mtr
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => { setEditingGrayLot(null); setEditGrayLotForm(null); }}
                  className="btn-secondary"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '0.45rem 1.25rem', fontSize: '0.82rem', background: '#0284c7' }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 🧾 MODAL: ATTACH WEAVER INVOICE TO PENDING GRAY LOT       */}
      {/* ======================================================== */}
      {attachingInvoiceLot && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '640px',
              maxHeight: '92vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: 14,
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={20} color="#b45309" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 900, color: '#0f172a' }}>
                      Attach Weaver Invoice
                    </h3>
                    <span style={{ fontSize: '0.72rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 4, fontWeight: 800 }}>
                      Lot {attachingInvoiceLot.lotNumber}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    Enter commercial bill details received from the weaver and automatically post to Purchase Register.
                  </span>
                </div>
              </div>
              <button
                onClick={() => setAttachingInvoiceLot(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Lot Summary Badge */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: '0.76rem' }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Weaver / Loom Owner:</span>
                <strong style={{ color: '#0f172a' }}>{attachingInvoiceLot.weaverParty}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Delivery Challan:</span>
                <strong style={{ color: '#0f172a' }}>{attachingInvoiceLot.weaverChallanNo || 'N/A'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Quality & Quantity:</span>
                <strong style={{ color: '#0284c7' }}>{attachingInvoiceLot.fabricQuality} — {attachingInvoiceLot.totalMeters.toFixed(1)} Mtr</strong> ({attachingInvoiceLot.tps?.length || 0} TPs)
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveAttachInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', marginBottom: 3 }}>
                    Invoice / Bill No *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. INV-2026/89"
                    value={attachInvoiceForm.invoiceNo}
                    onChange={e => setAttachInvoiceForm(prev => ({ ...prev, invoiceNo: e.target.value }))}
                    className="input-field"
                    style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#0f172a', marginBottom: 3 }}>
                    Invoice Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={attachInvoiceForm.invoiceDate}
                    onChange={e => setAttachInvoiceForm(prev => ({ ...prev, invoiceDate: e.target.value }))}
                    className="input-field"
                    style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                    HSN Code
                  </label>
                  <input
                    type="text"
                    list="attach-hsn-datalist"
                    placeholder="5208"
                    value={attachInvoiceForm.hsnCode}
                    onChange={e => setAttachInvoiceForm(prev => ({ ...prev, hsnCode: e.target.value }))}
                    className="input-field"
                    style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
                  />
                  <datalist id="attach-hsn-datalist">
                    <option value="5208" label="Woven cotton gray fabric" />
                    <option value="5407" label="Woven synthetic fabric" />
                    <option value="998821" label="Textile jobwork" />
                  </datalist>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#0284c7', marginBottom: 3 }}>
                    Rate / Meter (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 42.50"
                    value={attachInvoiceForm.ratePerMeter}
                    onChange={e => setAttachInvoiceForm(prev => ({ ...prev, ratePerMeter: e.target.value }))}
                    className="input-field"
                    style={{ height: '34px', fontSize: '0.85rem', fontWeight: 800, width: '100%', borderColor: '#0284c7' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                    GST Rate %
                  </label>
                  <select
                    value={attachInvoiceForm.gstRate}
                    onChange={e => setAttachInvoiceForm(prev => ({ ...prev, gstRate: e.target.value }))}
                    className="input-field"
                    style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
                  >
                    <option value="5">5% (Standard Textile Fabric)</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="0">0% (Nil / Exempt)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                  Payment Terms
                </label>
                <select
                  value={attachInvoiceForm.paymentTerms}
                  onChange={e => setAttachInvoiceForm(prev => ({ ...prev, paymentTerms: e.target.value }))}
                  className="input-field"
                  style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
                >
                  <option value="30 Days">30 Days Credit</option>
                  <option value="15 Days">15 Days Credit</option>
                  <option value="45 Days">45 Days Credit</option>
                  <option value="60 Days">60 Days Credit</option>
                  <option value="Immediate Cash">Immediate / Cash</option>
                </select>
              </div>

              {/* Live Financial Calculations Ribbon */}
              {(() => {
                const roundMtrs = parseFloat(attachingInvoiceLot.totalMeters.toFixed(2));
                const rate = parseFloat(attachInvoiceForm.ratePerMeter) || 0;
                const gstPct = parseFloat(attachInvoiceForm.gstRate) || 0;
                const taxable = parseFloat((roundMtrs * rate).toFixed(2));
                const gstAmt = parseFloat(((taxable * gstPct) / 100).toFixed(2));
                const grand = Math.round(taxable + gstAmt);

                return (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.76rem' }}>
                      <span style={{ color: '#166534' }}>
                        Qty: <strong>{roundMtrs} Mtr</strong>
                      </span>
                      <span style={{ color: '#166534' }}>
                        Taxable: <strong>₹{taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </span>
                      <span style={{ color: '#166534' }}>
                        GST ({gstPct}%): <strong>₹{gstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </span>
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#15803d' }}>
                      Invoice Total: <span style={{ fontSize: '1.1rem', color: '#166534' }}>₹{grand.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Purchase Register Checkbox */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 800, color: attachInvoiceForm.postToPurchase ? '#0369a1' : '#64748b', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={attachInvoiceForm.postToPurchase}
                    onChange={e => setAttachInvoiceForm(prev => ({ ...prev, postToPurchase: e.target.checked }))}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#0284c7' }}
                  />
                  Auto-Post to Purchase Register ({companyEntity})
                </label>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2, marginLeft: 24 }}>
                  Creates an inventory purchase voucher linked with Lot #{attachingInvoiceLot.lotNumber} and Weaver party.
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
                <button
                  type="button"
                  onClick={() => setAttachingInvoiceLot(null)}
                  className="btn-secondary"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    padding: '0.45rem 1.25rem',
                    fontSize: '0.82rem',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Check size={16} /> Save & Attach Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 📥 MODAL: INWARD RFD FABRIC (TOTAL METERS & SHORTAGE)    */}
      {/* ======================================================== */}
      {showInwardRfdModal && (() => {
        const modalGraySent = parseFloat(inwardRfdForm.graySentMeters) || 0;
        const modalReceivedRfd = parseFloat(inwardRfdForm.receivedRfdMeters) || 0;
        const inputShortagePct = parseFloat(inwardRfdForm.shortagePercent);
        const inputShortageMtr = parseFloat(inwardRfdForm.shortageMeters);

        let modalShortagePct = 0;
        let modalShortageMtr = 0;

        if (!isNaN(inputShortagePct)) {
          modalShortagePct = inputShortagePct;
          modalShortageMtr = modalGraySent > 0 ? parseFloat(((modalGraySent * inputShortagePct) / 100).toFixed(1)) : 0;
        } else if (!isNaN(inputShortageMtr)) {
          modalShortageMtr = inputShortageMtr;
          modalShortagePct = modalGraySent > 0 ? parseFloat(((inputShortageMtr / modalGraySent) * 100).toFixed(2)) : 0;
        } else if (modalReceivedRfd > 0 && modalGraySent > modalReceivedRfd && inwardRfdForm.isChallanClosed) {
          modalShortageMtr = parseFloat((modalGraySent - modalReceivedRfd).toFixed(1));
          modalShortagePct = parseFloat(((modalShortageMtr / modalGraySent) * 100).toFixed(2));
        }

        const calculatedStillAtMill = Math.max(0, parseFloat((modalGraySent - (modalReceivedRfd + modalShortageMtr)).toFixed(1)));
        const modalStillAtMill = inwardRfdForm.isChallanClosed ? 0 : calculatedStillAtMill;
        const isHighShortage = modalShortagePct > 4.0;

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem'
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '820px',
                maxHeight: '92vh',
                overflowY: 'auto',
                background: '#ffffff',
                borderRadius: 14,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Layers size={20} color="#0284c7" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                      Inward Processed RFD Fabric (Total Mtr & Mill Shortage)
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Reconcile total received meters and shortage to accurately track fabric still remaining at the mill.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInwardRfdModal(false)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmitInwardRfd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Source Mill Challan Selection */}
                <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#0369a1', marginBottom: 4 }}>
                    🔗 Link to Dispatched Mill Outward Challan (Optional)
                  </label>
                  <select
                    className="input-field"
                    value={inwardRfdForm.sourceChallanId}
                    onChange={e => handleSelectSourceChallan(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6, background: '#ffffff' }}
                  >
                    <option value="">-- Manual / Direct RFD Inward (No Outward Challan) --</option>
                    {millChallans.map(ch => {
                      const sentMtr = parseFloat(ch.totalMeters) || 0;
                      const prevLots = rfdLots.filter(l => l.sourceChallanId === ch.id || (ch.challanNo && l.millChallanNo === ch.challanNo));
                      const prevRec = prevLots.reduce((sum, l) => sum + (parseFloat(l.receivedRfdMeters) || 0), 0);
                      const prevShort = prevLots.reduce((sum, l) => sum + (parseFloat(l.shrinkageLossMeters) || 0), 0);
                      const atMill = ch.isClosed || ch.status === 'Fully Received' ? 0 : Math.max(0, (sentMtr - (prevRec + prevShort)).toFixed(1));
                      return (
                        <option key={ch.id} value={ch.id}>
                          Challan #{ch.challanNo} — {ch.millParty} ({ch.fabricQuality || 'Gray'}) — Sent: {sentMtr} Mtr | Still at Mill: {atMill} Mtr [{ch.status}]
                        </option>
                      );
                    })}
                  </select>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 3, display: 'block' }}>
                    Selecting a Mill Challan automatically populates Mill name, quality, and remaining gray meters for instant reconciliation.
                  </span>
                </div>

                {/* Basic Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                      RFD Lot Number *
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={inwardRfdForm.lotNumber}
                      onChange={e => setInwardRfdForm({ ...inwardRfdForm, lotNumber: e.target.value })}
                      required
                      placeholder="e.g. YJ-RFD-001"
                      style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                      Inward Date *
                    </label>
                    <input
                      type="date"
                      className="input-field"
                      value={inwardRfdForm.inwardDate}
                      onChange={e => setInwardRfdForm({ ...inwardRfdForm, inwardDate: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                      Processing Mill Name *
                    </label>
                    <select
                      className="input-field"
                      value={inwardRfdForm.millParty}
                      onChange={e => setInwardRfdForm({ ...inwardRfdForm, millParty: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                    >
                      <option value="">-- Select Processing Mill * --</option>
                      {configs.mills.map((m, idx) => (
                        <option key={idx} value={getPartyName(m)}>{getPartyName(m)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                      Fabric Quality *
                    </label>
                    <select
                      className="input-field"
                      value={inwardRfdForm.fabricQuality}
                      onChange={e => setInwardRfdForm({ ...inwardRfdForm, fabricQuality: e.target.value })}
                      required
                      style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                    >
                      <option value="">-- Select Fabric Quality * --</option>
                      {configs.qualities.map((q, idx) => (
                        <option key={idx} value={q}>{q}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Delivery Challan # & Rolls Count */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                      Mill Delivery Challan / LR #
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={inwardRfdForm.millChallanNo}
                      onChange={e => setInwardRfdForm({ ...inwardRfdForm, millChallanNo: e.target.value })}
                      placeholder="e.g. SR-CH-5541"
                      style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                      Received Rolls / Bundles Count
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="input-field"
                      value={inwardRfdForm.receivedRollsCount}
                      onChange={e => setInwardRfdForm({ ...inwardRfdForm, receivedRollsCount: e.target.value })}
                      placeholder="e.g. 50 Rolls"
                      style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                    />
                  </div>
                </div>

                {/* Total Meters & Shortage Reconciliation Section */}
                <div style={{ border: '2px solid #bae6fd', borderRadius: 10, padding: '1rem', background: '#f0f9ff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <TrendingUp size={16} /> Total Meters & Shortage Reconciliation
                    </h4>
                    <span style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 700 }}>
                      No need to enter individual TPs — enter total meters
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                        Gray Sent to Mill (Mtr) *
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        className="input-field"
                        value={inwardRfdForm.graySentMeters}
                        onChange={e => {
                          const val = e.target.value;
                          const gSent = parseFloat(val) || 0;
                          const rec = parseFloat(inwardRfdForm.receivedRfdMeters) || 0;
                          let sMtr = parseFloat(inwardRfdForm.shortageMeters);
                          const sPct = parseFloat(inwardRfdForm.shortagePercent);
                          if (isNaN(sMtr) && !isNaN(sPct) && gSent > 0) {
                            sMtr = parseFloat(((gSent * sPct) / 100).toFixed(1));
                          } else if (isNaN(sMtr)) {
                            sMtr = 0;
                          }
                          const rem = Math.max(0, parseFloat((gSent - (rec + sMtr)).toFixed(1)));
                          let newClosed = inwardRfdForm.isChallanClosed;
                          if (!inwardRfdForm.isChallanClosedUserOverridden && gSent > 0 && rec > 0) {
                            newClosed = rem <= 0.5;
                          }
                          setInwardRfdForm(prev => ({
                            ...prev,
                            graySentMeters: val,
                            isChallanClosed: newClosed
                          }));
                        }}
                        required
                        placeholder="e.g. 5000.0"
                        style={{ width: '100%', padding: '0.5rem 0.7rem', fontSize: '0.9rem', fontWeight: 700, border: '1px solid #cbd5e1', borderRadius: 6, background: '#ffffff' }}
                      />
                      <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2, display: 'block' }}>
                        Gray fabric sent or remaining for this delivery
                      </span>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#0284c7', marginBottom: 4 }}>
                        Total Received RFD Fabric (Mtr) *
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        className="input-field"
                        value={inwardRfdForm.receivedRfdMeters}
                        onChange={e => {
                          const val = e.target.value;
                          const recVal = parseFloat(val);
                          const gSent = parseFloat(inwardRfdForm.graySentMeters) || 0;

                          let newShortagePct = inwardRfdForm.shortagePercent;
                          let newShortageMtr = inwardRfdForm.shortageMeters;
                          let sMtrNum = parseFloat(newShortageMtr);
                          const sPctNum = parseFloat(newShortagePct);
                          if (isNaN(sMtrNum) && !isNaN(sPctNum) && gSent > 0) {
                            sMtrNum = parseFloat(((gSent * sPctNum) / 100).toFixed(1));
                            newShortageMtr = String(sMtrNum);
                          } else if (isNaN(sMtrNum)) {
                            sMtrNum = 0;
                          }

                          const rem = Math.max(0, parseFloat((gSent - ((isNaN(recVal) ? 0 : recVal) + sMtrNum)).toFixed(1)));
                          let newClosed = inwardRfdForm.isChallanClosed;
                          if (!inwardRfdForm.isChallanClosedUserOverridden && gSent > 0 && !isNaN(recVal) && recVal > 0) {
                            newClosed = rem <= 0.5;
                          }
                          setInwardRfdForm(prev => ({
                            ...prev,
                            receivedRfdMeters: val,
                            shortageMeters: newShortageMtr,
                            shortagePercent: newShortagePct,
                            isChallanClosed: newClosed
                          }));
                        }}
                        required
                        placeholder="e.g. 87.0"
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.7rem',
                          fontSize: '0.95rem',
                          fontWeight: 900,
                          border: '2px solid #0284c7',
                          borderRadius: 6,
                          background: '#ffffff',
                          color: '#0f172a'
                        }}
                      />
                      <span style={{ fontSize: '0.7rem', color: '#0369a1', marginTop: 2, display: 'block' }}>
                        Actual meters received back in warehouse
                      </span>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a' }}>
                          Mill Shortage / Loss (%)
                        </label>
                        {modalGraySent > 0 && modalReceivedRfd > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const diff = Math.max(0, modalGraySent - modalReceivedRfd);
                              const pct = modalGraySent > 0 ? parseFloat(((diff / modalGraySent) * 100).toFixed(2)) : 0;
                              setInwardRfdForm(p => ({
                                ...p,
                                shortagePercent: String(pct),
                                shortageMeters: String(diff.toFixed(1))
                              }));
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#0284c7',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              padding: 0,
                              textDecoration: 'underline'
                            }}
                          >
                            ⚡ Auto from Received Mtr
                          </button>
                        )}
                      </div>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="number"
                          step="0.01"
                          className="input-field"
                          value={inwardRfdForm.shortagePercent}
                          onChange={e => {
                            const pctVal = e.target.value;
                            const pct = parseFloat(pctVal);
                            const gSent = parseFloat(inwardRfdForm.graySentMeters) || 0;
                            const recVal = parseFloat(inwardRfdForm.receivedRfdMeters) || 0;
                            let newLossMtr = '';
                            let sMtrNum = 0;
                            if (!isNaN(pct) && gSent > 0) {
                              sMtrNum = parseFloat(((gSent * pct) / 100).toFixed(1));
                              newLossMtr = String(sMtrNum);
                            }
                            const rem = Math.max(0, parseFloat((gSent - (recVal + sMtrNum)).toFixed(1)));
                            let newClosed = inwardRfdForm.isChallanClosed;
                            if (!inwardRfdForm.isChallanClosedUserOverridden && gSent > 0 && recVal > 0) {
                              newClosed = rem <= 0.5;
                            }
                            setInwardRfdForm(prev => ({
                              ...prev,
                              shortagePercent: pctVal,
                              shortageMeters: newLossMtr,
                              isChallanClosed: newClosed
                            }));
                          }}
                          placeholder="e.g. 4.4"
                          style={{
                            width: '100%',
                            padding: '0.5rem 2rem 0.5rem 0.7rem',
                            fontSize: '0.95rem',
                            fontWeight: 800,
                            border: isHighShortage ? '2px solid #ef4444' : '2px solid #cbd5e1',
                            borderRadius: 6,
                            background: '#ffffff',
                            color: '#0f172a'
                          }}
                        />
                        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#64748b', fontSize: '0.9rem' }}>
                          %
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: isHighShortage ? '#dc2626' : '#d97706' }}>
                          Loss: {modalShortageMtr} Mtr ({modalShortagePct}%)
                        </span>
                        {isHighShortage && modalShortagePct > 0 && (
                          <span style={{ fontSize: '0.66rem', background: '#fee2e2', color: '#b91c1c', padding: '1px 5px', borderRadius: 4, fontWeight: 800 }}>
                            🚨 High Shortage
                          </span>
                        )}
                      </div>

                      {/* Quick-fill Mill Shortage Presets */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: 6 }}>
                        <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>Quick:</span>
                        {[2.5, 3.0, 3.5, 4.0].map(pct => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => {
                              const gSent = parseFloat(inwardRfdForm.graySentMeters) || 0;
                              const recVal = parseFloat(inwardRfdForm.receivedRfdMeters) || 0;
                              const loss = gSent > 0 ? parseFloat(((gSent * pct) / 100).toFixed(1)) : 0;
                              const rem = Math.max(0, parseFloat((gSent - (recVal + loss)).toFixed(1)));
                              let newClosed = inwardRfdForm.isChallanClosed;
                              if (!inwardRfdForm.isChallanClosedUserOverridden && gSent > 0 && recVal > 0) {
                                newClosed = rem <= 0.5;
                              }
                              setInwardRfdForm(prev => ({
                                ...prev,
                                shortagePercent: String(pct),
                                shortageMeters: String(loss),
                                isChallanClosed: newClosed
                              }));
                            }}
                            style={{
                              padding: '2px 7px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              borderRadius: 4,
                              border: inwardRfdForm.shortagePercent === String(pct) ? '1px solid #0284c7' : '1px solid #cbd5e1',
                              background: inwardRfdForm.shortagePercent === String(pct) ? '#e0f2fe' : '#ffffff',
                              color: inwardRfdForm.shortagePercent === String(pct) ? '#0369a1' : '#475569',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mill Challan Delivery Status — Interactive Selectable Cards */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '6px' }}>
                    <div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', display: 'block' }}>
                        Delivery Status & Mill Remaining Balance
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        Determines whether fabric lot is final or partial inward
                      </span>
                    </div>
                    <div>
                      {!inwardRfdForm.isChallanClosedUserOverridden ? (
                        <span style={{ fontSize: '0.68rem', color: '#0284c7', background: '#e0f2fe', padding: '3px 8px', borderRadius: 6, fontWeight: 800, border: '1px solid #bae6fd', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          ⚡ Auto-calculated from meters
                        </span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.68rem', color: '#64748b', background: '#f1f5f9', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>
                            Manual Override
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const autoClosed = calculatedStillAtMill <= 0.5;
                              setInwardRfdForm(prev => ({
                                ...prev,
                                isChallanClosed: autoClosed,
                                isChallanClosedUserOverridden: false
                              }));
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#0284c7',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              padding: 0,
                              textDecoration: 'underline'
                            }}
                          >
                            Reset to Auto
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Interactive Option Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                    {/* Complete Delivery Card */}
                    <div
                      onClick={() => setInwardRfdForm({ ...inwardRfdForm, isChallanClosed: true, isChallanClosedUserOverridden: true })}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        padding: '0.85rem 1rem',
                        borderRadius: 10,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        border: inwardRfdForm.isChallanClosed ? '2px solid #10b981' : '1.5px solid #e2e8f0',
                        background: inwardRfdForm.isChallanClosed ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(255,255,255,0.9))' : '#fafbfc',
                        boxShadow: inwardRfdForm.isChallanClosed ? '0 4px 12px rgba(16,185,129,0.12)' : 'none'
                      }}
                    >
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: inwardRfdForm.isChallanClosed ? '#10b981' : '#cbd5e1',
                        color: '#ffffff', fontSize: '0.75rem', fontWeight: 900, flexShrink: 0, marginTop: 2
                      }}>
                        ✓
                      </div>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: inwardRfdForm.isChallanClosed ? '#065f46' : '#334155' }}>
                          Complete Delivery
                        </div>
                        <div style={{ fontSize: '0.72rem', color: inwardRfdForm.isChallanClosed ? '#047857' : '#64748b', marginTop: 2 }}>
                          Challan Closed — 0 Mtr Left at Mill
                        </div>
                      </div>
                    </div>

                    {/* Partial Delivery Card */}
                    <div
                      onClick={() => setInwardRfdForm({ ...inwardRfdForm, isChallanClosed: false, isChallanClosedUserOverridden: true })}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        padding: '0.85rem 1rem',
                        borderRadius: 10,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        border: !inwardRfdForm.isChallanClosed ? '2px solid #f59e0b' : '1.5px solid #e2e8f0',
                        background: !inwardRfdForm.isChallanClosed ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(255,255,255,0.9))' : '#fafbfc',
                        boxShadow: !inwardRfdForm.isChallanClosed ? '0 4px 12px rgba(245,158,11,0.12)' : 'none'
                      }}
                    >
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: !inwardRfdForm.isChallanClosed ? '#f59e0b' : '#cbd5e1',
                        color: '#ffffff', fontSize: '0.75rem', fontWeight: 900, flexShrink: 0, marginTop: 2
                      }}>
                        ⏳
                      </div>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: !inwardRfdForm.isChallanClosed ? '#92400e' : '#334155' }}>
                          Partial Delivery
                        </div>
                        <div style={{ fontSize: '0.72rem', color: !inwardRfdForm.isChallanClosed ? '#b45309' : '#64748b', marginTop: 2, fontWeight: !inwardRfdForm.isChallanClosed ? 700 : 400 }}>
                          {calculatedStillAtMill > 0 ? `${calculatedStillAtMill} Mtr Fabric Remaining at Mill` : 'Fabric Still at Mill'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Reconciliation HUD Summary Box with Visual Life Cycle Progress Bar */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: 12,
                    padding: '1rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                  }}
                >
                  {/* Segmented Progress Bar */}
                  {modalGraySent > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                          Fabric Lot Lifecycle Progress
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a' }}>
                          {modalGraySent > 0 ? Math.min(100, (((modalReceivedRfd + modalShortageMtr) / modalGraySent) * 100)).toFixed(1) : 0}% Accounted
                        </span>
                      </div>
                      <div style={{ height: 10, borderRadius: 99, background: '#e2e8f0', display: 'flex', overflow: 'hidden' }}>
                        {/* Received RFD Bar */}
                        <div
                          style={{
                            width: `${modalGraySent > 0 ? Math.min(100, (modalReceivedRfd / modalGraySent) * 100) : 0}%`,
                            background: '#10b981',
                            transition: 'width 0.3s ease'
                          }}
                          title={`Received: ${modalReceivedRfd} Mtr`}
                        />
                        {/* Mill Shortage Bar */}
                        <div
                          style={{
                            width: `${modalGraySent > 0 ? Math.min(100, (modalShortageMtr / modalGraySent) * 100) : 0}%`,
                            background: isHighShortage ? '#ef4444' : '#f59e0b',
                            transition: 'width 0.3s ease'
                          }}
                          title={`Shortage: ${modalShortageMtr} Mtr`}
                        />
                        {/* Still at Mill Bar */}
                        <div
                          style={{
                            width: `${modalGraySent > 0 ? Math.min(100, (modalStillAtMill / modalGraySent) * 100) : 0}%`,
                            background: '#38bdf8',
                            transition: 'width 0.3s ease'
                          }}
                          title={`Still at Mill: ${modalStillAtMill} Mtr`}
                        />
                      </div>
                      {/* Progress Legend */}
                      <div style={{ display: 'flex', gap: '1rem', marginTop: 6, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: '#047857', fontWeight: 700 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                          Received ({modalGraySent > 0 ? ((modalReceivedRfd / modalGraySent) * 100).toFixed(1) : 0}%)
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: isHighShortage ? '#b91c1c' : '#b45309', fontWeight: 700 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: isHighShortage ? '#ef4444' : '#f59e0b' }} />
                          Loss ({modalShortagePct}%)
                        </div>
                        {modalStillAtMill > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: '#0284c7', fontWeight: 700 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8' }} />
                            At Mill ({modalGraySent > 0 ? ((modalStillAtMill / modalGraySent) * 100).toFixed(1) : 0}%)
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Metrics Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '0.75rem'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, display: 'block' }}>GRAY SENT</span>
                      <strong style={{ fontSize: '1.15rem', color: '#0f172a' }}>{modalGraySent} Mtr</strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.68rem', color: '#0284c7', fontWeight: 700, display: 'block' }}>RECEIVED RFD</span>
                      <strong style={{ fontSize: '1.15rem', color: '#0284c7' }}>{modalReceivedRfd} Mtr</strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.68rem', color: isHighShortage ? '#dc2626' : '#d97706', fontWeight: 700, display: 'block' }}>MILL SHORTAGE</span>
                      <strong style={{ fontSize: '1.15rem', color: isHighShortage ? '#dc2626' : '#d97706' }}>
                        {modalShortageMtr} Mtr ({modalShortagePct}%)
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.68rem', color: modalStillAtMill > 0 ? '#b45309' : '#15803d', fontWeight: 800, display: 'block' }}>
                        STILL AT MILL (PENDING)
                      </span>
                      <strong style={{ fontSize: '1.15rem', color: modalStillAtMill > 0 ? '#d97706' : '#16a34a' }}>
                        {modalStillAtMill > 0 ? `${modalStillAtMill} Mtr` : '0 Mtr (Clear)'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* 🧾 OPTIONAL MILL JOB WORK PROCESSING BILL */}
                <div style={{ border: '1px solid #cbd5e1', borderRadius: 10, background: '#f8fafc', padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={15} color="#0284c7" />
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>
                        Mill Job Work / Processing Bill (Optional)
                      </span>
                    </div>

                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 700, color: inwardRfdForm.postToPurchase ? '#0369a1' : '#64748b', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={inwardRfdForm.postToPurchase}
                        onChange={e => setInwardRfdForm({ ...inwardRfdForm, postToPurchase: e.target.checked })}
                        style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#0284c7' }}
                      />
                      Post Mill Bill to Purchases (Jobwork Expense)
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: 2 }}>
                        Mill Bill / Inv #
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. MB-908"
                        value={inwardRfdForm.invoiceNo}
                        onChange={e => setInwardRfdForm({ ...inwardRfdForm, invoiceNo: e.target.value })}
                        className="input-field"
                        style={{ height: '30px', fontSize: '0.8rem', width: '100%' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: 2 }}>
                        Bill Date
                      </label>
                      <input
                        type="date"
                        value={inwardRfdForm.invoiceDate}
                        onChange={e => setInwardRfdForm({ ...inwardRfdForm, invoiceDate: e.target.value })}
                        className="input-field"
                        style={{ height: '30px', fontSize: '0.8rem', width: '100%' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: 2 }}>
                        Job Rate / Mtr (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 8.50"
                        value={inwardRfdForm.processRatePerMeter}
                        onChange={e => setInwardRfdForm({ ...inwardRfdForm, processRatePerMeter: e.target.value })}
                        className="input-field"
                        style={{ height: '30px', fontSize: '0.8rem', width: '100%' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: 2 }}>
                        GST Rate %
                      </label>
                      <select
                        value={inwardRfdForm.gstRate}
                        onChange={e => setInwardRfdForm({ ...inwardRfdForm, gstRate: e.target.value })}
                        className="input-field"
                        style={{ height: '30px', fontSize: '0.8rem', width: '100%' }}
                      >
                        <option value="5">5% (Textile Jobwork)</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="0">0%</option>
                      </select>
                    </div>
                  </div>

                  {parseFloat(inwardRfdForm.processRatePerMeter) > 0 && modalReceivedRfd > 0 && (
                    <div style={{ marginTop: '0.5rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 10px', fontSize: '0.74rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>
                        Jobwork Subtotal: <strong>₹{(modalReceivedRfd * parseFloat(inwardRfdForm.processRatePerMeter)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                      </span>
                      <span style={{ fontWeight: 800, color: '#16a34a' }}>
                        Total + GST ({inwardRfdForm.gstRate}%): ₹{(Math.round((modalReceivedRfd * parseFloat(inwardRfdForm.processRatePerMeter)) * (1 + parseFloat(inwardRfdForm.gstRate) / 100))).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Notes / Remarks
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={inwardRfdForm.notes}
                    onChange={e => setInwardRfdForm({ ...inwardRfdForm, notes: e.target.value })}
                    placeholder="e.g. Scouring and heat set quality ok, delivered in tempo"
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  />
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowInwardRfdModal(false)}
                    className="btn-secondary"
                    style={{ padding: '0.45rem 1.25rem', fontSize: '0.82rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{
                      padding: '0.45rem 1.5rem',
                      fontSize: '0.82rem',
                      background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                      border: 'none',
                      boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
                    }}
                  >
                    Save & Inward RFD ({modalReceivedRfd > 0 ? `${modalReceivedRfd} Mtr` : 'Enter Meters'})
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ======================================================== */}
      {/* 👁️ MODAL: VIEW RFD LOT & MILL SHORTAGE DETAILS          */}
      {/* ======================================================== */}
      {viewingRfdTpsLot && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '720px',
              maxHeight: '92vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: 14,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
                    RFD Lot Reconciliation: {viewingRfdTpsLot.lotNumber}
                  </h3>
                  <span style={{ fontSize: '0.72rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 4, fontWeight: 800 }}>
                    {viewingRfdTpsLot.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                  Processing Mill: <strong>{viewingRfdTpsLot.millParty}</strong> | Fabric: <strong>{viewingRfdTpsLot.fabricQuality}</strong> | Date: <strong>{viewingRfdTpsLot.inwardDate}</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingRfdTpsLot(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* KPI Badges */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, display: 'block' }}>GRAY SENT</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#475569' }}>
                  {viewingRfdTpsLot.graySentMeters} Mtr
                </span>
              </div>

              <div style={{ background: '#f0f9ff', padding: '0.75rem', borderRadius: 8, border: '1px solid #bae6fd' }}>
                <span style={{ fontSize: '0.7rem', color: '#0369a1', fontWeight: 700, display: 'block' }}>RFD RECEIVED</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0284c7' }}>
                  {viewingRfdTpsLot.receivedRfdMeters} Mtr
                </span>
                <span style={{ fontSize: '0.7rem', color: '#0369a1', fontWeight: 600 }}>
                  {viewingRfdTpsLot.receivedRollsCount || 1} Rolls
                </span>
              </div>

              <div style={{ background: (viewingRfdTpsLot.shrinkagePercent || 0) > 4 ? '#fef2f2' : '#fffbeb', padding: '0.75rem', borderRadius: 8, border: (viewingRfdTpsLot.shrinkagePercent || 0) > 4 ? '1px solid #fecaca' : '1px solid #fde68a' }}>
                <span style={{ fontSize: '0.7rem', color: (viewingRfdTpsLot.shrinkagePercent || 0) > 4 ? '#b91c1c' : '#b45309', fontWeight: 700, display: 'block' }}>MILL SHORTAGE</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: (viewingRfdTpsLot.shrinkagePercent || 0) > 4 ? '#dc2626' : '#d97706' }}>
                  {viewingRfdTpsLot.shrinkageLossMeters || 0} Mtr ({viewingRfdTpsLot.shrinkagePercent || 0}%)
                </span>
              </div>

              <div style={{ background: (viewingRfdTpsLot.stillAtMillMeters || 0) > 0 ? '#fffbeb' : '#f0fdf4', padding: '0.75rem', borderRadius: 8, border: (viewingRfdTpsLot.stillAtMillMeters || 0) > 0 ? '1px solid #fde68a' : '1px solid #bbf7d0' }}>
                <span style={{ fontSize: '0.7rem', color: (viewingRfdTpsLot.stillAtMillMeters || 0) > 0 ? '#b45309' : '#16a34a', fontWeight: 700, display: 'block' }}>STILL AT MILL</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: (viewingRfdTpsLot.stillAtMillMeters || 0) > 0 ? '#d97706' : '#16a34a' }}>
                  {(viewingRfdTpsLot.stillAtMillMeters || 0) > 0 ? `${viewingRfdTpsLot.stillAtMillMeters} Mtr` : '0 Mtr (Clear)'}
                </span>
              </div>
            </div>

            {/* Reconciliation Audit Box */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.82rem' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Mill Delivery Challan: </span>
                  <strong>{viewingRfdTpsLot.millChallanNo || 'Direct Inward'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Available Stock Balance: </span>
                  <strong style={{ color: '#16a34a' }}>
                    {Math.max(0, (viewingRfdTpsLot.receivedRfdMeters || 0) - (viewingRfdTpsLot.issuedMeters || 0)).toFixed(1)} Mtr
                  </strong>
                </div>
                {viewingRfdTpsLot.notes && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: '#64748b' }}>Notes: </span>
                    <span>{viewingRfdTpsLot.notes}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setViewingRfdTpsLot(null)}
                className="btn-secondary"
                style={{ padding: '0.45rem 1.25rem', fontSize: '0.82rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ✏️ MODAL: EDIT RFD FABRIC LOT                           */}
      {/* ======================================================== */}
      {editingRfdLot && editRfdLotForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '780px',
              maxHeight: '92vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: 14,
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>
                  Edit RFD Fabric Lot
                </span>
                <span style={{ marginLeft: 8, fontSize: '0.74rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 4, fontWeight: 800 }}>
                  {editingRfdLot.lotNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={() => { setEditingRfdLot(null); setEditRfdLotForm(null); }}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditRfdLot} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Lot Number
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editRfdLotForm.lotNumber}
                    onChange={e => setEditRfdLotForm({ ...editRfdLotForm, lotNumber: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Inward Date
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={editRfdLotForm.inwardDate}
                    onChange={e => setEditRfdLotForm({ ...editRfdLotForm, inwardDate: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Processing Mill
                  </label>
                  <select
                    className="input-field"
                    value={editRfdLotForm.millParty}
                    onChange={e => setEditRfdLotForm({ ...editRfdLotForm, millParty: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  >
                    {configs.mills.map((m, idx) => (
                      <option key={idx} value={getPartyName(m)}>{getPartyName(m)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Mill Challan #
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editRfdLotForm.millChallanNo}
                    onChange={e => setEditRfdLotForm({ ...editRfdLotForm, millChallanNo: e.target.value })}
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Fabric Quality
                  </label>
                  <select
                    className="input-field"
                    value={editRfdLotForm.fabricQuality}
                    onChange={e => setEditRfdLotForm({ ...editRfdLotForm, fabricQuality: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  >
                    {configs.qualities.map((q, idx) => (
                      <option key={idx} value={q}>{q}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Status
                  </label>
                  <select
                    className="input-field"
                    value={editRfdLotForm.status}
                    onChange={e => setEditRfdLotForm({ ...editRfdLotForm, status: e.target.value })}
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  >
                    <option value="In Stock">In Stock</option>
                    <option value="Partially Issued">Partially Issued</option>
                    <option value="Fully Issued">Fully Issued</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', background: '#f8fafc', padding: '0.85rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Gray Sent to Mill (Mtr)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    className="input-field"
                    value={editRfdLotForm.graySentMeters}
                    onChange={e => setEditRfdLotForm({ ...editRfdLotForm, graySentMeters: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#0284c7', marginBottom: 3 }}>
                    Received RFD Meters *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    className="input-field"
                    value={editRfdLotForm.receivedRfdMeters}
                    onChange={e => setEditRfdLotForm({ ...editRfdLotForm, receivedRfdMeters: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.84rem', fontWeight: 800, border: '1px solid #0284c7', borderRadius: 6 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#d97706', marginBottom: 3 }}>
                    Mill Shortage Loss (%)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      step="0.01"
                      className="input-field"
                      value={editRfdLotForm.shortagePercent}
                      onChange={e => {
                        const pctVal = e.target.value;
                        const pct = parseFloat(pctVal);
                        const graySent = parseFloat(editRfdLotForm.graySentMeters) || 0;
                        const loss = (!isNaN(pct) && graySent > 0) ? parseFloat(((graySent * pct) / 100).toFixed(1)) : 0;
                        setEditRfdLotForm({
                          ...editRfdLotForm,
                          shortagePercent: pctVal,
                          shortageMeters: String(loss)
                        });
                      }}
                      style={{ width: '100%', padding: '0.45rem 1.6rem 0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                    />
                    <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>
                      %
                    </span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2, display: 'block' }}>
                    Loss: {parseFloat(editRfdLotForm.shortageMeters) || 0} Mtr
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#b45309', marginBottom: 3 }}>
                    Fabric Still at Mill (Mtr)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    className="input-field"
                    value={editRfdLotForm.stillAtMillMeters}
                    onChange={e => setEditRfdLotForm({ ...editRfdLotForm, stillAtMillMeters: e.target.value })}
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 6 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: 3 }}>
                    Received Rolls Count
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="input-field"
                    value={editRfdLotForm.receivedRollsCount}
                    onChange={e => setEditRfdLotForm({ ...editRfdLotForm, receivedRollsCount: e.target.value })}
                    style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => { setEditingRfdLot(null); setEditRfdLotForm(null); }}
                  className="btn-secondary"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '0.45rem 1.25rem', fontSize: '0.82rem', background: '#0284c7' }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
