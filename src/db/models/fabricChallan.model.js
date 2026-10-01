const mongoose = require('mongoose');

const tpDetailSchema = new mongoose.Schema(
  {
    tpNo: { type: Number, required: true },
    tpMeter: { type: Number, default: 0 },
    freshMtr: { type: Number, default: 0 },
    westMtr: { type: Number, default: 0 },
    lotNo: { type: String, default: '' },
  },
  { _id: false }
);

const fabricChallanSchema = new mongoose.Schema(
  {
    challanNo: {
      type: Number,
      unique: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    companyEntity: {
      type: String,
      trim: true,
      default: 'Elite Digital Print',
      index: true,
    },
    partyName: {
      type: String,
      trim: true,
      default: '',
    },

    // Lot details (auto-filled from Inward lot)
    lotNo: {
      type: String,
      default: '',
    },
    vendorChallanNo: {
      type: String,
      trim: true,
      default: '',
    },
    deliveryBy: {
      type: String,
      trim: true,
      default: '',
    },
    fabricName: {
      type: String,
      trim: true,
      default: '',
    },
    shortagePct: {
      type: Number,
      default: null,
    },
    shortageMtr: {
      type: Number,
      default: null,
    },
    shortageMode: {
      type: String,
      enum: ['pct', 'mtr'],
      default: 'pct',
    },

    // Job card details (auto-filled from Job Card)
    jobNo: {
      type: String,
      trim: true,
      default: '',
    },
    designNo: {
      type: String,
      trim: true,
      default: '',
    },
    colour: {
      type: String,
      trim: true,
      default: '',
    },
    panna: {
      type: String,
      trim: true,
      default: '',
    },

    // TP details — up to 20 entries
    tpDetails: {
      type: [tpDetailSchema],
      default: [],
      validate: [arr => arr.length <= 30, 'Maximum 30 TP entries allowed'],
    },

    // Computed totals
    totalMtr: {
      type: Number,
      default: 0,
    },
    proportionalWasteMtr: {
      type: Number,
      default: 0,
    },
    totalTp: {
      type: Number,
      default: 0,
    },
    pcs: {
      type: Number,
      default: 0,
    },
    billTo: {
      type: String,
      trim: true,
      default: '',
    },
    shipTo: {
      type: String,
      trim: true,
      default: '',
    },

    notes: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: String,
      trim: true,
      default: '',
    },
    // References to the auto-created fabric outward transactions (lot-wise)
    fabricOutwardIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FabricTransaction',
    }],
    status: {
      type: String,
      default: 'PENDING',
      enum: ['PENDING', 'INVOICED', 'CANCELLED']
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BillingInvoice',
      default: null
    },
    invoiceNo: {
      type: String,
      default: ''
    },
    // Signed physical copy upload & verification (max 2 images in R2)
    signedCopy: {
      images: {
        type: [{ type: String }],
        validate: [arr => !arr || arr.length <= 2, 'Maximum 2 images allowed for signed copy'],
        default: []
      },
      status: {
        type: String,
        enum: ['NONE', 'PENDING', 'APPROVED', 'REJECTED'],
        default: 'NONE'
      },
      uploadedAt: { type: Date },
      uploadedBy: { type: String, default: '' },
      uploadedByName: { type: String, default: '' },
      approvedAt: { type: Date },
      approvedBy: { type: String, default: '' },
      approvedByName: { type: String, default: '' },
      rejectionReason: { type: String, default: '' }
    },

    // ── Phase 3: Digital QR Code Verification & Physical Challan Authentication ──
    verificationUuid: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    verificationHash: {
      type: String,
      default: '',
    },
    verificationScanCount: {
      type: Number,
      default: 0,
    },
    lastScannedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'fabricChallans',
  }
);

// Auto-increment challanNo & generate verification UUID/hash before saving a new doc
// Starting from EDP-621 as the baseline
const CHALLAN_START_NO = 621;
fabricChallanSchema.pre('save', async function () {
  const crypto = require('crypto');
  if (this.isNew && !this.challanNo) {
    const last = await this.constructor.findOne({}, 'challanNo').sort({ challanNo: -1 });
    this.challanNo = last && last.challanNo
      ? Math.max(last.challanNo + 1, CHALLAN_START_NO)
      : CHALLAN_START_NO;
  }

  // Ensure cryptographic UUID exists for physical QR verification
  if (!this.verificationUuid) {
    this.verificationUuid = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  }

  // Generate tamper-evident 16-hex digest
  const hashPayload = `${this.challanNo || ''}:${this.partyName || ''}:${this.totalMtr || 0}:${this.date ? new Date(this.date).toISOString().split('T')[0] : ''}`;
  this.verificationHash = crypto.createHash('sha256').update(hashPayload).digest('hex').substring(0, 16);
});

// Challan queries filtering by fabric and panna
fabricChallanSchema.index({ fabricName: 1, panna: 1 });
// Challan listing and search
fabricChallanSchema.index({ partyName: 1 });
// Status filter
fabricChallanSchema.index({ status: 1 });
// Lookup challans by job number
fabricChallanSchema.index({ jobNo: 1 });
// Default sort
fabricChallanSchema.index({ createdAt: -1 });
// Signed copy approval status index
fabricChallanSchema.index({ 'signedCopy.status': 1 });

const FabricChallan = mongoose.model('FabricChallan', fabricChallanSchema);
module.exports = FabricChallan;
