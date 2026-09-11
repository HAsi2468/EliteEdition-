const db = require('../db/models');
const logger = require('../config/logger');
const config = require('../config/config');
const {
  fetchProductData,
  getAccessToken,
  createExportJob,
  checkJobStatus,
  readFileFromUrl,
} = require('../services/api.service');
const { transformProducts, convertKeysV2 } = require('../utils/dataParser');
const {
  fetchProductImages,
  fetchSalesReportData,
} = require('../services/product.service');
const { extractBaseSku } = require('../utils/skuHelper');

const getOrders = async (
  page = 1,
  pageSize = 10,
  sortField,
  sortOrder,
  dateRange,
  skuCode = null,
  filters,
  useInventoryTable = false
) => {
  try {
    const offset = (page - 1) * pageSize;
    const limit = pageSize;

    const sortClause = {};
    if (sortField && sortOrder) {
      sortClause[sortField] = sortOrder.toLowerCase() === 'desc' ? -1 : 1;
    }

    const whereClause = {};

    if (dateRange && dateRange.start && dateRange.end) {
      whereClause.orderDate = {
        $gte: new Date(dateRange.start),
        $lte: new Date(dateRange.end),
      };
    }

    if (skuCode) {
      const skuArray = skuCode.split(',').map((code) => code.trim());
      whereClause.skuCode = { $in: skuArray };
    }
    if (filters) {
      if (filters.search) {
        const searchRegex = new RegExp(filters.search, 'i');
        whereClause.$or = [
          { skuCode: searchRegex },
          { description: searchRegex }
        ];
      }
      Object.keys(filters).forEach((filterKey) => {
        if (filterKey === 'search') return;
        const filterValue = filters[filterKey];
        if (filterValue) {
          if (filterKey === 'color' || filterKey === 'size') {
            const colors = filterValue.split(',').map((c) => c.trim());
            whereClause[filterKey] = { $in: colors };
          } else if (
            typeof filterValue === 'string' &&
            filterValue.includes(',')
          ) {
            whereClause[filterKey] = {
              $in: filterValue.split(',').map((value) => value.trim()),
            };
          } else {
            whereClause[filterKey] = filterValue;
          }
        }
      });
    }

    const collection = useInventoryTable ? db.InventoryProduct : db.Product;
    const products = await collection.find(whereClause)
      .sort(sortClause)
      .skip(offset)
      .limit(limit)
      .lean();

    return products.map((p) => ({ ...p, id: p._id.toString() }));
  } catch (error) {
    logger.error('Error fetching orders: %o', error);
    throw error;
  }
};

const getAllProductsList = async (req, res) => {
  const { page: defaultPage, limit: defaultLimit } = config.pagination;
  const {
    page = defaultPage,
    limit = defaultLimit,
    sortField,
    sortOrder,
    dateStart,
    dateEnd,
    search,
  } = req.query;

  try {
    const filters = {};
    if (search) {
      filters.search = search;
    }
    const allData = await getOrders(
      page,
      limit,
      sortField,
      sortOrder,
      {
        start: dateStart,
        end: dateEnd,
      },
      null,
      filters,
      true // useInventoryTable
    );
    res.send(allData);
  } catch (error) {
    res.status(500).send({ message: 'somtheng went wrong' });
  }
};

