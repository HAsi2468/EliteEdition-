const mongoose = require('mongoose');

const templateElementSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['text', 'dynamic_text', 'image', 'dynamic_table', 'qr_code', 'divider', 'rect'],
      default: 'text'
    },
    x: { type: Number, required: true, default: 20 },
    y: { type: Number, required: true, default: 20 },
    width: { type: Number, required: true, default: 150 },
    height: { type: Number, required: true, default: 40 },
    content: { type: String, default: '' },
    fieldBinding: { type: String, default: '' },
    tableConfig: {
      columns: [
        {
          key: { type: String, default: '' },
          label: { type: String, default: '' },
          width: { type: String, default: 'auto' },
          align: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
          field: { type: String, default: '' }
        }
      ],
      showHeader: { type: Boolean, default: true },
      striped: { type: Boolean, default: false },
      borderColor: { type: String, default: '#e2e8f0' },
      headerBg: { type: String, default: '#f8fafc' },
      headerColor: { type: String, default: '#0f172a' },
      rowHeight: { type: Number, default: 28 }
    },
    style: {
      fontSize: { type: Number, default: 12 },
      fontWeight: { type: String, default: 'normal' },
      fontStyle: { type: String, default: 'normal' },
      textAlign: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
      color: { type: String, default: '#0f172a' },
      backgroundColor: { type: String, default: 'transparent' },
      borderWidth: { type: Number, default: 0 },
      borderStyle: { type: String, default: 'none' },
      borderColor: { type: String, default: '#cbd5e1' },
      borderRadius: { type: Number, default: 0 },
      padding: { type: Number, default: 4 },
      letterSpacing: { type: String, default: 'normal' },
      lineHeight: { type: Number, default: 1.3 },
      zIndex: { type: Number, default: 1 }
    }
  },
  { _id: false }
);

const documentTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      default: 'Untitled Template'
    },
    documentType: {
      type: String,
      required: true,
      enum: ['INVOICE', 'CHALLAN', 'JOB_CARD', 'BILL'],
      default: 'INVOICE'
    },
    pageSize: {
      type: String,
      default: 'A4',
      enum: ['A4', 'A5', 'LETTER']
    },
    orientation: {
      type: String,
      enum: ['portrait', 'landscape'],
      default: 'portrait'
    },
    margins: {
      top: { type: Number, default: 20 },
      bottom: { type: Number, default: 20 },
      left: { type: Number, default: 20 },
      right: { type: Number, default: 20 }
    },
    elements: [templateElementSchema],
    isDefault: {
      type: Boolean,
      default: false
    },
    description: {
      type: String,
      default: ''
    },
    createdBy: {
      type: String,
      default: 'System Admin'
    }
  },
  {
    timestamps: true
  }
);

documentTemplateSchema.index({ documentType: 1, isDefault: 1 });

const DocumentTemplate = mongoose.model('DocumentTemplate', documentTemplateSchema);

module.exports = DocumentTemplate;
