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
const { normalizeCompanyId } = require('../config/company.constants');

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

  const val = parseFloat(amount || 0);
  if (isNaN(val) || val <= 0) return 'Rupees Zero Only';

  const rupees = Math.floor(val);
  const paise = Math.round((val - rupees) * 100);

  let result = 'Rupees';
  if (rupees > 0) {
    result += ' ' + convert(rupees);
  } else {
    result += ' Zero';
  }

  if (paise > 0) {
    result += ' and ' + convert(paise) + ' Paise';
  }

  return result + ' Only';
}

// Helper for flexible company entity resolution
function resolveCompanyEntity(raw) {
  if (!raw) return 'Elite Digital Print';
  const norm = String(raw).trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (norm === 'exedp' || norm === 'ex-edp' || norm === 'ex_edp' || norm === 'oldedp') return 'EXEDP';
  if (norm === 'eliteonline' || norm === 'eon' || norm === 'eo') return 'Elite Online';
  if (norm === 'eliteedition' || norm === 'ee') return 'Elite Edition';
  if (norm === 'elitefabtex' || norm === 'ef') return 'Elite Fabtex';
  if (norm === 'sobise' || norm === 'so') return 'Sobise';
  if (norm === 'elitestitching' || norm === 'es') return 'Elite Stitching';
  if (norm === 'ethnowear' || norm === 'ew') return 'Ethno wear';
  if (norm === 'yamunaji' || norm === 'yj' || norm === 'yamuna') return 'Yamunaji';
  if (norm === 'elitedigitalprint' || norm === 'elitedigitalprints' || norm === 'edp' || norm === 'digitalprint' || norm === 'digitalprints') return 'Elite Digital Print';
  return String(raw).trim();
}

// Helper for flexible company entity queries
function buildCompanyFilter(companyEntity) {
  if (!companyEntity) return {};
  const raw = String(companyEntity).trim();
  if (raw === '[object Object]') return {};

  const norm = raw.toLowerCase().replace(/[\s_-]+/g, '');

  if (norm === 'exedp' || norm === 'ex-edp' || norm === 'ex_edp' || norm === 'oldedp') {
    return {
      $or: [
        { companyEntity: { $in: ['EXEDP', 'EX-EDP', 'exedp'] } },
        { invoiceNo: { $regex: '^EXEDP', $options: 'i' } }
      ]
    };
  } else if (norm === 'eliteedition' || norm === 'ee') {
    return {
      $or: [
        { companyEntity: 'Elite Edition' },
        { invoiceNo: { $regex: '^EE', $options: 'i' } }
      ]
    };
  } else if (norm === 'elitefabtex' || norm === 'ef') {
    return {
      $or: [
        { companyEntity: 'Elite Fabtex' },
        { invoiceNo: { $regex: '^EF', $options: 'i' } }
      ]
    };
  } else if (norm === 'sobise' || norm === 'so') {
    return {
      $or: [
        { companyEntity: 'Sobise' },
        { invoiceNo: { $regex: '^SO', $options: 'i' } }
      ]
    };
  } else if (norm === 'elitestitching' || norm === 'es') {
    return {
      $or: [
        { companyEntity: 'Elite Stitching' },
        { invoiceNo: { $regex: '^ES', $options: 'i' } }
      ]
    };
  } else if (norm === 'eliteonline' || norm === 'eon' || norm === 'eo') {
    return {
      $or: [
        { companyEntity: 'Elite Online' },
        { invoiceNo: { $regex: '^EO', $options: 'i' } }
      ]
    };
  } else if (norm === 'ethnowear' || norm === 'ew') {
    return {
      $or: [
        { companyEntity: 'Ethno wear' },
        { invoiceNo: { $regex: '^EW', $options: 'i' } }
      ]
    };
  } else if (norm === 'yamunaji' || norm === 'yj') {
    return {
      $or: [
        { companyEntity: 'Yamunaji' },
        { invoiceNo: { $regex: '^YJ', $options: 'i' } }
      ]
    };
  } else if (
    norm === 'elitedigitalprint' ||
    norm === 'elitedigitalprints' ||
    norm === 'edp' ||
    norm === 'digitalprint'
  ) {
    // Elite Digital Print / Digital Print — strictly exclude EXEDP to maintain total data isolation
    return {
      $and: [
        { companyEntity: { $nin: ['EXEDP', 'EX-EDP', 'exedp'] } },
        { invoiceNo: { $not: { $regex: '^EXEDP', $options: 'i' } } },
        {
          $or: [
            { companyEntity: { $in: ['Elite Digital Print', 'Elite Digital Prints', 'EDP', 'edp'] } },
            { companyEntity: { $exists: false } },
            { companyEntity: null },
            { companyEntity: '' },
            { invoiceNo: { $regex: '^EDP', $options: 'i' } }
          ]
        }
      ]
    };
  } else {
    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return {
      $or: [
        { companyEntity: { $regex: `^${escaped}$`, $options: 'i' } }
      ]
    };
  }
}

function buildPurchaseCompanyFilter(companyEntity) {
  if (!companyEntity) return {};
  const ce = String(companyEntity).trim();
  if (ce === '[object Object]') return {};
  const norm = ce.toLowerCase().replace(/[\s_-]+/g, '');

  if (norm === 'exedp' || norm === 'ex-edp' || norm === 'ex_edp' || norm === 'oldedp') {
    return {
      $or: [
        { companyEntity: { $in: ['EXEDP', 'EX-EDP', 'exedp'] } },
        { purchaseNo: { $regex: '^EXEDP', $options: 'i' } }
      ]
    };
  } else if (norm === 'eliteedition' || norm === 'ee') {
    return {
      $or: [
        { companyEntity: 'Elite Edition' },
        { purchaseNo: { $regex: '^EE', $options: 'i' } }
      ]
    };
  } else if (norm === 'elitefabtex' || norm === 'ef') {
    return {
      $or: [
        { companyEntity: 'Elite Fabtex' },
        { purchaseNo: { $regex: '^EF', $options: 'i' } }
      ]
    };
  } else if (norm === 'sobise' || norm === 'so') {
    return {
      $or: [
        { companyEntity: 'Sobise' },
        { purchaseNo: { $regex: '^SO', $options: 'i' } }
      ]
    };
  } else if (norm === 'elitestitching' || norm === 'es') {
    return {
      $or: [
        { companyEntity: 'Elite Stitching' },
        { purchaseNo: { $regex: '^ES', $options: 'i' } }
      ]
    };
  } else if (norm === 'eliteonline' || norm === 'eo' || norm === 'eon') {
    return {
      $or: [
        { companyEntity: 'Elite Online' },
        { purchaseNo: { $regex: '^EO', $options: 'i' } }
      ]
    };
  } else if (norm === 'ethnowear' || norm === 'ew') {
    return {
      $or: [
        { companyEntity: 'Ethno wear' },
        { purchaseNo: { $regex: '^EW', $options: 'i' } }
      ]
    };
  } else if (norm === 'yamunaji' || norm === 'yamunajicreation' || norm === 'yj') {
    return {
      $or: [
        { companyEntity: 'Yamunaji' },
        { purchaseNo: { $regex: '^YJ', $options: 'i' } }
      ]
    };
  } else if (
    norm === 'edp' ||
    norm === 'elitedigitalprint' ||
    norm === 'elitedigitalprints' ||
    norm === 'digitalprint'
  ) {
    return {
      $and: [
        { companyEntity: { $nin: ['EXEDP', 'EX-EDP', 'exedp'] } },
        { purchaseNo: { $not: { $regex: '^EXEDP', $options: 'i' } } },
        {
          $or: [
            { companyEntity: { $in: ['Elite Digital Prints', 'Elite Digital Print', 'EDP', 'edp'] } },
            { companyEntity: { $exists: false } },
            { companyEntity: null },
            { companyEntity: '' }
          ]
        }
      ]
    };
  }
  const escaped = ce.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { companyEntity: { $regex: `^${escaped}$`, $options: 'i' } };
}

