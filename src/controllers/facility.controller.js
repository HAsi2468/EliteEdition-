const db = require('../db/models');
const logger = require('../config/logger');

const DEFAULT_FACILITIES = [
  { name: 'Main Facility', code: 'MAIN', address: 'Main Warehouse', isDefault: true },
  { name: 'Pramukh Park', code: 'PP', address: 'Pramukh Park Godown', isDefault: false }
];

const getFacilities = async (req, res) => {
  try {
    let facilities = await db.Facility.find().sort({ isDefault: -1, name: 1 }).lean();

    // Auto-seed initial facilities if none exist
    if (!facilities || facilities.length === 0) {
      logger.info('[FACILITY] No facilities found, seeding defaults...');
      await db.Facility.insertMany(DEFAULT_FACILITIES);
      facilities = await db.Facility.find().sort({ isDefault: -1, name: 1 }).lean();
    }

    res.json(facilities.map(f => ({ ...f, id: f._id.toString() })));
  } catch (error) {
    logger.error('[FACILITY] Error fetching facilities: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const createFacility = async (req, res) => {
  try {
    const { name, code, address, contactPerson, phone, isDefault } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Facility name is required' });
    }

    const cleanName = name.trim();
    const existing = await db.Facility.findOne({ 
      name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
    });

    if (existing) {
      return res.status(400).json({ error: `Facility "${cleanName}" already exists.` });
    }

    if (isDefault) {
      await db.Facility.updateMany({}, { $set: { isDefault: false } });
    }

    const newFacility = await db.Facility.create({
      name: cleanName,
      code: code ? code.trim().toUpperCase() : '',
      address: address ? address.trim() : '',
      contactPerson: contactPerson ? contactPerson.trim() : '',
      phone: phone ? phone.trim() : '',
      isDefault: Boolean(isDefault),
    });

    logger.info(`[FACILITY] Created facility: ${newFacility.name} (${newFacility._id})`);
    res.status(201).json({ ...newFacility.toObject(), id: newFacility._id.toString() });
  } catch (error) {
    logger.error('[FACILITY] Error creating facility: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const updateFacility = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, address, contactPerson, phone, isDefault } = req.body;

    const updates = {};
    if (name !== undefined) {
      const cleanName = name.trim();
      if (!cleanName) {
        return res.status(400).json({ error: 'Facility name cannot be empty' });
      }
      const existing = await db.Facility.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
      if (existing) {
        return res.status(400).json({ error: `Facility "${cleanName}" already exists.` });
      }
      updates.name = cleanName;
    }

    if (code !== undefined) updates.code = code.trim().toUpperCase();
    if (address !== undefined) updates.address = address.trim();
    if (contactPerson !== undefined) updates.contactPerson = contactPerson.trim();
    if (phone !== undefined) updates.phone = phone.trim();

    if (isDefault) {
      await db.Facility.updateMany({ _id: { $ne: id } }, { $set: { isDefault: false } });
      updates.isDefault = true;
    } else if (isDefault !== undefined) {
      updates.isDefault = false;
    }

    const updated = await db.Facility.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Facility not found' });
    }

    logger.info(`[FACILITY] Updated facility: ${updated.name} (${updated._id})`);
    res.json({ ...updated.toObject(), id: updated._id.toString() });
  } catch (error) {
    logger.error('[FACILITY] Error updating facility: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const deleteFacility = async (req, res) => {
  try {
    const { id } = req.params;
    const count = await db.Facility.countDocuments();
    if (count <= 1) {
      return res.status(400).json({ error: 'At least one storage facility must remain in the system.' });
    }

    const deleted = await db.Facility.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Facility not found' });
    }

    logger.info(`[FACILITY] Deleted facility: ${deleted.name} (${deleted._id})`);
    res.json({ success: true, message: `Facility "${deleted.name}" deleted successfully.`, id });
  } catch (error) {
    logger.error('[FACILITY] Error deleting facility: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const seedFacilitiesOnStartup = async () => {
  try {
    const count = await db.Facility.countDocuments();
    if (count === 0) {
      logger.info('[FACILITY] No facilities found, auto-seeding defaults on startup...');
      await db.Facility.insertMany(DEFAULT_FACILITIES);
      logger.info('[FACILITY] ✅ Default facilities successfully seeded.');
    }
  } catch (error) {
    logger.error('[FACILITY] Error auto-seeding facilities on startup: %o', error);
  }
};

module.exports = {
  getFacilities,
  createFacility,
  updateFacility,
  deleteFacility,
  seedFacilitiesOnStartup,
  DEFAULT_FACILITIES,
};
