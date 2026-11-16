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
const { getAccessToken, fetchEntireCatalog, fetchProductData } = require('./api.service');
const { extractBaseSku, extractSizeFromSku } = require('../utils/skuHelper');
const { normalizeImageUrl, extractApiImageUrl } = require('../utils/imageUrlHelper');
const { clearProductImageCache } = require('./product.service');

let isSyncRunning = false;

function isPlaceholderDesc(desc, skuCode) {
  if (!desc || typeof desc !== 'string') return true;
  const t = desc.trim();
  if (!t) return true;
  if (/^(unnamed product|uniware sku|product|sku|n\/a|null|undefined|-)$/i.test(t)) return true;
  if (skuCode && t.toUpperCase() === String(skuCode).trim().toUpperCase()) return true;
  return false;
}

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
    // 1. Fetch existing records from local collections first so we can cross-pollinate images & descriptions immediately
    const [existingInvProducts, existingProducts, existingInventories, existingSaleOrders] = await Promise.all([
      db.InventoryProduct.find({}, { skuCode: 1, imageUrl: 1, description: 1, categoryName: 1, brand: 1, brandCodes: 1 }).lean(),
      db.Product.find({}, { skuCode: 1, imageUrl: 1, description: 1, categoryName: 1, brand: 1, brandCodes: 1 }).lean(),
      db.Inventory ? db.Inventory.find({}, { skuCode: 1, imageUrl: 1, itemName: 1, brandCodes: 1 }).lean() : Promise.resolve([]),
      db.SaleOrder
        ? db.SaleOrder.aggregate([
            { $match: { itemSKUCode: { $nin: [null, ''] } } },
            { $group: { _id: '$itemSKUCode', itemTypeName: { $first: '$itemTypeName' }, category: { $first: '$category' }, brand: { $first: '$itemTypeBrand' } } },
          ]).catch(() => [])
        : Promise.resolve([]),
    ]);

    const uniwareSkuMap = new Map();
    const baseSkuImageMap = new Map();
    const baseSkuDescMap = new Map();
    const baseSkuMetaMap = new Map();

    const registerKnowledge = (sku, rawImg, rawDesc, meta = {}) => {
      if (!sku) return;
      const fullSku = String(sku).trim().toUpperCase();
      const baseSku = extractBaseSku(sku).trim().toUpperCase();
      const cleanImg = normalizeImageUrl(rawImg);
      const validDesc = !isPlaceholderDesc(rawDesc, sku) ? String(rawDesc).trim() : '';

      if (cleanImg) {
        if (!baseSkuImageMap.has(fullSku)) baseSkuImageMap.set(fullSku, cleanImg);
        if (baseSku && !baseSkuImageMap.has(baseSku)) baseSkuImageMap.set(baseSku, cleanImg);
      }
      if (validDesc) {
        if (!baseSkuDescMap.has(fullSku)) baseSkuDescMap.set(fullSku, validDesc);
        if (baseSku && !baseSkuDescMap.has(baseSku)) baseSkuDescMap.set(baseSku, validDesc);
      }
      if (meta && (meta.categoryName || meta.brand)) {
        if (baseSku && !baseSkuMetaMap.has(baseSku)) baseSkuMetaMap.set(baseSku, meta);
      }
    };

    // Seed maps from local collections first
    existingInvProducts.forEach((p) => registerKnowledge(p.skuCode, extractApiImageUrl(p) || p.imageUrl, p.description, p));
    existingProducts.forEach((p) => registerKnowledge(p.skuCode, extractApiImageUrl(p) || p.imageUrl, p.description, p));
    existingInventories.forEach((inv) => registerKnowledge(inv.skuCode, extractApiImageUrl(inv) || inv.imageUrl, inv.itemName, inv));
    existingSaleOrders.forEach((so) => registerKnowledge(so._id, '', so.itemTypeName, { categoryName: so.category, brand: so.brand }));

    // 2. Get Unicommerce Uniware Access Token & Fetch Catalog
    const token = await getAccessToken();
    let uniwareItems = [];
    if (token) {
      try {
        uniwareItems = await fetchEntireCatalog(token);
        logger.info(`[CatalogImageSync] 📦 Retrieved ${uniwareItems.length} items from Uniware.`);
      } catch (e) {
        logger.warn(`[CatalogImageSync] fetchEntireCatalog warning: ${e.message}`);
      }
    }

    uniwareItems.forEach((item) => {
      if (!item.skuCode) return;
      const fullSku = item.skuCode.trim().toUpperCase();
      const baseSku = extractBaseSku(item.skuCode).toUpperCase();
      const img = normalizeImageUrl(extractApiImageUrl(item) || item.imageUrl);
      const desc = item.name || item.description || '';

      uniwareSkuMap.set(fullSku, { ...item, cleanImg: img, baseSku });
      registerKnowledge(item.skuCode, img, desc, {
        categoryName: item.categoryName,
        brand: item.brand,
        price: item.price,
      });
    });

    // 3. Targeted Uniware lookup for any local base SKUs STILL missing an imageUrl
    if (token) {
      const missingBaseSkus = new Set();
      [...existingInvProducts, ...existingProducts].forEach((p) => {
        if (!p.skuCode) return;
        const baseUpper = extractBaseSku(p.skuCode).trim().toUpperCase();
        const skuUpper = p.skuCode.trim().toUpperCase();
        if (!baseSkuImageMap.has(skuUpper) && !baseSkuImageMap.has(baseUpper)) {
          missingBaseSkus.add(extractBaseSku(p.skuCode).trim());
        }
      });

      const targetBaseList = Array.from(missingBaseSkus).slice(0, 50);
      if (targetBaseList.length > 0) {
        logger.info(`[CatalogImageSync] 🔎 Performing targeted Uniware API lookup for ${targetBaseList.length} base SKUs missing images...`);
        const BATCH = 5;
        for (let i = 0; i < targetBaseList.length; i += BATCH) {
          const slice = targetBaseList.slice(i, i + BATCH);
          await Promise.all(
            slice.map(async (bSku) => {
              try {
                const res = await fetchProductData(bSku, token);
                const elements = (res && res.elements) || [];
                elements.forEach((el) => {
                  if (!el) return;
                  const img = normalizeImageUrl(extractApiImageUrl(el) || el.imageUrl);
                  const desc = el.name || el.description || '';
                  registerKnowledge(el.skuCode || bSku, img, desc, {
                    categoryName: el.categoryName,
                    brand: el.brand,
                  });
                  if (img || desc) {
                    registerKnowledge(bSku, img, desc, {
                      categoryName: el.categoryName,
                      brand: el.brand,
                    });
                  }
                });
              } catch (_) {}
            })
          );
        }
      }
    }

    const existingInvSkuSet = new Set(existingInvProducts.map((p) => (p.skuCode || '').trim().toUpperCase()));
    const existingProdSkuSet = new Set(existingProducts.map((p) => (p.skuCode || '').trim().toUpperCase()));

    // 4. Insert any NEW products from Uniware that don't exist locally
    let newProductsSaved = 0;
    const newInvDocs = [];
    const newProdDocs = [];

    uniwareItems.forEach((uItem) => {
      if (!uItem.skuCode) return;
      const skuUpper = uItem.skuCode.trim().toUpperCase();
      const rawSku = uItem.skuCode.trim();
      const baseSku = extractBaseSku(rawSku);
      const baseUpper = baseSku.toUpperCase();
      const size = uItem.size || extractSizeFromSku(rawSku) || 'N/A';
      const color = uItem.color || 'N/A';

      const resolvedImg =
        normalizeImageUrl(extractApiImageUrl(uItem) || uItem.imageUrl) ||
        baseSkuImageMap.get(skuUpper) ||
        baseSkuImageMap.get(baseUpper) ||
        '';
      const resolvedDesc =
        uItem.name ||
        (!isPlaceholderDesc(uItem.description, rawSku) ? uItem.description : '') ||
        baseSkuDescMap.get(skuUpper) ||
        baseSkuDescMap.get(baseUpper) ||
        uItem.categoryName ||
        rawSku;

      const docPayload = {
        skuCode: rawSku,
        description: resolvedDesc,
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
        updatedAt: new Date(),
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
      await db.InventoryProduct.insertMany(newInvDocs, { ordered: false }).catch((err) => {
        logger.warn(`[CatalogImageSync] Bulk insert partial error in InventoryProduct: ${err.message}`);
      });
      newProductsSaved += newInvDocs.length;
    }
    if (newProdDocs.length > 0) {
      await db.Product.insertMany(newProdDocs, { ordered: false }).catch((err) => {
        logger.warn(`[CatalogImageSync] Bulk insert partial error in Product: ${err.message}`);
      });
    }

    // 5. Identify existing products missing images or having placeholder descriptions and update them
    let invImagesUpdated = 0;
    const invBulkOps = [];

    existingInvProducts.forEach((ip) => {
      if (!ip.skuCode) return;
      const currentImg = (ip.imageUrl || '').trim();
      const isMissingImg = !currentImg || currentImg.toLowerCase() === 'null' || currentImg.includes('placeholder');
      const needsDesc = isPlaceholderDesc(ip.description, ip.skuCode);

      const skuUpper = ip.skuCode.trim().toUpperCase();
      const baseSkuUpper = extractBaseSku(ip.skuCode).trim().toUpperCase();

      const updateFields = {};
      if (isMissingImg) {
        const bestImg = baseSkuImageMap.get(skuUpper) || baseSkuImageMap.get(baseSkuUpper) || '';
        if (bestImg) updateFields.imageUrl = bestImg;
      } else {
        const normCurrent = normalizeImageUrl(currentImg);
        if (normCurrent && normCurrent !== currentImg) updateFields.imageUrl = normCurrent;
      }

      if (needsDesc) {
        const bestDesc = baseSkuDescMap.get(skuUpper) || baseSkuDescMap.get(baseSkuUpper) || '';
        if (bestDesc) updateFields.description = bestDesc;
      }

      if (Object.keys(updateFields).length > 0) {
        updateFields.updatedAt = new Date();
        invBulkOps.push({
          updateOne: {
            filter: { _id: ip._id },
            update: { $set: updateFields },
          },
        });
      }
    });

    if (invBulkOps.length > 0) {
      const CHUNK = 250;
      for (let i = 0; i < invBulkOps.length; i += CHUNK) {
        await db.InventoryProduct.bulkWrite(invBulkOps.slice(i, i + CHUNK), { ordered: false });
      }
      invImagesUpdated = invBulkOps.length;
    }

    let prodImagesUpdated = 0;
    const prodBulkOps = [];
    existingProducts.forEach((p) => {
      if (!p.skuCode) return;
      const currentImg = (p.imageUrl || '').trim();
      const isMissingImg = !currentImg || currentImg.toLowerCase() === 'null' || currentImg.includes('placeholder');
      const needsDesc = isPlaceholderDesc(p.description, p.skuCode);

      const skuUpper = p.skuCode.trim().toUpperCase();
      const baseSkuUpper = extractBaseSku(p.skuCode).trim().toUpperCase();

      const updateFields = {};
      if (isMissingImg) {
        const bestImg = baseSkuImageMap.get(skuUpper) || baseSkuImageMap.get(baseSkuUpper) || '';
        if (bestImg) updateFields.imageUrl = bestImg;
      } else {
        const normCurrent = normalizeImageUrl(currentImg);
        if (normCurrent && normCurrent !== currentImg) updateFields.imageUrl = normCurrent;
      }

      if (needsDesc) {
        const bestDesc = baseSkuDescMap.get(skuUpper) || baseSkuDescMap.get(baseSkuUpper) || '';
        if (bestDesc) updateFields.description = bestDesc;
      }

      if (Object.keys(updateFields).length > 0) {
        updateFields.updatedAt = new Date();
        prodBulkOps.push({
          updateOne: {
            filter: { _id: p._id },
            update: { $set: updateFields },
          },
        });
      }
    });

    if (prodBulkOps.length > 0) {
      const CHUNK = 250;
      for (let i = 0; i < prodBulkOps.length; i += CHUNK) {
        await db.Product.bulkWrite(prodBulkOps.slice(i, i + CHUNK), { ordered: false });
      }
      prodImagesUpdated = prodBulkOps.length;
    }

    // Also update Inventory items missing images
    if (existingInventories.length > 0 && db.Inventory) {
      const stockBulkOps = [];
      existingInventories.forEach((inv) => {
        if (!inv.skuCode) return;
        const currentImg = (inv.imageUrl || '').trim();
        const isMissingImg = !currentImg || currentImg.toLowerCase() === 'null' || currentImg.includes('placeholder');
        if (isMissingImg) {
          const skuUpper = inv.skuCode.trim().toUpperCase();
          const baseUpper = extractBaseSku(inv.skuCode).trim().toUpperCase();
          const bestImg = baseSkuImageMap.get(skuUpper) || baseSkuImageMap.get(baseUpper) || '';
          if (bestImg) {
            stockBulkOps.push({
              updateOne: {
                filter: { _id: inv._id },
                update: { $set: { imageUrl: bestImg } },
              },
            });
          }
        }
      });
      if (stockBulkOps.length > 0) {
        await db.Inventory.bulkWrite(stockBulkOps, { ordered: false }).catch(() => {});
      }
    }

    clearProductImageCache();

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`[CatalogImageSync] ✅ Completed in ${durationSec}s. New Products: ${newProductsSaved}, InventoryProduct Updated: ${invImagesUpdated}, Product Updated: ${prodImagesUpdated}.`);

    return {
      success: true,
      durationSec,
      totalUniware: uniwareItems.length,
      newProductsSaved,
      inventoryImagesUpdated: invImagesUpdated,
      productImagesUpdated: prodImagesUpdated,
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
