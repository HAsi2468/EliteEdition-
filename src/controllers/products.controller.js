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

const getOrders = async (
  page = 1,
  pageSize = 10,
  sortField,
  sortOrder,
  dateRange,
  skuCode = null,
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

    if (skuCode) {
      const skuArray = skuCode.split(',').map((code) => code.trim());
      whereClause.skuCode = { $in: skuArray };
    }
    if (filters) {
      Object.keys(filters).forEach((filterKey) => {
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

    const products = await db.Product.find(whereClause)
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
  } = req.query;

  try {
    const allData = await getOrders(page, limit, sortField, sortOrder, {
      start: dateStart,
      end: dateEnd,
    });
    res.send(allData);
  } catch (error) {
    res.status(500).send({ message: 'somtheng went wrong' });
  }
};

const readFile = async (url, accesstoken) => {
  const bgStartTime = Date.now();
  logger.info('[⏱️] Starting background CSV download and DB import...');
  logger.debug('readFile ~ url: %s', url);

  // Fetch and format the data
  const formattedData = await readFileFromUrl(url, accesstoken);
  logger.info(`Fetched ${formattedData ? formattedData.length : 0} items from CSV.`);

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
    logger.info(`SaleOrders to insert in this chunk: ${orderCodes.slice(0, 5).join(', ')}${orderCodes.length > 5 ? `... (+${orderCodes.length - 5} more)` : ''}`);
    const res = await db.SaleOrder.insertMany(chunk);
    totalSaleOrdersStored += (res ? res.length : chunk.length);
  }
  logger.info(`📊 Database Status: Stored/Inserted ${totalSaleOrdersStored} documents into db.SaleOrder.`);

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
    const res = await db.SalesList.bulkWrite(operations);
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
    const operations = chunk.map((item) => ({
      updateOne: {
        filter: { skuCode: item.skuCode },
        update: { $set: item },
        upsert: true,
      },
    }));
    const res = await db.Product.bulkWrite(operations);
    totalProductsStored += (res ? res.upsertedCount + res.modifiedCount : chunk.length);
    if (res) {
      logger.info(`📝 Product Chunk Result: ${res.upsertedCount} newly added (upserted), ${res.modifiedCount} updated (modified)`);
    }
  }
  logger.info(`📊 Database Status: Stored/Upserted ${totalProductsStored} documents into db.Product.`);

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

    const jobResult = await createExportJob(accessToken);
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

// Sales report
const buildWhereClause = (query) => {
  const { dateStart, dateEnd, searchCode } = query;
  const whereClause = {};

  if (dateStart) {
    const dateStartObj = new Date(dateStart);
    const dateEndObj = dateEnd ? new Date(dateEnd) : new Date(dateStart);
    const startOfDay = new Date(dateStartObj.setHours(0, 59, 0, 0));
    const endOfDay = new Date(dateEndObj.setHours(23, 59, 59, 999));
    whereClause.orderDate = {
      $gte: startOfDay,
      $lte: endOfDay,
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
      productMap[plainOrder[field].split('_')[0]] || null;
    return plainOrder;
  });
};

const fetchSalesReport = async (req, res) => {
  try {
    const whereClause = buildWhereClause(req.query);
    const salesReport = await fetchSalesReportData(whereClause);
    const modeSku = !!whereClause.itemSKUCode;
    const field = modeSku ? 'skuName' : 'itemSKUCode';
    const productMap = await fetchProductImages(
      salesReport.map((order) => order[field].split('_')[0])
    );
    const enhancedSalesData = enhanceSalesDataWithImages(
      salesReport,
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
  
  console.log(`[Background] Starting product fetch for ${missingSKUs.length} SKUs...`);
  const allProductsMap = new Map();
  
  // To get orderDate, we can query the order associated with the SKU
  const salesOrders = await db.SaleOrder.find({ itemSKUCode: { $in: missingSKUs } }, { itemSKUCode: 1, orderDate: 1 }).lean();
  
  for (const skuCode of missingSKUs) {
    try {
      // Fire Search Item(s) API with body { productCode: "ItemSKUCode" }
      const { elements } = await fetchProductData(skuCode, accessToken);
      if (elements && elements.length > 0) {
        const productInfo = elements[0];
        
        // Find associated orderDate if possible
        const foundOrder = salesOrders.find(o => o.itemSKUCode === skuCode);
        productInfo.orderDate = foundOrder ? foundOrder.orderDate : new Date();
        
        allProductsMap.set(skuCode, productInfo);
        console.log(`[Background] Successfully fetched details for SKU: ${skuCode}`);
        
        // 1. Update matching sale_orders
        const saleOrderUpdate = {};
        if (productInfo.name) saleOrderUpdate.itemTypeName = productInfo.name;
        if (productInfo.color) saleOrderUpdate.itemTypeColor = productInfo.color;
        if (productInfo.size) saleOrderUpdate.itemTypeSize = productInfo.size;
        if (productInfo.brand) saleOrderUpdate.itemTypeBrand = productInfo.brand;
        if (productInfo.price !== undefined && productInfo.price !== null) {
          saleOrderUpdate.mrp = String(productInfo.price);
        }
        if (productInfo.weight !== undefined && productInfo.weight !== null) {
          saleOrderUpdate.weight = String(productInfo.weight);
        }
        
        if (Object.keys(saleOrderUpdate).length > 0) {
          const resSO = await db.SaleOrder.updateMany({ itemSKUCode: skuCode }, { $set: saleOrderUpdate });
          console.log(`[Background] Updated ${resSO.modifiedCount} sale_orders for SKU: ${skuCode}`);
        }
        
        // 2. Update matching salesList
        const salesListUpdate = {};
        if (productInfo.color) salesListUpdate.itemTypeColor = productInfo.color;
        if (productInfo.brand) salesListUpdate.itemTypeBrand = productInfo.brand;
        if (productInfo.size) salesListUpdate.itemTypeSize = productInfo.size;
        if (productInfo.imageUrl) salesListUpdate.productImage = productInfo.imageUrl;
        if (productInfo.price !== undefined && productInfo.price !== null) {
          salesListUpdate.mrp = String(productInfo.price);
        }
        
        if (Object.keys(salesListUpdate).length > 0) {
          const resSL = await db.SalesList.updateMany({ itemSKUCode: skuCode }, { $set: salesListUpdate });
          console.log(`[Background] Updated ${resSL.modifiedCount} salesList entries for SKU: ${skuCode}`);
        }
      } else {
        console.warn(`[Background] No product elements found for SKU: ${skuCode}`);
      }
    } catch (err) {
      console.error(`[Background] Failed to fetch product details for SKU: ${skuCode}`, err.message);
    }
  }
  
  if (allProductsMap.size === 0) {
    console.log('[Background] No new products retrieved to store.');
    return;
  }
  
  const transformedProducts = transformProducts(Array.from(allProductsMap.values()));
  const productChunks = splitData(transformedProducts, CHUNK_SIZE);
  
  let totalAdded = 0;
  for (const [index, chunk] of productChunks.entries()) {
    console.log(`[Background] Inserting chunk ${index + 1}/${productChunks.length}`);
    const operations = chunk.map((item) => {
      const { size, color, ...rest } = item;
      const updateDoc = { $set: rest };
      
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
          filter: { skuCode: item.skuCode },
          update: updateDoc,
          upsert: true,
        },
      };
    });
    const result = await db.Product.bulkWrite(operations);
    totalAdded += result.upsertedCount + result.modifiedCount;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  console.log(`[Background] DB Import Complete! Added/Updated ${totalAdded} products.`);
};

async function fetchMissingProduct(req, res) {
  try {
    let missingSKUs = [];
    const querySKU = req.query.itemSKUCode || req.body.itemSKUCode;
    
    if (querySKU) {
      // If a specific SKU code is requested, always fetch and update it to keep it fresh
      missingSKUs = [querySKU];
    } else {
      // Fallback: Scan database for missing SKUs or sizes
      console.log('Scanning database for missing SKUs...');
      const salesOrders = await db.SaleOrder.find({}, { itemSKUCode: 1 }).lean();
      const products = await db.Product.find({}, { skuCode: 1, size: 1 }).lean();
      
      const productMap = new Map();
      products.forEach((p) => {
        productMap.set(p.skuCode, p.size || []);
      });
      
      const missingSet = new Set();
      for (const order of salesOrders) {
        if (!order.itemSKUCode) continue;
        const parts = order.itemSKUCode.split('_');
        const baseSku = parts[0];
        const variation = parts[1];
        
        const existingSizes = productMap.get(baseSku);
        if (!existingSizes) {
          missingSet.add(order.itemSKUCode);
        } else if (variation && !existingSizes.includes(variation)) {
          missingSet.add(order.itemSKUCode);
        }
      }
      missingSKUs = Array.from(missingSet);
    }
    
    console.log(`Missing SKUs to fetch:`, missingSKUs);
    
    if (missingSKUs.length === 0) {
      return res.json({
        message: 'No missing products found or specified product variation already exists.',
        totalMissing: 0,
        expectedTimeSeconds: 0
      });
    }
    
    // Calculate expected time: each Unicommerce SKU fetch takes ~0.4s
    const expectedTimeSeconds = Math.ceil(missingSKUs.length * 0.4);
    
    // Retrieve access token to pass to the background function
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return res.status(500).json({ error: 'Failed to retrieve access token from Unicommerce.' });
    }
    
    // Launch the background process
    runBackgroundImport(missingSKUs, accessToken).catch((err) => {
      console.error('Error in background missing product import:', err);
    });
    
    // Respond immediately with the expected duration!
    return res.json({
      message: 'Background fetch started.',
      totalMissing: missingSKUs.length,
      missingSKUs,
      expectedTimeSeconds,
    });
  } catch (error) {
    logger.error('Error in fetchMissingProduct: %o', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = {
  getAllProductsList,
  fetchFromAPIS,
  getProductsSales,
  deletaAllProduct,
  searchBySku,
  fetchSalesReport,
  skimHO,
  deleteDuplicateProducts,
  updateSaleCount,
  fetchMissingProduct,
};
