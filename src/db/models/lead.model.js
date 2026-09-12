const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  companyName: {
    type: String,
    default: '',
    trim: true
  },
  email: {
    type: String,
    default: '',
    trim: true
  },
  source: {
    type: String,
    enum: ['WhatsApp', 'Phone Call', 'Reference', 'Instagram', 'Direct Visit', 'Other'],
    default: 'WhatsApp'
  },
  stage: {
    type: String,
    enum: ['New', 'Contacted', 'In Discussion', 'Quotation Sent', 'Order Confirmed', 'Lost'],
    default: 'New'
  },
  priority: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium'
  },
  estimatedValue: {
    type: Number,
    default: 0
  },
  requirement: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  followUpDate: {
    type: Date,
    default: null
  },
  assignedTo: {
    type: String,
    default: 'Unassigned'
  },
  companyEntity: {
    type: String,
    default: 'Elite Digital Print'
  }
}, {
  timestamps: true
});

leadSchema.index({ stage: 1, createdAt: -1 });
leadSchema.index({ companyEntity: 1 });

const Lead = mongoose.model('Lead', leadSchema);

module.exports = Lead;
