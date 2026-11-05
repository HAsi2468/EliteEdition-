const puppeteer = require('puppeteer');
const logger = require('../config/logger');

/**
 * Company Themes
 */
const COMPANY_THEMES = {
  'elite digital print': { primary: '#1e1b4b', border: '#1e1b4b' },
  'elite digital prints': { primary: '#1e1b4b', border: '#1e1b4b' },
  'elite edition': { primary: '#312e81', border: '#312e81' },
  'elite stitching': { primary: '#064e3b', border: '#064e3b' },
  'ethno wear': { primary: '#701a75', border: '#701a75' },
  'elite fabtex': { primary: '#78350f', border: '#78350f' },
  'sobise': { primary: '#134e4a', border: '#134e4a' },
  'yamunaji': { primary: '#581c87', border: '#581c87' },
  'elite online': { primary: '#1e3a8a', border: '#1e3a8a' },
  'exedp': { primary: '#1e293b', border: '#1e293b' }
};

const getTheme = (companyEntity = '') => {
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

/**
 * Compile Master HTML exactly matching user specification
 */
const compileMasterInvoiceHtml = async (invoice, printConfig = {}, options = {}) => {
  const companyEntity = invoice.companyEntity || printConfig.companyEntity || 'Elite Digital Print';
  const theme = getTheme(companyEntity);

  const companyName = (printConfig.companyName || companyEntity).toUpperCase();
  const companyGstin = printConfig.companyGstin || '24AANFE0044M1ZG';
  const companyAddress = printConfig.companyAddress || 'Plot No. 42-45, GIDC Industrial Estate, Khatodara, Surat, Gujarat - 395002';
  const companyPhone = printConfig.companyPhone || '+91 99098 66667';
  const companyEmail = printConfig.companyEmail || 'billing@elitedigitalprints.com';
  const companyState = printConfig.companyState || 'Gujarat';
  const companyStateCode = printConfig.companyStateCode || '24';
  const companyPan = printConfig.companyPan || invoice.companyPan || (companyGstin && companyGstin.length >= 12 ? companyGstin.substring(2, 12) : 'AANFE0044M');

  const cust = invoice.customer || {};
  const customerName = cust.businessName || cust.name || 'YAMUNAJI CREATION';
  const customerGstin = cust.gstin || '';
  const customerAddress = cust.billingAddress || 'PLOT NO-115/116, Kohinoor 2 Textile Plaza, CANAL ROAD, Surat, Gujarat - 395010';
  const customerState = cust.state || 'Gujarat';
  const customerStateCode = cust.stateCode || '24';

  const invNo = invoice.invoiceNo || 'EDP/26-27/1042';
  const invDate = invoice.invoiceDate
    ? (new Date(invoice.invoiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/'))
    : '05/11/2026';
  const dueDate = invoice.dueDate
    ? (new Date(invoice.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/'))
    : (invoice.paymentDueDate || '20/11/2026');
  const copyTitle = invoice.copyTitle || printConfig.copyTitle || options.copyTitle || 'ORIGINAL FOR RECIPIENT';
  const placeOfSupply = invoice.placeOfSupply || printConfig.placeOfSupply || `${companyState} (${companyStateCode})`;

  const deliveryTerms = invoice.deliveryBy || invoice.agentName || invoice.brokerName || 'SUNIL';
  const challanNos = invoice.ourChallanNo || (Array.isArray(invoice.linkedChallanNos) ? invoice.linkedChallanNos.join(', ') : 'EDP-1388, EDP-1389, EDP-1390, EDP-1391');

  const items = Array.isArray(invoice.items) && invoice.items.length > 0 ? invoice.items : [];
  const totalQty = items.reduce((sum, it) => sum + Number(it.qty || 0), 0);
  const subtotal = Number(invoice.subtotal || items.reduce((sum, it) => sum + (Number(it.qty || 1) * Number(it.unitPrice || 0)), 0));

  const isIgst = invoice.taxType === 'IGST' || Number(invoice.igstAmount) > 0;
  const totalTax = Number(invoice.totalTax || 0);
  const cgstAmount = Number(invoice.cgstAmount || (totalTax / 2));
  const sgstAmount = Number(invoice.sgstAmount || (totalTax / 2));
  const igstAmount = Number(invoice.igstAmount || totalTax);
  const roundOff = Number(invoice.roundOff || 0);
  const grandTotal = Number(invoice.grandTotal || (subtotal + totalTax + roundOff));

  const hasTds = Boolean(invoice.enableTds || Number(invoice.tdsAmount) > 0);
  const tdsSection = invoice.tdsSection || '194C';
  const tdsRate = Number(invoice.tdsRate || 2);
  const tdsAmount = Number(invoice.tdsAmount || 0);
  const netReceivable = Math.max(0, grandTotal - tdsAmount);

  const bankName = printConfig.companyBankName || 'KOTAK BANK';
  const bankAccount = printConfig.companyAccountNo || '9909866667';
  const bankIfsc = printConfig.companyIfscCode || 'KKBK0000883';

  const rowsHtml = items.map((it, idx) => {
    const qty = Number(it.qty || 1);
    const rate = Number(it.unitPrice || 0);
    const lineAmt = Number(it.totalAmount || (qty * rate));
    return `
      <tr>
        <td style="text-align: center; font-weight: 700; padding: 6px 4px; border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">${idx + 1}</td>
        <td style="text-align: center; padding: 4px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">
          <div style="width: 44px; height: 44px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 3px; margin: 0 auto; overflow: hidden; display: flex; align-items: center; justify-content: center;">
            ${it.imageUrl ? `<img src="${it.imageUrl}" alt="" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span style="font-size: 8px; color: #94a3b8;">Design</span>`}
          </div>
        </td>
        <td style="padding: 6px 8px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">
          <div style="font-weight: 900; font-size: 10.5px; color: #000000;">${it.itemName || 'DIGITAL PRINT JOB WORK 58"'}</div>
          <div style="font-size: 8.5px; font-weight: 700; color: ${theme.primary}; margin-top: 1px;">Design No: ${it.designNo || it.jobNo || 'ED-35'}</div>
          <div style="font-size: 8.5px; color: #0f172a;">Job Card: ${it.jobNo || '-'} &nbsp;|&nbsp; Challan: ${it.ourChallanNo || invoice.ourChallanNo || '-'}</div>
          <div style="font-size: 8.5px; color: #0f172a;">Fabric: ${it.fabric || it.fabricName || '-'} &nbsp;|&nbsp; Lot: ${it.lotNo || '-'}</div>
          ${it.partyChallan ? `<div style="font-size: 8.5px; color: #0f172a;">Party Challan: ${it.partyChallan}</div>` : ''}
        </td>
        <td style="text-align: center; font-family: monospace; padding: 6px 4px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">${it.hsnCode || '998821'}</td>
        <td style="text-align: center; padding: 6px 4px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">${it.taxRate != null ? it.taxRate : 5}%</td>
        <td style="text-align: right; font-weight: 800; padding: 6px 4px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">
          ${qty.toFixed(2)}<br /><span style="font-size: 8px; font-weight: 500; color: #64748b;">${it.unit || 'MTR'}</span>
        </td>
        <td style="text-align: right; padding: 6px 4px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">${rate.toFixed(2)}</td>
        <td style="text-align: center; padding: 6px 4px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">${it.unit || 'MTR'}</td>
        <td style="text-align: right; font-weight: 800; padding: 6px 8px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">${lineAmt.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TAX INVOICE - ${invNo}</title>
  <style>
    @page { size: A4 portrait; margin: 6mm 8mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; color: #000000; font-size: 10px; line-height: 1.25; }
    .invoice-wrapper { width: 100%; max-width: 800px; margin: 0 auto; background: #ffffff; border: 1px solid ${theme.border}; }
    .top-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px 8px 14px; border-bottom: 1px solid #cbd5e1; }
    .title-bar { display: flex; justify-content: space-between; align-items: center; padding: 5px 14px; border-bottom: 1px solid ${theme.border}; }
    .info-grid { display: grid; grid-template-columns: 1.1fr 1fr; border-bottom: 1px solid ${theme.border}; }
    .section-bar { background: ${theme.primary}; color: #ffffff; font-size: 9px; font-weight: 800; padding: 3px 8px; text-transform: uppercase; letter-spacing: 0.4px; }
    table.invoice-table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
    table.invoice-table th { background: ${theme.primary}; color: #ffffff; padding: 6px; font-size: 9px; font-weight: 800; border: 1px solid ${theme.primary}; text-align: center; }
    .totals-area { border-top: 1px solid ${theme.border}; border-bottom: 1px solid ${theme.border}; }
    .calc-row { display: flex; justify-content: flex-end; align-items: center; padding: 2.5px 12px; font-size: 9.5px; }
    .banner-row { display: flex; justify-content: space-between; align-items: center; background: ${theme.primary}; color: #ffffff; padding: 4px 12px; font-size: 10.5px; font-weight: 800; }
    table.hsn-table { width: 100%; border-collapse: collapse; font-size: 8.5px; border-bottom: 1px solid ${theme.border}; }
    table.hsn-table th { background: ${theme.primary}; color: #ffffff; padding: 4px 6px; font-size: 8.5px; font-weight: 800; border: 1px solid ${theme.primary}; text-align: center; }
    table.hsn-table td { border: 1px solid #cbd5e1; padding: 3.5px 6px; text-align: right; }
    .footer-grid { display: grid; grid-template-columns: 1.3fr 1fr; padding: 8px 12px; font-size: 8.5px; line-height: 1.35; }
  </style>
</head>
<body>
  <div class="invoice-wrapper">
    <div class="top-header">
      <div>
        <img src="DigitalLogo.png" alt="Logo" style="height: 48px; display: block;" onerror="this.style.display='none'" />
      </div>
      <div style="text-align: right;">
        <div style="font-size: 13.5px; font-weight: 900; color: #000000;">${companyName} (${companyGstin})</div>
        <div style="font-size: 8.5px; color: #1e293b; margin-top: 2px; line-height: 1.35;">
          ${companyAddress}<br />
          PHONE: ${companyPhone} &nbsp;&nbsp; STATE: ${companyState}, CODE: ${companyStateCode}
        </div>
      </div>
    </div>

    <div class="title-bar">
      <div style="width: 80px;"></div>
      <div style="flex: 1; text-align: center; font-size: 15px; font-weight: 900; color: ${theme.primary}; letter-spacing: 0.5px;">TAX INVOICE</div>
      <div style="font-size: 11px; font-weight: 800;">Date: ${invDate}</div>
    </div>

    <div class="info-grid">
      <div style="border-right: 1px solid ${theme.border};">
        <div class="section-bar">BILL TO</div>
        <div style="padding: 6px 10px; font-size: 9.5px; line-height: 1.35;">
          <div style="font-size: 11px; font-weight: 800;">${customerName} ${customerGstin ? `(GST: ${customerGstin})` : ''}</div>
          <div style="color: #1e293b; margin-top: 2px;">${customerAddress}</div>
          <div style="font-weight: 700; margin-top: 3px;">State: ${customerState}, Code: ${customerStateCode}</div>
        </div>
      </div>

      <div>
        <div class="section-bar">SELLER / DISPATCH DETAILS</div>
        <div style="display: grid; grid-template-columns: 1.1fr 1fr; height: 100%;">
          <div style="padding: 6px 10px; font-size: 9px; border-right: 1px solid #e2e8f0;">
            <div style="color: #475569; font-size: 8.5px;">Challan No.:</div>
            <div style="font-weight: 800; margin-top: 2px;">${challanNos}</div>
          </div>
          <div style="padding: 6px 10px; font-size: 9px;">
            <div style="color: #475569; font-size: 8.5px;">Tax Invoice No.:</div>
            <div style="font-weight: 800; font-size: 10px;">${invNo}</div>
            <div style="color: #475569; font-size: 8.5px; marginTop: 4px;">Terms of Delivery:</div>
            <div style="font-weight: 800;">${deliveryTerms}</div>
          </div>
        </div>
      </div>
    </div>

    <table class="invoice-table">
      <thead>
        <tr>
          <th style="width: 25px;">Sr.</th>
          <th style="width: 55px;">Image</th>
          <th style="text-align: left;">Description of Goods</th>
          <th style="width: 50px;">HSN</th>
          <th style="width: 45px;">GST%</th>
          <th style="width: 60px; text-align: right;">Qty</th>
          <th style="width: 50px; text-align: right;">Rate</th>
          <th style="width: 40px; text-align: center;">Per</th>
          <th style="width: 75px; text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="totals-area">
      <div class="calc-row" style="background: #ffffff; padding: 4px 12px; border-bottom: 1px solid #e2e8f0;">
        <div style="flex: 1; text-align: right; font-weight: 800; padding-right: 50px;">
          Total Qty: &nbsp;&nbsp; ${totalQty.toFixed(2)} MTR
        </div>
        <div style="width: 90px; text-align: right; font-weight: 800;">${subtotal.toFixed(2)}</div>
      </div>

      ${isIgst ? `
        <div class="calc-row">
          <div style="width: 130px; text-align: right; padding-right: 15px; font-weight: 700; color: #334155;">IGST @ 5%</div>
          <div style="width: 90px; text-align: right; font-weight: 800;">${igstAmount.toFixed(2)}</div>
        </div>
      ` : `
        <div class="calc-row">
          <div style="width: 130px; text-align: right; padding-right: 15px; font-weight: 700; color: #334155;">CGST @ 2.5%</div>
          <div style="width: 90px; text-align: right; font-weight: 800;">${cgstAmount.toFixed(2)}</div>
        </div>
        <div class="calc-row">
          <div style="width: 130px; text-align: right; padding-right: 15px; font-weight: 700; color: #334155;">SGST @ 2.5%</div>
          <div style="width: 90px; text-align: right; font-weight: 800;">${sgstAmount.toFixed(2)}</div>
        </div>
      `}

      <div class="calc-row">
        <div style="width: 130px; text-align: right; padding-right: 15px; font-weight: 700; color: #334155;">Round Off</div>
        <div style="width: 90px; text-align: right; font-weight: 800;">${roundOff.toFixed(2)}</div>
      </div>

      <div class="banner-row">
        <div>${totalQty.toFixed(2)} MTR</div>
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

        <div class="banner-row">
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

    <table class="hsn-table">
      <thead>
        <tr>
          <th style="width: 70px; text-align: left; padding: 4px 8px;">HSN</th>
          <th style="width: 90px;">Taxable Value</th>
          <th style="width: 60px;">CGST %</th>
          <th style="width: 80px;">CGST Amount</th>
          <th style="width: 60px;">SGST %</th>
          <th style="width: 80px;">SGST Amount</th>
          <th style="width: 90px;">Total Tax</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="text-align: left; padding: 3.5px 8px; font-weight: 700;">998821</td>
          <td>${subtotal.toFixed(2)}</td>
          <td style="text-align: center;">2.5%</td>
          <td>${cgstAmount.toFixed(2)}</td>
          <td style="text-align: center;">2.5%</td>
          <td>${sgstAmount.toFixed(2)}</td>
          <td style="font-weight: 700;">${totalTax.toFixed(2)}</td>
        </tr>
        <tr style="background: #f8fafc; font-weight: 800;">
          <td style="text-align: left; padding: 3.5px 8px;">Total</td>
          <td>${subtotal.toFixed(2)}</td>
          <td></td>
          <td>${cgstAmount.toFixed(2)}</td>
          <td></td>
          <td>${sgstAmount.toFixed(2)}</td>
          <td>${totalTax.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <div style="padding: 4px 12px; font-size: 8.5px; border-bottom: 1px solid #cbd5e1;">
      <span style="font-weight: 700;">Tax Amount (in words):</span> &nbsp;
      <span>${numberToWordsIndian(totalTax)}</span>
    </div>

    <div class="footer-grid">
      <div>
        <div style="font-weight: 800; text-decoration: underline; margin-bottom: 2px;">Company's Bank Details:</div>
        <div>Bank Name: <strong>${bankName}</strong></div>
        <div>A/c No.: <strong style="font-family: monospace;">${bankAccount}</strong></div>
        <div>Branch & IFS Code: <strong style="font-family: monospace;">${bankIfsc}</strong></div>
        
        <div style="font-weight: 800; margin-top: 6px;">Terms & Conditions:</div>
        <div style="color: #475569; font-size: 8px;">
          Payment due within 30 days from invoice date. Subject to Surat jurisdiction.
        </div>
      </div>

      <div style="text-align: right; display: flex; flex-direction: column; justify-content: space-between;">
        <div style="font-weight: 800; font-size: 10px;">for ${companyName}</div>
        <div style="margin-top: 38px; border-top: 1px solid #000000; width: 140px; margin-left: auto; text-align: center; padding-top: 2px;">
          <span style="font-weight: 700; font-size: 8.5px;">Authorised Signatory</span>
        </div>
      </div>
    </div>

    <div style="text-align: center; font-size: 8px; color: #475569; padding: 4px; border-top: 1px solid #e2e8f0; background: #fafafa;">
      This is a Computer Generated Document
    </div>
  </div>
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
