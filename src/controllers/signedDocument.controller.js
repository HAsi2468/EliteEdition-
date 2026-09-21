const FabricChallan = require('../db/models/fabricChallan.model');
const BillingInvoice = require('../db/models/billingInvoice.model');
const logger = require('../config/logger');

/**
 * 1. Upload signed copy (Regular staff / delivery users can upload up to 2 images)
 * Automatically sets status to 'PENDING'
 */
const uploadSignedCopy = async (req, res) => {
  try {
    const { docType, docId, images } = req.body;

    if (!docType || !['challan', 'invoice'].includes(docType)) {
      return res.status(400).json({ error: "Invalid docType. Must be 'challan' or 'invoice'" });
    }

    if (!docId) {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'Please provide at least 1 image' });
    }

    if (images.length > 2) {
      return res.status(400).json({ error: 'Maximum 2 images allowed for signed copy' });
    }

    const uploaderName = req.user?.name || req.headers['x-user-name'] || 'Staff User';
    const uploaderId = String(req.user?.id || req.user?._id || 'user');

    let doc = null;
    if (docType === 'challan') {
      doc = await FabricChallan.findById(docId);
    } else {
      doc = await BillingInvoice.findById(docId);
    }

    if (!doc) {
      return res.status(404).json({ error: `${docType === 'challan' ? 'Challan' : 'Invoice'} not found` });
    }

    doc.signedCopy = {
      images: images.slice(0, 2),
      status: 'PENDING',
      uploadedAt: new Date(),
      uploadedBy: uploaderId,
      uploadedByName: uploaderName,
      approvedAt: null,
      approvedBy: '',
      approvedByName: '',
      rejectionReason: ''
    };

    await doc.save();

    logger.info(`[SignedDocument] ${uploaderName} uploaded signed copy for ${docType} ${docId}`);

    return res.json({
      success: true,
      message: 'Signed copy uploaded successfully and submitted for Admin approval',
      signedCopy: doc.signedCopy
    });
  } catch (err) {
    logger.error('uploadSignedCopy error: %o', err);
    return res.status(500).json({ error: 'Internal Server Error: ' + err.message });
  }
};

/**
 * 2. Get Signed Documents for Admin Review Queue
 */
const getSignedDocuments = async (req, res) => {
  try {
    const { status = 'PENDING', docType = 'all', search = '' } = req.query;

    const statusFilter = status && status !== 'ALL' ? status : { $in: ['PENDING', 'APPROVED', 'REJECTED'] };

    // Queries
    const challanFilter = { 'signedCopy.status': statusFilter };
    const invoiceFilter = { 'signedCopy.status': statusFilter };

    if (search && search.trim()) {
      const sRegex = new RegExp(search.trim(), 'i');
      challanFilter.$or = [
        { partyName: sRegex },
        { jobNo: sRegex },
        { 'signedCopy.uploadedByName': sRegex }
      ];
      invoiceFilter.$or = [
        { invoiceNo: sRegex },
        { 'customer.name': sRegex },
        { ourChallanNo: sRegex },
        { 'signedCopy.uploadedByName': sRegex }
      ];
    }

    let challans = [];
    let invoices = [];

    if (docType === 'all' || docType === 'challan') {
      challans = await FabricChallan.find(challanFilter)
        .select('_id challanNo date partyName jobNo totalMtr signedCopy createdAt')
        .sort({ 'signedCopy.uploadedAt': -1 })
        .lean();
    }

    if (docType === 'all' || docType === 'invoice') {
      invoices = await BillingInvoice.find(invoiceFilter)
        .select('_id invoiceNo invoiceDate customer grandTotal ourChallanNo signedCopy created_at')
        .sort({ 'signedCopy.uploadedAt': -1 })
        .lean();
    }

    // Unify format
    const unified = [
      ...challans.map(c => ({
        _id: c._id,
        docType: 'challan',
        docNumber: `CH-${c.challanNo}`,
        partyName: c.partyName || '—',
        jobNo: c.jobNo || '',
        date: c.date,
        amountOrMtr: c.totalMtr ? `${c.totalMtr} mtr` : '—',
        signedCopy: c.signedCopy,
        createdAt: c.createdAt
      })),
      ...invoices.map(i => ({
        _id: i._id,
        docType: 'invoice',
        docNumber: i.invoiceNo,
        partyName: i.customer?.businessName || i.customer?.name || '—',
        jobNo: i.ourChallanNo || '',
        date: i.invoiceDate,
        amountOrMtr: `₹${(i.grandTotal || 0).toLocaleString('en-IN')}`,
        signedCopy: i.signedCopy,
        createdAt: i.created_at
      }))
    ];

    // Sort combined records by uploadedAt descending
    unified.sort((a, b) => {
      const timeA = new Date(a.signedCopy?.uploadedAt || a.createdAt).getTime();
      const timeB = new Date(b.signedCopy?.uploadedAt || b.createdAt).getTime();
      return timeB - timeA;
    });

    // Counts for tabs/badges
    const [pendingChallans, pendingInvoices, approvedChallans, approvedInvoices, rejectedChallans, rejectedInvoices] = await Promise.all([
      FabricChallan.countDocuments({ 'signedCopy.status': 'PENDING' }),
      BillingInvoice.countDocuments({ 'signedCopy.status': 'PENDING' }),
      FabricChallan.countDocuments({ 'signedCopy.status': 'APPROVED' }),
      BillingInvoice.countDocuments({ 'signedCopy.status': 'APPROVED' }),
      FabricChallan.countDocuments({ 'signedCopy.status': 'REJECTED' }),
      BillingInvoice.countDocuments({ 'signedCopy.status': 'REJECTED' })
    ]);

    const stats = {
      pending: pendingChallans + pendingInvoices,
      approved: approvedChallans + approvedInvoices,
      rejected: rejectedChallans + rejectedInvoices,
      total: (pendingChallans + pendingInvoices) + (approvedChallans + approvedInvoices) + (rejectedChallans + rejectedInvoices)
    };

    return res.json({
      data: unified,
      stats
    });
  } catch (err) {
    logger.error('getSignedDocuments error: %o', err);
    return res.status(500).json({ error: 'Internal Server Error: ' + err.message });
  }
};

