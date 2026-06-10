const db = require('../db/models');
const logger = require('../config/logger');

const createVendor = async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Vendor name is required' });
    }

    const existingVendor = await db.Vendor.findOne({ name: name.trim() });
    if (existingVendor) {
      return res.status(400).json({ error: 'Vendor with this name already exists' });
    }

    const newVendor = await db.Vendor.create({
      name: name.trim(),
      phone: phone || '',
      address: address || '',
    });

    res.status(201).json(newVendor);
  } catch (error) {
    logger.error('Error creating vendor: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const getVendors = async (req, res) => {
  try {
    const { search } = req.query;
    const whereClause = {};

    if (search) {
      whereClause.name = new RegExp(search, 'i');
    }

    const vendors = await db.Vendor.find(whereClause)
      .sort({ name: 1 })
      .lean();

    res.json(vendors.map(p => ({ ...p, id: p._id.toString() })));
  } catch (error) {
    logger.error('Error fetching vendors: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const updateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.name) {
      updates.name = updates.name.trim();
      const existingVendor = await db.Vendor.findOne({ name: updates.name, _id: { $ne: id } });
      if (existingVendor) {
        return res.status(400).json({ error: 'Vendor with this name already exists' });
      }
    }

    const updatedVendor = await db.Vendor.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    if (!updatedVendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    res.json(updatedVendor);
  } catch (error) {
    logger.error('Error updating vendor: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const deleteVendor = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedVendor = await db.Vendor.findByIdAndDelete(id);

    if (!deletedVendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    res.json({ message: 'Vendor deleted successfully', id });
  } catch (error) {
    logger.error('Error deleting vendor: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

module.exports = {
  createVendor,
  getVendors,
  updateVendor,
  deleteVendor,
};
