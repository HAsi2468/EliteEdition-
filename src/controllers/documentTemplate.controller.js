const httpStatus = require('http-status').default;
const db = require('../db/models');
const logger = require('../config/logger');
const templatePdfService = require('../services/templatePdf.service');

// Default starter templates matching Elite Edition current operational designs
const getDefaultStarterTemplates = () => [
  {
    name: 'Standard GST Tax Invoice',
    documentType: 'INVOICE',
    pageSize: 'A4',
    orientation: 'portrait',
    margins: { top: 20, bottom: 20, left: 20, right: 20 },
    isDefault: true,
    description: 'Official GST Compliant B2B & B2C Tax Invoice with Itemized Tax Breakdown and Bank QR Code',
    elements: [
      // Top Header Border Line
      {
        id: 'header-divider',
        type: 'divider',
        x: 20,
        y: 88,
        width: 555,
        height: 2,
        style: { borderWidth: 2, borderColor: '#0284c7' }
      },
      // Company Name
      {
        id: 'comp-name',
        type: 'dynamic_text',
        x: 20,
        y: 20,
        width: 320,
        height: 26,
        content: '{{company.name}}',
        fieldBinding: 'company.name',
        style: { fontSize: 18, fontWeight: '900', color: '#0f172a', letterSpacing: '0.04em' }
      },
      // Company Details
      {
        id: 'comp-details',
        type: 'text',
        x: 20,
        y: 46,
        width: 340,
        height: 38,
        content: '{{company.address}}\nGSTIN: {{company.gstin}} | State: {{company.state}}',
        style: { fontSize: 8.5, color: '#475569', lineHeight: 1.35 }
      },
      // Invoice Title Badge
      {
        id: 'inv-title-box',
        type: 'rect',
        x: 410,
        y: 20,
        width: 165,
        height: 26,
        style: { backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 6 }
      },
      {
        id: 'inv-title-text',
        type: 'text',
        x: 410,
        y: 24,
        width: 165,
        height: 20,
        content: 'TAX INVOICE',
        style: { fontSize: 13, fontWeight: '900', color: '#0369a1', textAlign: 'center', letterSpacing: '0.06em' }
      },
      // Invoice Meta Details
      {
        id: 'inv-meta',
        type: 'text',
        x: 410,
        y: 50,
        width: 165,
        height: 36,
        content: 'Invoice No: {{invoice.invoiceNumber}}\nDate: {{invoice.invoiceDate}}\nPlace of Supply: {{invoice.placeOfSupply}}',
        style: { fontSize: 8.5, color: '#334155', textAlign: 'right', lineHeight: 1.35 }
      },
      // Billed To Box
      {
        id: 'bill-to-rect',
        type: 'rect',
        x: 20,
        y: 98,
        width: 270,
        height: 75,
        style: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 8 }
      },
      {
        id: 'bill-to-label',
        type: 'text',
        x: 28,
        y: 104,
        width: 250,
        height: 14,
        content: 'BILLED TO (BUYER):',
        style: { fontSize: 8, fontWeight: '800', color: '#64748b', letterSpacing: '0.05em' }
      },
      {
        id: 'bill-to-info',
        type: 'text',
        x: 28,
        y: 118,
        width: 250,
        height: 50,
        content: '{{customer.name}}\n{{customer.address}}\nGSTIN: {{customer.gstin}} | State: {{customer.state}}',
        style: { fontSize: 8.5, color: '#0f172a', fontWeight: '500', lineHeight: 1.3 }
      },
      // Consignee Box
      {
        id: 'ship-to-rect',
        type: 'rect',
        x: 305,
        y: 98,
        width: 270,
        height: 75,
        style: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 8 }
      },
      {
        id: 'ship-to-label',
        type: 'text',
        x: 313,
        y: 104,
        width: 250,
        height: 14,
        content: 'SHIPPED TO (CONSIGNEE):',
        style: { fontSize: 8, fontWeight: '800', color: '#64748b', letterSpacing: '0.05em' }
      },
      {
        id: 'ship-to-info',
        type: 'text',
        x: 313,
        y: 118,
        width: 250,
        height: 50,
        content: '{{customer.deliveryName}}\n{{customer.deliveryAddress}}\nDispatched via: {{invoice.transporter}}',
        style: { fontSize: 8.5, color: '#0f172a', fontWeight: '500', lineHeight: 1.3 }
      },
      // Dynamic Item Table
      {
        id: 'inv-items-table',
        type: 'dynamic_table',
        x: 20,
        y: 184,
        width: 555,
        height: 380,
        tableConfig: {
          columns: [
            { key: 'sr', label: 'Sr', width: '35px', align: 'center', field: 'index' },
            { key: 'description', label: 'Item Description / Quality', width: '220px', align: 'left', field: 'description' },
            { key: 'hsn', label: 'HSN/SAC', width: '70px', align: 'center', field: 'hsn' },
            { key: 'qty', label: 'Meters / Qty', width: '70px', align: 'right', field: 'quantity' },
            { key: 'rate', label: 'Rate (₹)', width: '70px', align: 'right', field: 'rate' },
            { key: 'total', label: 'Taxable Val (₹)', width: '90px', align: 'right', field: 'total' }
          ],
          showHeader: true,
          striped: true,
          borderColor: '#e2e8f0',
          headerBg: '#0f172a',
          headerColor: '#ffffff',
          rowHeight: 25
        },
        style: { fontSize: 9, color: '#0f172a' }
      },
      // Bank Details Card
      {
        id: 'bank-rect',
        type: 'rect',
        x: 20,
        y: 575,
        width: 320,
        height: 95,
        style: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8 }
      },
      {
        id: 'bank-label',
        type: 'text',
        x: 28,
        y: 582,
        width: 200,
        height: 14,
        content: 'BANK SETTLEMENT DETAILS:',
        style: { fontSize: 8, fontWeight: '800', color: '#475569' }
      },
      {
        id: 'bank-details',
        type: 'text',
        x: 28,
        y: 598,
        width: 220,
        height: 65,
        content: 'Bank: {{company.bankName}}\nA/C No: {{company.bankAccount}}\nIFSC Code: {{company.bankIfsc}}\nBranch: {{company.bankBranch}}',
        style: { fontSize: 8.5, color: '#0f172a', lineHeight: 1.35 }
      },
      // Payment UPI QR Code
      {
        id: 'upi-qr',
        type: 'qr_code',
        x: 255,
        y: 582,
        width: 75,
        height: 75,
        content: 'upi://pay?pa=eliteedition@icici&pn=Elite%20Edition&am={{invoice.grandTotal}}',
        style: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, backgroundColor: '#ffffff', padding: 2 }
      },
      // Totals Box
      {
        id: 'totals-rect',
        type: 'rect',
        x: 355,
        y: 575,
        width: 220,
        height: 95,
        style: { backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 8 }
      },
      {
        id: 'totals-breakdown',
        type: 'text',
        x: 365,
        y: 582,
        width: 200,
        height: 52,
        content: 'Taxable Amount:  {{invoice.taxableTotal}}\nCGST (2.5%):  {{invoice.cgstTotal}}\nSGST (2.5%):  {{invoice.sgstTotal}}',
        style: { fontSize: 8.5, color: '#334155', lineHeight: 1.4 }
      },
      {
        id: 'grand-total-divider',
        type: 'divider',
        x: 365,
        y: 636,
        width: 200,
        height: 1,
        style: { borderWidth: 1, borderColor: '#7dd3fc' }
      },
      {
        id: 'grand-total-text',
        type: 'text',
        x: 365,
        y: 642,
        width: 200,
        height: 22,
        content: 'GRAND TOTAL:  {{invoice.grandTotal}}',
        style: { fontSize: 11, fontWeight: '900', color: '#0369a1' }
      },
      // Terms and Signatures
      {
        id: 'terms-note',
        type: 'text',
        x: 20,
        y: 680,
        width: 320,
        height: 50,
        content: 'Terms & Conditions:\n1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged after due date.\n3. Subject to Surat jurisdiction only.',
        style: { fontSize: 7.5, color: '#64748b', lineHeight: 1.3 }
      },
      {
        id: 'auth-sign',
        type: 'text',
        x: 380,
        y: 710,
        width: 195,
        height: 35,
        content: 'For {{company.name}}\n\nAuthorized Signatory',
        style: { fontSize: 8.5, fontWeight: '700', color: '#0f172a', textAlign: 'center' }
      }
    ]
  },
  {
    name: 'Elite Delivery Challan',
    documentType: 'CHALLAN',
    pageSize: 'A4',
    orientation: 'portrait',
    margins: { top: 20, bottom: 20, left: 20, right: 20 },
    isDefault: true,
    description: 'Textile Fabric & Job Work Delivery Challan with 3 Copy Declarations and Signature Panels',
    elements: [
      {
        id: 'dc-comp-name',
        type: 'text',
        x: 20,
        y: 20,
        width: 320,
        height: 26,
        content: '{{company.name}}',
        style: { fontSize: 18, fontWeight: '900', color: '#0f172a' }
      },
      {
        id: 'dc-comp-meta',
        type: 'text',
        x: 20,
        y: 46,
        width: 320,
        height: 30,
        content: '{{company.address}}\nGSTIN: {{company.gstin}}',
        style: { fontSize: 8.5, color: '#475569' }
      },
      {
        id: 'dc-title-badge',
        type: 'rect',
        x: 375,
        y: 20,
        width: 200,
        height: 26,
        style: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 6 }
      },
      {
        id: 'dc-title-text',
        type: 'text',
        x: 375,
        y: 25,
        width: 200,
        height: 20,
        content: 'DELIVERY CHALLAN',
        style: { fontSize: 13, fontWeight: '900', color: '#92400e', textAlign: 'center' }
      },
      {
        id: 'dc-meta',
        type: 'text',
        x: 375,
        y: 50,
        width: 200,
        height: 35,
        content: 'Challan No: {{challan.challanNumber}}\nDate: {{challan.challanDate}}\nVehicle No: {{challan.vehicleNumber}}',
        style: { fontSize: 8.5, color: '#334155', textAlign: 'right' }
      },
      {
        id: 'dc-divider-1',
        type: 'divider',
        x: 20,
        y: 85,
        width: 555,
        height: 2,
        style: { borderWidth: 2, borderColor: '#d97706' }
      },
      {
        id: 'dc-party-rect',
        type: 'rect',
        x: 20,
        y: 95,
        width: 555,
        height: 55,
        style: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, padding: 6 }
      },
      {
        id: 'dc-party-info',
        type: 'text',
        x: 30,
        y: 100,
        width: 535,
        height: 45,
        content: 'Consignee: {{customer.name}} | GSTIN: {{customer.gstin}}\nDelivery Address: {{customer.deliveryAddress}}\nTransporter: {{challan.transporter}} | E-Way Bill: {{challan.ewayBill}}',
        style: { fontSize: 8.5, color: '#0f172a', lineHeight: 1.35 }
      },
      {
        id: 'dc-table',
        type: 'dynamic_table',
        x: 20,
        y: 160,
        width: 555,
        height: 420,
        tableConfig: {
          columns: [
            { key: 'sr', label: 'Sr', width: '35px', align: 'center', field: 'index' },
            { key: 'design', label: 'Design / Job Code', width: '130px', align: 'left', field: 'designCode' },
            { key: 'quality', label: 'Quality / Fabric', width: '180px', align: 'left', field: 'quality' },
            { key: 'hsn', label: 'HSN', width: '70px', align: 'center', field: 'hsn' },
            { key: 'meters', label: 'Meters / Qty', width: '80px', align: 'right', field: 'quantity' },
            { key: 'unit', label: 'Unit', width: '60px', align: 'center', field: 'unit' }
          ],
          showHeader: true,
          striped: true,
          borderColor: '#e2e8f0',
          headerBg: '#78350f',
          headerColor: '#ffffff',
          rowHeight: 25
        },
        style: { fontSize: 9, color: '#0f172a' }
      },
      {
        id: 'dc-total-meters',
        type: 'text',
        x: 350,
        y: 590,
        width: 225,
        height: 24,
        content: 'TOTAL METERS: {{challan.totalMeters}} Mtr',
        style: { fontSize: 11, fontWeight: '900', color: '#78350f', textAlign: 'right' }
      },
      // 3 Signatures Panel
      {
        id: 'dc-sign-1',
        type: 'text',
        x: 20,
        y: 680,
        width: 170,
        height: 40,
        content: "Receiver's Signature\n(Goods Received in Order)",
        style: { fontSize: 8, textAlign: 'center', color: '#475569' }
      },
      {
        id: 'dc-sign-2',
        type: 'text',
        x: 210,
        y: 680,
        width: 170,
        height: 40,
        content: "Checked / Prepared By\n(Store Keeper)",
        style: { fontSize: 8, textAlign: 'center', color: '#475569' }
      },
      {
        id: 'dc-sign-3',
        type: 'text',
        x: 400,
        y: 680,
        width: 175,
        height: 40,
        content: "For {{company.name}}\nAuthorized Signatory",
        style: { fontSize: 8.5, fontWeight: '700', textAlign: 'center', color: '#0f172a' }
      }
    ]
  },
  {
    name: 'Print & Stitching Job Card',
    documentType: 'JOB_CARD',
    pageSize: 'A4',
    orientation: 'portrait',
    margins: { top: 20, bottom: 20, left: 20, right: 20 },
    isDefault: true,
    description: 'Factory Floor Operations Job Card with Barcode, Stage Checklist, and Quality Specs',
    elements: [
      {
        id: 'jc-header',
        type: 'text',
        x: 20,
        y: 20,
        width: 350,
        height: 26,
        content: '{{company.name}} • PRODUCTION JOB CARD',
        style: { fontSize: 16, fontWeight: '900', color: '#0f172a' }
      },
      {
        id: 'jc-qr',
        type: 'qr_code',
        x: 485,
        y: 15,
        width: 90,
        height: 90,
        content: 'https://eliteedition.in/jobcard/{{jobCard.jobCardNumber}}',
        style: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 2 }
      },
      {
        id: 'jc-meta',
        type: 'text',
        x: 20,
        y: 50,
        width: 450,
        height: 50,
        content: 'Job Card No: {{jobCard.jobCardNumber}} | Priority: {{jobCard.priority}}\nCustomer: {{customer.name}} | Delivery Date: {{jobCard.targetDate}}\nFabric: {{jobCard.fabricQuality}} | Panna: {{jobCard.panna}}" | Pass: {{jobCard.pass}}',
        style: { fontSize: 9.5, color: '#1e293b', fontWeight: '600', lineHeight: 1.4 }
      },
      {
        id: 'jc-divider-1',
        type: 'divider',
        x: 20,
        y: 110,
        width: 555,
        height: 2,
        style: { borderWidth: 2, borderColor: '#4f46e5' }
      },
      {
        id: 'jc-table',
        type: 'dynamic_table',
        x: 20,
        y: 125,
        width: 555,
        height: 480,
        tableConfig: {
          columns: [
            { key: 'sr', label: '#', width: '35px', align: 'center', field: 'index' },
            { key: 'design', label: 'Design Number', width: '140px', align: 'left', field: 'designCode' },
            { key: 'meters', label: 'Required Meters', width: '100px', align: 'right', field: 'requiredMeters' },
            { key: 'printed', label: 'Printed Meters', width: '100px', align: 'right', field: 'printedMeters' },
            { key: 'operator', label: 'Machine / Operator', width: '180px', align: 'left', field: 'operator' }
          ],
          showHeader: true,
          striped: true,
          borderColor: '#e2e8f0',
          headerBg: '#312e81',
          headerColor: '#ffffff',
          rowHeight: 26
        },
        style: { fontSize: 9, color: '#0f172a' }
      },
      {
        id: 'jc-stages-rect',
        type: 'rect',
        x: 20,
        y: 620,
        width: 555,
        height: 90,
        style: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 8 }
      },
      {
        id: 'jc-stages-title',
        type: 'text',
        x: 30,
        y: 626,
        width: 500,
        height: 16,
        content: 'STAGE COMPLETION CHECKLIST & OPERATOR SIGN-OFF:',
        style: { fontSize: 8.5, fontWeight: '800', color: '#4338ca' }
      },
      {
        id: 'jc-stages-boxes',
        type: 'text',
        x: 30,
        y: 646,
        width: 535,
        height: 55,
        content: '[ ] 1. Pre-Flight Rip   |   [ ] 2. Paper Printing   |   [ ] 3. Fusing Heat Transfer   |   [ ] 4. QA Inspection & Packing\nOperator Initial: _________       Machine No: _________       Dispatched Meters: _________\nSupervisor Sign: ___________________________',
        style: { fontSize: 8.5, color: '#334155', lineHeight: 1.5 }
      }
    ]
  },
  {
    name: 'Thermal Shipping Label (4x6")',
    documentType: 'SHIPPING_LABEL',
    pageSize: '4x6',
    orientation: 'portrait',
    margins: { top: 10, bottom: 10, left: 10, right: 10 },
    isDefault: true,
    description: 'Standard 4x6 inch direct thermal courier & transport parcel dispatch label',
    elements: [
      {
        id: 'lbl-transporter-badge',
        type: 'rect',
        x: 10,
        y: 10,
        width: 268,
        height: 38,
        style: { backgroundColor: '#0f172a', borderRadius: 4 }
      },
      {
        id: 'lbl-transporter-text',
        type: 'text',
        x: 18,
        y: 16,
        width: 250,
        height: 26,
        content: 'EXPEDITED FREIGHT • {{invoice.transporter}}',
        style: { fontSize: 11, fontWeight: '900', color: '#ffffff', letterSpacing: '0.04em' }
      },
      {
        id: 'lbl-to-header',
        type: 'text',
        x: 14,
        y: 56,
        width: 260,
        height: 14,
        content: 'DELIVER TO / CONSIGNEE:',
        style: { fontSize: 8, fontWeight: '800', color: '#475569' }
      },
      {
        id: 'lbl-to-body',
        type: 'text',
        x: 14,
        y: 72,
        width: 260,
        height: 60,
        content: '{{customer.name}}\n{{customer.deliveryAddress}}\nCity: Surat | State: {{customer.state}}\nPhone: {{customer.phone}}',
        style: { fontSize: 9.5, fontWeight: '700', color: '#0f172a', lineHeight: 1.35 }
      },
      {
        id: 'lbl-div-1',
        type: 'divider',
        x: 10,
        y: 140,
        width: 268,
        height: 2,
        style: { borderWidth: 2, borderColor: '#000000' }
      },
      {
        id: 'lbl-barcode-qr',
        type: 'qr_code',
        x: 20,
        y: 152,
        width: 110,
        height: 110,
        content: 'PKG-{{invoice.invoiceNumber}}-SURAT',
        style: { borderWidth: 1, borderColor: '#cbd5e1', padding: 2, backgroundColor: '#ffffff' }
      },
      {
        id: 'lbl-pkg-meta',
        type: 'text',
        x: 140,
        y: 158,
        width: 135,
        height: 100,
        content: 'Ref: {{invoice.invoiceNumber}}\nDate: {{invoice.invoiceDate}}\nMeters: 855 Mtr\nRolls: 3 Parcels\nWeight: 142.5 KG',
        style: { fontSize: 9, fontWeight: '800', color: '#0f172a', lineHeight: 1.45 }
      },
      {
        id: 'lbl-div-2',
        type: 'divider',
        x: 10,
        y: 275,
        width: 268,
        height: 1,
        style: { borderWidth: 1, borderColor: '#cbd5e1' }
      },
      {
        id: 'lbl-return-info',
        type: 'text',
        x: 14,
        y: 286,
        width: 260,
        height: 48,
        content: 'If undelivered, return to sender:\n{{company.name}}\n{{company.address}}\nHelpline: {{company.phone}}',
        style: { fontSize: 7.5, color: '#475569', lineHeight: 1.3 }
      }
    ]
  },
  {
    name: 'Fabric Roll Barcode Sticker (3x2")',
    documentType: 'ROLL_LABEL',
    pageSize: '3x2',
    orientation: 'landscape',
    margins: { top: 6, bottom: 6, left: 8, right: 8 },
    isDefault: true,
    description: 'Direct thermal 3x2 inch barcode sticker for factory fabric roll tracking',
    elements: [
      {
        id: 'roll-comp',
        type: 'text',
        x: 10,
        y: 8,
        width: 196,
        height: 16,
        content: 'ELITE PRINTS • ROLL IDENTIFIER',
        style: { fontSize: 8, fontWeight: '900', color: '#0f172a' }
      },
      {
        id: 'roll-quality',
        type: 'text',
        x: 10,
        y: 26,
        width: 120,
        height: 28,
        content: 'Pure Modal Satin\n44" Panna | Lot #402',
        style: { fontSize: 8, fontWeight: '700', color: '#334155', lineHeight: 1.25 }
      },
      {
        id: 'roll-qr',
        type: 'qr_code',
        x: 140,
        y: 20,
        width: 65,
        height: 65,
        content: 'ROLL-402-120M',
        style: { borderWidth: 1, borderColor: '#cbd5e1', padding: 2, backgroundColor: '#ffffff' }
      },
      {
        id: 'roll-meters-badge',
        type: 'rect',
        x: 10,
        y: 60,
        width: 120,
        height: 25,
        style: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4 }
      },
      {
        id: 'roll-meters-text',
        type: 'text',
        x: 16,
        y: 65,
        width: 110,
        height: 18,
        content: 'NET: 120.50 MTR',
        style: { fontSize: 10, fontWeight: '900', color: '#0f172a' }
      },
      {
        id: 'roll-barcode-text',
        type: 'text',
        x: 10,
        y: 95,
        width: 196,
        height: 14,
        content: '*RL-2026-9021*',
        style: { fontSize: 9, fontWeight: '800', textAlign: 'center', letterSpacing: '0.12em', color: '#0f172a' }
      }
    ]
  }
];

