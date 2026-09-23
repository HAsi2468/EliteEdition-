const db = require('../db/models');
const {
  JobPrintLog,
  JobCard,
  RawMaterialTransaction,
  FabricChallan,
  BillingInvoice,
  Expense,
  Complaint
} = db;

// Helper to format Date to "YYYY-MM-DD"
function toYMD(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const getDailyOperationsSummary = async (req, res) => {
  try {
    let { dateStart, dateEnd, shift = 'All', companyEntity = 'Elite Digital Print' } = req.query;

    const todayStr = toYMD(new Date());

    if (!dateStart) dateStart = todayStr;
    if (!dateEnd) dateEnd = dateStart;

    const cleanStart = dateStart.split('T')[0];
    const cleanEnd = dateEnd.split('T')[0];

    // Build Date bounds for Date objects (00:00:00 to 23:59:59.999)
    const startDateObj = new Date(cleanStart + 'T00:00:00.000Z');
    const endDateObj = new Date(cleanEnd + 'T23:59:59.999Z');

    // Month start / end for monthly comparison
    const curYear = new Date(cleanStart).getFullYear();
    const curMonth = new Date(cleanStart).getMonth();
    const monthStartObj = new Date(Date.UTC(curYear, curMonth, 1, 0, 0, 0));
    const monthEndObj = new Date(Date.UTC(curYear, curMonth + 1, 0, 23, 59, 59, 999));
    const monthStartStr = toYMD(monthStartObj);
    const monthEndStr = toYMD(monthEndObj);

    // Entity matching array
    const entityAliases = [
      'Elite Digital Print',
      'Elite Digital Prints',
      'digital_print',
      'Digital Print'
    ];

    // Shift filter for JobPrintLog
    const shiftMatch = (shift && shift !== 'All') ? { shift } : {};

    // ──────────────────────────────────────────────────────────────────────────
    // 1. PRINTING PRODUCTION (JobPrintLog)
    // ──────────────────────────────────────────────────────────────────────────
    const printLogDateMatch = {
      date: { $gte: startDateObj, $lte: endDateObj },
      ...shiftMatch
    };

    const monthPrintLogMatch = {
      date: { $gte: monthStartObj, $lte: monthEndObj }
    };

    const [
      printingAgg,
      monthPrintingAgg,
      machineAgg,
      shiftAgg,
      operatorAgg,
      recentPrintLogs
    ] = await Promise.all([
      // Daily total printed meters & job count
      JobPrintLog.aggregate([
        { $match: printLogDateMatch },
        {
          $group: {
            _id: null,
            totalMeters: { $sum: '$meters' },
            jobsCount: { $sum: 1 }
          }
        }
      ]),

      // Monthly total printed meters
      JobPrintLog.aggregate([
        { $match: monthPrintLogMatch },
        {
          $group: {
            _id: null,
            monthMeters: { $sum: '$meters' },
            monthJobs: { $sum: 1 }
          }
        }
      ]),

      // Machine-wise breakdown
      JobPrintLog.aggregate([
        { $match: printLogDateMatch },
        {
          $group: {
            _id: '$machineName',
            meters: { $sum: '$meters' },
            jobsCount: { $sum: 1 }
          }
        },
        { $sort: { meters: -1 } }
      ]),

      // Shift-wise breakdown (Morning vs Night)
      JobPrintLog.aggregate([
        { $match: { date: { $gte: startDateObj, $lte: endDateObj } } },
        {
          $group: {
            _id: '$shift',
            meters: { $sum: '$meters' },
            jobsCount: { $sum: 1 }
          }
        }
      ]),

      // Operator Leaderboard
      JobPrintLog.aggregate([
        { $match: printLogDateMatch },
        {
          $group: {
            _id: '$operatorName',
            meters: { $sum: '$meters' },
            jobsCount: { $sum: 1 }
          }
        },
        { $sort: { meters: -1 } },
        { $limit: 10 }
      ]),

      // Recent 6 print logs
      JobPrintLog.find(printLogDateMatch)
        .sort({ createdAt: -1 })
        .limit(6)
        .lean()
    ]);

    const dailyPrintedMeters = printingAgg[0]?.totalMeters || 0;
    const dailyPrintedJobs = printingAgg[0]?.jobsCount || 0;
    const monthPrintedMeters = monthPrintingAgg[0]?.monthMeters || 0;

    // ──────────────────────────────────────────────────────────────────────────
    // 2. FUSING PRODUCTION & BACKLOG (JobCard)
    // ──────────────────────────────────────────────────────────────────────────
    // Fused today: fusingStatus = 'Fusing Done' and fusingDate within cleanStart..cleanEnd
    const [fusedTodayAgg, fusingPendingAgg] = await Promise.all([
      JobCard.aggregate([
        {
          $match: {
            department: 'digital_print',
            fusingStatus: 'Fusing Done',
            fusingDate: { $gte: cleanStart, $lte: cleanEnd }
          }
        },
        {
          $group: {
            _id: '$fusingMachine',
            meters: {
              $sum: {
                $cond: [
                  { $gt: [{ $toDouble: '$fusingMtr' }, 0] },
                  { $toDouble: '$fusingMtr' },
                  { $toDouble: '$totalMtr' }
                ]
              }
            },
            cardsCount: { $sum: 1 }
          }
        }
      ]),

      // Fusing Queue / Backlog: printed done but fusing pending
      JobCard.aggregate([
        {
          $match: {
            department: 'digital_print',
            printStatus: 'Printing Done',
            fusingStatus: 'Fusing Pending'
          }
        },
        {
          $group: {
            _id: null,
            pendingMeters: {
              $sum: {
                $cond: [
                  { $gt: [{ $toDouble: '$totalMtr' }, 0] },
                  { $toDouble: '$totalMtr' },
                  0
                ]
              }
            },
            pendingCards: { $sum: 1 }
          }
        }
      ])
    ]);

    const dailyFusedMeters = fusedTodayAgg.reduce((acc, curr) => acc + (curr.meters || 0), 0);
    const dailyFusedCards = fusedTodayAgg.reduce((acc, curr) => acc + (curr.cardsCount || 0), 0);
    const pendingFusingMeters = fusingPendingAgg[0]?.pendingMeters || 0;
    const pendingFusingCards = fusingPendingAgg[0]?.pendingCards || 0;

    // ──────────────────────────────────────────────────────────────────────────
    // 3. JOB CARDS ACTIVE PIPELINE
    // ──────────────────────────────────────────────────────────────────────────
    const [pipelineAgg, todayCreatedJobCards] = await Promise.all([
      JobCard.aggregate([
        { $match: { department: 'digital_print' } },
        {
          $group: {
            _id: {
              printStatus: '$printStatus',
              fusingStatus: '$fusingStatus',
              deliveryStatus: '$deliveryStatus'
            },
            count: { $sum: 1 },
            meters: {
              $sum: {
                $cond: [
                  { $gt: [{ $toDouble: '$totalMtr' }, 0] },
                  { $toDouble: '$totalMtr' },
                  0
                ]
              }
            }
          }
        }
      ]),

      // Today's created job cards
      JobCard.aggregate([
        {
          $match: {
            department: 'digital_print',
            date: { $gte: cleanStart, $lte: cleanEnd }
          }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            meters: {
              $sum: {
                $cond: [
                  { $gt: [{ $toDouble: '$totalMtr' }, 0] },
                  { $toDouble: '$totalMtr' },
                  0
                ]
              }
            }
          }
        }
      ])
    ]);

    // Compute stage buckets
    let pendingPrintCount = 0, pendingPrintMtr = 0;
    let printingDoneCount = 0, printingDoneMtr = 0;
    let fusingDoneCount = 0, fusingDoneMtr = 0;
    let deliveredCount = 0, deliveredMtr = 0;

    pipelineAgg.forEach(item => {
      const { printStatus, fusingStatus, deliveryStatus } = item._id;
      const count = item.count || 0;
      const mtr = item.meters || 0;

      if (deliveryStatus === 'Delivery Done') {
        deliveredCount += count;
        deliveredMtr += mtr;
      } else if (fusingStatus === 'Fusing Done') {
        fusingDoneCount += count;
        fusingDoneMtr += mtr;
      } else if (printStatus === 'Printing Done') {
        printingDoneCount += count;
        printingDoneMtr += mtr;
      } else {
        pendingPrintCount += count;
        pendingPrintMtr += mtr;
      }
    });

    const pipeline = {
      pending: { label: 'Printing Pending', count: pendingPrintCount, meters: Math.round(pendingPrintMtr) },
      inFusing: { label: 'Fusing Pending', count: printingDoneCount, meters: Math.round(printingDoneMtr) },
      readyForDelivery: { label: 'Ready for Dispatch', count: fusingDoneCount, meters: Math.round(fusingDoneMtr) },
      delivered: { label: 'Dispatched / Delivered', count: deliveredCount, meters: Math.round(deliveredMtr) },
      todayCreated: {
        count: todayCreatedJobCards[0]?.count || 0,
        meters: Math.round(todayCreatedJobCards[0]?.meters || 0)
      }
    };

    // ──────────────────────────────────────────────────────────────────────────
    // 4. INK & RAW MATERIALS HEALTH (Liters & Rolls)
    // ──────────────────────────────────────────────────────────────────────────
    // Compute lifetime balance of all inks and paper, plus today's inward and outward
    const [rawStockAgg, todayRawActivity] = await Promise.all([
      RawMaterialTransaction.aggregate([
        {
          $group: {
            _id: {
              materialName: '$materialName',
              color: '$color'
            },
            inwardQty: {
              $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] }
            },
            outwardQty: {
              $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] }
            },
            unit: { $first: '$unit' }
          }
        }
      ]),

      RawMaterialTransaction.aggregate([
        {
          $match: {
            date: { $gte: startDateObj, $lte: endDateObj }
          }
        },
        {
          $group: {
            _id: {
              type: '$type',
              color: '$color'
            },
            totalQty: { $sum: '$qty' }
          }
        }
      ])
    ]);

    // Map ink stock levels
    const inkStock = {
      grando: { C: 0, M: 0, Y: 0, K: 0, CS: 0 },
      printdot: { C: 0, M: 0, Y: 0, K: 0 },
      paperRolls: 0
    };

    rawStockAgg.forEach(row => {
      const mat = (row._id.materialName || '').toLowerCase();
      const col = (row._id.color || '').toUpperCase();
      const net = (row.inwardQty || 0) - (row.outwardQty || 0);

      if (mat.includes('grando')) {
        if (col === 'C' || col.includes('CYAN')) inkStock.grando.C += net;
        else if (col === 'M' || col.includes('MAGENTA')) inkStock.grando.M += net;
        else if (col === 'Y' || col.includes('YELLOW')) inkStock.grando.Y += net;
        else if (col === 'K' || col.includes('BLACK')) inkStock.grando.K += net;
        else if (mat.includes('cleaning') || col.includes('C.S')) inkStock.grando.CS += net;
      } else if (mat.includes('printdot')) {
        if (col === 'C' || col.includes('CYAN')) inkStock.printdot.C += net;
        else if (col === 'M' || col.includes('MAGENTA')) inkStock.printdot.M += net;
        else if (col === 'Y' || col.includes('YELLOW')) inkStock.printdot.Y += net;
        else if (col === 'K' || col.includes('BLACK')) inkStock.printdot.K += net;
      } else if (mat.includes('paper') || mat.includes('sublimation') || mat.includes('butter')) {
        inkStock.paperRolls += net;
      }
    });

    // Round values to 2 decimals
    ['C', 'M', 'Y', 'K', 'CS'].forEach(k => {
      if (inkStock.grando[k] !== undefined) inkStock.grando[k] = Math.max(0, Number(inkStock.grando[k].toFixed(2)));
      if (inkStock.printdot[k] !== undefined) inkStock.printdot[k] = Math.max(0, Number(inkStock.printdot[k].toFixed(2)));
    });
    inkStock.paperRolls = Math.max(0, Math.round(inkStock.paperRolls));

    let todayInkConsumed = 0;
    let todayInkInward = 0;
    todayRawActivity.forEach(a => {
      if (a._id.type === 'OUTWARD') todayInkConsumed += a.totalQty || 0;
      if (a._id.type === 'INWARD') todayInkInward += a.totalQty || 0;
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 5. FABRIC MANAGEMENT
    // ──────────────────────────────────────────────────────────────────────────
    const [fabricActivityAgg] = await Promise.all([
      FabricChallan.aggregate([
        {
          $match: {
            date: { $gte: startDateObj, $lte: endDateObj }
          }
        },
        {
          $group: {
            _id: '$direction',
            totalMeters: { $sum: '$totalMeters' },
            totalRolls: { $sum: '$totalRolls' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    let fabricInwardToday = 0, fabricInwardRollsToday = 0;
    let fabricIssuedToday = 0, fabricIssuedRollsToday = 0;
    fabricActivityAgg.forEach(row => {
      if (row._id === 'INWARD') {
        fabricInwardToday = row.totalMeters || 0;
        fabricInwardRollsToday = row.totalRolls || 0;
      } else if (row._id === 'OUTWARD') {
        fabricIssuedToday = row.totalMeters || 0;
        fabricIssuedRollsToday = row.totalRolls || 0;
      }
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 6. FINANCIAL SNAPSHOT (Today & This Month)
    // ──────────────────────────────────────────────────────────────────────────
    const [
      todayInvoiceAgg,
      monthInvoiceAgg,
      todayExpenseAgg,
      monthExpenseAgg
    ] = await Promise.all([
      // Today Billed Invoices
      BillingInvoice.aggregate([
        {
          $match: {
            companyEntity: { $in: entityAliases },
            date: { $gte: startDateObj, $lte: endDateObj }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$grandTotal' },
            totalTaxable: { $sum: '$subtotal' },
            totalMeters: { $sum: '$meters' },
            count: { $sum: 1 }
          }
        }
      ]),

      // Month Billed Invoices
      BillingInvoice.aggregate([
        {
          $match: {
            companyEntity: { $in: entityAliases },
            date: { $gte: monthStartObj, $lte: monthEndObj }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$grandTotal' },
            totalTaxable: { $sum: '$subtotal' },
            count: { $sum: 1 }
          }
        }
      ]),

      // Today Expenses
      Expense.aggregate([
        {
          $match: {
            companyEntity: { $in: entityAliases },
            date: { $gte: startDateObj, $lte: endDateObj }
          }
        },
        {
          $group: {
            _id: null,
            totalExpense: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]),

      // Month Expenses
      Expense.aggregate([
        {
          $match: {
            companyEntity: { $in: entityAliases },
            date: { $gte: monthStartObj, $lte: monthEndObj }
          }
        },
        {
          $group: {
            _id: null,
            totalExpense: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const todayBilledRev = todayInvoiceAgg[0]?.totalRevenue || 0;
    const todayBilledCount = todayInvoiceAgg[0]?.count || 0;
    const todayBilledMeters = todayInvoiceAgg[0]?.totalMeters || 0;

    const monthBilledRev = monthInvoiceAgg[0]?.totalRevenue || 0;
    const monthBilledCount = monthInvoiceAgg[0]?.count || 0;

    const todayExp = todayExpenseAgg[0]?.totalExpense || 0;
    const monthExp = monthExpenseAgg[0]?.totalExpense || 0;

    const todayNet = todayBilledRev - todayExp;
    const monthNet = monthBilledRev - monthExp;

    const financialPulse = {
      today: {
        billedRevenue: todayBilledRev,
        billedCount: todayBilledCount,
        billedMeters: Math.round(todayBilledMeters),
        expenses: todayExp,
        netProfitOrLoss: todayNet,
        isPlus: todayNet >= 0
      },
      month: {
        billedRevenue: monthBilledRev,
        billedCount: monthBilledCount,
        expenses: monthExp,
        netProfitOrLoss: monthNet,
        isPlus: monthNet >= 0,
        marginPct: monthBilledRev > 0 ? Number(((monthNet / monthBilledRev) * 100).toFixed(1)) : 0
      }
    };

    // ──────────────────────────────────────────────────────────────────────────
    // 7. COMPLAINTS & QUALITY
    // ──────────────────────────────────────────────────────────────────────────
    const [complaintsAgg] = await Promise.all([
      Complaint.aggregate([
        { $match: { companyEntity: { $in: entityAliases } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    let openComplaints = 0, resolvedComplaints = 0;
    complaintsAgg.forEach(c => {
      if (c._id === 'Resolved' || c._id === 'Closed') resolvedComplaints += c.count || 0;
      else openComplaints += c.count || 0;
    });

    // ──────────────────────────────────────────────────────────────────────────
    // RESPONSE PAYLOAD
    // ──────────────────────────────────────────────────────────────────────────
    return res.json({
      success: true,
      query: {
        dateStart: cleanStart,
        dateEnd: cleanEnd,
        shift,
        companyEntity
      },
      summary: {
        // High level KPI cards
        dailyPrintedMeters: Math.round(dailyPrintedMeters * 100) / 100,
        dailyPrintedJobs,
        monthPrintedMeters: Math.round(monthPrintedMeters * 100) / 100,
        dailyFusedMeters: Math.round(dailyFusedMeters * 100) / 100,
        pendingFusingMeters: Math.round(pendingFusingMeters * 100) / 100,
        pendingFusingCards,
        todayBilledRevenue: todayBilledRev,
        todayBilledCount,
        todayExpenses: todayExp,
        todayNetProfit: todayNet,
        isTodayPlus: todayNet >= 0,
        monthBilledRevenue: monthBilledRev,
        monthNetProfit: monthNet,
        openComplaints
      },
      printing: {
        dailyPrintedMeters,
        dailyPrintedJobs,
        machineBreakdown: machineAgg.map(m => ({
          machineName: m._id || 'Unknown Machine',
          meters: Math.round(m.meters * 100) / 100,
          jobsCount: m.jobsCount,
          pct: dailyPrintedMeters > 0 ? Math.round((m.meters / dailyPrintedMeters) * 100) : 0
        })),
        shiftBreakdown: shiftAgg.map(s => ({
          shift: s._id || 'Standard',
          meters: Math.round(s.meters * 100) / 100,
          jobsCount: s.jobsCount
        })),
        operatorLeaderboard: operatorAgg.map(o => ({
          operatorName: o._id || 'Unassigned',
          meters: Math.round(o.meters * 100) / 100,
          jobsCount: o.jobsCount
        })),
        recentLogs: recentPrintLogs
      },
      fusing: {
        dailyFusedMeters,
        dailyFusedCards,
        pendingFusingMeters,
        pendingFusingCards,
        machineBreakdown: fusedTodayAgg.map(f => ({
          machineName: f._id || 'Fusing Machine',
          meters: Math.round(f.meters * 100) / 100,
          cardsCount: f.cardsCount
        }))
      },
      pipeline,
      rawMaterials: {
        inkStock,
        todayInkConsumed: Math.round(todayInkConsumed * 100) / 100,
        todayInkInward: Math.round(todayInkInward * 100) / 100
      },
      fabric: {
        inwardMetersToday: fabricInwardToday,
        inwardRollsToday: fabricInwardRollsToday,
        issuedMetersToday: fabricIssuedToday,
        issuedRollsToday: fabricIssuedRollsToday
      },
      financialPulse,
      quality: {
        openComplaints,
        resolvedComplaints
      }
    });
  } catch (err) {
    console.error('digitalPrintDashboard error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error fetching operations summary'
    });
  }
};

module.exports = {
  getDailyOperationsSummary
};
