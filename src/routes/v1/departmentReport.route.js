const express = require('express');
const { getElitePrintReports } = require('../../controllers/departmentReport.controller');

const router = express.Router();

router.get('/elite-print', getElitePrintReports);

module.exports = router;
