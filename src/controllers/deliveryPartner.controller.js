const db = require('../db/models');
const logger = require('../config/logger');

const createDeliveryPartner = async (req, res) => {
  try {
    const { name, phone, address, parties } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'DeliveryPartner name is required' });
    }

    const existingDeliveryPartner = await db.DeliveryPartner.findOne({ name: name.trim() });
    if (existingDeliveryPartner) {
      return res.status(400).json({ error: 'DeliveryPartner with this name already exists' });
    }

    const newDeliveryPartner = await db.DeliveryPartner.create({
      name: name.trim(),
      phone: phone || '',
      address: address || '',
      parties: parties || [],
    });

    res.status(201).json(newDeliveryPartner);
  } catch (error) {
    logger.error('Error creating deliveryPartner: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const getDeliveryPartners = async (req, res) => {
  try {
    const { search } = req.query;
    const whereClause = {};

    if (search) {
      whereClause.name = new RegExp(search, 'i');
    }

    const deliveryPartners = await db.DeliveryPartner.find(whereClause)
      .sort({ name: 1 })
      .lean();

    res.json(deliveryPartners.map(p => ({ ...p, id: p._id.toString() })));
  } catch (error) {
    logger.error('Error fetching deliveryPartners: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const updateDeliveryPartner = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.name) {
      updates.name = updates.name.trim();
      const existingDeliveryPartner = await db.DeliveryPartner.findOne({ name: updates.name, _id: { $ne: id } });
      if (existingDeliveryPartner) {
        return res.status(400).json({ error: 'DeliveryPartner with this name already exists' });
      }
    }

    const updatedDeliveryPartner = await db.DeliveryPartner.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    if (!updatedDeliveryPartner) {
      return res.status(404).json({ error: 'DeliveryPartner not found' });
    }

    res.json(updatedDeliveryPartner);
  } catch (error) {
    logger.error('Error updating deliveryPartner: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const deleteDeliveryPartner = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedDeliveryPartner = await db.DeliveryPartner.findByIdAndDelete(id);

    if (!deletedDeliveryPartner) {
      return res.status(404).json({ error: 'DeliveryPartner not found' });
    }

    res.json({ message: 'DeliveryPartner deleted successfully', id });
  } catch (error) {
    logger.error('Error deleting deliveryPartner: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

module.exports = {
  createDeliveryPartner,
  getDeliveryPartners,
  updateDeliveryPartner,
  deleteDeliveryPartner,
};