// Helper to provide realistic mock context data for studio live preview & test PDF rendering
const getMockDataContext = (documentType = 'INVOICE') => {
  const company = {
    name: 'Elite Edition Digital Prints',
    address: 'Plot No. 42-45, Surat Textile Park, Sachin GIDC, Surat, Gujarat - 394230',
    gstin: '24AAACE1234F1Z9',
    state: 'Gujarat (24)',
    phone: '+91 98765 43210',
    email: 'accounts@eliteedition.in',
    bankName: 'ICICI Bank Ltd',
    bankAccount: '123405009876',
    bankIfsc: 'ICIC0001234',
    bankBranch: 'Ring Road Branch, Surat'
  };

  const customer = {
    name: 'Shree Krishna Textiles Pvt Ltd',
    address: 'Shop 108-112, Millennium Textile Market, Ring Road, Surat - 395002',
    deliveryName: 'Shree Krishna Textiles (Godown Unit)',
    deliveryAddress: 'Plot 12, Pandesara GIDC, Surat - 394221',
    gstin: '24AABCS9876K1ZY',
    state: 'Gujarat (24)',
    phone: '+91 91234 56789'
  };

  const invoice = {
    invoiceNumber: 'EE/26-27/0482',
    invoiceDate: new Date().toLocaleDateString('en-IN'),
    placeOfSupply: 'Gujarat (24)',
    transporter: 'V-Trans Logistics (E-Way: 541289034211)',
    taxableTotal: 48500.0,
    cgstTotal: 1212.5,
    sgstTotal: 1212.5,
    igstTotal: 0.0,
    grandTotal: 50925.0,
    items: [
      { index: 1, description: 'Digital Print Fabric (Pure Modal Silk)', hsn: '5407', quantity: 350, rate: 65, total: 22750 },
      { index: 2, description: 'Viscose Rayon Printed Meters (140 GSM)', hsn: '5407', quantity: 280, rate: 52, total: 14560 },
      { index: 3, description: 'Job Work Printing Service (Cotton Satin)', hsn: '9988', quantity: 220, rate: 50, total: 11000 },
      { index: 4, description: 'Sample Strike-off Swatch Panel', hsn: '9988', quantity: 5, rate: 38, total: 190 }
    ]
  };

  const challan = {
    challanNumber: 'EDP/DC/26-27/0192',
    challanDate: new Date().toLocaleDateString('en-IN'),
    vehicleNumber: 'GJ-05-BX-4921',
    transporter: 'Local Tempo Delivery',
    ewayBill: '231098456128',
    totalMeters: 855,
    items: [
      { index: 1, designCode: 'DS-9021-FLORAL', quality: 'Modal Satin 44" Panna', hsn: '5407', quantity: 350, unit: 'Mtr' },
      { index: 2, designCode: 'DS-9022-GEOM', quality: 'Rayon Twill 60" Panna', hsn: '5407', quantity: 280, unit: 'Mtr' },
      { index: 3, designCode: 'JW-5110-STRIPE', quality: 'Cotton Cambric 58" Panna', hsn: '5208', quantity: 225, unit: 'Mtr' }
    ]
  };

  const jobCard = {
    jobCardNumber: 'JC-2026-8910',
    priority: 'HIGH PRIORITY',
    targetDate: new Date(Date.now() + 86400000 * 2).toLocaleDateString('en-IN'),
    fabricQuality: 'Pure Modal Satin',
    panna: '60',
    pass: '2 Pass High Definition',
    items: [
      { index: 1, designCode: 'DS-9021-FLORAL', requiredMeters: 350, printedMeters: 350, operator: 'Grando #1 (Ramesh)' },
      { index: 2, designCode: 'DS-9022-GEOM', requiredMeters: 280, printedMeters: 280, operator: 'Grando #2 (Mukesh)' },
      { index: 3, designCode: 'JW-5110-STRIPE', requiredMeters: 225, printedMeters: 225, operator: 'Grando #1 (Ramesh)' }
    ]
  };

  return { company, customer, invoice, challan, jobCard, items: invoice.items };
};

