const mongoose = require('mongoose');
const BillingInvoice = require('../db/models/billingInvoice.model');
const BillingPurchase = require('../db/models/billingPurchase.model');
const BillingCustomer = require('../db/models/billingCustomer.model');
const BillingVendor = require('../db/models/billingVendor.model');
const Vendor = require('../db/models/vendor.model');
const FabricVendor = require('../db/models/fabricVendor.model');
const BillingItem = require('../db/models/billingItem.model');
const FabricChallan = require('../db/models/fabricChallan.model');
const StitchingChallan = require('../db/models/stitchingChallan.model');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { updateWithOCC } = require('../services/concurrencyService');
const logger = require('../config/logger');

// Helper to convert number to Indian Currency Words
function numToWords(amount) {
  const words = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n) {
    if (n < 20) return words[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + words[n % 10] : '');
    if (n < 1000) return words[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
  }

  const num = Math.floor(amount || 0);
  if (num === 0) return 'Rupees Zero Only';
  return 'Rupees ' + convert(num) + ' Only';
}

// Helper for flexible company entity queries
function buildCompanyFilter(companyEntity) {
  if (!companyEntity) return {};
  let ce = String(companyEntity).trim();
  if (ce === '[object Object]') return {};

  if (ce === 'Elite Edition') {
    return {
      $or: [
        { companyEntity: 'Elite Edition' },
        { invoiceNo: { $regex: '^EE', $options: 'i' } }
      ]
    };
  } else if (ce === 'Elite Fabtex') {
    return {
      $or: [
        { companyEntity: 'Elite Fabtex' },
        { invoiceNo: { $regex: '^EF', $options: 'i' } }
      ]
    };
  } else if (ce === 'Sobise') {
    return {
      $or: [
        { companyEntity: 'Sobise' },
        { invoiceNo: { $regex: '^SO', $options: 'i' } }
      ]
    };
  } else if (ce === 'Elite Stitching') {
    return {
      $or: [
        { companyEntity: 'Elite Stitching' },
        { invoiceNo: { $regex: '^ES', $options: 'i' } }
      ]
    };
  } else if (ce === 'Elite Online') {
    return {
      $or: [
        { companyEntity: 'Elite Online' },
        { invoiceNo: { $regex: '^EO', $options: 'i' } }
      ]
    };
  } else if (ce === 'Ethno wear' || ce === 'ethno_wear' || ce === 'EW') {
    return {
      $or: [
        { companyEntity: 'Ethno wear' },
        { invoiceNo: { $regex: '^EW', $options: 'i' } }
      ]
    };
  } else if (ce === 'Yamunaji' || ce === 'yamunaji' || ce === 'YJ') {
    return {
      $or: [
        { companyEntity: 'Yamunaji' },
        { invoiceNo: { $regex: '^YJ', $options: 'i' } }
      ]
    };
  } else if (
    ce === 'Elite Digital Print' ||
    ce === 'Elite Digital Prints' ||
    ce === 'edp' ||
    ce === 'digital_print'
  ) {
    // Elite Digital Print / Digital Print
    return {
      $or: [
        { companyEntity: { $in: ['Elite Digital Print', 'Elite Digital Prints'] } },
        { companyEntity: { $exists: false } },
        { companyEntity: null },
        { companyEntity: '' },
        { invoiceNo: { $regex: '^EDP', $options: 'i' } }
      ]
    };
  } else {
    // Exact match for any other company entity to prevent leaking other company data
    return {
      companyEntity: ce
    };
  }
}

function buildPurchaseCompanyFilter(companyEntity) {
  if (!companyEntity) return {};
  const ce = String(companyEntity).trim();
  if (ce === '[object Object]') return {};
  if (ce === 'Elite Edition') {
    return {
      $or: [
        { companyEntity: 'Elite Edition' },
        { purchaseNo: { $regex: '^EE', $options: 'i' } }
      ]
    };
  } else if (ce === 'Elite Fabtex') {
    return {
      $or: [
        { companyEntity: 'Elite Fabtex' },
        { purchaseNo: { $regex: '^EF', $options: 'i' } }
      ]
    };
  } else if (ce === 'Sobise') {
    return {
      $or: [
        { companyEntity: 'Sobise' },
        { purchaseNo: { $regex: '^SO', $options: 'i' } }
      ]
    };
  } else if (ce === 'Elite Stitching') {
    return {
      $or: [
        { companyEntity: 'Elite Stitching' },
        { purchaseNo: { $regex: '^ES', $options: 'i' } }
      ]
    };
  } else if (ce === 'Elite Online') {
    return {
      $or: [
        { companyEntity: 'Elite Online' },
        { purchaseNo: { $regex: '^EO', $options: 'i' } }
      ]
    };
  } else if (ce === 'Ethno wear' || ce === 'ethno_wear' || ce === 'EW') {
    return {
      $or: [
        { companyEntity: 'Ethno wear' },
        { purchaseNo: { $regex: '^EW', $options: 'i' } }
      ]
    };
  } else if (ce === 'Yamunaji' || ce === 'yamunaji' || ce === 'YJ') {
    return {
      $or: [
        { companyEntity: 'Yamunaji' },
        { purchaseNo: { $regex: '^YJ', $options: 'i' } }
      ]
    };
  } else if (ce === 'edp' || ce === 'Elite Digital Prints' || ce === 'Elite Digital Print') {
    return {
      $or: [
        { companyEntity: { $in: ['Elite Digital Prints', 'Elite Digital Print', 'edp'] } },
        { companyEntity: { $exists: false } },
        { companyEntity: null },
        { companyEntity: '' }
      ]
    };
  }
  return { companyEntity: ce };
}

