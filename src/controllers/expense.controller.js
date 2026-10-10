const db = require('../db/models');
const logger = require('../config/logger');
const { emitSocketEvent } = require('../utils/socketEmitHelper');

const normalizeBusinessUnit = (bu) => {
  if (!bu) return 'Elite Digital Print';
  const u = String(bu).trim().toUpperCase();
  if (u === 'EDP' || u === 'ELITE DIGITAL PRINT' || u === 'ELITE DIGITAL PRINTS') return 'Elite Digital Print';
  if (u === 'ES' || u === 'ELITE STITCHING') return 'Elite Stitching';
  if (u === 'EE' || u === 'ELITE EDITION') return 'Elite Edition';
  if (u === 'EF' || u === 'ELITE FABTEX') return 'Elite Fabtex';
  if (u === 'EON' || u === 'ELITE ONLINE') return 'Elite Online';
  return bu;
};

const getBusinessUnitCode = (bu) => {
  const norm = normalizeBusinessUnit(bu);
  if (norm === 'Elite Digital Print') return 'EDP';
  if (norm === 'Elite Stitching') return 'ES';
  if (norm === 'Elite Edition') return 'EE';
  if (norm === 'Elite Fabtex') return 'EF';
  if (norm === 'Elite Online') return 'EON';
  return 'EDP';
};

const buildExpenseCompFilter = (companyEntity) => {
  const norm = normalizeBusinessUnit(companyEntity);
  if (norm === 'Elite Stitching') {
    return { companyEntity: 'Elite Stitching' };
  }
  if (norm === 'Elite Edition') {
    return { companyEntity: 'Elite Edition' };
  }
  if (norm === 'Elite Fabtex') {
    return { companyEntity: 'Elite Fabtex' };
  }
  if (norm === 'Elite Online') {
    return { companyEntity: 'Elite Online' };
  }
  return {
    $or: [
      { companyEntity: { $in: ['Elite Digital Print', 'Elite Digital Prints'] } },
      { companyEntity: { $exists: false } },
      { companyEntity: null },
      { companyEntity: '' }
    ]
  };
};

const isCashTransaction = (item) => {
  const account = String(item.bankAccount || '').trim().toLowerCase();
  if (account === 'cash in hand' || account === 'cash' || account.includes('cash in hand') || account.includes('petty cash')) {
    return true;
  }
  if (account && !account.includes('cash')) {
    // Explicitly associated with a bank account (e.g. KOTAK EDP, HDFC Bank)
    return false;
  }
  const mode = String(item.paymentMode || '').trim().toLowerCase();
  return mode === 'cash' || mode.includes('petty cash');
};

/**
 * Core Ledger Aggregation Pipeline
 * Computes Historical Openings (Cash/Bank), Period Movements, and Closing Balances
 */
