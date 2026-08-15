const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    voucherNo: { type: String, required: true, unique: true, trim: true },
    date: { type: String, default: () => new Date().toISOString().split('T')[0] },
    type: { type: String, required: true, enum: ['IN', 'OUT'], default: 'OUT' },
    category: { type: String, required: true, default: 'Miscellaneous', trim: true },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMode: { type: String, default: 'Cash', enum: ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Petty Cash', 'Other'] },
    paidToOrReceivedFrom: { type: String, default: '', trim: true },
    billNo: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true },
    receiptUrls: [{ type: String, trim: true }],
    department: { type: String, default: 'digital_print', trim: true },
    createdBy: { type: String, default: 'System', trim: true }
  },
  {
    timestamps: true
  }
);

expenseSchema.index({ voucherNo: 1 });
expenseSchema.index({ date: 1 });
expenseSchema.index({ type: 1 });
expenseSchema.index({ category: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
