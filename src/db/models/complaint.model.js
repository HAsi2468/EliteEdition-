const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    complaintNo: { type: String, required: true, unique: true, trim: true },
    date: { type: String, default: () => new Date().toISOString().split('T')[0] },
    partyName: { type: String, required: true, trim: true },
    jobCardNo: { type: String, default: '', trim: true },
    invoiceNo: { type: String, default: '', trim: true },
    designNo: { type: String, default: '', trim: true },
    category: {
      type: String,
      default: 'Printing Defect',
      enum: [
        'Color Matching / Shade Difference',
        'Printing Defect',
        'Fabric Damage',
        'Quantity Shortage',
        'Delivery Delay',
        'Billing Issue',
        'Other'
      ]
    },
    subCategory: { type: String, default: '', trim: true },
    priority: { type: String, default: 'Medium', enum: ['Low', 'Medium', 'High', 'Urgent'] },
    status: { type: String, default: 'Open', enum: ['Open', 'Hold', 'Close', 'Feedback', 'Pending', 'In Progress', 'Resolved', 'Rejected'] },
    defectiveMeters: { type: Number, default: 0 },
    expectedAmount: { type: Number, default: 0 },
    description: { type: String, default: '', trim: true },
    photoUrls: [{ type: String, trim: true }],
    actionTaken: { type: String, default: '', trim: true },
    resolvedDate: { type: Date, default: null },
    assignedTo: { type: String, default: '', trim: true },
    responsiblePerson: { type: String, default: '', trim: true },
    createdBy: { type: String, default: 'System', trim: true }
  },
  {
    timestamps: true
  }
);

complaintSchema.index({ complaintNo: 1 });
complaintSchema.index({ partyName: 1 });
complaintSchema.index({ status: 1 });

module.exports = mongoose.model('Complaint', complaintSchema);
