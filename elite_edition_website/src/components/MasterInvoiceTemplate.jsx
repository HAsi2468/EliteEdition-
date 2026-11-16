import React, { useMemo, useState } from 'react';

/**
 * Helper to blend a hex color towards white (#ffffff) by a given factor (0.0 to 1.0).
 * factor = 0.50 produces an exact 50% lighter shade of the Original department color.
 */
export const tintHexColor = (hex, factor = 0.5) => {
  const clean = String(hex || '#1e3a8a').replace('#', '').trim();
  const num = parseInt(clean, 16);
  const r = isNaN(num) ? 30 : (num >> 16) & 255;
  const g = isNaN(num) ? 58 : (num >> 8) & 255;
  const b = isNaN(num) ? 138 : num & 255;
  const tr = Math.round(r + (255 - r) * factor);
  const tg = Math.round(g + (255 - g) * factor);
  const tb = Math.round(b + (255 - b) * factor);
  return `#${((1 << 24) + (tr << 16) + (tg << 8) + tb).toString(16).slice(1)}`;
};

export const isMeaningfulValue = (val) => {
  if (val === undefined || val === null) return false;
  const s = String(val).trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  return !['--', '-', '—', 'n/a', 'na', 'null', 'undefined', 'none'].includes(lower);
};

/**
 * Department Signature Brand Color Themes
 */
export const COMPANY_THEMES = {
  'elite digital print': {
    primary: '#1e3a8a',
    secondary: '#1d4ed8',
    lightBg: '#eff6ff',
    border: '#1e3a8a'
  },
  'elite digital prints': {
    primary: '#1e3a8a',
    secondary: '#1d4ed8',
    lightBg: '#eff6ff',
    border: '#1e3a8a'
  },
  'edp': {
    primary: '#1e3a8a',
    secondary: '#1d4ed8',
    lightBg: '#eff6ff',
    border: '#1e3a8a'
  },
  'elite edition': {
    primary: '#312e81',
    secondary: '#4338ca',
    lightBg: '#f5f3ff',
    border: '#312e81'
  },
  'ee': {
    primary: '#312e81',
    secondary: '#4338ca',
    lightBg: '#f5f3ff',
    border: '#312e81'
  },
  'elite stitching': {
    primary: '#064e3b',
    secondary: '#047857',
    lightBg: '#f0fdf4',
    border: '#064e3b'
  },
  'es': {
    primary: '#064e3b',
    secondary: '#047857',
    lightBg: '#f0fdf4',
    border: '#064e3b'
  },
  'ethno wear': {
    primary: '#8b5a2b',
    secondary: '#a06d3b',
    lightBg: '#fcf6f0',
    border: '#8b5a2b'
  },
  'elite ethnowear': {
    primary: '#8b5a2b',
    secondary: '#a06d3b',
    lightBg: '#fcf6f0',
    border: '#8b5a2b'
  },
  'ew': {
    primary: '#8b5a2b',
    secondary: '#a06d3b',
    lightBg: '#fcf6f0',
    border: '#8b5a2b'
  },
  'elite fabtex': {
    primary: '#d97706',
    secondary: '#b45309',
    lightBg: '#fffbeb',
    border: '#d97706'
  },
  'ef': {
    primary: '#d97706',
    secondary: '#b45309',
    lightBg: '#fffbeb',
    border: '#d97706'
  },
  'sobise': {
    primary: '#e11d48',
    secondary: '#be123c',
    lightBg: '#fff1f2',
    border: '#e11d48'
  },
  'so': {
    primary: '#e11d48',
    secondary: '#be123c',
    lightBg: '#fff1f2',
    border: '#e11d48'
  },
  'yamunaji': {
    primary: '#581c87',
    secondary: '#6b21a8',
    lightBg: '#faf5ff',
    border: '#581c87'
  },
  'yj': {
    primary: '#581c87',
    secondary: '#6b21a8',
    lightBg: '#faf5ff',
    border: '#581c87'
  },
  'elite online': {
    primary: '#0284c7',
    secondary: '#0369a1',
    lightBg: '#f0f9ff',
    border: '#0284c7'
  },
  'eon': {
    primary: '#0284c7',
    secondary: '#0369a1',
    lightBg: '#f0f9ff',
    border: '#0284c7'
  },
  'exedp': {
    primary: '#1e293b',
    secondary: '#334155',
    lightBg: '#f8fafc',
    border: '#1e293b'
  }
};

export const getCompanyTheme = (companyEntity = '', isDuplicate = false) => {
  const norm = String(companyEntity || '').trim().toLowerCase();
  let base = COMPANY_THEMES[norm];
  if (!base) {
    if (norm.includes('stitching')) base = COMPANY_THEMES['elite stitching'];
    else if (norm.includes('fabtex')) base = COMPANY_THEMES['elite fabtex'];
    else if (norm.includes('edition')) base = COMPANY_THEMES['elite edition'];
    else if (norm.includes('sobise')) base = COMPANY_THEMES['sobise'];
    else if (norm.includes('ethno')) base = COMPANY_THEMES['ethno wear'];
    else if (norm.includes('yamuna')) base = COMPANY_THEMES['yamunaji'];
    else if (norm.includes('online')) base = COMPANY_THEMES['elite online'];
    else if (norm.includes('exedp')) base = COMPANY_THEMES['exedp'];
    else base = COMPANY_THEMES['elite digital print'];
  }
  if (!isDuplicate) return base;
  const dupPrimary = tintHexColor(base.primary, 0.50);
  return {
    primary: dupPrimary,
    secondary: tintHexColor(base.secondary || base.primary, 0.50),
    lightBg: tintHexColor(base.primary, 0.95),
    border: dupPrimary
  };
};

