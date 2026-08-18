const express = require('express');
const billingController = require('../../controllers/billing.controller');

const router = express.Router();

// Dashboard Stats
router.get('/dashboard-stats', billingController.getBillingDashboardStats);

// Invoices CRUD & Payment
router.get('/invoices', billingController.getInvoices);
router.get('/invoices/next-no', billingController.getNextInvoiceNo);
router.get('/invoices/:id', billingController.getInvoiceById);
router.post('/invoices', billingController.createInvoice);
router.post('/merge-challans', billingController.mergeChallans);
router.put('/invoices/:id', billingController.updateInvoice);
router.delete('/invoices/:id', billingController.deleteInvoice);
router.post('/invoices/:id/payment', billingController.recordPayment);
router.get('/invoices-bulk-pdf', billingController.downloadBulkInvoicesPdf);
router.post('/invoices-bulk-pdf', billingController.downloadBulkInvoicesPdf);
router.get('/invoices/:id/pdf', billingController.downloadInvoicePdf);

// Customers CRUD
router.get('/customers', billingController.getCustomers);
router.post('/customers', billingController.createCustomer);
router.put('/customers/:id', billingController.updateCustomer);
router.delete('/customers/:id', billingController.deleteCustomer);

// Items CRUD
router.get('/items', billingController.getItems);
router.post('/items', billingController.createItem);
router.put('/items/:id', billingController.updateItem);
router.delete('/items/:id', billingController.deleteItem);

// Company Settings CRUD
router.get('/company-settings', billingController.getCompanySettings);
router.put('/company-settings', billingController.updateCompanySettings);

module.exports = router;