// Strict billing module permission guard (SEC-008)
function checkBillingPermission(req) {
  const user = req.user;
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  if (user.isMainAdmin || role === 'super_admin' || role === 'superadmin' || role === 'admin') {
    return true;
  }
  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  const billingScreens = [
    'jobcards_billing',
    'jobcards_billing_elite',
    'jobcards_billing_fabtex',
    'jobcards_billing_sobise',
    'invoices',
    'purchases',
    'eo_invoices',
    'ee_invoices',
    'ef_invoices',
    'so_invoices',
    'ew_invoices',
    'yj_invoices',
    'exedp_invoices',
    'exedp_finance',
    'exedp_expenses',
    'finance',
    'reports'
  ];
  return billingScreens.some(s => perms.includes(s)) || user.canViewFinancials === true || user.canCreateInvoices === true;
}

// Strict multi-tenant isolation guard (SEC-008 & SEC-002)
function checkCompanyTenantAccess(req, requestedCompany) {
  const user = req.user;
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  const isSuperOwner = user.isMainAdmin || role === 'super_admin' || role === 'superadmin' || user.email === 'harshitsidapara2468@gmail.com';

  // Master Admin and Main Admin have global tenant access across all companies
  if (isSuperOwner) {
    return true;
  }

  // If no company or ALL requested, permit default access if user has company context
  if (!requestedCompany || requestedCompany === 'ALL') {
    return true;
  }

  const canonReq = normalizeCompanyId(requestedCompany);
  const normReq = String(requestedCompany).toLowerCase().replace(/[\s_-]+/g, '');
  const normReqStem = normReq.replace(/s$/, '');

  // 1. Tenant enforcement: derive allowed tenant from user's allowedCompanies
  if (Array.isArray(user.allowedCompanies) && user.allowedCompanies.length > 0) {
    if (user.allowedCompanies.includes('ALL')) return true;
    const isAllowed = user.allowedCompanies.some(ac => {
      const canonAc = normalizeCompanyId(ac);
      if (canonReq && canonAc && canonReq === canonAc) return true;
      const normAc = String(ac).toLowerCase().replace(/[\s_-]+/g, '');
      const normAcStem = normAc.replace(/s$/, '');
      if (normReq === 'exedp' || normReq === 'ex-edp' || normReq === 'ex_edp' || normReq === 'oldedp') {
        return normAc === 'exedp' || normAc === 'elitedigitalprint' || normAc === 'edp' || canonAc === 'digital_print';
      }
      return normAc === normReq || normAcStem === normReqStem;
    });
    if (isAllowed) return true;
  }

  // 2. Direct user company assignment fallback (company_id / companyId / department)
  const userDirectComp = user.company_id || user.companyId || user.department;
  if (userDirectComp) {
    const canonUserComp = normalizeCompanyId(userDirectComp);
    if (canonReq && canonUserComp && canonReq === canonUserComp) return true;
    const normUserComp = String(userDirectComp).toLowerCase().replace(/[\s_-]+/g, '');
    if (normUserComp === normReq || normUserComp.replace(/s$/, '') === normReqStem) return true;
  }

  // 3. Admin role without explicit allowedCompanies array restriction defaults to allowed
  if (role === 'admin') {
    return true;
  }

  return false;
}

// Master Directory Read Access Guard (Customers/Parties, Vendors, Items)
// Allows operational staff (Job Cards, Fabric, Challans, Purchases) to view master directories for their assigned company
function checkDirectoryReadPermission(req, requestedCompany) {
  const user = req.user;
  if (!user) return false;

  const role = String(user.role || '').toLowerCase();
  if (user.isMainAdmin || role === 'super_admin' || role === 'superadmin' || role === 'admin') {
    return true;
  }

  if (checkBillingPermission(req)) {
    return true;
  }

  // Any authenticated user who has access to this company tenant can view party/vendor/item directories
  return checkCompanyTenantAccess(req, requestedCompany);
}