const calculateLedgerAggregation = async ({ businessUnit, companyEntity, startDate, endDate, dateStart, dateEnd }) => {
  const effectiveBU = businessUnit || companyEntity || 'EDP';
  const buCode = getBusinessUnitCode(effectiveBU);
  const normEntity = normalizeBusinessUnit(effectiveBU);

  const now = new Date();
  const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const start = startDate || dateStart || currentMonthStart;
  const end = endDate || dateEnd || todayDate;

  // 1. Fetch LedgerSettings for initial opening configuration
  const settings = await db.LedgerSettings.findOne({
    $or: [
      { businessUnit: buCode },
      { companyEntity: normEntity },
      { businessUnit: normEntity }
    ]
  }).lean();

  const initialCashOpening = Number(settings?.initialCashOpening) || 0;
  const initialBankOpening = Number(settings?.initialBankOpening) || 0;
  const effectiveDate = (settings?.effectiveDate || '').trim();
  const bankAccountName = settings?.bankAccountName || (buCode === 'EDP' ? 'KOTAK EDP' : `${buCode} Bank Account`);

  const compFilter = buildExpenseCompFilter(normEntity);

  // 2. Calculate Historical Opening Balances (all approved transactions before `start`)
  const histDateCond = {};
  if (effectiveDate && effectiveDate < start) {
    histDateCond.$gte = effectiveDate;
    histDateCond.$lt = start;
  } else {
    histDateCond.$lt = start;
  }

  const historicalTxns = await db.Expense.find({
    $and: [
      compFilter,
      { status: { $ne: 'REJECTED' } },
      { date: histDateCond }
    ]
  }, { type: 1, amount: 1, paymentMode: 1, bankAccount: 1 }).lean();

  let histCashIn = 0;
  let histCashOut = 0;
  let histBankIn = 0;
  let histBankOut = 0;

  historicalTxns.forEach(item => {
    const amt = Number(item.amount) || 0;
    if (isCashTransaction(item)) {
      if (item.type === 'IN') histCashIn += amt;
      else if (item.type === 'OUT') histCashOut += amt;
    } else {
      if (item.type === 'IN') histBankIn += amt;
      else if (item.type === 'OUT') histBankOut += amt;
    }
  });

  const cashOpening = Number((initialCashOpening + histCashIn - histCashOut).toFixed(2));
  const bankOpening = Number((initialBankOpening + histBankIn - histBankOut).toFixed(2));

  // 3. Calculate Period Movements (transactions between `start` and `end`)
  const periodTxns = await db.Expense.find({
    $and: [
      compFilter,
      { status: { $ne: 'REJECTED' } },
      { date: { $gte: start, $lte: end } }
    ]
  }, { type: 1, amount: 1, paymentMode: 1, bankAccount: 1 }).lean();

  let cashIn = 0;
  let cashExpense = 0;
  let bankIn = 0;
  let bankExpense = 0;

  periodTxns.forEach(item => {
    const amt = Number(item.amount) || 0;
    if (isCashTransaction(item)) {
      if (item.type === 'IN') cashIn += amt;
      else if (item.type === 'OUT') cashExpense += amt;
    } else {
      if (item.type === 'IN') bankIn += amt;
      else if (item.type === 'OUT') bankExpense += amt;
    }
  });

  cashIn = Number(cashIn.toFixed(2));
  cashExpense = Number(cashExpense.toFixed(2));
  bankIn = Number(bankIn.toFixed(2));
  bankExpense = Number(bankExpense.toFixed(2));

  // 4. Derive Closing Balances:
  // cashClosing = cashOpening + cashIn - cashExpense
  // bankClosing = bankOpening + bankIn - bankExpense
  const cashClosing = Number((cashOpening + cashIn - cashExpense).toFixed(2));
  const bankClosing = Number((bankOpening + bankIn - bankExpense).toFixed(2));

  return {
    cashOpening,
    bankOpening,
    cashIn,
    cashExpense,
    cashClosing,
    bankIn,
    bankExpense,
    bankClosing,
    totalTransactions: periodTxns.length,
    businessUnit: buCode,
    companyEntity: normEntity,
    startDate: start,
    endDate: end,
    settings: {
      initialCashOpening,
      initialBankOpening,
      effectiveDate,
      bankAccountName,
      notes: settings?.notes || ''
    }
  };
};

