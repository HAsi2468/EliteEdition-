const db = require('../db/models');
const logger = require('../config/logger');

const createFabricVendor = async (req, res) => {
  try {
    const { name, businessName, phone, gstin, address } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Vendor name is required' });
    }

    const newVendor = await db.FabricVendor.create({
      name: name.trim(),
      businessName: businessName ? businessName.trim() : '',
      phone: phone || '',
      gstin: gstin || '',
      address: address || '',
    });

    res.status(201).json(newVendor);
  } catch (error) {
    logger.error('Error creating fabric vendor: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const getFabricVendors = async (req, res) => {
  try {
    const { search } = req.query;
    const whereClause = {};

    if (search) {
      whereClause.name = new RegExp(search, 'i');
    }

    const vendors = await db.FabricVendor.find(whereClause)
      .sort({ name: 1 })
      .lean();

    res.json(vendors.map(p => ({ ...p, id: p._id.toString() })));
  } catch (error) {
    logger.error('Error fetching fabric vendors: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const updateFabricVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.name) {
      updates.name = updates.name.trim();
      const existingVendor = await db.FabricVendor.findOne({ name: updates.name, _id: { $ne: id } });
      if (existingVendor) {
        return res.status(400).json({ error: 'Fabric Vendor with this name already exists' });
      }
    }

    const updatedVendor = await db.FabricVendor.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    if (!updatedVendor) {
      return res.status(404).json({ error: 'Fabric Vendor not found' });
    }

    res.json(updatedVendor);
  } catch (error) {
    logger.error('Error updating fabric vendor: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const deleteFabricVendor = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedVendor = await db.FabricVendor.findByIdAndDelete(id);

    if (!deletedVendor) {
      return res.status(404).json({ error: 'Fabric Vendor not found' });
    }

    res.json({ message: 'Fabric Vendor deleted successfully', id });
  } catch (error) {
    logger.error('Error deleting fabric vendor: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

module.exports = {
  createFabricVendor,
  getFabricVendors,
  updateFabricVendor,
  deleteFabricVendor,
};