// ── 1. DASHBOARD STATS ────────────────────────────────────────────────────────
const getBillingDashboardStats = async (req, res) => {
  try {
    if (!checkBillingPermission(req)) {
      return res.status(403).json({
        success: false,
        code: 'PERMISSION_DENIED',
        error: 'Access denied: You do not have permission to access Billing & Invoicing records.'
      });
    }

    let { companyEntity } = req.query;
    if (companyEntity === '[object Object]') {
      companyEntity = '';
    }
    let activeCompany = companyEntity || req.headers['x-company-id'] || req.headers['x-company'];
    if (!activeCompany && Array.isArray(req.user?.allowedCompanies) && req.user.allowedCompanies.length > 0) {
      activeCompany = req.user.allowedCompanies[0];
    }
    if (!checkCompanyTenantAccess(req, activeCompany)) {
      return res.status(403).json({
        success: false,
        code: 'COMPANY_FORBIDDEN',
        error: `Access denied: You do not have permission to access billing stats for '${activeCompany || 'unspecified company'}'.`
      });
    }
    const effectiveCompany = activeCompany || (req.user?.allowedCompanies?.[0]);
    const filter = buildCompanyFilter(effectiveCompany);
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
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
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
    if (!checkBillingPermission(req)) {
      return res.status(403).json({
        success: false,
        code: 'PERMISSION_DENIED',
        error: 'Access denied: You do not have permission to access Billing & Invoicing records.'
      });
    }

    const { search, paymentStatus, page = 1, limit = 5000, dateStart, dateEnd, companyEntity } = req.query;

    if (search !== undefined && search !== null && typeof search !== 'string') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_SEARCH',
        error: 'Search query must be a string'
      });
    }

    let activeCompany = companyEntity;
    const isRestricted = Array.isArray(req.user?.allowedCompanies) && req.user.allowedCompanies.length > 0 &&
      !(req.user.isMainAdmin && req.user.allowedCompanies.length >= 5);

    if (isRestricted) {
      if (!activeCompany) {
        activeCompany = req.user.allowedCompanies[0];
      } else if (!checkCompanyTenantAccess(req, activeCompany)) {
        return res.status(403).json({
          success: false,
          code: 'COMPANY_FORBIDDEN',
          error: `Access denied: You do not have permission to view records for '${activeCompany}'.`
        });
      }
    } else {
      activeCompany = activeCompany || req.headers['x-company-id'] || req.headers['x-company'] || req.headers['company'];
    }

    if (!checkCompanyTenantAccess(req, activeCompany)) {
      return res.status(403).json({
        success: false,
        code: 'COMPANY_FORBIDDEN',
        error: `Access denied: You do not have permission to view records for '${activeCompany || 'unspecified company'}'.`
      });
    }

    const filter = buildCompanyFilter(activeCompany);

    if (paymentStatus && paymentStatus !== 'ALL') {
      filter.paymentStatus = paymentStatus;
    }

    if (search && String(search).trim()) {
      const safeSearch = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchOr = [
        { invoiceNo: { $regex: safeSearch, $options: 'i' } },
        { 'customer.name': { $regex: safeSearch, $options: 'i' } },
        { 'customer.businessName': { $regex: safeSearch, $options: 'i' } },
        { 'customer.phone': { $regex: safeSearch, $options: 'i' } }
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
    }

    if (dateStart || dateEnd) {
      const dsStr = dateStart ? String(dateStart).split('T')[0] : '';
      const deStr = dateEnd ? String(dateEnd).split('T')[0] : '';
      const minMs = dsStr ? Math.min(new Date(`${dsStr}T00:00:00.000Z`).getTime(), new Date(`${dsStr}T00:00:00.000`).getTime()) : null;
      const maxMs = deStr ? Math.max(new Date(`${deStr}T23:59:59.999Z`).getTime(), new Date(`${deStr}T23:59:59.999`).getTime()) : null;

      const dateQuery = {};
      if (minMs) dateQuery.$gte = new Date(minMs);
      if (maxMs) dateQuery.$lte = new Date(maxMs);

      const dateOr = [
        { invoiceDate: dateQuery },
        { invoiceDate: { $gte: dsStr, $lte: deStr } },
        { created_at: dateQuery },
        { createdAt: dateQuery }
      ];

      if (filter.$and) {
        filter.$and.push({ $or: dateOr });
      } else if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: dateOr }];
        delete filter.$or;
      } else {
        filter.$or = dateOr;
      }
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
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── 3. GET SINGLE INVOICE BY ID ─────────────────────────────────────────────
const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const invoice = await BillingInvoice.findById(id).lean();
    if (!invoice || !checkCompanyTenantAccess(req, invoice.companyEntity)) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    await enrichInvoiceItemsWithImages(invoice);

    res.json({ success: true, data: invoice });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    logger.error('Error fetching invoice by id: %s', error.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ── 4. GET NEXT INVOICE NUMBER ──────────────────────────────────────────────
const getNextInvoiceNo = async (req, res) => {
  try {
    const rawEntity = req.query.companyEntity || req.query.company || req.headers['x-company-id'] || req.headers['x-company-entity'] || 'Elite Digital Print';
    const companyEntity = resolveCompanyEntity(rawEntity);
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
    } else if (companyEntity === 'EXEDP' || companyEntity === 'exedp') {
      defaultPrefix = 'EXEDP-2627-';
      defaultStartSeq = 1;
    }

    const filter = buildCompanyFilter(companyEntity);
    const config = await PrintConfig.findOne(filter).lean() || {};
    const isLegacyEdpConfigOnEo = companyEntity === 'Elite Online' && /^EDP/i.test(config.invoicePrefix || '');
    const START_SEQ = (!isLegacyEdpConfigOnEo && config.startingInvoiceNo != null) ? Number(config.startingInvoiceNo) : defaultStartSeq;
    const prefix = (!isLegacyEdpConfigOnEo && config.invoicePrefix !== undefined) ? config.invoicePrefix : defaultPrefix;
    const suffix = config.invoiceSuffix || '';

    const lastInvoice = await BillingInvoice.findOne(filter, 'invoiceSeq').sort({ invoiceSeq: -1 });
    const nextSeq = lastInvoice && lastInvoice.invoiceSeq ? Math.max(lastInvoice.invoiceSeq + 1, START_SEQ) : START_SEQ;
    
    let formattedSeq = nextSeq;
    if (prefix && prefix.endsWith('-')) {
      formattedSeq = String(nextSeq).padStart(4, '0');
    }
    const cleanPrefix = prefix || '';
    const cleanSuffix = suffix || '';
    const invoiceNo = `${cleanPrefix}${formattedSeq}${cleanSuffix}`;

    res.json({ success: true, nextSeq, prefix: cleanPrefix, suffix: cleanSuffix, invoiceNo });
  } catch (error) {
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
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
    const rawEntity = invoiceData.companyEntity || 'Elite Digital Print';
    const entity = resolveCompanyEntity(rawEntity);
    invoiceData.companyEntity = entity;

    // Strict multi-tenant authorization
    if (!checkCompanyTenantAccess(req, entity)) {
      return res.status(403).json({
        success: false,
        code: 'COMPANY_FORBIDDEN',
        error: `Access denied: You do not have permission to create invoices for '${entity}'.`
      });
    }

    // Due Date Validation (BUG-069)
    if (invoiceData.dueDate && invoiceData.invoiceDate) {
      const iDate = new Date(invoiceData.invoiceDate);
      const dDate = new Date(invoiceData.dueDate);
      if (!isNaN(iDate.getTime()) && !isNaN(dDate.getTime())) {
        iDate.setHours(0, 0, 0, 0);
        dDate.setHours(0, 0, 0, 0);
        if (dDate < iDate) {
          return res.status(400).json({
            success: false,
            error: `Due Date (${invoiceData.dueDate}) cannot precede Invoice Date (${invoiceData.invoiceDate}).`
          });
        }
      }
    }

    const filter = buildCompanyFilter(entity);

    // Strict Guard: Prevent duplicate billing of delivery challans
    try {
      await assertChallansNotAlreadyBilled(invoiceData);
    } catch (guardErr) {
      return res.status(409).json({ success: false, error: guardErr.message });
    }

    // Prefix & Sequence Determination
    let defaultPrefix = 'EDP/26-27/';
    let defaultStartSeq = 223;
    if (entity === 'EXEDP' || entity === 'exedp') {
      defaultPrefix = 'EXEDP-2627-';
      defaultStartSeq = 1;
    } else if (entity === 'Elite Edition') {
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
    const isLegacyEdpConfigOnEo = entity === 'Elite Online' && /^EDP/i.test(config.invoicePrefix || '');
    const prefix = (!isLegacyEdpConfigOnEo && config.invoicePrefix !== undefined) ? config.invoicePrefix : defaultPrefix;
    const suffix = config.invoiceSuffix || '';
    const startSeq = (!isLegacyEdpConfigOnEo && config.startingInvoiceNo != null) ? Number(config.startingInvoiceNo) : defaultStartSeq;

    const explicitInvoiceNo = invoiceData.invoiceNo ? String(invoiceData.invoiceNo).trim() : '';

    if (explicitInvoiceNo) {
      // BUG-056: When the user explicitly supplies an invoiceNo, reject duplicate collisions with HTTP 409
      const existingInv = await BillingInvoice.findOne({ invoiceNo: explicitInvoiceNo, ...filter }).lean();
      if (existingInv) {
        return res.status(409).json({
          success: false,
          error: `Invoice number "${explicitInvoiceNo}" already exists for ${entity}. Duplicate invoice numbers are not allowed.`
        });
      }
      invoiceData.invoiceNo = explicitInvoiceNo;
    } else {
      // Auto-assign sequential invoice number
      const lastInvoice = await BillingInvoice.findOne(filter, 'invoiceSeq').sort({ invoiceSeq: -1 });
      const nextSeq = lastInvoice && lastInvoice.invoiceSeq ? Math.max(lastInvoice.invoiceSeq + 1, startSeq) : startSeq;
      invoiceData.invoiceSeq = nextSeq;
      invoiceData.invoicePrefix = prefix || '';
      invoiceData.invoiceSuffix = suffix || '';
      let formattedSeq = nextSeq;
      if (prefix && prefix.endsWith('-')) {
        formattedSeq = String(nextSeq).padStart(4, '0');
      }
      invoiceData.invoiceNo = `${prefix || ''}${formattedSeq}${suffix || ''}`;
    }

    // Strict Numerical Upper Bound & Tax Consistency Recomputation (BUG-057 & BUG-060)
    const items = Array.isArray(invoiceData.items) ? invoiceData.items : [];
    if (items.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one invoice line item is required.' });
    }

    let computedTaxable = 0;
    let computedCgst = 0;
    let computedSgst = 0;
    let computedIgst = 0;

    for (const it of items) {
      const qty = parseFloat(it.qty) || 0;
      const rate = parseFloat(it.unitPrice != null ? it.unitPrice : it.rate) || 0;
      const disc = parseFloat(it.discountPct) || 0;

      // Commercial Bounds Guard: max qty 1,000,000; max unit price 10,000,000 (BUG-060)
      if (qty <= 0 || qty > 1000000) {
        return res.status(400).json({ success: false, error: `Invalid item quantity (${qty}). Must be between 0.001 and 1,000,000.` });
      }
      if (rate < 0 || rate > 10000000) {
        return res.status(400).json({ success: false, error: `Invalid item unit price (${rate}). Must be between 0 and 10,000,000.` });
      }
      if (disc < 0 || disc > 100) {
        return res.status(400).json({ success: false, error: `Invalid discount percentage (${disc}%). Must be between 0 and 100%.` });
      }

      const lineGross = Math.round((qty * rate) * 100) / 100;
      const lineDisc = Math.round(((lineGross * disc) / 100) * 100) / 100;
      const lineTaxable = Math.round((lineGross - lineDisc) * 100) / 100;
      const gstRate = parseFloat(it.taxRate != null ? it.taxRate : it.gstRate) || 0;
      const lineTax = Math.round(((lineTaxable * gstRate) / 100) * 100) / 100;

      it.qty = qty;
      it.unitPrice = rate;
      it.discountPct = disc;
      it.discountAmount = lineDisc;
      it.taxableAmount = lineTaxable;
      it.taxRate = gstRate;
      it.gstRate = gstRate;
      it.taxAmount = lineTax; // BUG-057 fix: ensure line item taxAmount is never 0 when taxable
      it.totalAmount = Math.round((lineTaxable + lineTax) * 100) / 100;

      computedTaxable += lineTaxable;
      const isIgst = invoiceData.taxType === 'IGST' || invoiceData.isInterState;
      if (isIgst) {
        computedIgst += lineTax;
      } else {
        const half = Math.round(((lineTaxable * (gstRate / 2)) / 100) * 100) / 100;
        computedCgst += half;
        computedSgst += half;
      }
    }

    computedTaxable = Math.round(computedTaxable * 100) / 100;
    computedCgst = Math.round(computedCgst * 100) / 100;
    computedSgst = Math.round(computedSgst * 100) / 100;
    computedIgst = Math.round(computedIgst * 100) / 100;
    const computedTotalTax = (invoiceData.taxType === 'IGST' || invoiceData.isInterState)
      ? computedIgst
      : Math.round((computedCgst + computedSgst) * 100) / 100;

    invoiceData.taxableAmount = computedTaxable;
    invoiceData.taxableValue = computedTaxable;
    invoiceData.subtotal = computedTaxable;
    invoiceData.cgstAmount = computedCgst;
    invoiceData.sgstAmount = computedSgst;
    invoiceData.igstAmount = computedIgst;
    invoiceData.totalTax = computedTotalTax; // BUG-057: guarantee totalTax === cgst + sgst

    const rawTotal = computedTaxable + computedTotalTax;
    const grandRounded = Math.round(rawTotal);
    const roundOff = Math.round((grandRounded - rawTotal) * 100) / 100;
    invoiceData.roundOff = roundOff;
    invoiceData.grandTotal = grandRounded;

    // Ensure customer object is present and customerId is valid ObjectId or omitted (avoids CastError for walk-in clients)
    if (invoiceData.customer) {
      if (!invoiceData.customer.name || !String(invoiceData.customer.name).trim()) {
        invoiceData.customer.name = invoiceData.partyName || invoiceData.customerName || 'Walk-in Client';
      }
      if (
        !invoiceData.customer.customerId ||
        !mongoose.Types.ObjectId.isValid(invoiceData.customer.customerId) ||
        String(invoiceData.customer.customerId).toLowerCase().includes('walk')
      ) {
        delete invoiceData.customer.customerId;
      }
    } else {
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
    const tdsAmount = invoiceData.enableTds ? parseFloat((parseFloat(invoiceData.tdsAmount) || 0).toFixed(2)) : 0;
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

    // BUG-068: Invoices > Clone must not copy signed-copy approval state
    delete invoiceData.signedCopy;
    delete invoiceData.signedCopyUrl;
    invoiceData.signedCopy = null;
    if (!invoiceData.approvalStatus || invoiceData.approvalStatus === 'APPROVED' || invoiceData.approvalStatus === 'SIGNED') {
      invoiceData.approvalStatus = 'DRAFT';
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
    if (error.name === 'CastError' || (error.message && error.message.includes('Cast to ObjectId failed'))) {
      return res.status(400).json({ success: false, error: 'Invalid identifier format in customer or line items.' });
    }
    if (error.code === 11000) {
      return res.status(409).json({ success: false, code: 'DUPLICATE_INVOICE_NO', error: `Invoice number already exists. Duplicate invoice numbers are not allowed.` });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, error: error.message });
    }
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

    // Strict multi-tenant authorization
    if (invoiceData.companyEntity && !checkCompanyTenantAccess(req, invoiceData.companyEntity)) {
      return res.status(403).json({
        success: false,
        code: 'COMPANY_FORBIDDEN',
        error: `Access denied: You do not have permission to edit invoices for '${invoiceData.companyEntity}'.`
      });
    }

    // Due Date Validation (BUG-069)
    if (invoiceData.dueDate && invoiceData.invoiceDate) {
      const iDate = new Date(invoiceData.invoiceDate);
      const dDate = new Date(invoiceData.dueDate);
      if (!isNaN(iDate.getTime()) && !isNaN(dDate.getTime())) {
        iDate.setHours(0, 0, 0, 0);
        dDate.setHours(0, 0, 0, 0);
        if (dDate < iDate) {
          return res.status(400).json({
            success: false,
            error: `Due Date (${invoiceData.dueDate}) cannot precede Invoice Date (${invoiceData.invoiceDate}).`
          });
        }
      }
    }

    const editorName = req.headers['x-user-name'] || req.user?.name || invoiceData.updatedBy || 'Staff User';
    invoiceData.updatedBy = editorName;
    invoiceData.updatedByName = editorName;

    // Ensure customerId is valid or omitted for walk-in clients
    if (invoiceData.customer) {
      if (
        !invoiceData.customer.customerId ||
        !mongoose.Types.ObjectId.isValid(invoiceData.customer.customerId) ||
        String(invoiceData.customer.customerId).toLowerCase().includes('walk')
      ) {
        delete invoiceData.customer.customerId;
      }
    }

    if (Array.isArray(invoiceData.items)) {
      const validChallanIds = invoiceData.items.map(i => i.challanId).filter(Boolean);
      const validChallanNos = invoiceData.items.map(i => i.ourChallanNo).filter(Boolean);
      invoiceData.linkedChallanIds = validChallanIds;
      invoiceData.linkedChallanNos = validChallanNos;
      invoiceData.ourChallanNo = validChallanNos.join(', ');
    }

    const grandTotal = parseFloat(invoiceData.grandTotal) || 0;
    const paidAmount = parseFloat(invoiceData.paidAmount) || 0;
    const tdsAmount = invoiceData.enableTds ? parseFloat((parseFloat(invoiceData.tdsAmount) || 0).toFixed(2)) : 0;
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
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
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
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
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

    const effectiveTds = invoice.enableTds ? parseFloat((parseFloat(invoice.tdsAmount) || 0).toFixed(2)) : 0;
    const currentBalanceDue = invoice.balanceDue != null
      ? invoice.balanceDue
      : Math.max(0, parseFloat((invoice.grandTotal - effectiveTds - (invoice.paidAmount || 0)).toFixed(2)));

    // Prevent overpayment beyond balance due (BUG-063)
    if (paymentAmt > currentBalanceDue + 0.01) {
      return res.status(400).json({
        success: false,
        error: `Payment amount (₹${paymentAmt.toFixed(2)}) exceeds outstanding balance due (₹${currentBalanceDue.toFixed(2)}). Overpayment is not permitted.`
      });
    }

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
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
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

    const includeDuplicate = req.query?.duplicate !== 'false';

    const noCache = req.query?.nocache === 'true' || req.query?.refresh === 'true';

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
    const companyEntity = resolveCompanyEntity(invoice.companyEntity || 'Elite Digital Print');
    let config = await PrintConfig.findOne({ companyEntity }).lean();
    if (!config) {
      config = await PrintConfig.findOne({ companyEntity: { $regex: new RegExp(`^${companyEntity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }).lean();
    }
    const isDirectConfigFound = Boolean(config);
    if (!config) {
      config = await PrintConfig.findOne({ isConfig: true }).lean() || {};
    }
    // Strict assignment of issuing company entity
    config.companyEntity = companyEntity;
    if (!isDirectConfigFound && companyEntity !== 'Elite Digital Print') {
      config.isFallbackConfig = true;
      config.companyName = companyEntity === 'Elite Online' ? 'ELITE ONLINE' : companyEntity.toUpperCase();
      if (companyEntity === 'Elite Online') {
        config.companyAddress = 'PLOT NO. 12, SURAT, GUJARAT - 395010';
        config.companyPhone = '+91 76006 65058';
        config.companyEmail = 'info.eliteonline@gmail.com';
        config.companyGstin = '';
      }
    } else if (!config.companyName) {
      config.companyName = companyEntity.toUpperCase();
    }

    const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: true, bufferPages: true, autoPageBreak: false });
    doc.options.autoPageBreak = false;

    const { renderTallyInvoice } = require('../services/tallyInvoicePdfService');

    // Page 1: Original in Issuing Company Brand Color
    renderTallyInvoice(doc, invoice, config, { isColor: true, isDuplicate: false, copyLabel: '(ORIGINAL FOR RECIPIENT)' });

    // Page 2: Duplicate in Crisp Black & White (if requested / included)
    if (includeDuplicate) {
      doc.addPage({ margin: 0, size: 'A4' });
      renderTallyInvoice(doc, invoice, config, { isColor: false, isDuplicate: true, copyLabel: '(DUPLICATE FOR TRANSPORTER)' });
    }

    const buffers = [];
    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfData.length);
      res.setHeader('Content-Disposition', `attachment; filename="Invoice_${invoice.invoiceNo || 'Draft'}.pdf"`);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.send(pdfData);
      console.log(`[PDF Performance] Invoice ${invoice.invoiceNo} PDF generated & delivered in ${Date.now() - startTime}ms (${(invoice.items || []).length} items, ${pdfData.length} bytes)`);
    });
    doc.on('error', docErr => {
      console.error('PDFKit Document Error:', docErr);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error generating PDF invoice', message: docErr.message });
      }
    });

    doc.end();

  } catch (error) {
    console.error('Download Invoice PDF Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error generating PDF invoice', message: error?.message || 'Error generating PDF invoice' });
    }
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

    const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: true, bufferPages: true, autoPageBreak: false });
    doc.options.autoPageBreak = false;

    const { renderTallyInvoice } = require('../services/tallyInvoicePdfService');
    for (let invIdx = 0; invIdx < invoices.length; invIdx++) {
      const invoice = invoices[invIdx];
      const companyEntity = resolveCompanyEntity(invoice.companyEntity || 'Elite Digital Print');
      let companyConfig = await PrintConfig.findOne({ companyEntity }).lean();
      if (!companyConfig) {
        companyConfig = await PrintConfig.findOne({ companyEntity: { $regex: new RegExp(`^${companyEntity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }).lean();
      }
      if (!companyConfig) {
        companyConfig = await PrintConfig.findOne({ isConfig: true }).lean() || {};
      }
      companyConfig.companyEntity = companyEntity;
      if (!companyConfig.companyName || companyConfig.companyEntity !== companyEntity) {
        companyConfig.companyName = companyEntity.toUpperCase();
      }

      if (invIdx > 0) {
        doc.addPage({ margin: 0, size: 'A4' });
      }
      renderTallyInvoice(doc, invoice, companyConfig, { isColor: true, isDuplicate: false, copyLabel: '(ORIGINAL FOR RECIPIENT)' });
    }

    const buffers = [];
    doc.on('data', chunk => buffers.push(chunk));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfData.length);
      res.setHeader('Content-Disposition', `attachment; filename="Combined_Tax_Invoices_${invoices.length}_Items.pdf"`);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.send(pdfData);
      console.log(`[Bulk PDF Performance] ${invoices.length} Invoices generated into single combined PDF in ${Date.now() - startTime}ms (${pdfData.length} bytes)`);
    });
    doc.on('error', docErr => {
      console.error('PDFKit Document Error in Bulk PDF:', docErr);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error generating bulk combined PDF invoice', message: docErr.message });
      }
    });

    doc.end();

  } catch (error) {
    console.error('Download Bulk Invoice PDF Error:', error);
    if (!res.headersSent) {
      res.status(500).send('Error generating bulk combined PDF invoice');
    }
  }
};


