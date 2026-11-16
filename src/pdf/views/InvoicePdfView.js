/**
 * ============================================================================
 * MVVM PDF ARCHITECTURE - VIEW LAYER: INVOICE PDF VIEW
 * Pure HTML/CSS presentation template receiving an InvoicePdfViewModel.
 * Renders exact brand colors, crisp typography, and tight signatory dotted line.
 * ============================================================================
 */

class InvoicePdfView {
  /**
   * @param {import('../viewmodels/InvoicePdfViewModel')} vm
   * @returns {string} Rendered HTML string ready for Puppeteer PDF conversion
   */
  static render(vm) {
    const { company, invoice, theme } = vm;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 7mm 8mm 7mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 8.5px;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.25;
    }
    .invoice-wrapper {
      width: 100%;
      border: 1.5px solid ${theme.primary};
      border-radius: 4px;
      overflow: hidden;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 12px;
      background: ${theme.tint};
      border-bottom: 1.5px solid ${theme.primary};
    }
    .company-title {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: ${theme.primary};
      margin: 0;
    }
    .badge-pill {
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      padding: 2.5px 8px;
      border-radius: 9999px;
      background: ${theme.primary};
      color: #ffffff;
      letter-spacing: 0.4px;
    }
    .grid-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-bottom: 1px solid #cbd5e1;
    }
    .grid-cell {
      padding: 6px 12px;
    }
    .border-right {
      border-right: 1px solid #cbd5e1;
    }
    .label {
      font-size: 7.5px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
    }
    .val-strong {
      font-weight: 800;
      color: #0f172a;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8px;
    }
    table.data-table th {
      background: ${theme.primary};
      color: #ffffff;
      font-weight: 800;
      padding: 4.5px 6px;
      text-align: left;
      border: 1px solid ${theme.primary};
    }
    table.data-table td {
      padding: 4px 6px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    
    .footer-grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      border-top: 1.5px solid ${theme.primary};
      background: #ffffff;
    }
    .signatory-box {
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border-left: 1px solid #cbd5e1;
    }
    .signatory-line-container {
      width: ${vm.signatoryDottedWidth};
      margin-left: auto;
      text-align: center;
    }
    .signatory-dashed-line {
      border-top: ${vm.signatoryDottedBorder};
      margin-bottom: 3.5px;
    }
    .signatory-label {
      font-size: 8.5px;
      font-weight: 800;
      color: #000000;
    }
  </style>
