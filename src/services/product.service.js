const db = require('../db/models');

const getProducts = async (skuCodes) => {
  return await db.Product.find({ skuCode: { $in: skuCodes } }).lean();
};

const fetchProductImages = async (skuCodes) => {
  const products = await getProducts(skuCodes);
  return products.reduce((acc, product) => {
    const baseSku = product.skuCode ? product.skuCode.split('_')[0] : '';
    acc[baseSku] = product.imageUrl;
    return acc;
  }, {});
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
        },
      },
      {
        $project: {
          _id: 0,
          skuName: '$_id',
          salesCount: 1,
          itemTypeBrand: 1,
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
