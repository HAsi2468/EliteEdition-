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
      paperTypes: ['A++', 'A+', 'A'],
      rawMaterials: ['A++', 'A+', 'A', 'Grando Ink', 'Printdot Ink'],
      sublimationPanna: ['44', '60', '64'],
      sublimationQualities: ['70 GSM', '80 GSM', '90 GSM'],
      butterPanna: ['44', '60'],
      inkColors: ['C', 'M', 'Y', 'K', 'C.S.'],
      inkCanSizes: ['1 Ltr', '5 Ltr', '10 Ltr']
    });
    if (!config.paperTypes || config.paperTypes.length === 0 || config.paperTypes.includes('Sublimation Paper')) {
      config.paperTypes = ['A++', 'A+', 'A'];
      changed = true;
    }
    if (!config.rawMaterials || config.rawMaterials.length === 0) {
      config.rawMaterials = ['A++', 'A+', 'A', 'Grando Ink', 'Printdot Ink'];
      changed = true;
    }
    if (!config.sublimationPanna || config.sublimationPanna.length === 0) {
      config.sublimationPanna = ['44', '60', '64'];
      changed = true;
    }
    if (!config.sublimationQualities || config.sublimationQualities.length === 0) {
      config.sublimationQualities = ['70 GSM', '80 GSM', '90 GSM'];
      changed = true;
    }
    if (!config.butterPanna || config.butterPanna.length === 0) {
      config.butterPanna = ['44', '60'];
      changed = true;
    }
    if (!config.inkColors || config.inkColors.length === 0) {
      config.inkColors = ['C', 'M', 'Y', 'K', 'C.S.'];
      changed = true;
    }
    if (!config.inkCanSizes || config.inkCanSizes.length === 0) {
      config.inkCanSizes = ['1 Ltr', '5 Ltr', '10 Ltr'];
      changed = true;
    }
    if (!config.stitchingCategories || config.stitchingCategories.length === 0) {
      config.stitchingCategories = ['SUIT', 'KURTI', 'DUPATTA', 'TOP', 'BOTTOM', 'LEHENGA', 'STITCHING SET', 'KIDS', 'ETHNIC'];
      changed = true;
    }
    if (!config.stitchingLabels || config.stitchingLabels.length === 0) {
      config.stitchingLabels = ['Elite Edition', 'Private Label', 'Custom Brand'];
      changed = true;
    }
    if (!config.finishingOptions || config.finishingOptions.length === 0) {
      config.finishingOptions = ['Standard Finishing', 'Iron & Pack', 'Overlock', 'Embroidery Finish', 'Premium Box'];
      changed = true;
    }
    if (!config.stitchingParties || config.stitchingParties.length === 0) {
      config.stitchingParties = ['Wholesale Party', 'Direct Client', 'Retailer'];
      changed = true;
    }
    if (!config.stitchingDeliveryBy || config.stitchingDeliveryBy.length === 0) {
      config.stitchingDeliveryBy = ['Party Delivery', 'Self Pickup', 'Courier / Cargo'];
      changed = true;
    }
    if (!config.expenseInCategories || config.expenseInCategories.length === 0) {
      config.expenseInCategories = ['Petty Cash Top-up', 'Client Payment / Advance', 'Scrap / Waste Sale', 'Refund / Cashback', 'Other Receipt'];
      changed = true;
    }
    if (!config.expenseOutCategories || config.expenseOutCategories.length === 0) {
      config.expenseOutCategories = ['Machine Maintenance & Service', 'Ink & Consumables', 'Spare Parts & Repairs', 'Paper & Transfer Film', 'Tea & Refreshments', 'Carriage & Freight', 'Salary / Daily Wages', 'Electricity & Utility', 'Stationery & Office', 'Other Expense'];
      changed = true;
    }
    if (!config.expensePaymentModes || config.expensePaymentModes.length === 0) {
      config.expensePaymentModes = ['Cash', 'UPI / GPay / PhonePe', 'Bank Transfer (NEFT/RTGS)', 'Cheque', 'Credit / Debit Card', 'Other'];
      changed = true;
    }
    if (changed) {
      await config.save();
    }
  }
  return config;
};

