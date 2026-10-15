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
  ArrowRight,
  Maximize2,
  RefreshCw,
  Printer,
  ShieldCheck,
  RotateCcw,
  Check,
  AlertTriangle,
  X,
  FileSpreadsheet,
  Calendar,
  ExternalLink,
  MapPin,
  Tag,
  Undo2
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
  
  // Return Processing Form State
  const [returnCondition, setReturnCondition] = useState('INTACT');
  const [returnType, setReturnType] = useState('RTO');
  const [returnNotes, setReturnNotes] = useState('');
  
  // Scanned history list
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
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (err) {
      // AudioContext may be restricted by browser policy if no interaction
    }
  };

  // Main processing pipeline when an AWB is scanned or typed
  const handleProcessScan = async (codeToProcess, source = 'Manual Input') => {
    const trimmed = (codeToProcess || '').trim();
    if (!trimmed) return;

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // 1. Lookup AWB details
      const lookupRes = await api.lookupAwb(trimmed);
      if (!lookupRes || !lookupRes.success) {
        throw new Error(lookupRes?.error || 'Failed to lookup AWB code');
      }

      const orderData = lookupRes.data;
      setActiveOrder(orderData);

      // 2. Perform automated action based on current Scan Mode
      if (scanMode === 'PACK') {
        // Mode 1: Auto-mark as PACKED & DISPATCHED
        const packRes = await api.packAwbOrder({
          awb: trimmed,
          displayOrderCode: orderData.displayOrderCode,
          sku: orderData.itemSKUCode,
          courier: orderData.courier
        });

        playAudioCue('success');
        setSuccessMsg(`✅ AWB ${trimmed} verified & packed! Dispatched date automatically stamped.`);
        
        // Add to history list
        const historyEntry = {
          id: Date.now(),
          awb: trimmed,
          orderCode: orderData.displayOrderCode,
          sku: orderData.itemSKUCode,
          courier: orderData.courier,
          mode: 'PACK',
          status: 'DISPATCHED',
          time: new Date().toLocaleTimeString('en-IN'),
          date: new Date().toLocaleDateString('en-IN')
        };
        setScanHistory(prev => [historyEntry, ...prev.slice(0, 49)]);
        fetchStats();

      } else if (scanMode === 'DELIVERY') {
        // Mode 2: Auto-mark as DELIVERED
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
        // Mode 3: Found order, ready for return condition check
        playAudioCue('success');
        setSuccessMsg(`📦 Return parcel detected for Order #${orderData.displayOrderCode} (${orderData.itemSKUCode}). Select condition below.`);
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

  // Submit Return Process
  const handleConfirmReturn = async () => {
    if (!activeOrder?.awb) return;

    setLoading(true);
    try {
      const res = await api.processAwbReturn({
        awb: activeOrder.awb,
        displayOrderId: activeOrder.displayOrderCode,
        sku: activeOrder.itemSKUCode,
        returnType,
        condition: returnCondition,
        notes: returnNotes,
        quantity: 1
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
          time: new Date().toLocaleTimeString('en-IN'),
          date: new Date().toLocaleDateString('en-IN')
        };
        setScanHistory(prev => [historyEntry, ...prev.slice(0, 49)]);
        setActiveOrder(null);
        setReturnNotes('');
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
              AWB Tracking, Automated Date Stamping, Deliveries & Inward RTO Return Management
            </p>
          </div>
        </div>

        {/* Hardware Status & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
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
            <span>{hardwareDetected ? 'Laser Scanner Active' : 'Ready for AWB Scan Bursts'}</span>
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
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Auto-Dated & Manifested</span>
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
          <span style={{ fontSize: '0.72rem', color: '#f43f5e', fontWeight: 600 }}>QC Inspected & Restocked</span>
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
                  ? "Scan shipping label or enter AWB code (e.g. MYSC1359190430)..."
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
            <span>Process AWB</span>
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
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginTop: '2px' }}>
                    {activeOrder.itemName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '12px', marginTop: '3px' }}>
                    <span>SKU: <strong>{activeOrder.itemSKUCode}</strong></span>
                    {activeOrder.size && <span>Size: <strong>{activeOrder.size}</strong></span>}
                    {activeOrder.color && <span>Color: <strong>{activeOrder.color}</strong></span>}
                    {activeOrder.price > 0 && <span>Value: <strong>{fmtINR(activeOrder.price)}</strong></span>}
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

            {/* Return QC Controls (If Mode === RETURN) */}
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
                    🔴 Damaged / Claim
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

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Optional return inspection remarks..."
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
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Courier</th>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>Mode</th>
                <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {scanHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
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
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{item.courier}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: item.mode === 'PACK' ? '#eff6ff' : item.mode === 'DELIVERY' ? '#ecfdf5' : '#fff1f2', color: item.mode === 'PACK' ? '#0284c7' : item.mode === 'DELIVERY' ? '#059669' : '#be123c' }}>
                        {item.mode}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
