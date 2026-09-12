const Lead = require('../db/models/lead.model');

// Create new lead
const createLead = async (req, res) => {
  try {
    const {
      name,
      phone,
      companyName,
      email,
      source,
      stage,
      priority,
      estimatedValue,
      requirement,
      notes,
      followUpDate,
      assignedTo,
      companyEntity
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'Customer Name and Phone Number are required.' });
    }

    const newLead = new Lead({
      name: String(name).trim(),
      phone: String(phone).trim(),
      companyName: companyName ? String(companyName).trim() : '',
      email: email ? String(email).trim() : '',
      source: source || 'WhatsApp',
      stage: stage || 'New',
      priority: priority || 'Medium',
      estimatedValue: Number(estimatedValue) || 0,
      requirement: requirement ? String(requirement).trim() : '',
      notes: notes ? String(notes).trim() : '',
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      assignedTo: assignedTo || 'Unassigned',
      companyEntity: companyEntity || 'Elite Digital Print'
    });

    await newLead.save();

    return res.status(201).json({
      success: true,
      message: 'Lead created successfully',
      data: newLead
    });
  } catch (error) {
    console.error('Error in createLead:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Get leads list with filtering
const getLeads = async (req, res) => {
  try {
    const { stage, priority, search, companyEntity } = req.query;
    const filter = {};

    if (companyEntity) {
      filter.companyEntity = companyEntity;
    }

    if (stage && stage !== 'All') {
      filter.stage = stage;
    }

    if (priority && priority !== 'All') {
      filter.priority = priority;
    }

    if (search && String(search).trim()) {
      const sRegex = new RegExp(String(search).trim(), 'i');
      filter.$or = [
        { name: sRegex },
        { phone: sRegex },
        { companyName: sRegex },
        { email: sRegex },
        { requirement: sRegex },
        { notes: sRegex }
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

module.exports = {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  deleteLead
};
