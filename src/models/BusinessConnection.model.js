const mongoose = require('mongoose');

const commonDirectorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  primary_phone: { type: String, default: null, trim: true },
  whatsapp_phone: { type: String, default: null, trim: true },
  email: { type: String, default: null, trim: true, lowercase: true },
  city: { type: String, default: null, trim: true },
  state: { type: String, default: null, trim: true },
  address: { type: String, default: null, trim: true },
  is_active: { type: Boolean, default: true }
}, { _id: false });

const leadDataSchema = new mongoose.Schema({
  business_name: { type: String, default: null },
  product_or_sku_interest: { type: String, default: null },
  quantity: { type: Number, default: null },
  budget: { type: String, default: null },
  source: { type: String, enum: ['Meta Ads', 'WhatsApp', 'Website', 'Direct', 'Referral'], default: 'Direct' },
  lead_score: { type: Number, min: 0, max: 100, default: 50 },
  priority: { type: String, enum: ['HOT', 'WARM', 'COLD'], default: 'WARM' },
  pipeline_stage: { type: String, enum: ['New Lead', 'Contacted', 'Qualified'], default: 'New Lead' },
  suggested_next_action: { type: String, default: null },
  sla_followup_hours: { type: Number, default: 1 },
  instant_reply_text: { type: String, default: null }
}, { _id: false });

const vendorDataSchema = new mongoose.Schema({
  company_name: { type: String, default: null },
  gst_or_tax_id: { type: String, default: null },
  bank_account: { type: String, default: null },
  bank_ifsc: { type: String, default: null },
  upi_id: { type: String, default: null },
  payment_terms: { type: String, enum: ['Advance', 'Net 15', 'Net 30', 'COD'], default: 'Advance' },
  supplied_items: { type: String, default: null }
}, { _id: false });

const employeeDataSchema = new mongoose.Schema({
  department: { type: String, enum: ['Design', 'Production', 'Sales', 'Accounts', 'Management'], default: 'Production' },
  designation: { type: String, default: null },
  monthly_salary: { type: Number, default: null },
  joining_date: { type: String, default: null },
  emergency_contact: { type: String, default: null }
}, { _id: false });

const workerDataSchema = new mongoose.Schema({
  station_or_skill: { type: String, default: null },
  wage_model: { type: String, enum: ['DAILY_WAGE', 'PIECE_RATE', 'MONTHLY'], default: 'DAILY_WAGE' },
  rate_amount: { type: Number, default: null },
  payout_schedule: { type: String, enum: ['DAILY', 'WEEKLY', 'MONTHLY'], default: 'WEEKLY' }
}, { _id: false });

const businessConnectionSchema = new mongoose.Schema({
  companyEntity: { type: String, default: 'Elite Digital Print' },
  record_type: { 
    type: String, 
    required: true, 
    enum: ['LEAD', 'VENDOR', 'EMPLOYEE', 'WORKER'] 
  },
  operation: { type: String, default: 'UPSERT_RECORD' },
  common_directory: { type: commonDirectorySchema, required: true },
  lead_data: { type: leadDataSchema, default: null },
  vendor_data: { type: vendorDataSchema, default: null },
  employee_data: { type: employeeDataSchema, default: null },
  worker_data: { type: workerDataSchema, default: null },
  raw_input: { type: String, default: null },
  notes: [{
    text: String,
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: String, default: 'System' }
  }]
}, { timestamps: true });

businessConnectionSchema.index({ 'common_directory.primary_phone': 1 });
businessConnectionSchema.index({ 'common_directory.name': 1 });
businessConnectionSchema.index({ record_type: 1 });

module.exports = mongoose.model('BusinessConnection', businessConnectionSchema);
