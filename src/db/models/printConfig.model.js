const mongoose = require('mongoose');

const printConfigSchema = new mongoose.Schema(
  {
    // A singleton identifier
    isConfig: {
      type: Boolean,
      default: true,
      unique: true,
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
    operators: {
      type: [String],
      default: [],
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
    companyEmail: {
      type: String,
      default: 'info@elitedigitalprints.com',
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
  },
  {
    timestamps: true,
  }
);

const PrintConfig = mongoose.model('PrintConfig', printConfigSchema);

module.exports = PrintConfig;