// 1. List Templates (with auto-seed if none exist)
const getTemplates = async (req, res) => {
  try {
    const { documentType } = req.query;
    const filter = {};
    if (documentType) {
      filter.documentType = documentType.toUpperCase();
    }

    let templates = await db.DocumentTemplate.find(filter).sort({ isDefault: -1, updatedAt: -1 });

    // Auto-seed if database is completely empty
    if (!templates || templates.length === 0) {
      const defaultTemplates = getDefaultStarterTemplates();
      await db.DocumentTemplate.insertMany(defaultTemplates);
      templates = await db.DocumentTemplate.find(filter).sort({ isDefault: -1, updatedAt: -1 });
      logger.info('Auto-seeded DocumentTemplate collection with initial operational presets.');
    }

    return res.status(httpStatus.OK).json({
      success: true,
      data: templates
    });
  } catch (error) {
    logger.error('Error fetching document templates: %o', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || 'Failed to fetch templates'
    });
  }
};

// 2. Get Single Template by ID
const getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await db.DocumentTemplate.findById(id);
    if (!template) {
      return res.status(httpStatus.NOT_FOUND).json({
        success: false,
        message: 'Document template not found'
      });
    }

    return res.status(httpStatus.OK).json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error('Error fetching template by ID: %o', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
};

