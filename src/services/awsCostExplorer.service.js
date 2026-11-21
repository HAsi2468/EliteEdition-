const { CostExplorerClient, GetCostAndUsageCommand } = require('@aws-sdk/client-cost-explorer');
const logger = require('../config/logger');

const DEFAULT_USD_TO_INR = 86.5;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // Strict 24-Hour Cache Lock (max 1 query / 24 hours)

// In-memory cache fallback
let memoryCache = {
  timestamp: 0,
  data: null,
};

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
  const nowMs = Date.now();

  // 1. Check in-memory 24-hour cache lock
  if (memoryCache.data && (nowMs - memoryCache.timestamp) < CACHE_TTL_MS && !options.bypassCache) {
    const hoursRemaining = Math.max(0, ((CACHE_TTL_MS - (nowMs - memoryCache.timestamp)) / 3600000).toFixed(1));
    logger.info(`[AWS Cost Explorer] 24-HOUR CACHE LOCK HIT. Skipped paid AWS API call ($0.00). Next live fetch allowed in ${hoursRemaining} hours.`);
    return {
      ...memoryCache.data,
      cached: true,
      nextRefreshInHours: hoursRemaining,
      lockExpiresAt: new Date(memoryCache.timestamp + CACHE_TTL_MS).toISOString(),
    };
  }

  // 2. Check persistent MongoDB cache lock (across server/PM2 restarts)
  if (!options.bypassCache) {
    try {
      const InfrastructureBill = require('../db/models/infrastructureBill.model');
      const recentSync = await InfrastructureBill.findOne({
        isAutoSynced: true,
        syncedAt: { $gte: new Date(nowMs - CACHE_TTL_MS) },
      }).sort({ syncedAt: -1 });

      if (recentSync && recentSync.awsBreakdown && recentSync.awsBreakdown.length > 0) {
        const syncTimestamp = new Date(recentSync.syncedAt).getTime();
        const hoursRemaining = Math.max(0, ((CACHE_TTL_MS - (nowMs - syncTimestamp)) / 3600000).toFixed(1));
        logger.info(`[AWS Cost Explorer] 24-HOUR DB CACHE LOCK HIT. Skipped paid AWS API call ($0.00). Next live fetch allowed in ${hoursRemaining} hours.`);

        const allRecentBills = await InfrastructureBill.find({ isAutoSynced: true }).sort({ createdAt: -1 }).limit(6);
        const mappedResults = allRecentBills.map((b) => ({
          month: b.month,
          monthKey: b.month,
          totalUsd: b.awsUsdAmount || Number((b.awsAmount / exchangeRate).toFixed(2)),
          totalInr: b.awsAmount,
          exchangeRate,
          services: b.awsBreakdown || [],
        }));

        const cachedPayload = {
          success: true,
          cached: true,
          nextRefreshInHours: hoursRemaining,
          lockExpiresAt: new Date(syncTimestamp + CACHE_TTL_MS).toISOString(),
          exchangeRate,
          results: mappedResults.length > 0 ? mappedResults : [
            {
              month: recentSync.month,
              monthKey: recentSync.month,
              totalUsd: recentSync.awsUsdAmount || Number((recentSync.awsAmount / exchangeRate).toFixed(2)),
              totalInr: recentSync.awsAmount,
              exchangeRate,
              services: recentSync.awsBreakdown || [],
            }
          ],
        };

        memoryCache = {
          timestamp: syncTimestamp,
          data: cachedPayload,
        };

        return cachedPayload;
      }
    } catch (dbErr) {
      logger.warn(`[AWS Cost Explorer] DB cache lookup notice: ${dbErr.message}`);
    }
  }

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

    const payload = {
      success: true,
      cached: false,
      nextRefreshInHours: '24.0',
      lockExpiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
      exchangeRate,
      results: monthlyResults,
    };

    // Arm the 24-hour cache lock
    memoryCache = {
      timestamp: Date.now(),
      data: payload,
    };
    logger.info(`[AWS Cost Explorer] Live query executed ($0.01). 24-Hour Cache Lock ARMED until ${payload.lockExpiresAt}.`);

    return payload;
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
