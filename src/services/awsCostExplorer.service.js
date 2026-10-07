const { CostExplorerClient, GetCostAndUsageCommand } = require('@aws-sdk/client-cost-explorer');
const logger = require('../config/logger');

const DEFAULT_USD_TO_INR = 86.5;

/**
 * Creates and returns an AWS Cost Explorer client.
 * AWS Cost Explorer endpoint is global in 'us-east-1'.
 */
function getCostExplorerClient() {
  const config = {
    region: process.env.AWS_COST_EXPLORER_REGION || 'us-east-1',
  };

  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
    };
  }

  return new CostExplorerClient(config);
}

/**
 * Helper to format date as YYYY-MM-DD
 */
function formatDate(date) {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Formats YYYY-MM to human readable "Month YYYY" (e.g. "October 2026")
 */
function formatMonthName(yearMonthStr) {
  const [year, month] = yearMonthStr.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Fetches AWS monthly cost breakdown from AWS Cost Explorer.
 *
 * @param {Object} options
 * @param {string} [options.startDate] - e.g. '2026-05-01'
 * @param {string} [options.endDate]   - e.g. '2026-11-01'
 * @param {number} [options.exchangeRate=86.5] - USD to INR exchange rate
 */
async function fetchAwsMonthlyCosts(options = {}) {
  const exchangeRate = Number(options.exchangeRate) || DEFAULT_USD_TO_INR;

  // Default to past 6 months up to next month 1st
  const now = new Date();
  const start = options.startDate || formatDate(new Date(now.getFullYear(), now.getMonth() - 5, 1));
  const end = options.endDate || formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 1));

  try {
    const client = getCostExplorerClient();
    const command = new GetCostAndUsageCommand({
      TimePeriod: {
        Start: start,
        End: end,
      },
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      GroupBy: [
        {
          Type: 'DIMENSION',
          Key: 'SERVICE',
        },
      ],
    });

    logger.info(`[AWS Cost Explorer] Querying costs from ${start} to ${end}...`);
    const response = await client.send(command);

    const monthlyResults = (response.ResultsByTime || []).map((monthResult) => {
      const periodStart = monthResult.TimePeriod.Start; // 'YYYY-MM-01'
      const yearMonth = periodStart.substring(0, 7);
      const monthDisplayName = formatMonthName(yearMonth);

      let totalMonthUsd = 0;
      const services = [];

      (monthResult.Groups || []).forEach((group) => {
        const serviceName = group.Keys && group.Keys[0] ? group.Keys[0] : 'Other';
        const amountUsd = parseFloat(group.Metrics?.UnblendedCost?.Amount || '0');
        if (amountUsd > 0.0001) {
          totalMonthUsd += amountUsd;
          services.push({
            service: serviceName,
            amountUsd: Number(amountUsd.toFixed(2)),
            amountInr: Number((amountUsd * exchangeRate).toFixed(2)),
          });
        }
      });

      // Sort services descending by cost
      services.sort((a, b) => b.amountUsd - a.amountUsd);

      return {
        month: monthDisplayName,
        monthKey: yearMonth,
        startDate: periodStart,
        endDate: monthResult.TimePeriod.End,
        totalUsd: Number(totalMonthUsd.toFixed(2)),
        totalInr: Number((totalMonthUsd * exchangeRate).toFixed(2)),
        exchangeRate,
        services,
      };
    });

    return {
      success: true,
      exchangeRate,
      results: monthlyResults,
    };
  } catch (error) {
    logger.error('[AWS Cost Explorer] Error fetching cost and usage: %o', error);
    
    // Provide actionable error diagnosis
    let message = error.message;
    let hint = '';

    if (error.name === 'AccessDeniedException') {
      message = 'AWS Access Denied. Your IAM User / Role needs "ce:GetCostAndUsage" permission.';
      hint = 'Attach the AWS managed policy "CostExplorerReadOnlyAccess" or add "ce:GetCostAndUsage" to your IAM user or EC2 Instance Profile.';
    } else if (error.name === 'UnrecognizedClientException' || error.name === 'CredentialsProviderError') {
      message = 'AWS credentials not found or invalid.';
      hint = 'Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env, or attach an IAM Role to your EC2 instance.';
    } else if (error.name === 'ValidationException' && message.includes('Cost Explorer')) {
      hint = 'AWS Cost Explorer must be enabled in your AWS Billing Console. It takes ~24 hours after initial enablement to generate data.';
    }

    return {
      success: false,
      error: message,
      hint,
      originalError: error.name || 'UnknownError',
    };
  }
}

module.exports = {
  fetchAwsMonthlyCosts,
  DEFAULT_USD_TO_INR,
};