const readFile = async (url, accesstoken) => {
  const bgStartTime = Date.now();
  logger.info('[⏱️] Starting background CSV download and DB import...');
  logger.debug('readFile ~ url: %s', url);

  // Fetch CSV data from the provided URL
  const rawData = await readFileFromUrl(url, accesstoken);
  // If the fetch fails or returns empty, log a warning
  if (!rawData || rawData.length === 0) {
    logger.warn('No CSV data retrieved from URL: %s', url);
  }
  // Validate rows – ensure each has a SKU code; otherwise log and skip
  const formattedData = rawData.filter((row) => {
    if (!row.itemSKUCode) {
      logger.warn('Skipping CSV row missing itemSKUCode: %j', row);
      return false;
    }
    return true;
  });
  logger.info(`CSV import: ${rawData.length} rows fetched, ${formattedData.length} rows will be processed after validation.`);

  // Process the data in chunks
  const CHUNK_SIZE = 800; // Define chunk size
  const splitData = (data, size) => {
    const chunks = [];
    for (let i = 0; i < data.length; i += size) {
      chunks.push(data.slice(i, i + size));
    }
    return chunks;
  };

  // Split formatted data into smaller chunks
  const dataChunks = splitData(formattedData, CHUNK_SIZE);

  logger.info(`Processing ${dataChunks.length} chunks of data.`);

  let totalSaleOrdersStored = 0;
  let totalSalesListStored = 0;
  let totalProductsStored = 0;

  // Process chunks for SaleOrder
  for (const [index, chunk] of dataChunks.entries()) {
    logger.info(`Processing SaleOrder chunk ${index + 1}/${dataChunks.length}`);
    const orderCodes = chunk.map(item => item.saleOrderCode || item.displayorderCode).filter(Boolean);
    logger.info(`SaleOrders to process in this chunk: ${orderCodes.slice(0, 5).join(', ')}${orderCodes.length > 5 ? `... (+${orderCodes.length - 5} more)` : ''}`);
    const operations = chunk.map((item) => ({
      updateOne: {
        filter: { saleOrderItemCode: item.saleOrderItemCode },
        update: { $set: item },
        upsert: true,
      },
    }));
    const res = await db.SaleOrder.bulkWrite(operations, { ordered: false });
    totalSaleOrdersStored += (res ? res.upsertedCount + res.modifiedCount : chunk.length);
  }
  logger.info(`📊 Database Status: Stored/Upserted ${totalSaleOrdersStored} documents into db.SaleOrder.`);

  // Process chunks for SalesList with updates
  for (const [index, chunk] of dataChunks.entries()) {
    logger.info(`Processing SalesList chunk ${index + 1}/${dataChunks.length}`);
    const convertedChunk = convertKeysV2(chunk);
    const itemCodes = convertedChunk.map(item => item.saleOrderItemCode || item.itemCode).filter(Boolean);
    logger.info(`SalesList items to process in this chunk: ${itemCodes.slice(0, 5).join(', ')}${itemCodes.length > 5 ? `... (+${itemCodes.length - 5} more)` : ''}`);
    const operations = convertedChunk.map((item) => ({
      updateOne: {
        filter: { saleOrderItemCode: item.saleOrderItemCode },
        update: { $set: item },
        upsert: true,
      },
    }));
    const res = await db.SalesList.bulkWrite(operations, { ordered: false });
    totalSalesListStored += (res ? res.upsertedCount + res.modifiedCount : chunk.length);
    if (res) {
      logger.info(`📝 SalesList Chunk Result: ${res.upsertedCount} newly added (upserted), ${res.modifiedCount} updated (modified)`);
    }
  }
  logger.info(`📊 Database Status: Stored/Upserted ${totalSalesListStored} documents into db.SalesList.`);

  const allProductsMap = new Map();

  // Gather unique SKU codes
  const skuCodes = new Set(formattedData.map((item) => item.itemSKUCode));
  const skuChunks = splitData(Array.from(skuCodes), CHUNK_SIZE);

  logger.info(`Fetching product data for ${skuCodes.size} SKUs in ${skuChunks.length} chunks.`);

  // Fetch product data in chunks
  for (const [index, chunk] of skuChunks.entries()) {
    logger.info(`Fetching SKU chunk ${index + 1}/${skuChunks.length}`);
    const productDataPromises = chunk.map(async (skuCode) => {
      try {
        const { elements } = await fetchProductData(skuCode, accesstoken);
        if (elements.length > 0) {
          const found = formattedData.find((e) => e.itemSKUCode === skuCode);
          const orderDate = found ? found.orderDate : undefined;
          elements[0].orderDate = orderDate;
          allProductsMap.set(skuCode, elements[0]);
        }
        logger.info('Fetched data for SKU: %s', skuCode);
      } catch (error) {
        logger.error('Error fetching data for SKU: %s %o', skuCode, error);
      }
    });
    await Promise.all(productDataPromises);
  }

  logger.info(`Total fetched products: ${allProductsMap.size}`);

  // Transform and bulk insert products
  const transformedProducts = transformProducts(
    Array.from(allProductsMap.values())
  );

  // Process transformed products in chunks
  const productChunks = splitData(transformedProducts, CHUNK_SIZE);

  for (const [index, chunk] of productChunks.entries()) {
    logger.info(`Inserting Product chunk ${index + 1}/${productChunks.length}`);
    const skus = chunk.map(item => item.skuCode).filter(Boolean);
    logger.info(`Products (SKUs) to process in this chunk: ${skus.slice(0, 5).join(', ')}${skus.length > 5 ? `... (+${skus.length - 5} more)` : ''}`);
    
    // 1. Sync exact variations to InventoryProduct
    const inventoryOperations = chunk.map((item) => ({
      updateOne: {
        filter: { skuCode: item.skuCode },
        update: { $set: item },
        upsert: true,
      },
    }));
    await db.InventoryProduct.bulkWrite(inventoryOperations, { ordered: false });

    // 2. Sync grouped base SKUs to Product
    const productOperations = chunk.map((item) => {
      const baseSku = extractBaseSku(item.skuCode);
      const sizeToPush = item.size && item.size.length > 0 ? item.size[0] : null;
      
      const { size, ...itemWithoutSize } = item;
      const updateDoc = {
        $setOnInsert: { ...itemWithoutSize, skuCode: baseSku }
      };
      if (sizeToPush) {
        updateDoc.$addToSet = { size: sizeToPush };
      }

      return {
        updateOne: {
          filter: { skuCode: baseSku },
          update: updateDoc,
          upsert: true,
        },
      };
    });
    const res = await db.Product.bulkWrite(productOperations, { ordered: false });

    totalProductsStored += (res ? res.upsertedCount + res.modifiedCount : chunk.length);
    if (res) {
      logger.info(`📝 Product Chunk Result: ${res.upsertedCount} newly added (upserted), ${res.modifiedCount} updated (modified)`);
    }
  }
  logger.info(`📊 Database Status: Stored/Upserted ${totalProductsStored} documents into db.Product and db.InventoryProduct.`);
  // Detailed summary of import results
  logger.info(`SaleOrder – upserted/modified: ${totalSaleOrdersStored}`);
  logger.info(`SalesList – upserted/modified: ${totalSalesListStored}`);
  logger.info(`Products – upserted/modified: ${totalProductsStored}`);

  const elapsedSec = ((Date.now() - bgStartTime) / 1000).toFixed(2);
  logger.info(`[⏱️] Background DB Import completed in ${elapsedSec} seconds!`);
  logger.info('Data processing complete!');
};

const deletaAllProduct = async (req, res) => {
  await db.Product.deleteMany({});
  res.send('DONE');
};

const searchBySku = async (req, res) => {
  const { page: defaultPage, limit: defaultLimit } = config.pagination;
  const {
    page = defaultPage,
    limit = defaultLimit,
    skuCode,
    color,
    brand,
    size,
    categoryName,
  } = req.query;

  try {
    const allData = await getOrders(
      page,
      limit,
      null,
      null,
      {
        start: null,
        end: null,
      },
      skuCode,
      {
        color,
        brand,
        size,
        categoryName,
      }
    );
    res.send(allData);
  } catch (error) {
    res.status(500).send({ message: 'somtheng went wrong' });
  }
};

