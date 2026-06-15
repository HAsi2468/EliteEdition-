const cron = require('node-cron');
const axios = require('axios');
const db = require('../db/models');
const logger = require('../config/logger');

const MYNTRA_API_URL = 'https://api.pretr.com'; // Wait for user to get real URL

// Sleep function to respect rate limits
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const syncInventoryToMyntra = async () => {
  logger.info('Starting Automated Myntra Inventory Sync...');
  
  try {
    const config = await db.MyntraConfig.findOne();
    if (!config || !config.isActive) {
      logger.info('Myntra Sync aborted: Credentials not set or inactive.');
      return;
    }

    // Generate fresh token
    const params = new URLSearchParams();
    params.append('merchant_id', config.merchantId);
    params.append('secret_key', config.secretKey);

    let token;
    try {
      // Temporarily wrapping in try/catch to prevent crashes due to dead URL
      const tokenRes = await axios.post(`${MYNTRA_API_URL}/authorization/generate_token`, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      });
      token = tokenRes.data.access_token;
    } catch (tokenErr) {
      logger.warn('Myntra Auto-Sync: Could not generate token (Likely due to dead API URL). Skipping sync.');
      return;
    }

    // Fetch all local active inventory mapping
    const inventoryItems = await db.InventoryProduct.find({ 'variations.0': { $exists: true } }).lean();
    
    const myntraPayload = [];
    inventoryItems.forEach(item => {
      item.variations.forEach(variation => {
        if (variation.sku) {
          myntraPayload.push({
            sku: variation.sku,
            inventoryCount: variation.quantity || 0, // absolute inventory
            processingSla: 2,
            storeCode: "MAIN_WH"
          });
        }
      });
    });

    if (myntraPayload.length === 0) {
      logger.info('Myntra Auto-Sync: No SKUs found to sync.');
      return;
    }

    // The API document specifies batch size of 10 and max 100 requests per minute
    const BATCH_SIZE = 10;
    const DELAY_MS = 600; // 600ms between batches to stay under 100/min

    for (let i = 0; i < myntraPayload.length; i += BATCH_SIZE) {
      const batch = myntraPayload.slice(i, i + BATCH_SIZE);
      
      try {
        await axios.put(`${MYNTRA_API_URL}/partner/v4/inventory/update`, batch, {
          headers: {
            'access_token': token,
            'x-partner-store': 'MYNTRA',
            'Content-Type': 'application/json'
          },
          timeout: 10000,
        });
        logger.info(`Myntra Auto-Sync: Synced batch ${i / BATCH_SIZE + 1}`);
      } catch (err) {
        logger.error(`Myntra Auto-Sync: Failed to sync batch ${i / BATCH_SIZE + 1}. Error: ${err.message}`);
      }

      await sleep(DELAY_MS);
    }

    logger.info(`Completed Automated Myntra Inventory Sync for ${myntraPayload.length} SKUs.`);
  } catch (error) {
    logger.error('Critical Error in Myntra Inventory Sync Job: %o', error.message);
  }
};

// Run every 15 minutes
const startMyntraScheduler = () => {
  cron.schedule('*/15 * * * *', () => {
    syncInventoryToMyntra();
  });
  logger.info('Myntra Inventory CRON Scheduler initialized (runs every 15 minutes)');
};

module.exports = {
  startMyntraScheduler,
  syncInventoryToMyntra, // exported for manual triggers
};
