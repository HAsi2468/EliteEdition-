const express = require('express');
const backupController = require('../../controllers/backup.controller');

const router = express.Router();

router.get('/download', backupController.getDepartmentBackup);
router.post('/trigger-r2', backupController.triggerR2Backup);
router.get('/list-r2', backupController.listR2Backups);

module.exports = router;