// 3. Create or Save Template
const createTemplate = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.name) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Template name is required'
      });
    }

    if (payload.isDefault) {
      // Unset previous defaults for this documentType
      await db.DocumentTemplate.updateMany(
        { documentType: payload.documentType },
        { isDefault: false }
      );
    }

    const template = await db.DocumentTemplate.create({
      ...payload,
      createdBy: req.user?.username || req.user?.email || 'Admin'
    });

    return res.status(httpStatus.CREATED).json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error('Error creating document template: %o', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
};

// 4. Update Template
const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    if (payload.isDefault && payload.documentType) {
      await db.DocumentTemplate.updateMany(
        { documentType: payload.documentType, _id: { $ne: id } },
        { isDefault: false }
      );
    }

    const updated = await db.DocumentTemplate.findByIdAndUpdate(id, payload, { new: true });
    if (!updated) {
      return res.status(httpStatus.NOT_FOUND).json({
        success: false,
        message: 'Template not found'
      });
    }

    return res.status(httpStatus.OK).json({
      success: true,
      data: updated
    });
  } catch (error) {
    logger.error('Error updating document template: %o', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
};

// 5. Delete Template
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await db.DocumentTemplate.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(httpStatus.NOT_FOUND).json({
        success: false,
        message: 'Template not found'
      });
    }

    return res.status(httpStatus.OK).json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting document template: %o', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
};

