const httpStatus = require('http-status').default;
const db = require('../db/models');
const logger = require('../config/logger');

// Helper to ensure config exists in stitching_configs collection
const getStitchingConfigDocument = async () => {
  let config = await db.StitchingConfig.findOne({ isConfig: true });
  if (!config) {
    config = await db.StitchingConfig.create({
      isConfig: true,
      categories: ['SUIT', 'KURTI', 'DUPATTA', 'TOP', 'BOTTOM', 'LEHENGA', 'STITCHING SET', 'KIDS', 'ETHNIC'],
      labels: ['Elite Edition', 'Private Label', 'Custom Brand'],
      finishingOptions: ['Standard Finishing', 'Iron & Pack', 'Overlock', 'Embroidery Finish', 'Premium Box'],
      parties: ['Wholesale Party', 'Direct Client', 'Retailer'],
      billToOptions: [],
      shipToOptions: [],
      deliveryOptions: ['Party Delivery', 'Self Pickup', 'Courier / Cargo'],
      startingJobNo: 1001,
      startingChallanNo: 1
    });
  } else {
    let changed = false;
    if (!config.categories || config.categories.length === 0) {
      config.categories = ['SUIT', 'KURTI', 'DUPATTA', 'TOP', 'BOTTOM', 'LEHENGA', 'STITCHING SET', 'KIDS', 'ETHNIC'];
      changed = true;
    }
    if (!config.labels || config.labels.length === 0) {
      config.labels = ['Elite Edition', 'Private Label', 'Custom Brand'];
      changed = true;
    }
    if (!config.finishingOptions || config.finishingOptions.length === 0) {
      config.finishingOptions = ['Standard Finishing', 'Iron & Pack', 'Overlock', 'Embroidery Finish', 'Premium Box'];
      changed = true;
    }
    if (!config.parties || config.parties.length === 0) {
      config.parties = ['Wholesale Party', 'Direct Client', 'Retailer'];
      changed = true;
    }
    if (!config.vendors || config.vendors.length === 0) {
      config.vendors = ['Stitching Contractor A', 'Fabric Supplier B', 'Embroidery Job Worker'];
      changed = true;
    }
    if (!config.deliveryOptions || config.deliveryOptions.length === 0) {
      config.deliveryOptions = ['Party Delivery', 'Self Pickup', 'Courier / Cargo'];
      changed = true;
    }
    if (changed) {
      await config.save();
    }
  }
  return config;
};

const getStitchingConfig = async (req, res) => {
  try {
    const config = await getStitchingConfigDocument();
    res.status(httpStatus.OK).send(config);
  } catch (error) {
    logger.error('Error getting stitching config: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error fetching stitching config');
  }
};

const updateStitchingConfig = async (req, res) => {
  try {
    const { action, field, value } = req.body;
    let config = await getStitchingConfigDocument();

    if (!action || !field || value === undefined) {
      return res.status(httpStatus.BAD_REQUEST).send('Missing action, field, or value');
    }

    const validFields = [
      'categories', 'labels', 'finishingOptions', 'parties', 'vendors', 'billToOptions',
      'shipToOptions', 'deliveryOptions', 'startingJobNo', 'startingChallanNo', 'notes'
    ];

    if (!validFields.includes(field)) {
      return res.status(httpStatus.BAD_REQUEST).send('Invalid field for Stitching config');
    }

    if (field === 'startingJobNo' || field === 'startingChallanNo') {
      config[field] = Number(value) || 1;
    } else if (field === 'notes') {
      config.notes = value;
    } else {
      if (!config[field]) config[field] = [];
      const valStr = String(value).trim();

      if (action === 'add') {
        if (!config[field].includes(valStr)) {
          config[field].push(valStr);
        }
      } else if (action === 'remove') {
        config[field] = config[field].filter(item => item !== valStr);
      } else {
        return res.status(httpStatus.BAD_REQUEST).send('Invalid action (use add or remove)');
      }
    }

    await config.save();
    res.status(httpStatus.OK).send(config);

  } catch (error) {
    logger.error('Error updating stitching config: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error updating stitching config');
  }
};

module.exports = {
  getStitchingConfig,
  updateStitchingConfig,
};
