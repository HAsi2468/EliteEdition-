const config = require('../config/config');
const logger = require('../config/logger');
const { getSalseListFromDB } = require('../services/salesList.service');
const db = require('../db/models');
const { readFileFromUrl } = require('../services/api.service');
const { convertKeysV2 } = require('../utils/dataParser');

const buildWhereClause = (query) => {
  logger.info('Fetching sales orders...');
  const {
    dateStart,
    endDate,
    category,
    shippingAddressCity,
    shippingAddressState,
    itemSKUCode,
    itemTypeColor,
    itemTypeSize,
    mrp,
    totalPrice,
    facility,
    itemTypeBrand,
    discount,
    saleOrderStatus,
    shippingAddressPincode,
  } = query;
  const whereClause = {};

  const addLikeCondition = (field, value) => {
    if (value) {
      if (value.includes(',')) {
        whereClause[field] = {
          $in: value.split(',').map((v) => v.trim()),
        };
      } else {
        whereClause[field] = new RegExp(`^${value}`, 'i');
      }
    }
  };

  const addExactCondition = (field, value) => {
    if (value) {
      if (value.includes(',')) {
        whereClause[field] = {
          $in: value.split(',').map((v) => v.trim()),
        };
      } else {
        whereClause[field] = value;
      }
    }
  };

  if (dateStart && endDate) {
    const dateStartObj = new Date(dateStart);
    const dateEndObj = new Date(endDate);
    const startOfDay = new Date(dateStartObj.setHours(0, 59, 0, 0));
    const endOfDay = new Date(dateEndObj.setHours(23, 59, 59, 999));
    whereClause.orderDate = {
      $gte: startOfDay,
      $lte: endOfDay,
    };
  }

  addLikeCondition('itemSKUCode', itemSKUCode);
  addExactCondition('category', category);
  addExactCondition('shippingAddressCity', shippingAddressCity);
  addExactCondition('shippingAddressState', shippingAddressState);
  addExactCondition('itemTypeColor', itemTypeColor);
  addExactCondition('itemTypeSize', itemTypeSize);
  addExactCondition('facility', facility);
  addExactCondition('itemTypeBrand', itemTypeBrand);
  addExactCondition('shippingAddressPincode', shippingAddressPincode);
  addExactCondition('mrp', mrp);
  addExactCondition('totalPrice', totalPrice);
  addExactCondition('discount', discount);
  addExactCondition('saleOrderStatus', saleOrderStatus);
  logger.info('Sales orders filtered.');

  return whereClause;
};

const getSalseList = async (req, res) => {
  try {
    logger.info('Fetching sales order list...');
    const { page: defaultPage, limit: defaultLimit } = config.pagination;
    const {
      page = defaultPage,
      limit = defaultLimit,
      sortField,
      sortOrder,
    } = req.query;
    const whereClause = buildWhereClause(req.query);
    const data = await getSalseListFromDB(
      page,
      limit,
      sortField,
      sortOrder,
      whereClause
    );
    res.send(data);
  } catch (error) {
    logger.debug('getSalseList ~ error: %o', error);
    res.send(error);
  }
};

const saveCsvData = async (req, res) => {
  try {
    logger.info('Processing CSV data...');
    const formattedData = await readFileFromUrl(
      'https://unicommerce-export.s3.amazonaws.com/sunshinetrends/69e10616cb1c3875b7797c6a/Sale%20Orders_16042026212512.csv',
      ''
    );
    const ff2 = convertKeysV2(formattedData);
    await Promise.all(
      ff2.map(async (data) => {
        try {
          await db.SalesList.create(data);
        } catch (error) {
          logger.debug('saveCsvData ~ error: %o', error);
        }
      })
    );
    res.send('Done');
  } catch (error) {
    res.send(error);
  }
};

const dropTable = async (req, res) => {
  try {
    const result = await db.SalesList.deleteMany({});
    res.send({ status: 'DONE', result });
  } catch (error) {
    res.send(error);
  }
};

module.exports = {
  getSalseList,
  saveCsvData,
  dropTable,
};
