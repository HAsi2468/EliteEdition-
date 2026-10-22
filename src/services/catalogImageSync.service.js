/**
 * Catalog & Image Auto-Sync Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Daily automated off-peak service to:
 * 1. Discover and save any new products from Uniware into Product Catalog.
 * 2. Scan existing catalog for items missing product photos / images,
 *    fetch matching images from Uniware (exact SKU or base style SKU), and update them.
 */

const db = require('../db/models');
const logger = require('../config/logger');
const { getAccessToken, fetchEntireCatalog } = require('./api.service');
const { extractBaseSku, extractSizeFromSku } = require('../utils/skuHelper');

let isSyncRunning = false;

/**
 * Execute full catalog & image synchronization
 * @param {Object} options - { triggerSource: 'CRON' | 'MANUAL' }
 * @returns {Promise<Object>} summary of sync results
 */
async function runCatalogAndImageSync(options = { triggerSource: 'CRON' }) {
  if (isSyncRunning) {
    logger.warn('[CatalogImageSync] A sync job is already in progress. Skipping duplicate run.');
    return { skipped: true, reason: 'Job already running' };
  }

  isSyncRunning = true;
  const startTime = Date.now();
  logger.info(`[CatalogImageSync] 🚀 Starting catalog & image sync (Trigger: ${options.triggerSource})...`);

  try {
    // 1. Get Unicommerce Uniware Access Token
    const token = await getAccessToken();
    if (!token) {
      logger.error('[CatalogImageSync] ❌ Failed to obtain Unicommerce access token.');
      return { success: false, error: 'Failed to obtain Unicommerce access token' };
    }

    // 2. Fetch full catalog from Uniware
    const uniwareItems = await fetchEntireCatalog(token);
    logger.info(`[CatalogImageSync] 📦 Retrieved ${uniwareItems.length} items from Uniware.`);

    if (!uniwareItems || uniwareItems.length === 0) {
      logger.warn('[CatalogImageSync] No items returned from Uniware. Aborting sync.');
      return { success: true, newProductsSaved: 0, imagesUpdated: 0, totalUniware: 0 };
    }

    // 3. Build fast lookup maps: exact SKU and base style SKU
    const uniwareSkuMap = new Map();
    const baseSkuImageMap = new Map();

    uniwareItems.forEach(item => {
      if (!item.skuCode) return;
      const fullSku = item.skuCode.trim().toUpperCase();
      const baseSku = extractBaseSku(item.skuCode).toUpperCase();
      const img = (item.imageUrl || item.image || item.photo || '').trim();

      uniwareSkuMap.set(fullSku, { ...item, cleanImg: img, baseSku });

      if (baseSku && img && !baseSkuImageMap.has(baseSku)) {
        baseSkuImageMap.set(baseSku, img);
      }
    });

    logger.info(`[CatalogImageSync] 🔍 Uniware indexing complete: ${uniwareSkuMap.size} SKUs, ${baseSkuImageMap.size} base styles with images.`);

    // 4. Fetch existing SKUs from both local collections
    const existingInvProducts = await db.InventoryProduct.find({}, { skuCode: 1, imageUrl: 1 }).lean();
    const existingProducts = await db.Product.find({}, { skuCode: 1, imageUrl: 1 }).lean();

    const existingInvSkuSet = new Set(existingInvProducts.map(p => (p.skuCode || '').trim().toUpperCase()));
    const existingProdSkuSet = new Set(existingProducts.map(p => (p.skuCode || '').trim().toUpperCase()));

    // 5. Insert any NEW products from Uniware that don't exist locally
    let newProductsSaved = 0;
    const newInvDocs = [];
    const newProdDocs = [];

    uniwareItems.forEach(uItem => {
      if (!uItem.skuCode) return;
      const skuUpper = uItem.skuCode.trim().toUpperCase();
      const rawSku = uItem.skuCode.trim();
      const baseSku = extractBaseSku(rawSku);
      const size = uItem.size || extractSizeFromSku(rawSku) || 'N/A';
      const color = uItem.color || 'N/A';

      // Fallback to base style image if exact SKU doesn't have one
      const resolvedImg = (uItem.imageUrl || '').trim() || baseSkuImageMap.get(baseSku.toUpperCase()) || '';

      const docPayload = {
        skuCode: rawSku,
        description: uItem.name || uItem.description || rawSku,
        brand: uItem.brand || uItem.categoryName || 'Uniware',
        categoryName: uItem.categoryName || '',
        price: Number(uItem.price) || Number(uItem.basePrice) || 0,
        basePrice: Number(uItem.basePrice) || Number(uItem.price) || 0,
        imageUrl: resolvedImg,
        size: [size],
        color: [color],
        gstTaxTypeCode: uItem.gstTaxTypeCode || '5',
        hsnCode: uItem.hsnCode || '',
        enabled: true,
        skuType: 'GOODS',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      if (!existingInvSkuSet.has(skuUpper)) {
        newInvDocs.push(docPayload);
        existingInvSkuSet.add(skuUpper);
      }
      if (!existingProdSkuSet.has(skuUpper)) {
        newProdDocs.push(docPayload);
        existingProdSkuSet.add(skuUpper);
      }
    });

    if (newInvDocs.length > 0) {
      await db.InventoryProduct.insertMany(newInvDocs, { ordered: false }).catch(err => {
        logger.warn(`[CatalogImageSync] Bulk insert partial error in InventoryProduct: ${err.message}`);
      });
      newProductsSaved += newInvDocs.length;
    }
    if (newProdDocs.length > 0) {
      await db.Product.insertMany(newProdDocs, { ordered: false }).catch(err => {
        logger.warn(`[CatalogImageSync] Bulk insert partial error in Product: ${err.message}`);
      });
    }

    logger.info(`[CatalogImageSync] ✨ Added ${newProductsSaved} new products from Uniware.`);

    // 6. Identify existing products missing images and update them
    let invImagesUpdated = 0;
    const invBulkOps = [];

    existingInvProducts.forEach(ip => {
      const currentImg = (ip.imageUrl || '').trim();
      const isMissingImg = !currentImg || currentImg === '' || currentImg.toLowerCase() === 'null' || currentImg.includes('placeholder');

      if (isMissingImg && ip.skuCode) {
        const skuUpper = ip.skuCode.trim().toUpperCase();
        const baseSkuUpper = extractBaseSku(ip.skuCode).toUpperCase();

        const uMatch = uniwareSkuMap.get(skuUpper);
        let bestImg = uMatch ? uMatch.cleanImg : '';
        if (!bestImg && baseSkuImageMap.has(baseSkuUpper)) {
          bestImg = baseSkuImageMap.get(baseSkuUpper);
        }

        if (bestImg) {
          invBulkOps.push({
            updateOne: {
              filter: { _id: ip._id },
              update: { $set: { imageUrl: bestImg, updatedAt: new Date() } }
            }
          });
        }
      }
    });

    if (invBulkOps.length > 0) {
      // Chunk bulk writes into batches of 250 to keep DB load ultra-low
      const CHUNK = 250;
      for (let i = 0; i < invBulkOps.length; i += CHUNK) {
        const slice = invBulkOps.slice(i, i + CHUNK);
        await db.InventoryProduct.bulkWrite(slice, { ordered: false });
      }
      invImagesUpdated = invBulkOps.length;
    }

    // Also update Product collection images
    let prodImagesUpdated = 0;
    const prodBulkOps = [];
    existingProducts.forEach(p => {
      const currentImg = (p.imageUrl || '').trim();
      const isMissingImg = !currentImg || currentImg === '' || currentImg.toLowerCase() === 'null' || currentImg.includes('placeholder');

      if (isMissingImg && p.skuCode) {
        const skuUpper = p.skuCode.trim().toUpperCase();
        const baseSkuUpper = extractBaseSku(p.skuCode).toUpperCase();

        const uMatch = uniwareSkuMap.get(skuUpper);
        let bestImg = uMatch ? uMatch.cleanImg : '';
        if (!bestImg && baseSkuImageMap.has(baseSkuUpper)) {
          bestImg = baseSkuImageMap.get(baseSkuUpper);
        }

        if (bestImg) {
          prodBulkOps.push({
            updateOne: {
              filter: { _id: p._id },
              update: { $set: { imageUrl: bestImg, updatedAt: new Date() } }
            }
          });
        }
      }
    });

    if (prodBulkOps.length > 0) {
      const CHUNK = 250;
      for (let i = 0; i < prodBulkOps.length; i += CHUNK) {
        const slice = prodBulkOps.slice(i, i + CHUNK);
        await db.Product.bulkWrite(slice, { ordered: false });
      }
      prodImagesUpdated = prodBulkOps.length;
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`[CatalogImageSync] ✅ Completed in ${durationSec}s. New Products: ${newProductsSaved}, Inventory Images Updated: ${invImagesUpdated}, Product Images Updated: ${prodImagesUpdated}.`);

    return {
      success: true,
      durationSec,
      totalUniware: uniwareItems.length,
      newProductsSaved,
      inventoryImagesUpdated: invImagesUpdated,
      productImagesUpdated: prodImagesUpdated
    };
  } catch (error) {
    logger.error('[CatalogImageSync] ❌ Error during sync: %o', error);
    return { success: false, error: error.message };
  } finally {
    isSyncRunning = false;
  }
}

module.exports = {
  runCatalogAndImageSync,
};
