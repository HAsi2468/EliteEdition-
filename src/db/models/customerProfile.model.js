const mongoose = require('mongoose');

const customerProfileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    normalizedPhone: {
      type: String,
      trim: true,
      index: true,
    },
    companyName: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    city: {
      type: String,
      default: '',
      trim: true,
    },
    state: {
      type: String,
      default: 'Gujarat',
      trim: true,
    },
    gstin: {
      type: String,
      default: '',
      trim: true,
    },
    customerType: {
      type: String,
      enum: [
        'Boutique / Designer',
        'Wholesaler / Trader',
        'Garment Manufacturer',
        'Retail Brand',
        'Fabric Merchant',
        'Exporter',
        'Individual / Other',
      ],
      default: 'Boutique / Designer',
    },
    status: {
      type: String,
      enum: ['Active', 'Lead', 'VIP Client', 'Inactive'],
      default: 'Lead',
    },
    source: {
      type: String,
      default: 'WhatsApp',
    },
    creditLimit: {
      type: Number,
      default: 0,
    },
    paymentTerms: {
      type: String,
      default: 'Immediate / Advance',
    },
    totalInquiries: {
      type: Number,
      default: 1,
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    totalValue: {
      type: Number,
      default: 0,
    },
    latestRequirement: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
    tags: {
      type: [String],
      default: [],
    },
    assignedTo: {
      type: String,
      default: 'Unassigned',
    },
    companyEntity: {
      type: String,
      default: 'Elite Digital Print',
    },
    leadHistory: [
      {
        leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
        date: { type: Date, default: Date.now },
        stage: String,
        requirement: String,
        estimatedValue: Number,
        notes: String,
        source: String,
      },
    ],
    interactionLogs: [
      {
        date: { type: Date, default: Date.now },
        type: { type: String, default: 'Note' }, // 'Call', 'WhatsApp', 'Meeting', 'Note', 'Email'
        author: { type: String, default: 'Admin' },
        note: String,
      },
    ],
  },
  {
    timestamps: true,
    collection: 'customer_profiles',
  }
);

customerProfileSchema.index({ phone: 1, companyEntity: 1 });
customerProfileSchema.index({ normalizedPhone: 1, companyEntity: 1 });
customerProfileSchema.index({ status: 1, customerType: 1 });

module.exports = mongoose.model('CustomerProfile', customerProfileSchema);
