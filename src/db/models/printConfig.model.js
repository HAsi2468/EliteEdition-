const mongoose = require('mongoose');

const printConfigSchema = new mongoose.Schema(
  {
    companyEntity: {
      type: String,
      default: 'Elite Online',
      index: true,
    },
    isConfig: {
      type: Boolean,
      default: true,
    },
    categories: {
      type: [String],
      default: [],
    },
    passes: {
      type: [String],
      default: [],
    },
    parties: {
      type: [String],
      default: [],
    },
    widths: {
      type: [String],
      default: [],
    },
    fabrics: {
      type: [String],
      default: [],
    },
    designers: {
      type: [String],
      default: [],
    },
    colourMatchings: {
      type: [String],
      default: [],
    },
    operators: {
      type: [String],
      default: [],
    },
    complaintCategories: {
      type: [String],
      default: ['Printing Defect', 'Color Matching / Shade Difference', 'Fabric Damage', 'Quantity Shortage', 'Delivery Delay', 'Billing Issue', 'Other'],
    },
    complaintSubCategories: {
      type: Map,
      of: [String],
      default: {
        'Printing Defect': ['Line Defect', 'Ink Spot', 'Ghost Printing', 'Streaks', 'Smudge', 'Misalignment', 'White Specks', 'Paper Wrinkle', 'Other Printing Defect'],
        'Color Matching / Shade Difference': ['Lighter Shade', 'Darker Shade', 'Tone Variation', 'Color Bleeding', 'Sample Mismatch', 'Shade Variation Across Width', 'Other Shade Issue'],
        'Fabric Damage': ['Hole / Tear', 'Stains / Spots', 'Shrinkage', 'Weaving Flaw', 'Panna Variation', 'Other Fabric Defect'],
        'Quantity Shortage': ['Meter Shortage', 'Piece Count Shortage', 'Partial Delivery', 'Missing Roll', 'Other Shortage'],
        'Delivery Delay': ['Late Dispatch', 'Transit Delay', 'Missing Parcel', 'Wrong Address Delivery'],
        'Billing Issue': ['Rate Mismatch', 'Discount Missing', 'GST Calculation Error', 'Duplicate Bill'],
        'Other': ['General Customer Issue', 'Packaging Defect', 'Miscellaneous']
      },
    },
    paperTypes: {
      type: [String],
      default: [],
    },
    machines: {
      type: [{
        name: { type: String, required: true },
        profiles: { type: [String], default: [] }
      }],
      default: [
        { name: 'GRANDO', profiles: [] },
        { name: 'PRINTDOT', profiles: [] }
      ],
    },
    billToOptions: {
      type: [String],
      default: [],
    },
    shipToOptions: {
      type: [String],
      default: [],
    },
    temperatures: {
      type: [String],
      default: [],
    },
    speeds: {
      type: [String],
      default: [],
    },
    startingJobNo: {
      type: Number,
      default: 1,
    },
    rawMaterials: {
      type: [String],
      default: [],
    },
    sublimationPanna: {
      type: [String],
      default: [],
    },
    sublimationQualities: {
      type: [String],
      default: [],
    },
    butterPanna: {
      type: [String],
      default: [],
    },
    inkColors: {
      type: [String],
      default: [],
    },
    inkCanSizes: {
      type: [String],
      default: [],
    },
    deliveryOptions: {
      type: [String],
      default: [],
    },
    stitchingCategories: {
      type: [String],
      default: ['SUIT', 'KURTI', 'DUPATTA', 'TOP', 'BOTTOM', 'LEHENGA', 'STITCHING SET', 'KIDS', 'ETHNIC'],
    },
    stitchingLabels: {
      type: [String],
      default: ['Elite Edition', 'Private Label', 'Custom Brand'],
    },
    finishingOptions: {
      type: [String],
      default: ['Standard Finishing', 'Iron & Pack', 'Overlock', 'Embroidery Finish', 'Premium Box'],
    },
    stitchingParties: {
      type: [String],
      default: ['Wholesale Party', 'Direct Client', 'Retailer'],
    },
    stitchingBillTo: {
      type: [String],
      default: [],
    },
    stitchingShipTo: {
      type: [String],
      default: [],
    },
    stitchingDeliveryBy: {
      type: [String],
      default: ['Party Delivery', 'Self Pickup', 'Courier / Cargo'],
    },
    expenseInCategories: {
      type: [String],
      default: [
        'Petty Cash Top-up',
        'Client Payment / Advance',
        'Scrap / Waste Sale',
        'Refund / Cashback',
        'Other Receipt'
      ],
    },
    expenseOutCategories: {
      type: [String],
      default: [
        'Machine Maintenance & Service',
        'Ink & Consumables',
        'Spare Parts & Repairs',
        'Paper & Transfer Film',
        'Tea & Refreshments',
        'Carriage & Freight',
        'Salary / Daily Wages',
        'Electricity & Utility',
        'Stationery & Office',
        'Other Expense'
      ],
    },
    expensePaymentModes: {
      type: [String],
      default: ['Cash', 'UPI / GPay / PhonePe', 'Bank Transfer (NEFT/RTGS)', 'Cheque', 'Credit / Debit Card', 'Other'],
    },
    lotPartyMap: {
      type: Map,
      of: String,
      default: {},
    },
    companyName: {
      type: String,
      default: 'ELITE DIGITAL PRINTS',
    },
    companyGstin: {
      type: String,
      default: '24AAAFE1234F1Z5',
    },
    companyAddress: {
      type: String,
      default: 'G.F., PLOT NO-B/37, Siddheshwar Soc., Punagam Main Road, Surat - 395006',
    },
    companyPhone: {
      type: String,
      default: '+91 98790 00000',
    },
    companyLogo: {
      type: String,
      default: '',
    },
    companyState: {
      type: String,
      default: 'Gujarat',
    },
    companyStateCode: {
      type: String,
      default: '24',
    },
    companyEmail: {
      type: String,
      default: 'info@company.com',
    },
    companyBankName: {
      type: String,
      default: '',
    },
    companyAccountNo: {
      type: String,
      default: '',
    },
    companyIfscCode: {
      type: String,
      default: '',
    },
    companyTerms: {
      type: String,
      default: 'Payment due within 30 days from invoice date. Subject to Surat jurisdiction.',
    },
    paymentDueDays: {
      type: Number,
      default: 30,
    },
    startingInvoiceNo: {
      type: Number,
      default: 1001,
    },
    invoicePrefix: {
      type: String,
      default: 'EDP-INV-',
    },
    challanDesign: {
      title: { type: String, default: 'DELIVERY CHALLAN' },
      prefix: { type: String, default: 'DC-2627-' },
      startingNo: { type: Number, default: 1 },
      paperSize: { type: String, default: 'A4' },
      orientation: { type: String, default: 'portrait' },
      copies: {
        type: [String],
        default: ['Original for Consignee', 'Duplicate for Transporter', 'Triplicate for Supplier'],
      },
      showLogo: { type: Boolean, default: true },
      showGstin: { type: Boolean, default: true },
      showPhoneEmail: { type: Boolean, default: true },
      showBankDetails: { type: Boolean, default: false },
      showDesignImage: { type: Boolean, default: true },
      showHsnCode: { type: Boolean, default: true },
      showRateAndAmount: { type: Boolean, default: true },
      showRemarks: { type: Boolean, default: true },
      signatureLeft: { type: String, default: "Receiver's Signature" },
      signatureCenter: { type: String, default: "Prepared / Checked By" },
      signatureRight: { type: String, default: "Authorized Signatory" },
      termsAndConditions: {
        type: String,
        default: '1. Goods received in good condition and as per specification.\n2. Dispute if any subject to Surat jurisdiction only.\n3. Goods once dispatched/delivered will not be taken back.',
      },
      footerNote: { type: String, default: 'This is a computer generated delivery challan.' },
    },
    reportDesign: {
      themeColor: { type: String, default: '#0284c7' },
      paperSize: { type: String, default: 'A4' },
      orientation: { type: String, default: 'landscape' },
      density: { type: String, default: 'compact' },
      showLogo: { type: Boolean, default: true },
      showKpiSummary: { type: Boolean, default: true },
      showGeneratedBy: { type: Boolean, default: true },
      showTimestamp: { type: Boolean, default: true },
      watermarkText: { type: String, default: '' },
      footerDisclaimer: { type: String, default: 'Confidential ERP Report - For Internal Operations Only.' },
    },
    isSystemLocked: {
      type: Boolean,
      default: false,
    },
    systemLockedAt: {
      type: Date,
      default: null,
    },
    systemLockedBy: {
      type: String,
      default: '',
    },
    systemLockMessage: {
      type: String,
      default: 'System operations are temporarily paused by Administrator for routine maintenance. Please wait, operations will resume automatically.',
    },
  },
  {
    timestamps: true,
  }
);

const PrintConfig = mongoose.model('PrintConfig', printConfigSchema);

module.exports = PrintConfig;
