/**
 * Global Search Controller
 * Fast, indexed search across Job Cards, Invoices, Parties, and Inventory Stock
 * Strictly scoped to the active company.
 */

const httpStatus = require('http-status');
const models = require('../db/models');
const { normalizeCompanyId } = require('../config/company.constants');

const globalSearch = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.status(200).json({
        success: true,
        query: q,
        results: []
      });
    }

    const rawComp = req.headers['x-company-id'] || req.query.companyId || req.user?.company_id || 'digital_print';
    const companyId = normalizeCompanyId(rawComp) || 'digital_print';

    // Safe regex pattern (escaped)
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    // Build company filter queries
    const companyFilter = {
      $or: [
        { company_id: companyId },
        { companyId: companyId },
        { department: companyId },
        { companyEntity: companyId }
      ]
    };

    // Parallel search across 4 core collections
    const [jobCards, invoices, parties, stock] = await Promise.all([
      // 1. Job Cards
      models.JobCard
        ? models.JobCard.find({
            $and: [
              companyFilter,
              {
                $or: [
                  { jobNo: regex },
                  { clientName: regex },
                  { fabricName: regex },
                  { stage: regex },
                  { poNumber: regex }
                ]
              }
            ]
          })
            .select('_id jobNo clientName fabricName stage totalMeters createdAt')
            .limit(6)
            .lean()
            .catch(() => [])
        : [],

      // 2. Billing Invoices
      models.BillingInvoice
        ? models.BillingInvoice.find({
            $and: [
              companyFilter,
              {
                $or: [
                  { invoiceNo: regex },
                  { customerName: regex },
                  { partyName: regex },
                  { invoiceType: regex }
                ]
              }
            ]
          })
            .select('_id invoiceNo customerName partyName grandTotal invoiceDate status')
            .limit(6)
            .lean()
            .catch(() => [])
        : [],

      // 3. Parties / Clients / Vendors
      models.Party
        ? models.Party.find({
            $and: [
              companyFilter,
              {
                $or: [
                  { partyName: regex },
                  { name: regex },
                  { phone: regex },
                  { city: regex },
                  { gstNumber: regex }
                ]
              }
            ]
          })
            .select('_id partyName name phone city gstNumber')
            .limit(6)
            .lean()
            .catch(() => [])
        : [],

      // 4. Stock / Inventory Products
      models.Inventory
        ? models.Inventory.find({
            $and: [
              companyFilter,
              {
                $or: [
                  { productName: regex },
                  { name: regex },
                  { sku: regex },
                  { fabricType: regex }
                ]
              }
            ]
          })
            .select('_id productName name sku fabricType quantity currentStock unit')
            .limit(6)
            .lean()
            .catch(() => [])
        : []
    ]);

    const results = [
      ...jobCards.map((j) => ({
        id: j._id,
        category: 'Job Cards',
        title: `Job #${j.jobNo || 'N/A'}`,
        subtitle: `${j.clientName || 'Client'} - ${j.fabricName || 'Fabric'} (${j.stage || 'In Progress'})`,
        meta: j.totalMeters ? `${j.totalMeters}m` : '',
        route: `#jobcards_list`,
        item: j
      })),
      ...invoices.map((inv) => ({
        id: inv._id,
        category: 'Invoices',
        title: `Invoice #${inv.invoiceNo || 'N/A'}`,
        subtitle: `${inv.customerName || inv.partyName || 'Customer'}`,
        meta: inv.grandTotal ? `₹${Number(inv.grandTotal).toLocaleString('en-IN')}` : '',
        route: `#ee_invoices`,
        item: inv
      })),
      ...parties.map((p) => ({
        id: p._id,
        category: 'Parties & Vendors',
        title: p.partyName || p.name || 'Party',
        subtitle: `${p.city ? p.city + ' | ' : ''}${p.phone || p.gstNumber || ''}`,
        meta: '',
        route: `#jobcards_business_connection`,
        item: p
      })),
      ...stock.map((s) => ({
        id: s._id,
        category: 'Inventory Stock',
        title: s.productName || s.name || s.sku || 'Item',
        subtitle: `${s.fabricType ? s.fabricType + ' | ' : ''}SKU: ${s.sku || 'N/A'}`,
        meta: s.quantity !== undefined ? `${s.quantity} ${s.unit || 'units'}` : '',
        route: `#inventory`,
        item: s
      }))
    ];

    res.status(200).json({
      success: true,
      query: q,
      companyId,
      total: results.length,
      results
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

module.exports = {
  globalSearch
};
