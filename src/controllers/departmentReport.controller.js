const { JobCard, Design, RawMaterialTransaction, JobPrintLog } = require('../db/models');
const FabricTransaction = require('../db/models/fabricTransaction.model');

/**
 * GET /api/reports/elite-print
 * Aggregation reports for the Elite Digital Print department
 */
const getElitePrintReports = async (req, res) => {
  try {
    const { dateStart, dateEnd } = req.query;

    const cleanDateStart = dateStart ? dateStart.split('T')[0] : '';
    const cleanDateEnd = dateEnd ? dateEnd.split('T')[0] : '';

    // Match stage for JobCard (which uses String format "YYYY-MM-DD" for `date`)
    const matchStage = {};
    if (cleanDateStart || cleanDateEnd) {
      matchStage.date = {};
      if (cleanDateStart) matchStage.date.$gte = cleanDateStart;
      if (cleanDateEnd) matchStage.date.$lte = cleanDateEnd;
    }

    // Match stage for JobPrintLog
    const logDateMatch = {};
    if (dateStart || dateEnd) {
      logDateMatch.date = {};
      if (dateStart) logDateMatch.date.$gte = new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setHours(23, 59, 59, 999);
        logDateMatch.date.$lte = end;
      }
    }

    // Match stage for Design (which uses Date object `created_date_time`)
    const designMatchStage = {};
    if (dateStart || dateEnd) {
      designMatchStage.created_date_time = {};
      const hasTime = (str) => /T|\s|:/.test(str);
      if (dateStart) {
        designMatchStage.created_date_time.$gte = hasTime(dateStart) ? new Date(dateStart) : new Date(dateStart + "T00:00:00.000Z");
      }
      if (dateEnd) {
        designMatchStage.created_date_time.$lte = hasTime(dateEnd) ? new Date(dateEnd) : new Date(dateEnd + "T23:59:59.999Z");
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

    // 3. Machine Speed & Meterage Report (from JobPrintLog & JobCard)
    let machineMeterage = await JobPrintLog.aggregate([
      { $match: logDateMatch },
      {
        $group: {
          _id: {
            machineName: "$machineName",
            pass: "$pass"
          },
          totalMtr: { $sum: "$meters" },
          uniqueJobNos: { $addToSet: "$jobNo" }
        }
      },
      {
        $project: {
          _id: 1,
          totalMtr: 1,
          totalJobs: { $size: "$uniqueJobNos" }
        }
      },
      { $sort: { totalMtr: -1 } }
    ]);

    if (machineMeterage.length === 0) {
      machineMeterage = await JobCard.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              machineName: "$machineName",
              speed: "$speed",
              pass: "$pass"
            },
            totalMtr: { $sum: { $convert: { input: "$printMtr", to: "double", onError: 0, onNull: 0 } } },
            totalJobs: { $sum: 1 }
          }
        },
        { $sort: { totalMtr: -1 } }
      ]);
    }

    // 4. Fusing Operator Throughput
    const fusingMatchStage = { fusingStatus: "Fusing Done" };
    if (cleanDateStart || cleanDateEnd) {
      fusingMatchStage.fusingDate = {};
      if (cleanDateStart) fusingMatchStage.fusingDate.$gte = cleanDateStart;
      if (cleanDateEnd) fusingMatchStage.fusingDate.$lte = cleanDateEnd;
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
    if (cleanDateStart || cleanDateEnd) {
      deliveryMatchStage.deliveryDate = {};
      if (cleanDateStart) deliveryMatchStage.deliveryDate.$gte = cleanDateStart;
      if (cleanDateEnd) deliveryMatchStage.deliveryDate.$lte = cleanDateEnd;
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

const downloadElitePrintPdf = async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const { dateStart, dateEnd } = req.query;

    const cleanDateStart = dateStart ? dateStart.split('T')[0] : '';
    const cleanDateEnd = dateEnd ? dateEnd.split('T')[0] : '';

    const matchStage = {};
    if (cleanDateStart || cleanDateEnd) {
      matchStage.date = {};
      if (cleanDateStart) matchStage.date.$gte = cleanDateStart;
      if (cleanDateEnd) matchStage.date.$lte = cleanDateEnd;
    }

    const logDateMatch = {};
    if (dateStart || dateEnd) {
      logDateMatch.date = {};
      if (dateStart) logDateMatch.date.$gte = new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setHours(23, 59, 59, 999);
        logDateMatch.date.$lte = end;
      }
    }

    let machineMeterage = await JobPrintLog.aggregate([
      { $match: logDateMatch },
      {
        $group: {
          _id: { machineName: "$machineName", pass: "$pass" },
          totalMtr: { $sum: "$meters" },
          uniqueJobNos: { $addToSet: "$jobNo" }
        }
      },
      {
        $project: {
          _id: 1,
          totalMtr: 1,
          totalJobs: { $size: "$uniqueJobNos" }
        }
      },
      { $sort: { totalMtr: -1 } }
    ]);

    if (machineMeterage.length === 0) {
      machineMeterage = await JobCard.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: { machineName: "$machineName", pass: "$pass" },
            totalMtr: { $sum: { $convert: { input: "$printMtr", to: "double", onError: 0, onNull: 0 } } },
            totalJobs: { $sum: 1 }
          }
        },
        { $sort: { totalMtr: -1 } }
      ]);
    }

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
      { $limit: 10 }
    ]);

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
      { $limit: 10 }
    ]);

    const fabricTrends = await JobCard.aggregate([
      { $match: { ...matchStage, fabric: { $exists: true, $ne: "" } } },
      {
        $group: {
          _id: "$fabric",
          totalMtr: { $sum: { $convert: { input: "$printMtr", to: "double", onError: 0, onNull: 0 } } },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalMtr: -1 } },
      { $limit: 10 }
    ]);

    const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Elite_Print_Report_${cleanDateStart || 'all'}_to_${cleanDateEnd || 'all'}.pdf"`);
    doc.pipe(res);

    doc.rect(30, 30, 535, 45).fill('#0f172a');
    doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold')
      .text('ELITE DIGITAL PRINTS — DEPARTMENT REPORT', 30, 42, { width: 535, align: 'center' });
    
    let subtitle = 'Period: All Time';
    if (cleanDateStart && cleanDateEnd) subtitle = `Period: ${cleanDateStart} to ${cleanDateEnd}`;
    else if (cleanDateStart) subtitle = `Period: From ${cleanDateStart}`;
    else if (cleanDateEnd) subtitle = `Period: Until ${cleanDateEnd}`;
    
    doc.fillColor('#94a3b8').fontSize(9).font('Helvetica')
      .text(subtitle, 30, 60, { width: 535, align: 'center' });

    let y = 90;

    const totalPrintedMtr = machineMeterage.reduce((sum, item) => sum + item.totalMtr, 0);
    const totalJobsCount = machineMeterage.reduce((sum, item) => sum + item.totalJobs, 0);

    doc.rect(30, y, 160, 45).fill('#f8fafc').stroke('#cbd5e1');
    doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold').text('TOTAL JOBS PROCESSED', 35, y + 8);
    doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text(String(totalJobsCount), 35, y + 22);

    doc.rect(205, y, 160, 45).fill('#f8fafc').stroke('#cbd5e1');
    doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold').text('TOTAL METRES PRINTED', 210, y + 8);
    doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text(`${totalPrintedMtr.toLocaleString('en-IN')} m`, 210, y + 22);

    doc.rect(380, y, 185, 45).fill('#f8fafc').stroke('#cbd5e1');
    doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold').text('TOP FABRIC DEMAND', 385, y + 8);
    doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text(fabricTrends[0] ? fabricTrends[0]._id : 'N/A', 385, y + 24, { width: 175, lineBreak: false });

    y += 60;

    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('1. MACHINE METERAGE & PRODUCTION OUTPUT', 30, y);
    y += 15;

    doc.rect(30, y, 535, 20).fill('#1e293b');
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
    doc.text('MACHINE NAME', 35, y + 6);
    doc.text('PASS / CONFIG', 200, y + 6);
    doc.text('JOB CARDS COUNT', 340, y + 6);
    doc.text('TOTAL METERAGE (m)', 450, y + 6);
    y += 20;

    machineMeterage.forEach((row, i) => {
      if (y > 750) { doc.addPage(); y = 40; }
      doc.rect(30, y, 535, 18).fill(i % 2 === 0 ? '#f1f5f9' : '#ffffff');
      doc.fillColor('#334155').fontSize(8).font('Helvetica');
      doc.text(row._id.machineName || '—', 35, y + 5);
      doc.text(row._id.pass || '—', 200, y + 5);
      doc.text(String(row.totalJobs), 340, y + 5);
      doc.text(row.totalMtr.toLocaleString('en-IN') + ' m', 450, y + 5);
      y += 18;
    });

    y += 15;
    if (y > 700) { doc.addPage(); y = 40; }

    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('2. TOP DESIGNS BY PRINT VOLUME', 30, y);
    y += 15;

    doc.rect(30, y, 535, 20).fill('#1e293b');
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
    doc.text('RANK / DESIGN NAME', 35, y + 6);
    doc.text('TOTAL JOBS', 300, y + 6);
    doc.text('TOTAL METRES (m)', 430, y + 6);
    y += 20;

    topDesigns.forEach((row, i) => {
      if (y > 750) { doc.addPage(); y = 40; }
      doc.rect(30, y, 535, 18).fill(i % 2 === 0 ? '#f1f5f9' : '#ffffff');
      doc.fillColor('#334155').fontSize(8).font('Helvetica');
      doc.text(`#${i+1}  ${row._id}`, 35, y + 5);
      doc.text(String(row.count), 300, y + 5);
      doc.text(row.totalMtr.toLocaleString('en-IN') + ' m', 430, y + 5);
      y += 18;
    });

    y += 15;
    if (y > 700) { doc.addPage(); y = 40; }

    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('3. PARTY WISE PRODUCTION & FABRIC TRENDS', 30, y);
    y += 15;

    doc.rect(30, y, 535, 20).fill('#1e293b');
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
    doc.text('PARTY NAME', 35, y + 6);
    doc.text('JOBS COUNT', 220, y + 6);
    doc.text('METRES (m)', 320, y + 6);
    doc.text('TOP FABRIC DEMAND', 420, y + 6);
    y += 20;

    busiestParties.forEach((party, i) => {
      if (y > 750) { doc.addPage(); y = 40; }
      const matchingFabric = fabricTrends[i] ? fabricTrends[i]._id : '—';
      doc.rect(30, y, 535, 18).fill(i % 2 === 0 ? '#f1f5f9' : '#ffffff');
      doc.fillColor('#334155').fontSize(8).font('Helvetica');
      doc.text(party._id, 35, y + 5);
      doc.text(String(party.count), 220, y + 5);
      doc.text(party.totalMtr.toLocaleString('en-IN') + ' m', 320, y + 5);
      doc.text(matchingFabric, 420, y + 5);
      y += 18;
    });

    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
        .text(`Page ${i + 1} of ${pages.count} — Elite Digital Prints Department Report`, 30, 815, { width: 535, align: 'center' });
    }

    doc.end();
  } catch (err) {
    console.error('Error generating Elite Print PDF report:', err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = {
  getElitePrintReports,
  downloadElitePrintPdf,
};
