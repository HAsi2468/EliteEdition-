const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const companiesData = [
  {
    companyEntity: 'Elite Digital Print',
    companyName: 'ELITE DIGITAL PRINTS',
    companyGstin: '24AANFE0044M1ZG',
    companyAddress: 'Plot No. 42-45, GIDC Industrial Estate, Khatodara, Surat, Gujarat - 395002',
    companyPhone: '+91 99098 66667',
    companyEmail: 'billing@elitedigitalprints.com',
    companyState: 'Gujarat',
    companyStateCode: '24',
    companyPan: 'AANFE0044M',
    theme: { primary: '#1e3a8a', border: '#1e3a8a', badgeBg: '#dbeafe', badgeText: '#1e40af' },
    invoiceNo: 'EDP/26-27/1042',
    invoiceDate: '05/11/2026',
    dueDate: '20/11/2026',
    customer: {
      name: 'YAMUNAJI CREATION',
      address: 'Plot No. 115/116, Kohinoor 2 Textile Plaza, Canal Road, Surat, Gujarat - 395010',
      gstin: '24AAEFY0361N1ZZ',
      state: 'Gujarat',
      stateCode: '24',
      pan: 'AAEFY0361N'
    },
    dispatch: {
      challans: 'EDP-1388, EDP-1389, EDP-1390, EDP-1391',
      transport: 'BY ROAD (MAHESH TRANSPORT)',
      agent: 'SUNIL (SHREE RAM TEXTILE)',
      terms: 'DOOR DELIVERY / SURAT'
    },
    items: [
      { name: 'DIGITAL PRINT JOB WORK 58"', design: 'ED-35', jobNo: 'JC-4412', fabric: 'CAPSULE FOIL', lot: 'LOT-982', hsn: '998821', gst: 5, qty: 1532.50, rate: 11.50, amount: 17623.75 },
      { name: 'DIGITAL PRINT JOB WORK 58"', design: 'ED-36', jobNo: 'JC-4413', fabric: 'ROMAN SILK', lot: 'LOT-983', hsn: '998821', gst: 5, qty: 1840.00, rate: 12.00, amount: 22080.00 },
      { name: 'DIGITAL PRINT JOB WORK 44"', design: 'ED-37', jobNo: 'JC-4414', fabric: 'PURE VISCOSE', lot: 'LOT-984', hsn: '998821', gst: 5, qty: 1180.20, rate: 11.50, amount: 13572.30 }
    ],
    taxable: 53276.05,
    cgst: 1331.90,
    sgst: 1331.90,
    roundOff: 0.25,
    grandTotal: 55940.00,
    hasTds: true,
    tdsAmount: 1065.52,
    netReceivable: 54874.48,
    words: 'Rupees Fifty Five Thousand Nine Hundred Forty Only',
    netWords: 'Rupees Fifty Four Thousand Eight Hundred Seventy Four Only'
  },
  {
    companyEntity: 'Elite Edition',
    companyName: 'ELITE EDITION',
    companyGstin: '24BSWPA7682P1ZS',
    companyAddress: '1095, SIDDHESWAR SOC, KALAPOOL, PUNAGAM, Surat, Gujarat - 395010',
    companyPhone: '+91 76006 65058',
    companyEmail: 'accounts@eliteedition.in',
    companyState: 'Gujarat',
    companyStateCode: '24',
    companyPan: 'BSWPA7682P',
    theme: { primary: '#312e81', border: '#312e81', badgeBg: '#ede9fe', badgeText: '#4338ca' },
    invoiceNo: 'EE/26-27/0815',
    invoiceDate: '04/11/2026',
    dueDate: '19/11/2026',
    customer: {
      name: 'SHREE RAM FASHIONS',
      address: 'Shop No. 402-404, Millennium Textile Market 2, Ring Road, Surat - 395002',
      gstin: '24AAJFS1294K1Z8',
      state: 'Gujarat',
      stateCode: '24',
      pan: 'AAJFS1294K'
    },
    dispatch: {
      challans: 'EE-0921, EE-0922',
      transport: 'BY TEMPO (LOCAL)',
      agent: 'RAJESHBHAI CHOTHANI',
      terms: 'EX-MILL / SURAT'
    },
    items: [
      { name: 'PREMIUM HEAVY RAYON PRINT 44"', design: 'EE-102', jobNo: 'JC-8810', fabric: '14KG RAYON', lot: 'LOT-551', hsn: '998821', gst: 5, qty: 2450.00, rate: 13.00, amount: 31850.00 },
      { name: 'MODAL SATIN DIGITAL PRINT 44"', design: 'EE-103', jobNo: 'JC-8811', fabric: 'MODAL SATIN', lot: 'LOT-552', hsn: '998821', gst: 5, qty: 1980.50, rate: 14.50, amount: 28717.25 }
    ],
    taxable: 60567.25,
    cgst: 1514.18,
    sgst: 1514.18,
    roundOff: 0.39,
    grandTotal: 63596.00,
    hasTds: false,
    tdsAmount: 0,
    netReceivable: 63596.00,
    words: 'Rupees Sixty Three Thousand Five Hundred Ninety Six Only',
    netWords: 'Rupees Sixty Three Thousand Five Hundred Ninety Six Only'
  },
  {
    companyEntity: 'Ethno wear',
    companyName: 'ELITE ETHNOWEAR',
    companyGstin: '24AANFE3950C1ZO',
    companyAddress: 'F-112/113, Laxminarayan Industrial Society, Oppo Daxeshvar Mandir, Udhna, Surat - 394210',
    companyPhone: '+91 90337 55661',
    companyEmail: 'ethnowear@elitedigitalprints.com',
    companyState: 'Gujarat',
    companyStateCode: '24',
    companyPan: 'AANFE3950C',
    theme: { primary: '#8b5a2b', border: '#8b5a2b', badgeBg: '#fbf3ec', badgeText: '#6b3e1b' }, // Ethnowear Brand Brown
    invoiceNo: 'ETW/26-27/0420',
    invoiceDate: '03/11/2026',
    dueDate: '18/11/2026',
    customer: {
      name: 'RADHE KRISHNA TEXTILES',
      address: '201-203, Raghukul Textile Market, Ring Road, Surat, Gujarat - 395002',
      gstin: '24ABUPR9812M1Z2',
      state: 'Gujarat',
      stateCode: '24',
      pan: 'ABUPR9812M'
    },
    dispatch: {
      challans: 'ETW-512, ETW-513',
      transport: 'BY PARCEL (SURAT EXPRESS)',
      agent: 'BHARATBHAI DESAI',
      terms: 'DOOR DELIVERY'
    },
    items: [
      { name: 'KURTI DIGITAL FOIL JOB WORK', design: 'EW-504', jobNo: 'JC-3101', fabric: 'CHANDERI SILK', lot: 'LOT-210', hsn: '998821', gst: 5, qty: 1250.00, rate: 16.00, amount: 20000.00 },
      { name: 'ETHNIC PRINT WITH FOIL 58"', design: 'EW-505', jobNo: 'JC-3102', fabric: 'ORGANZA TISSUE', lot: 'LOT-211', hsn: '998821', gst: 5, qty: 1600.00, rate: 15.50, amount: 24800.00 }
    ],
    taxable: 44800.00,
    cgst: 1120.00,
    sgst: 1120.00,
    roundOff: 0.00,
    grandTotal: 47040.00,
    hasTds: true,
    tdsAmount: 896.00,
    netReceivable: 46144.00,
    words: 'Rupees Forty Seven Thousand Forty Only',
    netWords: 'Rupees Forty Six Thousand One Hundred Forty Four Only'
  },
  {
    companyEntity: 'Elite Fabtex',
    companyName: 'ELITE FABTEX',
    companyGstin: '24AAJFE5663L1Z3',
    companyAddress: '101-102, KOHINOOR-2 TEXTILE PLAZA, OPPO AVADH-2, SAROLI, SURAT - 395010',
    companyPhone: '+91 99791 12777',
    companyEmail: 'fabtex@elitedigitalprints.com',
    companyState: 'Gujarat',
    companyStateCode: '24',
    companyPan: 'AAJFE5663L',
    theme: { primary: '#78350f', border: '#78350f', badgeBg: '#fef3c7', badgeText: '#92400e' },
    invoiceNo: 'EFT/26-27/0312',
    invoiceDate: '02/11/2026',
    dueDate: '17/11/2026',
    customer: {
      name: 'MAHAVIR SILK MILLS',
      address: 'B-301, New Bombay Market, Umarwada, Surat, Gujarat - 395010',
      gstin: '24AACCM4411Q1ZW',
      state: 'Gujarat',
      stateCode: '24',
      pan: 'AACCM4411Q'
    },
    dispatch: {
      challans: 'EFT-710, EFT-711, EFT-712',
      transport: 'BY ROAD (JAI HIND CARRIERS)',
      agent: 'JAGDISHBHAI PATEL',
      terms: 'DOOR DELIVERY / SURAT'
    },
    items: [
      { name: 'ORGANZA PRINTING & FINISHING 58"', design: 'FT-801', jobNo: 'JC-7210', fabric: 'GLASS ORGANZA', lot: 'LOT-412', hsn: '998821', gst: 5, qty: 2100.00, rate: 12.50, amount: 26250.00 },
      { name: 'TABBY SILK PRINTING JOB WORK 44"', design: 'FT-802', jobNo: 'JC-7211', fabric: 'TABBY SILK', lot: 'LOT-413', hsn: '998821', gst: 5, qty: 1750.00, rate: 14.00, amount: 24500.00 }
    ],
    taxable: 50750.00,
    cgst: 1268.75,
    sgst: 1268.75,
    roundOff: -0.50,
    grandTotal: 53287.00,
    hasTds: false,
    tdsAmount: 0,
    netReceivable: 53287.00,
    words: 'Rupees Fifty Three Thousand Two Hundred Eighty Seven Only',
    netWords: 'Rupees Fifty Three Thousand Two Hundred Eighty Seven Only'
  },
  {
    companyEntity: 'Yamunaji',
    companyName: 'YAMUNAJI CREATION',
    companyGstin: '24AAEFY0361N1ZZ',
    companyAddress: 'GROUND FLOOR, PLOT NO-115/116, Kohinoor 2 Textile Plaza, CANAL ROAD, Surat - 395010',
    companyPhone: '+91 99791 12777',
    companyEmail: 'yamunajicreation@gmail.com',
    companyState: 'Gujarat',
    companyStateCode: '24',
    companyPan: 'AAEFY0361N',
    theme: { primary: '#581c87', border: '#581c87', badgeBg: '#f3e8ff', badgeText: '#6b21a8' },
    invoiceNo: 'YC/26-27/1190',
    invoiceDate: '01/11/2026',
    dueDate: '16/11/2026',
    customer: {
      name: 'BALAJI TEXTILE AGENCY',
      address: 'Shop 118, Good Luck Textile Market, Ring Road, Surat, Gujarat - 395002',
      gstin: '24AAGPB7722R1ZE',
      state: 'Gujarat',
      stateCode: '24',
      pan: 'AAGPB7722R'
    },
    dispatch: {
      challans: 'YC-911, YC-912',
      transport: 'BY HAND DELIVERY',
      agent: 'RAMESHBHAI PARMAR',
      terms: 'DOOR DELIVERY / SURAT'
    },
    items: [
      { name: 'DUPATTA DIGITAL ROTARY JOB 2.25M', design: 'YC-210', jobNo: 'JC-1901', fabric: 'CHIFFON CRAPE', lot: 'LOT-671', hsn: '998821', gst: 5, qty: 1450.00, rate: 18.00, amount: 26100.00 },
      { name: 'SCARF & STOLE PRINTING JOB', design: 'YC-211', jobNo: 'JC-1902', fabric: 'POLY SATIN', lot: 'LOT-672', hsn: '998821', gst: 5, qty: 1300.00, rate: 15.00, amount: 19500.00 }
    ],
    taxable: 45600.00,
    cgst: 1140.00,
    sgst: 1140.00,
    roundOff: 0.00,
    grandTotal: 47880.00,
    hasTds: true,
    tdsAmount: 912.00,
    netReceivable: 46968.00,
    words: 'Rupees Forty Seven Thousand Eight Hundred Eighty Only',
    netWords: 'Rupees Forty Six Thousand Nine Hundred Sixty Eight Only'
  }
];