/**
 * 3. Approve or Reject Signed Copy (Admin only)
 */
const updateApprovalStatus = async (req, res) => {
  try {
    const { docType, id } = req.params;
    const { action, rejectionReason } = req.body; // action: 'APPROVED' | 'REJECTED'

    // Strict Admin Authorization Check
    const userRole = String(req.user?.role || '').toLowerCase();
    const isMainAdmin = Boolean(req.user?.isMainAdmin);
    if (userRole !== 'admin' && !isMainAdmin) {
      return res.status(403).json({ error: 'Access Denied: Only administrators can approve or reject signed documents.' });
    }

    if (!['APPROVED', 'REJECTED'].includes(action)) {
      return res.status(400).json({ error: "Invalid action. Must be 'APPROVED' or 'REJECTED'" });
    }

    const adminName = req.user?.name || req.headers['x-user-name'] || 'Admin';
    const adminId = String(req.user?.id || req.user?._id || 'admin');

    let doc = null;
    if (docType === 'challan') {
      doc = await FabricChallan.findById(id);
    } else if (docType === 'invoice') {
      doc = await BillingInvoice.findById(id);
    } else {
      return res.status(400).json({ error: "Invalid docType. Must be 'challan' or 'invoice'" });
    }

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (!doc.signedCopy || !doc.signedCopy.images || doc.signedCopy.images.length === 0) {
      return res.status(400).json({ error: 'No signed copy uploaded for this document yet' });
    }

    if (action === 'APPROVED') {
      doc.signedCopy.status = 'APPROVED';
      doc.signedCopy.approvedAt = new Date();
      doc.signedCopy.approvedBy = adminId;
      doc.signedCopy.approvedByName = adminName;
      doc.signedCopy.rejectionReason = '';
    } else {
      doc.signedCopy.status = 'REJECTED';
      doc.signedCopy.approvedAt = null;
      doc.signedCopy.approvedBy = adminId;
      doc.signedCopy.approvedByName = adminName;
      doc.signedCopy.rejectionReason = rejectionReason || 'Document rejected by administrator';
    }

    await doc.save();

    logger.info(`[SignedDocument] ${adminName} ${action} signed copy for ${docType} ${id}`);

    return res.json({
      success: true,
      message: `Signed copy has been ${action === 'APPROVED' ? 'approved' : 'rejected'} successfully`,
      signedCopy: doc.signedCopy
    });
  } catch (err) {
    logger.error('updateApprovalStatus error: %o', err);
    return res.status(500).json({ error: 'Internal Server Error: ' + err.message });
  }
};

module.exports = {
  uploadSignedCopy,
  getSignedDocuments,
  updateApprovalStatus
};
