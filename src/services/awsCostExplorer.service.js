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
 * Formats remaining milliseconds into human-readable "Xh Ym" (e.g. "14h 25m")
 */
function formatRemainingTime(ms) {
  const safeMs = Math.max(0, Number(ms) || 0);
  if (safeMs <= 0) return 'Ready now';
  const totalMinutes = Math.ceil(safeMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h 0m`;
  return `${minutes}m`;
}

/**
 * Fetches AWS monthly cost breakdown from AWS Cost Explorer.
 *
 * COST PROTECTION POLICY:
 * - Paid AWS Cost Explorer API ($0.01/request) NEVER fires automatically on page load or cron.
 * - It ONLY fires when `options.manualTrigger === true` (explicit user button click)
 *   AND at least 24 hours have elapsed since the last live sync.
 * - All non-manual calls return cached DB/memory data ($0.00) with exact cooldown timing metadata.
 *
 * @param {Object} options
 * @param {string} [options.startDate] - e.g. '2026-05-01'
 * @param {string} [options.endDate]   - e.g. '2026-11-01'
 * @param {number} [options.exchangeRate=86.5] - USD to INR exchange rate
 * @param {boolean} [options.manualTrigger=false] - Must be true (user button click) to hit AWS API
 */
async function fetchAwsMonthlyCosts(options = {}) {
  const exchangeRate = Number(options.exchangeRate) || DEFAULT_USD_TO_INR;
  const manualTrigger = Boolean(options.manualTrigger);
  const nowMs = Date.now();

  // Helper to build consistent cached response payload with countdown metadata
  const buildCachedResponse = (results, syncTimestamp) => {
    const hasSynced = Boolean(syncTimestamp && syncTimestamp > 0);
    const lockExpiresMs = hasSynced ? syncTimestamp + CACHE_TTL_MS : 0;
    const remainingMs = hasSynced ? Math.max(0, lockExpiresMs - nowMs) : 0;
    const canSyncNow = !hasSynced || remainingMs <= 0;
    const hoursRemaining = (remainingMs / 3600000).toFixed(1);

    return {
      success: true,
      cached: true,
      canSyncNow,
      lastSyncedAt: hasSynced ? new Date(syncTimestamp).toISOString() : null,
      lockExpiresAt: hasSynced ? new Date(lockExpiresMs).toISOString() : null,
      remainingMs,
      nextRefreshInHours: hoursRemaining,
      nextRefreshFormatted: formatRemainingTime(remainingMs),
      exchangeRate,
      results: results || [],
    };
  };

  // 1. Check in-memory cache first
  if (memoryCache.data && memoryCache.timestamp > 0) {
    const elapsed = nowMs - memoryCache.timestamp;
    const isLocked = elapsed < CACHE_TTL_MS;
    if (!manualTrigger || isLocked) {
      const payload = buildCachedResponse(memoryCache.data.results, memoryCache.timestamp);
      logger.info(
        `[AWS Cost Explorer] Served from memory cache ($0.00). manualTrigger=${manualTrigger}, canSyncNow=${payload.canSyncNow}, remaining=${payload.nextRefreshFormatted}.`
      );
      return payload;
    }
  }

  // 2. Check persistent MongoDB cache (survives server/PM2 restarts)
  let latestDbSyncTimestamp = 0;
  let dbMappedResults = [];
  try {
    const InfrastructureBill = require('../db/models/infrastructureBill.model');
    const recentSync = await InfrastructureBill.findOne({
      isAutoSynced: true,
      syncedAt: { $ne: null },
    }).sort({ syncedAt: -1 });

    if (recentSync) {
      latestDbSyncTimestamp = new Date(recentSync.syncedAt).getTime();
      const allRecentBills = await InfrastructureBill.find({ isAutoSynced: true }).sort({ createdAt: -1 }).limit(6);
      dbMappedResults = allRecentBills.map((b) => ({
        month: b.month,
        monthKey: b.month,
        totalUsd: b.awsUsdAmount || Number(((b.awsAmount || 0) / exchangeRate).toFixed(2)),
        totalInr: b.awsAmount || 0,
        exchangeRate,
        services: b.awsBreakdown || [],
      }));
      if (dbMappedResults.length === 0) {
        dbMappedResults = [
          {
            month: recentSync.month,
            monthKey: recentSync.month,
            totalUsd: recentSync.awsUsdAmount || Number(((recentSync.awsAmount || 0) / exchangeRate).toFixed(2)),
            totalInr: recentSync.awsAmount || 0,
            exchangeRate,
            services: recentSync.awsBreakdown || [],
          },
        ];
      }
    }
  } catch (dbErr) {
    logger.warn(`[AWS Cost Explorer] DB cache lookup notice: ${dbErr.message}`);
  }

  const dbIsLocked = latestDbSyncTimestamp > 0 && (nowMs - latestDbSyncTimestamp) < CACHE_TTL_MS;

  // If NOT a manual button press, NEVER hit paid AWS API — return DB snapshot (or empty ready state)
  if (!manualTrigger || dbIsLocked) {
    const cachedPayload = buildCachedResponse(dbMappedResults, latestDbSyncTimestamp);
    if (latestDbSyncTimestamp > 0) {
      memoryCache = {
        timestamp: latestDbSyncTimestamp,
        data: cachedPayload,
      };
    }
    logger.info(
      `[AWS Cost Explorer] Served from DB cache ($0.00). manualTrigger=${manualTrigger}, canSyncNow=${cachedPayload.canSyncNow}, remaining=${cachedPayload.nextRefreshFormatted}.`
    );
    return cachedPayload;
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

    const syncedNowMs = Date.now();
    const payload = {
      success: true,
      cached: false,
      canSyncNow: false,
      lastSyncedAt: new Date(syncedNowMs).toISOString(),
      lockExpiresAt: new Date(syncedNowMs + CACHE_TTL_MS).toISOString(),
      remainingMs: CACHE_TTL_MS,
      nextRefreshInHours: '24.0',
      nextRefreshFormatted: '24h 0m',
      exchangeRate,
      results: monthlyResults,
    };

    // Arm the 24-hour cache lock
    memoryCache = {
      timestamp: syncedNowMs,
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
