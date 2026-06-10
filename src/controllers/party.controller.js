const db = require('../db/models');
const logger = require('../config/logger');

const createParty = async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Party name is required' });
    }

    const existingParty = await db.Party.findOne({ name: name.trim() });
    if (existingParty) {
      return res.status(400).json({ error: 'Party with this name already exists' });
    }

    const newParty = await db.Party.create({
      name: name.trim(),
      phone: phone || '',
      address: address || '',
    });

    res.status(201).json(newParty);
  } catch (error) {
    logger.error('Error creating party: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const getPartys = async (req, res) => {
  try {
    const { search } = req.query;
    const whereClause = {};

    if (search) {
      whereClause.name = new RegExp(search, 'i');
    }

    const partys = await db.Party.find(whereClause)
      .sort({ name: 1 })
      .lean();

    res.json(partys.map(p => ({ ...p, id: p._id.toString() })));
  } catch (error) {
    logger.error('Error fetching partys: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const updateParty = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.name) {
      updates.name = updates.name.trim();
      const existingParty = await db.Party.findOne({ name: updates.name, _id: { $ne: id } });
      if (existingParty) {
        return res.status(400).json({ error: 'Party with this name already exists' });
      }
    }

    const updatedParty = await db.Party.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    if (!updatedParty) {
      return res.status(404).json({ error: 'Party not found' });
    }

    res.json(updatedParty);
  } catch (error) {
    logger.error('Error updating party: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const deleteParty = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedParty = await db.Party.findByIdAndDelete(id);

    if (!deletedParty) {
      return res.status(404).json({ error: 'Party not found' });
    }

    res.json({ message: 'Party deleted successfully', id });
  } catch (error) {
    logger.error('Error deleting party: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

module.exports = {
  createParty,
  getPartys,
  updateParty,
  deleteParty,
};
