import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Plus,
  Search,
  Filter,
  FileText,
  CheckCircle2,
  Clock,
  Printer,
  Edit2,
  Trash2,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  Calendar,
  X,
  Package,
  AlertCircle,
  Building,
  RefreshCw,
  Hash,
  MapPin,
  Phone,
  FileSpreadsheet
} from 'lucide-react';
import { api } from '../services/api';
import { EntityBrandBadge } from './common/EntityBrandBadge';

const fmtINR = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CorporateDeliveryChallanPanel({
  companyEntity = 'Sobise',
  onNavigateToBilling
}) {
  const [challans, setChallans] = useState([]);
  const [stats, setStats] = useState({
    totalChallans: 0,
    totalDelivered: 0,
    pendingInvoice: 0,
    invoicedCount: 0,
    totalDispatchedQty: 0
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PENDING_INVOICE, DELIVERED, INVOICED
  const [convertingId, setConvertingId] = useState(null);

  // Modal State for Create / Edit
  const [showModal, setShowModal] = useState(false);
  const [editingChallan, setEditingChallan] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState({
    challanNo: '',
    challanDate: new Date().toISOString().split('T')[0],
    dispatchDate: new Date().toISOString().split('T')[0],
    status: 'DELIVERED',
    customer: {
      customerId: '',
      name: '',
      businessName: '',
      phone: '',
      email: '',
      gstin: '',
      billingAddress: '',
      shippingAddress: '',
      state: 'Gujarat',
      stateCode: '24'
    },
    dispatchDetails: {
      transporter: '',
      vehicleNo: '',
      eWayBillNo: '',
      dispatchThrough: 'By Road',
      lrNo: ''
    },
    items: [
      {
        itemName: '',
        description: '',
        hsnCode: '6204',
        qty: 1,
        unit: 'Pcs',
        unitPrice: 0,
        taxRate: 5,
        taxAmount: 0,
        totalAmount: 0
      }
    ],
    notes: '',
    terms: '1. Goods dispatched in sound condition.\n2. Receiver acknowledgment required on delivery.\n3. Subject to local jurisdiction only.'
  });

  const getThemeColor = () => {
    const norm = String(companyEntity || '').toLowerCase();
    if (norm.includes('sobise')) return '#e11d48'; // Sobise Rose
    if (norm.includes('fabtex')) return '#f59e0b'; // Fabtex Amber
    if (norm.includes('edition')) return '#8b5cf6'; // Edition Purple
    return '#2563eb';
  };

  const themeColor = getThemeColor();

  const fetchChallans = async () => {
    setLoading(true);
    try {
      const res = await api.getDeliveryChallans({
        companyEntity,
        status: statusFilter,
        search
      });
      if (res && res.success) {
        setChallans(res.data || []);
        if (res.stats) setStats(res.stats);
      }
    } catch (err) {
      console.error('Failed to load delivery challans:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [custRes, itemRes] = await Promise.all([
        api.getBillingCustomers(companyEntity),
        api.getBillingItems(companyEntity)
      ]);
      if (Array.isArray(custRes)) setCustomers(custRes);
      else if (custRes?.data) setCustomers(custRes.data);

      if (Array.isArray(itemRes)) setItemsList(itemRes);
      else if (itemRes?.data) setItemsList(itemRes.data);
    } catch (e) {
      console.warn('Failed to load customers or items list:', e);
    }
  };

  useEffect(() => {
    fetchChallans();
  }, [companyEntity, statusFilter, search]);

  useEffect(() => {
    fetchDependencies();
  }, [companyEntity]);

  // Open New Challan Modal
  const handleOpenCreate = async () => {
    try {
      const nextRes = await api.getNextDeliveryChallanNo(companyEntity);
      const nextNo = nextRes?.nextNo || 'SO-1000';

      setEditingChallan(null);
      setForm({
        challanNo: nextNo,
        challanDate: new Date().toISOString().split('T')[0],
        dispatchDate: new Date().toISOString().split('T')[0],
        status: 'DELIVERED',
        customer: {
          customerId: '',
          name: '',
          businessName: '',
          phone: '',
          email: '',
          gstin: '',
          billingAddress: '',
          shippingAddress: '',
          state: 'Gujarat',
          stateCode: '24'
        },
        dispatchDetails: {
          transporter: '',
          vehicleNo: '',
          eWayBillNo: '',
          dispatchThrough: 'By Road',
          lrNo: ''
        },
        items: [
          {
            itemName: '',
            description: '',
            hsnCode: '6204',
            qty: 1,
            unit: 'Pcs',
            unitPrice: 0,
            taxRate: 5,
            taxAmount: 0,
            totalAmount: 0
          }
        ],
        notes: '',
        terms: '1. Goods dispatched in sound condition.\n2. Receiver acknowledgment required on delivery.\n3. Subject to local jurisdiction only.'
      });
      setShowModal(true);
    } catch (err) {
      console.error('Failed to get next challan number:', err);
    }
  };

  // Open Edit Challan Modal
  const handleOpenEdit = (ch) => {
    setEditingChallan(ch);
    setForm({
      challanNo: ch.challanNo,
      challanDate: ch.challanDate ? new Date(ch.challanDate).toISOString().split('T')[0] : '',
      dispatchDate: ch.dispatchDate ? new Date(ch.dispatchDate).toISOString().split('T')[0] : '',
      status: ch.status || 'DELIVERED',
      customer: { ...(ch.customer || {}) },
      dispatchDetails: { ...(ch.dispatchDetails || {}) },
      items: (ch.items && ch.items.length > 0) ? ch.items.map(i => ({ ...i })) : [
        { itemName: '', description: '', hsnCode: '6204', qty: 1, unit: 'Pcs', unitPrice: 0, taxRate: 5, taxAmount: 0, totalAmount: 0 }
      ],
      notes: ch.notes || '',
      terms: ch.terms || ''
    });
    setShowModal(true);
  };

  // Delete Challan
  const handleDelete = async (id, no) => {
    if (!window.confirm(`Are you sure you want to delete Delivery Challan ${no}?`)) return;
    try {
      const res = await api.deleteDeliveryChallan(id);
      if (res && res.success) {
        fetchChallans();
      } else {
        alert(res?.error || 'Failed to delete Delivery Challan');
      }
    } catch (e) {
      alert(e.message || 'Error deleting challan');
    }
  };

  // 1-Click Convert to Invoice
  const handleConvertToInvoice = async (ch) => {
    if (ch.invoiced) {
      alert(`Challan ${ch.challanNo} is already invoiced as #${ch.invoiceNo}`);
      return;
    }
    if (!window.confirm(`Convert Delivery Challan ${ch.challanNo} to Tax Invoice now?`)) return;

    setConvertingId(ch._id);
    try {
      const res = await api.convertDeliveryChallanToInvoice(ch._id);
      if (res && res.success) {
        fetchChallans();
        if (onNavigateToBilling) {
          onNavigateToBilling(res.data);
        } else {
          alert(`✅ Successfully converted! Tax Invoice ${res.data?.invoiceNo} generated.`);
        }
      } else {
        alert(res?.error || 'Failed to convert Challan to Invoice');
      }
    } catch (e) {
      alert(e.message || 'Error converting Challan to Invoice');
    } finally {
      setConvertingId(null);
    }
  };

  // Handle Customer Selection
  const handleSelectCustomer = (e) => {
    const custId = e.target.value;
    if (!custId) return;
    const found = customers.find(c => c._id === custId || c.id === custId);
    if (found) {
      setForm(prev => ({
        ...prev,
        customer: {
          customerId: found._id || found.id,
          name: found.name || '',
          businessName: found.businessName || '',
          phone: found.phone || '',
          email: found.email || '',
          gstin: found.gstin || '',
          billingAddress: found.billingAddress || '',
          shippingAddress: found.shippingAddress || found.billingAddress || '',
          state: found.state || 'Gujarat',
          stateCode: found.stateCode || '24'
        }
      }));
    }
  };

  // Handle Line Item Change & Calculation
  const handleItemChange = (index, field, value) => {
    setForm(prev => {
      const newItems = [...prev.items];
      const cur = { ...newItems[index], [field]: value };

      if (field === 'qty' || field === 'unitPrice' || field === 'taxRate') {
        const qty = parseFloat(cur.qty) || 0;
        const rate = parseFloat(cur.unitPrice) || 0;
        const taxRate = parseFloat(cur.taxRate) || 0;
        const sub = qty * rate;
        const tax = (sub * taxRate) / 100;
        cur.taxAmount = parseFloat(tax.toFixed(2));
        cur.totalAmount = parseFloat((sub + tax).toFixed(2));
      }

      newItems[index] = cur;
      return { ...prev, items: newItems };
    });
  };

  // Handle selecting item from master catalog
  const handleSelectCatalogItem = (index, itemId) => {
    const found = itemsList.find(i => i._id === itemId || i.id === itemId);
    if (found) {
      setForm(prev => {
        const newItems = [...prev.items];
        const cur = { ...newItems[index] };
        cur.itemId = found._id || found.id;
        cur.itemName = found.itemName || '';
        cur.hsnCode = found.hsnCode || '6204';
        cur.unit = found.unit || 'Pcs';
        cur.unitPrice = found.unitPrice != null ? found.unitPrice : 0;
        cur.taxRate = found.taxRate != null ? found.taxRate : 5;

        const qty = parseFloat(cur.qty) || 1;
        const sub = qty * cur.unitPrice;
        const tax = (sub * cur.taxRate) / 100;
        cur.taxAmount = parseFloat(tax.toFixed(2));
        cur.totalAmount = parseFloat((sub + tax).toFixed(2));

        newItems[index] = cur;
        return { ...prev, items: newItems };
      });
    }
  };

  const handleAddItemRow = () => {
    setForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          itemName: '',
          description: '',
          hsnCode: '6204',
          qty: 1,
          unit: 'Pcs',
          unitPrice: 0,
          taxRate: 5,
          taxAmount: 0,
          totalAmount: 0
        }
      ]
    }));
  };

  const handleRemoveItemRow = (idx) => {
    if (form.items.length <= 1) return;
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  // Form Subtotals
  const formCalculations = useMemo(() => {
    let sub = 0;
    let tax = 0;
    let totalQty = 0;
    (form.items || []).forEach(it => {
      const q = parseFloat(it.qty) || 0;
      const r = parseFloat(it.unitPrice) || 0;
      const lineSub = q * r;
      const lineTax = (lineSub * (parseFloat(it.taxRate) || 0)) / 100;
      sub += lineSub;
      tax += lineTax;
      totalQty += q;
    });
    return {
      subtotal: sub,
      taxTotal: tax,
      grandTotal: sub + tax,
      totalQty
    };
  }, [form.items]);

  // Submit Modal Form
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!form.customer?.name?.trim()) {
      alert('Please enter or select a Customer / Consignee Name.');
      return;
    }
    if (!form.items || form.items.length === 0 || !form.items[0].itemName?.trim()) {
      alert('Please add at least one line item.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        companyEntity
      };

      let res;
      if (editingChallan && editingChallan._id) {
        res = await api.updateDeliveryChallan(editingChallan._id, payload);
      } else {
        res = await api.createDeliveryChallan(payload);
      }

      if (res && res.success) {
        setShowModal(false);
        fetchChallans();
      } else {
        alert(res?.error || 'Failed to save Delivery Challan');
      }
    } catch (err) {
      alert(err.message || 'Error saving Delivery Challan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* 📊 5 Modern KPI Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        
        {/* Card 1: Total Challans */}
        <div className="glass-panel" style={{ padding: '1.1rem', borderLeft: `4px solid ${themeColor}`, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Challans
            </span>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: `${themeColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Truck size={16} color={themeColor} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {stats.totalChallans}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dispatched Records</span>
        </div>

        {/* Card 2: Delivered */}
        <div className="glass-panel" style={{ padding: '1.1rem', borderLeft: '4px solid #0284c7', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Delivered
            </span>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#0284c715', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={16} color="#0284c7" />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0284c7' }}>
            {stats.totalDelivered}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dispatches Completed</span>
        </div>

        {/* Card 3: Ready for Invoicing */}
        <div className="glass-panel" style={{ padding: '1.1rem', borderLeft: '4px solid #f59e0b', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Pending Invoicing
            </span>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#f59e0b15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} color="#f59e0b" />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#d97706' }}>
            {stats.pendingInvoice}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600 }}>Ready to Bill & Convert</span>
        </div>

        {/* Card 4: Invoiced */}
        <div className="glass-panel" style={{ padding: '1.1rem', borderLeft: '4px solid #10b981', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Invoiced & Billed
            </span>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#10b98115', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} color="#10b981" />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#10b981' }}>
            {stats.invoicedCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>Tax Invoices Linked</span>
        </div>

        {/* Card 5: Total Dispatched Qty */}
        <div className="glass-panel" style={{ padding: '1.1rem', borderLeft: '4px solid #8b5cf6', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Dispatched
            </span>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#8b5cf615', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet size={16} color="#8b5cf6" />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#8b5cf6' }}>
            {stats.totalDispatchedQty}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Units / Pcs</span>
        </div>

      </div>

      {/* 🛠️ Modern Control Bar */}
      <div className="glass-panel" style={{ padding: '0.9rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        
        {/* Left: Search & Filter Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ position: 'relative', minWidth: '240px', maxWidth: '340px', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder={`Search ${companyEntity} challans, party, vehicle...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.75rem 0.45rem 2.1rem',
                fontSize: '0.84rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #e2e8f0)',
                background: 'var(--card-bg, #ffffff)',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
            {[
              { id: 'ALL', label: 'All' },
              { id: 'PENDING_INVOICE', label: 'Unbilled' },
              { id: 'DELIVERED', label: 'Delivered' },
              { id: 'INVOICED', label: 'Invoiced' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  border: 'none',
                  background: statusFilter === tab.id ? '#ffffff' : 'transparent',
                  color: statusFilter === tab.id ? themeColor : '#64748b',
                  fontWeight: statusFilter === tab.id ? 700 : 500,
                  fontSize: '0.78rem',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: statusFilter === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchChallans()}
            className="btn-secondary"
            title="Refresh register"
            style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
          >
            <RefreshCw size={15} className={loading ? 'spin-loader' : ''} />
          </button>
        </div>

        {/* Right: + New Challan Action */}
        <button
          onClick={handleOpenCreate}
          style={{
            background: `linear-gradient(135deg, ${themeColor}, #be123c)`,
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '0.5rem 1.2rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: `0 3px 10px ${themeColor}35`,
            whiteSpace: 'nowrap'
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>New Delivery Challan</span>
        </button>
      </div>

      {/* 📋 Register Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '12px 16px', fontWeight: 800 }}>Challan No</th>
                <th style={{ padding: '12px 16px', fontWeight: 800 }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 800 }}>Date</th>
                <th style={{ padding: '12px 16px', fontWeight: 800 }}>Consignee / Party</th>
                <th style={{ padding: '12px 16px', fontWeight: 800 }}>Dispatch / Vehicle</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'right' }}>Items / Qty</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'right' }}>Value</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="spin-loader" style={{ margin: '0 auto 8px', color: themeColor }} />
                    <div>Loading {companyEntity} Delivery Challans...</div>
                  </td>
                </tr>
              ) : challans.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${themeColor}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                      <Truck size={24} color={themeColor} />
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>No Delivery Challans Found</div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 16px' }}>
                      Create your first dispatch delivery challan for {companyEntity} (e.g. SO-1000).
                    </p>
                    <button
                      onClick={handleOpenCreate}
                      style={{
                        background: themeColor,
                        color: '#fff',
                        border: 'none',
                        padding: '0.45rem 1rem',
                        borderRadius: '6px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      + Create Delivery Challan
                    </button>
                  </td>
                </tr>
              ) : (
                challans.map((ch) => {
                  const isInv = ch.invoiced || ch.status === 'INVOICED';
                  return (
                    <tr
                      key={ch._id}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.12s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Challan No */}
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: themeColor }}>
                        <span style={{ padding: '3px 8px', background: `${themeColor}12`, borderRadius: '6px', border: `1px solid ${themeColor}30` }}>
                          {ch.challanNo}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '12px 16px' }}>
                        {isInv ? (
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <CheckCircle2 size={12} /> INVOICED
                            {ch.invoiceNo && <span style={{ opacity: 0.85, fontWeight: 800 }}>({ch.invoiceNo})</span>}
                          </span>
                        ) : ch.status === 'CANCELLED' ? (
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}>
                            CANCELLED
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Clock size={12} /> DELIVERED (UNBILLED)
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td style={{ padding: '12px 16px', color: '#475569', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {ch.challanDate ? new Date(ch.challanDate).toLocaleDateString('en-IN') : '-'}
                      </td>

                      {/* Consignee */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{ch.customer?.name || '-'}</div>
                        {ch.customer?.businessName && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{ch.customer.businessName}</div>
                        )}
                      </td>

                      {/* Transport / Vehicle */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                          {ch.dispatchDetails?.vehicleNo || 'Direct Transport'}
                        </div>
                        {ch.dispatchDetails?.transporter && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{ch.dispatchDetails.transporter}</div>
                        )}
                      </td>

                      {/* Items / Qty */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          {ch.totalQty} <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Pcs/Mtr</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {ch.items?.length || 0} item(s)
                        </div>
                      </td>

                      {/* Value */}
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                        {fmtINR(ch.grandTotal)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          
                          {/* 1-Click Convert to Tax Invoice Button */}
                          {!isInv && ch.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleConvertToInvoice(ch)}
                              disabled={convertingId === ch._id}
                              title="1-Click Convert this Delivery Challan to Tax Invoice"
                              style={{
                                background: '#10b981',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                boxShadow: '0 1px 3px rgba(16,185,129,0.2)'
                              }}
                            >
                              <FileText size={13} />
                              <span>{convertingId === ch._id ? 'Converting...' : 'Convert to Invoice'}</span>
                            </button>
                          )}

                          {/* Print / View PDF */}
                          <button
                            onClick={() => api.downloadDeliveryChallanPdf(ch._id, ch.challanNo)}
                            title="Download / Print Delivery Challan PDF"
                            style={{
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              color: '#334155',
                              padding: '5px 7px',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            <Printer size={14} />
                          </button>

                          {/* Edit */}
                          {!isInv && (
                            <button
                              onClick={() => handleOpenEdit(ch)}
                              title="Edit Delivery Challan"
                              style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                color: '#334155',
                                padding: '5px 7px',
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                            >
                              <Edit2 size={14} />
                            </button>
                          )}

                          {/* Delete */}
                          {!isInv && (
                            <button
                              onClick={() => handleDelete(ch._id, ch.challanNo)}
                              title="Delete Delivery Challan"
                              style={{
                                background: '#fee2e2',
                                border: '1px solid #fca5a5',
                                color: '#dc2626',
                                padding: '5px 7px',
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CREATE / EDIT DELIVERY CHALLAN MODAL ────────────────────────────── */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              width: '100%',
              maxWidth: '920px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${themeColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Truck size={20} color={themeColor} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {editingChallan ? `Edit Delivery Challan (${form.challanNo})` : 'New Delivery Challan'}
                    <EntityBrandBadge entityId={companyEntity} />
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                    Generate item dispatch notes, delivery proof and convert to invoice with 1-click.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitForm} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Row 1: Document Metadata */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Challan Number
                  </label>
                  <input
                    type="text"
                    value={form.challanNo}
                    onChange={(e) => setForm(prev => ({ ...prev, challanNo: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 700, color: themeColor }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Challan Date
                  </label>
                  <input
                    type="date"
                    value={form.challanDate}
                    onChange={(e) => setForm(prev => ({ ...prev, challanDate: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Dispatch Date
                  </label>
                  <input
                    type="date"
                    value={form.dispatchDate}
                    onChange={(e) => setForm(prev => ({ ...prev, dispatchDate: e.target.value }))}
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value }))}
                    style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 600 }}
                  >
                    <option value="DELIVERED">DELIVERED (Ready to Bill)</option>
                    <option value="PENDING">PENDING (In Transit)</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Customer / Consignee Selection */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Consignee / Party Details
                  </span>
                  {customers.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Select Saved Party:</span>
                      <select
                        onChange={handleSelectCustomer}
                        style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem' }}
                      >
                        <option value="">-- Choose Party --</option>
                        {customers.map(c => (
                          <option key={c._id || c.id} value={c._id || c.id}>
                            {c.name} {c.businessName ? `(${c.businessName})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>Party / Client Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Surat Fashion Wear"
                      value={form.customer.name}
                      onChange={(e) => setForm(prev => ({ ...prev, customer: { ...prev.customer, name: e.target.value } }))}
                      required
                      style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 9876543210"
                      value={form.customer.phone}
                      onChange={(e) => setForm(prev => ({ ...prev, customer: { ...prev.customer, phone: e.target.value } }))}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>GSTIN</label>
                    <input
                      type="text"
                      placeholder="e.g. 24AAAAA0000A1Z5"
                      value={form.customer.gstin}
                      onChange={(e) => setForm(prev => ({ ...prev, customer: { ...prev.customer, gstin: e.target.value.toUpperCase() } }))}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>Delivery Address</label>
                    <input
                      type="text"
                      placeholder="Shipping destination address"
                      value={form.customer.shippingAddress}
                      onChange={(e) => setForm(prev => ({ ...prev, customer: { ...prev.customer, shippingAddress: e.target.value } }))}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Dispatch & Logistics Details */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Transport & Logistics Information
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>Transporter Name</label>
                    <input
                      type="text"
                      placeholder="e.g. SafeXpress Logistics"
                      value={form.dispatchDetails.transporter}
                      onChange={(e) => setForm(prev => ({ ...prev, dispatchDetails: { ...prev.dispatchDetails, transporter: e.target.value } }))}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>Vehicle Number</label>
                    <input
                      type="text"
                      placeholder="e.g. GJ-05-XX-1234"
                      value={form.dispatchDetails.vehicleNo}
                      onChange={(e) => setForm(prev => ({ ...prev, dispatchDetails: { ...prev.dispatchDetails, vehicleNo: e.target.value.toUpperCase() } }))}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>E-Way Bill No</label>
                    <input
                      type="text"
                      placeholder="Optional E-Way Bill"
                      value={form.dispatchDetails.eWayBillNo}
                      onChange={(e) => setForm(prev => ({ ...prev, dispatchDetails: { ...prev.dispatchDetails, eWayBillNo: e.target.value } }))}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>Dispatch Through</label>
                    <input
                      type="text"
                      placeholder="By Road, Hand Delivery"
                      value={form.dispatchDetails.dispatchThrough}
                      onChange={(e) => setForm(prev => ({ ...prev, dispatchDetails: { ...prev.dispatchDetails, dispatchThrough: e.target.value } }))}
                      style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: Line Items Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Dispatched Items & Quantities
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      color: themeColor,
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    + Add Row
                  </button>
                </div>

                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Item Description *</th>
                        <th style={{ padding: '8px', width: '90px', textAlign: 'left' }}>HSN</th>
                        <th style={{ padding: '8px', width: '85px', textAlign: 'right' }}>Qty *</th>
                        <th style={{ padding: '8px', width: '90px', textAlign: 'left' }}>Unit</th>
                        <th style={{ padding: '8px', width: '95px', textAlign: 'right' }}>Rate (₹)</th>
                        <th style={{ padding: '8px', width: '75px', textAlign: 'right' }}>GST %</th>
                        <th style={{ padding: '8px', width: '110px', textAlign: 'right' }}>Total (₹)</th>
                        <th style={{ padding: '8px', width: '40px', textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          
                          {/* Item Name & Catalog Picker */}
                          <td style={{ padding: '6px 8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <input
                                type="text"
                                placeholder="Item name or product description"
                                value={it.itemName}
                                onChange={(e) => handleItemChange(idx, 'itemName', e.target.value)}
                                required
                                style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                              />
                              {itemsList.length > 0 && (
                                <select
                                  onChange={(e) => handleSelectCatalogItem(idx, e.target.value)}
                                  style={{ fontSize: '0.7rem', padding: '2px', border: '1px solid #e2e8f0', borderRadius: '4px', color: '#64748b' }}
                                >
                                  <option value="">-- Choose from Catalog --</option>
                                  {itemsList.map(item => (
                                    <option key={item._id || item.id} value={item._id || item.id}>
                                      {item.itemName} (₹{item.unitPrice})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </td>

                          {/* HSN */}
                          <td style={{ padding: '6px 8px' }}>
                            <input
                              type="text"
                              value={it.hsnCode}
                              onChange={(e) => handleItemChange(idx, 'hsnCode', e.target.value)}
                              style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            />
                          </td>

                          {/* Qty */}
                          <td style={{ padding: '6px 8px' }}>
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={it.qty}
                              onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                              required
                              style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 700 }}
                            />
                          </td>

                          {/* Unit */}
                          <td style={{ padding: '6px 8px' }}>
                            <select
                              value={it.unit}
                              onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                              style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            >
                              <option value="Pcs">Pcs</option>
                              <option value="Meters">Meters</option>
                              <option value="Sets">Sets</option>
                              <option value="Rolls">Rolls</option>
                              <option value="Boxes">Boxes</option>
                              <option value="Kgs">Kgs</option>
                            </select>
                          </td>

                          {/* Unit Price (Rate) */}
                          <td style={{ padding: '6px 8px' }}>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={it.unitPrice}
                              onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                              style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'right' }}
                            />
                          </td>

                          {/* Tax Rate */}
                          <td style={{ padding: '6px 8px' }}>
                            <select
                              value={it.taxRate}
                              onChange={(e) => handleItemChange(idx, 'taxRate', e.target.value)}
                              style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'right' }}
                            >
                              <option value={0}>0%</option>
                              <option value={5}>5%</option>
                              <option value={12}>12%</option>
                              <option value={18}>18%</option>
                            </select>
                          </td>

                          {/* Line Total */}
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>
                            ₹ {(it.totalAmount || 0).toFixed(2)}
                          </td>

                          {/* Remove */}
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              disabled={form.items.length <= 1}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: form.items.length <= 1 ? '#cbd5e1' : '#ef4444',
                                cursor: form.items.length <= 1 ? 'not-allowed' : 'pointer'
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Subtotals Box */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <div style={{ width: '280px', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                      <span>Total Quantity:</span>
                      <strong style={{ color: '#0f172a' }}>{formCalculations.totalQty} Units</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                      <span>Subtotal:</span>
                      <span style={{ fontWeight: 600 }}>₹ {formCalculations.subtotal.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                      <span>Estimated Taxes:</span>
                      <span style={{ fontWeight: 600 }}>₹ {formCalculations.taxTotal.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '4px', fontSize: '0.95rem', fontWeight: 900, color: themeColor }}>
                      <span>Total Value:</span>
                      <span>₹ {formCalculations.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: `linear-gradient(135deg, ${themeColor}, #be123c)`,
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.5rem 1.4rem',
                    borderRadius: '8px',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: `0 3px 10px ${themeColor}35`
                  }}
                >
                  {submitting ? 'Saving...' : editingChallan ? 'Update Delivery Challan' : 'Save Delivery Challan'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