const fetchFromAPIS = async (req, res) => {
  // Disable Express-level timeout for this long‑running endpoint (if available)
  if (typeof res.setTimeout === 'function') {
    res.setTimeout(0);
  }
  const MAX_POLL_TIME_MS = 15 * 60 * 1000; // 15 minutes
  const POLL_INTERVAL_MS = 10000; // 10 seconds
  const startTime = Date.now();

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      // When token cannot be fetched (e.g., offline), return mock data to avoid 500 errors
      console.warn('Access token not available – returning mock response');
      return res.json({ message: 'Mock fetchFromAPIS result (no token)', data: [] });
    }

    const dateRangeText = req?.query?.dateRangeText || 'TODAY';
    const jobResult = await createExportJob(accessToken, dateRangeText);
    if (!jobResult || jobResult.error) {
      const errMsg = (jobResult && jobResult.error) || 'Failed to create export job';
      logger.error('Export job creation error: %s', errMsg);
      return res.status(500).json({ error: errMsg });
    }
    const jobCode = typeof jobResult === 'string' ? jobResult : jobResult.jobCode;

    while (Date.now() - startTime < MAX_POLL_TIME_MS) {
      // Check job status using helper
      try {
        const statusRes = await checkJobStatus(accessToken, jobCode);
        logger.info(`Current job status: ${statusRes ? statusRes.status : 'unknown'}`);
        console.log('statusRes payload:', JSON.stringify(statusRes, null, 2));
        
        if (statusRes && (statusRes.status === 'COMPLETE' || statusRes.status === 'COMPLETED' || (statusRes.successful && (statusRes.filePath || statusRes.downloadUrl)))) {
          const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
          console.log(`✅ Export job completed in ${elapsedSec} seconds`);
          // Retrieve CSV download URL from response
          const csvUrl = statusRes.filePath || statusRes.downloadUrl || statusRes.fileUrl || statusRes.url;
          if (csvUrl) {
            console.log('CSV download URL:', csvUrl);
            // Trigger reading/storing the CSV in background
            logger.info('Starting database background processing...');
            readFile(csvUrl, accessToken).catch((readErr) => {
              logger.error('Error processing/reading CSV data: %o', readErr);
            });
          } else {
            console.warn('CSV download URL not found in job status response');
          }
          // Respond with the URL (or jobCode) to the client
          return res.json({ jobCode, csvUrl });
        }
      } catch (statusErr) {
        console.error('Status check error:', statusErr.message);
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    // If we exit the loop, the job did not complete in time
    throw new Error('Export job polling timed out');
    
  } catch (err) {
    logger.error('Error in fetchFromAPIS: %o', err);
    logger.error('Stack: %s', err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

const fetchProductsSales = async (
  page = 1,
  pageSize = 10,
  sortField,
  sortOrder,
  dateRange,
  filters
) => {
  try {
    const offset = (page - 1) * pageSize;
    const limit = pageSize;

    const sortClause = {};
    if (sortField && sortOrder) {
      sortClause[sortField] = sortOrder.toLowerCase() === 'desc' ? -1 : 1;
    }

    const whereClause = {};

    if (dateRange && dateRange.start && dateRange.end) {
      whereClause.orderDate = {
        $gte: new Date(dateRange.start),
        $lte: new Date(dateRange.end),
      };
    }

    Object.keys(filters).forEach((filterKey) => {
      const filterValue = filters[filterKey];
      if (filterValue) {
        if (typeof filterValue === 'string' && filterValue.includes(',')) {
          whereClause[filterKey] = {
            $in: filterValue.split(',').map((value) => value.trim()),
          };
        } else if (filterKey === 'itemSKUCode') {
          const skuCodes = filterValue.split(',').map((value) => value.trim());
          whereClause.itemSKUCode = {
            $or: skuCodes.map((skuCode) => new RegExp(`^${skuCode}`, 'i')),
          };
        } else {
          whereClause[filterKey] = filterValue;
        }
      }
    });

    const salesOrders = await db.SaleOrder.find(whereClause)
      .sort(sortClause)
      .skip(offset)
      .limit(limit)
      .lean();

    const plainData = salesOrders.map((el) => ({ ...el, id: el._id.toString() }));
    const skuCodes = plainData.map((e) => e.itemSKUCode);

    // Compute itemSKUCodeCount for each itemSKUCode
    let countsMap = {};
    if (skuCodes.length > 0) {
      const counts = await db.SaleOrder.aggregate([
        { $match: { itemSKUCode: { $in: skuCodes } } },
        { $group: { _id: '$itemSKUCode', count: { $sum: 1 } } },
      ]);
      counts.forEach((c) => {
        countsMap[c._id] = c.count;
      });
    }

    plainData.forEach((e) => {
      e.itemSKUCodeCount = countsMap[e.itemSKUCode] || 0;
    });

    const productMap = await fetchProductImages(skuCodes);
    let accessToken = '';
    for (let i = 0; i < plainData.length; i++) {
      const e = plainData[i];
      e.productImage = productMap[e.itemSKUCode] || null;
      if (!e.productImage) {
        if (accessToken === '') accessToken = await getAccessToken();
        const { elements } = await fetchProductData(e.itemSKUCode, accessToken);
        e.productImage = (elements[0] ? elements[0].imageUrl : null) || null;
      }
    }
    return plainData;
  } catch (error) {
    logger.error('Error in fetchProductsSales: %o', error);
    throw error;
  }
};

const getProductsSales = async (req, res) => {
  const { page: defaultPage, limit: defaultLimit } = config.pagination;
  const {
    page = defaultPage,
    limit = defaultLimit,
    sortField,
    sortOrder,
    dateStart,
    dateEnd,
    category,
    shippingAddressCity,
    shippingAddressState,
    itemSKUCode,
    itemTypeColor,
    mrp,
    totalPrice,
    facility,
    itemTypeBrand,
    discount,
    shippingAddressPincode,
  } = req.query;

  try {
    const allData = await fetchProductsSales(
      page,
      limit,
      sortField,
      sortOrder,
      {
        start: dateStart,
        end: dateEnd,
      },
      {
        category,
        shippingAddressCity,
        shippingAddressState,
        itemSKUCode,
        itemTypeColor,
        mrp,
        totalPrice,
        facility,
        itemTypeBrand,
        discount,
        shippingAddressPincode,
      }
    );

    res.send({
      data: allData,
      meta: {
        currentPage: page,
        pageSize: limit,
      },
    });
  } catch (error) {
    logger.error('Error fetching product sales: %o', error);
    res.status(500).send({ message: 'Something went wrong' });
  }
};

const parseDateStart = (str) => {
  if (!str) return new Date();
  const cleanStr = String(str).trim();
  const datePart = cleanStr.includes('T') ? cleanStr.split('T')[0] : cleanStr.split(' ')[0];
  return new Date(`${datePart}T00:00:00+05:30`);
};

const parseDateEnd = (str) => {
  if (!str) return new Date();
  const cleanStr = String(str).trim();
  const datePart = cleanStr.includes('T') ? cleanStr.split('T')[0] : cleanStr.split(' ')[0];
  return new Date(`${datePart}T23:59:59.999+05:30`);
};

const buildWhereClause = (query) => {
  const { dateStart, dateEnd, searchCode } = query;
  const whereClause = { saleOrderStatus: { $ne: 'CANCELLED' } };

  if (dateStart) {
    whereClause.orderDate = {
      $gte: parseDateStart(dateStart),
      $lte: parseDateEnd(dateEnd || dateStart),
    };
  }
  if (searchCode) {
    whereClause.itemSKUCode = new RegExp(`^${searchCode}`, 'i');
  }
  return whereClause;
};

const enhanceSalesDataWithImages = (salesData, productMap) => {
  return salesData.map((order) => {
    const plainOrder = { ...order };
    const field = (plainOrder && plainOrder.itemSKUCode) ? 'itemSKUCode' : 'skuName';
    plainOrder.productImage =
      productMap[extractBaseSku(plainOrder[field])] || null;
    return plainOrder;
  });
};

const fetchSalesReport = async (req, res) => {
  try {
    const whereClause = buildWhereClause(req.query);
    const salesReport = await fetchSalesReportData(whereClause);
    const modeSku = !!whereClause.itemSKUCode;
    const field = modeSku ? 'skuName' : 'itemSKUCode';

    // Group variation SKUs (e.g. S-4_344-M, S-4_344_L) into Base SKU (S-4_344)
    const map = new Map();
    for (const item of salesReport) {
      const rawSku = item[field] || '';
      const baseSku = extractBaseSku(rawSku);
      if (!map.has(baseSku)) {
        map.set(baseSku, {
          ...item,
          [field]: baseSku,
          salesCount: Number(item.salesCount || 0),
          sellableAmount: Number(item.sellableAmount || 0),
        });
      } else {
        const existing = map.get(baseSku);
        existing.salesCount += Number(item.salesCount || 0);
        existing.sellableAmount += Number(item.sellableAmount || 0);
        if (item.orderDate && (!existing.orderDate || item.orderDate > existing.orderDate)) {
          existing.orderDate = item.orderDate;
        }
      }
    }
    const aggregatedReport = Array.from(map.values());

    const productMap = await fetchProductImages(
      aggregatedReport.map((order) => order[field])
    );
    const enhancedSalesData = enhanceSalesDataWithImages(
      aggregatedReport,
      productMap
    ).sort((a, b) => {
      return b.salesCount - a.salesCount;
    });
    res.send(
      modeSku
        ? enhancedSalesData.map((e) => ({ ...e, cr: '0', rto: '0' }))
        : enhancedSalesData
    );
  } catch (error) {
    logger.debug('fetchSalesReport error: %o', error);
    res.status(500).send('Internal Server Error');
  }
};

async function updateSaleCount(req, res) {
  try {
    const result = await db.SalesList.updateMany(
      { saleOrderStatus: 'CANCELLED' },
      { $set: { saleCount: 0 } }
    );
    res.send(`Rows updated: ${result.modifiedCount}`);
  } catch (error) {
    logger.error('Error updating saleCount: %o', error);
    res.status(500).send('Internal Server Error');
  }
}

const skimHO = async (req, res) => {
  try {
    const { skuCode } = req.query;
    const whereClause = {
      itemSKUCode: new RegExp(`^${skuCode}`, 'i'),
    };
    const filterdSku = await db.SalesList.find(whereClause).lean();
    const allProductsMap = new Map();
    const accessToken = '907de287-d50b-4403-86ae-ce1776901019';
    const productDataPromises = filterdSku.map(async ({ skuName }) => {
      const { elements } = await fetchProductData(skuName, accessToken);
      if (elements.length > 0) {
        elements[0].orderDate = filterdSku.find(
          (e) => e.itemSKUCode === skuCode
        ).orderDate;
        allProductsMap.set(skuCode, elements[0]);
      }
    });

    await Promise.all(productDataPromises);

    const transformedProducts = transformProducts(
      Array.from(allProductsMap.values())
    );
    const oldProduct = await db.Product.findOne({
      skuCode: new RegExp(`^${skuCode}`, 'i'),
    }).lean();
    res.send(oldProduct);
  } catch (error) {
    logger.debug('skimHO error: %o', error);
    res.status(500).send('Internal Server Error');
  }
};

async function deleteDuplicateProducts(req, res) {
  try {
    const duplicates = await db.Product.aggregate([
      { $group: { _id: '$skuCode', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);

    const allList = [];
    const totalDeletedRecord = [];
    for (const duplicate of duplicates) {
      const skuCode = duplicate._id;

      const products = await db.Product.find({ skuCode });
      if (products.length === 0) continue;
      const primaryProduct = products[0];
      for (let i = 1; i < products.length; i++) {
        const duplicateProduct = products[i];
        primaryProduct.color = [
          ...new Set([...primaryProduct.color, ...duplicateProduct.color]),
        ];
        primaryProduct.size = [
          ...new Set([...primaryProduct.size, ...duplicateProduct.size]),
        ];
        totalDeletedRecord.push(duplicateProduct);
        // await db.Product.deleteOne({ _id: duplicateProduct._id });
      }
      // await primaryProduct.save();
      allList.push(totalDeletedRecord.length);
    }

    res.send(allList);
  } catch (error) {
    console.error('Error deleting duplicate products:', error);
    res
      .status(500)
      .send('An error occurred while deleting duplicate products.');
  }
}

const runBackgroundImport = async (missingSKUs, accessToken) => {
  const CHUNK_SIZE = 800;
  const splitData = (data, size) => {
    const chunks = [];
    for (let i = 0; i < data.length; i += size) {
      chunks.push(data.slice(i, i + size));
    }
    return chunks;
  };
  
  const allProductsMap = new Map();
  const isBulkSync = !missingSKUs || missingSKUs.length === 0;

  if (!isBulkSync) {
    console.log(`[Background] Starting product fetch for ${missingSKUs.length} SKUs...`);
    const salesOrders = await db.SaleOrder.find({ itemSKUCode: { $in: missingSKUs } }, { itemSKUCode: 1, orderDate: 1, itemTypeName: 1 }).lean();
    
    for (const skuCode of missingSKUs) {
      try {
        const { elements } = await fetchProductData(skuCode, accessToken);
        if (elements && elements.length > 0) {
          const productInfo = elements[0];
          const foundOrder = salesOrders.find(o => o.itemSKUCode === skuCode);
          productInfo.orderDate = foundOrder ? foundOrder.orderDate : new Date();
          if (foundOrder && foundOrder.itemTypeName) {
            productInfo.description = foundOrder.itemTypeName;
          } else if (productInfo.name) {
            productInfo.description = productInfo.name;
          }
          allProductsMap.set(skuCode, productInfo);
        }
      } catch (err) {
        console.error(`[Background] Failed to fetch product details for SKU: ${skuCode}`, err.message);
      }
    }
  } else {
    console.log(`[Background] Starting bulk product fetch for ALL available products in Uniware...`);
    try {
      const axios = require('axios');
      const response = await axios.post(
        'https://eliteedition.unicommerce.com/services/rest/v1/product/itemType/search',
        {},
        {
          headers: {
            Authorization: `bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Cookie: 'unicommerce=app1',
          },
        }
      );
      if (response.data && response.data.elements) {
        response.data.elements.forEach((productInfo) => {
          if (productInfo.skuCode) {
            productInfo.orderDate = new Date();
            if (productInfo.name) productInfo.description = productInfo.name;
            allProductsMap.set(productInfo.skuCode, productInfo);
          }
        });
        console.log(`[Background] Successfully fetched ${allProductsMap.size} products from Uniware.`);
      }
    } catch (err) {
      console.error(`[Background] Failed to bulk fetch products from Uniware:`, err.message);
    }
  }
  
  if (allProductsMap.size === 0) {
    console.log('[Background] No new products retrieved to store.');
    return;
  }
  
  const transformedProducts = transformProducts(Array.from(allProductsMap.values()));
  const productChunks = splitData(transformedProducts, CHUNK_SIZE);
  
  let totalAddedProduct = 0;
  let totalAddedInventory = 0;
  
  for (const [index, chunk] of productChunks.entries()) {
    console.log(`[Background] Inserting chunk ${index + 1}/${productChunks.length}`);
    
    // 1. Sync exact variations to InventoryProduct
    const inventoryOperations = chunk.map((item) => ({
      updateOne: {
        filter: { skuCode: item.skuCode },
        update: { $set: item },
        upsert: true,
      },
    }));
    const invResult = await db.InventoryProduct.bulkWrite(inventoryOperations, { ordered: false });
    totalAddedInventory += invResult.upsertedCount + invResult.modifiedCount;

    // 2. Sync grouped base SKUs to Product
    const operations = chunk.map((item) => {
      const baseSku = extractBaseSku(item.skuCode);
      const { size, color, ...rest } = item;
      
      const cleanRest = {};
      for (const key in rest) {
        if (rest[key] !== null && rest[key] !== undefined) {
          cleanRest[key] = rest[key];
        }
      }
      
      delete cleanRest.skuCode; // Ensure exact skuCode doesn't override baseSku
      
      const updateDoc = { $set: cleanRest, $setOnInsert: { skuCode: baseSku } };
      
      if (size && size.length > 0) {
        updateDoc.$addToSet = updateDoc.$addToSet || {};
        updateDoc.$addToSet.size = { $each: size };
      }
      if (color && color.length > 0) {
        updateDoc.$addToSet = updateDoc.$addToSet || {};
        updateDoc.$addToSet.color = { $each: color };
      }
      
      return {
        updateOne: {
          filter: { skuCode: baseSku },
          update: updateDoc,
          upsert: true,
        },
      };
    });
    const result = await db.Product.bulkWrite(operations, { ordered: false });
    totalAddedProduct += result.upsertedCount + result.modifiedCount;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  console.log(`[Background] DB Import Complete! Added/Updated ${totalAddedProduct} grouped products and ${totalAddedInventory} exact inventory variants.`);
};

async function fetchMissingProduct(req, res) {
  try {
    let missingSKUs = [];
    const querySKU = req.query.itemSKUCode || req.body.itemSKUCode;
    const isBulkSync = req.query.bulk === 'true' || req.body.bulk === true || !querySKU;
    
    if (querySKU) {
      // If a specific SKU code is requested, always fetch and update it to keep it fresh
      missingSKUs = [querySKU];
    } else if (!isBulkSync) {
      // Fallback: Scan database for all unique SKU codes in sale_orders
      console.log('Scanning database for all unique SKU codes...');
      const salesOrders = await db.SaleOrder.find({}, { itemSKUCode: 1 }).lean();
      missingSKUs = [
        ...new Set(salesOrders.map((order) => order.itemSKUCode).filter(Boolean)),
      ];
    }
    
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return res.status(500).json({ error: 'Failed to retrieve access token from Unicommerce.' });
    }
    
    let expectedTimeSeconds = 0;
    
    if (isBulkSync) {
      console.log('Triggering bulk product sync from Unicommerce...');
      expectedTimeSeconds = 5; // Bulk fetch is fast
      runBackgroundImport([], accessToken).catch((err) => {
        console.error('Error in background missing product import:', err);
      });
      return res.json({
        message: 'Background bulk fetch started.',
        totalMissing: 'ALL',
        expectedTimeSeconds,
      });
    } else {
      console.log(`Missing SKUs to fetch:`, missingSKUs);
      if (missingSKUs.length === 0) {
        return res.json({
          message: 'No missing products found or specified product variation already exists.',
          totalMissing: 0,
          expectedTimeSeconds: 0
        });
      }
      expectedTimeSeconds = Math.ceil(missingSKUs.length * 0.4);
      runBackgroundImport(missingSKUs, accessToken).catch((err) => {
        console.error('Error in background missing product import:', err);
      });
      return res.json({
        message: 'Background fetch started.',
        totalMissing: missingSKUs.length,
        missingSKUs,
        expectedTimeSeconds,
      });
    }
  } catch (error) {
    logger.error('Error in fetchMissingProduct: %o', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

// ─────────────────────────────────────────────────────────────
// Normalize and Merge duplicate brand names & SKUs (case/space mismatch)
// ─────────────────────────────────────────────────────────────
const normalizeAndMergeBrands = (rawBrands) => {
  if (!Array.isArray(rawBrands)) return [];
  const brandMap = new Map();

  for (const b of rawBrands) {
    const rawBrandName = (b._id || b.brand || b.brandName || 'Unknown').toString().trim();
    if (!rawBrandName) continue;
    const cleanBrandKey = rawBrandName.toUpperCase();

    if (!brandMap.has(cleanBrandKey)) {
      brandMap.set(cleanBrandKey, {
        _id: rawBrandName,
        brand: rawBrandName,
        brandName: rawBrandName,
        brandQty: 0,
        brandAmt: 0,
        brandQuantity: 0,
        brandSellableAmount: 0,
        totalOrderQuantity: 0,
        totalSellableAmount: 0,
        productMap: new Map(),
      });
    }

    const targetBrand = brandMap.get(cleanBrandKey);
    const bQty = Number(b.brandQty || b.brandQuantity || b.totalOrderQuantity || 0);
    const bAmt = Number(b.brandAmt || b.brandSellableAmount || b.totalSellableAmount || 0);

    targetBrand.brandQty += bQty;
    targetBrand.brandAmt += bAmt;
    targetBrand.brandQuantity += bQty;
    targetBrand.brandSellableAmount += bAmt;
    targetBrand.totalOrderQuantity += bQty;
    targetBrand.totalSellableAmount += bAmt;

    const prods = b.products || [];
    for (const p of prods) {
      const rawSku = (p.sku || p.baseSku || '-').toString().trim();
      if (!rawSku) continue;
      const cleanSkuKey = rawSku.toUpperCase();

      if (!targetBrand.productMap.has(cleanSkuKey)) {
        targetBrand.productMap.set(cleanSkuKey, {
          sku: rawSku,
          qty: 0,
          amt: 0,
          total: 0,
          sellableAmount: 0,
          productQty: 0,
          productAmt: 0,
          skuQuantity: 0,
          skuSellableAmount: 0,
          variationMap: new Map(),
        });
      }

      const targetProd = targetBrand.productMap.get(cleanSkuKey);
      const pQty = Number(p.qty || p.total || p.skuQty || p.productQty || p.skuQuantity || 0);
      const pAmt = Number(p.amt || p.sellableAmount || p.skuAmt || p.productAmt || p.skuSellableAmount || 0);

      targetProd.qty += pQty;
      targetProd.amt += pAmt;
      targetProd.total += pQty;
      targetProd.sellableAmount += pAmt;
      targetProd.productQty += pQty;
      targetProd.productAmt += pAmt;
      targetProd.skuQuantity += pQty;
      targetProd.skuSellableAmount += pAmt;

      const vars = p.variations || [];
      for (const v of vars) {
        const rawSize = (v.size || 'N/A').toString().trim();
        const cleanSizeKey = rawSize.toUpperCase() || 'N/A';

        if (!targetProd.variationMap.has(cleanSizeKey)) {
          targetProd.variationMap.set(cleanSizeKey, {
            size: cleanSizeKey,
            quantity: 0,
            sellableAmount: 0,
          });
        }

        const targetVar = targetProd.variationMap.get(cleanSizeKey);
        targetVar.quantity += Number(v.quantity || 0);
        targetVar.sellableAmount += Number(v.sellableAmount || 0);
      }
    }
  }

  const mergedBrands = [];
  for (const b of brandMap.values()) {
    const products = [];
    for (const p of b.productMap.values()) {
      const variations = Array.from(p.variationMap.values());
      products.push({
        sku: p.sku,
        qty: p.qty,
        amt: p.amt,
        total: p.total,
        sellableAmount: p.sellableAmount,
        productQty: p.productQty,
        productAmt: p.productAmt,
        skuQuantity: p.skuQuantity,
        skuSellableAmount: p.skuSellableAmount,
        variations,
      });
    }
    mergedBrands.push({
      _id: b._id,
      brand: b.brand,
      brandName: b.brandName,
      brandQty: b.brandQty,
      brandAmt: b.brandAmt,
      brandQuantity: b.brandQuantity,
      brandSellableAmount: b.brandSellableAmount,
      totalOrderQuantity: b.totalOrderQuantity,
      totalSellableAmount: b.totalSellableAmount,
      products,
    });
  }

  return mergedBrands;
};

async function fetchBrandReport(req, res) {
  try {
    const whereClause = buildWhereClause(req.query);
    const rawOrders = await db.SalesList.find(whereClause).lean();

    const brandMap = new Map();
    for (const item of rawOrders) {
      const brand = (item.itemTypeBrand && item.itemTypeBrand.trim()) ? item.itemTypeBrand.trim() : "Unknown";
      const rawSku = item.itemSKUCode || "";
      const baseSku = extractBaseSku(rawSku);
      const size = (item.itemTypeSize && item.itemTypeSize.trim()) ? item.itemTypeSize.trim() : (extractSizeFromSku(rawSku) || "Unknown");
      const qty = Number(item.saleCount || 1);
      const price = parseFloat(item.totalPrice) || 0;
      const amt = qty * price;

      if (!brandMap.has(brand)) {
        brandMap.set(brand, { brand, productsMap: new Map(), brandQuantity: 0, brandSellableAmount: 0 });
      }
      const brandObj = brandMap.get(brand);
      brandObj.brandQuantity += qty;
      brandObj.brandSellableAmount += amt;

      if (!brandObj.productsMap.has(baseSku)) {
        brandObj.productsMap.set(baseSku, { sku: baseSku, total: 0, sellableAmount: 0, variationsMap: new Map() });
      }
      const prodObj = brandObj.productsMap.get(baseSku);
      prodObj.total += qty;
      prodObj.sellableAmount += amt;

      if (!prodObj.variationsMap.has(size)) {
        prodObj.variationsMap.set(size, { size, quantity: 0, sellableAmount: 0 });
      }
      const varObj = prodObj.variationsMap.get(size);
      varObj.quantity += qty;
      varObj.sellableAmount += amt;
    }

    const rawBrands = Array.from(brandMap.values()).map(b => ({
      _id: b.brand,
      brandQuantity: b.brandQuantity,
      brandSellableAmount: b.brandSellableAmount,
      products: Array.from(b.productsMap.values()).map(p => ({
        sku: p.sku,
        total: p.total,
        sellableAmount: p.sellableAmount,
        variations: Array.from(p.variationsMap.values())
      }))
    })).sort((a, b) => a._id.localeCompare(b._id));

    const aggregatedBrands = normalizeAndMergeBrands(rawBrands);
    
    // Gather all base SKUs to fetch product images
    const baseSkus = [];
    aggregatedBrands.forEach(b => {
      b.products.forEach(p => {
        if (p.sku) baseSkus.push(p.sku);
      });
    });
    
    const productImagesMap = await fetchProductImages(baseSkus);
    
    // Populate image URLs and format final response
    let totalOrderQuantity = 0;
    let totalSellableAmount = 0;
    
    const formattedBrands = aggregatedBrands.map(b => {
      totalOrderQuantity += b.brandQuantity;
      totalSellableAmount += b.brandSellableAmount;
      
      return {
        brand: b._id,
        totalOrderQuantity: b.brandQuantity,
        totalSellableAmount: Number(b.brandSellableAmount.toFixed(2)),
        products: b.products.map(p => {
          p.variations.sort((v1, v2) => v1.size.localeCompare(v2.size));
          
          return {
            sku: p.sku,
            imageUrl: productImagesMap[p.sku] || null,
            total: p.total,
            averageCount: p.total > 0 ? Number((p.total / p.variations.length).toFixed(2)) : 0,
            sellableAmount: Number(p.sellableAmount.toFixed(2)),
            variations: p.variations.map(v => ({
              size: v.size,
              quantity: v.quantity,
              sellableAmount: Number(v.sellableAmount.toFixed(2))
            }))
          };
        })
      };
    });
    
    // Format report date string
    const reportDate = req.query.dateStart 
      ? (req.query.dateEnd ? `${req.query.dateStart} to ${req.query.dateEnd}` : req.query.dateStart)
      : new Date().toISOString().split('T')[0];
      
    res.json({
      reportDate,
      totalOrderQuantity,
      totalSellableAmount: Number(totalSellableAmount.toFixed(2)),
      brands: formattedBrands
    });
    
  } catch (error) {
    logger.error('Error generating brand report: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}

async function fetchBrandReportHourWise(req, res) {
  try {
    const whereClause = buildWhereClause(req.query);
    const rawOrders = await db.SalesList.find(whereClause).lean();

    const hourMap = new Map();
    for (const item of rawOrders) {
      if (!item.orderDate) continue;
      const dateIST = new Date(new Date(item.orderDate).getTime() + (5.5 * 60 * 60 * 1000));
      const hour = dateIST.getUTCHours();
      const brand = (item.itemTypeBrand && item.itemTypeBrand.trim()) ? item.itemTypeBrand.trim() : "Unknown";
      const rawSku = item.itemSKUCode || "";
      const baseSku = extractBaseSku(rawSku);
      const size = (item.itemTypeSize && item.itemTypeSize.trim()) ? item.itemTypeSize.trim() : (extractSizeFromSku(rawSku) || "Unknown");
      const qty = Number(item.saleCount || 1);
      const price = parseFloat(item.totalPrice) || 0;
      const amt = qty * price;

      const key = `${hour}_${brand}_${baseSku}`;
      if (!hourMap.has(key)) {
        hourMap.set(key, {
          hour,
          brand,
          baseSku,
          variationsMap: new Map(),
          skuQuantity: 0,
          skuSellableAmount: 0
        });
      }
      const entry = hourMap.get(key);
      entry.skuQuantity += qty;
      entry.skuSellableAmount += amt;

      if (!entry.variationsMap.has(size)) {
        entry.variationsMap.set(size, { size, quantity: 0, sellableAmount: 0 });
      }
      const varObj = entry.variationsMap.get(size);
      varObj.quantity += qty;
      varObj.sellableAmount += amt;
    }

    const hoursGroupMap = new Map();
    for (const entry of hourMap.values()) {
      const { hour, brand, baseSku, skuQuantity, skuSellableAmount, variationsMap } = entry;
      const productObj = {
        sku: baseSku,
        total: skuQuantity,
        sellableAmount: skuSellableAmount,
        variations: Array.from(variationsMap.values())
      };

      const hourBrandKey = `${hour}_${brand}`;
      if (!hoursGroupMap.has(hourBrandKey)) {
        hoursGroupMap.set(hourBrandKey, {
          hour,
          brandName: brand,
          products: [],
          brandQuantity: 0,
          brandSellableAmount: 0
        });
      }
      const hb = hoursGroupMap.get(hourBrandKey);
      hb.products.push(productObj);
      hb.brandQuantity += skuQuantity;
      hb.brandSellableAmount += skuSellableAmount;
    }

    const finalHoursMap = new Map();
    for (const hb of hoursGroupMap.values()) {
      const { hour, brandName, products, brandQuantity, brandSellableAmount } = hb;
      const brandObj = {
        brandName,
        products,
        brandQuantity,
        brandSellableAmount
      };

      if (!finalHoursMap.has(hour)) {
        finalHoursMap.set(hour, {
          _id: hour,
          brands: [],
          hourQuantity: 0,
          hourSellableAmount: 0
        });
      }
      const hObj = finalHoursMap.get(hour);
      hObj.brands.push(brandObj);
      hObj.hourQuantity += brandQuantity;
      hObj.hourSellableAmount += brandSellableAmount;
    }

    const aggregatedHours = Array.from(finalHoursMap.values()).sort((a, b) => a._id - b._id);

    // Gather all base SKUs to fetch product images
    const baseSkus = [];
    aggregatedHours.forEach(h => {
      h.brands.forEach(b => {
        b.products.forEach(p => {
          if (p.sku) baseSkus.push(p.sku);
        });
      });
    });

    const productImagesMap = await fetchProductImages(baseSkus);

    // Pre-fill 24 hours
    const hourLookupMap = new Map();
    aggregatedHours.forEach(h => {
      hourLookupMap.set(h._id, h);
    });

    let totalOrderQuantity = 0;
    let totalSellableAmount = 0;

    const formattedHours = [];
    for (let h = 0; h < 24; h++) {
      const match = hourLookupMap.get(h);
      const hourLabel = `${h.toString().padStart(2, '0')}:00 - ${(h + 1).toString().padStart(2, '0')}:00`;
      
      let hourQuantity = 0;
      let hourSellableAmount = 0;
      let formattedBrands = [];

      if (match) {
        hourQuantity = match.hourQuantity;
        hourSellableAmount = match.hourSellableAmount;
        totalOrderQuantity += hourQuantity;
        totalSellableAmount += hourSellableAmount;

        formattedBrands = match.brands.map(b => ({
          brand: b.brandName,
          brandQuantity: b.brandQuantity,
          brandSellableAmount: Number(b.brandSellableAmount.toFixed(2)),
          products: b.products.map(p => {
            p.variations.sort((v1, v2) => v1.size.localeCompare(v2.size));
            return {
              sku: p.sku,
              imageUrl: productImagesMap[p.sku] || null,
              total: p.total,
              sellableAmount: Number(p.sellableAmount.toFixed(2)),
              variations: p.variations.map(v => ({
                size: v.size,
                quantity: v.quantity,
                sellableAmount: Number(v.sellableAmount.toFixed(2))
              }))
            };
          })
        }));
      }

      formattedHours.push({
        hour: h,
        hourLabel,
        hourQuantity,
        hourSellableAmount: Number(hourSellableAmount.toFixed(2)),
        brands: formattedBrands
      });
    }

    const reportDate = req.query.dateStart 
      ? (req.query.dateEnd ? `${req.query.dateStart} to ${req.query.dateEnd}` : req.query.dateStart)
      : new Date().toISOString().split('T')[0];

    res.json({
      reportDate,
      totalOrderQuantity,
      totalSellableAmount: Number(totalSellableAmount.toFixed(2)),
      hours: formattedHours
    });

  } catch (error) {
    logger.error('Error generating hour-wise brand report: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}


const createProduct = async (req, res) => {
  try {
    const { skuCode, description, imageUrl, size } = req.body;

    if (!skuCode) {
      return res.status(400).json({ error: 'skuCode is required' });
    }

    let sizeArray = [];
    if (Array.isArray(size)) {
      sizeArray = size;
    } else if (typeof size === 'string') {
      sizeArray = size.split(',').map(s => s.trim()).filter(Boolean);
    }

    const newProduct = await db.InventoryProduct.create({
      skuCode: skuCode.trim(),
      description,
      imageUrl,
      size: sizeArray,
      enabled: true,
      skuType: 'GOODS',
    });

    res.status(201).json({ ...newProduct.toObject(), id: newProduct._id.toString() });
  } catch (error) {
    logger.error('Error creating product: %o', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Product with this skuCode already exists' });
    }
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await db.InventoryProduct.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully', id: deleted._id.toString() });
  } catch (error) {
    logger.error('Error deleting product: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { skuCode, description, imageUrl, size } = req.body;

    const product = await db.InventoryProduct.findById(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (skuCode) {
      const skuClean = skuCode.trim();
      const existingProduct = await db.Product.findOne({ skuCode: skuClean, _id: { $ne: id } });
      if (existingProduct) {
        return res.status(400).json({ error: 'Product with this SKU code already exists' });
      }
      product.skuCode = skuClean;
    }

    if (description !== undefined) {
      product.description = description;
    }
    if (imageUrl !== undefined) {
      product.imageUrl = imageUrl;
    }

    if (size !== undefined) {
      let sizeArray = [];
      if (Array.isArray(size)) {
        sizeArray = size;
      } else if (typeof size === 'string') {
        sizeArray = size.split(',').map(s => s.trim()).filter(Boolean);
      }
      product.size = sizeArray;
    }

    await product.save();
    res.json({ ...product.toObject(), id: product._id.toString() });
  } catch (error) {
    logger.error('Error updating product: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const instantSyncFromSaleOrders = async (req, res) => {
  try {
    const { getAccessToken, fetchEntireCatalog } = require('../services/api.service');
    const token = await getAccessToken();
    if (!token) {
      return res.status(500).json({ error: 'Failed to get Unicommerce access token' });
    }
    
    // Fetch rich product details from Unicommerce catalog
    const catalogItems = await fetchEntireCatalog(token);
    // Create a map for quick lookup
    const catalogMap = new Map();
    for (const item of catalogItems) {
      if (item.skuCode) catalogMap.set(item.skuCode.trim(), item);
    }

    // Get active SKUs from SaleOrders
    const salesOrders = await db.SaleOrder.aggregate([
      {
        $group: {
          _id: "$itemSKUCode",
          size: { $first: "$itemTypeSize" },
          description: { $first: "$itemTypeName" }
        }
      }
    ]);

    let added = 0;
    let updated = 0;

    for (const order of salesOrders) {
      if (!order._id) continue;
      const skuCode = order._id.trim();
      const sizeArray = order.size ? [order.size] : [];
      
      // Get rich details from catalog if available, otherwise fallback to SaleOrder info
      const item = catalogMap.get(skuCode) || {};
      const description = item.name || order.description || skuCode;

      // 1. Sync to InventoryProduct (Exact Variations)
      const existingInvProduct = await db.InventoryProduct.findOne({ skuCode });
      if (existingInvProduct) {
        let changed = false;
        if (sizeArray.length > 0 && !existingInvProduct.size.includes(sizeArray[0])) {
           existingInvProduct.size.push(sizeArray[0]);
           changed = true;
        }
        // Update basic details if missing or default, respecting user custom modifications
        if (!existingInvProduct.description && item.name) {
           existingInvProduct.description = item.name;
           changed = true;
        }
        if (!existingInvProduct.imageUrl && item.imageUrl) {
           existingInvProduct.imageUrl = item.imageUrl;
           changed = true;
        }
        if ((!existingInvProduct.color || existingInvProduct.color.length === 0) && item.color) {
           existingInvProduct.color = [item.color];
           changed = true;
        }
        if (!existingInvProduct.brand && item.brand) {
           existingInvProduct.brand = item.brand;
           changed = true;
        }
        if (changed) {
           await existingInvProduct.save();
        }
      } else {
        await db.InventoryProduct.create({
          skuCode: skuCode,
          description: description,
          size: sizeArray,
          color: item.color ? [item.color] : [],
          brand: item.brand || null,
          imageUrl: item.imageUrl || "",
          price: item.price || null,
          categoryName: item.categoryName || null,
        });
      }

      // 2. Sync to Product (Grouped base SKU)
      const baseSku = extractBaseSku(skuCode);
      const existingProduct = await db.Product.findOne({ skuCode: baseSku });
      if (existingProduct) {
        let changed = false;
        if (sizeArray.length > 0 && !existingProduct.size.includes(sizeArray[0])) {
           existingProduct.size.push(sizeArray[0]);
           changed = true;
        }
        if (!existingProduct.description && item.name) {
           existingProduct.description = item.name;
           changed = true;
        }
        if (!existingProduct.imageUrl && item.imageUrl) {
           existingProduct.imageUrl = item.imageUrl;
           changed = true;
        }
        if (changed) {
           await existingProduct.save();
           updated++;
        }
      } else {
        await db.Product.create({
          skuCode: baseSku,
          description: description,
          size: sizeArray,
          imageUrl: item.imageUrl || ""
        });
        added++;
      }
    }

    res.json({ message: `Sync Complete. Processed ${salesOrders.length} active SKUs. Base Added: ${added}, Base Updated: ${updated}`, success: true });
  } catch (error) {
    logger.error('Error in instantSyncFromSaleOrders (Catalog Sync): %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

const resetAndSyncUniwareSkus = async (req, res) => {
  try {
    logger.info('🧹 Clearing existing mismatched SKU catalog (db.Product & db.InventoryProduct)...');
    await db.Product.deleteMany({});
    await db.InventoryProduct.deleteMany({});

    const accessToken = await getAccessToken();
    let catalogElements = [];

    if (accessToken) {
      try {
        catalogElements = await fetchEntireCatalog(accessToken);
      } catch (catErr) {
        logger.warn('fetchEntireCatalog failed or returned empty: %o', catErr.message);
      }
    }

    let addedCount = 0;
    const baseSkuSet = new Set();

    if (catalogElements && catalogElements.length > 0) {
      for (const item of catalogElements) {
        const rawSku = item.skuCode || item.code || item.itemSKUCode;
        if (!rawSku) continue;
        const baseSku = extractBaseSku(rawSku);

        await db.InventoryProduct.updateOne(
          { skuCode: rawSku },
          {
            $set: {
              skuCode: rawSku,
              description: item.name || item.description || item.categoryName || 'Uniware SKU',
              size: item.size ? [item.size] : [],
              color: item.color ? [item.color] : [],
              brand: item.brand || item.itemTypeBrand || 'Uniware',
              imageUrl: item.imageUrl || '',
              price: item.price || 0,
            }
          },
          { upsert: true }
        );

        if (!baseSkuSet.has(baseSku)) {
          baseSkuSet.add(baseSku);
          await db.Product.updateOne(
            { skuCode: baseSku },
            {
              $set: {
                skuCode: baseSku,
                description: item.name || item.description || item.categoryName || 'Uniware SKU',
                imageUrl: item.imageUrl || '',
              },
              $addToSet: {
                size: item.size || 'N/A'
              }
            },
            { upsert: true }
          );
          addedCount++;
        }
      }
    } else {
      const orders = await db.SaleOrder.find({}, { itemSKUCode: 1, itemTypeName: 1 }).lean();
      for (const o of orders) {
        if (!o.itemSKUCode) continue;
        const baseSku = extractBaseSku(o.itemSKUCode);

        await db.InventoryProduct.updateOne(
          { skuCode: o.itemSKUCode },
          {
            $set: {
              skuCode: o.itemSKUCode,
              description: o.itemTypeName || 'Uniware SKU',
              brand: 'Uniware',
            }
          },
          { upsert: true }
        );

        if (!baseSkuSet.has(baseSku)) {
          baseSkuSet.add(baseSku);
          await db.Product.updateOne(
            { skuCode: baseSku },
            {
              $set: {
                skuCode: baseSku,
                description: o.itemTypeName || 'Uniware SKU',
              }
            },
            { upsert: true }
          );
          addedCount++;
        }
      }
    }

    res.json({
      success: true,
      message: `Cleared old mismatched SKUs and synchronized ${baseSkuSet.size} fresh SKUs from Uniware.`,
      count: baseSkuSet.size,
    });
  } catch (error) {
    logger.error('Error in resetAndSyncUniwareSkus: %o', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

module.exports = {
  getAllProductsList,
  readFile,
  deletaAllProduct,
  searchBySku,
  fetchFromAPIS,
  getProductsSales,
  skimHO,
  deleteDuplicateProducts,
  runBackgroundImport,
  // Admin helper to force a CSV import on demand
  reimportCsv: async (req, res) => {
    try {
      const { url, dateRangeText } = req.query;
      if (!url) return res.status(400).json({ error: 'Missing csv url' });
      const token = await getAccessToken();
      // Directly invoke the background import logic without polling
      await readFile(url, token);
      res.json({ message: 'CSV reimport triggered', url });
    } catch (err) {
      logger.error('reimportCsv error: %o', err);
      res.status(500).json({ error: err.message });
    }
  },
  updateSaleCount,
  fetchMissingProduct,
  fetchSalesReport,
  fetchBrandReport,
  fetchBrandReportHourWise,
  createProduct,
  deleteProduct,
  updateProduct,
  instantSyncFromSaleOrders,
  resetAndSyncUniwareSkus,
};



