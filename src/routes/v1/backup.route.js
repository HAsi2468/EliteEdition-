const express = require('express');
const backupController = require('../../controllers/backup.controller');

const router = express.Router();

router.get('/download', backupController.getDepartmentBackup);
router.post('/trigger-r2', backupController.triggerR2Backup);
router.get('/list-r2', backupController.listR2Backups);

// Automated Daily Backup endpoints (Database & Images)
router.get('/history', backupController.listDailyBackups);
router.get('/download-archive/:fileName', backupController.downloadDailyBackupArchive);
router.get('/images-history', backupController.listImagesBackups);
router.get('/download-images-archive/:fileName', backupController.downloadImagesBackupArchive);
router.post('/send-email', backupController.triggerSendBackupEmail);

module.exports = router;

