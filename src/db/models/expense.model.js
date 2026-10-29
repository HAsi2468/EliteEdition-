const mongoose = require('mongoose');

function normalizeIsoDateString(val) {
  if (!val) return new Date().toISOString().split('T')[0];
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    return `${ddmmyyyy[3]}-${month}-${day}`;
  }
  return str;
}

const expenseSchema = new mongoose.Schema(
  {
    companyEntity: { type: String, default: 'Elite Digital Prints', trim: true, index: true },
    voucherNo: { type: String, required: true, trim: true },
    date: {
      type: String,
      default: () => new Date().toISOString().split('T')[0],
      set: normalizeIsoDateString
    },
    type: { type: String, required: true, enum: ['IN', 'OUT'], default: 'OUT' },
    category: { type: String, required: true, default: 'Miscellaneous', trim: true },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMode: { type: String, default: 'Cash', trim: true },
    paidToOrReceivedFrom: { type: String, default: '', trim: true },
    billNo: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true },
    receiptUrls: [{ type: String, trim: true }],
    bankAccount: { type: String, default: '', trim: true },
    status: { type: String, default: 'APPROVED', trim: true },
    department: { type: String, default: 'digital_print', trim: true },
    createdBy: { type: String, default: 'System', trim: true },
    createdByName: { type: String, default: 'System', trim: true },
    updatedBy: { type: String, default: '', trim: true },
    updatedByName: { type: String, default: '', trim: true }
  },
  {
    timestamps: true
  }
);

expenseSchema.index({ companyEntity: 1, voucherNo: 1 });
expenseSchema.index({ companyEntity: 1, date: -1 });
expenseSchema.index({ date: 1 });
expenseSchema.index({ type: 1 });
expenseSchema.index({ category: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
