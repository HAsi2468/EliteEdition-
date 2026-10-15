import React, { useState, useRef, useEffect } from 'react';
import { 
  PackageCheck, 
  Barcode, 
  Scan, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Boxes, 
  Layers, 
  Clock, 
  Truck, 
  Maximize2,
  RefreshCw,
  Printer,
  RotateCcw,
  Check,
  AlertTriangle,
  X,
  FileSpreadsheet,
  Calendar,
  ExternalLink,
  MapPin,
  Tag,
  Undo2,
  Camera,
  Image as ImageIcon,
  Upload,
  FileText,
  ShieldAlert,
  UserCheck,
  Eye,
  CheckCheck,
  FileDown,
  Scale,
  TrendingUp,
  BarChart2,
  Sliders
} from 'lucide-react';
import { api } from '../services/api';
import EntityBrandBadge from './common/EntityBrandBadge';
import { useHardwareBarcodeSniffer } from '../hooks/useHardwareBarcodeSniffer';

const fmtINR = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ScanAndPackScreen({ currentUser }) {
  // Operational Modes: 'PACK' (Outward Dispatch), 'DELIVERY' (Delivered Tracking), 'RETURN' (Inward RTO/Return)
  const [scanMode, setScanMode] = useState('PACK');
  
  const [scanInput, setScanInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Currently Active Scanned Order
  const [activeOrder, setActiveOrder] = useState(null);

  // ── ⚖️ Digital Weighing Scale & Weight Discrepancy Guard ────────────────
  const [parcelWeight, setParcelWeight] = useState('350'); // in grams
  const [returnWeight, setReturnWeight] = useState('');

  // ── 📸 Return Processing & SPF Claim Evidence ──────────────────────────
  const [returnCondition, setReturnCondition] = useState('INTACT');
  const [returnType, setReturnType] = useState('RTO');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnImages, setReturnImages] = useState([]);
  const [claimAmount, setClaimAmount] = useState(0);
  const [claimId, setClaimId] = useState('');
  const [claimNotes, setClaimNotes] = useState('');
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);

  // Return Claim Detail Modal
  const [selectedClaimRecord, setSelectedClaimRecord] = useState(null);
  const [savingClaim, setSavingClaim] = useState(false);

  // ── 📋 Daily Courier Pickup Manifest Generator ──────────────────────────
  const [showManifestModal, setShowManifestModal] = useState(false);
  const [manifestDate, setManifestDate] = useState(new Date().toISOString().slice(0, 10));
  const [manifestCourier, setManifestCourier] = useState('ALL');
  const [manifestPendingData, setManifestPendingData] = useState(null);
  const [manifestDriverName, setManifestDriverName] = useState('');
  const [manifestDriverPhone, setManifestDriverPhone] = useState('');
  const [manifestVehicleNumber, setManifestVehicleNumber] = useState('');
  const [manifestTab, setManifestTab] = useState('PENDING'); // 'PENDING' | 'HISTORY'
  const [pastManifests, setPastManifests] = useState([]);
  const [activePrintManifest, setActivePrintManifest] = useState(null);

  // ── 📊 Bulk Delivery MIS Importer ──────────────────────────────────────
  const [showBulkDeliveryModal, setShowBulkDeliveryModal] = useState(false);
  const [bulkAwbText, setBulkAwbText] = useState('');
  const [bulkDeliveryDate, setBulkDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  // ── 📈 Courier Analytics Dashboard Modal ───────────────────────────────
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // ── 🏷️ Barcode Thermal Label Printing Modal ────────────────────────────
  const [showBarcodeTagModal, setShowBarcodeTagModal] = useState(false);
  const [barcodeTagData, setBarcodeTagData] = useState({
    sku: 'AC22111_M',
    brand: 'SOBISE',
    itemName: 'Designer Kurta Set',
    size: 'M',
    color: 'Teal Green',
    mrp: 1499,
    barcode: 'MYSC1359190430'
  });

  // Scanned history list & Stats
  const [scanHistory, setScanHistory] = useState([]);
  const [stats, setStats] = useState({
    dispatchedToday: 0,
    deliveredToday: 0,
    returnedToday: 0
  });

  const [hardwareDetected, setHardwareDetected] = useState(false);
  const inputRef = useRef(null);

  // Focus input automatically
  const focusInput = () => {
    if (inputRef.current) inputRef.current.focus();
  };

  useEffect(() => {
    focusInput();
    fetchStats();
  }, [scanMode]);

  // Hook up hardware barcode sniffer (e.g. USB or wireless laser scanner)
  useHardwareBarcodeSniffer((event) => {
    if (event?.code) {
      setHardwareDetected(true);
      handleProcessScan(event.code, 'Hardware Laser Scanner');
    }
  });

  const fetchStats = async () => {
    try {
      const res = await api.getScanPackHistory();
      if (res && res.success && res.stats) {
        setStats(res.stats);
      }
    } catch (e) {
      console.warn('Failed to fetch scan pack stats:', e);
    }
  };

  // Play audio feedback for fast factory floor verification
  const playAudioCue = (type = 'success') => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === 'step') {
        osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else {
        // High alert buzzer for wrong item mismatch or suspicious empty box
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.setValueAtTime(100, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      }
    } catch (err) {
      // AudioContext may be restricted by browser policy if no interaction
    }
  };

  // ── Main Processing Pipeline (Single AWB Direct Scan) ──────────────────────
  const handleProcessScan = async (codeToProcess, source = 'Manual Input') => {
    const trimmed = (codeToProcess || '').trim();
    if (!trimmed) return;

    setErrorMsg('');
    setSuccessMsg('');

    // ──────────────────────────────────────────────────────────────────────────
    // Direct AWB Scan (PACK, DELIVERY, or RETURN)
    // ──────────────────────────────────────────────────────────────────────────
    setLoading(true);
    try {
      const lookupRes = await api.lookupAwb(trimmed);
      if (!lookupRes || !lookupRes.success) {
        throw new Error(lookupRes?.error || 'Failed to lookup AWB code');
      }

      const orderData = lookupRes.data;
      setActiveOrder(orderData);
      setClaimAmount(orderData.price || 0);

      // Auto setup barcode print data
      setBarcodeTagData({
        sku: orderData.itemSKUCode,
        brand: 'SOBISE',
        itemName: orderData.itemName,
        size: orderData.size || 'M',
        color: orderData.color || '',
        mrp: orderData.mrp || 1499,
        barcode: trimmed
      });

      if (scanMode === 'PACK') {
        const numericWeight = Number(parcelWeight) || 0;
        await api.packAwbOrder({
          awb: trimmed,
          displayOrderCode: orderData.displayOrderCode,
          sku: orderData.itemSKUCode,
          courier: orderData.courier,
          weightGrams: numericWeight
        });

        playAudioCue('success');
        setSuccessMsg(`✅ AWB ${trimmed} verified & packed! Dispatched date automatically stamped (${numericWeight > 0 ? `${numericWeight}g` : 'Standard'}).`);
        
        const historyEntry = {
          id: Date.now(),
          awb: trimmed,
          orderCode: orderData.displayOrderCode,
          sku: orderData.itemSKUCode,
          courier: orderData.courier,
          weightGrams: numericWeight,
          mode: 'PACK',
          status: 'DISPATCHED',
          time: new Date().toLocaleTimeString('en-IN'),
          date: new Date().toLocaleDateString('en-IN')
        };
        setScanHistory(prev => [historyEntry, ...prev.slice(0, 49)]);
        fetchStats();

      } else if (scanMode === 'DELIVERY') {
        await api.markAwbDelivered({
          awb: trimmed,
          deliveryDate: new Date().toISOString()
        });

        playAudioCue('success');
        setSuccessMsg(`🚚 AWB ${trimmed} marked as DELIVERED! Delivery date automatically recorded.`);

        const historyEntry = {
          id: Date.now(),
          awb: trimmed,
          orderCode: orderData.displayOrderCode,
          sku: orderData.itemSKUCode,
          courier: orderData.courier,
          mode: 'DELIVERY',
          status: 'DELIVERED',
          time: new Date().toLocaleTimeString('en-IN'),
          date: new Date().toLocaleDateString('en-IN')
        };
        setScanHistory(prev => [historyEntry, ...prev.slice(0, 49)]);
        fetchStats();

      } else if (scanMode === 'RETURN') {
        playAudioCue('success');
        setSuccessMsg(`📦 Return parcel detected for Order #${orderData.displayOrderCode} (${orderData.itemSKUCode}). Select condition & upload evidence below.`);
      }

    } catch (err) {
      playAudioCue('error');
      setErrorMsg(err.message || 'Error processing AWB scan');
    } finally {
      setLoading(false);
      setScanInput('');
      focusInput();
    }
  };

  // ── 📸 Webcam Capture Helpers ─────────────────────────────────────────────
  const startCamera = async () => {
    setShowCameraModal(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      alert('Unable to access station camera: ' + err.message);
      setShowCameraModal(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCameraModal(false);
  };

  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setReturnImages(prev => [...prev, dataUrl]);
    stopCamera();
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setReturnImages(prev => [...prev, ev.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  // ── Submit Return Process with Photos & SPF Claims ────────────────────────
  const handleConfirmReturn = async () => {
    if (!activeOrder?.awb) return;

    setLoading(true);
    try {
      const isDamagedOrWrong = returnCondition === 'DAMAGED' || returnCondition === 'WRONG_ITEM';
      const numericReturnWeight = Number(returnWeight) || 0;

      const res = await api.processAwbReturn({
        awb: activeOrder.awb,
        displayOrderId: activeOrder.displayOrderCode,
        sku: activeOrder.itemSKUCode,
        returnType,
        condition: returnCondition,
        notes: returnNotes,
        quantity: 1,
        images: returnImages,
        claimStatus: isDamagedOrWrong ? 'CLAIM_PENDING' : 'NOT_APPLICABLE',
        claimAmount: isDamagedOrWrong ? (Number(claimAmount) || activeOrder.price || 0) : 0,
        claimId: claimId || '',
        claimNotes: claimNotes || '',
        weightGrams: numericReturnWeight
      });

      if (res && res.success) {
        playAudioCue('success');
        setSuccessMsg(`🔄 Return processed for ${activeOrder.awb}! ${res.stockUpdated ? 'Stock automatically incremented (+1).' : ''}`);
        
        const historyEntry = {
          id: Date.now(),
          awb: activeOrder.awb,
          orderCode: activeOrder.displayOrderCode,
          sku: activeOrder.itemSKUCode,
          courier: activeOrder.courier,
          mode: 'RETURN',
          status: returnCondition === 'INTACT' ? 'RESTOCKED (+1)' : 'RETURN_DISPUTE',
          hasPhotos: returnImages.length > 0,
          weightGrams: numericReturnWeight,
          returnDoc: res.data,
          time: new Date().toLocaleTimeString('en-IN'),
          date: new Date().toLocaleDateString('en-IN')
        };
        setScanHistory(prev => [historyEntry, ...prev.slice(0, 49)]);
        setActiveOrder(null);
        setReturnNotes('');
        setReturnImages([]);
        setClaimId('');
        setClaimNotes('');
        setReturnWeight('');
        fetchStats();
      } else {
        alert(res?.error || 'Failed to process return');
      }
    } catch (e) {
      alert(e.message || 'Error processing return');
    } finally {
      setLoading(false);
      focusInput();
    }
  };

  // ── 📋 Courier Manifest Handover Helpers ──────────────────────────────────
  const openManifestModal = async () => {
    setShowManifestModal(true);
    setManifestTab('PENDING');
    fetchManifestPending();
  };

  const fetchManifestPending = async () => {
    try {
      const res = await api.getManifestPending({ date: manifestDate, courier: manifestCourier });
      if (res && res.success) {
        setManifestPendingData(res);
      }
    } catch (e) {
      console.warn('Error fetching pending manifest:', e);
    }
  };

  const fetchPastManifests = async () => {
    try {
      const res = await api.getManifestList();
      if (res && res.success) {
        setPastManifests(res.data || []);
      }
    } catch (e) {
      console.warn('Error fetching past manifests:', e);
    }
  };

  const handleGenerateManifest = async (courierName, packages) => {
    if (!packages || !packages.length) {
      alert('No packages available for this courier');
      return;
    }
    if (!manifestDriverName.trim()) {
      alert('Please enter Pickup Driver Name for handover authorization');
      return;
    }

    try {
      const res = await api.generateManifest({
        courier: courierName,
        driverName: manifestDriverName,
        driverPhone: manifestDriverPhone,
        vehicleNumber: manifestVehicleNumber,
        packages
      });

      if (res && res.success) {
        alert(`✅ Handover Manifest ${res.data.manifestId} created! Opening print preview...`);
        setActivePrintManifest(res.data);
        fetchManifestPending();
      } else {
        alert(res?.error || 'Failed to generate manifest');
      }
    } catch (e) {
      alert(e.message || 'Error generating manifest');
    }
  };

  // ── 📊 Bulk Delivery MIS Importer ─────────────────────────────────────────
  const handleBulkDeliverSubmit = async () => {
    const rawLines = bulkAwbText.split(/[\r\n,;]+/).map(s => s.trim()).filter(Boolean);
    const uniqueAwbs = [...new Set(rawLines)];

    if (!uniqueAwbs.length) {
      alert('Please paste at least one AWB code');
      return;
    }

    setBulkProcessing(true);
    setBulkResult(null);
    try {
      const res = await api.bulkMarkAwbDelivered({
        awbs: uniqueAwbs,
        deliveryDate: bulkDeliveryDate
      });

      if (res && res.success) {
        playAudioCue('success');
        setBulkResult(res);
        fetchStats();
      } else {
        alert(res?.error || 'Failed to process bulk delivery');
      }
    } catch (e) {
      alert(e.message || 'Error processing bulk delivery');
    } finally {
      setBulkProcessing(false);
    }
  };

  // ── 📈 Fetch Courier Analytics ────────────────────────────────────────────
  const openAnalytics = async () => {
    setShowAnalyticsModal(true);
    setAnalyticsLoading(true);
    try {
      const res = await api.getCourierAnalytics();
      if (res && res.success) {
        setAnalyticsData(res);
      }
    } catch (e) {
      console.warn('Failed to fetch courier analytics:', e);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // ── Save Claim Details Update ─────────────────────────────────────────────
  const handleSaveClaimDetails = async () => {
    if (!selectedClaimRecord?._id) return;
    setSavingClaim(true);
    try {
      const res = await api.updateReturnClaim(selectedClaimRecord._id, {
        claimStatus: selectedClaimRecord.claimStatus,
        claimId: selectedClaimRecord.claimId,
        claimAmount: selectedClaimRecord.claimAmount,
        claimNotes: selectedClaimRecord.claimNotes
      });
      if (res && res.success) {
        alert('✅ SPF Claim details updated successfully!');
        setSelectedClaimRecord(null);
      }
    } catch (e) {
      alert(e.message || 'Failed to update claim');
    } finally {
      setSavingClaim(false);
    }
  };

  // Handle Manual Form Submit
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    handleProcessScan(scanInput, 'Manual Entry');
  };

  return (
    <div className="scan-and-pack-screen" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', minHeight: '100%' }}>
      
      {/* 👑 Top Header Banner */}
      <div className="glass-panel" style={{
        padding: '1.25rem 1.75rem',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.95))',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.3), rgba(99, 102, 241, 0.3))',
            border: '1px solid rgba(14, 165, 233, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8'
          }}>
            <PackageCheck size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '700', color: '#ffffff', letterSpacing: '-0.02em' }}>
                Scan & Pack Hub
              </h2>
              <EntityBrandBadge entityId="elite_online" />
            </div>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
              AWB Tracking, Double-Scan Zero Error Check, Weight Scale Guard & Courier Manifest Handover
            </p>
          </div>
        </div>

        {/* Action Buttons: Manifest, Analytics, Barcode Tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>

          {/* Courier Handover Manifest Button */}
          <button
            type="button"
            onClick={openManifestModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.45rem 0.9rem',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(14,165,233,0.3)'
            }}
          >
            <FileSpreadsheet size={15} />
            <span>Daily Manifest</span>
          </button>

          {/* Courier Performance Analytics */}
          <button
            type="button"
            onClick={openAnalytics}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.45rem 0.9rem',
              borderRadius: '8px',
              background: 'rgba(168, 85, 247, 0.2)',
              border: '1px solid #a855f7',
              color: '#c084fc',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <BarChart2 size={15} />
            <span>Courier Analytics</span>
          </button>

          {/* Bulk Delivery MIS Importer */}
          <button
            type="button"
            onClick={() => { setShowBulkDeliveryModal(true); setBulkResult(null); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.45rem 0.9rem',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid #10b981',
              color: '#34d399',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <CheckCheck size={15} />
            <span>Bulk Delivery</span>
          </button>

          {/* Barcode Tag Print */}
          <button
            type="button"
            onClick={() => setShowBarcodeTagModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.45rem 0.9rem',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Tag size={15} />
            <span>Tag Printer</span>
          </button>

          {/* Hardware Scanner Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.45rem 0.9rem',
            borderRadius: '999px',
            background: hardwareDetected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(14, 165, 233, 0.15)',
            border: `1px solid ${hardwareDetected ? 'rgba(34, 197, 94, 0.35)' : 'rgba(14, 165, 233, 0.3)'}`,
            fontSize: '0.75rem',
            fontWeight: 700,
            color: hardwareDetected ? '#4ade80' : '#38bdf8'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: hardwareDetected ? '#22c55e' : '#0ea5e9',
              boxShadow: hardwareDetected ? '0 0 10px #22c55e' : '0 0 8px #0ea5e9'
            }} />
            <span>{hardwareDetected ? 'Laser Active' : 'Ready'}</span>
          </div>

          <button 
            type="button"
            onClick={() => {
              setActiveOrder(null);
              setErrorMsg('');
              setSuccessMsg('');
              focusInput();
            }}
            title="Clear Workspace"
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#94a3b8',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* 📊 3 KPI Stat Counters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
        
        {/* Metric 1: Dispatched Today */}
        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #0ea5e9', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Packed & Dispatched Today
            </span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#0ea5e915', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Truck size={15} color="#0ea5e9" />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0ea5e9' }}>
            {stats.dispatchedToday}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Auto-Dated & Weight Stamped</span>
        </div>

        {/* Metric 2: Delivered Today */}
        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #10b981', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Delivered Shipments
            </span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#10b98115', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={15} color="#10b981" />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981' }}>
            {stats.deliveredToday}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>Confirmed Deliveries</span>
        </div>

        {/* Metric 3: Returns Processed */}
        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #f43f5e', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Returns / RTOs Inward
            </span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f43f5e15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RotateCcw size={15} color="#f43f5e" />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f43f5e' }}>
            {stats.returnedToday}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#f43f5e', fontWeight: 600 }}>QC & Empty Box Guarded</span>
        </div>

      </div>

      {/* 🚀 Mode Switcher & Scanner Terminal */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(15,23,42,0.04)' }}>
        
        {/* Mode Selector Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Select Operational Mode
            </span>
            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
              Choose whether you are dispatching new orders, tracking deliveries, or processing incoming return parcels.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
            
            {/* Mode 1: Pack Outward */}
            <button
              type="button"
              onClick={() => { setScanMode('PACK'); focusInput(); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.55rem 1.1rem',
                borderRadius: '8px',
                border: 'none',
                background: scanMode === 'PACK' ? 'linear-gradient(135deg, #0ea5e9, #0284c7)' : 'transparent',
                color: scanMode === 'PACK' ? '#ffffff' : '#475569',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: scanMode === 'PACK' ? '0 2px 8px rgba(14,165,233,0.3)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Truck size={15} />
              <span>1. Scan to Pack & Dispatch</span>
            </button>

            {/* Mode 2: Delivery Tracker */}
            <button
              type="button"
              onClick={() => { setScanMode('DELIVERY'); focusInput(); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.55rem 1.1rem',
                borderRadius: '8px',
                border: 'none',
                background: scanMode === 'DELIVERY' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                color: scanMode === 'DELIVERY' ? '#ffffff' : '#475569',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: scanMode === 'DELIVERY' ? '0 2px 8px rgba(16,185,129,0.3)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <CheckCircle2 size={15} />
              <span>2. Delivery Confirmation</span>
            </button>

            {/* Mode 3: Inward Return / RTO */}
            <button
              type="button"
              onClick={() => { setScanMode('RETURN'); focusInput(); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.55rem 1.1rem',
                borderRadius: '8px',
                border: 'none',
                background: scanMode === 'RETURN' ? 'linear-gradient(135deg, #f43f5e, #be123c)' : 'transparent',
                color: scanMode === 'RETURN' ? '#ffffff' : '#475569',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: scanMode === 'RETURN' ? '0 2px 8px rgba(244,63,94,0.3)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <RotateCcw size={15} />
              <span>3. Scan Return / RTO Inward</span>
            </button>

          </div>
        </div>


        {/* ⚖️ Weighing Scale Check Widget */}
        {scanMode === 'PACK' && (
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Scale size={18} color="#0ea5e9" />
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>
                Parcel Weight (Grams):
              </span>
              <input
                type="number"
                placeholder="350"
                value={parcelWeight}
                onChange={(e) => setParcelWeight(e.target.value)}
                style={{
                  width: '90px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: Number(parcelWeight) > 0 && Number(parcelWeight) < 120 ? '2px solid #f59e0b' : '1px solid #cbd5e1',
                  fontWeight: 800,
                  fontSize: '0.85rem'
                }}
              />
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>g</span>

              {Number(parcelWeight) > 0 && Number(parcelWeight) < 120 && (
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '4px' }}>
                  ⚠️ Low weight (&lt;120g). Check if all items are inside box!
                </span>
              )}
            </div>

            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Presets:</span>
              {['300', '380', '500', '1000'].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setParcelWeight(w)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: parcelWeight === w ? '#0ea5e9' : '#fff',
                    color: parcelWeight === w ? '#fff' : '#475569',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {w}g
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 🎯 High-Visibility AWB Scan Input Box */}
        <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Scan size={22} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#0ea5e9' }} />
            <input
              ref={inputRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder={
                scanMode === 'PACK' 
                  ? "Scan or enter Courier AWB to Pack & Dispatch (e.g. MYSC1359190430)..."
                  : scanMode === 'DELIVERY'
                  ? "Scan AWB to mark Delivered (e.g. MYSC1359190430)..."
                  : "Scan incoming Return / RTO parcel AWB (e.g. MYSC1359190430)..."
              }
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.9rem 1rem 0.9rem 3rem',
                fontSize: '1.05rem',
                fontWeight: 700,
                borderRadius: '12px',
                border: '2px solid #0ea5e9',
                background: '#f8fafc',
                color: '#0f172a',
                boxShadow: '0 4px 12px rgba(14,165,233,0.1)',
                outline: 'none',
                letterSpacing: '0.02em'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !scanInput.trim()}
            style={{
              background: scanMode === 'PACK' ? '#0ea5e9' : scanMode === 'DELIVERY' ? '#10b981' : '#f43f5e',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '0 1.75rem',
              fontSize: '0.95rem',
              fontWeight: 800,
              cursor: loading || !scanInput.trim() ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            {loading ? <RefreshCw size={18} className="spin-loader" /> : <Barcode size={18} />}
            <span>Process Scan</span>
          </button>
        </form>

        {/* Notifications & Feedback */}
        {successMsg && (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="#10b981" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} color="#ef4444" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 📦 Active Order Inspection Card (When AWB is scanned) */}
        {activeOrder && (
          <div style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {activeOrder.productImage ? (
                  <img
                    src={activeOrder.productImage}
                    alt={activeOrder.itemSKUCode}
                    style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', border: '1px solid #e2e8f0' }}
                  />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: 8, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                    <Boxes size={28} />
                  </div>
                )}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                      AWB: {activeOrder.awb}
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                      {activeOrder.courier}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowBarcodeTagModal(true)}
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Tag size={12} />
                      <span>Print Garment Tag</span>
                    </button>
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginTop: '2px' }}>
                    {activeOrder.itemName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '12px', marginTop: '3px' }}>
                    <span>SKU: <strong>{activeOrder.itemSKUCode}</strong></span>
                    {activeOrder.size && <span>Size: <strong>{activeOrder.size}</strong></span>}
                    {activeOrder.color && <span>Color: <strong>{activeOrder.color}</strong></span>}
                    {activeOrder.price > 0 && <span>Value: <strong>{fmtINR(activeOrder.price)}</strong></span>}
                    {activeOrder.weightGrams > 0 && <span>Weight: <strong>{activeOrder.weightGrams}g</strong></span>}
                  </div>
                </div>
              </div>

              {/* Destination & Order Tag */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                  Order: #{activeOrder.displayOrderCode}
                </div>
                {activeOrder.city && (
                  <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px', marginTop: '3px' }}>
                    <MapPin size={12} /> {activeOrder.city}, {activeOrder.state} ({activeOrder.pincode})
                  </div>
                )}
              </div>
            </div>

            {/* Lifecycle Auto-Date Timestamps */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', background: '#ffffff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.75rem' }}>
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>Order Date:</span>
                <strong style={{ color: '#0f172a' }}>
                  {activeOrder.orderDate ? new Date(activeOrder.orderDate).toLocaleString('en-IN') : 'N/A'}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>Dispatch Date:</span>
                <strong style={{ color: '#0ea5e9' }}>
                  {activeOrder.dispatchDate ? new Date(activeOrder.dispatchDate).toLocaleString('en-IN') : 'Stamped on Scan'}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>Delivery Date:</span>
                <strong style={{ color: '#10b981' }}>
                  {activeOrder.deliveryTime ? new Date(activeOrder.deliveryTime).toLocaleString('en-IN') : 'In-Transit'}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>Return Date:</span>
                <strong style={{ color: '#f43f5e' }}>
                  {activeOrder.returnDate ? new Date(activeOrder.returnDate).toLocaleString('en-IN') : 'Not Returned'}
                </strong>
              </div>
            </div>

            {/* Return QC Controls & Photo Evidence (If Mode === RETURN) */}
            {scanMode === 'RETURN' && (
              <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#be123c', textTransform: 'uppercase' }}>
                  Return Quality Control & Inward Restock
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                  
                  <button
                    type="button"
                    onClick={() => setReturnCondition('INTACT')}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: returnCondition === 'INTACT' ? '2px solid #10b981' : '1px solid #cbd5e1',
                      background: returnCondition === 'INTACT' ? '#ecfdf5' : '#ffffff',
                      color: returnCondition === 'INTACT' ? '#065f46' : '#334155',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                  >
                    🟢 Intact (Restock +1)
                  </button>

                  <button
                    type="button"
                    onClick={() => setReturnCondition('NEEDS_REFINISHING')}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: returnCondition === 'NEEDS_REFINISHING' ? '2px solid #f59e0b' : '1px solid #cbd5e1',
                      background: returnCondition === 'NEEDS_REFINISHING' ? '#fef3c7' : '#ffffff',
                      color: returnCondition === 'NEEDS_REFINISHING' ? '#92400e' : '#334155',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                  >
                    🟡 Needs Refinishing
                  </button>

                  <button
                    type="button"
                    onClick={() => setReturnCondition('DAMAGED')}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: returnCondition === 'DAMAGED' ? '2px solid #ef4444' : '1px solid #cbd5e1',
                      background: returnCondition === 'DAMAGED' ? '#fee2e2' : '#ffffff',
                      color: returnCondition === 'DAMAGED' ? '#991b1b' : '#334155',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                  >
                    🔴 Damaged / SPF Claim
                  </button>

                  <button
                    type="button"
                    onClick={() => setReturnCondition('WRONG_ITEM')}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: returnCondition === 'WRONG_ITEM' ? '2px solid #ef4444' : '1px solid #cbd5e1',
                      background: returnCondition === 'WRONG_ITEM' ? '#fee2e2' : '#ffffff',
                      color: returnCondition === 'WRONG_ITEM' ? '#991b1b' : '#334155',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                  >
                    ❌ Wrong Item Return
                  </button>
                </div>

                {/* ⚖️ Return Weight Scale Inspection & Empty Box Guard */}
                <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #fecaca', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <Scale size={16} color="#be123c" />
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#991b1b' }}>
                      Weigh Returned Box (Grams):
                    </span>
                    <input
                      type="number"
                      placeholder="e.g. 350"
                      value={returnWeight}
                      onChange={(e) => setReturnWeight(e.target.value)}
                      style={{ width: '80px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>g</span>

                    {activeOrder.weightGrams > 0 && (
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        (Dispatched at: <strong>{activeOrder.weightGrams}g</strong>)
                      </span>
                    )}

                    {/* Empty Box Discrepancy Alert */}
                    {Number(returnWeight) > 0 && activeOrder.weightGrams > 200 && Number(returnWeight) < 120 && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#ffffff', background: '#ef4444', padding: '2px 8px', borderRadius: '4px' }}>
                        🚨 EMPTY BOX SUSPECTED! Weight is under 120g! File SPF Claim!
                      </span>
                    )}
                  </div>
                </div>

                {/* 📸 Photo Proof Capture for Damaged / Wrong Items */}
                {(returnCondition === 'DAMAGED' || returnCondition === 'WRONG_ITEM' || returnCondition === 'NEEDS_REFINISHING') && (
                  <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #fecaca', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#991b1b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Camera size={14} /> Photo Proof for SPF Claim ({returnImages.length} attached)
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={startCamera}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: '#0ea5e9',
                            color: '#fff',
                            border: 'none',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <Camera size={12} />
                          <span>Webcam Snapshot</span>
                        </button>

                        <label style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background: '#475569',
                          color: '#fff',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}>
                          <Upload size={12} />
                          <span>Upload File</span>
                          <input type="file" accept="image/*" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
                        </label>
                      </div>
                    </div>

                    {/* Image Preview Thumbnails */}
                    {returnImages.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '4px 0' }}>
                        {returnImages.map((img, idx) => (
                          <div key={idx} style={{ position: 'relative', width: 50, height: 50, flexShrink: 0 }}>
                            <img src={img} alt={`Proof ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                            <button
                              type="button"
                              onClick={() => setReturnImages(prev => prev.filter((_, i) => i !== idx))}
                              style={{
                                position: 'absolute',
                                top: -4,
                                right: -4,
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                background: '#ef4444',
                                color: '#fff',
                                border: 'none',
                                fontSize: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Claim Details Input */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '6px', marginTop: '2px' }}>
                      <input
                        type="number"
                        placeholder="Claim Amount (₹)"
                        value={claimAmount}
                        onChange={(e) => setClaimAmount(e.target.value)}
                        style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                      />
                      <input
                        type="text"
                        placeholder="Myntra / Portal Claim Ticket ID (optional)"
                        value={claimId}
                        onChange={(e) => setClaimId(e.target.value)}
                        style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                      />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Inspection remarks / cloth defect description..."
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    style={{ flex: 1, padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  />

                  <button
                    type="button"
                    onClick={handleConfirmReturn}
                    disabled={loading}
                    style={{
                      background: '#be123c',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0.5rem 1.25rem',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Confirm Return & Restock
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* 📋 Live Scans Activity History Register */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={16} color="#0ea5e9" />
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
              Today's Scanned Operations Log
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {scanHistory.length} scan records in session
          </span>
        </div>

        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Time</th>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>AWB Code</th>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Order ID</th>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>SKU</th>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Weight</th>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Courier</th>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Mode</th>
                <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'center' }}>Status</th>
                <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'center' }}>SPF Action</th>
              </tr>
            </thead>
            <tbody>
              {scanHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                    <Scan size={24} style={{ margin: '0 auto 6px', color: '#cbd5e1' }} />
                    <div>No AWB codes scanned yet in this session.</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Scan or type an AWB like <strong>MYSC1359190430</strong> above.</div>
                  </td>
                </tr>
              ) : (
                scanHistory.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '0.76rem' }}>{item.time}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0ea5e9' }}>{item.awb}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{item.orderCode}</td>
                    <td style={{ padding: '10px 14px', color: '#334155' }}>{item.sku}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '0.76rem' }}>
                      {item.weightGrams ? `${item.weightGrams}g` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{item.courier}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: item.mode === 'PACK' ? '#eff6ff' : item.mode === 'DELIVERY' ? '#ecfdf5' : '#fff1f2', color: item.mode === 'PACK' ? '#0284c7' : item.mode === 'DELIVERY' ? '#059669' : '#be123c' }}>
                        {item.mode}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: item.status.includes('RESTOCK') ? '#ecfdf5' : item.status.includes('PACK') ? '#eff6ff' : '#fff1f2', color: item.status.includes('RESTOCK') ? '#059669' : item.status.includes('PACK') ? '#0284c7' : '#be123c', border: '1px solid rgba(0,0,0,0.06)' }}>
                        {item.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      {item.returnDoc ? (
                        <button
                          type="button"
                          onClick={() => setSelectedClaimRecord(item.returnDoc)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <Eye size={12} />
                          <span>SPF Dossier</span>
                          {item.hasPhotos && <Camera size={11} color="#0284c7" />}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setBarcodeTagData({
                              sku: item.sku,
                              brand: 'SOBISE',
                              itemName: 'Garment / Apparel',
                              size: 'M',
                              color: '',
                              mrp: 1499,
                              barcode: item.awb
                            });
                            setShowBarcodeTagModal(true);
                          }}
                          title="Print Barcode Tag"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#64748b',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}
                        >
                          <Tag size={13} />
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


      {/* ────────────────────────────────────────────────────────────────────────
          MODAL 2: 📸 Station Webcam Shutter
      ──────────────────────────────────────────────────────────────────────── */}
      {showCameraModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{ background: '#1e293b', borderRadius: '16px', overflow: 'hidden', maxWidth: '640px', width: '100%', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.9rem' }}>
                Station Camera — Snap Return Defect / Wrong Item
              </span>
              <button type="button" onClick={stopCamera} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ position: 'relative', width: '100%', height: '360px', background: '#000' }}>
              <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center', gap: '1rem', background: '#0f172a' }}>
              <button
                type="button"
                onClick={captureSnapshot}
                style={{
                  background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '0.65rem 1.75rem',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <Camera size={18} />
                <span>Capture Shutter</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          MODAL 3: 📋 Daily Courier Handover Manifest
      ──────────────────────────────────────────────────────────────────────── */}
      {showManifestModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '850px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#0ea5e915', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9' }}>
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                    Daily Courier Pickup Handover Manifest
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Official run-sheet for Ekart, Delhivery, Blue Dart & Shadowfax pickup vans
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setShowManifestModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '0.85rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => { setManifestTab('PENDING'); fetchManifestPending(); }}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: manifestTab === 'PENDING' ? '#0ea5e9' : '#e2e8f0',
                    color: manifestTab === 'PENDING' ? '#fff' : '#475569',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Ready for Handover
                </button>
                <button
                  type="button"
                  onClick={() => { setManifestTab('HISTORY'); fetchPastManifests(); }}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: manifestTab === 'HISTORY' ? '#0ea5e9' : '#e2e8f0',
                    color: manifestTab === 'HISTORY' ? '#fff' : '#475569',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Past Generated Manifests
                </button>
              </div>

              {manifestTab === 'PENDING' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="date"
                    value={manifestDate}
                    onChange={(e) => setManifestDate(e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                  />
                  <select
                    value={manifestCourier}
                    onChange={(e) => setManifestCourier(e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                  >
                    <option value="ALL">All Logistics Partners</option>
                    <option value="Flipkart">Flipkart Logistics / Ekart</option>
                    <option value="Delhivery">Delhivery</option>
                    <option value="Blue Dart">Blue Dart</option>
                    <option value="Shadowfax">Shadowfax</option>
                    <option value="Xpressbees">Xpressbees</option>
                  </select>
                  <button
                    type="button"
                    onClick={fetchManifestPending}
                    style={{ padding: '4px 8px', borderRadius: '6px', background: '#0ea5e9', color: '#fff', border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Filter
                  </button>
                </div>
              )}
            </div>

            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {manifestTab === 'PENDING' ? (
                <>
                  <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '2px' }}>
                        Pickup Driver Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Ramesh Kumar"
                        value={manifestDriverName}
                        onChange={(e) => setManifestDriverName(e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '2px' }}>
                        Driver Mobile No
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 9876543210"
                        value={manifestDriverPhone}
                        onChange={(e) => setManifestDriverPhone(e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '2px' }}>
                        Vehicle / Van Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. GJ-05-XX-1234"
                        value={manifestVehicleNumber}
                        onChange={(e) => setManifestVehicleNumber(e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                      />
                    </div>
                  </div>

                  {!manifestPendingData || manifestPendingData.groups?.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                      No dispatched packages found for handover on this date.
                    </div>
                  ) : (
                    manifestPendingData.groups.map((grp, idx) => (
                      <div key={idx} style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                              {grp.courier}
                            </span>
                            <span style={{ marginLeft: '10px', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#eff6ff', color: '#2563eb' }}>
                              {grp.count} Parcels Ready
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleGenerateManifest(grp.courier, grp.orders)}
                            style={{
                              background: '#0ea5e9',
                              color: '#fff',
                              border: 'none',
                              padding: '6px 14px',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Printer size={13} />
                            <span>Generate & Print Run-Sheet</span>
                          </button>
                        </div>

                        <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '6px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', color: '#64748b' }}>
                                <th style={{ padding: '6px 8px', textAlign: 'left' }}>AWB Code</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Order ID</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left' }}>SKU</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left' }}>City</th>
                              </tr>
                            </thead>
                            <tbody>
                              {grp.orders.map((o, oIdx) => (
                                <tr key={oIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0ea5e9' }}>{o.awb}</td>
                                  <td style={{ padding: '6px 8px' }}>#{o.displayOrderCode}</td>
                                  <td style={{ padding: '6px 8px' }}>{o.sku}</td>
                                  <td style={{ padding: '6px 8px', color: '#64748b' }}>{o.city || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))
                  )}
                </>
              ) : (
                pastManifests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    No past manifests saved yet.
                  </div>
                ) : (
                  pastManifests.map((mnf) => (
                    <div key={mnf._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0ea5e9' }}>
                          {mnf.manifestId} — {mnf.courier}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                          Driver: {mnf.pickupDriverName || 'N/A'} ({mnf.pickupDriverPhone || 'No Phone'}) | Packages: {mnf.totalPackages} | Date: {new Date(mnf.createdAt).toLocaleString('en-IN')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActivePrintManifest(mnf)}
                        style={{ padding: '4px 10px', borderRadius: '4px', background: '#0ea5e9', color: '#fff', border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Printer size={12} />
                        <span>Print</span>
                      </button>
                    </div>
                  ))
                )
              )}

            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          MODAL 4: 📊 Bulk Delivery MIS Excel Importer
      ──────────────────────────────────────────────────────────────────────── */}
      {showBulkDeliveryModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '560px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#10b98115', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                  <CheckCheck size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                    Bulk Carrier Delivery MIS Importer
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Mark 100+ AWBs as Delivered in 1 second from Logistics Excel sheet
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setShowBulkDeliveryModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Delivery Date to Stamp
                </label>
                <input
                  type="date"
                  value={bulkDeliveryDate}
                  onChange={(e) => setBulkDeliveryDate(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Paste AWB Codes (One per line or comma-separated)
                </label>
                <textarea
                  rows={8}
                  placeholder="MYSC1359190430&#10;MYSC1359190431&#10;MYSC1359190432&#10;..."
                  value={bulkAwbText}
                  onChange={(e) => setBulkAwbText(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontFamily: 'monospace' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: '2px' }}>
                  {bulkAwbText.split(/[\r\n,;]+/).filter(s => s.trim()).length} unique codes detected
                </span>
              </div>

              {bulkResult && (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '0.75rem', borderRadius: '8px', color: '#065f46', fontSize: '0.82rem', fontWeight: 700 }}>
                  {bulkResult.message}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowBulkDeliveryModal(false)}
                  style={{ padding: '0.6rem 1rem', borderRadius: '8px', background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkDeliverSubmit}
                  disabled={bulkProcessing || !bulkAwbText.trim()}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: bulkProcessing || !bulkAwbText.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {bulkProcessing ? <RefreshCw size={14} className="spin-loader" /> : <CheckCheck size={14} />}
                  <span>Execute Bulk Delivery Update</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          MODAL 5: 📈 Courier Performance & RTO Rate Analytics Modal
      ──────────────────────────────────────────────────────────────────────── */}
      {showAnalyticsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '750px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#a855f715', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7' }}>
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                    Courier SLA & RTO Performance Analytics
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Compare transit success, RTO percentages & SPF Claim recovery
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setShowAnalyticsModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {analyticsLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  <RefreshCw size={24} className="spin-loader" style={{ margin: '0 auto 8px' }} />
                  <div>Loading courier metrics...</div>
                </div>
              ) : analyticsData?.overview ? (
                <>
                  {/* Top Overview Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                    <div style={{ background: '#eff6ff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Total Dispatched</span>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#2563eb', marginTop: '2px' }}>{analyticsData.overview.totalDispatched}</div>
                    </div>
                    <div style={{ background: '#ecfdf5', padding: '0.85rem', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#065f46', textTransform: 'uppercase' }}>Delivered</span>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>{analyticsData.overview.totalDelivered}</div>
                    </div>
                    <div style={{ background: '#fff1f2', padding: '0.85rem', borderRadius: '8px', border: '1px solid #fecdd3' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#be123c', textTransform: 'uppercase' }}>Overall RTO Rate</span>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#f43f5e', marginTop: '2px' }}>{analyticsData.overview.overallRtoRate}%</div>
                    </div>
                    <div style={{ background: '#faf5ff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6b21a8', textTransform: 'uppercase' }}>SPF Claims Value</span>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#a855f7', marginTop: '2px' }}>{fmtINR(analyticsData.overview.totalClaimAmount)}</div>
                    </div>
                  </div>

                  {/* Courier Breakdown Table */}
                  <div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      Partner SLA & Delivery Efficiency
                    </span>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Courier Partner</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Dispatched</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Delivered</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Returned</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Success Rate</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>RTO %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyticsData.couriers?.map((c, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>{c.courier}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{c.dispatched}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', color: '#10b981', fontWeight: 700 }}>{c.delivered}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', color: '#ef4444', fontWeight: 700 }}>{c.returned}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: '#ecfdf5', color: '#059669' }}>
                                {c.deliveryRate}%
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: c.rtoRate > 20 ? '#fee2e2' : '#f8fafc', color: c.rtoRate > 20 ? '#dc2626' : '#475569' }}>
                                {c.rtoRate}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          MODAL 6: 🏷️ Thermal Barcode Tag Sticker Printer (50x25mm)
      ──────────────────────────────────────────────────────────────────────── */}
      {showBarcodeTagModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '460px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag size={18} color="#0ea5e9" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                  Thermal Barcode Sticker Tag
                </h3>
              </div>
              <button type="button" onClick={() => setShowBarcodeTagModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
              
              {/* Thermal Label Preview (50x25mm / 2x1 inch ratio) */}
              <div id="thermal-barcode-tag" style={{
                width: '280px',
                height: '140px',
                border: '2px dashed #000',
                borderRadius: '6px',
                padding: '10px 12px',
                background: '#ffffff',
                color: '#000000',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.05em' }}>
                    {barcodeTagData.brand || 'SOBISE'}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 700, border: '1px solid #000', padding: '1px 4px', borderRadius: '2px' }}>
                    SIZE: {barcodeTagData.size || 'M'}
                  </span>
                </div>

                <div style={{ textAlign: 'center', margin: '2px 0' }}>
                  {/* High Contrast Barcode Representation */}
                  <div style={{
                    height: '34px',
                    background: 'repeating-linear-gradient(90deg, #000 0px, #000 2px, #fff 2px, #fff 4px, #000 4px, #000 7px, #fff 7px, #fff 9px)',
                    margin: '0 auto',
                    width: '85%'
                  }} />
                  <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.15em', fontFamily: 'monospace' }}>
                    {barcodeTagData.barcode || barcodeTagData.sku}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '9.5px', borderTop: '1px solid #000', paddingTop: '3px' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>SKU: {barcodeTagData.sku}</div>
                    {barcodeTagData.color && <div style={{ fontSize: '8.5px', color: '#444' }}>Color: {barcodeTagData.color}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', fontWeight: 900 }}>MRP: ₹ {barcodeTagData.mrp}</div>
                    <div style={{ fontSize: '7px', color: '#666' }}>Inc. of all taxes</div>
                  </div>
                </div>
              </div>

              {/* Tag Controls */}
              <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>Brand / Entity</label>
                  <input
                    type="text"
                    value={barcodeTagData.brand}
                    onChange={(e) => setBarcodeTagData({ ...barcodeTagData, brand: e.target.value })}
                    style={{ width: '100%', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>SKU Code</label>
                  <input
                    type="text"
                    value={barcodeTagData.sku}
                    onChange={(e) => setBarcodeTagData({ ...barcodeTagData, sku: e.target.value })}
                    style={{ width: '100%', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>Size</label>
                  <input
                    type="text"
                    value={barcodeTagData.size}
                    onChange={(e) => setBarcodeTagData({ ...barcodeTagData, size: e.target.value })}
                    style={{ width: '100%', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>MRP (₹)</label>
                  <input
                    type="number"
                    value={barcodeTagData.mrp}
                    onChange={(e) => setBarcodeTagData({ ...barcodeTagData, mrp: e.target.value })}
                    style={{ width: '100%', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowBarcodeTagModal(false)}
                  style={{ padding: '6px 12px', borderRadius: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{ padding: '6px 16px', borderRadius: '6px', background: '#000000', color: '#ffffff', border: 'none', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={14} />
                  <span>Print to Thermal Printer</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          MODAL 7: 📄 SPF Return Claim Dossier Viewer & Editor
      ──────────────────────────────────────────────────────────────────────── */}
      {selectedClaimRecord && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '620px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f43f5e15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f43f5e' }}>
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                    SPF Claim Evidence & Dispute Dossier
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    AWB: {selectedClaimRecord.referenceId} | Order #{selectedClaimRecord.displayOrderId}
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedClaimRecord(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Photo Evidence Gallery */}
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>
                  Damaged / Wrong Item Photos ({selectedClaimRecord.images?.length || 0})
                </span>
                {selectedClaimRecord.images?.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
                    {selectedClaimRecord.images.map((img, i) => (
                      <a key={i} href={img} target="_blank" rel="noreferrer" style={{ display: 'block', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                        <img src={img} alt={`Proof ${i}`} style={{ width: '100%', height: '80px', objectFit: 'cover' }} />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '6px', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>
                    No photos were attached during scan.
                  </div>
                )}
              </div>

              {/* Status and Claim ID */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '2px' }}>
                    Claim Status
                  </label>
                  <select
                    value={selectedClaimRecord.claimStatus || 'CLAIM_PENDING'}
                    onChange={(e) => setSelectedClaimRecord({ ...selectedClaimRecord, claimStatus: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  >
                    <option value="CLAIM_PENDING">Pending Submission</option>
                    <option value="CLAIM_SUBMITTED">Submitted to Marketplace</option>
                    <option value="CLAIM_APPROVED">Approved & Reimbursed</option>
                    <option value="CLAIM_REJECTED">Rejected by Courier/Platform</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '2px' }}>
                    Claim Ticket / Case ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SPF-MYNTRA-98421"
                    value={selectedClaimRecord.claimId || ''}
                    onChange={(e) => setSelectedClaimRecord({ ...selectedClaimRecord, claimId: e.target.value })}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '2px' }}>
                  Claim Amount (₹)
                </label>
                <input
                  type="number"
                  value={selectedClaimRecord.claimAmount || 0}
                  onChange={(e) => setSelectedClaimRecord({ ...selectedClaimRecord, claimAmount: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '2px' }}>
                  Dispute & Investigation Notes
                </label>
                <textarea
                  rows={3}
                  value={selectedClaimRecord.claimNotes || ''}
                  onChange={(e) => setSelectedClaimRecord({ ...selectedClaimRecord, claimNotes: e.target.value })}
                  placeholder="Record communication with Flipkart/Myntra SPF manager..."
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedClaimRecord(null)}
                  style={{ padding: '0.5rem 1rem', borderRadius: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveClaimDetails}
                  disabled={savingClaim}
                  style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', background: '#0ea5e9', color: '#fff', border: 'none', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  {savingClaim ? 'Saving...' : 'Save Claim Updates'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          PRINT TEMPLATE: 🖨️ Official Printable Handover Manifest
      ──────────────────────────────────────────────────────────────────────── */}
      {activePrintManifest && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          zIndex: 99999,
          overflowY: 'auto',
          padding: '2rem 1rem',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <div style={{ background: '#fff', maxWidth: '800px', width: '100%', padding: '2.5rem', borderRadius: '8px', color: '#000', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase' }}>
                COURIER PICKUP HANDOVER MANIFEST
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{ background: '#000', color: '#fff', padding: '6px 14px', borderRadius: '4px', border: 'none', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={14} />
                  <span>Print Manifest</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePrintManifest(null)}
                  style={{ background: '#e2e8f0', color: '#000', padding: '6px 14px', borderRadius: '4px', border: 'none', fontWeight: 800, cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
              <div>
                <div><strong>Manifest ID:</strong> {activePrintManifest.manifestId}</div>
                <div><strong>Date & Time:</strong> {new Date(activePrintManifest.createdAt).toLocaleString('en-IN')}</div>
                <div><strong>Transporter / Courier:</strong> {activePrintManifest.courier}</div>
                <div><strong>Fulfillment Warehouse:</strong> {activePrintManifest.facility || 'WH-MAIN (Surat)'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div><strong>Pickup Driver:</strong> {activePrintManifest.pickupDriverName || 'N/A'}</div>
                <div><strong>Driver Phone:</strong> {activePrintManifest.pickupDriverPhone || 'N/A'}</div>
                <div><strong>Vehicle Number:</strong> {activePrintManifest.vehicleNumber || 'N/A'}</div>
                <div><strong>Total Package Count:</strong> <span style={{ fontSize: '1.1rem', fontWeight: 900 }}>{activePrintManifest.totalPackages}</span></div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', border: '1px solid #000', marginTop: '0.5rem' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #000' }}>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid #000', textAlign: 'center', width: '35px' }}>#</th>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid #000', textAlign: 'left' }}>AWB Tracking Number</th>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid #000', textAlign: 'left' }}>Order ID</th>
                  <th style={{ padding: '6px 8px', borderRight: '1px solid #000', textAlign: 'left' }}>SKU Code</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Destination City</th>
                </tr>
              </thead>
              <tbody>
                {activePrintManifest.packages?.map((pkg, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #ccc' }}>
                    <td style={{ padding: '6px 8px', borderRight: '1px solid #ccc', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ padding: '6px 8px', borderRight: '1px solid #ccc', fontFamily: 'monospace', fontWeight: 800 }}>{pkg.awb}</td>
                    <td style={{ padding: '6px 8px', borderRight: '1px solid #ccc' }}>#{pkg.displayOrderCode}</td>
                    <td style={{ padding: '6px 8px', borderRight: '1px solid #ccc' }}>{pkg.sku}</td>
                    <td style={{ padding: '6px 8px' }}>{pkg.city || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', fontSize: '0.85rem' }}>
              <div style={{ borderTop: '1px solid #000', paddingTop: '0.5rem', textAlign: 'center' }}>
                <strong>Warehouse Dispatch Supervisor</strong>
                <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '2px' }}>Signature & Stamp</div>
              </div>
              <div style={{ borderTop: '1px solid #000', paddingTop: '0.5rem', textAlign: 'center' }}>
                <strong>Courier Pickup Driver Acknowledgment</strong>
                <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '2px' }}>
                  "I confirm receipt of {activePrintManifest.totalPackages} sealed packets in good condition"
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
