import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { triggerPushNotification } from './NotificationToast';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import {
  FileText,
  Plus,
  Trash2,
  Download,
  Printer,
  DollarSign,
  Users,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  CreditCard,
  Building,
  RefreshCw,
  PlusCircle,
  Eye,
  Edit2,
  ChevronRight,
  Package,
  X
} from 'lucide-react';

// Helper for Indian Currency formatting
const fmtINR = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Number to Words Converter in Indian format
function numToWords(amount) {
  const words = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n) {
    if (n < 20) return words[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + words[n % 10] : '');
    if (n < 1000) return words[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
  }

  const num = Math.floor(amount || 0);
  if (num === 0) return 'Rupees Zero Only';
  return 'Rupees ' + convert(num) + ' Only';
}

export default function EliteBillingDepartment() {
  const [activeTab, setActiveTab] = useState('invoices'); // 'dashboard', 'invoices', 'create', 'customers', 'items'
  const [stats, setStats] = useState({
    totalInvoices: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    totalBalanceDue: 0,
    paidCount: 0,
    unpaidCount: 0,
    overdueCount: 0
  });

  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State for Payments
  const [paymentModalInvoice, setPaymentModalInvoice] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Bank Transfer');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [submittingPay, setSubmittingPay] = useState(false);

  // New Customer Modal State
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [custForm, setCustForm] = useState({
    name: '', businessName: '', phone: '', email: '', gstin: '', billingAddress: '', state: 'Gujarat', stateCode: '24'
  });

  // New Item Modal State
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemForm, setItemForm] = useState({
    itemName: '', hsnCode: '5407', unitPrice: '', unit: 'Meters', taxRate: 18, category: 'Printing Services'
  });

  // ── INVOICE EDITOR STATE (myBillBook style) ──────────────────────────────
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNo: '',
    invoiceSeq: 1001,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
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
    items: [
      { itemName: 'Digital Printing Service (Fabric)', hsnCode: '5407', qty: 100, unit: 'Meters', unitPrice: 45, discountPct: 0, taxRate: 18, totalAmount: 4500 }
    ],
    discountType: 'flat',
    discountValue: 0,
    taxType: 'CGST_SGST', // 'CGST_SGST' or 'IGST'
    paidAmount: 0,
    notes: 'Thank you for doing business with Elite Digital Prints!',
    terms: 'Payment due within 15 days from invoice date. Subject to Surat jurisdiction.'
  });

  // ── Fetch Initial Data ─────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [sRes, iRes, cRes, itemRes] = await Promise.all([
        api.getBillingDashboardStats(),
        api.getBillingInvoices({ limit: 50, search, paymentStatus: statusFilter }),
        api.getBillingCustomers(),
        api.getBillingItems()
      ]);

      if (sRes.data) setStats(sRes.data);
      if (iRes.data) setInvoices(iRes.data);
      if (cRes.data) setCustomers(cRes.data);
      if (itemRes.data) setItemsList(itemRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter]);

  // Load next invoice number when opening create tab
  const handleOpenCreateTab = async (invoiceToEdit = null) => {
    if (invoiceToEdit) {
      setEditingInvoiceId(invoiceToEdit._id);
      setInvoiceForm({
        ...invoiceToEdit,
        invoiceDate: invoiceToEdit.invoiceDate ? invoiceToEdit.invoiceDate.split('T')[0] : '',
        dueDate: invoiceToEdit.dueDate ? invoiceToEdit.dueDate.split('T')[0] : ''
      });
      setActiveTab('create');
    } else {
      setEditingInvoiceId(null);
      try {
        const nextRes = await api.getNextInvoiceNo();
        setInvoiceForm({
          invoiceNo: nextRes.invoiceNo || 'EDP-INV-1001',
          invoiceSeq: nextRes.nextSeq || 1001,
          invoiceDate: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
          customer: customers[0] ? { ...customers[0] } : {
            customerId: '', name: 'Walk-in Client', businessName: '', phone: '', email: '', gstin: '', billingAddress: '', state: 'Gujarat', stateCode: '24'
          },
          items: [
            { itemName: 'Digital Printing Service (Fabric)', hsnCode: '5407', qty: 100, unit: 'Meters', unitPrice: 45, discountPct: 0, taxRate: 18, totalAmount: 4500 }
          ],
          discountType: 'flat',
          discountValue: 0,
          taxType: 'CGST_SGST',
          paidAmount: 0,
          notes: 'Thank you for doing business with Elite Digital Prints!',
          terms: 'Payment due within 15 days from invoice date. Subject to Surat jurisdiction.'
        });
        setActiveTab('create');
      } catch (err) {
        console.error('Failed to get next invoice number:', err);
      }
    }
  };

  // ── REAL-TIME INVOICE CALCULATIONS ──────────────────────────────────────
  const calculatedInvoice = useMemo(() => {
    let subtotal = 0;
    const updatedItems = invoiceForm.items.map(it => {
      const qty = parseFloat(it.qty) || 0;
      const price = parseFloat(it.unitPrice) || 0;
      const discPct = parseFloat(it.discountPct) || 0;
      const baseTotal = qty * price;
      const discAmt = (baseTotal * discPct) / 100;
      const itemTotal = baseTotal - discAmt;
      subtotal += itemTotal;
      return {
        ...it,
        discountAmt: discAmt,
        totalAmount: itemTotal
      };
    });

    const discVal = parseFloat(invoiceForm.discountValue) || 0;
    let discountTotal = 0;
    if (invoiceForm.discountType === 'percentage') {
      discountTotal = (subtotal * discVal) / 100;
    } else {
      discountTotal = discVal;
    }

    const netSubtotal = Math.max(0, subtotal - discountTotal);

    // Calculate Tax based on items average tax rate or 18%
    const avgTaxRate = updatedItems.length > 0
      ? (updatedItems.reduce((sum, i) => sum + (parseFloat(i.taxRate) || 18), 0) / updatedItems.length)
      : 18;

    const totalTax = (netSubtotal * avgTaxRate) / 100;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (invoiceForm.taxType === 'IGST') {
      igstAmount = totalTax;
    } else {
      cgstAmount = totalTax / 2;
      sgstAmount = totalTax / 2;
    }

    const grandTotal = Math.round(netSubtotal + totalTax);
    const paid = parseFloat(invoiceForm.paidAmount) || 0;
    const balanceDue = Math.max(0, grandTotal - paid);

    return {
      items: updatedItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discountTotal: parseFloat(discountTotal.toFixed(2)),
      netSubtotal: parseFloat(netSubtotal.toFixed(2)),
      cgstAmount: parseFloat(cgstAmount.toFixed(2)),
      sgstAmount: parseFloat(sgstAmount.toFixed(2)),
      igstAmount: parseFloat(igstAmount.toFixed(2)),
      totalTax: parseFloat(totalTax.toFixed(2)),
      grandTotal,
      balanceDue: parseFloat(balanceDue.toFixed(2))
    };
  }, [invoiceForm.items, invoiceForm.discountType, invoiceForm.discountValue, invoiceForm.taxType, invoiceForm.paidAmount]);

  // Handle Dynamic Line Item Change
  const handleItemChange = (index, field, value) => {
    const newItems = [...invoiceForm.items];
    newItems[index][field] = value;

    // If item selected from dropdown, fill default metadata
    if (field === 'itemName') {
      const matched = itemsList.find(i => i.itemName === value);
      if (matched) {
        newItems[index].hsnCode = matched.hsnCode || '5407';
        newItems[index].unitPrice = matched.unitPrice || 0;
        newItems[index].unit = matched.unit || 'Meters';
        newItems[index].taxRate = matched.taxRate || 18;
      }
    }

    setInvoiceForm(prev => ({ ...prev, items: newItems }));
  };

  const handleAddItemRow = () => {
    setInvoiceForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { itemName: '', hsnCode: '5407', qty: 1, unit: 'Meters', unitPrice: 0, discountPct: 0, taxRate: 18, totalAmount: 0 }
      ]
    }));
  };

  const handleRemoveItemRow = (index) => {
    if (invoiceForm.items.length === 1) return;
    setInvoiceForm(prev => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index)
    }));
  };

  const handleCustomerSelect = (custName) => {
    const matched = customers.find(c => c.name === custName || c.businessName === custName);
    if (matched) {
      setInvoiceForm(prev => ({
        ...prev,
        customer: {
          customerId: matched._id,
          name: matched.name,
          businessName: matched.businessName || '',
          phone: matched.phone || '',
          email: matched.email || '',
          gstin: matched.gstin || '',
          billingAddress: matched.billingAddress || '',
          shippingAddress: matched.shippingAddress || matched.billingAddress || '',
          state: matched.state || 'Gujarat',
          stateCode: matched.stateCode || '24'
        },
        taxType: matched.stateCode && matched.stateCode !== '24' ? 'IGST' : 'CGST_SGST'
      }));
    }
  };

  // Submit Invoice Handler
  const handleSaveInvoice = async () => {
    setLoading(true);
    try {
      const payload = {
        ...invoiceForm,
        items: calculatedInvoice.items,
        subtotal: calculatedInvoice.subtotal,
        discountTotal: calculatedInvoice.discountTotal,
        cgstAmount: calculatedInvoice.cgstAmount,
        sgstAmount: calculatedInvoice.sgstAmount,
        igstAmount: calculatedInvoice.igstAmount,
        totalTax: calculatedInvoice.totalTax,
        grandTotal: calculatedInvoice.grandTotal,
        balanceDue: calculatedInvoice.balanceDue
      };

      if (editingInvoiceId) {
        await api.updateBillingInvoice(editingInvoiceId, payload);
      } else {
        await api.createBillingInvoice(payload);
      }

      alert(`Invoice ${editingInvoiceId ? 'updated' : 'created'} successfully!`);
      await loadData();
      setActiveTab('invoices');
    } catch (err) {
      alert(err.message || 'Failed to save invoice');
    } finally {
      setLoading(false);
    }
  };

  // Delete Invoice
  const handleDeleteInvoice = async (id, invNo) => {
    if (!window.confirm(`Delete Invoice "${invNo}"?`)) return;
    try {
      await api.deleteBillingInvoice(id);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to delete invoice');
    }
  };

  // Record Payment
  const handleSavePayment = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }
    setSubmittingPay(true);
    try {
      await api.recordInvoicePayment(paymentModalInvoice._id, {
        amount: parseFloat(payAmount),
        method: payMethod,
        referenceNo: payRef,
        notes: payNotes
      });
      alert('Payment recorded successfully!');
      setPaymentModalInvoice(null);
      setPayAmount('');
      setPayRef('');
      setPayNotes('');
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to record payment');
    } finally {
      setSubmittingPay(false);
    }
  };

  // Create Customer Handler
  const handleSaveCustomer = async () => {
    if (!custForm.name) {
      alert('Customer Name is required');
      return;
    }
    try {
      const res = await api.createBillingCustomer(custForm);
      setCustomers(prev => [...prev, res.data]);
      setShowCustomerModal(false);
      setCustForm({ name: '', businessName: '', phone: '', email: '', gstin: '', billingAddress: '', state: 'Gujarat', stateCode: '24' });
    } catch (err) {
      alert(err.message || 'Failed to create customer');
    }
  };

  // Create Item Handler
  const handleSaveItem = async () => {
    if (!itemForm.itemName || !itemForm.unitPrice) {
      alert('Item Name and Price are required');
      return;
    }
    try {
      const res = await api.createBillingItem(itemForm);
      setItemsList(prev => [...prev, res.data]);
      setShowItemModal(false);
      setItemForm({ itemName: '', hsnCode: '5407', unitPrice: '', unit: 'Meters', taxRate: 18, category: 'Printing Services' });
    } catch (err) {
      alert(err.message || 'Failed to create billing item');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* ── TOP BANNER ──────────────────────────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={22} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Billing & Invoicing Department</h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>
                Elite Digital Prints — Cloud Accounting & GST Invoicing System
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button className="btn-primary" onClick={() => handleOpenCreateTab()} style={{ padding: '0.55rem 1.25rem', background: 'linear-gradient(135deg,#7c3aed,#6366f1)' }}>
              <PlusCircle size={15} /> Create Invoice
            </button>
            <button className="btn-secondary" onClick={() => setShowCustomerModal(true)} style={{ padding: '0.55rem 1rem' }}>
              <Users size={15} /> Add Customer
            </button>
            <button className="btn-secondary" onClick={() => setShowItemModal(true)} style={{ padding: '0.55rem 1rem' }}>
              <Package size={15} /> Add Product
            </button>
          </div>
        </div>

        {/* Sub-Tabs Bar */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.2rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.8rem', overflowX: 'auto' }}>
          {[
            { id: 'invoices', label: '🧾 Invoices Directory', count: stats.totalInvoices },
            { id: 'dashboard', label: '📊 Financial Summary' },
            { id: 'create', label: activeTab === 'create' ? (editingInvoiceId ? '✍️ Edit Invoice' : '✍️ New Invoice Generator') : '✍️ Create Invoice' },
            { id: 'customers', label: `👥 Customers (${customers.length})` },
            { id: 'items', label: `📦 Billing Products (${itemsList.length})` }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => {
                if (t.id === 'create' && activeTab !== 'create') {
                  handleOpenCreateTab();
                } else {
                  setActiveTab(t.id);
                }
              }}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                border: '1px solid',
                borderColor: activeTab === t.id ? '#7c3aed' : 'var(--border-light)',
                background: activeTab === t.id ? 'rgba(124,58,237,0.15)' : 'transparent',
                color: activeTab === t.id ? '#a78bfa' : 'var(--text-muted)',
                transition: 'all 0.15s'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI CARDS ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1.1rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Invoiced</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{fmtINR(stats.totalInvoiced)}</div>
          <div style={{ fontSize: '0.72rem', color: '#3b82f6', marginTop: 4 }}>{stats.totalInvoices} Invoices Generated</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.1rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Received (Paid)</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#34d399', marginTop: 4 }}>{fmtINR(stats.totalPaid)}</div>
          <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: 4 }}>{stats.paidCount} Fully Paid Invoices</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.1rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Pending Receivables</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fbbf24', marginTop: 4 }}>{fmtINR(stats.totalBalanceDue)}</div>
          <div style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: 4 }}>{stats.unpaidCount} Pending / Partial</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.1rem', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Overdue Invoices</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f87171', marginTop: 4 }}>{stats.overdueCount}</div>
          <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: 4 }}>Payment Date Passed</div>
        </div>
      </div>

      {/* ── TAB 1: INVOICES DIRECTORY ───────────────────────────────────────── */}
      {activeTab === 'invoices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Search & Status Filters */}
          <div className="glass-panel" style={{ padding: '0.85rem 1.25rem', display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search Invoice No, Customer Name, Phone..."
                style={{ paddingLeft: 32, width: '100%', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {['ALL', 'UNPAID', 'PARTIALLY_PAID', 'PAID'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    border: '1px solid',
                    borderColor: statusFilter === st ? '#7c3aed' : 'var(--border-light)',
                    background: statusFilter === st ? 'rgba(124,58,237,0.15)' : 'transparent',
                    color: statusFilter === st ? '#a78bfa' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {st}
                </button>
              ))}
            </div>

            <button onClick={loadData} className="btn-icon" title="Refresh">
              <RefreshCw size={14} className={loading ? 'spin-loader' : ''} />
            </button>
          </div>

          {/* Invoices Table */}
          <div className="glass-panel" style={{ overflowX: 'auto', padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Invoice No</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer Name</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Grand Total</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Paid Amount</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Balance Due</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No invoices found. Click "Create Invoice" to issue your first invoice!
                    </td>
                  </tr>
                ) : (
                  invoices.map(inv => (
                    <tr key={inv._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 800, color: '#a78bfa' }}>
                        {inv.invoiceNo}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                        <div style={{ fontWeight: 700 }}>{inv.customer?.businessName || inv.customer?.name || '—'}</div>
                        {inv.customer?.gstin && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>GSTIN: {inv.customer.gstin}</div>}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                        {formatDateDDMMYYYY(inv.invoiceDate)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {fmtINR(inv.grandTotal)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#34d399', fontWeight: 700 }}>
                        {fmtINR(inv.paidAmount)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: inv.balanceDue > 0 ? '#f87171' : 'var(--text-muted)', fontWeight: 700 }}>
                        {fmtINR(inv.balanceDue)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          padding: '0.2rem 0.6rem',
                          borderRadius: 6,
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          background: inv.paymentStatus === 'PAID' ? 'rgba(16,185,129,0.15)' : inv.paymentStatus === 'PARTIALLY_PAID' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                          color: inv.paymentStatus === 'PAID' ? '#34d399' : inv.paymentStatus === 'PARTIALLY_PAID' ? '#fbbf24' : '#f87171',
                          border: `1px solid ${inv.paymentStatus === 'PAID' ? 'rgba(16,185,129,0.3)' : inv.paymentStatus === 'PARTIALLY_PAID' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`
                        }}>
                          {inv.paymentStatus}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                          <button onClick={() => api.downloadInvoicePdf(inv._id, inv.invoiceNo)} className="btn-icon" title="Download GST PDF">
                            <Download size={14} color="#a78bfa" />
                          </button>
                          {inv.balanceDue > 0 && (
                            <button onClick={() => { setPaymentModalInvoice(inv); setPayAmount(inv.balanceDue); }} className="btn-icon" title="Record Payment">
                              <CreditCard size={14} color="#34d399" />
                            </button>
                          )}
                          <button onClick={() => handleOpenCreateTab(inv)} className="btn-icon" title="Edit">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDeleteInvoice(inv._id, inv.invoiceNo)} className="btn-icon" title="Delete">
                            <Trash2 size={14} color="#f87171" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: INVOICE GENERATOR / EDITOR (myBillBook style) ────────────── */}
      {activeTab === 'create' && (
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.8rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {editingInvoiceId ? `Edit Invoice — ${invoiceForm.invoiceNo}` : 'New GST Tax Invoice Generator'}
            </h3>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="btn-secondary" onClick={() => setActiveTab('invoices')}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveInvoice} disabled={loading} style={{ background: 'linear-gradient(135deg,#7c3aed,#6366f1)' }}>
                {loading ? 'Saving...' : editingInvoiceId ? 'Update Invoice' : 'Save & Issue Invoice'}
              </button>
            </div>
          </div>

          {/* Core Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Invoice No. *</label>
              <input
                type="text"
                value={invoiceForm.invoiceNo}
                onChange={e => setInvoiceForm(f => ({ ...f, invoiceNo: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Invoice Date *</label>
              <input
                type="date"
                value={invoiceForm.invoiceDate}
                onChange={e => setInvoiceForm(f => ({ ...f, invoiceDate: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Due Date</label>
              <input
                type="date"
                value={invoiceForm.dueDate}
                onChange={e => setInvoiceForm(f => ({ ...f, dueDate: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>GST Tax Type</label>
              <select
                value={invoiceForm.taxType}
                onChange={e => setInvoiceForm(f => ({ ...f, taxType: e.target.value }))}
                style={inputStyle}
              >
                <option value="CGST_SGST">Intra-State (CGST 9% + SGST 9%)</option>
                <option value="IGST">Inter-State (IGST 18%)</option>
              </select>
            </div>
          </div>

          {/* Customer Selection */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>🏢 Billed To (Customer Details)</div>
              <button type="button" onClick={() => setShowCustomerModal(true)} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}>
                + Add New Customer
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
              <div>
                <label style={labelStyle}>Select Saved Customer</label>
                <select
                  onChange={e => handleCustomerSelect(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => (
                    <option key={c._id} value={c.name}>{c.businessName ? `${c.businessName} (${c.name})` : c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Customer / Party Name *</label>
                <input
                  type="text"
                  value={invoiceForm.customer.name}
                  onChange={e => setInvoiceForm(f => ({ ...f, customer: { ...f.customer, name: e.target.value } }))}
                  style={inputStyle}
                  placeholder="e.g. Acme Prints Ltd."
                />
              </div>

              <div>
                <label style={labelStyle}>GSTIN Number</label>
                <input
                  type="text"
                  value={invoiceForm.customer.gstin}
                  onChange={e => setInvoiceForm(f => ({ ...f, customer: { ...f.customer, gstin: e.target.value } }))}
                  style={inputStyle}
                  placeholder="e.g. 24AAAFE1234F1Z5"
                />
              </div>

              <div>
                <label style={labelStyle}>Billing Address</label>
                <input
                  type="text"
                  value={invoiceForm.customer.billingAddress}
                  onChange={e => setInvoiceForm(f => ({ ...f, customer: { ...f.customer, billingAddress: e.target.value } }))}
                  style={inputStyle}
                  placeholder="Street / Area / City"
                />
              </div>
            </div>
          </div>

          {/* Dynamic Products / Line Items Table */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '1rem', overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>📦 Invoice Line Items</div>
              <button type="button" onClick={handleAddItemRow} className="btn-secondary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.75rem' }}>
                <Plus size={13} /> Add Item Row
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light)', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.5rem' }}>Item Description</th>
                  <th style={{ padding: '0.5rem', width: '90px' }}>HSN</th>
                  <th style={{ padding: '0.5rem', width: '80px' }}>Qty</th>
                  <th style={{ padding: '0.5rem', width: '90px' }}>Unit</th>
                  <th style={{ padding: '0.5rem', width: '110px' }}>Price (₹)</th>
                  <th style={{ padding: '0.5rem', width: '80px' }}>Disc %</th>
                  <th style={{ padding: '0.5rem', width: '80px' }}>GST %</th>
                  <th style={{ padding: '0.5rem', width: '110px', textAlign: 'right' }}>Total (₹)</th>
                  <th style={{ padding: '0.5rem', width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {invoiceForm.items.map((it, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '0.4rem' }}>
                      <input
                        type="text"
                        list={`items-list-${idx}`}
                        value={it.itemName}
                        onChange={e => handleItemChange(idx, 'itemName', e.target.value)}
                        placeholder="Type item or select..."
                        style={inputStyle}
                      />
                      <datalist id={`items-list-${idx}`}>
                        {itemsList.map(item => <option key={item._id} value={item.itemName} />)}
                      </datalist>
                    </td>
                    <td style={{ padding: '0.4rem' }}>
                      <input
                        type="text"
                        value={it.hsnCode}
                        onChange={e => handleItemChange(idx, 'hsnCode', e.target.value)}
                        style={inputStyle}
                      />
                    </td>
                    <td style={{ padding: '0.4rem' }}>
                      <input
                        type="number"
                        value={it.qty}
                        onChange={e => handleItemChange(idx, 'qty', e.target.value)}
                        style={inputStyle}
                      />
                    </td>
                    <td style={{ padding: '0.4rem' }}>
                      <select
                        value={it.unit}
                        onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                        style={inputStyle}
                      >
                        <option value="Meters">Meters</option>
                        <option value="Pcs">Pcs</option>
                        <option value="Rolls">Rolls</option>
                        <option value="Hours">Hours</option>
                      </select>
                    </td>
                    <td style={{ padding: '0.4rem' }}>
                      <input
                        type="number"
                        value={it.unitPrice}
                        onChange={e => handleItemChange(idx, 'unitPrice', e.target.value)}
                        style={inputStyle}
                      />
                    </td>
                    <td style={{ padding: '0.4rem' }}>
                      <input
                        type="number"
                        value={it.discountPct}
                        onChange={e => handleItemChange(idx, 'discountPct', e.target.value)}
                        style={inputStyle}
                      />
                    </td>
                    <td style={{ padding: '0.4rem' }}>
                      <select
                        value={it.taxRate}
                        onChange={e => handleItemChange(idx, 'taxRate', e.target.value)}
                        style={inputStyle}
                      >
                        <option value={0}>0%</option>
                        <option value={5}>5%</option>
                        <option value={12}>12%</option>
                        <option value={18}>18%</option>
                        <option value={28}>28%</option>
                      </select>
                    </td>
                    <td style={{ padding: '0.4rem', textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)' }}>
                      ₹ {((parseFloat(it.qty) || 0) * (parseFloat(it.unitPrice) || 0)).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                      <button type="button" onClick={() => handleRemoveItemRow(idx)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Summary & Tax Breakdown Box */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div>
                <label style={labelStyle}>Notes for Customer</label>
                <textarea
                  rows={2}
                  value={invoiceForm.notes}
                  onChange={e => setInvoiceForm(f => ({ ...f, notes: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Terms & Conditions</label>
                <textarea
                  rows={2}
                  value={invoiceForm.terms}
                  onChange={e => setInvoiceForm(f => ({ ...f, terms: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.1rem', background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.25)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
                <span style={{ fontWeight: 700 }}>₹ {calculatedInvoice.subtotal.toFixed(2)}</span>
              </div>

              {calculatedInvoice.discountTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#34d399' }}>
                  <span>Discount:</span>
                  <span>- ₹ {calculatedInvoice.discountTotal.toFixed(2)}</span>
                </div>
              )}

              {invoiceForm.taxType === 'IGST' ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>IGST Tax (18%):</span>
                  <span>₹ {calculatedInvoice.igstAmount.toFixed(2)}</span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>CGST Tax (9%):</span>
                    <span>₹ {calculatedInvoice.cgstAmount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>SGST Tax (9%):</span>
                    <span>₹ {calculatedInvoice.sgstAmount.toFixed(2)}</span>
                  </div>
                </>
              )}

              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800, color: '#a78bfa' }}>
                <span>Grand Total:</span>
                <span>₹ {calculatedInvoice.grandTotal.toFixed(2)}</span>
              </div>

              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                Amount in Words: {numToWords(calculatedInvoice.grandTotal)}
              </div>

              <div style={{ marginTop: '0.8rem', paddingTop: '0.6rem', borderTop: '1px dashed var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Advance / Paid (₹)</label>
                  <input
                    type="number"
                    value={invoiceForm.paidAmount}
                    onChange={e => setInvoiceForm(f => ({ ...f, paidAmount: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>BALANCE DUE</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: calculatedInvoice.balanceDue > 0 ? '#f87171' : '#34d399' }}>
                    ₹ {calculatedInvoice.balanceDue.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── RECORD PAYMENT MODAL ────────────────────────────────────────────── */}
      {paymentModalInvoice && (
        <div className="modal-overlay" style={{ alignItems: 'center' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Record Payment — {paymentModalInvoice.invoiceNo}</h3>
              <button onClick={() => setPaymentModalInvoice(null)} className="btn-icon"><X size={16} /></button>
            </div>

            <div>
              <label style={labelStyle}>Payment Amount (₹) *</label>
              <input
                type="number"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Payment Mode</label>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)} style={inputStyle}>
                <option value="UPI / GPay / PhonePe">UPI / GPay / PhonePe</option>
                <option value="Bank Transfer (NEFT/RTGS)">Bank Transfer (NEFT/RTGS)</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Transaction / Reference No</label>
              <input
                type="text"
                value={payRef}
                onChange={e => setPayRef(e.target.value)}
                placeholder="e.g. UTR123456789"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button className="btn-secondary" onClick={() => setPaymentModalInvoice(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleSavePayment} disabled={submittingPay} style={{ background: '#10b981' }}>
                {submittingPay ? 'Recording...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE CUSTOMER MODAL ───────────────────────────────────────────── */}
      {showCustomerModal && (
        <div className="modal-overlay" style={{ alignItems: 'center' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '450px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Add New Customer / Client</h3>
              <button onClick={() => setShowCustomerModal(false)} className="btn-icon"><X size={16} /></button>
            </div>

            <div>
              <label style={labelStyle}>Contact Person Name *</label>
              <input type="text" value={custForm.name} onChange={e => setCustForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Business / Company Name</label>
              <input type="text" value={custForm.businessName} onChange={e => setCustForm(f => ({ ...f, businessName: e.target.value }))} style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input type="text" value={custForm.phone} onChange={e => setCustForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>GSTIN Number</label>
                <input type="text" value={custForm.gstin} onChange={e => setCustForm(f => ({ ...f, gstin: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Billing Address</label>
              <textarea rows={2} value={custForm.billingAddress} onChange={e => setCustForm(f => ({ ...f, billingAddress: e.target.value }))} style={inputStyle} />
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button className="btn-secondary" onClick={() => setShowCustomerModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveCustomer}>Save Customer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE ITEM MODAL ──────────────────────────────────────────────── */}
      {showItemModal && (
        <div className="modal-overlay" style={{ alignItems: 'center' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Add Billing Product / Service</h3>
              <button onClick={() => setShowItemModal(false)} className="btn-icon"><X size={16} /></button>
            </div>

            <div>
              <label style={labelStyle}>Product / Service Name *</label>
              <input type="text" value={itemForm.itemName} onChange={e => setItemForm(f => ({ ...f, itemName: e.target.value }))} style={inputStyle} placeholder="e.g. Digital Printing Service" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div>
                <label style={labelStyle}>HSN Code</label>
                <input type="text" value={itemForm.hsnCode} onChange={e => setItemForm(f => ({ ...f, hsnCode: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Unit Price (₹) *</label>
                <input type="number" value={itemForm.unitPrice} onChange={e => setItemForm(f => ({ ...f, unitPrice: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div>
                <label style={labelStyle}>Unit</label>
                <select value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))} style={inputStyle}>
                  <option value="Meters">Meters</option>
                  <option value="Pcs">Pcs</option>
                  <option value="Rolls">Rolls</option>
                  <option value="Hours">Hours</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Default GST %</label>
                <select value={itemForm.taxRate} onChange={e => setItemForm(f => ({ ...f, taxRate: e.target.value }))} style={inputStyle}>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                  <option value={28}>28%</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button className="btn-secondary" onClick={() => setShowItemModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveItem}>Save Product</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const labelStyle = {
  fontSize: '0.7rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  marginBottom: '0.3rem',
  display: 'block'
};

const inputStyle = {
  width: '100%',
  padding: '0.5rem 0.7rem',
  fontSize: '0.85rem',
  background: 'var(--bg-input, #161b26)',
  border: '1px solid var(--border-light, #2d3748)',
  borderRadius: 'var(--radius-sm, 6px)',
  color: 'var(--text-primary, #f7fafc)',
  boxSizing: 'border-box'
};
