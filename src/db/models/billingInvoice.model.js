const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  hsnCode: { type: String, default: '' },
  qty: { type: Number, required: true, default: 1 },
  unit: { type: String, default: 'Meters' },
  unitPrice: { type: Number, required: true, default: 0 },
  discountPct: { type: Number, default: 0 },
  discountAmt: { type: Number, default: 0 },
  taxRate: { type: Number, default: 18 }, // GST %
  taxAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true, default: 0 }
});

const billingInvoiceSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, required: true, unique: true },
    invoicePrefix: { type: String, default: 'EDP-INV-' },
    invoiceSeq: { type: Number, required: true },
    invoiceDate: { type: Date, default: Date.now },
    dueDate: { type: Date },

    // Customer / Client Details
    customer: {
      customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'BillingCustomer' },
      name: { type: String, required: true },
      businessName: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      gstin: { type: String, default: '' },
      billingAddress: { type: String, default: '' },
      shippingAddress: { type: String, default: '' },
      state: { type: String, default: 'Gujarat' },
      stateCode: { type: String, default: '24' }
    },

    // Line Items
    items: [invoiceItemSchema],

    // Calculations
    subtotal: { type: Number, required: true, default: 0 },
    discountType: { type: String, enum: ['percentage', 'flat'], default: 'flat' },
    discountValue: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },

    // Tax Details
    taxType: { type: String, enum: ['CGST_SGST', 'IGST'], default: 'CGST_SGST' },
    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },

    // Financial Totals
    grandTotal: { type: Number, required: true, default: 0 },
    paidAmount: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },

    // Status
    paymentStatus: {
      type: String,
      enum: ['PAID', 'UNPAID', 'PARTIALLY_PAID', 'OVERDUE'],
      default: 'UNPAID'
    },
    paymentMethod: { type: String, default: 'UPI / Bank Transfer' },
    paymentHistory: [
      {
        date: { type: Date, default: Date.now },
        amount: { type: Number, required: true },
        method: { type: String, default: 'Bank Transfer' },
        referenceNo: { type: String, default: '' },
        notes: { type: String, default: '' }
      }
    ],

    // Notes & Terms
    notes: { type: String, default: 'Thank you for doing business with Elite Digital Prints!' },
    terms: { type: String, default: 'Payment due within 15 days from invoice date. Subject to Surat jurisdiction.' }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

module.exports = mongoose.model('BillingInvoice', billingInvoiceSchema);
