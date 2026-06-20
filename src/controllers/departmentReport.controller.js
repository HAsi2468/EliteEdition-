const { JobCard, Design } = require('../db/models');

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
    // Theoretical consumption = pcs * consumption
    // Compare with printMtr
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
    // Time difference between target expTime and actual deliveryDate grouped by status
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

    res.json({
      success: true,
      data: {
        designerCreativeOutput,
        colorMatchingEfficiency,
        machineMeterage,
        fusingThroughput,
        fabricConsumptionVariance,
        deadlineAdherence
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
