/**
 * ============================================================================
 * MVVM PDF ARCHITECTURE - VIEW LAYER: PROVIDER BILL VIEW
 * Special-purpose template for AWS, MongoDB Atlas, and SaaS cloud invoices.
 * ============================================================================
 */

class ProviderBillView {
  /**
   * @param {import('../viewmodels/ProviderBillViewModel')} vm
   * @returns {string} HTML string
   */
  static render(vm) {
    const { bill, theme } = vm;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 10mm 10mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 9px;
      color: #111827;
      background: #ffffff;
      line-height: 1.35;
    }
    .bill-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid ${theme.accent};
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .provider-logo-text {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: ${theme.primary};
    }
    .provider-tag {
      display: inline-block;
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      background: ${theme.badgeBg};
      color: ${theme.badgeText};
      padding: 3px 8px;
      border-radius: 4px;
      margin-top: 4px;
    }
    .info-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 16px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    table.bill-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      font-size: 8.5px;
    }
    table.bill-table th {
      background: ${theme.primary};
      color: #ffffff;
      padding: 6px 10px;
      text-align: left;
      font-weight: 700;
      border: 1px solid ${theme.primary};
    }
    table.bill-table td {
      padding: 6px 10px;
      border: 1px solid #e5e7eb;
      vertical-align: top;
    }
    .total-banner {
      margin-top: 16px;
      padding: 12px 16px;
      background: #f3f4f6;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-left: 4px solid ${theme.accent};
    }
    .signatory-container {
      margin-top: 28px;
      display: flex;
      justify-content: flex-end;
    }
    .signatory-inner {
      width: ${vm.signatoryDottedWidth};
      text-align: center;
    }
    .signatory-dashed {
      border-top: ${vm.signatoryDottedBorder};
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="bill-header">
    <div>
      <div class="provider-logo-text">${vm.logoText}</div>
      <div class="provider-tag">${vm.documentTitle}</div>
      <div style="font-size: 8px; color: #4b5563; margin-top: 6px;">
        ${bill.providerName}<br/>
        ${bill.providerAddress}<br/>
        Tax ID / GSTIN: <strong>${bill.providerGstin}</strong>
      </div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 14px; font-weight: 800; color: ${theme.primary};">${bill.invoiceNo}</div>
      <div style="font-size: 8.5px; color: #4b5563; margin-top: 2px;">Invoice Date: <strong>${vm.invoiceDate}</strong></div>
      <div style="font-size: 8.5px; color: #4b5563;">Billing Period: <strong>${vm.billingPeriod}</strong></div>
      <div style="font-size: 8.5px; color: #4b5563;">Account Number: <strong>${vm.accountNumber}</strong></div>
    </div>
  </div>

  <div class="info-card">
    <div>
      <div style="font-size: 7.5px; font-weight: 800; color: #6b7280; text-transform: uppercase;">Customer Information:</div>
      <div style="font-size: 10px; font-weight: 800; color: #111827; margin-top: 2px;">Elite Digital Prints (Enterprise Infrastructure)</div>
      <div style="color: #4b5563;">Plot No. 42-45, GIDC Industrial Estate, Khatodara, Surat - 395002</div>
      <div style="color: #4b5563;">GSTIN: <strong>24AANFE0044M1ZG</strong></div>
    </div>
    <div>
      <div style="font-size: 7.5px; font-weight: 800; color: #6b7280; text-transform: uppercase;">Payment Settlement:</div>
      <div style="font-size: 9.5px; font-weight: 800; color: #059669; margin-top: 2px;">${bill.paymentStatus}</div>
      <div style="color: #4b5563;">Method: <strong>${bill.paymentMethod}</strong></div>
      <div style="color: #4b5563;">Currency: <strong>INR (₹) with USD ($) conversion</strong></div>
    </div>
  </div>

  <table class="bill-table">
    <thead>
      <tr>
        <th style="width: 35px; text-align: center;">Sr.</th>
        <th>Service Description / Usage Type</th>
        <th>Region / Cluster / Resource</th>
        <th style="width: 75px; text-align: right;">Rate / Unit</th>
        <th style="width: 80px; text-align: right;">USD Total</th>
        <th style="width: 95px; text-align: right;">INR Total</th>
      </tr>
    </thead>
    <tbody>
      ${vm.items.map(it => `
        <tr>
          <td style="text-align: center;">${it.srNo}</td>
          <td><strong>${it.description}</strong></td>
          <td>${it.usage}</td>
          <td style="text-align: right;">${it.rate}</td>
          <td style="text-align: right;">${it.amountUsd}</td>
          <td style="text-align: right;"><strong>${it.amountInr}</strong></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="total-banner">
    <div>
      <div style="font-size: 8px; color: #4b5563; text-transform: uppercase; font-weight: 700;">Total Amount Settled</div>
      <div style="font-size: 11px; font-weight: 700; color: #374151;">USD Equivalent: ${vm.usdAmountFormatted}</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 16px; font-weight: 900; color: ${theme.primary};">${vm.inrAmountFormatted}</div>
      <div style="font-size: 7.5px; color: #059669; font-weight: 700;">Zero Balance Due • Automatically Settled</div>
    </div>
  </div>

  <div class="signatory-container">
    <div class="signatory-inner">
      <div style="font-size: 8.5px; font-weight: 800; margin-bottom: 24px; color: #111827;">For ${bill.providerName}</div>
      <div class="signatory-dashed"></div>
      <div style="font-size: 8px; font-weight: 800; color: #000000;">Authorized Signatory</div>
    </div>
  </div>
</body>
</html>`;
  }
}

module.exports = ProviderBillView;