// 6. Set Template as Default
const setDefaultTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await db.DocumentTemplate.findById(id);
    if (!template) {
      return res.status(httpStatus.NOT_FOUND).json({
        success: false,
        message: 'Template not found'
      });
    }

    await db.DocumentTemplate.updateMany(
      { documentType: template.documentType },
      { isDefault: false }
    );

    template.isDefault = true;
    await template.save();

    return res.status(httpStatus.OK).json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error('Error setting default template: %o', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
};

// 7. Generate PDF Stream from Template (Live DB record or Mock Data)
const generatePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const { documentId, documentType = 'INVOICE', mockData = false, templateOverride } = req.body;

    let template = null;
    if (templateOverride && templateOverride.elements) {
      template = templateOverride;
    } else if (id && id !== 'preview') {
      template = await db.DocumentTemplate.findById(id);
    } else {
      template = await db.DocumentTemplate.findOne({ documentType, isDefault: true });
    }

    if (!template) {
      // Fallback to default starter template
      const defaults = getDefaultStarterTemplates();
      template = defaults.find((d) => d.documentType === documentType) || defaults[0];
    }

    let dataContext = {};

    if (mockData || !documentId) {
      dataContext = getMockDataContext(template.documentType || documentType);
    } else {
      // Fetch actual operational record from MongoDB
      const docTypeUpper = (template.documentType || documentType).toUpperCase();
      let docRecord = null;
      if (docTypeUpper === 'INVOICE') {
        docRecord = await db.BillingInvoice.findById(documentId).populate('customer').lean();
      } else if (docTypeUpper === 'CHALLAN') {
        docRecord = await db.FabricChallan.findById(documentId).populate('vendor party').lean();
      } else if (docTypeUpper === 'JOB_CARD') {
        docRecord = await db.JobCard.findById(documentId).lean();
      }

      if (docRecord) {
        dataContext = {
          ...getMockDataContext(docTypeUpper),
          [docTypeUpper.toLowerCase()]: docRecord,
          items: docRecord.items || docRecord.rolls || docRecord.orders || []
        };
      } else {
        dataContext = getMockDataContext(docTypeUpper);
      }
    }

    const pdfBuffer = await templatePdfService.generatePdfFromTemplate(template, dataContext);

    // Audit Log print event asynchronously
    try {
      const docNum = dataContext.invoice?.invoiceNumber || dataContext.challan?.challanNumber || dataContext.jobCard?.jobCardNumber || 'DIRECT_PREVIEW';
      const party = dataContext.customer?.name || 'General';
      const existingCount = await db.DocumentPrintLog.countDocuments({
        documentType: template.documentType,
        documentNumber: docNum
      });
      const printCount = existingCount + 1;
      const copyType = printCount === 1 ? 'ORIGINAL' : printCount === 2 ? 'DUPLICATE' : 'REPRINT';

      db.DocumentPrintLog.create({
        templateId: template._id,
        templateName: template.name || 'Document',
        documentType: template.documentType,
        documentNumber: docNum,
        partyName: party,
        printedBy: req.user?.name || req.user?.username || 'Admin',
        printCount,
        copyType,
        fileSize: pdfBuffer.length
      }).catch((e) => logger.warn('Failed to save print log: %o', e));
    } catch (auditErr) {
      logger.warn('Failed to calculate print log counter: %o', auditErr);
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${(template.name || 'document').replace(/\s+/g, '_')}.pdf"`,
      'Content-Length': pdfBuffer.length
    });

    return res.end(pdfBuffer);
  } catch (error) {
    logger.error('Error generating template PDF: %o', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || 'Failed to render PDF'
    });
  }
};

