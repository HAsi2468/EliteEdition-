const express = require('express');
const { getUniqueFilters } = require('../../controllers/filters.controller');
const router = express.Router();

router.get('/', getUniqueFilters);

module.exports = router;
