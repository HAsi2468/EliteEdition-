const express = require('express');
const signedDocumentController = require('../../controllers/signedDocument.controller');

const router = express.Router();

// 1. Upload signed copy (up to 2 images)
router.post('/upload', signedDocumentController.uploadSignedCopy);

// 2. Get signed documents for review / queue
router.get('/approvals', signedDocumentController.getSignedDocuments);

// 3. Approve or reject signed document (admin only)
router.patch('/:docType/:id/approval', signedDocumentController.updateApprovalStatus);

module.exports = router;