// 8. Fetch Real ERP Records for Live Studio Previewing
const getRecentRecords = async (req, res) => {
  try {
    const { documentType = 'INVOICE' } = req.query;
    const docTypeUpper = (documentType || 'INVOICE').toUpperCase();
    let records = [];

    if (docTypeUpper === 'INVOICE' || docTypeUpper === 'BILL') {
      const invoices = await db.BillingInvoice.find()
        .populate('customer')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      records = invoices.map((inv) => ({
        id: inv._id,
        label: `${inv.invoiceNumber || 'INV'} • ${inv.customer?.name || inv.partyName || 'Customer'} (₹${Number(inv.grandTotal || 0).toLocaleString('en-IN')})`,
        dataContext: {
          ...getMockDataContext('INVOICE'),
          invoice: {
            ...inv,
            invoiceNumber: inv.invoiceNumber || 'INV-001',
            invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
            placeOfSupply: inv.placeOfSupply || 'Gujarat (24)',
            transporter: inv.transporter || 'V-Trans Logistics',
            taxableTotal: inv.subTotal || inv.taxableTotal || 0,
            cgstTotal: inv.cgstTotal || 0,
            sgstTotal: inv.sgstTotal || 0,
            igstTotal: inv.igstTotal || 0,
            grandTotal: inv.grandTotal || 0,
            items: inv.items || []
          },
          customer: {
            name: inv.customer?.name || inv.partyName || 'Cash Customer',
            address: inv.customer?.billingAddress || inv.customer?.address || inv.deliveryAddress || 'Surat, Gujarat',
            deliveryName: inv.customer?.name || inv.partyName || '',
            deliveryAddress: inv.customer?.deliveryAddress || inv.deliveryAddress || '',
            gstin: inv.customer?.gstin || inv.gstin || '',
            state: inv.customer?.state || 'Gujarat (24)',
            phone: inv.customer?.phone || ''
          },
          items: inv.items || []
        }
      }));
    } else if (docTypeUpper === 'CHALLAN') {
      const challans = await db.FabricChallan.find()
        .populate('party vendor')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      records = challans.map((ch) => ({
        id: ch._id,
        label: `${ch.challanNumber || ch.challanNo || 'CH'} • ${ch.party?.name || ch.partyName || 'Party'} (${ch.totalMeters || 0} Mtr)`,
        dataContext: {
          ...getMockDataContext('CHALLAN'),
          challan: {
            challanNumber: ch.challanNumber || ch.challanNo || 'CH-001',
            challanDate: ch.challanDate ? new Date(ch.challanDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
            vehicleNumber: ch.vehicleNumber || ch.vehicleNo || 'GJ-05-BX-4921',
            transporter: ch.transporter || 'Local Tempo Delivery',
            ewayBill: ch.ewayBill || ch.ewayBillNumber || '',
            totalMeters: ch.totalMeters || 0,
            items: ch.items || ch.rolls || []
          },
          customer: {
            name: ch.party?.name || ch.partyName || 'Recipient Party',
            address: ch.party?.address || '',
            deliveryAddress: ch.deliveryAddress || ch.party?.address || '',
            gstin: ch.party?.gstin || ''
          },
          items: ch.items || ch.rolls || []
        }
      }));
    } else if (docTypeUpper === 'JOB_CARD') {
      const jobCards = await db.JobCard.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      records = jobCards.map((jc) => ({
        id: jc._id,
        label: `${jc.jobCardNumber || jc.jobNo || 'JC'} • ${jc.party || jc.client || 'Client'} (${jc.quality || 'Quality'})`,
        dataContext: {
          ...getMockDataContext('JOB_CARD'),
          jobCard: {
            jobCardNumber: jc.jobCardNumber || jc.jobNo || 'JC-001',
            priority: jc.priority || 'NORMAL',
            targetDate: jc.targetDate || jc.deliveryDate ? new Date(jc.targetDate || jc.deliveryDate).toLocaleDateString('en-IN') : '',
            fabricQuality: jc.quality || jc.fabric || 'Pure Modal Satin',
            panna: jc.panna || '44',
            pass: jc.pass || '2 Pass HD',
            items: jc.items || jc.designs || []
          },
          customer: {
            name: jc.party || jc.client || 'Client'
          },
          items: jc.items || jc.designs || []
        }
      }));
    }

    return res.status(httpStatus.OK).json({
      success: true,
      data: records
    });
  } catch (error) {
    logger.error('Error fetching recent ERP records for studio: %o', error);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message
    });
  }
};

// 9. Fetch Document Print Audit Logs
const getPrintLogs = async (req, res) => {
  try {
    const { documentType, limit = 50 } = req.query;
    const filter = {};
    if (documentType) filter.documentType = documentType.toUpperCase();
    const logs = await db.DocumentPrintLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    return res.status(httpStatus.OK).json({
      success: true,
      data: logs
    });
  } catch (err) {
    logger.error('Error fetching print audit logs: %o', err);
    return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: err.message
    });
  }
};

module.exports = {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setDefaultTemplate,
  generatePdf,
  getRecentRecords,
  getPrintLogs,
  getDefaultStarterTemplates,
  getMockDataContext
};
