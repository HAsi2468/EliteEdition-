/**
 * Token Resolution and Data Context Helper for Document & Invoice Design Studio
 */

export const ERP_TOKEN_CATEGORIES = [
  {
    category: 'Company / Organization',
    color: '#0284c7',
    tokens: [
      { key: 'company.name', label: 'Company Name', example: 'Elite Edition Digital Prints' },
      { key: 'company.address', label: 'Full Address', example: 'Plot 42, Surat Textile Park, Sachin GIDC' },
      { key: 'company.gstin', label: 'GSTIN Number', example: '24AAACE1234F1Z9' },
      { key: 'company.state', label: 'State & Code', example: 'Gujarat (24)' },
      { key: 'company.phone', label: 'Phone Number', example: '+91 98765 43210' },
      { key: 'company.email', label: 'Email Address', example: 'accounts@eliteedition.in' },
      { key: 'company.bankName', label: 'Bank Name', example: 'ICICI Bank Ltd' },
      { key: 'company.bankAccount', label: 'Account No', example: '123405009876' },
      { key: 'company.bankIfsc', label: 'IFSC Code', example: 'ICIC0001234' },
      { key: 'company.bankBranch', label: 'Branch Name', example: 'Ring Road Branch, Surat' }
    ]
  },
  {
    category: 'Customer / Party / Consignee',
    color: '#10b981',
    tokens: [
      { key: 'customer.name', label: 'Customer / Party Name', example: 'Shree Krishna Textiles Pvt Ltd' },
      { key: 'customer.address', label: 'Billing Address', example: 'Shop 108, Millennium Textile Market, Surat' },
      { key: 'customer.deliveryName', label: 'Consignee / Ship-To Name', example: 'Shree Krishna Textiles (Godown)' },
      { key: 'customer.deliveryAddress', label: 'Delivery Address', example: 'Plot 12, Pandesara GIDC, Surat' },
      { key: 'customer.gstin', label: 'Party GSTIN', example: '24AABCS9876K1ZY' },
      { key: 'customer.state', label: 'Party State', example: 'Gujarat (24)' },
      { key: 'customer.phone', label: 'Party Phone', example: '+91 91234 56789' }
    ]
  },
  {
    category: 'Document Meta (Invoice / Challan / JobCard)',
    color: '#f59e0b',
    tokens: [
      { key: 'invoice.invoiceNumber', label: 'Invoice Number', example: 'EE/26-27/0482' },
      { key: 'invoice.invoiceDate', label: 'Invoice Date', example: '13/10/2026' },
      { key: 'invoice.placeOfSupply', label: 'Place of Supply', example: 'Gujarat (24)' },
      { key: 'invoice.transporter', label: 'Transporter Info', example: 'V-Trans Logistics' },
      { key: 'challan.challanNumber', label: 'Challan Number', example: 'EDP/DC/26-27/0192' },
      { key: 'challan.challanDate', label: 'Challan Date', example: '13/10/2026' },
      { key: 'challan.vehicleNumber', label: 'Vehicle Number', example: 'GJ-05-BX-4921' },
      { key: 'challan.ewayBill', label: 'E-Way Bill No', example: '231098456128' },
      { key: 'challan.totalMeters', label: 'Challan Total Meters', example: '855' },
      { key: 'jobCard.jobCardNumber', label: 'Job Card Number', example: 'JC-2026-8910' },
      { key: 'jobCard.priority', label: 'Order Priority', example: 'HIGH PRIORITY' },
      { key: 'jobCard.targetDate', label: 'Target Delivery Date', example: '15/10/2026' },
      { key: 'jobCard.fabricQuality', label: 'Fabric Quality', example: 'Pure Modal Satin' },
      { key: 'jobCard.panna', label: 'Panna Width (inch)', example: '60' },
      { key: 'jobCard.pass', label: 'Print Pass', example: '2 Pass HD' }
    ]
  },
  {
    category: 'Financials & Tax Breakdown',
    color: '#8b5cf6',
    tokens: [
      { key: 'invoice.taxableTotal', label: 'Total Taxable Value', example: '₹48,500.00' },
      { key: 'invoice.cgstTotal', label: 'CGST Total (2.5%)', example: '₹1,212.50' },
      { key: 'invoice.sgstTotal', label: 'SGST Total (2.5%)', example: '₹1,212.50' },
      { key: 'invoice.igstTotal', label: 'IGST Total (5.0%)', example: '₹0.00' },
      { key: 'invoice.grandTotal', label: 'Grand Total Amount', example: '₹50,925.00' }
    ]
  }
];

