const Lead = require('../db/models/lead.model');
const { evaluateLeadInquiry } = require('../services/leadEvaluator');

// Ingest raw inquiry text, run AI Lead Evaluation engine, save to DB, and return standardized JSON
const ingestAndQualifyLead = async (req, res) => {
  try {
    const { rawInquiryText, lead_source, companyEntity } = req.body;
    if (!rawInquiryText || !String(rawInquiryText).trim()) {
      return res.status(400).json({ success: false, error: 'Raw inquiry text is required.' });
    }

    const evaluationResult = evaluateLeadInquiry(rawInquiryText, lead_source);

    const leadDoc = new Lead({
      rawInquiryText: String(rawInquiryText).trim(),
      companyEntity: companyEntity || 'Elite Digital Print',
      lead_profile: evaluationResult.lead_profile,
      inquiry_details: evaluationResult.inquiry_details,
      qualification: evaluationResult.qualification,
      action_plan: evaluationResult.action_plan,
      auto_response_draft: evaluationResult.auto_response_draft,
      scoring_breakdown: evaluationResult.scoring_breakdown,
      status: 'New'
    });

    await leadDoc.save();

    return res.status(201).json({
      success: true,
      message: 'Lead successfully ingested & qualified by AI',
      data: leadDoc,
      evaluationJson: evaluationResult
    });
  } catch (error) {
    console.error('Error in ingestAndQualifyLead:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Get list of leads with filtering
const getLeads = async (req, res) => {
  try {
    const { priority, pipeline_stage, search, lead_intent, companyEntity } = req.query;
    const filter = {};

    if (companyEntity) {
      filter.companyEntity = companyEntity;
    }

    if (priority && priority !== 'All') {
      filter['qualification.priority'] = priority;
    }

    if (pipeline_stage && pipeline_stage !== 'All') {
      filter['qualification.pipeline_stage'] = pipeline_stage;
    }

    if (lead_intent && lead_intent !== 'All') {
      filter['qualification.lead_intent'] = lead_intent;
    }

    if (search && String(search).trim()) {
      const sRegex = new RegExp(String(search).trim(), 'i');
      filter.$or = [
        { rawInquiryText: sRegex },
        { 'lead_profile.full_name': sRegex },
        { 'lead_profile.phone': sRegex },
        { 'lead_profile.email': sRegex },
        { 'lead_profile.company_or_business_name': sRegex },
        { 'inquiry_details.product_service_interest': sRegex },
        { 'inquiry_details.raw_notes_summary': sRegex }
      ];
    }

    const leads = await Lead.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: leads.length,
      data: leads
    });
  } catch (error) {
    console.error('Error in getLeads:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Get single lead details
const getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found.' });
    }
    return res.status(200).json({ success: true, data: lead });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Update lead
const updateLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found.' });
    }
    return res.status(200).json({ success: true, data: lead });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Delete lead
const deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found.' });
    }
    return res.status(200).json({ success: true, message: 'Lead deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Send / log auto response to lead
const sendAutoResponse = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found.' });
    }

    lead.status = 'Contacted';
    if (lead.qualification.pipeline_stage === 'New Lead') {
      lead.qualification.pipeline_stage = 'Contacted';
    }
    await lead.save();

    return res.status(200).json({
      success: true,
      message: `Auto response logged and dispatched via ${lead.auto_response_draft.channel}`,
      data: lead
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  ingestAndQualifyLead,
  getLeads,
  getLeadById,
  updateLead,
  deleteLead,
  sendAutoResponse
};
