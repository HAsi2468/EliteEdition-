const db = require('../db/models');
const logger = require('../config/logger');

const createInventory = async (req, res) => {
  try {
    if (Array.isArray(req.body)) {
      logger.info(`[INVENTORY] Bulk create request — ${req.body.length} items`);
      const itemsToCreate = req.body.map(item => {
        const { party, itemName, size, currentlyAvailableStock, salePrice, purchasePrice, qty, imageUrl, skuCode, date } = item;
        if (!party || !itemName || !size) {
          throw new Error('Party, Item Name, and Size are required for all bulk items');
        }
        return {
          party,
          itemName,
          size,
          currentlyAvailableStock: currentlyAvailableStock || 0,
          salePrice: salePrice || 0.0,
          purchasePrice: purchasePrice || 0.0,
          qty: qty || 0,
          imageUrl: imageUrl || '',
          skuCode: skuCode || '',
          date: date || new Date(),
        };
      });

      const createdItems = await db.Inventory.insertMany(itemsToCreate);
      logger.info(`[INVENTORY] ✅ Bulk created ${createdItems.length} items successfully`);
      createdItems.forEach((item, i) => {
        logger.info(`[INVENTORY]   [${i + 1}] Party: "${item.party}" | Item: "${item.itemName}" | Size: ${item.size} | Qty: ${item.qty} | Date: ${item.date ? new Date(item.date).toLocaleDateString('en-IN') : 'N/A'}`);
      });
      return res.status(201).json(createdItems);
    }

    const { party, itemName, size, currentlyAvailableStock, salePrice, purchasePrice, qty, imageUrl, skuCode, date } = req.body;
    logger.info(`[INVENTORY] Create request — Party: "${party}" | Item: "${itemName}" | Size: ${size} | Qty: ${qty} | Date: ${date || 'now'}`);

    if (!party || !itemName || !size) {
      logger.warn(`[INVENTORY] Validation failed — Party, Item Name, Size required`);
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
      date: date || new Date(),
    });

    logger.info(`[INVENTORY] ✅ Created — ID: ${newItem._id} | Party: "${newItem.party}" | Item: "${newItem.itemName}" | Size: ${newItem.size} | Qty: ${newItem.qty} | Buy: Rs.${newItem.purchasePrice} | Sell: Rs.${newItem.salePrice}`);
    res.status(201).json(newItem);
  } catch (error) {
    logger.error('[INVENTORY] Error creating inventory item: %o', error);
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
      logger.info(`[INVENTORY] GET — Search: "${search}"`);
    } else {
      logger.info(`[INVENTORY] GET — Fetching all inventory items`);
    }

    const items = await db.Inventory.find(whereClause)
      .sort({ created_date_time: -1 })
      .lean();

    logger.info(`[INVENTORY] ✅ Returned ${items.length} item(s)`);
    res.json(items.map(item => ({ ...item, id: item._id.toString() })));
  } catch (error) {
    logger.error('[INVENTORY] Error fetching inventory items: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const updateInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    logger.info(`[INVENTORY] Update request — ID: ${id} | Fields: ${Object.keys(updates).join(', ')}`);

    const updatedItem = await db.Inventory.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    if (!updatedItem) {
      logger.warn(`[INVENTORY] Update failed — Item not found: ${id}`);
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    logger.info(`[INVENTORY] ✅ Updated — ID: ${updatedItem._id} | Party: "${updatedItem.party}" | Item: "${updatedItem.itemName}" | Size: ${updatedItem.size}`);
    res.json(updatedItem);
  } catch (error) {
    logger.error('[INVENTORY] Error updating inventory item: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const deleteInventory = async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`[INVENTORY] Delete request — ID: ${id}`);

    const deletedItem = await db.Inventory.findByIdAndDelete(id);

    if (!deletedItem) {
      logger.warn(`[INVENTORY] Delete failed — Item not found: ${id}`);
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    logger.info(`[INVENTORY] ✅ Deleted — ID: ${id} | Party: "${deletedItem.party}" | Item: "${deletedItem.itemName}" | Size: ${deletedItem.size}`);
    res.json({ message: 'Inventory item deleted successfully', id });
  } catch (error) {
    logger.error('[INVENTORY] Error deleting inventory item: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

module.exports = {
  createInventory,
  getInventory,
  updateInventory,
  deleteInventory,
};
