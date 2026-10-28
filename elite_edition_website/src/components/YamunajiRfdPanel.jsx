import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  RotateCcw,
  MapPin,
  Phone,
  User,
  Briefcase,
  Lock
} from 'lucide-react';
import { triggerEliteAlert, triggerEliteConfirm } from '../services/dialogService';
import EnterpriseEmptyState from './common/EnterpriseEmptyState';

const STORAGE_GRAY_KEY = 'yamunaji_gray_lots_data';
const STORAGE_MILL_CHALLAN_KEY = 'yamunaji_mill_challans_data';
const STORAGE_RFD_KEY = 'yamunaji_rfd_lots_data';
const STORAGE_CONFIGS_KEY = 'yamunaji_master_configurations';
const STORAGE_CLEAN_SLATE_KEY = 'yamunaji_clean_slate_20261028_cleared';

// ==========================================
// DEFAULT MASTER CONFIGURATIONS (SURAT TEXTILES)
// ==========================================
export const DEFAULT_CONFIGS = {
  weavers: [
    {
      name: 'Maruti Weaving Works',
      gst: '24AABCM1234F1Z8',
      address: 'Plot No. 42-45, Phase-2, GIDC Pandesara',
      city: 'Surat, Gujarat - 394221',
      phone: '+91 98251 12345',
      contactPerson: 'Hareshbhai Patel',
      broker: 'Ramesh Dalal (Textile Agent)',
      notes: 'Specialist in 14kg Viscose & Modal Satin weaving'
    },
    {
      name: 'Harikrishna Textiles',
      gst: '24AAACH9876K1Z3',
      address: 'Shed No. 12, Bamroli Road, Khatodara GIDC',
      city: 'Surat, Gujarat - 395002',
      phone: '+91 98240 54321',
      contactPerson: 'Mukeshbhai Radadiya',
      broker: 'Kishorebhai (Direct)',
      notes: 'Premium 60s Cambric & Pure Linen specialist'
    },
    {
      name: 'Shivam Loom Industries',
      gst: '24AAKFS4412L1Z9',
      address: 'Survey 108/B, Anjana Farm, Ring Road',
      city: 'Surat, Gujarat - 395003',
      phone: '+91 98980 11223',
      contactPerson: 'Pravinbhai Savani',
      broker: 'Shyam Agency',
      notes: 'High-speed airjet looms, prompt delivery'
    },
    {
      name: 'Radha Krishna Weaving',
      gst: '24AAGFR7721M1Z4',
      address: 'Plot 78, Road No. 6, Sachin GIDC',
      city: 'Surat, Gujarat - 394230',
      phone: '+91 97234 88990',
      contactPerson: 'Ghanshyambhai Vaghasiya',
      broker: 'Direct Weaver',
      notes: 'Viscose Crepe & Georgette weaving'
    },
    {
      name: 'Shreeji Textiles',
      gst: '24AALPS3344P1Z2',
      address: 'Plot 15, Ved Road Industrial Area, Katargam',
      city: 'Surat, Gujarat - 395004',
      phone: '+91 98790 66778',
      contactPerson: 'Dineshbhai Patel',
      broker: 'Jalaram Brokerage',
      notes: 'Organza & Gold Weave specialist'
    },
    {
      name: 'Gopi Loom Mills',
      gst: '24AAJFG5566Q1Z6',
      address: 'Block 201, Palsana Industrial Park, NH-48',
      city: 'Surat, Gujarat - 394315',
      phone: '+91 98255 33445',
      contactPerson: 'Bharatbhai Dobariya',
      broker: 'Ramesh Dalal',
      notes: 'Heavy Cotton Twill & Dola Silk'
    },
    {
      name: 'Omkar Weavers',
      gst: '24AAUPO9988R1Z1',
      address: 'Plot 89, Pipodara GIDC, Surat',
      city: 'Surat, Gujarat - 394110',
      phone: '+91 99090 44556',
      contactPerson: 'Ashokbhai Sutariya',
      broker: 'Direct',
      notes: 'Chanderi Silk & Viscose Weaves'
    },
    {
      name: 'Pooja Textiles (Katargam)',
      gst: '24AABCP1122S1Z7',
      address: 'Near Gajera Circle, Laxmi Enclave, Katargam',
      city: 'Surat, Gujarat - 395004',
      phone: '+91 98253 77889',
      contactPerson: 'Sanjaybhai Gondaliya',
      broker: 'Bhavna Textiles Agency',
      notes: 'Prompt delivery, high-grade quality inspection'
    }
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
    'Dola Silk Heavy 80gm',
    'Tissue Silk Zari'
  ],
  mills: [
    {
      name: 'Shree Radhe Bleaching & Dyeing Processors',
      gst: '24AAACR1234A1Z5',
      address: 'Plot 112-116, Road No. 12, Sachin GIDC',
      city: 'Surat, Gujarat - 394230',
      phone: '+91 98250 11999',
      contactPerson: 'Maheshbhai (Mill Manager)',
      processTypes: 'RFD Bleaching, Scouring & Heat Setting',
      notes: 'Turnaround: 2-3 Days. Loss/Shrinkage avg 2.5-3%'
    },
    {
      name: 'Vrundavan Mills Pvt Ltd',
      gst: '24AABCV5678B1Z0',
      address: 'Block 402, GIDC Pandesara, Opp. Water Tank',
      city: 'Surat, Gujarat - 394221',
      phone: '+91 98241 88776',
      contactPerson: 'Kishorebhai Desai',
      processTypes: 'Mercerizing & RFD Bleaching, Bio Wash',
      notes: 'Specialist for 60s Cambric & Pure Modal'
    },
    {
      name: 'Ganesh Textile Processors',
      gst: '24AAACG9012C1Z8',
      address: 'Plot 55, Kadodara Road, Palsana GIDC',
      city: 'Surat, Gujarat - 394317',
      phone: '+91 99798 22334',
      contactPerson: 'Rajubhai Kothari',
      processTypes: 'Soft Finish & Wash RFD, Stenter Finishing',
      notes: 'Fast delivery for urgent job card requirements'
    },
    {
      name: 'Shree Ambika Processing Mill',
      gst: '24AAACA3456D1Z3',
      address: 'Survey 245, Bhestan-Jiaav Road, Surat',
      city: 'Surat, Gujarat - 395023',
      phone: '+91 98256 66554',
      contactPerson: 'Chandreshbhai Shah',
      processTypes: 'High Tensile Heat Setting, Scouring',
      notes: 'Zero shrinkage calibration on viscose rayon'
    },
    {
      name: 'Bhagwati Dyeing House',
      gst: '24AAACB7890E1Z1',
      address: 'Plot 18, Road No. 3, Hojiwala Industrial Estate',
      city: 'Surat, Gujarat - 394230',
      phone: '+91 98795 44332',
      contactPerson: 'Girishbhai Parmar',
      processTypes: 'Bio Wash & Zero Shrinkage Finish',
      notes: 'Continuous bleaching range (CBR)'
    },
    {
      name: 'Navkar Processing Mills',
      gst: '24AAACN2345F1Z6',
      address: 'Plot 72, Sachin-Magdalla Road, Surat',
      city: 'Surat, Gujarat - 394230',
      phone: '+91 98258 99001',
      contactPerson: 'Anandbhai Mehta',
      processTypes: 'Viscose Crepe & Chanderi RFD processing',
      notes: 'High consistency white whiteness index'
    }
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
    const defaultMatch = (DEFAULT_CONFIGS.weavers || []).concat(DEFAULT_CONFIGS.mills || []).find(
      d => typeof d === 'object' && d.name.toLowerCase() === item.toLowerCase()
    );
    if (defaultMatch) {
      return { ...defaultMatch };
    }
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
            weavers: Array.isArray(p.weavers) && p.weavers.length > 0 
              ? p.weavers.map(w => normalizeParty(w)) 
              : DEFAULT_CONFIGS.weavers,
            qualities: Array.isArray(p.qualities) && p.qualities.length > 0 ? p.qualities : DEFAULT_CONFIGS.qualities,
            mills: Array.isArray(p.mills) && p.mills.length > 0 
              ? p.mills.map(m => normalizeParty(m)) 
              : DEFAULT_CONFIGS.mills,
            processes: Array.isArray(p.processes) && p.processes.length > 0 ? p.processes : DEFAULT_CONFIGS.processes
          };
        }
      }
    } catch (e) {}
    return DEFAULT_CONFIGS;
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
    notes: ''
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
    tps: [
      { srNo: 1, tpNo: '', tpMtr: '' }
    ]
  });

  // Unified Multi-Filter States (Date, Quality, Weaver, Mill, Status, Search)
  const [datePreset, setDatePreset] = useState('all'); // 'all' | 'today' | 'this_week' | 'this_month' | 'custom'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedWeaver, setSelectedWeaver] = useState('all');
  const [selectedQuality, setSelectedQuality] = useState('all');
  const [selectedMill, setSelectedMill] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'in_warehouse' | 'at_mill' | 'closed'
  const [millQualityFilter, setMillQualityFilter] = useState('all');
  const [millSearchQuery, setMillSearchQuery] = useState('');

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

    grayLots.forEach(lot => {
      const availableTps = (lot.tps || []).filter(t => t.status === 'In Stock');
      const inStockMtr = availableTps.reduce((sum, t) => sum + (Number(t.tpMtr) || 0), 0);
      inStockMtrs += inStockMtr;
      inStockTps += availableTps.length;
      atMillMtrs += (lot.sentToMillMeters || 0);
      totalGrayValuation += inStockMtr * (lot.ratePerMeter || 0);
    });

    return {
      inStockMtrs,
      inStockTps,
      atMillMtrs,
      totalGrayValuation,
      totalLots: grayLots.length
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
      return { ...prev, [partyModalType]: list };
    });

    setShowPartyModal(false);
    triggerEliteAlert(
      `${partyModalType === 'weavers' ? 'Weaver' : 'Processing Mill'} "${cleanParty.name}" details saved!`,
      'Party Saved'
    );
  };

  const handleAddMasterSetting = (e) => {
    e.preventDefault();
    const val = newSettingInput.trim();
    if (!val) return;
    const currentList = configs[settingsActiveTab] || [];
    if (currentList.some(item => (typeof item === 'string' ? item : item.name).toLowerCase() === val.toLowerCase())) {
      triggerEliteAlert(`"${val}" is already present in ${settingsActiveTab}!`, 'Duplicate Item');
      return;
    }
    setConfigs(prev => ({
      ...prev,
      [settingsActiveTab]: [...(prev[settingsActiveTab] || []), val]
    }));
    setNewSettingInput('');
  };

  const handleStartEditMasterSetting = (index, value) => {
    setEditingItemIndex(index);
    setEditingItemValue(typeof value === 'object' ? value.name : value);
  };

  const handleSaveEditMasterSetting = (index) => {
    const val = editingItemValue.trim();
    if (!val) return;
    setConfigs(prev => {
      const updated = [...prev[settingsActiveTab]];
      if (typeof updated[index] === 'object') {
        updated[index] = { ...updated[index], name: val };
      } else {
        updated[index] = val;
      }
      return { ...prev, [settingsActiveTab]: updated };
    });
    setEditingItemIndex(null);
    setEditingItemValue('');
  };

  const handleDeleteMasterSetting = (index, item) => {
    const itemName = typeof item === 'object' ? item.name : item;
    triggerEliteConfirm(
      `Are you sure you want to remove "${itemName}" from master list?`,
      () => {
        setConfigs(prev => ({
          ...prev,
          [settingsActiveTab]: prev[settingsActiveTab].filter((_, idx) => idx !== index)
        }));
      },
      null,
      'Delete Master Item',
      'Delete',
      'Cancel'
    );
  };

  const handleResetMasterTabDefaults = () => {
    triggerEliteConfirm(
      `Reset all ${settingsActiveTab} back to standard Surat factory defaults?`,
      () => {
        setConfigs(prev => ({
          ...prev,
          [settingsActiveTab]: DEFAULT_CONFIGS[settingsActiveTab]
        }));
        triggerEliteAlert(`Reset ${settingsActiveTab} to default values.`, 'Reset Complete');
      },
      null,
      'Reset Defaults',
      'Reset',
      'Cancel'
    );
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

  const handleAddTpRow = () => {
    setWeaverForm(prev => {
      const nextSr = prev.tps.length + 1;
      return {
        ...prev,
        tps: [...prev.tps, { srNo: nextSr, tpNo: '', tpMtr: '' }]
      };
    });
  };

  const handleAddMultipleTpRows = (count = 5) => {
    setWeaverForm(prev => {
      const updated = [...prev.tps];
      for (let i = 0; i < count; i++) {
        const nextSr = updated.length + 1;
        updated.push({ srNo: nextSr, tpNo: '', tpMtr: '' });
      }
      return { ...prev, tps: updated };
    });
  };

  const handleClearAllTps = () => {
    setWeaverForm(prev => ({
      ...prev,
      tps: [{ srNo: 1, tpNo: '', tpMtr: '' }]
    }));
  };

  const handleRemoveTpRow = (index) => {
    setWeaverForm(prev => {
      const filtered = prev.tps.filter((_, idx) => idx !== index);
      const reIndexed = filtered.map((item, idx) => ({ ...item, srNo: idx + 1 }));
      return { ...prev, tps: reIndexed.length > 0 ? reIndexed : [{ srNo: 1, tpNo: '', tpMtr: '' }] };
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

  const handleResetToCleanSlate = () => {
    triggerEliteConfirm(
      'Are you sure you want to clear all fabric lots and mill challans from the system? This will remove all test/demo data and start completely fresh.',
      () => {
        setGrayLots([]);
        setMillChallans([]);
        setRfdLots([]);
        try {
          localStorage.removeItem(STORAGE_GRAY_KEY);
          localStorage.removeItem(STORAGE_MILL_CHALLAN_KEY);
          localStorage.removeItem(STORAGE_RFD_KEY);
        } catch (e) {}
        triggerEliteAlert('All fabric lots and mill challans have been cleared. System is now on a completely clean slate!', 'Clean Slate');
      },
      'Clear All Data'
    );
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
    return {
      totalMtrs: parseFloat(totalMtrs.toFixed(2)),
      totalTps: filledTps,
      avgMtr: filledTps > 0 ? (totalMtrs / filledTps).toFixed(2) : 0
    };
  }, [weaverForm.tps]);

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

  const handleSaveWeaverInward = (e) => {
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

    const newGrayLot = {
      id: nextId,
      lotNumber,
      inwardDate: weaverForm.inwardDate,
      weaverParty: weaverForm.weaverParty.trim(),
      weaverChallanNo: weaverForm.weaverChallanNo.trim() || 'Direct Inward',
      fabricQuality: weaverForm.fabricQuality,
      totalTps: validTps.length,
      totalMeters: parseFloat(totalMeters.toFixed(2)),
      sentToMillMeters: 0,
      ratePerMeter: parseFloat(weaverForm.ratePerMeter) || 0,
      status: 'In Stock',
      rackLocation: weaverForm.rackLocation.trim() || '',
      remarks: weaverForm.remarks.trim(),
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
      tps: [
        { srNo: 1, tpNo: '', tpMtr: '' }
      ]
    });

    triggerEliteAlert(`Gray Fabric Lot ${lotNumber} (${validTps.length} TPs, ${totalMeters.toFixed(2)} Mtr) successfully inwarded!`, 'Inward Successful');
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
  const matchesDateRange = (itemDateStr) => {
    if (!itemDateStr) return true;
    const itemDate = new Date(itemDateStr);
    if (isNaN(itemDate.getTime())) return true;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (datePreset === 'today') {
      const d = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
      return d.getTime() === today.getTime();
    }
    if (datePreset === 'this_week') {
      const startOfWeek = new Date(today);
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      return itemDate >= startOfWeek;
    }
    if (datePreset === 'this_month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return itemDate >= startOfMonth;
    }
    if (datePreset === 'custom' || dateFrom || dateTo) {
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (itemDate < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (itemDate > to) return false;
      }
      return true;
    }
    return true;
  };

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
    return Array.from(set).sort();
  }, [configs.qualities, grayLots, millChallans]);

  const availableMillOptions = useMemo(() => {
    const set = new Set();
    (configs.mills || []).forEach(m => {
      const name = typeof m === 'string' ? m : m?.name;
      if (name) set.add(name);
    });
    millChallans.forEach(c => {
      if (c.millParty) set.add(c.millParty);
    });
    return Array.from(set).sort();
  }, [configs.mills, millChallans]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (datePreset !== 'all' || dateFrom || dateTo) count++;
    if (selectedWeaver !== 'all') count++;
    if (selectedQuality !== 'all') count++;
    if (selectedMill !== 'all') count++;
    if (selectedStatus !== 'all') count++;
    return count;
  }, [searchQuery, datePreset, dateFrom, dateTo, selectedWeaver, selectedQuality, selectedMill, selectedStatus]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    setSelectedWeaver('all');
    setSelectedQuality('all');
    setSelectedMill('all');
    setSelectedStatus('all');
    setMillQualityFilter('all');
    setMillSearchQuery('');
  };

  // Filtered Gray Fabric Lots
  const filteredGrayLots = useMemo(() => {
    return grayLots.filter(lot => {
      if (!matchesDateRange(lot.inwardDate)) return false;
      if (selectedWeaver !== 'all' && lot.weaverParty !== selectedWeaver) return false;
      if (selectedQuality !== 'all' && lot.fabricQuality !== selectedQuality) return false;

      if (selectedStatus !== 'all') {
        const availableTps = (lot.tps || []).filter(t => t.status === 'In Stock');
        const inWarehouseMtr = availableTps.reduce((sum, t) => sum + (Number(t.tpMtr) || 0), 0);
        const atMillMtr = (lot.tps || []).filter(t => t.status === 'Sent to Mill').reduce((sum, t) => sum + (Number(t.tpMtr) || 0), 0);

        if (selectedStatus === 'in_warehouse' && inWarehouseMtr <= 0) return false;
        if (selectedStatus === 'at_mill' && atMillMtr <= 0) return false;
        if (selectedStatus === 'closed' && inWarehouseMtr > 0) return false;
      }

      if (searchQuery.trim()) {
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
  }, [grayLots, datePreset, dateFrom, dateTo, selectedWeaver, selectedQuality, selectedStatus, searchQuery]);

  // Filtered Mill Outward Challans
  const filteredMillChallans = useMemo(() => {
    return millChallans.filter(ch => {
      if (!matchesDateRange(ch.challanDate)) return false;
      if (selectedMill !== 'all' && ch.millParty !== selectedMill) return false;
      if (selectedQuality !== 'all' && ch.fabricQuality !== selectedQuality) return false;
      if (millQualityFilter !== 'all' && ch.fabricQuality !== millQualityFilter) return false;

      if (selectedStatus !== 'all') {
        const isClosed = ch.isClosed || ch.status === 'Fully Received';
        if (selectedStatus === 'closed' && !isClosed) return false;
        if (selectedStatus === 'open' && isClosed) return false;
      }

      const q = (searchQuery || millSearchQuery).trim().toLowerCase();
      if (q) {
        const matchNo = ch.challanNo && ch.challanNo.toLowerCase().includes(q);
        const matchMill = ch.millParty && ch.millParty.toLowerCase().includes(q);
        const matchProcess = ch.processRequired && ch.processRequired.toLowerCase().includes(q);
        const matchVehicle = ch.vehicleNo && ch.vehicleNo.toLowerCase().includes(q);
        const matchQuality = ch.fabricQuality && ch.fabricQuality.toLowerCase().includes(q);
        if (!matchNo && !matchMill && !matchProcess && !matchVehicle && !matchQuality) return false;
      }
      return true;
    });
  }, [millChallans, datePreset, dateFrom, dateTo, selectedMill, selectedQuality, millQualityFilter, selectedStatus, searchQuery, millSearchQuery]);

  // Filtered RFD Processed Lots
  const filteredRfdLots = useMemo(() => {
    return rfdLots.filter(lot => {
      if (!matchesDateRange(lot.receivedDate)) return false;
      if (selectedMill !== 'all' && lot.millParty !== selectedMill) return false;
      if (selectedQuality !== 'all' && lot.fabricQuality !== selectedQuality) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchLot = lot.lotNumber && lot.lotNumber.toLowerCase().includes(q);
        const matchMill = lot.millParty && lot.millParty.toLowerCase().includes(q);
        const matchChallan = lot.millChallanNo && String(lot.millChallanNo).toLowerCase().includes(q);
        const matchQuality = lot.fabricQuality && lot.fabricQuality.toLowerCase().includes(q);
        if (!matchLot && !matchMill && !matchChallan && !matchQuality) return false;
      }
      return true;
    });
  }, [rfdLots, datePreset, dateFrom, dateTo, selectedMill, selectedQuality, searchQuery]);

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
      notes: lot.notes || lot.remarks || '',
      tps: (lot.tps || []).map(t => ({ ...t }))
    });
  };

  const handleSaveEditGrayLot = (e) => {
    e.preventDefault();
    if (!editingGrayLot || !editGrayLotForm) return;

    const validTps = (editGrayLotForm.tps || []).map((t, idx) => ({
      ...t,
      srNo: idx + 1,
      tpNo: t.tpNo || String(idx + 1),
      tpMtr: parseFloat(t.tpMtr) || 0
    }));

    const totalMeters = validTps.reduce((sum, t) => sum + t.tpMtr, 0);
    const sentToMillMeters = validTps.filter(t => t.status === 'Sent to Mill').reduce((sum, t) => sum + t.tpMtr, 0);
    const hasSent = sentToMillMeters > 0;
    const hasRemainingInStock = validTps.some(t => t.status === 'In Stock');

    let newStatus = 'In Stock';
    if (hasSent && hasRemainingInStock) newStatus = 'Partially at Mill';
    else if (hasSent && !hasRemainingInStock) newStatus = 'Fully at Mill';

    setGrayLots(prev => prev.map(l => {
      if (l.id === editingGrayLot.id) {
        return {
          ...l,
          lotNumber: editGrayLotForm.lotNumber.trim(),
          inwardDate: editGrayLotForm.inwardDate,
          weaverParty: editGrayLotForm.weaverParty,
          weaverChallanNo: editGrayLotForm.weaverChallanNo,
          fabricQuality: editGrayLotForm.fabricQuality,
          ratePerMeter: parseFloat(editGrayLotForm.ratePerMeter) || 0,
          remarks: editGrayLotForm.notes,
          notes: editGrayLotForm.notes,
          tps: validTps,
          totalTps: validTps.length,
          totalMeters: parseFloat(totalMeters.toFixed(2)),
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

  const handleSubmitInwardRfd = (e) => {
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
      sourceChallanId: inwardRfdForm.sourceChallanId || null
    };

    setRfdLots(prev => [newRfdLot, ...prev]);

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
      shortageMeters: '',
      receivedRollsCount: '',
      isChallanClosed: true,
      notes: ''
    });

    triggerEliteAlert(
      `RFD Fabric Lot "${lotNumber}" inwarded (${receivedRfd} Mtr). Shortage: ${shortageMtr} Mtr (${shortagePct}%). Still at Mill: ${stillAtMill} Mtr.`,
      'RFD Inward Successful'
    );
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
          {/* 🔍 UNIFIED MULTI-FILTER BAR (DATE + QUALITY + WEAVER + SEARCH) */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div
            className="glass-panel"
            style={{
              padding: '0.875rem 1rem',
              marginBottom: '1rem',
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              {/* Left: Quick Date Presets & Custom Pickers */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                  <button
                    type="button"
                    onClick={() => { setDatePreset('all'); setDateFrom(''); setDateTo(''); }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.74rem',
                      fontWeight: datePreset === 'all' ? 800 : 500,
                      borderRadius: '6px',
                      border: 'none',
                      background: datePreset === 'all' ? '#ffffff' : 'transparent',
                      color: datePreset === 'all' ? '#0f172a' : '#64748b',
                      cursor: 'pointer',
                      boxShadow: datePreset === 'all' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    All Dates
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDatePreset('today'); setDateFrom(''); setDateTo(''); }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.74rem',
                      fontWeight: datePreset === 'today' ? 800 : 500,
                      borderRadius: '6px',
                      border: 'none',
                      background: datePreset === 'today' ? '#ffffff' : 'transparent',
                      color: datePreset === 'today' ? '#0f172a' : '#64748b',
                      cursor: 'pointer',
                      boxShadow: datePreset === 'today' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDatePreset('this_week'); setDateFrom(''); setDateTo(''); }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.74rem',
                      fontWeight: datePreset === 'this_week' ? 800 : 500,
                      borderRadius: '6px',
                      border: 'none',
                      background: datePreset === 'this_week' ? '#ffffff' : 'transparent',
                      color: datePreset === 'this_week' ? '#0f172a' : '#64748b',
                      cursor: 'pointer',
                      boxShadow: datePreset === 'this_week' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    This Week
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDatePreset('this_month'); setDateFrom(''); setDateTo(''); }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.74rem',
                      fontWeight: datePreset === 'this_month' ? 800 : 500,
                      borderRadius: '6px',
                      border: 'none',
                      background: datePreset === 'this_month' ? '#ffffff' : 'transparent',
                      color: datePreset === 'this_month' ? '#0f172a' : '#64748b',
                      cursor: 'pointer',
                      boxShadow: datePreset === 'this_month' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    This Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setDatePreset('custom')}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.74rem',
                      fontWeight: datePreset === 'custom' ? 800 : 500,
                      borderRadius: '6px',
                      border: 'none',
                      background: datePreset === 'custom' ? '#ffffff' : 'transparent',
                      color: datePreset === 'custom' ? '#0f172a' : '#64748b',
                      cursor: 'pointer',
                      boxShadow: datePreset === 'custom' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    Custom Range
                  </button>
                </div>

                {/* Inline Date Range Picker */}
                {datePreset === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="input-field"
                      style={{ height: '30px', fontSize: '0.74rem', padding: '0 6px' }}
                      title="Date From"
                    />
                    <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>to</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="input-field"
                      style={{ height: '30px', fontSize: '0.74rem', padding: '0 6px' }}
                      title="Date To"
                    />
                  </div>
                )}
              </div>

              {/* Right: Reset Data Button */}
              <button
                type="button"
                onClick={handleResetToCleanSlate}
                className="btn-secondary"
                style={{
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#dc2626',
                  borderColor: '#fca5a5',
                  background: '#fef2f2',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  borderRadius: '6px'
                }}
                title="Clear all lots and challans from memory and start fresh"
              >
                <Trash2 size={12} /> Clear Screen Data
              </button>
            </div>

            {/* Second Row: Dropdown Filters & Search */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginTop: '10px', alignItems: 'center' }}>
              {/* Keyword Search */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder={graySubTab === 'weaver_inward' ? "Search Lot, Weaver, Challan #..." : "Search Challan #, Mill, Vehicle..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '30px', height: '32px', fontSize: '0.78rem', width: '100%' }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Quality Filter */}
              <select
                value={selectedQuality}
                onChange={(e) => setSelectedQuality(e.target.value)}
                className="input-field"
                style={{ height: '32px', fontSize: '0.78rem', padding: '0 8px', fontWeight: 600 }}
              >
                <option value="all">All Fabric Qualities</option>
                {availableQualityOptions.map(q => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>

              {/* Weaver Filter (shown in weaver inward tab) */}
              {graySubTab === 'weaver_inward' && screenMode === 'gray' && (
                <select
                  value={selectedWeaver}
                  onChange={(e) => setSelectedWeaver(e.target.value)}
                  className="input-field"
                  style={{ height: '32px', fontSize: '0.78rem', padding: '0 8px', fontWeight: 600 }}
                >
                  <option value="all">All Weavers / Loom Owners</option>
                  {availableWeaverOptions.map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              )}

              {/* Mill Filter (shown in mill outward and rfd tab) */}
              {(graySubTab === 'mill_outward' || screenMode === 'rfd') && (
                <select
                  value={selectedMill}
                  onChange={(e) => setSelectedMill(e.target.value)}
                  className="input-field"
                  style={{ height: '32px', fontSize: '0.78rem', padding: '0 8px', fontWeight: 600 }}
                >
                  <option value="all">All Processing Mills</option>
                  {availableMillOptions.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="input-field"
                style={{ height: '32px', fontSize: '0.78rem', padding: '0 8px', fontWeight: 600 }}
              >
                <option value="all">All Stock Statuses</option>
                {graySubTab === 'weaver_inward' ? (
                  <>
                    <option value="in_warehouse">In Warehouse (Available)</option>
                    <option value="at_mill">At Mill (Sent Outward)</option>
                    <option value="closed">Fully Cleared / Dispatched</option>
                  </>
                ) : (
                  <>
                    <option value="open">Active / Pending Inward</option>
                    <option value="closed">Fully Received / Closed</option>
                  </>
                )}
              </select>

              {/* Reset Filters Action */}
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="btn-secondary"
                  style={{
                    height: '32px',
                    padding: '0 10px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: '#2563eb',
                    borderColor: '#bfdbfe',
                    background: '#eff6ff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    borderRadius: '6px'
                  }}
                >
                  <RotateCcw size={12} /> Reset ({activeFilterCount})
                </button>
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* 📋 SUB-TAB 1: WEAVER INWARD & GRAY FABRIC LOTS           */}
          {/* ======================================================== */}
          {graySubTab === 'weaver_inward' && (
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Gray Fabric Inward Lots (Received from Weavers)
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Each lot contains full TP breakdown (Sr No, TP No, TP Mtr). Click "View TPs" to inspect all pieces.
                  </p>
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
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>
                            {lot.weaverChallanNo}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                            <span style={{ background: '#f8fafc', padding: '3px 8px', borderRadius: '5px', border: '1px solid #e2e8f0' }}>
                              {lot.fabricQuality}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0284c7' }}>
                            {lot.totalTps} TPs
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 800 }}>
                            {lot.totalMeters.toFixed(1)} Mtr
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
          {/* 🔍 UNIFIED MULTI-FILTER BAR (DATE + QUALITY + MILL + SEARCH)   */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div
            className="glass-panel"
            style={{
              padding: '0.875rem 1rem',
              marginBottom: '1rem',
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              {/* Left: Quick Date Presets & Custom Pickers */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                  <button
                    type="button"
                    onClick={() => { setDatePreset('all'); setDateFrom(''); setDateTo(''); }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.74rem',
                      fontWeight: datePreset === 'all' ? 800 : 500,
                      borderRadius: '6px',
                      border: 'none',
                      background: datePreset === 'all' ? '#ffffff' : 'transparent',
                      color: datePreset === 'all' ? '#0f172a' : '#64748b',
                      cursor: 'pointer',
                      boxShadow: datePreset === 'all' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    All Dates
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDatePreset('today'); setDateFrom(''); setDateTo(''); }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.74rem',
                      fontWeight: datePreset === 'today' ? 800 : 500,
                      borderRadius: '6px',
                      border: 'none',
                      background: datePreset === 'today' ? '#ffffff' : 'transparent',
                      color: datePreset === 'today' ? '#0f172a' : '#64748b',
                      cursor: 'pointer',
                      boxShadow: datePreset === 'today' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDatePreset('this_week'); setDateFrom(''); setDateTo(''); }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.74rem',
                      fontWeight: datePreset === 'this_week' ? 800 : 500,
                      borderRadius: '6px',
                      border: 'none',
                      background: datePreset === 'this_week' ? '#ffffff' : 'transparent',
                      color: datePreset === 'this_week' ? '#0f172a' : '#64748b',
                      cursor: 'pointer',
                      boxShadow: datePreset === 'this_week' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    This Week
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDatePreset('this_month'); setDateFrom(''); setDateTo(''); }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.74rem',
                      fontWeight: datePreset === 'this_month' ? 800 : 500,
                      borderRadius: '6px',
                      border: 'none',
                      background: datePreset === 'this_month' ? '#ffffff' : 'transparent',
                      color: datePreset === 'this_month' ? '#0f172a' : '#64748b',
                      cursor: 'pointer',
                      boxShadow: datePreset === 'this_month' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    This Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setDatePreset('custom')}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.74rem',
                      fontWeight: datePreset === 'custom' ? 800 : 500,
                      borderRadius: '6px',
                      border: 'none',
                      background: datePreset === 'custom' ? '#ffffff' : 'transparent',
                      color: datePreset === 'custom' ? '#0f172a' : '#64748b',
                      cursor: 'pointer',
                      boxShadow: datePreset === 'custom' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    Custom Range
                  </button>
                </div>

                {datePreset === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="input-field"
                      style={{ height: '30px', fontSize: '0.74rem', padding: '0 6px' }}
                      title="Date From"
                    />
                    <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>to</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="input-field"
                      style={{ height: '30px', fontSize: '0.74rem', padding: '0 6px' }}
                      title="Date To"
                    />
                  </div>
                )}
              </div>

              {/* Reset Data Button */}
              <button
                type="button"
                onClick={handleResetToCleanSlate}
                className="btn-secondary"
                style={{
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#dc2626',
                  borderColor: '#fca5a5',
                  background: '#fef2f2',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  borderRadius: '6px'
                }}
                title="Clear all lots and challans from memory and start fresh"
              >
                <Trash2 size={12} /> Clear Screen Data
              </button>
            </div>

            {/* Second Row: Dropdown Filters & Search */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginTop: '10px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search RFD Lot, Mill, Challan #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '30px', height: '32px', fontSize: '0.78rem', width: '100%' }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <select
                value={selectedQuality}
                onChange={(e) => setSelectedQuality(e.target.value)}
                className="input-field"
                style={{ height: '32px', fontSize: '0.78rem', padding: '0 8px', fontWeight: 600 }}
              >
                <option value="all">All Fabric Qualities</option>
                {availableQualityOptions.map(q => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>

              <select
                value={selectedMill}
                onChange={(e) => setSelectedMill(e.target.value)}
                className="input-field"
                style={{ height: '32px', fontSize: '0.78rem', padding: '0 8px', fontWeight: 600 }}
              >
                <option value="all">All Processing Mills</option>
                {availableMillOptions.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="btn-secondary"
                  style={{
                    height: '32px',
                    padding: '0 10px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: '#2563eb',
                    borderColor: '#bfdbfe',
                    background: '#eff6ff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    borderRadius: '6px'
                  }}
                >
                  <RotateCcw size={12} /> Reset ({activeFilterCount})
                </button>
              )}
            </div>
          </div>

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
                onClick={() => { setShowSettingsModal(false); setEditingItemIndex(null); }}
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
                {/* Search & Add Bar */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                    <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      placeholder={`Search ${settingsActiveTab === 'weavers' ? 'weavers' : 'mills'} by name, GSTIN, address, phone...`}
                      value={partySearchTerm}
                      onChange={(e) => setPartySearchTerm(e.target.value)}
                      className="input-field"
                      style={{ paddingLeft: '32px', height: '36px', fontSize: '0.82rem', width: '100%' }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenAddParty(settingsActiveTab)}
                    className="btn-primary"
                    style={{
                      height: '36px',
                      padding: '0 16px',
                      fontSize: '0.82rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                      border: 'none',
                      borderRadius: 8,
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 5px rgba(2, 132, 199, 0.25)'
                    }}
                  >
                    <Plus size={16} /> + Add New {settingsActiveTab === 'weavers' ? 'Weaver' : 'Processing Mill'}
                  </button>
                </div>

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
                        <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                          No {settingsActiveTab} found matching your search. Click "+ Add New" above to register details.
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
                      settingsActiveTab === 'qualities' ? 'Enter Fabric Quality (e.g. Cotton 60x60 Cambric)...' :
                      'Enter Process Type (e.g. RFD Bleaching)...'
                    }
                    value={newSettingInput}
                    onChange={(e) => setNewSettingInput(e.target.value)}
                    className="input-field"
                    style={{ height: '36px', fontSize: '0.82rem', flex: 1 }}
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ height: '36px', padding: '0 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '5px', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', border: 'none' }}
                  >
                    <Plus size={15} /> Add to Master
                  </button>
                </form>

                {/* Items List */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.5rem', maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(configs[settingsActiveTab] || []).length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                      No items configured for {settingsActiveTab}. Add a new value above.
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
                            padding: '7px 12px',
                            borderRadius: 6,
                            background: '#f8fafc',
                            border: '1px solid #f1f5f9'
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
                                style={{ height: '30px', padding: '0 8px', fontSize: '0.74rem' }}
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
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                              {textVal}
                            </span>
                          )}

                          {!isEditing && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() => handleStartEditMasterSetting(idx, item)}
                                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 3 }}
                                title="Edit / Rename"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMasterSetting(idx, item)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 3 }}
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

            {/* Modal Footer with Reset Defaults */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleResetMasterTabDefaults}
                  className="btn-secondary"
                  style={{ fontSize: '0.76rem', color: '#d97706', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #fde68a' }}
                >
                  <RotateCcw size={13} /> Restore Default {settingsActiveTab}
                </button>
                <button
                  type="button"
                  onClick={handleResetToCleanSlate}
                  className="btn-secondary"
                  style={{ fontSize: '0.76rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #fca5a5' }}
                  title="Clear all saved transaction data to start completely fresh"
                >
                  <Trash2 size={13} /> Clear All Lots & Challans
                </button>
              </div>

              <button
                type="button"
                onClick={() => { setShowSettingsModal(false); setEditingItemIndex(null); }}
                className="btn-primary"
                style={{ padding: '0.45rem 1.25rem', fontSize: '0.82rem' }}
              >
                Done / Close
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
              width: '100%',
              maxWidth: 740,
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
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Boxes size={22} color="#0284c7" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                      + Inward Gray Fabric from Weaver
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Select weaver & quality from masters. Enter individual TP Numbers & TP Meters. Press Enter to add next row.
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

            {/* Inward Form */}
            <form onSubmit={handleSaveWeaverInward} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Header Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                    Lot Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder={`GRAY-2026-${String(grayLots.length + 1).padStart(3, '0')}`}
                    value={weaverForm.lotNumber}
                    onChange={(e) => setWeaverForm(prev => ({ ...prev, lotNumber: e.target.value }))}
                    className="input-field"
                    style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                    Inward Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={weaverForm.inwardDate}
                    onChange={(e) => setWeaverForm(prev => ({ ...prev, inwardDate: e.target.value }))}
                    className="input-field"
                    style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>
              </div>

              {/* Weaver Party & Challan */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155' }}>
                      Weaver / Loom Owner Name *
                    </label>
                    <button
                      type="button"
                      onClick={() => { setSettingsActiveTab('weavers'); setShowSettingsModal(true); }}
                      style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      ⚙️ Manage Weavers
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <input
                      type="text"
                      required
                      list="weavers-master-datalist"
                      placeholder="Select or enter weaver name..."
                      value={weaverForm.weaverParty}
                      onChange={(e) => setWeaverForm(prev => ({ ...prev, weaverParty: e.target.value }))}
                      className="input-field"
                      style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
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
                      <div style={{ fontSize: '0.72rem', background: '#f8fafc', padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', color: '#475569', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {selectedWeaverDetails.gst && (
                          <span style={{ fontWeight: 800, color: '#16a34a' }}>
                            GSTIN: {selectedWeaverDetails.gst}
                          </span>
                        )}
                        {selectedWeaverDetails.address && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                            <MapPin size={11} color="#0284c7" /> {selectedWeaverDetails.address}, {selectedWeaverDetails.city}
                          </span>
                        )}
                        {selectedWeaverDetails.phone && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                            <Phone size={11} color="#16a34a" /> {selectedWeaverDetails.phone}
                          </span>
                        )}
                        {selectedWeaverDetails.broker && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                            <Briefcase size={11} color="#64748b" /> Agent: {selectedWeaverDetails.broker}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                    Weaver Gray Challan No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CH-8901"
                    value={weaverForm.weaverChallanNo}
                    onChange={(e) => setWeaverForm(prev => ({ ...prev, weaverChallanNo: e.target.value }))}
                    className="input-field"
                    style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>
              </div>

              {/* Fabric Quality & Rate per Meter from Master Settings */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155' }}>
                      Fabric Quality *
                    </label>
                    <button
                      type="button"
                      onClick={() => { setSettingsActiveTab('qualities'); setShowSettingsModal(true); }}
                      style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      ⚙️ Manage Qualities
                    </button>
                  </div>
                  <select
                    value={weaverForm.fabricQuality}
                    onChange={(e) => setWeaverForm(prev => ({ ...prev, fabricQuality: e.target.value }))}
                    className="input-field"
                    style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
                    required
                  >
                    <option value="">-- Select Fabric Quality * --</option>
                    {(configs.qualities || []).map(q => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                    Rate / Mtr (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Enter rate per meter..."
                    value={weaverForm.ratePerMeter}
                    onChange={(e) => setWeaverForm(prev => ({ ...prev, ratePerMeter: e.target.value }))}
                    className="input-field"
                    style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>
              </div>

              {/* 📊 TP ENTRY TABLE (SR NO AUTO, TP NO, TP MTR) */}
              <div style={{ marginTop: '0.5rem', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: '#f8fafc', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Hash size={15} color="#0284c7" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                      TP (Piece) Breakdown Entries
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                      type="button"
                      onClick={() => handleAddMultipleTpRows(10)}
                      className="btn-secondary"
                      style={{ padding: '3px 8px', fontSize: '0.72rem', height: '26px' }}
                    >
                      + Add 10 Rows
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddMultipleTpRows(5)}
                      className="btn-secondary"
                      style={{ padding: '3px 8px', fontSize: '0.72rem', height: '26px' }}
                    >
                      + Add 5 Rows
                    </button>
                    <button
                      type="button"
                      onClick={handleAddTpRow}
                      className="btn-primary"
                      style={{ padding: '3px 8px', fontSize: '0.72rem', height: '26px', background: '#0ea5e9', border: 'none' }}
                    >
                      + Add Row
                    </button>
                    {weaverForm.tps.length > 1 && (
                      <button
                        type="button"
                        onClick={handleClearAllTps}
                        style={{ padding: '3px 8px', fontSize: '0.72rem', height: '26px', background: 'none', border: '1px solid #fca5a5', color: '#ef4444', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                        title="Clear all rows and reset to 1 empty row"
                      >
                        Reset Rows
                      </button>
                    )}
                  </div>
                </div>

                {/* TP Rows Scrollable Area */}
                <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '6px 8px', width: 70 }}>Sr. No</th>
                        <th style={{ padding: '6px 8px' }}>TP No.</th>
                        <th style={{ padding: '6px 8px' }}>TP Meter (Mtr) *</th>
                        <th style={{ padding: '6px 8px', width: 40, textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {weaverForm.tps.map((tp, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '5px 8px', fontWeight: 800, color: '#64748b' }}>
                            {tp.srNo}
                          </td>
                          <td style={{ padding: '5px 8px' }}>
                            <input
                              type="text"
                              value={tp.tpNo}
                              onChange={(e) => handleTpChange(idx, 'tpNo', e.target.value)}
                              placeholder={`TP-${idx + 1}`}
                              className="input-field"
                              style={{ height: '30px', fontSize: '0.8rem', width: '100%' }}
                            />
                          </td>
                          <td style={{ padding: '5px 8px' }}>
                            <input
                              id={`tp-mtr-input-${idx}`}
                              type="text"
                              inputMode="decimal"
                              value={tp.tpMtr}
                              onChange={(e) => handleTpChange(idx, 'tpMtr', e.target.value)}
                              onKeyDown={(e) => handleTpKeyDown(e, idx)}
                              placeholder="e.g. 102.5"
                              className="input-field"
                              style={{ height: '30px', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', width: '100%' }}
                            />
                          </td>
                          <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                            {weaverForm.tps.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTpRow(idx)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2 }}
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

                {/* TP Summary Footer */}
                <div style={{ background: '#f1f5f9', padding: '8px 12px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.76rem', color: '#475569' }}>
                    Total TPs Entered: <strong style={{ color: '#0284c7' }}>{weaverFormSummary.totalTps}</strong>
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                    Grand Total: <span style={{ color: '#0284c7', fontSize: '1rem' }}>{weaverFormSummary.totalMtrs}</span> Mtr
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
                <button
                  type="button"
                  onClick={() => setShowWeaverInwardModal(false)}
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
                const lotDisplay = showPrintChallanModal.lotNumber || Array.from(new Set((showPrintChallanModal.tps || []).map(tp => tp.lotNumber).filter(Boolean))).join(', ') || 'N/A';
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
                          <div><strong>Vehicle No:</strong> {showPrintChallanModal.vehicleNo}</div>
                          <div><strong>Quality:</strong> {showPrintChallanModal.fabricQuality}</div>
                          <div><strong>Lot No:</strong> <span style={{ fontWeight: 800 }}>{lotDisplay}</span></div>
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
