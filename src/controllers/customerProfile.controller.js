const CustomerProfile = require('../db/models/customerProfile.model');
const Lead = require('../db/models/lead.model');

// Helper to normalize phone numbers (extract last 10 digits)
const normalizePhone = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/[^0-9]/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

/**
 * Auto-syncs or creates a CustomerProfile from a Lead record
 */
const syncProfileFromLead = async (leadData) => {
  if (!leadData || !leadData.phone) return null;

  try {
    const rawPhone = String(leadData.phone).trim();
    const cleanPhone = normalizePhone(rawPhone);
    const companyEntity = leadData.companyEntity || 'Elite Digital Print';

    // Search by normalized phone or exact phone
    let profile = await CustomerProfile.findOne({
      companyEntity,
      $or: [
        { normalizedPhone: cleanPhone },
        { phone: rawPhone },
      ],
    });

    const isConfirmedOrder = leadData.stage === 'Order Confirmed';
    const leadValue = Number(leadData.estimatedValue) || 0;

    const leadEntry = {
      leadId: leadData._id,
      date: leadData.createdAt || new Date(),
      stage: leadData.stage || 'New',
      requirement: leadData.requirement || '',
      estimatedValue: leadValue,
      notes: leadData.notes || '',
      source: leadData.source || 'WhatsApp',
    };

    if (profile) {
      // Update existing profile with new/latest information
      if (leadData.name && (!profile.name || profile.name === 'Unknown')) {
        profile.name = String(leadData.name).trim();
      }
      if (leadData.companyName && !profile.companyName) {
        profile.companyName = String(leadData.companyName).trim();
      }
      if (leadData.email && !profile.email) {
        profile.email = String(leadData.email).trim();
      }
      if (leadData.city && !profile.city) {
        profile.city = String(leadData.city).trim();
      }
      if (leadData.address && !profile.address) {
        profile.address = String(leadData.address).trim();
      }
      if (leadData.customerType && profile.customerType === 'Boutique / Designer') {
        profile.customerType = leadData.customerType;
      }
      if (leadData.requirement) {
        profile.latestRequirement = String(leadData.requirement).trim();
      }

      // Check if leadId is already in leadHistory
      const existingHistoryIndex = profile.leadHistory.findIndex(
        (h) => h.leadId && leadData._id && String(h.leadId) === String(leadData._id)
      );

      if (existingHistoryIndex >= 0) {
        profile.leadHistory[existingHistoryIndex] = leadEntry;
      } else {
        profile.leadHistory.unshift(leadEntry);
        profile.totalInquiries = (profile.totalInquiries || 0) + 1;
        profile.totalValue = (profile.totalValue || 0) + leadValue;
      }

      if (isConfirmedOrder) {
        profile.totalOrders = (profile.totalOrders || 0) + 1;
        if (profile.status !== 'VIP Client') {
          profile.status = 'Active';
        }
      }

      if (profile.totalValue > 100000 || profile.totalOrders >= 5) {
        profile.status = 'VIP Client';
      }

      await profile.save();
      return profile;
    } else {
      // Create fresh customer profile auto-populated from this lead
      const newProfile = new CustomerProfile({
        name: String(leadData.name).trim(),
        phone: rawPhone,
        normalizedPhone: cleanPhone,
        companyName: leadData.companyName ? String(leadData.companyName).trim() : '',
        email: leadData.email ? String(leadData.email).trim() : '',
        city: leadData.city ? String(leadData.city).trim() : '',
        address: leadData.address ? String(leadData.address).trim() : '',
        gstin: leadData.gstin ? String(leadData.gstin).trim() : '',
        customerType: leadData.customerType || 'Boutique / Designer',
        status: isConfirmedOrder ? 'Active' : 'Lead',
        source: leadData.source || 'WhatsApp',
        totalInquiries: 1,
        totalOrders: isConfirmedOrder ? 1 : 0,
        totalValue: leadValue,
        latestRequirement: leadData.requirement ? String(leadData.requirement).trim() : '',
        notes: leadData.notes ? String(leadData.notes).trim() : '',
        assignedTo: leadData.assignedTo || 'Unassigned',
        companyEntity,
        leadHistory: [leadEntry],
      });

      await newProfile.save();
      return newProfile;
    }
  } catch (err) {
    console.error('Error auto-syncing customer profile from lead:', err);
    return null;
  }
};

/**
 * Sync all existing leads into customer profiles (one-time or on-demand)
 */
