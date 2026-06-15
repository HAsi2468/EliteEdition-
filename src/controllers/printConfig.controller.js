const httpStatus = require('http-status').default;
const db = require('../db/models');
const logger = require('../config/logger');

// Helper to ensure config exists
const getConfig = async () => {
  let config = await db.PrintConfig.findOne({ isConfig: true });
  if (!config) {
    config = await db.PrintConfig.create({
      isConfig: true,
      categories: ['Cotton', 'Polyester', 'Silk'],
      passes: ['1 Pass', '2 Pass'],
      parties: ['Wholesale'],
      widths: ['44 inch', '58 inch']
    });
  }
  return config;
};

const getPrintConfig = async (req, res) => {
  try {
    const config = await getConfig();
    res.status(httpStatus.OK).send(config);
  } catch (error) {
    logger.error('Error getting print config: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error fetching config');
  }
};

const updatePrintConfig = async (req, res) => {
  try {
    const { action, field, value } = req.body;
    
    if (!action || !field || !value) {
      return res.status(httpStatus.BAD_REQUEST).send('Missing action, field, or value');
    }

    const validFields = ['categories', 'passes', 'parties', 'widths', 'fabrics'];
    if (!validFields.includes(field)) {
      return res.status(httpStatus.BAD_REQUEST).send('Invalid field');
    }

    let config = await getConfig();

    if (action === 'add') {
      if (!config[field].includes(value)) {
        config[field].push(value);
      }
    } else if (action === 'remove') {
      config[field] = config[field].filter(item => item !== value);
    } else {
      return res.status(httpStatus.BAD_REQUEST).send('Invalid action (use add or remove)');
    }

    await config.save();
    res.status(httpStatus.OK).send(config);

  } catch (error) {
    logger.error('Error updating print config: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error updating config');
  }
};

module.exports = {
  getPrintConfig,
  updatePrintConfig,
};
