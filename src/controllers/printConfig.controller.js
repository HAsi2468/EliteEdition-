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
    const { action, field, value, machineName } = req.body;
    
    if (!action || !field || !value) {
      return res.status(httpStatus.BAD_REQUEST).send('Missing action, field, or value');
    }

    const validFields = ['categories', 'passes', 'parties', 'widths', 'fabrics', 'designers', 'billToOptions', 'shipToOptions', 'machines', 'machine_profile'];
    if (!validFields.includes(field)) {
      return res.status(httpStatus.BAD_REQUEST).send('Invalid field');
    }

    let config = await getConfig();

    if (field === 'machines') {
      if (action === 'add') {
        const exists = config.machines.find(m => m.name === value);
        if (!exists) config.machines.push({ name: value, profiles: [] });
      } else if (action === 'remove') {
        config.machines = config.machines.filter(m => m.name !== value);
      }
    } else if (field === 'machine_profile') {
      if (!machineName) return res.status(httpStatus.BAD_REQUEST).send('Missing machineName');
      const machine = config.machines.find(m => m.name === machineName);
      if (!machine) return res.status(httpStatus.BAD_REQUEST).send('Machine not found');
      
      if (action === 'add') {
        if (!machine.profiles.includes(value)) machine.profiles.push(value);
      } else if (action === 'remove') {
        machine.profiles = machine.profiles.filter(p => p !== value);
      }
    } else {
      if (!config[field]) config[field] = [];
      
      if (action === 'add') {
        if (!config[field].includes(value)) config[field].push(value);
      } else if (action === 'remove') {
        config[field] = config[field].filter(item => item !== value);
      } else {
        return res.status(httpStatus.BAD_REQUEST).send('Invalid action (use add or remove)');
      }
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