</head>
<body>
  <div class="invoice-wrapper">
    <!-- Header Bar -->
    <div class="header-bar">
      <div>
        <h1 class="company-title">${company.name}</h1>
        <div style="font-size: 8px; color: #475569; margin-top: 2px;">
          ${company.address}
        </div>
      </div>
      <div style="text-align: right;">
        <span class="badge-pill">TAX INVOICE</span>
        <div style="font-size: 8px; margin-top: 3px; font-weight: 700; color: ${theme.primary};">
          ORIGINAL FOR RECIPIENT
        </div>
      </div>
    </div>

    <!-- Company & Invoice Meta Info -->
    <div class="grid-2col">
      <div class="grid-cell border-right">
        <div><span class="label">GSTIN:</span> <span class="val-strong">${company.gstin}</span> &nbsp;|&nbsp; <span class="label">PAN:</span> <span class="val-strong">${company.pan}</span></div>
        <div><span class="label">State:</span> <span>${company.state} (Code: ${company.stateCode})</span> &nbsp;|&nbsp; <span class="label">Phone:</span> <span>${company.phone}</span></div>
      </div>
      <div class="grid-cell">
        <div style="display: flex; justify-content: space-between;">
          <div><span class="label">Invoice No:</span> <strong style="font-size: 10px; color: ${theme.primary}; font-family: monospace;">${invoice.invoiceNo}</strong></div>
          <div><span class="label">Date:</span> <strong style="font-size: 9.5px;">${invoice.invoiceDate}</strong></div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 2px;">
          <div><span class="label">Challans:</span> <span style="font-weight: 700;">${invoice.dispatch.challans}</span></div>
          <div><span class="label">Transport:</span> <span>${invoice.dispatch.transport}</span></div>
        </div>
      </div>
    </div>

    <!-- Buyer / Bill-To Section -->
    <div class="grid-2col">
      <div class="grid-cell border-right" style="background: #fafafa;">
        <div class="label" style="margin-bottom: 2px;">Billed To (Customer):</div>
        <div style="font-size: 10px; font-weight: 800; color: #000;">${invoice.customer.name}</div>
        <div style="font-size: 8px; color: #334155;">${invoice.customer.address}</div>
        <div style="margin-top: 2px;">
          <span class="label">GSTIN:</span> <span class="val-strong">${invoice.customer.gstin}</span>
          &nbsp;|&nbsp; <span class="label">State:</span> <span>${invoice.customer.state} (${invoice.customer.stateCode})</span>
        </div>
      </div>
      <div class="grid-cell" style="background: #fafafa;">
        <div class="label" style="margin-bottom: 2px;">Dispatch & Delivery Details:</div>
        <div><span class="label">Agent / Broker:</span> <strong>${invoice.dispatch.agent}</strong></div>
        <div><span class="label">Terms of Delivery:</span> <span>${invoice.dispatch.terms}</span></div>
        <div><span class="label">Place of Supply:</span> <strong>${invoice.placeOfSupply}</strong></div>
        <div><span class="label">Reverse Charge:</span> <span>${invoice.isReverseCharge ? 'YES' : 'NO'}</span></div>
      </div>
    </div>

    <!-- Itemized Particulars Table -->
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 30px;" class="text-center">Sr.</th>
          <th>Description of Goods / Job Work</th>
          <th style="width: 55px;" class="text-center">Design</th>
          <th style="width: 60px;" class="text-center">Job Card</th>
          <th style="width: 50px;" class="text-center">HSN</th>
          <th style="width: 65px;" class="text-right">Qty</th>
          <th style="width: 55px;" class="text-right">Rate (₹)</th>
          <th style="width: 80px;" class="text-right">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${vm.items.map(it => `
          <tr>
            <td class="text-center">${it.srNo}</td>
            <td>
              <strong>${it.description}</strong>
              ${it.fabric ? `<span style="color: #64748b;"> • ${it.fabric}</span>` : ''}
              ${it.lot ? `<span style="color: #64748b;"> [${it.lot}]</span>` : ''}
            </td>
            <td class="text-center"><strong>${it.design || '-'}</strong></td>
            <td class="text-center" style="font-family: monospace;">${it.jobNo || '-'}</td>
            <td class="text-center">${it.hsn}</td>
            <td class="text-right"><strong>${it.qtyFormatted}</strong></td>
            <td class="text-right">${it.rateFormatted}</td>
            <td class="text-right"><strong>${it.amountFormatted}</strong></td>
          </tr>
        `).join('')}
        
        <!-- Totals & Taxes Breakdown -->
        <tr style="background: #f8fafc; font-weight: 700;">
          <td colspan="5" class="text-right" style="padding: 4px 8px;">Subtotal (Taxable Value):</td>
          <td colspan="3" class="text-right" style="padding: 4px 8px; font-size: 9px;">₹ ${vm.subtotalFormatted}</td>
        </tr>
        ${vm.isInterState ? `
          <tr style="background: #ffffff;">
            <td colspan="5" class="text-right" style="padding: 3px 8px; color: #475569;">Integrated GST (IGST 5.0%):</td>
            <td colspan="3" class="text-right" style="padding: 3px 8px;">₹ ${vm.formatCurrency(vm.igstAmount)}</td>
          </tr>
        ` : `
          <tr style="background: #ffffff;">
            <td colspan="5" class="text-right" style="padding: 3px 8px; color: #475569;">Central GST (CGST 2.5%):</td>
            <td colspan="3" class="text-right" style="padding: 3px 8px;">₹ ${vm.formatCurrency(vm.cgstAmount)}</td>
          </tr>
          <tr style="background: #ffffff;">
            <td colspan="5" class="text-right" style="padding: 3px 8px; color: #475569;">State GST (SGST 2.5%):</td>
            <td colspan="3" class="text-right" style="padding: 3px 8px;">₹ ${vm.formatCurrency(vm.sgstAmount)}</td>
          </tr>
        `}
        ${vm.roundOff !== 0 ? `
          <tr style="background: #ffffff;">
            <td colspan="5" class="text-right" style="padding: 3px 8px; color: #64748b;">Round Off:</td>
            <td colspan="3" class="text-right" style="padding: 3px 8px;">₹ ${vm.roundOffFormatted}</td>
          </tr>
        ` : ''}
        <tr style="background: ${theme.tint}; font-weight: 800; font-size: 10px; color: ${theme.primary}; border-top: 1.5px solid ${theme.primary};">
          <td colspan="5" class="text-right" style="padding: 5px 8px;">Invoice Grand Total:</td>
          <td colspan="3" class="text-right" style="padding: 5px 8px;">₹ ${vm.grandTotalFormatted}</td>
        </tr>
        ${vm.hasTds ? `
          <tr style="background: #fffbeb; font-weight: 700; color: #b45309;">
            <td colspan="5" class="text-right" style="padding: 3.5px 8px;">Less: TDS u/s 194C (${vm.tdsPercentage}%):</td>
            <td colspan="3" class="text-right" style="padding: 3.5px 8px;">- ₹ ${vm.formatCurrency(vm.tdsAmount)}</td>
          </tr>
          <tr style="background: #ecfdf5; font-weight: 800; font-size: 10px; color: #047857;">
            <td colspan="5" class="text-right" style="padding: 4.5px 8px;">Net Payable / Receivable:</td>
            <td colspan="3" class="text-right" style="padding: 4.5px 8px;">₹ ${vm.netReceivableFormatted}</td>
          </tr>
        ` : ''}
      </tbody>
    </table>

    <!-- Amount in Words -->
    <div style="padding: 4px 10px; font-size: 8px; border-bottom: 1px solid #cbd5e1; background: #fafafa;">
      <span class="label">Amount (in words):</span>
      <span style="font-weight: 700; color: #0f172a;">${vm.grandTotalWords}</span>
    </div>

    <!-- Bank Details & Authorized Signatory Footer -->
    <div class="footer-grid">
      <div style="padding: 7px 12px; font-size: 8px;">
        <div style="font-weight: 800; text-decoration: underline; margin-bottom: 3px; color: ${theme.primary};">
          Company's Bank Details:
        </div>
        <div>Bank Name: <strong>${company.bankName}</strong></div>
        <div>A/c No.: <strong style="font-family: monospace; font-size: 9px;">${company.bankAccount}</strong></div>
        <div>Branch & IFS Code: <strong style="font-family: monospace;">${company.bankIfsc}</strong> (${company.bankBranch})</div>
        
        <div style="font-weight: 800; margin-top: 5px; color: #475569;">Terms & Conditions:</div>
        <div style="color: #64748b; font-size: 7.5px;">
          1. Goods once sold will not be taken back.<br/>
          2. Payment due within 15 days. Subject to Surat jurisdiction only.
        </div>
      </div>

      <!-- Signatory Box with Strict Dotted Line Spec -->
      <div class="signatory-box">
        <div style="font-weight: 800; font-size: 9.5px; color: #000000; text-align: right;">
          For ${company.name}
        </div>
        <div style="height: 36px;"></div>
        <div class="signatory-line-container">
          <div class="signatory-dashed-line"></div>
          <div class="signatory-label">Authorized Signatory</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }
}

module.exports = InvoicePdfView;
