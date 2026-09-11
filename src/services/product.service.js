const db = require('../db/models');
const { extractBaseSku } = require('../utils/skuHelper');

const getProducts = async (skuCodes) => {
  return await db.Product.find({ skuCode: { $in: skuCodes } }).lean();
};

const fetchProductImages = async (skuCodes) => {
  if (!Array.isArray(skuCodes) || skuCodes.length === 0) return {};

  const cleanSkus = skuCodes.filter(Boolean);
  const baseSkus = [...new Set(cleanSkus.map(s => extractBaseSku(s)))];
  
  // Build regexes to match base SKUs with any variation suffix or exact match
  const regexes = baseSkus.map(s => new RegExp('^' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([-_]|$)', 'i'));
  
  const acc = {};
  
  // Helper to store image for base SKU and any variation SKUs
  const registerImage = (skuCode, imageUrl) => {
    if (!skuCode || !imageUrl) return;
    const base = extractBaseSku(skuCode);
    if (base && !acc[base]) {
      acc[base] = imageUrl;
    }
    if (!acc[skuCode]) {
      acc[skuCode] = imageUrl;
    }
    // Also match any input SKU that shares this base SKU
    cleanSkus.forEach(inputSku => {
      if (extractBaseSku(inputSku) === base && !acc[inputSku]) {
        acc[inputSku] = imageUrl;
      }
    });
  };

  // 1. Query InventoryProduct for matching SKUs
  const invProducts = await db.InventoryProduct.find({
    skuCode: { $in: regexes },
    imageUrl: { $exists: true, $nin: [null, ''] }
  }).lean();

  invProducts.forEach(product => {
    registerImage(product.skuCode, product.imageUrl);
  });

  // 2. Query Product collection for any missing base SKUs
  const missingBaseSkus = baseSkus.filter(b => !acc[b]);
  if (missingBaseSkus.length > 0) {
    const missingRegexes = missingBaseSkus.map(s => new RegExp('^' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([-_]|$)', 'i'));
    const products = await db.Product.find({
      skuCode: { $in: [...missingBaseSkus, ...missingRegexes] },
      imageUrl: { $exists: true, $nin: [null, ''] }
    }).lean();

    products.forEach(product => {
      registerImage(product.skuCode, product.imageUrl);
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
          salesCount: { $sum: 1 },
          itemTypeBrand: { $first: '$itemTypeBrand' },
          sellableAmount: {
            $sum: {
              $multiply: [
                { $ifNull: ['$saleCount', 0] },
                {
                  $convert: {
                    input: '$totalPrice',
                    to: 'double',
                    onError: 0.0,
                    onNull: 0.0,
                  },
                },
              ],
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
              $multiply: [
                { $ifNull: ['$saleCount', 0] },
                {
                  $convert: {
                    input: '$totalPrice',
                    to: 'double',
                    onError: 0.0,
                    onNull: 0.0,
                  },
                },
              ],
            },
          },
          maxOrderDate: { $max: '$orderDate' },
          salesCount: { $sum: 1 },
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
};