export const MOCK_DATA_CONTEXT = {
  company: {
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
  },
  customer: {
    name: 'Shree Krishna Textiles Pvt Ltd',
    address: 'Shop 108-112, Millennium Textile Market, Ring Road, Surat - 395002',
    deliveryName: 'Shree Krishna Textiles (Godown Unit)',
    deliveryAddress: 'Plot 12, Pandesara GIDC, Surat - 394221',
    gstin: '24AABCS9876K1ZY',
    state: 'Gujarat (24)',
    phone: '+91 91234 56789'
  },
  invoice: {
    invoiceNumber: 'EE/26-27/0482',
    invoiceDate: '13/10/2026',
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
  },
  challan: {
    challanNumber: 'EDP/DC/26-27/0192',
    challanDate: '13/10/2026',
    vehicleNumber: 'GJ-05-BX-4921',
    transporter: 'Local Tempo Delivery',
    ewayBill: '231098456128',
    totalMeters: 855,
    items: [
      { index: 1, designCode: 'DS-9021-FLORAL', quality: 'Modal Satin 44" Panna', hsn: '5407', quantity: 350, unit: 'Mtr' },
      { index: 2, designCode: 'DS-9022-GEOM', quality: 'Rayon Twill 60" Panna', hsn: '5407', quantity: 280, unit: 'Mtr' },
      { index: 3, designCode: 'JW-5110-STRIPE', quality: 'Cotton Cambric 58" Panna', hsn: '5208', quantity: 225, unit: 'Mtr' }
    ]
  },
  jobCard: {
    jobCardNumber: 'JC-2026-8910',
    priority: 'HIGH PRIORITY',
    targetDate: '15/10/2026',
    fabricQuality: 'Pure Modal Satin',
    panna: '60',
    pass: '2 Pass High Definition',
    items: [
      { index: 1, designCode: 'DS-9021-FLORAL', requiredMeters: 350, printedMeters: 350, operator: 'Grando #1 (Ramesh)' },
      { index: 2, designCode: 'DS-9022-GEOM', requiredMeters: 280, printedMeters: 280, operator: 'Grando #2 (Mukesh)' },
      { index: 3, designCode: 'JW-5110-STRIPE', requiredMeters: 225, printedMeters: 225, operator: 'Grando #1 (Ramesh)' }
    ]
  }
};

/**
 * Safely resolves nested property value
 */
export const getNestedValue = (obj, path) => {
  if (!obj || !path) return '';
  const parts = path.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined) return '';
    curr = curr[part];
  }
  return curr !== undefined && curr !== null ? curr : '';
};

/**
 * Resolves template string with tokens e.g. "Inv: {{invoice.invoiceNumber}}"
 */
export const resolveTokens = (templateStr, dataContext = MOCK_DATA_CONTEXT) => {
  if (!templateStr || typeof templateStr !== 'string') return '';
  return templateStr.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, tokenKey) => {
    const val = getNestedValue(dataContext, tokenKey);
    if (val === '') return match;
    if (typeof val === 'number') {
      const lower = tokenKey.toLowerCase();
      if (lower.includes('total') || lower.includes('rate') || lower.includes('amount') || lower.includes('tax') || lower.includes('balance')) {
        return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      return val.toString();
    }
    return val;
  });
};