// Get All Expense / Income Records (with filters + ledger summary)
const getAll = async (req, res) => {
  try {
    const {
      search = '',
      type = 'All',
      category = 'All',
      paymentMode = 'All',
      dateStart = '',
      dateEnd = '',
      startDate = '',
      endDate = '',
      page = 1,
      limit = 500,
      companyEntity,
      businessUnit
    } = req.query;

    const effectiveDateStart = dateStart || startDate || '';
    const effectiveDateEnd = dateEnd || endDate || '';
    const effectiveBU = businessUnit || companyEntity;

    const conditions = [];

    const compFilter = buildExpenseCompFilter(effectiveBU);
    if (compFilter) {
      conditions.push(compFilter);
    }

    if (type && type !== 'All') {
      const types = String(type).split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
      if (types.length > 1) {
        conditions.push({ type: { $in: types } });
      } else if (types.length === 1) {
        conditions.push({ type: types[0] });
      }
    }

    if (category && category !== 'All') {
      const cats = String(category).split(',').map(c => c.trim()).filter(Boolean);
      if (cats.length > 1) {
        conditions.push({ category: { $in: cats } });
      } else if (cats.length === 1) {
        conditions.push({ category: cats[0] });
      }
    }

    if (paymentMode && paymentMode !== 'All') {
      const modes = String(paymentMode).split(',').map(m => m.trim()).filter(Boolean);
      if (modes.length > 1) {
        conditions.push({ paymentMode: { $in: modes } });
      } else if (modes.length === 1) {
        conditions.push({ paymentMode: modes[0] });
      }
    }

    if (effectiveDateStart || effectiveDateEnd) {
      const dateCond = {};
      if (effectiveDateStart) dateCond.$gte = effectiveDateStart;
      if (effectiveDateEnd) dateCond.$lte = effectiveDateEnd;
      conditions.push({ date: dateCond });
    }

    if (search && search.trim()) {
      const s = search.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(s, 'i');
      conditions.push({
        $or: [
          { voucherNo: regex },
          { title: regex },
          { category: regex },
          { paidToOrReceivedFrom: regex },
          { billNo: regex },
          { description: regex },
          { bankAccount: regex }
        ]
      });
    }

    const filter = conditions.length > 0 ? { $and: conditions } : {};

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 500;
    const skip = (pageNum - 1) * limitNum;

    const [data, total, ledgerSummary] = await Promise.all([
      db.Expense.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      db.Expense.countDocuments(filter),
      calculateLedgerAggregation({
        businessUnit: effectiveBU,
        companyEntity: effectiveBU,
        startDate: effectiveDateStart,
        endDate: effectiveDateEnd
      })
    ]);

    // Calculate Summary Totals for filtered dataset
    const allMatching = await db.Expense.find(filter, { type: 1, amount: 1 }).lean();
    let totalIn = 0;
    let totalOut = 0;

    allMatching.forEach(item => {
      const amt = Number(item.amount) || 0;
      if (item.type === 'IN') totalIn += amt;
      else if (item.type === 'OUT') totalOut += amt;
    });

    res.json({
      success: true,
      data,
      total,
      totalIn,
      totalOut,
      netBalance: totalIn - totalOut,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      ledgerSummary
    });
  } catch (err) {
    logger.error('expense.getAll error: %o', err);
    res.status(500).json({ error: err.message || 'Failed to fetch expense records' });
  }
};

// Standalone Ledger Aggregation Endpoint
const getLedgerSummary = async (req, res) => {
  try {
    const { businessUnit, companyEntity, startDate, endDate, dateStart, dateEnd } = req.query;
    const summary = await calculateLedgerAggregation({
      businessUnit: businessUnit || companyEntity,
      companyEntity: companyEntity || businessUnit,
      startDate: startDate || dateStart,
      endDate: endDate || dateEnd
    });
    res.json(summary);
  } catch (err) {
    logger.error('expense.getLedgerSummary error: %o', err);
    res.status(500).json({ error: err.message || 'Failed to calculate ledger summary' });
  }
};

// Get Ledger Initial Opening Settings
const getLedgerSettings = async (req, res) => {
  try {
    const { businessUnit, companyEntity } = req.query;
    const buCode = getBusinessUnitCode(companyEntity || businessUnit);
    const normEntity = normalizeBusinessUnit(companyEntity || businessUnit);

    let settings = await db.LedgerSettings.findOne({
      $or: [
        { businessUnit: buCode },
        { companyEntity: normEntity },
        { businessUnit: normEntity }
      ]
    }).lean();

    if (!settings) {
      settings = {
        businessUnit: buCode,
        companyEntity: normEntity,
        initialCashOpening: 0,
        initialBankOpening: 0,
        effectiveDate: '2024-04-01',
        bankAccountName: buCode === 'EDP' ? 'KOTAK EDP' : `${buCode} Bank Account`,
        notes: ''
      };
    }

    res.json({ success: true, settings });
  } catch (err) {
    logger.error('expense.getLedgerSettings error: %o', err);
    res.status(500).json({ error: 'Failed to fetch ledger settings' });
  }
};

