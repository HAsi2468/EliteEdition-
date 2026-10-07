const httpStatus = require('http-status').default;
const InfrastructureBill = require('../db/models/infrastructureBill.model');
const awsCostExplorerService = require('../services/awsCostExplorer.service');
const logger = require('../config/logger');

const createBill = async (req, res) => {
  try {
    const { month, awsAmount, awsUsdAmount, mongoDbAmount, exchangeRate, awsBreakdown, notes, isAutoSynced } = req.body;
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
      awsUsdAmount: Number(awsUsdAmount || 0),
      mongoDbAmount: Number(mongoDbAmount || 0),
      exchangeRate: Number(exchangeRate || 86.5),
      awsBreakdown: Array.isArray(awsBreakdown) ? awsBreakdown : [],
      isAutoSynced: Boolean(isAutoSynced),
      syncedAt: isAutoSynced ? new Date() : undefined,
      notes,
    });

    await bill.save();
    res.status(httpStatus.CREATED).json({ success: true, bill });
  } catch (error) {
    logger.error('createBill error: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

const getBills = async (req, res) => {
  try {
    const bills = await InfrastructureBill.find({}).sort({ createdAt: -1 });
    res.status(httpStatus.OK).json({ success: true, bills });
  } catch (error) {
    logger.error('getBills error: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

const updateBill = async (req, res) => {
  try {
    const { id } = req.params;
    const { month, awsAmount, awsUsdAmount, mongoDbAmount, exchangeRate, awsBreakdown, notes, isAutoSynced } = req.body;

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
    if (awsUsdAmount !== undefined) bill.awsUsdAmount = Number(awsUsdAmount || 0);
    if (mongoDbAmount !== undefined) bill.mongoDbAmount = Number(mongoDbAmount || 0);
    if (exchangeRate !== undefined) bill.exchangeRate = Number(exchangeRate || 86.5);
    if (awsBreakdown !== undefined) bill.awsBreakdown = Array.isArray(awsBreakdown) ? awsBreakdown : [];
    if (isAutoSynced !== undefined) bill.isAutoSynced = Boolean(isAutoSynced);
    if (isAutoSynced) bill.syncedAt = new Date();
    if (notes !== undefined) bill.notes = notes;

    await bill.save();
    res.status(httpStatus.OK).json({ success: true, bill });
  } catch (error) {
    logger.error('updateBill error: %o', error);
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
    logger.error('deleteBill error: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

/**
 * Live preview of AWS Cost Explorer without saving
 */
const getAwsLiveCost = async (req, res) => {
  try {
    const { startDate, endDate, exchangeRate } = req.query;
    const costData = await awsCostExplorerService.fetchAwsMonthlyCosts({
      startDate,
      endDate,
      exchangeRate: exchangeRate ? Number(exchangeRate) : undefined,
    });

    res.status(httpStatus.OK).json(costData);
  } catch (error) {
    logger.error('getAwsLiveCost error: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

/**
 * Sync AWS costs directly into InfrastructureBill records in MongoDB.
 * Upserts monthly bills with live AWS costs & service breakdown.
 */
const syncAwsCosts = async (req, res) => {
  try {
    const { startDate, endDate, exchangeRate } = req.body || {};
    const costData = await awsCostExplorerService.fetchAwsMonthlyCosts({
      startDate,
      endDate,
      exchangeRate: exchangeRate ? Number(exchangeRate) : undefined,
    });

    if (!costData.success) {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        error: costData.error,
        hint: costData.hint,
      });
    }

    const syncedBills = [];

    for (const item of costData.results || []) {
      // Upsert by month name (e.g. "October 2026")
      let bill = await InfrastructureBill.findOne({ month: item.month });

      if (bill) {
        bill.awsAmount = item.totalInr;
        bill.awsUsdAmount = item.totalUsd;
        bill.exchangeRate = item.exchangeRate;
        bill.awsBreakdown = item.services;
        bill.isAutoSynced = true;
        bill.syncedAt = new Date();
        await bill.save();
      } else {
        bill = await InfrastructureBill.create({
          month: item.month,
          awsAmount: item.totalInr,
          awsUsdAmount: item.totalUsd,
          mongoDbAmount: 0,
          exchangeRate: item.exchangeRate,
          awsBreakdown: item.services,
          isAutoSynced: true,
          syncedAt: new Date(),
          notes: `Auto-synced from AWS Cost Explorer on ${new Date().toLocaleDateString('en-IN')}`,
        });
      }

      syncedBills.push(bill);
    }

    res.status(httpStatus.OK).json({
      success: true,
      message: `Successfully synced ${syncedBills.length} monthly bill(s) from AWS Cost Explorer.`,
      bills: syncedBills,
    });
  } catch (error) {
    logger.error('syncAwsCosts error: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
};

module.exports = {
  createBill,
  getBills,
  updateBill,
  deleteBill,
  getAwsLiveCost,
  syncAwsCosts,
};
