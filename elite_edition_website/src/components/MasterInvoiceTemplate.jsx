import React, { useMemo } from 'react';

/**
 * Company Color Themes
 */
export const COMPANY_THEMES = {
  'elite digital print': {
    primary: '#1e1b4b', // Deep Dark Navy/Purple as in sample
    secondary: '#312e81',
    lightBg: '#f8fafc',
    border: '#1e1b4b'
  },
  'elite digital prints': {
    primary: '#1e1b4b',
    secondary: '#312e81',
    lightBg: '#f8fafc',
    border: '#1e1b4b'
  },
  'elite edition': {
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
  'ethno wear': {
    primary: '#8b5a2b', // Ethnowear Brand Brown
    secondary: '#a06d3b',
    lightBg: '#fcf6f0',
    border: '#8b5a2b'
  },
  'elite ethnowear': {
    primary: '#8b5a2b', // Ethnowear Brand Brown
    secondary: '#a06d3b',
    lightBg: '#fcf6f0',
    border: '#8b5a2b'
  },
  'elite fabtex': {
    primary: '#d97706', // Fabtex Amber / Gold
    secondary: '#b45309',
    lightBg: '#fffbeb',
    border: '#d97706'
  },
  'sobise': {
    primary: '#e11d48', // Sobise Rose
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
  'elite online': {
    primary: '#1e3a8a',
    secondary: '#2563eb',
    lightBg: '#eff6ff',
    border: '#1e3a8a'
  },
  'exedp': {
    primary: '#1e293b',
    secondary: '#334155',
    lightBg: '#f8fafc',
    border: '#1e293b'
  }
};

export const getCompanyTheme = (companyEntity = '') => {
  const norm = String(companyEntity || '').trim().toLowerCase();
  return COMPANY_THEMES[norm] || COMPANY_THEMES['elite digital print'];
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

  const n = Math.floor(Math.abs(num));
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

  const decimals = Math.round((Math.abs(num) - n) * 100);
  let paiseStr = '';
  if (decimals > 0) {
    paiseStr = ' and ' + inWords(decimals) + ' Paise';
  }

  return 'Rupees ' + res.trim() + paiseStr + ' Only';
};

export default function MasterInvoiceTemplate({
  invoice = {},
  printConfig = {},
  customTheme = null
}) {
  const effectiveCompany = invoice.companyEntity || printConfig.companyEntity || 'Elite Digital Print';
  const theme = useMemo(() => customTheme || getCompanyTheme(effectiveCompany), [effectiveCompany, customTheme]);

  // Company Details
  const companyName = (printConfig.companyName || effectiveCompany).toUpperCase();
  const companyGstin = printConfig.companyGstin || '24AANFE0044M1ZG';
  const companyAddress = printConfig.companyAddress || 'Plot No. 42-45, GIDC Industrial Estate, Khatodara, Surat, Gujarat - 395002';
  const companyPhone = printConfig.companyPhone || '+91 99098 66667';
  const companyEmail = printConfig.companyEmail || 'billing@elitedigitalprints.com';
  const companyState = printConfig.companyState || 'Gujarat';
  const companyStateCode = printConfig.companyStateCode || '24';
  const companyPan = printConfig.companyPan || invoice.companyPan || (companyGstin && companyGstin.length >= 12 ? companyGstin.substring(2, 12) : 'AANFE0044M');

  // Customer Details
  const cust = invoice.customer || {};
  const customerName = cust.businessName || cust.name || 'YAMUNAJI CREATION';
  const customerGstin = cust.gstin || '';
  const customerAddress = cust.billingAddress || 'PLOT NO-115/116, Kohinoor 2 Textile Plaza, CANAL ROAD, Surat, Gujarat - 395010';
  const customerState = cust.state || 'Gujarat';
  const customerStateCode = cust.stateCode || '24';

  // Dates & Numbers
  const invNo = invoice.invoiceNo || 'EDP/26-27/1042';
  const invDate = invoice.invoiceDate
    ? (new Date(invoice.invoiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/'))
    : '05/11/2026';
  const dueDate = invoice.dueDate
    ? (new Date(invoice.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/'))
    : (invoice.paymentDueDate || '20/11/2026');
  const copyTitle = invoice.copyTitle || printConfig.copyTitle || 'ORIGINAL FOR RECIPIENT';
  const placeOfSupply = invoice.placeOfSupply || printConfig.placeOfSupply || `${companyState} (${companyStateCode})`;

  // Delivery / Agent / Terms
  const deliveryTerms = invoice.deliveryBy || invoice.agentName || invoice.brokerName || 'SUNIL';
  const challanNos = invoice.ourChallanNo || (Array.isArray(invoice.linkedChallanNos) ? invoice.linkedChallanNos.join(', ') : 'EDP-1388, EDP-1389, EDP-1390, EDP-1391');

  // Items
  const items = Array.isArray(invoice.items) && invoice.items.length > 0 ? invoice.items : [];
  const totalQty = items.reduce((sum, it) => sum + Number(it.qty || 0), 0);
  const subtotal = Number(invoice.subtotal || items.reduce((sum, it) => sum + (Number(it.qty || 1) * Number(it.unitPrice || 0)), 0));

  // Taxes
  const isIgst = invoice.taxType === 'IGST' || Number(invoice.igstAmount) > 0;
  const totalTax = Number(invoice.totalTax || 0);
  const cgstAmount = Number(invoice.cgstAmount || (totalTax / 2));
  const sgstAmount = Number(invoice.sgstAmount || (totalTax / 2));
  const igstAmount = Number(invoice.igstAmount || totalTax);
  const roundOff = Number(invoice.roundOff || 0);
  const grandTotal = Number(invoice.grandTotal || (subtotal + totalTax + roundOff));

  // TDS
  const hasTds = Boolean(invoice.enableTds || Number(invoice.tdsAmount) > 0);
  const tdsSection = invoice.tdsSection || '194C';
  const tdsRate = Number(invoice.tdsRate || 2);
  const tdsAmount = Number(invoice.tdsAmount || 0);
  const netReceivable = Math.max(0, grandTotal - tdsAmount);

  // Bank
  const bankName = printConfig.companyBankName || 'KOTAK BANK';
  const bankAccount = printConfig.companyAccountNo || '9909866667';
  const bankIfsc = printConfig.companyIfscCode || 'KKBK0000883';

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '800px',
        minHeight: '1050px',
        height: '100%',
        margin: '0 auto',
        background: '#ffffff',
        border: `1.5px solid ${theme.border}`,
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
      {/* ── 1. HEADER (USER APPROVED MODERN DESIGN) ────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%)',
          borderBottom: `3px solid ${theme.primary}`,
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
              color: theme.primary,
              letterSpacing: '-0.3px',
              marginBottom: '4px'
            }}
          >
            {companyName}
          </div>
          <div style={{ fontSize: '11px', color: '#475569', marginBottom: '2px' }}>
            {companyAddress}
          </div>
          <div style={{ fontSize: '10.5px', color: '#475569' }}>
            Phone: <strong style={{ color: '#0f172a' }}>{companyPhone}</strong> • Email: {companyEmail}
          </div>
          <div style={{ marginTop: '5px', fontSize: '11px' }}>
            <span style={{ display: 'inline-block', marginRight: '12px' }}>
              GSTIN: <strong style={{ color: theme.primary, fontFamily: 'monospace' }}>{companyGstin}</strong>
            </span>
            <span>
              State: <strong>{companyState} ({companyStateCode})</strong>
            </span>
            {companyPan && (
              <span style={{ marginLeft: '12px' }}>
                PAN: <strong>{companyPan}</strong>
              </span>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              display: 'inline-block',
              background: '#dbeafe',
              color: '#1e40af',
              border: '1px solid #bfdbfe',
              padding: '3px 10px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}
          >
            {copyTitle}
          </span>
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
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>
            Invoice Date: <strong style={{ color: '#0f172a' }}>{invDate}</strong>
          </div>
          {dueDate && (
            <div style={{ fontSize: '10.5px', color: '#b45309', marginTop: '2px' }}>
              Due Date: <strong>{dueDate}</strong>
            </div>
          )}
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
            Place of Supply: <strong>{placeOfSupply}</strong>
          </div>
        </div>
      </div>

      {/* ── 2. BILL TO & DISPATCH SECTION ────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', borderBottom: `1.5px solid ${theme.border}` }}>
        {/* Left Column: BILL TO (MATCHING HEADER STYLING) */}
        <div style={{ borderRight: `1.5px solid ${theme.border}` }}>
          <div style={{ background: theme.primary, color: '#ffffff', fontSize: '9px', fontWeight: 800, padding: '3.5px 8px', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
            BILL TO
          </div>
          <div style={{ padding: '8px 12px', fontSize: '9.5px', lineHeight: 1.35 }}>
            <div style={{ fontSize: '12px', fontWeight: 900, color: '#000000', letterSpacing: '-0.2px' }}>
              {customerName}
            </div>
            <div style={{ color: '#475569', fontSize: '10px', marginTop: '2px', lineHeight: 1.35 }}>
              {customerAddress}
            </div>
            <div style={{ marginTop: '5px', fontSize: '10.5px' }}>
              <span style={{ display: 'inline-block', marginRight: '12px' }}>
                GSTIN: <strong style={{ color: theme.primary, fontFamily: 'monospace' }}>{customerGstin || 'URP'}</strong>
              </span>
              <span>
                State: <strong>{customerState} ({customerStateCode})</strong>
              </span>
              {(cust.pan || (customerGstin && customerGstin.length >= 12)) && (
                <span style={{ marginLeft: '12px' }}>
                  PAN: <strong>{cust.pan || customerGstin.substring(2, 12)}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: SELLER / DISPATCH DETAILS (NO TAX INVOICE NO, ADDS AGENT & DISPATCH DETAILS) */}
        <div>
          <div style={{ background: theme.primary, color: '#ffffff', fontSize: '9px', fontWeight: 800, padding: '3.5px 8px', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
            SELLER / DISPATCH DETAILS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', height: '100%' }}>
            <div style={{ padding: '6px 10px', fontSize: '9px', borderRight: '1px solid #e2e8f0' }}>
              <div style={{ color: '#475569', fontSize: '8.5px' }}>Challan No.:</div>
              <div style={{ fontWeight: 800, marginTop: '2px', fontSize: '9.5px', lineHeight: 1.3 }}>{challanNos}</div>
              <div style={{ color: '#475569', fontSize: '8.5px', marginTop: '4px' }}>Dispatched Through:</div>
              <div style={{ fontWeight: 800 }}>{invoice.transport || invoice.dispatchThrough || 'BY ROAD (MAHESH TRANSPORT)'}</div>
            </div>
            <div style={{ padding: '6px 10px', fontSize: '9px' }}>
              <div style={{ color: '#475569', fontSize: '8.5px' }}>Agent / Broker:</div>
              <div style={{ fontWeight: 800, fontSize: '10px', color: theme.primary, marginTop: '2px' }}>
                {invoice.agentName || invoice.brokerName || deliveryTerms}
              </div>
              <div style={{ color: '#475569', fontSize: '8.5px', marginTop: '4px' }}>Terms of Delivery:</div>
              <div style={{ fontWeight: 800 }}>{invoice.deliveryTerms || invoice.termsOfDelivery || 'DOOR DELIVERY / SURAT'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. ITEMS TABLE (FILLS AVAILABLE HEIGHT) ────────────────────── */}
      <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: '260px' }}>
        <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', fontSize: '9.5px' }}>
          <thead>
            <tr style={{ background: theme.primary, color: '#ffffff', fontSize: '9px', fontWeight: 800 }}>
              <th style={{ width: '25px', padding: '6px 4px', border: `1px solid ${theme.primary}`, textAlign: 'center' }}>Sr.</th>
              <th style={{ width: '55px', padding: '6px 4px', border: `1px solid ${theme.primary}`, textAlign: 'center' }}>Image</th>
              <th style={{ padding: '6px 8px', border: `1px solid ${theme.primary}`, textAlign: 'left' }}>Description of Goods</th>
              <th style={{ width: '50px', padding: '6px 4px', border: `1px solid ${theme.primary}`, textAlign: 'center' }}>HSN</th>
              <th style={{ width: '45px', padding: '6px 4px', border: `1px solid ${theme.primary}`, textAlign: 'center' }}>GST%</th>
              <th style={{ width: '60px', padding: '6px 4px', border: `1px solid ${theme.primary}`, textAlign: 'right' }}>Qty</th>
              <th style={{ width: '50px', padding: '6px 4px', border: `1px solid ${theme.primary}`, textAlign: 'right' }}>Rate</th>
              <th style={{ width: '40px', padding: '6px 4px', border: `1px solid ${theme.primary}`, textAlign: 'center' }}>Per</th>
              <th style={{ width: '75px', padding: '6px 8px', border: `1px solid ${theme.primary}`, textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const qty = Number(it.qty || 1);
              const rate = Number(it.unitPrice || 0);
              const lineAmt = Number(it.totalAmount || (qty * rate));

              return (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ textAlign: 'center', fontWeight: 700, padding: '6px 4px', borderLeft: '1px solid #cbd5e1' }}>{idx + 1}</td>
                  <td style={{ textAlign: 'center', padding: '4px' }}>
                    <div style={{ width: '44px', height: '44px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '3px', margin: '0 auto', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {it.imageUrl ? (
                        <img src={it.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '8px', color: '#94a3b8' }}>Design</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <div style={{ fontWeight: 900, fontSize: '10.5px' }}>{it.itemName || 'DIGITAL PRINT JOB WORK'}</div>
                    <div style={{ fontSize: '8.5px', fontWeight: 700, color: theme.primary, marginTop: '1px' }}>
                      Design No: {it.designNo || it.jobNo || '-'}
                    </div>
                    <div style={{ fontSize: '8.5px', color: '#0f172a' }}>
                      Job Card: {it.jobNo || '-'} &nbsp;|&nbsp; Challan: {it.ourChallanNo || invoice.ourChallanNo || '-'}
                    </div>
                    <div style={{ fontSize: '8.5px', color: '#0f172a' }}>
                      Fabric: {it.fabric || it.fabricName || '-'} &nbsp;|&nbsp; Lot: {it.lotNo || '-'}
                    </div>
                    {it.partyChallan && <div style={{ fontSize: '8.5px', color: '#0f172a' }}>Party Challan: {it.partyChallan}</div>}
                  </td>
                  <td style={{ textAlign: 'center', fontFamily: 'monospace', padding: '6px 4px' }}>{it.hsnCode || '998821'}</td>
                  <td style={{ textAlign: 'center', padding: '6px 4px' }}>{it.taxRate != null ? it.taxRate : 5}%</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, padding: '6px 4px' }}>
                    {qty.toFixed(2)}<br /><span style={{ fontSize: '8px', color: '#64748b' }}>{it.unit || 'MTR'}</span>
                  </td>
                  <td style={{ textAlign: 'right', padding: '6px 4px' }}>{rate.toFixed(2)}</td>
                  <td style={{ textAlign: 'center', padding: '6px 4px' }}>{it.unit || 'MTR'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, padding: '6px 8px', borderRight: '1px solid #cbd5e1' }}>{lineAmt.toFixed(2)}</td>
                </tr>
              );
            })}
            {/* Filler row to stretch column lines down to footer */}
            <tr style={{ height: '100%' }}>
              <td style={{ borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', borderBottom: 'none' }}></td>
              <td style={{ borderRight: '1px solid #cbd5e1', borderBottom: 'none' }}></td>
              <td style={{ borderRight: '1px solid #cbd5e1', borderBottom: 'none' }}></td>
              <td style={{ borderRight: '1px solid #cbd5e1', borderBottom: 'none' }}></td>
              <td style={{ borderRight: '1px solid #cbd5e1', borderBottom: 'none' }}></td>
              <td style={{ borderRight: '1px solid #cbd5e1', borderBottom: 'none' }}></td>
              <td style={{ borderRight: '1px solid #cbd5e1', borderBottom: 'none' }}></td>
              <td style={{ borderRight: '1px solid #cbd5e1', borderBottom: 'none' }}></td>
              <td style={{ borderRight: '1px solid #cbd5e1', borderBottom: 'none' }}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── ANCHORED AT END OF PAGE ──────────────────────────────────────── */}
      <div style={{ flex: '0 0 auto', marginTop: 'auto' }}>
        {/* ── 5. TOTALS AREA ───────────────────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 12px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ flex: 1, textAlign: 'right', fontWeight: 800, paddingRight: '50px' }}>
            Total Qty: &nbsp;&nbsp; {totalQty.toFixed(2)} MTR
          </div>
          <div style={{ width: '90px', textAlign: 'right', fontWeight: 800 }}>{subtotal.toFixed(2)}</div>
        </div>

        {isIgst ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px 12px' }}>
            <div style={{ width: '130px', textAlign: 'right', paddingRight: '15px', fontWeight: 700, color: '#334155' }}>IGST @ 5%</div>
            <div style={{ width: '90px', textAlign: 'right', fontWeight: 800 }}>{igstAmount.toFixed(2)}</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px 12px' }}>
              <div style={{ width: '130px', textAlign: 'right', paddingRight: '15px', fontWeight: 700, color: '#334155' }}>CGST @ 2.5%</div>
              <div style={{ width: '90px', textAlign: 'right', fontWeight: 800 }}>{cgstAmount.toFixed(2)}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px 12px' }}>
              <div style={{ width: '130px', textAlign: 'right', paddingRight: '15px', fontWeight: 700, color: '#334155' }}>SGST @ 2.5%</div>
              <div style={{ width: '90px', textAlign: 'right', fontWeight: 800 }}>{sgstAmount.toFixed(2)}</div>
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px 12px' }}>
          <div style={{ width: '130px', textAlign: 'right', paddingRight: '15px', fontWeight: 700, color: '#334155' }}>Round Off</div>
          <div style={{ width: '90px', textAlign: 'right', fontWeight: 800 }}>{roundOff.toFixed(2)}</div>
        </div>

        {/* Banner: TOTAL */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: theme.primary, color: '#ffffff', padding: '4px 12px', fontSize: '10.5px', fontWeight: 800 }}>
          <div>{totalQty.toFixed(2)} MTR</div>
          <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
            <span>Total</span>
            <span style={{ fontSize: '12px', fontWeight: 900 }}>Rs. {grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* TDS Row */}
        {hasTds && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 12px', background: '#fafafa' }}>
              <div style={{ width: '200px', textAlign: 'right', paddingRight: '15px', fontWeight: 700 }}>
                Less: TDS ({tdsSection}) @ {tdsRate}%
              </div>
              <div style={{ width: '90px', textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>- {tdsAmount.toFixed(2)}</div>
            </div>

            {/* Banner: NET RECEIVABLE */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: theme.primary, color: '#ffffff', padding: '4px 12px', fontSize: '10.5px', fontWeight: 800 }}>
              <div></div>
              <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                <span>Net Receivable</span>
                <span style={{ fontSize: '12px', fontWeight: 900 }}>Rs. {netReceivable.toFixed(2)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── 6. WORDS BAR ─────────────────────────────────────────────────── */}
      <div style={{ padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', borderBottom: '1px solid #cbd5e1', background: '#f8fafc' }}>
        <div>
          <span style={{ fontWeight: 700 }}>Amount Chargeable (in words):</span><br />
          <strong style={{ fontSize: '10px' }}>{numberToWordsIndian(hasTds ? netReceivable : grandTotal)}</strong>
        </div>
        <div style={{ fontWeight: 800, fontSize: '9.5px', color: '#475569' }}>E. & O.E.</div>
      </div>

      {/* ── 7. HSN TAX TABLE ─────────────────────────────────────────────── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5px', borderBottom: `1px solid ${theme.border}` }}>
        <thead>
          <tr style={{ background: theme.primary, color: '#ffffff', fontWeight: 800 }}>
            <th style={{ width: '70px', textAlign: 'left', padding: '4px 8px', border: `1px solid ${theme.primary}` }}>HSN</th>
            <th style={{ width: '90px', padding: '4px 6px', textAlign: 'right', border: `1px solid ${theme.primary}` }}>Taxable Value</th>
            <th style={{ width: '60px', padding: '4px 6px', textAlign: 'center', border: `1px solid ${theme.primary}` }}>CGST %</th>
            <th style={{ width: '80px', padding: '4px 6px', textAlign: 'right', border: `1px solid ${theme.primary}` }}>CGST Amount</th>
            <th style={{ width: '60px', padding: '4px 6px', textAlign: 'center', border: `1px solid ${theme.primary}` }}>SGST %</th>
            <th style={{ width: '80px', padding: '4px 6px', textAlign: 'right', border: `1px solid ${theme.primary}` }}>SGST Amount</th>
            <th style={{ width: '90px', padding: '4px 6px', textAlign: 'right', border: `1px solid ${theme.primary}` }}>Total Tax</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ textAlign: 'left', padding: '3.5px 8px', fontWeight: 700, border: '1px solid #cbd5e1' }}>998821</td>
            <td style={{ padding: '3.5px 6px', textAlign: 'right', border: '1px solid #cbd5e1' }}>{subtotal.toFixed(2)}</td>
            <td style={{ textAlign: 'center', padding: '3.5px 6px', border: '1px solid #cbd5e1' }}>2.5%</td>
            <td style={{ padding: '3.5px 6px', textAlign: 'right', border: '1px solid #cbd5e1' }}>{cgstAmount.toFixed(2)}</td>
            <td style={{ textAlign: 'center', padding: '3.5px 6px', border: '1px solid #cbd5e1' }}>2.5%</td>
            <td style={{ padding: '3.5px 6px', textAlign: 'right', border: '1px solid #cbd5e1' }}>{sgstAmount.toFixed(2)}</td>
            <td style={{ fontWeight: 700, padding: '3.5px 6px', textAlign: 'right', border: '1px solid #cbd5e1' }}>{totalTax.toFixed(2)}</td>
          </tr>
          <tr style={{ background: '#f8fafc', fontWeight: 800 }}>
            <td style={{ textAlign: 'left', padding: '3.5px 8px', border: '1px solid #cbd5e1' }}>Total</td>
            <td style={{ padding: '3.5px 6px', textAlign: 'right', border: '1px solid #cbd5e1' }}>{subtotal.toFixed(2)}</td>
            <td style={{ border: '1px solid #cbd5e1' }}></td>
            <td style={{ padding: '3.5px 6px', textAlign: 'right', border: '1px solid #cbd5e1' }}>{cgstAmount.toFixed(2)}</td>
            <td style={{ border: '1px solid #cbd5e1' }}></td>
            <td style={{ padding: '3.5px 6px', textAlign: 'right', border: '1px solid #cbd5e1' }}>{sgstAmount.toFixed(2)}</td>
            <td style={{ padding: '3.5px 6px', textAlign: 'right', border: '1px solid #cbd5e1' }}>{totalTax.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* Tax Amount in Words */}
      <div style={{ padding: '4px 12px', fontSize: '8.5px', borderBottom: '1px solid #cbd5e1' }}>
        <span style={{ fontWeight: 700 }}>Tax Amount (in words):</span> &nbsp;
        <span>{numberToWordsIndian(totalTax)}</span>
      </div>

      {/* ── 8. FOOTER: BANK & SIGNATURE ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', padding: '8px 12px', fontSize: '8.5px', lineHeight: 1.35 }}>
        <div>
          <div style={{ fontWeight: 800, textDecoration: 'underline', marginBottom: '2px' }}>Company's Bank Details:</div>
          <div>Bank Name: <strong>{bankName}</strong></div>
          <div>A/c No.: <strong style={{ fontFamily: 'monospace' }}>{bankAccount}</strong></div>
          <div>Branch & IFS Code: <strong style={{ fontFamily: 'monospace' }}>{bankIfsc}</strong></div>
          
          <div style={{ fontWeight: 800, marginTop: '6px' }}>Terms & Conditions:</div>
          <div style={{ color: '#475569', fontSize: '8px' }}>
            Payment due within 30 days from invoice date. Subject to Surat jurisdiction.
          </div>
        </div>

        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 800, fontSize: '10px', color: '#000000' }}>
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