// Save Ledger Initial Opening Settings
const saveLedgerSettings = async (req, res) => {
  try {
    const {
      businessUnit,
      companyEntity,
      initialCashOpening = 0,
      initialBankOpening = 0,
      effectiveDate,
      bankAccountName = 'KOTAK EDP',
      notes = ''
    } = req.body;

    const buCode = getBusinessUnitCode(companyEntity || businessUnit);
    const normEntity = normalizeBusinessUnit(companyEntity || businessUnit);
    const activeUserName = req.headers['x-user-name'] || req.user?.name || 'Staff User';

    const updated = await db.LedgerSettings.findOneAndUpdate(
      {
        $or: [
          { businessUnit: buCode },
          { companyEntity: normEntity }
        ]
      },
      {
        $set: {
          businessUnit: buCode,
          companyEntity: normEntity,
          initialCashOpening: Number(initialCashOpening) || 0,
          initialBankOpening: Number(initialBankOpening) || 0,
          effectiveDate: effectiveDate || '2024-04-01',
          bankAccountName: bankAccountName || (buCode === 'EDP' ? 'KOTAK EDP' : `${buCode} Bank Account`),
          notes: notes || '',
          updatedBy: activeUserName
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    emitSocketEvent(req, 'ledger-settings-updated', updated);

    res.json({ success: true, settings: updated });
  } catch (err) {
    logger.error('expense.saveLedgerSettings error: %o', err);
    res.status(500).json({ error: err.message || 'Failed to save ledger settings' });
  }
};

// Helper to generate a guaranteed unique expense voucher number
async function generateUniqueVoucherNo(companyEntity = 'Elite Digital Print') {
  const prefixMap = {
    'Elite Edition': 'EE-EXP-',
    'Elite Fabtex': 'EF-EXP-',
    'Elite Stitching': 'ES-EXP-',
    'Elite Online': 'EO-EXP-',
    'Elite Digital Print': 'EDP-EXP-'
  };
  const prefix = prefixMap[companyEntity] || 'EDP-EXP-';

  const expenses = await db.Expense.find({}, { voucherNo: 1 }).lean();
  let maxNo = 1000;

  expenses.forEach(e => {
    if (!e.voucherNo) return;
    const match = String(e.voucherNo).match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNo) maxNo = num;
    }
  });

  let candidate = `${prefix}${maxNo + 1}`;
  let counter = maxNo + 1;

  while (await db.Expense.exists({ voucherNo: candidate })) {
    counter++;
    candidate = `${prefix}${counter}`;
  }

  return candidate;
}

// Get Next Voucher Number
const getNextVoucherNo = async (req, res) => {
  try {
    const { companyEntity } = req.query;
    const nextVoucherNo = await generateUniqueVoucherNo(companyEntity || 'Elite Digital Print');
    res.json({ nextVoucherNo });
  } catch (err) {
    logger.error('expense.getNextVoucherNo error: %o', err);
    res.status(500).json({ error: 'Failed to generate next voucher number' });
  }
};

// Get Single Expense Record
const getOne = async (req, res) => {
  try {
    const item = await db.Expense.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Expense record not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expense details' });
  }
};

// Create New Expense/Income Record
const create = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.title || !payload.title.trim()) {
      return res.status(400).json({ error: 'Title/Purpose is required' });
    }
    if (!payload.amount || isNaN(payload.amount) || Number(payload.amount) <= 0) {
      return res.status(400).json({ error: 'Valid Amount (> 0) is required' });
    }

    if (!payload.companyEntity) {
      payload.companyEntity = 'Elite Digital Print';
    }

    if (!payload.voucherNo || (await db.Expense.exists({ voucherNo: payload.voucherNo }))) {
      payload.voucherNo = await generateUniqueVoucherNo(payload.companyEntity);
    }

    // Default Bank Account routing
    if (!payload.bankAccount || !payload.bankAccount.trim()) {
      const pMode = String(payload.paymentMode || '').trim().toLowerCase();
      if (pMode === 'cash' || pMode.includes('petty cash')) {
        payload.bankAccount = 'Cash in Hand';
      } else {
        const buCode = getBusinessUnitCode(payload.companyEntity);
        payload.bankAccount = buCode === 'EDP' ? 'KOTAK EDP' : `${buCode} Bank Account`;
      }
    }

    if (!payload.status) {
      payload.status = 'APPROVED';
    }

    const activeUserName = req.headers['x-user-name'] || req.user?.name || payload.userName || payload.createdBy || 'Staff User';
    payload.createdBy = activeUserName;
    payload.createdByName = activeUserName;

    const created = await db.Expense.create(payload);

    // Publish Authority Activity Event
    try {
      const { publishActivity } = require('../utils/activityEvent');
      const uName = activeUserName;
      const uId = req.user?._id || payload.userId;
      publishActivity({
        actorId: uId,
        actorName: uName,
        action: 'CREATE',
        module: 'Finance Expense',
        recordRef: created.voucherNo,
        recordId: created._id,
        permissionScope: 'finance_expenses',
        department: 'Finance',
        description: `💸 **Expense Voucher #${created.voucherNo}** logged for Purpose: **"${created.title}"** | Category: **${created.category}** | Amount: **₹${created.amount}** (${created.type === 'IN' ? 'Income' : 'Expense'}) [${created.bankAccount || created.paymentMode}] by **${uName}**.`
      }).catch(e => logger.warn('publishActivity expense create failed: %s', e.message));
    } catch (e) {
      logger.warn('Failed to publish activity for expense: %o', e);
    }

    emitSocketEvent(req, 'expense-created', created);
    emitSocketEvent(req, 'expense-updated', created);

    res.status(201).json(created);
  } catch (err) {
    logger.error('expense.create error: %o', err);
    res.status(500).json({ error: err.message || 'Failed to log expense record' });
  }
};

