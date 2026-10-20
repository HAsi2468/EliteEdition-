const mongoose = require('mongoose');

const deliveryChallanItemSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'BillingItem' },
  itemName: { type: String, required: true },
  description: { type: String, default: '' },
  hsnCode: { type: String, default: '6204' },
  qty: { type: Number, required: true, default: 1 },
  unit: { type: String, default: 'Pcs' }, // Pcs, Meters, Sets, Rolls, Boxes, Kgs
  unitPrice: { type: Number, default: 0 },
  taxRate: { type: Number, default: 5 }, // GST %
  taxAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 }
});

const deliveryChallanSchema = new mongoose.Schema(
  {
    companyEntity: { type: String, required: true, default: 'Sobise', index: true },
    challanNo: { type: String, required: true, unique: true, index: true }, // e.g. SO-1000, SO-1001
    challanPrefix: { type: String, default: 'SO-' },
    challanSeq: { type: Number, required: true, index: true },
    challanDate: { type: Date, default: Date.now, index: true },
    dispatchDate: { type: Date, default: Date.now },

    // Status tracking: PENDING, DELIVERED, INVOICED, CANCELLED
    status: {
      type: String,
      enum: ['PENDING', 'DELIVERED', 'INVOICED', 'CANCELLED'],
      default: 'PENDING',
      index: true
    },

    // Customer / Party Details
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

    // Transport & Logistics Details
    dispatchDetails: {
      transporter: { type: String, default: '' },
      vehicleNo: { type: String, default: '' },
      eWayBillNo: { type: String, default: '' },
      dispatchThrough: { type: String, default: 'By Road' },
      driverName: { type: String, default: '' },
      driverPhone: { type: String, default: '' },
      lrNo: { type: String, default: '' } // Lorry Receipt / Bilty No
    },

    // Line Items
    items: [deliveryChallanItemSchema],

    // Aggregates & Totals
    totalQty: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    // Invoicing Linkage
    invoiced: { type: Boolean, default: false, index: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'BillingInvoice' },
    invoiceNo: { type: String, default: '' },
    invoicedAt: { type: Date },

    // Documentation & Notes
    notes: { type: String, default: '' },
    terms: { 
      type: String, 
      default: '1. Goods dispatched in sound condition.\n2. Receiver acknowledgment required on delivery.\n3. Subject to local jurisdiction only.' 
    },
    createdBy: { type: String, default: 'Admin' }
  },
  {
    timestamps: true
  }
);

deliveryChallanSchema.index({ companyEntity: 1, challanDate: -1 });
deliveryChallanSchema.index({ companyEntity: 1, status: 1 });

const DeliveryChallan = mongoose.model('DeliveryChallan', deliveryChallanSchema);

module.exports = DeliveryChallan;
