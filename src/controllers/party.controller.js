const db = require('../db/models');
const logger = require('../config/logger');

let partiesCache = null;
let partiesCacheTime = 0;
const PARTIES_CACHE_TTL = 60 * 1000;

const invalidatePartiesCache = () => {
  partiesCache = null;
  partiesCacheTime = 0;
};

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

    invalidatePartiesCache();
    res.status(201).json(newParty);
  } catch (error) {
    logger.error('Error creating party: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const getPartys = async (req, res) => {
  try {
    const { search, limit, page } = req.query;
    
    // Serve from cache if no search filter and cache is valid
    if (!search && partiesCache && (Date.now() - partiesCacheTime < PARTIES_CACHE_TTL)) {
      return res.json(partiesCache);
    }

    const whereClause = {};

    if (search) {
      whereClause.name = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    const limitNum = limit ? Math.min(parseInt(limit, 10) || 100, 500) : 0;
    const pageNum = parseInt(page, 10) || 1;
    const skipNum = limitNum > 0 ? (pageNum - 1) * limitNum : 0;

    let query = db.Party.find(whereClause)
      .sort({ name: 1 })
      .lean();

    if (skipNum > 0) query = query.skip(skipNum);
    if (limitNum > 0) query = query.limit(limitNum);

    const partys = await query;
    const result = partys.map(p => ({ ...p, id: p._id.toString() }));

    if (!search && (!limit || limitNum >= 100)) {
      partiesCache = result;
      partiesCacheTime = Date.now();
    }

    res.json(result);
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

    invalidatePartiesCache();
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

    invalidatePartiesCache();
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