function renderSingleInvoice(comp) {
  const t = comp.theme;
  const totalQty = comp.items.reduce((s, it) => s + it.qty, 0);

  const rows = comp.items.map((it, idx) => `
    <tr>
      <td style="text-align: center; font-weight: 700; padding: 6px 4px; border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">${idx + 1}</td>
      <td style="text-align: center; padding: 4px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">
        <div style="width: 44px; height: 44px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 3px; margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 800; color: ${t.primary};">
          ${it.design}
        </div>
      </td>
      <td style="padding: 6px 8px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">
        <div style="font-weight: 900; font-size: 10.5px; color: #000000;">${it.name}</div>
        <div style="font-size: 8.5px; font-weight: 700; color: ${t.primary}; margin-top: 1px;">Design No: ${it.design}</div>
        <div style="font-size: 8.5px; color: #0f172a;">Job Card: ${it.jobNo} &nbsp;|&nbsp; Fabric: ${it.fabric} &nbsp;|&nbsp; Lot: ${it.lot}</div>
      </td>
      <td style="text-align: center; font-family: monospace; padding: 6px 4px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">${it.hsn}</td>
      <td style="text-align: center; padding: 6px 4px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">${it.gst}%</td>
      <td style="text-align: right; font-weight: 800; padding: 6px 4px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">
        ${it.qty.toFixed(2)}<br /><span style="font-size: 8px; font-weight: 500; color: #64748b;">MTR</span>
      </td>
      <td style="text-align: right; padding: 6px 4px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">${it.rate.toFixed(2)}</td>
      <td style="text-align: center; padding: 6px 4px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">MTR</td>
      <td style="text-align: right; font-weight: 800; padding: 6px 8px; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;">${it.amount.toFixed(2)}</td>
    </tr>
  `).join('');

  return `
  <div class="page-container">
    <div class="invoice-wrapper" style="border: 1.5px solid ${t.border};">
      <!-- ── 1. HEADER (USER APPROVED MODERN DESIGN) ────────────────────── -->
      <div class="invoice-header" style="border-bottom: 3px solid ${t.primary}; background: linear-gradient(135deg, ${t.badgeBg} 0%, #ffffff 100%);">
        <div style="max-width: 60%;">
          <div class="company-title" style="color: ${t.primary};">${comp.companyName}</div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 2px;">
            ${comp.companyAddress}
          </div>
          <div style="font-size: 10.5px; color: #475569;">
            Phone: <strong style="color: #0f172a;">${comp.companyPhone}</strong> &bull; Email: ${comp.companyEmail}
          </div>
          <div style="margin-top: 5px; font-size: 11px;">
            <span style="display: inline-block; margin-right: 12px;">
              GSTIN: <strong style="color: ${t.primary}; font-family: monospace;">${comp.companyGstin}</strong>
            </span>
            <span>
              State: <strong>${comp.companyState} (${comp.companyStateCode})</strong>
            </span>
            <span style="margin-left: 12px;">
              PAN: <strong>${comp.companyPan}</strong>
            </span>
          </div>
        </div>

        <div style="text-align: right;">
          <span class="meta-badge" style="background: ${t.badgeBg}; color: ${t.badgeText}; border: 1px solid ${t.border};">ORIGINAL FOR RECIPIENT</span>
          <div style="font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 5px; letter-spacing: -0.3px;">
            ${comp.invoiceNo}
          </div>
          <div style="font-size: 11px; color: #475569; margin-top: 3px;">
            Invoice Date: <strong style="color: #0f172a;">${comp.invoiceDate}</strong>
          </div>
          <div style="font-size: 10.5px; color: #b45309; margin-top: 2px;">
            Due Date: <strong>${comp.dueDate}</strong>
          </div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
            Place of Supply: <strong>${comp.companyState} (${comp.companyStateCode})</strong>
          </div>
        </div>
      </div>

      <!-- ── 2. BILL TO & DISPATCH SECTION ────────────────────────────────── -->
      <div class="info-grid" style="border-bottom: 1.5px solid ${t.border};">
        <!-- Left Column: BILL TO (MATCHING HEADER STYLING) -->
        <div style="border-right: 1.5px solid ${t.border};">
          <div class="section-bar" style="background: ${t.primary};">BILL TO</div>
          <div style="padding: 8px 12px; font-size: 9.5px; line-height: 1.35;">
            <div style="font-size: 12px; font-weight: 900; color: #000000; letter-spacing: -0.2px;">
              ${comp.customer.name}
            </div>
            <div style="color: #475569; font-size: 10px; margin-top: 2px; line-height: 1.35;">
              ${comp.customer.address}
            </div>
            <div style="margin-top: 5px; font-size: 10.5px;">
              <span style="display: inline-block; margin-right: 12px;">
                GSTIN: <strong style="color: ${t.primary}; font-family: monospace;">${comp.customer.gstin}</strong>
              </span>
              <span>
                State: <strong>${comp.customer.state} (${comp.customer.stateCode})</strong>
              </span>
              <span style="margin-left: 12px;">
                PAN: <strong>${comp.customer.pan}</strong>
              </span>
            </div>
          </div>
        </div>

        <!-- Right Column: SELLER / DISPATCH DETAILS (NO TAX INVOICE NO, ADDS AGENT & DISPATCH DETAILS) -->
        <div>
          <div class="section-bar" style="background: ${t.primary};">SELLER / DISPATCH DETAILS</div>
          <div style="display: grid; grid-template-columns: 1.1fr 1fr; height: 100%;">
            <div style="padding: 6px 10px; font-size: 9px; border-right: 1px solid #e2e8f0;">
              <div style="color: #475569; font-size: 8.5px;">Challan No.:</div>
              <div style="font-weight: 800; margin-top: 2px; font-size: 9.5px; line-height: 1.3;">
                ${comp.dispatch.challans}
              </div>
              <div style="color: #475569; font-size: 8.5px; margin-top: 4px;">Dispatched Through:</div>
              <div style="font-weight: 800;">${comp.dispatch.transport}</div>
            </div>
            <div style="padding: 6px 10px; font-size: 9px;">
              <div style="color: #475569; font-size: 8.5px;">Agent / Broker:</div>
              <div style="font-weight: 800; font-size: 10px; color: ${t.primary}; margin-top: 2px;">
                ${comp.dispatch.agent}
              </div>
              <div style="color: #475569; font-size: 8.5px; margin-top: 4px;">Terms of Delivery:</div>
              <div style="font-weight: 800;">${comp.dispatch.terms}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── 3. ITEMS TABLE ───────────────────────────────────────────────── -->
      <div class="items-table-container">
        <table class="invoice-table">
          <thead>
            <tr style="background: ${t.primary};">
              <th style="width: 25px; border-color: ${t.primary};">Sr.</th>
              <th style="width: 55px; border-color: ${t.primary};">Image</th>
              <th style="text-align: left; border-color: ${t.primary};">Description of Goods</th>
              <th style="width: 55px; border-color: ${t.primary};">HSN</th>
              <th style="width: 38px; border-color: ${t.primary};">GST%</th>
              <th style="width: 65px; border-color: ${t.primary}; text-align: right;">Qty</th>
              <th style="width: 50px; border-color: ${t.primary}; text-align: right;">Rate</th>
              <th style="width: 35px; border-color: ${t.primary};">Per</th>
              <th style="width: 85px; border-color: ${t.primary}; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="table-filler-row">
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ── ANCHORED BOTTOM SECTION (AT THE END OF THE PAGE) ──────────────── -->
      <div class="invoice-bottom-block">
        <!-- ── 4. TOTALS & TDS SECTION ──────────────────────────────────────── -->
        <div class="totals-area" style="border-top: 1.5px solid ${t.border}; border-bottom: 1.5px solid ${t.border};">
          <div class="calc-row">
            <div class="calc-label">Total Quantity:</div>
            <div class="calc-val">${totalQty.toFixed(2)} MTR</div>
          </div>
          <div class="calc-row">
            <div class="calc-label">Taxable Amount:</div>
            <div class="calc-val">₹${comp.taxable.toFixed(2)}</div>
          </div>
          <div class="calc-row">
            <div class="calc-label">CGST @ 2.5%:</div>
            <div class="calc-val">₹${comp.cgst.toFixed(2)}</div>
          </div>
          <div class="calc-row">
            <div class="calc-label">SGST @ 2.5%:</div>
            <div class="calc-val">₹${comp.sgst.toFixed(2)}</div>
          </div>
          ${comp.roundOff !== 0 ? `
            <div class="calc-row">
              <div class="calc-label">Round Off:</div>
              <div class="calc-val">${comp.roundOff > 0 ? '+' : ''}${comp.roundOff.toFixed(2)}</div>
            </div>
          ` : ''}

          <!-- Total Invoice Amount Banner -->
          <div class="banner-row" style="background: ${t.primary};">
            <div>TOTAL INVOICE AMOUNT</div>
            <div style="font-size: 13px;">₹${comp.grandTotal.toFixed(2)}</div>
          </div>

          ${comp.hasTds ? `
            <div class="calc-row" style="background: #fffbeb; color: #b45309; font-weight: 700;">
              <div class="calc-label" style="color: #b45309;">Less: TDS (Sec 194C @ 2%):</div>
              <div class="calc-val" style="color: #b45309;">- ₹${comp.tdsAmount.toFixed(2)}</div>
            </div>
            <!-- Net Receivable Banner -->
            <div class="banner-row" style="background: ${t.primary};">
              <div>NET RECEIVABLE AMOUNT</div>
              <div style="font-size: 13px;">₹${comp.netReceivable.toFixed(2)}</div>
            </div>
          ` : ''}
        </div>

        <!-- ── 5. AMOUNT IN WORDS ────────────────────────────────────────────── -->
        <div class="words-bar">
          <div>
            <span style="font-weight: 700; color: #334155;">Invoice Amount in Words:</span>
            <span style="font-weight: 900; color: #000000; margin-left: 4px;">${comp.words}</span>
            ${comp.hasTds ? `
              <br />
              <span style="font-weight: 700; color: #334155;">Net Receivable in Words:</span>
              <span style="font-weight: 900; color: ${t.primary}; margin-left: 4px;">${comp.netWords}</span>
            ` : ''}
          </div>
          <div style="font-size: 8.5px; color: #64748b; font-weight: 700;">E. & O.E.</div>
        </div>

        <!-- ── 6. HSN TAX SUMMARY ────────────────────────────────────────────── -->
        <table class="hsn-table">
          <thead>
            <tr style="background: ${t.primary};">
              <th rowspan="2" style="border-color: ${t.primary};">HSN/SAC</th>
              <th rowspan="2" style="border-color: ${t.primary};">Taxable Value</th>
              <th colspan="2" style="border-color: ${t.primary};">CGST</th>
              <th colspan="2" style="border-color: ${t.primary};">SGST</th>
              <th rowspan="2" style="border-color: ${t.primary};">Total Tax</th>
            </tr>
            <tr style="background: ${t.primary};">
              <th style="border-color: ${t.primary};">Rate</th>
              <th style="border-color: ${t.primary};">Amount</th>
              <th style="border-color: ${t.primary};">Rate</th>
              <th style="border-color: ${t.primary};">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align: center; font-family: monospace; font-weight: 800;">998821</td>
              <td>₹${comp.taxable.toFixed(2)}</td>
              <td style="text-align: center;">2.5%</td>
              <td>₹${comp.cgst.toFixed(2)}</td>
              <td style="text-align: center;">2.5%</td>
              <td>₹${comp.sgst.toFixed(2)}</td>
              <td style="font-weight: 800;">₹${(comp.cgst + comp.sgst).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <!-- ── 7. FOOTER: BANK & SIGNATURE ───────────────────────────────────── -->
        <div class="footer-grid">
          <div class="bank-box">
            <div style="font-weight: 800; text-transform: uppercase; margin-bottom: 2px; color: ${t.primary};">
              Bank Details (For RTGS / NEFT / IMPS):
            </div>
            <div>Bank Name: <strong>KOTAK MAHINDRA BANK</strong></div>
            <div>A/C No.: <strong>9909866667</strong></div>
            <div>IFSC Code: <strong>KKBK0000883</strong> &nbsp;|&nbsp; Branch: <strong>SURAT</strong></div>
            <div style="margin-top: 5px; font-size: 8px; color: #475569; line-height: 1.3;">
              1. Goods once sold will not be taken back.<br />
              2. Payment is due within 15 days from the invoice date. Interest @ 18% p.a. will be charged thereafter.<br />
              3. Subject to Surat Jurisdiction only.
            </div>
          </div>

          <div class="signatory-box">
            <div style="font-weight: 800; font-size: 9px; color: #000000;">
              For ${comp.companyName}
            </div>
            <div style="height: 38px;"></div>
            <div style="font-size: 8.5px; font-weight: 800; color: #000000; border-top: 1px dashed #cbd5e1; padding-top: 2px;">
              Authorized Signatory
            </div>
          </div>
        </div>

        <div class="computer-tag">
          This is a Computer Generated Tax Invoice &bull; Powered by Elite Edition OS
        </div>
      </div>
    </div>
  </div>
  `;
}

