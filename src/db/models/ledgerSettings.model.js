const mongoose = require('mongoose');

const ledgerSettingsSchema = new mongoose.Schema(
  {
    businessUnit: { type: String, required: true, trim: true, index: true },
    companyEntity: { type: String, trim: true, index: true },
    initialCashOpening: { type: Number, default: 0 },
    initialBankOpening: { type: Number, default: 0 },
    bankOpenings: { type: mongoose.Schema.Types.Mixed, default: {} },
    effectiveDate: { type: String, default: '2024-04-01', trim: true },
    bankAccountName: { type: String, default: 'KOTAK EDP', trim: true },
    notes: { type: String, default: '', trim: true },
    updatedBy: { type: String, default: 'System', trim: true }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('LedgerSettings', ledgerSettingsSchema);
