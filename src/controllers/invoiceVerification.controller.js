/**
 * Controller: Digital Public Tax Invoice Verification & Viewer
 *
 * Provides instant public verification and mobile-friendly full view of Tax Invoices
 * when scanning QR codes or clicking links from Job Cards and Delivery Challans.
 */

const mongoose = require('mongoose');
const BillingInvoice = require('../db/models/billingInvoice.model');

/**
 * Endpoint: Verify and view Tax Invoice publicly by Invoice No or ObjectId
 * GET /verify/invoice/:id
 * GET /v1/verify/invoice/:id
 */
const verifyInvoice = async (req, res) => {
  try {
    const rawParam = req.params.id || req.params[0] || '';
    if (!rawParam || !rawParam.trim()) {
      return res.status(400).json({ success: false, error: 'Invoice identifier is required.' });
    }

    let cleanParam = decodeURIComponent(String(rawParam).trim());
    let invoice = null;

    // 1. Direct ObjectId lookup
    if (mongoose.Types.ObjectId.isValid(cleanParam)) {
      invoice = await BillingInvoice.findById(cleanParam).lean();
    }

    // 2. Lookup by Invoice Number variations
    if (!invoice) {
      const slashVariant = cleanParam.replace(/-/g, '/');
      const hyphenVariant = cleanParam.replace(/\//g, '-');
      const digitsMatch = cleanParam.match(/\d+$/);
      const digits = digitsMatch ? digitsMatch[0] : '';
      const num = digits ? parseInt(digits, 10) : null;

      const orConditions = [
        { invoiceNo: cleanParam },
        { invoiceNo: slashVariant },
        { invoiceNo: hyphenVariant },
        { invoiceNo: cleanParam.toUpperCase() },
        { invoiceNo: slashVariant.toUpperCase() },
        { invoiceNo: new RegExp('^' + cleanParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
      ];

      if (digits) {
        orConditions.push({ invoiceNo: new RegExp(`[/-]${digits}$`, 'i') });
      }
      if (num !== null && !isNaN(num)) {
        orConditions.push({ invoiceSeq: num });
      }

      invoice = await BillingInvoice.findOne({ $or: orConditions }).lean();
    }

    if (!invoice) {
      if (req.accepts('html')) {
        return res.status(404).send(renderInvalidInvoiceHtml(cleanParam));
      }
      return res.status(404).json({
        success: false,
        verified: false,
        error: 'INVOICE_NOT_FOUND',
        message: `Tax Invoice '${cleanParam}' was not found in the ERP database.`
      });
    }

    if (req.accepts('html')) {
      return res.status(200).send(renderValidInvoiceHtml(invoice));
    }

    return res.json({
      success: true,
      verified: true,
      data: invoice
    });
  } catch (err) {
    console.error('Error verifying invoice:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

/**
 * HTML Template for Authenticated Tax Invoice Viewer
 */
function renderValidInvoiceHtml(inv) {
  const invNo = inv.invoiceNo || '—';
  const company = inv.companyEntity || 'Elite Digital Print';
  const custName = inv.customer?.businessName || inv.customer?.name || '—';
  const custGst = inv.customer?.gstin || '—';
  const custAddress = inv.customer?.billingAddress || inv.customer?.shippingAddress || '';
  
  const invDate = inv.invoiceDate
    ? new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  const dueDate = inv.dueDate
    ? new Date(inv.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  const isPaid = (inv.paymentStatus || '').toUpperCase() === 'PAID';
  const statusColor = isPaid ? '#10b981' : '#f59e0b';
  const statusBg = isPaid ? '#dcfce7' : '#fef3c7';

  const items = Array.isArray(inv.items) ? inv.items : [];
  const linkedChallans = Array.isArray(inv.linkedChallanNos) && inv.linkedChallanNos.length > 0
    ? inv.linkedChallanNos
    : (inv.ourChallanNo ? [inv.ourChallanNo] : []);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0">
  <title>Tax Invoice #${invNo} — Elite Digital Prints</title>
  <link rel="icon" type="image/png" href="/DigitalLogo.png">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
    body { background-color: #f1f5f9; color: #000000; padding: 12px; display: flex; justify-content: center; }
    .card-container { max-width: 650px; width: 100%; background: #ffffff; border: 1.5px solid #000000; box-shadow: 0 10px 25px rgba(0,0,0,0.08); overflow: hidden; }
    
    /* Header */
    .header-bar { display: flex; align-items: stretch; justify-content: space-between; border-bottom: 1.5px solid #000; background: #ffffff; }
    .logo-box { width: 110px; padding: 6px 8px; display: flex; align-items: center; justify-content: center; border-right: 1.5px solid #000; }
    .logo-box img { max-height: 42px; width: 100%; object-fit: contain; }
    .header-center { flex: 1; text-align: center; padding: 6px; display: flex; flex-direction: column; justify-content: center; }
    .company-title { font-size: 13pt; font-weight: 900; letter-spacing: 0.5px; color: #000; text-transform: uppercase; }
    .company-subtitle { font-size: 8pt; font-weight: 700; color: #475569; letter-spacing: 0.5px; margin-top: 1px; }
    .verified-box { width: 110px; padding: 6px 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1.5px solid #000; background: #f8fafc; text-align: center; }
    .verified-pill { font-size: 7pt; font-weight: 800; color: #166534; background: #dcfce7; padding: 2px 6px; border-radius: 3px; display: inline-block; margin-top: 2px; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; font-size: 8pt; }
    td, th { border: 1px solid #000000; padding: 4px 6px; vertical-align: middle; }
    .label { font-weight: 800; background: #f8fafc; font-size: 7.5pt; white-space: nowrap; }
    .val { font-weight: 600; font-size: 8pt; }
    .val-highlight { font-weight: 800; color: #0b5394; }

    .items-table th { background: #f1f5f9; font-weight: 800; text-align: center; font-size: 7.5pt; }
    .num-col { text-align: right; font-weight: 700; }
    .center-col { text-align: center; }

    .total-box { font-size: 9pt; font-weight: 900; color: #166534; text-align: right; }
    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 800; font-size: 8pt; }

    @media (max-width: 480px) {
      body { padding: 4px; }
      td, th { padding: 3px 4px; font-size: 7.5pt; }
      .company-title { font-size: 11pt; }
    }
  </style>
</head>
<body>
  <div class="card-container">
    <!-- HEADER -->
    <div class="header-bar">
      <div class="logo-box">
        <img src="/DigitalLogo.png" alt="Elite Digital Prints" onerror="this.style.display='none'">
      </div>
      <div class="header-center">
        <div class="company-title">${company}</div>
        <div class="company-subtitle">TAX INVOICE (JOB WORK)</div>
      </div>
      <div class="verified-box">
        <div style="font-size: 7pt; font-weight: 900; color: #000;">OFFICIAL ERP</div>
        <div class="verified-pill">✓ VERIFIED</div>
      </div>
    </div>

    <!-- INVOICE META TABLE -->
    <table>
      <tr>
        <td class="label" style="width: 18%;">INVOICE NO. :</td>
        <td class="val val-highlight" style="width: 32%; font-size: 9.5pt;">${invNo}</td>
        <td class="label" style="width: 18%;">DATE :</td>
        <td class="val" style="width: 32%;">${invDate}</td>
      </tr>
      <tr>
        <td class="label">PARTY :</td>
        <td class="val" style="font-weight: 800; font-size: 8.5pt;">${custName}</td>
        <td class="label">PAYMENT :</td>
        <td class="val">
          <span class="status-badge" style="color: ${statusColor}; background: ${statusBg}; border: 1px solid ${statusColor};">
            ${inv.paymentStatus || 'UNPAID'}
          </span>
        </td>
      </tr>
      ${custGst && custGst !== '—' ? `
      <tr>
        <td class="label">GSTIN :</td>
        <td class="val" colspan="3">${custGst}</td>
      </tr>` : ''}
      ${custAddress ? `
      <tr>
        <td class="label">ADDRESS :</td>
        <td class="val" colspan="3" style="font-size: 7.5pt; color: #475569;">${custAddress}</td>
      </tr>` : ''}
    </table>

    <!-- LINKED CHALLANS / JOB CARDS BAR -->
    ${linkedChallans.length > 0 ? `
    <div style="padding: 4px 6px; border: 1px solid #000; border-top: none; background: #f8fafc; font-size: 7.5pt;">
      <strong>Linked Delivery Challan(s):</strong>
      ${linkedChallans.map(c => {
        const cleanNo = String(c).replace(/^EDP-?/i, '');
        return `<a href="/verify/challan/${cleanNo}" target="_blank" style="color: #2563eb; text-decoration: underline; font-weight: 700; margin-left: 6px;">EDP-${cleanNo}</a>`;
      }).join(', ')}
    </div>` : ''}

    <!-- ITEMS TABLE -->
    <table class="items-table" style="margin-top: 2px;">
      <thead>
        <tr>
          <th style="width: 28px;">#</th>
          <th>Particulars / Description</th>
          <th style="width: 80px;">Job No</th>
          <th style="width: 65px;">Meters</th>
          <th style="width: 55px;">Rate</th>
          <th style="width: 85px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, idx) => `
          <tr>
            <td class="center-col" style="font-weight: 700;">${idx + 1}</td>
            <td>
              <div style="font-weight: 700;">${item.itemName || 'Job Work Digital Printing'}</div>
              ${item.fabric || item.fabricName ? `<div style="font-size: 7pt; color: #64748b;">Fabric: ${item.fabric || item.fabricName}</div>` : ''}
            </td>
            <td class="center-col">
              ${item.jobNo ? `<a href="/verify/jobcard/${encodeURIComponent(item.jobNo)}" target="_blank" style="color: #2563eb; text-decoration: underline; font-weight: 700;">${item.jobNo}</a>` : '—'}
            </td>
            <td class="num-col">${Number((item.qty || 0).toFixed(2))}</td>
            <td class="num-col">₹${Number((item.unitPrice || 0).toFixed(2))}</td>
            <td class="num-col" style="font-weight: 800;">₹${Number((item.totalAmount || 0).toFixed(2))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- TOTALS TABLE -->
    <table style="margin-top: 2px;">
      <tr>
        <td colspan="4" style="text-align: right; font-weight: 800; background: #f8fafc;">Subtotal :</td>
        <td class="num-col" style="width: 100px; font-weight: 800;">₹${Number((inv.subtotal || 0).toFixed(2))}</td>
      </tr>
      ${inv.cgstAmount > 0 || inv.sgstAmount > 0 ? `
      <tr>
        <td colspan="4" style="text-align: right; background: #f8fafc; font-size: 7.5pt;">CGST + SGST (5%) :</td>
        <td class="num-col" style="font-size: 7.5pt;">₹${Number(((inv.cgstAmount || 0) + (inv.sgstAmount || 0)).toFixed(2))}</td>
      </tr>` : ''}
      ${inv.igstAmount > 0 ? `
      <tr>
        <td colspan="4" style="text-align: right; background: #f8fafc; font-size: 7.5pt;">IGST (5%) :</td>
        <td class="num-col" style="font-size: 7.5pt;">₹${Number((inv.igstAmount || 0).toFixed(2))}</td>
      </tr>` : ''}
      ${inv.roundOff ? `
      <tr>
        <td colspan="4" style="text-align: right; background: #f8fafc; font-size: 7.5pt;">Round Off :</td>
        <td class="num-col" style="font-size: 7.5pt;">${inv.roundOff > 0 ? '+' : ''}${inv.roundOff}</td>
      </tr>` : ''}
      <tr>
        <td colspan="4" style="text-align: right; font-weight: 900; font-size: 9.5pt; background: #f1f5f9;">Grand Total :</td>
        <td class="num-col total-box" style="font-size: 10pt;">₹${Number((inv.grandTotal || 0).toFixed(2))}</td>
      </tr>
    </table>

    <!-- FOOTER -->
    <div style="padding: 6px 8px; border: 1.5px solid #000; border-top: none; font-size: 6.5pt; color: #475569; background: #ffffff; line-height: 1.35;">
      <strong>Note:</strong> ${inv.notes || 'Official tax invoice issued by Elite Digital Prints ERP.'}<br/>
      <strong>Authentication:</strong> This document has been verified against the official Elite Edition ERP financial database.
    </div>
  </div>
</body>
</html>`;
}

/**
 * 404 HTML Template when Invoice is not found
 */
function renderInvalidInvoiceHtml(param) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice Not Found — Elite Digital Prints</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; max-width: 440px; width: 100%; padding: 32px 24px; text-align: center; }
    .badge { display: inline-block; background: #ef4444; color: #fff; padding: 4px 12px; border-radius: 9999px; font-weight: 800; font-size: 12px; margin-bottom: 16px; }
    h1 { font-size: 20px; font-weight: 800; margin-bottom: 8px; color: #ffffff; }
    p { color: #94a3b8; font-size: 13.5px; line-height: 1.5; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">NOT FOUND</div>
    <h1>Tax Invoice Not Found</h1>
    <p>Could not locate any active Tax Invoice with identifier <strong>"${param}"</strong> in Elite Digital Prints ERP database.</p>
  </div>
</body>
</html>`;
}

module.exports = {
  verifyInvoice
};
