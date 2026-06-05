const db = require('../db/models');
const logger = require('../config/logger');

const createInventory = async (req, res) => {
  try {
    const { party, itemName, size, currentlyAvailableStock, salePrice, purchasePrice, qty, imageUrl, skuCode } = req.body;
    
    if (!party || !itemName || !size) {
      return res.status(400).json({ error: 'Party, Item Name, and Size are required' });
    }

    const newItem = await db.Inventory.create({
      party,
      itemName,
      size,
      currentlyAvailableStock: currentlyAvailableStock || 0,
      salePrice: salePrice || 0.0,
      purchasePrice: purchasePrice || 0.0,
      qty: qty || 0,
      imageUrl: imageUrl || '',
      skuCode: skuCode || '',
    });

    res.status(201).json(newItem);
  } catch (error) {
    logger.error('Error creating inventory item: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const getInventory = async (req, res) => {
  try {
    const { search } = req.query;
    const whereClause = {};

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      whereClause.$or = [
        { party: searchRegex },
        { itemName: searchRegex },
        { size: searchRegex }
      ];
    }

    const items = await db.Inventory.find(whereClause)
      .sort({ created_date_time: -1 })
      .lean();

    res.json(items.map(item => ({ ...item, id: item._id.toString() })));
  } catch (error) {
    logger.error('Error fetching inventory items: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const updateInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedItem = await db.Inventory.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    if (!updatedItem) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    res.json(updatedItem);
  } catch (error) {
    logger.error('Error updating inventory item: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const deleteInventory = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedItem = await db.Inventory.findByIdAndDelete(id);

    if (!deletedItem) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    res.json({ message: 'Inventory item deleted successfully', id });
  } catch (error) {
    logger.error('Error deleting inventory item: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

module.exports = {
  createInventory,
  getInventory,
  updateInventory,
  deleteInventory,
};