const getPrintConfig = async (req, res) => {
  try {
    const config = await getConfig();

    // Fetch all users with screen access to auto-populate operators list
    let autoUsers = [];
    try {
      const usersWithAccess = await db.user.find({
        $or: [
          { role: 'admin' },
          { permissions: { $in: ['jobcards_printing_log', 'jobcards', 'jobcards_list', 'stitching_jobcards'] } }
        ]
      }, { name: 1, email: 1 }).lean();

      autoUsers = usersWithAccess.map(u => (u.name || '').trim()).filter(Boolean);
    } catch (err) {
      logger.warn('Failed to fetch auto users for operators: %o', err);
    }

    const mergedOperators = Array.from(new Set([
      ...(config.operators || []),
      ...autoUsers
    ]));

    const result = config.toObject ? config.toObject() : { ...config };
    result.operators = mergedOperators;
    result.autoScreenUsers = autoUsers;

    if (config.complaintSubCategories) {
      if (config.complaintSubCategories instanceof Map) {
        result.complaintSubCategories = Object.fromEntries(config.complaintSubCategories);
      } else if (typeof config.complaintSubCategories === 'object') {
        result.complaintSubCategories = config.complaintSubCategories;
      }
    }

    res.status(httpStatus.OK).send(result);
  } catch (error) {
    logger.error('Error getting print config: %o', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send('Error fetching config');
  }
};

const updatePrintConfig = async (req, res) => {
  try {
    const { action, field, value, machineName, categoryName, companyData } = req.body;
    
    let config = await getConfig();

    if (action === 'set_company') {
      if (companyData) {
        if (companyData.companyName !== undefined) config.companyName = companyData.companyName;
        if (companyData.companyGstin !== undefined) config.companyGstin = companyData.companyGstin;
        if (companyData.companyAddress !== undefined) config.companyAddress = companyData.companyAddress;
        if (companyData.companyPhone !== undefined) config.companyPhone = companyData.companyPhone;
        if (companyData.companyEmail !== undefined) config.companyEmail = companyData.companyEmail;
        if (companyData.companyBankName !== undefined) config.companyBankName = companyData.companyBankName;
        if (companyData.companyAccountNo !== undefined) config.companyAccountNo = companyData.companyAccountNo;
        if (companyData.companyIfscCode !== undefined) config.companyIfscCode = companyData.companyIfscCode;
        if (companyData.companyTerms !== undefined) config.companyTerms = companyData.companyTerms;
        if (companyData.paymentDueDays !== undefined) config.paymentDueDays = Number(companyData.paymentDueDays) || 30;
        if (companyData.startingInvoiceNo !== undefined) config.startingInvoiceNo = Number(companyData.startingInvoiceNo) || 1001;
        if (companyData.invoicePrefix !== undefined) config.invoicePrefix = companyData.invoicePrefix || 'EDP-INV-';

        await config.save();
        return res.status(httpStatus.OK).send(config);
      }
    }

    if (!action || !field || value === undefined) {
      return res.status(httpStatus.BAD_REQUEST).send('Missing action, field, or value');
    }

    const validFields = [
      'categories', 'passes', 'parties', 'widths', 'fabrics', 'designers', 'operators',
      'complaintCategories', 'complaint_subcategory',
      'paperTypes', 'billToOptions', 'shipToOptions', 'machines',
      'machine_profile', 'temperatures', 'speeds', 'startingJobNo', 'rawMaterials',
      'sublimationPanna', 'sublimationQualities', 'butterPanna', 'inkColors', 'inkCanSizes',
      'deliveryOptions', 'lotPartyMap', 'companyName', 'companyGstin', 'companyAddress',
      'companyPhone', 'companyEmail', 'companyBankName', 'companyAccountNo', 'companyIfscCode', 'companyTerms',
      'paymentDueDays', 'startingInvoiceNo', 'invoicePrefix',
      'stitchingCategories', 'stitchingLabels', 'finishingOptions', 'stitchingParties', 'stitchingBillTo', 'stitchingShipTo', 'stitchingDeliveryBy',
      'expenseInCategories', 'expenseOutCategories', 'expensePaymentModes'
    ];
    if (!validFields.includes(field)) {
      return res.status(httpStatus.BAD_REQUEST).send('Invalid field');
    }

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
    } else if (field === 'complaint_subcategory') {
      if (!categoryName) return res.status(httpStatus.BAD_REQUEST).send('Missing categoryName');
      if (!config.complaintSubCategories) config.complaintSubCategories = new Map();

      let currentSubList = config.complaintSubCategories.get(categoryName) || [];
      if (action === 'add') {
        if (!currentSubList.includes(value)) {
          currentSubList.push(value);
          config.complaintSubCategories.set(categoryName, currentSubList);
        }
      } else if (action === 'remove') {
        currentSubList = currentSubList.filter(p => p !== value);
        config.complaintSubCategories.set(categoryName, currentSubList);
      }
    } else if (field === 'startingJobNo') {
      config.startingJobNo = Number(value) || 1;
    } else if (field === 'startingInvoiceNo') {
      config.startingInvoiceNo = Number(value) || 1001;
    } else if (field === 'paymentDueDays') {
      config.paymentDueDays = Number(value) || 30;
    } else if (field === 'invoicePrefix') {
      config.invoicePrefix = value;
    } else if (field.startsWith('company')) {
      config[field] = value;
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
