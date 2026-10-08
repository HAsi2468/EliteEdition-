const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  itemName: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  fabric: { type: String, default: '' },
  fabricName: { type: String, default: '' },
  jobNo: { type: String, default: '' },
  lotNo: { type: String, default: '' },
  partyChallan: { type: String, default: '' },
  ourChallanNo: { type: String, default: '' },
  hsnCode: { type: String, default: '998821' },
  quantity: { type: Number, default: 1 },
  qty: { type: Number, default: 1 },
  unit: { type: String, default: 'Meters' },
  rate: { type: Number, default: 0 },
  unitPrice: { type: Number, default: 0 },
  discountPct: { type: Number, default: 0 },
  discountAmt: { type: Number, default: 0 },
  taxRate: { type: Number, default: 5 },
  taxAmount: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 }
});

const billingPurchaseSchema = new mongoose.Schema(
  {
    companyEntity: { type: String, default: 'Elite Digital Prints', index: true },
    purchaseNo: { type: String, required: true, trim: true, index: true },
    ourChallanNo: { type: String, default: '' },
    date: { type: Date, default: Date.now },
    dueDate: { type: Date },

    // Vendor / Supplier Details (counterpart to Customer details in Invoice)
    vendor: {
      vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
      name: { type: String, default: '' },
      businessName: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      gstin: { type: String, default: '' },
      billingAddress: { type: String, default: '' },
      shippingAddress: { type: String, default: '' },
      state: { type: String, default: 'Gujarat' },
      stateCode: { type: String, default: '24' }
    },
    vendorName: { type: String, required: true, trim: true, index: true },

    items: [purchaseItemSchema],
    itemName: { type: String, default: '' },
    quantity: { type: Number, default: 0 },
    unit: { type: String, default: 'Meters' },
    rate: { type: mongoose.Schema.Types.Mixed, default: 0 },

    // Financial Calculations (identical to Invoice)
    subtotal: { type: Number, default: 0 },
    subtotalAmount: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    discountType: { type: String, enum: ['percentage', 'flat'], default: 'flat' },
    discountValue: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },

    taxType: { type: String, enum: ['CGST_SGST', 'IGST'], default: 'CGST_SGST' },
    gstRate: { type: Number, default: 0 },
    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },

    enableRoundOff: { type: Boolean, default: true },
    roundOff: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    paidAmount: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['PAID', 'UNPAID', 'PARTIALLY_PAID', 'OVERDUE'],
      default: 'UNPAID'
    },

    notes: { type: String, default: '' },
    terms: { type: String, default: '' }
  },
  {
    timestamps: true
  }
);

// Index for query optimization
billingPurchaseSchema.index({ companyEntity: 1, date: -1 });

const BillingPurchase = mongoose.model('BillingPurchase', billingPurchaseSchema);

module.exports = BillingPurchase;
