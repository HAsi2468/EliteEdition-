const express = require('express');
const { SaleOrder } = require('../../db/models');
const router = express.Router();
router.get('/clear', async (req, res) => {
  await SaleOrder.deleteMany({});
  res.json({ success: true, message: "Cleared SaleOrder" });
});
module.exports = router;
