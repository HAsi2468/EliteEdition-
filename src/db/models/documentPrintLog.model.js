const mongoose = require('mongoose');

const documentPrintLogSchema = new mongoose.Schema(
  {
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DocumentTemplate'
    },
    templateName: {
      type: String,
      default: 'Document'
    },
    documentType: {
      type: String,
      required: true,
      enum: ['INVOICE', 'CHALLAN', 'JOB_CARD', 'BILL', 'SHIPPING_LABEL', 'ROLL_LABEL'],
      default: 'INVOICE'
    },
    documentNumber: {
      type: String,
      default: 'N/A'
    },
    partyName: {
      type: String,
      default: 'General'
    },
    printedBy: {
      type: String,
      default: 'Admin'
    },
    printCount: {
      type: Number,
      default: 1
    },
    copyType: {
      type: String,
      enum: ['ORIGINAL', 'DUPLICATE', 'TRIPLICATE', 'REPRINT'],
      default: 'ORIGINAL'
    },
    recordId: {
      type: String,
      default: ''
    },
    fileSize: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

documentPrintLogSchema.index({ documentType: 1, documentNumber: 1, createdAt: -1 });

const DocumentPrintLog = mongoose.model('DocumentPrintLog', documentPrintLogSchema);

module.exports = DocumentPrintLog;
