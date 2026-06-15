const db = require('../db/models');
const logger = require('../config/logger');

// ─────────────────────────────────────────────────────────────
// Helper: build date-range filter
// ─────────────────────────────────────────────────────────────
const buildDateFilter = (dateStart, dateEnd) => {
  const filter = {};
  if (dateStart || dateEnd) {
    filter.orderDate = {};
    if (dateStart) filter.orderDate.$gte = new Date(dateStart);
    if (dateEnd) {
      const end = new Date(dateEnd);
      end.setHours(23, 59, 59, 999);
      filter.orderDate.$lte = end;
    }
  }
  return filter;
};

// ─────────────────────────────────────────────────────────────
// Helper: price tier label
// ─────────────────────────────────────────────────────────────
const getPriceTier = (price) => {
  const p = Number(price) || 0;
  if (p < 500) return 'Tier 1 (Under ₹499)';
  if (p < 1000) return 'Tier 2 (₹500-₹999)';
  return 'Tier 3 (₹1000+)';
};

// ═════════════════════════════════════════════════════════════
// 1. VARIANT ANALYTICS — Size Fit Matrix + Color Performance
// ═════════════════════════════════════════════════════════════
const getVariantAnalytics = async (req, res) => {
  try {
    const { dateStart, dateEnd, category, brand } = req.query;
    const dateFilter = buildDateFilter(dateStart, dateEnd);

    // Build match stage
    const matchStage = { ...dateFilter };
    if (category) matchStage.category = category;
    if (brand) matchStage.itemTypeBrand = brand;

    // Aggregate sales by SKU/Size/Color
    const salesAgg = await db.SaleOrder.aggregate([
      { $match: matchStage },
      {
        $addFields: {
          priceNum: { $toDouble: { $ifNull: ['$totalPrice', '0'] } },
        },
      },
      {
        $group: {
          _id: {
            sku: '$itemSKUCode',
            size: { $ifNull: ['$itemTypeSize', 'Unknown'] },
            color: { $ifNull: ['$itemTypeColor', 'Unknown'] },
            brand: { $ifNull: ['$itemTypeBrand', 'Unknown'] },
          },
          salesCount: { $sum: 1 },
          revenue: { $sum: '$priceNum' },
          statuses: { $push: '$saleOrderStatus' },
        },
      },
      { $sort: { salesCount: -1 } },
    ]);

    // Count returns (status contains RETURN or CANCELLED)
    const returnStatuses = ['RETURN_EXPECTED', 'RETURN_RECEIVED', 'CANCELLED'];

    // Build Size Fit Matrix — group by parent SKU (strip size/color suffix)
    const matrixMap = {}; // parentSku -> { sizes: { S: { sales, returns } } }
    const colorRevenue = {}; // color -> revenue
    let totalRevenue = 0;
    let totalSales = 0;
    let totalReturns = 0;
    const allSizes = new Set();
    const skuSet = new Set();

    salesAgg.forEach((row) => {
      const { sku, size, color, brand: skuBrand } = row._id;
      const parentSku = sku ? sku.replace(/-[A-Z0-9]+$/i, '') : sku;
      skuSet.add(sku);
      allSizes.add(size);

      // Count returns in this group
      const returnCount = row.statuses.filter((s) =>
        returnStatuses.includes(s)
      ).length;
      const netSales = row.salesCount - returnCount;

      totalRevenue += row.revenue;
      totalSales += row.salesCount;
      totalReturns += returnCount;

      // Size Fit Matrix
      if (!matrixMap[parentSku]) {
        matrixMap[parentSku] = { brand: skuBrand, sizes: {}, totalSales: 0, totalReturns: 0 };
      }
      if (!matrixMap[parentSku].sizes[size]) {
        matrixMap[parentSku].sizes[size] = { sales: 0, returns: 0 };
      }
      matrixMap[parentSku].sizes[size].sales += row.salesCount;
      matrixMap[parentSku].sizes[size].returns += returnCount;
      matrixMap[parentSku].totalSales += row.salesCount;
      matrixMap[parentSku].totalReturns += returnCount;

      // Color revenue
      if (!colorRevenue[color]) colorRevenue[color] = 0;
      colorRevenue[color] += row.revenue;
    });

    // Convert matrix to array
    const sizeFitMatrix = Object.entries(matrixMap)
      .map(([parentSku, data]) => ({
        parentSku,
        brand: data.brand,
        totalSales: data.totalSales,
        totalReturns: data.totalReturns,
        returnRate: data.totalSales > 0 ? ((data.totalReturns / data.totalSales) * 100).toFixed(1) : '0.0',
        sizes: data.sizes,
      }))
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 50); // Top 50 parent SKUs

    // Color performance sorted
    const colorPerformance = Object.entries(colorRevenue)
      .map(([color, revenue]) => ({ color, revenue: Math.round(revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20);

    // Available sizes sorted
    const sizeOrder = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '3XL', '4XL', '5XL'];
    const sortedSizes = [...allSizes].sort((a, b) => {
      const ia = sizeOrder.indexOf(a);
      const ib = sizeOrder.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    // Get distinct categories and brands for filter dropdowns
    const categories = await db.SaleOrder.distinct('category', dateFilter);
    const brands = await db.SaleOrder.distinct('itemTypeBrand', dateFilter);

    res.json({
      success: true,
      summary: {
        totalSkus: skuSet.size,
        totalSales,
        totalReturns,
        totalRevenue: Math.round(totalRevenue),
        returnRate: totalSales > 0 ? ((totalReturns / totalSales) * 100).toFixed(1) : '0.0',
        avgOrderValue: totalSales > 0 ? Math.round(totalRevenue / totalSales) : 0,
      },
      sizeFitMatrix,
      availableSizes: sortedSizes,
      colorPerformance,
      filters: {
        categories: categories.filter(Boolean).sort(),
        brands: brands.filter(Boolean).sort(),
      },
    });
  } catch (error) {
    logger.error('Variant analytics error: %o', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════
// 2. DEMOGRAPHICS ANALYTICS — State/City + Price Tiers
// ═════════════════════════════════════════════════════════════
const getDemographicsAnalytics = async (req, res) => {
  try {
    const { dateStart, dateEnd, state } = req.query;
    const dateFilter = buildDateFilter(dateStart, dateEnd);
    const matchStage = { ...dateFilter };
    if (state) matchStage.shippingAddressState = state;

    // State-wise aggregation
    const stateAgg = await db.SaleOrder.aggregate([
      { $match: matchStage },
      {
        $addFields: {
          priceNum: { $toDouble: { $ifNull: ['$totalPrice', '0'] } },
        },
      },
      {
        $group: {
          _id: { $ifNull: ['$shippingAddressState', 'Unknown'] },
          orders: { $sum: 1 },
          revenue: { $sum: '$priceNum' },
          topSizes: { $push: '$itemTypeSize' },
          topColors: { $push: '$itemTypeColor' },
        },
      },
      { $sort: { orders: -1 } },
    ]);

    // Process state data
    const stateData = stateAgg.map((row) => {
      // Find most common size
      const sizeCounts = {};
      row.topSizes.filter(Boolean).forEach((s) => { sizeCounts[s] = (sizeCounts[s] || 0) + 1; });
      const topSize = Object.entries(sizeCounts).sort((a, b) => b[1] - a[1])[0];

      // Find most common color
      const colorCounts = {};
      row.topColors.filter(Boolean).forEach((c) => { colorCounts[c] = (colorCounts[c] || 0) + 1; });
      const topColor = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0];

      return {
        state: row._id,
        orders: row.orders,
        revenue: Math.round(row.revenue),
        aov: row.orders > 0 ? Math.round(row.revenue / row.orders) : 0,
        topSize: topSize ? topSize[0] : 'N/A',
        topColor: topColor ? topColor[0] : 'N/A',
      };
    });

    // City-wise top 10
    const cityAgg = await db.SaleOrder.aggregate([
      { $match: matchStage },
      {
        $addFields: {
          priceNum: { $toDouble: { $ifNull: ['$totalPrice', '0'] } },
        },
      },
      {
        $group: {
          _id: { $ifNull: ['$shippingAddressCity', 'Unknown'] },
          orders: { $sum: 1 },
          revenue: { $sum: '$priceNum' },
        },
      },
      { $sort: { orders: -1 } },
      { $limit: 10 },
    ]);

    const topCities = cityAgg.map((row) => ({
      city: row._id,
      orders: row.orders,
      revenue: Math.round(row.revenue),
    }));

    // Price Tier distribution per state (top 15 states)
    const tierAgg = await db.SaleOrder.aggregate([
      { $match: matchStage },
      {
        $addFields: {
          priceNum: { $toDouble: { $ifNull: ['$totalPrice', '0'] } },
        },
      },
      {
        $addFields: {
          priceTier: {
            $switch: {
              branches: [
                { case: { $lt: ['$priceNum', 500] }, then: 'Tier 1' },
                { case: { $lt: ['$priceNum', 1000] }, then: 'Tier 2' },
              ],
              default: 'Tier 3',
            },
          },
        },
      },
      {
        $group: {
          _id: {
            state: { $ifNull: ['$shippingAddressState', 'Unknown'] },
            tier: '$priceTier',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.state': 1 } },
    ]);

    // Reshape tier data
    const tierByState = {};
    tierAgg.forEach((row) => {
      const st = row._id.state;
      if (!tierByState[st]) tierByState[st] = { state: st, tier1: 0, tier2: 0, tier3: 0 };
      if (row._id.tier === 'Tier 1') tierByState[st].tier1 = row.count;
      else if (row._id.tier === 'Tier 2') tierByState[st].tier2 = row.count;
      else tierByState[st].tier3 = row.count;
    });

    const priceTierData = Object.values(tierByState)
      .sort((a, b) => (b.tier1 + b.tier2 + b.tier3) - (a.tier1 + a.tier2 + a.tier3))
      .slice(0, 15);

    // Available states for filter
    const availableStates = stateData.map((s) => s.state).filter((s) => s !== 'Unknown');

    res.json({
      success: true,
      stateData,
      topCities,
      priceTierData,
      availableStates,
    });
  } catch (error) {
    logger.error('Demographics analytics error: %o', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════
// 3. TIME HEATMAP — Month × Category/Color density grid
// ═════════════════════════════════════════════════════════════
const getTimeHeatmapData = async (req, res) => {
  try {
    const { dateStart, dateEnd, dimension = 'category' } = req.query;
    const dateFilter = buildDateFilter(dateStart, dateEnd);

    const dimensionField = dimension === 'color' ? '$itemTypeColor' : '$category';

    const heatmapAgg = await db.SaleOrder.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            month: { $month: '$orderDate' },
            year: { $year: '$orderDate' },
            dim: { $ifNull: [dimensionField, 'Unknown'] },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Build matrix: rows = dimension values, columns = months
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const matrixData = {};
    let maxCount = 0;

    heatmapAgg.forEach((row) => {
      const dim = row._id.dim;
      const monthIdx = row._id.month - 1;
      if (!matrixData[dim]) {
        matrixData[dim] = { label: dim, months: new Array(12).fill(0) };
      }
      matrixData[dim].months[monthIdx] += row.count;
      if (matrixData[dim].months[monthIdx] > maxCount) {
        maxCount = matrixData[dim].months[monthIdx];
      }
    });

    // Sort by total volume descending, take top 15
    const heatmapRows = Object.values(matrixData)
      .map((row) => ({ ...row, total: row.months.reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    res.json({
      success: true,
      months,
      dimension,
      heatmapRows,
      maxCount,
    });
  } catch (error) {
    logger.error('Time heatmap error: %o', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════
// 4. DEAD STOCK AGEING MONITOR
// ═════════════════════════════════════════════════════════════
const getDeadStockReport = async (req, res) => {
  try {
    const thresholdDays = parseInt(req.query.thresholdDays) || 60;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - thresholdDays);

    // Get all products with stock
    const products = await db.Product.find({
      enabled: { $ne: false },
    }).lean();

    // Get last sale date for each SKU
    const lastSaleAgg = await db.SaleOrder.aggregate([
      {
        $group: {
          _id: '$itemSKUCode',
          lastSaleDate: { $max: '$orderDate' },
          totalSold: { $sum: 1 },
        },
      },
    ]);

    const lastSaleMap = {};
    lastSaleAgg.forEach((row) => {
      lastSaleMap[row._id] = {
        lastSaleDate: row.lastSaleDate,
        totalSold: row.totalSold,
      };
    });

    const now = new Date();
    const deadStock = [];

    products.forEach((product) => {
      const saleInfo = lastSaleMap[product.skuCode];
      const lastSale = saleInfo ? saleInfo.lastSaleDate : null;

      // Check if this SKU has inventory
      let currentStock = 0;
      if (product.inventorySnapshots) {
        if (typeof product.inventorySnapshots === 'object') {
          // Try to extract stock count from snapshot
          const snapValues = Object.values(product.inventorySnapshots);
          snapValues.forEach((v) => {
            if (typeof v === 'number') currentStock += v;
            else if (v && typeof v === 'object' && v.inventory !== undefined) currentStock += Number(v.inventory) || 0;
            else if (v && typeof v === 'object' && v.openSale !== undefined) currentStock += Number(v.openSale) || 0;
          });
        }
      }

      // SKU qualifies if: (no sale ever) OR (last sale > threshold days ago)
      const daysSinceLastSale = lastSale
        ? Math.floor((now - new Date(lastSale)) / (1000 * 60 * 60 * 24))
        : 999;

      if (daysSinceLastSale >= thresholdDays) {
        deadStock.push({
          skuCode: product.skuCode,
          name: product.description || product.skuCode,
          brand: product.brand || 'Unknown',
          category: product.categoryName || 'Unknown',
          price: product.price || 0,
          currentStock,
          daysSinceLastSale,
          lastSaleDate: lastSale ? new Date(lastSale).toISOString().split('T')[0] : 'Never',
          createdAt: product.createdAt ? new Date(product.createdAt).toISOString().split('T')[0] : 'N/A',
        });
      }
    });

    // Sort by days since last sale descending
    deadStock.sort((a, b) => b.daysSinceLastSale - a.daysSinceLastSale);

    res.json({
      success: true,
      thresholdDays,
      totalDeadSkus: deadStock.length,
      deadStock: deadStock.slice(0, 100), // Top 100
    });
  } catch (error) {
    logger.error('Dead stock report error: %o', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═════════════════════════════════════════════════════════════
// 5. LOST REVENUE ESTIMATOR (Stockout Impact)
// ═════════════════════════════════════════════════════════════
const getLostRevenueEstimate = async (req, res) => {
  try {
    const { dateStart, dateEnd } = req.query;

    // Calculate 30-day trailing velocity for all SKUs
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const velocityAgg = await db.SaleOrder.aggregate([
      { $match: { orderDate: { $gte: thirtyDaysAgo } } },
      {
        $addFields: {
          priceNum: { $toDouble: { $ifNull: ['$totalPrice', '0'] } },
        },
      },
      {
        $group: {
          _id: '$itemSKUCode',
          totalSales30d: { $sum: 1 },
          avgPrice: { $avg: '$priceNum' },
          lastSaleDate: { $max: '$orderDate' },
        },
      },
      { $match: { totalSales30d: { $gte: 3 } } }, // Only active SKUs (at least 3 sales in 30 days)
      { $sort: { totalSales30d: -1 } },
    ]);

    // Get product stock info
    const products = await db.Product.find({}).lean();
    const productMap = {};
    products.forEach((p) => {
      let stock = 0;
      if (p.inventorySnapshots && typeof p.inventorySnapshots === 'object') {
        const snapValues = Object.values(p.inventorySnapshots);
        snapValues.forEach((v) => {
          if (typeof v === 'number') stock += v;
          else if (v && typeof v === 'object' && v.inventory !== undefined) stock += Number(v.inventory) || 0;
          else if (v && typeof v === 'object' && v.openSale !== undefined) stock += Number(v.openSale) || 0;
        });
      }
      productMap[p.skuCode] = {
        name: p.description || p.skuCode,
        brand: p.brand || 'Unknown',
        currentStock: stock,
        price: p.price || 0,
      };
    });

    const now = new Date();
    const lostRevenueItems = [];
    let totalLostRevenue = 0;

    velocityAgg.forEach((row) => {
      const product = productMap[row._id];
      if (!product) return;

      // Calculate daily velocity
      const dailyVelocity = row.totalSales30d / 30;

      // Check if currently out of stock (stock <= 0)
      if (product.currentStock <= 0) {
        // Days out of stock = days since last sale
        const daysOOS = row.lastSaleDate
          ? Math.floor((now - new Date(row.lastSaleDate)) / (1000 * 60 * 60 * 24))
          : 0;

        if (daysOOS > 0) {
          const unitPrice = row.avgPrice || product.price || 0;
          const estimatedLoss = Math.round(dailyVelocity * daysOOS * unitPrice);

          if (estimatedLoss > 0) {
            lostRevenueItems.push({
              skuCode: row._id,
              name: product.name,
              brand: product.brand,
              dailyVelocity: dailyVelocity.toFixed(2),
              daysOutOfStock: daysOOS,
              unitPrice: Math.round(unitPrice),
              estimatedLoss,
              lastSaleDate: row.lastSaleDate
                ? new Date(row.lastSaleDate).toISOString().split('T')[0]
                : 'N/A',
            });
            totalLostRevenue += estimatedLoss;
          }
        }
      }
    });

    // Sort by estimated loss descending
    lostRevenueItems.sort((a, b) => b.estimatedLoss - a.estimatedLoss);

    res.json({
      success: true,
      totalLostRevenue,
      totalAffectedSkus: lostRevenueItems.length,
      items: lostRevenueItems.slice(0, 50), // Top 50
    });
  } catch (error) {
    logger.error('Lost revenue estimate error: %o', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getVariantAnalytics,
  getDemographicsAnalytics,
  getTimeHeatmapData,
  getDeadStockReport,
  getLostRevenueEstimate,
};
