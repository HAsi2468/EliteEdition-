const BillingInvoice = require('../db/models/billingInvoice.model');
const BillingPurchase = require('../db/models/billingPurchase.model');
const BillingCustomer = require('../db/models/billingCustomer.model');
const BillingVendor = require('../db/models/billingVendor.model');
const DeliveryChallan = require('../db/models/deliveryChallan.model');
const FabricChallan = require('../db/models/fabricChallan.model');
const LedgerReconciliation = require('../db/models/ledgerReconciliation.model');
const xaiService = require('./xai.service');
const logger = require('../config/logger');

/**
 * Fetch party master list with ERP balance indicators
 */
async function getPartiesList({ partyType = 'customer', search = '', tenantId, companyEntity }) {
  const query = {};
  if (companyEntity) query.companyEntity = companyEntity;

  if (partyType === 'customer') {
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { gstin: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    const customers = await BillingCustomer.find(query)
      .select('name gstin phone address balance currentBalance openingBalance')
      .limit(100)
      .lean();

    return customers.map(c => ({
      _id: c._id,
      name: c.name,
      gstin: c.gstin || '',
      phone: c.phone || '',
      type: 'customer',
      balance: c.balance ?? c.currentBalance ?? c.openingBalance ?? 0
    }));
  } else {
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { gstin: { $regex: search, $options: 'i' } }
      ];
    }
    const vendors = await BillingVendor.find(query)
      .select('name gstin phone balance currentBalance')
      .limit(100)
      .lean();

    return vendors.map(v => ({
      _id: v._id,
      name: v.name,
      gstin: v.gstin || '',
      phone: v.phone || '',
      type: 'vendor',
      balance: v.balance ?? v.currentBalance ?? 0
    }));
  }
}

/**
 * Fetch all relevant ERP transactions for a party
 */
async function fetchErpTransactions({ partyType, partyName, partyId, startDate, endDate, companyEntity }) {
  const erpTransactions = [];

  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);

  if (partyType === 'customer') {
    // 1. Invoices
    const invQuery = {
      $or: [
        { customerName: { $regex: partyName, $options: 'i' } },
        ...(partyId ? [{ customerId: partyId }] : [])
      ]
    };
    if (startDate || endDate) invQuery.invoiceDate = dateFilter;
    if (companyEntity) invQuery.companyEntity = companyEntity;

    const invoices = await BillingInvoice.find(invQuery)
      .select('invoiceNo invoiceDate totalAmount grandTotal finalAmount amountPaid status payments eWayBill')
      .sort({ invoiceDate: 1 })
      .lean();

    invoices.forEach(inv => {
      const invDate = inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split('T')[0] : '';
      const total = inv.grandTotal || inv.finalAmount || inv.totalAmount || 0;
      erpTransactions.push({
        id: `INV-${inv._id}`,
        date: invDate,
        voucherNo: inv.invoiceNo,
        type: 'INVOICE',
        narration: `Tax Invoice #${inv.invoiceNo} (${inv.status || 'Active'})`,
        debit: Number(total), // Customer is debited on sale
        credit: 0,
        amount: Number(total),
        source: 'BillingInvoice',
        ref: inv.invoiceNo
      });

      // Include recorded payments inside invoice if any
      if (Array.isArray(inv.payments) && inv.payments.length > 0) {
        inv.payments.forEach((p, idx) => {
          const payDate = p.date ? new Date(p.date).toISOString().split('T')[0] : invDate;
          const payAmt = Number(p.amount || 0);
          if (payAmt > 0) {
            erpTransactions.push({
              id: `PAY-${inv._id}-${idx}`,
              date: payDate,
              voucherNo: p.reference || p.transactionId || `PAY-${inv.invoiceNo}`,
              type: 'PAYMENT',
              narration: `Payment received for Inv #${inv.invoiceNo} (${p.mode || 'Bank'})`,
              debit: 0,
              credit: payAmt, // Customer is credited on payment
              amount: payAmt,
              source: 'InvoicePayment',
              ref: p.reference || inv.invoiceNo
            });
          }
        });
      }
    });

    // 2. Delivery Challans
    const dcQuery = {
      $or: [
        { clientName: { $regex: partyName, $options: 'i' } },
        { customerName: { $regex: partyName, $options: 'i' } }
      ]
    };
    if (companyEntity) dcQuery.companyEntity = companyEntity;
    const challans = await DeliveryChallan.find(dcQuery)
      .select('challanNo date totalPcs grandTotal status')
      .limit(50)
      .lean();

    challans.forEach(ch => {
      const chDate = ch.date ? new Date(ch.date).toISOString().split('T')[0] : '';
      if (ch.grandTotal && ch.grandTotal > 0) {
        erpTransactions.push({
          id: `DC-${ch._id}`,
          date: chDate,
          voucherNo: ch.challanNo,
          type: 'CHALLAN',
          narration: `Delivery Challan #${ch.challanNo} (${ch.totalPcs || 0} pcs)`,
          debit: Number(ch.grandTotal),
          credit: 0,
          amount: Number(ch.grandTotal),
          source: 'DeliveryChallan',
          ref: ch.challanNo
        });
      }
    });

  } else {
    // Vendor purchases
    const purQuery = {
      $or: [
        { vendorName: { $regex: partyName, $options: 'i' } },
        ...(partyId ? [{ vendorId: partyId }] : [])
      ]
    };
    if (companyEntity) purQuery.companyEntity = companyEntity;

    const purchases = await BillingPurchase.find(purQuery)
      .select('billNo purchaseNo date totalAmount grandTotal finalAmount paidAmount status')
      .sort({ date: 1 })
      .lean();

    purchases.forEach(pur => {
      const purDate = pur.date ? new Date(pur.date).toISOString().split('T')[0] : '';
      const total = pur.grandTotal || pur.finalAmount || pur.totalAmount || 0;
      erpTransactions.push({
        id: `PUR-${pur._id}`,
        date: purDate,
        voucherNo: pur.billNo || pur.purchaseNo,
        type: 'PURCHASE',
        narration: `Purchase Bill #${pur.billNo || pur.purchaseNo}`,
        debit: 0,
        credit: Number(total), // Vendor is credited on purchase
        amount: Number(total),
        source: 'BillingPurchase',
        ref: pur.billNo || pur.purchaseNo
      });

      if (pur.paidAmount && pur.paidAmount > 0) {
        erpTransactions.push({
          id: `PURPAY-${pur._id}`,
          date: purDate,
          voucherNo: `PAY-${pur.billNo || pur.purchaseNo}`,
          type: 'PAYMENT',
          narration: `Payment made for Bill #${pur.billNo || pur.purchaseNo}`,
          debit: Number(pur.paidAmount), // Vendor is debited on payment made
          credit: 0,
          amount: Number(pur.paidAmount),
          source: 'PurchasePayment',
          ref: pur.billNo || pur.purchaseNo
        });
      }
    });
  }

  return erpTransactions;
}

