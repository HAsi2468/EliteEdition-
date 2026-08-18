const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    companyEntity: { type: String, default: 'Elite Digital Print', index: true },
    complaintNo: { type: String, required: true, trim: true },
    date: { type: String, default: () => new Date().toISOString().split('T')[0] },
    partyName: { type: String, required: true, trim: true },
    jobCardNo: { type: String, default: '', trim: true },
    invoiceNo: { type: String, default: '', trim: true },
    designNo: { type: String, default: '', trim: true },
    category: { type: String, default: 'Printing Defect', trim: true },
    subCategory: { type: String, default: '', trim: true },
    priority: { type: String, default: 'Medium', enum: ['Low', 'Medium', 'High', 'Urgent'] },
    status: { type: String, default: 'Open', trim: true },
    defectiveMeters: { type: Number, default: 0 },
    expectedAmount: { type: Number, default: 0 },
    description: { type: String, default: '', trim: true },
    photoUrls: [{ type: String, trim: true }],
    actionTaken: { type: String, default: '', trim: true },
    resolvedDate: { type: Date, default: null },
    assignedTo: { type: String, default: '', trim: true },
    responsiblePerson: { type: String, default: '', trim: true },
    responsiblePersons: [{ type: String, trim: true }],
    comments: [
      {
        text: { type: String, required: true, trim: true },
        userName: { type: String, default: 'System', trim: true },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    createdBy: { type: String, default: 'System', trim: true },
    createdByName: { type: String, default: 'System', trim: true },
    updatedBy: { type: String, default: '', trim: true },
    updatedByName: { type: String, default: '', trim: true }
  },
  {
    timestamps: true
  }
);

complaintSchema.index({ companyEntity: 1, complaintNo: 1 });
complaintSchema.index({ partyName: 1 });
complaintSchema.index({ status: 1 });

module.exports = mongoose.model('Complaint', complaintSchema);
