const mongoose = require('mongoose');

const monthlyCostingSchema = new mongoose.Schema(
  {
    companyEntity: { type: String, default: 'Elite Digital Print', index: true },
    month: { type: String, required: true, index: true }, // Format: YYYY-MM e.g. "2026-09"
    paperCost: { type: Number, default: 0 },
    inkCost: { type: Number, default: 0 },
    salaryCost: { type: Number, default: 0 },
    rentCost: { type: Number, default: 0 },
    electricityCost: { type: Number, default: 0 },
    maintenanceCost: { type: Number, default: 0 },
    transportCost: { type: Number, default: 0 },
    wastageCost: { type: Number, default: 0 },
    foodCost: { type: Number, default: 0 },
    machineCost: { type: Number, default: 0 },
    otherCost: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    updatedBy: { type: String, default: '' }
  },
  {
    timestamps: true
  }
);

monthlyCostingSchema.index({ companyEntity: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyCosting', monthlyCostingSchema);