/**
 * Clean reference numbers for fuzzy matching
 */
function normalizeRef(ref) {
  if (!ref) return '';
  return String(ref)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Automated 3-Way Reconciliation Matching Engine
 */
function reconcileTransactions(statementItems = [], erpItems = [], partyType = 'customer', options = {}) {
  const toleranceDays = Number(options.toleranceDays) || 20;
  const toleranceAmount = Number(options.toleranceAmount) || 1.0;

  const matchedItems = [];
  const probableItems = [];
  const discrepantItems = [];
  const unmatchedStatementItems = [];
  const unmatchedErpItems = [];

  const erpPool = erpItems.map((item, idx) => ({ ...item, _poolIndex: idx, _matched: false }));
  const statementPool = statementItems.map((item, idx) => ({ ...item, _poolIndex: idx, _matched: false }));

  // Helper to get net magnitude for comparison
  const getNetVal = (item) => Math.abs(Number(item.debit || 0) - Number(item.credit || 0)) || Number(item.amount || 0);

  // STAGE 1: Exact Reference Match
  statementPool.forEach(stItem => {
    if (stItem._matched) return;
    const stNormRef = normalizeRef(stItem.voucherNo || stItem.ref);
    if (!stNormRef) return;

    const erpMatch = erpPool.find(erp => !erp._matched && (
      normalizeRef(erp.voucherNo) === stNormRef ||
      normalizeRef(erp.ref) === stNormRef ||
      (stNormRef.length >= 4 && normalizeRef(erp.voucherNo).includes(stNormRef))
    ));

    if (erpMatch) {
      const stAmt = getNetVal(stItem);
      const erpAmt = getNetVal(erpMatch);
      const diff = Math.abs(stAmt - erpAmt);

      if (diff <= toleranceAmount) {
        // Full Match
        stItem._matched = true;
        erpMatch._matched = true;
        matchedItems.push({
          date: stItem.date || erpMatch.date,
          voucherNo: stItem.voucherNo || erpMatch.voucherNo,
          type: stItem.type || erpMatch.type,
          narration: stItem.narration || erpMatch.narration,
          debit: stItem.debit,
          credit: stItem.credit,
          amount: stAmt,
          status: 'MATCHED',
          matchedWith: {
            erpId: erpMatch.id,
            voucherNo: erpMatch.voucherNo,
            amount: erpAmt,
            date: erpMatch.date
          },
          notes: 'Exact reference & amount match'
        });
      } else {
        // Discrepancy
        stItem._matched = true;
        erpMatch._matched = true;
        discrepantItems.push({
          date: stItem.date || erpMatch.date,
          voucherNo: stItem.voucherNo || erpMatch.voucherNo,
          type: stItem.type || erpMatch.type,
          narration: `Amount Variance: Statement ₹${stAmt.toFixed(2)} vs ERP ₹${erpAmt.toFixed(2)} (Diff: ₹${diff.toFixed(2)})`,
          debit: stItem.debit,
          credit: stItem.credit,
          amount: stAmt,
          status: 'DISCREPANT',
          matchedWith: {
            erpId: erpMatch.id,
            voucherNo: erpMatch.voucherNo,
            amount: erpAmt,
            variance: diff
          },
          notes: `Discrepancy of ₹${diff.toFixed(2)} detected`
        });
      }
    }
  });

  // STAGE 2: Amount & Date Match for remaining items
  statementPool.forEach(stItem => {
    if (stItem._matched) return;
    const stAmt = getNetVal(stItem);
    if (stAmt === 0) return;

    const erpMatch = erpPool.find(erp => {
      if (erp._matched) return false;
      const erpAmt = getNetVal(erp);
      const diff = Math.abs(stAmt - erpAmt);
      if (diff > toleranceAmount) return false;

      // Check date proximity if available (within specified toleranceDays)
      if (stItem.date && erp.date) {
        const d1 = new Date(stItem.date);
        const d2 = new Date(erp.date);
        const daysDiff = Math.abs((d1 - d2) / (1000 * 60 * 60 * 24));
        return daysDiff <= toleranceDays;
      }
      return true;
    });

    if (erpMatch) {
      stItem._matched = true;
      erpMatch._matched = true;
      matchedItems.push({
        date: stItem.date || erpMatch.date,
        voucherNo: stItem.voucherNo || erpMatch.voucherNo,
        type: stItem.type || erpMatch.type,
        narration: stItem.narration || erpMatch.narration,
        debit: stItem.debit,
        credit: stItem.credit,
        amount: stAmt,
        status: 'MATCHED',
        matchedWith: {
          erpId: erpMatch.id,
          voucherNo: erpMatch.voucherNo,
          amount: getNetVal(erpMatch),
          date: erpMatch.date
        },
        notes: 'Matched by amount and date window'
      });
    }
  });

  // STAGE 3: Probable Match (TDS 0.1% or 1% or 2% deduction)
  statementPool.forEach(stItem => {
    if (stItem._matched) return;
    const stAmt = getNetVal(stItem);
    if (stAmt === 0) return;

    const tdsCandidates = [0.001, 0.01, 0.02]; // 0.1%, 1%, 2%
    for (const rate of tdsCandidates) {
      const erpMatch = erpPool.find(erp => {
        if (erp._matched) return false;
        const erpAmt = getNetVal(erp);
        const expectedAfterTds = erpAmt * (1 - rate);
        return Math.abs(stAmt - expectedAfterTds) <= 2.0;
      });

      if (erpMatch) {
        stItem._matched = true;
        erpMatch._matched = true;
        const tdsPct = (rate * 100).toFixed(1);
        probableItems.push({
          date: stItem.date || erpMatch.date,
          voucherNo: stItem.voucherNo || erpMatch.voucherNo,
          type: 'TDS_PROBABLE',
          narration: `${stItem.narration || erpMatch.narration} (Net of ~${tdsPct}% TDS)`,
          debit: stItem.debit,
          credit: stItem.credit,
          amount: stAmt,
          status: 'PROBABLE',
          matchedWith: {
            erpId: erpMatch.id,
            voucherNo: erpMatch.voucherNo,
            grossAmount: getNetVal(erpMatch),
            tdsEstimated: getNetVal(erpMatch) - stAmt
          },
          notes: `Probable match with ~${tdsPct}% TDS deduction (₹${(getNetVal(erpMatch) - stAmt).toFixed(2)})`
        });
        break;
      }
    }
  });

  // Collect Remaining Unmatched Items
  statementPool.forEach(stItem => {
    if (!stItem._matched) {
      unmatchedStatementItems.push({
        date: stItem.date || '',
        voucherNo: stItem.voucherNo || '',
        type: stItem.type || 'UNKNOWN',
        narration: stItem.narration || 'Unmatched statement entry',
        debit: stItem.debit || 0,
        credit: stItem.credit || 0,
        amount: getNetVal(stItem),
        status: 'UNMATCHED',
        notes: 'Present in party statement, missing in ERP'
      });
    }
  });

  erpPool.forEach(erp => {
    if (!erp._matched) {
      unmatchedErpItems.push({
        date: erp.date || '',
        voucherNo: erp.voucherNo || '',
        type: erp.type || 'ERP_ITEM',
        narration: erp.narration || 'Unmatched ERP entry',
        debit: erp.debit || 0,
        credit: erp.credit || 0,
        amount: getNetVal(erp),
        status: 'UNMATCHED',
        notes: 'Recorded in ERP, missing in party statement'
      });
    }
  });

  return {
    matchedItems,
    probableItems,
    discrepantItems,
    unmatchedStatementItems,
    unmatchedErpItems
  };
}

module.exports = {
  getPartiesList,
  fetchErpTransactions,
  reconcileTransactions
};
