const db = require('../db/models');
const logger = require('../config/logger');

// Company entity filter helper for expenses and billing
const getCompanyAliases = (comp) => {
  const c = String(comp || 'Elite Digital Print').trim().toLowerCase();
  if (c.includes('print')) {
    return ['Elite Digital Print', 'Elite Digital Prints', 'digital_print', 'Digital Print'];
  }
  if (c.includes('stitch')) {
    return ['Elite Stitching', 'stitching', 'Stitching'];
  }
  if (c.includes('online')) {
    return ['Elite Online', 'elite_online', 'EON'];
  }
  if (c.includes('fabtex')) {
    return ['Elite Fabtex', 'elite_fabtex'];
  }
  return [comp, 'Elite Digital Print'];
};

/**
 * Categorize a single expense record into one of the 11 cost centers
 */
const categorizeExpense = (exp) => {
  const text = `${exp.category || ''} ${exp.title || ''} ${exp.description || ''}`.toLowerCase();

  if (/paper|sublimation\s*paper|transfer\s*film|butter/i.test(text)) return 'paper';
  if (/ink|flushing|cartridge|cmyk|dye/i.test(text)) return 'ink';
  if (/salary|wage|worker|staff|operator|designer|helper|labor|labour|attendance/i.test(text)) return 'salary';
  if (/rent|lease|godown|premises|shed/i.test(text)) return 'rent';
  if (/electr|power|light\s*bill|utility|torrent|dg\s*set|diesel|generator/i.test(text)) return 'electricity';
  if (/maint|repair|service|spare|head\s*clean|parts|grease|belt/i.test(text)) return 'maintenance';
  if (/transp|freight|delivery|tempo|auto|carriage|courier|fuel|petrol|dispatch/i.test(text)) return 'transport';
  if (/waste|scrap|damage|loss|rework|re-print|defect/i.test(text)) return 'wastage';
  if (/food|tea|refresh|snack|lunch|dinner|water|coffee|nashta/i.test(text)) return 'food';
  if (/machine|emi|deprec|loan|asset|hardware/i.test(text)) return 'machine';
  return 'other';
};

/**
 * GET /v1/costing/monthly-report
 */
