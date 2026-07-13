const httpStatus = require('http-status').default;
const InfrastructureBill = require('../db/models/infrastructureBill.model');
const ApiError = require('../utils/ApiError');

const createBill = async (req, res) => {
  try {
    const { month, awsAmount, mongoDbAmount, notes } = req.body;
    if (!month) {
      return res.status(httpStatus.BAD_REQUEST).json({ success: false, error: 'Month is required.' });
    }

    // Check if bill for this month already exists
    const existing = await InfrastructureBill.findOne({ month: month.trim() });
    if (existing) {
      return res.status(httpStatus.BAD_REQUEST).json({ success: false, error: 'A billing record for this month already exists.' });
    }

    const bill = new InfrastructureBill({
      month: month.trim(),
      awsAmount: Number(awsAmount || 0),
      mongoDbAmount: Number(mongoDbAmount || 0),
      notes,
    });

    await bill.save();
    res.status(httpStatus.CREATED).json({ success: true, bill });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

const getBills = async (req, res) => {
  try {
    const bills = await InfrastructureBill.find({}).sort({ createdAt: -1 });
    res.status(httpStatus.OK).json({ success: true, bills });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

const updateBill = async (req, res) => {
  try {
    const { id } = req.params;
    const { month, awsAmount, mongoDbAmount, notes } = req.body;

    const bill = await InfrastructureBill.findById(id);
    if (!bill) {
      return res.status(httpStatus.NOT_FOUND).json({ success: false, error: 'Billing record not found.' });
    }

    if (month && month.trim() !== bill.month) {
      const existing = await InfrastructureBill.findOne({ month: month.trim() });
      if (existing) {
        return res.status(httpStatus.BAD_REQUEST).json({ success: false, error: 'A billing record for this month already exists.' });
      }
      bill.month = month.trim();
    }

    if (awsAmount !== undefined) bill.awsAmount = Number(awsAmount || 0);
    if (mongoDbAmount !== undefined) bill.mongoDbAmount = Number(mongoDbAmount || 0);
    if (notes !== undefined) bill.notes = notes;

    await bill.save();
    res.status(httpStatus.OK).json({ success: true, bill });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

const deleteBill = async (req, res) => {
  try {
    const { id } = req.params;
    const bill = await InfrastructureBill.findById(id);
    if (!bill) {
      return res.status(httpStatus.NOT_FOUND).json({ success: false, error: 'Billing record not found.' });
    }

    await bill.deleteOne();
    res.status(httpStatus.OK).json({ success: true, message: 'Billing record deleted successfully.' });
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

module.exports = {
  createBill,
  getBills,
  updateBill,
  deleteBill,
};
