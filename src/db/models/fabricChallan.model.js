const mongoose = require('mongoose');

const tpDetailSchema = new mongoose.Schema(
  {
    tpNo: { type: Number, required: true },
    tpMeter: { type: Number, default: 0 },
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
  },
  {
    timestamps: true,
    collection: 'fabricChallans',
  }
);

// Auto-increment challanNo before saving a new doc
// Starting from EDP-621 as the baseline
const CHALLAN_START_NO = 621;
fabricChallanSchema.pre('save', async function () {
  if (this.isNew && !this.challanNo) {
    const last = await this.constructor.findOne({}, 'challanNo').sort({ challanNo: -1 });
    this.challanNo = last && last.challanNo
      ? Math.max(last.challanNo + 1, CHALLAN_START_NO)
      : CHALLAN_START_NO;
  }
});

const FabricChallan = mongoose.model('FabricChallan', fabricChallanSchema);
module.exports = FabricChallan;
