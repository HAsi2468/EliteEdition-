const FabricTransaction = require('../db/models/fabricTransaction.model');

// Create a new INWARD transaction
const createInward = async (req, res) => {
  try {
    const { challanNo, vendorName, fabricQuality, panna, qty, date, notes } = req.body;
    
    if (!fabricQuality || qty == null || qty < 0) {
      return res.status(400).json({ success: false, error: 'Fabric Quality and a valid Quantity are required.' });
    }

    const transaction = new FabricTransaction({
      type: 'INWARD',
      challanNo,
      vendorName,
      fabricQuality,
      panna,
      qty,
      date: date ? new Date(date) : new Date(),
      notes
    });

    await transaction.save();
    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    console.error('Error creating inward fabric transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create a new OUTWARD transaction
const createOutward = async (req, res) => {
  try {
    const { jobNo, partyName, fabricQuality, panna, lotNo, qty, date, notes } = req.body;
    
    if (!fabricQuality || qty == null || qty <= 0) {
      return res.status(400).json({ success: false, error: 'Fabric Quality and a valid Quantity (>0) are required.' });
    }

    const transaction = new FabricTransaction({
      type: 'OUTWARD',
      jobNo,
      partyName,
      fabricQuality,
      panna,
      lotNo: lotNo ? Number(lotNo) : undefined,
      qty,
      date: date ? new Date(date) : new Date(),
      notes
    });

    await transaction.save();
    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    console.error('Error creating outward fabric transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get all transactions
const getTransactions = async (req, res) => {
  try {
    const transactions = await FabricTransaction.find().sort({ date: -1, createdAt: -1 });
    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    console.error('Error fetching fabric transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get current stock overview grouped by fabric quality
const getStockOverview = async (req, res) => {
  try {
    const pipeline = [
      {
        $group: {
          _id: '$fabricQuality',
          totalInward: {
            $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] }
          },
          totalOutward: {
            $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] }
          }
        }
      },
      {
        $project: {
          fabricQuality: '$_id',
          totalInward: 1,
          totalOutward: 1,
          currentStock: { $subtract: ['$totalInward', '$totalOutward'] },
          _id: 0
        }
      },
      {
        $sort: { fabricQuality: 1 }
      }
    ];

    const stock = await FabricTransaction.aggregate(pipeline);
    res.status(200).json({ success: true, data: stock });
  } catch (error) {
    console.error('Error calculating fabric stock:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getLotStock = async (req, res) => {
  try {
    const { fabricQuality } = req.query;
    const matchStage = {};
    if (fabricQuality) {
      matchStage.fabricQuality = fabricQuality;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$lotNo',
          fabricQuality: { $first: '$fabricQuality' },
          panna: { $first: '$panna' },
          totalInward: {
            $sum: { $cond: [{ $eq: ['$type', 'INWARD'] }, '$qty', 0] }
          },
          totalOutward: {
            $sum: { $cond: [{ $eq: ['$type', 'OUTWARD'] }, '$qty', 0] }
          }
        }
      },
      {
        $project: {
          lotNo: '$_id',
          fabricQuality: 1,
          panna: 1,
          currentStock: { $subtract: ['$totalInward', '$totalOutward'] },
          _id: 0
        }
      },
      {
        $match: {
          lotNo: { $ne: null },
          currentStock: { $gt: 0 }
        }
      },
      { $sort: { lotNo: 1 } }
    ];

    const lotStock = await FabricTransaction.aggregate(pipeline);
    res.status(200).json({ success: true, data: lotStock });
  } catch (error) {
    console.error('Error fetching lot stock:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  createInward,
  createOutward,
  getTransactions,
  getStockOverview,
  getLotStock
};
