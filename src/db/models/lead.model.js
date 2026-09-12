const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  rawInquiryText: {
    type: String,
    required: true,
    trim: true
  },
  companyEntity: {
    type: String,
    default: 'Elite Digital Print'
  },
  lead_profile: {
    full_name: { type: String, default: null },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    city_location: { type: String, default: null },
    company_or_business_name: { type: String, default: null }
  },
  inquiry_details: {
    product_service_interest: { type: String, default: 'General Inquiry' },
    estimated_quantity: { type: Number, default: null },
    estimated_budget: { type: String, default: null },
    lead_source: { type: String, default: 'WhatsApp' },
    raw_notes_summary: { type: String, default: '' }
  },
  qualification: {
    lead_score: { type: Number, default: 0, min: 0, max: 100 },
    priority: { type: String, enum: ['HOT', 'WARM', 'COLD'], default: 'COLD' },
    pipeline_stage: { 
      type: String, 
      enum: ['New Lead', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost'], 
      default: 'New Lead' 
    },
    lead_intent: { 
      type: String, 
      enum: ['Immediate Purchase', 'Price Inquiry', 'Bulk Order', 'General Browsing'], 
      default: 'Price Inquiry' 
    }
  },
  action_plan: {
    suggested_assignee_role: { type: String, enum: ['Sales Rep', 'B2B Specialist', 'Support'], default: 'Sales Rep' },
    next_action: { type: String, default: '' },
    sla_follow_up_hours: { type: Number, default: 4 }
  },
  auto_response_draft: {
    channel: { type: String, enum: ['WhatsApp', 'Email', 'SMS'], default: 'WhatsApp' },
    message: { type: String, default: '' }
  },
  scoring_breakdown: {
    product_sku_matched: { type: Boolean, default: false },
    qty_or_budget_provided: { type: Boolean, default: false },
    high_urgency_detected: { type: Boolean, default: false },
    valid_contact_provided: { type: Boolean, default: false },
    business_or_bulk_inquiry: { type: Boolean, default: false }
  },
  assigned_to: { type: String, default: 'Unassigned' },
  status: { type: String, enum: ['New', 'In Progress', 'Contacted', 'Closed'], default: 'New' }
}, {
  timestamps: true
});

leadSchema.index({ 'qualification.priority': 1, createdAt: -1 });
leadSchema.index({ 'qualification.pipeline_stage': 1 });
leadSchema.index({ companyEntity: 1 });

const Lead = mongoose.model('Lead', leadSchema);

module.exports = Lead;
