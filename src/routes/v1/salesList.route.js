const express = require('express');
const {
  getSalseList,
  saveCsvData,
  dropTable,
} = require('../../controllers/salesList.controller');
const router = express.Router();
router.route('/getData').get(getSalseList);
router.route('/save').get(saveCsvData);
router.route('/drop').get(dropTable);

module.exports = router;
