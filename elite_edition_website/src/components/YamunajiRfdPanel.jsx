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

const STORAGE_GRAY_KEY = 'yamunaji_gray_lots_data';
const STORAGE_MILL_CHALLAN_KEY = 'yamunaji_mill_challans_data';
const STORAGE_RFD_KEY = 'yamunaji_rfd_lots_data';
const STORAGE_CONFIGS_KEY = 'yamunaji_master_configurations';

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
  pannas: [
    '44"',
    '48"',
    '50"',
    '54"',
    '58"',
    '60"'
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
// SEED DATA FOR GRAY FABRIC
// ==========================================
const SEED_GRAY_LOTS = [
  {
    id: 'GRAY-LOT-2026-001',
    lotNumber: 'GRAY-2026-001',
    inwardDate: '2026-10-24',
    weaverParty: 'Maruti Weaving Works',
    weaverChallanNo: 'MWW-8921',
    fabricQuality: 'Pure Viscose Rayon 14kg',
    panna: '44"',
    totalTps: 10,
    totalMeters: 1024.5,
    sentToMillMeters: 512.0,
    ratePerMeter: 46.0,
    status: 'Partially at Mill', // In Stock, Partially at Mill, Fully at Mill
    rackLocation: 'Gray Rack G-01',
    remarks: 'Dense 14kg warp-weft weave. Zero weaving defect.',
    tps: [
      { srNo: 1, tpNo: '101', tpMtr: 102.5, status: 'Sent to Mill', millChallanNo: 'MILL-CH-101' },
      { srNo: 2, tpNo: '102', tpMtr: 101.0, status: 'Sent to Mill', millChallanNo: 'MILL-CH-101' },
      { srNo: 3, tpNo: '103', tpMtr: 104.2, status: 'Sent to Mill', millChallanNo: 'MILL-CH-101' },
      { srNo: 4, tpNo: '104', tpMtr: 103.0, status: 'Sent to Mill', millChallanNo: 'MILL-CH-101' },
      { srNo: 5, tpNo: '105', tpMtr: 101.3, status: 'Sent to Mill', millChallanNo: 'MILL-CH-101' },
      { srNo: 6, tpNo: '106', tpMtr: 102.0, status: 'In Stock', millChallanNo: null },
      { srNo: 7, tpNo: '107', tpMtr: 103.5, status: 'In Stock', millChallanNo: null },
      { srNo: 8, tpNo: '108', tpMtr: 101.8, status: 'In Stock', millChallanNo: null },
      { srNo: 9, tpNo: '109', tpMtr: 102.7, status: 'In Stock', millChallanNo: null },
      { srNo: 10, tpNo: '110', tpMtr: 102.5, status: 'In Stock', millChallanNo: null }
    ]
  },
  {
    id: 'GRAY-LOT-2026-002',
    lotNumber: 'GRAY-2026-002',
    inwardDate: '2026-10-25',
    weaverParty: 'Harikrishna Textiles',
    weaverChallanNo: 'HKT-4450',
    fabricQuality: 'Pure Modal Satin 60s',
    panna: '44"',
    totalTps: 8,
    totalMeters: 818.0,
    sentToMillMeters: 0,
    ratePerMeter: 82.0,
    status: 'In Stock',
    rackLocation: 'Gray Rack G-02',
    remarks: 'High twist modal gray fabric received from Katargam looms.',
    tps: [
      { srNo: 1, tpNo: '201', tpMtr: 102.0, status: 'In Stock', millChallanNo: null },
      { srNo: 2, tpNo: '202', tpMtr: 101.5, status: 'In Stock', millChallanNo: null },
      { srNo: 3, tpNo: '203', tpMtr: 103.0, status: 'In Stock', millChallanNo: null },
      { srNo: 4, tpNo: '204', tpMtr: 102.5, status: 'In Stock', millChallanNo: null },
      { srNo: 5, tpNo: '205', tpMtr: 101.0, status: 'In Stock', millChallanNo: null },
      { srNo: 6, tpNo: '206', tpMtr: 103.5, status: 'In Stock', millChallanNo: null },
      { srNo: 7, tpNo: '207', tpMtr: 102.0, status: 'In Stock', millChallanNo: null },
      { srNo: 8, tpNo: '208', tpMtr: 102.5, status: 'In Stock', millChallanNo: null }
    ]
  },
  {
    id: 'GRAY-LOT-2026-003',
    lotNumber: 'GRAY-2026-003',
    inwardDate: '2026-10-26',
    weaverParty: 'Shivam Loom Industries',
    weaverChallanNo: 'SLI-1029',
    fabricQuality: 'Cotton 60x60 Cambric',
    panna: '58"',
    totalTps: 12,
    totalMeters: 1248.0,
    sentToMillMeters: 0,
    ratePerMeter: 38.5,
    status: 'In Stock',
    rackLocation: 'Gray Rack G-03',
    remarks: '58" wide cambric fresh inward from weaver.',
    tps: Array.from({ length: 12 }, (_, i) => ({
      srNo: i + 1,
      tpNo: `30${i + 1}`,
      tpMtr: 104.0,
      status: 'In Stock',
      millChallanNo: null
    }))
  }
];

// Seed Mill Outward Challans
const SEED_MILL_CHALLANS = [
  {
    id: 'MILL-CH-101',
    challanNo: 'MILL-CH-101',
    challanDate: '2026-10-25',
    millParty: 'Shree Radhe Bleaching & Dyeing Processors',
    vehicleNo: 'GJ-05-BT-4412',
    driverName: 'Ramesh Patel',
    processRequired: 'RFD Bleaching, Scouring & Heat Setting',
    fabricQuality: 'Pure Viscose Rayon 14kg',
    totalTps: 5,
    totalMeters: 512.0,
    status: 'At Mill',
    tps: [
      { srNo: 1, lotNumber: 'GRAY-2026-001', tpNo: '101', tpMtr: 102.5 },
      { srNo: 2, lotNumber: 'GRAY-2026-001', tpNo: '102', tpMtr: 101.0 },
      { srNo: 3, lotNumber: 'GRAY-2026-001', tpNo: '103', tpMtr: 104.2 },
      { srNo: 4, lotNumber: 'GRAY-2026-001', tpNo: '104', tpMtr: 103.0 },
      { srNo: 5, lotNumber: 'GRAY-2026-001', tpNo: '105', tpMtr: 101.3 }
    ],
    notes: 'Urgent RFD required for digital discharge printing batch #1102.'
  }
];

// Seed Processed RFD Lots
const SEED_RFD_LOTS = [
  {
    id: 'YJ-RFD-2026-001',
    lotNumber: 'YJ-RFD-2026-001',
    inwardDate: '2026-10-26',
    millParty: 'Shree Radhe Bleaching & Dyeing Processors',
    millChallanNo: 'RADHE-RFD-7721',
    originMillChallan: 'MILL-CH-101',
    fabricQuality: 'Pure Viscose Rayon 14kg',
    panna: '44"',
    gsm: 140,
    graySentMeters: 512.0,
    receivedRfdMeters: 498.0,
    shrinkageLossMeters: 14.0,
    shrinkagePercent: 2.73,
    totalRolls: 5,
    issuedMeters: 200.0,
    ratePerMeter: 68.5,
    qualityGrade: 'A Grade',
    status: 'Partially Issued',
    rackLocation: 'RFD Rack YJ-A1',
    remarks: 'Ready for digital sublimation discharge. 0% residue verified.',
    rolls: [
      { rollNo: 'R-01', meters: 100, status: 'Issued', issueTo: 'EDP Job Card #1102' },
      { rollNo: 'R-02', meters: 100, status: 'Issued', issueTo: 'EDP Job Card #1102' },
      { rollNo: 'R-03', meters: 100, status: 'In Stock', issueTo: null },
      { rollNo: 'R-04', meters: 99, status: 'In Stock', issueTo: null },
      { rollNo: 'R-05', meters: 99, status: 'In Stock', issueTo: null }
    ]
  }
];

export default function YamunajiRfdPanel({ companyEntity = 'Yamunaji', onNavigate }) {
  // Master Screen Mode: 'gray' (Gray Fabric) or 'rfd' (RFD Fabric)
  const [screenMode, setScreenMode] = useState('gray');

  // Sub-tabs for Gray: 'weaver_inward' or 'mill_outward'
  const [graySubTab, setGraySubTab] = useState('weaver_inward');

  // Master Configuration State (Weavers, Qualities, Pannas, Mills, Processes)
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
            pannas: Array.isArray(p.pannas) && p.pannas.length > 0 ? p.pannas : DEFAULT_CONFIGS.pannas,
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

  // Data States
  const [grayLots, setGrayLots] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_GRAY_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (Array.isArray(p) && p.length > 0) return p;
      }
    } catch (e) {}
    return SEED_GRAY_LOTS;
  });

  const [millChallans, setMillChallans] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_MILL_CHALLAN_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (Array.isArray(p) && p.length > 0) return p;
      }
    } catch (e) {}
    return SEED_MILL_CHALLANS;
  });

  const [rfdLots, setRfdLots] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_RFD_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (Array.isArray(p) && p.length > 0) return p;
      }
    } catch (e) {}
    return SEED_RFD_LOTS;
  });

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsActiveTab, setSettingsActiveTab] = useState('weavers'); // 'weavers' | 'qualities' | 'pannas' | 'mills' | 'processes'
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

  // Form State for Weaver Inward with TP details
  const [weaverForm, setWeaverForm] = useState({
    lotNumber: '',
    inwardDate: new Date().toISOString().split('T')[0],
    weaverParty: '',
    weaverChallanNo: '',
    fabricQuality: configs.qualities[0] || 'Pure Viscose Rayon 14kg',
    panna: configs.pannas[0] || '44"',
    ratePerMeter: 45,
    rackLocation: 'Gray Rack G-01',
    remarks: '',
    tps: [
      { srNo: 1, tpNo: '1', tpMtr: '' },
      { srNo: 2, tpNo: '2', tpMtr: '' },
      { srNo: 3, tpNo: '3', tpMtr: '' },
      { srNo: 4, tpNo: '4', tpMtr: '' },
      { srNo: 5, tpNo: '5', tpMtr: '' }
    ]
  });

  // Filters for Mill Outward Challans List
  const [millQualityFilter, setMillQualityFilter] = useState('all');
  const [millSearchQuery, setMillSearchQuery] = useState('');

  // Form State for Mill Outward Challan
  const [millChallanForm, setMillChallanForm] = useState({
    challanNo: '',
    challanDate: new Date().toISOString().split('T')[0],
    fabricQuality: configs.qualities[0] || 'Pure Viscose Rayon 14kg',
    selectedLotId: 'all',
    millParty: getPartyName(configs.mills[0]) || 'Shree Radhe Bleaching & Dyeing Processors',
    vehicleNo: '',
    driverName: '',
    processRequired: configs.processes[0] || 'RFD Bleaching, Scouring & Heat Setting',
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

  const rfdStats = useMemo(() => {
    let inStockRfdMtrs = 0;
    let inStockRolls = 0;
    rfdLots.forEach(lot => {
      const bal = Math.max(0, (lot.receivedRfdMeters || 0) - (lot.issuedMeters || 0));
      inStockRfdMtrs += bal;
      inStockRolls += (lot.rolls || []).filter(r => r.status === 'In Stock').length;
    });
    return { inStockRfdMtrs, inStockRolls, totalRfdLots: rfdLots.length };
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
      const lastTpNo = prev.tps.length > 0 ? Number(prev.tps[prev.tps.length - 1].tpNo) : 0;
      const nextTpNo = !isNaN(lastTpNo) && lastTpNo > 0 ? String(lastTpNo + 1) : String(nextSr);
      return {
        ...prev,
        tps: [...prev.tps, { srNo: nextSr, tpNo: nextTpNo, tpMtr: '' }]
      };
    });
  };

  const handleAddMultipleTpRows = (count = 5) => {
    setWeaverForm(prev => {
      const updated = [...prev.tps];
      for (let i = 0; i < count; i++) {
        const nextSr = updated.length + 1;
        const lastTpNo = updated.length > 0 ? Number(updated[updated.length - 1].tpNo) : 0;
        const nextTpNo = !isNaN(lastTpNo) && lastTpNo > 0 ? String(lastTpNo + 1) : String(nextSr);
        updated.push({ srNo: nextSr, tpNo: nextTpNo, tpMtr: '' });
      }
      return { ...prev, tps: updated };
    });
  };

  const handleRemoveTpRow = (index) => {
    setWeaverForm(prev => {
      const filtered = prev.tps.filter((_, idx) => idx !== index);
      const reIndexed = filtered.map((item, idx) => ({ ...item, srNo: idx + 1 }));
      return { ...prev, tps: reIndexed };
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
      panna: weaverForm.panna,
      totalTps: validTps.length,
      totalMeters: parseFloat(totalMeters.toFixed(2)),
      sentToMillMeters: 0,
      ratePerMeter: parseFloat(weaverForm.ratePerMeter) || 0,
      status: 'In Stock',
      rackLocation: weaverForm.rackLocation.trim() || 'Gray Rack',
      remarks: weaverForm.remarks.trim(),
      tps: validTps.map((t, idx) => ({
        srNo: idx + 1,
        tpNo: t.tpNo || String(idx + 1),
        tpMtr: parseFloat(t.tpMtr),
        status: 'In Stock',
        millChallanNo: null
      }))
    };

    setGrayLots(prev => [newGrayLot, ...prev]);
    setShowWeaverInwardModal(false);

    // Reset Form
    setWeaverForm({
      lotNumber: '',
      inwardDate: new Date().toISOString().split('T')[0],
      weaverParty: '',
      weaverChallanNo: '',
      fabricQuality: configs.qualities[0] || 'Pure Viscose Rayon 14kg',
      panna: configs.pannas[0] || '44"',
      ratePerMeter: 45,
      rackLocation: 'Gray Rack G-01',
      remarks: '',
      tps: [
        { srNo: 1, tpNo: '1', tpMtr: '' },
        { srNo: 2, tpNo: '2', tpMtr: '' },
        { srNo: 3, tpNo: '3', tpMtr: '' },
        { srNo: 4, tpNo: '4', tpMtr: '' },
        { srNo: 5, tpNo: '5', tpMtr: '' }
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
          panna: lot.panna,
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

  // Filtered Mill Outward Challans for table list
  const filteredMillChallans = useMemo(() => {
    return millChallans.filter(ch => {
      const matchQuality = millQualityFilter === 'all' || ch.fabricQuality === millQualityFilter;
      const q = millSearchQuery.trim().toLowerCase();
      const matchSearch = !q ||
        (ch.challanNo && ch.challanNo.toLowerCase().includes(q)) ||
        (ch.millParty && ch.millParty.toLowerCase().includes(q)) ||
        (ch.processRequired && ch.processRequired.toLowerCase().includes(q)) ||
        (ch.vehicleNo && ch.vehicleNo.toLowerCase().includes(q)) ||
        (ch.fabricQuality && ch.fabricQuality.toLowerCase().includes(q));
      return matchQuality && matchSearch;
    });
  }, [millChallans, millQualityFilter, millSearchQuery]);

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
      fabricQuality: configs.qualities[0] || 'Pure Viscose Rayon 14kg',
      selectedLotId: 'all',
      millParty: getPartyName(configs.mills[0]) || 'Shree Radhe Bleaching & Dyeing Processors',
      vehicleNo: '',
      driverName: '',
      processRequired: configs.processes[0] || 'RFD Bleaching, Scouring & Heat Setting',
      selectedTpKeys: {},
      notes: ''
    });

    triggerEliteAlert(`Mill Outward Challan ${challanNo} (${primaryQuality}) created for ${selectedMillTps.length} TPs (${totalMtrs} Mtr)!`, 'Challan Created');
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
                Yamunaji (YJ) — Fabric Operations & Challans
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
            title="Configure Weaver Names, Fabric Qualities, Panna Widths & Mills"
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

                <div style={{ position: 'relative', width: 260 }}>
                  <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Search Lot, Weaver, Challan..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: '32px', height: '34px', fontSize: '0.8rem', width: '100%' }}
                  />
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
                      <th style={{ padding: '10px 12px' }}>Panna</th>
                      <th style={{ padding: '10px 12px' }}>Total TPs</th>
                      <th style={{ padding: '10px 12px' }}>Total Gray Mtr</th>
                      <th style={{ padding: '10px 12px' }}>At Mill Mtr</th>
                      <th style={{ padding: '10px 12px' }}>In Warehouse</th>
                      <th style={{ padding: '10px 12px' }}>Status</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grayLots.map(lot => {
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
                          <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                            {lot.panna}
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
                            <button
                              onClick={() => setSelectedGrayLotForView(lot)}
                              className="btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '0.74rem', height: '28px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye size={13} /> View TPs ({lot.tps?.length || 0})
                            </button>
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

                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Quality Filter */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b' }}>
                      Quality:
                    </label>
                    <select
                      value={millQualityFilter}
                      onChange={(e) => setMillQualityFilter(e.target.value)}
                      className="input-field"
                      style={{ height: '34px', fontSize: '0.78rem', padding: '0 8px', fontWeight: 600 }}
                    >
                      <option value="all">All Fabric Qualities</option>
                      {(configs.qualities || []).map(q => (
                        <option key={q} value={q}>{q}</option>
                      ))}
                    </select>
                  </div>

                  {/* Search Input */}
                  <div style={{ position: 'relative', width: 220 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Search Challan, Mill, Vehicle..."
                      value={millSearchQuery}
                      onChange={(e) => setMillSearchQuery(e.target.value)}
                      className="input-field"
                      style={{ paddingLeft: '30px', height: '34px', fontSize: '0.78rem', width: '100%' }}
                    />
                  </div>

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
                      <th style={{ padding: '10px 12px' }}>Process Required</th>
                      <th style={{ padding: '10px 12px' }}>Vehicle / Transport</th>
                      <th style={{ padding: '10px 12px' }}>Total TPs</th>
                      <th style={{ padding: '10px 12px' }}>Total Meters</th>
                      <th style={{ padding: '10px 12px' }}>Status</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Print & Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMillChallans.map(ch => (
                      <tr key={ch.id} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover-row">
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: '#059669' }}>
                          {ch.challanNo}
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
                        <td style={{ padding: '10px 12px', color: '#64748b' }}>
                          {ch.processRequired}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                          {ch.vehicleNo}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0284c7' }}>
                          {ch.totalTps} TPs
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0f172a' }}>
                          {ch.totalMeters.toFixed(1)} Mtr
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: '5px',
                              background: '#fef3c7',
                              color: '#b45309',
                              border: '1px solid #fde68a'
                            }}
                          >
                            {ch.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button
                            onClick={() => setShowPrintChallanModal(ch)}
                            className="btn-primary"
                            style={{
                              padding: '3px 10px',
                              fontSize: '0.74rem',
                              height: '28px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#0ea5e9'
                            }}
                          >
                            <Printer size={13} /> Print Mill Challan
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredMillChallans.length === 0 && (
                      <tr>
                        <td colSpan={10} style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#64748b' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>
                            No Mill Outward Challans Found
                          </div>
                          <div style={{ fontSize: '0.78rem' }}>
                            {millQualityFilter !== 'all' || millSearchQuery
                              ? 'Try clearing the quality filter or search query.'
                              : 'Create your first delivery challan to send gray fabric pieces to the processing mill.'}
                          </div>
                        </td>
                      </tr>
                    )}
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
          {/* RFD Quick HUD */}
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
                {rfdStats.inStockRolls} Rolls Ready for Digital Printing
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Active RFD Lots
                </span>
                <PackageCheck size={16} color="#10b981" />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#059669' }}>
                {rfdStats.totalRfdLots} <span style={{ fontSize: '0.85rem' }}>Lots</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                Received from processing mills
              </div>
            </div>
          </div>

          {/* RFD Inventory Table */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Processed RFD Fabric Inventory (Ready For Dyeing / Discharge)
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Received back from processing mills. Directly available for EDP Digital Printing job cards.
                </p>
              </div>
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
                    <th style={{ padding: '10px 12px' }}>Panna</th>
                    <th style={{ padding: '10px 12px' }}>Gray Sent</th>
                    <th style={{ padding: '10px 12px' }}>RFD Received</th>
                    <th style={{ padding: '10px 12px' }}>Shrinkage / Loss</th>
                    <th style={{ padding: '10px 12px' }}>Available Balance</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rfdLots.map(lot => {
                    const balance = Math.max(0, lot.receivedRfdMeters - (lot.issuedMeters || 0));
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
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                          {lot.panna}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                          {lot.graySentMeters} Mtr
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0f172a' }}>
                          {lot.receivedRfdMeters} Mtr
                        </td>
                        <td style={{ padding: '10px 12px', color: '#ef4444', fontWeight: 700 }}>
                          {lot.shrinkageLossMeters} Mtr ({lot.shrinkagePercent}%)
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
                      </tr>
                    );
                  })}
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
                    Configure dropdown values for Weaver Names, Fabric Qualities, Panna Widths, Processing Mills & Process Types.
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
                onClick={() => { setSettingsActiveTab('pannas'); setEditingItemIndex(null); setNewSettingInput(''); }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: settingsActiveTab === 'pannas' ? 800 : 600,
                  background: settingsActiveTab === 'pannas' ? '#0ea5e9' : 'transparent',
                  color: settingsActiveTab === 'pannas' ? '#ffffff' : '#64748b',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                📏 Panna / Widths ({configs.pannas?.length || 0})
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
              /* TAB CONTENT: QUALITIES, PANNAS, PROCESSES */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* Quick Add Bar */}
                <form onSubmit={handleAddMasterSetting} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    required
                    placeholder={
                      settingsActiveTab === 'qualities' ? 'Enter Fabric Quality (e.g. Cotton 60x60 Cambric)...' :
                      settingsActiveTab === 'pannas' ? 'Enter Panna / Width (e.g. 52", 64")...' :
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
            zIndex: 10001,
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
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                    + Inward Gray Fabric from Weaver
                  </h3>
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

              {/* Fabric Quality & Panna from Master Settings */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr', gap: '0.75rem' }}>
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
                  >
                    {(configs.qualities || []).map(q => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155' }}>
                      Panna / Width *
                    </label>
                    <button
                      type="button"
                      onClick={() => { setSettingsActiveTab('pannas'); setShowSettingsModal(true); }}
                      style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      ⚙️ Manage Panna
                    </button>
                  </div>
                  <select
                    value={weaverForm.panna}
                    onChange={(e) => setWeaverForm(prev => ({ ...prev, panna: e.target.value }))}
                    className="input-field"
                    style={{ height: '34px', fontSize: '0.82rem', width: '100%' }}
                  >
                    {(configs.pannas || []).map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                    Rate / Mtr (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
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
              maxWidth: 720,
              maxHeight: '94vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: 12,
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
          >
            {/* Top Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                Print Preview: Delivery Challan to Processing Mill
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => window.print()}
                  className="btn-primary"
                  style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Printer size={14} /> Print Now
                </button>
                <button
                  onClick={() => setShowPrintChallanModal(null)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Printable Document Sheet */}
            <div
              id="printable-mill-challan"
              style={{
                border: '2px solid #0f172a',
                padding: '1.5rem',
                borderRadius: 4,
                background: '#ffffff',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                color: '#0f172a'
              }}
            >
              {/* Company Header */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, letterSpacing: '0.05em' }}>
                  YAMUNAJI (YJ)
                </h1>
                <p style={{ margin: '3px 0 0', fontSize: '0.82rem', fontWeight: 700 }}>
                  TEXTILE GRAY & RFD PROCESSING DIVISION — SURAT, GUJARAT
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#334155' }}>
                  GSTIN: <strong>24AAGFY0182C1ZP</strong> | Ring Road Textile Market, Surat - 395002 | Phone: +91 98250 12345
                </p>
                <div style={{ marginTop: 6, display: 'inline-block', border: '1.5px solid #0f172a', padding: '3px 14px', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  DELIVERY CHALLAN FOR PROCESSING MILL
                </div>
              </div>

              {/* Meta Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1rem', borderBottom: '1px solid #0f172a', paddingBottom: '0.75rem', marginBottom: '1rem', fontSize: '0.82rem' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>TO (PROCESSING MILL):</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 900, marginTop: 2, color: '#0f172a' }}>{showPrintChallanModal.millParty}</div>
                  {showPrintChallanModal.millGst && (
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0369a1', marginTop: 2 }}>
                      GSTIN: {showPrintChallanModal.millGst}
                    </div>
                  )}
                  {(showPrintChallanModal.millAddress || showPrintChallanModal.millCity) && (
                    <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: 2 }}>
                      {showPrintChallanModal.millAddress ? `${showPrintChallanModal.millAddress}, ` : ''}{showPrintChallanModal.millCity || ''}
                    </div>
                  )}
                  {showPrintChallanModal.millPhone && (
                    <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: 1 }}>
                      Phone: {showPrintChallanModal.millPhone} {showPrintChallanModal.millContact ? `(${showPrintChallanModal.millContact})` : ''}
                    </div>
                  )}
                  <div style={{ marginTop: 4 }}><strong>Process Required:</strong> {showPrintChallanModal.processRequired}</div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div><strong>Challan No:</strong> <span style={{ fontSize: '0.95rem', fontWeight: 800 }}>{showPrintChallanModal.challanNo}</span></div>
                  <div><strong>Date:</strong> {showPrintChallanModal.challanDate}</div>
                  <div><strong>Vehicle No:</strong> {showPrintChallanModal.vehicleNo}</div>
                  <div><strong>Quality:</strong> {showPrintChallanModal.fabricQuality}</div>
                </div>
              </div>

              {/* TP Breakdown Table */}
              <div style={{ marginBottom: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', border: '1px solid #0f172a' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #0f172a', textAlign: 'center', fontWeight: 800 }}>
                      <th style={{ padding: '6px', borderRight: '1px solid #0f172a', width: 60 }}>Sr. No</th>
                      <th style={{ padding: '6px', borderRight: '1px solid #0f172a' }}>Lot Number</th>
                      <th style={{ padding: '6px', borderRight: '1px solid #0f172a' }}>TP No.</th>
                      <th style={{ padding: '6px' }}>TP Meter (Mtr)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showPrintChallanModal.tps || []).map((tp, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>
                        <td style={{ padding: '5px', borderRight: '1px solid #0f172a', fontWeight: 700 }}>{tp.srNo}</td>
                        <td style={{ padding: '5px', borderRight: '1px solid #0f172a' }}>{tp.lotNumber}</td>
                        <td style={{ padding: '5px', borderRight: '1px solid #0f172a', fontWeight: 800 }}>{tp.tpNo}</td>
                        <td style={{ padding: '5px', fontWeight: 800 }}>{Number(tp.tpMtr).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8fafc', borderTop: '2px solid #0f172a', fontWeight: 900 }}>
                      <td colSpan={2} style={{ padding: '8px', borderRight: '1px solid #0f172a' }}>
                        TOTAL TPs: {showPrintChallanModal.totalTps}
                      </td>
                      <td colSpan={2} style={{ padding: '8px', textAlign: 'right', fontSize: '0.95rem' }}>
                        GRAND TOTAL METERS: {showPrintChallanModal.totalMeters.toFixed(1)} Mtr
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Remarks & Signatures */}
              {showPrintChallanModal.notes && (
                <div style={{ fontSize: '0.75rem', marginBottom: '1.5rem', background: '#f8fafc', padding: '6px 10px', border: '1px solid #e2e8f0' }}>
                  <strong>Notes:</strong> {showPrintChallanModal.notes}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2.5rem', paddingTop: '1rem', borderTop: '1px dashed #cbd5e1', fontSize: '0.78rem' }}>
                <div>
                  <div style={{ height: '35px' }}></div>
                  <div style={{ borderTop: '1px solid #0f172a', width: '180px', fontWeight: 700 }}>
                    Receiver's Signature (Mill)
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ height: '35px' }}></div>
                  <div style={{ borderTop: '1px solid #0f172a', width: '180px', marginLeft: 'auto', fontWeight: 700 }}>
                    For YAMUNAJI (Authorized)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