const numberToWordsIndian = (num) => {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n) => {
    let str = '';
    if (n > 99) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
    } else {
      str += a[n];
    }
    return str.trim();
  };

  const n = Math.floor(Math.abs(num || 0));
  if (n === 0) return 'Rupees Zero Only';

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const remainder = n % 1000;

  let res = '';
  if (crore > 0) res += inWords(crore) + ' Crore ';
  if (lakh > 0) res += inWords(lakh) + ' Lakh ';
  if (thousand > 0) res += inWords(thousand) + ' Thousand ';
  if (remainder > 0) res += inWords(remainder);

  const decimals = Math.round((Math.abs(num || 0) - n) * 100);
  let paiseStr = '';
  if (decimals > 0) {
    paiseStr = ' and ' + inWords(decimals) + ' Paise';
  }

  return 'Rupees ' + res.trim() + paiseStr + ' Only';
};

const formatDateVal = (val) => {
  if (!isMeaningfulValue(val)) return '';
  const dt = new Date(val);
  if (isNaN(dt.getTime())) return String(val);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

function SingleInvoiceSheet({ invoice = {}, printConfig = {}, baseTheme, isDuplicate = false, copyLabel }) {
  const activePrimary = isDuplicate ? tintHexColor(baseTheme.primary, 0.50) : baseTheme.primary;
  const activeBorder = activePrimary;
  const activeHeaderBg = tintHexColor(activePrimary, 0.94);
  const activeBadgeBg = tintHexColor(activePrimary, 0.88);
  const activeSubtleBorder = tintHexColor(activePrimary, 0.76);

  const effectiveCompany = invoice.companyEntity || printConfig.companyEntity || 'Elite Digital Print';
  const companyName = (printConfig.companyName || effectiveCompany || '').toUpperCase();
  const companyGstin = isMeaningfulValue(printConfig.companyGstin || invoice.companyGstin) ? String(printConfig.companyGstin || invoice.companyGstin).trim() : '';
  const companyAddress = isMeaningfulValue(printConfig.companyAddress || invoice.companyAddress) ? String(printConfig.companyAddress || invoice.companyAddress).trim() : '';
  const companyPhone = isMeaningfulValue(printConfig.companyPhone || invoice.companyPhone) ? String(printConfig.companyPhone || invoice.companyPhone).trim() : '';
  const companyEmail = isMeaningfulValue(printConfig.companyEmail || invoice.companyEmail) ? String(printConfig.companyEmail || invoice.companyEmail).trim() : '';
  const companyState = isMeaningfulValue(printConfig.companyState || invoice.companyState) ? String(printConfig.companyState || invoice.companyState).trim() : '';
  const companyStateCode = isMeaningfulValue(printConfig.companyStateCode || invoice.companyStateCode) ? String(printConfig.companyStateCode || invoice.companyStateCode).trim() : '';
  const companyPan = isMeaningfulValue(printConfig.companyPan || invoice.companyPan)
    ? String(printConfig.companyPan || invoice.companyPan).trim()
    : (companyGstin.length >= 12 ? companyGstin.substring(2, 12) : '');

  // Customer Details (strictly dynamic)
  const cust = invoice.customer || {};
  const customerName = isMeaningfulValue(cust.businessName || cust.name || invoice.partyName || invoice.customerName)
    ? String(cust.businessName || cust.name || invoice.partyName || invoice.customerName).trim()
    : '';
  const customerGstin = isMeaningfulValue(cust.gstin || invoice.customerGstin) ? String(cust.gstin || invoice.customerGstin).trim() : '';
  const customerAddress = isMeaningfulValue(cust.billingAddress || cust.shippingAddress || invoice.billingAddress)
    ? String(cust.billingAddress || cust.shippingAddress || invoice.billingAddress).trim()
    : '';
  const customerState = isMeaningfulValue(cust.state || invoice.customerState) ? String(cust.state || invoice.customerState).trim() : '';
  const customerStateCode = isMeaningfulValue(cust.stateCode || invoice.customerStateCode) ? String(cust.stateCode || invoice.customerStateCode).trim() : '';
  const customerPan = isMeaningfulValue(cust.pan)
    ? String(cust.pan).trim()
    : (customerGstin.length >= 12 ? customerGstin.substring(2, 12) : '');

  // Invoice Dates & Metadata (strictly dynamic)
  const invNo = isMeaningfulValue(invoice.invoiceNo) ? String(invoice.invoiceNo).trim() : '';
  const invDate = formatDateVal(invoice.invoiceDate);
  const dueDate = formatDateVal(invoice.dueDate || invoice.paymentDueDate);
  const placeOfSupply = isMeaningfulValue(invoice.placeOfSupply || printConfig.placeOfSupply)
    ? String(invoice.placeOfSupply || printConfig.placeOfSupply).trim()
    : (customerState ? `${customerState}${customerStateCode ? ` (${customerStateCode})` : ''}` : '');

  // Dispatch / Order / Challan Details (only populated fields)
  const challanNos = isMeaningfulValue(invoice.ourChallanNo)
    ? String(invoice.ourChallanNo).trim()
    : (Array.isArray(invoice.linkedChallanNos) && invoice.linkedChallanNos.filter(Boolean).length > 0
      ? invoice.linkedChallanNos.filter(Boolean).join(', ')
      : (isMeaningfulValue(invoice.challanNo) ? String(invoice.challanNo).trim() : ''));

  const dispatchedThrough = isMeaningfulValue(invoice.transport || invoice.dispatchThrough || invoice.dispatchedThrough || invoice.deliveryBy)
    ? String(invoice.transport || invoice.dispatchThrough || invoice.dispatchedThrough || invoice.deliveryBy).trim()
    : '';
  const agentOrBroker = isMeaningfulValue(invoice.agentName || invoice.brokerName)
    ? String(invoice.agentName || invoice.brokerName).trim()
    : '';
  const termsOfDelivery = isMeaningfulValue(invoice.deliveryTerms || invoice.termsOfDelivery || invoice.destination)
    ? String(invoice.deliveryTerms || invoice.termsOfDelivery || invoice.destination).trim()
    : '';
  const vehicleNo = isMeaningfulValue(invoice.vehicleNo || invoice.motorVehicleNo)
    ? String(invoice.vehicleNo || invoice.motorVehicleNo).trim()
    : '';
  const eWayBillNo = isMeaningfulValue(invoice.eWayBillNo)
    ? String(invoice.eWayBillNo).trim()
    : '';
  const poNumber = isMeaningfulValue(invoice.poNumber || invoice.buyersOrderNo)
    ? String(invoice.poNumber || invoice.buyersOrderNo).trim()
    : '';

  const dispatchEntries = [];
  if (challanNos) dispatchEntries.push({ label: 'Challan No.', value: challanNos });
  if (dispatchedThrough) dispatchEntries.push({ label: 'Dispatched Through', value: dispatchedThrough });
  if (agentOrBroker) dispatchEntries.push({ label: 'Agent / Broker', value: agentOrBroker, accent: true });
  if (termsOfDelivery) dispatchEntries.push({ label: 'Terms of Delivery', value: termsOfDelivery });
  if (vehicleNo) dispatchEntries.push({ label: 'Vehicle No.', value: vehicleNo });
  if (eWayBillNo) dispatchEntries.push({ label: 'E-Way Bill No.', value: eWayBillNo });
  if (poNumber) dispatchEntries.push({ label: 'Buyer Order No.', value: poNumber });

  // Items & Dynamic Column Detection
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const hasAnyImage = items.some(it => isMeaningfulValue(it.imageUrl || it.designImageUrl || it.image || it.thumbnailUrl));
  const hasAnyDiscount = items.some(it => Number(it.discountPct || it.discountPercent || it.discountAmount || 0) > 0);
  const overallUnit = (items[0] && (items[0].unit || items[0].qtyUnit)) || 'MTR';

  const totalQty = items.reduce((sum, it) => sum + Number(it.qty || it.quantity || 0), 0);
  const subtotal = Number(invoice.subtotal || items.reduce((sum, it) => sum + Number(it.totalAmount != null ? it.totalAmount : (Number(it.qty || 0) * Number(it.unitPrice || it.rate || 0))), 0));

  // Taxes & Totals
  const isIgst = invoice.taxType === 'IGST' || Number(invoice.igstAmount) > 0;
  const totalTax = Number(invoice.totalTax != null ? invoice.totalTax : (Number(invoice.cgstAmount || 0) + Number(invoice.sgstAmount || 0) + Number(invoice.igstAmount || 0)));
  const cgstAmount = Number(invoice.cgstAmount != null ? invoice.cgstAmount : (isIgst ? 0 : totalTax / 2));
  const sgstAmount = Number(invoice.sgstAmount != null ? invoice.sgstAmount : (isIgst ? 0 : totalTax / 2));
  const igstAmount = Number(invoice.igstAmount != null ? invoice.igstAmount : (isIgst ? totalTax : 0));
  const roundOff = Number(invoice.roundOff || 0);
  const grandTotal = Number(invoice.grandTotal || (subtotal + totalTax + roundOff));

  // TDS
  const hasTds = Boolean(invoice.enableTds && Number(invoice.tdsAmount) > 0);
  const tdsSection = invoice.tdsSection || '194C';
  const tdsRate = Number(invoice.tdsRate || 2);
  const tdsAmount = Number(invoice.tdsAmount || 0);
  const netReceivable = Math.max(0, grandTotal - tdsAmount);

  // Bank & Terms (strictly dynamic)
  const bankName = isMeaningfulValue((printConfig.companyBanks && printConfig.companyBanks[0]?.bankName) || printConfig.companyBankName || invoice.bankName)
    ? String((printConfig.companyBanks && printConfig.companyBanks[0]?.bankName) || printConfig.companyBankName || invoice.bankName).trim()
    : '';
  const bankAccount = isMeaningfulValue((printConfig.companyBanks && printConfig.companyBanks[0]?.accountNo) || printConfig.companyAccountNo || invoice.bankAccountNo)
    ? String((printConfig.companyBanks && printConfig.companyBanks[0]?.accountNo) || printConfig.companyAccountNo || invoice.bankAccountNo).trim()
    : '';
  const bankIfsc = isMeaningfulValue((printConfig.companyBanks && printConfig.companyBanks[0]?.ifscCode) || printConfig.companyIfscCode || invoice.bankIfsc)
    ? String((printConfig.companyBanks && printConfig.companyBanks[0]?.ifscCode) || printConfig.companyIfscCode || invoice.bankIfsc).trim()
    : '';
  const termsText = isMeaningfulValue(invoice.terms || invoice.termsAndConditions || invoice.notes || printConfig.companyTerms)
    ? String(invoice.terms || invoice.termsAndConditions || invoice.notes || printConfig.companyTerms).trim()
    : '';

  const firstHsnCode = items.map(it => it.hsnCode || it.hsn).find(isMeaningfulValue) || '';
  const totalColCount = 7 + (hasAnyImage ? 1 : 0) + (hasAnyDiscount ? 1 : 0);

  return (
    <div
      className="master-invoice-sheet"
      style={{
        width: '100%',
        maxWidth: '800px',
        minHeight: '1050px',
        margin: '0 auto',
        background: '#ffffff',
        border: `1.5px solid ${activeBorder}`,
        borderRadius: '6px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        color: '#000000',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '10px',
        lineHeight: 1.25
      }}
    >
      {/* ── 1. HEADER ────────────────────── */}
      <div
        style={{
          background: `linear-gradient(135deg, ${activeHeaderBg} 0%, #ffffff 100%)`,
          borderBottom: `3px solid ${activePrimary}`,
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}
      >
        <div style={{ maxWidth: '60%' }}>
          <div
            style={{
              fontSize: '21px',
              fontWeight: 900,
              color: activePrimary,
              letterSpacing: '-0.3px',
              marginBottom: '4px'
            }}
          >
            {companyName}
          </div>
          {companyAddress && (
            <div style={{ fontSize: '11px', color: '#475569', marginBottom: '2px' }}>
              {companyAddress}
            </div>
          )}
          {(companyPhone || companyEmail) && (
            <div style={{ fontSize: '10.5px', color: '#475569' }}>
              {companyPhone && (
                <span>
                  Phone: <strong style={{ color: '#0f172a' }}>{companyPhone}</strong>
                </span>
              )}
              {companyPhone && companyEmail && ' • '}
              {companyEmail && <span>Email: {companyEmail}</span>}
            </div>
          )}
          {(companyGstin || companyState || companyPan) && (
            <div style={{ marginTop: '5px', fontSize: '11px' }}>
              {companyGstin && (
                <span style={{ display: 'inline-block', marginRight: '12px' }}>
                  GSTIN: <strong style={{ color: activePrimary, fontFamily: 'monospace' }}>{companyGstin}</strong>
                </span>
              )}
              {companyState && (
                <span>
                  State: <strong>{companyState}{companyStateCode ? ` (${companyStateCode})` : ''}</strong>
                </span>
              )}
              {companyPan && (
                <span style={{ marginLeft: '12px' }}>
                  PAN: <strong>{companyPan}</strong>
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              display: 'inline-block',
              background: activeBadgeBg,
              color: activePrimary,
              border: `1px solid ${activeSubtleBorder}`,
              padding: '3px 10px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}
          >
            {copyLabel}
          </span>
          {invNo && (
            <div
              style={{
                fontSize: '20px',
                fontWeight: 900,
                color: '#0f172a',
                marginTop: '5px',
                letterSpacing: '-0.3px'
              }}
            >
              {invNo}
            </div>
          )}
          {invDate && (
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>
              Invoice Date: <strong style={{ color: '#0f172a' }}>{invDate}</strong>
            </div>
          )}
          {dueDate && (
            <div style={{ fontSize: '10.5px', color: '#b45309', marginTop: '2px' }}>
              Due Date: <strong>{dueDate}</strong>
            </div>
          )}
          {placeOfSupply && (
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
              Place of Supply: <strong>{placeOfSupply}</strong>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. BILL TO & DYNAMIC DISPATCH SECTION ────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: dispatchEntries.length > 0 ? '1.1fr 1fr' : '1fr',
          borderBottom: `1.5px solid ${activeBorder}`
        }}
      >
        <div style={{ borderRight: dispatchEntries.length > 0 ? `1.5px solid ${activeBorder}` : 'none' }}>
          <div
            style={{
              background: activePrimary,
              color: '#ffffff',
              fontSize: '9px',
              fontWeight: 800,
              padding: '3.5px 8px',
              letterSpacing: '0.4px',
              textTransform: 'uppercase'
            }}
          >
            BILL TO
          </div>
          <div style={{ padding: '8px 12px', fontSize: '9.5px', lineHeight: 1.35 }}>
            {customerName && (
              <div style={{ fontSize: '12px', fontWeight: 900, color: '#000000', letterSpacing: '-0.2px' }}>
                {customerName}
              </div>
            )}
            {customerAddress && (
              <div style={{ color: '#475569', fontSize: '10px', marginTop: '2px', lineHeight: 1.35 }}>
                {customerAddress}
              </div>
            )}
            {(customerGstin || customerState || customerPan) && (
              <div style={{ marginTop: '5px', fontSize: '10.5px' }}>
                {customerGstin && (
                  <span style={{ display: 'inline-block', marginRight: '12px' }}>
                    GSTIN: <strong style={{ color: activePrimary, fontFamily: 'monospace' }}>{customerGstin}</strong>
                  </span>
                )}
                {customerState && (
                  <span>
                    State: <strong>{customerState}{customerStateCode ? ` (${customerStateCode})` : ''}</strong>
                  </span>
                )}
                {customerPan && (
                  <span style={{ marginLeft: '12px' }}>
                    PAN: <strong>{customerPan}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {dispatchEntries.length > 0 && (
          <div>
            <div
              style={{
                background: activePrimary,
                color: '#ffffff',
                fontSize: '9px',
                fontWeight: 800,
                padding: '3.5px 8px',
                letterSpacing: '0.4px',
                textTransform: 'uppercase'
              }}
            >
              DISPATCH & ORDER DETAILS
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                padding: '6px 10px',
                gap: '6px 12px',
                fontSize: '9px'
              }}
            >
              {dispatchEntries.map((entry, i) => (
                <div key={i}>
                  <div style={{ color: '#475569', fontSize: '8.5px' }}>{entry.label}:</div>
                  <div
                    style={{
                      fontWeight: 800,
                      marginTop: '1px',
                      fontSize: '9.5px',
                      color: entry.accent ? activePrimary : '#0f172a'
                    }}
                  >
                    {entry.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 3. ITEMS TABLE ────────────────────── */}
      <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: '260px' }}>
        <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', fontSize: '9.5px' }}>
          <thead>
            <tr style={{ background: activePrimary, color: '#ffffff', fontSize: '9px', fontWeight: 800 }}>
              <th style={{ width: '25px', padding: '6px 4px', border: `1px solid ${activePrimary}`, textAlign: 'center' }}>Sr.</th>
              {hasAnyImage && (
                <th style={{ width: '55px', padding: '6px 4px', border: `1px solid ${activePrimary}`, textAlign: 'center' }}>Image</th>
              )}
              <th style={{ padding: '6px 8px', border: `1px solid ${activePrimary}`, textAlign: 'left' }}>Description of Goods</th>
              <th style={{ width: '50px', padding: '6px 4px', border: `1px solid ${activePrimary}`, textAlign: 'center' }}>HSN</th>
              <th style={{ width: '45px', padding: '6px 4px', border: `1px solid ${activePrimary}`, textAlign: 'center' }}>GST%</th>
              <th style={{ width: '60px', padding: '6px 4px', border: `1px solid ${activePrimary}`, textAlign: 'right' }}>Qty</th>
              <th style={{ width: '50px', padding: '6px 4px', border: `1px solid ${activePrimary}`, textAlign: 'right' }}>Rate</th>
              <th style={{ width: '40px', padding: '6px 4px', border: `1px solid ${activePrimary}`, textAlign: 'center' }}>Per</th>
              {hasAnyDiscount && (
                <th style={{ width: '45px', padding: '6px 4px', border: `1px solid ${activePrimary}`, textAlign: 'right' }}>Disc%</th>
              )}
              <th style={{ width: '75px', padding: '6px 8px', border: `1px solid ${activePrimary}`, textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const qty = Number(it.qty || it.quantity || 0);
              const rate = Number(it.unitPrice != null ? it.unitPrice : (it.rate || 0));
              const lineAmt = Number(it.totalAmount != null ? it.totalAmount : (qty * rate));
              const itemUnit = it.unit || it.qtyUnit || overallUnit;
              const itemImg = it.imageUrl || it.designImageUrl || it.image || it.thumbnailUrl || '';
              const itemName = isMeaningfulValue(it.itemName || it.description) ? String(it.itemName || it.description).trim() : '';
              const designNo = isMeaningfulValue(it.designNo) ? String(it.designNo).trim() : '';
              const jobNo = isMeaningfulValue(it.jobNo || it.jobCardNo) ? String(it.jobNo || it.jobCardNo).trim() : '';
              const itemChallan = isMeaningfulValue(it.ourChallanNo) ? String(it.ourChallanNo).trim() : '';
              const fabricStr = isMeaningfulValue(it.fabric || it.fabricName) ? String(it.fabric || it.fabricName).trim() : '';
              const lotStr = isMeaningfulValue(it.lotNo) ? String(it.lotNo).trim() : '';
              const partyChallanStr = isMeaningfulValue(it.partyChallan || it.partyChallanNo) ? String(it.partyChallan || it.partyChallanNo).trim() : '';
              const itemHsn = isMeaningfulValue(it.hsnCode || it.hsn) ? String(it.hsnCode || it.hsn).trim() : '';
              const itemTaxRate = it.taxRate != null ? Number(it.taxRate) : (totalTax > 0 ? 5 : 0);
              const discPct = Number(it.discountPct || it.discountPercent || 0);
              const discAmt = Number(it.discountAmount || 0);

              const jobChallanParts = [];
              if (jobNo) jobChallanParts.push(`Job Card: ${jobNo}`);
              if (itemChallan) jobChallanParts.push(`Challan: ${itemChallan}`);

              const fabricLotParts = [];
              if (fabricStr) fabricLotParts.push(`Fabric: ${fabricStr}`);
              if (lotStr) fabricLotParts.push(`Lot: ${lotStr}`);

              return (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ textAlign: 'center', fontWeight: 700, padding: '6px 4px', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1' }}>
                    {idx + 1}
                  </td>
                  {hasAnyImage && (
                    <td style={{ textAlign: 'center', padding: '4px', borderRight: '1px solid #cbd5e1' }}>
                      {isMeaningfulValue(itemImg) && (
                        <div style={{ width: '44px', height: '44px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '3px', margin: '0 auto', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src={itemImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )}
                    </td>
                  )}
                  <td style={{ padding: '6px 8px', borderRight: '1px solid #cbd5e1' }}>
                    {itemName && <div style={{ fontWeight: 900, fontSize: '10.5px' }}>{itemName}</div>}
                    {designNo && (
                      <div style={{ fontSize: '8.5px', fontWeight: 700, color: activePrimary, marginTop: '1px' }}>
                        Design No: {designNo}
                      </div>
                    )}
                    {jobChallanParts.length > 0 && (
                      <div style={{ fontSize: '8.5px', color: '#0f172a' }}>
                        {jobChallanParts.join('  |  ')}
                      </div>
                    )}
                    {fabricLotParts.length > 0 && (
                      <div style={{ fontSize: '8.5px', color: '#0f172a' }}>
                        {fabricLotParts.join('  |  ')}
                      </div>
                    )}
                    {partyChallanStr && (
                      <div style={{ fontSize: '8.5px', color: '#0f172a' }}>
                        Party Challan: {partyChallanStr}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', fontFamily: 'monospace', padding: '6px 4px', borderRight: '1px solid #cbd5e1' }}>
                    {itemHsn}
                  </td>
                  <td style={{ textAlign: 'center', padding: '6px 4px', borderRight: '1px solid #cbd5e1' }}>
                    {itemTaxRate > 0 ? `${itemTaxRate}%` : ''}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, padding: '6px 4px', borderRight: '1px solid #cbd5e1' }}>
                    {qty.toFixed(2)}<br /><span style={{ fontSize: '8px', color: '#64748b' }}>{itemUnit}</span>
                  </td>
                  <td style={{ textAlign: 'right', padding: '6px 4px', borderRight: '1px solid #cbd5e1' }}>
                    {rate.toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'center', padding: '6px 4px', borderRight: '1px solid #cbd5e1' }}>
                    {itemUnit}
                  </td>
                  {hasAnyDiscount && (
                    <td style={{ textAlign: 'right', padding: '6px 4px', borderRight: '1px solid #cbd5e1' }}>
                      {discPct > 0 ? `${discPct}%` : (discAmt > 0 ? `₹${discAmt.toFixed(2)}` : '')}
                    </td>
                  )}
                  <td style={{ textAlign: 'right', fontWeight: 800, padding: '6px 8px', borderRight: '1px solid #cbd5e1' }}>
                    {lineAmt.toFixed(2)}
                  </td>
                </tr>
              );
            })}
            <tr style={{ height: '100%' }}>
              {Array.from({ length: totalColCount }).map((_, cIdx) => (
                <td
                  key={cIdx}
                  style={{
                    borderLeft: cIdx === 0 ? '1px solid #cbd5e1' : 'none',
                    borderRight: '1px solid #cbd5e1',
                    borderBottom: 'none'
                  }}
                />
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── 4. BOTTOM TOTALS, HSN & FOOTER ──────────────────────────────────────── */}
      <div style={{ flex: '0 0 auto', marginTop: 'auto' }}>
        <div style={{ borderTop: `1px solid ${activeBorder}`, borderBottom: `1px solid ${activeBorder}` }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 12px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ flex: 1, textAlign: 'right', fontWeight: 800, paddingRight: '50px' }}>
              Total Qty: &nbsp;&nbsp; {totalQty.toFixed(2)} {overallUnit}
            </div>
            <div style={{ width: '90px', textAlign: 'right', fontWeight: 800 }}>{subtotal.toFixed(2)}</div>
          </div>

          {totalTax > 0 && (
            isIgst ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px 12px' }}>
                <div style={{ width: '130px', textAlign: 'right', paddingRight: '15px', fontWeight: 700, color: '#334155' }}>IGST @ 5%</div>
                <div style={{ width: '90px', textAlign: 'right', fontWeight: 800 }}>{igstAmount.toFixed(2)}</div>
              </div>
            ) : (
              <>
                {cgstAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px 12px' }}>
                    <div style={{ width: '130px', textAlign: 'right', paddingRight: '15px', fontWeight: 700, color: '#334155' }}>CGST @ 2.5%</div>
                    <div style={{ width: '90px', textAlign: 'right', fontWeight: 800 }}>{cgstAmount.toFixed(2)}</div>
                  </div>
                )}
                {sgstAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px 12px' }}>
                    <div style={{ width: '130px', textAlign: 'right', paddingRight: '15px', fontWeight: 700, color: '#334155' }}>SGST @ 2.5%</div>
                    <div style={{ width: '90px', textAlign: 'right', fontWeight: 800 }}>{sgstAmount.toFixed(2)}</div>
                  </div>
                )}
              </>
            )
          )}

          {roundOff !== 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px 12px' }}>
              <div style={{ width: '130px', textAlign: 'right', paddingRight: '15px', fontWeight: 700, color: '#334155' }}>Round Off</div>
              <div style={{ width: '90px', textAlign: 'right', fontWeight: 800 }}>
                {roundOff > 0 ? `+${roundOff.toFixed(2)}` : roundOff.toFixed(2)}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: activePrimary, color: '#ffffff', padding: '4px 12px', fontSize: '10.5px', fontWeight: 800 }}>
            <div>{totalQty.toFixed(2)} {overallUnit}</div>
            <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
              <span>Total</span>
              <span style={{ fontSize: '12px', fontWeight: 900 }}>Rs. {grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {hasTds && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 12px', background: '#fafafa' }}>
                <div style={{ width: '200px', textAlign: 'right', paddingRight: '15px', fontWeight: 700 }}>
                  Less: TDS ({tdsSection}) @ {tdsRate}%
                </div>
                <div style={{ width: '90px', textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>- {tdsAmount.toFixed(2)}</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: activePrimary, color: '#ffffff', padding: '4px 12px', fontSize: '10.5px', fontWeight: 800 }}>
                <div></div>
                <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                  <span>Net Receivable</span>
                  <span style={{ fontSize: '12px', fontWeight: 900 }}>Rs. {netReceivable.toFixed(2)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Words Bar */}
        <div style={{ padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', borderBottom: '1px solid #cbd5e1', background: '#f8fafc' }}>
          <div>
            <span style={{ fontWeight: 700 }}>Amount Chargeable (in words):</span><br />
            <strong style={{ fontSize: '10px' }}>{numberToWordsIndian(hasTds ? netReceivable : grandTotal)}</strong>
          </div>
          <div style={{ fontWeight: 800, fontSize: '9.5px', color: '#475569' }}>E. & O.E.</div>
        </div>

        {/* HSN Tax Table (Only when totalTax > 0) */}
        {totalTax > 0 && (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5px', borderBottom: `1px solid ${activeBorder}` }}>
              <thead>
                <tr style={{ background: activePrimary, color: '#ffffff', fontWeight: 800 }}>
                  <th style={{ width: '70px', textAlign: 'left', padding: '4px 8px', border: `1px solid ${activePrimary}` }}>HSN</th>
                  <th style={{ width: '90px', padding: '4px 6px', textAlign: 'right', border: `1px solid ${activePrimary}` }}>Taxable Value</th>
                  {isIgst ? (
                    <>
                      <th style={{ width: '70px', padding: '4px 6px', textAlign: 'center', border: `1px solid ${activePrimary}` }}>IGST %</th>
                      <th style={{ width: '90px', padding: '4px 6px', textAlign: 'right', border: `1px solid ${activePrimary}` }}>IGST Amount</th>
                    </>
                  ) : (
                    <>
                      <th style={{ width: '60px', padding: '4px 6px', textAlign: 'center', border: `1px solid ${activePrimary}` }}>CGST %</th>
                      <th style={{ width: '80px', padding: '4px 6px', textAlign: 'right', border: `1px solid ${activePrimary}` }}>CGST Amount</th>
                      <th style={{ width: '60px', padding: '4px 6px', textAlign: 'center', border: `1px solid ${activePrimary}` }}>SGST %</th>
                      <th style={{ width: '80px', padding: '4px 6px', textAlign: 'right', border: `1px solid ${activePrimary}` }}>SGST Amount</th>
                    </>
                  )}
                  <th style={{ width: '90px', padding: '4px 6px', textAlign: 'right', border: `1px solid ${activePrimary}` }}>Total Tax</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'left', padding: '3.5px 8px', fontWeight: 700, border: '1px solid #cbd5e1' }}>{firstHsnCode}</td>
                  <td style={{ padding: '3.5px 6px', textAlign: 'right', border: '1px solid #cbd5e1' }}>{subtotal.toFixed(2)}</td>
                  {isIgst ? (
                    <>
                      <td style={{ textAlign: 'center', padding: '3.5px 6px', border: '1px solid #cbd5e1' }}>5%</td>
                      <td style={{ padding: '3.5px 6px', textAlign: 'right', border: '1px solid #cbd5e1' }}>{igstAmount.toFixed(2)}</td>
                    </>
                  ) : (
                    <>
                      <td style={{ textAlign: 'center', padding: '3.5px 6px', border: '1px solid #cbd5e1' }}>2.5%</td>
                      <td style={{ padding: '3.5px 6px', textAlign: 'right', border: '1px solid #cbd5e1' }}>{cgstAmount.toFixed(2)}</td>
                      <td style={{ textAlign: 'center', padding: '3.5px 6px', border: '1px solid #cbd5e1' }}>2.5%</td>
                      <td style={{ padding: '3.5px 6px', textAlign: 'right', border: '1px solid #cbd5e1' }}>{sgstAmount.toFixed(2)}</td>
                    </>
                  )}
                  <td style={{ fontWeight: 700, padding: '3.5px 6px', textAlign: 'right', border: '1px solid #cbd5e1' }}>{totalTax.toFixed(2)}</td>
                </tr>
                <tr style={{ background: '#f8fafc', fontWeight: 800 }}>
                  <td style={{ textAlign: 'left', padding: '3.5px 8px', border: '1px solid #cbd5e1' }}>Total</td>
                  <td style={{ padding: '3.5px 6px', textAlign: 'right', border: '1px solid #cbd5e1' }}>{subtotal.toFixed(2)}</td>
                  {isIgst ? (
                    <>
                      <td style={{ border: '1px solid #cbd5e1' }}></td>
                      <td style={{ padding: '3.5px 6px', textAlign: 'right', border: '1px solid #cbd5e1' }}>{igstAmount.toFixed(2)}</td>
                    </>
                  ) : (
                    <>
                      <td style={{ border: '1px solid #cbd5e1' }}></td>
                      <td style={{ padding: '3.5px 6px', textAlign: 'right', border: '1px solid #cbd5e1' }}>{cgstAmount.toFixed(2)}</td>
                      <td style={{ border: '1px solid #cbd5e1' }}></td>
                      <td style={{ padding: '3.5px 6px', textAlign: 'right', border: '1px solid #cbd5e1' }}>{sgstAmount.toFixed(2)}</td>
                    </>
                  )}
                  <td style={{ padding: '3.5px 6px', textAlign: 'right', border: '1px solid #cbd5e1' }}>{totalTax.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ padding: '4px 12px', fontSize: '8.5px', borderBottom: '1px solid #cbd5e1' }}>
              <span style={{ fontWeight: 700 }}>Tax Amount (in words):</span> &nbsp;
              <span>{numberToWordsIndian(totalTax)}</span>
            </div>
          </>
        )}

        {/* Footer: Dynamic Bank Details, Terms & Signatory */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', padding: '8px 12px', fontSize: '8.5px', lineHeight: 1.35 }}>
          <div>
            {(bankName || bankAccount || bankIfsc) && (
              <>
                <div style={{ fontWeight: 800, textDecoration: 'underline', marginBottom: '2px' }}>Company&apos;s Bank Details:</div>
                {bankName && <div>Bank Name: <strong>{bankName}</strong></div>}
                {bankAccount && <div>A/c No.: <strong style={{ fontFamily: 'monospace' }}>{bankAccount}</strong></div>}
                {bankIfsc && <div>Branch &amp; IFS Code: <strong style={{ fontFamily: 'monospace' }}>{bankIfsc}</strong></div>}
              </>
            )}
            {termsText && (
              <>
                <div style={{ fontWeight: 800, marginTop: (bankName || bankAccount || bankIfsc) ? '6px' : '0' }}>Terms &amp; Conditions:</div>
                <div style={{ color: '#475569', fontSize: '8px' }}>{termsText}</div>
              </>
            )}
          </div>

          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 800, fontSize: '10px', color: activePrimary }}>
              For {companyName}
            </div>
            <div style={{ height: '35px' }}></div>
            <div style={{ width: '145px', marginLeft: 'auto', textAlign: 'center' }}>
              <div style={{ borderTop: '1.5px dashed #94a3b8', marginBottom: '4px' }}></div>
              <div style={{ fontWeight: 800, fontSize: '8.5px', color: '#000000' }}>
                Authorized Signatory
              </div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: '8px', color: '#475569', padding: '4px', borderTop: '1px solid #e2e8f0', background: '#fafafa' }}>
          This is a Computer Generated Document
        </div>
      </div>
    </div>
  );
}

export default function MasterInvoiceTemplate({
  invoice = {},
  printConfig = {},
  customTheme = null,
  defaultCopyView = 'both'
}) {
  const effectiveCompany = invoice.companyEntity || printConfig.companyEntity || 'Elite Digital Print';
  const baseTheme = useMemo(() => customTheme || getCompanyTheme(effectiveCompany, false), [effectiveCompany, customTheme]);
  const [copyView, setCopyView] = useState(defaultCopyView);

  const dupColorPreview = useMemo(() => tintHexColor(baseTheme.primary, 0.50), [baseTheme.primary]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      {/* Interactive Copy Switcher (hidden during print) */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: '800px',
          width: '100%',
          margin: '0 auto',
          padding: '8px 14px',
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(148, 163, 184, 0.22)',
          borderRadius: '10px',
          color: '#f8fafc',
          fontSize: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700 }}>
          <span
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '3px',
              background: baseTheme.primary,
              display: 'inline-block',
              border: '1px solid rgba(255,255,255,0.4)'
            }}
            title={`Original Color: ${baseTheme.primary}`}
          />
          <span>Original (100%)</span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '3px',
              background: dupColorPreview,
              display: 'inline-block',
              border: '1px solid rgba(255,255,255,0.4)'
            }}
            title={`Duplicate 50% Lighter Color: ${dupColorPreview}`}
          />
          <span>Duplicate (50% Lighter)</span>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { id: 'both', label: 'Both Copies' },
            { id: 'original', label: 'Original Only' },
            { id: 'duplicate', label: 'Duplicate (50% Lighter)' }
          ].map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setCopyView(opt.id)}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: copyView === opt.id ? `1px solid ${baseTheme.primary}` : '1px solid rgba(148,163,184,0.25)',
                background: copyView === opt.id ? baseTheme.primary : 'rgba(30, 41, 59, 0.7)',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {(copyView === 'both' || copyView === 'original') && (
        <SingleInvoiceSheet
          invoice={invoice}
          printConfig={printConfig}
          baseTheme={baseTheme}
          isDuplicate={false}
          copyLabel="ORIGINAL FOR RECIPIENT"
        />
      )}

      {(copyView === 'both' || copyView === 'duplicate') && (
        <div style={{ pageBreakBefore: copyView === 'both' ? 'always' : 'auto' }}>
          <SingleInvoiceSheet
            invoice={invoice}
            printConfig={printConfig}
            baseTheme={baseTheme}
            isDuplicate={true}
            copyLabel="DUPLICATE FOR TRANSPORTER"
          />
        </div>
      )}
    </div>
  );
}
