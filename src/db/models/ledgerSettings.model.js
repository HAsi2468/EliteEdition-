const mongoose = require('mongoose');

const ledgerSettingsSchema = new mongoose.Schema(
  {
    businessUnit: { type: String, required: true, trim: true, index: true },
    companyEntity: { type: String, trim: true, index: true },
    initialCashOpening: { type: Number, default: 0 },
    initialBankOpening: { type: Number, default: 0 },
    effectiveDate: { type: String, default: '2024-04-01', trim: true },
    bankAccountName: { type: String, default: 'KOTAK EDP', trim: true },
    notes: { type: String, default: '', trim: true },
    updatedBy: { type: String, default: 'System', trim: true }
  },
  {
    timestamps: true
  }
);

ledgerSettingsSchema.index({ businessUnit: 1 });
ledgerSettingsSchema.index({ companyEntity: 1 });

module.exports = mongoose.model('LedgerSettings', ledgerSettingsSchema);
