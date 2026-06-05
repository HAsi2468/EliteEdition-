const express = require('express');
const inventoryController = require('../../controllers/inventory.controller');

const router = express.Router();

router.route('/')
  .post(inventoryController.createInventory)
  .get(inventoryController.getInventory);

router.route('/:id')
  .put(inventoryController.updateInventory)
  .delete(inventoryController.deleteInventory);

module.exports = router;
