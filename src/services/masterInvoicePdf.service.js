const puppeteer = require('puppeteer');
const logger = require('../config/logger');
const {
  getCompanyBrandColor,
  tintColor,
  getDuplicateLighterColor,
  isMeaningfulValue
} = require('../utils/departmentThemeHelper');

const COMPANY_THEMES = {
  'elite digital print': { primary: '#1e3a8a', border: '#1e3a8a' },
  'elite digital prints': { primary: '#1e3a8a', border: '#1e3a8a' },
  'elite edition': { primary: '#312e81', border: '#312e81' },
  'elite stitching': { primary: '#064e3b', border: '#064e3b' },
  'ethno wear': { primary: '#8b5a2b', border: '#8b5a2b' },
  'elite ethnowear': { primary: '#8b5a2b', border: '#8b5a2b' },
  'elite fabtex': { primary: '#d97706', border: '#d97706' },
  'sobise': { primary: '#e11d48', border: '#e11d48' },
  'yamunaji': { primary: '#581c87', border: '#581c87' },
  'elite online': { primary: '#1e3a8a', border: '#1e3a8a' },
  'exedp': { primary: '#1e293b', border: '#1e293b' }
};

const getTheme = (companyEntity = '', customBrandColor = '', isDuplicate = false) => {
  const basePrimary = getCompanyBrandColor(companyEntity, customBrandColor);
  const activePrimary = isDuplicate ? getDuplicateLighterColor(basePrimary) : basePrimary;
  return {
    basePrimary,
    primary: activePrimary,
    border: activePrimary,
    headerBg: tintColor(activePrimary, 0.06),
    badgeBg: tintColor(activePrimary, 0.12),
    subtleBorder: tintColor(activePrimary, 0.22)
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

/**
 * Compile a single invoice copy block (Original or 50%-lighter Duplicate) with strictly dynamic fields
 */
const renderSingleInvoicePageHtml = (invoice, printConfig = {}, copyLabel = 'ORIGINAL FOR RECIPIENT', isDuplicate = false, pageBreakBefore = false) => {
  const companyEntity = invoice.companyEntity || printConfig.companyEntity || 'Elite Digital Print';
  const theme = getTheme(companyEntity, printConfig.brandColor, isDuplicate);

  const companyName = (printConfig.companyName || companyEntity || '').toUpperCase();
  const companyGstin = isMeaningfulValue(printConfig.companyGstin || invoice.companyGstin) ? String(printConfig.companyGstin || invoice.companyGstin).trim() : '';
  const companyAddress = isMeaningfulValue(printConfig.companyAddress || invoice.companyAddress) ? String(printConfig.companyAddress || invoice.companyAddress).trim() : '';
  const companyPhone = isMeaningfulValue(printConfig.companyPhone || invoice.companyPhone) ? String(printConfig.companyPhone || invoice.companyPhone).trim() : '';
  const companyEmail = isMeaningfulValue(printConfig.companyEmail || invoice.companyEmail) ? String(printConfig.companyEmail || invoice.companyEmail).trim() : '';
  const companyState = isMeaningfulValue(printConfig.companyState || invoice.companyState) ? String(printConfig.companyState || invoice.companyState).trim() : '';
  const companyStateCode = isMeaningfulValue(printConfig.companyStateCode || invoice.companyStateCode) ? String(printConfig.companyStateCode || invoice.companyStateCode).trim() : '';
  const companyPan = isMeaningfulValue(printConfig.companyPan || invoice.companyPan)
    ? String(printConfig.companyPan || invoice.companyPan).trim()
    : (companyGstin.length >= 12 ? companyGstin.substring(2, 12) : '');

  const cust = invoice.customer || {};
  const customerName = (cust.businessName || cust.name || invoice.partyName || invoice.customerName || '').trim();
  const customerGstin = isMeaningfulValue(cust.gstin || invoice.customerGstin) ? String(cust.gstin || invoice.customerGstin).trim() : '';
  const customerAddress = isMeaningfulValue(cust.billingAddress || cust.shippingAddress || invoice.billingAddress) ? String(cust.billingAddress || cust.shippingAddress || invoice.billingAddress).trim() : '';
  const customerState = isMeaningfulValue(cust.state || invoice.customerState) ? String(cust.state || invoice.customerState).trim() : '';
  const customerStateCode = isMeaningfulValue(cust.stateCode || invoice.customerStateCode) ? String(cust.stateCode || invoice.customerStateCode).trim() : '';
  const customerPan = isMeaningfulValue(cust.pan) ? String(cust.pan).trim() : (customerGstin.length >= 12 ? customerGstin.substring(2, 12) : '');

  const invNo = isMeaningfulValue(invoice.invoiceNo) ? String(invoice.invoiceNo).trim() : '';
  const invDate = formatDateVal(invoice.invoiceDate);
  const dueDate = formatDateVal(invoice.dueDate || invoice.paymentDueDate);
  const placeOfSupply = isMeaningfulValue(invoice.placeOfSupply || printConfig.placeOfSupply)
    ? String(invoice.placeOfSupply || printConfig.placeOfSupply).trim()
    : (customerState ? `${customerState}${customerStateCode ? ` (${customerStateCode})` : ''}` : '');

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

  const dispatchEntries = [];
  if (challanNos) dispatchEntries.push({ label: 'Challan No.', value: challanNos });
  if (dispatchedThrough) dispatchEntries.push({ label: 'Dispatched Through', value: dispatchedThrough });
  if (agentOrBroker) dispatchEntries.push({ label: 'Agent / Broker', value: agentOrBroker, accent: true });
  if (termsOfDelivery) dispatchEntries.push({ label: 'Terms of Delivery', value: termsOfDelivery });
  if (vehicleNo) dispatchEntries.push({ label: 'Vehicle No.', value: vehicleNo });
  if (eWayBillNo) dispatchEntries.push({ label: 'E-Way Bill No.', value: eWayBillNo });

  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const hasAnyImage = items.some(it => isMeaningfulValue(it.imageUrl || it.designImageUrl || it.image || it.thumbnailUrl));
  const hasAnyDiscount = items.some(it => Number(it.discountPct || it.discountPercent || it.discountAmount || 0) > 0);
  const overallUnit = (items[0] && (items[0].unit || items[0].qtyUnit)) || 'MTR';

  const totalQty = items.reduce((sum, it) => sum + Number(it.qty || it.quantity || 0), 0);
  const subtotal = Number(invoice.subtotal || items.reduce((sum, it) => sum + Number(it.totalAmount != null ? it.totalAmount : (Number(it.qty || 0) * Number(it.unitPrice || it.rate || 0))), 0));

  const isIgst = invoice.taxType === 'IGST' || Number(invoice.igstAmount) > 0;
  const totalTax = Number(invoice.totalTax != null ? invoice.totalTax : (Number(invoice.cgstAmount || 0) + Number(invoice.sgstAmount || 0) + Number(invoice.igstAmount || 0)));
  const cgstAmount = Number(invoice.cgstAmount != null ? invoice.cgstAmount : (isIgst ? 0 : totalTax / 2));
  const sgstAmount = Number(invoice.sgstAmount != null ? invoice.sgstAmount : (isIgst ? 0 : totalTax / 2));
  const igstAmount = Number(invoice.igstAmount != null ? invoice.igstAmount : (isIgst ? totalTax : 0));
  const roundOff = Number(invoice.roundOff || 0);
  const grandTotal = Number(invoice.grandTotal || (subtotal + totalTax + roundOff));

  const hasTds = Boolean(invoice.enableTds && Number(invoice.tdsAmount) > 0);
  const tdsSection = invoice.tdsSection || '194C';
  const tdsRate = Number(invoice.tdsRate || 2);
  const tdsAmount = Number(invoice.tdsAmount || 0);
  const netReceivable = Math.max(0, grandTotal - tdsAmount);

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

  const rowsHtml = items.map((it, idx) => {
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

    return `
      <tr>
        <td style="text-align: center; font-weight: 700; padding: 6px 4px; border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">${idx + 1}</td>
        ${hasAnyImage ? `
          <td style="text-align: center; padding: 4px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">
            ${isMeaningfulValue(itemImg) ? `
              <div style="width: 44px; height: 44px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 3px; margin: 0 auto; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                <img src="${itemImg}" alt="" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
            ` : ''}
          </td>
        ` : ''}
        <td style="padding: 6px 8px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">
          ${itemName ? `<div style="font-weight: 900; font-size: 10.5px; color: #0f172a;">${itemName}</div>` : ''}
          ${designNo ? `<div style="font-size: 8.5px; font-weight: 700; color: ${theme.primary}; margin-top: 1px;">Design No: ${designNo}</div>` : ''}
          ${jobChallanParts.length > 0 ? `<div style="font-size: 8.5px; color: #0f172a;">${jobChallanParts.join(' &nbsp;|&nbsp; ')}</div>` : ''}
          ${fabricLotParts.length > 0 ? `<div style="font-size: 8.5px; color: #0f172a;">${fabricLotParts.join(' &nbsp;|&nbsp; ')}</div>` : ''}
          ${partyChallanStr ? `<div style="font-size: 8.5px; color: #0f172a;">Party Challan: ${partyChallanStr}</div>` : ''}
        </td>
        <td style="text-align: center; font-family: monospace; padding: 6px 4px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">${itemHsn}</td>
        <td style="text-align: center; padding: 6px 4px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">${itemTaxRate > 0 ? `${itemTaxRate}%` : ''}</td>
        <td style="text-align: right; font-weight: 800; padding: 6px 4px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">
          ${qty.toFixed(2)}<br /><span style="font-size: 8px; font-weight: 500; color: #64748b;">${itemUnit}</span>
        </td>
        <td style="text-align: right; padding: 6px 4px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">${rate.toFixed(2)}</td>
        <td style="text-align: center; padding: 6px 4px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">${itemUnit}</td>
        ${hasAnyDiscount ? `
          <td style="text-align: right; padding: 6px 4px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">
            ${discPct > 0 ? `${discPct}%` : (discAmt > 0 ? `₹${discAmt.toFixed(2)}` : '')}
          </td>
        ` : ''}
        <td style="text-align: right; font-weight: 800; padding: 6px 8px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">${lineAmt.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const totalColCount = 7 + (hasAnyImage ? 1 : 0) + (hasAnyDiscount ? 1 : 0);
  const fillerCells = Array.from({ length: totalColCount }).map(() => '<td></td>').join('');
  const firstHsnCode = items.map(it => it.hsnCode || it.hsn).find(isMeaningfulValue) || '';

  return `
  <div class="invoice-wrapper" style="border-color: ${theme.border}; ${pageBreakBefore ? 'page-break-before: always;' : ''}">
    <div class="invoice-header" style="background: linear-gradient(135deg, ${theme.headerBg} 0%, #ffffff 100%); border-bottom: 3px solid ${theme.primary};">
      <div style="max-width: 60%;">
        <div class="company-title" style="color: ${theme.primary};">${companyName}</div>
        ${companyAddress ? `<div style="font-size: 11px; color: #475569; margin-bottom: 2px;">${companyAddress}</div>` : ''}
        ${(companyPhone || companyEmail) ? `
          <div style="font-size: 10.5px; color: #475569;">
            ${companyPhone ? `Phone: <strong style="color: #0f172a;">${companyPhone}</strong>` : ''}
            ${companyPhone && companyEmail ? ' &bull; ' : ''}
            ${companyEmail ? `Email: ${companyEmail}` : ''}
          </div>
        ` : ''}
        ${(companyGstin || companyState || companyPan) ? `
          <div style="margin-top: 5px; font-size: 11px;">
            ${companyGstin ? `<span style="display: inline-block; margin-right: 12px;">GSTIN: <strong style="color: ${theme.primary}; font-family: monospace;">${companyGstin}</strong></span>` : ''}
            ${companyState ? `<span>State: <strong>${companyState}${companyStateCode ? ` (${companyStateCode})` : ''}</strong></span>` : ''}
            ${companyPan ? `<span style="margin-left: 12px;">PAN: <strong>${companyPan}</strong></span>` : ''}
          </div>
        ` : ''}
      </div>

      <div style="text-align: right;">
        <span class="meta-badge" style="background: ${theme.badgeBg}; color: ${theme.primary}; border-color: ${theme.subtleBorder};">${copyLabel}</span>
        ${invNo ? `<div style="font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 5px; letter-spacing: -0.3px;">${invNo}</div>` : ''}
        ${invDate ? `<div style="font-size: 11px; color: #475569; margin-top: 3px;">Invoice Date: <strong style="color: #0f172a;">${invDate}</strong></div>` : ''}
        ${dueDate ? `<div style="font-size: 10.5px; color: #b45309; margin-top: 2px;">Due Date: <strong>${dueDate}</strong></div>` : ''}
        ${placeOfSupply ? `<div style="font-size: 10px; color: #64748b; margin-top: 2px;">Place of Supply: <strong>${placeOfSupply}</strong></div>` : ''}
      </div>
    </div>

    <div class="info-grid" style="border-bottom: 1.5px solid ${theme.border}; ${dispatchEntries.length === 0 ? 'grid-template-columns: 1fr;' : ''}">
      <div style="${dispatchEntries.length > 0 ? `border-right: 1.5px solid ${theme.border};` : ''}">
        <div class="section-bar" style="background: ${theme.primary};">BILL TO</div>
        <div style="padding: 8px 12px; font-size: 9.5px; line-height: 1.35;">
          ${customerName ? `<div style="font-size: 12px; font-weight: 900; color: #000000; letter-spacing: -0.2px;">${customerName}</div>` : ''}
          ${customerAddress ? `<div style="color: #475569; font-size: 10px; margin-top: 2px; line-height: 1.35;">${customerAddress}</div>` : ''}
          ${(customerGstin || customerState || customerPan) ? `
            <div style="margin-top: 5px; font-size: 10.5px;">
              ${customerGstin ? `<span style="display: inline-block; margin-right: 12px;">GSTIN: <strong style="color: ${theme.primary}; font-family: monospace;">${customerGstin}</strong></span>` : ''}
              ${customerState ? `<span>State: <strong>${customerState}${customerStateCode ? ` (${customerStateCode})` : ''}</strong></span>` : ''}
              ${customerPan ? `<span style="margin-left: 12px;">PAN: <strong>${customerPan}</strong></span>` : ''}
            </div>
          ` : ''}
        </div>
      </div>

      ${dispatchEntries.length > 0 ? `
        <div>
          <div class="section-bar" style="background: ${theme.primary};">DISPATCH & ORDER DETAILS</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; padding: 6px 10px; gap: 6px 12px; font-size: 9px;">
            ${dispatchEntries.map(entry => `
              <div>
                <div style="color: #475569; font-size: 8.5px;">${entry.label}:</div>
                <div style="font-weight: 800; margin-top: 1px; font-size: 9.5px; color: ${entry.accent ? theme.primary : '#0f172a'};">${entry.value}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>

    <div class="items-table-container">
      <table class="invoice-table">
        <thead>
          <tr>
            <th style="width: 25px; background: ${theme.primary}; border-color: ${theme.primary};">Sr.</th>
            ${hasAnyImage ? `<th style="width: 55px; background: ${theme.primary}; border-color: ${theme.primary};">Image</th>` : ''}
            <th style="text-align: left; background: ${theme.primary}; border-color: ${theme.primary};">Description of Goods</th>
            <th style="width: 50px; background: ${theme.primary}; border-color: ${theme.primary};">HSN</th>
            <th style="width: 45px; background: ${theme.primary}; border-color: ${theme.primary};">GST%</th>
            <th style="width: 60px; text-align: right; background: ${theme.primary}; border-color: ${theme.primary};">Qty</th>
            <th style="width: 50px; text-align: right; background: ${theme.primary}; border-color: ${theme.primary};">Rate</th>
            <th style="width: 40px; text-align: center; background: ${theme.primary}; border-color: ${theme.primary};">Per</th>
            ${hasAnyDiscount ? `<th style="width: 45px; text-align: right; background: ${theme.primary}; border-color: ${theme.primary};">Disc%</th>` : ''}
            <th style="width: 75px; text-align: right; background: ${theme.primary}; border-color: ${theme.primary};">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr class="table-filler-row">${fillerCells}</tr>
        </tbody>
      </table>
    </div>

    <div class="invoice-bottom-block">
      <div class="totals-area" style="border-top-color: ${theme.border}; border-bottom-color: ${theme.border};">
        <div class="calc-row" style="background: #ffffff; padding: 4px 12px; border-bottom: 1px solid #e2e8f0;">
          <div style="flex: 1; text-align: right; font-weight: 800; padding-right: 50px;">
            Total Qty: &nbsp;&nbsp; ${totalQty.toFixed(2)} ${overallUnit}
          </div>
          <div style="width: 90px; text-align: right; font-weight: 800;">${subtotal.toFixed(2)}</div>
        </div>

        ${totalTax > 0 ? (isIgst ? `
          <div class="calc-row">
            <div style="width: 130px; text-align: right; padding-right: 15px; font-weight: 700; color: #334155;">IGST @ 5%</div>
            <div style="width: 90px; text-align: right; font-weight: 800;">${igstAmount.toFixed(2)}</div>
          </div>
        ` : `
          ${cgstAmount > 0 ? `
            <div class="calc-row">
              <div style="width: 130px; text-align: right; padding-right: 15px; font-weight: 700; color: #334155;">CGST @ 2.5%</div>
              <div style="width: 90px; text-align: right; font-weight: 800;">${cgstAmount.toFixed(2)}</div>
            </div>
          ` : ''}
          ${sgstAmount > 0 ? `
            <div class="calc-row">
              <div style="width: 130px; text-align: right; padding-right: 15px; font-weight: 700; color: #334155;">SGST @ 2.5%</div>
              <div style="width: 90px; text-align: right; font-weight: 800;">${sgstAmount.toFixed(2)}</div>
            </div>
          ` : ''}
        `) : ''}

        ${roundOff !== 0 ? `
          <div class="calc-row">
            <div style="width: 130px; text-align: right; padding-right: 15px; font-weight: 700; color: #334155;">Round Off</div>
            <div style="width: 90px; text-align: right; font-weight: 800;">${roundOff > 0 ? `+${roundOff.toFixed(2)}` : roundOff.toFixed(2)}</div>
          </div>
        ` : ''}

        <div class="banner-row" style="background: ${theme.primary};">
          <div>${totalQty.toFixed(2)} ${overallUnit}</div>
          <div style="display: flex; gap: 30px; align-items: center;">
            <span>Total</span>
            <span style="font-size: 12px; font-weight: 900;">Rs. ${grandTotal.toFixed(2)}</span>
          </div>
        </div>

        ${hasTds ? `
          <div class="calc-row" style="padding: 4px 12px; background: #fafafa;">
            <div style="width: 200px; text-align: right; padding-right: 15px; font-weight: 700;">
              Less: TDS (${tdsSection}) @ ${tdsRate}%
            </div>
            <div style="width: 90px; text-align: right; font-weight: 800; color: #dc2626;">- ${tdsAmount.toFixed(2)}</div>
          </div>

          <div class="banner-row" style="background: ${theme.primary};">
            <div></div>
            <div style="display: flex; gap: 30px; align-items: center;">
              <span>Net Receivable</span>
              <span style="font-size: 12px; font-weight: 900;">Rs. ${netReceivable.toFixed(2)}</span>
            </div>
          </div>
        ` : ''}
      </div>

      <div style="padding: 6px 12px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; border-bottom: 1px solid #cbd5e1; background: #f8fafc;">
        <div>
          <span style="font-weight: 700;">Amount Chargeable (in words):</span><br />
          <strong style="font-size: 10px;">${numberToWordsIndian(hasTds ? netReceivable : grandTotal)}</strong>
        </div>
        <div style="font-weight: 800; font-size: 9.5px; color: #475569;">E. & O.E.</div>
      </div>

      ${totalTax > 0 ? `
        <table class="hsn-table" style="border-bottom-color: ${theme.border};">
          <thead>
            <tr>
              <th style="width: 70px; text-align: left; padding: 4px 8px; background: ${theme.primary}; border-color: ${theme.primary};">HSN</th>
              <th style="width: 90px; background: ${theme.primary}; border-color: ${theme.primary};">Taxable Value</th>
              ${isIgst ? `
                <th style="width: 70px; background: ${theme.primary}; border-color: ${theme.primary};">IGST %</th>
                <th style="width: 90px; background: ${theme.primary}; border-color: ${theme.primary};">IGST Amount</th>
              ` : `
                <th style="width: 60px; background: ${theme.primary}; border-color: ${theme.primary};">CGST %</th>
                <th style="width: 80px; background: ${theme.primary}; border-color: ${theme.primary};">CGST Amount</th>
                <th style="width: 60px; background: ${theme.primary}; border-color: ${theme.primary};">SGST %</th>
                <th style="width: 80px; background: ${theme.primary}; border-color: ${theme.primary};">SGST Amount</th>
              `}
              <th style="width: 90px; background: ${theme.primary}; border-color: ${theme.primary};">Total Tax</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align: left; padding: 3.5px 8px; font-weight: 700;">${firstHsnCode}</td>
              <td>${subtotal.toFixed(2)}</td>
              ${isIgst ? `
                <td style="text-align: center;">5%</td>
                <td>${igstAmount.toFixed(2)}</td>
              ` : `
                <td style="text-align: center;">2.5%</td>
                <td>${cgstAmount.toFixed(2)}</td>
                <td style="text-align: center;">2.5%</td>
                <td>${sgstAmount.toFixed(2)}</td>
              `}
              <td style="font-weight: 700;">${totalTax.toFixed(2)}</td>
            </tr>
            <tr style="background: #f8fafc; font-weight: 800;">
              <td style="text-align: left; padding: 3.5px 8px;">Total</td>
              <td>${subtotal.toFixed(2)}</td>
              ${isIgst ? `
                <td></td>
                <td>${igstAmount.toFixed(2)}</td>
              ` : `
                <td></td>
                <td>${cgstAmount.toFixed(2)}</td>
                <td></td>
                <td>${sgstAmount.toFixed(2)}</td>
              `}
              <td>${totalTax.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div style="padding: 4px 12px; font-size: 8.5px; border-bottom: 1px solid #cbd5e1;">
          <span style="font-weight: 700;">Tax Amount (in words):</span> &nbsp;
          <span>${numberToWordsIndian(totalTax)}</span>
        </div>
      ` : ''}

      <div class="footer-grid">
        <div>
          ${(bankName || bankAccount || bankIfsc) ? `
            <div style="font-weight: 800; text-decoration: underline; margin-bottom: 2px;">Company's Bank Details:</div>
            ${bankName ? `<div>Bank Name: <strong>${bankName}</strong></div>` : ''}
            ${bankAccount ? `<div>A/c No.: <strong style="font-family: monospace;">${bankAccount}</strong></div>` : ''}
            ${bankIfsc ? `<div>Branch & IFS Code: <strong style="font-family: monospace;">${bankIfsc}</strong></div>` : ''}
          ` : ''}
          ${termsText ? `
            <div style="font-weight: 800; margin-top: ${(bankName || bankAccount || bankIfsc) ? '6px' : '0'};">Terms & Conditions:</div>
            <div style="color: #475569; font-size: 8px;">${termsText}</div>
          ` : ''}
        </div>

        <div class="signatory-box">
          <div style="font-weight: 800; font-size: 10px; color: ${theme.primary}; text-align: right;">
            For ${companyName}
          </div>
          <div style="height: 35px;"></div>
          <div style="width: 145px; margin-left: auto; text-align: center;">
            <div style="border-top: 1.5px dashed #94a3b8; margin-bottom: 4px;"></div>
            <div style="font-size: 8.5px; font-weight: 800; color: #000000;">
              Authorized Signatory
            </div>
          </div>
        </div>
      </div>

      <div style="text-align: center; font-size: 8px; color: #475569; padding: 4px; border-top: 1px solid #e2e8f0; background: #fafafa;">
        This is a Computer Generated Document
      </div>
    </div>
  </div>
  `;
};

const compileMasterInvoiceHtml = async (invoice, printConfig = {}, options = {}) => {
  const copyType = String(options.copyType || invoice.copyTitle || printConfig.copyTitle || 'BOTH').toUpperCase();
  const includeDuplicate = options.includeDuplicate !== false && copyType !== 'ORIGINAL ONLY';

  let pagesHtml = '';
  if (copyType.includes('DUPLICATE') && copyType !== 'BOTH') {
    pagesHtml = renderSingleInvoicePageHtml(invoice, printConfig, 'DUPLICATE FOR TRANSPORTER', true, false);
  } else if (includeDuplicate) {
    pagesHtml = [
      renderSingleInvoicePageHtml(invoice, printConfig, 'ORIGINAL FOR RECIPIENT', false, false),
      renderSingleInvoicePageHtml(invoice, printConfig, 'DUPLICATE FOR TRANSPORTER', true, true)
    ].join('\n');
  } else {
    pagesHtml = renderSingleInvoicePageHtml(invoice, printConfig, 'ORIGINAL FOR RECIPIENT', false, false);
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TAX INVOICE - ${invoice.invoiceNo || ''}</title>
  <style>
    @page { size: A4 portrait; margin: 6mm 8mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; color: #000000; font-size: 10px; line-height: 1.25; }
    .invoice-wrapper { width: 100%; height: 284mm; max-width: 800px; margin: 0 auto; background: #ffffff; border: 1.5px solid #1e3a8a; border-radius: 4px; overflow: hidden; display: flex; flex-direction: column; }
    .invoice-header { flex: 0 0 auto; padding: 12px 18px 10px 18px; display: flex; justify-content: space-between; align-items: flex-start; }
    .company-title { font-size: 21px; font-weight: 900; letter-spacing: -0.3px; margin-bottom: 4px; }
    .meta-badge { display: inline-block; border: 1px solid #bfdbfe; padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }
    .info-grid { flex: 0 0 auto; display: grid; grid-template-columns: 1.1fr 1fr; }
    .section-bar { color: #ffffff; font-size: 9px; font-weight: 800; padding: 3.5px 8px; text-transform: uppercase; letter-spacing: 0.4px; }
    .items-table-container { flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0; }
    table.invoice-table { width: 100%; height: 100%; border-collapse: collapse; font-size: 9.5px; }
    table.invoice-table th { color: #ffffff; padding: 5px 6px; font-size: 9px; font-weight: 800; border: 1px solid #1e3a8a; text-align: center; }
    tr.table-filler-row { height: 100%; }
    tr.table-filler-row td { border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; border-bottom: none !important; padding: 0; }
    .invoice-bottom-block { flex: 0 0 auto; margin-top: auto; }
    .totals-area { border-top: 1.5px solid #1e3a8a; border-bottom: 1.5px solid #1e3a8a; }
    .calc-row { display: flex; justify-content: flex-end; align-items: center; padding: 2px 12px; font-size: 9px; }
    .banner-row { display: flex; justify-content: space-between; align-items: center; color: #ffffff; padding: 3.5px 12px; font-size: 10.5px; font-weight: 800; }
    table.hsn-table { width: 100%; border-collapse: collapse; font-size: 8.5px; border-bottom: 1px solid #1e3a8a; }
    table.hsn-table th { color: #ffffff; padding: 3px 6px; font-size: 8.5px; font-weight: 800; border: 1px solid #1e3a8a; text-align: center; }
    table.hsn-table td { border: 1px solid #cbd5e1; padding: 2.5px 6px; text-align: right; }
    .footer-grid { display: grid; grid-template-columns: 1.3fr 1fr; padding: 5px 12px; font-size: 8.5px; line-height: 1.35; }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>
  `;
};

const generateMasterInvoicePdf = async (invoice, printConfig = {}, options = {}) => {
  const html = await compileMasterInvoiceHtml(invoice, printConfig, options);

  let browser = null;
  try {
    browser = await puppeteer.launch({
      executablePath: process.env.CHROME_BIN || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined),
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: ['load', 'networkidle0'], timeout: 20000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '6mm', bottom: '6mm', left: '6mm', right: '6mm' }
    });

    return pdfBuffer;
  } catch (err) {
    logger.error(`Error generating master invoice PDF: ${err.message}`, { stack: err.stack });
    throw err;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
  }
};

module.exports = {
  COMPANY_THEMES,
  getTheme,
  compileMasterInvoiceHtml,
  generateMasterInvoicePdf
};
