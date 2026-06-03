const db = require('../db/models');
const { fetchProductImages } = require('./product.service');

const getSalseListFromDB = async (
  page,
  pageSize,
  sortField,
  sortOrder,
  whereClause
) => {
  try {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(pageSize, 10) || 10;
    const offset = (pageNum - 1) * limitNum;

    let totalRecords;
    if (sortField && sortOrder) {
      const countResult = await db.SalesList.aggregate([
        { $match: whereClause },
        { $group: { _id: '$itemSKUCode' } },
        { $count: 'count' },
      ]);
      totalRecords = countResult.length > 0 ? countResult[0].count : 0;
    } else {
      totalRecords = await db.SalesList.countDocuments(whereClause);
    }
    
    const totalPages = Math.ceil(totalRecords / limitNum);

    let salesList;

    if (!sortField || !sortOrder) {
      const list = await db.SalesList.find(whereClause)
        .sort({ orderDate: -1 })
        .skip(offset)
        .limit(limitNum)
        .lean();

      salesList = list.map((item) => ({
        ...item,
        id: item._id.toString(),
        itemSKUCodeCount: (item.saleCount || 1).toString(),
      }));
    } else {
      if (sortField === 'itemSKUCode') {
        sortField = 'itemSKUCodeCount';
      }
      
      const sortDirection = sortOrder.toLowerCase() === 'desc' ? -1 : 1;

      const pipeline = [
        { $match: whereClause },
        {
          $group: {
            _id: '$itemSKUCode',
            id: { $max: '$_id' },
            facility: { $max: '$facility' },
            category: { $max: '$category' },
            itemTypeColor: { $max: '$itemTypeColor' },
            itemTypeBrand: { $max: '$itemTypeBrand' },
            itemTypeSize: { $max: '$itemTypeSize' },
            mrp: { $max: '$mrp' },
            totalPrice: { $max: '$totalPrice' },
            discount: { $max: '$discount' },
            shippingAddressCity: { $max: '$shippingAddressCity' },
            shippingAddressState: { $max: '$shippingAddressState' },
            shippingAddressPincode: { $max: '$shippingAddressPincode' },
            saleOrderStatus: { $max: '$saleOrderStatus' },
            orderDate: { $max: '$orderDate' },
            skuName: { $max: '$skuName' },
            itemSKUCodeCount: { $sum: '$saleCount' },
          },
        },
        {
          $project: {
            _id: 0,
            itemSKUCode: '$_id',
            id: 1,
            facility: 1,
            category: 1,
            itemTypeColor: 1,
            itemTypeBrand: 1,
            itemTypeSize: 1,
            mrp: 1,
            totalPrice: 1,
            discount: 1,
            shippingAddressCity: 1,
            shippingAddressState: 1,
            shippingAddressPincode: 1,
            saleOrderStatus: 1,
            orderDate: 1,
            skuName: 1,
            itemSKUCodeCount: 1,
          },
        },
        { $sort: { [sortField]: sortDirection } },
        { $skip: offset },
        { $limit: limitNum },
      ];

      const list = await db.SalesList.aggregate(pipeline);
      salesList = list.map((item) => ({
        ...item,
        id: item.id ? item.id.toString() : '',
        itemSKUCodeCount: (item.itemSKUCodeCount || 1).toString(),
      }));
    }

    const skuCodes = salesList.map((order) => order.itemSKUCode);
    const productMap = await fetchProductImages(skuCodes);

    const salesListWithCounts = salesList.map((sale) => ({
      ...sale,
      productImage: productMap[sale.itemSKUCode] || null,
    }));

    return {
      data: salesListWithCounts,
      meta: {
        currentPage: pageNum,
        pageSize: limitNum,
        totalPages,
      },
    };
  } catch (error) {
    console.debug('error:', error);
    return {
      data: [],
      totalPages: 0,
      totalRecords: 0,
      error,
    };
  }
};

module.exports = {
  getSalseListFromDB,
};