(async () => {
  const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Elite Edition - 5 Companies Master Tax Invoices</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 4mm 6mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 0;
      padding: 0;
      background: #f8fafc;
      color: #000000;
      font-size: 10px;
      line-height: 1.25;
    }
    .page-container {
      page-break-after: always;
      width: 100%;
      height: 288mm;
      max-height: 288mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      padding: 2px 0;
    }
    .page-container:last-child {
      page-break-after: auto;
    }
    .invoice-wrapper {
      width: 100%;
      height: 100%;
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 5px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .invoice-header {
      flex: 0 0 auto;
      padding: 12px 18px 10px 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .company-title {
      font-size: 21px;
      font-weight: 900;
      letter-spacing: -0.3px;
      margin-bottom: 4px;
    }
    .meta-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .info-grid {
      flex: 0 0 auto;
      display: grid;
      grid-template-columns: 1.1fr 1fr;
    }
    .section-bar {
      color: #ffffff;
      font-size: 9px;
      font-weight: 800;
      padding: 3.5px 8px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    /* ── ITEMS AREA EXPANDS TO FILL AVAILABLE HEIGHT ── */
    .items-table-container {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    table.invoice-table {
      width: 100%;
      height: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
    }
    table.invoice-table th {
      color: #ffffff;
      padding: 5px 6px;
      font-size: 9px;
      font-weight: 800;
      border: 1px solid transparent;
      text-align: center;
    }
    tr.table-filler-row {
      height: 100%;
    }
    tr.table-filler-row td {
      border-left: 1px solid #cbd5e1;
      border-right: 1px solid #cbd5e1;
      border-bottom: none !important;
      padding: 0;
    }

    /* ── PINNED AT THE END OF THE PAGE ── */
    .invoice-bottom-block {
      flex: 0 0 auto;
      margin-top: auto;
    }
    .totals-area {
    }
    .calc-row {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding: 2px 12px;
      font-size: 9px;
    }
    .calc-row .calc-label {
      width: 180px;
      text-align: right;
      padding-right: 15px;
      font-weight: 700;
      color: #334155;
    }
    .calc-row .calc-val {
      width: 90px;
      text-align: right;
      font-weight: 800;
      color: #000000;
    }
    .banner-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #ffffff;
      padding: 3.5px 12px;
      font-size: 10.5px;
      font-weight: 800;
    }
    .words-bar {
      padding: 4.5px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      border-bottom: 1px solid #cbd5e1;
      background: #f8fafc;
    }
    table.hsn-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5px;
      border-bottom: 1px solid #cbd5e1;
    }
    table.hsn-table th {
      color: #ffffff;
      padding: 3px 6px;
      font-size: 8.5px;
      font-weight: 800;
      border: 1px solid transparent;
      text-align: center;
    }
    table.hsn-table td {
      border: 1px solid #cbd5e1;
      padding: 2.5px 6px;
      text-align: right;
    }
    .footer-grid {
      display: grid;
      grid-template-columns: 1.3fr 1fr;
      padding: 5px 12px;
      font-size: 8.5px;
      line-height: 1.35;
    }
    .bank-box {
      font-size: 8.5px;
    }
    .signatory-box {
      text-align: right;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .computer-tag {
      text-align: center;
      font-size: 8px;
      color: #475569;
      padding: 3px;
      border-top: 1px solid #e2e8f0;
      background: #fafafa;
    }
  </style>
</head>
<body>
  ${companiesData.map(renderSingleInvoice).join('\n')}
</body>
</html>
  `;

  // Write preview HTML to website public
  const multiHtmlPath = path.resolve('/Users/harshitsidapara/Node projects/Elite_Edition/elite_edition_website/public/five_companies_preview.html');
  fs.writeFileSync(multiHtmlPath, fullHtml, 'utf8');

  // Launch browser and print PDF
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: ['load', 'networkidle0'], timeout: 30000 });

  const destPdf = path.resolve('/Users/harshitsidapara/Downloads/Five_Companies_Master_Tax_Invoices.pdf');
  const destDesktopPdf = path.resolve('/Users/harshitsidapara/Desktop/Five_Companies_Master_Tax_Invoices.pdf');
  const artifactPdf = path.resolve('/Users/harshitsidapara/.gemini/antigravity/brain/02e9df84-8465-459d-8ec1-590139e2629f/Five_Companies_Master_Tax_Invoices.pdf');

  await page.pdf({
    path: destPdf,
    format: 'A4',
    printBackground: true,
    margin: { top: '5mm', bottom: '5mm', left: '6mm', right: '6mm' }
  });

  fs.copyFileSync(destPdf, destDesktopPdf);
  fs.copyFileSync(destPdf, artifactPdf);

  // Also update the single sample PDF
  const singleDestPdf = path.resolve('/Users/harshitsidapara/Downloads/Master_Tax_Invoice_Sample.pdf');
  const singleDesktopPdf = path.resolve('/Users/harshitsidapara/Desktop/Master_Tax_Invoice_Sample.pdf');
  const singleArtifactPdf = path.resolve('/Users/harshitsidapara/.gemini/antigravity/brain/02e9df84-8465-459d-8ec1-590139e2629f/Master_Tax_Invoice_Sample.pdf');
  fs.copyFileSync(destPdf, singleDestPdf);
  fs.copyFileSync(destPdf, singleDesktopPdf);
  fs.copyFileSync(destPdf, singleArtifactPdf);

  await browser.close();
  console.log('5 Companies PDF successfully generated at:', destPdf);
})();
