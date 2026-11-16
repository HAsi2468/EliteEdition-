const db = require('../db/models');
const { extractBaseSku } = require('../utils/skuHelper');
const { normalizeImageUrl, extractApiImageUrl } = require('../utils/imageUrlHelper');

const getProducts = async (skuCodes) => {
  return await db.Product.find({ skuCode: { $in: skuCodes } }).lean();
};

const imageCache = new Map();
const IMAGE_CACHE_MAX = 5000;

const clearProductImageCache = () => {
  imageCache.clear();
};

const fetchProductImages = async (skuCodes) => {
  if (!Array.isArray(skuCodes) || skuCodes.length === 0) return {};

  const cleanSkus = skuCodes.filter(Boolean).map((s) => String(s).trim());
  const acc = {};
  const unCachedSkus = [];

  for (const sku of cleanSkus) {
    const cached = imageCache.get(sku.toUpperCase());
    if (cached) {
      acc[sku] = cached;
    } else {
      unCachedSkus.push(sku);
    }
  }

  if (unCachedSkus.length === 0) {
    return acc;
  }

  const baseSkus = [...new Set(unCachedSkus.map((s) => extractBaseSku(s)).filter(Boolean))];
  const regexes = baseSkus.map((s) => new RegExp('^' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([-_]|$)', 'i'));

  const registerImage = (skuCode, rawImageUrl, brandCodes = []) => {
    const cleanUrl = normalizeImageUrl(rawImageUrl);
    if (!skuCode || !cleanUrl) return;
    const skuUpper = String(skuCode).trim().toUpperCase();
    const base = extractBaseSku(skuCode);
    const baseUpper = base ? base.trim().toUpperCase() : skuUpper;

    if (base && !acc[base]) acc[base] = cleanUrl;
    if (!acc[skuCode]) acc[skuCode] = cleanUrl;
    if (imageCache.size < IMAGE_CACHE_MAX) {
      imageCache.set(skuUpper, cleanUrl);
      if (baseUpper) imageCache.set(baseUpper, cleanUrl);
    }

    const brandCodeStrings = (Array.isArray(brandCodes) ? brandCodes : [])
      .map((bc) => (typeof bc === 'string' ? bc : bc?.code || ''))
      .filter(Boolean)
      .map((s) => s.trim().toUpperCase());

    cleanSkus.forEach((inputSku) => {
      const inUpper = inputSku.toUpperCase();
      const inBaseUpper = extractBaseSku(inputSku).trim().toUpperCase();
      if (
        !acc[inputSku] &&
        (inUpper === skuUpper ||
          inBaseUpper === baseUpper ||
          brandCodeStrings.includes(inUpper) ||
          brandCodeStrings.includes(inBaseUpper))
      ) {
        acc[inputSku] = cleanUrl;
        if (imageCache.size < IMAGE_CACHE_MAX) imageCache.set(inUpper, cleanUrl);
      }
    });
  };

  // 1. Query InventoryProduct for matching SKUs or brandCodes
  const invProducts = await db.InventoryProduct.find({
    $or: [
      { skuCode: { $in: regexes } },
      { brandCodes: { $in: unCachedSkus } },
      { 'brandCodes.code': { $in: unCachedSkus } },
    ],
    imageUrl: { $exists: true, $nin: [null, '', 'null'] },
  }).lean();

  invProducts.forEach((product) => {
    registerImage(product.skuCode, extractApiImageUrl(product) || product.imageUrl, product.brandCodes);
  });

  // 2. Query Product collection for any missing base SKUs
  const missingBaseSkus = baseSkus.filter((b) => !imageCache.has(b.toUpperCase()));
  if (missingBaseSkus.length > 0) {
    const missingRegexes = missingBaseSkus.map((s) => new RegExp('^' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([-_]|$)', 'i'));
    const products = await db.Product.find({
      skuCode: { $in: [...missingBaseSkus, ...missingRegexes] },
      imageUrl: { $exists: true, $nin: [null, '', 'null'] },
    }).lean();

    products.forEach((product) => {
      registerImage(product.skuCode, extractApiImageUrl(product) || product.imageUrl, product.brandCodes);
    });
  }

  // 3. Query Inventory collection for any still missing SKUs
  const stillMissing = baseSkus.filter((b) => !imageCache.has(b.toUpperCase()));
  if (stillMissing.length > 0 && db.Inventory) {
    const stillRegexes = stillMissing.map((s) => new RegExp('^' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([-_]|$)', 'i'));
    const invItems = await db.Inventory.find({
      skuCode: { $in: stillRegexes },
      imageUrl: { $exists: true, $nin: [null, '', 'null'] },
    }).lean();
    invItems.forEach((inv) => {
      registerImage(inv.skuCode, extractApiImageUrl(inv) || inv.imageUrl, inv.brandCodes);
    });
  }

  return acc;
};

const fetchSalesReportData = async (whereClause) => {
  const modeSku = !!whereClause?.itemSKUCode;
  
  if (modeSku) {
    const pipeline = [
      { $match: whereClause },
      {
        $group: {
          _id: '$skuName',
          salesCount: { $sum: { $ifNull: ['$saleCount', 1] } },
          itemTypeBrand: { $first: '$itemTypeBrand' },
          sellableAmount: {
            $sum: {
              $convert: {
                input: '$totalPrice',
                to: 'double',
                onError: 0.0,
                onNull: 0.0,
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          skuName: '$_id',
          salesCount: 1,
          itemTypeBrand: 1,
          sellableAmount: 1,
        },
      },
    ];
    return await db.SalesList.aggregate(pipeline);
  } else {
    const pipeline = [
      { $match: whereClause },
      {
        $group: {
          _id: '$itemSKUCode',
          sellableAmount: {
            $sum: {
              $convert: {
                input: '$totalPrice',
                to: 'double',
                onError: 0.0,
                onNull: 0.0,
              },
            },
          },
          maxOrderDate: { $max: '$orderDate' },
          salesCount: { $sum: { $ifNull: ['$saleCount', 1] } },
          skuName: { $first: '$skuName' },
          itemTypeBrand: { $first: '$itemTypeBrand' },
        },
      },
      {
        $project: {
          _id: 0,
          itemSKUCode: '$_id',
          sellableAmount: 1,
          salesCount: 1,
          skuName: 1,
          itemTypeBrand: 1,
          orderDate: {
            $dateToString: {
              format: '%d/%m/%Y',
              date: '$maxOrderDate',
            },
          },
        },
      },
    ];
    return await db.SalesList.aggregate(pipeline);
  }
};

module.exports = {
  fetchProductImages,
  fetchSalesReportData,
  clearProductImageCache,
};