const syncAllFromLeads = async (req, res) => {
  try {
    const leads = await Lead.find({}).sort({ createdAt: 1 });
    let createdOrUpdated = 0;

    for (const lead of leads) {
      const p = await syncProfileFromLead(lead);
      if (p) createdOrUpdated++;
    }

    const totalProfiles = await CustomerProfile.countDocuments({});

    return res.status(200).json({
      success: true,
      message: `Successfully processed ${leads.length} leads. Synced/updated ${createdOrUpdated} customer profiles.`,
      data: { totalProfiles, processedLeads: leads.length },
    });
  } catch (error) {
    console.error('Error syncing all leads to profiles:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get customer profiles list with search, filter, and stats
 */
const getCustomerProfiles = async (req, res) => {
  try {
    const {
      search,
      status,
      customerType,
      city,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      companyEntity = 'Elite Digital Print',
    } = req.query;

    // Check if profiles are empty; if so, auto-populate from existing leads
    const count = await CustomerProfile.countDocuments({ companyEntity });
    if (count === 0) {
      const existingLeads = await Lead.find({ companyEntity });
      if (existingLeads.length > 0) {
        for (const lead of existingLeads) {
          await syncProfileFromLead(lead);
        }
      }
    }

    const filter = { companyEntity };

    if (status && status !== 'All') {
      filter.status = status;
    }

    if (customerType && customerType !== 'All') {
      filter.customerType = customerType;
    }

    if (city && city !== 'All') {
      filter.city = new RegExp(city.trim(), 'i');
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { phone: searchRegex },
        { companyName: searchRegex },
        { email: searchRegex },
        { city: searchRegex },
        { latestRequirement: searchRegex },
      ];
    }

    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const profiles = await CustomerProfile.find(filter).sort(sortObj);

    // Compute aggregated KPI stats
    const allProfiles = await CustomerProfile.find({ companyEntity });
    const stats = {
      total: allProfiles.length,
      active: allProfiles.filter((p) => p.status === 'Active').length,
      leads: allProfiles.filter((p) => p.status === 'Lead').length,
      vip: allProfiles.filter((p) => p.status === 'VIP Client').length,
      inactive: allProfiles.filter((p) => p.status === 'Inactive').length,
      totalPipelineValue: allProfiles.reduce((sum, p) => sum + (Number(p.totalValue) || 0), 0),
      totalOrders: allProfiles.reduce((sum, p) => sum + (Number(p.totalOrders) || 0), 0),
    };

    return res.status(200).json({
      success: true,
      data: profiles,
      stats,
    });
  } catch (error) {
    console.error('Error fetching customer profiles:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get single customer profile by ID
 */
const getCustomerProfileById = async (req, res) => {
  try {
    const profile = await CustomerProfile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Customer profile not found.' });
    }
    return res.status(200).json({ success: true, data: profile });
  } catch (error) {
    console.error('Error fetching profile by ID:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Create customer profile manually
 */
const createCustomerProfile = async (req, res) => {
  try {
    const {
      name,
      phone,
      companyName,
      email,
      address,
      city,
      state,
      gstin,
      customerType,
      status,
      source,
      creditLimit,
      paymentTerms,
      notes,
      tags,
      assignedTo,
      companyEntity,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'Name and Phone number are required.' });
    }

    const rawPhone = String(phone).trim();
    const cleanPhone = normalizePhone(rawPhone);

    const newProfile = new CustomerProfile({
      name: String(name).trim(),
      phone: rawPhone,
      normalizedPhone: cleanPhone,
      companyName: companyName ? String(companyName).trim() : '',
      email: email ? String(email).trim() : '',
      address: address ? String(address).trim() : '',
      city: city ? String(city).trim() : '',
      state: state || 'Gujarat',
      gstin: gstin ? String(gstin).trim() : '',
      customerType: customerType || 'Boutique / Designer',
      status: status || 'Lead',
      source: source || 'Direct Visit',
      creditLimit: Number(creditLimit) || 0,
      paymentTerms: paymentTerms || 'Immediate / Advance',
      notes: notes ? String(notes).trim() : '',
      tags: Array.isArray(tags) ? tags : [],
      assignedTo: assignedTo || 'Unassigned',
      companyEntity: companyEntity || 'Elite Digital Print',
    });

    await newProfile.save();

    return res.status(201).json({
      success: true,
      message: 'Customer profile created successfully.',
      data: newProfile,
    });
  } catch (error) {
    console.error('Error creating customer profile:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Update customer profile
 */
const updateCustomerProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.phone) {
      updates.phone = String(updates.phone).trim();
      updates.normalizedPhone = normalizePhone(updates.phone);
    }

    const profile = await CustomerProfile.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!profile) {
      return res.status(404).json({ success: false, error: 'Customer profile not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Customer profile updated successfully.',
      data: profile,
    });
  } catch (error) {
    console.error('Error updating customer profile:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Add interaction / note log to customer profile
 */
const addInteractionLog = async (req, res) => {
  try {
    const { id } = req.params;
    const { type = 'Note', author = 'Admin', note } = req.body;

    if (!note || !String(note).trim()) {
      return res.status(400).json({ success: false, error: 'Interaction note cannot be empty.' });
    }

    const profile = await CustomerProfile.findById(id);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Customer profile not found.' });
    }

    profile.interactionLogs.unshift({
      date: new Date(),
      type,
      author,
      note: String(note).trim(),
    });

    await profile.save();

    return res.status(200).json({
      success: true,
      message: 'Interaction logged successfully.',
      data: profile,
    });
  } catch (error) {
    console.error('Error logging interaction:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Delete customer profile
 */
const deleteCustomerProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await CustomerProfile.findByIdAndDelete(id);

    if (!profile) {
      return res.status(404).json({ success: false, error: 'Customer profile not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Customer profile deleted successfully.',
    });
  } catch (error) {
    console.error('Error deleting customer profile:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  syncProfileFromLead,
  syncAllFromLeads,
  getCustomerProfiles,
  getCustomerProfileById,
  createCustomerProfile,
  updateCustomerProfile,
  addInteractionLog,
  deleteCustomerProfile,
};
