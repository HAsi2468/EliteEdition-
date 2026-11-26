const db = require('../db/models');
const { fetchProductImages } = require('./product.service');

const getSalseListFromDB = async (
  page,
  pageSize,
  sortField,
  sortOrder,
  whereClause,
  groupBy = 'order'
) => {
  try {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(pageSize, 10) || 10;
    const offset = (pageNum - 1) * limitNum;
    const isSkuGroup = groupBy === 'sku';

    const ALLOWED_SORT_FIELDS = new Set([
      'orderDate', 'itemSKUCode', 'category', 'shippingAddressCity',
      'totalPrice', 'discount', 'saleCount', 'saleOrderStatus', 'mrp'
    ]);
    const validSortField = ALLOWED_SORT_FIELDS.has(sortField) ? sortField : 'orderDate';
    const sortDir = String(sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1;

    // Aggregate order-level summary metrics for filtered dataset so KPI cards match full query
    const summaryPromise = db.SalesList.aggregate([
      { $match: whereClause },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ['$totalPrice', 0] } },
          totalUnits: { $sum: { $ifNull: ['$saleCount', 1] } },
          deliveredCount: {
            $sum: {
              $cond: [{ $in: [{ $toUpper: { $ifNull: ['$saleOrderStatus', ''] } }, ['DELIVERED', 'COMPLETE']] }, 1, 0]
            }
          },
          transitCount: {
            $sum: {
              $cond: [{ $in: [{ $toUpper: { $ifNull: ['$saleOrderStatus', ''] } }, ['SHIPPED', 'IN_TRANSIT', 'PROCESSING']] }, 1, 0]
            }
          },
          cancelledCount: {
            $sum: {
              $cond: [{ $in: [{ $toUpper: { $ifNull: ['$saleOrderStatus', ''] } }, ['CANCELLED', 'RETURNED']] }, 1, 0]
            }
          }
        }
      }
    ]);

    let totalRecords;
    if (isSkuGroup) {
      const countResult = await db.SalesList.aggregate([
        { $match: whereClause },
        { $group: { _id: '$itemSKUCode' } },
        { $count: 'count' },
      ]);
      totalRecords = countResult.length > 0 ? countResult[0].count : 0;
    } else {
      totalRecords = await db.SalesList.countDocuments(whereClause);
    }

    const totalPages = Math.ceil(totalRecords / limitNum) || 1;
    let salesList;

    if (!isSkuGroup) {
      const sortObj = validSortField === 'orderDate'
        ? { orderDate: sortDir, _id: sortDir }
        : { [validSortField]: sortDir, orderDate: -1 };
      const list = await db.SalesList.find(whereClause)
        .sort(sortObj)
        .skip(offset)
        .limit(limitNum)
        .lean();

      salesList = list.map((item) => ({
        ...item,
        id: item._id.toString(),
        itemSKUCodeCount: (item.saleCount || 1).toString(),
      }));
    } else {
      const aggSortField = validSortField === 'saleCount' ? 'itemSKUCodeCount' : validSortField;
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
            totalPrice: { $sum: { $ifNull: ['$totalPrice', 0] } },
            discount: { $sum: { $ifNull: ['$discount', 0] } },
            shippingAddressCity: { $max: '$shippingAddressCity' },
            shippingAddressState: { $max: '$shippingAddressState' },
            shippingAddressPincode: { $max: '$shippingAddressPincode' },
            saleOrderStatus: { $max: '$saleOrderStatus' },
            orderDate: { $max: '$orderDate' },
            skuName: { $max: '$skuName' },
            itemSKUCodeCount: { $sum: { $ifNull: ['$saleCount', 1] } },
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
        { $sort: { [aggSortField]: sortDir } },
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
    const [productMap, summaryRows] = await Promise.all([
      fetchProductImages(skuCodes),
      summaryPromise
    ]);
    const summary = summaryRows[0] || {
      totalOrders: totalRecords,
      totalRevenue: 0,
      totalUnits: 0,
      deliveredCount: 0,
      transitCount: 0,
      cancelledCount: 0
    };

    const salesListWithCounts = salesList.map((sale) => ({
      ...sale,
      productImage: productMap[sale.itemSKUCode] || null,
    }));

    return {
      data: salesListWithCounts,
      totalPages,
      totalRecords,
      summary,
      meta: {
        currentPage: pageNum,
        pageSize: limitNum,
        totalPages,
        totalRecords,
        summary,
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
