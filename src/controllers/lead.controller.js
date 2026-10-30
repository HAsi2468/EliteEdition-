const Lead = require('../db/models/lead.model');
const { syncProfileFromLead } = require('./customerProfile.controller');

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
      city,
      address,
      gstin,
      customerType,
      companyEntity
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'Customer Name and Phone Number are required.' });
    }

    const cleanPhone = String(phone).replace(/[\s\-\(\)\+]/g, '');
    if (!/^\d{10,12}$/.test(cleanPhone)) {
      return res.status(400).json({ success: false, error: 'Phone number must be a valid 10 to 12 digit number.' });
    }

    if (estimatedValue != null && !isNaN(Number(estimatedValue)) && Number(estimatedValue) < 0) {
      return res.status(400).json({ success: false, error: 'Estimated deal value cannot be negative.' });
    }

    if (gstin && String(gstin).trim()) {
      const cleanGstin = String(gstin).trim().toUpperCase();
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(cleanGstin)) {
        return res.status(400).json({ success: false, error: 'Invalid GSTIN format (Expected 15-character format e.g. 24AAAAA0000A1Z5).' });
      }
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
      city: city ? String(city).trim() : '',
      address: address ? String(address).trim() : '',
      gstin: gstin ? String(gstin).trim() : '',
      customerType: customerType || 'Boutique / Designer',
      companyEntity: companyEntity || 'Elite Digital Print'
    });

    await newLead.save();

    // Automatically sync / create Person Profile in Customer Directory
    try {
      await syncProfileFromLead(newLead);
    } catch (syncErr) {
      console.error('Warning: Error auto-syncing customer profile:', syncErr);
    }

    return res.status(201).json({
      success: true,
      message: 'Lead created successfully and customer profile synced',
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
    const { phone, estimatedValue, gstin } = req.body;
    if (phone) {
      const cleanPhone = String(phone).replace(/[\s\-\(\)\+]/g, '');
      if (!/^\d{10,12}$/.test(cleanPhone)) {
        return res.status(400).json({ success: false, error: 'Phone number must be a valid 10 to 12 digit number.' });
      }
    }
    if (estimatedValue != null && !isNaN(Number(estimatedValue)) && Number(estimatedValue) < 0) {
      return res.status(400).json({ success: false, error: 'Estimated deal value cannot be negative.' });
    }
    if (gstin && String(gstin).trim()) {
      const cleanGstin = String(gstin).trim().toUpperCase();
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(cleanGstin)) {
        return res.status(400).json({ success: false, error: 'Invalid GSTIN format (Expected 15-character format e.g. 24AAAAA0000A1Z5).' });
      }
    }

    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found.' });
    }

    try {
      await syncProfileFromLead(lead);
    } catch (syncErr) {
      console.error('Warning: Error syncing profile on lead update:', syncErr);
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
