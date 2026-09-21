const Client = require('../db/models/client.model');

/**
 * Get all clients with search and filter
 */
const getClients = async (req, res) => {
  try {
    const { search, companyCode, status, page = 1, limit = 100 } = req.query;
    const query = {};

    if (companyCode && companyCode !== 'All') {
      query.companyCode = companyCode;
    }

    if (status && status !== 'All') {
      query.status = status;
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { username: { $regex: term, $options: 'i' } },
        { mobile: { $regex: term, $options: 'i' } },
        { companyName: { $regex: term, $options: 'i' } },
        { companyCode: { $regex: term, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 100;
    const skip = (pageNum - 1) * limitNum;

    const total = await Client.countDocuments(query);
    const clients = await Client.find(query)
      .sort({ created_date_time: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      data: clients,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch clients', error: error.message });
  }
};

/**
 * Get single client by ID
 */
const getClientById = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    res.json({ success: true, data: client });
  } catch (error) {
    console.error('Error fetching client details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch client details', error: error.message });
  }
};

/**
 * Create a new client
 */
const createClient = async (req, res) => {
  try {
    const {
      username,
      mobile,
      companyName,
      companyCode,
      password,
      image = '',
      status = 'Active',
      notes = '',
    } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }
    if (!mobile || !mobile.trim()) {
      return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }
    if (!companyName || !companyName.trim()) {
      return res.status(400).json({ success: false, message: 'Company name is required' });
    }
    if (!companyCode || !companyCode.trim()) {
      return res.status(400).json({ success: false, message: 'Company code is required' });
    }
    if (!password || !password.trim()) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    // Check if username already exists
    const existing = await Client.findOne({
      username: { $regex: new RegExp(`^${username.trim()}$`, 'i') },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: `Username "${username.trim()}" is already registered` });
    }

    const client = await Client.create({
      username: username.trim(),
      mobile: mobile.trim(),
      companyName: companyName.trim(),
      companyCode: companyCode.trim(),
      password: password.trim(),
      image: (image || '').trim(),
      status: status || 'Active',
      notes: (notes || '').trim(),
    });

    res.status(201).json({ success: true, data: client, message: 'Client created successfully' });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ success: false, message: 'Failed to create client', error: error.message });
  }
};

/**
 * Update client details
 */
const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      username,
      mobile,
      companyName,
      companyCode,
      password,
      image,
      status,
      notes,
    } = req.body;

    const client = await Client.findById(id);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    if (username && username.trim() !== client.username) {
      const existing = await Client.findOne({
        _id: { $ne: id },
        username: { $regex: new RegExp(`^${username.trim()}$`, 'i') },
      });
      if (existing) {
        return res.status(400).json({ success: false, message: `Username "${username.trim()}" is already taken` });
      }
      client.username = username.trim();
    }

    if (mobile !== undefined) client.mobile = mobile.trim();
    if (companyName !== undefined) client.companyName = companyName.trim();
    if (companyCode !== undefined) client.companyCode = companyCode.trim();
    if (password && password.trim()) client.password = password.trim();
    if (image !== undefined) client.image = (image || '').trim();
    if (status !== undefined) client.status = status;
    if (notes !== undefined) client.notes = (notes || '').trim();
    client.modified_date_time = new Date();

    await client.save();

    res.json({ success: true, data: client, message: 'Client updated successfully' });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ success: false, message: 'Failed to update client', error: error.message });
  }
};

/**
 * Delete a client
 */
const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Client.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    res.json({ success: true, message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ success: false, message: 'Failed to delete client', error: error.message });
  }
};

module.exports = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
};