const getMonthlyCostingReport = async (req, res) => {
  try {
    const { companyEntity = 'Elite Digital Print', month } = req.query;

    // Determine target month (YYYY-MM)
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const targetMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : currentMonthStr;

    const [yearStr, monthNumStr] = targetMonth.split('-');
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthNumStr, 10); // 1-based

    // First and last day of target month
    const lastDayOfMonth = new Date(year, monthIndex, 0).getDate();
    const startDateStr = `${targetMonth}-01`;
    const endDateStr = `${targetMonth}-${String(lastDayOfMonth).padStart(2, '0')}`;

    const startDt = new Date(`${startDateStr}T00:00:00.000Z`);
    const endDt = new Date(`${endDateStr}T23:59:59.999Z`);

    const aliases = getCompanyAliases(companyEntity);

    // 1. Fetch Invoices for this month
    const invoiceQuery = {
      companyEntity: { $in: aliases },
      invoiceDate: { $gte: startDt, $lte: endDt },
      invoiceStatus: { $ne: 'CANCELLED' }
    };

    const invoices = await db.BillingInvoice.find(invoiceQuery).sort({ invoiceDate: -1, invoiceSeq: -1 }).lean();

    let totalBilled = 0;
    let totalTaxable = 0;
    let totalTax = 0;
    let totalPaid = 0;
    let totalBalance = 0;
    let totalBilledMeters = 0;

    const invoiceList = (invoices || []).map(inv => {
      const gTotal = Number(inv.grandTotal || 0);
      const sub = Number(inv.subtotal || 0);
      const tax = Number(inv.totalTax || 0);
      const paid = Number(inv.paidAmount || 0);
      const bal = Number(inv.balanceDue != null ? inv.balanceDue : (gTotal - paid));

      totalBilled += gTotal;
      totalTaxable += sub;
      totalTax += tax;
      totalPaid += paid;
      totalBalance += bal;

      let invMeters = 0;
      (inv.items || []).forEach(it => {
        const q = Number(it.qty || 0);
        invMeters += q;
      });
      totalBilledMeters += invMeters;

      return {
        _id: inv._id,
        invoiceNo: inv.invoiceNo,
        date: inv.invoiceDate ? String(inv.invoiceDate).split('T')[0] : '',
        party: inv.customer?.businessName || inv.customer?.name || 'Unknown Client',
        gstin: inv.customer?.gstin || '',
        subtotal: sub,
        tax: tax,
        grandTotal: gTotal,
        paidAmount: paid,
        balanceDue: bal,
        paymentStatus: inv.paymentStatus || (bal <= 0 ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID'),
        meters: Math.round(invMeters * 100) / 100,
        itemCount: (inv.items || []).length
      };
    });

    // 2. Fetch Recorded Expenses for this month
    const expenseQuery = {
      type: 'OUT',
      date: { $gte: startDateStr, $lte: endDateStr }
    };
    if (companyEntity) {
      expenseQuery.$or = [
        { companyEntity: { $in: aliases } },
        { companyEntity: { $exists: false } },
        { companyEntity: null },
        { companyEntity: '' }
      ];
    }

    const recordedExpenses = await db.Expense.find(expenseQuery).sort({ date: -1 }).lean();

    const expenseCategorySums = {
      paper: 0,
      ink: 0,
      salary: 0,
      rent: 0,
      electricity: 0,
      maintenance: 0,
      transport: 0,
      wastage: 0,
      food: 0,
      machine: 0,
      other: 0
    };

    const expenseItems = (recordedExpenses || []).map(exp => {
      const amt = Number(exp.amount || 0);
      const catKey = categorizeExpense(exp);
      expenseCategorySums[catKey] = (expenseCategorySums[catKey] || 0) + amt;

      return {
        _id: exp._id,
        voucherNo: exp.voucherNo,
        date: exp.date,
        title: exp.title,
        category: exp.category,
        detectedKey: catKey,
        amount: amt,
        paymentMode: exp.paymentMode || 'Cash',
        paidTo: exp.paidToOrReceivedFrom || '',
        description: exp.description || ''
      };
    });

    // 3. Fetch Stored Monthly Fixed Overheads for this month
    const storedOverheads = await db.MonthlyCosting.findOne({
      companyEntity: { $in: aliases },
      month: targetMonth
    }).lean();

    const overheads = {
      paperCost: Number(storedOverheads?.paperCost || 0),
      inkCost: Number(storedOverheads?.inkCost || 0),
      salaryCost: Number(storedOverheads?.salaryCost || 0),
      rentCost: Number(storedOverheads?.rentCost || 0),
      electricityCost: Number(storedOverheads?.electricityCost || 0),
      maintenanceCost: Number(storedOverheads?.maintenanceCost || 0),
      transportCost: Number(storedOverheads?.transportCost || 0),
      wastageCost: Number(storedOverheads?.wastageCost || 0),
      foodCost: Number(storedOverheads?.foodCost || 0),
      machineCost: Number(storedOverheads?.machineCost || 0),
      otherCost: Number(storedOverheads?.otherCost || 0),
      notes: storedOverheads?.notes || ''
    };

    // 4. Combine Recorded Expenses + Fixed Overheads
    const costBreakdown = {
      paper: {
        label: 'Paper Cost',
        icon: '📄',
        recorded: Math.round(expenseCategorySums.paper * 100) / 100,
        fixed: overheads.paperCost,
        total: Math.round((expenseCategorySums.paper + overheads.paperCost) * 100) / 100
      },
      ink: {
        label: 'Ink Cost',
        icon: '🎨',
        recorded: Math.round(expenseCategorySums.ink * 100) / 100,
        fixed: overheads.inkCost,
        total: Math.round((expenseCategorySums.ink + overheads.inkCost) * 100) / 100
      },
      salary: {
        label: 'Salary & Wages',
        icon: '👥',
        recorded: Math.round(expenseCategorySums.salary * 100) / 100,
        fixed: overheads.salaryCost,
        total: Math.round((expenseCategorySums.salary + overheads.salaryCost) * 100) / 100
      },
      rent: {
        label: 'Factory Rent',
        icon: '🏢',
        recorded: Math.round(expenseCategorySums.rent * 100) / 100,
        fixed: overheads.rentCost,
        total: Math.round((expenseCategorySums.rent + overheads.rentCost) * 100) / 100
      },
      electricity: {
        label: 'Electricity & Power',
        icon: '⚡',
        recorded: Math.round(expenseCategorySums.electricity * 100) / 100,
        fixed: overheads.electricityCost,
        total: Math.round((expenseCategorySums.electricity + overheads.electricityCost) * 100) / 100
      },
      maintenance: {
        label: 'Machine Maintenance',
        icon: '🛠️',
        recorded: Math.round(expenseCategorySums.maintenance * 100) / 100,
        fixed: overheads.maintenanceCost,
        total: Math.round((expenseCategorySums.maintenance + overheads.maintenanceCost) * 100) / 100
      },
      transport: {
        label: 'Transportation & Freight',
        icon: '🚚',
        recorded: Math.round(expenseCategorySums.transport * 100) / 100,
        fixed: overheads.transportCost,
        total: Math.round((expenseCategorySums.transport + overheads.transportCost) * 100) / 100
      },
      wastage: {
        label: 'Wastage & Scrap Loss',
        icon: '🗑️',
        recorded: Math.round(expenseCategorySums.wastage * 100) / 100,
        fixed: overheads.wastageCost,
        total: Math.round((expenseCategorySums.wastage + overheads.wastageCost) * 100) / 100
      },
      food: {
        label: 'Staff Food & Refreshments',
        icon: '☕',
        recorded: Math.round(expenseCategorySums.food * 100) / 100,
        fixed: overheads.foodCost,
        total: Math.round((expenseCategorySums.food + overheads.foodCost) * 100) / 100
      },
      machine: {
        label: 'Machine Cost / EMI / Deprec',
        icon: '🖨️',
        recorded: Math.round(expenseCategorySums.machine * 100) / 100,
        fixed: overheads.machineCost,
        total: Math.round((expenseCategorySums.machine + overheads.machineCost) * 100) / 100
      },
      other: {
        label: 'Other Sundry Expenses',
        icon: '📦',
        recorded: Math.round(expenseCategorySums.other * 100) / 100,
        fixed: overheads.otherCost,
        total: Math.round((expenseCategorySums.other + overheads.otherCost) * 100) / 100
      }
    };

    const totalOperationalCost = Object.values(costBreakdown).reduce((acc, c) => acc + c.total, 0);

    // 5. Total Production Meters from JobPrintLog or Invoices
    let totalPrintedMeters = 0;
    try {
      const logs = await db.JobPrintLog.find({
        $or: [
          { date: { $gte: startDt, $lte: endDt } },
          { date: { $gte: startDateStr, $lte: endDateStr } },
          { createdAt: { $gte: startDt, $lte: endDt } }
        ]
      }).select('printMtr totalMtr mtr').lean();

      (logs || []).forEach(l => {
        totalPrintedMeters += parseFloat(l.printMtr || l.totalMtr || l.mtr || 0) || 0;
      });
    } catch (e) {
      logger.warn('Failed to aggregate print logs for costing: %s', e.message);
    }

    const effectiveProductionMeters = totalPrintedMeters > 0 ? totalPrintedMeters : totalBilledMeters;

    // 6. Net Position: PLUS or MINUS
    const netProfitOrLoss = Math.round((totalBilled - totalOperationalCost) * 100) / 100;
    const isPlus = netProfitOrLoss >= 0;
    const profitMarginPct = totalBilled > 0 ? Math.round(((netProfitOrLoss / totalBilled) * 100) * 10) / 10 : 0;

    const costPerMeter = effectiveProductionMeters > 0 ? Math.round((totalOperationalCost / effectiveProductionMeters) * 100) / 100 : 0;
    const revenuePerMeter = effectiveProductionMeters > 0 ? Math.round((totalBilled / effectiveProductionMeters) * 100) / 100 : 0;
    const profitPerMeter = effectiveProductionMeters > 0 ? Math.round((netProfitOrLoss / effectiveProductionMeters) * 100) / 100 : 0;

    res.json({
      success: true,
      month: targetMonth,
      companyEntity,
      financialSummary: {
        totalRevenue: Math.round(totalBilled * 100) / 100,
        totalTaxable: Math.round(totalTaxable * 100) / 100,
        totalTax: Math.round(totalTax * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalBalance: Math.round(totalBalance * 100) / 100,
        invoiceCount: invoiceList.length,
        totalOperationalCost: Math.round(totalOperationalCost * 100) / 100,
        netProfitOrLoss,
        status: isPlus ? 'PLUS' : 'MINUS',
        isPlus,
        profitMarginPct,
        effectiveProductionMeters: Math.round(effectiveProductionMeters * 100) / 100,
        costPerMeter,
        revenuePerMeter,
        profitPerMeter
      },
      costBreakdown,
      overheads,
      invoices: invoiceList,
      expenses: expenseItems
    });
  } catch (err) {
    logger.error('getMonthlyCostingReport error: %o', err);
    res.status(500).json({ error: 'Failed to generate monthly costing report.' });
  }
};

/**
 * POST /v1/costing/monthly-overheads
 */
const saveMonthlyOverheads = async (req, res) => {
  try {
    const {
      companyEntity = 'Elite Digital Print',
      month,
      paperCost = 0,
      inkCost = 0,
      salaryCost = 0,
      rentCost = 0,
      electricityCost = 0,
      maintenanceCost = 0,
      transportCost = 0,
      wastageCost = 0,
      foodCost = 0,
      machineCost = 0,
      otherCost = 0,
      notes = ''
    } = req.body;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Valid month (YYYY-MM) is required.' });
    }

    const updated = await db.MonthlyCosting.findOneAndUpdate(
      { companyEntity, month },
      {
        $set: {
          paperCost: Number(paperCost || 0),
          inkCost: Number(inkCost || 0),
          salaryCost: Number(salaryCost || 0),
          rentCost: Number(rentCost || 0),
          electricityCost: Number(electricityCost || 0),
          maintenanceCost: Number(maintenanceCost || 0),
          transportCost: Number(transportCost || 0),
          wastageCost: Number(wastageCost || 0),
          foodCost: Number(foodCost || 0),
          machineCost: Number(machineCost || 0),
          otherCost: Number(otherCost || 0),
          notes: String(notes || ''),
          updatedBy: req.user?.username || req.user?.name || 'Admin'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: 'Monthly overheads saved successfully.',
      overheads: updated
    });
  } catch (err) {
    logger.error('saveMonthlyOverheads error: %o', err);
    res.status(500).json({ error: 'Failed to save monthly overheads.' });
  }
};

module.exports = {
  getMonthlyCostingReport,
  saveMonthlyOverheads
};