// ── 10. CUSTOMER CRUD ────────────────────────────────────────────────────────
const getCustomers = async (req, res) => {
  try {
    let { companyEntity } = req.query;
    let activeCompany = companyEntity || req.headers['x-company-id'] || req.headers['x-company'];
    if (!activeCompany && Array.isArray(req.user?.allowedCompanies) && req.user.allowedCompanies.length > 0) {
      activeCompany = req.user.allowedCompanies[0];
    }
    if (!activeCompany) {
      activeCompany = req.user?.company_id || req.user?.companyId || 'Elite Digital Prints';
    }

    if (!checkDirectoryReadPermission(req, activeCompany)) {
      return res.status(403).json({
        success: false,
        code: 'PERMISSION_DENIED',
        error: 'Access denied: You do not have permission to access Customer records.'
      });
    }

    const filter = buildCompanyFilter(activeCompany);
    const customers = await BillingCustomer.find(filter).sort({ name: 1 }).lean();
    res.json({ success: true, data: customers });
  } catch (error) {
    logger.error('Error fetching billing customers: %s', error.stack || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

const createCustomer = async (req, res) => {
  try {
    const { name, phone, gstin } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, error: 'Customer Name is required.' });
    }
    if (phone && String(phone).trim()) {
      const cleanPhone = String(phone).trim().replace(/[\s\-+]/g, '');
      if (!/^\d{10,12}$/.test(cleanPhone)) {
        return res.status(400).json({ success: false, error: 'Invalid phone number format. Must contain 10 to 12 digits.' });
      }
    }
    if (gstin && String(gstin).trim()) {
      const cleanGstin = String(gstin).trim().toUpperCase();
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleanGstin)) {
        return res.status(400).json({ success: false, error: 'Invalid GSTIN format. Must be 15 alphanumeric characters (e.g. 24AAAAA0000A1Z5).' });
      }
      req.body.gstin = cleanGstin;
    }
    const customer = await BillingCustomer.create(req.body);
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const { name, phone, gstin } = req.body;
    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ success: false, error: 'Customer Name cannot be empty.' });
    }
    if (phone && String(phone).trim()) {
      const cleanPhone = String(phone).trim().replace(/[\s\-+]/g, '');
      if (!/^\d{10,12}$/.test(cleanPhone)) {
        return res.status(400).json({ success: false, error: 'Invalid phone number format. Must contain 10 to 12 digits.' });
      }
    }
    if (gstin && String(gstin).trim()) {
      const cleanGstin = String(gstin).trim().toUpperCase();
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleanGstin)) {
        return res.status(400).json({ success: false, error: 'Invalid GSTIN format. Must be 15 alphanumeric characters (e.g. 24AAAAA0000A1Z5).' });
      }
      req.body.gstin = cleanGstin;
    }
    const customer = await BillingCustomer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: customer });
  } catch (error) {
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    await BillingCustomer.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── 10B. VENDOR CRUD (Billing Vendors Collection) ──────────────────────────
const getVendors = async (req, res) => {
  try {
    let { companyEntity } = req.query;
    let activeCompany = companyEntity || req.headers['x-company-id'] || req.headers['x-company'];
    if (!activeCompany && Array.isArray(req.user?.allowedCompanies) && req.user.allowedCompanies.length > 0) {
      activeCompany = req.user.allowedCompanies[0];
    }
    if (!activeCompany) {
      activeCompany = req.user?.company_id || req.user?.companyId || 'Elite Digital Prints';
    }

    if (!checkDirectoryReadPermission(req, activeCompany)) {
      return res.status(403).json({
        success: false,
        code: 'PERMISSION_DENIED',
        error: 'Access denied: You do not have permission to access Vendor records.'
      });
    }

    const filter = buildPurchaseCompanyFilter(activeCompany);
    const vendors = await BillingVendor.find(filter).sort({ name: 1 }).lean();
    res.json({ success: true, data: vendors || [] });
  } catch (error) {
    logger.error('Error fetching billing vendors: %s', error.stack || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

const validateVendorPayload = (body) => {
  const name = (body.name || body.businessName || '').trim();
  if (!name) {
    return 'Vendor name or business name is required.';
  }
  if (name.length > 200) {
    return 'Vendor name cannot exceed 200 characters.';
  }
  if (body.phone && String(body.phone).trim()) {
    const cleanPhone = String(body.phone).trim().replace(/[\s-]/g, '');
    if (!/^\+?[0-9]{7,15}$/.test(cleanPhone)) {
      return 'Invalid phone number format. Must contain 7 to 15 digits.';
    }
    body.phone = cleanPhone;
  }
  if (body.email && String(body.email).trim()) {
    const cleanEmail = String(body.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return 'Invalid email address format.';
    }
    body.email = cleanEmail;
  }
  if (body.gstin && String(body.gstin).trim()) {
    const cleanGstin = String(body.gstin).trim().toUpperCase();
    if (cleanGstin !== 'N/A' && cleanGstin !== 'UNREGISTERED') {
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleanGstin)) {
        return 'Invalid GSTIN format. Must be 15 alphanumeric characters (e.g. 24AAAAA0000A1Z5).';
      }
    }
    body.gstin = cleanGstin;
  }
  return null;
};

const createVendor = async (req, res) => {
  try {
    const vErr = validateVendorPayload(req.body);
    if (vErr) {
      return res.status(400).json({ success: false, error: vErr });
    }
    const vendor = await BillingVendor.create(req.body);
    res.status(201).json({ success: true, data: vendor });
  } catch (error) {
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateVendor = async (req, res) => {
  try {
    const vErr = validateVendorPayload(req.body);
    if (vErr) {
      return res.status(400).json({ success: false, error: vErr });
    }
    const vendor = await BillingVendor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!vendor) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }
    res.json({ success: true, data: vendor });
  } catch (error) {
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
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
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── 11. ITEM CRUD ────────────────────────────────────────────────────────────
const getItems = async (req, res) => {
  try {
    let { companyEntity } = req.query;
    let activeCompany = companyEntity || req.headers['x-company-id'] || req.headers['x-company'];
    if (!activeCompany && Array.isArray(req.user?.allowedCompanies) && req.user.allowedCompanies.length > 0) {
      activeCompany = req.user.allowedCompanies[0];
    }
    if (!activeCompany) {
      activeCompany = req.user?.company_id || req.user?.companyId || 'Elite Digital Prints';
    }

    if (!checkDirectoryReadPermission(req, activeCompany)) {
      return res.status(403).json({
        success: false,
        code: 'PERMISSION_DENIED',
        error: 'Access denied: You do not have permission to access Item catalog records.'
      });
    }

    const filter = buildCompanyFilter(activeCompany);
    const items = await BillingItem.find(filter).sort({ itemName: 1 }).lean();
    res.json({ success: true, data: items });
  } catch (error) {
    logger.error('Error fetching billing items: %s', error.stack || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

const validateItemPayload = (body) => {
  const itemName = (body.itemName || body.name || '').trim();
  if (!itemName) {
    return 'Item name is required.';
  }
  if (itemName.length > 200) {
    return 'Item name cannot exceed 200 characters.';
  }
  body.itemName = itemName;

  const priceVal = body.unitPrice != null ? body.unitPrice : body.price;
  if (priceVal !== undefined && priceVal !== null && priceVal !== '') {
    const numPrice = Number(priceVal);
    if (isNaN(numPrice) || numPrice < 0) {
      return 'Item unit price cannot be negative or invalid.';
    }
    if (numPrice > 10000000) {
      return 'Item unit price exceeds commercial limit (₹10,000,000).';
    }
    body.unitPrice = numPrice;
  }

  if (body.hsnCode && String(body.hsnCode).trim()) {
    const cleanHsn = String(body.hsnCode).trim();
    if (!/^\d{4,8}$/.test(cleanHsn)) {
      return 'Invalid HSN/SAC code. Must consist of 4 to 8 numeric digits.';
    }
    body.hsnCode = cleanHsn;
  }

  if (body.taxRate !== undefined && body.taxRate !== null && body.taxRate !== '') {
    const numTax = Number(body.taxRate);
    if (isNaN(numTax) || numTax < 0 || numTax > 100) {
      return 'Tax rate must be between 0% and 100%.';
    }
  }

  return null;
};

const createItem = async (req, res) => {
  try {
    const iErr = validateItemPayload(req.body);
    if (iErr) {
      return res.status(400).json({ success: false, error: iErr });
    }
    const item = await BillingItem.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateItem = async (req, res) => {
  try {
    const iErr = validateItemPayload(req.body);
    if (iErr) {
      return res.status(400).json({ success: false, error: iErr });
    }
    const item = await BillingItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    await BillingItem.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Billing item deleted successfully' });
  } catch (error) {
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
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
        invoiceSuffix: '',
        startingInvoiceNo: startNo,
        companyGstin: isEE ? '24BSWPA7682P1ZS' : '',
        companyAddress: isEE ? '1095, SIDDHESWAR SOC, KALAPOOL, PUNAGAM, Surat, Gujarat - 395010' : '',
        companyPhone: isEE ? '+91 76006 65058' : '',
        companyEmail: isEE ? 'INFO.ELITEEDITION@GMAIL.COM' : '',
        companyLogo: '',
        companyState: 'Gujarat',
        companyStateCode: '24',
        companyCity: isEE ? 'Surat' : '',
        companyPincode: isEE ? '395010' : '',
        companyCountry: 'India',
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

    // Dynamic Multi-Bank Support: Ensure companyBanks is array and contains primary bank if present
    if (!Array.isArray(config.companyBanks) || config.companyBanks.length === 0) {
      if (config.companyBankName) {
        config.companyBanks = [{
          bankName: config.companyBankName,
          accountNo: config.companyAccountNo || '',
          ifscCode: config.companyIfscCode || '',
          branch: '',
          accountType: 'Current',
          isDefault: true
        }];
      } else {
        config.companyBanks = [];
      }
    }

    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateCompanySettings = async (req, res) => {
  try {
    const { companyEntity = 'Elite Online', ...otherFields } = req.body;

    // Sync primary/default bank with legacy single fields for full backward compatibility
    if (Array.isArray(otherFields.companyBanks) && otherFields.companyBanks.length > 0) {
      const defaultBank = otherFields.companyBanks.find(b => b.isDefault) || otherFields.companyBanks[0];
      if (defaultBank) {
        otherFields.companyBankName = defaultBank.bankName || otherFields.companyBankName || '';
        otherFields.companyAccountNo = defaultBank.accountNo || otherFields.companyAccountNo || '';
        otherFields.companyIfscCode = defaultBank.ifscCode || otherFields.companyIfscCode || '';
      }
    }

    const PrintConfig = require('../db/models/printConfig.model');
    const updated = await PrintConfig.findOneAndUpdate(
      { companyEntity },
      { $set: { ...otherFields, companyEntity } },
      { new: true, upsert: true, returnDocument: 'after' }
    );
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── 13. PURCHASES CRUD ────────────────────────────────────────────────────────
const getPurchases = async (req, res) => {
  try {
    if (!checkBillingPermission(req)) {
      return res.status(403).json({
        success: false,
        code: 'PERMISSION_DENIED',
        error: 'Access denied: You do not have permission to access Purchase records.'
      });
    }
    let { companyEntity, search } = req.query;
    let activeCompany = companyEntity || req.headers['x-company-id'] || req.headers['x-company'];
    if (!activeCompany && Array.isArray(req.user?.allowedCompanies) && req.user.allowedCompanies.length > 0) {
      activeCompany = req.user.allowedCompanies[0];
    }
    if (!activeCompany) {
      activeCompany = req.user?.company_id || req.user?.companyId || 'Elite Digital Prints';
    }
    if (!checkCompanyTenantAccess(req, activeCompany)) {
      return res.status(403).json({
        success: false,
        code: 'COMPANY_FORBIDDEN',
        error: `Access denied: You do not have permission to access purchases for '${activeCompany || 'unspecified company'}'.`
      });
    }
    let query = {};
    if (activeCompany && activeCompany !== 'ALL') {
      query = buildPurchaseCompanyFilter(activeCompany);
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
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getPurchasePrefix = (entity = 'Elite Digital Prints') => {
  const norm = String(entity || '').trim().toLowerCase();
  if (norm.includes('exedp') || norm === 'ex-edp' || norm === 'ex_edp') return 'EXEDP-';
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
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
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
    if (purchaseData.vendor) {
      if (!purchaseData.vendor.vendorId || !mongoose.Types.ObjectId.isValid(purchaseData.vendor.vendorId)) {
        delete purchaseData.vendor.vendorId;
      }
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

    // Due Date Validation & Advance Payment Cap (BUG-064 & BUG-069)
    if (purchaseData.dueDate && purchaseData.date) {
      const pDateVal = new Date(purchaseData.date);
      const dDateVal = new Date(purchaseData.dueDate);
      if (!isNaN(pDateVal.getTime()) && !isNaN(dDateVal.getTime())) {
        pDateVal.setHours(0, 0, 0, 0);
        dDateVal.setHours(0, 0, 0, 0);
        if (dDateVal < pDateVal) {
          return res.status(400).json({
            success: false,
            error: `Due Date cannot precede Purchase Date.`
          });
        }
      }
    }
    const paidAmt = parseFloat(purchaseData.paidAmount || purchaseData.advanceAmount || purchaseData.advance || purchaseData.paid || 0);
    if (paidAmt < 0) {
      return res.status(400).json({
        success: false,
        error: `Paid / advance amount cannot be negative.`
      });
    }
    if (paidAmt > gTotal + 0.01) {
      return res.status(400).json({
        success: false,
        error: `Paid / advance amount (₹${paidAmt.toFixed(2)}) cannot exceed purchase total (₹${gTotal.toFixed(2)}). Excess advance is not permitted.`
      });
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
            pincode: purchaseData.vendor.pincode || '',
            city: purchaseData.vendor.city || '',
            state: purchaseData.vendor.state || 'Gujarat',
            stateCode: purchaseData.vendor.stateCode || '24',
            country: purchaseData.vendor.country || 'India',
            vendorType: 'General Supplier',
            companyEntity
          }
        },
        { upsert: true, new: true }
      ).catch(() => {});
    }

    // BUG-074: Only upsert into BillingItem catalog if user explicitly opted in (saveItemsToCatalog)
    // Prevents silent side effects and cluttering of the items catalog
    if (purchaseData.saveItemsToCatalog === true && Array.isArray(purchaseData.items) && purchaseData.items.length > 0) {
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
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
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
    if (purchaseData.vendor) {
      if (!purchaseData.vendor.vendorId || !mongoose.Types.ObjectId.isValid(purchaseData.vendor.vendorId)) {
        delete purchaseData.vendor.vendorId;
      }
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

    // Due Date Validation & Advance Payment Cap (BUG-064 & BUG-069)
    if (purchaseData.dueDate && purchaseData.date) {
      const pDateVal = new Date(purchaseData.date);
      const dDateVal = new Date(purchaseData.dueDate);
      if (!isNaN(pDateVal.getTime()) && !isNaN(dDateVal.getTime())) {
        pDateVal.setHours(0, 0, 0, 0);
        dDateVal.setHours(0, 0, 0, 0);
        if (dDateVal < pDateVal) {
          return res.status(400).json({
            success: false,
            error: `Due Date cannot precede Purchase Date.`
          });
        }
      }
    }
    const paidAmt = parseFloat(purchaseData.paidAmount || purchaseData.advanceAmount || purchaseData.advance || purchaseData.paid || 0);
    if (paidAmt < 0) {
      return res.status(400).json({
        success: false,
        error: `Paid / advance amount cannot be negative.`
      });
    }
    if (paidAmt > gTotal + 0.01) {
      return res.status(400).json({
        success: false,
        error: `Paid / advance amount (₹${paidAmt.toFixed(2)}) cannot exceed purchase total (₹${gTotal.toFixed(2)}). Excess advance is not permitted.`
      });
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
            pincode: purchaseData.vendor.pincode || '',
            city: purchaseData.vendor.city || '',
            state: purchaseData.vendor.state || 'Gujarat',
            stateCode: purchaseData.vendor.stateCode || '24',
            country: purchaseData.vendor.country || 'India',
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
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
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
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
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
    logger.error('Error creating billing purchase: %s', error.stack || error.message);
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

      const dateOr = [
        { invoiceDate: dateQuery },
        { invoiceDate: { $gte: dsStr, $lte: deStr } },
        { created_at: dateQuery },
        { createdAt: dateQuery }
      ];

      if (filter.$and) {
        filter.$and.push({ $or: dateOr });
      } else if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: dateOr }];
        delete filter.$or;
      } else {
        filter.$or = dateOr;
      }
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

// ── 15. PINCODE & LOCATION LOOKUP (OFFLINE DATASET + CANDIDATE RECOVERY) ─
const postalGeoService = require('../services/postalGeoService');
const pincodeCache = new Map();

const lookupPincode = async (req, res) => {
  try {
    const rawPin = String(req.params.pincode || req.query.pincode || req.query.query || '').trim();
    if (!rawPin) {
      return res.status(400).json({ success: false, error: 'Pincode or location query is required.' });
    }

    if (pincodeCache.has(rawPin)) {
      return res.json({ success: true, data: pincodeCache.get(rawPin) });
    }

    // 1. Instant ultra-fast lookup via offline postalGeoService (154,823 PINs + 5-digit recovery)
    let result = postalGeoService.lookupLocation(rawPin);

    // 2. If not found, try fallback
    if (!result && /^\d{6}$/.test(rawPin)) {
      try {
        const axios = require('axios');
        const response = await axios.get(`https://api.postalpincode.in/pincode/${rawPin}`, { timeout: 3000 });
        if (Array.isArray(response.data) && response.data[0] && response.data[0].Status === 'Success') {
          const poList = response.data[0].PostOffice || [];
          const primary = poList[0] || {};
          const stateName = primary.State || 'Gujarat';
          const districtName = primary.District || primary.Division || primary.Block || '';
          const stateCode = postalGeoService.resolveStateCode(stateName);

          result = {
            pincode: rawPin,
            city: districtName || 'Surat',
            district: districtName,
            state: stateName,
            stateCode,
            country: primary.Country || 'India',
            postOffices: poList.map(p => p.Name).filter(Boolean)
          };
        }
      } catch (e) {}
    }

    if (!result) {
      return res.status(404).json({ success: false, error: `No postal records found for ${rawPin}.` });
    }

    pincodeCache.set(rawPin, result);
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const lookupLocation = async (req, res) => {
  try {
    const q = String(req.query.q || req.query.query || req.params.query || '').trim();
    if (!q) {
      return res.status(400).json({ success: false, error: 'Search query is required.' });
    }
    const result = postalGeoService.lookupLocation(q);
    if (!result) {
      return res.status(404).json({ success: false, error: `No location found for "${q}".` });
    }
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
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
  getGstr1Table12Summary,
  lookupPincode,
  lookupLocation
};
