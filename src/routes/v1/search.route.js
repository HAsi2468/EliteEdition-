const express = require('express');
const { globalSearch } = require('../../controllers/search.controller');

const router = express.Router();

router.get('/global', globalSearch);

module.exports = router;