// Update Expense Record
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    if (!payload.companyEntity) {
      payload.companyEntity = 'Elite Digital Print';
    }

    if (!payload.bankAccount || !payload.bankAccount.trim()) {
      const pMode = String(payload.paymentMode || '').trim().toLowerCase();
      if (pMode === 'cash' || pMode.includes('petty cash')) {
        payload.bankAccount = 'Cash in Hand';
      } else {
        const buCode = getBusinessUnitCode(payload.companyEntity);
        payload.bankAccount = buCode === 'EDP' ? 'KOTAK EDP' : `${buCode} Bank Account`;
      }
    }

    const editorName = req.headers['x-user-name'] || req.user?.name || payload.userName || payload.updatedBy || 'Staff User';
    payload.updatedBy = editorName;
    payload.updatedByName = editorName;

    const updated = await db.Expense.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ error: 'Expense record not found' });
    emitSocketEvent(req, 'expense-updated', updated);
    res.json(updated);
  } catch (err) {
    logger.error('expense.update error: %o', err);
    res.status(500).json({ error: err.message || 'Failed to update expense record' });
  }
};

// Delete Expense Record
const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await db.Expense.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Expense record not found' });
    emitSocketEvent(req, 'expense-deleted', { id });
    emitSocketEvent(req, 'expense-updated', { id });
    res.json({ success: true, message: 'Expense record deleted successfully' });
  } catch (err) {
    logger.error('expense.remove error: %o', err);
    res.status(500).json({ error: err.message || 'Failed to delete expense record' });
  }
};

// Analytics KPI Summary
const getAnalytics = async (req, res) => {
  try {
    const { companyEntity, dateStart = '', dateEnd = '', businessUnit } = req.query;
    const effectiveBU = businessUnit || companyEntity;
    const conditions = [];

    const compFilter = buildExpenseCompFilter(effectiveBU);
    if (compFilter) conditions.push(compFilter);

    if (dateStart || dateEnd) {
      const dateCond = {};
      if (dateStart) dateCond.$gte = dateStart;
      if (dateEnd) dateCond.$lte = dateEnd;
      conditions.push({ date: dateCond });
    }

    const filter = conditions.length > 0 ? { $and: conditions } : {};
    const expenses = await db.Expense.find(filter).lean();

    let totalIn = 0;
    let totalOut = 0;
    let totalVouchers = expenses.length;
    const categoryTotals = {};

    expenses.forEach(e => {
      const amt = Number(e.amount) || 0;
      if (e.type === 'IN') {
        totalIn += amt;
      } else {
        totalOut += amt;
        const cat = e.category || 'Other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
      }
    });

    res.json({
      totalIn,
      totalOut,
      netBalance: totalIn - totalOut,
      totalVouchers,
      categoryTotals
    });
  } catch (err) {
    logger.error('expense.getAnalytics error: %o', err);
    res.status(500).json({ error: 'Failed to calculate expense analytics' });
  }
};

// Clear All Expense Records
const clearAll = async (req, res) => {
  try {
    const { companyEntity } = req.query;
    const filter = companyEntity ? { companyEntity } : {};
    const result = await db.Expense.deleteMany(filter);
    res.json({
      success: true,
      message: `Cleared ${result.deletedCount} expense records.`,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    logger.error('expense.clearAll error: %o', err);
    res.status(500).json({ error: 'Failed to clear expense records' });
  }
};

module.exports = {
  getAll,
  getNextVoucherNo,
  getOne,
  create,
  update,
  remove,
  clearAll,
  getAnalytics,
  getLedgerSummary,
  getLedgerSettings,
  saveLedgerSettings
};
