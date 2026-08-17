const db = require('../db/models');
const logger = require('../config/logger');

// Get All Expense / Income Records (with filters)
const getAll = async (req, res) => {
  try {
    const {
      search = '',
      type = 'All',
      category = 'All',
      dateStart = '',
      dateEnd = '',
      page = 1,
      limit = 200
    } = req.query;

    const filter = { department: 'digital_print' };

    if (type && type !== 'All') {
      filter.type = type.toUpperCase();
    }

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (dateStart || dateEnd) {
      filter.date = {};
      if (dateStart) filter.date.$gte = dateStart;
      if (dateEnd) filter.date.$lte = dateEnd;
    }

    if (search && search.trim()) {
      const s = search.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(s, 'i');
      filter.$or = [
        { voucherNo: regex },
        { title: regex },
        { category: regex },
        { paidToOrReceivedFrom: regex },
        { billNo: regex },
        { description: regex }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 200;
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      db.Expense.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      db.Expense.countDocuments(filter)
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
      pages: Math.ceil(total / limitNum) || 1
    });
  } catch (err) {
    logger.error('expense.getAll error: %o', err);
    res.status(500).json({ error: err.message || 'Failed to fetch expense records' });
  }
};

// Get Next Voucher Number (e.g. EDP-EXP-1001)
const getNextVoucherNo = async (req, res) => {
  try {
    const expenses = await db.Expense.find({}, { voucherNo: 1 }).lean();
    let maxNo = 1000;

    expenses.forEach(e => {
      if (!e.voucherNo) return;
      const match = String(e.voucherNo).match(/(?:EDP-EXP-)(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNo) maxNo = num;
      }
    });

    res.json({ nextVoucherNo: `EDP-EXP-${maxNo + 1}` });
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

    if (!payload.voucherNo) {
      const expenses = await db.Expense.find({}, { voucherNo: 1 }).lean();
      let maxNo = 1000;
      expenses.forEach(e => {
        if (!e.voucherNo) return;
        const match = String(e.voucherNo).match(/(?:EDP-EXP-)(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNo) maxNo = num;
        }
      });
      payload.voucherNo = `EDP-EXP-${maxNo + 1}`;
    }

    if (req.user) {
      payload.createdBy = req.user.name || req.user.fullName || req.user.username || 'System';
    }

    const created = await db.Expense.create(payload);

    // Publish Authority Activity Event
    try {
      const { publishActivity } = require('../utils/activityEvent');
      const uName = req.user?.name || payload.userName || payload.createdBy || 'Staff User';
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
        description: `💸 **Expense Voucher #${created.voucherNo}** logged for Purpose: **"${created.title}"** | Category: **${created.category}** | Amount: **₹${created.amount}** (${created.type === 'IN' ? 'Income' : 'Expense'}) by **${uName}**.`
      }).catch(e => logger.warn('publishActivity expense create failed: %s', e.message));
    } catch (e) {
      logger.warn('Failed to publish activity for expense: %o', e);
    }

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

    const updated = await db.Expense.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ error: 'Expense record not found' });
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
    res.json({ success: true, message: 'Expense record deleted successfully' });
  } catch (err) {
    logger.error('expense.remove error: %o', err);
    res.status(500).json({ error: err.message || 'Failed to delete expense record' });
  }
};

// Analytics KPI Summary
const getAnalytics = async (req, res) => {
  try {
    const { dateStart = '', dateEnd = '' } = req.query;
    const filter = { department: 'digital_print' };

    if (dateStart || dateEnd) {
      filter.date = {};
      if (dateStart) filter.date.$gte = dateStart;
      if (dateEnd) filter.date.$lte = dateEnd;
    }

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

module.exports = {
  getAll,
  getNextVoucherNo,
  getOne,
  create,
  update,
  remove,
  getAnalytics
};