// ── 1. DASHBOARD STATS ────────────────────────────────────────────────────────
const getBillingDashboardStats = async (req, res) => {
  try {
    let { companyEntity } = req.query;
    if (companyEntity === '[object Object]') {
      companyEntity = '';
    }
    const filter = buildCompanyFilter(companyEntity);
    const now = new Date();

    const [totalInvoices, statsAgg, recentInvoices] = await Promise.all([
      BillingInvoice.countDocuments(filter),
      BillingInvoice.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalInvoiced: { $sum: { $ifNull: ['$grandTotal', 0] } },
            totalPaid: { $sum: { $ifNull: ['$paidAmount', 0] } },
            totalBalanceDue: { $sum: { $ifNull: ['$balanceDue', 0] } },
            paidCount: {
              $sum: { $cond: [{ $eq: ['$paymentStatus', 'PAID'] }, 1, 0] }
            },
            unpaidCount: {
              $sum: { $cond: [{ $ne: ['$paymentStatus', 'PAID'] }, 1, 0] }
            },
            partiallyPaidCount: {
              $sum: { $cond: [{ $eq: ['$paymentStatus', 'PARTIALLY_PAID'] }, 1, 0] }
            },
            overdueCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$paymentStatus', 'PAID'] },
                      { $ne: ['$dueDate', null] },
                      { $lt: ['$dueDate', now] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]),
      BillingInvoice.find(filter)
        .sort({ invoiceDate: -1, createdAt: -1 })
        .limit(10)
        .populate('customer', 'name businessName phone gstNo')
        .lean()
    ]);

    const s = (statsAgg && statsAgg[0]) ? statsAgg[0] : {};
    const totalInvoiced = parseFloat((s.totalInvoiced || 0).toFixed(2));
    const totalPaid = parseFloat((s.totalPaid || 0).toFixed(2));
    const totalBalanceDue = parseFloat((s.totalBalanceDue || 0).toFixed(2));

    res.json({
      success: true,
      data: {
        totalInvoices,
        invoiceCount: totalInvoices,
        totalRevenue: totalInvoiced,
        totalInvoiced,
        totalPaid,
        totalBalanceDue,
        paidAmount: totalPaid,
        balanceDue: totalBalanceDue,
        paidCount: s.paidCount || 0,
        unpaidCount: s.unpaidCount || 0,
        partiallyPaidCount: s.partiallyPaidCount || 0,
        overdueCount: s.overdueCount || 0,
        recentInvoices: recentInvoices || []
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Helper to enrich invoice line items with design images from JobCards / Designs if missing
const enrichInvoiceItemsWithImages = async (invoices) => {
  if (!invoices) return;
  const list = Array.isArray(invoices) ? invoices : [invoices];
  const missingJobs = [];
  const missingDesigns = [];

  list.forEach(inv => {
    (inv.items || []).forEach(it => {
      if (!it.imageUrl) {
        let c = it.jobNo ? String(it.jobNo).replace(/[^0-9]/g, '') : '';
        if (!c && it.description) {
          const m = String(it.description).match(/Job\s*(?:Card|No\.?)?[:\s#-]*(\d+)/i) || String(it.description).match(/\b(\d{3,6})\b/);
          if (m) c = m[1];
        }
        if (c) missingJobs.push(c);

        let d = it.designNo ? String(it.designNo).trim() : '';
        if (!d && it.description) {
          const dm = String(it.description).match(/Design\s*(?:No\.?)?[:\s#-]*([A-Za-z0-9_-]+)/i);
          if (dm) d = dm[1];
        }
        if (d) missingDesigns.push(d);
      }
    });
  });

  if (missingJobs.length === 0 && missingDesigns.length === 0) return;

  try {
    const JobCard = require('../db/models/jobCard.model');
    const Design = require('../db/models/design.model');

    const uniqueCleanJobs = [...new Set(missingJobs)];
    const jobMap = new Map();
    if (uniqueCleanJobs.length > 0) {
      const orQueries = [];
      uniqueCleanJobs.forEach(c => {
        orQueries.push({ jobNo: `JOB-${c}` });
        orQueries.push({ jobNo: `JOB NO.- ${c}` });
        orQueries.push({ jobNo: c });
        orQueries.push({ jobNo: Number(c) });
      });

      const foundJobs = await JobCard.find({ $or: orQueries }).select('jobNo imageUrl1 imageUrl2 image proofing.artworkUrl').lean();
      foundJobs.forEach(j => {
        const img = j.imageUrl1 || j.imageUrl2 || j.image || (j.proofing && j.proofing.artworkUrl) || '';
        const c = String(j.jobNo || '').replace(/[^0-9]/g, '');
        if (img && c) jobMap.set(c, img);
      });
    }

    const uniqueCleanDesigns = [...new Set(missingDesigns)];
    const designMap = new Map();
    if (uniqueCleanDesigns.length > 0) {
      const dOrQueries = [];
      uniqueCleanDesigns.forEach(d => {
        dOrQueries.push({ designNo: d });
        dOrQueries.push({ designNo: new RegExp(`^${d.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') });
      });
      const foundDesigns = await Design.find({ $or: dOrQueries }).select('designNo image imageUrl thumbnail photo').lean();
      foundDesigns.forEach(d => {
        const img = d.imageUrl || d.image || d.thumbnail || d.photo || '';
        if (img && d.designNo) {
          designMap.set(String(d.designNo).trim().toUpperCase(), img);
        }
      });
    }

    list.forEach(inv => {
      (inv.items || []).forEach(it => {
        if (!it.imageUrl) {
          let c = it.jobNo ? String(it.jobNo).replace(/[^0-9]/g, '') : '';
          if (!c && it.description) {
            const m = String(it.description).match(/Job\s*(?:Card|No\.?)?[:\s#-]*(\d+)/i) || String(it.description).match(/\b(\d{3,6})\b/);
            if (m) c = m[1];
          }
          if (c && jobMap.has(c)) {
            it.imageUrl = jobMap.get(c);
            return;
          }

          let d = it.designNo ? String(it.designNo).trim().toUpperCase() : '';
          if (!d && it.description) {
            const dm = String(it.description).match(/Design\s*(?:No\.?)?[:\s#-]*([A-Za-z0-9_-]+)/i);
            if (dm) d = dm[1].toUpperCase();
          }
          if (d && designMap.has(d)) {
            it.imageUrl = designMap.get(d);
          }
        }
      });
    });
  } catch (err) {
    console.warn('enrichInvoiceItemsWithImages error:', err.message);
  }
};

// ── 2. GET INVOICES LIST ───────────────────────────────────────────────────────
const getInvoices = async (req, res) => {
  try {
    const { search, paymentStatus, page = 1, limit = 5000, dateStart, dateEnd, companyEntity } = req.query;

    const filter = buildCompanyFilter(companyEntity);

    if (paymentStatus && paymentStatus !== 'ALL') {
      filter.paymentStatus = paymentStatus;
    }

    if (search) {
      filter.$or = [
        { invoiceNo: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.businessName': { $regex: search, $options: 'i' } },
        { 'customer.phone': { $regex: search, $options: 'i' } }
      ];
    }

    if (dateStart || dateEnd) {
      const dsStr = dateStart ? String(dateStart).split('T')[0] : '';
      const deStr = dateEnd ? String(dateEnd).split('T')[0] : '';
      const minMs = dsStr ? Math.min(new Date(`${dsStr}T00:00:00.000Z`).getTime(), new Date(`${dsStr}T00:00:00.000`).getTime()) : null;
      const maxMs = deStr ? Math.max(new Date(`${deStr}T23:59:59.999Z`).getTime(), new Date(`${deStr}T23:59:59.999`).getTime()) : null;

      const dateQuery = {};
      if (minMs) dateQuery.$gte = new Date(minMs);
      if (maxMs) dateQuery.$lte = new Date(maxMs);

      filter.$or = [
        { invoiceDate: dateQuery },
        { invoiceDate: { $gte: dsStr, $lte: deStr } },
        { created_at: dateQuery },
        { createdAt: dateQuery }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [invoices, total] = await Promise.all([
      BillingInvoice.find(filter)
        .sort({ invoiceSeq: -1, created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      BillingInvoice.countDocuments(filter)
    ]);

    if (req.query.enrichImages === 'true') {
      await enrichInvoiceItemsWithImages(invoices);
    }

    res.json({
      success: true,
      data: invoices,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── 3. GET SINGLE INVOICE BY ID ─────────────────────────────────────────────
const getInvoiceById = async (req, res) => {
  try {
    const invoice = await BillingInvoice.findById(req.params.id).lean();
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    await enrichInvoiceItemsWithImages(invoice);

    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── 4. GET NEXT INVOICE NUMBER ──────────────────────────────────────────────
const getNextInvoiceNo = async (req, res) => {
  try {
    const { companyEntity = 'Elite Digital Print' } = req.query;
    const PrintConfig = require('../db/models/printConfig.model');
    let defaultPrefix = 'EDP/26-27/';
    let defaultStartSeq = 223;
    if (companyEntity === 'Elite Edition') {
      defaultPrefix = 'EE-2627-';
      defaultStartSeq = 1;
    } else if (companyEntity === 'Elite Fabtex') {
      defaultPrefix = 'EF-2627-';
      defaultStartSeq = 1;
    } else if (companyEntity === 'Sobise') {
      defaultPrefix = 'SO-2627-';
      defaultStartSeq = 1;
    } else if (companyEntity === 'Elite Stitching') {
      defaultPrefix = 'ES-2627-';
      defaultStartSeq = 1;
    } else if (companyEntity === 'Elite Online') {
      defaultPrefix = 'EO-2627-';
      defaultStartSeq = 1;
    } else if (companyEntity === 'Ethno wear' || companyEntity === 'ethno_wear') {
      defaultPrefix = 'EW-2627-';
      defaultStartSeq = 1;
    } else if (companyEntity === 'Yamunaji' || companyEntity === 'yamunaji') {
      defaultPrefix = 'YJ-2627-';
      defaultStartSeq = 1;
    }

    const filter = buildCompanyFilter(companyEntity);
    const config = await PrintConfig.findOne(filter).lean() || {};
    const START_SEQ = config.startingInvoiceNo != null ? Number(config.startingInvoiceNo) : defaultStartSeq;
    const prefix = config.invoicePrefix || defaultPrefix;

    const lastInvoice = await BillingInvoice.findOne(filter, 'invoiceSeq').sort({ invoiceSeq: -1 });
    const nextSeq = lastInvoice && lastInvoice.invoiceSeq ? Math.max(lastInvoice.invoiceSeq + 1, START_SEQ) : START_SEQ;
    
    let invoiceNo;
    if (prefix.endsWith('/')) {
      invoiceNo = `${prefix}${nextSeq}`;
    } else if (prefix.endsWith('-')) {
      invoiceNo = `${prefix}${String(nextSeq).padStart(4, '0')}`;
    } else {
      invoiceNo = `${prefix}${nextSeq}`;
    }

    res.json({ success: true, nextSeq, prefix, invoiceNo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Strict Guard: Verify delivery challans are not already billed in an active invoice.
 * A delivery challan cannot be billed a 2nd time.
 */
const assertChallansNotAlreadyBilled = async (invoiceData, currentInvoiceId = null) => {
  const rawChallanIds = new Set();
  const rawChallanNos = new Set();

  if (Array.isArray(invoiceData.linkedChallanIds)) {
    invoiceData.linkedChallanIds.forEach(id => id && rawChallanIds.add(String(id)));
  }
  if (Array.isArray(invoiceData.linkedChallanNos)) {
    invoiceData.linkedChallanNos.forEach(no => {
      const num = parseInt(String(no).replace(/[^0-9]/g, ''), 10);
      if (num) rawChallanNos.add(num);
    });
  }
  if (invoiceData.ourChallanNo) {
    String(invoiceData.ourChallanNo).split(/[,;\s]+/).forEach(p => {
      const num = parseInt(p.replace(/[^0-9]/g, ''), 10);
      if (num) rawChallanNos.add(num);
    });
  }
  if (Array.isArray(invoiceData.items)) {
    invoiceData.items.forEach(it => {
      if (it.challanId) rawChallanIds.add(String(it.challanId));
      if (it.ourChallanNo) {
        const num = parseInt(String(it.ourChallanNo).replace(/[^0-9]/g, ''), 10);
        if (num) rawChallanNos.add(num);
      }
    });
  }

  const activeChallanIdList = Array.from(rawChallanIds).filter(id => mongoose.Types.ObjectId.isValid(id));
  const activeChallanNoList = Array.from(rawChallanNos);

  let preexistingChallanNos = new Set();
  let preexistingChallanIds = new Set();
  let currentInvoiceNo = invoiceData.invoiceNo || null;
  let excludeCurrentInv = {};

  if (currentInvoiceId) {
    const currentObjId = mongoose.Types.ObjectId.isValid(currentInvoiceId)
      ? new mongoose.Types.ObjectId(currentInvoiceId)
      : currentInvoiceId;
    excludeCurrentInv = { _id: { $ne: currentObjId } };

    try {
      const existingCurrent = await BillingInvoice.findById(currentInvoiceId).lean();
      if (existingCurrent) {
        if (existingCurrent.invoiceNo) {
          currentInvoiceNo = existingCurrent.invoiceNo;
          excludeCurrentInv.invoiceNo = { $ne: existingCurrent.invoiceNo };
        }
        if (Array.isArray(existingCurrent.linkedChallanIds)) {
          existingCurrent.linkedChallanIds.forEach(id => id && preexistingChallanIds.add(String(id)));
        }
        if (Array.isArray(existingCurrent.linkedChallanNos)) {
          existingCurrent.linkedChallanNos.forEach(no => {
            const num = parseInt(String(no).replace(/[^0-9]/g, ''), 10);
            if (num) preexistingChallanNos.add(num);
          });
        }
        if (existingCurrent.ourChallanNo) {
          String(existingCurrent.ourChallanNo).split(/[,;\s]+/).forEach(p => {
            const num = parseInt(p.replace(/[^0-9]/g, ''), 10);
            if (num) preexistingChallanNos.add(num);
          });
        }
        if (Array.isArray(existingCurrent.items)) {
          existingCurrent.items.forEach(it => {
            if (it.challanId) preexistingChallanIds.add(String(it.challanId));
            if (it.ourChallanNo) {
              const num = parseInt(String(it.ourChallanNo).replace(/[^0-9]/g, ''), 10);
              if (num) preexistingChallanNos.add(num);
            }
          });
        }
      }
    } catch (e) {
      logger.warn('Error reading existing current invoice for challan guard: %s', e.message);
    }
  }

  // When updating an existing invoice, ONLY check challans that are newly added to this invoice.
  // Pre-existing challans already belong to this invoice, so updating image/notes/rates shouldn't be blocked.
  const challanNosToCheck = currentInvoiceId
    ? activeChallanNoList.filter(num => !preexistingChallanNos.has(num))
    : activeChallanNoList;
  const challanIdsToCheck = currentInvoiceId
    ? activeChallanIdList.filter(id => !preexistingChallanIds.has(String(id)))
    : activeChallanIdList;

  if (challanNosToCheck.length === 0 && challanIdsToCheck.length === 0) {
    return; // No new challans to check
  }

  // 1. Direct active BillingInvoice check
  for (const num of challanNosToCheck) {
    const numStr = String(num);
    const existingInv = await BillingInvoice.findOne({
      ...excludeCurrentInv,
      invoiceStatus: { $ne: 'CANCELLED' },
      $or: [
        { linkedChallanNos: numStr },
        { linkedChallanNos: `EDP-${numStr}` },
        { ourChallanNo: new RegExp(`(^|[^0-9])${numStr}([^0-9]|$)`) },
        { 'items.ourChallanNo': new RegExp(`(^|[^0-9])${numStr}([^0-9]|$)`) }
      ]
    }).lean();

    if (existingInv) {
      throw new Error(`Delivery Challan EDP-${numStr} is already billed in Invoice #${existingInv.invoiceNo}. A delivery challan cannot be billed a 2nd time.`);
    }
  }

  if (challanIdsToCheck.length > 0) {
    const existingInvById = await BillingInvoice.findOne({
      ...excludeCurrentInv,
      invoiceStatus: { $ne: 'CANCELLED' },
      $or: [
        { linkedChallanIds: { $in: challanIdsToCheck } },
        { 'items.challanId': { $in: challanIdsToCheck } }
      ]
    }).lean();

    if (existingInvById) {
      throw new Error(`One or more selected Challans are already billed in Invoice #${existingInvById.invoiceNo}. A delivery challan cannot be billed a 2nd time.`);
    }
  }

  // 2. Check FabricChallan database state
  const billedFabricChallans = await FabricChallan.find({
    $or: [
      ...(challanIdsToCheck.length > 0 ? [{ _id: { $in: challanIdsToCheck } }] : []),
      ...(challanNosToCheck.length > 0 ? [{ challanNo: { $in: challanNosToCheck } }] : [])
    ],
    status: 'INVOICED',
    invoiceNo: { $exists: true, $ne: '' }
  }).lean();

  for (const fc of billedFabricChallans) {
    if (fc.invoiceNo && fc.invoiceNo !== currentInvoiceNo) {
      const activeInv = await BillingInvoice.findOne({
        ...excludeCurrentInv,
        invoiceNo: fc.invoiceNo,
        invoiceStatus: { $ne: 'CANCELLED' }
      }).lean();
      if (activeInv) {
        throw new Error(`Delivery Challan EDP-${fc.challanNo} is already billed in Invoice #${fc.invoiceNo}. A delivery challan cannot be billed a 2nd time.`);
      }
    }
  }

  // 3. Check StitchingChallan database state
  const billedStitchingChallans = await StitchingChallan.find({
    $or: [
      ...(challanIdsToCheck.length > 0 ? [{ _id: { $in: challanIdsToCheck } }] : []),
      ...(challanNosToCheck.length > 0 ? [{ challanNo: { $in: challanNosToCheck } }] : [])
    ],
    status: 'INVOICED',
    invoiceNo: { $exists: true, $ne: '' }
  }).lean();

  for (const sc of billedStitchingChallans) {
    if (sc.invoiceNo && sc.invoiceNo !== currentInvoiceNo) {
      const activeInv = await BillingInvoice.findOne({
        ...excludeCurrentInv,
        invoiceNo: sc.invoiceNo,
        invoiceStatus: { $ne: 'CANCELLED' }
      }).lean();
      if (activeInv) {
        throw new Error(`Stitching Challan #${sc.challanNo} is already billed in Invoice #${sc.invoiceNo}. A delivery challan cannot be billed a 2nd time.`);
      }
    }
  }
};

// ── 5. CREATE INVOICE ────────────────────────────────────────────────────────
const createInvoice = async (req, res) => {
  try {
    const invoiceData = req.body;
    const entity = invoiceData.companyEntity || 'Elite Digital Print';
    const filter = buildCompanyFilter(entity);

    // Strict Guard: Prevent duplicate billing of delivery challans
    try {
      await assertChallansNotAlreadyBilled(invoiceData);
    } catch (guardErr) {
      return res.status(409).json({ success: false, error: guardErr.message });
    }

    if (!invoiceData.invoiceSeq || !invoiceData.invoiceNo) {
      let defaultPrefix = 'EDP/26-27/';
      let defaultStartSeq = 223;
      if (entity === 'Elite Edition') {
        defaultPrefix = 'EE-2627-';
        defaultStartSeq = 1;
      } else if (entity === 'Elite Fabtex') {
        defaultPrefix = 'EF-2627-';
        defaultStartSeq = 1;
      } else if (entity === 'Sobise') {
        defaultPrefix = 'SO-2627-';
        defaultStartSeq = 1;
      } else if (entity === 'Elite Stitching') {
        defaultPrefix = 'ES-2627-';
        defaultStartSeq = 1;
      } else if (entity === 'Elite Online') {
        defaultPrefix = 'EO-2627-';
        defaultStartSeq = 1;
      } else if (entity === 'Ethno wear' || entity === 'ethno_wear') {
        defaultPrefix = 'EW-2627-';
        defaultStartSeq = 1;
      } else if (entity === 'Yamunaji' || entity === 'yamunaji') {
        defaultPrefix = 'YJ-2627-';
        defaultStartSeq = 1;
      }

      const PrintConfig = require('../db/models/printConfig.model');
      const config = await PrintConfig.findOne(filter).lean() || {};
      const prefix = config.invoicePrefix || defaultPrefix;
      const startSeq = config.startingInvoiceNo != null ? Number(config.startingInvoiceNo) : defaultStartSeq;

      const lastInvoice = await BillingInvoice.findOne(filter, 'invoiceSeq').sort({ invoiceSeq: -1 });
      const nextSeq = lastInvoice && lastInvoice.invoiceSeq ? Math.max(lastInvoice.invoiceSeq + 1, startSeq) : startSeq;
      if (!invoiceData.invoiceSeq) {
        invoiceData.invoiceSeq = nextSeq;
      }
      if (!invoiceData.invoiceNo || !String(invoiceData.invoiceNo).trim()) {
        if (prefix.endsWith('/')) {
          invoiceData.invoiceNo = `${prefix}${invoiceData.invoiceSeq}`;
        } else {
          invoiceData.invoiceNo = `${prefix}${String(invoiceData.invoiceSeq).padStart(4, '0')}`;
        }
      }
    }

    // Ensure customer object is present
    if (!invoiceData.customer || !invoiceData.customer.name) {
      invoiceData.customer = {
        name: invoiceData.partyName || invoiceData.customerName || 'Walk-in Client',
        businessName: invoiceData.partyName || '',
        state: 'Gujarat',
        stateCode: '24'
      };
    }

    const activeUserName = req.headers['x-user-name'] || req.user?.name || invoiceData.createdBy || 'Staff User';
    invoiceData.createdBy = activeUserName;
    invoiceData.createdByName = activeUserName;

    // Auto-calculate balance due (deducting TDS if enabled)
    const grandTotal = parseFloat(invoiceData.grandTotal) || 0;
    const paidAmount = parseFloat(invoiceData.paidAmount) || 0;
    const tdsAmount = invoiceData.enableTds ? Math.round(parseFloat(invoiceData.tdsAmount) || 0) : 0;
    invoiceData.tdsAmount = tdsAmount;
    const balanceDue = Math.max(0, parseFloat((grandTotal - tdsAmount - paidAmount).toFixed(2)));

    invoiceData.balanceDue = balanceDue;

    if (balanceDue === 0 && grandTotal > 0) {
      invoiceData.paymentStatus = 'PAID';
    } else if (paidAmount > 0 && balanceDue > 0) {
      invoiceData.paymentStatus = 'PARTIALLY_PAID';
    } else {
      invoiceData.paymentStatus = 'UNPAID';
    }

    await enrichInvoiceItemsWithImages(invoiceData);

    const invoice = await BillingInvoice.create(invoiceData);

    // Publish Authority Activity Event
    try {
      const { publishActivity } = require('../utils/activityEvent');
      const uName = req.user?.name || invoiceData.createdBy || 'Staff User';
      const uId = req.user?._id || invoiceData.userId;
      const cName = invoice.customer ? (invoice.customer.businessName || invoice.customer.name) : 'Client';
      const itemCnt = invoice.items ? invoice.items.length : 0;
      publishActivity({
        actorId: uId,
        actorName: uName,
        action: 'CREATE',
        module: 'Billing Invoice',
        recordRef: invoice.invoiceNo,
        recordId: invoice._id,
        permissionScope: 'billing',
        department: 'Billing',
        description: `🧾 **Tax Invoice #${invoice.invoiceNo}** generated for Client: **"${cName}"** | Total: **₹${invoice.grandTotal || 0}** | Items: **${itemCnt}** by **${uName}**.`
      }).catch(e => console.warn('publishActivity invoice create failed: %s', e.message));
    } catch (e) {
      console.warn('Failed to publish activity for invoice:', e.message);
    }

    // Sync linked Challans to INVOICED
    await syncChallanStatusForInvoice(invoice);
    await syncJobCardsForInvoice(invoice);

    // Auto-sync Invoice to Sister Company's Raw Material Inward if buyer is a sister company
    try {
      const { syncInvoiceToSisterRawMaterial } = require('../utils/sisterCompanySync');
      await syncInvoiceToSisterRawMaterial(invoice);
    } catch (syncErr) {
      console.warn('[billing.createInvoice] Sister company raw material sync warning:', syncErr.message);
    }

    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Helper function to keep Challan statuses strictly synced with Invoice items
const syncChallanStatusForInvoice = async (invoice) => {
  if (!invoice) return;

  const activeIdsSet = new Set();

  if (Array.isArray(invoice.linkedChallanIds)) {
    invoice.linkedChallanIds.forEach(id => {
      if (id) activeIdsSet.add(String(id));
    });
  }

  if (Array.isArray(invoice.items)) {
    invoice.items.forEach(it => {
      if (it.challanId) activeIdsSet.add(String(it.challanId));
    });
  }

  // Fallback: check linkedChallanNos or items[].ourChallanNo by numeric challanNo
  const challanNosToLookup = new Set();
  if (Array.isArray(invoice.linkedChallanNos)) {
    invoice.linkedChallanNos.forEach(noStr => {
      const num = parseInt(String(noStr).replace(/[^0-9]/g, ''), 10);
      if (num) challanNosToLookup.add(num);
    });
  }
  if (invoice.ourChallanNo) {
    const parts = String(invoice.ourChallanNo).split(/[,;\s]+/);
    parts.forEach(p => {
      const num = parseInt(p.replace(/[^0-9]/g, ''), 10);
      if (num) challanNosToLookup.add(num);
    });
  }
  if (Array.isArray(invoice.items)) {
    invoice.items.forEach(it => {
      if (it.ourChallanNo) {
        const num = parseInt(String(it.ourChallanNo).replace(/[^0-9]/g, ''), 10);
        if (num) challanNosToLookup.add(num);
      }
      if (it.description && it.description.includes('Challan ')) {
        const match = it.description.match(/Challan\s+([A-Z0-9-]+)/i);
        if (match) {
          const num = parseInt(match[1].replace(/[^0-9]/g, ''), 10);
          if (num) challanNosToLookup.add(num);
        }
      }
    });
  }

  if (challanNosToLookup.size > 0) {
    const numList = Array.from(challanNosToLookup).map(n => parseInt(String(n).replace(/[^0-9]/g, ''), 10)).filter(n => !isNaN(n) && n > 0);
    if (numList.length > 0) {
      const fChs = await FabricChallan.find({ challanNo: { $in: numList } }, '_id').lean();
      fChs.forEach(fc => activeIdsSet.add(String(fc._id)));
      const sChs = await StitchingChallan.find({ challanNo: { $in: numList } }, '_id').lean();
      sChs.forEach(sc => activeIdsSet.add(String(sc._id)));
    }
  }

  const activeIds = Array.from(activeIdsSet);
  const activeObjectIds = activeIds
    .filter(id => mongoose.Types.ObjectId.isValid(id))
    .map(id => new mongoose.Types.ObjectId(id));

  const queryInv = {
    $or: [
      { invoiceId: invoice._id },
      { invoiceNo: invoice.invoiceNo }
    ]
  };

  const existingFabric = await FabricChallan.find(queryInv).lean();
  const existingStitching = await StitchingChallan.find(queryInv).lean();

  const toUnlinkFabric = existingFabric.filter(c => !activeIdsSet.has(String(c._id))).map(c => c._id);
  const toUnlinkStitching = existingStitching.filter(c => !activeIdsSet.has(String(c._id))).map(c => c._id);

  if (toUnlinkFabric.length > 0) {
    await FabricChallan.updateMany(
      { _id: { $in: toUnlinkFabric } },
      { $set: { status: 'PENDING', billingStatus: 'PENDING', isBilled: false }, $unset: { invoiceId: 1, invoiceNo: 1 } }
    );
  }
  if (toUnlinkStitching.length > 0) {
    await StitchingChallan.updateMany(
      { _id: { $in: toUnlinkStitching } },
      { $set: { status: 'PENDING', billingStatus: 'PENDING', isBilled: false }, $unset: { invoiceId: 1, invoiceNo: 1 } }
    );
  }

  if (activeObjectIds.length > 0) {
    await FabricChallan.updateMany(
      { _id: { $in: activeObjectIds } },
      { $set: { status: 'INVOICED', billingStatus: 'INVOICED', isBilled: true, invoiceId: invoice._id, invoiceNo: invoice.invoiceNo } }
    );
    await StitchingChallan.updateMany(
      { _id: { $in: activeObjectIds } },
      { $set: { status: 'INVOICED', billingStatus: 'INVOICED', isBilled: true, invoiceId: invoice._id, invoiceNo: invoice.invoiceNo } }
    );
  }
};

// Helper function to auto-sync invoices & billNo into JobCards matching invoice items
const extractJobKeys = (rawJobStr) => {
  if (!rawJobStr) return [];
  const parts = String(rawJobStr).split(/[,/;&|]+|\band\b/i).map(p => p.trim()).filter(Boolean);
  const keys = [];
  parts.forEach(p => {
    const subParts = p.split(/\.(?=\d{3,})/).map(s => s.trim()).filter(Boolean);
    subParts.forEach(sp => {
      const digits = sp.replace(/[^\d]/g, '');
      if (digits) keys.push({ digits, raw: sp });
    });
  });
  return keys;
};

const syncJobCardsForInvoice = async (invoice) => {
  if (!invoice || !Array.isArray(invoice.items)) return;
  try {
    const JobCard = require('../db/models/jobCard.model');
    const BillingInvoice = require('../db/models/billingInvoice.model');

    const jobKeys = new Set();
    invoice.items.forEach(it => {
      if (it.jobNo && String(it.jobNo).trim()) {
        const extracted = extractJobKeys(it.jobNo);
        extracted.forEach(k => jobKeys.add(k.digits));
        if (extracted.length === 0) {
          const raw = String(it.jobNo).trim().toLowerCase();
          jobKeys.add(raw);
        }
      }
    });

    if (jobKeys.size === 0) return;

    // Fetch all active invoices to re-aggregate history for affected jobs
    const allInvoices = await BillingInvoice.find({
      invoiceStatus: { $ne: 'CANCELLED' }
    }).select('_id invoiceNo invoiceDate items').lean();

    // Map invoice entries by job digits/key
    const jobInvoicesMap = new Map();
    allInvoices.forEach(inv => {
      (inv.items || []).forEach(it => {
        if (!it.jobNo || !String(it.jobNo).trim()) return;
        const extracted = extractJobKeys(it.jobNo);
        const totalLineQty = Number(it.qty) || 0;
        const totalLineAmt = Number(it.totalAmount) || 0;
        const numJobs = Math.max(1, extracted.length);

        if (extracted.length > 0) {
          extracted.forEach(({ digits }) => {
            if (jobKeys.has(digits)) {
              if (!jobInvoicesMap.has(digits)) {
                jobInvoicesMap.set(digits, []);
              }
              jobInvoicesMap.get(digits).push({
                invoiceId: inv._id,
                invoiceNo: inv.invoiceNo,
                date: inv.invoiceDate,
                meters: extracted.length > 1 ? 0 : totalLineQty,
                lineQty: totalLineQty,
                amount: Math.round((totalLineAmt / numJobs) * 100) / 100
              });
            }
          });
        } else {
          const key = String(it.jobNo).trim().toLowerCase();
          if (jobKeys.has(key)) {
            if (!jobInvoicesMap.has(key)) jobInvoicesMap.set(key, []);
            jobInvoicesMap.get(key).push({
              invoiceId: inv._id,
              invoiceNo: inv.invoiceNo,
              date: inv.invoiceDate,
              meters: totalLineQty,
              lineQty: totalLineQty,
              amount: totalLineAmt
            });
          }
        }
      });
    });

    // Find and update matching JobCards
    const allJobCards = await JobCard.find({});
    for (const card of allJobCards) {
      if (!card.jobNo) continue;
      const raw = String(card.jobNo).trim();
      const digits = raw.replace(/[^\d]/g, '');
      const key = digits || raw.toLowerCase();

      if (jobKeys.has(key)) {
        const invList = jobInvoicesMap.get(key) || [];
        const uniqueBillNos = Array.from(new Set(invList.map(i => i.invoiceNo))).filter(Boolean);

        const targetMatch = String(card.totalMtr || card.consumption || '0').match(/[\d.]+/);
        const targetMtr = targetMatch ? parseFloat(targetMatch[0]) : 0;

        card.invoices = invList.map(i => {
          let mtr = i.meters;
          if (mtr <= 0 && i.lineQty > 0) {
            mtr = targetMtr > 0 ? targetMtr : i.lineQty;
          }
          return {
            invoiceId: i.invoiceId,
            invoiceNo: i.invoiceNo,
            date: i.date,
            meters: Math.round(mtr * 100) / 100,
            amount: i.amount
          };
        });

        const totalDeliveredMtr = card.invoices.reduce((sum, item) => sum + (item.meters || 0), 0);
        card.deliveredMtr = Math.round(totalDeliveredMtr * 100) / 100;
        card.billNo = uniqueBillNos.join(', ');

        if (targetMtr > 0 && totalDeliveredMtr >= targetMtr) {
          card.deliveryStatus = 'Delivery Done';
          if (card.status !== 'Done' && card.fusingStatus === 'Fusing Done') {
            card.status = 'Done';
          }
        }

        if (invList.length > 0) {
          const sorted = [...invList].sort((a, b) => new Date(b.date) - new Date(a.date));
          if (sorted[0]?.date) {
            const dt = new Date(sorted[0].date);
            card.deliveryDate = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
          }
        }

        // Auto-sync Fusing from delivery mtr and invoice date
        if (totalDeliveredMtr > 0) {
          card.fusingMtr = String(card.deliveredMtr);
          card.fusingStatus = 'Fusing Done';
          if (card.deliveryDate) {
            card.fusingDate = card.deliveryDate;
          }
          if (card.deliveryStatus === 'Delivery Done') {
            card.status = 'Done';
          }
        }

        await card.save();
      }
    }
  } catch (err) {
    console.warn('syncJobCardsForInvoice warning: %s', err.message);
  }
};

// ── 6. UPDATE INVOICE ────────────────────────────────────────────────────────
// Helper to purge disk-cached PDFs for an invoice on edits/payments
const invalidateInvoicePdfCache = (invoiceId) => {
  try {
    const cacheDir = path.join(__dirname, '../../uploads/cached_invoices');
    if (!fs.existsSync(cacheDir) || !invoiceId) return;
    const prefix = `inv_${invoiceId}_`;
    const files = fs.readdirSync(cacheDir);
    files.forEach(f => {
      if (f.startsWith(prefix)) {
        try { fs.unlinkSync(path.join(cacheDir, f)); } catch (e) {}
      }
    });
  } catch (err) {
    if (typeof logger !== 'undefined' && logger.warn) {
      logger.warn(`Failed to invalidate invoice cache for ${invoiceId}: ${err.message}`);
    }
  }
};

const updateInvoice = async (req, res) => {
  try {
    const invoiceData = req.body;
    const editorName = req.headers['x-user-name'] || req.user?.name || invoiceData.updatedBy || 'Staff User';
    invoiceData.updatedBy = editorName;
    invoiceData.updatedByName = editorName;

    if (Array.isArray(invoiceData.items)) {
      const validChallanIds = invoiceData.items.map(i => i.challanId).filter(Boolean);
      const validChallanNos = invoiceData.items.map(i => i.ourChallanNo).filter(Boolean);
      invoiceData.linkedChallanIds = validChallanIds;
      invoiceData.linkedChallanNos = validChallanNos;
      invoiceData.ourChallanNo = validChallanNos.join(', ');
    }

    const grandTotal = parseFloat(invoiceData.grandTotal) || 0;
    const paidAmount = parseFloat(invoiceData.paidAmount) || 0;
    const tdsAmount = invoiceData.enableTds ? Math.round(parseFloat(invoiceData.tdsAmount) || 0) : 0;
    invoiceData.tdsAmount = tdsAmount;
    const balanceDue = Math.max(0, parseFloat((grandTotal - tdsAmount - paidAmount).toFixed(2)));

    invoiceData.balanceDue = balanceDue;

    if (balanceDue === 0 && grandTotal > 0) {
      invoiceData.paymentStatus = 'PAID';
    } else if (paidAmount > 0 && balanceDue > 0) {
      invoiceData.paymentStatus = 'PARTIALLY_PAID';
    } else {
      invoiceData.paymentStatus = 'UNPAID';
    }

    // Strict Guard: Prevent duplicate billing of delivery challans in another invoice
    try {
      await assertChallansNotAlreadyBilled(invoiceData, req.params.id);
    } catch (guardErr) {
      const userRole = String(req.user?.role || req.headers['x-user-role'] || '').toLowerCase();
      const isAdmin = userRole === 'admin' ||
                      userRole === 'main_admin' ||
                      userRole === 'super_admin' ||
                      Boolean(req.user?.isAdmin) ||
                      Boolean(req.user?.isMainAdmin) ||
                      req.headers['x-is-admin'] === 'true' ||
                      req.headers['x-operator-override'] === 'true';

      if (isAdmin) {
        logger.warn(`[updateInvoice] Admin override bypassed challan billing guard for invoice ${req.params.id}: ${guardErr.message}`);
      } else {
        return res.status(409).json({ success: false, error: guardErr.message });
      }
    }

    const clientVersion = req.body.version ?? req.body.clientVersion ?? req.headers['if-match-version'] ?? req.headers['if-match'];
    let invoice;
    await enrichInvoiceItemsWithImages(invoiceData);
    if (clientVersion !== undefined && clientVersion !== null && clientVersion !== '') {
      invoice = await updateWithOCC(BillingInvoice, req.params.id, clientVersion, invoiceData);
    } else {
      const updatePayload = { ...invoiceData, $inc: { version: 1 } };
      delete updatePayload.version;
      invoice = await BillingInvoice.findByIdAndUpdate(req.params.id, updatePayload, { new: true });
    }
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // Invalidate cached PDF on disk so subsequent downloads/prints immediately reflect edits
    invalidateInvoicePdfCache(req.params.id);

    // Sync linked Challans to INVOICED and revert unlinked ones to PENDING
    await syncChallanStatusForInvoice(invoice);
    await syncJobCardsForInvoice(invoice);

    // Auto-sync updated Invoice to Sister Company's Raw Material Inward
    try {
      const { syncInvoiceToSisterRawMaterial } = require('../utils/sisterCompanySync');
      await syncInvoiceToSisterRawMaterial(invoice);
    } catch (syncErr) {
      console.warn('[billing.updateInvoice] Sister company raw material sync warning:', syncErr.message);
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    if (error.statusCode === 409 || error.code === 'STALE_RECORD_CONFLICT') {
      return res.status(409).json({
        success: false,
        code: 'STALE_RECORD_CONFLICT',
        error: error.message,
        currentVersion: error.currentVersion,
        updatedByName: error.updatedByName,
        updatedAt: error.updatedAt
      });
    }
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

// ── 6B. MERGE CHALLANS TO INVOICE ───────────────────────────────────────────
const mergeChallans = async (req, res) => {
  try {
    const { challanIds } = req.body;
    if (!Array.isArray(challanIds) || challanIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Please select at least one Challan to merge.' });
    }

    // 1. Fetch Fabric Challans & Stitching Challans
    const fabricChallans = await FabricChallan.find({ _id: { $in: challanIds } }).lean();
    const stitchingChallans = await StitchingChallan.find({ _id: { $in: challanIds } }).lean();

    const allChallans = [...fabricChallans, ...stitchingChallans];
    if (allChallans.length === 0) {
      return res.status(404).json({ success: false, error: 'No matching Challans found.' });
    }

    // Strict Guard: Reject if any selected challan is already invoiced
    for (const ch of allChallans) {
      if (ch.status === 'INVOICED' || ch.billingStatus === 'INVOICED' || ch.isBilled || Boolean(ch.invoiceNo)) {
        return res.status(409).json({
          success: false,
          error: `Cannot generate bill: Challan #${ch.challanNo} has already been billed in Invoice #${ch.invoiceNo || 'N/A'}. A delivery challan cannot be billed a 2nd time.`
        });
      }
    }

    // 2. FLEXIBLE SAME-CUSTOMER VALIDATION CHECK
    const normalizeKey = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const customerKeys = new Set(
      allChallans.map(ch => normalizeKey(ch.billTo || ch.partyName)).filter(Boolean)
    );
    const partyNameKeys = new Set(
      allChallans.map(ch => normalizeKey(ch.partyName || ch.billTo)).filter(Boolean)
    );

    if (customerKeys.size > 1 && partyNameKeys.size > 1) {
      const partyList = [...new Set(allChallans.map(ch => ch.billTo || ch.partyName).filter(Boolean))].join(', ');
      return res.status(400).json({
        success: false,
        error: `Cannot merge Challans from different customers. Selected Challans belong to multiple customers: ${partyList}`
      });
    }

    // 3. AGGREGATE CUSTOMER DETAILS
    const rawParty = allChallans[0].billTo || allChallans[0].partyName || '';
    let customerObj = {
      name: rawParty,
      businessName: rawParty,
      phone: '',
      email: '',
      gstin: '',
      billingAddress: '',
      shippingAddress: '',
      state: 'Gujarat',
      stateCode: '24'
    };

    if (rawParty) {
      const cleanParty = rawParty.trim();
      const escapedParty = cleanParty.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matchedCust = await BillingCustomer.findOne({
        $or: [
          { name: { $regex: `^${escapedParty}$`, $options: 'i' } },
          { businessName: { $regex: `^${escapedParty}$`, $options: 'i' } },
          { name: { $regex: `^${escapedParty}\\b`, $options: 'i' } },
          { businessName: { $regex: `^${escapedParty}\\b`, $options: 'i' } },
          { name: { $regex: escapedParty, $options: 'i' } },
          { businessName: { $regex: escapedParty, $options: 'i' } }
        ]
      }).lean();
      if (matchedCust) {
        customerObj = {
          customerId: matchedCust._id,
          name: matchedCust.name || rawParty,
          businessName: matchedCust.businessName || matchedCust.name || rawParty,
          phone: matchedCust.phone || '',
          email: matchedCust.email || '',
          gstin: matchedCust.gstin || '',
          billingAddress: matchedCust.billingAddress || '',
          shippingAddress: matchedCust.shippingAddress || matchedCust.billingAddress || '',
          state: matchedCust.state || 'Gujarat',
          stateCode: matchedCust.stateCode || '24'
        };
      }
    }

    // 4. AGGREGATE LINE ITEMS (GROUPED BY CHALLAN NO)
    const items = [];
    const linkedChallanIds = [];
    const linkedChallanNos = [];
    const catalogItems = await BillingItem.find().lean();

    // Preload JobCards for all challan job numbers & design numbers
    const JobCard = require('../db/models/jobCard.model');
    const allChallanJobs = allChallans.map(ch => ch.jobNo).filter(Boolean);
    const allDesignNos = allChallans.map(ch => ch.designNo).filter(Boolean);
    const cleanJobNums = allChallanJobs.map(j => String(j).replace(/[^0-9]/g, '')).filter(Boolean);

    const jobOrQuery = [
      { jobNo: { $in: allChallanJobs } },
      { jobNo: { $in: cleanJobNums.map(n => `JOB-${n}`) } },
      { jobNo: { $in: cleanJobNums.map(n => `JOB NO.- ${n}`) } },
      { designNo: { $in: allDesignNos } },
    ];
    if (cleanJobNums.length > 0) {
      jobOrQuery.push({ jobNo: { $in: cleanJobNums } });
    }

    const foundJobCards = await JobCard.find({ $or: jobOrQuery }).select('jobNo designNo imageUrl1 imageUrl2 image').lean();
    const jobCardImgMap = new Map();
    foundJobCards.forEach(jc => {
      const img = jc.imageUrl1 || jc.imageUrl2 || jc.image || '';
      if (img) {
        if (jc.jobNo) jobCardImgMap.set(String(jc.jobNo).trim().toUpperCase(), img);
        const c = String(jc.jobNo || '').replace(/[^0-9]/g, '');
        if (c) jobCardImgMap.set(c, img);
        if (jc.designNo) jobCardImgMap.set(`DESIGN_${String(jc.designNo).trim().toUpperCase()}`, img);
      }
    });

    allChallans.forEach(ch => {
      const chNoStr = ch.challanNo
        ? (String(ch.challanNo).startsWith('PCH') || String(ch.challanNo).startsWith('EDP')
            ? String(ch.challanNo)
            : `EDP-${ch.challanNo}`)
        : `EDP-${ch._id}`;

      linkedChallanIds.push(String(ch._id));
      linkedChallanNos.push(chNoStr);

      const cleanChJob = String(ch.jobNo || '').replace(/[^0-9]/g, '');
      const defaultJobImg = ch.designImage || ch.imageUrl ||
        jobCardImgMap.get(String(ch.jobNo || '').trim().toUpperCase()) ||
        jobCardImgMap.get(cleanChJob) ||
        (ch.designNo ? jobCardImgMap.get(`DESIGN_${String(ch.designNo).trim().toUpperCase()}`) : '') || '';

      if (Array.isArray(ch.items) && ch.items.length > 0) {
        // Stitching Challan or Multi-item Challan
        ch.items.forEach(it => {
          const pcs = parseFloat(it.pcs) || 1;
          const rate = parseFloat(it.rate) || 0;
          const itemName = it.designNo ? `Design ${it.designNo}` : (it.particulars || 'Garment Work');
          const matched = catalogItems.find(cat => cat.itemName.trim().toLowerCase() === itemName.trim().toLowerCase());
          const unitPrice = matched?.unitPrice != null ? matched.unitPrice : rate;
          const taxRate = matched?.taxRate != null ? matched.taxRate : 5;

          const cleanItJob = String(it.jobNo || ch.jobNo || '').replace(/[^0-9]/g, '');
          const itemImg = it.imageUrl || defaultJobImg ||
            jobCardImgMap.get(String(it.jobNo || '').trim().toUpperCase()) ||
            jobCardImgMap.get(cleanItJob) ||
            (it.designNo ? jobCardImgMap.get(`DESIGN_${String(it.designNo).trim().toUpperCase()}`) : '') || '';

          items.push({
            itemName,
            description: `Challan ${chNoStr} | ${it.particulars || 'Stitching Work'}`,
            jobNo: ch.jobNo || it.jobNo || '',
            lotNo: ch.lotNo || it.lotNo || '',
            partyChallan: ch.vendorChallanNo ? String(ch.vendorChallanNo) : (ch.partyChallan ? String(ch.partyChallan) : ''),
            ourChallanNo: chNoStr,
            challanId: String(ch._id),
            isLocked: true, // MTR / PCS LOCKED
            imageUrl: itemImg,
            hsnCode: it.hsnCode || matched?.hsnCode || '6204',
            qty: pcs,
            unit: matched?.unit || 'Pcs',
            unitPrice,
            taxRate,
            totalAmount: parseFloat((pcs * unitPrice).toFixed(2))
          });
        });
      } else {
        // Digital Print Fabric Delivery Challan
        const mtr = parseFloat(ch.totalMtr || ch.pcs || 1);
        const pannaStr = String(ch.panna || '').trim();
        let itemName = 'DIGITAL PRINT JOB WORK 58"';
        if (pannaStr.includes('36')) itemName = 'DIGITAL PRINT JOB WORK 36"';
        else if (pannaStr.includes('44')) itemName = 'DIGITAL PRINT JOB WORK 44"';
        else if (pannaStr.includes('58')) itemName = 'DIGITAL PRINT JOB WORK 58"';
        else if (pannaStr) itemName = `DIGITAL PRINT JOB WORK ${pannaStr.replace(/['"]/g, '')}"`;

        const matched = catalogItems.find(cat => cat.itemName.trim().toLowerCase() === itemName.trim().toLowerCase());
        const hsnCode = matched?.hsnCode || '998821';
        const unitPrice = matched?.unitPrice != null ? matched.unitPrice : 25;
        const taxRate = matched?.taxRate != null ? matched.taxRate : 5;
        const unit = matched?.unit || 'Meters';

        items.push({
          itemName,
          description: `Challan ${chNoStr} | Fabric: ${ch.fabricName || 'Fabric'}`,
          fabric: ch.fabricName || '',
          fabricName: ch.fabricName || '',
          jobNo: ch.jobNo || '',
          lotNo: ch.lotNo || '',
          partyChallan: ch.vendorChallanNo ? String(ch.vendorChallanNo) : (ch.partyChallan ? String(ch.partyChallan) : ''),
          ourChallanNo: chNoStr,
          challanId: String(ch._id),
          isLocked: true, // MTR LOCKED
          imageUrl: defaultJobImg,
          hsnCode,
          qty: mtr,
          unit,
          unitPrice,
          taxRate,
          totalAmount: parseFloat((mtr * unitPrice).toFixed(2))
        });
      }
    });

    const deliveryByList = [...new Set(allChallans.map(ch => ch.deliveryBy).filter(Boolean))].join(', ');

    res.json({
      success: true,
      data: {
        customer: customerObj,
        items,
        linkedChallanIds,
        linkedChallanNos,
        deliveryBy: deliveryByList
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── 7. DELETE INVOICE ────────────────────────────────────────────────────────
const deleteInvoice = async (req, res) => {
  try {
    const invoice = await BillingInvoice.findByIdAndDelete(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const queryInv = {
      $or: [
        { invoiceId: invoice._id },
        { invoiceNo: invoice.invoiceNo }
      ]
    };
    await FabricChallan.updateMany(queryInv, { $set: { status: 'PENDING' }, $unset: { invoiceId: 1, invoiceNo: 1 } });
    await StitchingChallan.updateMany(queryInv, { $set: { status: 'PENDING' }, $unset: { invoiceId: 1, invoiceNo: 1 } });
    await syncJobCardsForInvoice(invoice);

    // Clean up sister company inward records for this deleted invoice
    try {
      const RawMaterialTransaction = require('../db/models/rawMaterialTransaction.model');
      await RawMaterialTransaction.deleteMany({ sourceDocId: invoice._id, sourceDocType: 'INVOICE' });
    } catch (delSyncErr) {
      console.warn('[billing.deleteInvoice] Clean up sister raw materials warning:', delSyncErr.message);
    }

    invalidateInvoicePdfCache(req.params.id);
    res.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── 8. RECORD PAYMENT FOR INVOICE ───────────────────────────────────────────
const recordPayment = async (req, res) => {
  try {
    const { amount, method, referenceNo, notes } = req.body;
    const paymentAmt = parseFloat(amount) || 0;

    if (paymentAmt <= 0) {
      return res.status(400).json({ success: false, error: 'Payment amount must be greater than 0' });
    }

    const invoice = await BillingInvoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const effectiveTds = invoice.enableTds ? Math.round(parseFloat(invoice.tdsAmount) || 0) : 0;
    invoice.paidAmount = parseFloat(((invoice.paidAmount || 0) + paymentAmt).toFixed(2));
    invoice.balanceDue = Math.max(0, parseFloat((invoice.grandTotal - effectiveTds - invoice.paidAmount).toFixed(2)));

    if (invoice.balanceDue === 0) {
      invoice.paymentStatus = 'PAID';
    } else {
      invoice.paymentStatus = 'PARTIALLY_PAID';
    }

    invoice.paymentHistory.push({
      date: new Date(),
      amount: paymentAmt,
      method: method || 'Bank Transfer',
      referenceNo: referenceNo || '',
      notes: notes || ''
    });

    await invoice.save();
    invalidateInvoicePdfCache(req.params.id);
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── ROBUST IMAGE RESOLVER FOR INVOICE PDF GENERATION ─────────────────────────
const findLocalImageByDesignToken = (dName) => {
  if (!dName) return null;
  const clean = String(dName).trim().replace(/^ED-/i, '');
  const pattern = new RegExp(`^(ED-)?${clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\([^)]+\\)|\\s.*)?\\.(jpg|jpeg|png|webp)$`, 'i');

  const possibleDirs = [
    path.join(__dirname, '../../elite_edition_images'),
    path.join(__dirname, '../../../elite_edition_images'),
    '/home/ubuntu/elite_edition_images',
    path.join(__dirname, '../elite_edition_images'),
    path.join(__dirname, '../../Digital print'),
    path.join(__dirname, '../../../Digital print'),
    '/home/ubuntu/Digital print',
    '/home/ubuntu/Node projects/Elite_Edition/Digital print',
    '/home/ubuntu/Node projects/Elite_Edition/elite_edition_images',
    path.join(process.cwd(), 'Digital print'),
    path.join(process.cwd(), 'elite_edition_images')
  ];

  for (const pDir of possibleDirs) {
    if (fs.existsSync(pDir)) {
      try {
        const files = fs.readdirSync(pDir);
        const matchedFile = files.find(f => pattern.test(f));
        if (matchedFile) return path.join(pDir, matchedFile);
      } catch (e) {}
    }
  }
  return null;
};

// Converts any image buffer or file (WebP, PNG, AVIF, HEIC, TIFF, JPEG) to a high-quality baseline JPEG buffer compatible with PDFKit
const ensureJpegBuffer = async (bufferOrFile) => {
  if (!bufferOrFile) return null;
  try {
    const sharp = require('sharp');
    return await sharp(bufferOrFile).jpeg({ quality: 92 }).toBuffer();
  } catch (sharpErr) {
    console.warn('ensureJpegBuffer conversion warning:', sharpErr.message);
    return bufferOrFile;
  }
};

const resolveInvoiceImagePath = async (urlOrPath, designNameHint = '', cache = null) => {
  if (!urlOrPath) return null;
  if (Buffer.isBuffer(urlOrPath)) {
    return await ensureJpegBuffer(urlOrPath);
  }

  const str = String(urlOrPath).trim();
  if (!str) return null;

  if (cache && cache.has(str)) return cache.get(str);

  // 1. Base64 Data URL
  if (str.startsWith('data:image/')) {
    try {
      const base64Data = str.split(',')[1];
      if (base64Data) {
        const rawBuf = Buffer.from(base64Data, 'base64');
        const jpegBuf = await ensureJpegBuffer(rawBuf);
        if (cache && jpegBuf) cache.set(str, jpegBuf);
        return jpegBuf;
      }
    } catch (e) {}
  }

  // 2. Direct local file path
  if (fs.existsSync(str) && fs.statSync(str).isFile()) {
    const jpegBuf = await ensureJpegBuffer(str);
    if (cache && jpegBuf) cache.set(str, jpegBuf);
    return jpegBuf;
  }

  // 3. Remote HTTP / HTTPS URL (Cloudflare R2, Google Drive, AWS S3, CloudFront)
  const { normalizeImageUrl } = require('../utils/imageUrlHelper');
  let targetUrl = str;
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    const norm = normalizeImageUrl(str, designNameHint);
    if (norm && (norm.startsWith('http://') || norm.startsWith('https://'))) {
      targetUrl = norm;
    }
  }

  if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
    try {
      const axios = require('axios');
      const r = await axios.get(targetUrl, {
        responseType: 'arraybuffer',
        timeout: 2500,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (r.data) {
        const rawBuf = Buffer.isBuffer(r.data) ? r.data : Buffer.from(r.data);
        const jpegBuf = await ensureJpegBuffer(rawBuf);
        if (cache && jpegBuf) cache.set(str, jpegBuf);
        return jpegBuf;
      }
    } catch (netErr) {
      console.warn('resolveInvoiceImagePath download error for', targetUrl, netErr.message);
    }
  }

  // 4. Local directories check for filename
  let filename = str.replace(/^.*\/designs\//, '').replace(/^\/designs\//, '').replace(/^.*\/uploads\//, '').trim();
  try { filename = decodeURIComponent(filename); } catch(e) {}
  filename = filename.split('?')[0].split('#')[0];

  const dirs = [
    path.join(__dirname, '../../elite_edition_images'),
    path.join(__dirname, '../../../elite_edition_images'),
    '/home/ubuntu/elite_edition_images',
    path.join(__dirname, '../elite_edition_images'),
    path.join(__dirname, '../../Digital print'),
    path.join(__dirname, '../../../Digital print'),
    '/home/ubuntu/Digital print',
    '/home/ubuntu/Node projects/Elite_Edition/Digital print',
    '/home/ubuntu/Node projects/Elite_Edition/elite_edition_images',
    path.join(process.cwd(), 'Digital print'),
    path.join(process.cwd(), 'elite_edition_images')
  ];

  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    const direct = path.join(d, filename);
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) {
      const jpegBuf = await ensureJpegBuffer(direct);
      if (cache && jpegBuf) cache.set(str, jpegBuf);
      return jpegBuf;
    }
    try {
      const f = fs.readdirSync(d).find(x => x.toLowerCase() === filename.toLowerCase());
      if (f) {
        const fullP = path.join(d, f);
        if (fs.statSync(fullP).isFile()) {
          const jpegBuf = await ensureJpegBuffer(fullP);
          if (cache && jpegBuf) cache.set(str, jpegBuf);
          return jpegBuf;
        }
      }
    } catch(e) {}
  }

  // 5. Check exact design token ONLY if designNameHint or filename starts with ED-
  const tokenToSearch = designNameHint || (filename.match(/^ED-?\d+/i) ? filename.replace(/\.[^.]+$/, '') : '');
  if (tokenToSearch) {
    const found = findLocalImageByDesignToken(tokenToSearch);
    if (found) {
      const jpegBuf = await ensureJpegBuffer(found);
      if (cache && jpegBuf) cache.set(str, jpegBuf);
      return jpegBuf;
    }
  }

  return null;
};

// Helper to resolve exact images for invoice line items without mismatched fallbacks
const resolveItemsImages = async (items, jobCardMap, cache) => {
  return Promise.all(items.map(async (item) => {
    // 1. Direct item.imageUrl (the perfect exact image assigned to this item)
    if (item.imageUrl) {
      const res = await resolveInvoiceImagePath(item.imageUrl, item.designNo || item.itemName, cache);
      if (res) return res;
    }

    // 2. Strict job card lookup using item.jobNo
    if (item.jobNo) {
      const nums = String(item.jobNo).match(/\d+/g) || [];
      for (const num of nums) {
        const jd = jobCardMap[num];
        if (jd) {
          const url = jd.imageUrl1 || jd.imageUrl2 || jd.image || jd.proofing?.artworkUrl;
          if (url) {
            const res = await resolveInvoiceImagePath(url, jd.designNo || jd.designName, cache);
            if (res) return res;
          }
          const des = jd.designNo || jd.designName;
          if (des) {
            const res = await resolveInvoiceImagePath(des, des, cache);
            if (res) return res;
          }
        }
      }
    }

    // 3. Fallback: explicit item.designNo
    if (item.designNo) {
      const res = await resolveInvoiceImagePath(item.designNo, item.designNo, cache);
      if (res) return res;
      try {
        const Design = require('../db/models/design.model');
        const dDoc = await Design.findOne({ $or: [{ designNo: item.designNo }, { designName: item.designNo }] }).lean();
        if (dDoc && (dDoc.imageUrl || dDoc.thumbnailUrl)) {
          const res = await resolveInvoiceImagePath(dDoc.imageUrl || dDoc.thumbnailUrl, item.designNo, cache);
          if (res) return res;
        }
      } catch (e) {}
    }

    // 4. Fallback: Design No extracted from item.description or item.itemName (e.g. "Design No: ED-740")
    const descText = `${item.description || ''} ${item.itemName || ''}`;
    const designMatch = descText.match(/Design\s*(?:No\.?|#)?\s*:?\s*([A-Za-z0-9_-]+)/i);
    if (designMatch && designMatch[1]) {
      const dCode = designMatch[1].trim();
      const res = await resolveInvoiceImagePath(dCode, dCode, cache);
      if (res) return res;
      try {
        const Design = require('../db/models/design.model');
        const dDoc = await Design.findOne({ $or: [{ designNo: dCode }, { designName: dCode }] }).lean();
        if (dDoc && (dDoc.imageUrl || dDoc.thumbnailUrl)) {
          const res = await resolveInvoiceImagePath(dDoc.imageUrl || dDoc.thumbnailUrl, dCode, cache);
          if (res) return res;
        }
      } catch (e) {}
    }

    // 5. Fallback: check if item.challanId is linked to a FabricChallan
    if (item.challanId) {
      try {
        const FabricChallan = require('../db/models/fabricChallan.model');
        const chDoc = await FabricChallan.findById(item.challanId).lean();
        if (chDoc && (chDoc.designImage || chDoc.imageUrl)) {
          const res = await resolveInvoiceImagePath(chDoc.designImage || chDoc.imageUrl, chDoc.designNo, cache);
          if (res) return res;
        }
      } catch (e) {}
    }

    // 6. Fallback: check item.ourChallanNo in FabricChallan (e.g. EDP-1262)
    if (item.ourChallanNo) {
      try {
        const chNumMatch = String(item.ourChallanNo).match(/\d+/);
        if (chNumMatch) {
          const FabricChallan = require('../db/models/fabricChallan.model');
          const chDoc = await FabricChallan.findOne({ challanNo: Number(chNumMatch[0]) }).lean();
          if (chDoc && (chDoc.designImage || chDoc.imageUrl)) {
            const res = await resolveInvoiceImagePath(chDoc.designImage || chDoc.imageUrl, chDoc.designNo, cache);
            if (res) return res;
          }
        }
      } catch (e) {}
    }

    return null;
  }));
};

const cleanJobDisplay = (jobStr) => {
  if (!jobStr) return '';
  const matches = String(jobStr).match(/\d+/g);
  if (matches && matches.length > 0) {
    const unique = [...new Set(matches)];
    return unique.length === 1 ? `Job Card: ${unique[0]}` : `Job Cards: ${unique.join(', ')}`;
  }
  return String(jobStr).replace(/JOB NO\.-?\s*/gi,'').replace(/Job\s*#?\s*/gi,'').trim();
};

const getInvoicePageChunks = (items, maxNonLast = 6, maxLast = 5) => {
  const total = (items || []).length;
  if (total <= maxLast) return [items || []];
  const pagesNeeded = 1 + Math.ceil((total - maxLast) / maxNonLast);
  const chunkSizes = new Array(pagesNeeded).fill(0);
  let remaining = total;
  for (let p = 0; p < pagesNeeded - 1; p++) {
    const pagesLeftAfterThis = pagesNeeded - 1 - p;
    let size = Math.ceil(remaining / (pagesLeftAfterThis + 1));
    if (size > maxNonLast) size = maxNonLast;
    if (remaining - size < pagesLeftAfterThis) size = remaining - pagesLeftAfterThis;
    const maxCapacityRemaining = (pagesLeftAfterThis - 1) * maxNonLast + maxLast;
    if (remaining - size > maxCapacityRemaining) size = remaining - maxCapacityRemaining;
    chunkSizes[p] = size;
    remaining -= size;
  }
  chunkSizes[pagesNeeded - 1] = remaining;
  const chunks = [];
  let curr = 0;
  for (const s of chunkSizes) {
    chunks.push((items || []).slice(curr, curr + s));
    curr += s;
  }
  return chunks;
};

// ── 9. DOWNLOAD INVOICE PDF ──────────────────────────────────────────────────
const downloadInvoicePdf = async (req, res) => {
  const startTime = Date.now();
  try {
    const invoice = await BillingInvoice.findById(req.params.id).lean();
    if (!invoice) return res.status(404).send('Invoice not found');

    const includeDuplicate = req.query?.duplicate === 'true';

    const noCache = req.query?.nocache === 'true' || req.query?.refresh === 'true';

    // Fast Disk Caching for Invoice PDFs to eliminate 25s hangs on preview
    const cacheDir = path.join(__dirname, '../../uploads/cached_invoices');
    if (!fs.existsSync(cacheDir)) {
      try { fs.mkdirSync(cacheDir, { recursive: true }); } catch (e) {}
    }
    const rawUpdatedAt = invoice.updated_at || invoice.updatedAt || invoice.created_at || invoice.createdAt;
    const invUpdatedAt = rawUpdatedAt ? new Date(rawUpdatedAt).getTime() : (invoice.version || 0);
    const cacheFileName = `inv_${invoice._id}_${invUpdatedAt}_${includeDuplicate ? 'dup' : 'orig'}.pdf`;
    const cachedFilePath = path.join(cacheDir, cacheFileName);

    if (!noCache && fs.existsSync(cachedFilePath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Invoice_${invoice.invoiceNo}.pdf"`);
      return fs.createReadStream(cachedFilePath).pipe(res);
    }

    await enrichInvoiceItemsWithImages(invoice);

    // Ensure customer details are up to date from BillingCustomer
    if (invoice.customer) {
      try {
        const BillingCustomer = require('../db/models/billingCustomer.model');
        let matchedCustomer = null;
        if (invoice.customer.customerId) {
          matchedCustomer = await BillingCustomer.findById(invoice.customer.customerId).lean();
        }
        if (!matchedCustomer && invoice.customer.name) {
          const cleanName = invoice.customer.name.trim();
          matchedCustomer = await BillingCustomer.findOne({
            $or: [
              { name: cleanName },
              { businessName: cleanName },
              { name: { $regex: `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, $options: 'i' } }
            ]
          }).lean();
        }
        if (matchedCustomer) {
          invoice.customer = {
            ...matchedCustomer,
            ...invoice.customer,
            name: matchedCustomer.name || invoice.customer.name,
            businessName: matchedCustomer.businessName || invoice.customer.businessName || matchedCustomer.name,
            gstin: matchedCustomer.gstin || invoice.customer.gstin,
            billingAddress: matchedCustomer.billingAddress || invoice.customer.billingAddress,
            state: matchedCustomer.state || invoice.customer.state || 'Gujarat',
            stateCode: matchedCustomer.stateCode || invoice.customer.stateCode || '24'
          };
        }
      } catch (custErr) {
        if (typeof logger !== 'undefined' && logger.warn) logger.warn(`Customer enrichment warning in PDF: ${custErr.message}`);
      }
    }

    const PrintConfig = require('../db/models/printConfig.model');
    const JobCard = require('../db/models/jobCard.model');
    const companyEntity = invoice.companyEntity || 'Elite Digital Print';
    const config = await PrintConfig.findOne({ companyEntity }).lean() || await PrintConfig.findOne({ isConfig: true }).lean() || {};

    const rawCompName = config.companyName || companyEntity.toUpperCase();
    const companyDisplayName = rawCompName.replace(/\s*\([^)]*\)/g, '').trim();
    const companyGstin   = config.companyGstin || '';
    const companyAddress = config.companyAddress || '';
    const companyPhone   = config.companyPhone || '';
    const companyState   = config.companyState || 'Gujarat';
    const companyStateCode = config.companyStateCode || '24';
    const companyTerms   = invoice.terms || config.companyTerms ||
      'Payment due within 30 days from invoice date. Subject to Surat jurisdiction.';
    const bankName   = config.companyBankName || '';
    const bankAcNo   = config.companyAccountNo || '';
    const bankIfsc   = config.companyIfscCode || '';

    const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: true, bufferPages: true, autoPageBreak: false });
    doc.options.autoPageBreak = false;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice_${invoice.invoiceNo}.pdf"`);
    doc.pipe(res);

    const tempCachedPath = `${cachedFilePath}.tmp_${Date.now()}`;
    const fileStream = fs.createWriteStream(tempCachedPath);
    doc.pipe(fileStream);

    fileStream.on('finish', () => {
      try {
        fs.renameSync(tempCachedPath, cachedFilePath);
      } catch (e) {}
    });

    const PW = 595.28, PH = 841.89;
    const PAD = 18;
    const CW = PW - PAD * 2;
    let logoBufferOrPath = path.join(__dirname, 'Logo.png');
    if (config.companyLogo && typeof config.companyLogo === 'string' && config.companyLogo.trim()) {
      const logoStr = config.companyLogo.trim();
      if (logoStr.startsWith('data:image/')) {
        try {
          const base64Data = logoStr.split(',')[1];
          if (base64Data) {
            logoBufferOrPath = Buffer.from(base64Data, 'base64');
          }
        } catch (e) {}
      } else if (fs.existsSync(logoStr)) {
        logoBufferOrPath = logoStr;
      }
    }

    // ── HELPERS ─────────────────────────────────────────────────────────────────
    const formatDate = (d) => {
      if (!d) return '--';
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return `${String(dt.getDate()).padStart(2,'0')}-${String(dt.getMonth()+1).padStart(2,'0')}-${dt.getFullYear()}`;
    };

    // ── COLUMN WIDTHS ────────────────────────────────────────────────────────────
    const COL = [20, 52, 180, 50, 34, 56, 54, 30, 83.28];
    const colX = COL.reduce((acc, w, i) => { acc.push((acc[i-1]||PAD) + (i>0?COL[i-1]:0)); return acc; }, []);

    // ── OPTIMIZED HIGH-SPEED PRE-LOAD IMAGES (STRICT JOB NUMBER MATCHING ONLY) ──
    const items = invoice.items || [];
    const imageCache = new Map();

    const allJobNumsSet = new Set();
    items.forEach(it => {
      const textToScan = [it.jobNo, it.description, it.itemName].filter(Boolean).join(' ');
      const matches = textToScan.match(/\d+/g) || [];
      matches.forEach(n => {
        if (n.length >= 2 && n.length <= 6) allJobNumsSet.add(n);
      });
    });
    const jobNumArray = Array.from(allJobNumsSet);

    const jobCardMap = {};
    if (jobNumArray.length > 0) {
      try {
        const queryOr = [];
        jobNumArray.forEach(n => {
          queryOr.push({ jobNo: n }, { jobNo: `JOB-${n}` }, { jobNo: `JOB NO.- ${n}` }, { jobNo: `JOB NO.-${n}` }, { jobNo: Number(n) });
        });
        const foundJobCards = await JobCard.find({ $or: queryOr }).select('jobNo designNo designName imageUrl1 imageUrl2 image proofing.artworkUrl').lean();
        foundJobCards.forEach(jc => {
          const nums = String(jc.jobNo).match(/\d+/g) || [];
          nums.forEach(n => { if (!jobCardMap[n]) jobCardMap[n] = jc; });
        });
      } catch(e) {}
    }

    const itemImages = await resolveItemsImages(items, jobCardMap, imageCache);

    const taxType = invoice.taxType || (invoice.customer && invoice.customer.stateCode && String(invoice.customer.stateCode).trim() !== '24' ? 'IGST' : 'CGST_SGST');
    const isIgst = taxType === 'IGST';

    const hsnMap = {};
    items.forEach(it => {
      const hsn  = it.hsnCode || '998821';
      const rate = Number(it.taxRate !== undefined && it.taxRate !== null ? it.taxRate : 5);
      const key  = `${hsn}_${rate}`;
      if (!hsnMap[key]) hsnMap[key] = { hsn, rate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      const taxable = Number(it.totalAmount || 0);
      hsnMap[key].taxable += taxable;
      if (isIgst) {
        hsnMap[key].igst += taxable * (rate / 100);
      } else {
        hsnMap[key].cgst += taxable * (rate / 2 / 100);
        hsnMap[key].sgst += taxable * (rate / 2 / 100);
      }
    });
    const hsnRows      = Object.values(hsnMap);
    const totalTaxable = hsnRows.reduce((s, r) => s + r.taxable, 0);
    const totalCgst    = hsnRows.reduce((s, r) => s + r.cgst,    0);
    const totalSgst    = hsnRows.reduce((s, r) => s + r.sgst,    0);
    const totalIgst    = hsnRows.reduce((s, r) => s + r.igst,    0);
    const totalTax     = isIgst ? totalIgst : (totalCgst + totalSgst);

    let delByVal = invoice.deliveryBy || '';
    if (!delByVal && Array.isArray(invoice.linkedChallanIds) && invoice.linkedChallanIds.length > 0) {
      try {
        const FabricChallan = require('../db/models/fabricChallan.model');
        const StitchingChallan = require('../db/models/stitchingChallan.model');
        const fChs = await FabricChallan.find({ _id: { $in: invoice.linkedChallanIds } }, 'deliveryBy').lean();
        const sChs = await StitchingChallan.find({ _id: { $in: invoice.linkedChallanIds } }, 'deliveryBy').lean();
        const allDel = [...fChs, ...sChs].map(c => c.deliveryBy).filter(Boolean);
        if (allDel.length > 0) delByVal = [...new Set(allDel)].join(', ');
      } catch(e) {}
    }
    if (!delByVal) delByVal = 'By Road';

    const renderPage = (copyLabel, bw = false) => {
      const c = (color, bwFallback) => bw ? (bwFallback || '#000000') : color;
      const PRP  = c('#4c1d95', '#000000');
      const PRPM = c('#6b21a8', '#000000');
      const PRPL = c('#ede9fe', '#f0f0f0');
      const S900 = c('#000000', '#000000');
      const S700 = c('#000000', '#000000');
      const S500 = c('#000000', '#000000');
      const S200 = c('#e2e8f0', '#cccccc');
      const S50  = c('#f8fafc', '#f9f9f9');
      const WHT  = '#ffffff';

      const pageChunks = getInvoicePageChunks(items, 6, 5);
      const totalPages = pageChunks.length;

      const drawHeader = (pageLabel) => {
        let Y = PAD;

        doc.rect(PAD, Y, CW, PH - PAD * 2).stroke(S200);
        doc.rect(PAD, Y, CW, 4).fill(PRP);
        Y += 4;

        const hdrH = 62;
        doc.rect(PAD, Y, CW, hdrH).fill(S50);

        if (logoBufferOrPath) {
          try { doc.image(logoBufferOrPath, PAD + 6, Y + 6, { width: 110, height: 50, fit: [110, 50] }); } catch(e) {}
        }

        doc.fillColor(S900).fontSize(12).font('Helvetica-Bold')
          .text(`${companyDisplayName.toUpperCase()} (${companyGstin})`, PAD + 120, Y + 6, { width: CW - 126, align: 'right' });
        doc.fillColor(S500).fontSize(8).font('Helvetica')
          .text(companyAddress.toUpperCase(), PAD + 120, Y + 22, { width: CW - 126, align: 'right' })
          .text(`PHONE: ${companyPhone}   STATE: ${companyState}, CODE: ${companyStateCode}`,
                PAD + 120, Y + 34, { width: CW - 126, align: 'right' });

        Y += hdrH;

        const titleH = 22;
        doc.rect(PAD, Y, CW, titleH).fill(PRPL);
        doc.fillColor(PRP).fontSize(14).font('Helvetica-Bold').text('TAX INVOICE', PAD, Y + 4, { width: CW, align: 'center' });
        doc.fillColor(S900).fontSize(10).font('Helvetica-Bold')
          .text(`Date: ${formatDate(invoice.invoiceDate)}`, PAD + CW - 180, Y + 5, { width: 175, align: 'right' });
        Y += titleH;

        const cust   = invoice.customer || {};
        const halfCW = Math.floor(CW / 2);

        const rawChallanStr = invoice.ourChallanNo || (invoice.linkedChallanNos && invoice.linkedChallanNos.join(', ')) || invoice.challanNo || '--';

        // Calculate dynamic height for BILL TO box
        const custNameStr   = cust.businessName || cust.name || '--';
        const custGstStr    = cust.gstin && cust.gstin !== 'N/A' ? ` (GST: ${cust.gstin})` : '';
        const fullCustTitle = `${custNameStr}${custGstStr}`;

        let custY = Y + 16;
        doc.font('Helvetica-Bold').fontSize(9.5);
        custY += doc.heightOfString(fullCustTitle, { width: halfCW - 10 }) + 3;

        if (cust.billingAddress && cust.billingAddress.trim() && cust.billingAddress.trim() !== '--') {
          doc.font('Helvetica').fontSize(8);
          custY += doc.heightOfString(cust.billingAddress.trim(), { width: halfCW - 10 }) + 3;
        }
        custY += 14; // For State and Code line

        // Calculate dynamic height for SELLER / DISPATCH box
        const rx = PAD + halfCW;
        const metaW = (CW - halfCW) / 2 - 5;
        const pairs = [
          ['Challan No.', rawChallanStr, 'Tax Invoice No.', invoice.invoiceNo || '--'],
          ['', '', 'Terms of Delivery', delByVal],
        ];
        if (totalPages > 1 && pageLabel) {
          pairs.push(['Page', pageLabel, '', '']);
        }

        let testMetaY = Y + 16;
        pairs.forEach(([k1, v1, k2, v2]) => {
          doc.font('Helvetica-Bold').fontSize(8);
          const vh1 = v1 ? doc.heightOfString(v1, { width: metaW }) : 0;
          const vh2 = v2 ? doc.heightOfString(v2, { width: metaW }) : 0;
          const leftH = (k1 ? 8 : 0) + vh1;
          const rightH = (k2 ? 8 : 0) + vh2;
          const rowH = Math.max(leftH, rightH, (k1 || k2 || v1 || v2) ? 12 : 0) + 4;
          testMetaY += rowH;
        });

        const infoH = Math.max(76, custY - Y, testMetaY - Y + 4);

        // Render Boxes
        doc.rect(PAD, Y, halfCW, infoH).fill(WHT).stroke(S200);
        doc.rect(PAD, Y, halfCW, 14).fill(PRP);
        doc.fillColor(WHT).fontSize(8.5).font('Helvetica-Bold')
          .text('BILL TO', PAD + 5, Y + 3, { width: halfCW - 10 });

        let drawCustY = Y + 16;
        doc.fillColor(S900).fontSize(9.5).font('Helvetica-Bold')
          .text(fullCustTitle, PAD + 5, drawCustY, { width: halfCW - 10 });
        drawCustY += doc.heightOfString(fullCustTitle, { width: halfCW - 10 }) + 3;

        if (cust.billingAddress && cust.billingAddress.trim() && cust.billingAddress.trim() !== '--') {
          const addrStr = cust.billingAddress.trim();
          doc.fillColor(S700).fontSize(8).font('Helvetica')
            .text(addrStr, PAD + 5, drawCustY, { width: halfCW - 10 });
          doc.font('Helvetica').fontSize(8);
          drawCustY += doc.heightOfString(addrStr, { width: halfCW - 10 }) + 3;
        }

        doc.fillColor(S500).fontSize(8).font('Helvetica')
          .text(`State: ${cust.state || 'Gujarat'}, Code: ${cust.stateCode || '24'}`, PAD + 5, drawCustY);

        doc.rect(rx, Y, CW - halfCW, infoH).fill(WHT).stroke(S200);
        doc.rect(rx, Y, CW - halfCW, 14).fill(PRP);
        doc.fillColor(WHT).fontSize(8.5).font('Helvetica-Bold')
          .text('SELLER / DISPATCH DETAILS', rx + 5, Y + 3, { width: CW - halfCW - 10 });

        let metaY = Y + 16;
        pairs.forEach(([k1, v1, k2, v2]) => {
          doc.font('Helvetica-Bold').fontSize(8);
          const vh1 = v1 ? doc.heightOfString(v1, { width: metaW }) : 0;
          const vh2 = v2 ? doc.heightOfString(v2, { width: metaW }) : 0;
          const leftH = (k1 ? 8 : 0) + vh1;
          const rightH = (k2 ? 8 : 0) + vh2;
          const rowH = Math.max(leftH, rightH, (k1 || k2 || v1 || v2) ? 12 : 0) + 4;

          if (k1 || v1) {
            if (k1) {
              doc.fillColor(S500).fontSize(7).font('Helvetica')
                .text(k1 + ':', rx + 4, metaY, { width: metaW });
            }
            if (v1) {
              const valY = k1 ? metaY + 8 : metaY;
              doc.fillColor(S900).fontSize(8).font('Helvetica-Bold')
                .text(v1, rx + 4, valY, { width: metaW });
            }
          }
          if (k2 || v2) {
            if (k2) {
              doc.fillColor(S500).fontSize(7).font('Helvetica')
                .text(k2 + ':', rx + metaW + 10, metaY, { width: metaW });
            }
            if (v2) {
              const valY = k2 ? metaY + 8 : metaY;
              doc.fillColor(S900).fontSize(8).font('Helvetica-Bold')
                .text(v2, rx + metaW + 10, valY, { width: metaW });
            }
          }
          metaY += rowH;
        });

        Y += infoH;
        return Y;
      };

      const drawItemsTable = (startY, itemsToRender, startIdx, isLastPage, minBottomY) => {
        let Y = startY;

        const tblHdrH = 22;
        doc.rect(PAD, Y, CW, tblHdrH).fill(PRP);
        doc.fillColor(WHT).fontSize(9.5).font('Helvetica-Bold');
        const hdrs   = ['Sr.', 'Image', 'Description of Goods', 'HSN', 'GST%', 'Qty', 'Rate', 'Per', 'Amount'];
        const aligns = ['left','center','left','center','center','center','right','center','right'];
        hdrs.forEach((h, i) => doc.text(h, colX[i] + 2, Y + 7, { width: COL[i] - 4, align: aligns[i] }));
        Y += tblHdrH;

        const drawColSeps = (rowY, rowH) => {
          colX.slice(1).forEach(cx => {
            doc.moveTo(cx, rowY).lineTo(cx, rowY + rowH).strokeColor(S200).lineWidth(0.4).stroke();
          });
        };

        let targetRowHPerItem = 82;
        if (isLastPage && minBottomY && itemsToRender.length > 0) {
          const availH = minBottomY - Y;
          const dynamicRowH = Math.floor(availH / itemsToRender.length);
          targetRowHPerItem = Math.min(82, Math.max(62, dynamicRowH));
        }

        itemsToRender.forEach((item, localIdx) => {
          const idx = startIdx + localIdx;
          const rowBg = localIdx % 2 === 0 ? WHT : S50;

          const metaLines = [];

          // 1. Design No (from item or jobCardMap)
          let designStr = item.designNo || '';
          if (!designStr && item.jobNo) {
            const matches = String(item.jobNo).match(/\d+/g) || [];
            for (const n of matches) {
              if (jobCardMap[n]) {
                designStr = jobCardMap[n].designNo || jobCardMap[n].designName || '';
                if (designStr) break;
              }
            }
          }
          if (designStr) {
            metaLines.push({ text: `Design No: ${designStr}`, font: 'Helvetica-Bold', size: 8, color: PRP });
          }

          // 2. Job Card & Delivery Challan
          const jd = cleanJobDisplay(item.jobNo);
          const chNo = item.ourChallanNo || '';
          const line1 = [];
          if (jd) line1.push(jd);
          if (chNo) line1.push(`Challan: ${chNo}`);
          if (line1.length) metaLines.push({ text: line1.join('   |   '), font: 'Helvetica-Bold', size: 8, color: PRPM });

          // 3. Fabric & Lot
          const line2 = [];
          const fab = item.fabric || item.fabricName || '';
          if (fab) line2.push(`Fabric: ${fab}`);
          if (item.lotNo) line2.push(`Lot: ${item.lotNo}`);
          if (line2.length) metaLines.push({ text: line2.join('   |   '), font: 'Helvetica', size: 7.5, color: S700 });

          // 4. Party Challan (standalone line, never truncated)
          if (item.partyChallan) {
            metaLines.push({ text: `Party Challan: ${item.partyChallan}`, font: 'Helvetica-Bold', size: 7.5, color: S900 });
          }

          // 5. Additional custom description or notes
          if (item.description) {
            const cleanDesc = item.description
              .replace(new RegExp(`Challan\\s*${chNo}`, 'i'), '')
              .replace(new RegExp(`Fabric:\\s*${fab}`, 'i'), '')
              .replace(/^[|\s]+|[|\s]+$/g, '').trim();
            if (cleanDesc && cleanDesc.length > 1 && !metaLines.some(m => m.text.includes(cleanDesc))) {
              metaLines.push({ text: cleanDesc, font: 'Helvetica-Oblique', size: 7, color: S500 });
            }
          }

          doc.font('Helvetica-Bold').fontSize(10);
          let descH = doc.heightOfString(item.itemName || '--', { width: COL[2] - 6 });
          metaLines.forEach(m => {
            doc.font(m.font).fontSize(m.size);
            descH += doc.heightOfString(m.text, { width: COL[2] - 6 }) + 1.5;
          });
          const rowH = Math.max(targetRowHPerItem, descH + 10);

          doc.rect(PAD, Y, CW, rowH).fill(rowBg).stroke(S200);
          drawColSeps(Y, rowH);

          const contentPadY = Math.max(5, Math.floor((rowH - descH) / 2));
          const numY = Y + Math.max(6, Math.floor((rowH - 12) / 2));

          doc.fillColor(S700).fontSize(9.5).font('Helvetica-Bold')
            .text(String(idx + 1), colX[0] + 2, numY, { width: COL[0] - 2, align: 'center' });

          const imgPath = itemImages[idx];
          const imgMaxW = COL[1] - 6;
          const imgMaxH = Math.min(rowH - 8, 70);
          const hasImage = imgPath && (Buffer.isBuffer(imgPath) || (typeof imgPath === 'string' && fs.existsSync(imgPath)));
          if (hasImage) {
            try {
              const imgY = Y + Math.max(4, Math.floor((rowH - imgMaxH) / 2));
              doc.image(imgPath, colX[1] + 3, imgY, { fit: [imgMaxW, imgMaxH], align: 'center', valign: 'center' });
            } catch(e) {
              doc.fillColor(S200).fontSize(7).font('Helvetica')
                .text('N/A', colX[1], numY, { width: COL[1], align: 'center' });
            }
          } else {
            doc.fillColor(S200).fontSize(7).font('Helvetica')
              .text('N/A', colX[1], numY, { width: COL[1], align: 'center' });
          }

          let textY = Y + contentPadY;
          doc.fillColor(S900).font('Helvetica-Bold').fontSize(10);
          doc.text(item.itemName || '--', colX[2] + 3, textY, { width: COL[2] - 6 });
          textY += 13;
          metaLines.forEach(m => {
            doc.font(m.font).fontSize(m.size).fillColor(m.color);
            doc.text(m.text, colX[2] + 3, textY, { width: COL[2] - 6 });
            textY += 11;
          });

          const taxRate = item.taxRate || 5;
          let u = (item.unit || 'MTR').trim();
          if (/meter|mtr/i.test(u)) u = 'MTR';
          doc.fillColor(S700).font('Helvetica').fontSize(9.5)
            .text(item.hsnCode || '998821', colX[3] + 2, numY, { width: COL[3] - 4, align: 'center' })
            .text(`${taxRate}%`,            colX[4] + 2, numY, { width: COL[4] - 4, align: 'center' });
          doc.fillColor(S900).font('Helvetica').fontSize(10)
            .text(`${Number(item.qty||0).toFixed(2)} ${u}`, colX[5]+2, numY, { width: COL[5]-4, align:'center' })
            .text(Number(item.unitPrice||0).toFixed(2), colX[6]+2, numY, { width: COL[6]-4, align:'right' });
          doc.fillColor(S500).font('Helvetica').fontSize(8.5)
            .text(u, colX[7]+2, numY, { width: COL[7]-4, align:'center' });
          doc.fillColor(S900).font('Helvetica').fontSize(10.5)
            .text(Number(item.totalAmount||0).toFixed(2), colX[8]+2, numY, { width: COL[8]-4, align:'right' });
          Y += rowH;
        });

        // Fill remaining table height so table reaches minBottomY
        if (minBottomY && Y < minBottomY) {
          const fillH = minBottomY - Y;
          doc.rect(PAD, Y, CW, fillH).fill(WHT).stroke(S200);
          drawColSeps(Y, fillH);
          Y = minBottomY;
        }

        if (isLastPage) {
          const grandTotalQty = (items || []).reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
          let qtyUnit = (items && items[0] && (items[0].unit || items[0].qtyUnit)) || 'MTR';
          if (/meter|mtr/i.test(qtyUnit)) qtyUnit = 'MTR';
          const subRowH = 18;
          doc.rect(PAD, Y, CW, subRowH).fill(PRPL).stroke(S200);
          drawColSeps(Y, subRowH);
          doc.fillColor(PRP).fontSize(8.5).font('Helvetica-Bold')
            .text('Total Qty:', colX[0] + 3, Y + 4, { width: colX[5] - colX[0] - 6, align: 'right' });
          doc.fillColor(PRP).fontSize(9).font('Helvetica-Bold')
            .text(`${grandTotalQty.toFixed(2)} ${qtyUnit}`, colX[5] + 2, Y + 4, { width: COL[5] - 4, align: 'center' });
          doc.fillColor(PRP).fontSize(9).font('Helvetica-Bold')
            .text(Number(totalTaxable || 0).toFixed(2), colX[8] + 2, Y + 4, { width: COL[8] - 4, align: 'right' });
          Y += subRowH;
        } else {
          const pageQty = (itemsToRender || []).reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
          let qtyUnit = (items && items[0] && (items[0].unit || items[0].qtyUnit)) || 'MTR';
          if (/meter|mtr/i.test(qtyUnit)) qtyUnit = 'MTR';
          const pageAmt = (itemsToRender || []).reduce((s, i) => s + (parseFloat(i.totalAmount) || 0), 0);
          const subRowH = 18;
          doc.rect(PAD, Y, CW, subRowH).fill(PRPL).stroke(S200);
          drawColSeps(Y, subRowH);
          doc.fillColor(PRPM).fontSize(8).font('Helvetica-Bold')
            .text('Page Subtotal (Continued on Next Page...):', colX[0] + 3, Y + 4, { width: colX[5] - colX[0] - 6, align: 'right' });
          doc.fillColor(PRPM).fontSize(8.5).font('Helvetica-Bold')
            .text(`${pageQty.toFixed(2)} ${qtyUnit}`, colX[5] + 2, Y + 4, { width: COL[5] - 4, align: 'center' });
          doc.fillColor(PRPM).fontSize(8.5).font('Helvetica-Bold')
            .text(pageAmt.toFixed(2), colX[8] + 2, Y + 4, { width: COL[8] - 4, align: 'right' });
          Y += subRowH;
        }

        return Y;
      };

      const drawSummary = (startY) => {
        let Y = startY;

        if (isIgst) {
          hsnRows.forEach(row => {
            const trH = 16;
            doc.rect(PAD, Y, CW, trH).fill(PRPL).stroke(S200);
            doc.fillColor(PRPM).fontSize(8.5).font('Helvetica-Bold')
              .text(`IGST @ ${row.rate}%`, colX[6] - 20, Y + 4, { width: COL[6] + COL[7] + 16, align: 'right' });
            doc.fillColor(PRP).font('Helvetica-Bold').fontSize(9)
              .text(row.igst.toFixed(2), colX[8] + 2, Y + 4, { width: COL[8] - 4, align: 'right' });
            Y += trH;
          });
        } else {
          hsnRows.forEach(row => {
            const halfRate = row.rate / 2;
            ['CGST', 'SGST'].forEach(type => {
              const amt = type === 'CGST' ? row.cgst : row.sgst;
              const trH = 16;
              doc.rect(PAD, Y, CW, trH).fill(PRPL).stroke(S200);
              doc.fillColor(PRPM).fontSize(8.5).font('Helvetica-Bold')
                .text(`${type} @ ${halfRate}%`, colX[6] - 20, Y + 4, { width: COL[6] + COL[7] + 16, align: 'right' });
              doc.fillColor(PRP).font('Helvetica-Bold').fontSize(9)
                .text(amt.toFixed(2), colX[8] + 2, Y + 4, { width: COL[8] - 4, align: 'right' });
              Y += trH;
            });
          });
        }

        let computedRoundOff = 0;
        if (invoice.roundOff !== undefined && invoice.roundOff !== null && Number(invoice.roundOff) !== 0) {
          computedRoundOff = Number(invoice.roundOff);
        } else if (invoice.grandTotal) {
          const rawSum = totalTaxable + totalTax;
          computedRoundOff = Number((Number(invoice.grandTotal) - rawSum).toFixed(2));
        }

        const roH = 16;
        doc.rect(PAD, Y, CW, roH).fill(PRPL).stroke(S200);
        doc.fillColor(PRPM).fontSize(8.5).font('Helvetica-Bold')
          .text('Round Off', colX[6] - 20, Y + 4, { width: COL[6] + COL[7] + 16, align: 'right' });
        const roStr = computedRoundOff > 0 ? `+${computedRoundOff.toFixed(2)}` : computedRoundOff.toFixed(2);
        doc.fillColor(PRP).font('Helvetica-Bold').fontSize(9)
          .text(roStr, colX[8] + 2, Y + 4, { width: COL[8] - 4, align: 'right' });
        Y += roH;

        const grandTotalQty = (items || []).reduce((s, i) => s + (parseFloat(i.qty) || 0), 0);
        let qtyUnit = (items && items[0] && (items[0].unit || items[0].qtyUnit)) || 'MTR';
        if (/meter|mtr/i.test(qtyUnit)) qtyUnit = 'MTR';
        const formattedTotalQty = `${grandTotalQty.toFixed(2)} ${qtyUnit}`;

        const totH = 22;
        doc.rect(PAD, Y, CW, totH).fill(PRP);
        doc.fillColor(WHT).fontSize(8.5).font('Helvetica-Bold')
          .text(formattedTotalQty, colX[5] - 10, Y + 6, { width: COL[5] + 20, align: 'center' })
          .text('Total', colX[6] - 20, Y + 6, { width: COL[6] + COL[7] + 16, align: 'right' })
          .text(`Rs. ${Number(invoice.grandTotal||0).toFixed(2)}`, colX[8] + 2, Y + 6, { width: COL[8]-4, align: 'right' });
        Y += totH;

        if (invoice.enableTds && Number(invoice.tdsAmount) > 0) {
          const tdsH = 16;
          const tdsSec = invoice.tdsSection ? ` (${invoice.tdsSection})` : '';
          const tdsRate = invoice.tdsRate ? ` @ ${invoice.tdsRate}%` : '';
          doc.rect(PAD, Y, CW, tdsH).fill(PRPL).stroke(S200);
          doc.fillColor(PRPM).fontSize(8.5).font('Helvetica-Bold')
            .text(`Less: TDS${tdsSec}${tdsRate}`, colX[6] - 40, Y + 4, { width: COL[6] + COL[7] + 36, align: 'right' });
          doc.fillColor(PRP).font('Helvetica-Bold').fontSize(9)
            .text(`- ${Math.round(Number(invoice.tdsAmount || 0))}`, colX[8] + 2, Y + 4, { width: COL[8] - 4, align: 'right' });
          Y += tdsH;

          const netH = 20;
          const netPayable = Math.max(0, Number(invoice.grandTotal || 0) - Number(invoice.tdsAmount || 0));
          doc.rect(PAD, Y, CW, netH).fill(PRP);
          doc.fillColor(WHT).fontSize(8.5).font('Helvetica-Bold')
            .text('Net Receivable', colX[6] - 20, Y + 5, { width: COL[6] + COL[7] + 16, align: 'right' })
            .text(`Rs. ${netPayable.toFixed(2)}`, colX[8] + 2, Y + 5, { width: COL[8] - 4, align: 'right' });
          Y += netH;
        }

        const wordsH = 28;
        doc.rect(PAD, Y, CW, wordsH).fill(S50).stroke(S200);
        doc.fillColor(S700).fontSize(7.5).font('Helvetica-Bold')
          .text('Amount Chargeable (in words):', PAD + 5, Y + 4);
        doc.fillColor(S900).fontSize(8.5).font('Helvetica-Bold')
          .text(numToWords(invoice.grandTotal), PAD + 5, Y + 14, { width: CW - 80 });
        doc.fillColor(S500).fontSize(7).font('Helvetica')
          .text('E. & O.E.', PAD + CW - 55, Y + 14, { width: 50, align: 'right' });
        Y += wordsH;

        if (isIgst) {
          const TC = [90, 120, 90, 130];
          TC.push(CW - TC.reduce((a,b) => a+b, 0));
          const TX = TC.reduce((acc, w, i) => { acc.push((acc[i-1]||PAD) + (i>0?TC[i-1]:0)); return acc; }, []);

          const tHdrH2 = 18;
          doc.rect(PAD, Y, CW, tHdrH2).fill(PRP);
          doc.fillColor(WHT).fontSize(7.5).font('Helvetica-Bold');
          ['HSN','Taxable Value','IGST %','IGST Amount','Total Tax'].forEach((h, i) => {
            const align = i === 0 ? 'left' : (i === 2 ? 'center' : 'right');
            doc.text(h, TX[i] + 2, Y + 5, { width: TC[i] - 4, align });
          });
          Y += tHdrH2;

          hsnRows.forEach((row, i) => {
            const rH = 16;
            doc.rect(PAD, Y, CW, rH).fill(i % 2 === 0 ? WHT : S50).stroke(S200);
            doc.fillColor(S700).fontSize(8).font('Helvetica')
              .text(row.hsn, TX[0]+2, Y+4, { width: TC[0]-4 })
              .text(row.taxable.toFixed(2), TX[1]+2, Y+4, { width: TC[1]-4, align:'right' })
              .text(`${row.rate}%`, TX[2]+2, Y+4, { width: TC[2]-4, align:'center' })
              .text(row.igst.toFixed(2), TX[3]+2, Y+4, { width: TC[3]-4, align:'right' });
            doc.fillColor(S900).font('Helvetica-Bold')
              .text(row.igst.toFixed(2), TX[4]+2, Y+4, { width: TC[4]-4, align:'right' });
            Y += rH;
          });

          const tTotH = 17;
          doc.rect(PAD, Y, CW, tTotH).fill(PRPL).stroke(S200);
          doc.fillColor(PRP).fontSize(8.5).font('Helvetica-Bold')
            .text('Total', TX[0]+2, Y+4, { width: TC[0]-4 })
            .text(totalTaxable.toFixed(2), TX[1]+2, Y+4, { width: TC[1]-4, align:'right' })
            .text(totalIgst.toFixed(2), TX[3]+2, Y+4, { width: TC[3]-4, align:'right' })
            .text(totalIgst.toFixed(2), TX[4]+2, Y+4, { width: TC[4]-4, align:'right' });
          Y += tTotH + 3;
        } else {
          const TC = [58, 86, 44, 74, 44, 74];
          TC.push(CW - TC.reduce((a,b) => a+b, 0));
          const TX = TC.reduce((acc, w, i) => { acc.push((acc[i-1]||PAD) + (i>0?TC[i-1]:0)); return acc; }, []);

          const tHdrH2 = 18;
          doc.rect(PAD, Y, CW, tHdrH2).fill(PRP);
          doc.fillColor(WHT).fontSize(7.5).font('Helvetica-Bold');
          ['HSN','Taxable Value','CGST %','CGST Amount','SGST %','SGST Amount','Total Tax'].forEach((h, i) => {
            const align = i === 0 ? 'left' : (i === 2 || i === 4 ? 'center' : 'right');
            doc.text(h, TX[i] + 2, Y + 5, { width: TC[i] - 4, align });
          });
          Y += tHdrH2;

          hsnRows.forEach((row, i) => {
            const rH = 16;
            doc.rect(PAD, Y, CW, rH).fill(i % 2 === 0 ? WHT : S50).stroke(S200);
            const halfRate = row.rate / 2;
            doc.fillColor(S700).fontSize(8).font('Helvetica')
              .text(row.hsn, TX[0]+2, Y+4, { width: TC[0]-4 })
              .text(row.taxable.toFixed(2), TX[1]+2, Y+4, { width: TC[1]-4, align:'right' })
              .text(`${halfRate}%`, TX[2]+2, Y+4, { width: TC[2]-4, align:'center' })
              .text(row.cgst.toFixed(2), TX[3]+2, Y+4, { width: TC[3]-4, align:'right' })
              .text(`${halfRate}%`, TX[4]+2, Y+4, { width: TC[4]-4, align:'center' })
              .text(row.sgst.toFixed(2), TX[5]+2, Y+4, { width: TC[5]-4, align:'right' });
            doc.fillColor(S900).font('Helvetica-Bold')
              .text((row.cgst+row.sgst).toFixed(2), TX[6]+2, Y+4, { width: TC[6]-4, align:'right' });
            Y += rH;
          });

          const tTotH = 17;
          doc.rect(PAD, Y, CW, tTotH).fill(PRPL).stroke(S200);
          doc.fillColor(PRP).fontSize(8.5).font('Helvetica-Bold')
            .text('Total', TX[0]+2, Y+4, { width: TC[0]-4 })
            .text(totalTaxable.toFixed(2), TX[1]+2, Y+4, { width: TC[1]-4, align:'right' })
            .text(totalCgst.toFixed(2), TX[3]+2, Y+4, { width: TC[3]-4, align:'right' })
            .text(totalSgst.toFixed(2), TX[5]+2, Y+4, { width: TC[5]-4, align:'right' })
            .text(totalTax.toFixed(2), TX[6]+2, Y+4, { width: TC[6]-4, align:'right' });
          Y += tTotH + 3;
        }

        doc.fillColor(S500).fontSize(7.5).font('Helvetica')
          .text('Tax Amount (in words):', PAD+2, Y+2)
          .text(numToWords(totalTax), PAD+105, Y+2, { width: CW-109 });
        Y += 16;
        return Y;
      };

      const drawFooter = (startY) => {
        const minFooterY = PH - PAD - 82;
        const footerY = (typeof startY === 'number' && !isNaN(startY)) ? Math.max(startY, minFooterY) : minFooterY;
        doc.moveTo(PAD, footerY).lineTo(PAD+CW, footerY).strokeColor(S200).lineWidth(0.6).stroke();

        const leftFW = 320;
        const rightFX = PAD + leftFW + 8;
        const rightFW = CW - leftFW - 8;

        doc.fillColor(S900).fontSize(8).font('Helvetica-Bold')
          .text("Company's Bank Details:", PAD+4, footerY+4);
        doc.fillColor(S700).fontSize(7.5).font('Helvetica')
          .text(`Bank Name: ${bankName}`, PAD+4, footerY+15)
          .text(`A/c No.: ${bankAcNo}`, PAD+4, footerY+24)
          .text(`Branch & IFS Code: ${bankIfsc}`, PAD+4, footerY+33);
        doc.fillColor(S500).fontSize(6.5).font('Helvetica')
          .text('Terms & Conditions:', PAD+4, footerY+43)
          .text(companyTerms, PAD+4, footerY+51, { width: leftFW });

        doc.fillColor(S900).fontSize(8.5).font('Helvetica-Bold')
          .text(`for ${companyDisplayName.toUpperCase()}`, rightFX, footerY+4, { width: rightFW, align:'right' });
        doc.moveTo(rightFX + rightFW - 100, footerY + 44).lineTo(rightFX + rightFW, footerY + 44)
          .strokeColor(S500).lineWidth(0.5).stroke();
        doc.fillColor(S500).fontSize(8).font('Helvetica')
          .text('Authorised Signatory', rightFX, footerY+46, { width: rightFW, align:'right' });

        const bottomNoteY = PH - PAD - 12;
        doc.moveTo(PAD, bottomNoteY).lineTo(PAD+CW, bottomNoteY).strokeColor(S200).lineWidth(0.4).stroke();
        doc.fillColor(S500).fontSize(7).font('Helvetica')
          .text('This is a Computer Generated Document', PAD, bottomNoteY+2, { width: CW, align:'center' });
      };

      // ── PAGINATION: INTERMEDIATE PAGES FIT UP TO 6 ITEMS; LAST PAGE HAS FULL DETAILS ──
      // pageChunks and totalPages are calculated at start of renderPage (getInvoicePageChunks(items, 6, 5))

      // Calculate exact summary height and position minBottomY so summary meets footer with zero blank gap
      const tdsExtraH = (invoice.enableTds && Number(invoice.tdsAmount) > 0) ? (16 + 20) : 0;
      const sumH = (isIgst
        ? (16 * hsnRows.length + 16 + 22 + 28 + 18 + 16 * hsnRows.length + 17 + 3 + 16)
        : (32 * hsnRows.length + 16 + 22 + 28 + 18 + 16 * hsnRows.length + 17 + 3 + 16)) + tdsExtraH;
      const minFooterY = PH - PAD - 82;
      const subRowH = 18;
      const minBottomYLast = minFooterY - sumH - subRowH;
      const minBottomYNonLast = PH - PAD - 16 - subRowH;

      let runningStartIdx = 0;
      pageChunks.forEach((chunk, pageIdx) => {
        if (pageIdx > 0) {
          doc.addPage({ margin: 0, size: 'A4' });
        }
        const isLast = pageIdx === pageChunks.length - 1;
        const pageLabel = totalPages > 1 ? `${pageIdx + 1} of ${totalPages}` : '';
        let Y = drawHeader(pageLabel);

        const startIdx = runningStartIdx;
        runningStartIdx += chunk.length;

        if (isLast) {
          Y = drawItemsTable(Y, chunk, startIdx, true, minBottomYLast);
          Y = drawSummary(Y);
          drawFooter(Y);
        } else {
          Y = drawItemsTable(Y, chunk, startIdx, false, minBottomYNonLast);
          const bottomNoteY = PH - PAD - 12;
          doc.moveTo(PAD, bottomNoteY).lineTo(PAD + CW, bottomNoteY).strokeColor(S200).lineWidth(0.4).stroke();
          doc.fillColor(S500).fontSize(7).font('Helvetica')
            .text('This is a Computer Generated Document', PAD, bottomNoteY + 2, { width: CW, align: 'center' });
        }
      });
    };

    // ── RENDER PAGES ──────────────────────────────────────────────────────────
    // Page 1 (and 2 if > 5 items): Colourful original
    renderPage('ORIGINAL FOR BUYER', false);

    // Page 2/3/4 (if duplicate requested): Black & White duplicate
    if (includeDuplicate) {
      doc.addPage({ margin: 0, size: 'A4' });
      renderPage('DUPLICATE COPY', true);
    }

    console.log(`[PDF Performance] Invoice ${invoice.invoiceNo} PDF generated in ${Date.now() - startTime}ms (${items.length} items)`);
    doc.end();

  } catch (error) {
    console.error('Download Invoice PDF Error:', error);
    res.status(500).send('Error generating PDF invoice');
  }
};

// ── 9B. DOWNLOAD BULK INVOICES MERGED PDF ──────────────────────────────────
const downloadBulkInvoicesPdf = async (req, res) => {
  const startTime = Date.now();
  try {
    let ids = [];
    if (req.query.ids) {
      ids = String(req.query.ids).split(',').map(s => s.trim()).filter(Boolean);
    } else if (req.body && Array.isArray(req.body.ids)) {
      ids = req.body.ids;
    }

    if (ids.length === 0) {
      return res.status(400).send('No invoice IDs provided for bulk PDF generation.');
    }

    const invoices = await BillingInvoice.find({ _id: { $in: ids } }).sort({ invoiceSeq: 1, created_at: 1 }).lean();
    if (invoices.length === 0) {
      return res.status(404).send('No matching invoices found.');
    }

    const PrintConfig = require('../db/models/printConfig.model');
    const JobCard = require('../db/models/jobCard.model');
    const FabricChallan = require('../db/models/fabricChallan.model');
    const StitchingChallan = require('../db/models/stitchingChallan.model');
    const config = await PrintConfig.findOne({ isConfig: true }).lean() || {};

    const rawCompName = config.companyName || 'ELITE DIGITAL PRINTS';
    const companyDisplayName = rawCompName.replace(/\s*\([^)]*\)/g, '').trim();
    const companyGstin   = config.companyGstin   || '24AANFE0044M1ZG';
    const companyAddress = config.companyAddress  || 'G.F., PLOT NO-B/37, Siddheshwar Soc., Punagam Main Road, Surat - 395006';
    const companyPhone   = config.companyPhone   || '+91 98790 00000';
    const companyState   = config.companyState   || 'Gujarat';
    const companyStateCode = config.companyStateCode || '24';
    const bankName   = config.companyBankName  || 'ICICI Bank';
    const bankAcNo   = config.companyAccountNo || 'N/A';
    const bankIfsc   = config.companyIfscCode  || 'N/A';

    const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: true, bufferPages: true, autoPageBreak: false });
    doc.options.autoPageBreak = false;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Combined_Tax_Invoices_${invoices.length}_Items.pdf"`);
    doc.pipe(res);

    const PW = 595.28, PH = 841.89;
    const PAD = 18;
    const CW = PW - PAD * 2;
    const logoPath = path.join(__dirname, 'Logo.png');

    const formatDate = (d) => {
      if (!d) return '--';
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return `${String(dt.getDate()).padStart(2,'0')}-${String(dt.getMonth()+1).padStart(2,'0')}-${dt.getFullYear()}`;
    };

    const COL = [20, 52, 180, 50, 34, 56, 54, 30, 83.28];
    const colX = COL.reduce((acc, w, i) => { acc.push((acc[i-1]||PAD) + (i>0?COL[i-1]:0)); return acc; }, []);

    let isFirstPageOverall = true;
    for (let invIdx = 0; invIdx < invoices.length; invIdx++) {
      const invoice = invoices[invIdx];

      const companyEntity = invoice.companyEntity || 'Elite Online';
      const companyConfig = await PrintConfig.findOne({ companyEntity }).lean() || await PrintConfig.findOne({ isConfig: true }).lean() || {};

      const rawCompName = companyConfig.companyName || companyEntity.toUpperCase();
      const companyDisplayName = rawCompName.replace(/\s*\([^)]*\)/g, '').trim();
      const companyGstin   = companyConfig.companyGstin || '';
      const companyAddress = companyConfig.companyAddress || '';
      const companyPhone   = companyConfig.companyPhone || '';
      const companyState   = companyConfig.companyState || 'Gujarat';
      const companyStateCode = companyConfig.companyStateCode || '24';
      const companyTerms   = invoice.terms || companyConfig.companyTerms || 'Payment due within 30 days from invoice date. Subject to Surat jurisdiction.';
      const bankName   = companyConfig.companyBankName || '';
      const bankAcNo   = companyConfig.companyAccountNo || '';
      const bankIfsc   = companyConfig.companyIfscCode || '';

      let bulkLogoBufferOrPath = path.join(__dirname, 'Logo.png');
      if (companyConfig.companyLogo && typeof companyConfig.companyLogo === 'string' && companyConfig.companyLogo.trim()) {
        const logoStr = companyConfig.companyLogo.trim();
        if (logoStr.startsWith('data:image/')) {
          try {
            const base64Data = logoStr.split(',')[1];
            if (base64Data) bulkLogoBufferOrPath = Buffer.from(base64Data, 'base64');
          } catch(e) {}
        } else if (fs.existsSync(logoStr)) {
          bulkLogoBufferOrPath = logoStr;
        }
      }

      const items = invoice.items || [];
      const imageCache = new Map();

      const allJobNumsSet = new Set();
      items.forEach(it => {
        const textToScan = [it.jobNo, it.description, it.itemName].filter(Boolean).join(' ');
        const matches = textToScan.match(/\d+/g) || [];
        matches.forEach(n => {
          if (n.length >= 2 && n.length <= 6) allJobNumsSet.add(n);
        });
      });
      const jobNumArray = Array.from(allJobNumsSet);

      const jobCardMap = {};
      if (jobNumArray.length > 0) {
        try {
          const queryOr = [];
          jobNumArray.forEach(n => {
            queryOr.push({ jobNo: n }, { jobNo: `JOB-${n}` }, { jobNo: `JOB NO.- ${n}` }, { jobNo: `JOB NO.-${n}` }, { jobNo: Number(n) });
          });
          const foundJobCards = await JobCard.find({ $or: queryOr }).select('jobNo designNo designName imageUrl1 imageUrl2 image proofing.artworkUrl').lean();
          foundJobCards.forEach(jc => {
            const nums = String(jc.jobNo).match(/\d+/g) || [];
            nums.forEach(n => { if (!jobCardMap[n]) jobCardMap[n] = jc; });
          });
        } catch(e) {}
      }

      const itemImages = await resolveItemsImages(items, jobCardMap, imageCache);

      const taxType = invoice.taxType || (invoice.customer && invoice.customer.stateCode && String(invoice.customer.stateCode).trim() !== '24' ? 'IGST' : 'CGST_SGST');
      const isIgst = taxType === 'IGST';

      const hsnMap = {};
      items.forEach(it => {
        const hsn  = it.hsnCode || '998821';
        const rate = Number(it.taxRate !== undefined && it.taxRate !== null ? it.taxRate : 5);
        const key  = `${hsn}_${rate}`;
        if (!hsnMap[key]) hsnMap[key] = { hsn, rate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
        const taxable = Number(it.totalAmount || 0);
        hsnMap[key].taxable += taxable;
        if (isIgst) {
          hsnMap[key].igst += taxable * (rate / 100);
        } else {
          hsnMap[key].cgst += taxable * (rate / 2 / 100);
          hsnMap[key].sgst += taxable * (rate / 2 / 100);
        }
      });
      const hsnRows      = Object.values(hsnMap);
      const totalTaxable = hsnRows.reduce((s, r) => s + r.taxable, 0);
      const totalCgst    = hsnRows.reduce((s, r) => s + r.cgst,    0);
      const totalSgst    = hsnRows.reduce((s, r) => s + r.sgst,    0);
      const totalIgst    = hsnRows.reduce((s, r) => s + r.igst,    0);
      const totalTax     = isIgst ? totalIgst : (totalCgst + totalSgst);

      let delByVal = invoice.deliveryBy || '';
      if (!delByVal && Array.isArray(invoice.linkedChallanIds) && invoice.linkedChallanIds.length > 0) {
        try {
          const fChs = await FabricChallan.find({ _id: { $in: invoice.linkedChallanIds } }, 'deliveryBy').lean();
          const sChs = await StitchingChallan.find({ _id: { $in: invoice.linkedChallanIds } }, 'deliveryBy').lean();
          const allDel = [...fChs, ...sChs].map(c => c.deliveryBy).filter(Boolean);
          if (allDel.length > 0) delByVal = [...new Set(allDel)].join(', ');
        } catch(e) {}
      }
      if (!delByVal) delByVal = 'By Road';

      const useTwoPages = items.length > 5;

      const renderPage = (copyLabel, bw = false) => {
        const c = (color, bwFallback) => bw ? (bwFallback || '#000000') : color;
        const PRP  = c('#4c1d95', '#000000');
        const PRPM = c('#6b21a8', '#000000');
        const PRPL = c('#ede9fe', '#f0f0f0');
        const S900 = c('#000000', '#000000');
        const S700 = c('#000000', '#000000');
        const S500 = c('#000000', '#000000');
        const S200 = c('#e2e8f0', '#cccccc');
        const S50  = c('#f8fafc', '#f9f9f9');
        const WHT  = '#ffffff';

        const pageChunks = getInvoicePageChunks(items, 6, 5);
        const totalPages = pageChunks.length;

        const drawHeader = (pageLabel) => {
          let Y = PAD;

          doc.rect(PAD, Y, CW, PH - PAD * 2).stroke(S200);
          doc.rect(PAD, Y, CW, 4).fill(PRP);
          Y += 4;

          const hdrH = 62;
          doc.rect(PAD, Y, CW, hdrH).fill(S50);

          if (bulkLogoBufferOrPath) {
            try { doc.image(bulkLogoBufferOrPath, PAD + 6, Y + 6, { width: 110, height: 50, fit: [110, 50] }); } catch(e) {}
          }

          doc.fillColor(S900).fontSize(12).font('Helvetica-Bold')
            .text(`${companyDisplayName.toUpperCase()} (${companyGstin})`, PAD + 120, Y + 6, { width: CW - 126, align: 'right' });
          doc.fillColor(S500).fontSize(8).font('Helvetica')
            .text(companyAddress.toUpperCase(), PAD + 120, Y + 22, { width: CW - 126, align: 'right' })
            .text(`PHONE: ${companyPhone}   STATE: ${companyState}, CODE: ${companyStateCode}`,
                  PAD + 120, Y + 34, { width: CW - 126, align: 'right' });

          Y += hdrH;

          const titleH = 22;
          doc.rect(PAD, Y, CW, titleH).fill(PRPL);
          doc.fillColor(PRP).fontSize(14).font('Helvetica-Bold').text('TAX INVOICE', PAD, Y + 4, { width: CW, align: 'center' });
          doc.fillColor(S900).fontSize(10).font('Helvetica-Bold')
            .text(`Date: ${formatDate(invoice.invoiceDate)}`, PAD + CW - 180, Y + 5, { width: 175, align: 'right' });
          Y += titleH;

          const cust   = invoice.customer || {};
          const halfCW = Math.floor(CW / 2);
          const rawChallanStr = invoice.ourChallanNo || (invoice.linkedChallanNos && invoice.linkedChallanNos.join(', ')) || invoice.challanNo || '--';
          const custNameStr   = cust.businessName || cust.name || '--';
          const custGstStr    = cust.gstin && cust.gstin !== 'N/A' ? ` (GST: ${cust.gstin})` : '';
          const fullCustTitle = `${custNameStr}${custGstStr}`;

          let custY = Y + 16;
          doc.font('Helvetica-Bold').fontSize(9.5);
          custY += doc.heightOfString(fullCustTitle, { width: halfCW - 10 }) + 3;

          if (cust.billingAddress && cust.billingAddress.trim() && cust.billingAddress.trim() !== '--') {
            doc.font('Helvetica').fontSize(8);
            custY += doc.heightOfString(cust.billingAddress.trim(), { width: halfCW - 10 }) + 3;
          }
          custY += 14;

          const rx = PAD + halfCW;
          const metaW = (CW - halfCW) / 2 - 5;
          const pairs = [
            ['Challan No.', rawChallanStr, 'Tax Invoice No.', invoice.invoiceNo || '--'],
            ['', '', 'Terms of Delivery', delByVal],
          ];
          if (totalPages > 1 && pageLabel) {
            pairs.push(['Page', pageLabel, '', '']);
          }

          let testMetaY = Y + 16;
          pairs.forEach(([k1, v1, k2, v2]) => {
            doc.font('Helvetica-Bold').fontSize(8);
            const vh1 = v1 ? doc.heightOfString(v1, { width: metaW }) : 0;
            const vh2 = v2 ? doc.heightOfString(v2, { width: metaW }) : 0;
            const leftH = (k1 ? 8 : 0) + vh1;
            const rightH = (k2 ? 8 : 0) + vh2;
            const rowH = Math.max(leftH, rightH, (k1 || k2 || v1 || v2) ? 12 : 0) + 4;
            testMetaY += rowH;
          });

          const infoH = Math.max(76, custY - Y, testMetaY - Y + 4);

          doc.rect(PAD, Y, halfCW, infoH).fill(WHT).stroke(S200);
          doc.rect(PAD, Y, halfCW, 14).fill(PRP);
          doc.fillColor(WHT).fontSize(8.5).font('Helvetica-Bold')
            .text('BILL TO', PAD + 5, Y + 3, { width: halfCW - 10 });

          let drawCustY = Y + 16;
          doc.fillColor(S900).fontSize(9.5).font('Helvetica-Bold')
            .text(fullCustTitle, PAD + 5, drawCustY, { width: halfCW - 10 });
          drawCustY += doc.heightOfString(fullCustTitle, { width: halfCW - 10 }) + 3;

          if (cust.billingAddress && cust.billingAddress.trim() && cust.billingAddress.trim() !== '--') {
            const addrStr = cust.billingAddress.trim();
            doc.fillColor(S700).fontSize(8).font('Helvetica')
              .text(addrStr, PAD + 5, drawCustY, { width: halfCW - 10 });
            doc.font('Helvetica').fontSize(8);
            drawCustY += doc.heightOfString(addrStr, { width: halfCW - 10 }) + 3;
          }

          doc.fillColor(S500).fontSize(8).font('Helvetica')
            .text(`State: ${cust.state || 'Gujarat'}, Code: ${cust.stateCode || '24'}`, PAD + 5, drawCustY);

          doc.rect(rx, Y, CW - halfCW, infoH).fill(WHT).stroke(S200);
          doc.rect(rx, Y, CW - halfCW, 14).fill(PRP);
          doc.fillColor(WHT).fontSize(8.5).font('Helvetica-Bold')
            .text('SELLER / DISPATCH DETAILS', rx + 5, Y + 3, { width: CW - halfCW - 10 });

          let metaY = Y + 16;
          pairs.forEach(([k1, v1, k2, v2]) => {
            doc.font('Helvetica-Bold').fontSize(8);
            const vh1 = v1 ? doc.heightOfString(v1, { width: metaW }) : 0;
            const vh2 = v2 ? doc.heightOfString(v2, { width: metaW }) : 0;
            const leftH = (k1 ? 8 : 0) + vh1;
            const rightH = (k2 ? 8 : 0) + vh2;
            const rowH = Math.max(leftH, rightH, (k1 || k2 || v1 || v2) ? 12 : 0) + 4;

            if (k1 || v1) {
              if (k1) {
                doc.fillColor(S500).fontSize(7).font('Helvetica')
                  .text(k1 + ':', rx + 4, metaY, { width: metaW });
              }
              if (v1) {
                const valY = k1 ? metaY + 8 : metaY;
                doc.fillColor(S900).fontSize(8).font('Helvetica-Bold')
                  .text(v1, rx + 4, valY, { width: metaW });
              }
            }
            if (k2 || v2) {
              if (k2) {
                doc.fillColor(S500).fontSize(7).font('Helvetica')
                  .text(k2 + ':', rx + metaW + 10, metaY, { width: metaW });
              }
              if (v2) {
                const valY = k2 ? metaY + 8 : metaY;
                doc.fillColor(S900).fontSize(8).font('Helvetica-Bold')
                  .text(v2, rx + metaW + 10, valY, { width: metaW });
              }
            }
            metaY += rowH;
          });

          Y += infoH;
          return Y;
        };

        const drawItemsTable = (startY, itemsToRender, startIdx, isLastPage, minBottomY) => {
          let Y = startY;

          const tblHdrH = 22;
          doc.rect(PAD, Y, CW, tblHdrH).fill(PRP);
          doc.fillColor(WHT).fontSize(9.5).font('Helvetica-Bold');
          const hdrs   = ['Sr.', 'Image', 'Description of Goods', 'HSN', 'GST%', 'Qty', 'Rate', 'Per', 'Amount'];
          const aligns = ['left','center','left','center','center','center','right','center','right'];
          hdrs.forEach((h, i) => doc.text(h, colX[i] + 2, Y + 7, { width: COL[i] - 4, align: aligns[i] }));
          Y += tblHdrH;

          const drawColSeps = (rowY, rowH) => {
            colX.slice(1).forEach(cx => {
              doc.moveTo(cx, rowY).lineTo(cx, rowY + rowH).strokeColor(S200).lineWidth(0.4).stroke();
            });
          };

          let targetRowHPerItem = 82;
          if (isLastPage && minBottomY && itemsToRender.length > 0) {
            const availH = minBottomY - Y;
            const dynamicRowH = Math.floor(availH / itemsToRender.length);
            targetRowHPerItem = Math.min(82, Math.max(62, dynamicRowH));
          }

          itemsToRender.forEach((item, localIdx) => {
            const idx = startIdx + localIdx;
            const rowBg = localIdx % 2 === 0 ? WHT : S50;

            const metaLines = [];

            // 1. Design No (from item or jobCardMap)
            let designStr = item.designNo || '';
            if (!designStr && item.jobNo) {
              const matches = String(item.jobNo).match(/\d+/g) || [];
              for (const n of matches) {
                if (jobCardMap[n]) {
                  designStr = jobCardMap[n].designNo || jobCardMap[n].designName || '';
                  if (designStr) break;
                }
              }
            }
            if (designStr) {
              metaLines.push({ text: `Design No: ${designStr}`, font: 'Helvetica-Bold', size: 8, color: PRP });
            }

            // 2. Job Card & Delivery Challan
            const jd = cleanJobDisplay(item.jobNo);
            const chNo = item.ourChallanNo || '';
            const line1 = [];
            if (jd) line1.push(jd);
            if (chNo) line1.push(`Challan: ${chNo}`);
            if (line1.length) metaLines.push({ text: line1.join('   |   '), font: 'Helvetica-Bold', size: 8, color: PRPM });

            // 3. Fabric & Lot
            const line2 = [];
            const fab = item.fabric || item.fabricName || '';
            if (fab) line2.push(`Fabric: ${fab}`);
            if (item.lotNo) line2.push(`Lot: ${item.lotNo}`);
            if (line2.length) metaLines.push({ text: line2.join('   |   '), font: 'Helvetica', size: 7.5, color: S700 });

            // 4. Party Challan (standalone line, never truncated)
            if (item.partyChallan) {
              metaLines.push({ text: `Party Challan: ${item.partyChallan}`, font: 'Helvetica-Bold', size: 7.5, color: S900 });
            }

            // 5. Additional custom description or notes
            if (item.description) {
              const cleanDesc = item.description
                .replace(new RegExp(`Challan\\s*${chNo}`, 'i'), '')
                .replace(new RegExp(`Fabric:\\s*${fab}`, 'i'), '')
                .replace(/^[|\s]+|[|\s]+$/g, '').trim();
              if (cleanDesc && cleanDesc.length > 1 && !metaLines.some(m => m.text.includes(cleanDesc))) {
                metaLines.push({ text: cleanDesc, font: 'Helvetica-Oblique', size: 7, color: S500 });
              }
            }

            doc.font('Helvetica-Bold').fontSize(10);
            let descH = doc.heightOfString(item.itemName || '--', { width: COL[2] - 6 });
            metaLines.forEach(m => {
              doc.font(m.font).fontSize(m.size);
              descH += doc.heightOfString(m.text, { width: COL[2] - 6 }) + 1.5;
            });
            const rowH = Math.max(targetRowHPerItem, descH + 10);

            doc.rect(PAD, Y, CW, rowH).fill(rowBg).stroke(S200);
            drawColSeps(Y, rowH);

            const contentPadY = Math.max(5, Math.floor((rowH - descH) / 2));
            const numY = Y + Math.max(6, Math.floor((rowH - 12) / 2));

            doc.fillColor(S700).fontSize(9.5).font('Helvetica-Bold')
              .text(String(idx + 1), colX[0] + 2, numY, { width: COL[0] - 2, align: 'center' });

            const imgPath = itemImages[idx];
            const imgMaxW = COL[1] - 6;
            const imgMaxH = Math.min(rowH - 8, 70);
            const hasImage = imgPath && (Buffer.isBuffer(imgPath) || (typeof imgPath === 'string' && fs.existsSync(imgPath)));

            if (hasImage) {
              try {
                const imgY = Y + Math.max(4, Math.floor((rowH - imgMaxH) / 2));
                doc.image(imgPath, colX[1] + 3, imgY, { fit: [imgMaxW, imgMaxH], align: 'center', valign: 'center' });
              } catch(e) {
                doc.fillColor(S500).fontSize(7).font('Helvetica')
                  .text('[Img Err]', colX[1] + 2, numY, { width: COL[1] - 4, align: 'center' });
              }
            } else {
              doc.fillColor(S500).fontSize(7).font('Helvetica')
                .text('NO IMAGE', colX[1] + 2, numY, { width: COL[1] - 4, align: 'center' });
            }

            let descY = Y + contentPadY;
            doc.fillColor(S900).font('Helvetica-Bold').fontSize(10);
            doc.text(item.itemName || '--', colX[2] + 3, descY, { width: COL[2] - 6 });
            descY += 13;

            metaLines.forEach(m => {
              doc.fillColor(m.color).fontSize(m.size).font(m.font)
                .text(m.text, colX[2] + 3, descY, { width: COL[2] - 6 });
              descY += 11;
            });

            doc.fillColor(S700).fontSize(9.5).font('Helvetica-Bold')
              .text(item.hsnCode || '998821', colX[3] + 2, numY, { width: COL[3] - 4, align: 'center' });

            const gstVal = item.taxRate !== undefined && item.taxRate !== null ? `${item.taxRate}%` : '5%';
            doc.fillColor(S700).fontSize(9.5).font('Helvetica-Bold')
              .text(gstVal, colX[4] + 2, numY, { width: COL[4] - 4, align: 'center' });

            const qtyVal = Number(item.qty || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
            doc.fillColor(S900).fontSize(10).font('Helvetica-Bold')
              .text(qtyVal, colX[5] + 2, numY, { width: COL[5] - 4, align: 'center' });

            const rateVal = Number(item.unitPrice || 0).toFixed(2);
            doc.fillColor(S700).fontSize(9.5).font('Helvetica')
              .text(rateVal, colX[6] + 2, numY, { width: COL[6] - 4, align: 'right' });

            doc.fillColor(S500).fontSize(8.5).font('Helvetica')
              .text(item.unit || 'Mtr', colX[7] + 2, numY, { width: COL[7] - 4, align: 'center' });

            const amtVal = Number(item.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            doc.fillColor(S900).fontSize(10).font('Helvetica-Bold')
              .text(amtVal, colX[8] + 2, numY, { width: COL[8] - 4, align: 'right' });

            Y += rowH;
          });

          if (minBottomY && Y < minBottomY) {
            const fillH = minBottomY - Y;
            doc.rect(PAD, Y, CW, fillH).fill(WHT).stroke(S200);
            drawColSeps(Y, fillH);
            Y = minBottomY;
          }

          if (isLastPage) {
            const totalQty = items.reduce((s, i) => s + Number(i.qty || 0), 0);
            const subtotal = invoice.subtotal || totalTaxable;
            const totalH   = 18;

            doc.rect(PAD, Y, CW, totalH).fill(PRPL).stroke(S200);
            drawColSeps(Y, totalH);

            doc.fillColor(PRP).fontSize(8.5).font('Helvetica-Bold')
              .text('Total Qty:', colX[0] + 3, Y + 4, { width: colX[5] - colX[0] - 6, align: 'right' });
            doc.fillColor(PRP).fontSize(9).font('Helvetica-Bold')
              .text(totalQty.toLocaleString('en-IN', { maximumFractionDigits: 2 }), colX[5] + 2, Y + 4, { width: COL[5] - 4, align: 'center' });
            doc.fillColor(PRP).fontSize(9).font('Helvetica-Bold')
              .text(Number(subtotal).toFixed(2), colX[8] + 2, Y + 4, { width: COL[8] - 4, align: 'right' });
            Y += totalH;
          } else {
            const pageQty = (itemsToRender || []).reduce((s, i) => s + Number(i.qty || 0), 0);
            const pageAmt = (itemsToRender || []).reduce((s, i) => s + Number(i.totalAmount || 0), 0);
            const subRowH = 18;
            doc.rect(PAD, Y, CW, subRowH).fill(PRPL).stroke(S200);
            drawColSeps(Y, subRowH);
            doc.fillColor(PRPM).fontSize(8).font('Helvetica-Bold')
              .text('Page Subtotal (Continued on Next Page...):', colX[0] + 3, Y + 4, { width: colX[5] - colX[0] - 6, align: 'right' });
            doc.fillColor(PRPM).fontSize(8.5).font('Helvetica-Bold')
              .text(pageQty.toLocaleString('en-IN', { maximumFractionDigits: 2 }), colX[5] + 2, Y + 4, { width: COL[5] - 4, align: 'center' });
            doc.fillColor(PRPM).fontSize(8.5).font('Helvetica-Bold')
              .text(Number(pageAmt).toFixed(2), colX[8] + 2, Y + 4, { width: COL[8] - 4, align: 'right' });
            Y += subRowH;
          }

          return Y;
        };

        const drawSummary = (startY) => {
          let Y = startY;

          const sumHdrH = 16;
          doc.rect(PAD, Y, CW, sumHdrH).fill(PRP);
          doc.fillColor(WHT).fontSize(8).font('Helvetica-Bold');
          doc.text('HSN/SAC', colX[0] + 2, Y + 4, { width: COL[0] + COL[1] + COL[2] - 4 });
          doc.text('Taxable Value', colX[3] + 2, Y + 4, { width: COL[3] + COL[4] - 4, align: 'right' });

          if (isIgst) {
            doc.text('IGST Amount', colX[5] + 2, Y + 4, { width: COL[5] + COL[6] - 4, align: 'right' });
          } else {
            doc.text('Central Tax (CGST)', colX[5] + 2, Y + 4, { width: COL[5] + COL[6] - 4, align: 'center' });
            doc.text('State Tax (SGST)',   colX[7] + 2, Y + 4, { width: COL[7] + COL[8] - 4, align: 'center' });
          }
          Y += sumHdrH;

          if (!isIgst) {
            const subHdrH = 14;
            doc.rect(PAD, Y, CW, subHdrH).fill(PRPL);
            doc.fillColor(PRP).fontSize(7.5).font('Helvetica-Bold');
            doc.text('Rate', colX[5] + 2, Y + 3, { width: COL[5] - 2, align: 'center' });
            doc.text('Amount', colX[6] + 2, Y + 3, { width: COL[6] - 2, align: 'right' });
            doc.text('Rate', colX[7] + 2, Y + 3, { width: COL[7] - 2, align: 'center' });
            doc.text('Amount', colX[8] + 2, Y + 3, { width: COL[8] - 2, align: 'right' });
            Y += subHdrH;
          }

          hsnRows.forEach((r, idx) => {
            const hsnRowBg = idx % 2 === 0 ? WHT : S50;
            const rowH = 16;
            doc.rect(PAD, Y, CW, rowH).fill(hsnRowBg).stroke(S200);

            doc.fillColor(S900).fontSize(8).font('Helvetica')
              .text(r.hsn, colX[0] + 2, Y + 4, { width: COL[0] + COL[1] + COL[2] - 4 });
            doc.fillColor(S900).fontSize(8).font('Helvetica')
              .text(r.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    colX[3] + 2, Y + 4, { width: COL[3] + COL[4] - 4, align: 'right' });

            if (isIgst) {
              doc.fillColor(S900).fontSize(8).font('Helvetica')
                .text(r.igst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                      colX[5] + 2, Y + 4, { width: COL[5] + COL[6] - 4, align: 'right' });
            } else {
              const halfRate = (r.rate / 2).toFixed(1) + '%';
              doc.fillColor(S700).fontSize(7.5).font('Helvetica')
                .text(halfRate, colX[5] + 2, Y + 4, { width: COL[5] - 2, align: 'center' });
              doc.fillColor(S900).fontSize(8).font('Helvetica')
                .text(r.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                      colX[6] + 2, Y + 4, { width: COL[6] - 2, align: 'right' });

              doc.fillColor(S700).fontSize(7.5).font('Helvetica')
                .text(halfRate, colX[7] + 2, Y + 4, { width: COL[7] - 2, align: 'center' });
              doc.fillColor(S900).fontSize(8).font('Helvetica')
                .text(r.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                      colX[8] + 2, Y + 4, { width: COL[8] - 2, align: 'right' });
            }
            Y += rowH;
          });

          const totH = 16;
          doc.rect(PAD, Y, CW, totH).fill(PRPL).stroke(S200);
          doc.fillColor(PRP).fontSize(8.5).font('Helvetica-Bold')
            .text('Total Tax:', colX[0] + 2, Y + 4);
          doc.fillColor(PRP).fontSize(8.5).font('Helvetica-Bold')
            .text(totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                  colX[3] + 2, Y + 4, { width: COL[3] + COL[4] - 4, align: 'right' });

          if (isIgst) {
            doc.fillColor(PRP).fontSize(8.5).font('Helvetica-Bold')
              .text(totalIgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    colX[5] + 2, Y + 4, { width: COL[5] + COL[6] - 4, align: 'right' });
          } else {
            doc.fillColor(PRP).fontSize(8.5).font('Helvetica-Bold')
              .text(totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    colX[6] + 2, Y + 4, { width: COL[6] - 2, align: 'right' });
            doc.fillColor(PRP).fontSize(8.5).font('Helvetica-Bold')
              .text(totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    colX[8] + 2, Y + 4, { width: COL[8] - 2, align: 'right' });
          }
          Y += totH;

          const gtotBoxH = 22;
          doc.rect(PAD, Y, CW, gtotBoxH).fill(PRP);

          doc.fillColor(WHT).fontSize(8.5).font('Helvetica-Bold')
            .text('Grand Total (in words):', PAD + 4, Y + 4, { width: 140 });

          const grandTotalVal = invoice.grandTotal || (totalTaxable + totalTax);
          doc.fillColor(WHT).fontSize(8.5).font('Helvetica-Bold')
            .text(numToWords(grandTotalVal), PAD + 148, Y + 4, { width: CW - 260 });

          doc.fillColor(WHT).fontSize(11).font('Helvetica-Bold')
            .text(`Rs. ${Number(grandTotalVal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                  PAD + CW - 110, Y + 5, { width: 105, align: 'right' });
          Y += gtotBoxH;

          const roundOffVal = invoice.roundOff != null ? Number(invoice.roundOff) : 0;
          doc.rect(PAD, Y, CW, 16).fill(S50).stroke(S200);
          doc.fillColor(S700).fontSize(8).font('Helvetica')
            .text(`Round Off: ${roundOffVal !== 0 ? (roundOffVal > 0 ? '+' : '') + ' Rs. ' + roundOffVal.toFixed(2) : 'Rs. 0.00'}`, PAD + 5, Y + 3);
          Y += 16;

          if (invoice.enableTds && Number(invoice.tdsAmount) > 0) {
            const tdsSec = invoice.tdsSection ? ` (${invoice.tdsSection})` : '';
            const tdsRate = invoice.tdsRate ? ` @ ${invoice.tdsRate}%` : '';
            doc.rect(PAD, Y, CW, 16).fill(PRPL).stroke(S200);
            doc.fillColor(PRPM).fontSize(8).font('Helvetica-Bold')
              .text(`Less: TDS${tdsSec}${tdsRate}: - Rs. ${Math.round(Number(invoice.tdsAmount || 0))}`, PAD + 5, Y + 3);
            const netPayable = Math.max(0, Number(grandTotalVal) - Number(invoice.tdsAmount || 0));
            doc.fillColor(PRP).fontSize(8.5).font('Helvetica-Bold')
              .text(`Net Receivable: Rs. ${netPayable.toFixed(2)}`, PAD + CW - 160, Y + 3, { width: 155, align: 'right' });
            Y += 16;
          }

          doc.rect(PAD, Y, CW, 16).fill(WHT).stroke(S200);
          doc.fillColor(S500).fontSize(7.5).font('Helvetica')
            .text('Tax Amount (in words):', PAD + 2, Y + 2)
            .text(numToWords(totalTax), PAD + 105, Y + 2, { width: CW - 109 });
          Y += 16;

          return Y;
        };

        const drawFooter = (startY) => {
          const minFooterY = PH - PAD - 82;
          const footerY = (typeof startY === 'number' && !isNaN(startY)) ? Math.max(startY, minFooterY) : minFooterY;
          doc.moveTo(PAD, footerY).lineTo(PAD + CW, footerY).strokeColor(S200).lineWidth(0.6).stroke();

          const leftFW = 320;
          const rightFX = PAD + leftFW + 8;
          const rightFW = CW - leftFW - 8;

          doc.fillColor(S900).fontSize(8).font('Helvetica-Bold')
            .text("Company's Bank Details:", PAD + 4, footerY + 4);
          doc.fillColor(S700).fontSize(7.5).font('Helvetica')
            .text(`Bank Name: ${bankName}`, PAD + 4, footerY + 15)
            .text(`A/c No.: ${bankAcNo}`, PAD + 4, footerY + 24)
            .text(`Branch & IFS Code: ${bankIfsc}`, PAD + 4, footerY + 33);
          doc.fillColor(S500).fontSize(6.5).font('Helvetica')
            .text('Terms & Conditions:', PAD + 4, footerY + 43)
            .text(companyTerms, PAD + 4, footerY + 51, { width: leftFW });

          doc.fillColor(S900).fontSize(8.5).font('Helvetica-Bold')
            .text(`for ${companyDisplayName.toUpperCase()}`, rightFX, footerY + 4, { width: rightFW, align: 'right' });
          doc.moveTo(rightFX + rightFW - 100, footerY + 44).lineTo(rightFX + rightFW, footerY + 44)
            .strokeColor(S500).lineWidth(0.5).stroke();
          doc.fillColor(S500).fontSize(8).font('Helvetica')
            .text('Authorised Signatory', rightFX, footerY + 46, { width: rightFW, align: 'right' });

          const bottomNoteY = PH - PAD - 12;
          doc.moveTo(PAD, bottomNoteY).lineTo(PAD + CW, bottomNoteY).strokeColor(S200).lineWidth(0.4).stroke();
          doc.fillColor(S500).fontSize(7).font('Helvetica')
            .text('This is a Computer Generated Document', PAD, bottomNoteY + 2, { width: CW, align: 'center' });
        };

        // ── PAGINATION: INTERMEDIATE PAGES FIT UP TO 6 ITEMS; LAST PAGE HAS FULL DETAILS ──
        // pageChunks and totalPages are calculated at start of renderPage (getInvoicePageChunks(items, 6, 5))

        const tdsExtraH = (invoice.enableTds && Number(invoice.tdsAmount) > 0) ? 16 : 0;
        const sumH = (isIgst
          ? (16 * hsnRows.length + 16 + 22 + 28 + 18 + 16 * hsnRows.length + 17 + 3 + 16)
          : (32 * hsnRows.length + 16 + 22 + 28 + 18 + 16 * hsnRows.length + 17 + 3 + 16)) + tdsExtraH;
        const minFooterY = PH - PAD - 82;
        const subRowH = 18;
        const minBottomYLast = minFooterY - sumH - subRowH;
        const minBottomYNonLast = PH - PAD - 16 - subRowH;

        let runningStartIdx = 0;
        pageChunks.forEach((chunk, pageIdx) => {
          if (!isFirstPageOverall) {
            doc.addPage({ margin: 0, size: 'A4' });
          }
          isFirstPageOverall = false;

          const isLast = pageIdx === pageChunks.length - 1;
          const pageLabel = totalPages > 1 ? `${pageIdx + 1} of ${totalPages}` : '';
          let Y = drawHeader(pageLabel);

          const startIdx = runningStartIdx;
          runningStartIdx += chunk.length;

          if (isLast) {
            Y = drawItemsTable(Y, chunk, startIdx, true, minBottomYLast);
            Y = drawSummary(Y);
            drawFooter(Y);
          } else {
            Y = drawItemsTable(Y, chunk, startIdx, false, minBottomYNonLast);
            const bottomNoteY = PH - PAD - 12;
            doc.moveTo(PAD, bottomNoteY).lineTo(PAD + CW, bottomNoteY).strokeColor(S200).lineWidth(0.4).stroke();
            doc.fillColor(S500).fontSize(7).font('Helvetica')
              .text('This is a Computer Generated Document', PAD, bottomNoteY + 2, { width: CW, align: 'center' });
          }
        });
      };

      renderPage('ORIGINAL FOR BUYER', false);
    }

    console.log(`[Bulk PDF Performance] ${invoices.length} Invoices generated into single combined PDF in ${Date.now() - startTime}ms`);
    doc.end();

  } catch (error) {
    console.error('Download Bulk Invoice PDF Error:', error);
    res.status(500).send('Error generating bulk combined PDF invoice');
  }
};


// ── 10. CUSTOMER CRUD ────────────────────────────────────────────────────────
const getCustomers = async (req, res) => {
  try {
    const { companyEntity } = req.query;
    const filter = buildCompanyFilter(companyEntity);
    const customers = await BillingCustomer.find(filter).sort({ name: 1 }).lean();
    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const createCustomer = async (req, res) => {
  try {
    const customer = await BillingCustomer.create(req.body);
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const customer = await BillingCustomer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    await BillingCustomer.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── 10B. VENDOR CRUD (Billing Vendors Collection) ──────────────────────────
const getVendors = async (req, res) => {
  try {
    const { companyEntity } = req.query;
    const filter = buildPurchaseCompanyFilter(companyEntity);

    const vendors = await BillingVendor.find(filter).sort({ name: 1 }).lean();
    res.json({ success: true, data: vendors || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const createVendor = async (req, res) => {
  try {
    const vendor = await BillingVendor.create(req.body);
    res.status(201).json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateVendor = async (req, res) => {
  try {
    const vendor = await BillingVendor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!vendor) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }
    res.json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteVendor = async (req, res) => {
  try {
    const deleted = await BillingVendor.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }
    res.json({ success: true, message: 'Vendor deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── 11. ITEM CRUD ────────────────────────────────────────────────────────────
const getItems = async (req, res) => {
  try {
    const { companyEntity } = req.query;
    const filter = buildCompanyFilter(companyEntity);
    const items = await BillingItem.find(filter).sort({ itemName: 1 }).lean();
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const createItem = async (req, res) => {
  try {
    const item = await BillingItem.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateItem = async (req, res) => {
  try {
    const item = await BillingItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    await BillingItem.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Billing item deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── 12. COMPANY SETTINGS CRUD ────────────────────────────────────────────────
const getCompanySettings = async (req, res) => {
  try {
    const { companyEntity = 'Elite Online' } = req.query;
    const PrintConfig = require('../db/models/printConfig.model');
    let config = await PrintConfig.findOne({ companyEntity }).lean();
    if (!config) {
      const masterConfig = (await PrintConfig.findOne({ isConfig: true }).lean()) || {};
      let compName = companyEntity.toUpperCase();
      let prefix = 'EE-2627-';
      let startNo = 1;
      let isEE = companyEntity === 'Elite Edition';

      if (companyEntity === 'Sobise') {
        prefix = 'SO-2627-';
      } else if (companyEntity === 'Elite Fabtex') {
        prefix = 'EF-2627-';
      } else if (companyEntity === 'Ethno wear') {
        prefix = 'EW-2627-';
      } else if (companyEntity === 'Yamunaji') {
        prefix = 'YJ-2627-';
      } else if (companyEntity === 'Elite Online' || companyEntity === 'Elite Digital Print') {
        prefix = 'EDP/26-27/';
        startNo = 223;
      }
      config = {
        companyEntity,
        companyName: isEE ? 'ELITE EDITION' : compName,
        invoicePrefix: prefix,
        startingInvoiceNo: startNo,
        companyGstin: isEE ? '24BSWPA7682P1ZS' : '',
        companyAddress: isEE ? '1095, SIDDHESWAR SOC, KALAPOOL, PUNAGAM, Surat, Gujarat - 395010' : '',
        companyPhone: isEE ? '+91 76006 65058' : '',
        companyEmail: isEE ? 'INFO.ELITEEDITION@GMAIL.COM' : '',
        companyLogo: '',
        companyState: 'Gujarat',
        companyStateCode: '24',
        companyBankName: isEE ? 'KOTAK MAHINDRA BANK' : '',
        companyAccountNo: isEE ? '9909866667' : '',
        companyIfscCode: isEE ? 'KKBK0000883' : '',
        companyTerms: masterConfig.companyTerms || 'Payment due within 30 days from invoice date. Subject to Surat jurisdiction.',
        categories: masterConfig.categories || ['Cotton', 'Polyester', 'Silk'],
        paperTypes: masterConfig.paperTypes || ['A++', 'A+', 'A'],
        fabrics: masterConfig.fabrics || ['Rayon', 'Cotton', 'Poly'],
        widths: masterConfig.widths || ['44"', '58"', '60"'],
        passes: masterConfig.passes || ['1 Pass', '2 Pass'],
        expenseInCategories: masterConfig.expenseInCategories || ['Petty Cash Top-up', 'Client Payment / Advance', 'Scrap / Waste Sale', 'Refund / Cashback', 'Other Receipt'],
        expenseOutCategories: masterConfig.expenseOutCategories || ['Machine Maintenance & Service', 'Ink & Consumables', 'Spare Parts & Repairs', 'Paper & Transfer Film', 'Tea & Refreshments', 'Carriage & Freight', 'Salary / Daily Wages', 'Electricity & Utility', 'Stationery & Office', 'Other Expense'],
        expensePaymentModes: masterConfig.expensePaymentModes || ['Cash', 'UPI / GPay / PhonePe', 'Bank Transfer (NEFT/RTGS)', 'Cheque', 'Credit / Debit Card', 'Other'],
        purchaseTypes: ['Inventory Purchase', 'Expense Purchase', 'Asset Purchase']
      };
    }
    const defaultChallanDesign = {
      title: 'DELIVERY CHALLAN',
      prefix: 'DC-2627-',
      startingNo: 1,
      paperSize: 'A4',
      orientation: 'portrait',
      copies: ['Original for Consignee', 'Duplicate for Transporter', 'Triplicate for Supplier'],
      showLogo: true,
      showGstin: true,
      showPhoneEmail: true,
      showBankDetails: false,
      showDesignImage: true,
      showHsnCode: true,
      showRateAndAmount: true,
      showRemarks: true,
      signatureLeft: "Receiver's Signature",
      signatureCenter: "Prepared / Checked By",
      signatureRight: "Authorized Signatory",
      termsAndConditions: '1. Goods received in good condition and as per specification.\n2. Dispute if any subject to Surat jurisdiction only.\n3. Goods once dispatched/delivered will not be taken back.',
      footerNote: 'This is a computer generated delivery challan.'
    };

    const defaultReportDesign = {
      themeColor: '#0284c7',
      paperSize: 'A4',
      orientation: 'landscape',
      density: 'compact',
      showLogo: true,
      showKpiSummary: true,
      showGeneratedBy: true,
      showTimestamp: true,
      watermarkText: '',
      footerDisclaimer: 'Confidential ERP Report - For Internal Operations Only.'
    };

    config.challanDesign = { ...defaultChallanDesign, ...(config.challanDesign || {}) };
    config.reportDesign = { ...defaultReportDesign, ...(config.reportDesign || {}) };

    if (config.purchaseTypes === undefined || config.purchaseTypes === null || !Array.isArray(config.purchaseTypes)) {
      config.purchaseTypes = ['Inventory Purchase', 'Expense Purchase', 'Asset Purchase'];
    }

    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateCompanySettings = async (req, res) => {
  try {
    const { companyEntity = 'Elite Online', ...otherFields } = req.body;
    const PrintConfig = require('../db/models/printConfig.model');
    const updated = await PrintConfig.findOneAndUpdate(
      { companyEntity },
      { $set: { ...otherFields, companyEntity } },
      { new: true, upsert: true, returnDocument: 'after' }
    );
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── 13. PURCHASES CRUD ────────────────────────────────────────────────────────
const getPurchases = async (req, res) => {
  try {
    const { companyEntity, search } = req.query;
    let query = {};
    if (companyEntity && companyEntity !== 'ALL') {
      query = buildPurchaseCompanyFilter(companyEntity);
    }
    if (search && search.trim()) {
      const s = search.trim();
      const searchConditions = [
        { purchaseNo: { $regex: s, $options: 'i' } },
        { billNo: { $regex: s, $options: 'i' } },
        { vendorName: { $regex: s, $options: 'i' } },
        { itemName: { $regex: s, $options: 'i' } },
        { 'items.itemName': { $regex: s, $options: 'i' } }
      ];
      if (query.$or) {
        query = {
          $and: [
            { $or: query.$or },
            { $or: searchConditions }
          ]
        };
      } else {
        query.$or = searchConditions;
      }
    }
    const purchases = await BillingPurchase.find(query).sort({ date: -1, createdAt: -1 }).lean();
    res.json({ success: true, data: purchases });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getPurchasePrefix = (entity = 'Elite Digital Prints') => {
  const norm = String(entity || '').trim().toLowerCase();
  if (norm.includes('ethno') || norm === 'ew') return 'EWP-';
  if (norm.includes('yamunaji') || norm === 'yj') return 'YJP-';
  if (norm.includes('edition') || norm === 'ee') return 'EEP-';
  if (norm.includes('fabtex') || norm === 'ef') return 'EFP-';
  if (norm.includes('sobise') || norm === 'so') return 'SOP-';
  if (norm.includes('stitching') || norm === 'es') return 'ESP-';
  if (norm.includes('online') || norm === 'eo') return 'EOP-';
  return 'DP-';
};

const getPurchaseRegex = (prefix) => {
  if (prefix === 'DP-') return /^DP[-_]?(\d+)/i;
  const clean = prefix.replace('-', '');
  return new RegExp(`^${clean}[-_]?(\\d+)`, 'i');
};

const getNextPurchaseNo = async (req, res) => {
  try {
    const { companyEntity = 'Elite Digital Prints' } = req.query;
    const prefix = getPurchasePrefix(companyEntity);
    const regex = getPurchaseRegex(prefix);

    const purchases = await BillingPurchase.find({
      $or: [
        { companyEntity },
        { purchaseNo: { $regex: `^${prefix}`, $options: 'i' } }
      ]
    }, 'purchaseNo').lean();
    let maxNum = 0;

    purchases.forEach(p => {
      if (p.purchaseNo) {
        const match = String(p.purchaseNo).trim().match(regex);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    });

    const nextSeq = maxNum + 1;
    const purchaseNo = `${prefix}${String(nextSeq).padStart(2, '0')}`;
    res.json({ success: true, nextSeq, prefix, purchaseNo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const createPurchase = async (req, res) => {
  try {
    const purchaseData = { ...req.body };
    if (!purchaseData.purchaseNo || !purchaseData.purchaseNo.trim()) {
      const prefix = getPurchasePrefix(purchaseData.companyEntity);
      const regex = getPurchaseRegex(prefix);

      const purchases = await BillingPurchase.find({
        $or: [
          { companyEntity: purchaseData.companyEntity },
          { purchaseNo: { $regex: `^${prefix}`, $options: 'i' } }
        ]
      }, 'purchaseNo').lean();
      let maxNum = 0;
      purchases.forEach(p => {
        if (p.purchaseNo) {
          const match = String(p.purchaseNo).trim().match(regex);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }
      });
      purchaseData.purchaseNo = `${prefix}${String(maxNum + 1).padStart(2, '0')}`;
    }
    if (purchaseData.date) {
      purchaseData.date = new Date(purchaseData.date);
    }
    if (purchaseData.dueDate) {
      purchaseData.dueDate = new Date(purchaseData.dueDate);
    }
    if (!purchaseData.vendorName && purchaseData.vendor) {
      purchaseData.vendorName = purchaseData.vendor.businessName || purchaseData.vendor.name || '';
    }
    if (purchaseData._id && !mongoose.Types.ObjectId.isValid(purchaseData._id)) {
      delete purchaseData._id;
    }

    // ── Duplicate Purchase Bill Guard (Vendor + Bill No, or complete details) ──
    const vName = (purchaseData.vendorName || purchaseData.vendor?.businessName || purchaseData.vendor?.name || '').trim();
    const bNo = (purchaseData.billNo || '').trim();
    const chNo = (purchaseData.ourChallanNo || '').trim();
    const cEntity = (purchaseData.companyEntity || '').trim();
    const gTotal = Number(purchaseData.grandTotal || purchaseData.totalAmount || 0);
    const pDate = purchaseData.date ? new Date(purchaseData.date) : new Date();

    if (vName && bNo && bNo !== '-' && bNo.toLowerCase() !== 'na' && bNo.toLowerCase() !== 'n/a') {
      const dupQuery = {
        vendorName: { $regex: new RegExp(`^${vName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        billNo: { $regex: new RegExp(`^${bNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      };
      if (cEntity) {
        dupQuery.companyEntity = { $regex: new RegExp(`^${cEntity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
      }
      const existing = await BillingPurchase.findOne(dupQuery);
      if (existing) {
        const dupDate = existing.date ? new Date(existing.date).toLocaleDateString('en-GB') : 'N/A';
        return res.status(409).json({
          success: false,
          error: `Duplicate Purchase Blocked: Purchase #${existing.purchaseNo} already exists for Vendor "${existing.vendorName}", Bill #${existing.billNo} with Total ₹${(Number(existing.grandTotal || existing.totalAmount || 0)).toFixed(2)} (dated ${dupDate}). Duplicate purchase bills are not permitted.`
        });
      }
    } else if (vName && chNo && chNo !== '-' && chNo.toLowerCase() !== 'na' && chNo.toLowerCase() !== 'n/a') {
      const dupQuery = {
        vendorName: { $regex: new RegExp(`^${vName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        ourChallanNo: { $regex: new RegExp(`^${chNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      };
      const existing = await BillingPurchase.findOne(dupQuery);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: `Duplicate Purchase Blocked: Purchase #${existing.purchaseNo} already exists for Vendor "${existing.vendorName}", Challan #${existing.ourChallanNo} with Total ₹${(Number(existing.grandTotal || existing.totalAmount || 0)).toFixed(2)}.`
        });
      }
    } else if (vName && gTotal > 0) {
      const startOfDay = new Date(pDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(pDate);
      endOfDay.setHours(23, 59, 59, 999);

      const dupQuery = {
        vendorName: { $regex: new RegExp(`^${vName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        billNo: { $in: [null, '', '-', 'NA', 'N/A', 'na', 'n/a'] },
        grandTotal: { $gte: gTotal - 1, $lte: gTotal + 1 },
        date: { $gte: startOfDay, $lte: endOfDay }
      };
      const existing = await BillingPurchase.findOne(dupQuery);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: `Duplicate Purchase Blocked: Purchase #${existing.purchaseNo} with identical Vendor "${existing.vendorName}" and Total ₹${(Number(existing.grandTotal || existing.totalAmount || 0)).toFixed(2)} already exists for this date.`
        });
      }
    }

    const purchase = await BillingPurchase.create(purchaseData);

    // Auto-upsert into BillingVendor if vendor info is present so user never loses entered vendor
    if (purchaseData.vendor && (purchaseData.vendor.name || purchaseData.vendor.businessName)) {
      const vName = (purchaseData.vendor.name || purchaseData.vendor.businessName).trim();
      const vBusiness = (purchaseData.vendor.businessName || purchaseData.vendor.name).trim();
      const companyEntity = purchaseData.companyEntity || 'Elite Digital Print';
      BillingVendor.findOneAndUpdate(
        {
          $or: [
            { name: vName },
            { businessName: vBusiness }
          ]
        },
        {
          $setOnInsert: {
            name: vName,
            businessName: vBusiness,
            phone: purchaseData.vendor.phone || '',
            email: purchaseData.vendor.email || '',
            gstin: purchaseData.vendor.gstin || '',
            billingAddress: purchaseData.vendor.billingAddress || '',
            shippingAddress: purchaseData.vendor.shippingAddress || '',
            state: purchaseData.vendor.state || 'Gujarat',
            stateCode: purchaseData.vendor.stateCode || '24',
            vendorType: 'General Supplier',
            companyEntity
          }
        },
        { upsert: true, new: true }
      ).catch(() => {});
    }

    // Auto-upsert into BillingItem catalog so any newly entered line item is saved with its details
    if (Array.isArray(purchaseData.items) && purchaseData.items.length > 0) {
      const compEntity = purchaseData.companyEntity || 'Elite Digital Prints';
      for (const it of purchaseData.items) {
        if (!it.itemName || !it.itemName.trim()) continue;
        const cleanName = it.itemName.trim();
        const escaped = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        BillingItem.findOne({
          $or: [
            { companyEntity: compEntity, itemName: { $regex: `^${escaped}$`, $options: 'i' } },
            { itemName: { $regex: `^${escaped}$`, $options: 'i' } }
          ]
        }).then(existing => {
          if (!existing) {
            const defaultCat = purchaseData.purchaseType === 'asset'
              ? 'Capital Assets'
              : purchaseData.purchaseType === 'expense'
                ? 'Operating Expenses'
                : 'Raw Materials';
            return BillingItem.create({
              companyEntity: compEntity,
              itemName: cleanName,
              hsnCode: it.hsnCode || '998821',
              unitPrice: parseFloat(it.unitPrice != null ? it.unitPrice : it.rate) || 0,
              unit: it.unit || 'Meters',
              taxRate: parseFloat(it.taxRate) != null ? parseFloat(it.taxRate) : 5,
              category: defaultCat
            });
          }
        }).catch(e => console.warn('Auto-upsert BillingItem error:', e.message));
      }
    }

    res.status(201).json({ success: true, data: purchase });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updatePurchase = async (req, res) => {
  try {
    const purchaseData = { ...req.body };
    if (purchaseData.date) {
      purchaseData.date = new Date(purchaseData.date);
    }
    if (purchaseData.dueDate) {
      purchaseData.dueDate = new Date(purchaseData.dueDate);
    }
    if (!purchaseData.vendorName && purchaseData.vendor) {
      purchaseData.vendorName = purchaseData.vendor.businessName || purchaseData.vendor.name || '';
    }
    delete purchaseData._id;

    // ── Duplicate Purchase Bill Guard on Edit ──
    const vName = (purchaseData.vendorName || purchaseData.vendor?.businessName || purchaseData.vendor?.name || '').trim();
    const bNo = (purchaseData.billNo || '').trim();
    const chNo = (purchaseData.ourChallanNo || '').trim();
    const cEntity = (purchaseData.companyEntity || '').trim();
    const gTotal = Number(purchaseData.grandTotal || purchaseData.totalAmount || 0);
    const pDate = purchaseData.date ? new Date(purchaseData.date) : new Date();

    if (vName && bNo && bNo !== '-' && bNo.toLowerCase() !== 'na' && bNo.toLowerCase() !== 'n/a') {
      const dupQuery = {
        _id: { $ne: req.params.id },
        vendorName: { $regex: new RegExp(`^${vName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        billNo: { $regex: new RegExp(`^${bNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      };
      if (cEntity) {
        dupQuery.companyEntity = { $regex: new RegExp(`^${cEntity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
      }
      const existing = await BillingPurchase.findOne(dupQuery);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: `Duplicate Purchase Blocked: Purchase #${existing.purchaseNo} already exists for Vendor "${existing.vendorName}", Bill #${existing.billNo} with Total ₹${(Number(existing.grandTotal || existing.totalAmount || 0)).toFixed(2)}.`
        });
      }
    } else if (vName && chNo && chNo !== '-' && chNo.toLowerCase() !== 'na' && chNo.toLowerCase() !== 'n/a') {
      const dupQuery = {
        _id: { $ne: req.params.id },
        vendorName: { $regex: new RegExp(`^${vName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        ourChallanNo: { $regex: new RegExp(`^${chNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      };
      const existing = await BillingPurchase.findOne(dupQuery);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: `Duplicate Purchase Blocked: Purchase #${existing.purchaseNo} already exists for Vendor "${existing.vendorName}", Challan #${existing.ourChallanNo} with Total ₹${(Number(existing.grandTotal || existing.totalAmount || 0)).toFixed(2)}.`
        });
      }
    } else if (vName && gTotal > 0) {
      const startOfDay = new Date(pDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(pDate);
      endOfDay.setHours(23, 59, 59, 999);

      const dupQuery = {
        _id: { $ne: req.params.id },
        vendorName: { $regex: new RegExp(`^${vName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        billNo: { $in: [null, '', '-', 'NA', 'N/A', 'na', 'n/a'] },
        grandTotal: { $gte: gTotal - 1, $lte: gTotal + 1 },
        date: { $gte: startOfDay, $lte: endOfDay }
      };
      const existing = await BillingPurchase.findOne(dupQuery);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: `Duplicate Purchase Blocked: Purchase #${existing.purchaseNo} with identical Vendor "${existing.vendorName}" and Total ₹${(Number(existing.grandTotal || existing.totalAmount || 0)).toFixed(2)} already exists for this date.`
        });
      }
    }

    const purchase = await BillingPurchase.findByIdAndUpdate(req.params.id, purchaseData, { new: true });
    if (!purchase) {
      return res.status(404).json({ success: false, error: 'Purchase record not found' });
    }

    // Auto-upsert into BillingVendor if vendor info is present
    if (purchaseData.vendor && (purchaseData.vendor.name || purchaseData.vendor.businessName)) {
      const vName = (purchaseData.vendor.name || purchaseData.vendor.businessName).trim();
      const vBusiness = (purchaseData.vendor.businessName || purchaseData.vendor.name).trim();
      const companyEntity = purchaseData.companyEntity || 'Elite Digital Print';
      BillingVendor.findOneAndUpdate(
        {
          $or: [
            { name: vName },
            { businessName: vBusiness }
          ]
        },
        {
          $setOnInsert: {
            name: vName,
            businessName: vBusiness,
            phone: purchaseData.vendor.phone || '',
            email: purchaseData.vendor.email || '',
            gstin: purchaseData.vendor.gstin || '',
            billingAddress: purchaseData.vendor.billingAddress || '',
            shippingAddress: purchaseData.vendor.shippingAddress || '',
            state: purchaseData.vendor.state || 'Gujarat',
            stateCode: purchaseData.vendor.stateCode || '24',
            vendorType: 'General Supplier',
            companyEntity
          }
        },
        { upsert: true, new: true }
      ).catch(() => {});
    }

    // Auto-upsert into BillingItem catalog so any newly entered line item is saved with its details
    if (Array.isArray(purchaseData.items) && purchaseData.items.length > 0) {
      const compEntity = purchaseData.companyEntity || 'Elite Digital Prints';
      for (const it of purchaseData.items) {
        if (!it.itemName || !it.itemName.trim()) continue;
        const cleanName = it.itemName.trim();
        const escaped = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        BillingItem.findOne({
          $or: [
            { companyEntity: compEntity, itemName: { $regex: `^${escaped}$`, $options: 'i' } },
            { itemName: { $regex: `^${escaped}$`, $options: 'i' } }
          ]
        }).then(existing => {
          if (!existing) {
            const defaultCat = purchaseData.purchaseType === 'asset'
              ? 'Capital Assets'
              : purchaseData.purchaseType === 'expense'
                ? 'Operating Expenses'
                : 'Raw Materials';
            return BillingItem.create({
              companyEntity: compEntity,
              itemName: cleanName,
              hsnCode: it.hsnCode || '998821',
              unitPrice: parseFloat(it.unitPrice != null ? it.unitPrice : it.rate) || 0,
              unit: it.unit || 'Meters',
              taxRate: parseFloat(it.taxRate) != null ? parseFloat(it.taxRate) : 5,
              category: defaultCat
            });
          }
        }).catch(e => console.warn('Auto-upsert BillingItem error:', e.message));
      }
    }

    res.json({ success: true, data: purchase });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const deletePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const { purchaseNo, vendorName } = req.query;

    const filter = { $or: [] };
    if (mongoose.Types.ObjectId.isValid(id)) {
      filter.$or.push({ _id: new mongoose.Types.ObjectId(id) });
    } else if (id) {
      filter.$or.push({ id });
      filter.$or.push({ purchaseNo: id });
    }

    if (purchaseNo && String(purchaseNo).trim()) {
      const pNo = String(purchaseNo).trim();
      const escaped = pNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or.push({ purchaseNo: pNo });
      filter.$or.push({ purchaseNo: new RegExp(`^${escaped}$`, 'i') });
    }

    if (filter.$or.length === 0) {
      return res.status(400).json({ success: false, error: 'Valid purchase identifier required' });
    }

    // Atomic purge of all duplicate/alias records matching this purchase across all entity aliases
    const result = await BillingPurchase.deleteMany(filter);
    res.json({
      success: true,
      message: 'Purchase record deleted successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const bulkSyncPurchases = async (req, res) => {
  try {
    const { purchases } = req.body;
    if (!Array.isArray(purchases) || purchases.length === 0) {
      return res.json({ success: true, count: 0, message: 'No purchases provided' });
    }

    let syncedCount = 0;
    const syncedRecords = [];
    for (const p of purchases) {
      if (!p.purchaseNo && !p.vendorName) continue;
      const purchaseNo = (p.purchaseNo || '').trim();
      const vendorName = (p.vendorName || '').trim();
      const companyEntity = p.companyEntity || 'Elite Digital Prints';

      const existing = await BillingPurchase.findOne({
        purchaseNo,
        vendorName
      });

      if (!existing) {
        const created = await BillingPurchase.create({
          ...p,
          companyEntity,
          purchaseNo: purchaseNo || `PUR-${Date.now().toString().slice(-4)}`,
          date: p.date ? new Date(p.date) : new Date(),
          dueDate: p.dueDate ? new Date(p.dueDate) : undefined,
          vendor: p.vendor || undefined,
          vendorName: p.vendorName || (p.vendor ? (p.vendor.businessName || p.vendor.name) : '') || vendorName,
          items: Array.isArray(p.items) ? p.items : [],
          notes: p.notes || ''
        });
        syncedRecords.push(created);
        syncedCount++;
      } else {
        syncedRecords.push(existing);
      }
    }
    res.json({ success: true, syncedCount, data: syncedRecords });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const HSN_STANDARD_DESCRIPTIONS = {
  '9988': 'Textile Job Work / Manufacturing Services on Physical Inputs Owned by Others',
  '998821': 'Textile Job Work / Digital Printing, Dyeing & Bleaching Services',
  '998822': 'Knitting, Weaving and Stitching Job Work Services',
  '998829': 'Other Manufacturing Services on Textile Inputs',
  '9983': 'Design, Graphic and Artwork Services',
  '5407': 'Woven Fabrics of Synthetic Filament Yarn',
  '5408': 'Woven Fabrics of Artificial Filament Yarn',
  '5208': 'Woven Fabrics of Cotton (Powerloom / Mill)',
  '5209': 'Woven Fabrics of Cotton (Heavy Weight)',
  '5512': 'Woven Fabrics of Synthetic Staple Fibres',
  '5513': 'Woven Fabrics of Synthetic Staple Fibres (Mixed with Cotton)',
  '5514': 'Woven Fabrics of Synthetic Staple Fibres (Heavy Weight)',
  '5515': 'Other Woven Fabrics of Synthetic Staple Fibres',
  '5516': 'Woven Fabrics of Artificial Staple Fibres',
  '6001': 'Pile Fabrics (Including Terry Towelling)',
  '6006': 'Other Knitted or Crocheted Fabrics',
  '6203': 'Mens / Boys Suits, Ensembles, Trousers',
  '6204': 'Womens / Girls Suits, Ensembles, Dresses, Skirts, Trousers',
  '6302': 'Bed Linen, Table Linen, Toilet Linen and Kitchen Linen',
  '6307': 'Other Made Up Textile Articles'
};

function normalizeUqc(unit, hsnCode) {
  const u = String(unit || '').trim().toLowerCase();
  const hsn = String(hsnCode || '').trim();
  const isService = hsn.startsWith('99');

  if (/meter|mtr/i.test(u)) return 'MTR';
  if (/kg|kilo/i.test(u)) return 'KGS';
  if (/pc|piece/i.test(u)) return 'PCS';
  if (/no|number|nos/i.test(u)) return 'NOS';
  if (/roll/i.test(u)) return 'ROL';
  if (/yard|yd/i.test(u)) return 'YDS';
  if (/sqm|sq\.mt|sq\s*mtr/i.test(u)) return 'SQM';
  if (/sqf|sq\.ft/i.test(u)) return 'SQF';
  if (isService && (!u || /na|none|oth|other|service|job/i.test(u))) return 'OTH';
  if (u.length === 3 && /^[A-Z]{3}$/i.test(u)) return u.toUpperCase();
  return isService ? 'OTH' : 'MTR';
}

function resolveHsnDescription(hsnCode, rawDesc, rawItemName) {
  const code = String(hsnCode || '').trim();
  if (HSN_STANDARD_DESCRIPTIONS[code]) return HSN_STANDARD_DESCRIPTIONS[code];
  const prefix4 = code.substring(0, 4);
  if (HSN_STANDARD_DESCRIPTIONS[prefix4]) return HSN_STANDARD_DESCRIPTIONS[prefix4];
  if (rawDesc && rawDesc.trim() && rawDesc.trim().length > 2) return rawDesc.trim();
  if (rawItemName && rawItemName.trim() && rawItemName.trim().length > 2) return rawItemName.trim();
  if (code.startsWith('99')) return 'Textile Job Work / Processing Services';
  return 'Textile Fabrics / Goods';
}

const getGstr1Table12Summary = async (req, res) => {
  try {
    const { dateStart, dateEnd, companyEntity, partyType = 'ALL', gstin } = req.query;

    const filter = {
      invoiceStatus: { $ne: 'CANCELLED' }
    };

    if (companyEntity && companyEntity !== 'ALL') {
      Object.assign(filter, buildCompanyFilter(companyEntity));
    }

    if (dateStart || dateEnd) {
      const dsStr = dateStart ? String(dateStart).split('T')[0] : '';
      const deStr = dateEnd ? String(dateEnd).split('T')[0] : '';
      const minMs = dsStr ? Math.min(new Date(`${dsStr}T00:00:00.000Z`).getTime(), new Date(`${dsStr}T00:00:00.000`).getTime()) : null;
      const maxMs = deStr ? Math.max(new Date(`${deStr}T23:59:59.999Z`).getTime(), new Date(`${deStr}T23:59:59.999`).getTime()) : null;

      const dateQuery = {};
      if (minMs) dateQuery.$gte = new Date(minMs);
      if (maxMs) dateQuery.$lte = new Date(maxMs);

      filter.$or = [
        { invoiceDate: dateQuery },
        { invoiceDate: { $gte: dsStr, $lte: deStr } },
        { created_at: dateQuery },
        { createdAt: dateQuery }
      ];
    }

    const invoices = await BillingInvoice.find(filter).lean();

    const groups = {};

    let grandTotalQty = 0;
    let grandTotalTaxable = 0;
    let grandTotalIgst = 0;
    let grandTotalCgst = 0;
    let grandTotalSgst = 0;
    let grandTotalCess = 0;
    let grandTotalValue = 0;

    invoices.forEach(inv => {
      const custGstin = (inv.customer?.gstin || '').trim();
      const isB2B = !!custGstin && custGstin.length >= 15;
      if (partyType === 'B2B' && !isB2B) return;
      if (partyType === 'B2C' && isB2B) return;

      const isInterState = inv.taxType === 'IGST' ||
        (inv.customer?.stateCode && String(inv.customer.stateCode).trim() !== '24') ||
        (inv.customer?.state && !inv.customer.state.toLowerCase().includes('gujarat')) ||
        (Number(inv.igstAmount || 0) > 0);

      const items = Array.isArray(inv.items) && inv.items.length > 0
        ? inv.items
        : [{
            itemName: 'Textile Supply',
            hsnCode: '998821',
            qty: 0,
            unit: 'OTH',
            totalAmount: inv.taxableAmount || inv.subtotal || 0,
            taxRate: 5
          }];

      items.forEach(it => {
        const rawHsn = it.hsnCode || '998821';
        const hsn = String(rawHsn).trim() || 'UNMAPPED';
        const uqc = normalizeUqc(it.unit, hsn);
        const taxRate = Number(it.taxRate != null ? it.taxRate : 5);
        const isService = hsn.startsWith('99');
        const qty = isService && (/oth/i.test(uqc) || Number(it.qty) <= 0) ? 0 : Number(it.qty || 0);

        const taxable = Number(it.totalAmount != null ? it.totalAmount : (Number(it.qty || 0) * Number(it.unitPrice || 0) - Number(it.discountAmt || 0))) || 0;

        let igst = 0;
        let cgst = 0;
        let sgst = 0;
        const cess = 0;

        if (isInterState) {
          igst = taxable * (taxRate / 100);
        } else {
          cgst = taxable * (taxRate / 2 / 100);
          sgst = taxable * (taxRate / 2 / 100);
        }

        const totalVal = taxable + igst + cgst + sgst + cess;

        const groupKey = `${hsn}_${uqc}_${taxRate}`;
        if (!groups[groupKey]) {
          groups[groupKey] = {
            hsn,
            description: resolveHsnDescription(hsn, it.description, it.itemName),
            uqc,
            taxRate,
            isService,
            totalQuantity: 0,
            totalValue: 0,
            taxableValue: 0,
            igstAmount: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            cessAmount: 0,
            invoiceCount: 0,
            contributingInvoices: []
          };
        }

        const g = groups[groupKey];
        g.totalQuantity += qty;
        g.taxableValue += taxable;
        g.igstAmount += igst;
        g.cgstAmount += cgst;
        g.sgstAmount += sgst;
        g.cessAmount += cess;
        g.totalValue += totalVal;
        g.invoiceCount += 1;

        if (!g.contributingInvoices.some(ci => ci.id === String(inv._id))) {
          g.contributingInvoices.push({
            id: String(inv._id),
            invoiceNo: inv.invoiceNo,
            invoiceDate: inv.invoiceDate,
            partyName: inv.customer?.businessName || inv.customer?.name || 'Customer',
            gstin: custGstin,
            isB2B,
            taxable,
            qty
          });
        }

        grandTotalQty += qty;
        grandTotalTaxable += taxable;
        grandTotalIgst += igst;
        grandTotalCgst += cgst;
        grandTotalSgst += sgst;
        grandTotalCess += cess;
        grandTotalValue += totalVal;
      });
    });

    const rows = Object.values(groups).sort((a, b) => a.hsn.localeCompare(b.hsn));

    rows.forEach(r => {
      r.totalQuantity = Math.round(r.totalQuantity * 100) / 100;
      r.totalValue = Math.round(r.totalValue * 100) / 100;
      r.taxableValue = Math.round(r.taxableValue * 100) / 100;
      r.igstAmount = Math.round(r.igstAmount * 100) / 100;
      r.cgstAmount = Math.round(r.cgstAmount * 100) / 100;
      r.sgstAmount = Math.round(r.sgstAmount * 100) / 100;
      r.cessAmount = Math.round(r.cessAmount * 100) / 100;
    });

    const grandTotals = {
      totalQuantity: Math.round(grandTotalQty * 100) / 100,
      totalValue: Math.round(grandTotalValue * 100) / 100,
      taxableValue: Math.round(grandTotalTaxable * 100) / 100,
      igstAmount: Math.round(grandTotalIgst * 100) / 100,
      cgstAmount: Math.round(grandTotalCgst * 100) / 100,
      sgstAmount: Math.round(grandTotalSgst * 100) / 100,
      cessAmount: Math.round(grandTotalCess * 100) / 100
    };

    res.json({
      success: true,
      data: {
        gstin: gstin || '24AANFE0044M1ZG',
        companyEntity: companyEntity || 'All Entities',
        dateStart: dateStart || '',
        dateEnd: dateEnd || '',
        partyType,
        rowCount: rows.length,
        rows,
        grandTotals
      }
    });
  } catch (error) {
    if (logger && logger.error) logger.error('Error generating GSTR-1 Table 12 summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getBillingDashboardStats,
  getInvoices,
  getInvoiceById,
  getNextInvoiceNo,
  createInvoice,
  updateInvoice,
  mergeChallans,
  deleteInvoice,
  recordPayment,
  downloadInvoicePdf,
  downloadBulkInvoicesPdf,
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getVendors,
  createVendor,
  updateVendor,
  deleteVendor,
  getItems,
  createItem,
  updateItem,
  deleteItem,
  getCompanySettings,
  updateCompanySettings,
  getPurchases,
  getNextPurchaseNo,
  createPurchase,
  updatePurchase,
  deletePurchase,
  bulkSyncPurchases,
  getGstr1Table12Summary
};
