const express = require('express');
const companyController = require('../../controllers/company.controller');
const { companyScope } = require('../../middlewares/companyScope');

const router = express.Router();

// Apply companyScope middleware
router.use(companyScope);

router.post('/switch', companyController.switchCompany);
router.get('/permitted', companyController.getPermittedCompanies);
router.get('/summary', companyController.getSuperAdminSummary);
router.get('/activity-logs', companyController.getActivityLogs);

module.exports = router;
