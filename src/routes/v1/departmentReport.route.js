const express = require('express');
const { getElitePrintReports, downloadElitePrintPdf } = require('../../controllers/departmentReport.controller');

const router = express.Router();

router.get('/elite-print', getElitePrintReports);
router.get('/elite-print/pdf', downloadElitePrintPdf);

module.exports = router;
