const express = require('express');
const backupController = require('../../controllers/backup.controller');

const router = express.Router();

router.get('/download', backupController.getDepartmentBackup);

module.exports = router;
