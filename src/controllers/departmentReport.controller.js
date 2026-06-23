const { JobCard, Design, RawMaterialTransaction } = require('../db/models');
const FabricTransaction = require('../db/models/fabricTransaction.model');

/**
 * GET /api/reports/elite-print
 * Aggregation reports for the Elite Digital Print department
 */
const getElitePrintReports = async (req, res) => {
  try {
    const { dateStart, dateEnd } = req.query;

    // Match stage for JobCard (which uses String format "YYYY-MM-DD" for `date`)
    const matchStage = {};
    if (dateStart || dateEnd) {
      matchStage.date = {};
      if (dateStart) matchStage.date.$gte = dateStart;
      if (dateEnd) matchStage.date.$lte = dateEnd;
    }

    // Match stage for Design (which uses Date object `created_date_time`)
    const designMatchStage = {};
    if (dateStart || dateEnd) {
      designMatchStage.created_date_time = {};
      if (dateStart) {
        designMatchStage.created_date_time.$gte = new Date(dateStart + "T00:00:00.000Z");
      }
      if (dateEnd) {
        designMatchStage.created_date_time.$lte = new Date(dateEnd + "T23:59:59.999Z");
      }
    }

    // 1. Designer Creative Output Report (from Design Collection)
    const designerCreativeOutput = await Design.aggregate([
      { $match: { ...designMatchStage, designerName: { $exists: true, $ne: "" } } },
      { $group: { _id: "$designerName", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // 2. Color Matching Efficiency Log (from Design Collection)
    const colorMatchingEfficiency = await Design.aggregate([
      { $match: { ...designMatchStage, colourMatching: { $exists: true, $ne: "" } } },
      { $group: { _id: "$colourMatching", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // 3. Machine Speed & Meterage Report (from JobCard Collection)
    const machineMeterage = await JobCard.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            machineName: "$machineName",
            speed: "$speed",
            pass: "$pass"
          },
          totalMtr: { $sum: { $convert: { input: "$printMtr", to: "double", onError: 0, onNull: 0 } } }
        }
      },
      { $sort: { totalMtr: -1 } }
    ]);

    // 4. Fusing Operator Throughput
    const fusingMatchStage = { fusingStatus: "Fusing Done" };
    if (dateStart || dateEnd) {
      fusingMatchStage.fusingDate = {};
      if (dateStart) fusingMatchStage.fusingDate.$gte = dateStart;
      if (dateEnd) fusingMatchStage.fusingDate.$lte = dateEnd;
    }
    const fusingThroughput = await JobCard.aggregate([
      { $match: fusingMatchStage },
      {
        $group: {
          _id: "$fusingDate",
          completedCount: { $sum: 1 },
          totalFusingMtr: { $sum: { $convert: { input: "$fusingMtr", to: "double", onError: 0, onNull: 0 } } }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    // 5. Fabric Consumption Variance
    const fabricConsumptionVariance = await JobCard.aggregate([
      { $match: matchStage },
      {
        $project: {
          jobNo: 1,
          pcs: 1,
          consumption: 1,
          printMtr: 1,
          theoreticalMtr: { $multiply: [{ $convert: { input: "$pcs", to: "double", onError: 0, onNull: 0 } }, { $convert: { input: "$consumption", to: "double", onError: 0, onNull: 0 } }] },
          actualMtr: { $convert: { input: "$printMtr", to: "double", onError: 0, onNull: 0 } }
        }
      },
      {
        $project: {
          jobNo: 1,
          theoreticalMtr: 1,
          actualMtr: 1,
          variance: { $subtract: ["$actualMtr", "$theoreticalMtr"] }
        }
      },
      { $sort: { variance: -1 } },
      { $limit: 100 }
    ]);

    // 6. Production Deadline Adherence
    const deliveryMatchStage = { deliveryDate: { $exists: true, $ne: "" } };
    if (dateStart || dateEnd) {
      deliveryMatchStage.deliveryDate = {};
      if (dateStart) deliveryMatchStage.deliveryDate.$gte = dateStart;
      if (dateEnd) deliveryMatchStage.deliveryDate.$lte = dateEnd;
    }
    const deadlineAdherence = await JobCard.aggregate([
      { $match: deliveryMatchStage },
      {
        $group: {
          _id: "$status",
          avgExpectedTime: { $avg: { $convert: { input: "$expTime", to: "double", onError: 0, onNull: 0 } } },
          totalJobs: { $sum: 1 }
        }
      }
    ]);

    // ─── NEW SMART INSIGHTS ───

    // 7. Top 5 Designs by printed volume
    const topDesigns = await JobCard.aggregate([
      { $match: { ...matchStage, designName: { $exists: true, $ne: "" } } },
      {
        $group: {
          _id: "$designName",
          totalMtr: { $sum: { $convert: { input: "$printMtr", to: "double", onError: 0, onNull: 0 } } },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalMtr: -1 } },
      { $limit: 5 }
    ]);

    // 8. Busiest Parties
    const busiestParties = await JobCard.aggregate([
      { $match: { ...matchStage, party: { $exists: true, $ne: "" } } },
      {
        $group: {
          _id: "$party",
          totalMtr: { $sum: { $convert: { input: "$printMtr", to: "double", onError: 0, onNull: 0 } } },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalMtr: -1 } },
      { $limit: 5 }
    ]);

    // 9. Fabric Trends
    const fabricTrends = await JobCard.aggregate([
      { $match: { ...matchStage, fabric: { $exists: true, $ne: "" } } },
      {
        $group: {
          _id: "$fabric",
          totalMtr: { $sum: { $convert: { input: "$printMtr", to: "double", onError: 0, onNull: 0 } } },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalMtr: -1 } }
    ]);

    // 10. Average print-to-delivery days
    const printToDelivery = await JobCard.aggregate([
      {
        $match: {
          ...matchStage,
          printDate: { $exists: true, $ne: "" },
          deliveryDate: { $exists: true, $ne: "" }
        }
      },
      {
        $project: {
          daysDiff: {
            $divide: [
              {
                $subtract: [
                  { $dateFromString: { dateString: "$deliveryDate" } },
                  { $dateFromString: { dateString: "$printDate" } }
                ]
              },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgDays: { $avg: "$daysDiff" },
          count: { $sum: 1 }
        }
      }
    ]);

    // 11. Bottleneck Stage Analysis
    const stageTimes = await JobCard.aggregate([
      { $match: matchStage },
      {
        $project: {
          dateObj: { $cond: { if: { $and: ["$date", { $ne: ["$date", ""] }] }, then: { $dateFromString: { dateString: "$date" } }, else: null } },
          printDateObj: { $cond: { if: { $and: ["$printDate", { $ne: ["$printDate", ""] }] }, then: { $dateFromString: { dateString: "$printDate" } }, else: null } },
          fusingDateObj: { $cond: { if: { $and: ["$fusingDate", { $ne: ["$fusingDate", ""] }] }, then: { $dateFromString: { dateString: "$fusingDate" } }, else: null } },
          deliveryDateObj: { $cond: { if: { $and: ["$deliveryDate", { $ne: ["$deliveryDate", ""] }] }, then: { $dateFromString: { dateString: "$deliveryDate" } }, else: null } },
        }
      },
      {
        $project: {
          printDuration: { $cond: { if: { $and: ["$dateObj", "$printDateObj"] }, then: { $subtract: ["$printDateObj", "$dateObj"] }, else: null } },
          fusingDuration: { $cond: { if: { $and: ["$printDateObj", "$fusingDateObj"] }, then: { $subtract: ["$fusingDateObj", "$printDateObj"] }, else: null } },
          deliveryDuration: { $cond: { if: { $and: ["$fusingDateObj", "$deliveryDateObj"] }, then: { $subtract: ["$deliveryDateObj", "$fusingDateObj"] }, else: null } },
        }
      },
      {
        $group: {
          _id: null,
          avgPrintHrs: { $avg: { $divide: ["$printDuration", 1000 * 60 * 60] } },
          avgFusingHrs: { $avg: { $divide: ["$fusingDuration", 1000 * 60 * 60] } },
          avgDeliveryHrs: { $avg: { $divide: ["$deliveryDuration", 1000 * 60 * 60] } },
        }
      }
    ]);
    const avgTimes = stageTimes[0] || {};
    const bottleneck = {
      avgPrintHrs: avgTimes.avgPrintHrs ? Number(avgTimes.avgPrintHrs.toFixed(1)) : 0,
      avgFusingHrs: avgTimes.avgFusingHrs ? Number(avgTimes.avgFusingHrs.toFixed(1)) : 0,
      avgDeliveryHrs: avgTimes.avgDeliveryHrs ? Number(avgTimes.avgDeliveryHrs.toFixed(1)) : 0
    };

    // Delayed Job Cards (not Done, older than 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
    const delayedCards = await JobCard.find({
      status: { $ne: "Done" },
      date: { $lte: sevenDaysAgoStr }
    }).select("jobNo designName party status date expTime").sort({ date: 1 }).limit(10).lean();

    // 12. Fabric Demand Forecasting
    const fabricStockPipeline = [
      {
        $group: {
          _id: '$fabricQuality',
          totalInward: { $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] } },
          totalOutward: { $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] } }
        }
      },
      {
        $project: {
          fabricQuality: '$_id',
          currentStock: { $subtract: ['$totalInward', '$totalOutward'] },
          _id: 0
        }
      }
    ];
    const fabricStockList = await FabricTransaction.aggregate(fabricStockPipeline);
    const fabricStockMap = {};
    fabricStockList.forEach(s => {
      fabricStockMap[s.fabricQuality] = s.currentStock;
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const fabricConsumption = await JobCard.aggregate([
      {
        $match: {
          printDate: { $gte: thirtyDaysAgoStr },
          printStatus: "Printing Done"
        }
      },
      {
        $group: {
          _id: "$fabric",
          totalMtr: { $sum: { $convert: { input: "$printMtr", to: "double", onError: 0, onNull: 0 } } }
        }
      }
    ]);

    const fabricForecasts = fabricConsumption.map(fc => {
      const dailyAvg = fc.totalMtr / 30;
      const currentStock = fabricStockMap[fc._id] || 0;
      const demand7Days = dailyAvg * 7;
      const demand30Days = dailyAvg * 30;
      const status = currentStock >= demand7Days ? 'Safe' : 'Shortage';
      return {
        fabricQuality: fc._id,
        currentStock: Number(currentStock.toFixed(1)),
        demand7Days: Number(demand7Days.toFixed(1)),
        demand30Days: Number(demand30Days.toFixed(1)),
        status
      };
    });

    const forecastFabrics = new Set(fabricForecasts.map(f => f.fabricQuality));
    fabricStockList.forEach(s => {
      if (!forecastFabrics.has(s.fabricQuality)) {
        fabricForecasts.push({
          fabricQuality: s.fabricQuality,
          currentStock: Number(s.currentStock.toFixed(1)),
          demand7Days: 0,
          demand30Days: 0,
          status: 'Safe'
        });
      }
    });

    // 13. Low Stock Alerts
    const rawMaterialStockPipeline = [
      {
        $group: {
          _id: {
            materialName: '$materialName',
            panna: '$panna',
            paperQuality: '$paperQuality',
            color: '$color',
            canSize: '$canSize',
            metersPerRoll: '$metersPerRoll'
          },
          totalInward: { $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] } },
          totalOutward: { $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] } },
          unit: { $first: '$unit' }
        }
      },
      {
        $project: {
          materialName: '$_id.materialName',
          panna: '$_id.panna',
          paperQuality: '$_id.paperQuality',
          color: '$_id.color',
          canSize: '$_id.canSize',
          metersPerRoll: '$_id.metersPerRoll',
          currentStock: { $subtract: ['$totalInward', '$totalOutward'] },
          unit: 1,
          _id: 0
        }
      }
    ];
    const rawMaterialStockList = await RawMaterialTransaction.aggregate(rawMaterialStockPipeline);

    const lowStockFabrics = fabricStockList
      .filter(s => s.currentStock <= 5)
      .map(s => ({ item: s.fabricQuality, type: 'Fabric', qty: Number(s.currentStock.toFixed(1)), unit: 'mtr' }));

    const lowStockRawMaterials = rawMaterialStockList
      .filter(s => s.currentStock <= 5)
      .map(s => {
        const details = [];
        const nameLower = (s.materialName || '').toLowerCase();
        if (nameLower.includes('sublimation')) {
          if (s.panna) details.push(`Panna: ${s.panna}`);
          if (s.paperQuality) details.push(`Qual: ${s.paperQuality}`);
          if (s.metersPerRoll) details.push(`${s.metersPerRoll}m`);
        } else if (nameLower.includes('butter')) {
          if (s.panna) details.push(`Panna: ${s.panna}`);
          if (s.metersPerRoll) details.push(`${s.metersPerRoll}m`);
        } else if (nameLower.includes('ink')) {
          if (s.color) details.push(s.color);
          if (s.canSize) details.push(`${s.canSize} Ltr`);
        }
        const formattedName = details.length > 0 ? `${s.materialName} (${details.join(', ')})` : s.materialName;
        return { item: formattedName, type: 'Raw Material', qty: Number(s.currentStock.toFixed(1)), unit: s.unit || 'rolls' };
      });

    const lowStockAlerts = [...lowStockFabrics, ...lowStockRawMaterials];

    res.json({
      success: true,
      data: {
        designerCreativeOutput,
        colorMatchingEfficiency,
        machineMeterage,
        fusingThroughput,
        fabricConsumptionVariance,
        deadlineAdherence,
        
        // Smart metrics
        topDesigns,
        busiestParties,
        fabricTrends,
        avgPrintToDelivery: printToDelivery[0] ? Number(printToDelivery[0].avgDays.toFixed(1)) : 0,
        bottleneck,
        delayedCards,
        fabricForecasts,
        lowStockAlerts
      }
    });

  } catch (error) {
    console.error('Error fetching elite print reports:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = {
  getElitePrintReports,
};
