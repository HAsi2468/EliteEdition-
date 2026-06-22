const db = require('../db/models');

const getProducts = async (skuCodes) => {
  return await db.Product.find({ skuCode: { $in: skuCodes } }).lean();
};

const fetchProductImages = async (skuCodes) => {
  const regexes = skuCodes.filter(Boolean).map(s => new RegExp('^' + s + '(_|$)', 'i'));
  
  // 1. Query InventoryProduct for matching SKUs
  const invProducts = await db.InventoryProduct.find({
    skuCode: { $in: regexes },
    imageUrl: { $exists: true, $nin: [null, ''] }
  }).lean();

  const acc = {};
  
  // 2. Map base SKU from InventoryProduct (e.g. 266_XL -> 266)
  invProducts.forEach(product => {
    const baseSku = product.skuCode ? product.skuCode.split('_')[0] : '';
    if (baseSku && !acc[baseSku]) {
      acc[baseSku] = product.imageUrl;
    }
  });

  // 3. Fallback to Product collection for any missing base SKUs
  const products = await db.Product.find({
    skuCode: { $in: skuCodes },
    imageUrl: { $exists: true, $nin: [null, ''] }
  }).lean();

  products.forEach(product => {
    const baseSku = product.skuCode ? product.skuCode.split('_')[0] : '';
    if (baseSku && !acc[baseSku]) {
      acc[baseSku] = product.imageUrl;
    }
  });

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
