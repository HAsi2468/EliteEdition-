const ActivityLog = require('../db/models/activityLog.model');
const BillingInvoice = require('../db/models/billingInvoice.model');
const JobCard = require('../db/models/jobCard.model');
const GarmentJobCard = require('../db/models/garmentJobCard.model');
const {
  COMPANIES,
  normalizeCompanyId,
  getCompanyEntityName,
  getCompanyById,
  buildCompanyFilter,
} = require('../config/company.constants');
const { isUserSuperAdmin, isCompanyPermittedForUser } = require('../middlewares/companyScope');

/**
 * Switch active company
 * Verifies permission and logs company switch to the activity log
 */
const switchCompany = async (req, res) => {
  try {
    const { company_id } = req.body;
    const canonicalId = normalizeCompanyId(company_id);

    if (!canonicalId) {
      return res.status(400).json({ success: false, message: 'Invalid company_id provided' });
    }

    const companyName = getCompanyEntityName(canonicalId);
    const hasPermission = isCompanyPermittedForUser(req.user, canonicalId);

    if (!hasPermission) {
      await ActivityLog.create({
        company_id: canonicalId,
        companyName,
        userId: req.user?._id ? String(req.user._id) : '',
        userName: req.user?.name || 'User',
        userRole: req.user?.role || 'user',
        action: 'ACCESS_DENIED',
        details: `Denied company switch to '${companyName}' (${canonicalId})`,
        ip: req.ip || '',
        userAgent: req.headers['user-agent'] || '',
      });

      return res.status(403).json({
        success: false,
        message: `Access denied: You do not have permission to access data for ${companyName}.`,
      });
    }

    // Log the successful company switch
    await ActivityLog.create({
      company_id: canonicalId,
      companyName,
      userId: req.user?._id ? String(req.user._id) : '',
      userName: req.user?.name || 'User',
      userRole: req.user?.role || 'user',
      action: 'COMPANY_SWITCH',
      details: `Switched active company to ${companyName}`,
      ip: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
    });

    return res.json({
      success: true,
      company_id: canonicalId,
      companyName,
      message: `Active company switched to ${companyName}`,
    });
  } catch (err) {
    console.error('[switchCompany] Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get permitted companies for current user
 */
const getPermittedCompanies = async (req, res) => {
  try {
    const superAdmin = isUserSuperAdmin(req.user);

    if (superAdmin) {
      return res.json({
        success: true,
        isSuperAdmin: true,
        companies: COMPANIES,
      });
    }

    // Filter permitted companies
    const permitted = COMPANIES.filter((c) => isCompanyPermittedForUser(req.user, c.id));

    return res.json({
      success: true,
      isSuperAdmin: false,
      companies: permitted,
    });
  } catch (err) {
    console.error('[getPermittedCompanies] Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Super Admin Summary: per-company totals (sales, outstanding, delayed jobs)
 */
const getSuperAdminSummary = async (req, res) => {
  try {
    const superAdmin = isUserSuperAdmin(req.user);
    if (!superAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Super Admin privilege required for cross-company summary.',
      });
    }

    const now = new Date();

    // Parallelize metrics retrieval across companies to eliminate serial N+1 query loop
    const summary = await Promise.all(
      COMPANIES.map(async (comp) => {
        const compFilter = buildCompanyFilter(comp.id);

        const [invoices, jobs] = await Promise.all([
          BillingInvoice.find(compFilter, 'totalAmount dueAmount balanceAmount paymentStatus').lean(),
          comp.id === 'stitching'
            ? GarmentJobCard.find({}, 'status targetDate deliveryDate created_date_time').lean()
            : JobCard.find(compFilter, 'status expTime deliveryStatus created_date_time').lean(),
        ]);

        let totalSales = 0;
        let outstanding = 0;

        for (const inv of invoices) {
          totalSales += Number(inv.totalAmount) || 0;
          const due = inv.dueAmount !== undefined ? Number(inv.dueAmount) : Number(inv.balanceAmount) || 0;
          if (inv.paymentStatus !== 'Paid') {
            outstanding += due > 0 ? due : (Number(inv.totalAmount) || 0);
          }
        }

        let activeJobsCount = 0;
        let delayedJobsCount = 0;

        if (comp.id === 'stitching') {
          for (const gj of jobs) {
            if (gj.status !== 'Done' && gj.status !== 'Completed') {
              activeJobsCount++;
              const due = gj.targetDate || gj.deliveryDate;
              if (due && new Date(due) < now) {
                delayedJobsCount++;
              }
            }
          }
        } else {
          for (const jc of jobs) {
            if (jc.status !== 'Done') {
              activeJobsCount++;
              if (jc.expTime) {
                const expDate = new Date(jc.expTime);
                if (!isNaN(expDate.getTime()) && expDate < now) {
                  delayedJobsCount++;
                }
              }
            }
          }
        }

        return {
          company_id: comp.id,
          code: comp.code,
          name: comp.name,
          type: comp.type,
          sales: Math.round(totalSales * 100) / 100,
          outstanding: Math.round(outstanding * 100) / 100,
          activeJobs: activeJobsCount,
          delayedJobs: delayedJobsCount,
        };
      })
    );

    return res.json({
      success: true,
      summary,
    });
  } catch (err) {
    console.error('[getSuperAdminSummary] Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get Activity Logs for the active company
 */
const getActivityLogs = async (req, res) => {
  try {
    const { company_id } = req;
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
    const logs = await ActivityLog.find({ company_id })
      .sort({ created_date_time: -1 })
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      company_id,
      logs,
    });
  } catch (err) {
    console.error('[getActivityLogs] Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  switchCompany,
  getPermittedCompanies,
  getSuperAdminSummary,
  getActivityLogs,
};
